// Núcleo de la etapa "embeddings -> problemas" de IA a escala. Funciones PURAS (sin red, sin base) salvo cargarCohorte/leerVectores (lectura de archivos locales).
// Reproduce las invariantes del worker oficial packages/problems/runtime.mjs SIN pasar por la cola de jobs:
//  - una fila por mensaje citado (revisión redactada), con la mayor severidad (empate: gana la primera cita); severidad 'unknown' no entra (problems.severity no la admite);
//  - ids deterministas con stableId (misma fórmula del runtime): embedding = stableId({tenant,revision,model,version}); problema = stableId({tenant,embedding:<fundador>});
//  - asignación voraz por vecino más cercano (distancia coseno = operador <=> de pgvector), desempate por id de embedding, `distancia <= umbral` => se une; si no, funda un problema;
//  - título y severidad del problema = categoría y severidad del fundador (igual que el runtime); outlier = problema de un solo miembro;
//  - snapshot problem_versions con provenance.kind='vector-problem-v1' (único que leen las vistas).
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import {sha256} from '../../intelligence/index.mjs';
import {stableId} from '../../problems/contracts.mjs';
import {selectCandidates,buildPersistence} from '../persistir.mjs';
import {configHash,DEFAULT_MODEL,loadOrLearnBoilerplate} from '../cohorte.mjs';
import {TENANT,PROJECT_REF} from '../sql.mjs';

export {TENANT,PROJECT_REF};
export const EMBED_MODEL='openai/text-embedding-3-small';
export const EMBED_DIM=1536;
export const SOURCE='ia-escala-problemas-v1';
export const HARD_CAP_USD=0.20;          // tope fijo de gasto de esta etapa (libro propio)
export const EMBED_USD_PER_TOKEN=2e-8;   // text-embedding-3-small vía OpenRouter (models-snapshot.json)
export const MODES=Object.freeze(['mensaje','quote']);
export const defaultVersion=mode=>mode==='quote'?'ia-escala-quote-v1':'ia-escala-msg-v1';
const SEV=['unknown','low','medium','high','critical'];
const OK_SEV=['low','medium','high','critical'];
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;

export const embeddingId=({tenant,revision,model=EMBED_MODEL,version})=>stableId({tenant,revision,model,version});
export const problemIdFor=({tenant,embedding})=>stableId({tenant,embedding});
export const lit=v=>v===null||v===undefined?'null':"'"+String(v).replace(/'/g,"''")+"'";
export const readJsonl=f=>fs.readFileSync(f,'utf8').split('\n').filter(Boolean).map(l=>JSON.parse(l));
export const f32ToB64=v=>Buffer.from(new Float32Array(v).buffer).toString('base64');
export const b64ToF32=s=>{const b=Buffer.from(s,'base64');if(b.length%4!==0)throw Error('vector base64 inválido');return new Float32Array(b.buffer.slice(b.byteOffset,b.byteOffset+b.length));};

// ------------------------------------------------------------------ carga de la cohorte (misma selección que persistir.mjs)
export function cargarCohorte({resultsFile,inputFiles,taxonomy,max=Infinity,excluir=new Set(),tenant=TENANT}){
  const convs=new Map(inputFiles.filter(f=>fs.existsSync(f)).flatMap(readJsonl).map(c=>[c.conversation_id,c]));
  const dir=path.dirname(resultsFile);
  const boilerplate=loadOrLearnBoilerplate(dir,[],{cfg:configHash({model:DEFAULT_MODEL,provider:'azure',taxonomy}),window:null,allowLearn:false});
  const items=[],bad=[];
  for(const [cid,recs] of selectCandidates(readJsonl(resultsFile),convs)){
    if(items.length>=max)break;
    if(excluir.has(cid))continue;
    let built=null,lastErr=null;
    for(const r of recs){try{built=buildPersistence({conv:convs.get(cid),rec:r,taxonomy,boilerplate,tenant});break;}catch(e){lastErr=e;}}
    if(built)items.push(built);else bad.push(lastErr?.message??'sin candidato');
  }
  return{items,bad};
}

// ------------------------------------------------------------------ filas candidatas
// Una fila por mensaje citado. mode='mensaje': texto = mensaje redactado completo (el que ya embebió cohorte.mjs, costo 0).
// mode='quote': texto = cita de la evidencia ganadora (idéntico al worker oficial).
export function construirFilas(items,{mode='mensaje',tenant=TENANT,model=EMBED_MODEL,version=defaultVersion(mode),cap=32}={}){
  if(!MODES.includes(mode))throw Error('modo inválido');
  const rows=[];let descartadasSeveridad=0,textoInvalido=0;
  for(const p of items){
    if(p.status!=='succeeded')continue; // las abstenciones no tienen issues; el repositorio oficial exige 'succeeded'
    const rev=new Map(p.revs.map(r=>[r.message_revision_id,r]));
    const best=new Map();
    for(const issue of p.data.issues)for(const ev of issue.evidence){
      const prior=best.get(ev.message_revision_id);
      if(!prior||SEV.indexOf(issue.severity)>SEV.indexOf(prior.severity))best.set(ev.message_revision_id,{label:issue.category,severity:issue.severity,quote:ev.quote});
    }
    const cands=[...best].map(([rid,b])=>({rid,prepId:rev.get(rid)?.message_id,...b,message:rev.get(rid)?.text}));
    descartadasSeveridad+=cands.filter(c=>!OK_SEV.includes(c.severity)).length;
    const kept=cands.filter(c=>OK_SEV.includes(c.severity)&&c.prepId).sort((a,b)=>a.prepId<b.prepId?-1:1).slice(0,cap).sort((a,b)=>a.rid<b.rid?-1:1);
    for(const c of kept){
      const text=mode==='quote'?c.quote:c.message;
      if(typeof text!=='string'||!text.length||text.includes('\u0000')){textoInvalido++;continue;}
      rows.push({taskKey:p.taskKey,conversationId:p.conversationId,runId:p.runId,rid:c.rid,prepId:c.prepId,label:c.label,severity:c.severity,text,textHash:sha256(text),
        id:embeddingId({tenant,revision:c.rid,model,version}),vec:null});
    }
  }
  return{rows,descartadasSeveridad,textoInvalido};
}

// ------------------------------------------------------------------ vectores en disco (embeddings.jsonl de cohorte + embeddings-problemas.jsonl de esta etapa)
export async function leerVectores(files,{mode='mensaje',needed}){
  const map=new Map(); // `${task_key}|${message_id}` -> {vec,textHash|null}
  for(const f of files){
    if(!fs.existsSync(f))continue;
    const rl=readline.createInterface({input:fs.createReadStream(f),crlfDelay:Infinity});
    for await(const line of rl){
      if(!line)continue;let o;try{o=JSON.parse(line);}catch{continue;}
      const m=o.mode??'mensaje';if(m!==mode||o.dim!==EMBED_DIM||o.model!==EMBED_MODEL||typeof o.vec_f32_b64!=='string')continue;
      const key=o.task_key+'|'+o.message_id;if(needed&&!needed.has(key))continue;
      const vec=b64ToF32(o.vec_f32_b64);if(vec.length!==EMBED_DIM)continue;
      map.set(key,{vec,textHash:o.text_hash??null});
    }
  }
  return map;
}
export function adjuntarVectores(rows,vecs,{mode}){
  let sinVector=0,obsoletos=0;
  for(const r of rows){
    const v=vecs.get(r.taskKey+'|'+r.prepId);
    if(!v){sinVector++;continue;}
    if(v.textHash&&v.textHash!==r.textHash){obsoletos++;continue;} // el texto cambió desde que se embebió
    let n=0;for(let i=0;i<v.vec.length;i++){if(!Number.isFinite(v.vec[i]))n=NaN;n+=v.vec[i]*v.vec[i];}
    if(!(n>0)){sinVector++;continue;}
    r.vec=v.vec;
  }
  return{sinVector,obsoletos};
}

// ------------------------------------------------------------------ agrupación voraz (equivalente a la consulta <=> del runtime)
const normalizar=rows=>{const d=EMBED_DIM,M=new Float32Array(rows.length*d);rows.forEach((r,k)=>{let n=0;for(let i=0;i<d;i++)n+=r.vec[i]*r.vec[i];n=Math.sqrt(n);for(let i=0;i<d;i++)M[k*d+i]=r.vec[i]/n;});return M;};
const dot=(M,a,b,d)=>{let s0=0,s1=0,s2=0,s3=0;const oa=a*d,ob=b*d;for(let i=0;i<d;i+=4){s0+=M[oa+i]*M[ob+i];s1+=M[oa+i+1]*M[ob+i+1];s2+=M[oa+i+2]*M[ob+i+2];s3+=M[oa+i+3]*M[ob+i+3];}return s0+s1+s2+s3;};
// rows con vec (orden de procesamiento = orden del arreglo). Devuelve {asig:[{problemId,distance,founder}],problemas:Map}
export function agrupar(rows,{threshold,tenant=TENANT,onProgress=null}){
  if(!(Number.isFinite(threshold)&&threshold>=0&&threshold<1))throw Error('umbral inválido (0 <= umbral < 1, distancia coseno)');
  const n=rows.length,d=EMBED_DIM,M=normalizar(rows),asig=new Array(n),problemas=new Map();
  for(let i=0;i<n;i++){
    let best=-1,bestDot=-Infinity;
    for(let j=0;j<i;j++){const s=dot(M,i,j,d);if(s>bestDot||s===bestDot&&best>=0&&rows[j].id<rows[best].id){bestDot=s;best=j;}}
    const dist=best>=0?1-bestDot:null;
    if(best>=0&&dist<=threshold){asig[i]={problemId:asig[best].problemId,distance:dist,founder:false};}
    else{const pid=problemIdFor({tenant,embedding:rows[i].id});asig[i]={problemId:pid,distance:dist,founder:true};problemas.set(pid,{id:pid,title:rows[i].label,severity:rows[i].severity,founderEmbedding:rows[i].id});}
    if(onProgress&&i%1000===0)onProgress(i,n);
  }
  return{asig,problemas};
}
export function resumenAgrupacion(rows,{asig,problemas}){
  const size=new Map();asig.forEach(a=>size.set(a.problemId,(size.get(a.problemId)??0)+1));
  const sizes=[...size.values()].sort((a,b)=>a-b);const q=p=>sizes.length?sizes[Math.min(sizes.length-1,Math.floor(p*sizes.length))]:0;
  return{filas:rows.length,problemas:problemas.size,outliers:sizes.filter(s=>s===1).length,tamano:{p50:q(.5),p90:q(.9),max:sizes.at(-1)??0},
    pctEnProblemasDeMasDe1:rows.length?+(100*sizes.filter(s=>s>1).reduce((a,b)=>a+b,0)/rows.length).toFixed(1):0};
}
// Calibración del umbral: distribución de la distancia al vecino previo más cercano y nº de problemas por umbral candidato. Sin texto.
export function calibrar(rows,{muestra=4000,umbrales=[0.10,0.15,0.20,0.25,0.30,0.35,0.40,0.50],tenant=TENANT}={}){
  const sel=rows.length>muestra?[...rows].sort((a,b)=>sha256('cal|'+a.id)<sha256('cal|'+b.id)?-1:1).slice(0,muestra):rows;
  const n=sel.length,d=EMBED_DIM,M=normalizar(sel);const nn=[];
  for(let i=1;i<n;i++){let b=-Infinity;for(let j=0;j<i;j++){const s=dot(M,i,j,d);if(s>b)b=s;}nn.push(1-b);}
  nn.sort((a,b)=>a-b);const q=p=>nn.length?+nn[Math.min(nn.length-1,Math.floor(p*nn.length))].toFixed(4):null;
  const porUmbral=umbrales.map(t=>({umbral:t,...resumenAgrupacion(sel,agrupar(sel,{threshold:t,tenant}))}));
  return{muestra:n,distancia_vecino_previo:{p05:q(.05),p25:q(.25),p50:q(.5),p75:q(.75),p95:q(.95)},por_umbral:porUmbral,nota:'Muestra determinista; sobre la cohorte completa los problemas serán más y los outliers menos.'};
}

// ------------------------------------------------------------------ SQL (solo INSERT; idempotente)
export const ALLOWED=/^(begin|commit|rollback|do \$g\$|select set_config|insert into public\.(problems|embeddings|problem_embedding_members|problem_versions)\b|with mem as)/;
export const FORBIDDEN=/\b(update|delete|drop|alter|truncate|grant|revoke|create|copy)\b/i;
export const onlyAllowedStatements=stmts=>stmts.every(s=>ALLOWED.test(s.trim())&&!FORBIDDEN.test(s.replace(/'(?:[^']|'')*'/g,"''")));
const vecLit=v=>'['+Array.from(v,x=>String(Number(x.toPrecision(9)))).join(',')+']';
const vals=rows=>rows.map(r=>'('+r.map(lit).join(',')+')').join(',\n');
const arrUuid=a=>`array[${a.map(lit).join(',')}]::uuid[]`;

// Sentencias de un lote de miembros. items: filas {…, problemId, founder} de un grupo de conversaciones.
export function sentenciasMiembros(filas,{tenant=TENANT,model=EMBED_MODEL,version,vectorType='extensions.vector',threshold}){
  const T=lit(tenant)+'::uuid',out=[];
  const runs=[...new Set(filas.map(f=>f.runId))];
  out.push('begin;');
  out.push(`do $g$ begin
 if not exists (select 1 from public.organizations where id=${T}) then raise exception 'tenant inesperado'; end if;
 if (select count(*) from public.extraction_runs where tenant_id=${T} and status='succeeded' and id=any(${arrUuid(runs)}))<>${runs.length} then raise exception 'faltan corridas extraction_runs succeeded: ejecute persistir.mjs primero (o excluya esas conversaciones)'; end if;
 if exists (select 1 from public.problem_embedding_members m join (values ${filas.map(f=>`(${lit(f.id)},${lit(f.problemId)})`).join(',')}) v(e,p) on m.embedding_id=v.e::uuid where m.tenant_id=${T} and m.problem_id<>v.p::uuid) then raise exception 'asignación previa distinta: el catálogo ya tiene miembros con otro problema (corrida incremental no soportada)'; end if;
end $g$;`);
  out.push(`insert into public.embeddings(id,tenant_id,model_id,dim,version,content,embedding,message_revision_id,provenance)
select v.id::uuid,${T},${lit(model)},${EMBED_DIM},${lit(version)},v.content,v.emb::${vectorType},v.rid::uuid,jsonb_build_object('source',${lit(SOURCE)},'extractionRunId',v.run,'kind','vector-problem-v1')
from (values
${vals(filas.map(f=>[f.id,f.rid,f.text,vecLit(f.vec),f.runId]))}) v(id,rid,content,emb,run)
where exists (select 1 from public.message_revisions r where r.tenant_id=${T} and r.id=v.rid::uuid) on conflict do nothing;`);
  const fundadores=filas.filter(f=>f.founder);
  if(fundadores.length)out.push(`insert into public.problems(id,tenant_id,title,provenance,severity,cause_status)
select v.id::uuid,${T},v.title,jsonb_build_object('kind','vector-problem-v1','source',${lit(SOURCE)},'threshold',${Number(threshold)},'embeddingVersion',${lit(version)}),v.sev,'unknown'
from (values
${vals(fundadores.map(f=>[f.problemId,f.label,f.severity,f.id]))}) v(id,title,sev,founder)
where exists (select 1 from public.embeddings e where e.tenant_id=${T} and e.id=v.founder::uuid) on conflict (id) do nothing;`);
  out.push(`insert into public.problem_embedding_members(tenant_id,embedding_id,problem_id,extraction_run_id,conversation_id)
select ${T},v.e::uuid,v.p::uuid,v.run::uuid,v.c::uuid
from (values
${vals(filas.map(f=>[f.id,f.problemId,f.runId,f.conversationId]))}) v(e,p,run,c)
where exists (select 1 from public.embeddings e where e.tenant_id=${T} and e.id=v.e::uuid) and exists (select 1 from public.problems p where p.tenant_id=${T} and p.id=v.p::uuid) on conflict do nothing;`);
  return out;
}

// Snapshots problem_versions (lo único que leen repository.list/detail, metrics/exposure y workspace-service). Se calcula DESDE LA BASE
// (miembros reales), por lo que es acumulativo y no duplica: no inserta si ya existe una versión con el mismo hash de miembros.
// El trigger problem_snapshot_guard exige problem_write_authorized => contexto de OWNER 'configure' (el mismo camino de restructure()).
export function sentenciasVersiones(problemIds,{tenant=TENANT,model=EMBED_MODEL,version}){
  const T=lit(tenant)+'::uuid',out=['begin;'];
  out.push(`do $g$ begin
 if not exists (select 1 from public.memberships where tenant_id=${T} and role='owner' and status='active') then raise exception 'el tenant no tiene owner activo'; end if;
end $g$;`);
  out.push(`select set_config('vexa.tenant_id',${lit(tenant)},true),set_config('vexa.action','configure',true),set_config('request.jwt.claim.sub',o.u::text,true),set_config('request.jwt.claims',json_build_object('sub',o.u)::text,true)
from (select user_id as u from public.memberships where tenant_id=${T} and role='owner' and status='active' order by created_at,user_id limit 1) o;`);
  for(const pid of problemIds){
    const P=lit(pid)+'::uuid';
    out.push(`with mem as (select m.embedding_id::text as e,m.conversation_id::text as c,c2.order_id::text as o from public.problem_embedding_members m join public.conversations c2 on c2.tenant_id=m.tenant_id and c2.id=m.conversation_id where m.tenant_id=${T} and m.problem_id=${P}),
a as (select (select count(*) from mem) as n,
 (select coalesce(jsonb_agg(e order by e collate "C"),'[]'::jsonb) from mem) as ids,
 (select coalesce(jsonb_agg(c order by c collate "C"),'[]'::jsonb) from (select distinct c from mem) z) as cs,
 (select coalesce(jsonb_agg(o order by o collate "C"),'[]'::jsonb) from (select distinct o from mem where o is not null) z) as os)
insert into public.problem_versions(tenant_id,problem_id,previous_version_id,version,title,rationale,change_kind,provenance)
select ${T},p.id,prev.id,coalesce(prev.version,0)+1,p.title,'Agrupación por vectores',case when prev.id is null then 'create' else 'edit' end,
 jsonb_build_object('kind','vector-problem-v1','source',${lit(SOURCE)},'actorId',current_setting('request.jwt.claim.sub',true),'snapshot',
  jsonb_build_object('id',p.id,'label',p.title,'state','active','outlier',a.n=1,'modelId',${lit(model)},'dimensions',${EMBED_DIM},'embeddingVersion',${lit(version)},
   'embeddingIds',a.ids,'conversationIds',a.cs,'orderIds',a.os,'version',coalesce(prev.version,0)+1,'memberHash',md5(a.ids::text)))
from public.problems p cross join a
left join lateral (select id,version from public.problem_versions v where v.tenant_id=${T} and v.problem_id=p.id order by v.version desc limit 1) prev on true
where p.tenant_id=${T} and p.id=${P} and a.n>0
and not exists (select 1 from public.problem_versions w where w.tenant_id=${T} and w.problem_id=p.id and w.provenance->>'kind'='vector-problem-v1' and w.provenance->'snapshot'->>'memberHash'=md5(a.ids::text));`);
  }
  return out;
}

// ------------------------------------------------------------------ SELECT de verificación (solo conteos y títulos de taxonomía; sin texto de clientes)
export function verificacionSql({tenant=TENANT,version}){
  const T=`'${tenant}'::uuid`,V=version?`'${String(version).replace(/'/g,"''")}'`:'null';
  return `-- SOLO LECTURA. Conteos; ningún texto de clientes. Tenant ${tenant}. Pegar en MCP execute_sql (proyecto proyecto-ejemplo) o supabase db query --linked -f.
-- 1. Resumen del catálogo creado por esta etapa
select (select count(*) from public.embeddings where tenant_id=${T} and provenance->>'source'='${SOURCE}') as embeddings,
 (select count(*) from public.problems where tenant_id=${T} and provenance->>'source'='${SOURCE}') as problemas,
 (select count(*) from public.problem_embedding_members m join public.embeddings e on e.tenant_id=m.tenant_id and e.id=m.embedding_id where m.tenant_id=${T} and e.provenance->>'source'='${SOURCE}') as miembros,
 (select count(distinct problem_id) from public.problem_versions where tenant_id=${T} and provenance->>'source'='${SOURCE}') as problemas_con_version,
 (select count(*) from public.problem_versions where tenant_id=${T} and provenance->>'source'='${SOURCE}') as versiones;
-- 2. Huérfanos / incoherencias (todo debe ser 0)
select (select count(*) from public.problems p where p.tenant_id=${T} and p.provenance->>'source'='${SOURCE}' and not exists (select 1 from public.problem_embedding_members m where m.tenant_id=p.tenant_id and m.problem_id=p.id)) as problemas_sin_miembros,
 (select count(*) from public.problems p where p.tenant_id=${T} and p.provenance->>'source'='${SOURCE}' and not exists (select 1 from public.problem_versions v where v.tenant_id=p.tenant_id and v.problem_id=p.id and v.provenance->>'kind'='vector-problem-v1')) as problemas_sin_version,
 (select count(*) from public.embeddings e where e.tenant_id=${T} and e.provenance->>'source'='${SOURCE}' and not exists (select 1 from public.problem_embedding_members m where m.tenant_id=e.tenant_id and m.embedding_id=e.id)) as embeddings_sin_miembro,
 (select count(*) from public.problem_embedding_members m join public.extraction_runs r on r.tenant_id=m.tenant_id and r.id=m.extraction_run_id where m.tenant_id=${T} and r.status<>'succeeded') as miembros_de_corrida_no_succeeded,
 (select count(*) from public.embeddings e where e.tenant_id=${T} and e.provenance->>'source'='${SOURCE}' and (e.dim<>${EMBED_DIM} or e.model_id<>'${EMBED_MODEL}')) as embeddings_espacio_distinto,
 (select count(*) from (select distinct on (problem_id) problem_id,provenance from public.problem_versions where tenant_id=${T} and provenance->>'kind'='vector-problem-v1' order by problem_id,version desc) lv
   where jsonb_array_length(lv.provenance->'snapshot'->'embeddingIds')<>(select count(*) from public.problem_embedding_members m where m.tenant_id=${T} and m.problem_id=lv.problem_id)) as ultimo_snapshot_no_coincide_con_miembros;
-- 3. Aislamiento: nada de esta etapa fuera del tenant (debe ser 0)
select (select count(*) from public.embeddings where tenant_id<>${T} and provenance->>'source'='${SOURCE}') as embeddings_otros_tenants,
 (select count(*) from public.problems where tenant_id<>${T} and provenance->>'source'='${SOURCE}') as problemas_otros_tenants;
-- 4. Lo que haría desaparecer problemas de la vista (evidencia no vigente: conversación borrada, conexión inactiva o cabeza no vigente). Debe ser 0.
select count(*) as miembros_con_evidencia_no_vigente from public.problem_embedding_members m
 join public.conversations c on c.tenant_id=m.tenant_id and c.id=m.conversation_id
 join public.connections n on n.tenant_id=c.tenant_id and n.id=c.connection_id
 left join public.source_heads h on h.tenant_id=c.tenant_id and h.id=c.id
 where m.tenant_id=${T} and (c.deleted_at is not null or n.status<>'active' or h.state is null or h.state not in ('unique','selected','ambiguous'));
-- 5. Forma del catálogo
select case when size=1 then '1 (outlier)' when size<=5 then '2-5' when size<=20 then '6-20' when size<=100 then '21-100' else '>100' end as tamano,count(*) as problemas,sum(size) as miembros
from (select problem_id,count(*) as size from public.problem_embedding_members where tenant_id=${T} group by 1) s group by 1 order by 1;
-- 6. Top 25 problemas (títulos = categorías de la taxonomía)
select p.title,p.severity,count(*) as miembros,count(distinct m.conversation_id) as conversaciones
from public.problems p join public.problem_embedding_members m on m.tenant_id=p.tenant_id and m.problem_id=p.id
where p.tenant_id=${T} and p.provenance->>'source'='${SOURCE}' group by p.id,p.title,p.severity order by miembros desc limit 25;
-- 7. Espacio de embeddings en uso (debe coincidir con VEXA_PROBLEMS_CONFIG_JSON del tenant si se quiere usar el worker oficial luego)
select model_id,dim,version,count(*) from public.embeddings where tenant_id=${T} group by 1,2,3 order by 4 desc;
${V==='null'?'':`-- 8. Versión pedida\nselect count(*) as embeddings_de_la_version from public.embeddings where tenant_id=${T} and version=${V};`}`;
}

// ------------------------------------------------------------------ corridas que NO existen en la base (causa del abort "faltan corridas")
// Causa raíz: agrupar.mjs y persistir.mjs usan la MISMA selección (selectCandidates + buildPersistence sobre resultados.jsonl), pero persistir.mjs
// NO inserta la corrida cuando (a) la conversación ya tenía otra corrida oficial succeeded/abstained con id distinto (NOOFF), (b) ya existía una corrida con el
// mismo input_hash, (c) la conversación no existe/ya no coincide en la base, o (d) el resultado se recuperó DESPUÉS de persistir (pasada `reintentar`).
// agrupar.mjs exige que cada corrida usada exista como 'succeeded'; con --omitir-sin-corrida las conversaciones sin ella se excluyen y se cuentan.
const UUID_G=/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi;
export const preflightSql=(runIds,{tenant=TENANT}={})=>`-- SOLO LECTURA: ids de corridas succeeded que existen (de ${runIds.length} pedidas)
select id from public.extraction_runs where tenant_id=${lit(tenant)}::uuid and status='succeeded' and id=any(array[${runIds.map(lit).join(',')}]::uuid[]);`;
// exec(sql)->stdout (psql, supabase db query...). Formato agnóstico: se extraen los uuid de la salida y se intersectan con los pedidos.
export function preflightCorridas(runIds,{tenant=TENANT,exec}){
  const wanted=new Set(runIds);if(!wanted.size)return new Set();
  const out=exec(preflightSql([...wanted],{tenant}));
  const found=new Set((String(out).match(UUID_G)??[]).map(s=>s.toLowerCase()).filter(s=>wanted.has(s)));
  if(!found.size)throw Error('el preflight no devolvió ninguna corrida succeeded (formato inesperado o persistir no corrió): se aborta en vez de omitir todo');
  return found;
}
export function filtrarSinCorrida(filas,existentes){
  const kept=[],omConv=new Set();let omFilas=0;
  for(const f of filas){if(existentes.has(f.runId))kept.push(f);else{omConv.add(f.conversationId);omFilas++;}}
  return{kept,omitidas:{conversaciones:omConv.size,filas:omFilas,ids:[...omConv].sort()}};
}
// Diagnóstico (solo lectura, solo conteos por categoría): por qué la corrida esperada de cada conversación no es succeeded en la base.
export function diagnosticoSql(items,{tenant=TENANT}={}){
  const T=lit(tenant)+'::uuid';
  const v=items.map(p=>`(${lit(p.conversationId)},${lit(p.runId)},${lit(p.inputHash)},${lit(p.status)})`).join(',\n');
  return `-- SOLO LECTURA. Por cada conversación esperada: ¿existe su corrida? Devuelve conteos por categoría (sin texto).
with esperado(conv,run_id,input_hash,estado_local) as (values
${v}),
x as (select e.*,
 (select r.status from public.extraction_runs r where r.tenant_id=${T} and r.id=e.run_id::uuid) as estado_corrida_esperada,
 exists(select 1 from public.conversations c where c.tenant_id=${T} and c.id=e.conv::uuid) as conversacion_existe,
 (select string_agg(distinct o.status,',') from public.extraction_runs o where o.tenant_id=${T} and o.conversation_id=e.conv::uuid and o.id<>e.run_id::uuid and o.status in ('succeeded','abstained')) as otras_oficiales,
 exists(select 1 from public.extraction_runs h where h.tenant_id=${T} and h.conversation_id=e.conv::uuid and h.input_hash=e.input_hash and h.id<>e.run_id::uuid) as mismo_input_otro_id
 from esperado e)
select case when estado_corrida_esperada='succeeded' then '0 ok: corrida succeeded existe'
 when estado_corrida_esperada is not null then '1 existe pero con estado '||estado_corrida_esperada
 when not conversacion_existe then '2 la conversación no existe en la base'
 when otras_oficiales is not null then '3 sin corrida propia; la conversación tiene otra corrida oficial ('||otras_oficiales||')'
 when mismo_input_otro_id then '4 sin corrida propia; existe una con el mismo input_hash y otro id'
 else '5 sin corrida: persistir no la escribió (¿recuperada después, o descartada?)' end as categoria,
 estado_local,count(*) as conversaciones
from x group by 1,2 order by 1,2;`;
}
