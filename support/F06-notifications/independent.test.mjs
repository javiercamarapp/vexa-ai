import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const candidate=process.env.VEXA_CANDIDATE;
test('F06-08 notification implementation exists independently of control',()=>{
 assert.ok(candidate,'VEXA_CANDIDATE required');
 for(const f of ['packages/notifications/index.mjs','supabase/migrations/0028_notification_center.sql'])assert.ok(fs.existsSync(path.join(candidate,f)),'NOTIFICATION_IMPLEMENTATION_MISSING:'+f);
});
const load=async name=>import(new URL('file://'+path.join(candidate,'packages/notifications',name)));
const role={tenantId:'11111111-1111-4111-8111-111111111111',userId:'22222222-2222-4222-8222-222222222222',role:'viewer',permissionsVersion:3};
const selection={status:'all',limit:30},after={createdAt:'2026-09-23T14:15:16.123456Z',id:'33333333-3333-4333-8333-333333333333'};
const rejected=(fn,status)=>assert.throws(fn,e=>e.status===status);
test('catalogue communicates six disconnected VEXA-only events and no external delivery',async()=>{
 const {catalog,channels,resourceHref}=await load('catalog.mjs');assert.deepEqual(catalog.map(x=>x.type).sort(),['brief.available','connection.attention','intervention.assigned','membership.invited','membership.welcome','processing.failed']);assert.equal(new Set(catalog.map(x=>x.type)).size,6);assert.ok(Object.isFrozen(catalog)&&catalog.every(Object.isFrozen));assert.ok(catalog.every(x=>x.connected===false));assert.deepEqual(channels.map(x=>x.id).sort(),['email','inapp','push']);assert.ok(channels.every(x=>x.deliveryAvailable===false&&x.reason.length>0));assert.ok(Object.isFrozen(channels)&&channels.every(Object.isFrozen));assert.equal(resourceHref('membership.invited',after.id),null);assert.equal(resourceHref('crm.customer',after.id),null);for(const event of catalog.filter(x=>!['membership.invited','intervention.assigned'].includes(x.type))){const href=resourceHref(event.type,after.id);assert.ok(href.startsWith('/')&&!href.startsWith('//'),'NOTIFICATION_INTERNAL_RESOURCE_LINK');}
});
test('inbox query rejects arbitrary selectors and duplicate malformed filters',async()=>{
 const {parseInboxQuery}=await load('contracts.mjs');assert.deepEqual(parseInboxQuery(new URLSearchParams()),{limit:30,status:'all',cursor:null});assert.equal(parseInboxQuery(new URLSearchParams('limit=100&status=unread')).limit,100);
 for(const query of ['tenant_id=x','user_id=x','resource=x','status=all&status=unread','limit=0','limit=101','limit=01','limit=1.5','limit=-1','limit=1e2','limit=Infinity','status=read','cursor='])rejected(()=>parseInboxQuery(new URLSearchParams(query)),400);
});
test('preference payload is exact allowlist boolean CAS and owns no caller identity',async()=>{
 const {validatePreference}=await load('contracts.mjs');const p={channel:'inapp',eventType:'brief.available',enabled:true,expectedVersion:0};assert.deepEqual(validatePreference(p),p);assert.notEqual(validatePreference(p),p);
 for(const patch of [{tenantId:role.tenantId},{userId:role.userId},{email:'syn@example.test'},{html:'<script>'},{channel:'sms'},{eventType:'crm.customer'},{enabled:1},{enabled:'true'},{expectedVersion:-1},{expectedVersion:1.5},{expectedVersion:2147483647},{expectedVersion:Number.MAX_SAFE_INTEGER}])rejected(()=>validatePreference({...p,...patch}),400);
 for(const key of Object.keys(p)){const x={...p};delete x[key];rejected(()=>validatePreference(x),400);}for(const channel of ['inapp','email','push'])assert.equal(validatePreference({...p,channel,eventType:'*'}).channel,channel);
});
export function assertCursorUserBinding(c){const a=c.cursorBinding(role,selection),b=c.cursorBinding({...role,userId:'44444444-4444-4444-8444-444444444444'},selection);assert.notEqual(a,b,'NOTIFICATION_CURSOR_USER_BOUND');}
test('cursor preserves microsecond timestamp and binds tenant user role permission status page size',async()=>{
 const c=await load('contracts.mjs'),binding=c.cursorBinding(role,selection),cursor=c.encodeCursor(after,binding);assert.deepEqual(c.decodeCursor(cursor,binding),after);assert.equal(c.decodeCursor(null,binding),null);assertCursorUserBinding(c);
 for(const patch of [{tenantId:after.id},{userId:after.id},{role:'owner'},{permissionsVersion:4}])rejected(()=>c.decodeCursor(cursor,c.cursorBinding({...role,...patch},selection)),409);for(const patch of [{status:'unread'},{limit:31}])rejected(()=>c.decodeCursor(cursor,c.cursorBinding(role,{...selection,...patch})),409);
 for(const value of ['', 'bad===',Buffer.from(JSON.stringify({v:1,binding,after,tenantId:role.tenantId})).toString('base64url'),c.encodeCursor({...after,id:'not-a-uuid'},binding),c.encodeCursor({...after,createdAt:'2026-02-30T14:15:16.123456Z'},binding),c.encodeCursor({...after,createdAt:'2026-09-23T25:15:16.123456Z'},binding)])rejected(()=>c.decodeCursor(value,binding),409);
});
test('missing preferences are explicit false and database failures remain failures',async()=>{
 const {createNotificationRepository}=await load('index.mjs');const calls=[];const repository=createNotificationRepository({database:{async transaction(action,fn){calls.push(action);return fn({...role,async query(){return {rows:[],rowCount:0};}});}}});const view=await repository.preferences();assert.equal(view.preferences.length,21);assert.ok(view.preferences.every(x=>x.enabled===false&&x.version===0));assert.deepEqual(calls,['read']);const fail=createNotificationRepository({database:{async transaction(){throw Object.assign(Error('SYN db unavailable'),{status:503});}}});await assert.rejects(()=>fail.preferences(),e=>e.status===503);await assert.rejects(()=>fail.inbox({query:new URLSearchParams()}),e=>e.status===503);
});
test('causal cursor isolation mutant is rejected and restored',async()=>{
 const {mkdtempSync,copyFileSync,readFileSync,writeFileSync,rmSync}=fs;const {tmpdir}=await import('node:os');const tmp=mkdtempSync(path.join(tmpdir(),'vexa-notification295-mutant-'));try{for(const f of ['catalog.mjs','contracts.mjs'])copyFileSync(path.join(candidate,'packages/notifications',f),path.join(tmp,f));const original=readFileSync(path.join(tmp,'contracts.mjs'),'utf8');assert.equal(original.split('scope.tenantId,scope.userId,scope.role').length,2,'NOTIFICATION_MUTANT_ANCHOR');const baseline=await import(new URL('file://'+path.join(tmp,'contracts.mjs')+'?baseline'));assertCursorUserBinding(baseline);writeFileSync(path.join(tmp,'contracts.mjs'),original.replace('scope.tenantId,scope.userId,scope.role','scope.tenantId,scope.role'));const mutant=await import(new URL('file://'+path.join(tmp,'contracts.mjs')+'?mutant'));assert.throws(()=>assertCursorUserBinding(mutant),e=>e.code==='ERR_ASSERTION'&&e.message.includes('NOTIFICATION_CURSOR_USER_BOUND'));writeFileSync(path.join(tmp,'contracts.mjs'),original);assertCursorUserBinding(await import(new URL('file://'+path.join(tmp,'contracts.mjs')+'?restored')));}finally{rmSync(tmp,{recursive:true,force:true});}
});
