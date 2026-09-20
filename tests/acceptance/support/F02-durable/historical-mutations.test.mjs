import test from 'node:test';
import assert from 'node:assert/strict';
import {runtime} from './runtime.mjs';
import {exam02} from './exam02.mjs';
import {createImportHandler} from './reference.mjs';
test('SYNTHETIC ORACLE mutation proof; SQL and Storage real, NOT product',{timeout:300000},async t=>{
 const h=await runtime(process.cwd());t.after(()=>h.close());
 const run=async(only,defect)=>{
  const cleanup=[];let reached=0;
  try{await exam02({after:fn=>cleanup.push(fn),test:async(name,fn)=>{reached++;await fn();}},h,ports=>createImportHandler(ports,{defect}),{only});assert.equal(reached,1,'MUTATION_TARGET_COUNT');}
  finally{for(const close of cleanup.reverse())await close();}
 };
 for(const [label,only,defect,assertion] of [
  ['M02-HASH','D02-02','hash','HASH_MISMATCH'],
  ['M02-ATOMIC','SQL fault at outbox','atomic','ATOMIC_CONFIRM_ROLLBACK'],
 ])await t.test(label+' healthy0 → assertion1 → restored0',async()=>{
  await run(only,null);
  let error;try{await run(only,defect);}catch(e){error=e;}
  assert.ok(error,'MUTANT_SURVIVED');assert.equal(error.code,'ERR_ASSERTION','INFRA_NOT_MUTATION');assert.match(error.message,new RegExp(assertion),'WRONG_ASSERTION');
  await run(only,null);
  t.diagnostic(label+' healthy=0 defect=1 restored=0 assertion='+assertion);
 });
});
