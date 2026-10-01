// Focal real Auth/DB regression for F06-11 session retirement; does not certify the full gate.
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {pathToFileURL} from 'node:url';import {createRequire} from 'node:module';import {randomUUID} from 'node:crypto';
import {setup,q} from './harness.mjs';import {localProvider,syntheticSubscription} from './local-provider.mjs';
const candidate=process.env.VEXA_CANDIDATE;assert.ok(candidate,'VEXA_CANDIDATE_REQUIRED');
const evidence=fs.mkdtempSync(path.join(os.tmpdir(),'vexa-push305-logout-'));console.log('LOGOUT_RUNNING:'+evidence);let h,provider;
try{
 h=await setup(candidate,evidence);provider=await localProvider(evidence);const require=createRequire(path.join(h.tmp,'packages/notifications/package.json')),sdk=require('web-push');
 const vapid={...sdk.generateVAPIDKeys(),subject:'mailto:SYN305@example.test'};await h.stopWeb();await h.startWeb(false,{VEXA_PUSH_PUBLIC_KEY:vapid.publicKey,VEXA_PUSH_PRIVATE_KEY:vapid.privateKey,VEXA_PUSH_SUBJECT:vapid.subject});
 const subscription=syntheticSubscription('logout-probe').subscription;
 assert.equal((await h.request(h.A,'/api/notifications/push',{op:'register',consent:true,subscription})).status,200);
 for(const eventType of ['*','membership.welcome'])assert.equal((await h.request(h.A,'/api/notifications/preferences',{channel:'push',eventType,enabled:true,expectedVersion:0})).status,200);
 const outbox=h.outbox();await outbox.configure({channel:'push',enabled:true,expectedVersion:0,intervalMs:1000,digestWindowMs:0,maxAttempts:3,lifetimeMs:120000});
 const job=await outbox.enqueue({eventId:randomUUID(),type:'membership.welcome',resourceId:h.A.id,userId:h.A.id,channel:'push'});
 const {consumeNotification}=await import(pathToFileURL(path.join(h.built,'packages/notifications/worker.mjs'))),{createPushTransport}=await import(pathToFileURL(path.join(h.built,'packages/notifications/push.mjs')));
 await consumeNotification({repository:outbox,transports:{push:createPushTransport({database:h.database(),sdk,vapid,request:provider.request,timeoutMs:1000})},timeoutMs:5000});assert.equal((await outbox.get(job.id)).state,'accepted');
 assert.equal(h.sql('SELECT count(*) FROM push_attempts'),'1');
 const response=await fetch(h.base+'/auth/logout',{method:'POST',headers:{cookie:h.cookie(h.A),origin:h.base},redirect:'manual'});fs.writeFileSync(path.join(evidence,'SYN-logout.json'),JSON.stringify({status:response.status}));
 assert.equal(response.status,303,'AUTH_LOGOUT_MUST_SUCCEED_AFTER_PUSH_ATTEMPTS');assert.match(response.headers.get('clear-site-data'),/storage/);assert.equal(h.sql('SELECT count(*) FROM push_attempts'),'1','LOGOUT_PRESERVES_DURABLE_ATTEMPTS');assert.equal(h.sql(`SELECT count(*) FROM auth.sessions WHERE user_id=${q(h.A.id)}`),'0');assert.equal(h.sql("SELECT count(*) FROM push_subscriptions WHERE status='active'"),'0');
 const refresh=await h.auth('auth','/token?grant_type=refresh_token',null,{method:'POST',body:{refresh_token:h.A.refresh}});assert.equal(refresh.status,400);h.verifySources();console.log('PASS real Auth logout303, session removed, device revoked, durable attempt preserved, refresh rejected');
}finally{if(provider)await provider.close();if(h)await h.close();console.log('LOGOUT_EVIDENCE:'+evidence);}
