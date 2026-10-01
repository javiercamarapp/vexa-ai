import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {syntheticSubscription} from './local-provider.mjs';
export async function pushSenderSecurity(t,{root,dependencyRoot,provider}){
 const {createWebPushSender,copyPushSubscription,retryAfter}=await import(pathToFileURL(path.join(root,'packages/notifications/push.mjs')));
 const sdk=createRequire(path.join(dependencyRoot,'package.json'))('web-push');
 const vapid={...sdk.generateVAPIDKeys(),subject:'mailto:SYN423@example.test'},fixture=syntheticSubscription('security423');
 const deliveryScope={subscriptionId:'11111111-1111-4111-8111-111111111111',version:1};
 const sender=createWebPushSender({sdk,vapid,request:provider.request,timeoutMs:200});
 await t.test('push endpoint and key confusion is rejected before transport',async()=>{
  const before=provider.calls.length;
  for(const endpoint of ['http://fcm.googleapis.com/fcm/send/SYN','https://127.0.0.1/internal','https://[::1]/private','https://fcm.googleapis.com.evil.test/push','https://user@fcm.googleapis.com/push','https://fcm.googleapis.com:444/push','https://fcm.googleapis.com/push?token=secret','https://fcm.googleapis.com/push#fragment','https://fcm.googleapis.com\\@evil.test/push','https://fcm.googleapis.com/\ninternal','https://fcm.googleapis.com/']){
   const subscription={...fixture.subscription,endpoint};assert.throws(()=>copyPushSubscription(subscription));assert.equal((await sender.send({subscription,idempotencyKey:'1'.repeat(64)})).kind,'blocked');
  }
  for(const keys of [{...fixture.subscription.keys,p256dh:'A'.repeat(87)},{...fixture.subscription.keys,auth:fixture.subscription.keys.auth+'='},{...fixture.subscription.keys,auth:'short'}])assert.equal((await sender.send({deliveryScope,subscription:{...fixture.subscription,keys},idempotencyKey:'1'.repeat(64)})).kind,'blocked');
  assert.equal(provider.calls.length,before);
 });
 await t.test('provider redirects never trigger second request or imply success',async()=>{
  provider.setResponse(()=>({status:302,headers:{location:'https://127.0.0.1/private'}}));const before=provider.calls.length;
  assert.equal((await sender.send({deliveryScope,subscription:fixture.subscription,idempotencyKey:'2'.repeat(64)})).kind,'uncertain');assert.equal(provider.calls.length,before+1);
 });
 await t.test('provider unknown or server errors retain uncertainty without automatic retry',async()=>{
  for(const status of [408,409,500,503]){provider.setResponse(()=>({status}));const before=provider.calls.length;assert.equal((await sender.send({deliveryScope,subscription:fixture.subscription,idempotencyKey:'3'.repeat(64)})).kind,'uncertain');assert.equal(provider.calls.length,before+1);}
 });
 await t.test('provider authentication errors block and invalid retry-after cannot authorize a retry',async()=>{
  for(const status of [401,403]){provider.setResponse(()=>({status}));assert.equal((await sender.send({deliveryScope,subscription:fixture.subscription,idempotencyKey:'4'.repeat(64)})).kind,'blocked');}
  for(const value of ['invalid','86401','-1']){provider.setResponse(()=>({status:429,headers:{'retry-after':value}}));assert.equal((await sender.send({deliveryScope,subscription:fixture.subscription,idempotencyKey:'4'.repeat(64)})).kind,'permanent');}
  const now=Date.UTC(2026,9,1);assert.equal(retryAfter(new Date(now+3000).toUTCString(),now),3000);assert.equal(retryAfter(undefined,now),60000);
 });
 await t.test('midflight abort closes the real local TLS socket and remains uncertain',async()=>{
  provider.setResponse(()=>({hang:true}));const before=provider.calls.length,abort=new AbortController();const pending=sender.send({deliveryScope,subscription:fixture.subscription,idempotencyKey:'5'.repeat(64),signal:abort.signal});
  for(let i=0;i<50&&provider.calls.length===before;i++)await new Promise(r=>setTimeout(r,5));assert.equal(provider.calls.length,before+1);abort.abort();assert.equal((await pending).kind,'uncertain');
  for(let i=0;i<50&&provider.activeConnections();i++)await new Promise(r=>setTimeout(r,5));assert.equal(provider.activeConnections(),0);
 });
 await t.test('SDK destination substitution is blocked before native request',async()=>{
  let calls=0;const maliciousSdk={generateRequestDetails(...args){return {...sdk.generateRequestDetails(...args),endpoint:'https://127.0.0.1/private'};}};
  const isolated=createWebPushSender({sdk:maliciousSdk,vapid,request(){calls++;throw Error('UNREACHABLE');}});assert.equal((await isolated.send({deliveryScope,subscription:fixture.subscription,idempotencyKey:'6'.repeat(64)})).kind,'blocked');assert.equal(calls,0);
 });
 await t.test('missing or invalid delivery binding cannot send',async()=>{const before=provider.calls.length;for(const deliveryScope of [undefined,{subscriptionId:'bad',version:1},{subscriptionId:'11111111-1111-4111-8111-111111111111',version:0}])assert.equal((await sender.send({subscription:fixture.subscription,idempotencyKey:'7'.repeat(64),deliveryScope})).kind,'blocked');assert.equal(provider.calls.length,before);});
 provider.setResponse(()=>({status:201}));
}
