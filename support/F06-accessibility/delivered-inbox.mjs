import assert from 'node:assert/strict';
import {cli,q} from '../F06-notification-events/harness.mjs';
import {preferences,policy} from '../F06-notification-events/fixtures.mjs';
// Isolated SYN membership transition exercises the real business trigger and default inapp consumer.
export async function deliveredInboxReady({page,h,record,scanAndRecord,axePath,out,engine}){
 const prefApi='/api/notifications/preferences',policyApi='/api/notifications/delivery';
 const prefBefore=await h.request(h.A,prefApi);assert.equal(prefBefore.status,200);const originalPrefs=prefBefore.data.data.preferences.filter(x=>x.channel==='inapp'&&['*','membership.welcome'].includes(x.eventType));
 const policyBefore=await h.request(h.A,policyApi);assert.equal(policyBefore.status,200);const originalPolicy=policyBefore.data.data.find(x=>x.channel==='inapp');
 const foreignBefore=await h.request(h.B,'/api/notifications?status=all');assert.equal(foreignBefore.status,200);
 try{
  const empty=await h.request(h.A,'/api/notifications?status=unread');assert.equal(empty.status,200);assert.equal(empty.data.data.items.length,0);
  await policy(h,h.A);await preferences(h,h.A,'membership.welcome');
  h.sql(`UPDATE memberships SET status='revoked',permissions_version=permissions_version+1 WHERE tenant_id=${q(h.A.tenant)} AND user_id=${q(h.A.id)};UPDATE memberships SET status='active',permissions_version=permissions_version+1 WHERE tenant_id=${q(h.A.tenant)} AND user_id=${q(h.A.id)}`);
  const consumed=await cli(h);
  const populated=await h.request(h.A,'/api/notifications?status=unread');assert.equal(populated.status,200);assert.equal(populated.data.data.items.length,1,'REAL_CONSUMER_MUST_DELIVER_ONE_NOTICE');assert.equal(populated.data.data.unreadCount,1);
  const notice=populated.data.data.items[0];assert.equal(notice.type,'membership.welcome');assert.equal(notice.resourceId,h.A.id);assert.equal(notice.readAt,null);
  record({family:'inbox-real-delivery',engine,consumerExit:consumed.code,noticeId:notice.id,type:notice.type,status:'pass',fixture:'SYN membership activation + real trigger/default CLI; no direct inbox insert'});
  for(const viewport of [{width:390,height:844},{width:1440,height:900}])await scanAndRecord({page,url:h.base+'/notifications',viewport,axePath,out,engine,label:'/notifications-populated'},'/notifications','ready');
  const [readResponse]=await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname==='/api/notifications/'+notice.id+'/read'&&r.request().method()==='POST'),page.locator('article[data-notification-id="'+notice.id+'"]').getByRole('button',{name:'Marcar como leído',exact:true}).click()]);assert.equal(readResponse.status(),200);
  await page.getByText('Aviso marcado como leído.',{exact:true}).waitFor();await page.getByText('No hay avisos sin leer disponibles.',{exact:true}).waitFor();assert.equal(await page.locator('article[data-notification-id="'+notice.id+'"]').count(),0);
  const unread=await h.request(h.A,'/api/notifications?status=unread'),all=await h.request(h.A,'/api/notifications?status=all');assert.equal(unread.status,200);assert.equal(all.status,200);assert.equal(unread.data.data.unreadCount,0);assert.equal(unread.data.data.items.length,0);assert.equal(typeof all.data.data.items.find(x=>x.id===notice.id)?.readAt,'string');
  await page.reload();await page.getByText('No hay avisos sin leer disponibles.',{exact:true}).waitFor();await page.locator('a[aria-label="Notificaciones"][title="0 avisos sin leer"]').waitFor();assert.equal(await page.locator('a[aria-label="Notificaciones"] .notification-count').count(),0);
  const foreignAfter=await h.request(h.B,'/api/notifications?status=all');assert.equal(foreignAfter.status,200);assert.deepEqual(foreignAfter.data.data,foreignBefore.data.data);
  record({family:'inbox-mark-read',engine,method:'POST',status:'pass',http:200,noticeId:notice.id,unreadCount:0,persisted:true,reloaded:true,foreignUnchanged:true});
 }finally{
  // Restore only this synthetic user's own settings using their current CAS versions.
  for(const original of originalPrefs){const r=await h.request(h.A,prefApi);assert.equal(r.status,200);const current=r.data.data.preferences.find(x=>x.channel==='inapp'&&x.eventType===original.eventType);const restored=await h.request(h.A,prefApi,{channel:'inapp',eventType:original.eventType,enabled:original.enabled,expectedVersion:current.version});assert.equal(restored.status,200);}
  const r=await h.request(h.A,policyApi);assert.equal(r.status,200);const current=r.data.data.find(x=>x.channel==='inapp');const body={channel:'inapp',enabled:originalPolicy.enabled,intervalMs:originalPolicy.intervalMs,digestWindowMs:originalPolicy.digestWindowMs,maxAttempts:originalPolicy.maxAttempts,lifetimeMs:originalPolicy.lifetimeMs,expectedVersion:current.version};assert.equal((await h.request(h.A,policyApi,body)).status,200);
 }
}
