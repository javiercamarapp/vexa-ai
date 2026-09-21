// Full SQL/RLS/Auth/Storage regression matrix, including economic0018.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
import '../../tests/acceptance/F01-03.test.mjs';
test('F05-02 ledger migration is mandatory even when legacy matrix alone would pass',()=>{assert.ok(process.env.VEXA_CANDIDATE,'CANDIDATE_REQUIRED');assert.ok(fs.existsSync(path.join(process.env.VEXA_CANDIDATE,'supabase/migrations/0018_economic_runtime.sql')),'ECONOMIC_IMPLEMENTATION_MISSING');});

test('F05-02 FORCE RLS mutant reaches the specific economic oracle',{timeout:120000},async t=>{
 const {candidateInputs,launch}=await import('../../tests/acceptance/support/F01-03/harness.mjs');
 const economic=await import('../../tests/acceptance/support/F01-03/economic-oracles.mjs');
 const {foreignKeys}=await import('../../tests/acceptance/support/F01-03/oracles.mjs');
 const sql=candidateInputs(process.env.VEXA_CANDIDATE),needle='alter table public.economic_source_versions force row level security;';
 assert.equal(sql.filter(s=>s.includes(needle)).length,1,'ECONOMIC_FORCE_MUTANT_TARGET_REQUIRED');
 const h=await launch({services:true});t.after(()=>{const cleanup=process.env.VEXA_F01_03_CLEANUP;try{if(cleanup)process.env.VEXA_F01_03_CLEANUP=cleanup+'.calibration';h.close();}finally{if(cleanup)process.env.VEXA_F01_03_CLEANUP=cleanup;}});
 for(const migration of sql)h.sql(migration.replace(needle,'alter table public.economic_source_versions no force row level security;'));
 const keys=foreignKeys(h);assert.throws(()=>economic.schema(h,keys),e=>e.code==='ERR_ASSERTION'&&e.message.includes('ECONOMIC_FORCE_RLS'),'ECONOMIC_FORCE_MUTANT_SPECIFIC_ORACLE');
 h.sql(needle);assert.doesNotThrow(()=>economic.schema(h,keys),'ECONOMIC_FORCE_RESTORED_POSITIVE');
});
