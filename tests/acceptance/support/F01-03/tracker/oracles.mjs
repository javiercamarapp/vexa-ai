// Examen externo de 0052_tracker_ingestion: cinco tablas privadas SOLO-INSERT (salvo el cierre de tracker_sheet_jobs).
// Derivado de lo que la migración hace: FORCE RLS; authenticated/anon/service_role sin ningún privilegio;
// vexa_backend SELECT+INSERT (UPDATE solo en las columnas state,updated_at de tracker_sheet_jobs); lectura por
// vexa.tenant_id + vexa_member (cualquier rol); escritura con acción 'import' (owner/analyst).
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {q,insert} from '../matrix.mjs';
import {read,write,rows,denied} from '../harness.mjs';
import {backend} from '../import-uploads/oracles.mjs';
export const tables=['tracker_versions','tracker_sheet_jobs','tracker_row_revisions','tracker_row_observations','tracker_row_rejections'];
export const present=h=>tables.filter(t=>h.sql(`SELECT to_regclass(${q('public.'+t)}) IS NOT NULL`)==='t');
const org=['organizations',{tenant_id:'id'}];
const expected={
 tracker_versions:[org,['connections',{tenant_id:'tenant_id',connection_id:'id'}]],
 tracker_sheet_jobs:[org,['tracker_versions',{tenant_id:'tenant_id',version_id:'id'}]],
 tracker_row_revisions:[org,['tracker_versions',{tenant_id:'tenant_id',first_version_id:'id'}]],
 tracker_row_observations:[org,['tracker_versions',{tenant_id:'tenant_id',version_id:'id'}],['tracker_row_revisions',{tenant_id:'tenant_id',revision_id:'id'}]],
 tracker_row_rejections:[org,['tracker_versions',{tenant_id:'tenant_id',version_id:'id'}]],
};
const primary={
 tracker_versions:['id'],tracker_sheet_jobs:['id'],tracker_row_revisions:['id'],
 tracker_row_observations:['row_number','sheet_name','tenant_id','version_id'],
 tracker_row_rejections:['code','row_number','sheet_name','tenant_id','version_id'],
};
const functions=['tracker_revision_id(uuid,uuid,text,integer,text)','tracker_ingest_batch(uuid,text,jsonb,jsonb)','tracker_close_sheet(uuid,text)'];
const hex=()=>randomBytes(32).toString('hex');
const keyOf=(table,row)=>JSON.stringify(primary[table].map(c=>row[c]));
export function schema(h,fks){
 assert.deepEqual(present(h),tables,'TRACKER_ALL_TABLES');
 for(const table of tables){
  const reg=q('public.'+table);
  assert.deepEqual(h.json(`SELECT jsonb_build_array(relrowsecurity,relforcerowsecurity) FROM pg_class WHERE oid=${reg}::regclass`),[true,true],'TRACKER_FORCE_RLS:'+table);
  assert.equal(h.sql(`SELECT attnotnull FROM pg_attribute WHERE attrelid=${reg}::regclass AND attname='tenant_id'`),'t','TRACKER_TENANT_NONNULL:'+table);
  assert.deepEqual(h.json(`SELECT jsonb_agg(a.attname::text ORDER BY a.attname) FROM pg_constraint c JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=ANY(c.conkey) WHERE c.conrelid=${reg}::regclass AND c.contype='p'`),primary[table],'TRACKER_PK:'+table);
  for(const role of ['anon','authenticated','service_role','vexa_backend'])for(const action of ['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']){
   const allowed=role==='vexa_backend'&&(['SELECT','INSERT'].includes(action));
   assert.equal(h.sql(`SELECT has_table_privilege(${q(role)},${reg},${q(action)})`),allowed?'t':'f',`TRACKER_GRANT:${table}:${role}:${action}`);
  }
  // UPDATE solo existe como privilegio de columna y solo en el cierre del job de hoja.
  for(const role of ['anon','authenticated','service_role','vexa_backend']){
   const cols=h.json(`SELECT coalesce(jsonb_agg(a.attname::text ORDER BY a.attname),'[]'::jsonb) FROM pg_attribute a WHERE a.attrelid=${reg}::regclass AND a.attnum>0 AND NOT a.attisdropped AND has_column_privilege(${q(role)},${reg},a.attname,'UPDATE')`);
   assert.deepEqual(cols,role==='vexa_backend'&&table==='tracker_sheet_jobs'?['state','updated_at']:[],`TRACKER_UPDATE_COLUMNS:${table}:${role}`);
  }
  const keys=fks.filter(f=>f.table===table);
  assert.equal(keys.length,expected[table].length,'TRACKER_FK_COUNT:'+table);
  for(const [parent,mapping] of expected[table])assert.ok(keys.some(f=>f.parent===parent&&f.validated&&JSON.stringify(Object.entries(f.mapping).sort())===JSON.stringify(Object.entries(mapping).sort())),'TRACKER_FK_REQUIRED:'+table+':'+parent);
  assert.equal(h.sql(`SELECT count(*) FROM pg_trigger WHERE tgrelid=${reg}::regclass AND NOT tgisinternal`),'0','TRACKER_NO_USER_TRIGGERS:'+table);
 }
 // Vista de cabezas: security_invoker (aplica la RLS de quien consulta) y solo vexa_backend la lee.
 assert.equal(h.sql("SELECT coalesce((SELECT 'security_invoker=true'=ANY(reloptions) FROM pg_class WHERE oid='public.tracker_row_heads'::regclass),false)"),'t','TRACKER_HEADS_SECURITY_INVOKER');
 for(const role of ['anon','authenticated','service_role','vexa_backend'])for(const action of ['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'])
  assert.equal(h.sql(`SELECT has_table_privilege(${q(role)},'public.tracker_row_heads',${q(action)})`),role==='vexa_backend'&&action==='SELECT'?'t':'f',`TRACKER_HEADS_GRANT:${role}:${action}`);
 for(const role of ['anon','authenticated','service_role','vexa_backend'])for(const fn of functions)
  assert.equal(h.sql(`SELECT has_function_privilege(${q(role)},${q('public.'+fn)},'EXECUTE')`),role==='vexa_backend'?'t':'f',`TRACKER_FUNCTION_GRANT:${fn}:${role}`);
}
export function seed(h,f,actors){
 const out={actors};
 for(const side of ['a','b']){
  const c=f[side].connections,tenant=c.tenant_id;
  const versions={id:randomUUID(),tenant_id:tenant,connection_id:c.id,file_sha256:'a'.repeat(64),label:'SYN',rank:1};
  const jobs={id:randomUUID(),tenant_id:tenant,version_id:versions.id,sheet_name:'SYN',sheet_state:'visible',expected_rows:1,expected_cells:1,state:'open'};
  const revisions={id:randomUUID(),tenant_id:tenant,connection_id:c.id,sheet_name:'SYN',row_number:2,row_hash:'b'.repeat(64),cells:[],ticket_state:'no_ticket',first_version_id:versions.id};
  const observations={tenant_id:tenant,version_id:versions.id,sheet_name:'SYN',row_number:2,revision_id:revisions.id};
  const rejections={tenant_id:tenant,version_id:versions.id,sheet_name:'SYN',row_number:3,code:'ROW_REJECTED',field:null,raw_hash:'c'.repeat(64)};
  const seeded={tracker_versions:versions,tracker_sheet_jobs:jobs,tracker_row_revisions:revisions,tracker_row_observations:observations,tracker_row_rejections:rejections};
  for(const table of tables)h.sql(insert(table,seeded[table])+';');
  out[side]={...seeded,connections:c,organizations:{id:tenant}};
 }
 return out;
}
// Fila nueva válida (mismos padres, identidad natural distinta) para probar INSERT sin colisión de unicidad.
function fresh(table,row,n){
 switch(table){
  case 'tracker_versions':return {...row,id:randomUUID(),file_sha256:hex(),rank:row.rank+n};
  case 'tracker_sheet_jobs':return {...row,id:randomUUID(),sheet_name:'SYN-'+randomUUID()};
  case 'tracker_row_revisions':return {...row,id:randomUUID(),row_number:row.row_number+n,row_hash:hex()};
  case 'tracker_row_observations':return {...row,row_number:row.row_number+n};
  case 'tracker_row_rejections':return {...row,row_number:row.row_number+n,code:'OTHER_REJECTION'};
 }
}
const keys=(table,r)=>r.rows.map(x=>keyOf(table,x)).sort();
export function access(h,f,actors){
 const A=f.a.tracker_versions.tenant_id,B=f.b.tracker_versions.tenant_id;
 const same=(table,r,ids,label)=>{assert.equal(r.code,'00000',label);assert.deepEqual(keys(table,r),ids.map(x=>keyOf(table,x)).sort(),label);};
 for(const table of tables){
  const a=f.a[table],b=f.b[table];
  // 1. Ninguna ruta directa (anon, authenticated de cualquier rol, service_role): sin grants.
  for(const who of [null,...Object.values(actors)])denied(h.probe(read(table),who),'TRACKER_DIRECT_READ_DENIED:'+table);
  denied(h.probe('SET LOCAL ROLE service_role; '+read(table)),'TRACKER_SERVICE_DENIED:'+table);
  for(const who of [null,actors.a,actors.dual])denied(h.probe(write(insert(table,fresh(table,a,1))),who),'TRACKER_DIRECT_INSERT_DENIED:'+table);
  // 2. Lectura backend: tenant del scope + membresía vigente (cualquier rol); aislamiento entre tenants.
  for(const key of ['a','analyst','operator','viewer','dual'])same(table,backend(h,read(table),actors[key],A,'read'),[a],`TRACKER_READ_A:${table}:${key}`);
  same(table,backend(h,read(table),actors.b,B,'read'),[b],'TRACKER_READ_B:'+table);
  same(table,backend(h,read(table),actors.dual,B,'read'),[b],'TRACKER_DUAL_SELECTS_B:'+table);
  same(table,backend(h,read(table),actors.outsider,A,'read'),[],'TRACKER_OUTSIDER_DENIED:'+table);
  for(const [who,tenant] of [[actors.a,B],[actors.a,null],[actors.dual,null],[actors.b,A]])same(table,backend(h,read(table),who,tenant,'read'),[],'TRACKER_WRONG_SCOPE:'+table);
  const revoked=`UPDATE memberships SET status='revoked' WHERE user_id=${q(actors.a.id)} AND tenant_id=${q(A)};`;
  same(table,backend(h,read(table),actors.a,A,'read',revoked),[],'TRACKER_REVOKED_READ:'+table);
  // 3. INSERT: acción import + owner/analyst + tenant del scope (cada probe hace rollback).
  const row=fresh(table,a,1);
  for(const key of ['a','analyst'])rows(backend(h,write(insert(table,row)),actors[key],A,'import'),[0],`TRACKER_INSERT_POSITIVE:${table}:${key}`);
  for(const key of ['viewer','operator','outsider'])denied(backend(h,write(insert(table,row)),actors[key],A,'import'),`TRACKER_INSERT_ROLE:${table}:${key}`);
  for(const action of ['read','configure','retain','approve','execute','propose'])denied(backend(h,write(insert(table,row)),actors.a,A,action),`TRACKER_INSERT_ACTION:${table}:${action}`);
  denied(backend(h,write(insert(table,row)),actors.a,A,''),'TRACKER_INSERT_NO_ACTION:'+table);
  denied(backend(h,write(insert(table,fresh(table,b,1))),actors.dual,A,'import'),'TRACKER_INSERT_FOREIGN_TENANT:'+table);
  denied(backend(h,write(insert(table,fresh(table,b,1))),actors.a,B,'import'),'TRACKER_INSERT_NOT_MEMBER_OF_SCOPE:'+table);
  denied(backend(h,write(insert(table,row)),actors.a,A,'import',revoked),'TRACKER_INSERT_REVOKED:'+table);
  // 4. Solo-INSERT: sin DELETE ni UPDATE (salvo cierre de job), ni con la acción más fuerte.
  for(const action of ['import','retain','configure'])denied(backend(h,write(`DELETE FROM public.${table}`),actors.a,A,action),`TRACKER_NO_DELETE:${table}:${action}`);
  if(table!=='tracker_sheet_jobs')for(const action of ['import','configure'])denied(backend(h,write(`UPDATE public.${table} SET created_at=created_at`),actors.a,A,action),`TRACKER_APPEND_ONLY:${table}:${action}`);
  denied(h.probe(write(`UPDATE public.${table} SET tenant_id=tenant_id`),actors.a),'TRACKER_DIRECT_UPDATE_DENIED:'+table);
 }
 // 5. Único campo mutable: cierre del job de hoja (state,updated_at), con acción import por owner/analyst.
 const job=f.a.tracker_sheet_jobs,close=where=>write(`UPDATE public.tracker_sheet_jobs SET state='closed',updated_at=now() WHERE ${where}`);
 const mine=`id=${q(job.id)}`;
 for(const key of ['a','analyst'])rows(backend(h,close(mine),actors[key],A,'import'),[0],'TRACKER_CLOSE_POSITIVE:'+key);
 for(const key of ['viewer','operator','outsider'])denied(backend(h,close(mine),actors[key],A,'import'),'TRACKER_CLOSE_ROLE:'+key);
 for(const action of ['read','configure','retain','approve','execute','propose'])denied(backend(h,close(mine),actors.a,A,action),'TRACKER_CLOSE_ACTION:'+action);
 denied(backend(h,close(`id=${q(f.b.tracker_sheet_jobs.id)}`),actors.dual,A,'import'),'TRACKER_CLOSE_FOREIGN_TENANT');
 denied(backend(h,close(mine),actors.dual,B,'import'),'TRACKER_CLOSE_WRONG_SCOPE');
 for(const [col,value] of [['tenant_id',B],['version_id',f.b.tracker_versions.id],['sheet_name','X'],['sheet_state','hidden'],['expected_rows',99],['expected_cells',99],['created_at','2000-01-01'],['id',randomUUID()]])
  denied(backend(h,write(`UPDATE public.tracker_sheet_jobs SET ${col}=${q(value)} WHERE ${mine}`),actors.a,A,'import'),'TRACKER_JOB_IMMUTABLE_COLUMN:'+col);
 assert.equal(backend(h,write(`UPDATE public.tracker_sheet_jobs SET state='archived' WHERE ${mine}`),actors.a,A,'import').code,'23514','TRACKER_JOB_STATE_DOMAIN');
 // 6. Funciones de ingesta: solo vexa_backend, SECURITY INVOKER (la RLS sigue mandando).
 const batch=(version,sheet,hash)=>`result:=jsonb_build_array(public.tracker_ingest_batch(${q(version)},${q(sheet)},${q(JSON.stringify([{row_number:50,row_hash:hash,cells:[],ticket_state:'no_ticket'}]))}::jsonb));`;
 const hash=hex();
 for(const key of ['a','analyst']){
  const r=backend(h,batch(f.a.tracker_versions.id,'SYN',hash),actors[key],A,'import');
  assert.equal(r.code,'00000','TRACKER_BATCH_POSITIVE:'+key);assert.equal(r.rows[0].inserted,1,'TRACKER_BATCH_COUNTS:'+key);assert.equal(r.rows[0].rejected,0,'TRACKER_BATCH_REJECTED:'+key);
 }
 for(const key of ['viewer','operator','outsider'])denied(backend(h,batch(f.a.tracker_versions.id,'SYN',hash),actors[key],A,'import'),'TRACKER_BATCH_ROLE:'+key);
 denied(backend(h,batch(f.a.tracker_versions.id,'SYN',hash),actors.a,A,'read'),'TRACKER_BATCH_ACTION');
 // Versión de otro tenant: no existe en el scope (VERSION_UNKNOWN), y no se escribe nada.
 assert.notEqual(backend(h,batch(f.b.tracker_versions.id,'SYN',hash),actors.dual,A,'import').code,'00000','TRACKER_BATCH_FOREIGN_VERSION');
 // Hoja cerrada ya no admite lotes (SHEET_JOB_NOT_OPEN).
 const closed=`UPDATE tracker_sheet_jobs SET state='closed' WHERE id=${q(job.id)};`;
 assert.notEqual(backend(h,batch(f.a.tracker_versions.id,'SYN',hash),actors.a,A,'import',closed).code,'00000','TRACKER_BATCH_CLOSED_SHEET');
 // Sin scope de tenant la función no opera.
 assert.notEqual(backend(h,batch(f.a.tracker_versions.id,'SYN',hash),actors.a,null,'import').code,'00000','TRACKER_BATCH_NO_SCOPE');
 // El cierre exige filas aceptadas + rechazadas == esperadas (la semilla tiene 1 observación y 1 rechazo en filas distintas -> 2 != 1).
 assert.notEqual(backend(h,`PERFORM public.tracker_close_sheet(${q(f.a.tracker_versions.id)},'SYN');`,actors.a,A,'import').code,'00000','TRACKER_CLOSE_COUNT_MISMATCH');
}
export function fk(h,f,key){
 const table=key.table,source=f.a[table];
 const probe=r=>h.probe(write(insert(table,r))+' SET CONSTRAINTS ALL IMMEDIATE;');
 const row=fresh(table,source,7);
 rows(probe(row),[0],'TRACKER_FK_POSITIVE:'+key.name);
 const bad={...row};
 if(key.parent==='organizations')bad.tenant_id=randomUUID();
 else for(const [col,ref] of Object.entries(key.mapping))if(col!=='tenant_id')bad[col]=f.b[key.parent][ref];
 const r=probe(bad);
 assert.equal(r.code,'23503','TRACKER_FK_CROSS:'+key.name);
 assert.ok(r.constraint,'TRACKER_FK_CONSTRAINT:'+key.name);
}
