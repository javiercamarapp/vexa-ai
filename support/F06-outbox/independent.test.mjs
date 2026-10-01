import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import os from 'node:os';
const candidate=process.env.VEXA_CANDIDATE;
const load=()=>import(pathToFileURL(path.join(candidate,'packages/notifications/delivery.mjs')).href);
test('F06-09 durable notification implementation is present',()=>{
 assert.ok(candidate,'VEXA_CANDIDATE required');
 for(const name of ['packages/notifications/outbox.mjs','packages/notifications/worker.mjs','packages/notifications/delivery.mjs','supabase/migrations/0029_notification_outbox.sql'])assert.ok(fs.existsSync(path.join(candidate,name)),'OUTBOX_IMPLEMENTATION_MISSING:'+name);
});
test('delivery policy is strict bounded and does not coerce privileges or clocks',async()=>{
 const {validatePolicy}=await load(),policy={channel:'email',enabled:true,expectedVersion:0,intervalMs:60000,digestWindowMs:0,maxAttempts:5,lifetimeMs:86400000};
 const copy=validatePolicy(policy);assert.deepEqual(copy,policy);assert.notEqual(copy,policy);
 for(const patch of [{tenantId:'foreign'},{userId:'recipient'},{endpoint:'https://example.test/send'},{channel:'sms'},{enabled:1},{enabled:'true'},{expectedVersion:-1},{expectedVersion:2147483647},{intervalMs:999},{intervalMs:86400001},{digestWindowMs:-1},{digestWindowMs:3600001},{maxAttempts:0},{maxAttempts:11},{lifetimeMs:999},{lifetimeMs:2592000001},{digestWindowMs:1000,lifetimeMs:1000}])assert.throws(()=>validatePolicy({...policy,...patch}),e=>e.status===400,'OUTBOX_POLICY_EXACT_BOUNDS');
 for(const k of Object.keys(policy)){const x={...policy};delete x[k];assert.throws(()=>validatePolicy(x),e=>e.status===400,'OUTBOX_POLICY_REQUIRED');}
 for(const k of ['expectedVersion','intervalMs','digestWindowMs','maxAttempts','lifetimeMs'])for(const x of [NaN,Infinity,1.5,'1',null])assert.throws(()=>validatePolicy({...policy,[k]:x}),e=>e.status===400,'OUTBOX_POLICY_NO_COERCION');
});
test('provider outcomes preserve uncertainty and never infer delivered or read',async()=>{
 const {normalizeOutcome:n}=await load();assert.deepEqual(n({kind:'accepted',providerId:'SYN_receipt-1',secret:'excluded'}),{kind:'accepted',providerId:'SYN_receipt-1'});
 for(const x of [null,undefined,{},()=>true,{kind:'delivered',providerId:'SYN'},{kind:'read',providerId:'SYN'},{kind:'accepted'},{kind:'accepted',providerId:''},{kind:'accepted',providerId:'x'.repeat(201)},{kind:'accepted',providerId:'<script>'},{kind:'uncertain'}])assert.equal(n(x).kind,'uncertain','OUTBOX_OUTCOME_UNKNOWN_IS_UNCERTAIN');
 assert.equal(n({kind:'retry',retryAfterMs:86400000}).retryAfterMs,86400000);
 for(const delay of [-1,86400001,NaN,Infinity,'1000',1.5])assert.equal(n({kind:'retry',retryAfterMs:delay}).kind,'permanent','OUTBOX_RETRY_BOUNDED');
 assert.equal(n({kind:'blocked'}).kind,'blocked');assert.equal(n({kind:'permanent'}).kind,'permanent');
});
test('transport timeout exceptions and abort are uncertainty with no implicit retry',async()=>{
 const {boundedSend}=await load();let observedSignal,calls=0;
 const timeout=await boundedSend(signal=>{calls++;observedSignal=signal;return new Promise(()=>{});},20);
 assert.equal(timeout.kind,'uncertain','OUTBOX_TIMEOUT_UNCERTAIN');assert.equal(observedSignal.aborted,true);assert.equal(calls,1);
 assert.equal((await boundedSend(()=>{throw Error('SYN secret');},20)).kind,'uncertain');
 assert.deepEqual(await boundedSend(async()=>({kind:'accepted',providerId:'SYN'}),100),{kind:'accepted',providerId:'SYN'});
 for(const ms of [0,-1,300001,NaN,Infinity,'100'])await assert.rejects(()=>boundedSend(()=>assert.fail('OUTBOX_INVALID_TIMEOUT_MUST_NOT_SEND'),ms),e=>e.status===400);
});
const expected={tenantId:'11111111-1111-4111-8111-111111111111',userId:'22222222-2222-4222-8222-222222222222',channel:'email'};
export function assertRecipientIdentity(m){assert.equal(m.recipientSnapshot({...expected,userId:'33333333-3333-4333-8333-333333333333',email:'syn@example.test',emailVerified:true},expected),null,'OUTBOX_RECIPIENT_USER_BOUND');}
test('recipient snapshots bind verified VEXA identity and cannot change after validation',async()=>{
 const m=await load(),input={...expected,email:'syn@example.test',emailVerified:true,nested:{endpoint:'https://example.test/SYN'}};const copy=m.recipientSnapshot(input,expected);assert.ok(copy);input.email='other@example.test';input.nested.endpoint='http://127.0.0.1/private';assert.equal(copy.email,'syn@example.test');assert.equal(copy.nested.endpoint,'https://example.test/SYN');assertRecipientIdentity(m);
 for(const patch of [{tenantId:expected.userId},{channel:'push'},{emailVerified:false},{email:'bad'},{email:'syn@example.test\r\nBcc: leak@example.test'},{email:'a'.repeat(255)+'@example.test'}])assert.equal(m.recipientSnapshot({...expected,email:'syn@example.test',emailVerified:true,...patch},expected),null,'OUTBOX_RECIPIENT_VALIDATED');
 const push={...expected,channel:'push'};assert.equal(m.recipientSnapshot({...push,consent:false},push),null);assert.ok(m.recipientSnapshot({...push,consent:true},push));assert.equal(m.recipientSnapshot({...expected,unsafe:()=>true},expected),null);
});
test('causal recipient isolation mutant is rejected then restored',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'vexa-outbox299-mutant-'));
 try{for(const name of ['delivery.mjs','contracts.mjs','catalog.mjs'])fs.copyFileSync(path.join(candidate,'packages/notifications',name),path.join(dir,name));const file=path.join(dir,'delivery.mjs'),original=fs.readFileSync(file,'utf8'),anchor='a.userId!==expected.userId||';assert.equal(original.split(anchor).length,2,'OUTBOX_MUTANT_ANCHOR');
 assertRecipientIdentity(await import(pathToFileURL(file).href+'?green'));fs.writeFileSync(file,original.replace(anchor,''));
 const mutant=await import(pathToFileURL(file).href+'?mutant');assert.throws(()=>assertRecipientIdentity(mutant),e=>e.code==='ERR_ASSERTION'&&e.message.includes('OUTBOX_RECIPIENT_USER_BOUND'));fs.writeFileSync(file,original);assertRecipientIdentity(await import(pathToFileURL(file).href+'?restored'));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
