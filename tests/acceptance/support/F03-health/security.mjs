import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';
import {q} from './harness.mjs';
import {read,write} from '../F01-03/harness.mjs';
import {backend} from '../F01-03/import-uploads/oracles.mjs';
export async function security(t,h){await t.test('health permissions, actor and failed-success mutants are caught and restored',()=>{
 const cycles=[];function cycle(name,oracle,mutation,restore){oracle();h.sql(mutation);try{assert.throws(oracle,undefined,'HEALTH_MUTANT_NOT_CAUGHT:'+name);}finally{h.sql(restore);}oracle();cycles.push(name+':0-1-0');}
 const tenant=()=>{const r=backend(h,read('connection_health'),h.A,h.A.tenant,'read');assert.equal(r.code,'00000');assert.ok(r.rows.some(x=>x.connection_id===h.A.connection),'HEALTH_READ_CANARY');assert.ok(r.rows.every(x=>x.tenant_id===h.A.tenant),'HEALTH_SELECTED_TENANT');};
 cycle('selected_tenant',tenant,'CREATE POLICY synthetic_health_leak ON connection_health FOR SELECT TO vexa_backend USING(true)','DROP POLICY synthetic_health_leak ON connection_health');
 const failed=()=>{const r=backend(h,write(`UPDATE connection_health SET state='stale',last_success=last_attempt WHERE tenant_id=${q(h.A.tenant)} AND connection_id=${q(h.raceConnection)}`),h.A,h.A.tenant,'import');assert.notEqual(r.code,'00000','HEALTH_FAILED_ADVANCES_SUCCESS');};
 cycle('failed_success',failed,'ALTER TABLE connection_health DISABLE TRIGGER connection_health_guard','ALTER TABLE connection_health ENABLE TRIGGER connection_health_guard');
 const actor=()=>{const r=backend(h,write(`UPDATE connection_health SET actor_id=${q(h.bot.id)} WHERE tenant_id=${q(h.A.tenant)} AND connection_id=${q(h.raceConnection)}`),h.A,h.A.tenant,'import');assert.notEqual(r.code,'00000','HEALTH_ACTOR_BODY_SPOOF');};
 cycle('actor_identity',actor,'ALTER TABLE connection_health DISABLE TRIGGER connection_health_guard','ALTER TABLE connection_health ENABLE TRIGGER connection_health_guard');
 fs.writeFileSync(path.join(h.evidence,'mutants.json'),JSON.stringify(cycles),{mode:0o600});
});}
