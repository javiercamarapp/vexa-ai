import test from 'node:test';
import assert from 'node:assert/strict';
import {runtime} from './runtime.mjs';
import {exam02} from './exam02.mjs';
import {productBinding} from './product-binding.mjs';
import path from 'node:path';
test('PRODUCT NODE DIAGNOSTIC; not frozen acceptance, no SSR claim',{timeout:250000},async t=>{
 const candidate=process.env.VEXA_CANDIDATE;assert.ok(candidate);
 const h=await runtime(candidate);t.after(()=>h.close());
 await exam02(t,h,ports=>productBinding(candidate,ports),{product:true,only:process.env.F02_PROBE_CASE,processEntry:path.join(candidate,'packages/jobs/index.mjs')});
});
