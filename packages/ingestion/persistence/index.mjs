import {randomUUID} from 'node:crypto';
import {contentHash, createEnvelope, identityKey, adaptCSVRaw, IngestionError} from '../index.mjs';

class Rejection extends Error { constructor(code){super(code);this.code=code;} }
const normalizationFailure=Symbol('normalizationFailure');
const reject=code=>{throw new Rejection(code);};
const id=parts=>{const h=contentHash(['source-persistence-v1',...parts]);return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;};
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
const tables={customer:'customers',product:'products',order:'orders',conversation:'conversations',message:'messages'};
async function insert(s,table,row){const keys=Object.keys(row);await s.query(`INSERT INTO public.${table} (${keys.join(',')}) VALUES (${keys.map((_,i)=>'$'+(i+1)).join(',')})`,Object.values(row));}
async function reference(s,e,type,external,revision){
 if(external==null)return null;
 if(typeof external!=='string'||!external.trim())reject('REFERENCE_INVALID');
 const rows=(await s.query('SELECT DISTINCT canonical_id FROM public.source_revisions WHERE tenant_id=$1 AND connection_id=$2 AND entity_type=$3 AND external_id=$4 AND ($5::text IS NULL OR source_revision=$5)',[s.tenantId,e.connection_id,type,external,revision??null])).rows;
 if(rows.length!==1)reject(rows.length?'REFERENCE_AMBIGUOUS':'REFERENCE_MISSING');
 if(revision==null&&(await s.query("SELECT id FROM public.source_heads WHERE tenant_id=$1 AND id=$2 AND state='ambiguous'",[s.tenantId,rows[0].canonical_id])).rows.length)reject('REFERENCE_AMBIGUOUS');
 return rows[0].canonical_id;
}
async function project(s,e,p,mapping,provenance,canonical){
 const snapshot=[]; const capture=async(_s,table,row)=>snapshot.push({table,row});
 const base={id:canonical,tenant_id:s.tenantId,connection_id:e.connection_id,external_id:e.external_id,source_revision:e.source_revision,provenance:JSON.stringify(provenance)};
 const ref=(type,key)=>reference(s,e,type,p[key],p[key+'_revision']);
 if(e.entity_type==='customer')await capture(s,'customers',{...base,display_name:typeof p.display_name==='string'?p.display_name:null});
 if(e.entity_type==='product'){
  if(typeof p.sku!=='string'||!p.sku.trim())reject('SKU_REQUIRED');
  await capture(s,'products',{...base,sku:p.sku});
 }
 if(e.entity_type==='order'){
  if(p.amount_basis!=='gross'||!e.occurred_at)reject('ORDER_CONTEXT_REQUIRED');
  const exponents={USD:2,MXN:2,EUR:2,GBP:2,CAD:2,AUD:2,JPY:0,KWD:3};
  if(!Object.hasOwn(exponents,p.currency)||exponents[p.currency]!==p.exponent)reject('MONEY_CURRENCY_INVALID');
  if(p.amount_minor!==null&&!(typeof p.amount_minor==='string'&&/^(0|[1-9][0-9]*)$/.test(p.amount_minor)&&BigInt(p.amount_minor)<=9223372036854775807n))reject('MONEY_INVALID');
  await capture(s,'orders',{...base,amount_minor:p.amount_minor,currency:p.currency,exponent:p.exponent,occurred_at:e.occurred_at,customer_id:await ref('customer','customer_external_id')});
  if(p.product_external_id){const product=await ref('product','product_external_id');await capture(s,'order_lines',{id:id([canonical,'line']),tenant_id:s.tenantId,order_id:canonical,product_id:product,amount_minor:p.amount_minor,currency:p.currency,exponent:p.exponent,provenance:base.provenance});}
 }
 if(e.entity_type==='conversation')await capture(s,'conversations',{...base,source:e.source,started_at:e.occurred_at,customer_id:await ref('customer','customer_external_id'),order_id:await ref('order','order_external_id')});
 if(e.entity_type==='message'){
  if(!['customer','agent','internal'].includes(p.role))reject('ROLE_AMBIGUOUS');
  if(typeof p.text!=='string')reject('TEXT_REQUIRED');
  if(!p.conversation_external_id)reject('CONVERSATION_REQUIRED');
  // A CSV container carries no inferred customer, order, money or chronology.
  if(e.adapter_version==='csv-message-v1'){
   const customer=await reference(s,e,'customer',p.customer_id);
   const order=await reference(s,e,'order',p.order_id);
   let product=null;
   if(p.sku){
    const matches=(await s.query('SELECT id FROM public.products WHERE tenant_id=$1 AND connection_id=$2 AND sku=$3',[s.tenantId,e.connection_id,p.sku])).rows;
    if(matches.length!==1)reject(matches.length?'REFERENCE_AMBIGUOUS':'REFERENCE_MISSING');
    product=matches[0].id;
    if((await s.query("SELECT id FROM public.source_heads WHERE tenant_id=$1 AND id=$2 AND state='ambiguous'",[s.tenantId,product])).rows.length)reject('REFERENCE_AMBIGUOUS');
   }
   if(order){
    const o=(await s.query('SELECT customer_id FROM public.orders WHERE tenant_id=$1 AND id=$2',[s.tenantId,order])).rows[0];
    if(customer&&o.customer_id!==customer)reject('REFERENCE_MISMATCH');
    if(product&&!(await s.query('SELECT id FROM public.order_lines WHERE tenant_id=$1 AND order_id=$2 AND product_id=$3',[s.tenantId,order,product])).rows.length)reject('REFERENCE_MISMATCH');
   }
   const context={customer_external_id:p.customer_id??null,order_external_id:p.order_id??null};
   const ce=createEnvelope(e,{entity_type:'conversation',external_id:p.conversation_external_id,source_revision:'csv-container-v1',occurred_at:null,observed_at:e.observed_at,payload_ref:'sha256:'+contentHash(['csv-container',p.conversation_external_id])},context);
   const result=await persistRevision(s,ce,context,mapping);
   if(['conflict','rejected'].includes(result.status))reject('CONVERSATION_CONFLICT');
   p={...p,resolved_product_id:product,conversation_external_id_revision:'csv-container-v1'};
  }
  const conversation=await reference(s,e,'conversation',p.conversation_external_id,p.conversation_external_id_revision);
  if(!conversation)reject('CONVERSATION_REQUIRED');
  await capture(s,'messages',{...base,conversation_id:conversation,role:p.role,occurred_at:e.occurred_at,provenance:JSON.stringify({...provenance,product_id:p.resolved_product_id??null})});
  await capture(s,'message_revisions',{id:id([canonical,e.source_revision,'text']),tenant_id:s.tenantId,message_id:canonical,revision:e.source_revision,text_ref:provenance.payload_ref,hash:e.content_hash,occurred_at:e.occurred_at,provenance:base.provenance});
 }
 return snapshot;
}
async function applySnapshot(s,snapshot){
 for(const {table,row} of snapshot){
  if(![...Object.values(tables),'order_lines','message_revisions'].includes(table))throw Error('SNAPSHOT_INVALID');
  const keys=Object.keys(row);
  if(keys.some(k=>! /^[a-z_]+$/.test(k)))throw Error('SNAPSHOT_INVALID');
  if(table==='message_revisions'){
   await s.query(`INSERT INTO public.${table} (${keys.join(',')}) VALUES (${keys.map((_,i)=>'$'+(i+1)).join(',')}) ON CONFLICT DO NOTHING`,Object.values(row));
  }else{
   await s.query(`INSERT INTO public.${table} (${keys.join(',')}) VALUES (${keys.map((_,i)=>'$'+(i+1)).join(',')}) ON CONFLICT (id) DO UPDATE SET ${keys.filter(k=>!['id','tenant_id'].includes(k)).map(k=>`${k}=EXCLUDED.${k}`).join(',')}`,Object.values(row));
  }
 }
}
async function persistRevision(s,e,p,mapping){
 if(!Object.hasOwn(tables,e.entity_type))reject('ENTITY_UNSUPPORTED');
 if(e.deleted_at)reject('DELETION_REQUIRES_RETENTION');
 if((await s.query('SELECT public.retention_source_deleted($1,$2,$3,$4) AS deleted',[s.tenantId,e.connection_id,e.entity_type,e.external_id])).rows[0]?.deleted)reject('SOURCE_TOMBSTONED');
 const canonical=id([identityKey(e)]), revisionId=id([identityKey(e),e.source_revision]);
 const fingerprint=contentHash({content_hash:e.content_hash,occurred_at:e.occurred_at,deleted_at:e.deleted_at,adapter_version:e.adapter_version??null,normalized_hash:contentHash(p),mapping_version:mapping});
 const old=(await s.query('SELECT id,canonical_id,fingerprint FROM public.source_revisions WHERE tenant_id=$1 AND connection_id=$2 AND entity_type=$3 AND external_id=$4 AND source_revision=$5',[s.tenantId,e.connection_id,e.entity_type,e.external_id,e.source_revision])).rows[0];
 if(old)return {status:old.fingerprint===fingerprint?'duplicate':'conflict',canonical_id:old.canonical_id,code:old.fingerprint===fingerprint?'DUPLICATE':'REVISION_CONFLICT',original_revision_id:old.id};
 const provenance={source:e.source,account_id:e.source_account_id,content_hash:e.content_hash,payload_ref:e.payload_ref,observed_at:e.observed_at,mapping_version:mapping,adapter_version:e.adapter_version??null};
 const snapshot=await project(s,e,p,mapping,provenance,canonical);
 const head=(await s.query('SELECT * FROM public.source_heads WHERE tenant_id=$1 AND id=$2 FOR UPDATE',[s.tenantId,canonical])).rows[0];
 const row={id:revisionId,tenant_id:s.tenantId,connection_id:e.connection_id,entity_type:e.entity_type,external_id:e.external_id,source_revision:e.source_revision,content_hash:e.content_hash,fingerprint,mapping_version:mapping,canonical_id:canonical,[e.entity_type+'_id']:canonical,provenance:JSON.stringify(provenance),snapshot:JSON.stringify(snapshot),related_customer_id:snapshot.find(x=>x.row.customer_id)?.row.customer_id??null,related_product_id:snapshot.find(x=>x.row.product_id)?.row.product_id??JSON.parse(snapshot.find(x=>x.table==='messages')?.row.provenance??'{}').product_id??null,related_order_id:snapshot.find(x=>x.row.order_id)?.row.order_id??null,related_conversation_id:snapshot.find(x=>x.row.conversation_id)?.row.conversation_id??null,message_revision_id:snapshot.find(x=>x.table==='message_revisions')?.row.id??null};
 await insert(s,'source_revisions',row);
 if(!head){
  await applySnapshot(s,snapshot);
  await insert(s,'source_heads',{id:canonical,tenant_id:s.tenantId,connection_id:e.connection_id,entity_type:e.entity_type,external_id:e.external_id,selected_revision_id:revisionId,version:1,state:'unique'});
 }else{
  // Preserve every message text revision even while its logical projection is ambiguous.
  await applySnapshot(s,snapshot.filter(x=>x.table==='message_revisions'));
  await s.query("UPDATE public.source_heads SET selected_revision_id=null,version=version+1,state='ambiguous',updated_at=now() WHERE tenant_id=$1 AND id=$2",[s.tenantId,canonical]);
  if(e.entity_type==='order'){
   await s.query('UPDATE public.orders SET amount_minor=null WHERE tenant_id=$1 AND id=$2',[s.tenantId,canonical]);
   await s.query('UPDATE public.order_lines SET amount_minor=null WHERE tenant_id=$1 AND order_id=$2',[s.tenantId,canonical]);
  }
  return {status:'rejected',canonical_id:canonical,code:'REVISION_AMBIGUOUS',original_revision_id:revisionId};
 }
 return {status:'inserted',canonical_id:canonical,code:'INSERTED'};
}
/** Server-only; read through createDatabase.transaction('read'). */
export async function readCanonicalHistory(scope,{canonicalId}){
 if(typeof window!=='undefined'||!uuid(canonicalId))throw Error('CANONICAL_ID_INVALID');
 const head=(await scope.query('SELECT * FROM public.source_heads WHERE tenant_id=$1 AND id=$2',[scope.tenantId,canonicalId])).rows[0];
 if(!head)return null;
 if((await scope.query('SELECT public.retention_source_deleted($1,$2,$3,$4) AS deleted',[scope.tenantId,head.connection_id,head.entity_type,head.external_id])).rows[0]?.deleted)return null;
 const revisions=(await scope.query('SELECT * FROM public.source_revisions WHERE tenant_id=$1 AND canonical_id=$2 ORDER BY id',[scope.tenantId,canonicalId])).rows;
 return {head,revisions};
}
/** Owner only, current SQL identity, import action. CAS includes every arrival/selection. */
export async function selectCanonicalRevision(scope,{canonicalId,revisionId,expectedVersion,reason}){
 if(typeof window!=='undefined')throw Error('SERVER_ONLY');
 if(!uuid(canonicalId)||!uuid(revisionId)||!Number.isSafeInteger(expectedVersion)||expectedVersion<1||typeof reason!=='string'||!reason.trim()||reason.length>1000)throw Error('SELECTION_INVALID');
 const auth=(await scope.query("SELECT public.vexa_backend_action($1,array['import']) AND public.vexa_member($1,array['owner']) AS ok, auth.uid()::text AS actor",[scope.tenantId])).rows[0];
 if(!auth?.ok||auth.actor!==scope.userId)throw Object.assign(Error('SELECTION_NOT_AUTHORIZED'),{code:'42501'});
 const found=(await scope.query('SELECT connection_id FROM public.source_heads WHERE tenant_id=$1 AND id=$2',[scope.tenantId,canonicalId])).rows[0];
 if(!found)throw Error('CANONICAL_NOT_FOUND');
 await scope.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[scope.tenantId+':'+found.connection_id]);
 const head=(await scope.query('SELECT * FROM public.source_heads WHERE tenant_id=$1 AND id=$2 FOR UPDATE',[scope.tenantId,canonicalId])).rows[0];
 if((await scope.query('SELECT public.retention_source_deleted($1,$2,$3,$4) AS deleted',[scope.tenantId,head.connection_id,head.entity_type,head.external_id])).rows[0]?.deleted)throw Error('SOURCE_TOMBSTONED');
 if(Number(head.version)!==expectedVersion)return {status:'conflict',code:'SELECTION_CAS_CONFLICT'};
 const revision=(await scope.query('SELECT snapshot FROM public.source_revisions WHERE tenant_id=$1 AND canonical_id=$2 AND id=$3',[scope.tenantId,canonicalId,revisionId])).rows[0];
 if(!revision)throw Error('REVISION_NOT_FOUND');
 // A removed product relation must not leave an old line projecting money.
 if(head.entity_type==='order')await scope.query('UPDATE public.order_lines SET amount_minor=null,product_id=null WHERE tenant_id=$1 AND order_id=$2',[scope.tenantId,canonicalId]);
 await applySnapshot(scope,revision.snapshot);
 await scope.query("UPDATE public.source_heads SET selected_revision_id=$3,version=version+1,state='selected',updated_at=now() WHERE tenant_id=$1 AND id=$2",[scope.tenantId,canonicalId,revisionId]);
 await insert(scope,'audit_events',{id:randomUUID(),tenant_id:scope.tenantId,actor:auth.actor,action:'source_revision_selected',resource:canonicalId,reason:reason.trim(),trace_id:randomUUID(),provenance:JSON.stringify({revision_id:revisionId,previous_revision_id:head.selected_revision_id,expected_version:expectedVersion})});
 return {status:'selected',canonical_id:canonicalId,revision_id:revisionId,version:expectedVersion+1};
}
/** Use only inside createDatabase.transaction('import'). SQL failures are never quarantined. */
export async function persistCanonical(scope,{importId,record},internal){
 if(typeof window!=='undefined')throw Error('SERVER_ONLY');
 if(!uuid(importId))throw new Error('IMPORT_ID_INVALID');
 // Serialize accounting for a single import; uniqueness arbitrates across imports/processes.
 const imported=(await scope.query('SELECT i.*,c.source,c.account_id,c.status AS connection_status FROM public.imports i JOIN public.connections c ON c.tenant_id=i.tenant_id AND c.id=i.connection_id WHERE i.tenant_id=$1 AND i.id=$2 FOR UPDATE OF i',[scope.tenantId,importId])).rows[0];
 if(!imported)throw new Error('IMPORT_NOT_AUTHORIZED');
 const allowed=(await scope.query("SELECT public.vexa_backend_action($1,array['import']) AS ok",[scope.tenantId])).rows[0]?.ok;
 if(!allowed)throw new Error('IMPORT_NOT_AUTHORIZED');
 if(!['queued','running','partial'].includes(imported.state)||imported.connection_status!=='active')throw new Error('IMPORT_NOT_ACTIVE');
 await scope.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[scope.tenantId+':'+imported.connection_id]);
 const evidenceHash=contentHash(record);
 const rowRef=record&&((Number.isSafeInteger(record.row_ref)&&record.row_ref>0)||typeof record.row_ref==='string'&&record.row_ref.length>0)?String(record.row_ref):'sha256:'+evidenceHash;
 const rowId=id([scope.tenantId,importId,rowRef]);
 const payloadRef=`import:${importId}:row:${id([rowRef])}`; // no arbitrary URI/PII copied to DB
 const previous=(await scope.query('SELECT id,row_hash,provenance FROM public.import_rows WHERE tenant_id=$1 AND import_id=$2 AND row_ref=$3',[scope.tenantId,importId,rowRef])).rows[0];
 if(previous){
  const raw=record?.envelope??record;
  if(raw?.connection_id===imported.connection_id&&(await scope.query('SELECT public.retention_source_deleted($1,$2,$3,$4) AS deleted',[scope.tenantId,imported.connection_id,raw.entity_type,raw.external_id])).rows[0]?.deleted)return {status:'rejected',code:'SOURCE_TOMBSTONED'};
  if(previous.row_hash===evidenceHash){const {original_revision_id,...replayed}=previous.provenance.result;return replayed;}
  await quarantine(scope,importId,previous.id,evidenceHash,'IMPORT_ROW_CONFLICT',null,payloadRef);
  return {status:'conflict',code:'IMPORT_ROW_CONFLICT'};
 }
 let result;
 await scope.query('SAVEPOINT canonical_row');
 try{
  if(internal===normalizationFailure){
   if(record.mapping_version!==imported.mapping_version)reject('MAPPING_VERSION_MISMATCH');
   if(record.batch_hash!==imported.file_hash)reject('FILE_HASH_MISMATCH');
   const error=new IngestionError(record.code,record.field);throw error;
  }
  const raw=record.envelope??record;
  if(raw.tenant_id!==scope.tenantId||raw.connection_id!==imported.connection_id||raw.source!==imported.source||raw.source_account_id!==imported.account_id)reject('SOURCE_SCOPE_MISMATCH');
  if(record.mapping_version!==imported.mapping_version)reject('MAPPING_VERSION_MISMATCH');
  const payload=record.raw_payload??record.payload;
  if(!payload||typeof payload!=='object'||Array.isArray(payload))reject('PAYLOAD_REQUIRED');
  const e=createEnvelope({tenant_id:scope.tenantId,connection_id:imported.connection_id,source:imported.source,source_account_id:imported.account_id},raw,payload);
  if(e.content_hash!==raw.content_hash)reject('CONTENT_HASH_MISMATCH');
  if(raw.source_revision!==e.source_revision)reject('REVISION_REQUIRED');
  let p=payload;
  if(raw.adapter_version){
   if(raw.adapter_version!=='csv-message-v1')reject('ADAPTER_UNSUPPORTED');
   if(payload.role==='unknown')reject('ROLE_AMBIGUOUS');
    p=adaptCSVRaw({...e,adapter_version:raw.adapter_version},payload);
   if(record.row_hash!==e.content_hash)reject('ROW_HASH_MISMATCH');
   if(record.batch_hash!==imported.file_hash)reject('FILE_HASH_MISMATCH');
  }
  result=await persistRevision(scope,{...e,payload_ref:payloadRef,...(raw.adapter_version?{adapter_version:raw.adapter_version}:{})},p,record.mapping_version);
 }catch(error){
  if(!(error instanceof Rejection)&&!(error instanceof IngestionError))throw error;
  await scope.query('ROLLBACK TO SAVEPOINT canonical_row');
  result={status:'rejected',code:error.code,...(internal===normalizationFailure?{field:error.field,row_ref:record.row_ref,raw_hash:record.raw_hash}:{})};
 }
 await scope.query('RELEASE SAVEPOINT canonical_row');
 const state={inserted:'accepted',duplicate:'duplicate',conflict:'rejected',rejected:'rejected'}[result.status];
 await insert(scope,'import_rows',{id:rowId,tenant_id:scope.tenantId,import_id:importId,row_ref:rowRef,row_hash:evidenceHash,state,error_code:state==='rejected'?result.code:null,payload_ref:payloadRef,provenance:JSON.stringify({mapping_version:imported.mapping_version,result})});
 if(state==='rejected')await quarantine(scope,importId,rowId,evidenceHash,result.code,result.original_revision_id??null,payloadRef);
 const counter={accepted:'accepted',duplicate:'duplicates',rejected:'rejected'}[state];
 await scope.query(`UPDATE public.imports SET ${counter}=${counter}+1,total=total+CASE WHEN pending>0 THEN 0 ELSE 1 END,pending=greatest(0,pending-1),updated_at=now() WHERE tenant_id=$1 AND id=$2`,[scope.tenantId,importId]);
 const {original_revision_id,...publicResult}=result;
 return publicResult;
}
async function quarantine(s,importId,rowId,hash,code,original,ref){
 await s.query('INSERT INTO public.source_quarantine(id,tenant_id,import_id,import_row_id,original_revision_id,code,evidence_hash,provenance) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(id) DO NOTHING',[id([s.tenantId,importId,rowId,hash,code]),s.tenantId,importId,rowId,original,code,hash,JSON.stringify({payload_ref:ref})]);
}

/** Consumer adapter for an actual parser rejection; no fabricated envelope or source mismatch.
 * Only safe metadata is accepted; SQL errors are deliberately not caught.
 */
export async function persistNormalizationRejection(scope,{importId,error,rowRef,rawHash,batchHash,mappingVersion}){
 if(!error||typeof error.code!=='string'||! /^[A-Z][A-Z0-9_]{1,79}$/.test(error.code)||!(error.field==null||typeof error.field==='string'&&/^[a-z_]{1,80}$/.test(error.field))||!Number.isSafeInteger(rowRef)||rowRef<1||! /^[a-f0-9]{64}$/.test(rawHash)||typeof batchHash!=='string'||typeof mappingVersion!=='string')throw Error('NORMALIZATION_REJECTION_INVALID');
 return persistCanonical(scope,{importId,record:{code:error.code,field:error.field??null,row_ref:rowRef,raw_hash:rawHash,batch_hash:batchHash,mapping_version:mappingVersion}},normalizationFailure);
}
