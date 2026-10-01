import {createReader,preferences} from './fixtures.mjs';
import * as business from '../../tests/acceptance/support/F01-03/business-notification-oracles.mjs';import {foreignKeys} from '../../tests/acceptance/support/F01-03/oracles.mjs';
import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {q} from './harness.mjs';
export async function businessSecurity(t,h,{a,viewer}){
 await t.test('business private ledger has forced RLS, exact ACL and tenant/event foreign keys',()=>{
  const fks=foreignKeys(h);business.schema(h,fks);const base={};for(const [side,actor]of [['a',h.A],['b',h.B]])base[side]={tenant:actor.tenant,notification_events:h.json(`SELECT to_jsonb(e) FROM notification_events e WHERE tenant_id=${q(actor.tenant)} AND type='brief.available' LIMIT 1`)};
  const fixture=business.seed(h,base);try{business.access(h,fixture,{a:h.A,b:h.B,viewer});for(const fk of fks.filter(business.ownsFk))business.fk(h,fixture,fk);}finally{for(const side of ['a','b'])h.sql(`DELETE FROM notification_business_events WHERE tenant_id=${q(fixture[side].tenant)} AND source_key=${q(fixture[side].notification_business_events.source_key)}`);}
 });
 await t.test('delivery policy HTTP requires current owner, same origin and strict input without partial writes',async()=>{
  const snapshot=()=>h.sql("SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY tenant_id,channel,version),'[]') FROM notification_delivery_policies p");const before=snapshot();
  const row=(await h.request(h.A,'/api/notifications/delivery')).data.data.find(r=>r.channel==='inapp');const input={...row,expectedVersion:row.version};delete input.version;
  for(const actor of [null,viewer])assert.ok([401,403].includes((await h.request(actor,'/api/notifications/delivery',input)).status));
  const foreign=await fetch(h.base+'/api/notifications/delivery',{method:'POST',headers:{origin:'https://foreign.invalid',cookie:h.cookie(h.A),'content-type':'application/json'},body:JSON.stringify(input)});assert.equal(foreign.status,403);
  for(const extra of [{tenantId:h.B.tenant},{actorId:h.B.id},{approved:true}])assert.equal((await h.request(h.A,'/api/notifications/delivery',{...input,...extra})).status,400);
  assert.equal((await h.request(h.A,'/api/notifications/delivery?tenantId='+h.B.tenant)).status,400);assert.equal(snapshot(),before);
 });
 await t.test('business emitter requires a live policy issuer and live VEXA recipient before any enqueue',async()=>{
  const recipient=await createReader(h);await preferences(h,recipient,'membership.welcome');
  for(const mode of ['active','issuer_banned','issuer_deleted','recipient_banned','recipient_deleted']){
   const key='SYN426_AUTH:'+randomUUID(),who=mode.startsWith('issuer')?h.A.id:recipient.id;const change=mode==='active'?'':`UPDATE auth.users SET ${mode.endsWith('banned')?"banned_until=now()+interval '1 hour'":"deleted_at=now()"} WHERE id=${q(who)};`;
   const count=h.sql(`BEGIN;${change}SELECT public.notification_emit_business(${q(h.A.tenant)},'membership.welcome',${q(recipient.id)},${q(key)},${q(recipient.id)}) AS ignored \\gset
SELECT count(*) FROM notification_business_events WHERE tenant_id=${q(h.A.tenant)} AND source_key=${q(key)};ROLLBACK;`);assert.equal(count,mode==='active'?'1':'0',mode);
  }
 });
 await t.test('business helper restores original tenant action and Auth principal on success, error and cancellation',()=>{
  const key='SYN426:'+randomUUID(),other=randomUUID();
  const setup=`SELECT set_config('vexa.tenant_id',${q(h.B.tenant)},true);SELECT set_config('vexa.action','read',true);SELECT set_config('request.jwt.claim.sub',${q(other)},true);`;
  const check=`IF current_setting('vexa.tenant_id',true)<>${q(h.B.tenant)} OR current_setting('vexa.action',true)<>'read' OR auth.uid()<>${q(other)}::uuid THEN RAISE EXCEPTION 'BUSINESS_CONTEXT_NOT_RESTORED';END IF;`;
  h.sql(`BEGIN;DO $test$ BEGIN IF auth.uid() IS NOT NULL THEN RAISE EXCEPTION 'EXPECTED_UNINITIALIZED_AUTH';END IF;PERFORM public.notification_emit_business(${q(h.A.tenant)},'brief.available',${q(a.brief.id)},${q(key)},${q(randomUUID())});IF auth.uid() IS NOT NULL OR nullif(current_setting('vexa.tenant_id',true),'') IS NOT NULL OR nullif(current_setting('vexa.action',true),'') IS NOT NULL THEN RAISE EXCEPTION 'NULL_CONTEXT_NOT_RESTORED';END IF;END $test$;ROLLBACK;`);
  h.sql(`BEGIN;${setup}DO $test$ BEGIN PERFORM public.notification_emit_business(${q(h.A.tenant)},'brief.available',${q(a.brief.id)},${q(key)},${q(randomUUID())});${check}BEGIN PERFORM public.notification_emit_business(${q(h.A.tenant)},'invalid',${q(a.brief.id)},${q(key)},null);RAISE EXCEPTION 'EXPECTED_CHECK_VIOLATION';EXCEPTION WHEN check_violation THEN NULL;END;${check}END $test$;ROLLBACK;`);
  h.sql(`BEGIN;SELECT set_config('request.jwt.claim.sub','',true);SELECT set_config('request.jwt.claims',${q(JSON.stringify({sub:other}))},true);SELECT set_config('vexa.tenant_id',${q(h.B.tenant)},true);SELECT set_config('vexa.action','read',true);DO $test$ BEGIN PERFORM public.notification_emit_business(${q(h.A.tenant)},'brief.available',${q(a.brief.id)},${q(key)},${q(randomUUID())});${check}END $test$;ROLLBACK;`);
  h.sql(`BEGIN;CREATE FUNCTION pg_temp.cancel_business426() RETURNS trigger LANGUAGE plpgsql AS $cancel$ BEGIN RAISE EXCEPTION USING ERRCODE='57014',MESSAGE='SYN cancellation';END $cancel$;CREATE TRIGGER syn_cancel426 BEFORE INSERT ON public.notification_business_events FOR EACH ROW EXECUTE FUNCTION pg_temp.cancel_business426();${setup}DO $test$ BEGIN BEGIN PERFORM public.notification_emit_business(${q(h.A.tenant)},'brief.available',${q(a.brief.id)},${q(key)},${q(h.A.id)});RAISE EXCEPTION 'EXPECTED_QUERY_CANCELED';EXCEPTION WHEN query_canceled THEN NULL;END;${check}END $test$;ROLLBACK;`);
 });
}
