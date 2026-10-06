import test from 'node:test';
import assert from 'node:assert/strict';
import {createHubSpotAdapter} from './hubspot.mjs';
const base='/conversations/v3/conversations/threads',alias='/conversations/conversations/v3/threads';
const date='2026-10-06T12:00:00.000Z',raw='U1lOLWN1cnNvcg%3D%3D',decoded='U1lOLWN1cnNvcg==';
const cfg={context:{tenant_id:'11111111-1111-4111-8111-111111111111',connection_id:'22222222-2222-4222-8222-222222222222',source:'hubspot',source_account_id:'SYNTHETIC'},token:'SYNTHETIC',version:'v3',scopes:['conversations.read'],clock:()=>new Date(date)};
const link='https://api.hubapi.com'+alias+'?limit=100&association=TICKET&after='+raw;
const reply=value=>new Response(JSON.stringify(value));
function adapter({nextLink=link,nextAfter=raw,loop=false,requests=[]}={}){
 return createHubSpotAdapter({...cfg,fetch:async input=>{const url=new URL(input);requests.push(url);
  assert.equal(url.origin,'https://api.hubapi.com');assert.ok(url.pathname===base||url.pathname===base+'/SYN-thread/messages');
  if(url.pathname.endsWith('/messages'))return reply({results:[]});
  if(url.searchParams.has('after'))return reply({results:[],...(loop?{paging:{next:{after:loop===true?decoded:loop,link:'https://api.hubapi.com'+alias+'?after='+encodeURIComponent(loop===true?decoded:loop)}}}:{})});
  return reply({results:[{id:'SYN-thread',createdAt:date}],paging:{next:{after:nextAfter,...(nextLink===null?{}:{link:nextLink})}}});
 }});
}
async function collect(a,checkpoint=null){const rows=[];for await(const page of a.pages({checkpoint}))rows.push(page);return rows;}
test('SYN observed thread alias and encoded padding paginate on original route without double encoding',async()=>{
 const requests=[],pages=await collect(adapter({requests}));assert.equal(pages.length,2);assert.equal(pages[0].checkpoint.version,1);assert.equal(pages[0].checkpoint.cursor,raw);assert.equal(pages[1].done,true);
 const next=requests.find(u=>u.searchParams.has('after'));assert.equal(next.pathname,base);assert.equal(next.searchParams.get('after'),decoded);assert.ok(next.href.includes('after='+raw));assert.ok(!next.href.includes('%253D'));assert.equal(next.searchParams.get('association'),'TICKET');assert.equal(next.searchParams.get('archived'),'false');
});
for(const value of [raw,decoded])test('checkpoint v1 resumes existing '+(value===raw?'encoded':'plain')+' cursor without changing scope or shape',async()=>{
 const original=adapter().pages(),first=await original.next();await original.return();const checkpoint={...first.value.checkpoint,cursor:value},requests=[];
 const pages=await collect(adapter({requests}),checkpoint);assert.equal(pages.length,1);assert.equal(pages[0].done,true);assert.equal(requests[0].searchParams.get('after'),decoded);assert.equal(checkpoint.version,1);assert.deepEqual(Object.keys(checkpoint).sort(),['cursor','scope','version']);
});
test('canonical original-path link still permits encoded provider cursor',async()=>{const requests=[];await collect(adapter({nextLink:link.replace(alias,base),requests}));assert.equal(requests.at(-1).searchParams.get('after'),decoded);});
test('cursor normalization is limited to one observed padding encoding, including lowercase hex',async()=>{const requests=[];await collect(adapter({nextAfter:raw.replaceAll('%3D','%3d'),nextLink:null,requests}));assert.equal(requests.at(-1).searchParams.get('after'),decoded);});
test('raw padding cursor with no next link also avoids double encoding',async()=>{const requests=[];await collect(adapter({nextLink:null,requests}));assert.equal(requests.at(-1).searchParams.get('after'),decoded);});
for(const [name,bad] of Object.entries({host:link.replace('api.hubapi.com','evil.invalid'),http:link.replace('https:','http:'),credentials:link.replace('https://','https://SYN:secret@'),fragment:link+'#fragment',differentCursor:link.replace(raw,'OTHER%3D%3D'),doubleEncodedCursor:link.replace(raw,raw.replaceAll('%','%25')),changedLimit:link.replace('limit=100','limit=50'),changedAssociation:link.replace('TICKET','CONTACT'),changedArchived:link+'&archived=true',duplicateAfter:link+'&after='+raw,duplicateLimit:link+'&limit=100',unknownQuery:link+'&account=foreign',messagesPath:link.replace('/threads?','/threads/SYN-thread/messages?'),trailingSlash:link.replace('/threads?','/threads/?'),encodedPath:link.replace('/threads?','/%74hreads?')}))test('manipulated thread link fails closed: '+name,async()=>{const requests=[];await assert.rejects(collect(adapter({nextLink:bad,requests})),/UNSAFE_NEXT/);assert.equal(requests.length,1);});
test('doubly encoded provider cursor cannot match by recursively decoding the link',async()=>{const double=raw.replaceAll('%','%25');await assert.rejects(collect(adapter({nextAfter:double,nextLink:link.replace(raw,double)})),/UNSAFE_NEXT/);});
test('reordered alias is not permitted for messages collection',async()=>{let calls=0;const a=createHubSpotAdapter({...cfg,fetch:async input=>{calls++;const u=new URL(input);return reply(u.pathname===base?{results:[{id:'SYN-thread',createdAt:date}]}:{results:[],paging:{next:{after:'SYN-next',link:'https://api.hubapi.com'+alias+'/SYN-thread/messages?limit=100&after=SYN-next'}}});}});await assert.rejects(collect(a),/UNSAFE_NEXT/);assert.equal(calls,2);});
test('loop detection equates encoded and plain padding before yielding the repeated page',async()=>{const iterator=adapter({loop:true}).pages();await iterator.next();await assert.rejects(iterator.next(),/CURSOR_LOOP/);});
test('resumed encoded checkpoint detects plain cursor loop before emitting a page',async()=>{const first=adapter().pages();const page=await first.next();await first.return();await assert.rejects(collect(adapter({loop:true}),page.value.checkpoint),/CURSOR_LOOP/);});
test('a distinct cursor remains distinct after normalization',async()=>{let n=0;const requests=[];const a=createHubSpotAdapter({...cfg,fetch:async input=>{const u=new URL(input);requests.push(u);n++;return reply(n<=2?{results:[],paging:{next:{after:n===1?raw:'U1lOLXR3bw%3D%3D'}}}:{results:[]});}});const p=await collect(a);assert.equal(p.length,3);assert.equal(requests[1].searchParams.get('after'),decoded);assert.equal(requests[2].searchParams.get('after'),'U1lOLXR3bw==');});

test('one encoded padding character is normalized without general percent decoding',async()=>{const requests=[];await collect(adapter({nextAfter:'U1lO%3d',nextLink:null,requests}));assert.equal(requests.at(-1).searchParams.get('after'),'U1lO=');const opaque=[];await collect(adapter({nextAfter:'SYN%2Fopaque',nextLink:null,requests:opaque}));assert.equal(opaque.at(-1).searchParams.get('after'),'SYN%2Fopaque');});
test('SYN 100-thread page exceeds a 15-second run at 200ms per sequential request before any checkpoint',async()=>{
 let elapsed=0,calls=0;const epoch=Date.parse(date);
 const a=createHubSpotAdapter({...cfg,clock:()=>new Date(epoch+elapsed),deadlineMs:epoch+15000,fetch:async input=>{calls++;elapsed+=200;const u=new URL(input);return reply(u.pathname===base?{results:Array.from({length:100},(_,i)=>({id:'SYN-'+i,createdAt:date})),paging:{next:{after:raw,link}}}:{results:[]});}});
 await assert.rejects(a.pages().next(),/DEADLINE_EXCEEDED/);assert.equal(calls,75);assert.equal(elapsed,15000);
});
