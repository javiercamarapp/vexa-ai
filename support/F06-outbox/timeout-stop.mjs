import os from 'node:os';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';
import {setup,worker,eventually,bounded} from './harness.mjs';
import {policy,preferences} from './fixtures.mjs';

test('411 real HTTP timeout stays uncertain across restart and SIGTERM drains only the current send',{timeout:360000},async t=>{
 const evidence=fs.mkdtempSync(path.join(process.env.VEXA_FUNCTIONAL_EVIDENCE??os.tmpdir(),'vexa-f0609-timeout-'));fs.chmodSync(evidence,0o700);console.log('F0609_TIMEOUT_RUNNING:'+evidence);
 let h,server,daemon;const workers=[],requests=[],daemonOutput=[];let daemonExit;
 try{
  h=await setup(process.env.VEXA_CANDIDATE,evidence);
  server=createServer(async(req,res)=>{const body=[];for await(const chunk of req)body.push(chunk);assert.equal(req.method,'POST');assert.equal(req.url,'/SYN-notification');assert.equal(req.headers.authorization,undefined);requests.push({idempotencyKey:req.headers['idempotency-key'],body:JSON.parse(Buffer.concat(body).toString())}); /* Intentionally keep response open until the real consumer aborts. */ });
  server.listen(0,'127.0.0.1');await once(server,'listening');const url='http://127.0.0.1:'+server.address().port+'/SYN-notification';
  const owner=h.outbox().repository;await owner.configure(policy('email'));await preferences(h,h.A,'email',true,'membership.welcome');
  const input=()=>({eventId:randomUUID(),type:'membership.welcome',resourceId:h.A.id,userId:h.A.id,channel:'email'});
  const first=await owner.enqueue(input());const a=await worker(h,{sinkUrl:url});workers.push(a);
  const start=Date.now();const result=await a.call('consume');assert.equal(result.ok,true,JSON.stringify(result));const after=await owner.get(first.id);
  assert.equal(after.state,'uncertain');assert.equal(after.attempts,1);assert.equal(requests.length,1);assert.equal(a.barriers.at(-1).outcome.kind,'uncertain');assert.ok(Date.now()-start>=450,'REAL_TIMEOUT_NOT_EARLY');assert.ok(Date.now()-start<5000,'REAL_TIMEOUT_BOUNDED');await a.kill();
  const b=await worker(h,{sinkUrl:url});workers.push(b);await b.call('consume');await new Promise(resolve=>setTimeout(resolve,1100));await b.call('consume');assert.equal((await owner.get(first.id)).state,'uncertain');assert.equal(requests.length,1,'NO_BLIND_RETRY_AFTER_HTTP_TIMEOUT');await b.kill();
  await t.test('actual HTTP timeout remains uncertain with one effect after process restart',()=>assert.equal(requests.length,1));
  const second=await owner.enqueue(input()),third=await owner.enqueue(input());
  const modulePath=path.join(evidence,'syn-loopback-transport.mjs');
  fs.writeFileSync(modulePath,`export async function createTransports(env){const target=new URL(env.SYN_OUTBOX_SINK);if(target.hostname!=='127.0.0.1'||target.pathname!=='/SYN-notification')throw Error('SYN_SCOPE');return {email:{async configured(){return true;},async resolveRecipient(identity){return {...identity,email:'SYN-member@example.test',emailVerified:true};},async send(input){const response=await fetch(target,{method:'POST',headers:{'content-type':'application/json','idempotency-key':input.idempotencyKey},body:JSON.stringify({recipient:input.recipient,message:input.message}),signal:input.signal,redirect:'error'});return response.json();}}};}\n`);
  daemon=spawn(process.execPath,[path.join(h.built,'packages/notifications/daemon.mjs')],{cwd:h.tmp,env:{...h.common,NODE_OPTIONS:'--import='+fileURLToPath(new URL('../F06-recommendations/outbound-audit.mjs',import.meta.url)),VEXA_RECOMMENDATION_AUDIT:path.join(evidence,'outbound-attempts.jsonl'),VEXA_WORKER_EMAIL:h.bot.email,VEXA_WORKER_PASSWORD:h.bot.password,VEXA_WORKER_USER_ID:h.bot.id,VEXA_WORKER_TENANT:h.A.tenant,VEXA_WORKER_DISPATCHER:'enabled',VEXA_NOTIFICATION_TRANSPORT_MODULE:modulePath,VEXA_NOTIFICATION_TIMEOUT_MS:'1000',VEXA_NOTIFICATION_POLL_MS:'100',SYN_OUTBOX_SINK:url},stdio:['ignore','pipe','pipe']});
  daemonExit=once(daemon,'exit');daemon.stdout.on('data',x=>daemonOutput.push(String(x)));daemon.stderr.on('data',x=>daemonOutput.push(String(x)));
  await eventually(()=>requests.length,x=>x===2,'daemon-first-actual-http');const stop=Date.now();assert.equal(daemon.kill('SIGTERM'),true);const [code,signal]=await bounded(daemonExit,'graceful-stop',5000);assert.equal(code,0,daemonOutput.join(''));assert.equal(signal,null);assert.ok(Date.now()-stop<5000,'SIGTERM_EXIT_BOUNDED');
  const states=[await owner.get(second.id),await owner.get(third.id)];assert.equal(states.filter(x=>x.state==='uncertain').length,1);assert.equal(states.filter(x=>x.state==='queued').length,1);assert.equal(states.reduce((sum,x)=>sum+x.attempts,0),1);assert.equal(requests.length,2,'SIGTERM_DOES_NOT_ACQUIRE_NEXT_ROW');
  await t.test('real built daemon SIGTERM finishes bounded current send and leaves next row untouched',()=>assert.equal(requests.length,2));
  const attempts=fs.readFileSync(path.join(evidence,'outbound-attempts.jsonl'),'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);assert.equal(attempts.filter(x=>x.blocked).length,0);h.verifySources();
  fs.writeFileSync(path.join(evidence,'timeout-stop-results.json'),JSON.stringify({label:'SYN local HTTP only; no provider delivery',first:after,states,requests,daemon:{pid:daemon.pid,code,signal,output:daemonOutput.join('')},externalAttempts:0},null,2));
 }finally{
  if(daemon&&daemon.exitCode===null&&daemon.signalCode===null){daemon.kill('SIGKILL');await bounded(daemonExit,'cleanup-daemon',10000);}
  for(const w of workers)await w.kill();if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}if(h)await h.close();console.log('F0609_TIMEOUT_EVIDENCE:'+evidence);
 }
});
