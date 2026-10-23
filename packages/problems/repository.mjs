import {randomUUID} from 'node:crypto';
import {hash,stableId,sortedUnique,requireThat,DomainError} from './contracts.mjs';
import {createEvidenceRepository} from '../intelligence/evidence-repository.mjs';
import {memoized} from '../metrics/ledger-load.mjs';
import {evidenceRuns,evidenceCurrent} from '../metrics/evidence-memo.mjs';
const uuid=x=>typeof x==='string'&&/^[a-f0-9-]{36}$/i.test(x);
const one=async(s,q,a)=>(await s.query(q,a)).rows[0];
const scoped=s=>({transaction:async(_,work)=>work(s)});
export const evidence=async(s,id)=>{const e=await createEvidenceRepository({database:scoped(s)}).get(id);requireThat(e.state==='current'&&e.status==='succeeded','source_unavailable',409);return e;};
// Mismo veredicto que antes (cada miembro con su corrida y evidencia utilizable, el primero que falle decide) pero por LOTE: una consulta de membresías y una verificación de evidencia por lote (antes ~6 sentencias por miembro).
async function accessible(s,p){const ids=p.embeddingIds,rows=ids.length?(await s.query('SELECT embedding_id,extraction_run_id FROM public.problem_embedding_members WHERE tenant_id=$1 AND embedding_id=ANY($2::uuid[])',[s.tenantId,ids])).rows:[],runOf=new Map();for(const r of rows)if(!runOf.has(r.embedding_id))runOf.set(r.embedding_id,r.extraction_run_id);for(const id of ids)requireThat(runOf.has(id),'source_unavailable');await evidenceRuns(s,[...new Set(runOf.values())]);for(const id of ids)await evidenceCurrent(s,runOf.get(id));return p;}
/** Corridas utilizables según el veredicto «resumen» (ver list): Set de ids. Sin texto de evidencia; todas las consultas filtran por tenant_id=$1. */
const UUID_RE="'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'";
// Memoizado por (transacción, conjunto de corridas): el catálogo, las señales críticas y el resto de vistas de UNA petición piden el mismo veredicto; dentro de una memoSection se calcula una sola vez
// (≈6.5 s en frío para 8,761 corridas). Fuera de una sección (memoized sin memo) se calcula siempre. Nada cruza transacciones.
const usableRunsSummary=(s,runIds)=>memoized(s,'usable-runs-summary:'+[...runIds].sort().join(','),()=>usableRunsSummaryUncached(s,runIds));
// Tope por sentencia: la acción de lectura trae 10 s y las verificaciones de evidencia del catálogo son costosas EN FRÍO (resumen: 8,761 corridas, 6.5–9 s; completa con redacted_text: ~13 s) y a veces
// las cancelaba y tumbaba la vista (503). Se sube SOLO para esa lectura acotada y se restaura; un tope deliberadamente menor del llamador (p. ej. señales críticas, 1.5 s) NO se amplía.
const VERIFY_TIMEOUT_MS=45000;
async function withVerifyTimeout(s,work){
 const current=Number((await s.query("SELECT setting FROM pg_settings WHERE name='statement_timeout'")).rows[0]?.setting??0);
 if(current>0&&current<10000)return work();
 const previous=(await s.query("SELECT current_setting('statement_timeout') AS v")).rows[0].v;
 await s.query("SELECT set_config('statement_timeout',$1,true)",[String(VERIFY_TIMEOUT_MS)]);
 try{return await work();}
 finally{await s.query("SELECT set_config('statement_timeout',$1,true)",[previous]).catch(()=>{});}
}
async function usableRunsSummaryUncached(s,runIds){return withVerifyTimeout(s,()=>usableRunsSummaryBody(s,runIds));}
async function usableRunsSummaryBody(s,runIds){
 if(!runIds.length)return new Set();
 // Manifiestos expandidos en un solo recorrido (no una subconsulta por corrida): por corrida cuántas entradas de su manifiesto siguen íntegras.
 const rows=(await s.query(`WITH sel AS MATERIALIZED (SELECT r.id,r.conversation_id,r.provenance->'input_manifest' AS manifest FROM public.extraction_runs r
   WHERE r.tenant_id=$1 AND r.id=ANY($2::uuid[]) AND r.status='succeeded' AND jsonb_typeof(r.provenance->'input_manifest')='array' AND jsonb_array_length(r.provenance->'input_manifest') BETWEEN 1 AND 500),
  ent AS MATERIALIZED (SELECT sel.id,sel.conversation_id,jsonb_array_length(sel.manifest) AS total,CASE WHEN x->>'message_revision_id' ~* ${UUID_RE} THEN (x->>'message_revision_id')::uuid END AS mrid,CASE WHEN x->>'original_revision_id' ~* ${UUID_RE} THEN (x->>'original_revision_id')::uuid END AS oid,x->>'hash' AS hash FROM sel CROSS JOIN LATERAL jsonb_array_elements(sel.manifest) x),
  ok AS MATERIALIZED (SELECT ent.id,ent.conversation_id FROM ent
   JOIN public.message_revisions mr ON mr.tenant_id=$1 AND mr.id=ent.mrid AND mr.deleted_at IS NULL AND mr.redaction_version IS NOT NULL AND mr.hash=ent.hash AND mr.provenance->>'original_revision_id'=ent.oid::text
   JOIN public.messages m ON m.tenant_id=$1 AND m.id=mr.message_id AND m.deleted_at IS NULL
   JOIN public.message_revisions o ON o.tenant_id=$1 AND o.id=ent.oid AND o.deleted_at IS NULL
   GROUP BY ent.id,ent.conversation_id,ent.total HAVING count(*)=ent.total)
  SELECT ok.id,c.id AS conversation_id,c.connection_id,c.external_id FROM ok
  JOIN public.conversations c ON c.tenant_id=$1 AND c.id=ok.conversation_id AND c.deleted_at IS NULL
  JOIN public.connections n ON n.tenant_id=$1 AND n.id=c.connection_id AND n.status='active'
  JOIN public.source_heads h ON h.tenant_id=$1 AND h.id=c.id AND h.state IN ('unique','selected','ambiguous')
  WHERE NOT EXISTS(SELECT 1 FROM public.tombstones t WHERE t.tenant_id=$1 AND (t.connection_id IS NULL OR t.connection_id=c.connection_id) AND t.deleted_source_key IN (c.id::text,c.external_id))`,[s.tenantId,runIds])).rows;
 const distinct=new Map();for(const r of rows){const k=r.connection_id+'|'+r.external_id;if(!distinct.has(k))distinct.set(k,{i:distinct.size,connection_id:r.connection_id,kind:'conversation',external_id:r.external_id});}
 const deleted=new Set();
 if(distinct.size)for(const r of (await s.query('SELECT x.i FROM jsonb_to_recordset($2::jsonb) AS x(i int,connection_id uuid,kind text,external_id text) WHERE public.retention_source_deleted($1,x.connection_id,x.kind,x.external_id)',[s.tenantId,JSON.stringify([...distinct.values()])])).rows)deleted.add(r.i);
 return new Set(rows.filter(r=>!deleted.has(distinct.get(r.connection_id+'|'+r.external_id).i)).map(r=>r.id));
}
const expected=e=>['EVIDENCE_UNAVAILABLE','source_unavailable'].includes(e.message);
const projection=r=>({...r.provenance.snapshot,id:r.problem_id,version:r.version});
const latest=async(s,id)=>{const r=await one(s,"SELECT * FROM public.problem_versions WHERE tenant_id=$1 AND problem_id=$2 AND provenance->>'kind'='vector-problem-v1' ORDER BY version DESC LIMIT 1",[s.tenantId,id]);requireThat(r,'problem_not_found',404);return projection(r);};
export async function snapshot(s,p,event){
 const prev=await one(s,'SELECT id,version FROM public.problem_versions WHERE tenant_id=$1 AND problem_id=$2 ORDER BY version DESC LIMIT 1',[s.tenantId,p.id]);
 p={...p,version:(prev?.version??0)+1};
 await s.query('INSERT INTO public.problem_versions(id,tenant_id,problem_id,previous_version_id,version,title,rationale,change_kind,provenance) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[randomUUID(),s.tenantId,p.id,prev?.id??null,p.version,p.label,event.reason??'Agrupación por vectores',event.operation??(prev?'edit':'create'),JSON.stringify({kind:'vector-problem-v1',snapshot:p,actorId:s.userId,...event})]);return p;
}
export function createProblemRepository({database}){
 // Preserve only our own domain failures after the platform has rolled back.
 // Driver errors and untrusted status/code fields retain the platform sanitizer.
 const underlying=database;
 database={transaction:async(action,work)=>{let domainError;try{return await underlying.transaction(action,async scope=>{try{return await work(scope);}catch(error){if(error instanceof DomainError)domainError=error;throw error;}});}catch(error){if(domainError)throw domainError;throw error;}}};
 const read=work=>database.transaction('read',work);
 return Object.freeze({
 // verification='full' (por omisión): verificación COMPLETA fail-closed de la evidencia de cada miembro (lo que usan prioridades, historia y exportaciones).
 // verification='summary' (vista «Gestionar problemas»): NO carga texto de evidencia; comprueba por SQL agregado (una consulta por tipo de dato, mismo tenant) que cada miembro
 // tenga una corrida succeeded, conversación vigente y conexión activa, manifiesto completo con revisiones y mensajes no borrados y hash igual al del manifiesto, y sin lápida/retención de la conversación.
 // NO recalcula sha256 del texto, input_hash, validación de la extracción ni lápidas de mensajes: eso se verifica al abrir el problema (detail) y en las exportaciones.
 // only (opcional): ids de problemas a listar; el resto del catálogo NO se lee ni se verifica (detalle de UN problema, recomendación). Mismo veredicto por problema que sin filtro.
 async list({verification='full',only=null}={}){requireThat(verification==='full'||verification==='summary'||verification==='none','input_invalid',400);requireThat(only===null||Array.isArray(only)&&only.every(uuid),'input_invalid',400);return read(async s=>{const ps=(await s.query("SELECT DISTINCT ON(problem_id) * FROM public.problem_versions WHERE tenant_id=$1 AND provenance->>'kind'='vector-problem-v1' AND ($2::uuid[] IS NULL OR problem_id=ANY($2::uuid[])) ORDER BY problem_id,version DESC",[s.tenantId,only])).rows.map(projection);
  // verification='none': solo el catálogo vigente (sin membresías ni evidencia). Quien lo usa DEBE verificar lo que muestre (p. ej. la página visible) antes de exponerlo; el Explorador lo hace con la verificación completa fail-closed.
  if(verification==='none')return ps;
  // Mismo veredicto que accessible() por problema, con UNA consulta de membresías y la evidencia de las corridas distintas verificada por lote.
  const wanted=[...new Set(ps.flatMap(p=>p.embeddingIds??[]))],runOf=new Map();
  if(wanted.length)for(const m of (await s.query('SELECT embedding_id,extraction_run_id FROM public.problem_embedding_members WHERE tenant_id=$1 AND embedding_id=ANY($2::uuid[])',[s.tenantId,wanted])).rows)if(!runOf.has(m.embedding_id))runOf.set(m.embedding_id,m.extraction_run_id);
  const runs=[...new Set(runOf.values())];
  let usable;
  if(verification==='summary'){const ok=await usableRunsSummary(s,runs);usable=run=>ok.has(run);}
  else{const loaded=await withVerifyTimeout(s,()=>createEvidenceRepository({database:scoped(s)}).getMany(runs));usable=run=>{const e=loaded.get(run);return !!e&&e.state==='current'&&e.status==='succeeded';};}
  return ps.filter(p=>p.embeddingIds.every(id=>runOf.has(id)&&usable(runOf.get(id))));});},
 async detail({problemId}){requireThat(uuid(problemId),'input_invalid',400);return read(async s=>({...await accessible(s,await latest(s,problemId)),history:(await s.query('SELECT id,version,provenance FROM public.problem_versions WHERE tenant_id=$1 AND problem_id=$2 ORDER BY version DESC',[s.tenantId,problemId])).rows}));},
 async sources(){return read(async s=>{const rows=(await s.query("SELECT id,conversation_id,created_at FROM public.extraction_runs WHERE tenant_id=$1 AND status='succeeded' ORDER BY created_at DESC LIMIT 100",[s.tenantId])).rows;
  // Misma verificación fail-closed que evidence() por corrida, pero por lote (antes ~7 consultas por corrida, 100 corridas).
  const loaded=await createEvidenceRepository({database:scoped(s)}).getMany(rows.map(r=>r.id));
  return rows.filter(r=>{const e=loaded.get(r.id);return !!e&&e.state==='current'&&e.status==='succeeded';}).map(r=>({id:r.id,conversationId:r.conversation_id,createdAt:r.created_at}));});},
 async jobs(){return read(async s=>(await s.query('SELECT j.id,j.state,j.provenance,j.created_at,r.extraction_run_id FROM public.jobs j JOIN public.problem_embedding_requests r ON r.tenant_id=j.tenant_id AND r.job_id=j.id WHERE j.tenant_id=$1 AND (r.actor_id=$2 OR $3) ORDER BY j.created_at DESC LIMIT 100',[s.tenantId,s.userId,s.role==='owner'])).rows.map(r=>({id:r.id,state:r.state,reason:r.provenance?.reason??null,createdAt:r.created_at,extractionRunId:r.extraction_run_id})));},
 async submit({extractionRunId,requestKey,configHash}){requireThat(uuid(extractionRunId)&&uuid(requestKey)&&/^[a-f0-9]{64}$/.test(configHash),'input_invalid',400);return database.transaction('import',async s=>{
 await s.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[s.tenantId+':problem-submit:'+s.userId+requestKey]);
 const prior=await one(s,'SELECT * FROM public.problem_embedding_requests WHERE tenant_id=$1 AND actor_id=$2 AND request_key=$3',[s.tenantId,s.userId,requestKey]);
 if(prior){requireThat(prior.extraction_run_id===extractionRunId&&prior.config_hash===configHash,'request_conflict');const j=await one(s,'SELECT * FROM public.jobs WHERE tenant_id=$1 AND id=$2',[s.tenantId,prior.job_id]);return {id:j.id,state:j.state,reason:j.provenance?.reason??null,createdAt:j.created_at,extractionRunId};}
 await evidence(s,extractionRunId);const id=randomUUID();const j=await one(s,"INSERT INTO public.jobs(id,tenant_id,type,input_ref,input_hash,version,max_attempts) VALUES($1,$2,'embedding',$3,$4,'problem-v1',1) RETURNING *",[id,s.tenantId,'extraction:'+extractionRunId,hash({actor:s.userId,requestKey,extractionRunId,configHash})]);
 await s.query('INSERT INTO public.problem_embedding_requests(tenant_id,job_id,extraction_run_id,actor_id,request_key,config_hash) VALUES($1,$2,$3,$4,$5,$6)',[s.tenantId,id,extractionRunId,s.userId,requestKey,configHash]);return {id,state:j.state,reason:null,createdAt:j.created_at,extractionRunId};});},
 async retrieve({embeddingId,limit=10}){requireThat(uuid(embeddingId)&&Number.isInteger(limit)&&limit>0&&limit<=50,'input_invalid',400);return read(async s=>{
 const q=await one(s,'SELECT e.*,m.extraction_run_id FROM public.embeddings e JOIN public.problem_embedding_members m ON m.tenant_id=e.tenant_id AND m.embedding_id=e.id WHERE e.tenant_id=$1 AND e.id=$2',[s.tenantId,embeddingId]);requireThat(q,'embedding_not_found',404);await evidence(s,q.extraction_run_id);
 const candidates=(await s.query('SELECT DISTINCT extraction_run_id FROM public.problem_embedding_members WHERE tenant_id=$1',[s.tenantId])).rows.map(r=>r.extraction_run_id),loaded=await createEvidenceRepository({database:scoped(s)}).getMany(candidates);
 const allowed=candidates.filter(id=>{const e=loaded.get(id);return !!e&&e.state==='current'&&e.status==='succeeded';});
 return (await s.query('SELECT e.id AS "embeddingId",m.problem_id AS "problemId",(e.embedding OPERATOR(extensions.<=>) $2::extensions.vector) AS distance FROM public.embeddings e JOIN public.problem_embedding_members m ON m.tenant_id=e.tenant_id AND m.embedding_id=e.id WHERE e.tenant_id=$1 AND e.model_id=$3 AND e.dim=$4 AND e.version=$5 AND m.extraction_run_id=ANY($6::uuid[]) ORDER BY distance,e.id LIMIT $7',[s.tenantId,q.embedding,q.model_id,q.dim,q.version,allowed,limit])).rows;});},
 async restructure({operation,parents,children,reason,approved}){requireThat(['split','merge'].includes(operation)&&approved===true&&typeof reason==='string'&&reason.trim()&&reason.length<=2000&&Array.isArray(parents)&&Array.isArray(children),'input_invalid',400);requireThat(operation==='split'?parents.length===1&&children.length>=2:parents.length>=2&&children.length===1,'shape_invalid',400);return database.transaction('configure',async s=>{
 requireThat(s.role==='owner','role_forbidden',403);await s.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[s.tenantId+':vector-problems']);const ps=[];for(const parent of parents){const p=await accessible(s,await latest(s,parent.problemId));requireThat(p.version===parent.expectedVersion&&p.state==='active','stale_version');ps.push(p);}requireThat(new Set(ps.map(p=>p.id)).size===ps.length,'duplicate_parent',400);
 requireThat(ps.every(p=>p.modelId===ps[0].modelId&&p.dimensions===ps[0].dimensions&&p.embeddingVersion===ps[0].embeddingVersion),'embedding_space_mismatch');
 const before=sortedUnique(ps.flatMap(p=>p.embeddingIds)),after=children.flatMap(c=>c.embeddingIds??[]);requireThat(after.length===before.length&&sortedUnique(after).length===after.length&&JSON.stringify(sortedUnique(after))===JSON.stringify(before),'partition_invalid',400);
 const severityRows=(await s.query('SELECT severity FROM public.problems WHERE tenant_id=$1 AND id=ANY($2::uuid[])',[s.tenantId,ps.map(p=>p.id)])).rows;const severity=['critical','high','medium','low'].find(level=>severityRows.some(p=>p.severity===level));requireThat(severity,'problem_severity_missing');
 const result=[];for(let i=0;i<children.length;i++){const child=children[i];requireThat(typeof child.label==='string'&&child.label.trim()&&child.label.length<=500&&child.embeddingIds.length,'child_invalid',400);const id=stableId({tenant:s.tenantId,operation,parents,child:i});await s.query("INSERT INTO public.problems(id,tenant_id,title,provenance,severity,cause_status) VALUES($1,$2,$3,$4,$5,'unknown')",[id,s.tenantId,child.label,JSON.stringify({kind:'vector-problem-v1'}),severity]);await s.query('UPDATE public.problem_embedding_members SET problem_id=$3 WHERE tenant_id=$1 AND embedding_id=ANY($2::uuid[])',[s.tenantId,child.embeddingIds,id]);const rows=(await s.query('SELECT DISTINCT m.conversation_id,c.order_id FROM public.problem_embedding_members m JOIN public.conversations c ON c.tenant_id=m.tenant_id AND c.id=m.conversation_id WHERE m.tenant_id=$1 AND m.problem_id=$2',[s.tenantId,id])).rows;result.push(await snapshot(s,{...ps[0],id,label:child.label,state:'active',outlier:child.embeddingIds.length===1,embeddingIds:sortedUnique(child.embeddingIds),conversationIds:rows.map(x=>x.conversation_id).sort(),orderIds:sortedUnique(rows.map(x=>x.order_id).filter(Boolean))},{operation,reason,parents}));}
 for(const p of ps){await snapshot(s,{...p,state:'retired'},{operation,reason,children:result.map(x=>x.id)});await s.query('UPDATE public.problems SET archived_at=clock_timestamp() WHERE tenant_id=$1 AND id=$2',[s.tenantId,p.id]);}return result;});}
 });
}
