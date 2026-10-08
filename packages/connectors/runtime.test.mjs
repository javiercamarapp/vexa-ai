import test from 'node:test';
import assert from 'node:assert/strict';
import {createCRMRuntime} from './runtime.mjs';
import {ConnectorError,createTransport} from './transport.mjs';

// SQL-shaped SYN port: no database, credentials or external traffic. Real SQL is
// verified by the independent controller, not inferred from this unit boundary.
const tenant='11111111-1111-4111-8111-111111111111';
const connection='22222222-2222-4222-8222-222222222222';
function database({selected=false}={}){
 const calls=[];
 const row={id:'33333333-3333-4333-8333-333333333333',connection_id:connection,source:'hubspot',account_id:'SYN-account',credential_ref:'SYN-ref',generation:1,history_from:'2026-01-01T00:00:00Z',backfill_to:'2026-10-01T00:00:00Z',overlap_seconds:0,poll_seconds:300};
 return {calls,async transaction(action,work){return work({tenantId:tenant,userId:'44444444-4444-4444-8444-444444444444',role:'analyst',async query(sql,args){
  calls.push({action,sql,args});
  if(sql.includes('SELECT c.source,c.account_id,c.credential_ref,r.*'))return {rows:selected?[row]:[]};
  if(sql.includes('SELECT mode,window_spec,done'))return {rows:[]};
  if(sql.includes('SELECT public.crm_actor_authorized'))return {rows:[{ok:true}]};
  if(sql.startsWith('UPDATE public.crm_sync_settings'))return {rows:[],rowCount:1};
  assert.fail('Unexpected SQL in SYN unit port');
 }});}};
}
test('runtime accepts the hosted 100-chunk bound without changing the default idle contract',async()=>{
 const db=database(),crm=createCRMRuntime({database:db,resolveCredentials:()=>assert.fail('no credentials for idle')});
 assert.deepEqual(await crm.tick({deadlineMs:15000,maxPages:100}),{state:'idle'});
 assert.equal(db.calls.length,1);
 assert.deepEqual(await crm.tick(),{state:'idle'});
});
test('invalid work and time limits fail before tenant selection',async()=>{
 const db=database(),crm=createCRMRuntime({database:db,resolveCredentials:()=>assert.fail('no credentials')});
 for(const maxPages of [0,101,10000,1.5,true])await assert.rejects(crm.tick({maxPages}),/CRM_RUNTIME_LIMIT/);
 for(const deadlineMs of [0,20001,1.5,true])await assert.rejects(crm.tick({deadlineMs}),/CRM_RUNTIME_LIMIT/);
 assert.equal(db.calls.length,0);
});
test('provider Retry-After survives as a durable lower bound without another provider attempt',async()=>{
 const db=database({selected:true});let attempts=0;
 const crm=createCRMRuntime({database:db,resolveCredentials:()=>{attempts++;throw new ConnectorError('RETRY_DEFERRED',{status:429,retryable:true,retryAfterMs:600001});}});
 assert.deepEqual(await crm.tick(),{state:'blocked',connectionId:connection,code:'SYNC_FAILED'});
 assert.equal(attempts,1);
 const update=db.calls.find(c=>c.sql.includes('error_code=$3'));
 assert.equal(update.args[3],600001,'provider minimum in milliseconds must reach the durable schedule');
 assert.match(update.sql,/greatest\(/i,'preserve the larger of existing backoff and provider delay');
});
for(const [label,delay,expected] of [
 ['long finite delay',86400001,86400001],['largest safe integer overflows a scheduler timestamp',Number.MAX_SAFE_INTEGER,null],
 ['zero',0,0],['absent',null,0],['missing',undefined,0],
 ['infinite',Infinity,null],['NaN',NaN,null],['unsafe',Number.MAX_SAFE_INTEGER+1,null],
 ['negative',-1,null],['fractional',1.5,null],['string','60000',null]
])test('provider delay '+label+' cannot be silently shortened',async()=>{
 const db=database({selected:true});
 const crm=createCRMRuntime({database:db,resolveCredentials:()=>{throw new ConnectorError('RETRY_DEFERRED',{status:429,retryable:true,retryAfterMs:delay});}});
 assert.equal((await crm.tick()).state,'blocked');
 const update=db.calls.find(c=>c.sql.includes('error_code=$3'));
 assert.equal(update.args[3],expected??0);
 assert.equal(update.args[4],expected===null,'invalid hint must stop automatic retries, not shorten its delay');
 assert.match(update.sql,/failure_count=CASE WHEN \$5::boolean THEN 4/);
});
test('retryable 503 respects its provider delay too; unrelated errors keep ordinary backoff',async()=>{
 for(const [error,expected]of [[new ConnectorError('RETRY_DEFERRED',{status:503,retryable:true,retryAfterMs:600000}),600000],[{code:'SYNC_FAILURE',retryAfterMs:600000},0]]){
  const db=database({selected:true}),crm=createCRMRuntime({database:db,resolveCredentials:()=>{throw error;}});
  await crm.tick();assert.equal(db.calls.find(c=>c.sql.includes('error_code=$3')).args[3],expected);
 }
});
for(const [header,expected]of [['20',0],['600',600000]])test('real bounded transport Retry-After '+header+' reaches runtime scheduling without hidden retries',async()=>{
 let fetches=0,caught;
 const transport=createTransport({token:'SYN-token',maxRetries:0,fetch:async()=>{fetches++;return new Response('{}',{status:429,headers:{'Retry-After':header}});}});
 try{await transport.request(new URL('https://api.hubapi.com/conversations/v3/conversations/threads'));}catch(error){caught=error;}
 assert.equal(caught.status,429);assert.equal(fetches,1);
 const db=database({selected:true}),crm=createCRMRuntime({database:db,resolveCredentials:()=>{throw caught;}});
 await crm.tick();const update=db.calls.find(c=>c.sql.includes('error_code=$3'));
 assert.equal(update.args[3],expected);assert.equal(update.args[4],false);
});
