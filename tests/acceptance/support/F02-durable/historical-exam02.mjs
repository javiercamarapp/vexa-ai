import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {hash,q,snapshot,injection,serve} from './runtime.mjs';
export async function exam02(t,h,factory,{only}={}){
 const sub=(name,fn)=>!only||name.includes(only)?t.test(name,fn):Promise.resolve();
 const app=await serve(await factory(h.ports));t.after(()=>app.close());
 const fixture=()=>Buffer.from(`id,text\n${randomUUID()},SYNTHETIC\n`);
 const reserve=async(actor,bytes=fixture(),key=randomUUID(),extra={})=>{
  t.diagnostic?.('SYNTHETIC_FIXTURE '+JSON.stringify({sha256:hash(bytes),bytes_base64:bytes.toString('base64')}));
  const body={connection_id:actor.connection,mapping_version:'csv-message-v1',content_type:'text/csv',size:bytes.length,sha256:hash(bytes),...extra};
  const r=await app.request(actor,'/api/imports',body,{'idempotency-key':key});return {r,bytes,key,body,...r.data?.data};
 };
 const upload=async(v,bytes=v.bytes)=>{
  assert.equal(v.r.status,201,'RESERVE_POSITIVE');assert.ok(v.import_id,'RESERVE_ID');
  const u=new URL(v.upload_url,'http://127.0.0.1:56328');
  assert.equal(u.origin,'http://127.0.0.1:56328','UPLOAD_OWN_STORAGE');assert.ok(u.pathname.startsWith('/object/upload/sign/vexa-private/'),'UPLOAD_SIGNED_SCOPE');
  const r=await fetch(u,{method:'PUT',headers:{'Content-Type':'text/csv',Connection:'close'},body:bytes,signal:AbortSignal.timeout(5000)});
  assert.equal(r.status,200,'UPLOAD_REAL_STORAGE');
  const read=await h.http('storage','/object/authenticated/vexa-private/'+v.object_path,h.A.token);
  if(read.status===200)assert.equal(hash(Buffer.from(read.text)),hash(bytes),'STORAGE_BYTES');
 };
 const confirm=(a,v,extra={})=>app.request(a,`/api/imports/${v.import_id}/confirm`,{upload_token:v.upload_token,sha256:hash(v.bytes),mapping_version:'csv-message-v1',...extra});
 const noJobs=v=>{const s=snapshot(h,v.import_id);assert.equal(s.jobs.length,0,'NO_JOB_BEFORE_CONFIRM');assert.equal(s.outbox.length,0,'NO_OUTBOX_BEFORE_CONFIRM');return s;};
 await sub('D02-01 reservation, real direct upload, hash, queued and concurrent retry',async()=>{
  const v=await reserve(h.A);assert.equal(v.r.status,201);assert.equal(noJobs(v).imports[0].state,'reserved');
  await upload(v);
  const responses=await Promise.all([confirm(h.A,v),confirm(h.A,v)]);for(const r of responses){assert.equal(r.status,202,'CONFIRM_ACCEPTED');assert.equal(r.data.data.state,'queued','202_NOT_COMPLETE');}
  const s=snapshot(h,v.import_id);assert.equal(s.imports.length,1);assert.equal(s.jobs.length,1,'IDEMPOTENT_JOB');assert.equal(s.outbox.length,1,'IDEMPOTENT_OUTBOX');assert.equal(s.outbox[0].job_id,s.jobs[0].id);assert.equal(s.jobs[0].tenant_id,h.A.tenant);assert.equal(s.jobs[0].state,'queued');
  const replay=await reserve(h.A,v.bytes,v.key);assert.equal(replay.import_id,v.import_id,'RESERVATION_REPLAY');
  const conflict=await reserve(h.A,fixture(),v.key);assert.equal(conflict.r.status,409,'IDEMPOTENCY_PAYLOAD_CONFLICT');
 });
 await sub('D02-02 hash and size independently observed from Storage',async()=>{
  const v=await reserve(h.A);await upload(v,Buffer.from(v.bytes.toString().replace('SYNTHETIC','CORRUPTED')));
  const r=await confirm(h.A,v);assert.equal(r.status,422,'HASH_MISMATCH');assert.equal(r.data.error.code,'hash_mismatch','HASH_REASON');noJobs(v);
  const bytes=fixture(),s=await reserve(h.A,bytes,randomUUID(),{size:bytes.length+1});await upload(s);const mismatch=await confirm(h.A,s);assert.equal(mismatch.status,422,'SIZE_MISMATCH');assert.equal(mismatch.data.error.code,'size_mismatch','SIZE_REASON');noJobs(s);
 });
 await sub('D02-03 nonexistent object and expired confirmation capability',async()=>{
  const missing=await reserve(h.A);assert.equal((await confirm(h.A,missing)).status,422,'MISSING_OBJECT');noJobs(missing);
  const expired=await reserve(h.A);await upload(expired);h.advance(31000);
  const r=await confirm(h.A,expired);assert.equal(r.status,403,'EXPIRED_CONFIRM');assert.equal(r.data.error.code,'upload_token_expired');noJobs(expired);
  const fresh=await reserve(h.A);await upload(fresh);assert.equal((await confirm(h.A,fresh)).status,202,'EXPIRY_RESTORED_POSITIVE');
 });
 for(const table of ['jobs','outbox'])await sub('D02-04 SQL fault at '+table+' rolls back confirmation; retry preserves reservation',async()=>{
  const v=await reserve(h.A);await upload(v);const before=snapshot(h,v.import_id);
  injection(h,table,true);let r;try{r=await confirm(h.A,v);assert.equal(h.sql('SELECT is_called FROM public.f02_fault_reached'),'t','FAULT_REACHED_SQL_TRIGGER');}finally{injection(h,table,false);}
  assert.equal(r.status,503,'SQL_ERROR_NOT_SUCCESS');assert.deepEqual(snapshot(h,v.import_id),before,'ATOMIC_CONFIRM_ROLLBACK');
  assert.equal(h.sql(`SELECT count(*) FROM storage.objects WHERE name=${q(v.object_path)}`),'1','OBJECT_TRACKED_BY_RESERVATION');
  assert.equal((await confirm(h.A,v)).status,202,'RETRY_RECOVERS');assert.equal(snapshot(h,v.import_id).outbox.length,1);
 });
 await sub('D02-05 cross tenant confirmation, polling, selector and object substitution',async()=>{
  const v=await reserve(h.B);await upload(v);const before=snapshot(h,v.import_id);
  assert.equal((await confirm(h.A,v)).status,404,'CROSS_CONFIRM');assert.equal((await app.request(h.A,'/api/imports/'+v.import_id)).status,404,'CROSS_POLL');
  assert.equal((await reserve(h.A,fixture(),randomUUID(),{connection_id:h.B.connection})).r.status,404,'CROSS_CONNECTION');
  assert.equal((await reserve(h.A,fixture(),randomUUID(),{tenant_id:h.B.tenant})).r.status,400,'BODY_TENANT');
  assert.equal((await app.request({...h.A,tenant:h.B.tenant},'/api/imports/'+v.import_id)).status,403,'FORGED_SELECTOR');
  const a=await reserve(h.A);await upload(a);assert.equal((await confirm(h.A,a,{upload_token:v.upload_token})).status,403,'CROSS_CAPABILITY');
  const object=await h.http('storage','/object/authenticated/vexa-private/'+v.object_path,h.A.token);assert.ok([400,401,403,404].includes(object.status),'CROSS_STORAGE');assert.ok(!object.text.includes('SYNTHETIC'),'CROSS_BYTES');
  assert.deepEqual(snapshot(h,v.import_id),before,'B_UNCHANGED');assert.equal((await confirm(h.B,v)).status,202,'B_POSITIVE');
 });
 await sub('D02-06 revoked member cannot confirm, poll or fetch previously known object',async()=>{
  const v=await reserve(h.A);await upload(v);h.sql(`UPDATE memberships SET status='revoked',permissions_version=permissions_version+1 WHERE tenant_id=${q(h.A.tenant)} AND user_id=${q(h.A.id)}`);
  try{
   assert.equal((await confirm(h.A,v)).status,403,'REVOKED_CONFIRM');assert.equal((await app.request(h.A,'/api/imports/'+v.import_id)).status,403,'REVOKED_POLL');
   const r=await h.http('storage','/object/authenticated/vexa-private/'+v.object_path,h.A.token);assert.ok([400,401,403,404].includes(r.status),'REVOKED_STORAGE');noJobs(v);
  }finally{h.sql(`UPDATE memberships SET status='active',permissions_version=permissions_version+1 WHERE tenant_id=${q(h.A.tenant)} AND user_id=${q(h.A.id)}`);}
  assert.equal((await confirm(h.A,v)).status,202,'REVOCATION_RESTORED_POSITIVE');
 });
 await sub('D02-10 failed reservation cannot leave an untracked Storage object',async()=>{
  const before=h.sql('SELECT count(*) FROM storage.objects');const imports=h.sql('SELECT count(*) FROM imports');
  injection(h,'imports',true);
  try{const v=await reserve(h.A);assert.equal(v.r.status,503,'RESERVATION_SQL_ERROR');assert.equal(h.sql('SELECT is_called FROM f02_fault_reached'),'t','RESERVATION_FAULT_REACHED');assert.equal(h.sql('SELECT count(*) FROM imports'),imports,'RESERVATION_ROLLBACK');assert.equal(h.sql('SELECT count(*) FROM storage.objects'),before,'NO_UNTRACKED_OBJECT');}
  finally{injection(h,'imports',false);}
  const v=await reserve(h.A);await upload(v);assert.equal((await confirm(h.A,v)).status,202,'RESERVATION_RETRY_POSITIVE');
 });
 await sub('D02-09 independent SQL connections contend on tenant/idempotency unique',async()=>{
  const key=randomUUID(),ids=[randomUUID(),randomUUID()];
  const insert=(actor,id)=>`INSERT INTO imports(id,tenant_id,file_hash,mapping_version,idempotency_key) VALUES (${q(id)},${q(actor.tenant)},'SYNTHETIC_HASH','csv-message-v1',${q(key)})`;
  const results=await Promise.allSettled(ids.map(id=>h.sqlAsync(`BEGIN; SELECT pg_sleep(0.2); ${insert(h.A,id)}; SELECT pg_sleep(0.3); COMMIT;`)));
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1,'DB_UNIQUE_ONE_COMMIT');
  const rejected=results.filter(r=>r.status==='rejected');assert.equal(rejected.length,1,'DB_UNIQUE_ONE_REJECT');assert.equal(rejected[0].reason.sqlstate,'23505','DB_UNIQUE_NOT_INFRA');
  assert.equal(h.sql(`SELECT count(*) FROM imports WHERE tenant_id=${q(h.A.tenant)} AND idempotency_key=${q(key)}`),'1','DB_UNIQUE_PERSISTED');
  h.sql(insert(h.B,randomUUID()));assert.equal(h.sql(`SELECT count(*) FROM imports WHERE idempotency_key=${q(key)}`),'2','DB_UNIQUE_TENANT_SCOPE');
 });
 await sub('D02-08 Storage rejects correctly signed expired upload token; fresh control uploads',async()=>{
  const v=await reserve(h.A);assert.equal(v.r.status,201,'TOKEN_RESERVATION');
  const u=new URL(v.upload_url,'http://127.0.0.1:56328'),token=u.searchParams.get('token');assert.ok(token,'STORAGE_UPLOAD_JWT');
  const send=async clockExpired=>{const target=new URL(u);target.searchParams.set('token',h.signStorageClockToken(token,clockExpired));return fetch(target,{method:'PUT',headers:{'Content-Type':'text/csv',Connection:'close'},body:v.bytes,signal:AbortSignal.timeout(5000)});};
  const expired=await send(true);const text=await expired.text();assert.ok([400,401,403].includes(expired.status),'STORAGE_EXPIRED_STATUS');assert.match(JSON.parse(text).message,/expired|exp.*timestamp check failed/i,'STORAGE_EXPIRED_REASON');
  assert.equal(h.sql(`SELECT count(*) FROM storage.objects WHERE name=${q(v.object_path)}`),'0','EXPIRED_NO_OBJECT');
  const fresh=await send(false);assert.equal(fresh.status,200,'STORAGE_SIGNER_POSITIVE');await fresh.arrayBuffer();
  assert.equal((await confirm(h.A,v)).status,202,'STORAGE_FRESH_CONFIRMS');
  const foreign=new URL(u);foreign.pathname=foreign.pathname.replace(h.A.tenant,h.B.tenant);const bad=await fetch(foreign,{method:'PUT',headers:{'Content-Type':'text/csv',Connection:'close'},body:v.bytes,signal:AbortSignal.timeout(5000)});assert.ok([400,401,403].includes(bad.status),'SIGNED_URL_SCOPE');await bad.arrayBuffer();assert.equal(h.sql(`SELECT count(*) FROM storage.objects WHERE name=${q(v.object_path.replace(h.A.tenant,h.B.tenant))}`),'0','SIGNED_URL_NO_FOREIGN_OBJECT');
 });
 await sub('D02-07 anonymous, viewer and caller-selected bucket forbidden',async()=>{
  assert.equal((await app.request(null,'/api/imports',{})).status,401,'ANONYMOUS');
  assert.equal((await reserve(h.A,fixture(),randomUUID(),{bucket:'arbitrary'})).r.status,400,'ARBITRARY_BUCKET');
  h.sql(`UPDATE memberships SET role='viewer' WHERE tenant_id=${q(h.A.tenant)} AND user_id=${q(h.A.id)}`);
  try{assert.equal((await reserve(h.A)).r.status,403,'VIEWER_RESERVE');}finally{h.sql(`UPDATE memberships SET role='owner' WHERE tenant_id=${q(h.A.tenant)} AND user_id=${q(h.A.id)}`);}
 });
}
