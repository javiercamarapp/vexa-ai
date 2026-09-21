import test from 'node:test';
import assert from 'node:assert/strict';
import {createHubSpotAdapter} from './index.mjs';
const context={tenant_id:'11111111-1111-4111-8111-111111111111',connection_id:'22222222-2222-4222-8222-222222222222',source:'hubspot',source_account_id:'SYNTHETIC'};
const create=(threads,messages,maxRecords=2)=>createHubSpotAdapter({context,token:'SYNTHETIC-NOT-A-TOKEN',version:'v3',scopes:['conversations.read'],maxRecords,fetch:async url=>new Response(JSON.stringify({results:new URL(url).pathname.endsWith('/messages')?messages:threads}),{headers:{'content-type':'application/json'}})});
const thread={id:'synthetic-thread',createdAt:'2026-09-01T00:00:00Z'};
const collect=async adapter=>{const pages=[];for await(const page of adapter.pages())pages.push(page);return pages;};
test('record cap includes rejected messages before any page checkpoint',async()=>{
 let emitted=0;await assert.rejects(async()=>{for await(const page of create([thread],[null,null,null]).pages()){emitted++;void page;}},e=>e.code==='RECORD_LIMIT');assert.equal(emitted,0);
});
test('record cap includes malformed threads without issuing message requests',async()=>{
 await assert.rejects(()=>collect(create([null,null,null],[])),e=>e.code==='RECORD_LIMIT');
});
test('within cap retains accepted record and full rejected quarantine',async()=>{
 const pages=await collect(create([thread],[null]));assert.equal(pages.length,1);assert.equal(pages[0].records.length,1);assert.equal(pages[0].errors.length,1);assert.equal(pages[0].errors[0].payload,null);assert.equal(pages[0].coverage.objects_read,2);
});
