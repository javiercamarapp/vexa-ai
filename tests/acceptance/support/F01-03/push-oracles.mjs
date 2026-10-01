import assert from 'node:assert/strict';import {randomUUID,createECDH,randomBytes} from 'node:crypto';
import {q,insert} from './matrix.mjs';import {write,denied} from './harness.mjs';import {backend} from './import-uploads/oracles.mjs';
export const tables=['push_subscriptions','push_attempts'];
export const present=h=>tables.filter(t=>h.sql(`SELECT to_regclass(${q('public.'+t)}) IS NOT NULL`)==='t');
export const ownsFk=k=>tables.includes(k.table);
const json=v=>q(JSON.stringify(v))+'::jsonb';
const run=(h,a,t,action,statement)=>h.json(`BEGIN;SELECT set_config('request.jwt.claim.sub',${q(a.id)},true) AS ignored \\gset\nSELECT set_config('vexa.tenant_id',${q(t)},true) AS ignored \\gset\nSELECT set_config('vexa.action',${q(action)},true) AS ignored \\gset\nSET LOCAL ROLE vexa_backend;${statement};COMMIT;`);
const rowKey=(table,row)=>table==='push_subscriptions'?`tenant_id=${q(row.tenant_id)} AND id=${q(row.id)}`:`tenant_id=${q(row.tenant_id)} AND subscription_id=${q(row.subscription_id)} AND idempotency_key=${q(row.idempotency_key)}`;
export function schema(h,fks){
 assert.deepEqual(present(h),tables,'PUSH_TWO_CANONICAL_TABLES');
 for(const table of tables){
  assert.deepEqual(h.json(`SELECT jsonb_build_array(relrowsecurity,relforcerowsecurity) FROM pg_class WHERE oid=${q('public.'+table)}::regclass`),[true,true],'PUSH_FORCE_RLS:'+table);
  assert.equal(h.sql(`SELECT attnotnull FROM pg_attribute WHERE attrelid=${q('public.'+table)}::regclass AND attname='tenant_id'`),'t','PUSH_TENANT_REQUIRED');
  for(const role of ['anon','authenticated','service_role','vexa_backend','vexa_email_service','vexa_notification_verifier'])for(const action of ['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'])assert.equal(h.sql(`SELECT has_table_privilege(${q(role)},${q('public.'+table)},${q(action)})`),'f','PUSH_NO_DIRECT_GRANT:'+table+':'+role+':'+action);
 }
 for(const signature of ['push_own(jsonb)','push_worker(jsonb)','push_session_revoked()'])for(const role of ['anon','authenticated','service_role','vexa_backend','vexa_email_service','vexa_notification_verifier'])assert.equal(h.sql(`SELECT has_function_privilege(${q(role)},${q('public.'+signature)},'EXECUTE')`),role==='vexa_backend'&&signature!=='push_session_revoked()'?'t':'f','PUSH_RPC_LEAST_PRIVILEGE:'+signature+':'+role);
 assert.equal(h.sql("SELECT attnotnull FROM pg_attribute WHERE attrelid='public.push_attempts'::regclass AND attname='subscription_version'"),'t','PUSH_ATTEMPT_EPOCH_REQUIRED');
 const own=fks.filter(ownsFk);assert.equal(own.length,3,'PUSH_THREE_TENANT_FKS');
 for(const[table,parent,mapping]of [['push_subscriptions','memberships',{tenant_id:'tenant_id',user_id:'user_id'}],['push_attempts','push_subscriptions',{tenant_id:'tenant_id',subscription_id:'id'}],['push_attempts','notification_outbox',{tenant_id:'tenant_id',idempotency_key:'idempotency_key'}]]){const fk=own.find(k=>k.table===table&&k.parent===parent);assert.ok(fk?.validated);assert.deepEqual(fk.mapping,mapping);assert.deepEqual(fk.nullable,[]);}
 const session=h.json("SELECT jsonb_build_object('validated',convalidated,'delete',confdeltype,'columns',(SELECT jsonb_agg(attname) FROM unnest(conkey) a JOIN pg_attribute p ON p.attrelid=conrelid AND p.attnum=a)) FROM pg_constraint WHERE conrelid='public.push_subscriptions'::regclass AND confrelid='auth.sessions'::regclass AND contype='f'");assert.deepEqual(session,{validated:true,delete:'n',columns:['session_id']},'PUSH_AUTH_SESSION_SET_NULL_TOMBSTONE');
 assert.equal(h.sql("SELECT count(*) FROM pg_trigger WHERE tgrelid='public.push_subscriptions'::regclass AND tgfoid='public.push_session_revoked()'::regprocedure AND NOT tgisinternal AND tgenabled='O'"),'1','PUSH_SESSION_REVOKE_TRIGGER');
}
export async function seed(h,base,actors){const result={};for(const side of ['a','b']){
 const a=actors[side],t=base[side].tenant,sid=h.sql(`SELECT id FROM auth.sessions WHERE user_id=${q(a.id)} AND (not_after IS NULL OR not_after>clock_timestamp()) LIMIT 1`);assert.ok(sid,'PUSH_REAL_SESSION_FIXTURE');
 const key=createECDH('prime256v1');key.generateKeys();const device=randomUUID(),endpoint='https://fcm.googleapis.com/fcm/send/SYN_MATRIX_'+randomUUID();
 run(h,a,t,'configure',`SELECT notification_policy_set(${json({channel:'push',enabled:true,expectedVersion:0,intervalMs:1000,digestWindowMs:0,maxAttempts:5,lifetimeMs:86400000})})`);
 for(const event_type of ['*','membership.welcome'])run(h,a,t,'notify',insert('notification_preferences',{tenant_id:t,user_id:a.id,channel:'push',event_type,enabled:true,version:1})+';SELECT to_jsonb(true)');
 const registration=run(h,a,t,'notify',`SELECT push_own(${json({op:'register',sessionId:sid,deviceId:device,expiresAt:Math.floor(Date.now()/1000)+1800,consent:true,endpoint,p256dh:key.getPublicKey().toString('base64url'),auth:randomBytes(16).toString('base64url')})})`);
 const jid=run(h,a,t,'import',`SELECT to_jsonb(notification_enqueue(${json({eventId:randomUUID(),type:'membership.welcome',resourceId:a.id,userId:a.id,channel:'push'})}))`),claim=run(h,a,t,'import','SELECT notification_claim(30000)');assert.equal(claim.id,jid);
 assert.equal(run(h,a,t,'import',`SELECT notification_begin_send(${q(jid)},${q(claim.fencing_token)}::bigint,true)`).kind,'ready');
 const request={tenantId:t,userId:a.id,key:claim.idempotency_key,subscriptionId:registration.id};const begin=run(h,a,t,'import',`SELECT push_worker(${json({...request,op:'begin'})})`);assert.equal(begin.kind,'ready');
 run(h,a,t,'import',`SELECT push_worker(${json({...request,op:'finish',attempt:begin.attempt,kind:'accepted'})})`);
 const out={...base[side],tenant:t,sessionId:sid,actor:a};out.push_subscriptions=h.json(`SELECT to_jsonb(s) FROM push_subscriptions s WHERE tenant_id=${q(t)} AND id=${q(registration.id)}`);out.push_attempts=h.json(`SELECT to_jsonb(a) FROM push_attempts a WHERE tenant_id=${q(t)} AND subscription_id=${q(registration.id)}`);out.notification_outbox=h.json(`SELECT to_jsonb(o) FROM notification_outbox o WHERE tenant_id=${q(t)} AND id=${q(jid)}`);result[side]=out;
 }return result;}
export function fk(h,f,k){const row=f.a[k.table],same=Object.fromEntries(Object.keys(k.mapping).map(c=>[c,row[c]]));const probe=values=>h.probe(write(`UPDATE ${k.table} SET ${Object.entries(values).map(([col,v])=>`${col}=${q(v)}`).join(',')} WHERE ${rowKey(k.table,row)}`)+'SET CONSTRAINTS ALL IMMEDIATE;');assert.equal(probe(same).code,'00000');const bad={...same};for(const[col,ref]of Object.entries(k.mapping))if(col!=='tenant_id')bad[col]=f.b[k.parent][ref];assert.equal(probe(bad).code,'23503','PUSH_FOREIGN_TENANT_FK:'+k.name);}
export function access(h,f,actors){for(const table of tables){const row=f.a[table],query=`SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') INTO result FROM ${table} x WHERE ${rowKey(table,row)};`;
 for(const actor of [null,...Object.values(actors)])denied(h.probe(query,actor),'PUSH_BROWSER_PRIVATE');
 for(const role of ['service_role','vexa_email_service','vexa_notification_verifier'])denied(h.probe('SET LOCAL ROLE '+role+';'+query),'PUSH_DIRECT_ROLE_PRIVATE');
 for(const action of ['read','notify','import','configure']){denied(backend(h,query,actors.a,f.a.tenant,action),'PUSH_BACKEND_NO_KEYS');for(const statement of [write(`UPDATE ${table} SET tenant_id=tenant_id WHERE ${rowKey(table,row)}`),write(`DELETE FROM ${table} WHERE ${rowKey(table,row)}`)])denied(backend(h,statement,actors.a,f.a.tenant,action),'PUSH_NO_DIRECT_MUTATION');}
 }
 const attempt=f.a.push_attempts;assert.equal(h.probe(write(`UPDATE push_attempts SET subscription_version=0 WHERE ${rowKey('push_attempts',attempt)}`)).code,'23514','PUSH_ATTEMPT_EPOCH_POSITIVE');assert.equal(h.probe(write(`UPDATE push_attempts SET subscription_version=NULL WHERE ${rowKey('push_attempts',attempt)}`)).code,'23502','PUSH_ATTEMPT_EPOCH_NOT_NULL');
 const own=`SELECT push_own(${json({op:'list',sessionId:f.a.sessionId})}) INTO result;`;
 const positive=backend(h,own,actors.a,f.a.tenant,'read');assert.equal(positive.code,'00000');assert.equal(positive.rows.length,1);assert.equal(JSON.stringify(positive.rows).includes(f.a.push_subscriptions.endpoint),false,'PUSH_RPC_NO_ENDPOINT');
 for(const actor of [actors.b,actors.outsider])denied(backend(h,own,actor,f.a.tenant,'read'),'PUSH_FOREIGN_RPC');
 denied(backend(h,own,actors.a,f.a.tenant,'read',`UPDATE memberships SET status='revoked' WHERE tenant_id=${q(f.a.tenant)} AND user_id=${q(actors.a.id)};`),'PUSH_FRESH_MEMBERSHIP');
 denied(backend(h,own,actors.a,f.a.tenant,'read',`UPDATE auth.sessions SET not_after=clock_timestamp()-interval '1 second' WHERE id=${q(f.a.sessionId)};`),'PUSH_FRESH_AUTH_SESSION');
}
