// SYN294: actual Auth, ingestion, extraction, immutable snapshot and brief; no delivery claims.
import {randomUUID} from 'node:crypto';
import {seedDetail,detailQuery} from '../F06-detail/fixtures.mjs';
export {createReader} from '../F06-recommendations/fixtures.mjs';
export async function seedNotificationResource(h){
 const f=await seedDetail(h),query=detailQuery(f.snapshot);
 const workspace=await f.ok(h.request(h.A,'/api/workspace?'+query+'&resource=problems'));
 query.set('scope_hash',workspace.meta.scope_hash);
 const brief=await f.ok(h.request(h.A,'/api/briefs',{operation:'generate',query:query.toString(),comparisonQuery:null,expectedPreviousId:null,requestKey:randomUUID()}));
 return {...f,query,brief};
}
import assert from 'node:assert/strict';
import {q} from './harness.mjs';
import {createReader} from '../F06-recommendations/fixtures.mjs';
export async function seedNotifications(h){
 const f=await seedNotificationResource(h),viewer=await createReader(h),ownIds=[],eventIds=[];
 // Private DB-owner test setup, every product trigger/FK active. No HTTP emission path.
 for(let i=0;i<31;i++){
  const eventId=randomUUID(),id=randomUUID();eventIds.push(eventId);ownIds.push(id);
  h.sql(`INSERT INTO notification_events(tenant_id,id,type,resource_id) VALUES(${q(h.A.tenant)},${q(eventId)},'brief.available',${q(f.brief.id)});INSERT INTO notification_inbox(tenant_id,id,event_id,user_id) VALUES(${q(h.A.tenant)},${q(id)},${q(eventId)},${q(h.A.id)});`);
 }
 const viewerId=randomUUID();h.sql(`INSERT INTO notification_inbox(tenant_id,id,event_id,user_id) VALUES(${q(h.A.tenant)},${q(viewerId)},${q(eventIds[0])},${q(viewer.id)});`);
 const customerId=f.a.customers.C1;
 const denied=h.probe(`INSERT INTO notification_inbox(tenant_id,id,event_id,user_id) VALUES(${q(h.A.tenant)},${q(randomUUID())},${q(eventIds[0])},${q(customerId)});`);
 assert.equal(denied.code,'23514','CRM_CUSTOMER_IS_NOT_A_MEMBER_RECIPIENT');
 assert.equal(h.sql(`SELECT count(*) FROM notification_inbox WHERE user_id=${q(customerId)}`),'0');
 return {...f,viewer,viewerId,ownIds,eventIds,customerId};
}
