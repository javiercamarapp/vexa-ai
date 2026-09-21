import {fork} from 'node:child_process';import {once} from 'node:events';
import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import fs from 'node:fs';import path from 'node:path';import {q} from './harness.mjs';import {windowSpec,record,page,adapter} from '../F03-sync/fixtures.mjs';
export async function domain(t,h){
 const repos=h.repository(h.A),other=h.repository(h.B),list=()=>repos.health.list(),row=async()=>{const r=await list();assert.equal(r.length,1,'ONLY_A_CONNECTION');assert.equal(r[0].id,h.A.connection);return r[0];};
 let seq=0;const run=(extra={})=>h.sync.runSync({repository:repos.repository,connectionId:h.A.connection,mode:'live',window:{...windowSpec,version:'SYN-health-'+(++seq)},workerId:randomUUID(),leaseMs:30000,maxPages:10,deadlineMs:30000,...extra});
 const success=()=>run({adapterFactory:async()=>adapter([page([record(h.ingestion,h.A,'T1',{type:'ticket'}),record(h.ingestion,h.A,'M1')],'SYN-checkpoint',{done:true})])});
 await t.test('never attempted is unknown not healthy or zero',async()=>{const r=await row();assert.equal(r.lastAttempt,null);assert.equal(r.lastSuccess,null);assert.equal(r.coverage,null);assert.equal(r.permissions,'unknown');assert.equal(r.lagSeconds,null);assert.notEqual(r.state,'healthy');});
 await t.test('real sync success is durable and API is tenant scoped allowlist',async()=>{await success();const r=await row();assert.equal(r.state,'healthy');assert.ok(r.lastAttempt&&r.lastSuccess);assert.equal(r.permissions,'available');assert.equal(r.coverage.observed,2);assert.equal(r.coverage.accepted,2);assert.equal(r.coverage.rejected,0);assert.equal(r.watermark.kind,'checkpoint_hash');assert.ok(!JSON.stringify(r).includes('SYN-checkpoint'),'OPAQUE_CURSOR_NOT_EXPOSED');assert.equal((await other.health.list())[0].lastSuccess,null,'B_UNTOUCHED');
  const response=await fetch(h.base+'/api/connections?tenant_id='+h.B.tenant,{headers:{cookie:h.cookie(h.A)}});assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/private/);assert.match(response.headers.get('cache-control'),/no-store/);const data=await response.json();assert.equal(data.connections.length,1);assert.equal(data.connections[0].id,h.A.connection);const text=JSON.stringify(data);for(const secret of ['SYN-SECRET-REFERENCE',h.B.connection,h.B.account,h.A.token,'credential_ref','headers','access_token'])assert.ok(!text.includes(secret),'API_ALLOWLIST:'+secret.slice(0,12));
 });
 await t.test('partial deadline and no-op never fabricate new success',async()=>{const before=(await row()).lastSuccess;await run({maxPages:1,adapterFactory:async()=>adapter([page([record(h.ingestion,h.A,'M2')],'SYN-partial'),page([],'SYN-end',{done:true})])});let r=await row();assert.equal(r.lastSuccess,before,'PARTIAL_NO_SUCCESS');assert.notEqual(r.state,'healthy');await run({adapterFactory:async()=>adapter([page([],'SYN-empty',{done:true})])});r=await row();assert.equal(r.lastSuccess,before,'EMPTY_NO_SUCCESS');});
 await t.test('timeout durable stale retains prior success and sanitizes exception',async()=>{const previous=await row(),before=previous.lastSuccess;await run({adapterFactory:async()=>({async *pages(){throw Object.assign(Error('SYN-SECRET-TOKEN https://host/?token=SYN-QUERY'),{code:'TIMEOUT',name:'TimeoutError',headers:{authorization:'SYN-AUTH'}});}})}).catch(()=>{});const r=await row();assert.equal(r.state,'stale');assert.equal(r.lastSuccess,before,'FAILURE_NO_SUCCESS');assert.ok(r.lastAttempt);assert.equal(r.coverage,null,'FAILED_FETCH_COVERAGE_UNKNOWN');assert.deepEqual(r.watermark,previous.watermark,'FAILED_FETCH_PRESERVES_COMMITTED_WATERMARK');const data=JSON.stringify(r);for(const secret of ['SYN-SECRET','SYN-QUERY','SYN-AUTH','https://host'])assert.ok(!data.includes(secret),'EXCEPTION_REDACTION');});
 await t.test('401 revocation visible in real Chromium and next sync never fetches',async()=>{const before=(await row()).lastSuccess;await run({adapterFactory:async()=>({async *pages(){throw Object.assign(Error('SYN credential revoked'),{status:401,code:'AUTH_REQUIRED'});}})}).catch(()=>{});const r=await row();assert.equal(r.state,'reconnect_required');assert.equal(r.permissions,'revoked');assert.equal(r.lastSuccess,before);assert.equal(r.reconnect.ownerRequired,true);let fetched=0;await assert.rejects(run({adapterFactory:async()=>{fetched++;return adapter([]);}}));assert.equal(fetched,0,'REVOCATION_BEFORE_PROVIDER');
  const browser=await h.browser(),ctx=await browser.newContext();ctx.setDefaultTimeout(15000);try{await ctx.addCookies(h.cookie(h.A).split('; ').map(v=>{const n=v.indexOf('=');return{name:v.slice(0,n),value:v.slice(n+1),url:h.base};}));const p=await ctx.newPage();await p.goto(h.base+'/connections');await p.getByText(h.A.account,{exact:false}).first().waitFor();const body=await p.locator('body').innerText();assert.match(body,/reconex|reconnect/i,'UI_REVOKED');assert.ok(!body.includes(h.B.account),'UI_NO_B');const request=p.waitForResponse(r=>new URL(r.url()).pathname==='/api/connections');await p.getByRole('button',{name:/actualizar|refrescar/i}).click();assert.equal((await request).status(),200,'REFRESH_REAL_API');await p.screenshot({path:path.join(h.evidence,'connection-health-revoked.png'),fullPage:true});}finally{await ctx.close();}
 });
 await t.test('403 also blocks following sync and retains unknown success',async()=>{const r=other.repository;await h.sync.runSync({repository:r,connectionId:h.B.connection,mode:'live',window:windowSpec,workerId:randomUUID(),deadlineMs:30000,maxPages:1,adapterFactory:async()=>({async *pages(){throw Object.assign(Error('forbidden'),{status:403,code:'FORBIDDEN'});}})}).catch(()=>{});const state=(await other.health.list())[0];assert.equal(state.state,'reconnect_required');assert.equal(state.lastSuccess,null);});
 await t.test('owner recheck requires CSRF, confirmation and current attempt; it does not invent restored permissions',async()=>{
  const previous=await row(),route='/api/connections/'+h.A.connection+'/recheck',request={confirmedCredentialRotation:true,expectedAttemptId:previous.reconnect.attemptId};
  const csrf=await fetch(h.base+route,{method:'POST',headers:{cookie:h.cookie(h.A),'content-type':'application/json'},body:JSON.stringify(request)});assert.equal(csrf.status,403,'RECHECK_CSRF_REQUIRED');
  assert.equal((await h.request(h.A,route,{...request,confirmedCredentialRotation:false})).status,400,'RECHECK_CONFIRMATION_REQUIRED');
  assert.equal((await h.request({...h.bot,tenant:h.A.tenant},route,request)).status,403,'RECHECK_OWNER_REQUIRED');
  assert.equal((await h.request(h.B,route,request)).status,409,'RECHECK_FOREIGN_CONNECTION_DENIED');
  assert.equal((await h.request(h.A,route,{...request,expectedAttemptId:randomUUID()})).status,409,'RECHECK_STALE_CAS');
  const browser=await h.browser(),ctx=await browser.newContext();ctx.setDefaultTimeout(15000);
  try{await ctx.addCookies(h.cookie(h.A).split('; ').map(v=>{const n=v.indexOf('=');return{name:v.slice(0,n),value:v.slice(n+1),url:h.base};}));const p=await ctx.newPage();await p.goto(h.base+'/connections');const button=p.getByRole('button',{name:'Permitir nuevo intento'});await button.waitFor();assert.equal(await button.isDisabled(),true);await p.getByLabel('Confirmo la rotación de credenciales de esta cuenta').check();const response=p.waitForResponse(r=>new URL(r.url()).pathname===route);await button.click();assert.equal((await response).status(),202,'OWNER_UI_RECHECK');await p.getByText('Permisos pendientes de comprobar').waitFor();}
  finally{await ctx.close();}
  const pending=await row();assert.equal(pending.lastSuccess,previous.lastSuccess,'RECHECK_NO_SUCCESS');assert.equal(pending.permissions,'unknown','RECHECK_NOT_PROVIDER_VERIFICATION');
  await success();assert.equal((await row()).state,'healthy','REAL_NEXT_SYNC_RESTORES_HEALTH');
 });
 await t.test('current membership revocation rejects old database and HTTP session',async()=>{h.sql(`UPDATE memberships SET status='revoked' WHERE user_id=${q(h.A.id)} AND tenant_id=${q(h.A.tenant)}`);try{await assert.rejects(list());const res=await h.request(h.A,'/api/connections');assert.ok([401,403].includes(res.status),'REVOKED_HTTP_DENIED');}finally{h.sql(`UPDATE memberships SET status='active' WHERE user_id=${q(h.A.id)} AND tenant_id=${q(h.A.tenant)}`);}});
 await t.test('database unavailable is 503 never successful empty list',async()=>{await h.stopWeb();await h.startWeb(true);try{const response=await h.request(h.A,'/api/connections');assert.equal(response.status,503,'DB_FAILURE_503');}finally{await h.stopWeb();await h.startWeb();}});
 await t.test('two first health attempts cannot overwrite one another',async()=>{
  const connectionId=randomUUID();h.raceConnection=connectionId;h.sql(`INSERT INTO connections(id,tenant_id,source,account_id) VALUES(${q(connectionId)},${q(h.A.tenant)},'zendesk',${q('SYN-race-'+connectionId)})`);
  let arrivals=0,release;const barrier=new Promise(resolve=>{release=resolve;});
  const database={transaction:(action,work)=>repos.database.transaction(action,scope=>work({...scope,query:async(sql,values)=>{const result=await scope.query(sql,values);if(sql.startsWith('SELECT state,last_attempt')&&values[1]===connectionId){if(++arrivals===2)release();await barrier;}return result;}}))};
  const owners=[];for(const version of ['SYN-race-1','SYN-race-2']){const row=await repos.repository.ensure({connectionId,mode:'live',window:{...windowSpec,version}}),workerId=randomUUID();const lease=await repos.repository.claim({syncId:row.id,workerId});owners.push({connectionId,syncId:row.id,workerId,fence:Number(lease.fence)});}
  const concurrent=h.health.createHealthRepository({database});const outcomes=await Promise.allSettled(owners.map(owner=>concurrent.beginAttempt(owner)));
  assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,1,'ONE_CURRENT_HEALTH_ATTEMPT');
  assert.equal(h.sql(`SELECT count(*) FROM connection_health WHERE tenant_id=${q(h.A.tenant)} AND connection_id=${q(connectionId)}`),'1');
 });
 await t.test('process death after health begins can resume after the actual sync lease expires',async()=>{
  const a={...h.A,connection:randomUUID(),account:'SYN-crash-'+randomUUID()};h.sql(`INSERT INTO connections(id,tenant_id,source,account_id) VALUES(${q(a.connection)},${q(a.tenant)},'zendesk',${q(a.account)})`);
  const childFile=path.join(h.tmp,'health-crash.mjs'),window={...windowSpec,version:'SYN-crash-recovery'};
  const code=`import pg from './node_modules/pg/lib/index.js';
import {pathToFileURL} from 'node:url';
const {createDatabase}=await import(pathToFileURL(${JSON.stringify(h.built+'/packages/platform/db.mjs')}));
const {createSyncRepository,runSync}=await import(pathToFileURL(${JSON.stringify(h.built+'/packages/connectors/sync.mjs')}));
const actor=${JSON.stringify({id:a.id,tenant:a.tenant,connection:a.connection})};const identity={async getUser(){return{id:actor.id}},async memberships(){return[{tenant_id:actor.tenant,user_id:actor.id,role:'owner',status:'active',permissions_version:1}]}};
const repository=createSyncRepository({database:createDatabase({identity,pool:new pg.Pool({connectionString:process.env.VEXA_DATABASE_URL,max:2}),selectedTenant:actor.tenant})});
await runSync({repository,connectionId:actor.connection,mode:'live',window:${JSON.stringify(window)},leaseMs:100,adapterFactory:async()=>{process.send({started:true});await new Promise(()=>{});}});`;
  fs.writeFileSync(childFile,code);const child=fork(childFile,[],{execPath:process.execPath,execArgv:[],env:{...h.common},stdio:['ignore','ignore','ignore','ipc']});let timer;
  try{const message=await Promise.race([once(child,'message'),once(child,'exit').then(()=>{throw Error('HEALTH_CRASH_CHILD_EXIT');}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('HEALTH_CRASH_CHILD_TIMEOUT')),10000);})]);assert.equal(message[0].started,true);}
  finally{clearTimeout(timer);if(child.exitCode===null&&child.signalCode===null){const ended=once(child,'exit');child.kill('SIGKILL');await ended;}}
  await new Promise(resolve=>setTimeout(resolve,150));
  const resumed=await h.sync.runSync({repository:h.repository(a).repository,connectionId:a.connection,mode:'live',window,leaseMs:30000,adapterFactory:async()=>adapter([page([record(h.ingestion,a,'crash-ticket',{type:'ticket'})],'SYN-resumed',{done:true})])});
  assert.equal(resumed.state,'done','CRASH_RESUMES_WITHOUT_FIVE_MINUTE_HEALTH_LOCK');
  const item=(await h.repository(a).health.list()).find(x=>x.id===a.connection);assert.equal(item.state,'healthy');
 });
 await t.test('terminal page committed before health interruption is reconciled without another fetch or a new success timestamp',async()=>{
  const a={...h.A,connection:randomUUID(),account:'SYN-ack-'+randomUUID()};h.sql(`INSERT INTO connections(id,tenant_id,source,account_id) VALUES(${q(a.connection)},${q(a.tenant)},'zendesk',${q(a.account)})`);
  const repository=h.repository(a).repository,window={...windowSpec,version:'SYN-health-terminal-recovery'};
  let finishCalls=0;
  await assert.rejects(h.sync.runSync({repository:{...repository,finishAttempt:async input=>{if(++finishCalls===1)throw Error('SYN transient health transaction failure');return repository.finishAttempt(input);}},connectionId:a.connection,mode:'live',window,adapterFactory:async()=>adapter([page([record(h.ingestion,a,'terminal-ticket',{type:'ticket'})],'SYN-terminal',{done:true})])}));
  assert.equal(finishCalls,1,'SUMMARY_FAILURE_NOT_RECORDED_AS_SYNC_FAILURE');
  const before=(await h.repository(a).health.list()).find(x=>x.id===a.connection);assert.equal(before.state,'running');assert.equal(before.lastSuccess,null);
  let fetches=0;const input={repository,connectionId:a.connection,mode:'live',window,adapterFactory:async()=>{fetches++;throw Error('MUST_NOT_FETCH_COMMITTED_TERMINAL');}};
  const resumed=await h.sync.runSync(input);assert.equal(resumed.pages,0);assert.equal(fetches,0);
  const after=(await h.repository(a).health.list()).find(x=>x.id===a.connection);assert.equal(after.state,'healthy');assert.equal(after.lastAttempt,before.lastAttempt);assert.equal(after.lastSuccess,before.lastAttempt,'RECOVERY_USES_ORIGINAL_COMMITTED_ATTEMPT');
  await h.sync.runSync(input);assert.equal((await h.repository(a).health.list()).find(x=>x.id===a.connection).lastSuccess,after.lastSuccess,'NOOP_DOES_NOT_RESTAMP_SUCCESS');
 });
 await t.test('late parent recovery counts one accepted source message rather than a permanent rejection or a duplicate',async()=>{
  const a={...h.A,connection:randomUUID(),account:'SYN-linked-'+randomUUID()};h.sql(`INSERT INTO connections(id,tenant_id,source,account_id) VALUES(${q(a.connection)},${q(a.tenant)},'zendesk',${q(a.account)})`);
  await h.sync.runSync({repository:h.repository(a).repository,connectionId:a.connection,mode:'live',window:{...windowSpec,version:'SYN-linked-health'},adapterFactory:async()=>adapter([page([record(h.ingestion,a,'M-linked')],'SYN-orphan'),page([record(h.ingestion,a,'T1',{type:'ticket'})],'SYN-linked-done',{done:true})])});
  const value=(await h.repository(a).health.list()).find(x=>x.id===a.connection);assert.deepEqual(value.coverage,{observed:2,accepted:2,rejected:0},'LINKED_V1_COVERAGE_UNIQUE_ACCEPTED');assert.equal(value.state,'healthy');
  assert.equal(h.sql(`SELECT count(*) FROM sync_raw_objects WHERE connection_id=${q(a.connection)}`),'2','IMMUTABLE_RAW_NOT_REWRITTEN');
 });
 fs.writeFileSync(path.join(h.evidence,'domain.json'),JSON.stringify({kind:'synthetic-local-real-sql-auth-next-chromium',countedAccepted:false}));
}
