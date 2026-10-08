import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const candidate=process.env.VEXA_CANDIDATE;
assert.ok(candidate&&path.isAbsolute(candidate),'EXPLICIT_CANDIDATE_REQUIRED');
const {createCRMHostedHandler}=await import(pathToFileURL(path.join(candidate,'packages/connectors/hosted.mjs')));
const {createCRMRuntime}=await import(pathToFileURL(path.join(candidate,'packages/connectors/runtime.mjs')));
const secret='SYN-crm-bounded-trigger-0123456789abcdef';
const request=(method='GET',headers={authorization:'Bearer '+secret})=>new Request('http://localhost/api/internal/crm',{method,headers});

for(const method of ['GET','POST'])test(`${method} admits up to100 durable units under unchanged15s deadline`,async()=>{
 let observed,closed=0;
 const handler=createCRMHostedHandler({secret,runtime:async()=>({crm:{tick:async input=>{observed=input;return {state:'continuation',pages:7};}},close:async()=>{closed++;}})});
 const response=await handler(request(method));assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store');
 assert.deepEqual(await response.json(),{data:{state:'continuation',pages:7}});assert.deepEqual(observed,{deadlineMs:15000,maxPages:100},'BOUNDED_MULTI_UNIT_REQUEST');assert.equal(closed,1);
});
test('runtime permits100 but rejects invalid bounds before any database access',async()=>{
 let transactions=0;const runtime=createCRMRuntime({database:{transaction:async(_action,work)=>{transactions++;return work({tenantId:'SYN',query:async()=>({rows:[]})});}},resolveCredentials:()=>assert.fail('idle cannot resolve credentials')});
 for(const maxPages of [0,101,100.5,Infinity])await assert.rejects(runtime.tick({deadlineMs:15000,maxPages}),/CRM_RUNTIME_LIMIT/);
 assert.equal(transactions,0);assert.deepEqual(await runtime.tick({deadlineMs:15000,maxPages:100}),{state:'idle'});assert.equal(transactions,1);
});
test('caller cannot increase units or deadline using trigger body/query',async()=>{
 let calls=0;const handler=createCRMHostedHandler({secret,runtime:async()=>{calls++;return {idle:true,close:async()=>{}};}});
 for(const suffix of ['?maxPages=10000','?deadlineMs=60000'])assert.equal((await handler(new Request('http://localhost/api/internal/crm'+suffix,{headers:{authorization:'Bearer '+secret}}))).status,400);
 for(const body of ['{"maxPages":10000}','{"deadlineMs":60000}'])assert.equal((await handler(new Request('http://localhost/api/internal/crm',{method:'POST',headers:{authorization:'Bearer '+secret},body}))).status,400);
 assert.equal((await handler(request('GET',{}))).status,401);assert.equal(calls,0);
});
test('GET and POST remain busy through close; throwing close releases the guard',async()=>{
 let begin,finish,closeStarted,releaseClose;const began=new Promise(r=>begin=r),held=new Promise(r=>finish=r),closing=new Promise(r=>closeStarted=r),closeHeld=new Promise(r=>releaseClose=r);let count=0;
 const handler=createCRMHostedHandler({secret,runtime:async()=>++count===1?{crm:{tick:async()=>{begin();await held;return {pages:2};}},close:async()=>{closeStarted();await closeHeld;throw Error('SYN_CLOSE_FAILURE');}}:{idle:true,close:async()=>{}}});
 const first=handler(request('GET'));await began;assert.equal((await handler(request('POST'))).status,409);finish();await closing;assert.equal((await handler(request('POST'))).status,409);
 releaseClose();await assert.rejects(first,/SYN_CLOSE_FAILURE/);assert.equal((await handler(request('POST'))).status,200);assert.equal(count,2);
});
test('route and sync preserve40s admission60s platform and30s lease',()=>{
 const route=fs.readFileSync(path.join(candidate,'apps/web/src/app/api/internal/crm/route.ts'),'utf8');
 assert.match(route,/maxDuration=60/);assert.match(route,/deadlineAt:Date\.now\(\)\+40000/);
 assert.match(route,/export const GET=handler/);assert.match(route,/export const POST=handler/);
 assert.match(fs.readFileSync(path.join(candidate,'packages/connectors/runtime.mjs'),'utf8'),/leaseMs:30000/);
});
