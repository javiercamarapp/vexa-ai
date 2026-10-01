import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {q} from './harness.mjs';
export async function pushLogoutSecurity(t,h){
 await t.test('platform administrator without workspace membership can terminate actual Auth session',async()=>{
  const response=await h.auth('auth','/signup',null,{method:'POST',body:{email:'syn-push-admin-'+randomUUID()+'@example.test',password:'SYN-'+randomUUID()}});assert.equal(response.status,200);
  const actor={id:response.data.user.id,token:response.data.access_token,refresh:response.data.refresh_token,tenant:''};assert.ok(actor.token&&actor.refresh);
  h.sql(`INSERT INTO vexa_platform.administrators(user_id,active) VALUES(${q(actor.id)},true)`);
  assert.equal(h.sql(`SELECT count(*) FROM memberships WHERE user_id=${q(actor.id)}`),'0');assert.equal(h.sql(`SELECT count(*) FROM auth.sessions WHERE user_id=${q(actor.id)}`),'1');
  const logout=await fetch(h.base+'/auth/logout',{method:'POST',headers:{origin:h.base,cookie:h.cookie(actor)+'; vexa_push_device='+randomUUID()},redirect:'manual',signal:AbortSignal.timeout(10000)});
  assert.equal(logout.status,303);assert.match(logout.headers.get('clear-site-data')??'',/storage/);assert.ok(logout.headers.getSetCookie().some(c=>c.startsWith('vexa_push_device=')&&/Max-Age=0|Expires=Thu, 01 Jan 1970/i.test(c)),'PUSH_DEVICE_COOKIE_CLEARED');
  assert.equal(h.sql(`SELECT count(*) FROM auth.sessions WHERE user_id=${q(actor.id)}`),'0');
  const refreshed=await h.auth('auth','/token?grant_type=refresh_token',null,{method:'POST',body:{refresh_token:actor.refresh}});assert.equal(refreshed.status,400);
 });
}
