import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {q,insert} from '../matrix.mjs';
import {read,write,rows,denied} from '../harness.mjs';
import {backend} from '../import-uploads/oracles.mjs';
export const tables=['source_revisions','source_quarantine','source_heads'];
export const present=h=>tables.filter(t=>h.sql(`SELECT to_regclass('public.${t}') IS NOT NULL`)==='t');
export function schema(h,fks){
 if(present(h).includes('source_heads')){
  assert.equal(fks.filter(f=>tables.includes(f.table)).length,19,'HISTORY_19_NEW_FKS');
  assert.equal(h.sql("SELECT attnotnull FROM pg_attribute WHERE attrelid='messages'::regclass AND attname='occurred_at'"),'f','MESSAGE_NULL_DATE_FEATURE006');
  assert.deepEqual(fks.find(f=>f.table==='source_heads'&&f.parent==='source_revisions')?.mapping,{tenant_id:'tenant_id',id:'canonical_id',selected_revision_id:'id'},'HEAD_TRIPLE_IDENTITY_FK');
 }
 for(const table of present(h)){
  assert.deepEqual(h.json(`SELECT jsonb_build_array(relrowsecurity,relforcerowsecurity) FROM pg_class WHERE oid='public.${table}'::regclass`),[true,true],`HISTORY_RLS:${table}`);
  for(const role of ['anon','authenticated','service_role','vexa_backend'])for(const action of ['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'])assert.equal(h.sql(`SELECT has_table_privilege(${q(role)},${q('public.'+table)},${q(action)})`),role==='vexa_backend'&&(table==='source_heads'?['SELECT','INSERT','UPDATE']:['SELECT','INSERT']).includes(action)?'t':'f',`HISTORY_GRANT:${table}:${role}:${action}`);
  const expected=table==='source_revisions'?['organizations','connections','customers','products','orders','conversations','messages','customers','products','orders','conversations','message_revisions']:table==='source_heads'?['organizations','connections','source_revisions']:['organizations','imports','import_rows','source_revisions'];
  assert.deepEqual(fks.filter(f=>f.table===table).map(f=>f.parent).sort(),expected.sort(),`HISTORY_FKS:${table}`);
 }
}
export function seedHistory(h,f){
 for(const side of ['a','b']){
  const r=f[side];
  if(present(h).includes('source_revisions')){
   r.source_revisions={id:randomUUID(),tenant_id:r.customers.tenant_id,connection_id:r.connections.id,entity_type:'customer',external_id:'history-fixture',source_revision:'1',content_hash:'a'.repeat(64),fingerprint:'b'.repeat(64),mapping_version:'1',canonical_id:r.customers.id,customer_id:r.customers.id,provenance:{fixture:true,...(h.sql("SELECT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.external_aliases'::regclass AND attname='operation' AND NOT attisdropped)")==='t'?{source:r.connections.source,account_id:r.connections.account_id}:{})},snapshot:[]};
   h.sql(insert('source_revisions',r.source_revisions)+';');
  }
  if(present(h).includes('source_heads')){r.source_heads={id:r.customers.id,tenant_id:r.customers.tenant_id,connection_id:r.connections.id,entity_type:'customer',external_id:'history-fixture',selected_revision_id:r.source_revisions.id,state:'unique',version:1};h.sql(insert('source_heads',r.source_heads)+';');}
  if(present(h).includes('source_quarantine')){
   r.source_quarantine={id:randomUUID(),tenant_id:r.imports.tenant_id,import_id:r.imports.id,import_row_id:r.import_rows.id,original_revision_id:r.source_revisions.id,code:'SYNTHETIC',evidence_hash:'c'.repeat(64),provenance:{fixture:true}};
   h.sql(insert('source_quarantine',r.source_quarantine)+';');
  }
 }
}
const fresh=r=>({...r,...('selected_revision_id' in r?{selected_revision_id:null,state:'ambiguous'}:{}),id:randomUUID(),...('external_id' in r?{external_id:randomUUID()}:{})});
export function access(h,f,actors){
 if(present(h).includes('source_revisions')){
  const base=fresh(f.a.source_revisions);
  for(const change of [{product_id:f.a.products.id},{customer_id:null},{canonical_id:randomUUID()},{entity_type:'product'}])assert.equal(h.probe(write(insert('source_revisions',{...base,...change}))).code,'23514','HISTORY_EXACTLY_ONE_MATCHING_PROJECTION');
 }

 for(const table of present(h)){
  for(const actor of [null,...Object.values(actors)]){
   denied(h.probe(read(table),actor),`HISTORY_DIRECT_READ:${table}`);
   denied(h.probe(write(insert(table,fresh(f.a[table]))),actor),`HISTORY_DIRECT_INSERT:${table}`);
  }
  denied(h.probe(`SET LOCAL ROLE service_role; ${read(table)}`),`HISTORY_SERVICE_READ:${table}`);
  denied(h.probe(`SET LOCAL ROLE service_role; ${write(insert(table,fresh(f.a[table])))}`),`HISTORY_SERVICE_INSERT:${table}`);
  for(const side of ['a','b']){
   const row=f[side][table],actor=actors[side],tenant=row.tenant_id;
   rows(backend(h,read(table),actor,tenant),[row.id],`HISTORY_BACKEND_READ:${table}`);
   rows(backend(h,write(insert(table,fresh(row))),actor,tenant),[0],`HISTORY_BACKEND_INSERT:${table}`);
   denied(backend(h,write(insert(table,fresh(row))),actor,tenant,'read'),`HISTORY_ACTION:${table}`);
   denied(backend(h,read(table),actor,f[side==='a'?'b':'a'][table].tenant_id),`HISTORY_TENANT:${table}`);
   for(const action of (table==='source_heads'?['DELETE']:['UPDATE','DELETE']))denied(backend(h,write(action==='UPDATE'?`UPDATE public.${table} SET provenance='{}' WHERE id=${q(row.id)}`:`DELETE FROM public.${table} WHERE id=${q(row.id)}`),actor,tenant),`HISTORY_IMMUTABLE:${table}:${action}`);
   h.sql(`UPDATE memberships SET status='revoked' WHERE tenant_id=${q(tenant)} AND user_id=${q(actor.id)}`);
   try{denied(backend(h,read(table),actor,tenant),'HISTORY_REVOKED_READ');denied(backend(h,write(insert(table,fresh(row))),actor,tenant),'HISTORY_REVOKED_INSERT');}finally{h.sql(`UPDATE memberships SET status='active' WHERE tenant_id=${q(tenant)} AND user_id=${q(actor.id)}`);}
  }
  for(const key of ['viewer','operator','analyst','dual','outsider']){
   const result=backend(h,write(insert(table,fresh(f.a[table]))),actors[key],f.a[table].tenant_id);
   if(['analyst','dual'].includes(key))rows(result,[0],`HISTORY_ROLE_POSITIVE:${key}`);else denied(result,`HISTORY_ROLE_DENY:${key}`);
  }
 }
}
export function fk(h,f,key){
 const table=key.table,row=fresh(f.a[table]);
 const sourceColumn=Object.keys(key.mapping).find(k=>k!=='tenant_id');
 if(table==='source_revisions'&&['customer_id','product_id','order_id','conversation_id','message_id'].includes(sourceColumn)){
  for(const c of ['customer','product','order','conversation','message'])row[c+'_id']=null;
  const col=Object.keys(key.mapping).find(k=>k!=='tenant_id');row.entity_type=col.slice(0,-3);row[col]=f.a[key.parent].id;row.canonical_id=row[col];
 }
 if(table==='source_revisions'&&(sourceColumn?.startsWith('related_')||sourceColumn==='message_revision_id'))row[sourceColumn]=f.a[key.parent].id;
 if(table==='source_quarantine'&&sourceColumn==='original_revision_id')row[sourceColumn]=f.a.source_revisions.id;
 if(table==='source_heads'&&key.parent==='source_revisions'){row.id=f.a.source_revisions.canonical_id;row.selected_revision_id=f.a.source_revisions.id;row.state='selected';}
 const probe=r=>h.probe(`${table==='source_heads'&&key.parent==='source_revisions'?`DELETE FROM source_heads WHERE id=${q(row.id)};`:''} ALTER TABLE public.${table} DISABLE TRIGGER USER; ${write(insert(table,r))} SET CONSTRAINTS ALL IMMEDIATE;`);
 rows(probe(row),[0],`HISTORY_FK_POSITIVE:${key.name}`);
 const bad={...row};
 if(key.parent==='organizations')bad.tenant_id=randomUUID();
 else for(const [col,ref] of Object.entries(key.mapping))if(col!=='tenant_id'&&!(table==='source_heads'&&col==='id'))bad[col]=f.b[key.parent][ref];
 if(table==='source_revisions'&&['customer_id','product_id','order_id','conversation_id','message_id'].includes(sourceColumn))bad.canonical_id=bad[Object.keys(key.mapping).find(k=>k!=='tenant_id')];
 const result=probe(bad);assert.equal(result.code,'23503',`HISTORY_FK_CROSS:${key.name}`);assert.equal(result.constraint,key.name,`HISTORY_FK_TARGET:${key.name}`);
}

export function selectionFence(h,f,actors){
 if(!present(h).includes('source_heads'))return;
 const row=f.a.source_heads,tenant=row.tenant_id;
 // Valid FK and unchanged revision: only authorization/CAS/audit fence may reject.
 const attack=write(`UPDATE source_heads SET state='selected',version=version+1 WHERE id=${q(row.id)}`);
 denied(backend(h,attack,actors.a,tenant,'read'),'HEAD_READ_ACTION_UPDATE');
 const swap=backend(h,write(`UPDATE source_heads SET tenant_id=${q(f.b.source_heads.tenant_id)} WHERE id=${q(row.id)}`),actors.dual,tenant);
 assert.equal(swap.code,'23514','HEAD_TENANT_IMMUTABLE');
 const alien=f.b.source_revisions.id;
 const result=h.probe(write(`UPDATE source_heads SET selected_revision_id=${q(alien)} WHERE id=${q(row.id)}`));
 assert.equal(result.code,'23503','HEAD_SELECTED_TENANT_FK');
 denied(backend(h,attack,actors.analyst,tenant),'P1_OWNER_SELECTION_BYPASS_ANALYST_DIRECT_HEAD_UPDATE');
}
