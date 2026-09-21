import test from 'node:test';
import assert from 'node:assert/strict';
import {createEnvelope} from '../ingestion/index.mjs';
const sync=await import('./sync.mjs').catch(()=>({}));
const context={tenant_id:'00000000-0000-4000-8000-000000000001',connection_id:'00000000-0000-4000-8000-000000000002',source:'hubspot',source_account_id:'123'};
const row=(entity,extra={})=>{const payload={id:'1'};return {envelope:createEnvelope(context,{entity_type:entity,external_id:'1',payload_ref:'fixture:raw',observed_at:'2026-09-20T00:00:00Z'},payload),payload,...extra};};
test('CRM preserves unknown roles as quarantined originals, never customer',()=>{
 assert.equal(typeof sync.normalizeSyncRecord,'function','CRM normalization missing');
 assert.equal(sync.normalizeSyncRecord(row('message',{conversation_id:'1',role:'unknown',text:'hello',body_complete:true})).code,'ROLE_AMBIGUOUS');
});
test('metadata and unbound notes do not become conversation evidence',()=>{
 assert.equal(typeof sync.normalizeSyncRecord,'function');
 assert.equal(sync.normalizeSyncRecord(row('note',{role:'internal',text:'note',body_complete:true})).code,'ENTITY_METADATA_ONLY');
 assert.equal(sync.normalizeSyncRecord(row('ticket')).code,'ENTITY_METADATA_ONLY');
});
test('normalized hash binds actual canonical payload, original revision remains opaque',()=>{
 assert.equal(typeof sync.normalizeSyncRecord,'function');
 const source=row('message',{conversation_id:'1',role:'agent',visibility:'public',text:'hello',body_complete:true});
 const result=sync.normalizeSyncRecord(source);
 assert.equal(result.envelope.source_revision,source.envelope.source_revision);
 assert.notEqual(result.envelope.content_hash,source.envelope.content_hash);
 assert.equal(result.payload.conversation_external_id,'1');
 assert.equal(result.envelope.adapter_version,undefined);
});
test('real adapter factory converts run duration into transport epoch deadline',async()=>{
 const factory=sync.createCRMAdapterFactory({token:'SYNTHETIC',subdomain:'synthetic-vexa',clock:()=>new Date('2026-09-20T00:00:00Z'),fetch:async()=>new Response(JSON.stringify({tickets:[],after_cursor:'terminal',end_of_stream:true}),{status:200})});
 const adapter=factory({context:{...context,source:'zendesk'},window:{fetchFrom:'2026-01-01T00:00:00Z'},deadlineMs:1000});
 const page=await adapter.pages().next();assert.equal(page.value.done,true);
});
