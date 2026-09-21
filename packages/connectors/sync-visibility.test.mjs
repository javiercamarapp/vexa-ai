import test from 'node:test';
import assert from 'node:assert/strict';
import {createEnvelope} from '../ingestion/index.mjs';
import {normalizeSyncRecord} from './sync.mjs';
import {createZendeskAdapter} from './zendesk.mjs';
const context={tenant_id:'00000000-0000-4000-8000-000000000001',connection_id:'00000000-0000-4000-8000-000000000002',source:'zendesk',source_account_id:'synthetic'};
function row(role,visibility){const payload={id:'M1',body:'SYNTHETIC body'};return{envelope:createEnvelope(context,{entity_type:'message',external_id:'M1',payload_ref:'synthetic:raw',observed_at:'2026-09-20T00:00:00Z'},payload),payload,role,visibility,body_complete:true,text:payload.body,conversation_id:'T1'};}
for(const[role,visibility]of [['customer','unknown'],['customer','internal'],['agent','unknown'],['internal','public']])test('quarantine inconsistent visibility '+role+'/'+visibility,()=>{assert.equal(normalizeSyncRecord(row(role,visibility)).code,'VISIBILITY_AMBIGUOUS');});
for(const[role,visibility]of [['customer','public'],['agent','public'],['internal','internal']])test('preserve confirmed visibility '+role+'/'+visibility,()=>{assert.equal(normalizeSyncRecord(row(role,visibility)).payload.role,role);});
test('actual Zendesk end-user without public field stays uncertain through normalization',async()=>{
 const adapter=createZendeskAdapter({context,token:'SYNTHETIC',subdomain:'synthetic',startTime:1700000000,clock:()=>new Date('2026-09-20T00:00:00Z'),fetch:async url=>{
  const p=new URL(url).pathname;
  const body=p.includes('/incremental/')?{tickets:[{id:1,created_at:'2026-01-01T00:00:00Z',updated_at:'2026-02-01T00:00:00Z'}],after_cursor:'SYN-end',end_of_stream:true}:p.includes('/comments')?{comments:[{id:2,author_id:3,body:'SYNTHETIC body',created_at:'2026-01-01T00:00:00Z'}],meta:{has_more:false}}:{user:{id:3,role:'end-user'}};
  return new Response(JSON.stringify(body),{status:200});
 }});
 const p=(await adapter.pages().next()).value,r=p.records.find(r=>r.envelope.entity_type==='message');
 assert.ok(r,'REAL_ADAPTER_MESSAGE');assert.equal(r.role,'customer');assert.equal(r.visibility,'unknown');assert.equal(normalizeSyncRecord(r).code,'VISIBILITY_AMBIGUOUS');
});
