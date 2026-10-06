import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createCRMHostedHandler} from './hosted.mjs';

// SYN only: fake runtime, no credentials, database or provider calls.
const secret='SYN-CRM-trigger-secret-0123456789abcdef';
const endpoint='https://syn.invalid/api/internal/crm';
const request=(method='GET',options={})=>new Request(endpoint+(options.query??''),{
 method,headers:options.headers??{authorization:'Bearer '+secret},
 ...(options.body===undefined?{}:{body:options.body})
});
function setup(options={}){
 const calls={runtime:0,tick:[],close:0};
 const handler=createCRMHostedHandler({secret,runtime:async()=>{
  calls.runtime++;
  return {crm:{tick:async input=>{calls.tick.push(input);return {state:'continuation',pages:1};}},close:async()=>{calls.close++;}};
 },...options});
 return {handler,calls};
}
async function check(response,status,code){
 assert.equal(response.status,status);
 assert.equal(response.headers.get('cache-control'),'private, no-store');
 const value=await response.json();if(code)assert.deepEqual(value,{code});return value;
}
for(const method of ['GET','POST']){
 test(`${method}: authenticated request uses unchanged bounded CRM tick and closes`,async()=>{
  const f=setup();const result=await check(await f.handler(request(method)),200);
  assert.deepEqual(result,{data:{state:'continuation',pages:1}});
  assert.deepEqual(f.calls,{runtime:1,tick:[{deadlineMs:15000,maxPages:1}],close:1});
 });
 test(`${method}: anonymous, incorrect and spoofed scheduler headers never start runtime`,async()=>{
  const f=setup();for(const headers of [{},{authorization:'Bearer SYN-wrong'},
   {authorization:'Bearer '+secret+'x'},{authorization:secret},{cookie:'SYN-session=owner','user-agent':'vercel-cron/1.0','x-vercel-cron-schedule':'*/5 * * * *'}]){
   await check(await f.handler(request(method,{headers})),401,'UNAUTHORIZED');
  }assert.equal(f.calls.runtime,0);
 });
 test(`${method}: any query is rejected without tenant selection`,async()=>{
  const f=setup();for(const query of ['?tenantId=SYN-other','?maxPages=5','?x=','?cron=1']){
   await check(await f.handler(request(method,{query})),400,'BODY_NOT_ALLOWED');
  }assert.equal(f.calls.runtime,0);
 });
 test(`${method}: missing or invalid server configuration fails closed`,async()=>{
  for(const options of [{secret:undefined},{secret:''},{secret:'short'},{runtime:undefined},{timeoutMs:0}]){
   const f=setup(options);await check(await f.handler(request(method)),503,'CRM_CONFIGURATION_REQUIRED');assert.equal(f.calls.runtime,0);
  }
 });
 test(`${method}: idle worker closes without tick`,async()=>{
  let closed=0;const f=setup({runtime:async()=>({idle:true,close:async()=>{closed++;}})});
  await check(await f.handler(request(method)),200,'IDLE');assert.equal(closed,1);
 });
 test(`${method}: runtime failure remains unavailable and releases guard`,async()=>{
  let calls=0;const f=setup({runtime:async()=>{if(calls++===0)throw Error('SYN-private');return {idle:true,close:async()=>{}};}});
  await check(await f.handler(request(method)),503,'CRM_WORKER_UNAVAILABLE');
  await check(await f.handler(request(method)),200,'IDLE');assert.equal(calls,2);
 });
}
test('POST accepts only empty body or exact empty object',async()=>{
 const f=setup();await check(await f.handler(request('POST',{body:'{}'})),200);
 for(const body of ['{"tenantId":"SYN-other"}','{"maxPages":5}','null','[]',' ','{ }']){
  await check(await f.handler(request('POST',{body})),400,'BODY_NOT_ALLOWED');
 }assert.equal(f.calls.runtime,1);
});
test('GET rejects bodies including POST empty object protocol before runtime',async()=>{
 const f=setup();for(const body of ['{}','{"tenantId":"SYN-other"}',' ']){
  // Fetch Request forbids GET bodies; a request-shaped port checks the server guard explicitly.
  await check(await f.handler({method:'GET',url:endpoint,headers:new Headers({authorization:'Bearer '+secret}),text:async()=>body}),400,'BODY_NOT_ALLOWED');
 }assert.equal(f.calls.runtime,0);
});
test('unsupported methods cannot execute, including automatic HEAD',async()=>{
 const f=setup();for(const method of ['HEAD','PUT','PATCH','DELETE','OPTIONS'])await check(await f.handler(request(method)),405,'METHOD_NOT_ALLOWED');
 assert.equal(f.calls.runtime,0);
});
for(const [first,second] of [['GET','POST'],['POST','GET']]){
 test(`${first}/${second} share concurrency until close completes`,async()=>{
  let releaseTick,releaseClose,started,closing;const didStart=new Promise(resolve=>{started=resolve;}),didClose=new Promise(resolve=>{closing=resolve;});
  const tickWait=new Promise(resolve=>{releaseTick=resolve;}),closeWait=new Promise(resolve=>{releaseClose=resolve;});
  let runs=0;const handler=createCRMHostedHandler({secret,runtime:async()=>{
   if(runs++>0)return {idle:true,close:async()=>{}};
   return {crm:{tick:async()=>{started();await tickWait;return {pages:1};}},close:async()=>{closing();await closeWait;}};
  }});
  const running=handler(request(first));await didStart;
  await check(await handler(request(second)),409,'CHUNK_BUSY');
  releaseTick();await didClose;await check(await handler(request(second)),409,'CHUNK_BUSY');
  releaseClose();await check(await running,200);await check(await handler(request(second)),200,'IDLE');assert.equal(runs,2);
 });
}
test('failed tick closes and releases shared guard without leaking errors',async()=>{
 let closed=0,runs=0;const handler=createCRMHostedHandler({secret,runtime:async()=>{
  if(runs++>0)return {idle:true,close:async()=>{}};return {crm:{tick:async()=>{throw Error('SYN-provider-private');}},close:async()=>{closed++;}};
 }});
 await check(await handler(request('GET')),503,'CRM_WORKER_UNAVAILABLE');
 await check(await handler(request('POST')),200,'IDLE');assert.equal(closed,1);
});
test('deployment config declares only CRM every five minutes and route shares one handler',()=>{
 const config=JSON.parse(readFileSync(new URL('../../apps/web/vercel.json',import.meta.url),'utf8'));
 assert.deepEqual(config,{$schema:'https://openapi.vercel.sh/vercel.json',crons:[{path:'/api/internal/crm',schedule:'*/5 * * * *'}]});
 const route=readFileSync(new URL('../../apps/web/src/app/api/internal/crm/route.ts',import.meta.url),'utf8');
 assert.equal((route.match(/createCRMHostedHandler\(/g)??[]).length,1);
 assert.match(route,/const handler=createCRMHostedHandler\(\{secret:process\.env\.VEXA_WORKER_TRIGGER_SECRET/);
 assert.match(route,/export const GET=handler;/);assert.match(route,/export const POST=handler;/);
 assert.match(route,/consumer:'crm'/);assert.match(route,/dynamic='force-dynamic'/);
});
