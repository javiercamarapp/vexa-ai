import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const candidate=process.env.VEXA_CANDIDATE;
assert.ok(candidate,'CANDIDATE_REQUIRED');
const load=()=>import(pathToFileURL(path.join(candidate,'packages/interventions/index.mjs')));
test('F06-05 independent intervention implementation is required',async()=>{
 assert.ok(fs.existsSync(path.join(candidate,'packages/interventions/index.mjs')),'INTERVENTION_IMPLEMENTATION_MISSING');
 assert.ok(fs.existsSync(path.join(candidate,'supabase/migrations/0026_interventions.sql')),'INTERVENTION_SQL_IMPLEMENTATION_MISSING');
 const {createInterventionRepository}=await load();
 const repository=createInterventionRepository({database:{transaction(){throw Error('FACTORY_MUST_NOT_QUERY');}}});
 for(const name of ['list','get','savePlan','transition','measure'])assert.equal(typeof repository[name],'function','INTERVENTION_METHOD_REQUIRED:'+name);
});
const state=()=>import(pathToFileURL(path.join(candidate,'packages/interventions/state.mjs')));
const plan={hypothesis:'SYN operational change may reduce observed contacts.',ownerId:'11111111-1111-4111-8111-111111111111',start:'2026-10-01T00:00:00Z',end:'2026-10-02T00:00:00Z',unit:'order',population:'SYN eligible orders within the captured scope.',outcome:'refunds',controlPlan:'SYN no control; descriptive association only.',metricDefinitionVersion:'economic-policy-f05-05-v1',baselineSnapshotId:'22222222-2222-4222-8222-222222222222',scopeHash:'a'.repeat(64),maturityDays:30,concurrentChanges:'SYN concurrent promotion explicitly recorded.'};
test('F06-05 plan requires explicit frozen measurement meaning and valid UTC instants',async()=>{
 const {validatePlan}=await state();const p=validatePlan(plan);assert.equal(p.start,'2026-10-01T00:00:00.000Z');assert.equal(p.end,'2026-10-02T00:00:00.000Z');assert.equal(p.maturityDays,30);
 for(const k of Object.keys(plan)){const q={...plan};delete q[k];assert.throws(()=>validatePlan(q),e=>e.status===400,'INTERVENTION_REQUIRED_PLAN_FIELD:'+k);assert.throws(()=>validatePlan({...plan,[k]:null}),e=>e.status===400,'INTERVENTION_NULL_PLAN_FIELD:'+k);}
 for(const patch of [{tenantId:'SYN-foreign'},{amountMinor:'1500'},{result:{deltaMinor:'999'}},{causallyAttributedIncrementalMargin:'99'},{scopeHash:'x'.repeat(64)},{start:'2026-02-30T00:00:00Z'},{start:'2026-10-01T00:00:00-03:00'},{end:plan.start},{end:'infinity'},{maturityDays:-1},{maturityDays:366},{maturityDays:0.1},{unit:'message'},{outcome:'recovered_revenue'},{hypothesis:'short'},{ownerId:'SYN-unverified'}])assert.throws(()=>validatePlan({...plan,...patch}),e=>e.status===400,'INTERVENTION_REJECT_INVALID_PLAN:'+JSON.stringify(patch));
});
const edges={draft:['approved','cancelled'],approved:['active','cancelled'],active:['measuring','cancelled'],measuring:['closed','cancelled'],closed:['measuring'],cancelled:[]};
test('F06-05 explicit state graph has no skipped transitions and only owner controlled measurement reopening',async()=>{
 const {assertTransition}=await state();for(const from of Object.keys(edges))for(const to of Object.keys(edges)){const fn=()=>assertTransition({status:from,owner_id:plan.ownerId},to,'owner',plan.ownerId);if(edges[from].includes(to))assert.doesNotThrow(fn);else assert.throws(fn,e=>e.status===409,'INTERVENTION_TRANSITION_DENIED:'+from+'>'+to);}
});
function executionOracle(assertTransition){const i={status:'approved',owner_id:plan.ownerId};assert.doesNotThrow(()=>assertTransition(i,'active','operator',plan.ownerId));assert.throws(()=>assertTransition(i,'active','operator',plan.baselineSnapshotId),e=>e.status===403,'INTERVENTION_UNASSIGNED_OPERATOR_DENIED');for(const role of ['viewer','analyst'])assert.throws(()=>assertTransition(i,'active',role,plan.ownerId),e=>e.status===403,'INTERVENTION_NONEXECUTOR_DENIED');}
test('F06-05 execution requires assigned operator while approval and cancellation require owner',async()=>{
 const {assertTransition}=await state();executionOracle(assertTransition);for(const role of ['viewer','analyst','operator'])for(const [from,target]of [['draft','approved'],['draft','cancelled'],['active','cancelled'],['closed','measuring']])assert.throws(()=>assertTransition({status:from,owner_id:plan.ownerId},target,role,plan.ownerId),e=>e.status===403,'INTERVENTION_OWNER_DECISION_REQUIRED');
});
test('F06-05 causal assignment mutant is killed semantically and original restored',async()=>{
 const {mkdtempSync,rmSync,mkdirSync,writeFileSync}=fs;const {tmpdir}=await import('node:os');const tmp=mkdtempSync(path.join(tmpdir(),'vexa-intervention-mutant-287-'));
 try{mkdirSync(path.join(tmp,'packages/interventions'),{recursive:true});mkdirSync(path.join(tmp,'packages/workspace-service'),{recursive:true});fs.copyFileSync(path.join(candidate,'packages/workspace-service/contracts.mjs'),path.join(tmp,'packages/workspace-service/contracts.mjs'));const source=fs.readFileSync(path.join(candidate,'packages/interventions/state.mjs'),'utf8');assert.ok(source.includes('current.owner_id===userId'),'INTERVENTION_MUTANT_SITE');executionOracle((await state()).assertTransition);const target=path.join(tmp,'packages/interventions/state.mjs');writeFileSync(target,source.replace('current.owner_id===userId','true'));const mutated=await import(pathToFileURL(target));assert.throws(()=>executionOracle(mutated.assertTransition),e=>e.code==='ERR_ASSERTION'&&e.message.includes('INTERVENTION_UNASSIGNED_OPERATOR_DENIED'),'INTERVENTION_MUTANT_SEMANTIC_KILL');executionOracle((await state()).assertTransition);}finally{rmSync(tmp,{recursive:true,force:true});}
});
