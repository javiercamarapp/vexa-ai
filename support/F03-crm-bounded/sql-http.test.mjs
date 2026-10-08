import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {performance} from 'node:perf_hooks';
import {pathToFileURL} from 'node:url';
import {setup,q,hash} from '../../tests/acceptance/support/F03-sync/harness.mjs';

const candidate=process.env.VEXA_CANDIDATE,baseline=process.env.VEXA_CRM_BASELINE;
for(const p of [candidate,baseline])assert.ok(p&&path.isAbsolute(p),'EXPLICIT_CANDIDATE_AND_BASELINE_REQUIRED');
const evidence=process.env.VEXA_CRM_EVIDENCE??fs.mkdtempSync(path.join(os.tmpdir(),'rovaq-crm-bounded-'));
fs.mkdirSync(evidence,{recursive:true});
const baselineFile=path.join(baseline,'packages/connectors/hosted.mjs'),baselineHash=hash(fs.readFileSync(baselineFile));
const {createCRMHostedHandler:oldHosted}=await import(pathToFileURL(baselineFile));
const secret='SYN-crm-bounded-trigger-0123456789abcdef';
const fixtureDate='2026-02-01T00:00:00Z';
const report={schema:'rovaq-crm-bounded-local-v1',fixture:'SYN:one-thread-four-messages',candidate,baseline,baselineHostedHash:baselineHash,comparisonScope:'Original baseline hosted handler versus candidate handler, both using candidate runtime and identical synthetic input. Real loopback HTTP and PostgreSQL RLS; synthetic identity port, not Auth HTTP, Next or remote provider.',expectedCases:8,cases:[],measurement:null};
function provider(control){return async(raw,init)=>{
 const u=new URL(raw);assert.equal(u.origin,'https://api.hubapi.com','NO_EXTERNAL_TRANSPORT');assert.equal(u.searchParams.get('limit'),'1');
 const call=++control.calls;if(control.beforeFetch)await control.beforeFetch(call,u,init);
 if(control.failure&&call>=control.failure.at)return new Response('{}',{status:control.failure.status,headers:control.failure.delay===undefined?{}:{'Retry-After':control.failure.delay}});
 if(u.pathname==='/conversations/v3/conversations/threads')return Response.json({results:[{id:'T1',createdAt:fixtureDate}]});
 assert.equal(u.pathname,'/conversations/v3/conversations/threads/T1/messages');
 const index=u.searchParams.has('after')?Number(u.searchParams.get('after')):0;assert.ok(Number.isInteger(index)&&index>=0&&index<4,'FIXTURE_CURSOR');
 return Response.json({results:[{id:'M'+index,conversationsThreadId:'T1',createdAt:fixtureDate,type:'MESSAGE',text:'SYN bounded message '+index,truncationStatus:'NOT_TRUNCATED',senders:[{actorId:'V-SYN'}]}],...(index<3?{paging:{next:{after:String(index+1)}}}:{})});
};}
async function serve(handler){
 const server=createServer(async(req,res)=>{try{const chunks=[];for await(const chunk of req)chunks.push(chunk);const body=Buffer.concat(chunks);const input=new Request('http://localhost/api/internal/crm',{method:req.method,headers:req.headers,...(body.length?{body}: {})});const out=await handler(input);res.writeHead(out.status,Object.fromEntries(out.headers));res.end(Buffer.from(await out.arrayBuffer()));}catch{res.writeHead(500,{'content-type':'application/json'});res.end('{"error":"SYN_HANDLER_THROW"}');}});
 server.listen(0,'127.0.0.1');await once(server,'listening');const url='http://127.0.0.1:'+server.address().port+'/api/internal/crm';
 return {async invoke(method='POST'){const start=performance.now();const r=await fetch(url,{method,headers:{authorization:'Bearer '+secret},signal:AbortSignal.timeout(25000)});const body=await r.json();return{status:r.status,body,elapsedMs:performance.now()-start};},async close(){server.closeAllConnections();await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}};
}

test('CRM bounded HTTP/SQL regression and real-clock comparison',{timeout:300000},async t=>{
 const h=await setup(candidate,evidence);const servers=[];
 t.after(async()=>{try{for(const s of servers)await s.close();h.verifySources();assert.equal(hash(fs.readFileSync(baselineFile)),baselineHash,'BASELINE_UNCHANGED');report.sourcesUnchanged=true;}finally{await h.close();report.cleanup=JSON.parse(fs.readFileSync(path.join(evidence,'cleanup.json'),'utf8'));report.passed=!t.signal.aborted&&report.sourcesUnchanged===true&&report.cleanup.removed===true&&report.cases.length===report.expectedCases&&report.cases.every(x=>x.status==='pass');fs.writeFileSync(path.join(evidence,'report.json'),JSON.stringify(report,null,2),{mode:0o600});}});
 const {createCRMRuntime}=await import(pathToFileURL(path.join(h.built,'packages/connectors/runtime.mjs')));
 const {createCRMHostedHandler}=await import(pathToFileURL(path.join(h.built,'packages/connectors/hosted.mjs')));
 const read=a=>h.json(`SELECT json_build_object('pages',(SELECT count(*) FROM sync_pages WHERE tenant_id=${q(a.tenant)}),'raw',(SELECT count(*) FROM sync_raw_objects WHERE tenant_id=${q(a.tenant)}),'messages',(SELECT count(*) FROM messages WHERE tenant_id=${q(a.tenant)}),'cursor',(SELECT row_to_json(x) FROM (SELECT version,done,checkpoint,worker_id,lease_until FROM sync_cursors WHERE tenant_id=${q(a.tenant)} LIMIT 1)x),'settings',(SELECT row_to_json(x) FROM (SELECT failure_count,error_code,isfinite(next_attempt_at) AS finite,extract(epoch FROM(next_attempt_at-clock_timestamp())) AS wait_seconds FROM crm_sync_settings WHERE connection_id=${q(a.connection)})x))`);
 const due=a=>h.sql(`UPDATE crm_sync_settings SET next_attempt_at=clock_timestamp()-interval '1 second' WHERE connection_id=${q(a.connection)}`);
 async function fixture({legacy=false,fault,clock,beforeFetch,failure}={}){
  const a=h.actor('owner',undefined,'hubspot'),control={calls:0,beforeFetch,failure};
  const {database}=h.repository(a,{fault});const runtime=createCRMRuntime({database,clock:clock??Date.now,fetch:provider(control),resolveCredentials:()=>({token:'SYN-FIXTURE-TOKEN',scopes:['conversations.read'],version:'v3'})});
  const input={source:'hubspot',accountId:'SYN-bounded-'+a.id,credentialRef:'SYN-bounded-ref',enabled:true,historyFrom:'2026-01-01T00:00:00Z',overlapSeconds:0,pollSeconds:300};
  const configured=await runtime.configure(input);a.connection=configured.connectionId;
  let closes=0;const handler=(legacy?oldHosted:createCRMHostedHandler)({secret,runtime:async()=>({crm:runtime,close:async()=>{closes++;}})}),http=await serve(handler);servers.push(http);
  return{a,control,runtime,input,http,closes:()=>closes};
 }
 async function check(name,fn){await t.test(name,async()=>{try{await fn();report.cases.push({name,status:'pass'});}catch(error){report.cases.push({name,status:'fail',code:error.code??null});throw error;}});}
 function state(response,expected){assert.equal(response.status,200);assert.equal(response.body.data.state,expected);}
 function committed(s,n,done=false){assert.equal(s.pages,n);assert.equal(s.raw,n);assert.equal(s.messages,Math.max(0,n-1));assert.equal(Number(s.cursor.version),n);assert.equal(s.cursor.done,done);if(done)assert.equal(s.cursor.checkpoint,null);else{assert.equal(s.cursor.checkpoint.version,2);assert.equal(s.cursor.checkpoint.state.phase,'messages');} }
 await check('same SYN dataset: baseline one unit per HTTP, candidate five units per HTTP; real elapsed time',async()=>{
  const old=await fixture({legacy:true}),current=await fixture();const samples=[];
  for(let i=0;i<5;i++){if(i)due(old.a);const r=await old.http.invoke(i%2?'GET':'POST');state(r,i===4?'done':'continuation');assert.equal(r.body.data.pages,1);samples.push(r.elapsedMs);committed(read(old.a),i+1,i===4);}
  const r=await current.http.invoke();state(r,'done');assert.equal(r.body.data.pages,5);committed(read(current.a),5,true);assert.equal(current.control.calls,5);assert.equal(old.control.calls,5);assert.equal(current.closes(),1);assert.equal(old.closes(),5);
  report.measurement={clock:'performance.now real wall time; SQL forced due between baseline invocations, scheduling waits excluded',baseline:{httpCalls:5,providerCalls:5,pages:5,httpElapsedMs:samples,totalHttpElapsedMs:samples.reduce((a,b)=>a+b,0)},candidate:{httpCalls:1,providerCalls:5,pages:5,totalHttpElapsedMs:r.elapsedMs},claim:'5x durable units per HTTP on this fixture; no production speed or latency claim'};
 });
 await check('15s boundary after committed units preserves checkpoint and resumes next HTTP',async()=>{
  let now=Date.now(),advance=true,page=false,commits=0;const fault={before:async text=>{if(text.includes('INSERT INTO public.sync_pages'))page=true;},after:async text=>{if(text==='COMMIT'&&page){page=false;commits++;if(advance)now+=8000;}}};
  const x=await fixture({clock:()=>now,fault});const first=await x.http.invoke();state(first,'continuation');assert.equal(first.body.data.pages,2);assert.equal(commits,2);committed(read(x.a),2);assert.equal(x.control.calls,2);assert.equal(read(x.a).settings.failure_count,0);assert.equal(read(x.a).cursor.worker_id,null);
  advance=false;due(x.a);const next=await x.http.invoke('GET');state(next,'done');assert.equal(next.body.data.pages,3);committed(read(x.a),5,true);assert.equal(x.control.calls,5);
 });
 await check('real transport abort at exhausted clock: zero commits is failure; prior commit is continuation',async()=>{
  for(const timeoutAt of [1,2]){
   let now=Date.now(),aborted=0;const x=await fixture({clock:()=>now,beforeFetch:async(call,_u,init)=>{if(call===timeoutAt){now+=16000;await new Promise((_resolve,reject)=>{init.signal.addEventListener('abort',()=>{aborted++;reject(Error('SYN_ABORT'));},{once:true});});}}});
   const response=await x.http.invoke();state(response,timeoutAt===1?'blocked':'continuation');const s=read(x.a);assert.equal(aborted,1);assert.equal(s.pages,timeoutAt-1);assert.equal(s.raw,timeoutAt-1);assert.equal(Number(s.cursor.version),timeoutAt-1);assert.equal(s.cursor.done,false);assert.equal(s.cursor.worker_id,null);assert.equal(s.settings.failure_count,timeoutAt===1?1:0);if(timeoutAt===2){assert.equal(response.body.data.pages,1);committed(s,1);}else assert.equal(s.cursor.checkpoint,null);
  }
 });
 await check('401 after a committed unit latches reconnect and prevents later provider fetch',async()=>{
  const x=await fixture({failure:{at:2,status:401}});const r=await x.http.invoke();state(r,'blocked');assert.equal(r.body.data.code,'RECONNECT_REQUIRED');committed(read(x.a),1);assert.equal(read(x.a).cursor.worker_id,null);due(x.a);state(await x.http.invoke(),'idle');assert.equal(x.control.calls,2);assert.equal(h.json(`SELECT to_json(state) FROM connection_health WHERE connection_id=${q(x.a.connection)}`),'reconnect_required');
 });
 await check('429 Retry-After600 is a durable minimum beyond300s and blocks immediate retry',async()=>{
  const x=await fixture({failure:{at:2,status:429,delay:'600'}});state(await x.http.invoke(),'blocked');const s=read(x.a);committed(s,1);assert.equal(s.settings.failure_count,1);assert.ok(s.settings.wait_seconds>=595&&s.settings.wait_seconds<=605,'PROVIDER_600_SECONDS_MINIMUM');state(await x.http.invoke(),'idle');assert.equal(x.control.calls,2);
  x.control.failure=null;due(x.a);state(await x.http.invoke(),'done');committed(read(x.a),5,true);assert.equal(x.control.calls,6);
 });
 await check('invalid overflowing provider delay is finite, blocked and recoverable by owner configure',async()=>{
  const x=await fixture({failure:{at:2,status:429,delay:'9'.repeat(400)}});state(await x.http.invoke(),'blocked');let s=read(x.a);committed(s,1);assert.equal(s.settings.failure_count,4);assert.equal(s.settings.finite,true);const settings=(await x.runtime.list()).settings;assert.equal(settings.length,1);assert.ok(Number.isFinite(Date.parse(settings[0].nextAttemptAt)));due(x.a);state(await x.http.invoke(),'idle');assert.equal(x.control.calls,2);
  x.control.failure=null;await x.runtime.configure({...x.input,connectionId:x.a.connection,expectedVersion:settings[0].version});state(await x.http.invoke(),'done');s=read(x.a);committed(s,5,true);assert.equal(s.settings.failure_count,0);
 });
 await check('revocation during second fetch denies second commit while retaining first checkpoint',async()=>{
  const x=await fixture();x.control.beforeFetch=async call=>{if(call===2)h.sql(`UPDATE memberships SET status='revoked' WHERE tenant_id=${q(x.a.tenant)} AND user_id=${q(x.a.id)}`);};const r=await x.http.invoke();assert.equal(r.status,503);committed(read(x.a),1);assert.equal(x.control.calls,2);assert.equal((await x.http.invoke()).status,503);assert.equal(x.control.calls,2);
 });
 await check('second COMMIT fails: second page and canonical writes roll back, next HTTP resumes exactly',async()=>{
  let page=false,confirmed=0,armed=true;const fault={before:async(text,_args,client)=>{if(text.includes('INSERT INTO public.sync_pages'))page=true;if(text==='COMMIT'&&page&&confirmed===1&&armed){armed=false;page=false;await client.query('ROLLBACK');throw Object.assign(Error('SYN_COMMIT_UNAVAILABLE'),{code:'08006'});}},after:async text=>{if(text==='COMMIT'&&page){page=false;confirmed++;}}};
  const x=await fixture({fault});state(await x.http.invoke(),'blocked');assert.equal(armed,false);committed(read(x.a),1);assert.equal(read(x.a).cursor.worker_id,null);due(x.a);state(await x.http.invoke(),'done');committed(read(x.a),5,true);assert.equal(confirmed,5);assert.equal(x.control.calls,6);
 });
 console.log('CRM_BOUNDED_EVIDENCE='+evidence);
});
