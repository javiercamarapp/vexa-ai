import assert from 'node:assert/strict';
import {q,insert} from '../matrix.mjs';
import {read,write,rows,denied} from '../harness.mjs';
import {backend} from '../import-uploads/oracles.mjs';
const A='00000000-0000-4000-8000-00000000000a',B='00000000-0000-4000-8000-00000000000b';
export const table='worker_delegations';
export const present=h=>h.sql("SELECT to_regclass('public.worker_delegations') IS NOT NULL")==='t';
export function schema(h,fks){
 assert.deepEqual(h.json(`SELECT jsonb_build_array(relrowsecurity,relforcerowsecurity) FROM pg_class WHERE oid='public.worker_delegations'::regclass`),[true,true],'WORKER_RLS_FORCE');
 assert.deepEqual(h.json(`SELECT coalesce(jsonb_agg(a.attname ORDER BY k.n),'null'::jsonb) FROM pg_constraint c CROSS JOIN LATERAL unnest(c.conkey) WITH ORDINALITY k(num,n) JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.num WHERE c.conrelid='public.worker_delegations'::regclass AND c.contype='p'`),['tenant_id','user_id'],'WORKER_PK');
 for(const col of ['tenant_id','user_id','enabled'])assert.equal(h.sql(`SELECT attnotnull FROM pg_attribute WHERE attrelid='public.worker_delegations'::regclass AND attname=${q(col)}`),'t','WORKER_NOT_NULL:'+col);
 const own=fks.filter(f=>f.table===table);assert.equal(own.length,1,'WORKER_FK_COUNT');assert.deepEqual(own[0].mapping,{tenant_id:'tenant_id',user_id:'user_id'},'WORKER_FK_MAPPING');assert.equal(own[0].parent,'memberships','WORKER_FK_PARENT');assert.equal(own[0].validated,true,'WORKER_FK_VALIDATED');
 const grants=h.json("SELECT jsonb_agg(jsonb_build_object('role',r,'action',a,'allowed',has_table_privilege(r,'public.worker_delegations',a))) FROM unnest(ARRAY['anon','authenticated','service_role','vexa_backend']) r CROSS JOIN unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) a");
 for(const {role,action,allowed} of grants)assert.equal(allowed,role==='vexa_backend'&&['SELECT','INSERT','UPDATE'].includes(action),`WORKER_GRANT:${role}:${action}`);
 for(const signature of ['worker_actor_authorized(uuid)','reserve_worker_scope()']){
  assert.deepEqual(h.json(`SELECT jsonb_build_object('definer',prosecdef,'search',proconfig) FROM pg_proc WHERE oid=${q('public.'+signature)}::regprocedure`),{definer:true,search:['search_path=""']},'WORKER_RPC_NARROW_DEFINER:'+signature);
  for(const {role,allowed} of h.json(`SELECT jsonb_agg(jsonb_build_object('role',r,'allowed',has_function_privilege(r,${q('public.'+signature)},'EXECUTE'))) FROM unnest(ARRAY['anon','authenticated','service_role','vexa_backend']) r`))assert.equal(allowed,role==='vexa_backend',`WORKER_RPC_GRANT:${signature}:${role}`);
 }
}
export function seedWorkers(h,actors){
 const a={tenant_id:A,user_id:actors.analyst.id,enabled:true},b={tenant_id:B,user_id:actors.b.id,enabled:true};
 h.sql(insert(table,a)+';'+insert(table,b)+';');return {a,b};
}
export function fk(h,w,key){
 assert.equal(key.parent,'memberships','WORKER_FK_UNCLASSIFIED');
 const probe=r=>h.probe(`DELETE FROM public.worker_delegations; ALTER TABLE public.worker_delegations DISABLE TRIGGER USER; ${write(insert(table,r))} SET CONSTRAINTS ALL IMMEDIATE;`);
 rows(probe(w.a),[0],'WORKER_FK_POSITIVE');
 const result=probe({...w.a,user_id:w.b.user_id});assert.equal(result.code,'23503','WORKER_FK_CROSS');assert.equal(result.constraint,key.name,'WORKER_FK_TARGET');
}
const clean=side=>`DELETE FROM public.worker_delegations WHERE tenant_id=${q(side)};`;
const change=side=>write(`UPDATE public.worker_delegations SET enabled=false WHERE tenant_id=${q(side)}`);
const scan=(r,expected,label)=>{assert.equal(r.code,'00000',label);assert.deepEqual(r.rows.map(x=>x.tenant_id).sort(),expected.sort(),label);};
const immutability=(r,label)=>{if(r.code!=='23514')denied(r,label);};
function snapshot(h){return h.sql('SELECT jsonb_agg(to_jsonb(d) ORDER BY tenant_id,user_id) FROM public.worker_delegations d');}
function stable(h,fn){const before=snapshot(h);try{fn();}finally{assert.equal(snapshot(h),before,'WORKER_NO_PERSISTED_EFFECT');}}
function rpc(h,fn,actor,scope,action,prepare=''){
 return backend(h,`${actor.id?'':"PERFORM set_config('request.jwt.claims','{}',true);"} SELECT jsonb_build_array(jsonb_build_object('value',public.${fn})) INTO result;`,actor,scope,action,prepare);
}
function value(r,want,label){assert.equal(r.code,'00000',label);assert.equal(r.rows[0].value,want,label);}
export const checks={
 access(h,f,a){stable(h,()=>{
  for(const actor of [null,...Object.values(a)])for(const statement of [read(table),write(insert(table,{tenant_id:A,user_id:a.operator.id,enabled:true})),change(A),write('DELETE FROM public.worker_delegations')])denied(h.probe(statement,actor),'WORKER_DIRECT');
  for(const statement of [read(table),change(A),write(insert(table,{tenant_id:A,user_id:a.operator.id,enabled:true})),write('DELETE FROM public.worker_delegations')])denied(h.probe(`SET LOCAL ROLE service_role; ${statement}`),'WORKER_SERVICE');
  for(const key of ['a','analyst','operator','viewer','dual'])scan(backend(h,read(table),a[key],A,'read'),[A],'WORKER_MEMBER_READ:'+key);
  for(const [actor,scope] of [[a.a,B],[a.outsider,A],[a.a,null]])scan(backend(h,read(table),actor,scope,'read'),[],'WORKER_READ_SCOPE');
  for(const key of ['a','dual']){rows(backend(h,change(A),a[key],A,'configure'),[0],'WORKER_OWNER_UPDATE');rows(backend(h,write(insert(table,f.workers.a)),a[key],A,'configure',clean(A)),[0],'WORKER_OWNER_INSERT');}
  for(const key of ['analyst','operator','viewer','outsider'])for(const statement of [change(A),write(insert(table,{tenant_id:A,user_id:a.operator.id,enabled:true}))])denied(backend(h,statement,a[key],A,'configure'),'WORKER_ROLE:'+key);
  for(const action of ['read','import','worker_dispatch',''])for(const statement of [change(A),write(insert(table,{tenant_id:A,user_id:a.operator.id,enabled:true}))])denied(backend(h,statement,a.a,A,action),'WORKER_ACTION:'+action);
  denied(backend(h,write('DELETE FROM public.worker_delegations'),a.a,A,'configure'),'WORKER_DELETE');
 });},
 scopeInsert(h,f,a){stable(h,()=>{for(const scope of [A,null])denied(backend(h,write(insert(table,f.workers.b)),a.dual,scope,'configure',clean(B)),'P1_WORKER_INSERT_FOREIGN_SCOPE');});},
 scopeUpdate(h,f,a){stable(h,()=>{for(const scope of [A,null])denied(backend(h,change(B),a.dual,scope,'configure'),'P1_WORKER_UPDATE_FOREIGN_SCOPE');});},
 identity(h,f,a){stable(h,()=>{
  immutability(backend(h,write(`UPDATE public.worker_delegations SET user_id=${q(a.operator.id)} WHERE tenant_id=${q(A)}`),a.a,A,'configure'),'P1_WORKER_USER_ID_IMMUTABLE');
  // Both memberships exist, so FK cannot hide a missing tenant immutability fence.
  immutability(backend(h,write(`UPDATE public.worker_delegations SET tenant_id=${q(B)} WHERE tenant_id=${q(A)} AND user_id=${q(a.dual.id)}`),a.dual,A,'configure',insert(table,{tenant_id:A,user_id:a.dual.id,enabled:true})+';'),'WORKER_TENANT_IMMUTABLE');
 });},
 revocation(h,f,a){stable(h,()=>{
  const prep=`UPDATE memberships SET status='revoked' WHERE tenant_id=${q(A)} AND user_id=${q(a.a.id)};`;
  scan(backend(h,read(table),a.a,A,'read',prep),[],'WORKER_REVOKED_READ');
  denied(backend(h,change(A),a.a,A,'configure',prep),'WORKER_REVOKED_UPDATE');
  denied(backend(h,write(insert(table,{tenant_id:A,user_id:a.operator.id,enabled:true})),a.a,A,'configure',prep),'WORKER_REVOKED_INSERT');
 });},
 rpc(h,f,a){stable(h,()=>{
  const job=`worker_actor_authorized(${q(f.a.jobs.id)})`;
  value(rpc(h,job,a.analyst,A,'import'),true,'WORKER_RPC_POSITIVE');
  for(const [actor,scope,action] of [[a.analyst,B,'import'],[a.analyst,null,'import'],[a.a,A,'import'],[a.viewer,A,'import'],[a.outsider,A,'import'],[a.analyst,A,'read']])value(rpc(h,job,actor,scope,action),false,'WORKER_RPC_NARROW');
  value(rpc(h,`worker_actor_authorized(${q(f.b.jobs.id)})`,a.analyst,A,'import'),false,'WORKER_RPC_FOREIGN_JOB');
  for(const prep of [`UPDATE worker_delegations SET enabled=false WHERE tenant_id=${q(A)};`,`UPDATE memberships SET status='revoked' WHERE tenant_id=${q(A)} AND user_id=${q(a.analyst.id)};`,`UPDATE memberships SET status='revoked' WHERE tenant_id=${q(A)} AND user_id=${q(a.a.id)};`,`UPDATE memberships SET role='viewer' WHERE tenant_id=${q(A)} AND user_id=${q(a.a.id)};`])value(rpc(h,job,a.analyst,A,'import',prep),false,'WORKER_RPC_REVOKED');
  value(rpc(h,'reserve_worker_scope()',a.analyst,null,'worker_dispatch'),A,'WORKER_RESERVE_POSITIVE');
  const effect=backend(h,`PERFORM public.reserve_worker_scope(); RESET ROLE; SELECT jsonb_agg(jsonb_build_object('tenant',tenant_id,'changed',last_dispatched_at IS NOT NULL) ORDER BY tenant_id) INTO result FROM public.worker_delegations;`,a.analyst,null,'worker_dispatch');
  assert.equal(effect.code,'00000','WORKER_RESERVE_EFFECT');assert.deepEqual(effect.rows,[{tenant:A,changed:true},{tenant:B,changed:false}],'WORKER_RESERVE_NARROW_EFFECT');
  for(const actor of [a.a,a.b,a.viewer,a.operator,a.outsider])value(rpc(h,'reserve_worker_scope()',actor,null,'worker_dispatch'),null,'WORKER_RESERVE_IDENTITY');
  for(const prep of [`UPDATE worker_delegations SET enabled=false;`,`UPDATE memberships SET status='revoked' WHERE user_id=${q(a.analyst.id)};`,`UPDATE memberships SET role='owner' WHERE user_id=${q(a.analyst.id)};`])value(rpc(h,'reserve_worker_scope()',a.analyst,null,'worker_dispatch',prep),null,'WORKER_RESERVE_REVOKED');
  for(const action of ['read','configure','import',''])assert.equal(rpc(h,'reserve_worker_scope()',a.analyst,A,action).code,'42501','WORKER_RESERVE_ACTION');
  assert.equal(rpc(h,'reserve_worker_scope()',{id:''},null,'worker_dispatch').code,'42501','WORKER_RESERVE_NO_IDENTITY');
  const rotate=`INSERT INTO memberships(tenant_id,user_id,role,status) VALUES(${q(B)},${q(a.analyst.id)},'analyst','active'); INSERT INTO worker_delegations(tenant_id,user_id,enabled) VALUES(${q(B)},${q(a.analyst.id)},true); UPDATE worker_delegations SET last_dispatched_at=now() WHERE tenant_id=${q(A)};`;
  value(rpc(h,'reserve_worker_scope()',a.analyst,null,'worker_dispatch',rotate),B,'WORKER_RESERVE_ROTATION');
 });}
};
