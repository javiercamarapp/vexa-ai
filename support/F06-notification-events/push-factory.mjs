import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {createRequire} from 'node:module';
import {localProvider,syntheticSubscription} from './local-provider.mjs';import {preferences,policy,createReader,q} from './fixtures.mjs';
/** Business emitter, standard factory and runtime are real; the HTTPS socket alone is local SYN. */
export async function businessPushFactory(h,evidence){
 const folder=path.join(evidence,'push-factory');fs.mkdirSync(folder);const provider=await localProvider(folder);const originalClose=h.close.bind(h);let closing;const close=()=>closing??=provider.close();h.close=async()=>{try{await close();}finally{await originalClose();}};
 try{
  const require=createRequire(path.join(h.tmp,'package.json')),sdk=require('web-push'),ece=require('http_ece');const vapid={...sdk.generateVAPIDKeys(),subject:'mailto:SYN426@example.test'};
  const fixture=syntheticSubscription('business428'),journal=path.join(folder,'https-socket.jsonl');fs.writeFileSync(journal,'',{mode:0o600});
  await h.stopWeb();await h.startWeb(false,{VEXA_PUSH_PUBLIC_KEY:vapid.publicKey,VEXA_PUSH_PRIVATE_KEY:vapid.privateKey,VEXA_PUSH_SUBJECT:vapid.subject,NODE_OPTIONS:h.webAuditOptions+' --import='+new URL('./push-local-preload.mjs',import.meta.url).href,VEXA_RECOMMENDATION_AUDIT:h.webAuditJournal,SYN_PUSH_SOCKET:provider.socketPath,SYN_PUSH_PATH:new URL(fixture.subscription.endpoint).pathname,SYN_PUSH_JOURNAL:journal});
  const actor=await createReader({...h,A:h.B});await preferences(h,actor,'membership.welcome',true,'push');await policy(h,h.B,'push');
  const response=await h.request(actor,'/api/notifications/push',{op:'register',consent:true,subscription:fixture.subscription});assert.equal(response.status,200,JSON.stringify(response.data));const device=response.data.data;
  h.sql(`UPDATE memberships SET status='revoked',permissions_version=permissions_version+1 WHERE tenant_id=${q(actor.tenant)} AND user_id=${q(actor.id)};UPDATE memberships SET status='active',permissions_version=permissions_version+1 WHERE tenant_id=${q(actor.tenant)} AND user_id=${q(actor.id)}`);
  const row=h.json(`SELECT jsonb_build_object('id',id,'key',idempotency_key) FROM notification_outbox WHERE tenant_id=${q(actor.tenant)} AND user_id=${q(actor.id)} AND channel='push'`);assert.ok(row?.id);
  for(let i=0;i<12&&h.sql(`SELECT state FROM notification_outbox WHERE id=${q(row.id)}`)!=='accepted';i++){
   const response=await fetch(h.base+'/api/internal/notifications',{method:'POST',headers:{authorization:'Bearer '+h.triggerSecret},body:'{}',signal:AbortSignal.timeout(50000)});const data=await response.json();assert.equal(response.status,200,JSON.stringify(data));assert.ok(['IDLE','CYCLE_COMPLETED'].includes(data.code));await new Promise(r=>setTimeout(r,1100));
  }
  assert.equal(h.sql(`SELECT state FROM notification_outbox WHERE id=${q(row.id)}`),'accepted');assert.equal(provider.calls.length,1);const plaintext=ece.decrypt(provider.calls[0].body,{version:'aes128gcm',privateKey:fixture.privateKey,authSecret:Buffer.from(fixture.subscription.keys.auth,'base64url')});assert.deepEqual(JSON.parse(plaintext.toString()),{title:'VEXA',body:'Tienes avisos disponibles en VEXA.',href:'/notifications',subscriptionId:device.id,version:device.version});
  assert.equal(h.sql(`SELECT count(*) FROM push_attempts WHERE idempotency_key=${q(row.key)} AND state='accepted'`),'1');assert.equal(h.sql(`SELECT count(*) FROM push_attempts WHERE tenant_id=${q(h.A.tenant)}`),'0');
  fs.writeFileSync(path.join(folder,'result.json'),JSON.stringify({factory:'Next HTTP route to built-in factory; no custom transport module; no substituted runtime',emitter:'real membership transition',receiver:'local Unix TLS, synthetic subscription',sdk:'web-push standard encryption decrypted by http_ece',acceptance:'accepted',delivery:'not proven'},null,2));
 }finally{await close();}
}
