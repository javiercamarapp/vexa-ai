import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {lstat, readFile, realpath} from 'node:fs/promises';
import {isAbsolute, relative, resolve} from 'node:path';
import {verifyReceipt} from '../F08-smoke/receipt.mjs';

export const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const check = (ok, code) => { if (!ok) throw new Error(`F0806_${code}`); };
const text = v => typeof v === 'string' && v.trim().length >= 3 && v.length <= 1000;
const sha = v => /^[a-f0-9]{64}$/.test(v ?? '');
const layers = ['documentation','local_software','synthetic_demo','real_pilot','production'];
const documents = ['docs/entrega/acta-cierre.json','docs/entrega/proximos-experimentos.md','docs/entrega/AUDITORIA-20-RUBROS.md','construccion/ESTADO-CONSTRUCCION.json'];
const git = (root,args) => execFileSync('git',['-C',root,...args],{encoding:'utf8',maxBuffer:8*1024*1024,stdio:['ignore','pipe','pipe']}).trim();
function identity(root) {
 check(!git(root,['ls-files','-v','-z']).split('\0').some(x => /^[a-zS] /.test(x)), 'HIDDEN_INDEX');
 check(git(root,['status','--porcelain','--untracked-files=all']) === '', 'DIRTY_CANDIDATE');
 const id = git(root,['rev-parse','HEAD']); check(/^[a-f0-9]{40}$/.test(id),'SOURCE_SHA'); return id;
}
async function privateBytes(file,candidate) {
 check(typeof file === 'string' && isAbsolute(file), 'PRIVATE_PATH');
 const stat = await lstat(file), real = await realpath(file), root = await realpath(candidate), rel = relative(root,real);
 check(stat.isFile() && !stat.isSymbolicLink() && (stat.mode & 0o777) === 0o600 && stat.size <= 4*1024*1024,'PRIVATE_FILE');
 check(rel === '..' || rel.startsWith('../') || isAbsolute(rel),'PRIVATE_OUTSIDE_CANDIDATE');
 const bytes = await readFile(file); check(bytes.length <= 4*1024*1024,'PRIVATE_SIZE');
 return bytes;
}
export async function privateFile(file,candidate) {const bytes=await privateBytes(file,candidate);return {bytes,value:JSON.parse(bytes)};}
function approvalValid(a,reference,sourceSha,dossierHash) {
 check(a?.schema === 'vexa-closure-authorization-v1' && text(reference) && a.reference === reference && text(a.operator),'OPERATOR_APPROVAL');
 check(a.sourceSha === sourceSha && a.dossierSha256 === dossierHash && a.operation === 'verify_final_closure','APPROVAL_BINDING');
 check(a.expiresAt && Date.parse(a.expiresAt)>Date.now() && Date.parse(a.expiresAt)<=Date.now()+86400000,'APPROVAL_EXPIRED');
 check(text(a.reviewer) && text(a.implementer) && a.reviewer !== a.implementer && a.evidenceReviewed === true,'INDEPENDENT_REVIEW');
}
/** Pure checks preserve unknowns and partial layers; they do not approve closure. */
export function validateDossier(d) {
 check(d?.schema === 'vexa-closure-dossier-v1' && /^[a-f0-9]{40}$/.test(d.sourceSha ?? ''),'DOSSIER_SCHEMA');
 check(d.pmfValidated === false && d.pitchDoesNotValidatePmf === true,'PMF_CLAIM');
 check(Array.isArray(d.blockers) && d.blockers.length <= 100,'BLOCKERS');
 for (const b of d.blockers) check(text(b.id) && text(b.owner) && text(b.exitCondition),'BLOCKER_OWNER_EXIT');
 check(d.layers && Object.keys(d.layers).sort().join() === [...layers].sort().join(),'LAYERS');
 for (const name of layers) {
  const l=d.layers[name]; check(['pass','fail','blocked','not_run'].includes(l?.status),'LAYER_STATUS');
  check(l.domain === name,'LAYER_DOMAIN');
  check(Array.isArray(l.evidence) && l.evidence.length<=100 && l.evidence.every(text),'LAYER_EVIDENCE');
  if (l.status === 'pass') check(l.evidence.length > 0,'PASS_WITHOUT_EVIDENCE');
  else check(text(l.owner) && text(l.exitCondition),'LAYER_BLOCKER');
 }
 check(Array.isArray(d.metrics) && d.metrics.length<=100,'METRICS');
 for (const m of d.metrics) {
  check(text(m.id) && layers.includes(m.layer) && text(m.method) && text(m.window),'METRIC_CONTEXT');
  if (m.status === 'not_measured') check(m.numerator === null && m.denominator === null && m.value === null && m.evidence === null,'UNKNOWN_NOT_ZERO');
  else {
   check(m.status==='observed' && Number.isSafeInteger(m.numerator) && Number.isSafeInteger(m.denominator) && m.denominator>0 && m.numerator>=0 && m.numerator<=m.denominator && text(m.evidence),'METRIC_DENOMINATOR');
   check(m.value === m.numerator/m.denominator,'METRIC_ARITHMETIC');
  }
 }
 check(Array.isArray(d.experiments) && d.experiments.length>0 && d.experiments.length<=100,'EXPERIMENTS');
 for (const e of d.experiments) {
  check(text(e.id) && text(e.owner) && text(e.hypothesis) && text(e.measure) && text(e.exitCondition),'EXPERIMENT_CONTRACT');
  check(e.agreedDate===null || (typeof e.agreedDate==='string' && Number.isFinite(Date.parse(e.agreedDate)) && text(e.agreementEvidence)),'DATE_WITHOUT_AGREEMENT');
  check(e.paymentMinor===null || (Number.isSafeInteger(e.paymentMinor) && e.paymentMinor>=0 && /^[A-Z]{3}$/.test(e.currency??'') && text(e.paymentEvidence)),'PAYMENT_WITHOUT_EVIDENCE');
 }
 return d;
}
function countState(state, graph) {
 const categories=['accepted_in_graph','technical_ready_external_pending','technical_ready_formal_pending'];
 const ids=categories.flatMap(k=>{check(Array.isArray(state[k]),'STATE_CATEGORIES');return state[k];});
 const expected=graph.tasks.map(t=>t.id);
 check(expected.length===60 && new Set(expected).size===60 && new Set(ids).size===ids.length && ids.every(id=>expected.includes(id)),'STATE_IDS');
 return {technical:ids.length,formal:state.accepted_in_graph.length,total:expected.length};
}
/** No candidate code or tests are loaded. Approval is a supervisor decision,
 * never permission created by a favorable JSON. Raw evidence is bound and
 * independently reviewed; software only checks consistency and observations. */
export async function verifyClosure({candidate,dossierFile,authorizationFile,approvalReference}) {
 check(candidate && dossierFile && authorizationFile && approvalReference,'EXTERNAL_INPUT_REQUIRED');
 candidate=await realpath(candidate); const sourceSha=identity(candidate);
 const [{bytes:dossierBytes,value:d},{bytes:approvalBytes,value:a}]=await Promise.all([privateFile(dossierFile,candidate),privateFile(authorizationFile,candidate)]);
 approvalValid(a,approvalReference,sourceSha,hash(dossierBytes)); validateDossier(d);
 check(d.sourceSha===sourceSha,'DOSSIER_SHA');
 const frozen=[];
 async function tracked(path) {
  check(git(candidate,['ls-files','--error-unmatch','--',path])===path,'DOCUMENT_UNTRACKED');
  const absolute=resolve(candidate,path), stat=await lstat(absolute);
  check(stat.isFile() && !stat.isSymbolicLink() && stat.size<=4*1024*1024,'DOCUMENT_FILE');
  const bytes=await readFile(absolute); frozen.push({file:absolute,hash:hash(bytes)}); return bytes;
 }
 for(const path of documents) check(d.documents?.[path]===hash(await tracked(path)),'DOCUMENT_HASH');
 const counts=countState(JSON.parse(await tracked('construccion/ESTADO-CONSTRUCCION.json')),JSON.parse(await tracked('orchestration/graph.json')));
 assert.deepEqual(d.counts,counts,'F0806_COUNT_MISMATCH');
 check(Array.isArray(d.evidence) && d.evidence.length>0 && d.evidence.length<=100,'EVIDENCE');
 const receipts=new Map(); let artifactCount=0,artifactBytes=0;
 for(const ref of d.evidence) {
  check(text(ref.id) && !receipts.has(ref.id) && sha(ref.sha256),'EVIDENCE_REFERENCE');
  check(a.evidence?.[ref.id]===ref.sha256,'EVIDENCE_NOT_REVIEWED');
  const {bytes,value:r}=await privateFile(ref.file,candidate); check(hash(bytes)===ref.sha256,'EVIDENCE_HASH');
  frozen.push({file:ref.file,hash:ref.sha256});
  check(r.schema==='vexa-closure-observation-v1' && r.sourceSha===sourceSha && layers.includes(r.layer),'OBSERVATION_BINDING');
  check(r.status==='pass' && r.exitCode===0 && text(r.command) && text(r.observer) && Number.isFinite(Date.parse(r.observedAt)) && Date.parse(r.observedAt)<=Date.now(),'OBSERVATION_NOT_PASS');
  check(r.synthetic===(r.layer==='synthetic_demo') || (['documentation','local_software'].includes(r.layer) && typeof r.synthetic==='boolean'),'OBSERVATION_DOMAIN');
  check(Array.isArray(r.artifacts) && r.artifacts.length>0 && r.artifacts.length<=100,'ARTIFACTS_REQUIRED');
  for(const artifact of r.artifacts) {
   check(sha(artifact.sha256) && a.artifacts?.[artifact.sha256]===true,'ARTIFACT_NOT_REVIEWED');
   const bytes=await privateBytes(artifact.file,candidate);artifactCount++;artifactBytes+=bytes.length;check(artifactCount<=200 && artifactBytes<=32*1024*1024,'ARTIFACT_BUDGET');check(hash(bytes)===artifact.sha256,'ARTIFACT_HASH');frozen.push({file:artifact.file,hash:artifact.sha256});
  }
  receipts.set(ref.id,r);
 }
 for(const name of layers) for(const id of d.layers[name].evidence) check(receipts.get(id)?.layer===name,'CROSS_LAYER_EVIDENCE');
 for(const m of d.metrics.filter(m=>m.status==='observed')) {
  const r=receipts.get(m.evidence); check(r?.layer===m.layer && Array.isArray(r.observations),'METRIC_OBSERVATIONS');
  const rows=r.observations.filter(x=>x.metric===m.id);
  check(rows.length===m.denominator && new Set(rows.map(x=>x.subject)).size===rows.length && rows.every(x=>text(x.subject) && typeof x.success==='boolean' && x.method===m.method && x.window===m.window),'METRIC_ROWS');
  check(rows.filter(x=>x.success).length===m.numerator,'METRIC_NUMERATOR');
 }
 for(const e of d.experiments) {
  if(e.agreedDate!==null) check(receipts.get(e.agreementEvidence)?.agreements?.some(x=>x.experiment===e.id && x.date===e.agreedDate && x.owner===e.owner),'AGREEMENT_NOT_OBSERVED');
  if(e.paymentMinor!==null) check(receipts.get(e.paymentEvidence)?.payments?.some(x=>x.experiment===e.id && x.amountMinor===e.paymentMinor && x.currency===e.currency),'PAYMENT_NOT_OBSERVED');
 }
 // Operator inventories all work processes and independently checks completeness.
 // Signal 0 only observes local PID existence. It never terminates a process.
 check(a.processInventoryReviewed===true && Array.isArray(d.processes) && d.processes.length<=1000,'PROCESS_INVENTORY');
 for(const p of d.processes) {
  check(Number.isSafeInteger(p.pid) && p.pid>1 && text(p.role) && p.host==='local' && p.status==='collected' && text(p.receipt) && receipts.has(p.receipt),'PROCESS_RECEIPT');
  let absent=false;try{process.kill(p.pid,0);}catch(error){if(error.code==='ESRCH') absent=true;}
  check(absent,'PROCESS_STILL_PRESENT_OR_UNOBSERVABLE');
 }
 check(d.blockers.length===0 && layers.every(name=>d.layers[name].status==='pass') && counts.technical===60,'CLOSURE_BLOCKED');
 // Reuse the reviewed external smoke verifier, including its HMAC custody,
 // exact current examiner hashes, eight observations and screenshot digests.
 await privateFile(d.remoteSmokeGateInput,candidate);
 check(text(a.remoteSmokeApprovalReference),'SMOKE_APPROVAL_REQUIRED');
 const smoke=verifyReceipt({controller:resolve(import.meta.dirname,'../..'),candidate,gateInput:d.remoteSmokeGateInput,approvalReference:a.remoteSmokeApprovalReference});
 check(smoke.mode==='remote-authorized','REMOTE_SMOKE_REQUIRED');
 for(const f of frozen) check(hash(await readFile(f.file))===f.hash,'INPUT_CHANGED');
 check(hash((await privateFile(dossierFile,candidate)).bytes)===hash(dossierBytes) && hash((await privateFile(authorizationFile,candidate)).bytes)===hash(approvalBytes),'APPROVAL_CHANGED');
 check(identity(candidate)===sourceSha,'SOURCE_CHANGED');approvalValid(a,approvalReference,sourceSha,hash(dossierBytes));
 return {schema:'vexa-closure-verification-v1',status:'verified_closure_binding',sourceSha,counts,pmfValidated:false,formalAcceptance:false,productionValidated:false,statement:'Evidence binding and supervised closure checks only; runner acceptance and production authorization remain separate.'};
}
