import assert from 'node:assert/strict';
import {insert,q,ident} from '../matrix.mjs';
import {read,write,rows,denied} from '../harness.mjs';

export const table='import_uploads';
const expected=[
  ['imports',{tenant_id:'tenant_id',import_id:'id'}],
  ['memberships',{tenant_id:'tenant_id',user_id:'user_id'}],
  ['jobs',{tenant_id:'tenant_id',job_id:'id'}],
];
export const present=h=>h.sql("SELECT to_regclass('public.import_uploads') IS NOT NULL")==='t';
export function schema(h,fks) {
  const c=h.json(`SELECT jsonb_build_object('rls',relrowsecurity,'force',relforcerowsecurity) FROM pg_class WHERE oid='public.import_uploads'::regclass`);
  assert.equal(c.rls,true,'UPLOAD_RLS_DISABLED');
  assert.equal(c.force,true,'UPLOAD_FORCE_DISABLED');
  const cols=h.json(`SELECT jsonb_object_agg(attname,jsonb_build_object('type',format_type(atttypid,atttypmod),'nonnull',attnotnull)) FROM pg_attribute WHERE attrelid='public.import_uploads'::regclass AND attnum>0 AND NOT attisdropped`);
  for(const [name,type,nonnull] of [['tenant_id','uuid',true],['import_id','uuid',true],['user_id','uuid',true],['size','bigint',true],['content_type','text',true],['request_hash','text',true],['expires_at','timestamp with time zone',true],['job_id','uuid',false]])
    assert.deepEqual(cols[name],{type,nonnull},`UPLOAD_COLUMN:${name}`);
  assert.deepEqual(h.json(`SELECT jsonb_agg(a.attname ORDER BY k.n) FROM pg_constraint c CROSS JOIN LATERAL unnest(c.conkey) WITH ORDINALITY k(num,n) JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.num WHERE c.conrelid='public.import_uploads'::regclass AND c.contype='p'`),['import_id'],'UPLOAD_PK');
  for(const role of ['anon','authenticated','service_role','vexa_backend'])for(const privilege of ['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']){
    const allowed=role==='authenticated'?privilege==='SELECT':role==='vexa_backend'&&['SELECT','INSERT','UPDATE'].includes(privilege);
    assert.equal(h.sql(`SELECT has_table_privilege(${q(role)},'public.import_uploads',${q(privilege)})`),allowed?'t':'f',`UPLOAD_GRANT:${role}:${privilege}`);
  }
  const own=fks.filter(fk=>fk.table===table);
  assert.equal(own.length,3,'UPLOAD_FK_COUNT');
  for(const [parent,mapping] of expected)assert.ok(own.some(fk=>fk.parent===parent&&fk.validated&&JSON.stringify(Object.entries(fk.mapping).sort())===JSON.stringify(Object.entries(mapping).sort())),`UPLOAD_FK_MISSING:${parent}`);
}
export function seedUploads(h,f,actors) {
  const result={};
  for(const side of ['a','b']){
    const row={tenant_id:f[side].imports.tenant_id,import_id:f[side].imports.id,user_id:actors[side].id,size:12,content_type:'text/csv',request_hash:'synthetic-upload-'+side,job_id:f[side].jobs.id};
    h.sql(insert(table,row)+';');result[side]=row;
  }
  return result;
}
function uploadRows(result,ids,label){
  assert.equal(result.code,'00000',label);
  assert.deepEqual(result.rows.map(r=>r.import_id).sort(),[...ids].sort(),label);
}
// h.probe defaults to admin only to enter a transaction; the statement and its
// permission checks run as the actual non-bypass product role, never admin.
export function backend(h,statement,actor,tenant,action='import',prepare='') {
  return h.probe(`${prepare} GRANT ALL ON exam_result TO vexa_backend; SET LOCAL ROLE vexa_backend;
    PERFORM set_config('request.jwt.claim.sub',${q(actor.id)},true);
    PERFORM set_config('request.jwt.claims',${q(JSON.stringify({sub:actor.id,role:'authenticated'}))},true);
    PERFORM set_config('vexa.tenant_id',${q(tenant??'')},true);
    PERFORM set_config('vexa.action',${q(action)},true);
    ${statement}`);
}
export function access(h,u,actors) {
  const snapshot=()=>h.sql('SELECT jsonb_agg(to_jsonb(u) ORDER BY import_id) FROM public.import_uploads u');
  const before=snapshot();
  uploadRows(h.probe(read(table),actors.a),[u.a.import_id],'UPLOAD_OWNER_A');
  uploadRows(h.probe(read(table),actors.b),[u.b.import_id],'UPLOAD_OWNER_B');
  for(const key of ['dual','viewer','analyst','operator','outsider'])uploadRows(h.probe(read(table),actors[key]),[],`UPLOAD_OWNER_ONLY:${key}`);
  denied(h.probe(read(table),null),'UPLOAD_ANON');
  const update=side=>write(`UPDATE public.import_uploads SET size=size+1 WHERE import_id=${q(u[side].import_id)}`);
  const del=side=>write(`DELETE FROM public.import_uploads WHERE import_id=${q(u[side].import_id)}`);
  // Delete existing reservation transactionally before INSERT to avoid PK masking.
  const add=side=>`DELETE FROM public.import_uploads WHERE import_id=${q(u[side].import_id)};`;
  for(const actor of [null,...Object.values(actors)])for(const side of ['a','b']){
    denied(h.probe(update(side),actor),'UPLOAD_DIRECT_UPDATE');
    denied(h.probe(del(side),actor),'UPLOAD_DIRECT_DELETE');
    const statement=`RESET ROLE; ${add(side)} SET LOCAL ROLE ${actor?'authenticated':'anon'}; ${write(insert(table,u[side]))}`;
    denied(h.probe(statement,actor),'UPLOAD_DIRECT_INSERT');
  }
  for(const side of ['a','b']){
    const tenant=u[side].tenant_id, actor=actors[side], other=side==='a'?'b':'a';
    for(const action of ['read','import'])uploadRows(backend(h,read(table),actor,tenant,action),[u[side].import_id],`UPLOAD_BACKEND_READ:${side}:${action}`);
    rows(backend(h,update(side),actor,tenant),[0],'UPLOAD_BACKEND_UPDATE');
    rows(backend(h,write(insert(table,u[side])),actor,tenant,'import',add(side)),[0],'UPLOAD_BACKEND_INSERT');
    denied(backend(h,update(side),actor,tenant,'read'),'UPLOAD_READ_CANNOT_UPDATE');
    denied(backend(h,write(insert(table,u[side])),actor,tenant,'read',add(side)),'UPLOAD_READ_CANNOT_INSERT');
    denied(backend(h,del(side),actor,tenant),'UPLOAD_BACKEND_DELETE_DENIED');
    denied(backend(h,update(other),actor,tenant),'UPLOAD_BACKEND_CROSS_UPDATE');
    denied(backend(h,write(insert(table,u[other])),actor,tenant,'import',add(other)),'UPLOAD_BACKEND_CROSS_INSERT');
    uploadRows(backend(h,read(table),actor,u[other].tenant_id),[],'UPLOAD_BACKEND_FOREIGN_SCOPE');
    uploadRows(backend(h,read(table),actor,null),[],'UPLOAD_BACKEND_NO_SCOPE');
  }
  for(const key of ['dual','analyst','viewer','operator','outsider']){
    const actor=actors[key],tenant=u.a.tenant_id;
    uploadRows(backend(h,read(table),actor,tenant),key==='outsider'?[]:[u.a.import_id],`UPLOAD_BACKEND_MEMBER:${key}`);
    const result=backend(h,update('a'),actor,tenant);
    if(['dual','analyst'].includes(key))rows(result,[0],`UPLOAD_BACKEND_IMPORT:${key}`);
    else denied(result,`UPLOAD_BACKEND_IMPORT_DENIED:${key}`);
  }
  for(const side of ['a','b']){
    const actor=actors[side],tenant=u[side].tenant_id;
    const where=`tenant_id=${q(tenant)} AND user_id=${q(actor.id)}`;
    const beforeMembership=h.sql(`SELECT to_jsonb(m) FROM public.memberships m WHERE ${where}`);
    h.sql(`UPDATE public.memberships SET status='revoked' WHERE ${where}`);
    try{
      uploadRows(h.probe(read(table),actor),[],'UPLOAD_REVOKED_OWNER');
      uploadRows(backend(h,read(table),actor,tenant),[],'UPLOAD_REVOKED_BACKEND_READ');
      denied(backend(h,update(side),actor,tenant),'UPLOAD_REVOKED_BACKEND_UPDATE');
      denied(backend(h,write(insert(table,u[side])),actor,tenant,'import',add(side)),'UPLOAD_REVOKED_BACKEND_INSERT');
    }finally{h.sql(`UPDATE public.memberships SET status='active' WHERE ${where}`);}
    assert.equal(h.sql(`SELECT to_jsonb(m) FROM public.memberships m WHERE ${where}`),beforeMembership,'UPLOAD_REVOCATION_RESTORED');
    uploadRows(h.probe(read(table),actor),[u[side].import_id],'UPLOAD_RESTORED_OWNER');
  }
  assert.equal(snapshot(),before,'UPLOAD_NO_PERSISTED_EFFECT');
}
export function fk(h,u,fk) {
  const spec=expected.find(([parent])=>parent===fk.parent);
  assert.ok(spec,'UPLOAD_FK_UNCLASSIFIED');assert.deepEqual(fk.mapping,spec[1],'UPLOAD_FK_MAPPING');
  const probe=row=>h.probe(`ALTER TABLE public.import_uploads DISABLE TRIGGER USER;
    DELETE FROM public.import_uploads WHERE import_id=${q(u.a.import_id)};
    ${write(insert(table,row))} SET CONSTRAINTS ALL IMMEDIATE;`);
  rows(probe(u.a),[0],`UPLOAD_FK_POSITIVE:${fk.parent}`);
  const bad=fk.parent==='imports'?{...u.a,tenant_id:u.b.tenant_id,user_id:u.b.user_id,job_id:u.b.job_id}
    :fk.parent==='memberships'?{...u.a,user_id:u.b.user_id}:{...u.a,job_id:u.b.job_id};
  const result=probe(bad);
  assert.equal(result.code,'23503',`UPLOAD_FK_CROSS:${fk.parent}`);
  assert.equal(result.constraint,fk.name,`UPLOAD_FK_TARGET:${fk.parent}`);
  if(fk.parent==='jobs')rows(probe({...u.a,job_id:null}),[0],'UPLOAD_NULL_JOB');
}
