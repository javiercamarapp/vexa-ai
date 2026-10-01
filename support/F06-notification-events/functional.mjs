import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const candidate=process.env.VEXA_CANDIDATE;
export function inputs(){
 assert.ok(candidate,'VEXA_CANDIDATE_REQUIRED');
 for(const file of ['supabase/migrations/0032_notification_business_events.sql','packages/notifications/policies.mjs','apps/web/src/app/api/notifications/delivery/route.ts','packages/notifications/hosted.mjs','apps/web/src/app/api/internal/notifications/route.ts'])assert.ok(fs.existsSync(path.join(candidate,file)),'BUSINESS_NOTIFICATION_IMPLEMENTATION_MISSING:'+file);
}
test('F06-12 business notification implementation exists before infrastructure setup',inputs);

import os from 'node:os';
import {randomUUID} from 'node:crypto';
import {mailpit,ownMailpit} from './mailpit.mjs';
import {setup,cli,q} from './harness.mjs';
import {seedNotificationResource,createReader,preferences,policy} from './fixtures.mjs';
import {planFor,reason} from '../F06-interventions/fixtures.mjs';
import {eventPureSuite,eventBodySuite} from './pure-suite.mjs';
import {policyUiStates} from './ui-policies.mjs';
import {businessSecurity} from './security.mjs';
import {businessHostedHttp} from './hosted-http.mjs';
import {businessPushFactory} from './push-factory.mjs';
import {windowSpec} from '../../tests/acceptance/support/F03-sync/fixtures.mjs';
test('F06-12 real business transitions own notifications policies and default consumer',{timeout:600000},async t=>{
 inputs();const evidence=fs.mkdtempSync(path.join(process.env.VEXA_FUNCTIONAL_EVIDENCE??os.tmpdir(),'vexa-events426-'));console.log('F0612_RUNNING:'+evidence);let h,context,mail;
 const step=async(name,fn)=>{let failure;await t.test(name,async()=>{try{await fn();}catch(error){failure=error;throw error;}});if(failure)throw Error('BUSINESS_NOTIFICATION_PREREQUISITE:'+name,{cause:failure});};
 try{
  h=await setup(candidate,evidence);await eventPureSuite(t,h,evidence);await eventBodySuite(t,h,evidence);let a,b,viewer,notice;const cliReceipts=[];
  const total=()=>h.json("SELECT jsonb_build_object('business',(SELECT count(*) FROM notification_business_events),'events',(SELECT count(*) FROM notification_events),'items',(SELECT count(*) FROM notification_outbox_items),'outbox',(SELECT count(*) FROM notification_outbox),'inbox',(SELECT count(*) FROM notification_inbox))");
  const matching=(tenant,type,resource)=>Number(h.sql(`SELECT count(*) FROM notification_events WHERE tenant_id=${q(tenant)} AND type=${q(type)} AND resource_id=${q(resource)}`));
  const inbox=async actor=>{const r=await h.request(actor,'/api/notifications?limit=100&status=all');assert.equal(r.status,200,JSON.stringify(r.data));return r.data.data.items;};
  const consume=async()=>{for(let n=0;n<12;n++){const remaining=Number(h.sql("SELECT count(*) FROM notification_outbox WHERE state IN('queued','retry')"));if(!remaining)return;cliReceipts.push(await cli(h));await new Promise(r=>setTimeout(r,1100));}assert.equal(h.sql("SELECT count(*) FROM notification_outbox WHERE state IN('queued','retry')"),'0','DEFAULT_CLI_MADE_PROGRESS');};
  await step('owner policies and personal opt-in are separate persisted prerequisites',async()=>{
   viewer=await createReader(h);assert.equal((await h.request(viewer,'/api/notifications/delivery')).status,403);
   for(const actor of [h.A,h.B]){await policy(h,actor);await preferences(h,actor);}
   const prefs=await h.request(h.A,'/api/notifications/preferences');assert.equal(prefs.status,200);const data=prefs.data.data;
   assert.deepEqual(data.catalog.filter(x=>x.connected).map(x=>x.type).sort(),['membership.welcome','brief.available','intervention.assigned','connection.attention','processing.failed'].sort());assert.equal(data.catalog.find(x=>x.type==='membership.invited').connected,false);
   assert.equal(data.channels.find(x=>x.id==='inapp').deliveryAvailable,true);assert.ok(data.channels.filter(x=>x.id!=='inapp').every(x=>x.deliveryAvailable===false));
   assert.deepEqual(total(),{business:0,events:0,items:0,outbox:0,inbox:0});
  });
  await step('actual brief API transactions emit one scoped event per organization and replay does not duplicate',async()=>{
   a=await seedNotificationResource(h);b=await seedNotificationResource({...h,A:h.B,B:h.A});
   assert.equal(matching(h.A.tenant,'brief.available',a.brief.id),1);assert.equal(matching(h.B.tenant,'brief.available',b.brief.id),1);assert.deepEqual(total(),{business:2,events:2,items:2,outbox:2,inbox:0});
   const before=total(),body={operation:'generate',query:a.query.toString(),comparisonQuery:null,expectedPreviousId:null,requestKey:randomUUID()};
   const pair=await Promise.all([h.request(h.A,'/api/briefs',body),h.request(h.A,'/api/briefs',body)]);for(const r of pair){assert.equal(r.status,200,JSON.stringify(r.data));assert.equal(r.data.data.id,a.brief.id);}assert.deepEqual(total(),before);
   assert.equal(h.sql(`SELECT count(*) FROM notification_outbox WHERE user_id=${q(viewer.id)}`),'0');assert.equal(h.sql(`SELECT count(*) FROM notification_outbox WHERE user_id=${q(a.a.customers.C1)}`),'0');
  });
  await step('real default CLI without custom transport processes inapp for A and B and preserves other jobs',async()=>{
   const otherJobs=h.json("SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'state',state,'type',type) ORDER BY id),'[]'::jsonb) FROM jobs WHERE type<>'notification'");
   await consume();const own=await inbox(h.A),other=await inbox(h.B);assert.equal(own.length,1);assert.equal(other.length,1);notice=own[0];assert.equal(notice.resourceId,a.brief.id);assert.equal(other[0].resourceId,b.brief.id);assert.equal(notice.href,'/briefs/'+a.brief.id);
   assert.equal((await h.request(h.A,notice.href.replace('/briefs/','/api/briefs/'))).status,200);assert.equal((await h.request(h.B,notice.href.replace('/briefs/','/api/briefs/'))).status,404);
   assert.deepEqual(h.json("SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'state',state,'type',type) ORDER BY id),'[]'::jsonb) FROM jobs WHERE type<>'notification'"),otherJobs);
   assert.equal(h.sql("SELECT count(*) FROM notification_events WHERE type='processing.failed'"),'0','NOTIFICATION_JOB_DOES_NOT_RECURSE');
  });
  await step('membership business mutation rolls back source event outbox and jobs together',async()=>{
   await preferences(h,viewer,'membership.welcome');h.sql(`UPDATE memberships SET status='revoked',permissions_version=permissions_version+1 WHERE tenant_id=${q(viewer.tenant)} AND user_id=${q(viewer.id)}`);
   const before=total();const during=h.sql(`BEGIN;UPDATE memberships SET status='active',permissions_version=permissions_version+1 WHERE tenant_id=${q(viewer.tenant)} AND user_id=${q(viewer.id)};SELECT count(*) FROM notification_events WHERE type='membership.welcome' AND resource_id=${q(viewer.id)};ROLLBACK;`);assert.match(during,/1/);assert.deepEqual(total(),before);assert.equal(h.sql(`SELECT status FROM memberships WHERE tenant_id=${q(viewer.tenant)} AND user_id=${q(viewer.id)}`),'revoked');
   h.sql(`UPDATE memberships SET status='active',permissions_version=permissions_version+1 WHERE tenant_id=${q(viewer.tenant)} AND user_id=${q(viewer.id)}`);assert.equal(matching(viewer.tenant,'membership.welcome',viewer.id),1);
   h.sql(`UPDATE memberships SET status=status WHERE tenant_id=${q(viewer.tenant)} AND user_id=${q(viewer.id)}`);assert.equal(matching(viewer.tenant,'membership.welcome',viewer.id),1);
   await consume();assert.equal((await inbox(viewer)).filter(x=>x.type==='membership.welcome').length,1);
  });
  await step('personal opt-out suppresses a new business transition without suppressing the source mutation',async()=>{
   await preferences(h,viewer,'membership.welcome',false);const before=total();h.sql(`UPDATE memberships SET status='revoked',permissions_version=permissions_version+1 WHERE tenant_id=${q(viewer.tenant)} AND user_id=${q(viewer.id)};UPDATE memberships SET status='active',permissions_version=permissions_version+1 WHERE tenant_id=${q(viewer.tenant)} AND user_id=${q(viewer.id)}`);assert.deepEqual(total(),before);assert.equal(h.sql(`SELECT status FROM memberships WHERE tenant_id=${q(viewer.tenant)} AND user_id=${q(viewer.id)}`),'active');
  });
  await step('real failed connection sync emits a single notification for its recorded attempt',async()=>{
   await preferences(h,h.A,'connection.attention');const repository=h.repository(h.A).repository;
   await h.sync.runSync({repository,connectionId:h.A.connection,mode:'live',window:{...windowSpec,version:'SYN306-failed-sync'},workerId:randomUUID(),deadlineMs:30000,maxPages:1,adapterFactory:async()=>({async *pages(){throw Object.assign(Error('SYN local timeout'),{name:'TimeoutError',code:'TIMEOUT'});}})}).catch(()=>{});
   assert.equal(matching(h.A.tenant,'connection.attention',h.A.connection),1);await consume();const own=await inbox(h.A);assert.ok(own.some(x=>x.type==='connection.attention'&&x.href==='/connections'));
  });
  await step('actual recommendation and assignment APIs emit for the assigned VEXA member only',async()=>{
   await preferences(h,h.A,'intervention.assigned');
   const recommendation=await h.request(h.A,'/api/recommendations',{operation:'generate',query:a.query.toString(),problemId:a.p1.id,requestKey:randomUUID()});assert.equal(recommendation.status,200,JSON.stringify(recommendation.data));
   const rec=recommendation.data.data,body={expectedVersion:rec.version,requestKey:randomUUID()};const draft=await h.request(h.A,'/api/recommendations/'+rec.id+'/interventions',body);assert.equal(draft.status,200,JSON.stringify(draft.data));
   const assigned=await h.request(h.A,'/api/interventions/'+draft.data.data.id,{operation:'plan',expectedVersion:draft.data.data.version,requestKey:randomUUID(),reason,plan:planFor(a,h.A.id)});assert.equal(assigned.status,200,JSON.stringify(assigned.data));
   assert.equal(matching(h.A.tenant,'intervention.assigned',draft.data.data.id),1);
   assert.equal((await h.request(h.A,'/api/recommendations/'+rec.id+'/interventions',body)).status,200);assert.equal(matching(h.A.tenant,'intervention.assigned',draft.data.data.id),1);
   await consume();const item=(await inbox(h.A)).find(x=>x.resourceId===draft.data.data.id);assert.ok(item?.href.startsWith('/interventions?'));assert.ok(item.href.endsWith('#intervention-'+draft.data.data.id));
  });
  await step('committed synthetic failed import fact emits once and notification job types do not recurse',async()=>{
   await preferences(h,h.A,'processing.failed');const importId=h.sql(`SELECT id FROM imports WHERE tenant_id=${q(h.A.tenant)} ORDER BY id LIMIT 1`),id=randomUUID();
   h.sql(`INSERT INTO jobs(id,tenant_id,type,state,input_ref,input_hash,version,import_id) VALUES(${q(id)},${q(h.A.tenant)},'import','failed','SYN306 failed import fact',${q(randomUUID())},'SYN306',${q(importId)})`);
   assert.equal(matching(h.A.tenant,'processing.failed',id),1);h.sql(`UPDATE jobs SET state=state WHERE id=${q(id)}`);assert.equal(matching(h.A.tenant,'processing.failed',id),1);await consume();assert.ok((await inbox(h.A)).some(x=>x.resourceId===id&&x.href==='/imports'));
   assert.equal(h.sql("SELECT count(*) FROM notification_events e JOIN jobs j ON e.tenant_id=j.tenant_id AND e.resource_id=j.id WHERE e.type='processing.failed' AND j.type='notification'"),'0');
  });
  await step('policy browser verifies saving and stale versions cannot silently overwrite',async()=>{
   const browser=await h.browser();context=await browser.newContext();context.setDefaultTimeout(15000);await context.addCookies(h.cookie(h.A).split('; ').map(v=>{const i=v.indexOf('=');return{name:v.slice(0,i),value:v.slice(i+1),url:h.base};}));const p=await context.newPage();await p.goto(h.base+'/settings/notification-delivery');
   const panel=p.getByRole('region',{name:'Política de envío'}),group=panel.getByRole('group',{name:'Centro de notificaciones'});await group.getByLabel('Autorizar este canal').waitFor();assert.equal(await group.getByLabel('Autorizar este canal').isChecked(),true);
   const before=(await h.request(h.A,'/api/notifications/delivery')).data.data.find(x=>x.channel==='inapp');await group.getByLabel('Intervalo mínimo entre envíos (segundos)').fill('2');await group.getByRole('button',{name:'Guardar Centro de notificaciones'}).click();await p.getByRole('dialog').getByRole('button',{name:'Confirmar guardado',exact:true}).click();await panel.getByText(/Política guardada y verificada/).waitFor();let current=(await h.request(h.A,'/api/notifications/delivery')).data.data.find(x=>x.channel==='inapp');assert.equal(current.intervalMs,2000);assert.equal(current.version,before.version+1);
   const stale={channel:'inapp',enabled:true,intervalMs:1000,digestWindowMs:0,maxAttempts:2,lifetimeMs:60000,expectedVersion:before.version};assert.equal((await h.request(h.A,'/api/notifications/delivery',stale)).status,409);
   await policy(h,h.A);await group.getByLabel('Intervalo mínimo entre envíos (segundos)').fill('3');await group.getByRole('button',{name:'Guardar Centro de notificaciones'}).click();await p.getByRole('dialog').getByRole('button',{name:'Confirmar guardado',exact:true}).click();await panel.getByRole('alert').waitFor();assert.match(await panel.getByRole('alert').innerText(),/cambió|Actualiza/);assert.equal(await panel.getByRole('group').count(),0);await panel.getByRole('button',{name:'Actualizar políticas'}).click();await group.getByLabel('Autorizar este canal').waitFor();assert.equal(await group.getByLabel('Intervalo mínimo entre envíos (segundos)').inputValue(),'1');
   await p.route('**/api/notifications/delivery',route=>route.abort());await panel.getByRole('button',{name:'Actualizar políticas'}).click();await panel.getByRole('alert').waitFor();assert.equal(await panel.getByRole('group').count(),0);await p.unroute('**/api/notifications/delivery');await panel.getByRole('button',{name:'Actualizar políticas'}).click();await group.getByLabel('Autorizar este canal').waitFor();
   await p.screenshot({path:path.join(evidence,'SYN-delivery-policy.png'),fullPage:true});await p.goto(h.base+'/notifications');const item=p.locator('article[data-notification-id="'+notice.id+'"]');const unreadBefore=await h.request(h.A,'/api/notifications?limit=100&status=unread');assert.equal(unreadBefore.status,200);assert.equal(unreadBefore.data.data.items.find(x=>x.id===notice.id)?.readAt,null);const otherBefore=await inbox(h.B);await item.getByRole('button',{name:'Abrir detalle',exact:true}).click();await p.getByRole('article',{name:'Brief versión '+a.brief.version}).waitFor();const allAfter=await inbox(h.A);assert.equal(typeof allAfter.find(x=>x.id===notice.id)?.readAt,'string','OPEN_DETAIL_MARKS_NOTICE_READ');const unreadAfter=await h.request(h.A,'/api/notifications?limit=100&status=unread');assert.equal(unreadAfter.status,200);assert.equal(unreadAfter.data.data.unreadCount,unreadBefore.data.data.unreadCount-1,'OPEN_DETAIL_DECREASES_UNREAD_COUNT');assert.ok(!unreadAfter.data.data.items.some(x=>x.id===notice.id),'OPEN_DETAIL_REMOVES_FROM_UNREAD');assert.deepEqual(await inbox(h.B),otherBefore,'OPEN_DETAIL_LEAVES_OTHER_TENANT_UNCHANGED');await p.screenshot({path:path.join(evidence,'SYN-notification-cta.png'),fullPage:true});await p.close();
  });
  await t.test('delivery policy UI recovers from uncertain results without duplicate POST',async()=>policyUiStates({browser:await h.browser(),base:h.base,cookie:h.cookie(h.A),evidence:path.join(evidence,'ui-policies')}));
  await businessSecurity(t,h,{a,b,viewer});
  await step('revocation blocks a retained old notice and its resource endpoint',async()=>{
   h.sql(`UPDATE memberships SET status='revoked' WHERE tenant_id=${q(h.A.tenant)} AND user_id=${q(h.A.id)}`);assert.equal((await h.request(h.A,'/api/notifications')).status,403);assert.equal((await h.request(h.A,'/api/notifications/'+notice.id+'/read',{})).status,403);assert.ok([403,404].includes((await h.request(h.A,'/api/briefs/'+a.brief.id)).status));assert.equal((await inbox(h.B)).length,1);
  });
  await businessHostedHttp(t,h);
  await step('business transition reaches local encrypted Push using the built-in factory',()=>businessPushFactory(h,evidence));
  await step('configured default CLI factory reaches local Mailpit without a custom transport module',async()=>{
   const recipient=await createReader({...h,A:h.B});await preferences(h,recipient,'membership.welcome',true,'email');await policy(h,h.B,'email');
   h.sql(`UPDATE memberships SET status='revoked',permissions_version=permissions_version+1 WHERE tenant_id=${q(recipient.tenant)} AND user_id=${q(recipient.id)};UPDATE memberships SET status='active',permissions_version=permissions_version+1 WHERE tenant_id=${q(recipient.tenant)} AND user_id=${q(recipient.id)}`);
   const id=h.sql(`SELECT id FROM notification_outbox WHERE tenant_id=${q(recipient.tenant)} AND user_id=${q(recipient.id)} AND channel='email'`);assert.match(id,/^[0-9a-f-]{36}$/);
   const role='syn_events306_'+randomUUID().replaceAll('-',''),password=randomUUID();h.sql(`CREATE ROLE ${role} LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS PASSWORD ${q(password)};GRANT vexa_email_service TO ${role};`);const connection=new URL(h.common.VEXA_DATABASE_URL);connection.username=role;connection.password=password;
   await h.stopWeb();mail=ownMailpit(h,await mailpit(evidence));cliReceipts.push(await cli(h,{VEXA_WORKER_DISPATCHER:'disabled',VEXA_WORKER_TENANT:recipient.tenant,VEXA_EMAIL_DATABASE_URL:connection.toString(),VEXA_EMAIL_MODE:'mailpit',VEXA_EMAIL_FROM:'SYN-vexa@example.test',VEXA_APP_ORIGIN:'https://syn-vexa.example.test',VEXA_MAILPIT_SMTP_PORT:'60864'}));
   assert.equal(h.sql(`SELECT state FROM notification_outbox WHERE id=${q(id)}`),'accepted');const status=h.json(`SELECT jsonb_build_object('acceptance',acceptance,'delivery',delivery,'provider',provider) FROM notification_email_messages WHERE job_id=${q(id)}`);assert.deepEqual(status,{acceptance:'accepted',delivery:'unknown',provider:'mailpit'});
   const list=mail.json('messages');assert.equal(list.total,1);const message=mail.json('message/'+list.messages[0].ID),email=h.sql(`SELECT email FROM auth.users WHERE id=${q(recipient.id)}`);assert.deepEqual(message.To.map(x=>x.Address),[email]);assert.match(message.Text,/https:\/\/syn-vexa\.example\.test\/notifications/);fs.writeFileSync(path.join(evidence,'SYN-default-factory-mailpit.json'),JSON.stringify(message,null,2));await mail.close();mail=null;
  });
  h.verifySources();fs.writeFileSync(path.join(evidence,'SYN-functional-receipt.json'),JSON.stringify({counts:total(),cli:cliReceipts,externalProviders:'not_run',securityReview:'pending'},null,2));
 }finally{if(mail)await mail.close();if(context)await context.close();if(h)await h.close();console.log('F0612_EVIDENCE:'+evidence);}
});
