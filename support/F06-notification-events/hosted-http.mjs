import assert from 'node:assert/strict';import {createReader,preferences,policy,q} from './fixtures.mjs';
export async function businessHostedHttp(t,h){
 await t.test('hosted notification route rejects unauthorized and tenant-supplied triggers without work',async()=>{
  const snapshot=()=>h.sql("SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'state',state,'attempts',attempts) ORDER BY id),'[]') FROM notification_outbox");const before=snapshot();
  const send=(body,authorization='Bearer '+h.triggerSecret,suffix='')=>fetch(h.base+'/api/internal/notifications'+suffix,{method:'POST',headers:{authorization},body,signal:AbortSignal.timeout(10000)});
  for(const authorization of ['',h.triggerSecret,'Bearer wrong']){const r=await send('{}',authorization);assert.equal(r.status,401);assert.match(r.headers.get('cache-control'),/no-store/);assert.equal((await r.text()).includes(h.triggerSecret),false);}
  const query=await send('{}','Bearer '+h.triggerSecret,'?tenantId='+h.B.tenant);assert.equal(query.status,400);
  const input=await send('{"tenantId":"'+h.B.tenant+'"}');assert.ok([400,413].includes(input.status));assert.equal(snapshot(),before);
 });
 await t.test('hosted HTTP consumes real membership business event into only the authorized recipient inbox',async()=>{
  const actor=await createReader({...h,A:h.B});await preferences(h,actor,'membership.welcome');await policy(h,h.B);
  h.sql(`UPDATE memberships SET status='revoked',permissions_version=permissions_version+1 WHERE tenant_id=${q(actor.tenant)} AND user_id=${q(actor.id)};UPDATE memberships SET status='active',permissions_version=permissions_version+1 WHERE tenant_id=${q(actor.tenant)} AND user_id=${q(actor.id)}`);
  const job=h.sql(`SELECT id FROM notification_outbox WHERE tenant_id=${q(actor.tenant)} AND user_id=${q(actor.id)} AND channel='inapp'`);assert.match(job,/^[0-9a-f-]{36}$/);const others=h.sql("SELECT coalesce(jsonb_agg(to_jsonb(j) ORDER BY id),'[]') FROM jobs j WHERE type<>'notification'");
  for(let i=0;i<12&&h.sql(`SELECT state FROM notification_outbox WHERE id=${q(job)}`)!=='accepted';i++){const r=await fetch(h.base+'/api/internal/notifications',{method:'POST',headers:{authorization:'Bearer '+h.triggerSecret},body:'{}',signal:AbortSignal.timeout(50000)});assert.equal(r.status,200,await r.clone().text());const data=await r.json();assert.ok(['IDLE','CYCLE_COMPLETED'].includes(data.code));assert.match(r.headers.get('cache-control'),/no-store/);await new Promise(resolve=>setTimeout(resolve,1100));}
  assert.equal(h.sql(`SELECT state FROM notification_outbox WHERE id=${q(job)}`),'accepted');const response=await h.request(actor,'/api/notifications?status=all');assert.equal(response.status,200);const items=response.data.data.items;assert.equal(items.length,1);assert.equal(items[0].type,'membership.welcome');assert.equal(items[0].resourceId,actor.id);assert.equal(items[0].href,'/overview');assert.equal(h.sql("SELECT coalesce(jsonb_agg(to_jsonb(j) ORDER BY id),'[]') FROM jobs j WHERE type<>'notification'"),others);
 });
}
