import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {q,delay} from './harness.mjs';
export const extensionIds=[
 '05 dispatcher multitenant coldstarts bootstrap',
 '05 real Auth refresh rotation',
 '05 revoked actor terminal audit and replay',
 '05 same rows distinct imports and idempotency keys',
 '05 SQL fault row103 preserves first100 and retries',
 '06 configurable queue120 heartbeat60 thresholds',
 '06 Next machine authorization body scope matrix',
 '06 CSV exact bytes antiinjection download retries',
 '06 browser history selection CAS conflict recovery',
];
export async function extensions({h,a,b,run,call,create,observed,cancel,evidence}){
 const browserPage=async()=>{const browser=await h.browser(),context=await browser.newContext();context.setDefaultTimeout(12000);await context.addCookies(h.cookie(h.A).split('; ').map(v=>{const i=v.indexOf('=');return {name:v.slice(0,i),value:v.slice(i+1),url:h.base};}));return {context,page:await context.newPage()};};
 const terminal=id=>['succeeded','partial','failed','cancelled'].includes(observed(id).job.state);
 await run(extensionIds[0],async()=>{
  const jobs=[await create({actor:h.A}),await create({actor:h.B})];
  try{
   // A dispatcher bootstraps a never-served tenant without browser credentials.
   h.sql(`DELETE FROM audit_events WHERE action='consumer_heartbeat' AND tenant_id IN (${q(h.A.tenant)},${q(h.B.tenant)})`);
   for(let i=0;i<8&&!jobs.every(j=>terminal(j.id));i++){
    const w=await h.worker(h.A,h.bot,{VEXA_WORKER_DISPATCHER:'enabled',VEXA_WORKER_TENANT:''});try{await call(w,'consume');}finally{await w.kill();}
   }
   for(const [i,j]of jobs.entries()){const s=observed(j.id);assert.equal(s.job.state,'succeeded','COLDSTART_TERMINAL');assert.equal(s.job.tenant_id,[h.A,h.B][i].tenant);assert.equal(s.rows.length,j.n);assert.equal(Number(s.import.total),j.n);}
   const ids=jobs.map(j=>new Set(observed(j.id).rows.map(r=>r.id)));assert.ok([...ids[0]].every(id=>!ids[1].has(id)),'TENANT_LEDGER_DISJOINT');
   h.sql(`UPDATE worker_delegations SET enabled=false WHERE user_id=${q(h.bot.id)}`);
   const w=await h.worker(h.A,h.bot,{VEXA_WORKER_DISPATCHER:'enabled',VEXA_WORKER_TENANT:''});try{assert.deepEqual(await call(w,'consume'),{idle:true},'DISABLED_DISPATCHER_IDLE');}finally{await w.kill();}
  }finally{h.sql(`UPDATE worker_delegations SET enabled=true WHERE user_id=${q(h.bot.id)}`);for(const j of jobs)await h.request(j===jobs[0]?h.A:h.B,`/api/jobs/${j.id}/cancel`,{});}
 });
 await run(extensionIds[1],async()=>{
  const start=h.authGrants.length,w=await h.worker();try{const r=await call(w,'credentials');assert.equal(r.authenticated,true);assert.equal(r.status,200);assert.equal(r.userId,h.bot.id);const grants=h.authGrants.slice(start);assert.ok(grants.includes('password'),'REAL_PASSWORD_AUTH');assert.ok(grants.includes('refresh_token'),'REAL_REFRESH_AUTH');assert.ok(h.authRotations.some(r=>r.rotated&&r.status===200),'REAL_REFRESH_TOKEN_ROTATED');fs.writeFileSync(path.join(evidence,'auth-refresh.json'),JSON.stringify({grants,status:r.status,identityMatches:true}));}finally{await w.kill();}
 });
 await run(extensionIds[2],async()=>{
  const j=await create();try{
   const claim=await call(a,'claim');assert.equal(claim.id,j.id);
   h.sql(`UPDATE memberships SET status='revoked',permissions_version=permissions_version+1 WHERE tenant_id=${q(h.A.tenant)} AND user_id=${q(h.A.id)}`);
   const before=observed(j.id);const denied=await a.call('renew',claim);assert.equal(denied.ok,false);assert.equal(denied.error.code,'ACTOR_REVOKED');
   await call(a,'fail',claim,{code:'ACTOR_REVOKED',status:403});const failed=observed(j.id);assert.equal(failed.job.state,'failed');assert.deepEqual(failed.rows,before.rows);assert.deepEqual(failed.cp,before.cp);
   assert.equal(h.sql(`SELECT count(*) FROM dead_letters WHERE job_id=${q(j.id)} AND reason='ACTOR_REVOKED'`),'1','AUDITABLE_TERMINAL_REASON');
   assert.equal(h.sql(`SELECT state FROM outbox WHERE job_id=${q(j.id)}`),'failed');assert.equal(failed.import.state,'failed');
   h.sql(`UPDATE memberships SET status='active',permissions_version=permissions_version+1 WHERE tenant_id=${q(h.A.tenant)} AND user_id=${q(h.A.id)}`);
   assert.equal((await h.request(h.A,`/api/jobs/${j.id}/replay`,{})).status,200);await call(a,'consume');const after=observed(j.id);assert.equal(after.job.state,'succeeded');assert.equal(after.job.import_id,j.importId);assert.equal(after.rows.length,j.n);assert.equal(h.sql(`SELECT count(*) FROM dead_letters WHERE job_id=${q(j.id)} AND reason='ACTOR_REVOKED'`),'1','REPLAY_PRESERVES_AUDIT');
  }finally{h.sql(`UPDATE memberships SET status='active' WHERE tenant_id=${q(h.A.tenant)} AND user_id=${q(h.A.id)}`);await cancel(j.id);}
 });
 await run(extensionIds[3],async()=>{
  const first=await create();let second;try{await call(a,'consume');const rows=observed(first.id).rows;const count=h.sql(`SELECT count(*) FROM source_revisions WHERE tenant_id=${q(h.A.tenant)}`);second=await create();assert.notEqual(second.importId,first.importId,'NEW_KEY_NEW_IMPORT');assert.deepEqual(second.bytes,first.bytes);await call(a,'consume');const s=observed(second.id);assert.equal(s.job.state,'succeeded');assert.equal(Number(s.import.duplicates),second.n,'CROSS_IMPORT_DEDUP');assert.equal(Number(s.import.accepted),0);assert.equal(s.rows.length,second.n);assert.equal(h.sql(`SELECT count(*) FROM source_revisions WHERE tenant_id=${q(h.A.tenant)}`),count,'NO_NEW_REVISIONS');assert.deepEqual(observed(first.id).rows,rows,'FIRST_IMPORT_IMMUTABLE');}finally{await cancel(first.id);if(second)await cancel(second.id);}
 });
 await run(extensionIds[4],async()=>{
  const j=await create({n:105});let installed=false;
  try{
   h.sql(`CREATE SEQUENCE f02_row103_canary; GRANT USAGE,SELECT ON SEQUENCE f02_row103_canary TO vexa_backend; CREATE FUNCTION f02_row103_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.import_id=${q(j.importId)}::uuid AND NEW.row_ref='103' THEN PERFORM nextval('f02_row103_canary'); RAISE EXCEPTION 'EXTERNAL SQL ROW103' USING ERRCODE='P0001'; END IF; RETURN NEW; END $$; CREATE TRIGGER f02_row103_fault BEFORE INSERT ON import_rows FOR EACH ROW EXECUTE FUNCTION f02_row103_fault();`);installed=true;
   await call(a,'consume');assert.equal(h.sql('SELECT is_called FROM f02_row103_canary'),'t','ROW103_SERVER_CANARY');const before=observed(j.id);assert.equal(before.cp.offset,100,'ONLY_FIRST100_CHECKPOINT');assert.equal(before.rows.length,100,'SECOND_CHUNK_ATOMIC_ROLLBACK');assert.equal(before.job.state,'queued');assert.equal(before.job.failure_count,1);assert.equal(Number(before.import.total),100);
   h.sql('DROP TRIGGER f02_row103_fault ON import_rows; DROP FUNCTION f02_row103_fault(); DROP SEQUENCE f02_row103_canary;');installed=false;await delay(Math.max(0,Date.parse(before.job.next_attempt_at)-Date.now())+50);await call(a,'consume');const after=observed(j.id);assert.equal(after.job.state,'succeeded');assert.equal(after.cp.offset,105);assert.equal(after.rows.length,105);assert.deepEqual(after.rows.filter(r=>Number(r.ref)<=101),before.rows,'FIRST_CHUNK_UNCHANGED');
  }finally{if(installed)h.sql('DROP TRIGGER f02_row103_fault ON import_rows; DROP FUNCTION f02_row103_fault(); DROP SEQUENCE f02_row103_canary;');await cancel(j.id);}
 });
 await run(extensionIds[5],async()=>{
  const j=await create(),w=await h.worker(h.A,h.A);try{
   h.sql(`UPDATE jobs SET created_at=clock_timestamp()-interval '90 seconds' WHERE id=${q(j.id)}; UPDATE audit_events SET occurred_at=clock_timestamp()-interval '45 seconds' WHERE tenant_id=${q(h.A.tenant)} AND action='consumer_heartbeat'`);
   const normal=await call(w,'healthOptions',{queueMs:120000,heartbeatMs:60000}),strict=await call(w,'healthOptions',{queueMs:60000,heartbeatMs:30000});assert.ok(!normal.reasons.includes('OLDEST_QUEUE'));assert.ok(!normal.reasons.includes('NO_HEARTBEAT'));assert.ok(strict.reasons.includes('OLDEST_QUEUE'),'CUSTOM_QUEUE_THRESHOLD');assert.ok(strict.reasons.includes('NO_HEARTBEAT'),'CUSTOM_HEARTBEAT_THRESHOLD');
  }finally{await w.kill();await cancel(j.id);await call(a,'heartbeat');}
 });
 await run(extensionIds[6],async()=>{
  const url=h.base+'/api/internal/worker',before=h.sql('SELECT count(*) FROM attempts');
  for(const [suffix,headers,body,expected]of [
   ['',{},'{}',401],['',{authorization:'Bearer wrong'},'{}',401],['',{cookie:h.cookie(h.A)},'{}',401],
   ['?tenant_id='+h.B.tenant,{authorization:'Bearer '+h.triggerSecret},'{}',400],
   ['',{authorization:'Bearer '+h.triggerSecret},JSON.stringify({tenant_id:h.B.tenant}),400],
   ['',{authorization:'Bearer '+h.triggerSecret},'{',400],
  ]){const r=await fetch(url+suffix,{method:'POST',headers,body});assert.equal(r.status,expected,'MACHINE_NEGATIVE_MATRIX');assert.match(r.headers.get('cache-control'),/no-store/);await r.arrayBuffer();}
  assert.equal(h.sql('SELECT count(*) FROM attempts'),before,'NO_NEGATIVE_SCOPE_EFFECTS');
  const jobs=[await create(),await create({actor:h.B})];try{for(let n=0;n<8&&!jobs.every(j=>terminal(j.id));n++){const r=await fetch(url,{method:'POST',headers:{authorization:'Bearer '+h.triggerSecret},body:'{}'});assert.equal(r.status,200,'MACHINE_POSITIVE');await r.arrayBuffer();await h.stopWeb();await h.startWeb();}for(const j of jobs)assert.equal(observed(j.id).job.state,'succeeded','HOSTED_SCOPE_PROGRESS');}finally{for(const [i,j]of jobs.entries())await h.request(i?h.B:h.A,`/api/jobs/${j.id}/cancel`,{});}
 });
 await run(extensionIds[7],async()=>{
  const j=await create({n:103,invalid:true});let context;try{await call(a,'consume');
   // A successful once invocation alone does not prove this job finished.
   // Persist the precondition before any assertion/cleanup; never retry it away.
   const consumed=observed(j.id),attempts=h.json(`SELECT coalesce(json_agg(json_build_object('state',state,'fencing_token',fencing_token,'error_code',error_code)),'[]') FROM attempts WHERE job_id=${q(j.id)}`);
   const outcome={job_id:j.id,state:consumed.job.state,failure_count:consumed.job.failure_count,checkpoint:consumed.cp,counters:{total:consumed.import.total,rejected:consumed.import.rejected,duplicates:consumed.import.duplicates,pending:consumed.import.pending},attempts};
   fs.writeFileSync(path.join(evidence,'csv-consume.json'),JSON.stringify(outcome,null,2),{mode:0o600});
   assert.equal(outcome.state,'partial','CSV_CONSUME_TERMINAL');assert.equal(outcome.checkpoint?.done,true,'CSV_CONSUME_DONE');assert.equal(outcome.checkpoint?.offset,103,'CSV_CONSUME_CHECKPOINT');assert.equal(Number(outcome.counters.rejected),1,'CSV_CONSUME_REJECTED');
   const route='/api/jobs/'+j.id+'/errors';assert.equal((await fetch(h.base+route,{headers:{cookie:h.cookie(h.B)}})).status,404,'CSV_TENANT_ISOLATION');assert.equal((await fetch(h.base+route)).status,401,'CSV_AUTH_REQUIRED');const r=await fetch(h.base+route,{headers:{cookie:h.cookie(h.A)}});assert.equal(r.status,200);assert.match(r.headers.get('content-type'),/text\/csv/);assert.match(r.headers.get('content-disposition'),/attachment/);const original=Buffer.from(await r.arrayBuffer());assert.equal(original.toString(),'line,field,code\r\n"103","date","INVALID_DATE"\r\n','CSV_EXACT_BYTES');
   const payload='=HYPERLINK("https://synthetic.invalid","x")';h.sql(`UPDATE import_rows SET provenance=jsonb_set(provenance,'{result,field}',to_jsonb(${q(payload)}::text)) WHERE import_id=${q(j.importId)} AND row_ref='103'`);
   const download=await fetch(h.base+route,{headers:{cookie:h.cookie(h.A)}});const escaped=Buffer.from(await download.arrayBuffer());assert.ok(escaped.toString().includes("'=HYPERLINK"),'CSV_FORMULA_PREFIX');assert.ok(!escaped.toString().includes('SYNTHETIC-'));
   const view=await browserPage();context=view.context;const page=view.page;await page.goto(h.base+'/jobs/'+j.id);await page.getByRole('status').filter({hasText:'partial'}).waitFor();
   const downloaded=await h.browserDownload(page,()=>page.getByRole('link',{name:'Descargar errores persistidos CSV'}).click());assert.deepEqual(downloaded,escaped,'BROWSER_DOWNLOAD_BYTES');
   let failed=false;await page.route('**/api/jobs/'+j.id,async route=>{if(!failed){failed=true;await route.fulfill({status:503,contentType:'application/json',body:'{"error":{"code":"SYNTHETIC_UNAVAILABLE"}}'});}else await route.continue();});await page.getByRole('button',{name:'Actualizar / reintentar'}).click();await page.getByRole('alert').filter({hasText:'Configura'}).waitFor();await page.getByRole('button',{name:'Actualizar / reintentar'}).click();await page.getByRole('alert').filter({hasText:'Configura'}).waitFor({state:'hidden'});assert.equal(observed(j.id).job.state,'partial');
  }finally{if(context)await context.close();await cancel(j.id);}
 });
 await run(extensionIds[8],async()=>{
  const j=await create();let context;try{
   const view=await browserPage();context=view.context;const page=view.page;let unavailable=true;
   await page.route('**/api/jobs/'+j.id+'/canonicals',async route=>{if(unavailable){unavailable=false;await route.fulfill({status:503,contentType:'application/json',body:'{"error":{"code":"SYNTHETIC_UNAVAILABLE"}}'});}else await route.continue();});
   await page.goto(h.base+'/jobs/'+j.id);await page.getByRole('alert').filter({hasText:'historial: 503'}).waitFor();
   assert.equal(await page.getByRole('button',{name:'Actualizar historial',exact:true}).count(),1,'HISTORY_RETRY_AVAILABLE');
   await page.getByRole('button',{name:'Actualizar historial',exact:true}).click();await page.getByRole('alert').filter({hasText:'historial: 503'}).waitFor({state:'hidden'});
   assert.deepEqual((await h.request(h.A,`/api/jobs/${j.id}/canonicals`)).data.data,[],'QUEUED_HISTORY_EMPTY');
   await call(a,'consume');await page.getByRole('status').filter({hasText:'succeeded'}).waitFor();
   const list=(await h.request(h.A,`/api/jobs/${j.id}/canonicals`)).data.data;assert.ok(list.length);const id=list[0].id,route=`/api/jobs/${j.id}/canonicals/${id}`;
   await page.getByRole('button',{name:new RegExp(id)}).click();await page.getByLabel('Motivo de selección').fill('SYNTHETIC browser choice');const history=(await h.request(h.A,route)).data.data;
   assert.equal((await h.request(h.A,route,{revisionId:history.revisions[0].id,expectedVersion:history.head.version,reason:'SYNTHETIC concurrent owner'})).status,200);
   const conflict=page.waitForResponse(r=>r.url().endsWith(route)&&r.request().method()==='POST');await page.getByRole('button',{name:'Elegir esta revisión'}).first().click();assert.equal((await conflict).status(),409);await page.getByRole('alert').filter({hasText:'La versión cambió'}).waitFor();await page.getByLabel('Motivo de selección').fill('SYNTHETIC resolved CAS');const success=page.waitForResponse(r=>r.url().endsWith(route)&&r.request().method()==='POST');await page.getByRole('button',{name:'Elegir esta revisión'}).first().click();assert.equal((await success).status(),200);assert.equal((await h.request(h.A,route)).data.data.head.version,history.head.version+2);
  }finally{if(context)await context.close();await cancel(j.id);}
 });
}
