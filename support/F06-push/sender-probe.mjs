// Focused public-behavior oracle; same assertions run against original and temporary mutant.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {localProvider,syntheticSubscription} from './local-provider.mjs';
const [modulePath,dependencyRoot]=process.argv.slice(2);assert.ok(modulePath&&dependencyRoot,'PROBE_SOURCE_AND_DEPENDENCIES_REQUIRED');
const require=createRequire(path.join(dependencyRoot,'package.json')),sdk=require('web-push'),ece=require('http_ece');
const {createWebPushSender}=await import(pathToFileURL(path.resolve(modulePath)));
const evidence=fs.mkdtempSync(path.join(os.tmpdir(),'vexa-push305-sender-'));let provider;
try{
 provider=await localProvider(evidence);const vapid={...sdk.generateVAPIDKeys(),subject:'mailto:SYN305@example.test'},fixture=syntheticSubscription('probe');
 const deliveryScope={subscriptionId:'11111111-1111-4111-8111-111111111111',version:1};
 const sender=createWebPushSender({sdk,vapid,request:provider.request,timeoutMs:150});
 provider.setResponse(()=>({status:429,headers:{'retry-after':'3'}}));
 assert.deepEqual(await sender.send({deliveryScope,subscription:fixture.subscription,idempotencyKey:'f'.repeat(64)}),{kind:'retry',retryAfterMs:3000},'PUSH_429_MUST_REMAIN_RETRY');
 const decoded=ece.decrypt(provider.calls[0].body,{version:'aes128gcm',privateKey:fixture.privateKey,authSecret:Buffer.from(fixture.subscription.keys.auth,'base64url')});assert.equal(JSON.parse(decoded.toString()).href,'/notifications');
 provider.setResponse(()=>({status:410}));assert.deepEqual(await sender.send({deliveryScope,subscription:fixture.subscription,idempotencyKey:'f'.repeat(64)}),{kind:'permanent',revoke:true});
 provider.setResponse(()=>({hang:true}));assert.equal((await sender.send({deliveryScope,subscription:fixture.subscription,idempotencyKey:'f'.repeat(64)})).kind,'uncertain');
 for(let n=0;n<50&&provider.activeConnections();n++)await new Promise(resolve=>setTimeout(resolve,10));assert.equal(provider.activeConnections(),0,'TIMED_OUT_SOCKET_MUST_CLOSE');
 console.log('PASS SDK real + local TLS: 429 retry3000ms,410 revoke,timeout uncertain');
}finally{if(provider)await provider.close();console.log('SENDER_EVIDENCE:'+evidence);}
