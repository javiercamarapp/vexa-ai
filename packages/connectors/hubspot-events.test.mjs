import test from 'node:test';
import assert from 'node:assert/strict';
import {createHubSpotAdapter} from './hubspot.mjs';
import {runHubSpotSpike} from './spike-hubspot.mjs';
import {contentHash} from '../ingestion/index.mjs';
import {normalizeSyncRecord} from './sync.mjs';

const context={tenant_id:'11111111-1111-4111-8111-111111111111',connection_id:'22222222-2222-4222-8222-222222222222',source:'hubspot',source_account_id:'SYNTHETIC'};
const config={context,version:'v3',token:'SYNTHETIC',scopes:['conversations.read']};
const date='2026-10-02T12:00:00Z';
const event=(id,type='ASSIGNMENT',extra={})=>({id,type,conversationsThreadId:'T1',createdAt:date,...extra});
const message=(extra={})=>event('M1','MESSAGE',{text:'SYNTHETIC message',senders:[{actorId:'V-1'}],truncationStatus:'NOT_TRUNCATED',...extra});
const collect=async adapter=>{const out=[];for await(const p of adapter.pages())out.push(p);return out;};
const fetchFor=(rows,requests=[])=>async(raw,opts)=>{
 assert.equal(opts.method,'GET');const u=new URL(raw);requests.push(u.pathname);
 assert.ok(!u.pathname.endsWith('/original-content'),'administrative event must not trigger body lookup');
 return new Response(JSON.stringify(u.pathname.endsWith('/messages')?{results:rows}:{results:[{id:'T1',createdAt:date}]}));
};

test('one human message and nine events have separate counts with original payloads retained',async()=>{
 const rows=[message(),...Array.from({length:6},(_,i)=>event('A'+i)),event('S1','THREAD_STATUS_CHANGE'),event('S2','THREAD_STATUS_CHANGE'),event('I1','THREAD_INBOX_CHANGE')];
 const [p]=await collect(createHubSpotAdapter({...config,fetch:fetchFor(rows)}));
 assert.equal(p.records.length,11);assert.equal(p.errors.length,0);
 assert.equal(p.coverage.messages_read,1);assert.equal(p.coverage.events_read,9);
 assert.equal(p.coverage.bodies_missing,0);assert.equal(p.coverage.messages_complete,true);
 for(const r of p.records.filter(r=>r.envelope.entity_type==='thread_event')){
  assert.deepEqual(r.payload,rows.find(x=>x.id===r.envelope.external_id));
  assert.equal(r.envelope.content_hash,contentHash(r.payload));
  assert.equal(r.conversation_id,'T1');assert.equal(r.text,null);assert.equal(r.role,'unknown');assert.equal(r.body_complete,false);
  assert.deepEqual(normalizeSyncRecord(r),{code:'ENTITY_METADATA_ONLY'});
 }
});

test('event text or truncation flags do not become customer content or trigger original-content request',async()=>{
 const requests=[];const [p]=await collect(createHubSpotAdapter({...config,fetch:fetchFor([event('E1','ASSIGNMENT',{text:'SYNTHETIC metadata',truncationStatus:'TRUNCATED',senders:[{actorId:'V-1'}]})],requests)}));
 assert.equal(requests.length,2);assert.equal(p.records[1].envelope.entity_type,'thread_event');
 assert.equal(p.records[1].text,null);assert.equal(p.records[1].payload.text,'SYNTHETIC metadata');
 assert.equal(p.coverage.messages_read,0);assert.equal(p.coverage.events_read,1);
});

test('unknown and missing types are quarantined even when they carry apparently complete text',async()=>{
 const rows=[message({id:'U1',type:'FUTURE_EVENT'}),message({id:'U2',type:undefined})];
 const [p]=await collect(createHubSpotAdapter({...config,fetch:fetchFor(rows)}));
 assert.equal(p.errors.length,2);assert.ok(p.errors.every(x=>x.code==='UNSUPPORTED_MESSAGE_TYPE'));
 assert.equal(p.records.length,1);assert.equal(p.coverage.messages_complete,false);assert.equal(p.coverage.events_read,0);
 assert.deepEqual(p.errors.map(x=>x.payload.id),['U1','U2']);
});

test('real missing body remains incomplete and internal comments remain messages',async()=>{
 const [p]=await collect(createHubSpotAdapter({...config,fetch:fetchFor([event('E1'),message({text:undefined}),message({id:'C1',type:'COMMENT'})])}));
 assert.equal(p.coverage.events_read,1);assert.equal(p.coverage.messages_read,2);assert.equal(p.coverage.bodies_missing,1);assert.equal(p.coverage.messages_complete,false);
 assert.equal(p.records.find(x=>x.envelope.external_id==='C1').role,'internal');
});

test('events retain thread binding and numeric identity checks',async()=>{
 const [p]=await collect(createHubSpotAdapter({...config,fetch:fetchFor([event('E1','ASSIGNMENT',{conversationsThreadId:'OTHER'}),event(9007199254740992)])}));
 assert.equal(p.errors.length,2);assert.equal(p.coverage.events_read,0);assert.equal(p.records.length,1);assert.equal(p.coverage.messages_complete,false);
});

test('events consume the record budget and cannot evade page limits',async()=>{
 await assert.rejects(()=>collect(createHubSpotAdapter({...config,maxRecords:2,fetch:fetchFor([event('E1'),event('E2')])})),/RECORD_LIMIT/);
});

test('old semantic checkpoint is rejected before network access',async()=>{
 const scope=contentHash({context,version:'vexa-hubspot-v2',archived:false,inbox:null,includeTickets:false,includeNotes:false,selected:null});
 let calls=0;const a=createHubSpotAdapter({...config,fetch:async()=>{calls++;throw Error('unexpected request');}});
 await assert.rejects(()=>a.pages({checkpoint:{version:1,scope,cursor:'2'}}).next(),/CHECKPOINT_SCOPE/);assert.equal(calls,0);
});

for(const withMessage of [true,false])test(`twenty-thread diagnostic keeps events separate; withMessage=${withMessage}`,async()=>{
 const threadIds=Array.from({length:20},(_,i)=>'T'+i);
 const receipt=await runHubSpotSpike({...config,threadIds,fetch:async raw=>{
  const p=new URL(raw).pathname;const thread=p.endsWith('/messages')?p.split('/').at(-2):p.split('/').at(-1);
  const rows=[event('E'+thread,'ASSIGNMENT',{conversationsThreadId:thread}),...(withMessage?[message({id:'M'+thread,conversationsThreadId:thread})]:[])];
  return new Response(JSON.stringify(p.endsWith('/messages')?{results:rows}:{id:thread,createdAt:date}));
 }},{authorizationRef:'SYNTHETIC',accountConfirmed:true,versionConfirmed:true});
 assert.equal(receipt.counts.events,20);assert.equal(receipt.counts.messages,withMessage?20:0);assert.equal(receipt.counts.bodies_missing,0);
 assert.equal(receipt.status,withMessage?'observed_needs_reconciliation':'blocked_insufficient_coverage');assert.equal(receipt.s01_accepted,false);
});
