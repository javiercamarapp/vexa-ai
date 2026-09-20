import assert from 'node:assert/strict';
import {extensionIds} from './extensions.mjs';
export const expectedIds=Object.freeze([
  "007 selected A dual owner cannot insert delegation B",
  "06 admission rejects consumer absent then recovers",
  "05 real two-process claims and stale fencing",
  "05 atomic checkpoint rollback with server fault canary",
  "06 live heartbeat does not hide stalled progress",
  "05 429 Retry-After and 401 no retry via real Storage HTTP",
  "06 Chromium queued polling cancel reload tenant Origin",
  "06 browser worker enable revoke replay and six durable states",
  "05 SIGKILL postcommit before ACK real process replay",
  "05 error after first100 has precise normalization code",
  "05 four real failures count attempts not chunks",
  "05 deadline cancellation revocation stop old worker",
  "06 HTTP isolation roles queue and lease alarms",
  "05 owner history CAS roles and manual replay conservation",
  "06 missing SQL configuration is 503",
  "MUTATION fence 0→1→0",
  "MUTATION atomic 0→1→0",
  "MUTATION health 0→1→0"
].concat(extensionIds));
export function validateResult(result,mutations){
 assert.equal(result.schema,1,'RESULT_SCHEMA');assert.equal(result.status,'PASS','FULL_STATUS');assert.equal(result.accepted,false);assert.equal(result.connectionReady,false);
 assert.deepEqual([...result.expectedIds].sort(),[...expectedIds].sort(),'DECLARED_INVENTORY');
 assert.deepEqual(result.results.map(r=>r.id).sort(),[...expectedIds].sort(),'COMPLETE_UNIQUE_INVENTORY');
 assert.ok(result.results.every(r=>r.status==='pass'),'ZERO_SKIP_PENDING_BLOCKED');
 for(const key of ['fence','atomic','health']){const phases=mutations[key];assert.deepEqual(phases.map(r=>r.phase),['positive','mutant','restored'],'MUTATION_PHASES');assert.deepEqual(phases.map(r=>r.exit_code),[0,1,0],'MUTATION_010');assert.match(phases[1].error,/MUTANT_TARGET_/,'TARGET_ASSERTION_REQUIRED');}
}
