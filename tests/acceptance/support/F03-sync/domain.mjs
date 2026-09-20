import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {q} from './harness.mjs';import {windowSpec,record,page,adapter} from './fixtures.mjs';
export async function domain(t,h){
 const ensureArgs=(a,extra={})=>({connectionId:a.connection,mode:'live',window:windowSpec,mappingVersion:'crm-canonical-v1',...extra});
 const start=async(a,options={})=>{const{repository,database}=h.repository(a,options),row=await repository.ensure(ensureArgs(a)),workerId=randomUUID();const claimed=await repository.claim({syncId:row.id,workerId,leaseMs:30000});assert.ok(claimed,'CLAIM_REQUIRED');return{repository,database,row,workerId,fence:claimed.fence,version:Number(claimed.version)};};
 const commit=(s,p)=>s.repository.commitPage({syncId:s.row.id,workerId:s.workerId,fence:s.fence,page:p,expectedVersion:s.version});
 const cursor=s=>h.json(`SELECT to_jsonb(s) FROM sync_cursors s WHERE id=${q(s.row.id)}`);
 const counts=a=>h.json(`SELECT json_build_object('messages',(SELECT count(*) FROM messages WHERE tenant_id=${q(a.tenant)}),'revisions',(SELECT count(*) FROM source_revisions WHERE tenant_id=${q(a.tenant)}),'raw',(SELECT count(*) FROM sync_raw_objects WHERE tenant_id=${q(a.tenant)}),'pages',(SELECT count(*) FROM sync_pages WHERE tenant_id=${q(a.tenant)}),'quarantine',(SELECT count(*) FROM source_quarantine WHERE tenant_id=${q(a.tenant)}))`);
 await t.test('canonical page, original evidence and unknown role quarantine are durable',async()=>{
  const a=h.actor(),s=await start(a),p=page([record(h.ingestion,a,'T1',{type:'ticket'}),record(h.ingestion,a,'M1'),record(h.ingestion,a,'MX',{role:'unknown'})],'opaque:/?second',{errors:[{index:9,code:'INVALID_RECORD',field:null,payload:{synthetic:'malformed'},context:{tenant_id:a.tenant,connection_id:a.connection,source:a.source,source_account_id:a.account},observed_at:'2026-09-01T00:00:00.000Z'}]});
  await commit(s,p);assert.deepEqual(cursor(s).checkpoint,p.checkpoint,'CURSOR_OPAQUE_EXACT');const c=counts(a);assert.equal(c.messages,1,'UNKNOWN_NOT_CUSTOMER');assert.equal(c.pages,1,'PAGE_DURABLE');assert.equal(c.raw,4,'EVERY_OBJECT_DURABLE');assert.equal(h.sql(`SELECT count(*) FROM import_rows WHERE tenant_id=${q(a.tenant)} AND state='rejected'`),'2','QUARANTINE_DURABLE');
  const raw=h.sql(`SELECT jsonb_agg(to_jsonb(r)) FROM sync_raw_objects r WHERE tenant_id=${q(a.tenant)}`);assert.match(raw,/SYNTHETIC body/,'ORIGINAL_BODY_RECOVERABLE');assert.match(raw,/malformed/,'REJECTION_ORIGINAL_RECOVERABLE');
  assert.equal(h.sql(`SELECT count(*) FROM messages WHERE tenant_id=${q(a.tenant)} AND role='customer'`),'1');
 });
 await t.test('failed COMMIT rolls back page raw canonical and checkpoint together',async()=>{
  const a=h.actor();let armed=false;const s=await start(a,{fault:{before:async(text,_values,c)=>{if(armed&&text==='COMMIT'){armed=false;await c.query('ROLLBACK');throw Object.assign(Error('SYN_COMMIT_FAILURE'),{code:'08006'});}}}});const before=cursor(s),c=counts(a);armed=true;
  await assert.rejects(commit(s,page([record(h.ingestion,a,'T1',{type:'ticket'}),record(h.ingestion,a,'M1')],'next')));
  assert.deepEqual(cursor(s),before,'CURSOR_NEVER_BEYOND_COMMIT');assert.deepEqual(counts(a),c,'EFFECTS_ROLLBACK');
 });
 await t.test('postCOMMIT lost ACK replay from another process is idempotent',async()=>{
  const a=h.actor();let armed=false;const s=await start(a,{fault:{after:async(text)=>{if(armed&&text==='COMMIT'){armed=false;throw Object.assign(Error('SYN_ACK_LOST'),{code:'08006'});}}}});const p=page([record(h.ingestion,a,'T1',{type:'ticket'}),record(h.ingestion,a,'M1')],'next');armed=true;await assert.rejects(commit(s,p));const before=counts(a);assert.equal(before.messages,1,'POSTCOMMIT_EFFECT_EXISTS');
  h.sql(`UPDATE sync_cursors SET lease_until=now()-interval '1 second' WHERE id=${q(s.row.id)}`);const replay=await h.child(a,{op:'run',args:{...ensureArgs(a),workerId:randomUUID(),deadlineMs:30000,maxPages:2},pages:[p,page([], 'terminal',{done:true})]});assert.equal(replay.code,0,'NEW_PROCESS_EXIT');assert.equal(replay.result?.ok,true,'REPLAY_ACK_REQUIRED');assert.equal(counts(a).messages,before.messages,'REPLAY_NO_DUPLICATION');assert.equal(counts(a).revisions,before.revisions,'REPLAY_NO_NEW_REVISION');assert.equal(counts(a).pages,2,'RESUME_TERMINAL_PAGE');assert.equal(cursor(s).done,true);
 });
 await t.test('429 after page1 resumes persisted cursor and never omits page2',async()=>{
  const a=h.actor(),{repository}=h.repository(a),pages=[page([record(h.ingestion,a,'T1',{type:'ticket'}),record(h.ingestion,a,'M1')],'p1'),page([record(h.ingestion,a,'M2')],'p2',{done:true})],visits=[];
  const options={repository,...ensureArgs(a),workerId:randomUUID(),leaseMs:30000,maxPages:10,deadlineMs:30000};
  await h.sync.runSync({...options,adapterFactory:async()=>adapter(pages,{failAfter:1,visits})}).catch(()=>{});assert.equal(counts(a).messages,1,'PAGE1_COMMITTED_BEFORE_429');
  await h.sync.runSync({...options,workerId:randomUUID(),adapterFactory:async()=>adapter(pages,{visits})});assert.equal(counts(a).messages,2,'PAGE2_NOT_OMITTED');assert.equal(counts(a).pages,2,'NO_DUPLICATE_PAGE');assert.deepEqual(visits,[0,1,1],'RESUME_FROM_LAST_COMMIT');
 });
 await t.test('maxPages and deadline preserve continuation instead of success',async()=>{
  const a=h.actor(),{repository}=h.repository(a),pages=[page([record(h.ingestion,a,'T1',{type:'ticket'}),record(h.ingestion,a,'M1')],'p1'),page([record(h.ingestion,a,'M2')],'p2',{done:true})];const opts={repository,...ensureArgs(a),workerId:randomUUID(),leaseMs:30000,adapterFactory:async()=>adapter(pages),deadlineMs:30000,maxPages:1};
  await h.sync.runSync(opts);assert.equal(counts(a).messages,1,'MAXPAGES_EXACT');const row=await repository.ensure(ensureArgs(a));assert.equal(row.done,false,'CONTINUATION_NOT_FALSE_SUCCESS');assert.deepEqual(row.checkpoint,pages[0].checkpoint);
  let requested=0,ticks=0;await h.sync.runSync({...opts,workerId:randomUUID(),deadlineMs:1,clock:()=>ticks++===0?0:2,adapterFactory:async()=>({async *pages(){requested++;yield pages[1];}})});assert.equal(requested,0,'DEADLINE_NO_REMOTE_FETCH');assert.equal(counts(a).messages,1);
  await h.sync.runSync({...opts,workerId:randomUUID(),maxPages:10});assert.equal(counts(a).messages,2,'CONTINUATION_RESUMES');
 });
 await t.test('backfill overlap and live have independent scopes but shared canonical identities',async()=>{
  const a=h.actor(),{repository}=h.repository(a),live=await repository.ensure(ensureArgs(a)),back=await repository.ensure(ensureArgs(a,{mode:'backfill'}));assert.notEqual(live.id,back.id,'LIVE_BACKFILL_SEPARATE');assert.notEqual(live.scope_hash,back.scope_hash,'SCOPE_HASH_SEPARATE');assert.deepEqual(back.window_spec,{...windowSpec,fetchFrom:'2025-12-31T23:59:00.000Z'},'DECLARED_OVERLAP');
  const records=[record(h.ingestion,a,'T1',{type:'ticket'}),record(h.ingestion,a,'M1')];for(const mode of ['live','backfill'])await h.sync.runSync({repository,...ensureArgs(a,{mode}),workerId:randomUUID(),maxPages:2,deadlineMs:30000,adapterFactory:async()=>adapter([page(records,'end',{done:true})])});assert.equal(counts(a).messages,1,'OVERLAP_DEDUP_CANONICAL');
 });
 await t.test('reorder and page size preserve canonical revisions',async()=>{
  const a=h.actor(),{repository}=h.repository(a),r=[record(h.ingestion,a,'T1',{type:'ticket'}),record(h.ingestion,a,'M1'),record(h.ingestion,a,'M2')];const opts={repository,...ensureArgs(a),workerId:randomUUID(),maxPages:10,deadlineMs:30000};await h.sync.runSync({...opts,adapterFactory:async()=>adapter([page(r,'end',{done:true})])});const before=counts(a).revisions;
  await h.sync.runSync({...opts,mode:'backfill',workerId:randomUUID(),adapterFactory:async()=>adapter([page([r[0],r[2]],'x'),page([r[1]],'end',{done:true})])});assert.equal(counts(a).revisions,before,'BATCH_ORDER_CANONICAL_IDENTICAL');assert.equal(counts(a).messages,2);
 });
 await t.test('fresh database message-first pages recover after later parent',async()=>{
  const a=h.actor(),{repository}=h.repository(a),r=[record(h.ingestion,a,'T1',{type:'ticket'}),record(h.ingestion,a,'M1'),record(h.ingestion,a,'M2')];await h.sync.runSync({repository,...ensureArgs(a),workerId:randomUUID(),maxPages:10,deadlineMs:30000,adapterFactory:async()=>adapter([page([r[2],r[1]],'messages-first'),page([r[0]],'parent-last',{done:true})])});assert.equal(counts(a).messages,2,'MESSAGE_FIRST_RECOVERED');assert.equal(counts(a).revisions,3,'MESSAGE_FIRST_REVISIONS');assert.equal(h.sql(`SELECT count(*) FROM messages WHERE tenant_id=${q(a.tenant)} AND role='customer'`),'2','MESSAGE_FIRST_ROLES');
 });
 await t.test('real Zendesk factory applies overlap to actual requested URL',async()=>{
  const a=h.actor(),{repository}=h.repository(a),requests=[];const factory=h.sync.createCRMAdapterFactory({subdomain:'synthetic',token:'SYNTHETIC-NOT-A-REAL-TOKEN',clock:()=>new Date('2026-09-20T00:00:00Z'),fetch:async(url)=>{requests.push(String(url));return new Response(JSON.stringify({tickets:[],after_cursor:'SYN-terminal',end_of_stream:true}),{status:200,headers:{'content-type':'application/json'}});}});await h.sync.runSync({repository,...ensureArgs(a),workerId:randomUUID(),deadlineMs:30000,maxPages:1,adapterFactory:factory});assert.equal(requests.length,1,'REAL_ADAPTER_REQUEST');const u=new URL(requests[0]);assert.equal(u.origin,'https://synthetic.zendesk.com');assert.equal(u.searchParams.get('start_time'),String(Date.parse('2025-12-31T23:59:00Z')/1000),'OVERLAP_PROVIDER_PARAMETER');
 });
 await t.test('revoked identity and inactive connection block next page atomically',async()=>{
  for(const kind of ['membership','connection']){const a=h.actor(),s=await start(a),before=counts(a),c=cursor(s);h.sql(kind==='membership'?`UPDATE memberships SET status='revoked' WHERE user_id=${q(a.id)}`:`UPDATE connections SET status='disabled' WHERE id=${q(a.connection)}`);await assert.rejects(commit(s,page([record(h.ingestion,a,'T1',{type:'ticket'})],'forbidden')));assert.deepEqual(counts(a),before,'REVOCATION_NO_EFFECT');assert.deepEqual(cursor(s),c,'REVOCATION_NO_CURSOR');}
 });
 await t.test('lease/fence prevents simultaneous and stale writers',async()=>{
  const a=h.actor(),s=await start(a),other=randomUUID();let denied=false;try{denied=!(await s.repository.claim({syncId:s.row.id,workerId:other,leaseMs:30000}));}catch{denied=true;}assert.equal(denied,true,'LIVE_LEASE_EXCLUSIVE');h.sql(`UPDATE sync_cursors SET lease_until=now()-interval '1 second' WHERE id=${q(s.row.id)}`);const next=await s.repository.claim({syncId:s.row.id,workerId:other,leaseMs:30000});assert.ok(Number(next.fence)>Number(s.fence),'FENCE_MONOTONE');await assert.rejects(commit(s,page([record(h.ingestion,a,'T1',{type:'ticket'})],'stale')));assert.equal(counts(a).pages,0,'STALE_WRITER_NO_EFFECT');
 });
 await t.test('source deletion preserves original and records explicit tombstone without erasing history',async()=>{
  const a=h.actor(),s=await start(a);await commit(s,page([record(h.ingestion,a,'T1',{type:'ticket'}),record(h.ingestion,a,'M1')],'p1'));s.version=Number(cursor(s).version);await commit(s,page([record(h.ingestion,a,'T1',{type:'ticket',deleted:true,revision:'r2'})],'p2',{done:true}));assert.equal(counts(a).messages,1,'DELETE_DOES_NOT_ERASE_HISTORY');const raw=h.sql(`SELECT jsonb_agg(to_jsonb(r)) FROM sync_raw_objects r WHERE tenant_id=${q(a.tenant)}`);assert.match(raw,/tombstone|SOURCE_DELETED|DELETION_REQUIRES_RETENTION/,'EXPLICIT_TOMBSTONE');assert.match(raw,/SYNTHETIC body/,'ORIGINAL_RETAINED');
 });
}
