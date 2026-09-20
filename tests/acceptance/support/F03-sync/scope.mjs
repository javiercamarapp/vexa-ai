import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {q} from './harness.mjs';
import {windowSpec,record,page,adapter} from './fixtures.mjs';
async function start(h){const a=h.actor(),{repository}=h.repository(a),row=await repository.ensure({connectionId:a.connection,mode:'live',window:windowSpec}),workerId=randomUUID(),lease=await repository.claim({syncId:row.id,workerId,leaseMs:30000});return{a,repository,row,ownership:{syncId:row.id,workerId,fence:Number(lease.fence),expectedVersion:0}};}
export async function scope(t,h){
 await t.test('connection history cannot be reassigned to another account by starting a new sync',async()=>{
  const s=await start(h);await s.repository.commitPage({...s.ownership,page:page([record(h.ingestion,s.a,'T1',{type:'ticket'})],'terminal',{done:true})});
  h.sql(`UPDATE connections SET account_id='SYN-NEW-ACCOUNT' WHERE id=${q(s.a.connection)}`);
  let rejected=false;try{await s.repository.ensure({connectionId:s.a.connection,mode:'backfill',window:windowSpec});}catch{rejected=true;}
  assert.equal(rejected,true,'NEW_SYNC_REUSED_DIFFERENT_ACCOUNT_HISTORY');assert.equal(h.sql(`SELECT count(*) FROM sync_cursors WHERE tenant_id=${q(s.a.tenant)}`),'1','ACCOUNT_REASSIGNMENT_CREATED_SYNC');
  h.sql(`UPDATE connections SET account_id=${q(s.a.account)} WHERE id=${q(s.a.connection)}`);
  const b=h.actor('owner',s.a.tenant),{repository}=h.repository(b);
  const result=await h.sync.runSync({repository,connectionId:b.connection,mode:'live',window:windowSpec,maxPages:2,deadlineMs:30000,adapterFactory:async()=>adapter([page([record(h.ingestion,b,'M1')],'message'),page([record(h.ingestion,b,'T1',{type:'ticket'})],'terminal',{done:true})])});
  assert.equal(result.state,'done');const joins=h.json(`SELECT jsonb_build_object('message_account',m.provenance->>'account_id','conversation_account',c.provenance->>'account_id') FROM messages m JOIN conversations c ON c.tenant_id=m.tenant_id AND c.id=m.conversation_id WHERE m.tenant_id=${q(b.tenant)} AND m.connection_id=${q(b.connection)}`);
  assert.deepEqual(joins,{message_account:b.account,conversation_account:b.account},'NEW_CONNECTION_MIXED_ACCOUNTS');
 });
 for(const dimension of ['tenant_id','connection_id','source','source_account_id','missing'])await t.test('rejection scope mismatch rolls back whole page '+dimension,async()=>{
  const s=await start(h),context={tenant_id:s.a.tenant,connection_id:s.a.connection,source:s.a.source,source_account_id:s.a.account};
  if(dimension!=='missing')context[dimension]=dimension.endsWith('_id')&&dimension!=='source_account_id'?randomUUID():dimension==='source'?'hubspot':'SYN-FOREIGN';
  const error={index:0,code:'INVALID_RECORD',payload:{sensitive:'SYNTHETIC-FOREIGN'},...(dimension==='missing'?{}:{context})};
  let rejected=false;try{await s.repository.commitPage({...s.ownership,page:page([record(h.ingestion,s.a,'T1',{type:'ticket'})],'terminal',{done:true,errors:[error]})});}catch{rejected=true;}
  assert.equal(rejected,true,'REJECTION_SCOPE_ACCEPTED:'+dimension);
  assert.equal(h.sql(`SELECT version FROM sync_cursors WHERE id=${q(s.row.id)}`),'0','FOREIGN_ERROR_ADVANCED_CURSOR');
  for(const table of ['sync_raw_objects','source_revisions','sync_pages'])assert.equal(h.sql(`SELECT count(*) FROM ${table} WHERE tenant_id=${q(s.a.tenant)}`),'0','FOREIGN_ERROR_PARTIAL_PAGE');
 });
 await t.test('valid scoped rejection persists raw and advances page',async()=>{
  const s=await start(h),error={index:0,code:'INVALID_RECORD',payload:{synthetic:'rejected'},context:{tenant_id:s.a.tenant,connection_id:s.a.connection,source:s.a.source,source_account_id:s.a.account}};
  await s.repository.commitPage({...s.ownership,page:page([],'terminal',{done:true,errors:[error]})});assert.equal(h.sql(`SELECT rejected FROM imports WHERE id=${q(s.row.import_id)}`),'1');assert.equal(h.sql(`SELECT count(*) FROM sync_raw_objects WHERE tenant_id=${q(s.a.tenant)}`),'1');
 });
 await t.test('record without verified envelope cannot enter raw tenant storage',async()=>{
  const s=await start(h);let rejected=false;try{await s.repository.commitPage({...s.ownership,page:page([{payload:{sensitive:'SYNTHETIC-UNKNOWN'}}],'terminal',{done:true})});}catch{rejected=true;}
  assert.equal(rejected,true,'UNSCOPED_RECORD_ACCEPTED');assert.equal(h.sql(`SELECT count(*) FROM sync_raw_objects WHERE tenant_id=${q(s.a.tenant)}`),'0');assert.equal(h.sql(`SELECT version FROM sync_cursors WHERE id=${q(s.row.id)}`),'0');
 });
 await t.test('uncertain visibility stays durable quarantine and never customer evidence',async()=>{
  const s=await start(h),records=[record(h.ingestion,s.a,'T1',{type:'ticket'}),...['unknown','internal'].map((visibility,i)=>({...record(h.ingestion,s.a,'M'+i),visibility}))];
  await s.repository.commitPage({...s.ownership,page:page(records,'terminal',{done:true})});
  assert.equal(h.sql(`SELECT count(*) FROM messages WHERE tenant_id=${q(s.a.tenant)}`),'0','UNCERTAIN_VISIBILITY_BECAME_EVIDENCE');
  assert.equal(h.sql(`SELECT count(*) FROM import_rows WHERE tenant_id=${q(s.a.tenant)} AND error_code='VISIBILITY_AMBIGUOUS'`),'2','UNCERTAIN_VISIBILITY_NOT_QUARANTINED');
  assert.equal(h.sql(`SELECT count(*) FROM sync_raw_objects WHERE tenant_id=${q(s.a.tenant)}`),'3','UNCERTAIN_RAW_LOST');
 });
}
