// Trusted external control: candidate files supply product, never the examiner.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
export const names=['crash_postcommit','expired_lease','storage_429','storage_401_deadletter_replay','revocation_during_work','deadline','explicit_cancel','database_outage','budget_concurrent_quota','llm_timeout_uncertain','deleted_source_replay'];
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
export function prepareControl(controller,driver){
 const root=fs.realpathSync(controller),files=[];
 for(const name of ['run','harness','fixtures','jobs','budget','retention','guards']){
  const source=path.join(root,'packages/jobs/chaos',name+'.mjs');assert.ok(fs.lstatSync(source).isFile()&&!fs.lstatSync(source).isSymbolicLink(),'CONTROL_REGULAR_FILE');
  const original=fs.readFileSync(source,'utf8');let code=original;
  if(name==='harness'){
   const old="path.join(candidate,'tests/acceptance/support/F02-durable-final/harness.mjs')";
   assert.equal(code.split(old).length,2,'TRUSTED_HARNESS_CONTRACT');
   code=code.replace(old,JSON.stringify(path.join(root,'tests/acceptance/support/F02-durable-final/harness.mjs')));
  }
  if(name==='run'){
   const old="path.join(candidate,'support/F06-detail/fixtures.mjs')";
   assert.equal(code.split(old).length,2,'TRUSTED_FIXTURE_CONTRACT');
   code=code.replace(old,JSON.stringify(path.join(root,'support/F06-detail/fixtures.mjs')));
  }
  const target=path.join(driver,name+'.mjs');fs.writeFileSync(target,code,{mode:0o600,flag:'wx'});
  files.push({path:path.relative(root,source),original_sha256:digest(original),driver_sha256:digest(code)});
 }
 return files;
}
export function validateReport(report,cleanup){
 assert.equal(report.status,'measured-pass-review-pending','CHAOS_RUN_STATUS');assert.equal(report.measuredScenariosPassed,true);assert.equal(report.repetitions,3);assert.equal(report.seed,42);assert.equal(report.results.length,33,'CHAOS_33_REQUIRED');
 for(let round=1;round<=3;round++){
  const rows=report.results.filter(r=>r.round===round);assert.deepEqual(rows.map(r=>r.name).sort(),[...names].sort(),'CHAOS_SCENARIO_INVENTORY');
  for(const row of rows){assert.equal(row.status,'pass');assert.equal(row.snapshotUnchanged,true);assert.ok(Number.isFinite(row.durationMs)&&row.durationMs>=0);assert.ok(row.backlogBefore&&row.backlogAfter);}
  const crash=rows.find(r=>r.name==='crash_postcommit');assert.equal(crash.observed.uniqueRows,350);assert.equal(crash.observed.cursor,350);assert.equal(crash.observed.resumedTail,250);assert.equal(crash.observed.priorLedgerIdentical,true);assert.equal(crash.accounting.pending,0);
  const timeout=rows.find(r=>r.name==='llm_timeout_uncertain');assert.equal(timeout.observed.state,'uncertain');assert.equal(timeout.observed.actualMinor,null);assert.equal(timeout.observed.attemptCommittedBeforeTransport,true);
  const erased=rows.find(r=>r.name==='deleted_source_replay');assert.equal(erased.observed.activeDeletedContent,0);assert.equal(erased.observed.tombstonedRejected,1);
 }
 assert.equal(cleanup.ownResourcesRemoved,true,'CHAOS_CLEANUP');assert.equal(cleanup.temporaryPathsRemoved,true);assert.ok(cleanup.resources.length>=5);assert.ok(cleanup.resources.every(r=>r.absent===true));
 return true;
}
