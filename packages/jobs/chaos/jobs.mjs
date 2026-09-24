// Scenario contracts reused from F02-durable-final/exam.mjs and extensions.mjs.
import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {performance} from 'node:perf_hooks';
import {call,createImport,observed,digest} from './fixtures.mjs';import {q} from './harness.mjs';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const equalRows=(a,b)=>assert.deepEqual(a.rows,b.rows,'COMMITTED_LEDGER_MUST_NOT_CHANGE');
export async function jobs({h,run,seed,round,notes}){
 let a=await h.worker(),b=await h.worker();notes.processes.push(a.c.pid,b.c.pid);
 const cancel=async id=>{const result=await h.request(h.A,`/api/jobs/${id}/cancel`,{});assert.equal(result.status,200);};
 try{
  await run('crash_postcommit',async record=>{
   const actor={...h.A,connection:randomUUID()};h.sql(`INSERT INTO connections(id,tenant_id,source,account_id) VALUES(${q(actor.connection)},${q(actor.tenant)},'csv',${q('SYN-crash359-'+round)})`);const job=await createImport(h,a,{seed,n:350,actor}),crash=await h.worker();notes.processes.push(crash.c.pid);record.fixtureHash=job.fixtureHash;record.jobId=job.id;
   try{assert.equal((await crash.barrier(false)).barrier,true);const before=observed(h,job.id);assert.equal(before.cursor.offset,100);assert.equal(before.rows.length,100);assert.equal(before.job.state,'running');record.deadline=before.job.deadline;record.committedHash=digest(JSON.stringify(before.rows));
    const began=performance.now();await crash.kill();assert.equal(crash.c.signalCode,'SIGKILL');h.sql(`UPDATE jobs SET lease_until='2000-01-01T00:00:00Z' WHERE id=${q(job.id)}`);await call(b,'consume');const after=observed(h,job.id);record.recoveryMs=performance.now()-began;
    const complete=value=>{assert.equal(value.job.state,'succeeded');assert.equal(value.cursor.offset,350,'CURSOR_REMAINDER');assert.equal(value.rows.length,350,'TAIL_REQUIRED');assert.equal(new Set(value.rows.map(r=>r.ref)).size,350,'UNIQUE_REFERENCES');assert.ok(value.rows.every(r=>r.state==='accepted'));const prior=new Map(before.rows.map(r=>[r.ref,r]));for(const row of value.rows)if(prior.has(row.ref))assert.deepEqual(row,prior.get(row.ref),'PREFIX_UNCHANGED');};complete(after);
    for(const mutant of [{...after,rows:after.rows.slice(0,200)},{...after,cursor:{...after.cursor,offset:100}},{...after,rows:[after.rows[0],...after.rows.slice(0,-1)]}])assert.throws(()=>complete(mutant),{code:'ERR_ASSERTION'});
    assert.equal(h.sql(`SELECT count(*) FROM source_heads WHERE connection_id=${q(actor.connection)} AND entity_type='message'`),'350');record.observed={state:after.job.state,cursor:350,committedBeforeCrash:100,resumedTail:250,uniqueRows:350,priorLedgerIdentical:true,oracleCorruptionsDetected:3};
   }finally{await crash.kill();await cancel(job.id);}
  });
  await run('expired_lease',async record=>{
   const job=await createImport(h,a,{seed});record.jobId=job.id;record.fixtureHash=job.fixtureHash;
   try{const claims=await Promise.all([call(a,'claim'),call(b,'claim')]);assert.equal(claims.filter(Boolean).length,1);const old=claims.find(Boolean);record.deadline=old.deadline;h.sql(`UPDATE jobs SET lease_until='2000-01-01T00:00:00Z' WHERE id=${q(job.id)}`);const newer=await call(b,'claim');assert.ok(Number(newer.fencing_token)>Number(old.fencing_token));const before=observed(h,job.id),denied=await a.call('commitChunk',old,{records:[],checkpoint:{offset:0,scope:'SYN-chaos'},done:true});assert.equal(denied.ok,false);assert.equal(denied.error.code,'STALE_FENCE');assert.deepEqual(observed(h,job.id),before);record.errors.push(denied.error.code);h.sql(`UPDATE jobs SET lease_until='2000-01-01T00:00:00Z' WHERE id=${q(job.id)}`);const began=performance.now();await call(b,'consume');record.recoveryMs=performance.now()-began;assert.equal(observed(h,job.id).job.state,'succeeded');record.observed={winners:1,staleFenceRejected:true,rows:observed(h,job.id).rows.length};
   }finally{await cancel(job.id);}
  });
  await run('storage_429',async record=>{
   const job=await createImport(h,a,{seed});record.jobId=job.id;
   try{const before=Date.now(),canary=h.canary;h.fault={status:429,retryAfter:1};await call(a,'consume');h.fault=null;const failed=observed(h,job.id);assert.equal(h.canary,canary+1);assert.equal(failed.job.state,'queued');assert.ok(Date.parse(failed.job.next_attempt_at)>=before+1000);assert.equal(await call(b,'claim'),null);record.errors.push('HTTP_429');record.deadline=failed.job.deadline;record.retryAt=failed.job.next_attempt_at;record.attemptsBeforeRecovery=failed.job.failure_count;await sleep(Math.max(0,Date.parse(failed.job.next_attempt_at)-Date.now())+25);const began=performance.now();await call(b,'consume');record.recoveryMs=performance.now()-began;assert.equal(observed(h,job.id).job.state,'succeeded');record.observed={noEarlyRetry:true,rows:observed(h,job.id).rows.length};
   }finally{h.fault=null;await cancel(job.id);}
  });
  await run('storage_401_deadletter_replay',async record=>{
   const job=await createImport(h,a,{seed});record.jobId=job.id;
   try{h.fault={status:401};const outcome=await a.call('consume');h.fault=null;assert.equal(outcome.ok,false);assert.equal(outcome.error.status,401);const denied=observed(h,job.id);assert.equal(denied.job.state,'failed');assert.equal(denied.deadLetters,1);assert.equal(denied.rows.length,0);assert.equal(await call(b,'claim'),null);record.errors.push('HTTP_401');record.deadline=denied.job.deadline;
    const began=performance.now();assert.equal((await h.request(h.A,`/api/jobs/${job.id}/replay`,{})).status,200);await call(b,'consume');record.recoveryMs=performance.now()-began;const recovered=observed(h,job.id);assert.equal(recovered.job.state,'succeeded');assert.equal(recovered.deadLetters,1);assert.equal(recovered.rows.length,200);record.observed={automaticRetry:false,manualReplay:true,deadLettersPreserved:1,cursor:recovered.cursor.offset};
   }finally{h.fault=null;await cancel(job.id);}
  });
  await run('revocation_during_work',async record=>{
   const job=await createImport(h,a,{seed});record.jobId=job.id;
   try{const claim=await call(a,'claim');record.deadline=claim.deadline;h.sql(`UPDATE memberships SET status='revoked',permissions_version=permissions_version+1 WHERE tenant_id=${q(h.A.tenant)} AND user_id=${q(h.A.id)}`);const before=observed(h,job.id),denied=await a.call('commitChunk',claim,{records:[],checkpoint:{offset:0,scope:'SYN-revoked'},done:true});assert.equal(denied.ok,false);assert.equal(denied.error.code,'ACTOR_REVOKED');assert.deepEqual(observed(h,job.id),before);await call(a,'fail',claim,{code:'ACTOR_REVOKED',status:403});assert.equal(observed(h,job.id).deadLetters,1);record.errors.push(denied.error.code);record.observed={publishedRows:0,deadLetters:1,oldCursorPreserved:true};
   }finally{h.sql(`UPDATE memberships SET status='active',permissions_version=permissions_version+1 WHERE tenant_id=${q(h.A.tenant)} AND user_id=${q(h.A.id)}`);await cancel(job.id);}
  });
  await run('deadline',async record=>{
   const job=await createImport(h,a,{seed});record.jobId=job.id;
   try{const claim=await call(a,'claim');h.sql(`UPDATE jobs SET deadline='2000-01-01T00:00:00Z' WHERE id=${q(job.id)}`);record.deadline='2000-01-01T00:00:00Z';const before=observed(h,job.id),denied=await a.call('commitChunk',claim,{records:[],checkpoint:{offset:0,scope:'SYN-deadline'},done:true});assert.equal(denied.ok,false);assert.equal(denied.error.code,'DEADLINE');assert.deepEqual(observed(h,job.id),before);record.errors.push('DEADLINE');record.observed={publishedRows:0,cursor:before.cursor};}finally{await cancel(job.id);}
  });
  await run('explicit_cancel',async record=>{const job=await createImport(h,a,{seed});record.jobId=job.id;const claim=await call(a,'claim');record.deadline=claim.deadline;await cancel(job.id);const before=observed(h,job.id);assert.equal(before.job.state,'cancelled');const denied=await a.call('commitChunk',claim,{records:[],checkpoint:{offset:0,scope:'SYN-cancelled'},done:true});assert.equal(denied.ok,false);assert.equal(denied.error.code,'STALE_FENCE');assert.deepEqual(observed(h,job.id),before);record.errors.push('STALE_FENCE');record.observed={state:'cancelled',publishedRows:0,oldCursorPreserved:true};});
  await run('database_outage',async record=>{
   const job=await createImport(h,a,{seed});record.jobId=job.id;const claim=await call(a,'claim');record.deadline=claim.deadline;const before=observed(h,job.id);await a.kill();await b.kill();let stopped=false;
   try{
    const began=performance.now();await h.databaseFault('stop');stopped=true;
    try{const result=await h.request(h.A,'/api/jobs/'+job.id);assert.equal(result.status,503,'DATABASE_DOWN_NOT_EMPTY_OR_SUCCESS');record.errors.push('HTTP_503');}catch(error){if(error.code==='ERR_ASSERTION')throw error;record.errors.push('LOCAL_REQUEST_UNAVAILABLE');}
    await h.databaseFault('start');stopped=false;
    for(let n=0;n<100;n++){try{h.sql('SELECT 1');break;}catch{assert.ok(n<99,'DATABASE_RECOVERY_TIMEOUT');await sleep(100);}}
    // Explicit operational recovery: restart the local web/worker process, not a self-healing claim.
    await h.stopWeb();await h.startWeb();a=await h.worker();b=await h.worker();notes.processes.push(a.c.pid,b.c.pid);
    const persisted=observed(h,job.id);equalRows(before,persisted);assert.deepEqual(persisted.cursor,before.cursor);h.sql(`UPDATE jobs SET lease_until='2000-01-01T00:00:00Z' WHERE id=${q(job.id)}`);await call(b,'consume');record.recoveryMs=performance.now()-began;const recovered=observed(h,job.id);assert.equal(recovered.job.state,'succeeded');assert.equal(recovered.rows.length,200);record.observed={cursor:recovered.cursor.offset,rows:recovered.rows.length,recoveryActor:'local runner restarts process after DB restoration'};
   }finally{if(stopped)await h.databaseFault('start');await cancel(job.id);}
  });
 }finally{await a.kill();await b.kill();}
}
