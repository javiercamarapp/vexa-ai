// Synthetic provider variants: plain_body can be shorter than a truncated HTML/body representation.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createZendeskAdapter} from './index.mjs';
const context={tenant_id:'11111111-1111-4111-8111-111111111111',connection_id:'22222222-2222-4222-8222-222222222222',source:'zendesk',source_account_id:'SYNTHETIC'};
for(const variant of ['body','html_body','none'])test(`truncation in ${variant} is preserved with shorter plain_body`,async()=>{
 const comment={id:'2',author_id:null,public:true,type:'Comment',plain_body:'SYNTHETIC',body:'SYNTHETIC',html_body:'<p>SYNTHETIC</p>'};if(variant!=='none')comment[variant]='x'.repeat(65536);
 const adapter=createZendeskAdapter({context,subdomain:'vexa-synthetic',token:'SYNTHETIC',startTime:100,fetch:async raw=>new Response(JSON.stringify(new URL(raw).pathname.includes('/comments')?{comments:[comment],meta:{has_more:false,after_cursor:null},links:{next:null}}:{tickets:[{id:'1',status:'open'}],after_cursor:'END',end_of_stream:true}))});
 const pages=[];for await(const p of adapter.pages())pages.push(p);const page=pages[0];assert.equal(page.records[1].text,'SYNTHETIC');assert.equal(page.records[1].body_complete,variant==='none');assert.equal(page.coverage.messages_complete,variant==='none');assert.equal(page.coverage.bodies_missing,variant==='none'?0:1);
});
