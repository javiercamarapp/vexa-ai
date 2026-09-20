import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeCSV,adaptCSVRaw,contentHash} from './index.mjs';
const context={tenant_id:'11111111-1111-4111-8111-111111111111',connection_id:'22222222-2222-4222-8222-222222222222',source:'csv',source_account_id:'SYNTHETIC'};
const csv='external_id,source_revision,occurred_at,text,role,conversation_id\nm1,1,2026-08-10T00:00:00Z,café,customer,c1\n';
const record=()=>normalizeCSV(csv,{context,observed_at:'2026-09-19T00:00:00Z',mappingVersion:'v1'}).records[0];
test('versioned CSV adapter preserves original hash and normalizes text/references independently',()=>{
 const r=record(),before=structuredClone(r.raw_payload);
 assert.deepEqual(adaptCSVRaw(r.envelope,r.raw_payload),r.message);
 assert.equal(r.envelope.content_hash,contentHash(before));
 assert.deepEqual(r.raw_payload,before);assert.notEqual(r.raw_payload.text,r.message.text);
 assert.notEqual(contentHash(r.message),r.envelope.content_hash);
});
test('raw mutation, normalized-as-raw and unsupported adapter versions fail closed',()=>{
 const r=record();
 for(const raw of [{...r.raw_payload,text:'altered'},r.message])assert.throws(()=>adaptCSVRaw(r.envelope,raw),{code:'CSV_RAW_HASH_MISMATCH'});
 assert.throws(()=>adaptCSVRaw({...r.envelope,adapter_version:'v2'},r.raw_payload),{code:'CSV_ADAPTER_VERSION'});
 for(const change of [{external_id:'other'},{source_revision:'2'},{occurred_at:'2026-08-11T00:00:00.000Z'}])assert.throws(()=>adaptCSVRaw({...r.envelope,...change},r.raw_payload),{code:'CSV_IDENTITY_MISMATCH'});
});
test('missing conversation and unknown role never manufacture canonical identities',()=>{
 const r=record();
 for(const [change,code] of [[{conversation_id:''},'CSV_CONVERSATION_REQUIRED'],[{role:'unknown'},'CSV_MESSAGE_INVALID']]){
  const raw={...r.raw_payload,...change};
  assert.throws(()=>adaptCSVRaw({...r.envelope,content_hash:contentHash(raw)},raw),{code});
 }
});
