import {sha256,validateExtraction,semanticProfile,validateSemanticBasis} from './index.mjs';
import {identityKey} from '../ingestion/index.mjs';
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
const fail=()=>{throw Object.assign(Error('EVIDENCE_UNAVAILABLE'),{code:'23514'});};
const BATCH=100;
const manifestOk=manifest=>Array.isArray(manifest)&&manifest.length&&manifest.length<=500&&new Set(manifest.map(x=>x?.message_revision_id)).size===manifest.length&&!manifest.some(x=>!uuid(x?.message_revision_id)||!uuid(x?.original_revision_id)||! /^[a-f0-9]{64}$/.test(x?.hash??'')||!['customer','agent','internal'].includes(x?.role));
// Reglas 1-2 (puras): estado de la corrida y manifiesto inmutable.
function checkRun(st){
 const run=st.run;
 if(!run||!['succeeded','abstained'].includes(run.status))fail();
 const manifest=run.provenance.input_manifest;
 if(!manifestOk(manifest))fail();
 st.manifest=manifest;
}
// Regla 3 (pura): conversación y conexión.
function checkConversation(st){
 const c=st.conversation;
 if(!c||c.deleted_at||c.status!=='active'||!['unique','selected','ambiguous'].includes(c.state))fail();
}
// Reglas 4-5 (puras): revisiones almacenadas contra el manifiesto. Deja en `st` las revisiones, identidades y claves de lápida.
function checkStored(tenantId,st){
 const {run,manifest,conversation,stored}=st;
 if(stored.length!==manifest.length||new Set(stored.map(x=>x.id)).size!==stored.length)fail();
 const identities=[];const byId=new Map(stored.map(x=>[x.id,x])),revisions=[],tombstoneKeys=[conversation.id,conversation.external_id];let historical=!['unique','selected'].includes(conversation.state),bytes=0;
 const key=(entityType,externalId)=>{identities.push({kind:entityType,external_id:externalId});const identity=identityKey({tenant_id:tenantId,connection_id:conversation.connection_id,source:conversation.source,source_account_id:conversation.account_id,entity_type:entityType,external_id:externalId});tombstoneKeys.push(identity,sha256(identity));};key('conversation',conversation.external_id);
 for(const input of manifest){
  const r=byId.get(input.message_revision_id),snapshots=r?.snapshot?.filter(x=>x.table==='messages'&&x.row?.id===r.message_id);
  if(!r||!['unique','selected','ambiguous'].includes(r.head_state)||r.deleted_at||r.original_deleted||r.message_deleted||!r.redaction_version||r.original_id!==input.original_revision_id||r.original_message_id!==r.message_id||r.canonical_id!==r.message_id||r.connection_id!==conversation.connection_id||r.source_connection!==conversation.connection_id||snapshots?.length!==1||snapshots[0].row.role!==input.role||snapshots[0].row.conversation_id!==run.conversation_id||typeof r.redacted_text!=='string'||r.hash!==input.hash||sha256(r.redacted_text)!==input.hash)fail();
  bytes+=Buffer.byteLength(r.redacted_text);if(bytes>1000000)fail();
  revisions.push({tenant_id:tenantId,message_revision_id:r.id,role:input.role,text:r.redacted_text});
  if(!['unique','selected'].includes(r.head_state)||r.current_revision!==r.original_id)historical=true;
  tombstoneKeys.push(r.id,r.original_id,r.message_id,r.external_id);key('message',r.external_id);
 }
 Object.assign(st,{identities,revisions,tombstoneKeys,historical});
 delete st.stored;
}
// Reglas 6-10: retención y lápidas ya consultadas; luego semántica, hash de entrada y validación de la extracción.
function finish(tenantId,st){
 const {run,revisions,historical}=st;
 if(st.retentionDeleted||st.tombstoned)fail();
 let semantics;
 if(Object.hasOwn(run.provenance,'semantic_policy_hash')||Object.hasOwn(run.provenance,'semantic_policy')){try{semantics=semanticProfile(run.provenance.semantic_policy,run.provenance.taxonomy);if(semantics.hash!==run.provenance.semantic_policy_hash)fail();}catch{fail();}}
 if(sha256(JSON.stringify({revisions,policyHash:run.provenance.policy_hash,taxonomy:run.provenance.taxonomy,...(semantics?{semanticPolicyHash:semantics.hash}:{})}))!==run.input_hash)fail();
 const result=validateExtraction(run.provenance.result,revisions,{taxonomy:run.provenance.taxonomy,tenantId});if(!result.ok)fail();
 if(semantics&&!validateSemanticBasis(run.provenance.semanticBasis,result.data,revisions,{taxonomy:run.provenance.taxonomy,tenantId,profile:semantics}).ok)fail();
 return {runId:run.id,conversationId:run.conversation_id,state:historical?'historical':'current',status:run.status,model:run.model_id,createdAt:run.created_at,...result.data};
}
const guard=(st,work)=>{if(st.error!==undefined)return;try{work();}catch(e){st.error=e;}};
const live=sts=>sts.filter(st=>st.error===undefined);
/**
 * Pipeline ÚNICO de verificación para una o muchas corridas (uuid ya validados). Mismas reglas y mismo orden semántico que la lectura por corrida;
 * solo cambia que cada consulta cubre a todas las corridas del lote (siempre con tenant_id=$1). Devuelve un estado por corrida: {view} o {error}.
 */
async function evaluate(s,runIds){
 const tenantId=s.tenantId;
 const sts=runIds.map(id=>({id}));
 const runs=new Map((await s.query('SELECT id,status,conversation_id,input_hash,provenance,model_id,created_at FROM public.extraction_runs WHERE tenant_id=$1 AND id=ANY($2::uuid[])',[tenantId,runIds])).rows.map(r=>[r.id,r]));
 for(const st of sts){st.run=runs.get(st.id.toLowerCase());guard(st,()=>checkRun(st));}
 let todo=live(sts);
 if(todo.length){
  const convs=new Map();
  for(const r of (await s.query(`SELECT c.id,c.external_id,c.source,c.connection_id,c.deleted_at,n.account_id,n.status,h.state
    FROM public.conversations c JOIN public.connections n ON n.tenant_id=c.tenant_id AND n.id=c.connection_id
    LEFT JOIN public.source_heads h ON h.tenant_id=c.tenant_id AND h.id=c.id WHERE c.tenant_id=$1 AND c.id=ANY($2::uuid[])`,[tenantId,[...new Set(todo.map(st=>st.run.conversation_id))]])).rows)if(!convs.has(r.id))convs.set(r.id,r);
  for(const st of todo){st.conversation=convs.get(st.run.conversation_id);guard(st,()=>checkConversation(st));}
 }
 todo=live(sts);
 if(todo.length){
  // Constrain joins to the validated immutable manifests before expanding source rows; each run then keeps only the rows its own manifest names.
  const rows=(await s.query(`SELECT r.id,r.message_id,r.redacted_text,r.hash,r.deleted_at,r.redaction_version,r.provenance,
    original.id AS original_id,original.message_id AS original_message_id,original.deleted_at AS original_deleted,
    m.deleted_at AS message_deleted,m.connection_id,m.external_id,
    sr.snapshot,sr.canonical_id,sr.connection_id AS source_connection,
    current_source.message_revision_id AS current_revision,h.state AS head_state
    FROM public.message_revisions r JOIN public.message_revisions original ON original.tenant_id=r.tenant_id AND original.id::text=r.provenance->>'original_revision_id'
    JOIN public.messages m ON m.tenant_id=r.tenant_id AND m.id=r.message_id
    JOIN public.source_revisions sr ON sr.tenant_id=original.tenant_id AND sr.message_revision_id=original.id AND sr.canonical_id=m.id AND sr.entity_type='message'
    LEFT JOIN public.source_heads h ON h.tenant_id=m.tenant_id AND h.id=m.id
    LEFT JOIN public.source_revisions current_source ON current_source.tenant_id=h.tenant_id AND current_source.id=h.selected_revision_id
    WHERE r.tenant_id=$1 AND r.id=ANY($2::uuid[])
    AND original.id=ANY($3::uuid[]) AND sr.message_revision_id=ANY($3::uuid[])`,[tenantId,[...new Set(todo.flatMap(st=>st.manifest.map(x=>x.message_revision_id)))],[...new Set(todo.flatMap(st=>st.manifest.map(x=>x.original_revision_id)))]])).rows;
  const byRevision=new Map();for(const r of rows){let a=byRevision.get(r.id);if(!a)byRevision.set(r.id,a=[]);a.push(r);}
  for(const st of todo){
   const originals=new Set(st.manifest.map(x=>x.original_revision_id.toLowerCase()));
   st.stored=st.manifest.flatMap(x=>(byRevision.get(x.message_revision_id.toLowerCase())??[]).filter(r=>originals.has(r.original_id)));
   guard(st,()=>checkStored(tenantId,st));
  }
 }
 todo=live(sts);
 if(todo.length){
  // Retención: la misma función (mismo tenant $1, mismo rol) sobre cada identidad distinta (conexión, tipo, id externo).
  const distinct=new Map();const idOf=(st,i)=>JSON.stringify([st.conversation.connection_id,i.kind,i.external_id]);
  for(const st of todo)for(const i of st.identities){const k=idOf(st,i);if(!distinct.has(k))distinct.set(k,{i:distinct.size,connection_id:st.conversation.connection_id,kind:i.kind,external_id:i.external_id});}
  const deleted=new Set();
  if(distinct.size)for(const r of (await s.query('SELECT x.i FROM jsonb_to_recordset($2::jsonb) AS x(i int,connection_id uuid,kind text,external_id text) WHERE public.retention_source_deleted($1,x.connection_id,x.kind,x.external_id)',[tenantId,JSON.stringify([...distinct.values()])])).rows)deleted.add(r.i);
  for(const st of todo)st.retentionDeleted=st.identities.some(i=>deleted.has(distinct.get(idOf(st,i)).i));
  // Lápidas: filas del tenant con conexión nula o la de la corrida cuya clave esté entre las claves de esa corrida.
  const keys=[...new Set(todo.flatMap(st=>st.tombstoneKeys))];
  const hits=new Map();
  for(const r of (await s.query('SELECT connection_id,deleted_source_key FROM public.tombstones WHERE tenant_id=$1 AND (connection_id IS NULL OR connection_id=ANY($2::uuid[])) AND deleted_source_key=ANY($3::text[])',[tenantId,[...new Set(todo.map(st=>st.conversation.connection_id))],keys])).rows){let a=hits.get(r.deleted_source_key);if(!a)hits.set(r.deleted_source_key,a=[]);a.push(r.connection_id);}
  for(const st of todo)st.tombstoned=st.tombstoneKeys.some(k=>(hits.get(k)??[]).some(c=>c===null||c===st.conversation.connection_id));
  for(const st of todo)guard(st,()=>{st.view=finish(tenantId,st);});
 }
 return sts;
}
/** Read only the immutable redacted input manifest. Private PII maps are never queried. */
export function createEvidenceRepository({database}={}){
 if(typeof window!=='undefined'||typeof database?.transaction!=='function')fail();
 return Object.freeze({
  async get(runId){
   if(!uuid(runId))fail();
   return database.transaction('read',async s=>{const [st]=await evaluate(s,[runId]);if(st.error!==undefined)throw st.error;return st.view;});
  },
  /**
   * Misma verificación que get() para muchas corridas con pocas consultas (lotes de 100 corridas). Devuelve Map(runId -> evidencia | null).
   * null = no utilizable: fail-closed también ante cualquier error de validación sobre las filas (get() lo propagaría). Los errores de base de datos se propagan.
   */
  async getMany(runIds){
   const out=new Map(),ids=[];
   for(const id of runIds){if(out.has(id))continue;out.set(id,null);if(uuid(id))ids.push(id);}
   if(!ids.length)return out;
   await database.transaction('read',async s=>{
    for(let i=0;i<ids.length;i+=BATCH)for(const st of await evaluate(s,ids.slice(i,i+BATCH)))if(st.error===undefined)out.set(st.id,st.view);
   });
   return out;
  }
 });
}
