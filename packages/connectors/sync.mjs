/** Server-only CRM page transactions. The injected database must be createDatabase, never a service-role client. */
import {randomUUID} from 'node:crypto';
import {contentHash,createEnvelope} from '../ingestion/index.mjs';
import {persistCanonical} from '../ingestion/persistence/index.mjs';
import {createHubSpotAdapter} from './hubspot.mjs';
import {createZendeskAdapter} from './zendesk.mjs';
import {createHealthRepository} from './health.mjs';
const fail=code=>{throw Object.assign(new Error(code),{code});};
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
const stableId=v=>{const h=contentHash(v);return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;};
const json=v=>JSON.stringify(v);
function windowSpec(w){
 if(!object(w)||typeof w.version!=='string'||!w.version||w.version.length>100||!Number.isSafeInteger(w.overlapSeconds)||w.overlapSeconds<0||w.overlapSeconds>31536000)fail('SYNC_WINDOW_INVALID');
 const from=Date.parse(w.from),to=Date.parse(w.to);if(!Number.isFinite(from)||!Number.isFinite(to)||from>=to)fail('SYNC_WINDOW_INVALID');
 return {from:new Date(from).toISOString(),to:new Date(to).toISOString(),overlapSeconds:w.overlapSeconds,version:w.version,fetchFrom:new Date(from-w.overlapSeconds*1000).toISOString()};
}
/** Unknown roles, metadata, deletion markers and incomplete text remain durable quarantine. */
export function normalizeSyncRecord(r){
 if(!object(r)||!object(r.envelope)||!object(r.payload))return {code:'RECORD_INVALID'};
 const e=r.envelope;
 if(e.content_hash!==contentHash(r.payload))return {code:'SOURCE_HASH_MISMATCH'};
 if(r.deleted||r.tombstone||e.deleted_at)return {code:'DELETION_REQUIRES_RETENTION'};
 let entity,payload;
 if((e.source==='hubspot'&&e.entity_type==='thread')||(e.source==='zendesk'&&e.entity_type==='ticket')){
  entity='conversation';payload={customer_external_id:null,order_external_id:null};
 }else if(e.entity_type==='message'){
  if(!['customer','agent','internal'].includes(r.role))return {code:'ROLE_AMBIGUOUS'};
  if(r.visibility!==(r.role==='internal'?'internal':'public'))return {code:'VISIBILITY_AMBIGUOUS'};
  if(!r.body_complete||typeof r.text!=='string')return {code:'BODY_INCOMPLETE'};
  if(typeof r.conversation_id!=='string'||!r.conversation_id)return {code:'CONVERSATION_REQUIRED'};
  entity='message';payload={conversation_external_id:r.conversation_id,role:r.role,text:r.text};
 }else return {code:'ENTITY_METADATA_ONLY'};
 const envelope=createEnvelope(e,{...e,entity_type:entity,payload_ref:'crm-normalized:'+contentHash(payload)},payload);
 return {envelope,payload};
}
export function createSyncRepository({database}){
 if(typeof window!=='undefined'||typeof database?.transaction!=='function')fail('SYNC_DATABASE_REQUIRED');
 const tx=work=>database.transaction('import',work);
 const health=createHealthRepository({database});
 async function connection(s,id){
  const c=(await s.query("SELECT * FROM public.connections WHERE tenant_id=$1 AND id=$2 FOR SHARE",[s.tenantId,id])).rows[0];
  if(!c||c.status!=='active'||!['hubspot','zendesk'].includes(c.source))fail('SYNC_CONNECTION_UNAVAILABLE');
  if((await s.query("SELECT state FROM public.connection_health WHERE tenant_id=$1 AND connection_id=$2",[s.tenantId,id])).rows[0]?.state==='reconnect_required')fail('RECONNECT_REQUIRED');
  // Canonical F02 references bind connection IDs permanently to their source account.
  // A new window cannot make an existing connection safe to reuse for another account.
  const foreignHistory=(await s.query("SELECT id FROM public.source_revisions WHERE tenant_id=$1 AND connection_id=$2 AND ((provenance->>'source') IS DISTINCT FROM $3 OR (provenance->>'account_id') IS DISTINCT FROM $4) LIMIT 1",[s.tenantId,id,c.source,c.account_id])).rows;
  if(foreignHistory.length)fail('SYNC_CONNECTION_HISTORY_CHANGED');
  const previous=(await s.query('SELECT scope_hash,mode,window_spec,mapping_version FROM public.sync_cursors WHERE tenant_id=$1 AND connection_id=$2',[s.tenantId,id])).rows;
  for(const r of previous){
   const expectedScope=contentHash({tenant:s.tenantId,connectionId:id,source:c.source,account:c.account_id,mode:r.mode,window:r.window_spec,mappingVersion:r.mapping_version});
   if(expectedScope!==r.scope_hash)fail('SYNC_CONNECTION_CHANGED');
  }
  return c;
 }
 async function owned(s,syncId,workerId,fence){
  if(!uuid(syncId))fail('SYNC_ID_INVALID');
  const r=(await s.query('SELECT *,lease_until>clock_timestamp() AS lease_valid FROM public.sync_cursors WHERE tenant_id=$1 AND id=$2 FOR UPDATE',[s.tenantId,syncId])).rows[0];
  if(!r)fail('SYNC_NOT_FOUND');
  await connection(s,r.connection_id);
  if(workerId!==undefined&&(!uuid(workerId)||r.worker_id!==workerId||Number(r.fence)!==Number(fence)||!r.lease_valid))fail('SYNC_FENCE_LOST');
  return r;
 }
 return Object.freeze({
  beginAttempt:health.beginAttempt,finishAttempt:health.finishAttempt,recoverCompleted:health.recoverCompleted,
  async ensure({connectionId,mode,window:windowInput,mappingVersion='crm-canonical-v1'}){
   if(!uuid(connectionId)||!['live','backfill'].includes(mode)||mappingVersion!=='crm-canonical-v1')fail('SYNC_CONFIG_INVALID');
   const window=windowSpec(windowInput);
   return tx(async s=>{
    const c=await connection(s,connectionId),scopeHash=contentHash({tenant:s.tenantId,connectionId,source:c.source,account:c.account_id,mode,window,mappingVersion});
    const syncId=stableId(['sync-v1',scopeHash]),importId=stableId(['sync-import-v1',scopeHash]);
    await s.query("INSERT INTO public.imports(id,tenant_id,connection_id,file_hash,mapping_version,state,idempotency_key,provenance) VALUES($1,$2,$3,$4,$5,'running',$6,$7) ON CONFLICT(tenant_id,idempotency_key) DO NOTHING",[importId,s.tenantId,connectionId,scopeHash,mappingVersion,'crm:'+scopeHash,json({kind:'crm-sync',mode,window})]);
    await s.query('INSERT INTO public.sync_cursors(id,tenant_id,connection_id,import_id,scope_hash,mode,window_spec,mapping_version) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(tenant_id,scope_hash) DO NOTHING',[syncId,s.tenantId,connectionId,importId,scopeHash,mode,json(window),mappingVersion]);
    return owned(s,syncId);
   });
  },
  async claim({syncId,workerId,leaseMs=30000}){
   if(!uuid(workerId)||!Number.isSafeInteger(leaseMs)||leaseMs<100||leaseMs>300000)fail('SYNC_LEASE_INVALID');
   return tx(async s=>{const r=await owned(s,syncId);
    if(r.lease_valid)fail('SYNC_BUSY');
    return (await s.query('UPDATE public.sync_cursors SET worker_id=$3,fence=fence+1,lease_until=clock_timestamp()+($4::int*interval \'1 millisecond\'),updated_at=now() WHERE tenant_id=$1 AND id=$2 RETURNING *',[s.tenantId,syncId,workerId,leaseMs])).rows[0];
   });
  },
  async current({syncId,workerId,fence}){return tx(async s=>{const r=await owned(s,syncId,workerId,fence),c=await connection(s,r.connection_id);return {...r,context:{tenant_id:s.tenantId,connection_id:c.id,source:c.source,source_account_id:c.account_id}};});},
  async commitPage({syncId,workerId,fence,expectedVersion,page}){
   if(!object(page)||!Array.isArray(page.records)||!Array.isArray(page.errors)||typeof page.done!=='boolean'||(!page.done&&page.checkpoint==null)||page.records.length+page.errors.length>100000||!Number.isSafeInteger(expectedVersion)||expectedVersion<0)fail('SYNC_PAGE_INVALID');
   // JSON materialization removes mutable caller references before any asynchronous boundary.
   const copy=JSON.parse(json(page));
   if(Buffer.byteLength(json(copy))>32*1024*1024)fail('SYNC_PAGE_LIMIT');
   return tx(async s=>{
    const state=await owned(s,syncId,workerId,fence);
    if(Number(state.version)!==expectedVersion)fail('SYNC_CAS_CONFLICT');
    if(state.done)fail('SYNC_ALREADY_DONE');
    if(!copy.done&&contentHash(copy.checkpoint)===contentHash(state.checkpoint))fail('SYNC_CURSOR_STALLED');
    const boundConnection=await connection(s,state.connection_id);
    const scoped=e=>object(e)&&e.tenant_id===s.tenantId&&e.connection_id===state.connection_id&&e.source===boundConnection.source&&e.source_account_id===boundConnection.account_id;
    if(copy.records.some(r=>!scoped(r?.envelope))||copy.errors.some(r=>!scoped(r?.context)))fail('SYNC_SOURCE_SCOPE');
    const counts={inserted:0,duplicate:0,rejected:0,conflict:0};
    const records=copy.records.map(r=>({original:r,normalized:normalizeSyncRecord(r)})).sort((a,b)=>(a.normalized.envelope?.entity_type==='conversation'?0:1)-(b.normalized.envelope?.entity_type==='conversation'?0:1));
    for(const error of copy.errors)records.push({original:error,normalized:{code:typeof error?.code==='string'&&/^[A-Z][A-Z0-9_]{1,79}$/.test(error.code)?error.code:'PROVIDER_ROW_INVALID'}});
    for(const {original,normalized} of records){
     const e=original?.envelope;
     if(e&&(e.tenant_id!==s.tenantId||e.connection_id!==state.connection_id||e.source!==boundConnection.source||e.source_account_id!==boundConnection.account_id))fail('SYNC_SOURCE_SCOPE');
     const rawHash=contentHash(original?.payload??original),rowRef=contentHash({identity:e?{source:e.source,account:e.source_account_id,entity:e.entity_type,id:e.external_id,revision:e.source_revision}:null,rawHash,normalized:normalized.payload??normalized.code});
     const previous=(await s.query('SELECT result FROM public.sync_raw_objects WHERE tenant_id=$1 AND import_id=$2 AND row_ref=$3',[s.tenantId,state.import_id,rowRef])).rows[0];
     if(previous){counts.duplicate++;continue;}
     let result={status:'rejected',code:normalized.code};
     if(!normalized.code)result=await persistCanonical(s,{importId:state.import_id,record:{...normalized,mapping_version:state.mapping_version,row_ref:rowRef}});
     if(normalized.code){
      const rawId=stableId([syncId,rowRef]);
      await s.query("INSERT INTO public.import_rows(id,tenant_id,import_id,row_ref,row_hash,state,error_code,payload_ref,provenance) VALUES($1,$2,$3,$4,$5,'rejected',$6,$7,$8)",[stableId(['crm-row',state.import_id,rowRef]),s.tenantId,state.import_id,rowRef,rawHash,normalized.code,'sync-raw:'+rawId,json({mapping_version:state.mapping_version,result})]);
      await s.query('UPDATE public.imports SET rejected=rejected+1,total=total+1,updated_at=now() WHERE tenant_id=$1 AND id=$2',[s.tenantId,state.import_id]);
     }
     counts[result.status]++;
     await s.query('INSERT INTO public.sync_raw_objects(id,tenant_id,sync_id,connection_id,import_id,row_ref,raw_hash,original,normalized,result) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[stableId([syncId,rowRef]),s.tenantId,syncId,state.connection_id,state.import_id,rowRef,rawHash,json(original),json(normalized),json(result)]);
    }
    // Recover a message seen before its conversation in another page/batch. The original
    // rejection remains immutable; an explicit linked-v1 import row records the recovery.
    const pending=(await s.query(`SELECT r.* FROM public.sync_raw_objects r
      JOIN public.source_heads h ON h.tenant_id=r.tenant_id AND h.connection_id=r.connection_id
       AND h.entity_type='conversation' AND h.external_id=r.normalized->'payload'->>'conversation_external_id'
       AND h.state<>'ambiguous'
      WHERE r.tenant_id=$1 AND r.connection_id=$2 AND r.result->>'code'='REFERENCE_MISSING'
       AND r.normalized->'envelope'->>'entity_type'='message'
       AND NOT EXISTS(SELECT 1 FROM public.import_rows i WHERE i.tenant_id=r.tenant_id AND i.import_id=r.import_id AND i.row_ref=r.row_ref||':linked-v1')
      ORDER BY r.id`,[s.tenantId,state.connection_id])).rows;
    for(const original of pending){
     const recovery=await persistCanonical(s,{importId:original.import_id,record:{...original.normalized,mapping_version:'crm-canonical-v1',row_ref:original.row_ref+':linked-v1'}});
     counts[recovery.status]++;
    }
    await s.query('INSERT INTO public.sync_pages(id,tenant_id,sync_id,version,previous_checkpoint,checkpoint,done,coverage,counts) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[randomUUID(),s.tenantId,syncId,expectedVersion+1,state.checkpoint==null?null:json(state.checkpoint),copy.checkpoint==null?null:json(copy.checkpoint),copy.done,json(copy.coverage??{}),json(counts)]);
    const advanced=(await s.query('UPDATE public.sync_cursors SET checkpoint=$3,done=$4,version=version+1,updated_at=now() WHERE tenant_id=$1 AND id=$2 RETURNING *',[s.tenantId,syncId,copy.checkpoint==null?null:json(copy.checkpoint),copy.done])).rows[0];
    return {...advanced,counts};
   });
  },
  async readPayload({importId,rowRef,payloadRef}){
   if(payloadRef!==undefined){
    if(typeof payloadRef!=='string'||payloadRef.length>300)fail('SYNC_PAYLOAD_INVALID');
    return database.transaction('read',async s=>(await s.query("SELECT r.original,r.normalized,r.result,i.provenance AS resolution FROM public.import_rows i JOIN public.sync_raw_objects r ON r.tenant_id=i.tenant_id AND r.import_id=i.import_id AND (r.row_ref=i.row_ref OR r.row_ref||':linked-v1'=i.row_ref) WHERE i.tenant_id=$1 AND i.payload_ref=$2",[s.tenantId,payloadRef])).rows[0]??null);
   }
   if(!uuid(importId)||typeof rowRef!=='string'||!rowRef)fail('SYNC_PAYLOAD_INVALID');
   return database.transaction('read',async s=>(await s.query('SELECT original,normalized,result FROM public.sync_raw_objects WHERE tenant_id=$1 AND import_id=$2 AND row_ref=$3',[s.tenantId,importId,rowRef.replace(/:linked-v1$/,'')])).rows[0]??null);
  },
  async release({syncId,workerId,fence}){
   if(!uuid(syncId)||!uuid(workerId)||!Number.isSafeInteger(Number(fence))||Number(fence)<1)fail('SYNC_FENCE_LOST');
   // Releasing our own live lease is cleanup, not another provider operation.
   // A provider 401 must not prevent release until timeout and block owner recheck.
   return tx(async s=>{const result=await s.query('UPDATE public.sync_cursors SET worker_id=null,lease_until=null,updated_at=now() WHERE tenant_id=$1 AND id=$2 AND worker_id=$3 AND fence=$4 AND lease_until>clock_timestamp()',[s.tenantId,syncId,workerId,fence]);if(result.rowCount!==1)fail('SYNC_FENCE_LOST');});
  }
 });
}
/** No token is persisted. adapterFactory receives authorized scope and explicit overlap bounds. */
export async function runSync({repository,connectionId,mode,window,mappingVersion='crm-canonical-v1',adapterFactory,workerId=randomUUID(),leaseMs=30000,maxPages=100,deadlineMs=60000,clock=Date.now}){
 if(!Number.isSafeInteger(maxPages)||maxPages<1||maxPages>10000||!Number.isSafeInteger(deadlineMs)||deadlineMs<1||deadlineMs>300000||typeof adapterFactory!=='function')fail('SYNC_RUN_INVALID');
 const start=clock(),initial=await repository.ensure({connectionId,mode,window,mappingVersion});
 if(initial.done){if(repository.recoverCompleted)await repository.recoverCompleted({syncId:initial.id});return {state:'done',syncId:initial.id,checkpoint:initial.checkpoint,pages:0};}
 const lease=await repository.claim({syncId:initial.id,workerId,leaseMs});
 const ownership={syncId:initial.id,workerId,fence:Number(lease.fence)};
 let state=await repository.current(ownership),pages=0,iterator,attempt,finalizing=false;
 try{
  if(repository.beginAttempt)attempt=await repository.beginAttempt({connectionId,...ownership});
  const adapter=await adapterFactory({context:state.context,window:state.window_spec,mode,deadlineMs:Math.max(1,deadlineMs-(clock()-start))});
  if(typeof adapter?.pages!=='function')fail('SYNC_ADAPTER_INVALID');
  iterator=adapter.pages({checkpoint:state.checkpoint})[Symbol.asyncIterator]();
  while(pages<maxPages&&clock()-start<deadlineMs){
   state=await repository.current(ownership); // Fresh membership/connection/lease before each network page.
   if(clock()-start>=deadlineMs)break;
   const next=await iterator.next();
   if(next.done)fail('SYNC_MISSING_TERMINAL_PAGE');
   state=await repository.commitPage({...ownership,expectedVersion:Number(state.version),page:next.value});pages++;
   if(state.done)break;
  }
  const outcome=state.done?'done':'continuation';
  // Once page work completed, a summary failure must remain recoverable;
  // do not overwrite committed success evidence with a second error summary.
  finalizing=true;
  if(attempt)await repository.finishAttempt({...attempt,syncId:initial.id,outcome});
  return {state:outcome,syncId:initial.id,checkpoint:state.checkpoint,version:Number(state.version),pages};
 }catch(error){
  if(attempt&&!finalizing)await repository.finishAttempt({...attempt,syncId:initial.id,error});
  throw error;
 }finally{
  if(iterator?.return)await iterator.return();
  // A lost/expired/revoked lease is already unavailable; never let release mask the original failure.
  try{await repository.release(ownership);}catch{/* Next claimant must wait for the SQL lease expiry. */}
 }
}

/** Read-only production adapter factory: credentials remain in the closure, never in SQL.
 * HubSpot v3 performs a conservative full scan because its reviewed adapter has no
 * documented update-window filter. Zendesk starts at the declared overlap boundary.
 */
export function createCRMAdapterFactory(config){
 if(!object(config))fail('SYNC_ADAPTER_CONFIG');
 return ({context,window,deadlineMs})=>{
  const now=(config.clock??(()=>new Date()))().getTime();
  const absoluteDeadline=Math.min(config.deadlineMs??Infinity,now+deadlineMs);
  const common={...config,context,deadlineMs:absoluteDeadline};
  if(context.source==='hubspot')return createHubSpotAdapter(common);
  if(context.source==='zendesk')return createZendeskAdapter({...common,startTime:Math.max(0,Math.floor(Date.parse(window.fetchFrom)/1000))});
  fail('SYNC_SOURCE_UNSUPPORTED');
 };
}
