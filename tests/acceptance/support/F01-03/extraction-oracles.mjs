import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {q,insert} from './matrix.mjs';import {read,write,rows,denied} from './harness.mjs';import {backend} from './import-uploads/oracles.mjs';
export const tables=['redaction_maps','extraction_claims','extraction_inputs','extraction_requests'];
export const present=h=>tables.filter(name=>h.sql(`SELECT to_regclass(${q('public.'+name)}) IS NOT NULL`)==='t');
const expected={extraction_requests:[['organizations',{tenant_id:'id'}],['jobs',{tenant_id:'tenant_id',job_id:'id'}],['conversations',{tenant_id:'tenant_id',conversation_id:'id'}],['memberships',{tenant_id:'tenant_id',actor_id:'user_id'}]],redaction_maps:[['organizations',{tenant_id:'id'}],['message_revisions',{tenant_id:'tenant_id',original_revision_id:'id'}],['message_revisions',{tenant_id:'tenant_id',redacted_revision_id:'id'}]],extraction_claims:[['organizations',{tenant_id:'id'}],['extraction_runs',{tenant_id:'tenant_id',run_id:'id'}],['jobs',{tenant_id:'tenant_id',job_id:'id'}]],extraction_inputs:[['organizations',{tenant_id:'id'}],['extraction_runs',{tenant_id:'tenant_id',run_id:'id'}],['redaction_maps',{tenant_id:'tenant_id',redaction_id:'id'}]]};
export function schema(h,fks){assert.deepEqual(present(h),tables,'EXTRACTION_REQUIRED_TABLES');for(const table of tables){
 assert.deepEqual(h.json(`SELECT jsonb_build_array(relrowsecurity,relforcerowsecurity) FROM pg_class WHERE oid=${q('public.'+table)}::regclass`),[true,true],'EXTRACTION_FORCE_RLS:'+table);
 assert.equal(h.sql(`SELECT attnotnull FROM pg_attribute WHERE attrelid=${q('public.'+table)}::regclass AND attname='tenant_id'`),'t','EXTRACTION_TENANT_REQUIRED');
 for(const role of ['anon','authenticated','service_role','vexa_backend'])for(const action of ['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'])assert.equal(h.sql(`SELECT has_table_privilege(${q(role)},${q('public.'+table)},${q(action)})`),role==='vexa_backend'&&['SELECT','INSERT'].includes(action)?'t':'f','EXTRACTION_GRANT:'+table+':'+role+':'+action);
 const own=fks.filter(k=>k.table===table);assert.equal(own.length,expected[table].length,'EXTRACTION_FK_COUNT:'+table);for(const[parent,mapping]of expected[table])assert.ok(own.some(k=>k.parent===parent&&k.validated&&JSON.stringify(Object.entries(k.mapping).sort())===JSON.stringify(Object.entries(mapping).sort())),'EXTRACTION_FK_REQUIRED:'+table+':'+parent);
}}
export function seed(h,f,actors){const out={};for(const side of ['a','b']){
 const tenant=f[side].jobs.tenant_id,job={...f[side].jobs,id:randomUUID(),type:'extraction',state:'running',input_hash:'SYN-extraction-'+randomUUID()},original=f[side].message_revisions,redacted={...original,id:randomUUID(),revision:'SYN-redacted',redacted_text:'SYN [REDACTED]',redaction_version:'SYN-v1'};
 const run={...f[side].extraction_runs,id:randomUUID(),job_id:job.id,status:'running',input_hash:'SYN-extraction'},map={id:randomUUID(),tenant_id:tenant,original_revision_id:original.id,redacted_revision_id:redacted.id,policy_hash:'a'.repeat(64),private_map:[{synthetic:true}]};
 const claim={id:randomUUID(),tenant_id:tenant,run_id:run.id,job_id:job.id,task_key:'SYN-'+randomUUID(),actor_id:actors[side].id,owner_token:randomUUID()},input={id:randomUUID(),tenant_id:tenant,run_id:run.id,redaction_id:map.id};
 for(const[table,row]of [['jobs',job],['message_revisions',redacted],['extraction_runs',run],['redaction_maps',map],['extraction_claims',claim],['extraction_inputs',input]])h.sql(insert(table,row)+';');
 const queueJob={...job,id:randomUUID(),state:'queued',input_hash:'SYN-queue-'+randomUUID()},request={id:randomUUID(),tenant_id:tenant,job_id:queueJob.id,conversation_id:f[side].conversations.id,actor_id:actors[side].id,request_key:randomUUID(),config_hash:'b'.repeat(64)};h.sql(insert('jobs',queueJob)+';'+insert('extraction_requests',request)+';');
 out[side]={extraction_requests:request,...f[side],jobs:job,message_revisions:redacted,extraction_runs:run,redaction_maps:map,extraction_claims:claim,extraction_inputs:input};
}return out;}
const scan=(r,want,label)=>{assert.equal(r.code,'00000',label);assert.equal(r.rows.length,want,label);};
export function access(h,f,a){const A=f.a.jobs.tenant_id,B=f.b.jobs.tenant_id;
 for(const table of tables){
  for(const actor of [null,...Object.values(a)])denied(h.probe(read(table),actor),'EXTRACTION_DIRECT_DENIED:'+table);
  denied(h.probe('SET LOCAL ROLE service_role;'+read(table)),'EXTRACTION_SERVICE_DENIED:'+table);
  for(const name of ['a','analyst','dual'])scan(backend(h,read(table),a[name],A,'read'),1,'EXTRACTION_PRIVATE_READ:'+name+':'+table);
  for(const name of ['operator','viewer','outsider'])scan(backend(h,read(table),a[name],A,'read'),0,'EXTRACTION_PRIVATE_ROLE:'+name+':'+table);
  for(const[actor,tenant]of [[a.a,B],[a.dual,null]])scan(backend(h,read(table),actor,tenant,'read'),0,'EXTRACTION_SCOPE:'+table);
  const clean=(tenant)=>`${table==='redaction_maps'?`DELETE FROM extraction_inputs WHERE tenant_id=${q(tenant)};`:''}DELETE FROM ${table} WHERE tenant_id=${q(tenant)};`;
  for(const name of ['a','analyst']){const row={...f.a[table],...(['extraction_claims','extraction_requests'].includes(table)?{actor_id:a[name].id}:{})};rows(backend(h,write(insert(table,row)),a[name],A,'import',clean(A)),[0],'EXTRACTION_INSERT_ALLOWED:'+name+':'+table);}
  for(const name of ['operator','viewer','outsider'])denied(backend(h,write(insert(table,f.a[table])),a[name],A,'import',clean(A)),'EXTRACTION_INSERT_ROLE:'+name+':'+table);
  for(const action of ['read','configure','retain','approve','execute'])denied(backend(h,write(insert(table,f.a[table])),a.a,A,action,clean(A)),'EXTRACTION_ACTION:'+table+':'+action);
  denied(backend(h,write(insert(table,{...f.b[table],...(['extraction_claims','extraction_requests'].includes(table)?{actor_id:a.dual.id}:{})})),a.dual,A,'import',clean(B)),'EXTRACTION_DUAL_INSERT_SCOPE:'+table);
  for(const statement of [`UPDATE ${table} SET id=${q(randomUUID())}`,`DELETE FROM ${table}`])denied(backend(h,write(statement),a.a,A,'import'),'EXTRACTION_APPEND_ONLY:'+table);
  const revoked=`UPDATE memberships SET status='revoked' WHERE tenant_id=${q(A)} AND user_id=${q(a.a.id)};`;
  scan(backend(h,read(table),a.a,A,'read',revoked),0,'EXTRACTION_REVOKED_READ:'+table);
  denied(backend(h,write(insert(table,f.a[table])),a.a,A,'import',clean(A)+revoked),'EXTRACTION_REVOKED_INSERT:'+table);
 }
 const row=f.a.extraction_claims,run=f.a.extraction_runs;
 const complete=write(`UPDATE extraction_runs SET status='failed' WHERE id=${q(run.id)}`),token=`PERFORM set_config('vexa.extraction_owner_token',${q(row.owner_token)},true);`;
 rows(backend(h,token+complete,a.a,A,'import'),[0],'EXTRACTION_VALID_TERMINAL_OWNER');
 assert.equal(backend(h,complete,a.a,A,'import').code,'23514','EXTRACTION_MISSING_OWNER_TOKEN');
 assert.equal(backend(h,token+complete,a.analyst,A,'import').code,'23514','EXTRACTION_WRONG_TERMINAL_ACTOR');
 for(const change of ["input_hash='SYN-altered'","prompt_hash='SYN-altered'",'job_id='+q(f.a.jobs.id===row.job_id?f.a.extraction_runs.id:row.job_id)])assert.notEqual(backend(h,token+write(`UPDATE extraction_runs SET status='failed',${change} WHERE id=${q(run.id)}`),a.a,A,'import').code,'00000','EXTRACTION_IMMUTABLE_INPUT:'+change);
}
export function fk(h,f,key){const row=f.a[key.table],probe=value=>h.probe(`DELETE FROM extraction_requests;DELETE FROM extraction_inputs;${key.table==='redaction_maps'?'DELETE FROM redaction_maps;':key.table==='extraction_claims'?'DELETE FROM extraction_claims;':''}${write(insert(key.table,value))}SET CONSTRAINTS ALL IMMEDIATE;`);rows(probe(row),[0],'EXTRACTION_FK_POSITIVE:'+key.name);const bad={...row};if(key.parent==='organizations')bad.tenant_id=randomUUID();else for(const[col,ref]of Object.entries(key.mapping))if(col!=='tenant_id')bad[col]=key.parent==='memberships'?f.b.extraction_requests.actor_id:f.b[key.parent][ref];const r=probe(bad);assert.equal(r.code,'23503','EXTRACTION_CROSS_FK:'+key.name);assert.ok(r.constraint);}
