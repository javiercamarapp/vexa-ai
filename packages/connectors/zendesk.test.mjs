import test from 'node:test';
import assert from 'node:assert/strict';
import * as connectors from './index.mjs';
const date='2026-09-20T12:00:00Z';
const context={tenant_id:'11111111-1111-4111-8111-111111111111',connection_id:'22222222-2222-4222-8222-222222222222',source:'zendesk',source_account_id:'SYNTHETIC'};
const config={context,token:'SYNTHETIC-SECRET',subdomain:'vexa-synthetic',startTime:100,clock:()=>new Date(date)};
const json=(body,status=200,headers={})=>new Response(JSON.stringify(body),{status,headers});
const ticket=(extra={})=>({id:'1',created_at:date,updated_at:date,status:'open',description:'NOT A CONVERSATION',...extra});
const comment=(extra={})=>({id:'2',author_id:'8',created_at:date,public:true,plain_body:'SYNTHETIC body',type:'Comment',...extra});
const exportPage=(tickets,next='END',done=true)=>({tickets,after_cursor:next,end_of_stream:done});
const comments=rows=>({comments:rows,meta:{has_more:false,after_cursor:null},links:{next:null}});
const collect=async(a,options)=>{const rows=[];for await(const p of a.pages(options))rows.push(p);return rows;};
function adapter(extra={}){assert.equal(typeof connectors.createZendeskAdapter,'function','Zendesk adapter missing');return connectors.createZendeskAdapter({...config,...extra});}
test('tickets metadata, nested comments, explicit author roles, internal and final cursor',async()=>{
 const calls=[];const pages=await collect(adapter({fetch:async raw=>{const u=new URL(raw);calls.push(u);if(u.pathname.includes('/users/'))return json({user:{id:'8',role:'end-user'}});if(u.pathname.includes('/comments'))return json(u.searchParams.has('page[after]')?comments([comment({id:'3',public:false})]):{comments:[comment()],meta:{has_more:true,after_cursor:'M2'},links:{next:'https://vexa-synthetic.zendesk.com/api/v2/tickets/1/comments.json?page%5Bsize%5D=100&page%5Bafter%5D=M2'}});return json(exportPage([ticket()]));}}));
 assert.equal(pages[0].records[0].text,null);assert.deepEqual(pages[0].records.slice(1).map(x=>[x.role,x.visibility]),[['customer','public'],['internal','internal']]);assert.equal(pages[0].records[1].conversation_id,'1');assert.equal(pages[0].checkpoint.cursor,'END');assert.equal(pages[0].done,true);assert.equal(pages[0].coverage.messages_complete,true);assert.equal(calls.length,4);
});
test('revisions differ on edit and deletion is explicit without fetching deleted comments',async()=>{
 const read=async t=>(await collect(adapter({fetch:async raw=>json(new URL(raw).pathname.includes('comments')?comments([]):exportPage([t]))})))[0].records[0];const a=await read(ticket()),b=await read(ticket({updated_at:'2026-09-20T12:01:00Z'})),d=await read(ticket({status:'deleted'}));assert.notEqual(a.envelope.source_revision,b.envelope.source_revision);assert.equal(d.deleted,true);assert.equal(d.envelope.deleted_at,null);assert.equal(d.tombstone,true);
});
test('external next link aborts without second request; 404 never becomes delete',async()=>{let calls=0;await assert.rejects(()=>collect(adapter({fetch:async()=>{calls++;return json({...exportPage([],'x',false),after_url:'https://evil.example/api/v2/incremental/tickets/cursor.json?cursor=x'});}})),/UNSAFE_NEXT/);assert.equal(calls,1);await assert.rejects(()=>collect(adapter({fetch:async()=>json({},404)})),e=>e.code==='HTTP_ERROR'&&e.status===404);});
test('maxRecords includes malformed comments and tickets, aborting checkpoint',async()=>{await assert.rejects(()=>collect(adapter({maxRecords:2,fetch:async raw=>json(new URL(raw).pathname.includes('comments')?comments([null,null]):exportPage([ticket()]))})),/RECORD_LIMIT/);await assert.rejects(()=>collect(adapter({maxRecords:2,fetch:async()=>json(exportPage([null,null,null]))})),/RECORD_LIMIT/);});
test('checkpoint bound to tenant/account/subdomain/start time; unsafe subdomain rejected',async()=>{const p=(await collect(adapter({fetch:async()=>json(exportPage([]))})))[0];for(const extra of [{startTime:99},{subdomain:'other'},{context:{...context,source_account_id:'OTHER'}}])await assert.rejects(()=>collect(adapter({...extra,fetch:async()=>assert.fail('request outside checkpoint scope')}),{checkpoint:p.checkpoint}),/CHECKPOINT_SCOPE/);assert.throws(()=>adapter({subdomain:'evil.example/path'}),/INVALID_CONFIG/);});
test('unknown public authors are not requester inferred; body absence and size coverage',async()=>{const p=(await collect(adapter({fetch:async raw=>json(new URL(raw).pathname.includes('comments')?comments([comment({author_id:null}),comment({id:'3',author_id:null,plain_body:null,body:undefined}),comment({id:'4',author_id:null,plain_body:'x'.repeat(65536)})]):exportPage([ticket({requester_id:'8'})]))})))[0];assert.ok(p.records.slice(1).every(x=>x.role==='unknown'));assert.equal(p.coverage.bodies_missing,2);assert.equal(p.coverage.messages_complete,false);});
test('64KB truncation coverage uses provider bytes before Unicode normalization',async()=>{
 const raw='e\u0301'.repeat(21846);assert.ok(Buffer.byteLength(raw)>=65536);assert.ok(Buffer.byteLength(raw.normalize('NFC'))<65536);
 const p=(await collect(adapter({fetch:async request=>json(new URL(request).pathname.includes('comments')?comments([comment({author_id:null,plain_body:raw})]):exportPage([ticket()]))})))[0];
 assert.equal(p.records[1].body_complete,false);assert.equal(p.coverage.messages_complete,false);
});
