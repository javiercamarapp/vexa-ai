import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
export const modules=['cli.mjs','runner.mjs','contract.mjs','transport.mjs'];
export const phases=['served_revision','two_authenticated_tenants','durable_import_final_accounting','financial_api_and_protected_export','known_foreign_tenant_ids','eight_product_views','bounded_consumer_fault_and_recovery','revocation_current_reads_and_export'];
export const views=['overview','problems','problem','customer','explorer','recommendations','interventions','brief'];
export const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
export function regular(file,mode){const s=fs.lstatSync(file);assert.ok(s.isFile()&&!s.isSymbolicLink(),'REGULAR_FILE_REQUIRED');if(mode!==undefined)assert.equal(s.mode&0o777,mode,'PRIVATE_FILE_REQUIRED');return s;}
export function privateInput(file){assert.ok(path.isAbsolute(file),'ABSOLUTE_INPUT_REQUIRED');const s=regular(file,0o600);assert.ok(s.size<=1048576,'INPUT_TOO_LARGE');return JSON.parse(fs.readFileSync(file,'utf8'));}
export function directory(dir){const s=fs.lstatSync(dir);assert.ok(s.isDirectory()&&!s.isSymbolicLink(),'REGULAR_DIRECTORY_REQUIRED');assert.equal(s.mode&0o777,0o700,'PRIVATE_DIRECTORY_REQUIRED');}
export function candidateRevision(candidate){
 assert.ok(path.isAbsolute(candidate),'ABSOLUTE_CANDIDATE_REQUIRED');
 const git=args=>{const r=spawnSync('git',['-C',candidate,...args],{encoding:'utf8',timeout:10000});assert.ok(!r.error&&r.signal===null&&r.status===0,'CANDIDATE_GIT_FAILED');return r.stdout.trim();};
 const sha=git(['rev-parse','HEAD']);assert.match(sha,/^[a-f0-9]{40}$/);
 assert.ok(!git(['ls-files','-v','-z']).split('\0').some(entry=>/^[a-zS] /.test(entry)),'CANDIDATE_INDEX_FLAGS_UNSAFE');
 assert.equal(git(['status','--porcelain','--untracked-files=all']),'','CANDIDATE_PRODUCT_NOT_COMMITTED');
 for(const name of ['apps/web/package.json','packages/release/smoke/cli.mjs'])regular(path.join(candidate,name));
 return sha;
}
export function prepareControl(controller,driver){
 directory(driver);const root=fs.realpathSync(controller),hashes={};
 for(const name of modules){const source=path.join(root,'packages/release/smoke',name);regular(source);const bytes=fs.readFileSync(source);hashes[name]=digest(bytes);fs.writeFileSync(path.join(driver,name),bytes,{flag:'wx',mode:0o600});}
 return hashes;
}
const accounting=job=>{assert.equal(job.state,'succeeded','TERMINAL_REQUIRED');assert.equal(String(job.checkpoint),'3');for(const [k,v]of Object.entries({total:'3',accepted:'3',rejected:'0',duplicates:'0',pending:'0'}))assert.equal(String(job.counters[k]),v,'JOB_ACCOUNTING');};
export function verifyReport(report,{sha,hashes,authorizationId,fixtureHash,out}){
 assert.equal(report.schema,'vexa-release-smoke-v1');assert.equal(report.status,'pass','SMOKE_NOT_PASS');assert.match(report.runId,/^[a-f0-9-]{36}$/);assert.equal(report.sourceSha,sha,'SOURCE_BINDING');assert.equal(report.authorizationId,authorizationId,'AUTHORIZATION_BINDING');assert.equal(report.fixtureHash,fixtureHash,'FIXTURE_BINDING');assert.deepEqual(report.runnerFiles,hashes,'EXAMINER_BINDING');
 assert.deepEqual(report.checks.map(x=>x.name),phases,'PHASE_INVENTORY');assert.ok(report.checks.every(x=>x.status==='pass'),'PHASE_NOT_PASS');const obs=Object.fromEntries(report.checks.map(x=>[x.name,x.observed]));
 assert.deepEqual(obs.served_revision,{expected:sha,observed:sha},'SERVED_SHA');assert.deepEqual(obs.two_authenticated_tenants,{accounts:2,distinctTenants:true});accounting(obs.durable_import_final_accounting);
 const money=obs.financial_api_and_protected_export;assert.equal(money.exposureMinor,'30000');assert.equal(money.refundMinor,'1500');assert.equal(money.currency,'USD');assert.match(money.exportSha,/^[a-f0-9]{64}$/);
 assert.equal(obs.known_foreign_tenant_ids.denied,true);assert.equal(obs.eight_product_views.count,8);assert.deepEqual(report.views.map(x=>x.name),views);assert.ok(report.views.every(x=>x.rootCount===1&&x.headingPresent===true));
 const fault=obs.bounded_consumer_fault_and_recovery;assert.ok(fault.alarm.includes('NO_HEARTBEAT'));assert.equal(fault.pendingBefore,fault.pendingDuring);assert.ok(!['succeeded','partial','failed','cancelled','dead_letter'].includes(fault.stateDuring));accounting(fault.final);
 assert.equal(report.admittedJobs.length,2);assert.equal(report.admittedJobs[0].jobId,obs.durable_import_final_accounting.jobId);assert.equal(report.admittedJobs[1].jobId,fault.jobId);assert.notEqual(report.admittedJobs[0].jobId,fault.jobId);for(const job of report.admittedJobs){assert.match(job.jobId,/^[a-f0-9-]{36}$/);assert.match(job.csvSha,/^[a-f0-9]{64}$/);assert.ok(report.jobObservations.some(x=>x.jobId===job.jobId&&x.state==='succeeded'),'JOB_OBSERVATIONS_REQUIRED');}
 assert.deepEqual(obs.revocation_current_reads_and_export,{Adenied:true,BstillAuthorized:true});assert.ok(!report.cleanup,'UNEXPECTED_COMPENSATION_ON_PASS');
 assert.ok(report.requests.some(x=>x.path==='/api/jobs/health'&&x.status===503),'ALARM_HTTP_REQUIRED');assert.ok(report.requests.some(x=>x.path==='/api/imports'&&x.status===503),'ADMISSION_HTTP_REQUIRED');
 assert.deepEqual(report.artifacts.map(x=>x.file),views.map(x=>x+'.png'),'SCREENSHOT_INVENTORY');for(const item of report.artifacts){const file=path.join(out,item.file);regular(file,0o600);assert.equal(digest(fs.readFileSync(file)),item.sha256,'SCREENSHOT_DIGEST');}
 return true;
}
