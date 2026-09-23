import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
const q=x=>"'"+String(x).replaceAll("'","''")+"'";
export async function assertNotificationDatabaseBoundary(h){
 const {default:pg}=await import(pathToFileURL(path.join(h.tmp,'node_modules/pg/lib/index.js')));
 const {createDatabase}=await import(pathToFileURL(path.join(h.built,'packages/platform/db.mjs')));
 const pool=new pg.Pool({connectionString:h.common.VEXA_DATABASE_URL,max:1}),owner=h.A,viewer={...h.bot,tenant:h.A.tenant};
 const prior=h.json(`SELECT to_jsonb(m) FROM memberships m WHERE tenant_id=${q(viewer.tenant)} AND user_id=${q(viewer.id)}`);assert.ok(prior,'NOTIFY_MEMBER_FIXTURE');
 const database=actor=>createDatabase({pool,selectedTenant:actor.tenant,identity:{async getUser(){const r=await fetch(h.common.VEXA_SUPABASE_URL+'/auth/v1/user',{headers:{apikey:h.common.VEXA_SUPABASE_ANON_KEY,authorization:'Bearer '+actor.token}});assert.equal(r.status,200,'NOTIFY_REAL_AUTH');const u=await r.json();assert.equal(u.id,actor.id);return {id:u.id};},async memberships(){return [{tenant_id:actor.tenant,user_id:actor.id,role:'owner',status:'active',permissions_version:1}];}}});
 const state=async s=>(await s.query("SELECT pg_backend_pid() AS pid,current_setting('transaction_read_only') AS readonly,current_setting('vexa.action') AS action,current_setting('request.jwt.claim.sub') AS actor,current_setting('vexa.tenant_id') AS tenant")).rows[0];let escaped;
 try{
  h.sql(`UPDATE memberships SET role='viewer',status='active' WHERE tenant_id=${q(viewer.tenant)} AND user_id=${q(viewer.id)}`);
  const a=database(owner),v=database(viewer),before=await a.transaction('read',state);assert.equal(before.readonly,'on');
  for(const role of ['viewer','operator','analyst','owner']){h.sql(`UPDATE memberships SET role=${q(role)} WHERE tenant_id=${q(viewer.tenant)} AND user_id=${q(viewer.id)}`);const now=await v.transaction('notify',async s=>{assert.equal(s.role,role,'NOTIFY_CURRENT_DB_ROLE');escaped=s;return state(s);});assert.equal(now.readonly,'off');assert.equal(now.action,'notify');assert.equal(now.actor,viewer.id);assert.equal(now.tenant,viewer.tenant);assert.equal(now.pid,before.pid,'NOTIFY_POOL_REUSED');await assert.rejects(()=>escaped.query('SELECT 1'),e=>e.code==='database_scope_expired');}
  h.sql(`UPDATE memberships SET role='viewer' WHERE tenant_id=${q(viewer.tenant)} AND user_id=${q(viewer.id)}`);
  const source=h.json(`SELECT to_jsonb(s) FROM economic_source_versions s WHERE tenant_id=${q(owner.tenant)} ORDER BY created_at,id LIMIT 1`);assert.ok(source,'NOTIFY_FINANCIAL_FIXTURE');
  const columns=['id','tenant_id','source_id','version','actor_id','name','evidence_type','active','complete','window_start','window_end','watermark','report','report_hash','attested'];const values=columns.map(k=>k==='id'||k==='source_id'?randomUUID():k==='version'?1:k==='actor_id'?owner.id:source[k]);
  for(const db of [a,v]){let wrote=false;await assert.rejects(()=>db.transaction('notify',async s=>{await s.query(`INSERT INTO economic_source_versions(${columns.join(',')}) VALUES(${values.map((_,i)=>'$'+(i+1)).join(',')})`,values);wrote=true;throw Error('rollback forbidden mutation');}),e=>e.code==='database_permission_denied');assert.equal(wrote,false,'NOTIFY_NOT_FINANCIAL_WRITE');}
  await assert.rejects(()=>v.transaction('configure',()=>assert.fail('NOTIFY_VIEWER_CONFIGURE')),e=>e.code==='role_insufficient');
  const again=await a.transaction('read',state);assert.equal(again.pid,before.pid);assert.equal(again.readonly,'on');assert.equal(again.action,'read');assert.equal(again.actor,owner.id,'NOTIFY_POOL_IDENTITY_RESET');
  h.sql(`UPDATE memberships SET status='revoked' WHERE tenant_id=${q(viewer.tenant)} AND user_id=${q(viewer.id)}`);await assert.rejects(()=>v.transaction('notify',()=>assert.fail('NOTIFY_REVOKED_CALLBACK')),e=>e.code==='organization_not_authorized');
  return {realAuth:true,roles4:true,notifyDistinct:true,poolReused:true,readOnlyRestored:true,financialWriteDenied:true,expiredScopeRejected:true,currentRevocation:true};
 }finally{try{h.sql(`UPDATE memberships SET role=${q(prior.role)},status=${q(prior.status)} WHERE tenant_id=${q(viewer.tenant)} AND user_id=${q(viewer.id)}`);}finally{await pool.end();}}
}
