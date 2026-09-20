// Real clock + signed actual SQL expiry. Short TTL is explicit isolated DB fixture,
// installed BEFORE reservation; never rewrite expiry after signing a capability.
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {runtime,serve,hash,snapshot,q} from './runtime.mjs';
import {productBinding} from './product-binding.mjs';
test('PRODUCT actual SQL expiry and object owner; SYNTHETIC local Node',{timeout:120000},async t=>{
 const h=await runtime(process.env.VEXA_CANDIDATE);t.after(()=>h.close());
 const app=await serve(await productBinding(process.env.VEXA_CANDIDATE,h.ports));t.after(()=>app.close());
 const reserve=async()=>{const bytes=Buffer.from('id,text\n'+randomUUID()+',SYNTHETIC\n');const r=await app.request(h.A,'/api/imports',{connection_id:h.A.connection,mapping_version:'csv-message-v1',size:bytes.length,sha256:hash(bytes),content_type:'text/csv'},{'Idempotency-Key':randomUUID()});assert.equal(r.status,201);return {bytes,...r.data.data};};
 const upload=async v=>{const r=await fetch(new URL(v.upload_url,'http://127.0.0.1:56328'),{method:'PUT',headers:{'Content-Type':'text/csv',Connection:'close'},body:v.bytes});assert.equal(r.status,200);await r.arrayBuffer();};
 const confirm=v=>app.request(h.A,'/api/imports/'+v.import_id+'/confirm',{upload_token:v.upload_token,mapping_version:'csv-message-v1',sha256:hash(v.bytes)});
 await t.test('actual object owner checked independently of valid bytes',async()=>{
  const v=await reserve();await upload(v);const before=snapshot(h,v.import_id);
  assert.equal(h.sql(`SELECT owner_id FROM storage.objects WHERE name=${q(v.object_path)}`),h.A.id,'UPLOADED_OWNER');
  const diagnostic=h.probe(`UPDATE storage.objects SET owner_id=${q(h.B.id)} WHERE name=${q(v.object_path)}; result:='[]'::jsonb;`);t.diagnostic('OWNER_FIXTURE_SETUP '+JSON.stringify(diagnostic));
  assert.equal(diagnostic.code,'42501','STORAGE_OWNER_IMMUTABLE');assert.equal(h.sql(`SELECT owner_id FROM storage.objects WHERE name=${q(v.object_path)}`),h.A.id,'OWNER_UNCHANGED');
  assert.deepEqual(snapshot(h,v.import_id),before,'OWNER_NO_JOB_BEFORE_CONFIRM');
  assert.equal((await confirm(v)).status,202,'OWNER_RESTORED_POSITIVE');
 });
 await t.test('reservation expires by wall and SQL clock with unchanged valid signature',async()=>{
  h.sql("ALTER TABLE public.import_uploads ALTER COLUMN expires_at SET DEFAULT (clock_timestamp()+interval '2 seconds')");
  const v=await reserve();await upload(v);const before=snapshot(h,v.import_id);
  await new Promise(r=>setTimeout(r,2200));
  assert.equal(h.sql(`SELECT expires_at<=clock_timestamp() FROM import_uploads WHERE import_id=${q(v.import_id)}`),'t','ACTUAL_DB_EXPIRY');
  const r=await confirm(v);assert.equal(r.status,409,'EXPIRED_RESERVATION_STATUS');assert.equal(r.data.error.code,'reservation_expired','SIGNED_CAPABILITY_NOT_TAMPERED');
  assert.deepEqual(snapshot(h,v.import_id),before,'EXPIRED_PERSISTENT_RESERVATION_NO_JOB');
  assert.equal(h.sql(`SELECT count(*) FROM storage.objects WHERE name=${q(v.object_path)}`),'1','EXPIRED_OBJECT_TRACKED');
  h.sql("ALTER TABLE public.import_uploads ALTER COLUMN expires_at SET DEFAULT (now()+interval '15 minutes')");
  const fresh=await reserve();await upload(fresh);assert.equal((await confirm(fresh)).status,202,'EXPIRY_FRESH_POSITIVE');
 });
});
