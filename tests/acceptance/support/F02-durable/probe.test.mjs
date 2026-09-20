import test from 'node:test';
import {runtime} from './runtime.mjs';
import {exam02} from './exam02.mjs';
import {createImportHandler,reconcileExpired} from './canonical-reference.mjs';
test('SYNTHETIC ORACLE PROBE ONLY — not product F02-02',{timeout:300000},async t=>{
 const h=await runtime(process.env.VEXA_CANDIDATE??process.cwd());t.after(()=>h.close());
 await exam02(t,h,ports=>createImportHandler(ports,{defect:process.env.F02_ORACLE_DEFECT}),{only:process.env.F02_PROBE_CASE,reconcile:(ports,request)=>reconcileExpired(ports,request,{defect:process.env.F02_ORACLE_DEFECT}),processEntry:new URL('./canonical-reference.mjs',import.meta.url).href});
});
