// Synthetic-only regression: the diagnostic must preserve per-channel missing bodies.
import test from 'node:test';
import assert from 'node:assert/strict';
import {runHubSpotSpike} from './spike-hubspot.mjs';
const context={tenant_id:'11111111-1111-4111-8111-111111111111',connection_id:'22222222-2222-4222-8222-222222222222',source:'hubspot',source_account_id:'SYNTHETIC'};
const threadIds=Array.from({length:20},(_,i)=>`T${i}`);
for(const missing of [true,false])test(`spike preserves note coverage with missing=${missing}`,async()=>{
 const seen=[];const receipt=await runHubSpotSpike({context,version:'v3',token:'SYNTHETIC-NOT-A-SECRET',threadIds,includeNotes:true,scopes:['conversations.read','tickets','crm.objects.contacts.read'],fetch:async raw=>{
  const p=new URL(raw).pathname;seen.push(p);let body;
  if(p.endsWith('/associations/notes'))body={results:[{toObjectId:'N'+p.split('/')[5]}]};
  else if(p.includes('/objects/notes/'))body={id:p.split('/').at(-1),properties:missing?{}:{hs_note_body:'<p>SYNTHETIC</p>'}};
  else if(p.endsWith('/messages')){const id=p.split('/')[5];body={results:[{id:'M'+id,conversationsThreadId:id,type:'MESSAGE',text:'SYNTHETIC',truncationStatus:'NOT_TRUNCATED',senders:[{actorId:'V-1'}]}]};}
  else {const id=p.split('/').at(-1);assert.ok(threadIds.includes(id));body={id,threadAssociations:{associatedTicketId:'K'+id}};}
  return new Response(JSON.stringify(body));
 }},{authorizationRef:'SYNTHETIC AUTHORIZATION',accountConfirmed:true,versionConfirmed:true});
 assert.equal(receipt.counts.threads,20);assert.equal(receipt.counts.messages,20);assert.equal(receipt.counts.notes,20);
 assert.equal(receipt.status,missing?'blocked_insufficient_coverage':'observed_needs_reconciliation');
 assert.equal(receipt.counts.bodies_missing,0);assert.equal(receipt.counts.notes_bodies_missing,missing?20:0);
 assert.equal(receipt.s01_accepted,false);assert.ok(!JSON.stringify(receipt).includes('SYNTHETIC-NOT-A-SECRET'));
});
