import assert from 'node:assert/strict';import * as sync from '../F01-03/sync/oracles.mjs';
import {read,denied} from '../F01-03/harness.mjs';import {backend} from '../F01-03/import-uploads/oracles.mjs';
export function mutants(h,f){
 const A=f.a.sync_cursors.tenant_id;
 const oracle=()=>denied(h.probe(read('sync_raw_objects'),f.actors.viewer),'MUTANT_RAW_VIEWER_LEAK');
 oracle();h.sql('GRANT SELECT ON sync_raw_objects TO authenticated; CREATE POLICY synthetic_mutant ON sync_raw_objects FOR SELECT TO authenticated USING(true)');
 try{assert.throws(oracle,/MUTANT_RAW_VIEWER_LEAK/,'RAW_VIEWER_MUTANT_MUST_DIE');}finally{h.sql('DROP POLICY synthetic_mutant ON sync_raw_objects; REVOKE SELECT ON sync_raw_objects FROM authenticated');}oracle();
 const scope=()=>{const r=backend(h,read('sync_raw_objects'),f.actors.dual,A,'read');assert.equal(r.code,'00000');assert.deepEqual(r.rows.map(x=>x.id),[f.a.sync_raw_objects.id],'MUTANT_DUAL_SCOPE_LEAK');};
 scope();h.sql('CREATE POLICY synthetic_mutant ON sync_raw_objects FOR SELECT TO vexa_backend USING(public.vexa_member(tenant_id,array[\'owner\',\'analyst\']))');
 try{assert.throws(scope,/MUTANT_DUAL_SCOPE_LEAK/,'SCOPE_MUTANT_MUST_DIE');}finally{h.sql('DROP POLICY synthetic_mutant ON sync_raw_objects');}scope();
 return ['raw_viewer_leak:0-1-0','dual_scope_leak:0-1-0'];
}
