import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {inputs,setup,q,worker,cli,eventually} from './harness.mjs';
import {seedNotificationResource,createReader,sink,policy,event,preferences} from './fixtures.mjs';
const candidate=process.env.VEXA_CANDIDATE;
test('F06-09 durable outbox implementation exists before runtime setup',()=>inputs(candidate));
test('F06-09 real SQL Auth and independent consumers preserve notification effects and uncertainty',{timeout:540000},async t=>{
 inputs(candidate);const evidence=fs.mkdtempSync(path.join(process.env.VEXA_FUNCTIONAL_EVIDENCE??os.tmpdir(),'vexa-f0609-run-'));fs.chmodSync(evidence,0o700);console.log('F0609_RUNNING:'+evidence);
 let h,receiver;const workers=[];
 const step=async(name,fn)=>{let error;await t.test(name,async()=>{try{await fn();}catch(e){error=e;throw e;}});if(error)throw Error('OUTBOX_PREREQUISITE:'+name,{cause:error});};
 try{
  h=await setup(candidate,evidence);receiver=await sink();let f,owner,viewer,viewerRepo,first,emailPolicyVersion=1;
  const processWorker=async options=>{const value=await worker(h,{sinkUrl:receiver.url,...options});workers.push(value);return value;};
  const waitQuota=async()=>{const ms=Number(h.sql(`SELECT coalesce(max(greatest(0,ceil(extract(epoch from(next_allowed_at-clock_timestamp()))*1000))),0)::text FROM notification_dispatch_limits WHERE tenant_id=${q(h.A.tenant)} AND user_id=${q(h.A.id)} AND channel='email'`));assert.ok(ms>=0&&ms<=10000,'BOUNDED_REAL_QUOTA_WAIT');if(ms)await new Promise(r=>setTimeout(r,ms+25));};
  const counts=()=>h.json("SELECT jsonb_build_object('events',(SELECT count(*) FROM notification_events),'items',(SELECT count(*) FROM notification_outbox_items),'outbox',(SELECT count(*) FROM notification_outbox),'jobs',(SELECT count(*) FROM jobs))");
  await step('published fixture authorizes actual VEXA recipients and owner policy has CAS',async()=>{
   f=await seedNotificationResource(h);viewer=await createReader(h);owner=h.outbox();viewerRepo=h.outbox(viewer).repository;
   assert.equal((await owner.repository.health()).healthy,true);await assert.rejects(viewerRepo.health(),e=>e.status===403);h.sql(`UPDATE memberships SET role='analyst' WHERE tenant_id=${q(h.A.tenant)} AND user_id=${q(viewer.id)}`);try{await assert.rejects(viewerRepo.health(),e=>e.status===403);}finally{h.sql(`UPDATE memberships SET role='viewer' WHERE tenant_id=${q(h.A.tenant)} AND user_id=${q(viewer.id)}`);}
   for(const channel of ['email','inapp']){await owner.repository.configure(policy(channel));await preferences(h,h.A,channel);}
   await assert.rejects(owner.repository.configure(policy('email')),e=>e.status===409);
   await assert.rejects(viewerRepo.configure(policy('push')),e=>e.status===403);
   await assert.rejects(viewerRepo.enqueue(event(h,f)),e=>e.status===403);
   await assert.rejects(owner.repository.enqueue(event(h,f,{userId:f.a.customers.C1})),e=>e.status===403);
   assert.equal(receiver.requests.length,0);
  });
  await step('event items and canonical job commit atomically and duplicate identity cannot change content',async()=>{
   const before=counts(),input=event(h,f),sentinel=Error('SYN_ATOMIC_ROLLBACK');let staged=false;
   await assert.rejects(owner.database.transaction('import',async scope=>{await owner.repository.enqueueIn(scope,input);staged=true;throw sentinel;}),e=>e.status===503&&e.code==='database_unavailable');assert.equal(staged,true,'ATOMIC_ROLLBACK_AFTER_ENQUEUE');assert.deepEqual(counts(),before);
   const pair=await Promise.all([owner.repository.enqueue(input),owner.repository.enqueue(input)]);assert.equal(pair[0].id,pair[1].id);first=pair[0];assert.equal(first.items.length,1);assert.equal(first.items[0].eventId,input.eventId);
   await assert.rejects(owner.repository.enqueue({...input,type:'membership.welcome',resourceId:h.A.id}),e=>e.status===409);
   const after=counts();for(const key of ['events','items','outbox','jobs'])assert.equal(after[key],before[key]+1,key);
   assert.equal(receiver.requests.length,0);
  });
  await step('two authenticated consumer processes produce one accepted effect without claiming delivered',async()=>{
   const a=await processWorker(),b=await processWorker();const results=await Promise.all([a.call('consume'),b.call('consume')]);assert.ok(results.every(x=>x.ok),JSON.stringify(results));
   const row=await owner.repository.get(first.id);assert.equal(row.state,'accepted');assert.equal(row.attempts,1);assert.equal(receiver.requests.length,1);assert.equal(receiver.requests[0].idempotencyKey,row.idempotencyKey);assert.equal(receiver.requests[0].body.recipient.userId,h.A.id);assert.equal(receiver.requests[0].body.recipient.tenantId,h.A.tenant);assert.equal(receiver.requests[0].body.message.href,'/notifications');assert.equal(row.items.length,1);assert.notEqual(row.state,'delivered');assert.notEqual(row.state,'read');
   await a.kill();await b.kill();
  });
  await step('built CLI dispatcher processes in-app notifications for two tenants without external transport',async()=>{
   const other=h.outbox(h.B).repository;await other.configure(policy('inapp'));await preferences(h,h.B,'inapp',true,'membership.welcome');
   const own=await owner.repository.enqueue(event(h,f,{channel:'inapp'}));const foreign=await other.enqueue({eventId:randomUUID(),type:'membership.welcome',resourceId:h.B.id,userId:h.B.id,channel:'inapp'});
   const before=receiver.requests.length;const runs=[];for(let i=0;i<4;i++){const run=await cli(h),states={own:(await owner.repository.get(own.id)).state,other:(await other.get(foreign.id)).state};runs.push({...run,states});fs.writeFileSync(path.join(evidence,'cli-dispatch.json'),JSON.stringify(runs));assert.equal(run.code,0,run.output);if(states.own==='accepted'&&states.other==='accepted')break;}
   assert.equal((await owner.repository.get(own.id)).state,'accepted');assert.equal((await other.get(foreign.id)).state,'accepted');assert.equal(receiver.requests.length,before);
   const inboxA=await h.request(h.A,'/api/notifications?limit=100&status=all'),inboxB=await h.request(h.B,'/api/notifications?limit=100&status=all');assert.equal(inboxA.status,200);assert.equal(inboxB.status,200);assert.equal(inboxA.data.data.items.filter(x=>x.resourceId===f.brief.id).length,1);assert.equal(inboxB.data.data.items.filter(x=>x.resourceId===h.B.id).length,1);assert.ok(inboxA.data.data.items.every(x=>x.resourceId!==h.B.id));
   fs.writeFileSync(path.join(evidence,'cli-dispatch.json'),JSON.stringify(runs));
  });
  await step('daemon reacquires idle scopes and closes runtimes on failure; malformed CLI configuration fails without secrets',async()=>{
   const {runNotificationDaemon,loadNotificationTransports}=await import(pathToFileURL(path.join(h.built,'packages/notifications/daemon.mjs')));const abort=new AbortController();let acquired=0,closed=0;
   // Lifecycle injection only; the preceding CLI case supplies actual Auth/PG dispatch evidence.
   await runNotificationDaemon(async()=>{acquired++;if(acquired===3)abort.abort();return {idle:true,async close(){closed++;}};},{signal:abort.signal,intervalMs:100});assert.equal(acquired,3);assert.equal(closed,3);
   let failureClosed=false;await assert.rejects(runNotificationDaemon(async()=>({database:{async transaction(){throw Error('SYN_TRANSACTION_FAILURE');}},async close(){failureClosed=true;}}),{once:true}),/SYN_TRANSACTION_FAILURE/);assert.equal(failureClosed,true);
   assert.deepEqual(await loadNotificationTransports({}),{});await assert.rejects(loadNotificationTransports({VEXA_NOTIFICATION_TRANSPORT_MODULE:'https://example.invalid/module.mjs'}),/CONFIGURATION_REQUIRED/);
   const invalid=await cli(h,{args:['--unknown-SYN-SECRET']});assert.equal(invalid.code,1);assert.doesNotMatch(invalid.output,/SYN-SECRET|postgresql:|Bearer|access_token|password/i);assert.match(invalid.output,/consumer unavailable/i);
  });
  await step('crash after real HTTP before commit persists uncertain and lease expiry cannot resend',async()=>{
   await waitQuota();const row=await owner.repository.enqueue(event(h,f)),a=await processWorker();await a.call('settings',{hold:true});const sending=a.call('consume');
   const barrier=await eventually(()=>a.barriers,x=>x.length>0,'after-http-before-commit');assert.equal(barrier[0].outcome.kind,'accepted');const seen=receiver.requests.length;assert.equal((await owner.repository.get(row.id)).state,'sending');await a.kill();await sending;
   const b=await processWorker();await eventually(async()=>{await b.call('consume');return owner.repository.get(row.id);},x=>x.state==='uncertain','expired-sending-is-uncertain',40000);
   const before=await owner.repository.get(row.id);assert.equal(before.state,'uncertain');await b.call('consume');await new Promise(r=>setTimeout(r,1100));await b.call('consume');const after=await owner.repository.get(row.id);assert.equal(after.state,'uncertain');assert.equal(after.attempts,before.attempts);assert.equal(receiver.requests.length,seen);await b.kill();
   fs.writeFileSync(path.join(evidence,'crash-uncertain.json'),JSON.stringify({id:row.id,sinkCount:seen,state:after.state,attempts:after.attempts}));
   const actualReceipt=[...receiver.receipts.values()].find(x=>x.idempotencyKey===after.idempotencyKey);assert.ok(actualReceipt,'LOCAL_HTTP_RECEIPT_EXISTS');
   const input={id:row.id,expectedFence:after.fence,decision:'accepted',evidenceId:actualReceipt.evidenceId,requestKey:randomUUID()};await assert.rejects(owner.repository.reconcile(input));
   await h.assertVerifierIsolation();
   const resolve=await h.verifier(async({outbox,decision})=>{const receipt=[...receiver.receipts.values()].find(x=>x.idempotencyKey===outbox.idempotencyKey&&x.tenantId===outbox.tenantId&&x.userId===outbox.userId&&x.decision===decision);if(!receipt)throw Error('SYN_RECEIPT_MISMATCH');return {verified:true,idempotencyKey:receipt.idempotencyKey,decision,providerId:receipt.providerId,evidence:JSON.stringify(receipt)};});
   const verified=h.outbox(h.A,{verifyReconciliation:resolve}).repository;
   const unverified=h.outbox(h.A,{verifyReconciliation:await h.verifier(async()=>({verified:false,idempotencyKey:after.idempotencyKey,decision:'accepted',providerId:'SYN-forged',evidence:'SYN-no-receipt'}))}).repository;await assert.rejects(unverified.reconcile(input));
   const wrong=h.outbox(h.A,{verifyReconciliation:async()=>({outboxId:after.id,decision:'accepted',evidenceId:input.evidenceId,idempotencyKey:'0'.repeat(64),providerId:actualReceipt.providerId})}).repository;await assert.rejects(wrong.reconcile(input));
   await verified.reconcile(input);assert.equal((await verified.get(row.id)).state,'accepted');assert.equal(receiver.requests.length,seen);await verified.reconcile(input);assert.equal(receiver.requests.length,seen);
  });
  await step('verified not-sent evidence alone permits a bounded retry with the original idempotency key',async()=>{
   await waitQuota();const row=await owner.repository.enqueue(event(h,f)),a=await processWorker(),seen=receiver.requests.length;
   receiver.responses.push({status:503,body:{kind:'uncertain'},evidenceDecision:'not_sent'});await a.call('consume');const uncertain=await owner.repository.get(row.id);assert.equal(uncertain.state,'uncertain');assert.equal(receiver.requests.length,seen+1);
   const proof=[...receiver.receipts.values()].find(x=>x.idempotencyKey===uncertain.idempotencyKey&&x.decision==='not_sent');assert.ok(proof,'SYN_NO_ACCEPTANCE_EVIDENCE');
   const verify=await h.verifier(async({outbox,decision})=>{const receipt=receiver.receipts.get(proof.evidenceId);if(decision!=='not_sent'||receipt.idempotencyKey!==outbox.idempotencyKey||receipt.tenantId!==outbox.tenantId||receipt.userId!==outbox.userId)throw Error('SYN_RECEIPT_MISMATCH');return {verified:true,idempotencyKey:receipt.idempotencyKey,decision,evidence:JSON.stringify(receipt)};});
   const recovery=h.outbox(h.A,{verifyReconciliation:verify}).repository,input={id:row.id,expectedFence:uncertain.fence,decision:'not_sent',evidenceId:proof.evidenceId,requestKey:randomUUID()};await recovery.reconcile(input);assert.equal((await recovery.get(row.id)).state,'retry');
   await eventually(async()=>{await a.call('consume');return recovery.get(row.id);},x=>x.state==='accepted','verified-retry-accepted');assert.equal(receiver.requests.length,seen+2);assert.equal(receiver.requests.at(-1).idempotencyKey,receiver.requests.at(-2).idempotencyKey);assert.equal((await recovery.get(row.id)).attempts,2);await assert.rejects(recovery.reconcile({...input,decision:'accepted'}),e=>e.status===409);await a.kill();
  });
  await step('causal calibration rejects automatic resend after uncertain crash and restores SQL exactly',async()=>{
   const definition=()=>h.sql("SELECT pg_get_functiondef('public.notification_claim(integer)'::regprocedure)");const original=definition(),hash=value=>createHash('sha256').update(value).digest('hex');
   const branch="if o.state='sending' then update public.notification_outbox set state='uncertain',code='lease_expired_during_send'";
   const job="update public.jobs set state='failed',lease_until=null where tenant_id=t and id=j.id;";
   assert.equal(original.split(branch).length,2,'MUTANT_SINGLE_SENDING_BRANCH');assert.equal(original.split(job).length,3,'MUTANT_TWO_TERMINAL_BRANCHES');
   const mutant=original.replace(branch,branch.replace("state='uncertain'","state='retry'")).replace(job,job.replace("state='failed'","state='queued'"));
   const exercise=async label=>{
    await waitQuota();const row=await owner.repository.enqueue(event(h,f)),a=await processWorker();await a.call('settings',{hold:true});const pending=a.call('consume');await eventually(()=>a.barriers,x=>x.length>0,label+'-after-http');const seen=receiver.requests.length;await a.kill();await pending;
    const sending=await owner.repository.get(row.id);assert.equal(sending.state,'sending');await eventually(()=>owner.repository.get(row.id),x=>Date.parse(x.leaseUntil)<=Date.now(),label+'-lease-expired');
    const b=await processWorker();const response=await b.call('consume');assert.ok(response.ok,JSON.stringify(response));const recovered=await owner.repository.get(row.id);await b.kill();return {label,id:row.id,before:sending,after:recovered,httpBefore:seen,httpAfter:receiver.requests.length};
   };
   let negative;try{h.sql(mutant);assert.notEqual(hash(definition()),hash(original));negative=await exercise('SYN_MUTANT');assert.equal(negative.after.state,'accepted','MUTANT_ACTUALLY_RESENT');assert.equal(negative.httpAfter,negative.httpBefore+1,'MUTANT_SECOND_HTTP_OBSERVED');assert.throws(()=>assert.equal(negative.httpAfter,negative.httpBefore,'NO_RESEND'),/NO_RESEND/);}
   finally{h.sql(original);assert.equal(hash(definition()),hash(original),'SQL_MUTANT_RESTORED_EXACT');}
   const restored=await exercise('SYN_RESTORED');assert.equal(restored.after.state,'uncertain');assert.equal(restored.httpAfter,restored.httpBefore,'NO_RESEND');fs.writeFileSync(path.join(evidence,'uncertain-calibration.json'),JSON.stringify({definitionBefore:hash(original),definitionAfter:hash(definition()),mutantHash:hash(mutant),negative,restored},null,2));
  });
  await step('digest groups only an open window and rate limits defer a second effect durably',async()=>{
   await owner.repository.configure(policy('email',emailPolicyVersion++,{digestWindowMs:2000,intervalMs:3000}));await waitQuota();
   const inputs=[event(h,f),event(h,f),event(h,f)],rows=await Promise.all(inputs.map(input=>owner.repository.enqueue(input)));assert.equal(new Set(rows.map(x=>x.id)).size,1);const a=await processWorker(),before=receiver.requests.length;
   await eventually(async()=>{const result=await a.call('consume');assert.ok(result.ok,JSON.stringify(result));return owner.repository.get(rows[0].id);},x=>x.state==='accepted','digest-accepted');
   assert.equal(receiver.requests.length,before+1);assert.equal(receiver.requests.at(-1).body.message.count,3);assert.equal((await owner.repository.get(rows[0].id)).items.length,3);
   await owner.repository.configure(policy('email',emailPolicyVersion++));const next=await owner.repository.enqueue(event(h,f));assert.notEqual(next.id,rows[0].id);await a.call('consume');const deferred=await owner.repository.get(next.id);assert.equal(deferred.state,'retry');assert.equal(deferred.attempts,0);assert.equal(receiver.requests.length,before+1);
   await eventually(async()=>{await a.call('consume');return owner.repository.get(next.id);},x=>x.state==='accepted','quota-recovery');assert.equal(receiver.requests.length,before+2);assert.equal((await owner.repository.get(next.id)).attempts,1);await a.kill();
  });
  await step('recipient object mutation cannot redirect the authorized effect',async()=>{
   await owner.repository.configure(policy('email',emailPolicyVersion++));await waitQuota();const row=await owner.repository.enqueue(event(h,f)),a=await processWorker();await a.call('settings',{mutateRecipient:true});const result=await a.call('consume');assert.ok(result.ok,JSON.stringify(result));assert.equal((await owner.repository.get(row.id)).state,'accepted');const sent=receiver.requests.at(-1).body.recipient;assert.equal(sent.userId,h.A.id);assert.equal(sent.email,'SYN-member@example.test');await a.kill();
  });
  await step('preference revoked recipient and disabled configuration prevent fresh HTTP effects',async()=>{
   const a=await processWorker(),before=receiver.requests.length;
   await preferences(h,h.A,'email',false);const optedOut=await owner.repository.enqueue(event(h,f));await a.call('consume');assert.equal((await owner.repository.get(optedOut.id)).state,'suppressed');await preferences(h,h.A,'email');
   await preferences(h,viewer,'email');const revoked=await owner.repository.enqueue(event(h,f,{userId:viewer.id}));h.sql(`UPDATE memberships SET status='revoked' WHERE tenant_id=${q(h.A.tenant)} AND user_id=${q(viewer.id)}`);try{await a.call('consume');assert.equal((await owner.repository.get(revoked.id)).state,'suppressed');}finally{h.sql(`UPDATE memberships SET status='active' WHERE tenant_id=${q(h.A.tenant)} AND user_id=${q(viewer.id)}`);}
   const blocked=await owner.repository.enqueue(event(h,f));await a.call('settings',{configured:false});await a.call('consume');assert.equal((await owner.repository.get(blocked.id)).state,'blocked');assert.equal(receiver.requests.length,before);await a.kill();
  });
  await step('retry policy reaches durable dead letter without recursive notification or automatic resurrection',async()=>{
   await owner.repository.configure(policy('email',emailPolicyVersion++,{maxAttempts:1,lifetimeMs:2000}));await waitQuota();const row=await owner.repository.enqueue(event(h,f)),before=counts(),a=await processWorker(),seen=receiver.requests.length;
   receiver.responses.push({status:429,body:{kind:'retry',retryAfterMs:1000}});await a.call('consume');const dead=await owner.repository.get(row.id);assert.equal(dead.state,'dead');assert.equal(dead.attempts,1);assert.equal(receiver.requests.length,seen+1);assert.equal(h.sql(`SELECT count(*) FROM dead_letters WHERE tenant_id=${q(h.A.tenant)} AND job_id=${q(row.id)} AND reason='NOTIFICATION_DEAD'`),'1');await a.call('consume');assert.equal(receiver.requests.length,seen+1);assert.deepEqual(counts(),before);assert.ok((await owner.repository.health()).reasons.includes('NOTIFICATION_DEAD'));await a.kill();
  });
  await step('expired claim fence cannot begin or publish after another worker reclaims',async()=>{
   await owner.repository.configure(policy('email',emailPolicyVersion++));const row=await owner.repository.enqueue(event(h,f)),a=await processWorker(),b=await processWorker();const old=await a.call('claim');assert.ok(old.ok&&old.result);assert.equal(old.result.id,row.id);
   const reclaimed=await eventually(async()=>b.call('claim'),x=>x.ok&&x.result!==null,'expired-claim-reclaimed');assert.equal(reclaimed.result.id,row.id);assert.ok(BigInt(reclaimed.result.fence)>BigInt(old.result.fence));const seen=receiver.requests.length;
   const begin=await a.call('beginSend',old.result,true);assert.equal(begin.ok,false);assert.equal(begin.error.status,409);
   const publish=await a.call('commitChunk',old.result,{records:[{kind:'accepted',providerId:'SYN-stale-not-accepted'}],done:true});assert.equal(publish.ok,false);assert.equal(publish.error.status,409);assert.equal(receiver.requests.length,seen);assert.equal((await owner.repository.get(row.id)).state,'claimed');await b.call('fail',reclaimed.result);await a.kill();await b.kill();
  });
  await step('current source withdrawal prevents new in-app dispatch and hides the earlier accepted resource',async()=>{
   const row=await owner.repository.enqueue(event(h,f,{channel:'inapp'})),a=await processWorker(),seen=receiver.requests.length,connection=f.a.a.connection;
   h.sql(`UPDATE connections SET status='disconnected' WHERE id=${q(connection)}`);try{
    const response=await a.call('consume');assert.ok(response.ok,JSON.stringify(response));assert.equal((await owner.repository.get(row.id)).state,'suppressed');assert.equal(receiver.requests.length,seen);const inbox=await h.request(h.A,'/api/notifications?limit=100&status=all');assert.equal(inbox.status,200);assert.equal(inbox.data.data.items.filter(x=>x.resourceId===f.brief.id).length,0);assert.ok([403,404].includes((await h.request(h.A,'/api/briefs/'+f.brief.id)).status));
   }finally{h.sql(`UPDATE connections SET status='active' WHERE id=${q(connection)}`);await a.kill();}
  });
  await step('synthetic receiver recorded no malformed request or external provider credential',async()=>{assert.deepEqual(receiver.violations,[]);const attempts=fs.readFileSync(path.join(evidence,'outbound-attempts.jsonl'),'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);assert.ok(attempts.length>0);assert.equal(attempts.filter(x=>x.blocked).length,0,'NO_EXTERNAL_HTTP_ATTEMPT');h.verifySources();});
  // Additional state-machine cases are completed against the frozen repository interface.
 }finally{
  for(const value of workers)await value.kill();if(receiver){fs.writeFileSync(path.join(evidence,'synthetic-http-effects.json'),JSON.stringify({label:'SYN local acceptance only; no external provider or delivered claim',requests:receiver.requests},null,2));await receiver.close();}
  if(h)await h.close();console.log('F0609_EVIDENCE:'+evidence);
 }
});
