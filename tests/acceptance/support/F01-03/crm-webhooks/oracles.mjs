import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {q,insert} from '../matrix.mjs';
import {read,write,denied} from '../harness.mjs';
import {backend} from '../import-uploads/oracles.mjs';
export const table='crm_webhook_receipts';
export const present=h=>h.sql("SELECT to_regclass('public.crm_webhook_receipts') IS NOT NULL")==='t';
export function schema(h,fks){
 assert.deepEqual(h.json("SELECT jsonb_build_array(relrowsecurity,relforcerowsecurity) FROM pg_class WHERE oid='crm_webhook_receipts'::regclass"),[true,true],'CRM_WEBHOOK_FORCED_RLS');
 for(const col of ['id','tenant_id','connection_id','digest','received_at'])assert.equal(h.sql(`SELECT attnotnull FROM pg_attribute WHERE attrelid='crm_webhook_receipts'::regclass AND attname=${q(col)}`),'t','CRM_WEBHOOK_REQUIRED:'+col);
 const own=fks.filter(x=>x.table===table);assert.equal(own.length,2,'CRM_WEBHOOK_FK_COUNT');
 for(const[parent,mapping]of [['organizations',{tenant_id:'id'}],['connections',{tenant_id:'tenant_id',connection_id:'id'}]])assert.ok(own.some(k=>k.parent===parent&&k.validated&&JSON.stringify(Object.entries(k.mapping).sort())===JSON.stringify(Object.entries(mapping).sort())),'CRM_WEBHOOK_FK:'+parent);
 for(const role of ['anon','authenticated','service_role','vexa_backend']){
  for(const action of ['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'])assert.equal(h.sql(`SELECT has_table_privilege(${q(role)},${q(table)},${q(action)})`),role==='vexa_backend'&&['SELECT','DELETE'].includes(action)?'t':'f',`CRM_WEBHOOK_TABLE_GRANT:${role}:${action}`);
  for(const col of ['id','tenant_id','connection_id','digest','received_at'])assert.equal(h.sql(`SELECT has_column_privilege(${q(role)},${q(table)},${q(col)},'INSERT')`),role==='vexa_backend'&&['tenant_id','connection_id','digest'].includes(col)?'t':'f',`CRM_WEBHOOK_COLUMN_INSERT:${role}:${col}`);
  assert.equal(h.sql(`SELECT has_sequence_privilege(${q(role)},'crm_webhook_receipts_id_seq','USAGE')`),role==='vexa_backend'?'t':'f','CRM_WEBHOOK_SEQUENCE:'+role);
 }
}
export function seed(h,f){const result={};for(const side of ['a','b']){
 const c=f[side].connections,row={tenant_id:c.tenant_id,connection_id:c.id,digest:(side==='a'?'a':'b').repeat(64)};
 h.sql(insert(table,row)+';');result[side]={...f[side],[table]:row};
}return result;}
export function access(h,f,a){
 const x=f.a[table],y=f.b[table],A=x.tenant_id,B=y.tenant_id;
 for(const actor of [null,...Object.values(a)])denied(h.probe(read(table),actor),'CRM_WEBHOOK_DIRECT_DENIED');
 denied(h.probe('SET LOCAL ROLE service_role; '+read(table)),'CRM_WEBHOOK_SERVICE_DENIED');
 for(const actor of [a.a,a.analyst]){const r=backend(h,read(table),actor,A);assert.equal(r.code,'00000');assert.deepEqual(r.rows.map(x=>x.digest),[x.digest],'CRM_WEBHOOK_CURRENT_AUTHORIZED_READ');}
 for(const[actor,scope,action]of [[a.a,B,'import'],[a.dual,A,'import'],[a.analyst,null,'import'],[a.viewer,A,'import'],[a.operator,A,'import'],[a.outsider,A,'import'],[a.a,A,'read'],[a.a,A,'configure']])denied(backend(h,read(table),actor,scope,action),'CRM_WEBHOOK_NEGATIVE_SCOPE');
 const add={...x,digest:'c'.repeat(64)};
 const accepted=backend(h,write(insert(table,add)),a.analyst,A);assert.equal(accepted.code,'00000');assert.equal(accepted.rows[0].affected,1,'CRM_WEBHOOK_DELEGATED_INSERT');
 denied(backend(h,write(insert(table,{...y,digest:'c'.repeat(64)})),a.analyst,A),'CRM_WEBHOOK_INSERT_CROSS');
 denied(backend(h,write(insert(table,{...add,received_at:'2020-01-01'})),a.analyst,A),'CRM_WEBHOOK_TIMESTAMP_FORGE');
 denied(backend(h,write("UPDATE crm_webhook_receipts SET digest=repeat('c',64)"),a.a,A),'CRM_WEBHOOK_IMMUTABLE');
 assert.equal(backend(h,write(insert(table,x)),a.a,A).code,'23505','CRM_WEBHOOK_REPLAY_UNIQUE');
 assert.equal(backend(h,write(insert(table,{...add,digest:'NOT_A_HASH'})),a.a,A).code,'23514','CRM_WEBHOOK_DIGEST_CHECK');
 const fresh=backend(h,write('DELETE FROM crm_webhook_receipts'),a.a,A);assert.equal(fresh.code,'00000');assert.deepEqual(fresh.rows,[],'CRM_WEBHOOK_NO_PREMATURE_DELETE');
 const aged=backend(h,write('DELETE FROM crm_webhook_receipts'),a.a,A,'import',"UPDATE crm_webhook_receipts SET received_at=clock_timestamp()-interval '11 minutes';");assert.equal(aged.code,'00000');assert.equal(aged.rows[0].affected,1,'CRM_WEBHOOK_ONLY_OWN_OLD_PRUNED');
 for(const prep of [
  `UPDATE worker_delegations SET enabled=false WHERE tenant_id=${q(A)};`,
  `UPDATE memberships SET status='revoked' WHERE tenant_id=${q(A)} AND user_id=${q(a.analyst.id)};`,
  `UPDATE memberships SET status='revoked' WHERE tenant_id=${q(A)} AND user_id=${q(a.a.id)};`,
  `UPDATE memberships SET role='viewer' WHERE tenant_id=${q(A)} AND user_id=${q(a.a.id)};`,
  `ALTER TABLE crm_sync_settings DISABLE TRIGGER USER; UPDATE crm_sync_settings SET enabled=false WHERE tenant_id=${q(A)}; ALTER TABLE crm_sync_settings ENABLE TRIGGER USER;`
 ]){denied(backend(h,read(table),a.analyst,A,'import',prep),'CRM_WEBHOOK_REVOKED_READ');denied(backend(h,write(insert(table,add)),a.analyst,A,'import',prep),'CRM_WEBHOOK_REVOKED_WRITE');}
}
export function fk(h,f,key){
 const row=f.a[table],probe=value=>h.probe(`DELETE FROM crm_webhook_receipts;${write(insert(table,value))} SET CONSTRAINTS ALL IMMEDIATE;`);
 const positive=probe(row);assert.equal(positive.code,'00000','CRM_WEBHOOK_FK_POSITIVE');assert.equal(positive.rows[0].affected,1);
 const bad={...row};if(key.parent==='organizations')bad.tenant_id=randomUUID();else bad.connection_id=f.b.connections.id;
 const r=probe(bad);assert.equal(r.code,'23503','CRM_WEBHOOK_FK_CROSS:'+key.name);assert.ok(r.constraint);
}
