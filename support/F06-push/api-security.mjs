import assert from 'node:assert/strict';
import {q} from './harness.mjs';
export async function pushApiSecurity(t,h,{subscription,device}){
 const request=async({actor=h.A,method='GET',body,origin=h.base,suffix='',cookie}={})=>{
  const response=await fetch(h.base+'/api/notifications/push'+suffix,{method,headers:{...(actor?{cookie:cookie??h.cookie(actor)}:{}),...(origin===null?{}:{origin}),'content-type':'application/json'},body:body===undefined?undefined:typeof body==='string'?body:JSON.stringify(body),signal:AbortSignal.timeout(10000)});
  const data=await response.json();assert.match(response.headers.get('cache-control')??'',/no-store|private/,'PUSH_PRIVATE_RESPONSE');return{status:response.status,data};
 };
 const register={op:'register',consent:true,subscription};
 await t.test('push API authenticates and rejects cross-origin or missing-origin mutations',async()=>{
  const before=h.sql('SELECT count(*) FROM push_subscriptions');
  assert.equal((await request({actor:null})).status,401);
  for(const origin of [null,'https://untrusted.example.test'])assert.equal((await request({method:'POST',body:register,origin})).status,403);
  assert.equal(h.sql('SELECT count(*) FROM push_subscriptions'),before);
 });
 await t.test('push API rejects caller tenant and session authority and oversized input',async()=>{
  const before=h.sql('SELECT count(*) FROM push_subscriptions');
  for(const body of [{...register,tenantId:h.B.tenant},{...register,userId:h.B.id},{...register,sessionId:JSON.parse(Buffer.from(h.B.token.split('.')[1],'base64url')).session_id},{...register,deviceId:device.id}])assert.equal((await request({method:'POST',body})).status,400);
  assert.equal((await request({suffix:'?tenantId='+h.B.tenant})).status,400);
  assert.equal((await request({method:'POST',body:' '.repeat(8193)})).status,413);
  assert.equal(h.sql('SELECT count(*) FROM push_subscriptions'),before);
 });
 await t.test('foreign actor cannot list or revoke another actor device',async()=>{
  const foreign=await request({actor:h.B});assert.equal(foreign.status,200);assert.equal(foreign.data.data.devices.some(d=>d.id===device.id),false);
  const revoke=await request({actor:h.B,method:'POST',body:{op:'revoke',id:device.id}});assert.ok([200,403,404].includes(revoke.status));assert.equal(h.sql(`SELECT status FROM push_subscriptions WHERE id=${q(device.id)}`),'active');
  const own=await request();assert.equal(own.status,200);assert.equal(JSON.stringify(own.data).includes(subscription.endpoint),false);assert.equal(JSON.stringify(own.data).includes(subscription.keys.auth),false);
  const selected=await request({cookie:h.cookie(h.A).replace('vexa_active_org='+h.A.tenant,'vexa_active_org='+h.B.tenant)});assert.ok([403,404].includes(selected.status));
 });
 await t.test('push API observes membership revocation and live Auth session expiry',async()=>{
  const sid=JSON.parse(Buffer.from(h.A.token.split('.')[1],'base64url')).session_id;
  const prior=h.json(`SELECT row_to_json(s) FROM (SELECT not_after FROM auth.sessions WHERE id=${q(sid)}) s`);
  h.sql(`UPDATE memberships SET status='revoked' WHERE tenant_id=${q(h.A.tenant)} AND user_id=${q(h.A.id)}`);
  try{assert.ok([401,403,404].includes((await request()).status));}finally{h.sql(`UPDATE memberships SET status='active' WHERE tenant_id=${q(h.A.tenant)} AND user_id=${q(h.A.id)}`);}
  h.sql(`UPDATE auth.sessions SET not_after=clock_timestamp()-interval '1 second' WHERE id=${q(sid)}`);
  try{assert.ok([401,403].includes((await request()).status));assert.ok([401,403].includes((await request({method:'POST',body:{op:'revoke',id:device.id}})).status));assert.equal(h.sql(`SELECT status FROM push_subscriptions WHERE id=${q(device.id)}`),'active');}
  finally{h.sql(`UPDATE auth.sessions SET not_after=${prior.not_after===null?'NULL':q(prior.not_after)} WHERE id=${q(sid)}`);}
  assert.equal((await request()).status,200);
 });
}
