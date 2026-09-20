import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import {q} from './harness.mjs';
import {windowSpec,record,page,adapter} from './fixtures.mjs';

async function start(h,fault) {
 const actor=h.actor(),{repository}=h.repository(actor,{fault});
 const row=await repository.ensure({connectionId:actor.connection,mode:'live',window:windowSpec});
 const workerId=randomUUID(),claimed=await repository.claim({syncId:row.id,workerId,leaseMs:30000});
 return {actor,repository,row,ownership:{syncId:row.id,workerId,fence:Number(claimed.fence)}};
}
const commit=(s,p)=>s.repository.commitPage({...s.ownership,expectedVersion:0,page:p});
const state=(h,s)=>h.json(`SELECT to_jsonb(s) FROM sync_cursors s WHERE id=${q(s.row.id)}`);
async function atomic(h) {
 let armed=false;
 const s=await start(h,{before:async(sql,_values,c)=>{if(armed&&sql==='COMMIT'){armed=false;await c.query('ROLLBACK');throw Object.assign(Error('SYN_FINAL_COMMIT_FAILED'),{code:'08006'});}}});
 armed=true;
 await assert.rejects(commit(s,page([record(h.ingestion,s.actor,'T1',{type:'ticket'})],'next')));
 assert.equal(Number(state(h,s).version),0,'ATOMIC_CURSOR_ADVANCED_WITHOUT_FINAL_COMMIT');
 for(const table of ['sync_pages','sync_raw_objects','source_revisions'])assert.equal(h.sql(`SELECT count(*) FROM ${table} WHERE tenant_id=${q(s.actor.tenant)}`),'0','ATOMIC_EFFECTS_ESCAPED_ROLLBACK');
}
async function cursor(h) {
 const s=await start(h),p=page([record(h.ingestion,s.actor,'T1',{type:'ticket'})],'opaque:next/?+%');
 await commit(s,p);assert.deepEqual(state(h,s).checkpoint,p.checkpoint,'CURSOR_DIFFERS_FROM_COMMITTED_PROVIDER_PAGE');
}
async function fence(h) {
 const s=await start(h);h.sql(`UPDATE sync_cursors SET lease_until=now()-interval '1 second' WHERE id=${q(s.row.id)}`);
 await s.repository.claim({syncId:s.row.id,workerId:randomUUID(),leaseMs:30000});
 let rejected=false;try{await commit(s,page([record(h.ingestion,s.actor,'T1',{type:'ticket'})],'next'));}catch{rejected=true;}
 assert.equal(rejected,true,'STALE_FENCE_WROTE_PAGE');assert.equal(Number(state(h,s).version),0,'STALE_FENCE_ADVANCED_CURSOR');
}
async function binding(h) {
 const s=await start(h);h.sql(`UPDATE connections SET account_id='SYN-CHANGED' WHERE id=${q(s.actor.connection)}`);
 let rejected=false;try{await s.repository.current(s.ownership);}catch{rejected=true;}
 assert.equal(rejected,true,'CHANGED_ACCOUNT_REUSED_OLD_CURSOR');assert.equal(Number(state(h,s).version),0);
}
export async function boundaries(t,h) {
 await t.test('more than1000 pending messages recover before terminal success',async()=>{
  const a=h.actor(),{repository}=h.repository(a),messages=Array.from({length:1001},(_,i)=>record(h.ingestion,a,'M'+i));
  const result=await h.sync.runSync({repository,connectionId:a.connection,mode:'live',window:windowSpec,leaseMs:300000,deadlineMs:300000,maxPages:2,adapterFactory:async()=>adapter([page(messages,'messages'),page([record(h.ingestion,a,'T1',{type:'ticket'})],'terminal',{done:true})])});
  assert.equal(result.state,'done');assert.equal(h.sql(`SELECT count(*) FROM messages WHERE tenant_id=${q(a.tenant)}`),'1001','PENDING_RECOVERY_TRUNCATED');
  assert.equal(h.sql(`SELECT count(*) FROM import_rows WHERE tenant_id=${q(a.tenant)} AND row_ref LIKE '%:linked-v1'`),'1001','RECOVERY_HISTORY_REQUIRED');
 });
 await t.test('import row-share does not authorize connection writes',async()=>{
  const a=h.actor(),{database}=h.repository(a);
  await database.transaction('import',async s=>{assert.equal((await s.query('SELECT id FROM connections WHERE tenant_id=$1 AND id=$2 FOR SHARE',[s.tenantId,a.connection])).rows.length,1);});
  await assert.rejects(database.transaction('import',s=>s.query("UPDATE connections SET status='disabled' WHERE tenant_id=$1 AND id=$2",[s.tenantId,a.connection])));
  assert.equal(h.sql(`SELECT status FROM connections WHERE id=${q(a.connection)}`),'active','IMPORT_CHANGED_CONNECTION');
 });
 const file=path.join(h.built,'packages/connectors/sync.mjs'),original=fs.readFileSync(file,'utf8');
 const definitions=[
  ['atomic',atomic,'return {...advanced,counts};',"await s.query('END'); return {...advanced,counts};",/ATOMIC_CURSOR_ADVANCED_WITHOUT_FINAL_COMMIT|ATOMIC_EFFECTS_ESCAPED_ROLLBACK/],
  ['cursor',cursor,'const copy=JSON.parse(json(page));',"const copy=JSON.parse(json(page)); copy.checkpoint={cursor:'SYN-SKIPPED-PAGE'};",/CURSOR_DIFFERS_FROM_COMMITTED_PROVIDER_PAGE/],
  ['fence',fence,"if(workerId!==undefined&&(!uuid(workerId)||r.worker_id!==workerId||Number(r.fence)!==Number(fence)||!r.lease_valid))fail('SYNC_FENCE_LOST');",'/* SYNTHETIC MUTANT: stale writer allowed. */',/STALE_FENCE_WROTE_PAGE/],
  ['binding',binding,"if(expectedScope!==r.scope_hash)fail('SYNC_CONNECTION_CHANGED');",'/* SYNTHETIC MUTANT: changed account allowed. */',/CHANGED_ACCOUNT_REUSED_OLD_CURSOR/],
 ];
 const receipts=[];
 const load=async source=>{fs.writeFileSync(file,source);h.sync=await import(pathToFileURL(file).href+'?external='+randomUUID());};
 for(const[name,oracle,needle,replacement,expected]of definitions)await t.test('product mutant '+name+' baseline/reject/restore',async()=>{
  assert.equal(original.split(needle).length,2,'MUTANT_ANCHOR_UNIQUE:'+name);
  try{await load(original);await oracle(h);await load(original.replace(needle,replacement));await assert.rejects(()=>oracle(h),expected,'MUTANT_MUST_FAIL_BY_DOMAIN_ORACLE:'+name);await load(original);await oracle(h);receipts.push({name,phases:[0,1,0],expected:String(expected)});}
  finally{await load(original);}
 });
 fs.writeFileSync(path.join(h.evidence,'product-mutants.json'),JSON.stringify(receipts),{mode:0o600});
}
