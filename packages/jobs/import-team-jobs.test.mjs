import test from 'node:test';
import assert from 'node:assert/strict';
import {createImportHandler} from './imports.mjs';
const A='11111111-1111-4111-8111-111111111111';
function fixture(role,tenant=A){
 const calls=[];
 const handler=createImportHandler({database:{transaction:async(action,fn)=>{
  assert.equal(action,'read');return fn({tenantId:tenant,userId:'22222222-2222-4222-8222-222222222222',role,query:async(sql,args)=>{
   calls.push({sql,args});assert.equal(args[0],tenant);
   if(sql.startsWith('SELECT j.id,j.state')){
    assert.match(sql,/WHERE j.tenant_id=\$1 AND j.type='import'/);
    assert.match(sql,/i.tenant_id=j.tenant_id/);assert.match(sql,/c.tenant_id=i.tenant_id/);
    return {rows:Array.from({length:51},(_,i)=>({id:'job-'+(i+args[1]),state:i?'succeeded':'running',accepted:String(i),rejected:'0',duplicates:'0',account_id:'SYN CSV',created_at:'2026-10-01T00:00:00Z'}))};
   }
   return {rows:[]};
  }});
 }},storage:{createUpload:()=>assert.fail('Read cannot sign uploads'),read:()=>assert.fail('Read cannot download private uploads')},confirmationSecret:'SYN'.repeat(16)});
 return {calls,request:async(q='')=>{const response=await handler(new Request('https://fixture.invalid/api/imports'+q));return {status:response.status,...await response.json()};}};
}
test('owner sees other uploaders’ job metadata with bounded pagination and unchanged own reservations',async()=>{
 const f=fixture('owner'),r=await f.request('?team_offset=50');assert.equal(r.status,200);assert.equal(r.data.team_jobs.length,50);assert.equal(r.data.team_jobs[0].id,'job-50');assert.equal(r.data.next_team_offset,100);assert.deepEqual(r.data.reservations,[]);assert(f.calls.some(c=>c.sql.includes('u.user_id=$2')));
 assert(r.data.team_jobs.every(j=>!('user_id'in j)&&!('object_path'in j)&&!('upload_token'in j)));
});
for(const role of ['analyst','viewer','operator'])test(role+' does not obtain team job metadata',async()=>{const f=fixture(role),r=await f.request();assert.equal(r.status,200);assert.deepEqual(r.data.team_jobs,[]);assert.equal(r.data.next_team_offset,null);assert(!f.calls.some(c=>c.sql.startsWith('SELECT j.id,j.state')));});
test('a different authorized organization pins every read to its own scope',async()=>{const tenant='33333333-3333-4333-8333-333333333333',f=fixture('owner',tenant);assert.equal((await f.request()).status,200);assert(f.calls.every(c=>c.args[0]===tenant));assert.equal((await f.request('?tenant_id='+A)).status,404);});
for(const query of ['?team_offset=-1','?team_offset=0.5','?team_offset=1000001','?team_offset=x','?team_offset=0&team_offset=1'])test('invalid team pagination rejected: '+query,async()=>{const f=fixture('owner');assert.equal((await f.request(query)).status,400);assert.equal(f.calls.length,0);});
