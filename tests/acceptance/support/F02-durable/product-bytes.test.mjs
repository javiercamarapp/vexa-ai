import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {runtime,serve,hash,snapshot,q} from './runtime.mjs';
import {productBinding} from './product-binding.mjs';
test('PRODUCT byte oracles with actual Storage, independent SQL observer',{timeout:120000},async t=>{
 const h=await runtime(process.env.VEXA_CANDIDATE);t.after(()=>h.close());const app=await serve(await productBinding(process.env.VEXA_CANDIDATE,h.ports));t.after(()=>app.close());
 for(const kind of (process.env.F02_BYTES_HASH_ONLY?['hash','positive']:['hash','size','positive']))await t.test(kind,async()=>{
  const bytes=Buffer.from(randomUUID()+',SYNTHETIC\n');
  const r=await app.request(h.A,'/api/imports',{connection_id:h.A.connection,mapping_version:'csv-message-v1',content_type:'text/csv',size:bytes.length,sha256:hash(bytes)},{'Idempotency-Key':randomUUID()});assert.equal(r.status,201,'BYTES_RESERVATION');const v=r.data.data;
  if(kind==='size'){
   const before=snapshot(h,v.import_id);const bad=await fetch(new URL(v.upload_url,'http://127.0.0.1:56328'),{method:'PUT',headers:{'Content-Type':'text/csv',Connection:'close'},body:Buffer.from('x')});const result=await bad.json();assert.equal(bad.status,500,'PRODUCT_SIZE_REJECT');assert.match(result.message,/code: 23514/);assert.equal(h.sql(`SELECT count(*) FROM storage.objects WHERE name=${q(v.object_path)}`),'0','SIZE_NO_OBJECT');assert.deepEqual(snapshot(h,v.import_id),before,'SIZE_NO_JOB');
  }
  const uploaded=kind==='hash'?Buffer.from(bytes.toString().replace('SYNTHETIC','CORRUPTED')):bytes;
  assert.equal(uploaded.length,bytes.length,'HASH_FIXTURE_SIZE_CONSTANT');
  const u=await fetch(new URL(v.upload_url,'http://127.0.0.1:56328'),{method:'PUT',headers:{'Content-Type':'text/csv',Connection:'close'},body:uploaded});assert.equal(u.status,200);await u.arrayBuffer();
  const before=snapshot(h,v.import_id);const c=await app.request(h.A,'/api/imports/'+v.import_id+'/confirm',{upload_token:v.upload_token,sha256:hash(bytes),mapping_version:'csv-message-v1'});
  assert.equal(c.status,kind==='hash'?422:202,kind==='hash'?'PRODUCT_HASH_MISMATCH':kind==='size'?'PRODUCT_SIZE_MISMATCH':'PRODUCT_BYTES_POSITIVE');
  if(kind==='hash')assert.deepEqual(snapshot(h,v.import_id),before,'INVALID_BYTES_NO_JOB');else {assert.equal(snapshot(h,v.import_id).jobs.length,1);assert.equal(snapshot(h,v.import_id).outbox.length,1);}
 });
});
