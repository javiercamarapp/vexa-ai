import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {q,insert,ident} from '../matrix.mjs';
import {read,write,denied} from '../harness.mjs';
import {backend} from '../import-uploads/oracles.mjs';

const org=['organizations',{tenant_id:'id'}];
const edge=(parent,column,target='id')=>[parent,{tenant_id:'tenant_id',[column]:target}];
const member=column=>edge('memberships',column,'user_id');
export const expected={
 retention_policies:[org,member('actor_id')],
 retention_ledger:[edge('connections','connection_id'),member('actor_id')],
 retention_artifacts:[edge('connections','connection_id')],
 retention_redactions:[edge('retention_ledger','request_id')],
 history_batches:[org,member('owner_id'),edge('connections','connection_id')],
 history_items:[edge('history_batches','batch_id'),edge('conversations','conversation_id'),edge('jobs','extraction_job'),edge('jobs','embedding_job')],
 retention_web_requests:[member('actor_id')],
 learning_cohorts:[org,member('actor_id'),edge('connections','connection_id')],
 learning_items:[edge('learning_cohorts','cohort_id'),edge('extraction_runs','run_id'),edge('conversations','conversation_id'),edge('customers','customer_id')],
 learning_feedback:[['learning_items',{tenant_id:'tenant_id',cohort_id:'cohort_id',ordinal:'ordinal'}],member('actor_id')],
 candidate_results:[org,member('actor_id')],
 candidate_selections:[org,member('actor_id'),edge('candidate_results','result_id')],
 team_invitations:[org],team_audit:[org],
};
export const tables=Object.keys(expected);
export const present=h=>h.json(`select coalesce(json_agg(relname order by relname),'[]') from pg_class where relnamespace='public'::regnamespace and relkind='r' and relname=any(array[${tables.map(q)}])`);
export function requireTables(h,required){assert.deepEqual(present(h),[...required].sort(),'RELEASE_REQUIRED_TABLES');}
const canonical=entries=>entries.map(([parent,mapping])=>JSON.stringify([parent,Object.entries(mapping).sort()])).sort();
export function schema(h,fks){
 for(const table of present(h)){
  assert.deepEqual(h.json(`select json_build_array(c.relrowsecurity,c.relforcerowsecurity,a.attnotnull,format_type(a.atttypid,a.atttypmod)) from pg_class c join pg_attribute a on a.attrelid=c.oid and a.attname='tenant_id' where c.oid=${q('public.'+table)}::regclass`),[true,true,true,'uuid'],`RELEASE_TABLE_RLS_TENANT:${table}`);
  const own=fks.filter(x=>x.table===table);assert.ok(own.every(x=>x.validated),`RELEASE_TABLE_FK_VALIDATED:${table}`);
  assert.deepEqual(canonical(own.map(x=>[x.parent,x.mapping])),canonical(expected[table]),`RELEASE_TABLE_FK_SET:${table}`);
  for(const role of ['anon','authenticated'])for(const privilege of ['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'])assert.equal(h.sql(`select has_table_privilege(${q(role)},${q('public.'+table)},${q(privilege)})`),'f',`RELEASE_TABLE_RAW_GRANT:${table}:${role}:${privilege}`);
 }
}
// Dedicated SYN rows exercise physical constraints separately from domain workflows.
// Only USER triggers are disabled for admin fixture construction; internal RI remains enabled.
export function seed(h,f,actors){
 const installed=new Set(present(h));
 for(const side of ['a','b']){
  const r=f[side],tenant=r.connections.tenant_id,actor=actors[side].id,hash='a'.repeat(64);
  const ledger=randomUUID(),batch=randomUUID(),cohort=randomUUID(),result=randomUUID();
  const data={
   retention_policies:{tenant_id:tenant,version:1,backup_ttl_seconds:3600,active_erasure:'immediate',business_history:'retain-authorized-audit',actor_id:actor},
   retention_ledger:{tenant_id:tenant,id:ledger,connection_id:r.connections.id,entity_type:'message',external_id:'SYN-release-'+side,actor_id:actor,policy_version:1},
   retention_artifacts:{tenant_id:tenant,id:randomUUID(),connection_id:r.connections.id,entity_type:'message',source_key:'SYN-release-'+side,class:'backup',object_path:tenant+'/SYN-release-'+side,expires_at:'2030-01-01T00:00:00Z'},
   retention_redactions:{tenant_id:tenant,request_id:ledger,table_name:'extraction_runs',row_id:r.extraction_runs.id,before_hash:hash,after_hash:hash},
   history_batches:{tenant_id:tenant,id:batch,owner_id:actor,connection_id:r.connections.id,request_key:randomUUID(),extraction_hash:hash,embedding_hash:hash},
   history_items:{tenant_id:tenant,batch_id:batch,conversation_id:r.conversations.id,extraction_job:r.jobs.id,embedding_job:r.jobs.id},
   retention_web_requests:{tenant_id:tenant,request_id:randomUUID(),actor_id:actor,token_hash:hash,result:{}},
   learning_cohorts:{tenant_id:tenant,id:cohort,actor_id:actor,connection_id:r.connections.id,window_start:'2020-01-01T00:00:00Z',cutoff:'2026-01-01T00:00:00Z',taxonomy_hash:hash,taxonomy:[],item_count:1},
   learning_items:{tenant_id:tenant,cohort_id:cohort,ordinal:1,run_id:r.extraction_runs.id,conversation_id:r.conversations.id,customer_id:r.customers.id,input_hash:hash,result_hash:hash,manifest_hash:hash},
   learning_feedback:{tenant_id:tenant,cohort_id:cohort,ordinal:1,version:1,actor_id:actor,verdict:'abstain',labels:[],topic_correct:false,evidence_sufficient:false,decision_possible:false},
   candidate_results:{tenant_id:tenant,id:result,actor_id:actor,candidate_id:'SYN-release',config_hash:hash,envelope:{}},
   candidate_selections:{tenant_id:tenant,version:1,actor_id:actor,candidate_id:'SYN-release',config_hash:hash,base_hash:hash,result_id:result,operation:'select',reason:'validated_evaluation',evidence_hash:hash},
   team_invitations:{tenant_id:tenant,id:randomUUID(),request_id:randomUUID(),email:'syn-release-'+side+'@example.test',role:'viewer',created_by:actor,created_at:'2026-01-01T00:00:00Z',expires_at:'2030-01-01T00:00:00Z'},
   team_audit:{tenant_id:tenant,actor_id:actor,operation:'SYN-fixture',target_id:randomUUID()},
  };
  for(const [table,row] of Object.entries(data))if(installed.has(table)){
   h.sql(`begin;alter table public.${ident(table)} disable trigger user;${insert(table,row)};alter table public.${ident(table)} enable trigger user;commit;`);
   // Keep supplemental physical fixtures outside the legacy retrieval canary inventory.
   Object.defineProperty(r,table,{value:h.json(`select to_jsonb(r) from public.${ident(table)} r where tenant_id=${q(tenant)}`)});
  }
 }
}
export function access(h,f,actors){
 for(const table of present(h)){
  const statement=read(table),a=f.a[table].tenant_id,b=f.b[table].tenant_id;
  denied(h.probe(statement,null),`RELEASE_ANON:${table}`);
  denied(h.probe(statement,actors.a),`RELEASE_RAW_AUTHENTICATED:${table}`);
  const readable=h.sql(`select has_table_privilege('vexa_backend',${q('public.'+table)},'SELECT')`)==='t';
  const own=backend(h,statement,actors.a,a,'read');
  if(readable){assert.equal(own.code,'00000',`RELEASE_OWNER_READ:${table}`);assert.equal(own.rows.length,1,`RELEASE_OWNER_ROW:${table}`);assert.equal(own.rows[0].tenant_id,a);}
  else denied(own,`RELEASE_NO_RUNTIME_GRANT:${table}`);
  denied(backend(h,statement,actors.a,b,'read'),`RELEASE_FOREIGN_SELECTOR:${table}`);
  denied(backend(h,statement,actors.outsider,a,'read'),`RELEASE_NONMEMBER:${table}`);
 }
}
export function fk(h,f,key){
 const table=key.table,tenant=f.a[table].tenant_id;
 const probe=side=>{
  const parent=key.parent==='organizations'?{id:side==='a'?tenant:randomUUID()}:f[side][key.parent];
  assert.ok(parent,`RELEASE_FK_PARENT_FIXTURE:${key.name}`);
  const changes=Object.entries(key.mapping).filter(([col])=>key.parent==='organizations'||col!=='tenant_id').map(([col,ref])=>{assert.ok(ref in parent,`RELEASE_FK_COLUMN_FIXTURE:${key.name}:${ref}`);return `${ident(col)}=${q(parent[ref])}`;});
  // Free the nullable unique reference in tenant B, inside this rollback-only probe,
  // so a uniqueness error cannot mask the actual cross-tenant RI assertion.
  const uniqueJob=table==='history_items'&&key.parent==='jobs'&&side==='b'?Object.keys(key.mapping).find(col=>col!=='tenant_id'):null;
  const releaseUnique=uniqueJob?`update public.history_items set ${ident(uniqueJob)}=null where tenant_id=${q(f.b[table].tenant_id)};`:'';
  return h.probe(`alter table public.${ident(table)} disable trigger user;${releaseUnique}${write(`update public.${ident(table)} set ${changes.join(',')} where tenant_id=${q(tenant)}`)}set constraints all immediate;`);
 };
 // Positive INSERTs were checked with internal RI active during seed; same-value UPDATE is a fixture sanity check.
 const positive=probe('a');assert.equal(positive.code,'00000',`RELEASE_FK_POSITIVE:${key.name}`);assert.equal(positive.rows[0]?.affected,1,`RELEASE_FK_ROW:${key.name}`);
 const negative=probe('b');assert.equal(negative.code,'23503',`${key.parent==='organizations'?'RELEASE_FK_ORPHAN':'RELEASE_FK_CROSS'}:${key.name}:${negative.message}`);assert.ok(negative.constraint,`RELEASE_FK_CONSTRAINT:${key.name}`);
}
