import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {prepare,components} from './harness.mjs';
import {routes} from './routes.mjs';
test('F01-04: mutante eleva todos los roles a owner; debe morir por rol real',{timeout:540000},async()=>{
 const candidate=process.env.VEXA_CANDIDATE;
 const h=await prepare(candidate);
 const file=path.join(h.tmp,'packages/platform/src/session.ts');
 const original=fs.readFileSync(file,'utf8');
 try{
  const from='return {user,memberships,active};';
  assert.equal(original.split(from).length,2,'MUTATION_SETUP unique return');
  fs.writeFileSync(file,original.replace(from,"return {user,memberships,active:{...active,role:'owner' as const}};"));
  await h.start();await components(h);
  await assert.rejects(()=>routes(h,candidate),error=>{
   assert.match(error.message,/AUTHORIZED_ROLE_PRESERVED expected=analyst/,'MUTANT_MUST_FAIL_ROLE_NOT_INFRA');
   console.log('KILLED forced-owner: AUTHORIZED_ROLE_PRESERVED expected=analyst');return true;
  });
 }finally{fs.writeFileSync(file,original);await h.close();console.log('Artifacts: '+h.tmp);}
});
