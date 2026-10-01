import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
export const candidate=process.env.VEXA_CANDIDATE;
export function implementation(){
 assert.ok(candidate,'VEXA_CANDIDATE_REQUIRED');
 for(const file of ['packages/notifications/push.mjs','packages/notifications/push-config.mjs','supabase/migrations/0031_push_subscriptions.sql','apps/web/public/service-worker.js','apps/web/src/app/api/notifications/push/route.ts'])assert.ok(fs.existsSync(path.join(candidate,file)),'PUSH_IMPLEMENTATION_MISSING:'+file);
}
test('F06-11 push implementation exists before runtime setup',implementation);

import os from 'node:os';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {randomUUID,createHash} from 'node:crypto';
import {setup,q} from './harness.mjs';
import {syntheticSubscription,localProvider} from './local-provider.mjs';
import {browserOptIn} from './browser.mjs';
import {exerciseWorker} from './service-worker.mjs';
import {pushHttpContract} from './http-contract.mjs';
import {pushSenderSecurity} from './sender-security.mjs';
import {pushApiSecurity} from './api-security.mjs';
import {pushSqlSecurity} from './security-sql.mjs';
import {pushPreSend} from './pre-send.mjs';
import {pushLogoutSecurity} from './logout-security.mjs';
import {pushUiStates} from './ui-states424.mjs';
import {pushWorkerReady} from './ui-ready.mjs';
import {seedNotificationResource} from '../F06-notifications/fixtures.mjs';
const delay=ms=>new Promise(r=>setTimeout(r,ms));
test('F06-11 actual local API browser worker and durable multi-device delivery',{timeout:600000},async t=>{
 implementation();const evidence=fs.mkdtempSync(path.join(process.env.VEXA_FUNCTIONAL_EVIDENCE??os.tmpdir(),'vexa-push423-'));fs.chmodSync(evidence,0o700);console.log('F0611_RUNNING:'+evidence);let h,provider,ui;
 const step=async(name,fn)=>{let error;await t.test(name,async()=>{try{await fn();}catch(e){error=e;throw e;}});if(error)throw Error('PUSH_PREREQUISITE:'+name,{cause:error});};
 try{
  h=await setup(candidate,evidence);provider=await localProvider(evidence);
  const originalClose=h.close.bind(h);let providerClosing;const closeProvider=()=>providerClosing??=provider.close();h.close=async()=>{try{await closeProvider();}finally{await originalClose();}};
  await pushHttpContract(t,h,evidence);
  const load=file=>import(pathToFileURL(path.join(h.built,'packages/notifications',file)));
  const {createPushTransport,createWebPushSender,copyPushSubscription}=await load('push.mjs'),{consumeNotification}=await load('worker.mjs');
  const require=createRequire(path.join(h.tmp,'packages/notifications/package.json')),sdk=require('web-push'),ece=require('http_ece');
  const vapid={...sdk.generateVAPIDKeys(),subject:'mailto:SYN305@example.test'};
  const one=syntheticSubscription('one'),two=syntheticSubscription('two'),rotated=syntheticSubscription('rotation');
  const cfg={database:h.database(),sdk,vapid,request:provider.request,timeoutMs:1000};
  const outbox=h.outbox();let f,deviceOne,deviceTwo,cookieTwo;
  const fetchPush=async(actor,body,cookie='')=>{const response=await fetch(h.base+'/api/notifications/push',{method:body===undefined?'GET':'POST',headers:{...(actor?{cookie:h.cookie(actor)+(cookie?'; '+cookie:'')}:{}),origin:h.base,'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});return{status:response.status,data:await response.json(),cookies:response.headers.getSetCookie()};};
  const devices=actor=>fetchPush(actor);
  const send=()=>consumeNotification({repository:outbox,transports:{push:createPushTransport(cfg)},timeoutMs:5000});
  const enqueue=()=>outbox.enqueue({eventId:randomUUID(),type:'brief.available',resourceId:f.brief.id,userId:h.A.id,channel:'push'});
  const attempts=key=>h.json(`SELECT coalesce(jsonb_agg(jsonb_build_object('id',subscription_id,'state',state,'attempt',attempt,'next',next_attempt_at) ORDER BY subscription_id),'[]') FROM push_attempts WHERE idempotency_key=${q(key)}`);
  await step('missing configuration cannot register and visiting never opts in',async()=>{
   const current=await devices(h.A);assert.equal(current.status,200);assert.equal(current.data.data.configured,false);assert.deepEqual(current.data.data.devices,[]);
   assert.equal((await devices(null)).status,401);
   assert.equal((await fetchPush(h.A,{op:'register',consent:true,subscription:one.subscription})).status,503);
   assert.equal(h.sql('SELECT count(*) FROM push_subscriptions'),'0');assert.equal(provider.calls.length,0);
   await h.stopWeb();await h.startWeb(false,{VEXA_PUSH_PUBLIC_KEY:vapid.publicKey,VEXA_PUSH_PRIVATE_KEY:vapid.privateKey,VEXA_PUSH_SUBJECT:vapid.subject});
  });
  await step('explicit browser gesture registers real service worker and one durable device without claiming delivery',async()=>{
   ui=await browserOptIn(h,one.subscription,evidence);const result=await devices(h.A);assert.equal(result.status,200);assert.equal(result.data.data.configured,true);assert.equal(result.data.data.devices.length,1);deviceOne=result.data.data.devices[0];
   assert.equal((await devices(h.B)).data.data.devices.length,0);assert.equal(JSON.stringify(result.data).includes(one.subscription.endpoint),false);assert.equal(JSON.stringify(result.data).includes(one.subscription.keys.auth),false);
  });
  await step('exact service worker handlers reauthorize current device and ignore payload destinations',async()=>{
   const cookies=await ui.context.cookies();const cookie=cookies.map(c=>c.name+'='+c.value).join('; ');
   const result=await exerciseWorker(path.join(candidate,'apps/web/public/service-worker.js'),{base:h.base,cookie,expectedVisible:true});
   await exerciseWorker(path.join(candidate,'apps/web/public/service-worker.js'),{base:h.base,cookie:'',expectedVisible:false});
   fs.writeFileSync(path.join(evidence,'SYN-sw-handlers.json'),JSON.stringify({...result,scope:'exact handler bytes; real local authorization API; notification display observed, not provider delivery'}));
  });
  await step('explicit consent and current-device rotation persist through authenticated API',async()=>{
   assert.equal((await fetchPush(h.A,{op:'register',consent:false,subscription:two.subscription})).status,400);
   const invalid={...two.subscription,endpoint:'https://127.0.0.1/internal'};assert.equal((await fetchPush(h.A,{op:'register',consent:true,subscription:invalid})).status,400);
   const result=await fetchPush(h.A,{op:'register',consent:true,subscription:two.subscription});assert.equal(result.status,200);deviceTwo=result.data.data;cookieTwo=result.cookies.find(x=>x.startsWith('vexa_push_device=')).split(';')[0];
   const changed=await fetchPush(h.A,{op:'register',consent:true,subscription:rotated.subscription},cookieTwo);assert.equal(changed.status,200);assert.equal(changed.data.data.id,deviceTwo.id);assert.equal(changed.data.data.version,2);assert.equal(h.sql(`SELECT endpoint FROM push_subscriptions WHERE id=${q(deviceTwo.id)}`),rotated.subscription.endpoint);
   assert.equal((await devices(h.A)).data.data.devices.length,2);assert.equal(provider.calls.length,0);
  });
  await pushApiSecurity(t,h,{subscription:one.subscription,device:deviceOne});
  await step('SDK encrypted payload is minimal and partial429 retries only the pending device durably',async()=>{
   f=await seedNotificationResource(h);
   for(const eventType of ['*','brief.available'])assert.equal((await h.request(h.A,'/api/notifications/preferences',{channel:'push',eventType,enabled:true,expectedVersion:0})).status,200);
   await outbox.configure({channel:'push',enabled:true,expectedVersion:0,intervalMs:1000,digestWindowMs:0,maxAttempts:3,lifetimeMs:120000});
   let retrySeen=0;provider.setResponse(call=>call.path.endsWith('rotation')&&retrySeen++===0?{status:429,headers:{'retry-after':'1'}}:{status:201});
   const job=await enqueue();await send();const first=await outbox.get(job.id);assert.equal(first.state,'retry');assert.equal(provider.calls.length,2);
   const rows=attempts(first.idempotencyKey);assert.deepEqual(rows.map(x=>x.state).sort(),['accepted','retry']);assert.ok(Date.parse(rows.find(x=>x.state==='retry').next)>Date.now()-1000);
   for(const call of provider.calls){const target=call.path.endsWith('one')?one:rotated;assert.equal(call.headers['content-encoding'],'aes128gcm');assert.match(call.headers.authorization,/^vapid /i);assert.ok(call.body.length>100);const plaintext=ece.decrypt(call.body,{version:'aes128gcm',privateKey:target.privateKey,authSecret:Buffer.from(target.subscription.keys.auth,'base64url')}).toString();assert.deepEqual(JSON.parse(plaintext),{title:'VEXA',body:'Tienes avisos disponibles en VEXA.',href:'/notifications',subscriptionId:target===one?deviceOne.id:deviceTwo.id,version:target===one?1:2});}
   await send();assert.equal(provider.calls.length,2,'BACKOFF_MUST_NOT_SEND_EARLY');
   await delay(1200);await send();const final=await outbox.get(job.id);assert.equal(final.state,'accepted');assert.match(final.providerId,/^push_local_/);assert.equal(provider.calls.length,3);assert.equal(provider.calls.filter(x=>x.path.endsWith('one')).length,1);assert.deepEqual(attempts(final.idempotencyKey).map(x=>x.state),['accepted','accepted']);assert.equal(attempts(final.idempotencyKey).find(x=>x.id===deviceOne.id).attempt,1);assert.equal(attempts(final.idempotencyKey).find(x=>x.id===deviceTwo.id).attempt,2);
   assert.equal(h.sql("SELECT count(*) FROM push_attempts WHERE state='delivered'"),'0');fs.writeFileSync(path.join(evidence,'SYN-fanout.json'),JSON.stringify({job:final.id,states:attempts(final.idempotencyKey),receiver:'local Unix-socket TLS only',sdk:'web-push standard aes128gcm encryption verified by http_ece decrypt'}));
  });
  await step('410 revokes only its device while accepted on another remains accepted',async()=>{
   await delay(1100);provider.setResponse(call=>call.path.endsWith('rotation')?{status:410}:{status:201});const before=provider.calls.length,job=await enqueue();await send();assert.equal((await outbox.get(job.id)).state,'accepted');assert.equal(provider.calls.length-before,2);assert.equal(h.sql(`SELECT status FROM push_subscriptions WHERE id=${q(deviceTwo.id)}`),'revoked');assert.equal(h.sql(`SELECT status FROM push_subscriptions WHERE id=${q(deviceOne.id)}`),'active');
  });
  await step('timeout closes local network attempt, stays uncertain and never resends automatically',async()=>{
   await delay(1100);provider.setResponse(()=>({hang:true}));const before=provider.calls.length,job=await enqueue();await send();const row=await outbox.get(job.id);assert.equal(row.state,'uncertain');assert.equal(provider.calls.length,before+1);assert.equal(attempts(row.idempotencyKey)[0].state,'uncertain');await send();assert.equal(provider.calls.length,before+1);
  });
  await step('disabling event preference suppresses effects rather than pretending success',async()=>{
   assert.equal((await h.request(h.A,'/api/notifications/preferences',{channel:'push',eventType:'brief.available',enabled:false,expectedVersion:1})).status,200);await delay(1100);const before=provider.calls.length,job=await enqueue();await send();assert.equal((await outbox.get(job.id)).state,'suppressed');assert.equal(provider.calls.length,before);
  });
  await step('SDK destination copy and negative configuration contracts do not reach remote services',async()=>{
   provider.setResponse(()=>({status:201}));const sender=createWebPushSender({sdk,vapid,request:provider.request,timeoutMs:1000});const deliveryScope={subscriptionId:deviceOne.id,version:1};const input=structuredClone(one.subscription);const before=provider.calls.length,pending=sender.send({deliveryScope,subscription:input,idempotencyKey:'c'.repeat(64)});input.endpoint='https://127.0.0.1/changed';input.keys.auth='changed';assert.equal((await pending).kind,'accepted');assert.equal(provider.calls.length,before+1);assert.ok(provider.calls.at(-1).path.endsWith('one'));
   assert.throws(()=>copyPushSubscription({...one.subscription,endpoint:'http://localhost/private'}));assert.equal(createWebPushSender({sdk,vapid:null}).configured(),false);assert.equal(createWebPushSender({sdk:null,vapid}).configured(),false);const aborted=new AbortController();aborted.abort();assert.equal((await sender.send({deliveryScope,subscription:one.subscription,idempotencyKey:'c'.repeat(64),signal:aborted.signal})).kind,'blocked');assert.equal(provider.calls.length,before+1);
  });
  await pushSenderSecurity(t,{root:h.built,dependencyRoot:h.tmp,provider});
  await pushSqlSecurity(t,h);
  await pushPreSend(t,h,evidence);
  await pushLogoutSecurity(t,h);
  await t.test('push browser permission configuration and recoverable failures',async()=>{const target=path.join(evidence,'ui-states424');fs.mkdirSync(target);await pushUiStates({browser:await h.browser(),base:h.base,cookie:h.cookie(h.A),evidence:target});});
  await t.test('pending service worker readiness ends with recoverable state and no subscription',async()=>{const target=path.join(evidence,'ui-ready');fs.mkdirSync(target);await pushWorkerReady({browser:await h.browser(),base:h.base,cookie:h.cookie(h.A),evidence:target});});
  await step('UI revoke, organization scope change and global logout revoke their actual durable devices',async()=>{
   await ui.page.getByRole('button',{name:'Actualizar estado',exact:true}).click();const currentRow=ui.page.getByRole('listitem').filter({hasText:'(este navegador)'});await currentRow.getByRole('button',{name:'Desactivar',exact:true}).click();await ui.page.getByRole('status').filter({hasText:'Suscripción desactivada'}).waitFor();assert.equal(h.sql(`SELECT status FROM push_subscriptions WHERE id=${q(deviceOne.id)}`),'revoked');assert.equal((await ui.page.evaluate(()=>window.__pushCalls)).unsubscribe,1);
   await ui.page.getByRole('button',{name:'Activar avisos en este dispositivo',exact:true}).click();await ui.page.getByRole('status').filter({hasText:'Dispositivo registrado'}).waitFor();assert.equal(h.sql(`SELECT status FROM push_subscriptions WHERE id=${q(deviceOne.id)}`),'active');
   h.sql(`INSERT INTO memberships(tenant_id,user_id,role,status) VALUES(${q(h.B.tenant)},${q(h.A.id)},'viewer','active')`);
   const switched=await ui.page.evaluate(async tenant=>{const response=await fetch('/auth/organization',{method:'POST',body:new URLSearchParams({tenant_id:tenant})});return response.status;},h.B.tenant);assert.equal(switched,200);assert.equal(h.sql(`SELECT status FROM push_subscriptions WHERE id=${q(deviceOne.id)}`),'revoked');
   await exerciseWorker(path.join(candidate,'apps/web/public/service-worker.js'),{base:h.base,cookie:(await ui.context.cookies()).map(c=>c.name+'='+c.value).join('; '),expectedVisible:false});
   const logoutDevice=syntheticSubscription('logout');assert.equal((await fetchPush(h.A,{op:'register',consent:true,subscription:logoutDevice.subscription})).status,200);assert.equal(h.sql(`SELECT count(*) FROM push_subscriptions WHERE user_id=${q(h.A.id)} AND status='active'`),'1');
   const beforeAttempts=h.sql(`SELECT count(*) FROM push_attempts WHERE tenant_id=${q(h.A.tenant)}`);
   const result=await fetch(h.base+'/auth/logout',{method:'POST',headers:{cookie:h.cookie(h.A),origin:h.base},redirect:'manual'});fs.writeFileSync(path.join(evidence,'SYN-logout-result.json'),JSON.stringify({status:result.status,location:result.headers.get('location'),clearSiteData:result.headers.get('clear-site-data')}));assert.equal(result.status,303);assert.match(result.headers.get('clear-site-data'),/storage/);assert.equal(h.sql(`SELECT count(*) FROM push_subscriptions WHERE user_id=${q(h.A.id)} AND status='active'`),'0');assert.equal(h.sql(`SELECT count(*) FROM push_attempts WHERE tenant_id=${q(h.A.tenant)}`),beforeAttempts,'LOGOUT_PRESERVES_DURABLE_ATTEMPTS');
  });
  await step('logout still revokes Auth when membership no longer authorizes push cleanup',async()=>{
   h.sql(`UPDATE memberships SET status='revoked',permissions_version=permissions_version+1 WHERE tenant_id=${q(h.B.tenant)} AND user_id=${q(h.B.id)}`);
   const response=await fetch(h.base+'/auth/logout',{method:'POST',headers:{cookie:h.cookie(h.B),origin:h.base},redirect:'manual'});assert.equal(response.status,303);assert.match(response.headers.get('clear-site-data'),/storage/);
   const refresh=await h.auth('auth','/token?grant_type=refresh_token',null,{method:'POST',body:{refresh_token:h.B.refresh}});assert.equal(refresh.status,400);assert.equal(h.sql(`SELECT count(*) FROM auth.sessions WHERE user_id=${q(h.B.id)}`),'0');
  });
  h.verifySources();
  fs.writeFileSync(path.join(evidence,'SYN-network-summary.json'),JSON.stringify({calls:provider.calls.map(c=>({path:c.path,bytes:c.body.length,sha256:createHash('sha256').update(c.body).digest('hex')})),remotePushRequests:0}));
 }finally{if(ui){try{fs.writeFileSync(path.join(evidence,'last-dom.html'),await ui.page.content());}catch{}try{await ui.context.close();}finally{if(h)await h.close();else if(provider)await provider.close();}}else if(h)await h.close();else if(provider)await provider.close();console.log('F0611_EVIDENCE:'+evidence);}
});
