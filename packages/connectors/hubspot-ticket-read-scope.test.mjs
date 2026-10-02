// Synthetic regression: provider-verified modern read scope must work without write access.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHubSpotAdapter} from './index.mjs';
const context={tenant_id:'11111111-1111-4111-8111-111111111111',connection_id:'22222222-2222-4222-8222-222222222222',source:'hubspot',source_account_id:'SYNTHETIC'};
const base={context,token:'SYNTHETIC',version:'v3',includeTickets:true};
test('modern and legacy ticket scopes read metadata and notes through GET',async()=>{
 for(const scope of ['crm.objects.tickets.read','tickets']){
  const paths=[];
  const adapter=createHubSpotAdapter({...base,includeNotes:true,scopes:['conversations.read',scope,'crm.objects.contacts.read'],fetch:async(raw,options)=>{
   assert.equal(options.method,'GET');const p=new URL(raw).pathname;paths.push(p);
   const body=p.endsWith('/associations/notes')?{results:[{toObjectId:'N1'}]}:p.includes('/objects/notes/')?{id:'N1',properties:{hs_note_body:'SYNTHETIC note'}}:p.includes('/objects/tickets/')?{id:'T1',properties:{subject:'SYNTHETIC ticket'}}:p.endsWith('/messages')?{results:[]}:{results:[{id:'H1',threadAssociations:{associatedTicketId:'T1'}}]};
   return new Response(JSON.stringify(body));
  }});
  const records=[];for await(const page of adapter.pages())records.push(...page.records);
  assert.equal(records.filter(r=>r.envelope.entity_type==='ticket').length,1);
  assert.equal(records.find(r=>r.envelope.entity_type==='note').role,'internal');
  assert.ok(paths.includes('/crm/v3/objects/tickets/T1'));
 }
});
test('write-only, unrelated and absent scopes cannot enable ticket reads',()=>{
 for(const scope of [undefined,'crm.objects.tickets.write','crm.objects.contacts.read','tickets.read']){
  assert.throws(()=>createHubSpotAdapter({...base,scopes:['conversations.read',...[scope].filter(Boolean)],fetch:()=>assert.fail('must not fetch')}),/SCOPE_REQUIRED/);
 }
});
test('modern ticket scope does not substitute conversation or note permissions',()=>{
 assert.throws(()=>createHubSpotAdapter({...base,scopes:['crm.objects.tickets.read']}),/SCOPE_REQUIRED/);
 assert.throws(()=>createHubSpotAdapter({...base,includeNotes:true,scopes:['conversations.read','crm.objects.tickets.read']}),/SCOPE_REQUIRED/);
});
