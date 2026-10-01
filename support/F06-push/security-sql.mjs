import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import * as push from '../../tests/acceptance/support/F01-03/push-oracles.mjs';import {foreignKeys} from '../../tests/acceptance/support/F01-03/oracles.mjs';import {q} from './harness.mjs';
export async function pushSqlSecurity(t,h){
 await t.test('push schema exposes only session-scoped RPCs and protects Auth tombstones',()=>push.schema(h,foreignKeys(h)));
 await t.test('push isolated tenant fixtures enforce all three FKs and private RPC access',async()=>{
  const actors={},base={};for(const side of ['a','b','outsider']){const actor={id:randomUUID()},tenant=randomUUID(),session=randomUUID();actors[side]=actor;
   h.sql(`INSERT INTO auth.users(id,email,email_confirmed_at) VALUES(${q(actor.id)},${q('syn-'+actor.id+'@example.test')},now());INSERT INTO auth.sessions(id,user_id,not_after) VALUES(${q(session)},${q(actor.id)},now()+interval '1 hour');`);
   if(side!=='outsider'){h.sql(`INSERT INTO organizations(id,name) VALUES(${q(tenant)},'SYN push matrix');INSERT INTO memberships(tenant_id,user_id,role,status) VALUES(${q(tenant)},${q(actor.id)},'owner','active');`);base[side]={tenant,memberships:{tenant_id:tenant,user_id:actor.id}};}
  }
  const fixtures=await push.seed(h,base,actors);push.access(h,fixtures,actors);for(const fk of foreignKeys(h).filter(push.ownsFk))push.fk(h,fixtures,fk);
  assert.equal(h.sql(`SELECT count(*) FROM push_subscriptions WHERE tenant_id=${q(fixtures.a.tenant)}`),'1');
 });
}
