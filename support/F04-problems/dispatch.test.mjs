import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {launch,candidateInputs} from '../../tests/acceptance/support/F01-03/harness.mjs';
const q=value=>value===null?'NULL':"'"+String(value).replaceAll("'","''")+"'";

test('hosted consumer rotation is durable, independent and authorized', {timeout:180000},async t=>{
 const evidence=fs.mkdtempSync(path.join(os.tmpdir(),'vexa-consumer-dispatch-'));fs.chmodSync(evidence,0o700);
 const inherited=process.env.VEXA_CI_JOURNAL;assert.equal(Boolean(inherited),Boolean(process.env.VEXA_CI_BROKER),'BROKER_CONFIG');
 if(!inherited){process.env.VEXA_CI_JOURNAL=path.join(evidence,'resources.jsonl');process.env.VEXA_CI_BROKER=randomUUID();fs.writeFileSync(process.env.VEXA_CI_JOURNAL,'',{mode:0o600,flag:'wx'});}
 const oldCleanup=process.env.VEXA_F01_03_CLEANUP;process.env.VEXA_F01_03_CLEANUP=path.join(evidence,'cleanup.json');let h;
 try{
  h=await launch({services:true});for(const ddl of candidateInputs(process.env.VEXA_CANDIDATE))h.sql(ddl);
  assert.equal(h.sql("SELECT to_regprocedure('public.reserve_worker_scope(text)') IS NOT NULL"),'t','CONSUMER_DISPATCH_IMPLEMENTATION_REQUIRED');
  const bot=randomUUID(),stranger=randomUUID(),A=randomUUID(),B=randomUUID(),C=randomUUID();
  h.sql(`INSERT INTO auth.users(id) VALUES(${q(bot)}),(${q(stranger)}); INSERT INTO organizations(id,name) VALUES(${q(A)},'SYN-A'),(${q(B)},'SYN-B'),(${q(C)},'SYN-C'); INSERT INTO memberships(tenant_id,user_id,role,status) VALUES(${q(A)},${q(bot)},'analyst','active'),(${q(B)},${q(bot)},'analyst','active'),(${q(C)},${q(stranger)},'analyst','active'); INSERT INTO worker_delegations(tenant_id,user_id,enabled) VALUES(${q(A)},${q(bot)},true),(${q(B)},${q(bot)},true),(${q(C)},${q(stranger)},true);`);
  // Every reservation opens a fresh SQL session, as separate hosted cold starts do.
  const reserve=(consumer,identity=bot,tenant=C)=>h.sql(`BEGIN; SET LOCAL ROLE vexa_backend; SET LOCAL request.jwt.claim.sub=${q(identity)}; SET LOCAL vexa.action='worker_dispatch'; SET LOCAL vexa.tenant_id=${q(tenant)}; SELECT public.reserve_worker_scope(${consumer===undefined?'':q(consumer)}); COMMIT;`).trim();
  const reset=()=>h.sql('UPDATE worker_delegations SET last_dispatched_at=null,crm_last_dispatched_at=null,extraction_last_dispatched_at=null,problems_last_dispatched_at=null');
  const fairness=(consumers=['imports','crm'])=>{reset();const rounds=[];for(let n=0;n<6;n++)rounds.push(Object.fromEntries(consumers.map(kind=>[kind,reserve(kind)])));
   for(const kind of consumers)assert.deepEqual([...new Set(rounds.map(row=>row[kind]))].sort(),[A,B].sort(),'CONSUMER_DISPATCH_FAIRNESS:'+kind);
   return rounds;
  };
  await t.test('four interleaved consumers reach both authorized tenants and never foreign scope',()=>{
   fs.writeFileSync(path.join(evidence,'rotation.json'),JSON.stringify({twoConsumers:fairness(),fourConsumers:fairness(['imports','crm','extraction','problems'])},null,2),{mode:0o600});
   assert.equal(h.sql(`SELECT last_dispatched_at IS NULL AND crm_last_dispatched_at IS NULL AND extraction_last_dispatched_at IS NULL AND problems_last_dispatched_at IS NULL FROM worker_delegations WHERE tenant_id=${q(C)}`),'t','FOREIGN_DISPATCH_UNCHANGED');
  });
  await t.test('legacy no-argument caller and explicit imports share only the imports rotation',()=>{
   reset();const first=reserve(undefined),second=reserve('imports');assert.notEqual(first,second,'LEGACY_IMPORTS_COMPATIBILITY');
   assert.equal(reserve('crm'),first);assert.equal(reserve('extraction'),first);
   const row=h.json(`SELECT jsonb_build_object('imports',last_dispatched_at IS NOT NULL,'crm',crm_last_dispatched_at IS NOT NULL,'extraction',extraction_last_dispatched_at IS NOT NULL) FROM worker_delegations WHERE tenant_id=${q(second)}`);
   assert.deepEqual(row,{imports:true,crm:false,extraction:false},'CONSUMER_COLUMN_ISOLATION');
  });
  const probe=(kind,{identity=bot,action='worker_dispatch',role='vexa_backend',prep=''}={})=>h.probe(`${prep} GRANT ALL ON exam_result TO ${role}; SET LOCAL ROLE ${role}; PERFORM set_config('request.jwt.claim.sub',${q(identity)},true); PERFORM set_config('vexa.action',${q(action)},true); SELECT jsonb_build_array(jsonb_build_object('tenant',public.reserve_worker_scope(${q(kind)}))) INTO result;`);
  await t.test('consumer allowlist, callable roles, current identity and action fail closed',()=>{
   for(const kind of [null,'','other',A,"crm'); DROP TABLE worker_delegations; --"])assert.equal(probe(kind).code,'22023','CONSUMER_INVALID');
   for(const kind of ['imports','crm','extraction','problems']){
    for(const action of ['','read','configure','import'])assert.equal(probe(kind,{action}).code,'42501','DISPATCH_ACTION');
    assert.equal(probe(kind,{identity:''}).code,'42501','DISPATCH_IDENTITY');
    for(const role of ['anon','authenticated','service_role'])assert.equal(probe(kind,{role}).code,'42501','DISPATCH_ROLE:'+role);
    const outside=probe(kind,{identity:randomUUID()});assert.equal(outside.code,'00000');assert.deepEqual(outside.rows,[{tenant:null}],'DISPATCH_OUTSIDER');
   }
   assert.deepEqual(h.json("SELECT jsonb_build_object('definer',prosecdef,'search',proconfig) FROM pg_proc WHERE oid='public.reserve_worker_scope(text)'::regprocedure"),{definer:true,search:['search_path=""']});
   for(const role of ['anon','authenticated','service_role','vexa_backend'])assert.equal(h.sql(`SELECT has_function_privilege(${q(role)},'public.reserve_worker_scope(text)','EXECUTE')`),role==='vexa_backend'?'t':'f');
  });
  await t.test('revoked membership, disabled delegation and changed role stop each consumer',()=>{
   for(const kind of ['imports','crm','extraction','problems'])for(const prep of [
    `UPDATE worker_delegations SET enabled=false WHERE user_id=${q(bot)};`,
    `UPDATE memberships SET status='revoked' WHERE user_id=${q(bot)};`,
    `UPDATE memberships SET role='owner' WHERE user_id=${q(bot)};`
   ]){const result=probe(kind,{prep});assert.equal(result.code,'00000');assert.deepEqual(result.rows,[{tenant:null}],'DISPATCH_REVOKED:'+kind);}
  });
  await t.test('fairness oracle rejects the prior shared-rotation behavior and restores green',()=>{
   const original=h.sql("SELECT pg_get_functiondef('public.reserve_worker_scope(text)'::regprocedure)");let rejected;
   try{h.sql("CREATE OR REPLACE FUNCTION public.reserve_worker_scope(p_consumer text) RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ SELECT public.reserve_worker_scope() $$;");try{fairness();}catch(e){rejected=e;}assert.equal(rejected?.code,'ERR_ASSERTION','FAIRNESS_MUTANT_ASSERTION');assert.match(rejected.message,/CONSUMER_DISPATCH_FAIRNESS/);}
   finally{h.sql(original);fairness();}
   fs.writeFileSync(path.join(evidence,'mutant.json'),JSON.stringify({baseline:'pass',sharedRotation:'specific assertion rejected',restored:'pass'}),{mode:0o600});
  });
 }finally{if(h)h.close();if(oldCleanup===undefined)delete process.env.VEXA_F01_03_CLEANUP;else process.env.VEXA_F01_03_CLEANUP=oldCleanup;if(!inherited){delete process.env.VEXA_CI_JOURNAL;delete process.env.VEXA_CI_BROKER;}console.log('CONSUMER_DISPATCH_EVIDENCE:'+evidence);}
});
