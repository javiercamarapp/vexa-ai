import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {randomUUID} from 'node:crypto';
import {setup,q,hash,delay} from './harness.mjs';
import {extensions} from './extensions.mjs';
import {expectedIds} from './inventory.mjs';
// Explicit coverage ledger; this exam is not approved/frozen for acceptance.
export const pending={'F02-05':['provider cron/net/Vault effective permissions; independent SQL007 global review'], 'F02-06':['full05 and standalone06 Node22/26 against fixed snapshot; independent review/freeze/verify/accept']};
export async function examine(candidate,evidence,selected=['F02-05','F02-06']){
 fs.mkdirSync(evidence,{recursive:true,mode:0o700});const results=[];let h;
 const run=async(id,fn)=>{if(process.env.F02_CASE_FILTER&&!new RegExp(process.env.F02_CASE_FILTER).test(id)){results.push({id,status:'not_run'});return;}try{await fn();results.push({id,status:'pass'});console.log('PASS',id);}catch(e){results.push({id,status:/browserType.launch/.test(e.message)?'blocked':'fail',error:e.message,stack:e.stack});console.log('FAIL',id,e.message);}};
 try{
 h=await setup(candidate,evidence);const a=await h.worker(),b=await h.worker();
 const call=async(w,op,...args)=>{const r=await w.call(op,...args);assert.equal(r.ok,true,op+': '+JSON.stringify(r.error));return r.value;};
 const status=(r,n,label)=>{assert.equal(r.status,n,label+': '+JSON.stringify(r.data));return r.data.data;};
 const fixture=(n=3,invalid=false)=>Buffer.from('id,text,date,role,conversation\n'+Array.from({length:n},(_,i)=>`syn-${i},SYNTHETIC-${i},${invalid&&i===101?'not-date':'2026-09-01T00:00:00Z'},customer,conversation-${i}`).join('\n')+'\n');
 const create=async({n=3,invalid=false,actor=h.A}={})=>{
  const w=actor===h.A?a:await h.worker(actor);await call(w,'heartbeat');
  const bytes=fixture(n,invalid),sha=hash(bytes);fs.writeFileSync(path.join(evidence,`fixture-${n}-${invalid}.sha256`),sha+'\n');
  const meta={connection_id:actor.connection,mapping_version:'csv-message-v1',content_type:'text/csv',size:bytes.length,sha256:sha};
  const v=status(await h.request(actor,'/api/imports',meta),201,'POST02_RESERVE');
  assert.equal(new URL(v.upload_url).origin,'http://127.0.0.1:58163','LOCAL_SIGNED_UPLOAD');
  const put=await fetch(v.upload_url,{method:'PUT',headers:{'content-type':'text/csv'},body:bytes});assert.equal(put.status,200,'STORAGE_SIGNED_PUT');await put.arrayBuffer();
  const mapping={columns:{id:'id',text:'text',date:'date',role:'role',conversation:'conversation'},timezone:'UTC',dateFormat:'iso'};
  const m=status(await h.request(actor,`/api/imports/${v.import_id}/mapping`,{mapping,expected_version:'csv-message-v1'}),200,'SAVE_MAPPING');
  const body={upload_token:m.upload_token,sha256:sha,mapping_version:m.mapping_version};
  const confirmed=status(await h.request(actor,`/api/imports/${v.import_id}/confirm`,body),202,'POST02_CONFIRM');assert.equal(confirmed.state,'queued','202_NOT_SUCCESS');
  const job=h.json(`SELECT row_to_json(j) FROM jobs j WHERE import_id=${q(v.import_id)}`);assert.ok(job?.id,'PERSISTED_JOB');
  return {id:job.id,importId:v.import_id,n,bytes,confirmed};
 };
 const observed=id=>h.json(`SELECT json_build_object('job',(SELECT row_to_json(j) FROM jobs j WHERE id=${q(id)}),'cp',(SELECT checkpoint FROM checkpoints WHERE job_id=${q(id)}),'rows',(SELECT coalesce(json_agg(json_build_object('id',r.id,'ref',r.row_ref,'state',r.state,'code',r.error_code,'field',r.provenance->'result'->>'field') ORDER BY r.row_ref),'[]') FROM import_rows r JOIN jobs j ON j.import_id=r.import_id WHERE j.id=${q(id)}),'import',(SELECT row_to_json(i) FROM imports i JOIN jobs j ON j.import_id=i.id WHERE j.id=${q(id)}))`);
 const cancel=async id=>status(await h.request(h.A,`/api/jobs/${id}/cancel`,{}),200,'CLEAN_CANCEL_API');
 await run('007 selected A dual owner cannot insert delegation B',async()=>{
  h.sql(`INSERT INTO memberships(tenant_id,user_id,role,status) VALUES(${q(h.B.tenant)},${q(h.A.id)},'owner','active')`);
  const statement=`SET LOCAL ROLE vexa_backend; PERFORM set_config('request.jwt.claim.sub',${q(h.A.id)},true); PERFORM set_config('vexa.tenant_id',${q(h.A.tenant)},true); PERFORM set_config('vexa.action','configure',true); INSERT INTO worker_delegations(tenant_id,user_id,enabled) VALUES(${q(h.B.tenant)},${q(h.A.id)},true); GET DIAGNOSTICS affected=ROW_COUNT; RESET ROLE; result=jsonb_build_object('affected',affected);`;
  const result=h.probe(statement);h.sql(`DELETE FROM memberships WHERE tenant_id=${q(h.B.tenant)} AND user_id=${q(h.A.id)}`);fs.writeFileSync(path.join(evidence,'007-insert.json'),JSON.stringify({statement,result},null,2));
  if(result.code==='00000')fs.writeFileSync(path.join(evidence,'P1-007.md'),'P1: selected tenant A, real dual-owner identity, configure action can INSERT enabled worker delegation in B through vexa_backend. SQL transaction rolled back. Reproduction and SQLSTATE in 007-insert.json. No product edits.');
  assert.equal(result.code,'42501','SELECTED_A_MUST_DENY_DELEGATION_INSERT_B');
 });
 await run('06 admission rejects consumer absent then recovers',async()=>{
  const r=await h.request(h.A,'/api/jobs/health');assert.equal(r.status,503);assert.ok(r.data.data.reasons.includes('NO_HEARTBEAT'));
  const bytes=fixture();const metadata={connection_id:h.A.connection,mapping_version:'csv-message-v1',content_type:'text/csv',size:bytes.length,sha256:hash(bytes)};
  assert.equal((await h.request(h.A,'/api/imports',metadata)).status,503,'ADMISSION_503');await call(a,'heartbeat');assert.equal((await h.request(h.A,'/api/jobs/health')).status,200,'HEALTH_RECOVERY');
 });
 await run('05 real two-process claims and stale fencing',async()=>{
  const j=await create();try{
   const claims=await Promise.all([call(a,'claim'),call(b,'claim')]);assert.equal(claims.filter(Boolean).length,1,'SKIP_LOCKED_SINGLE_WINNER');
   const old=claims.find(Boolean);h.sql(`UPDATE jobs SET lease_until=clock_timestamp()-interval '1 second' WHERE id=${q(j.id)}`);
   const fresh=await call(b,'claim');assert.equal(fresh.id,j.id);assert.ok(Number(fresh.fencing_token)>Number(old.fencing_token));
   const prior=observed(j.id);const rejected=await a.call('commitChunk',old,{records:[],checkpoint:{offset:0,scope:'external-fence'},done:true});
   assert.equal(rejected.ok,false,'STALE_FENCE_REJECTED');assert.equal(rejected.error.code,'STALE_FENCE');assert.deepEqual(observed(j.id),prior,'STALE_FENCE_NO_EFFECT');
  }finally{await cancel(j.id);}
 });
 await run('05 atomic checkpoint rollback with server fault canary',async()=>{
  const j=await create();try{
   h.sql(`CREATE SEQUENCE f020506_canary; GRANT USAGE,SELECT ON SEQUENCE f020506_canary TO vexa_backend; CREATE FUNCTION f020506_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM nextval('f020506_canary'); RAISE EXCEPTION 'EXTERNAL CHECKPOINT FAULT' USING ERRCODE='P0001'; END $$; CREATE TRIGGER f020506_fault BEFORE INSERT OR UPDATE ON checkpoints FOR EACH ROW EXECUTE FUNCTION f020506_fault();`);
   try{await call(a,'consume');}finally{h.sql('DROP TRIGGER f020506_fault ON checkpoints; DROP FUNCTION f020506_fault();');}
   assert.equal(h.sql('SELECT is_called FROM f020506_canary'),'t','SERVER_CHECKPOINT_FAULT_REACHED');h.sql('DROP SEQUENCE f020506_canary');
   const s=observed(j.id);assert.equal(s.cp,null,'CHECKPOINT_ROLLBACK');assert.equal(s.rows.length,0,'EFFECTS_ROLLBACK');assert.equal(Number(s.import.accepted),0,'COUNTERS_ROLLBACK');
   await delay(1100);await call(a,'consume');assert.equal(observed(j.id).job.state,'succeeded','RECOVERY_AFTER_ATOMIC_FAULT');
  }finally{await cancel(j.id);}
 });
 await run('06 live heartbeat does not hide stalled progress',async()=>{
  const j=await create();try{await call(a,'claim');h.sql(`UPDATE jobs SET last_progress_at=clock_timestamp()-interval '121 seconds',lease_until=clock_timestamp()+interval '60 seconds' WHERE id=${q(j.id)}`);await call(a,'heartbeat');
   const health=await h.request(h.A,'/api/jobs/health');assert.equal(health.status,503,'HEALTH_NO_PROGRESS_STATUS');assert.ok(health.data.data.reasons.includes('NO_PROGRESS'),'HEALTH_NO_PROGRESS');assert.ok(!health.data.data.reasons.includes('NO_HEARTBEAT'),'LIVE_HEARTBEAT_POSITIVE');
  }finally{await cancel(j.id);}
 });
 await run('05 429 Retry-After and 401 no retry via real Storage HTTP',async()=>{
  for(const code of [429,401]){const j=await create();try{
   const canary=h.canary;h.fault={status:code,retryAfter:3};const before=Date.now();const consumed=await a.call('consume');if(code===401){assert.equal(consumed.ok,false);assert.equal(consumed.error.status,401);}else assert.equal(consumed.ok,true);h.fault=null;assert.equal(h.canary,canary+1,'HTTP_FAULT_REACHED_ONCE');
   const s=observed(j.id);assert.equal(s.job.failure_count,1,'FAILURE_NOT_CHUNK_COUNT');
   if(code===429){assert.equal(s.job.state,'queued');assert.ok(Date.parse(s.job.next_attempt_at)>=before+3000,'RETRY_AFTER_3S');assert.equal(await call(b,'claim'),null,'NO_EARLY_RETRY');}
   else{assert.equal(s.job.state,'failed','401_TERMINAL');assert.equal(await call(b,'claim'),null,'401_NO_RETRY');}
  }finally{h.fault=null;await cancel(j.id);}}
 });
 await run('06 Chromium queued polling cancel reload tenant Origin',async()=>{
  const j=await create();let context;try{const browser=await h.browser();context=await browser.newContext();
   const cookies=h.cookie(h.A).split('; ').map(v=>{const index=v.indexOf('=');return {name:v.slice(0,index),value:v.slice(index+1),url:h.base};});await context.addCookies(cookies);const page=await context.newPage();
   await page.goto(h.base+'/jobs/'+j.id);await page.getByRole('status').filter({hasText:'queued'}).waitFor();
   assert.equal((await h.request(h.B,'/api/jobs/'+j.id)).status,404,'TENANT_B_404');assert.equal((await h.request({...h.A,tenant:h.B.tenant},'/api/jobs/'+j.id)).status,403,'CURRENT_SCOPE');
   assert.equal((await h.request(h.A,'/api/jobs/'+j.id+'/cancel',{}, {origin:'https://foreign.invalid'})).status,403,'CANCEL_ORIGIN');
   await page.getByRole('button',{name:'Cancelar ingestión'}).click();await page.getByRole('status').filter({hasText:'cancelled'}).waitFor();await page.reload();await page.getByRole('status').filter({hasText:'cancelled'}).waitFor();assert.equal(observed(j.id).job.state,'cancelled');
  }finally{if(context)await context.close();await cancel(j.id);}
 });
 await run('06 browser worker enable revoke replay and six durable states',async()=>{
  const browser=await h.browser(),context=await browser.newContext();context.setDefaultTimeout(15000);
  await context.addCookies(h.cookie(h.A).split('; ').map(v=>{const i=v.indexOf('=');return {name:v.slice(0,i),value:v.slice(i+1),url:h.base};}));const page=await context.newPage();
  const bodies=[];page.on('response',async r=>{if(r.url().startsWith(h.base)&&!r.url().includes('/_next/'))try{bodies.push(await r.text());}catch{}});
  try{
   await page.goto(h.base+'/jobs/setup');await page.getByLabel('ID de la cuenta de servicio').fill(h.bot.id);
   await page.getByRole('button',{name:'Revocar worker'}).click();await page.getByRole('status').filter({hasText:'deshabilitado'}).waitFor();assert.equal((await a.call('claim')).error.code,'WORKER_DISABLED');
   await page.getByRole('button',{name:'Habilitar worker'}).click();await page.getByRole('status').filter({hasText:'habilitado para'}).waitFor();
   for(const terminal of ['succeeded','partial','failed']){
    const j=await create({n:terminal==='partial'?103:3,invalid:terminal==='partial'});
    try{await page.goto(h.base+'/jobs/'+j.id);await page.getByRole('status').filter({hasText:'queued'}).waitFor();
     const w=await h.worker();try{
      if(terminal==='failed'){h.fault={status:401};await w.call('consume');h.fault=null;}
      else{const barrier=await w.barrier(true);assert.equal(barrier.barrier,true);await page.getByRole('status').filter({hasText:'running'}).waitFor();await w.kill();h.sql(`UPDATE jobs SET lease_until=clock_timestamp()-interval '1 second' WHERE id=${q(j.id)}`);await call(b,'consume');}
     }finally{h.fault=null;await w.kill();}
     await page.getByRole('status').filter({hasText:terminal}).waitFor();await page.reload();await page.getByRole('status').filter({hasText:terminal}).waitFor();
     const data=status(await h.request(h.A,'/api/jobs/'+j.id),200,'JOB_RESPONSE');assert.equal(data.analysis_complete,false);assert.equal(data.money,null);assert.equal(data.stage,'ingestion');
     if(terminal==='failed'){await page.getByRole('button',{name:'Reintentar ingestión (owner)'}).click();await page.getByRole('status').filter({hasText:'queued'}).waitFor();await page.getByRole('button',{name:'Cancelar ingestión'}).click();await page.getByRole('status').filter({hasText:'cancelled'}).waitFor();}
    }finally{await cancel(j.id);}
   }
   assert.ok(!bodies.join('').includes(h.A.token),'SSR_NO_AUTH_JWT');assert.ok(!bodies.join('').includes('SYNTHETIC-0'),'M10_NO_RAW_TEXT');
  }finally{h.fault=null;await context.close();await h.request(h.A,'/api/jobs/worker',{user_id:h.bot.id,enabled:true});}
 });
 await run('05 SIGKILL postcommit before ACK real process replay',async()=>{
  const j=await create({n:10000});const crash=await h.worker();try{
   const barrier=await crash.barrier(true);assert.equal(barrier.barrier,true,'AFTER_COMMIT_BARRIER');const before=observed(j.id);assert.equal(before.cp.offset,10000);assert.equal(before.rows.length,10000);assert.equal(before.job.state,'running');await crash.kill();
   h.sql(`UPDATE jobs SET lease_until=clock_timestamp()-interval '1 second' WHERE id=${q(j.id)}`);await call(b,'consume');const after=observed(j.id);assert.equal(after.job.state,'succeeded');assert.equal(after.cp.offset,10000);assert.equal(after.rows.length,10000);assert.deepEqual(after.rows,before.rows,'PRIOR_LEDGER_IDENTICAL');assert.equal(new Set(after.rows.map(r=>r.id)).size,10000);assert.deepEqual(after.rows.map(r=>Number(r.ref)).sort((a,b)=>a-b),Array.from({length:10000},(_,i)=>i+2),'FULL_ROW_REF_SET');assert.equal(Number(after.import.accepted)+Number(after.import.rejected)+Number(after.import.duplicates)+Number(after.import.pending),10000,'COUNTER_CONSERVATION');assert.equal(after.job.failure_count,0,'CHUNKS_ARE_NOT_FAILURES');
  }finally{await crash.kill();await cancel(j.id);}
 });
 await run('05 error after first100 has precise normalization code',async()=>{
  const j=await create({n:103,invalid:true});try{await call(a,'consume');const s=observed(j.id);assert.equal(s.rows.length,103,'NO_PREVIEW_TRUNCATION');const row=s.rows.find(r=>r.ref==='103');assert.equal(row.code,'INVALID_DATE','NORMALIZATION_CODE_NOT_SCOPE_CATCHALL');assert.equal(row.field,'date','NORMALIZATION_FIELD');assert.equal(s.job.state,'partial');const csv=await fetch(h.base+'/api/jobs/'+j.id+'/errors',{headers:{cookie:h.cookie(h.A)}});assert.equal(csv.status,200);const bytes=await csv.text();assert.match(bytes,/103.*date.*INVALID_DATE/);assert.ok(!bytes.includes('SYNTHETIC-'));}finally{await cancel(j.id);}
 });
 await run('05 four real failures count attempts not chunks',async()=>{
  const j=await create();try{h.fault={status:500};const before=h.canary;
   for(let i=1;i<=4;i++){await call(a,'consume');const s=observed(j.id);assert.equal(s.job.failure_count,i,'FOUR_FAILURE_LEDGER');assert.equal(s.job.state,i===4?'failed':'queued','FOUR_FAILURE_TERMINAL');if(i<4){assert.equal(await call(b,'claim'),null,'BACKOFF_BLOCKS_CLAIM');const wait=Date.parse(s.job.next_attempt_at)-Date.now();assert.ok(wait>0&&wait<=1000*2**(i-1),'BACKOFF_1_2_4');await delay(wait+50);}}
   assert.equal(h.canary,before+4,'FOUR_REAL_HTTP_FAILURES');assert.equal(await call(b,'claim'),null,'NO_FIFTH_ATTEMPT');
  }finally{h.fault=null;await cancel(j.id);}
 });
 await run('05 deadline cancellation revocation stop old worker',async()=>{
  for(const mode of ['deadline','cancel','revoked']){const j=await create();try{
   const claim=await call(a,'claim');assert.equal(claim.id,j.id);
   if(mode==='deadline')h.sql(`UPDATE jobs SET deadline=clock_timestamp()-interval '1 second' WHERE id=${q(j.id)}`);
   if(mode==='cancel')await cancel(j.id);
   if(mode==='revoked')h.sql(`UPDATE memberships SET status='revoked',permissions_version=permissions_version+1 WHERE tenant_id=${q(h.A.tenant)} AND user_id=${q(h.A.id)}`);
   const before=observed(j.id),r=await a.call('commitChunk',claim,{records:[],checkpoint:{offset:0,scope:'denied'},done:true});assert.equal(r.ok,false,'DENIED_PUBLICATION');if(mode!=='revoked')assert.equal(r.error.code,mode==='deadline'?'DEADLINE':'STALE_FENCE');else assert.equal(r.error.code,'ACTOR_REVOKED');assert.deepEqual(observed(j.id),before,'DENIED_NO_EFFECTS');
  }finally{if(mode==='revoked')h.sql(`UPDATE memberships SET status='active',permissions_version=permissions_version+1 WHERE tenant_id=${q(h.A.tenant)} AND user_id=${q(h.A.id)}`);await cancel(j.id);}}
 });
 await run('06 HTTP isolation roles queue and lease alarms',async()=>{
  const j=await create();try{
   assert.equal((await h.request(h.B,'/api/jobs/'+j.id)).status,404,'TENANT_404');assert.equal((await h.request({...h.A,tenant:h.B.tenant},'/api/jobs/'+j.id)).status,403,'CURRENT_SCOPE');
   assert.equal((await h.request(h.A,'/api/jobs/'+j.id+'/cancel',{}, {origin:'https://foreign.invalid'})).status,403,'ORIGIN');
   for(const role of ['operator','viewer']){h.sql(`UPDATE memberships SET role=${q(role)},permissions_version=permissions_version+1 WHERE tenant_id=${q(h.A.tenant)} AND user_id=${q(h.A.id)}`);assert.equal((await h.request(h.A,'/api/jobs/'+j.id+'/cancel',{})).status,403,'ROLE_CANCEL_DENIED');}
   h.sql(`UPDATE memberships SET role='owner',permissions_version=permissions_version+1 WHERE tenant_id=${q(h.A.tenant)} AND user_id=${q(h.A.id)}; UPDATE jobs SET created_at=clock_timestamp()-interval '121 seconds' WHERE id=${q(j.id)}`);
   assert.ok((await h.request(h.A,'/api/jobs/health')).data.data.reasons.includes('OLDEST_QUEUE'),'QUEUE_120');await call(a,'claim');h.sql(`UPDATE jobs SET lease_until=clock_timestamp()-interval '1 second' WHERE id=${q(j.id)}`);assert.ok((await h.request(h.A,'/api/jobs/health')).data.data.reasons.includes('EXPIRED_LEASE'),'EXPIRED_LEASE');
   const other=await h.worker(h.B);await call(other,'heartbeat');assert.equal((await h.request(h.B,'/api/jobs/health')).status,200,'TENANT_HEALTH_ISOLATION');await other.kill();
  }finally{h.sql(`UPDATE memberships SET role='owner',permissions_version=permissions_version+1 WHERE tenant_id=${q(h.A.tenant)} AND user_id=${q(h.A.id)}`);await cancel(j.id);}
 });
 await run('05 owner history CAS roles and manual replay conservation',async()=>{
  const j=await create();try{
   await call(a,'consume');const list=status(await h.request(h.A,`/api/jobs/${j.id}/canonicals`),200,'HEAD_LIST');assert.ok(list.length>0);
   const route=`/api/jobs/${j.id}/canonicals/${list[0].id}`,history=status(await h.request(h.A,route),200,'HISTORY');
   assert.ok(!JSON.stringify(history).includes('SYNTHETIC-'),'HISTORY_NO_RAW');
   const select={revisionId:history.revisions[0].id,expectedVersion:history.head.version,reason:'SYNTHETIC external selection'};
   assert.equal((await h.request(h.A,route,select)).status,200);assert.equal((await h.request(h.A,route,select)).status,409,'CAS_CONFLICT');assert.equal((await h.request(h.B,route)).status,404);
   for(const role of ['analyst','operator','viewer']){h.sql(`UPDATE memberships SET role=${q(role)} WHERE tenant_id=${q(h.A.tenant)} AND user_id=${q(h.A.id)}`);assert.equal((await h.request(h.A,route)).status,403,'HISTORY_OWNER_ONLY');}
  }finally{h.sql(`UPDATE memberships SET role='owner' WHERE tenant_id=${q(h.A.tenant)} AND user_id=${q(h.A.id)}`);await cancel(j.id);}
  const retry=await create();try{await cancel(retry.id);const before=observed(retry.id);status(await h.request(h.A,`/api/jobs/${retry.id}/replay`,{}),200,'REPLAY');await call(a,'consume');const after=observed(retry.id);assert.equal(after.job.import_id,before.job.import_id);assert.equal(after.rows.length,3);assert.equal(Number(after.import.total),3);assert.equal(after.job.state,'succeeded');assert.ok(Number(after.job.fencing_token)>Number(before.job.fencing_token));}finally{await cancel(retry.id);}
 });
 await run('06 missing SQL configuration is 503',async()=>{await h.stopWeb();await h.startWeb(true);assert.equal((await h.request(h.A,'/api/jobs/health')).status,503,'MISSING_CONFIGURATION_503');await h.stopWeb();await h.startWeb();});
 for(const mutation of ['fence','atomic','health'])await run('MUTATION '+mutation+' 0→1→0',async()=>{
  const file=path.join(h.built,'packages/jobs/durable/repository.mjs'),original=fs.readFileSync(file,'utf8');
  const anchors={fence:["String(j.fencing_token)!==String(claim.fencing_token)",'false'],atomic:['else await persistCanonical(s,{importId:j.import_id,record});','else await tx(rowScope=>persistCanonical(rowScope,{importId:j.import_id,record}));'],health:["if(Number(r.progress_age)>queueMs)reasons.push('NO_PROGRESS');",'/* injected missing progress alarm */']};
  const [anchor,replacement]=anchors[mutation];assert.equal(original.split(anchor).length,2,'MUTANT_ANCHOR');const phases=[];
  try{for(const phase of ['positive','mutant','restored']){
   fs.writeFileSync(file,phase==='mutant'?original.replace(anchor,replacement):original);
   const w=await h.worker(h.A,mutation==='health'?h.A:h.bot),j=await create();let error;
   try{
    if(mutation==='fence'){
     const old=await call(w,'claim');assert.equal(old.id,j.id,'MUTANT_SETUP_CLAIM');h.sql(`UPDATE jobs SET lease_until=clock_timestamp()-interval '1 second' WHERE id=${q(j.id)}`);const fresh=await call(b,'claim');assert.equal(fresh.id,j.id,'MUTANT_SETUP_RECLAIM');
     const r=await w.call('commitChunk',old,{records:[],checkpoint:{offset:0,scope:'mutant-fence'},done:true});assert.equal(r.ok,false,'MUTANT_TARGET_STALE_FENCE');assert.equal(r.error.code,'STALE_FENCE');
    }else if(mutation==='health'){
     const claimed=await call(b,'claim');assert.equal(claimed.id,j.id);h.sql(`UPDATE jobs SET last_progress_at=clock_timestamp()-interval '121 seconds' WHERE id=${q(j.id)}`);await call(b,'heartbeat');const health=await call(w,'health');assert.ok(health.reasons.includes('NO_PROGRESS'),'MUTANT_TARGET_NO_PROGRESS');
    }else{
     h.sql(`CREATE SEQUENCE f020506_mutant_canary; GRANT USAGE,SELECT ON SEQUENCE f020506_mutant_canary TO vexa_backend; CREATE FUNCTION f020506_mutant_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM nextval('f020506_mutant_canary'); RAISE EXCEPTION 'EXTERNAL ATOMIC FAULT'; END $$; CREATE TRIGGER f020506_mutant_fault BEFORE INSERT OR UPDATE ON checkpoints FOR EACH ROW EXECUTE FUNCTION f020506_mutant_fault();`);
     try{await call(w,'consume');}finally{h.sql('DROP TRIGGER f020506_mutant_fault ON checkpoints; DROP FUNCTION f020506_mutant_fault();');}
     assert.equal(h.sql('SELECT is_called FROM f020506_mutant_canary'),'t','MUTANT_SERVER_CANARY');h.sql('DROP SEQUENCE f020506_mutant_canary');assert.equal(observed(j.id).rows.length,0,'MUTANT_TARGET_ATOMIC_EFFECTS');
    }
   }catch(e){error=e;}finally{await w.kill();await cancel(j.id);}
   phases.push({phase,exit_code:error?1:0,error:error?.message??null});
   if(phase==='mutant'){assert.ok(error,'MUTANT_SURVIVED');assert.equal(error.code,'ERR_ASSERTION','NOT_A_TARGET_ASSERTION');assert.match(error.message,/MUTANT_TARGET_/,'NOT_A_TARGET_ASSERTION');}else if(error)throw error;
  }}finally{fs.writeFileSync(file,original);fs.writeFileSync(path.join(evidence,'mutation-'+mutation+'.json'),JSON.stringify(phases,null,2));}
 });
 await extensions({h,a,b,run,call,create,observed,cancel,evidence});
 h.verifySources();
 }catch(e){results.push({id:'setup',status:'blocked',error:e.message,stack:e.stack});console.log('BLOCKED',e.message);}
 finally{if(h)await h.close();}
 const result={schema:1,expectedIds,status:results.length===expectedIds.length&&expectedIds.every(id=>results.filter(r=>r.id===id&&r.status==='pass').length===1)?'PASS':'FAIL',selected,results,pending,accepted:false,connectionReady:false};fs.writeFileSync(path.join(evidence,'result.json'),JSON.stringify(result,null,2));return result;
}
