// SYNTHETIC regression for review203; no provider network.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHubSpotAdapter} from './index.mjs';
const context={tenant_id:'11111111-1111-4111-8111-111111111111',connection_id:'22222222-2222-4222-8222-222222222222',source:'hubspot',source_account_id:'SYNTHETIC'};
const base='/conversations/v3/conversations/threads',config={context,token:'SYNTHETIC-SECRET',version:'v3',scopes:['conversations.read']};
const response=v=>new Response(JSON.stringify(v));
const message=(id,thread)=>({id,conversationsThreadId:thread,type:'MESSAGE',text:'SYNTHETIC',truncationStatus:'NOT_TRUNCATED',senders:[{actorId:'V-1'}]});
const collect=async(a,options)=>{const rows=[];for await(const p of a.pages(options))rows.push(p);return rows;};
test('allowlisted threads fetched directly; no other thread in same list page is read',async()=>{
 const seen=[],ids=['T1','T2'];const a=createHubSpotAdapter({...config,threadIds:ids,fetch:async raw=>{const u=new URL(raw);seen.push(u.pathname);if(u.pathname===base)return response({results:[{id:'T1'},{id:'OUTSIDE'},{id:'T2'}]});const thread=u.pathname.split('/')[5];return response(u.pathname.endsWith('/messages')?{results:[message('M'+thread,thread)]}:{id:thread});}});
 ids.push('MUTATED');const pages=await collect(a);assert.deepEqual(seen,[base+'/T1',base+'/T1/messages',base+'/T2',base+'/T2/messages']);assert.equal(pages.length,2);assert.equal(pages[0].checkpoint.cursor,'1');
 seen.length=0;await collect(a,{checkpoint:pages[0].checkpoint});assert.deepEqual(seen,[base+'/T2',base+'/T2/messages']);
 await assert.rejects(()=>collect(createHubSpotAdapter({...config,threadIds:['T2','T1'],fetch:async()=>assert.fail('cross scope fetch')}),{checkpoint:pages[0].checkpoint}),/CHECKPOINT_SCOPE/);
});
test('direct thread identity mismatch fails before requesting any body',async()=>{const seen=[];await assert.rejects(()=>collect(createHubSpotAdapter({...config,threadIds:['T1'],fetch:async raw=>{seen.push(new URL(raw).pathname);return response({id:'OUTSIDE'});}})),/THREAD_SCOPE_MISMATCH/);assert.deepEqual(seen,[base+'/T1']);});
test('empty or duplicate or unsafe allowlist rejected before fetch',()=>{for(const threadIds of [[],['T1','T1'],['../OUTSIDE'],[123]])assert.throws(()=>createHubSpotAdapter({...config,threadIds}),/INVALID_CONFIG|INVALID_REMOTE_ID/);});
test('missing note body cannot report notes complete or make complete messages incomplete',async()=>{
 const pages=await collect(createHubSpotAdapter({...config,includeNotes:true,scopes:[...config.scopes,'tickets','crm.objects.contacts.read'],fetch:async raw=>{const p=new URL(raw).pathname;return response(p.endsWith('/associations/notes')?{results:[{toObjectId:'N1'}]}:p.includes('/objects/notes/')?{id:'N1',properties:{}}:p.endsWith('/messages')?{results:[message('M1','T1')]}:{results:[{id:'T1',threadAssociations:{associatedTicketId:'ticket1'}}]});}}));
 const coverage=pages[0].coverage;assert.equal(coverage.notes_complete,false);assert.equal(coverage.notes_bodies_missing,1);assert.equal(coverage.bodies_missing,0);assert.equal(coverage.messages_complete,true);
});
