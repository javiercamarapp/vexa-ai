import test from 'node:test';import assert from 'node:assert/strict';import {createHmac,createHash} from 'node:crypto';import {pathToFileURL} from 'node:url';import path from 'node:path';
const {handleEmailWebhook}=await import(pathToFileURL(path.join(process.env.VEXA_CANDIDATE,'packages/notifications/receipts.mjs')));
const secret=Buffer.from('SYN420 own independent rawbody fixture secret'),webhookSecret='whsec_'+secret.toString('base64');
const signed=(body,{id='SYN420_raw',timestamp=String(Math.floor(Date.now()/1000))}={})=>({'content-type':'application/json','svix-id':id,'svix-timestamp':timestamp,'svix-signature':'v1,'+createHmac('sha256',secret).update(`${id}.${timestamp}.${body}`).digest('base64')});
const raw=' { "type": "email.delivered", "created_at": "2026-01-01T00:00:00Z", "data": {"email_id":"SYN420_provider","tenant_id":"forged","label":"ñ"} }\n';
test('signature authenticates exact UTF8 bytes across multibyte stream boundaries and omits payload tenant',async()=>{
 const bytes=Buffer.from(raw),at=bytes.indexOf(Buffer.from('ñ'))+1,calls=[];
 const body=new ReadableStream({start(c){c.enqueue(bytes.subarray(0,at));c.enqueue(bytes.subarray(at));c.close();}});
 const r=await handleEmailWebhook(new Request('http://127.0.0.1/api/webhooks/email',{method:'POST',headers:signed(raw),body,duplex:'half'}),{webhookSecret,repository:{record:async row=>{calls.push(row);return{replay:false};}}});
 assert.equal(r.status,200);assert.equal(calls.length,1);assert.equal(calls[0].payloadHash,createHash('sha256').update(bytes).digest('hex'));assert.equal(calls[0].providerId,'SYN420_provider');assert.equal('tenant_id' in calls[0]||'tenantId' in calls[0],false);
});
test('semantically equal JSON with different original bytes cannot reuse signature',async()=>{let effects=0;const r=await handleEmailWebhook(new Request('http://127.0.0.1/api/webhooks/email',{method:'POST',headers:signed(raw),body:JSON.stringify(JSON.parse(raw))}),{webhookSecret,repository:{record:async()=>{effects++;}}});assert.equal(r.status,400);assert.equal(effects,0);});
test('SDK supports rotating signature list while wrong secret cannot authenticate',async()=>{
 const headers=signed(raw);headers['svix-signature']='v1,INVALID '+headers['svix-signature'];let calls=0;const repository={record:async()=>{calls++;return{replay:true};}};
 const invoke=key=>handleEmailWebhook(new Request('http://127.0.0.1/api/webhooks/email',{method:'POST',headers,body:raw}),{webhookSecret:key,repository});assert.equal((await invoke(webhookSecret)).status,200);assert.equal((await invoke('whsec_'+Buffer.from('SYN420 wrong secret').toString('base64'))).status,400);assert.equal(calls,1);
});
test('repository rejection remains retryable unavailable with no exception disclosure',async()=>{const r=await handleEmailWebhook(new Request('http://127.0.0.1/api/webhooks/email',{method:'POST',headers:signed(raw),body:raw}),{webhookSecret,repository:{record:async()=>{throw Error('SYN_PRIVATE_CONNECTION_STRING');}}});assert.equal(r.status,503);assert.equal(r.headers.get('cache-control'),'no-store');const text=await r.text();assert.match(text,/email_webhook_unavailable/);assert.doesNotMatch(text,/SYN_PRIVATE/);});

for(const kind of [null,'Permanent','Transient','Undetermined'])test('authenticated bounce subtype retained exactly: '+kind,async()=>{
 const payload={type:'email.bounced',created_at:'2026-01-01T00:00:00Z',data:{email_id:'SYN420_bounce',...(kind===null?{}:{bounce:{type:kind}})}};const body=JSON.stringify(payload);let observed;
 const r=await handleEmailWebhook(new Request('http://127.0.0.1/api/webhooks/email',{method:'POST',headers:signed(body),body}),{webhookSecret,repository:{record:async row=>{observed=row;return{replay:false};}}});assert.equal(r.status,200);assert.equal(observed.bounceKind,kind);assert.equal(observed.payloadHash,createHash('sha256').update(body).digest('hex'));
});
test('unrecognized signed bounce kind rejects and delivery cannot inject permanent suppression',async()=>{
 let calls=0,last;const repository={record:async row=>{calls++;last=row;return{replay:false};}};
 const send=async(type,kind)=>{const body=JSON.stringify({type,created_at:'2026-01-01T00:00:00Z',data:{email_id:'SYN420_bounce',bounce:{type:kind}}});return handleEmailWebhook(new Request('http://127.0.0.1/api/webhooks/email',{method:'POST',headers:signed(body),body}),{webhookSecret,repository});};
 assert.equal((await send('email.bounced','arbitrary')).status,400);assert.equal(calls,0);assert.equal((await send('email.delivered','Permanent')).status,200);assert.equal(calls,1);assert.equal(last.bounceKind,null);
});
