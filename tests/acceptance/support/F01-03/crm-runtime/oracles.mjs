import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {q,insert} from '../matrix.mjs';
import {read,write,rows,denied} from '../harness.mjs';
import {backend} from '../import-uploads/oracles.mjs';
export const table='crm_sync_settings';
export const present=h=>h.sql("SELECT to_regclass('public.crm_sync_settings') IS NOT NULL")==='t';
export function schema(h,fks){
 assert.deepEqual(h.json("SELECT jsonb_build_array(relrowsecurity,relforcerowsecurity) FROM pg_class WHERE oid='public.crm_sync_settings'::regclass"),[true,true],'CRM_FORCE_RLS');
 for(const col of ['tenant_id','connection_id','actor_id','enabled','history_from','backfill_to','version','generation','failure_count'])assert.equal(h.sql(`SELECT attnotnull FROM pg_attribute WHERE attrelid='public.crm_sync_settings'::regclass AND attname=${q(col)}`),'t','CRM_NOT_NULL:'+col);
 for(const role of ['anon','authenticated','service_role','vexa_backend'])for(const action of ['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'])assert.equal(h.sql(`SELECT has_table_privilege(${q(role)},'public.crm_sync_settings',${q(action)})`),role==='vexa_backend'&&['SELECT','INSERT','UPDATE'].includes(action)?'t':'f',`CRM_GRANT:${role}:${action}`);
 const own=fks.filter(k=>k.table===table);assert.equal(own.length,2,'CRM_FK_COUNT');
 for(const [parent,mapping]of [['organizations',{tenant_id:'id'}],['connections',{tenant_id:'tenant_id',connection_id:'id'}]])assert.ok(own.some(k=>k.parent===parent&&k.validated&&JSON.stringify(Object.entries(k.mapping).sort())===JSON.stringify(Object.entries(mapping).sort())),'CRM_FK_REQUIRED:'+parent);
 assert.deepEqual(h.json("SELECT jsonb_build_object('definer',prosecdef,'search',proconfig) FROM pg_proc WHERE oid='public.crm_actor_authorized(uuid)'::regprocedure"),{definer:true,search:['search_path=""']},'CRM_RPC_NARROW');
 for(const role of ['anon','authenticated','service_role','vexa_backend'])assert.equal(h.sql(`SELECT has_function_privilege(${q(role)},'public.crm_actor_authorized(uuid)','EXECUTE')`),role==='vexa_backend'?'t':'f','CRM_RPC_GRANT:'+role);
}
export function seed(h,f,actors){const out={};for(const side of ['a','b']){
 const c=f[side].connections,row={id:randomUUID(),tenant_id:c.tenant_id,connection_id:c.id,actor_id:actors[side].id,enabled:true,history_from:'2025-01-01T00:00:00Z',backfill_to:'2026-01-01T00:00:00Z',version:1,generation:1};
 h.sql(insert(table,row)+';');out[side]={...f[side],[table]:row};
}return out;}
const scans=(r,ids,label)=>{assert.equal(r.code,'00000',label);assert.deepEqual(r.rows.map(x=>x.id).sort(),ids.sort(),label);};
const rpc=(h,a,tenant,connection,action='import',prep='')=>backend(h,`SELECT jsonb_build_array(jsonb_build_object('allowed',public.crm_actor_authorized(${q(connection)}))) INTO result;`,a,tenant,action,prep);
const allowed=(r,value,label)=>{assert.equal(r.code,'00000',label);assert.equal(r.rows[0].allowed,value,label);};
export function access(h,f,a){
 const x=f.a[table],y=f.b[table],A=x.tenant_id,B=y.tenant_id;
 for(const actor of [null,...Object.values(a)])denied(h.probe(read(table),actor),'CRM_DIRECT_DENIED');
 denied(h.probe('SET LOCAL ROLE service_role; '+read(table)),'CRM_SERVICE_DENIED');
 for(const name of ['a','dual','analyst','operator','viewer'])scans(backend(h,read(table),a[name],A,'read'),[x.id],'CRM_SCOPED_READ:'+name);
 for(const [actor,tenant]of [[a.a,B],[a.dual,null],[a.outsider,A]])scans(backend(h,read(table),actor,tenant,'read'),[],'CRM_FOREIGN_READ');
 const remove=`DELETE FROM crm_sync_settings WHERE tenant_id=${q(A)};`;
 rows(backend(h,write(insert(table,x)),a.a,A,'configure',remove),[0],'CRM_CONFIG_INSERT_OWNER');
 for(const name of ['analyst','operator','viewer','outsider'])denied(backend(h,write(insert(table,{...x,actor_id:a[name].id})),a[name],A,'configure',remove),'CRM_CONFIG_INSERT_ROLE:'+name);
 for(const action of ['read','import','retain','execute'])denied(backend(h,write(insert(table,x)),a.a,A,action,remove),'CRM_CONFIG_ACTION:'+action);
 denied(backend(h,write(insert(table,{...y,actor_id:a.dual.id})),a.dual,A,'configure',`DELETE FROM crm_sync_settings WHERE tenant_id=${q(B)};`),'CRM_INSERT_DUAL_SCOPE');
 const ownerEdit=`UPDATE crm_sync_settings SET enabled=false,version=version+1 WHERE id=${q(x.id)}`;
 rows(backend(h,write(ownerEdit),a.a,A,'configure'),[0],'CRM_CONFIG_UPDATE_OWNER');
 for(const name of ['analyst','operator','viewer'])denied(backend(h,write(ownerEdit),a[name],A,'configure'),'CRM_CONFIG_UPDATE_ROLE:'+name);
 assert.equal(backend(h,write(`UPDATE crm_sync_settings SET enabled=false WHERE id=${q(x.id)}`),a.a,A,'configure').code,'23514','CRM_CONFIG_REQUIRES_CAS');
 const dispatch=`UPDATE crm_sync_settings SET last_dispatched_at=now(),next_attempt_at=now()+interval '30 seconds',failure_count=1,error_code='SYNC_FAILED' WHERE id=${q(x.id)}`;
 rows(backend(h,write(dispatch),a.analyst,A,'import'),[0],'CRM_DISPATCH_DELEGATED');
 for(const assignment of ['actor_id='+q(a.analyst.id),'enabled=false',"history_from='2020-01-01'",'generation=generation+1','version=version+1','connection_id='+q(y.connection_id),'tenant_id='+q(B)])assert.notEqual(backend(h,write(`UPDATE crm_sync_settings SET ${assignment} WHERE id=${q(x.id)}`),a.analyst,A,'import').code,'00000','CRM_WORKER_CONFIG_GUARD:'+assignment);
 denied(backend(h,write('DELETE FROM crm_sync_settings'),a.a,A,'retain'),'CRM_DELETE_DENIED');
 allowed(rpc(h,a.a,A,x.connection_id),true,'CRM_OWNER_RPC');allowed(rpc(h,a.analyst,A,x.connection_id),true,'CRM_WORKER_RPC');
 for(const [actor,tenant,connection,action]of [[a.analyst,B,x.connection_id,'import'],[a.analyst,null,x.connection_id,'import'],[a.dual,A,y.connection_id,'import'],[a.analyst,A,x.connection_id,'read'],[a.viewer,A,x.connection_id,'import'],[a.outsider,A,x.connection_id,'import']])allowed(rpc(h,actor,tenant,connection,action),false,'CRM_RPC_SCOPE');
 for(const prepare of [
  `UPDATE worker_delegations SET enabled=false WHERE tenant_id=${q(A)};`,
  `UPDATE memberships SET status='revoked' WHERE tenant_id=${q(A)} AND user_id=${q(a.analyst.id)};`,
  `UPDATE memberships SET status='revoked' WHERE tenant_id=${q(A)} AND user_id=${q(a.a.id)};`,
  `UPDATE memberships SET role='viewer' WHERE tenant_id=${q(A)} AND user_id=${q(a.a.id)};`,
  `ALTER TABLE crm_sync_settings DISABLE TRIGGER USER; UPDATE crm_sync_settings SET enabled=false WHERE tenant_id=${q(A)}; ALTER TABLE crm_sync_settings ENABLE TRIGGER USER;`
 ]){allowed(rpc(h,a.analyst,A,x.connection_id,'import',prepare),false,'CRM_RPC_REVOKED');denied(backend(h,write(dispatch),a.analyst,A,'import',prepare),'CRM_REVOKED_DISPATCH');}
 const revoke=`UPDATE memberships SET status='revoked' WHERE tenant_id=${q(A)} AND user_id=${q(a.a.id)};`;
 scans(backend(h,read(table),a.a,A,'read',revoke),[],'CRM_REVOKED_READ');
}
export function fk(h,f,key){const row=f.a[table],probe=value=>h.probe(`DELETE FROM crm_sync_settings; ${write(insert(table,value))} SET CONSTRAINTS ALL IMMEDIATE;`);rows(probe(row),[0],'CRM_FK_POSITIVE:'+key.name);const bad={...row};if(key.parent==='organizations')bad.tenant_id=randomUUID();else for(const[col,ref]of Object.entries(key.mapping))if(col!=='tenant_id')bad[col]=f.b[key.parent][ref];const r=probe(bad);assert.equal(r.code,'23503','CRM_FK_CROSS:'+key.name);assert.ok(r.constraint,'CRM_FK_CONSTRAINT');}
