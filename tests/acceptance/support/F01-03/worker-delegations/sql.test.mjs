import test from 'node:test';
import assert from 'node:assert/strict';
import {launch,candidateInputs} from '../harness.mjs';
import {schemaOracle,seed,foreignKeys} from '../oracles.mjs';
import {seedUploads} from '../import-uploads/oracles.mjs';
import {seedHistory} from '../source-history/oracles.mjs';
import {ident,q} from '../matrix.mjs';
import * as workers from './oracles.mjs';
test('global 0007 SQL matrix with real local Auth',{timeout:240000},async t=>{
 const h=await launch({services:true});t.after(()=>h.close());
 for(const sql of candidateInputs(process.env.VEXA_CANDIDATE))h.sql(sql);
 schemaOracle(h);assert.ok(workers.present(h),'WORKER_MIGRATION_REQUIRED');
 const actors={};for(const key of ['a','b','dual','outsider','viewer','analyst','operator'])actors[key]=await h.user();
 const f=seed(h,actors);seedHistory(h,f);f.importUploads=seedUploads(h,f,actors);f.workers=workers.seedWorkers(h,actors);
 const fk=foreignKeys(h).find(x=>x.table===workers.table);
 if(process.env.VEXA_WORKER_MUTATIONS!=='1'){
  await t.test('physical membership FK',()=>workers.fk(h,f.workers,fk));
  for(const [name,oracle] of Object.entries(workers.checks))await t.test(name,()=>oracle(h,f,actors));
  return;
 }
 async function cycle(name,oracle,mutate,restore,target){if(process.env.VEXA_WORKER_MUTANT_ONLY&&process.env.VEXA_WORKER_MUTANT_ONLY!==name)return;await t.test(name,()=>{
  oracle();try{h.sql(mutate);assert.throws(oracle,e=>e.code==='ERR_ASSERTION'&&e.message.includes(target),'MUTANT_TARGET:'+target);}finally{h.sql(restore);}oracle();t.diagnostic('0 -> '+target+' -> 0');
 });}
 const cat=()=>workers.schema(h,foreignKeys(h));
 await cycle('RLS',cat,'ALTER TABLE worker_delegations DISABLE ROW LEVEL SECURITY','ALTER TABLE worker_delegations ENABLE ROW LEVEL SECURITY','WORKER_RLS_FORCE');
 await cycle('FORCE',cat,'ALTER TABLE worker_delegations NO FORCE ROW LEVEL SECURITY','ALTER TABLE worker_delegations FORCE ROW LEVEL SECURITY','WORKER_RLS_FORCE');
 await cycle('grant',cat,'GRANT SELECT ON worker_delegations TO authenticated','REVOKE SELECT ON worker_delegations FROM authenticated','WORKER_GRANT:authenticated:SELECT');
 const definition=h.sql(`SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid='worker_delegations'::regclass AND conname=${q(fk.name)}`);
 await cycle('physical FK',()=>workers.fk(h,f.workers,fk),`ALTER TABLE worker_delegations DROP CONSTRAINT ${ident(fk.name)}`,`ALTER TABLE worker_delegations ADD CONSTRAINT ${ident(fk.name)} ${definition}`,'WORKER_FK_CROSS');
 await cycle('FK catalog',cat,`ALTER TABLE worker_delegations DROP CONSTRAINT ${ident(fk.name)}`,`ALTER TABLE worker_delegations ADD CONSTRAINT ${ident(fk.name)} ${definition}`,'WORKER_FK_COUNT');
 const pk=h.json("SELECT jsonb_build_object('name',conname,'definition',pg_get_constraintdef(oid)) FROM pg_constraint WHERE conrelid='worker_delegations'::regclass AND contype='p'");
 await cycle('PK missing',cat,`ALTER TABLE worker_delegations DROP CONSTRAINT ${ident(pk.name)}`,`ALTER TABLE worker_delegations ADD CONSTRAINT ${ident(pk.name)} ${pk.definition}`,'WORKER_PK');
 await cycle('functional permissive read',()=>workers.checks.access(h,f,actors),'CREATE POLICY mutant_worker_read ON worker_delegations FOR SELECT TO vexa_backend USING(true)','DROP POLICY mutant_worker_read ON worker_delegations','WORKER_MEMBER_READ:a');
 await cycle('unknown table',()=>schemaOracle(h),'CREATE TABLE unexpected_worker_table(n integer)','DROP TABLE unexpected_worker_table','MATRIX: unclassified public table');
 for(const signature of ['worker_actor_authorized(uuid)','reserve_worker_scope()']){
  await cycle('RPC public execute '+signature,cat,`GRANT EXECUTE ON FUNCTION ${signature} TO PUBLIC`,`REVOKE EXECUTE ON FUNCTION ${signature} FROM PUBLIC`,'WORKER_RPC_GRANT:');
  await cycle('RPC search path '+signature,cat,`ALTER FUNCTION ${signature} SET search_path=public`,`ALTER FUNCTION ${signature} SET search_path=''`,'WORKER_RPC_NARROW_DEFINER:');
  const original=h.sql(`SELECT pg_get_functiondef(${q(signature)}::regprocedure)`);
  if(signature==='reserve_worker_scope()')await cycle('RPC broad write effects',()=>workers.checks.rpc(h,f,actors),"CREATE OR REPLACE FUNCTION reserve_worker_scope() RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE chosen uuid; BEGIN SELECT tenant_id INTO chosen FROM public.worker_delegations WHERE user_id=auth.uid() AND enabled LIMIT 1; UPDATE public.worker_delegations SET last_dispatched_at=clock_timestamp(); RETURN chosen; END $$",original,'WORKER_RESERVE_NARROW_EFFECT');
  const mutant=signature.startsWith('worker_actor')?"CREATE OR REPLACE FUNCTION worker_actor_authorized(p_job uuid) RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ SELECT true $$":"CREATE OR REPLACE FUNCTION reserve_worker_scope() RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ SELECT '00000000-0000-4000-8000-00000000000b'::uuid $$";
  await cycle('RPC broad behavior '+signature,()=>workers.checks.rpc(h,f,actors),mutant,original,signature.startsWith('worker_actor')?'WORKER_RPC_NARROW':'WORKER_RESERVE_POSITIVE');
 }
});
