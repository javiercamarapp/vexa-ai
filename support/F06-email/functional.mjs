import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
test('F06-10 email implementation exists before runtime setup',()=>{
 const root=process.env.VEXA_CANDIDATE;
 assert.ok(root,'VEXA_CANDIDATE_REQUIRED');
 for(const file of ['packages/notifications/email.mjs','packages/notifications/receipts.mjs','supabase/migrations/0030_notification_email.sql','apps/web/src/app/api/webhooks/email/route.ts'])
  assert.ok(fs.existsSync(path.join(root,file)),'EMAIL_IMPLEMENTATION_MISSING:'+file);
});

import os from 'node:os';
import {pathToFileURL} from 'node:url';
const candidate=process.env.VEXA_CANDIDATE;
const product=async file=>import(pathToFileURL(path.join(candidate,'packages/notifications',file)));
test('F06-10 fixed transactional HTML and text explain CTA without tracking or invented metrics',async()=>{
 assert.ok(candidate&&fs.existsSync(path.join(candidate,'packages/notifications/email.mjs')),'EMAIL_IMPLEMENTATION_MISSING:packages/notifications/email.mjs');
 const {renderEmail}=await product('email-template.mjs');
 const base={type:'digest.available',appOrigin:'https://syn-vexa.example.test',ctaUrl:'https://syn-vexa.example.test/notifications'};
 const message=renderEmail(base);
 assert.ok(message.subject?.length>0);assert.ok(message.html?.length>200);assert.ok(message.text?.length>40);
 assert.match(message.html,/viewport/i);assert.match(message.html,/<table/i);
 assert.match(message.html,/https:\/\/syn-vexa\.example\.test\/notifications/);
 assert.match(message.text,/https:\/\/syn-vexa\.example\.test\/notifications/);
 assert.match(message.text,/preferenci|configur|recibes|recibiste/i);
 emailImages(message.html,{appOrigin:base.appOrigin,asset:(await import(pathToFileURL(path.join(candidate,'apps/web/src/lib/brand.mjs')))).brand()});
 for(const appOrigin of ['javascript:alert(1)','https://u:p@syn-vexa.example.test','https://syn-vexa.example.test/evil','https://syn-vexa.example.test\r\nBcc:evil@example.test'])assert.throws(()=>renderEmail({...base,appOrigin}));
 const escaped=renderEmail({...base,resourceLabel:'<b>SYN & fixture</b>'});assert.doesNotMatch(escaped.html,/<b>SYN/);assert.match(escaped.html,/&lt;b&gt;SYN &amp; fixture&lt;\/b&gt;/);assert.match(escaped.text,/<b>SYN & fixture<\/b>/);
});

import {randomUUID,createHmac} from 'node:crypto';
import {setup,mailpit,ownMailpit,q} from './harness.mjs';
import {emailSecuritySql} from './security-sql.mjs';
import {emailPureSuite} from './pure-suite.mjs';
import {emailPreSend} from './pre-send.mjs';
import {emailPresentation421} from './presentation421.mjs';
import {emailImages} from './brand-images421.mjs';
import {seedNotificationResource} from '../F06-notifications/fixtures.mjs';
test('F06-10 real local SMTP and durable provider receipt lifecycle',{timeout:600000},async t=>{
 assert.ok(candidate&&fs.existsSync(path.join(candidate,'packages/notifications/email.mjs')),'EMAIL_IMPLEMENTATION_MISSING:packages/notifications/email.mjs');
 const evidence=fs.mkdtempSync(path.join(process.env.VEXA_FUNCTIONAL_EVIDENCE??os.tmpdir(),'vexa-email421-'));console.log('F0610_RUNNING:'+evidence);let h,m;
 try{
  h=await setup(candidate,evidence);await emailPureSuite(t,h,evidence);m=ownMailpit(h,await mailpit(evidence));
  const load=file=>import(pathToFileURL(path.join(h.built,'packages/notifications',file)));
  const {createEmailTransport,createMailpitSender}=await load('email.mjs'),{createReceiptRepository,handleEmailWebhook}=await load('receipts.mjs'),{consumeNotification}=await load('worker.mjs');
  const smtp=createMailpitSender({port:60825});
  const receipts=createReceiptRepository({pool:h.emailPool}),outbox=h.outbox();
  const f=await seedNotificationResource(h);
  for(const eventType of ['*','brief.available']){const r=await h.request(h.A,'/api/notifications/preferences',{channel:'email',eventType,enabled:true,expectedVersion:0});assert.equal(r.status,200);}
  await outbox.configure({channel:'email',enabled:true,expectedVersion:0,intervalMs:1000,digestWindowMs:0,maxAttempts:2,lifetimeMs:60000});
  const enqueue=()=>outbox.enqueue({eventId:randomUUID(),type:'brief.available',resourceId:f.brief.id,userId:h.A.id,channel:'email'});
  const read=k=>h.json(`SELECT row_to_json(x) FROM notification_email_messages x WHERE idempotency_key=${q(k)}`);
  const config={mode:'mailpit',from:'SYN-vexa@example.test',replyTo:'SYN-support@example.test',appOrigin:'https://syn-vexa.example.test',repository:receipts,smtp};
  await t.test('provider errors stay retry blocked or uncertain without inventing acceptance',async()=>{
   const recipient=await receipts.resolveRecipient({tenantId:h.A.tenant,userId:h.A.id});let accepted=0;
   const repository={async prepare(){return recipient;},async accepted(){accepted++;}};
   for(const [result,kind] of [[{error:{statusCode:429}},'retry'],[{error:{statusCode:401}},'blocked'],[{error:{statusCode:503}},'uncertain'],[{data:{}},'uncertain']]){
    const transport=createEmailTransport({...config,repository,mode:'resend',apiKey:'re_SYN',resend:{emails:{async send(){return result;}}}});
    assert.equal((await transport.send({recipient,idempotencyKey:'a'.repeat(64)})).kind,kind);
   }
   const transport=createEmailTransport({...config,repository,mode:'resend',apiKey:'re_SYN',resend:{emails:{async send(){throw Error('SYN transport failure');}}}});
   assert.equal((await transport.send({recipient,idempotencyKey:'a'.repeat(64)})).kind,'uncertain');assert.equal(accepted,0);
   const controller=new AbortController();controller.abort();assert.equal((await transport.send({recipient,idempotencyKey:'a'.repeat(64),signal:controller.signal})).kind,'blocked');assert.equal(m.json('messages').total,0);
  });
  let job;
  await t.test('missing deployment configuration blocks without SMTP capture',async()=>{
   job=await enqueue();await consumeNotification({repository:outbox,transports:{email:createEmailTransport({...config,from:undefined})},timeoutMs:5000});
   assert.equal((await outbox.get(job.id)).state,'blocked');assert.equal(m.json('messages').total,0);
  });
  await t.test('outbox reaches accepted and Mailpit captures exact destination multipart content',async()=>{
   await new Promise(r=>setTimeout(r,1100));job=await enqueue();await consumeNotification({repository:outbox,transports:{email:createEmailTransport(config)},timeoutMs:5000});
   const row=await outbox.get(job.id);assert.equal(row.state,'accepted');assert.match(row.providerId,/^mailpit_/);
   const mapped=read(row.idempotencyKey);assert.equal(mapped.acceptance,'accepted');assert.equal(mapped.delivery,'unknown');assert.equal(mapped.tenant_id,h.A.tenant);
   const list=m.json('messages');assert.equal(list.total,1);const captured=m.json('message/'+list.messages[0].ID);
   assert.deepEqual(captured.To.map(x=>x.Address),[h.A.email]);assert.match(captured.HTML,/https:\/\/syn-vexa\.example\.test\/notifications/);assert.match(captured.Text,/https:\/\/syn-vexa\.example\.test\/notifications/);assert.match(captured.Text,/Recibes este aviso/);emailImages(captured.HTML,{appOrigin:config.appOrigin,asset:(await import(pathToFileURL(path.join(candidate,'apps/web/src/lib/brand.mjs')))).brand()});assert.deepEqual(captured.ReplyTo.map(x=>x.Address),['SYN-support@example.test']);
   fs.writeFileSync(path.join(evidence,'SYN-mailpit-message.json'),JSON.stringify(captured,null,2));fs.writeFileSync(path.join(evidence,'SYN-email.html'),captured.HTML);fs.writeFileSync(path.join(evidence,'SYN-email.txt'),captured.Text);
  });
  await t.test('policy revoked after beginSend blocks SQL preparation and creates no SMTP effect',async()=>{
   await new Promise(r=>setTimeout(r,1100));const pending=await enqueue(),claim=await outbox.claim();assert.equal(claim.id,pending.id);const recipient=await receipts.resolveRecipient({tenantId:h.A.tenant,userId:h.A.id});assert.ok(recipient);
   assert.equal((await outbox.beginSend(claim,true)).kind,'ready');const before=m.json('messages').total;
   await outbox.configure({channel:'email',enabled:false,expectedVersion:1,intervalMs:1000,digestWindowMs:0,maxAttempts:2,lifetimeMs:60000});
   try{const outcome=await createEmailTransport(config).send({recipient,idempotencyKey:claim.idempotencyKey});assert.equal(outcome.kind,'blocked');assert.equal(m.json('messages').total,before);assert.equal(h.sql(`SELECT count(*) FROM notification_email_messages WHERE idempotency_key=${q(claim.idempotencyKey)}`),'0');await outbox.commitChunk(claim,{records:[outcome],done:true});assert.equal((await outbox.get(claim.id)).state,'blocked');}
   finally{await outbox.configure({channel:'email',enabled:true,expectedVersion:2,intervalMs:1000,digestWindowMs:0,maxAttempts:2,lifetimeMs:60000});}
  });
  await t.test('Resend accepted is durable unknown until authenticated receipt and replay preserves count',async()=>{
   await new Promise(r=>setTimeout(r,1100));const next=await enqueue();const providerId='SYN_resend_'+randomUUID().replaceAll('-','');let calls=0;
   const transport=createEmailTransport({...config,mode:'resend',apiKey:'re_SYN',resend:{emails:{async send(){calls++;return{data:{id:providerId}};}}}});
   await consumeNotification({repository:outbox,transports:{email:transport},timeoutMs:5000});const row=await outbox.get(next.id);assert.equal(row.state,'accepted');assert.equal(calls,1);assert.equal(read(row.idempotencyKey).delivery,'unknown');
   assert.equal((await fetch(h.base+'/api/webhooks/email',{method:'POST'})).status,503);
   const secretBytes=Buffer.from('SYN303 webhook fixture only 32byte'),webhookSecret='whsec_'+secretBytes.toString('base64');
   await h.stopWeb();await h.startWeb(false,{VEXA_EMAIL_DATABASE_URL:h.emailUrl,RESEND_WEBHOOK_SECRET:webhookSecret});
   const webhook=async(type,pid=providerId,eventId='SYN_'+randomUUID().replaceAll('-',''),extra={})=>{
    const body=JSON.stringify({type,created_at:new Date().toISOString(),data:{email_id:pid,tenant_id:h.B.tenant},...extra}),timestamp=String(Math.floor(Date.now()/1000));
    const signature='v1,'+createHmac('sha256',secretBytes).update(`${eventId}.${timestamp}.${body}`).digest('base64');
    const invoke=()=>fetch(h.base+'/api/webhooks/email',{method:'POST',headers:{'content-type':'application/json','svix-id':eventId,'svix-timestamp':timestamp,'svix-signature':signature},body});
    return {invoke,eventId};
   };
   const delivered=await webhook('email.delivered');assert.equal((await delivered.invoke()).status,200);assert.equal(read(row.idempotencyKey).delivery,'delivered');assert.equal(read(row.idempotencyKey).tenant_id,h.A.tenant);
   assert.equal((await (await delivered.invoke()).json()).code,'email_webhook_replay');assert.equal(h.sql(`SELECT count(*) FROM notification_email_receipts WHERE event_id=${q(delivered.eventId)}`),'1');
   const sent=await webhook('email.sent');assert.equal((await sent.invoke()).status,200);assert.equal(read(row.idempotencyKey).delivery,'delivered');
   const orphan=await webhook('email.delivered','SYN_unknown_provider');assert.equal((await orphan.invoke()).status,200);assert.equal(h.sql(`SELECT count(*) FROM notification_email_receipts WHERE event_id=${q(orphan.eventId)} AND idempotency_key IS NULL`),'1');
   assert.equal(read(row.idempotencyKey).delivery,'delivered');
   const invalid=await handleEmailWebhook(new Request('http://localhost/api/webhooks/email',{method:'POST',headers:{'content-type':'application/json'},body:'{}'}),{webhookSecret,repository:receipts});assert.equal(invalid.status,400);
   await new Promise(r=>setTimeout(r,1100));const lateJob=await enqueue(),lateProvider='SYN_late_'+randomUUID().replaceAll('-','');let early;
   const lateTransport=createEmailTransport({...config,mode:'resend',apiKey:'re_SYN',resend:{emails:{async send(){early=await webhook('email.delivered',lateProvider);assert.equal((await early.invoke()).status,200);assert.equal(h.sql(`SELECT count(*) FROM notification_email_receipts WHERE event_id=${q(early.eventId)} AND idempotency_key IS NULL`),'1');return{data:{id:lateProvider}};}}}});
   await consumeNotification({repository:outbox,transports:{email:lateTransport},timeoutMs:5000});const late=await outbox.get(lateJob.id);assert.equal(late.state,'accepted');assert.equal(read(late.idempotencyKey).delivery,'delivered');assert.equal(h.sql(`SELECT count(*) FROM notification_email_receipts WHERE event_id=${q(early.eventId)} AND idempotency_key=${q(late.idempotencyKey)}`),'1');
   fs.writeFileSync(path.join(evidence,'SYN-delivery.json'),JSON.stringify({mapped:read(row.idempotencyKey),orphan:orphan.eventId,replay:delivered.eventId,provider:'SDK fixture; no Resend network'}));
  });
  await emailSecuritySql(t,h);
  await emailPreSend(t,h,evidence);
  await m.close();m=null;
  await t.test('actual SMTP captured HTML keeps VEXA appearance and accessibility in available declared browser engines',async()=>{
   await emailPresentation421({templatePath:path.join(h.built,'packages/notifications/email-template.mjs'),evidence,scope:h,capturedHtml:fs.readFileSync(path.join(evidence,'SYN-email.html'),'utf8')});h.verifySources();
  });
 }finally{if(m)await m.close();if(h)await h.close();console.log('F0610_EVIDENCE:'+evidence);}
});
