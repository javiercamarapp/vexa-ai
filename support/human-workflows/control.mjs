import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {evaluatePilot} from '../../packages/intelligence/evaluation/pilot.mjs';
import {hashValue,evaluate} from '../../packages/intelligence/evaluation/evaluate.mjs';

export const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const need=(ok,code)=>{if(!ok)throw Error('HUMAN_WORKFLOW_'+code);};
const text=v=>typeof v==='string'&&v.trim().length>=3&&v.length<=1000;
const hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const within=(root,p)=>{const r=path.relative(root,p);return r===''||(!r.startsWith('../')&&r!=='..'&&!path.isAbsolute(r));};
const required={
 'F07-05':['packages/intelligence/evaluation/pilot.mjs','packages/intelligence/evaluation/pilot-cli.mjs','packages/intelligence/evaluation/evaluate.mjs','packages/intelligence/evaluation/cli.mjs','packages/intelligence/evaluation/PILOT.md'],
 'F08-03':['docs/entrega/demo-script.md','docs/entrega/demo-backup-manifest.json','docs/entrega/demo-backup.webm','docs/entrega/portabilidad-crm-resultados.json'],
 'F08-05':['docs/entrega/README.md','docs/entrega/GUIA-USUARIO.md','docs/entrega/GUIA-DESARROLLADOR.md','docs/entrega/RUNBOOK.md','docs/entrega/ACCESOS-SIN-SECRETOS.md','docs/entrega/BACKLOG.md'],
};
function read(file,{privateInput=false,candidate}={}){
 need(path.isAbsolute(file??''),'ABSOLUTE_PATH');
 const before=fs.lstatSync(file,{bigint:true}),real=fs.realpathSync(file);
 need(before.isFile()&&!before.isSymbolicLink()&&before.size>0n&&before.size<=16000000n,'FILE_INVALID');
 if(privateInput){
  const physicalAlias=file.replace(/^\/var\//,'/private/var/').replace(/^\/tmp\//,'/private/tmp/');
  need((Number(before.mode)&0o777)===0o600&&!within(candidate,real)&&(real===file||real===physicalAlias),'PRIVATE_INPUT');
  const parent=fs.lstatSync(path.dirname(real));need(parent.isDirectory()&&!parent.isSymbolicLink()&&(parent.mode&0o777)===0o700,'PRIVATE_PARENT');
 }
 const bytes=fs.readFileSync(file),after=fs.lstatSync(file,{bigint:true});
 need(['dev','ino','size','mtimeNs','ctimeNs'].every(k=>before[k]===after[k])&&BigInt(bytes.length)===after.size,'FILE_CHANGED');
 return {file,bytes,sha256:digest(bytes)};
}
const parse=f=>{try{return JSON.parse(f.bytes);}catch{throw Error('HUMAN_WORKFLOW_JSON');}};
function same(a,b,code){try{assert.deepEqual(a,b);}catch{throw Error('HUMAN_WORKFLOW_'+code);}}
function fileFor(candidate,relative){
 need(typeof relative==='string'&&relative.split('/').every(p=>p&&p!=='.'&&p!=='..')&&!path.isAbsolute(relative),'SOURCE_PATH');
 let current=candidate;for(const part of relative.split('/')){current=path.join(current,part);need(!fs.lstatSync(current).isSymbolicLink(),'SOURCE_SYMLINK');}
 return current;
}
function isInstant(v){return typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v.replace(/(?<!\.\d{3})Z$/,'.000Z');}
function instant(v){need(isInstant(v),'TIME');return Date.parse(v);}
function human(a){need(a?.kind==='human_observation'&&a.status==='completed'&&text(a.observer)&&text(a.evidenceReference),'HUMAN_ACT_REQUIRED');}
export function pilotOracle({study,evaluation,evaluationReceipt,pilot,pilotReceipt},sources){
 need(study?.kind==='human'&&evaluation?.status==='measured','HUMAN_DATA_REQUIRED');
 const recomputed=evaluatePilot({study,evaluation});same(pilot,recomputed,'PILOT_RECOMPUTATION');
 need(recomputed.status==='requires_human_review'&&recomputed.blocking_reasons.length===0,'PILOT_BLOCKED');
 need(recomputed.metrics.ceo_comprehension.completed_under_five_minutes>0,'CEO_COMPREHENSION');
 need(recomputed.metrics.sponsored_action.numerator>0,'SPONSOR_REQUIRED');
 need(evaluationReceipt?.schema_version==='vexa-evaluation-receipt-v1'&&evaluationReceipt.exit_code===0&&evaluationReceipt.status==='measured'&&evaluationReceipt.result_hash===hashValue(evaluation)&&evaluationReceipt.release_decision==='not_issued','EVALUATION_RECEIPT');
 need(pilotReceipt?.schema_version==='vexa-pilot-receipt-v1'&&pilotReceipt.exit_code===0&&pilotReceipt.result_hash===hashValue(pilot)&&pilotReceipt.status===pilot.status&&pilotReceipt.release_decision==='not_issued','PILOT_RECEIPT');
 for(const [key,file]of [['engine_hash','pilot.mjs'],['cli_hash','pilot-cli.mjs'],['evaluation_engine_hash','evaluate.mjs'],['evaluation_cli_hash','cli.mjs']])need(pilotReceipt[key]===sources['packages/intelligence/evaluation/'+file],'ENGINE_CHANGED');
 need(evaluationReceipt.engine_hash===pilotReceipt.evaluation_engine_hash&&evaluationReceipt.cli_hash===pilotReceipt.evaluation_cli_hash,'EVALUATION_ENGINE');
 need(evaluationReceipt.exposure?.protocol_hash===evaluation.input_hashes.protocol&&evaluationReceipt.exposure?.holdout_hash===evaluation.input_hashes.holdout&&evaluationReceipt.exposure?.candidate_hash===hashValue(evaluation.candidate)&&evaluationReceipt.exposure?.prediction_hash===evaluation.input_hashes.predictions,'EXPERIMENT_BINDING');
}
export function pitchOracle(act,backup){
 human(act);const elapsed=instant(act.finishedAt)-instant(act.startedAt);
 need(elapsed>0&&elapsed<=300000&&act.comprehensionConfirmed===true,'PITCH_TIMING');
 need(act.offlinePlaybackObserved===true&&act.externalRequests===0&&act.fallbackLabelObserved===true&&act.portabilityObserved===true,'PITCH_OBSERVATIONS');
 same(act.financial,{currency:'USD',exponent:2,exposureMinor:'30000',refundsMinor:'1500',additive:false,causalSavingClaimed:false},'PITCH_FINANCIAL');
 need(backup?.synthetic_fixture?.no_real_customer_data===true&&backup.financial?.exposure_minor==='30000'&&backup.financial?.refunds_minor==='1500'&&backup.financial?.additive===false&&backup.financial?.causal_saving_claimed===false,'BACKUP_FINANCIAL');
 need(act.materialMode==='synthetic_vexa','IDENTIFIABLE_MATERIAL_REQUIRES_SEPARATE_PERMISSION_GATE');
}
export function handoffOracle(act){
 human(act);need(text(act.recipient)&&act.recipient!==act.observer&&['oauth','secret_manager'].includes(act.deliveryChannel),'RECEIPT_REQUIRED');
 for(const key of ['followingGuideOnly','login','import','jobTerminal','viewsAndEvidence','export','logoutAndReentry','duplicateImportDeduplicated','revocationObserved','received'])need(act[key]===true,'HANDOFF_OBSERVATION');
 need(text(act.owner)&&text(act.deputy)&&act.owner!==act.deputy&&text(act.incidentReference),'OPERATORS_REQUIRED');
 need(instant(act.nextReviewAt)>instant(act.completedAt),'NEXT_REVIEW');
 need(Array.isArray(act.pending)&&act.pending.every(x=>text(x.id)&&text(x.owner)&&text(x.acceptance)&&text(x.reproduction)&&['P0','P1','P2','P3'].includes(x.severity)&&isInstant(x.dueAt)),'PENDING_REGISTER');
}
export function verifyHumanWorkflow({task,candidate,manifestFile,reviewFile,reviewSha256,approvalReference,now=()=>Date.now()}){
 need(required[task]&&candidate&&manifestFile&&reviewFile&&hash(reviewSha256)&&text(approvalReference),'EXTERNAL_INPUTS_REQUIRED');
 candidate=fs.realpathSync(candidate);const git=(...a)=>execFileSync('git',['-C',candidate,...a],{encoding:'utf8',timeout:10000}).trim();
 const head=git('rev-parse','HEAD');need(/^[a-f0-9]{40}$/.test(head)&&git('status','--porcelain')==='','CANDIDATE_DIRTY');
 const inputs=[],take=(file,priv=true)=>{const r={...read(file,{privateInput:priv,candidate}),privateInput:priv};inputs.push(r);return r;};
 const mb=take(manifestFile),rb=take(reviewFile);need(rb.sha256===reviewSha256,'TRUSTED_REVIEW_PIN');const m=parse(mb),r=parse(rb);
 need(m.schema==='vexa-human-workflow-v1'&&m.task===task&&m.candidateSha===head,'MANIFEST_IDENTITY');
 need(r.schema==='vexa-human-workflow-review-v1'&&r.task===task&&r.candidateSha===head&&r.manifestSha256===mb.sha256&&r.approvalReference===approvalReference&&r.operation==='verify_human_workflow','REVIEW_BINDING');
 need(r.controlSha256===digest(fs.readFileSync(new URL(import.meta.url))),'REVIEW_CONTROL_BINDING');
 need(text(r.operator)&&text(r.reviewer)&&r.operator!==r.reviewer&&r.authenticityReviewed===true&&r.authorityCurrent===true&&r.decision==='approved'&&r.syntheticEvidenceAcceptedAsHuman===false,'HUMAN_REVIEW_REQUIRED');
 const reviewedAt=instant(r.reviewedAt),expiresAt=instant(r.expiresAt),current=now();need(reviewedAt<=current&&expiresAt>current&&expiresAt-reviewedAt<=86400000&&expiresAt>reviewedAt,'REVIEW_EXPIRED');
 const sources={};need(Array.isArray(m.sources),'SOURCES_REQUIRED');
 for(const pin of m.sources){need(hash(pin.sha256)&&!sources[pin.path],'SOURCE_PIN');const b=take(fileFor(candidate,pin.path),false);need(b.sha256===pin.sha256,'SOURCE_CHANGED');sources[pin.path]=b.sha256;}
 for(const name of required[task])need(sources[name],'REQUIRED_SOURCE');
 const artifacts={},bytes={};need(Array.isArray(m.artifacts)&&m.artifacts.length>0,'ARTIFACTS_REQUIRED');
 for(const pin of m.artifacts){need(text(pin.name)&&hash(pin.sha256)&&!artifacts[pin.name],'ARTIFACT_PIN');const b=take(pin.file);need(b.sha256===pin.sha256,'ARTIFACT_CHANGED');artifacts[pin.name]=parse(b);bytes[pin.name]=b;}
 human(artifacts.act);need(artifacts.act.observer===r.reviewer&&r.humanActSha256===bytes.act.sha256,'ACT_REVIEW_BINDING');
 const actFinished=instant(task==='F08-03'?artifacts.act.finishedAt:artifacts.act.completedAt);need(actFinished<=reviewedAt,'ACT_AFTER_REVIEW');
 if(task==='F07-05'){
  for(const name of required[task])need(digest(fs.readFileSync(new URL('../../'+name,import.meta.url)))===sources[name],'TRUSTED_EVALUATOR_CHANGED');
  same(artifacts.evaluation,evaluate({protocol:artifacts.protocol,dataset:artifacts.dataset,predictions:artifacts.predictions}),'F04_RECOMPUTATION');
  pilotOracle(artifacts,sources);const p=artifacts.pilotReceipt,e=artifacts.evaluationReceipt;
  need(p.result_file_hash===bytes.pilot.sha256&&e.result_file_hash===bytes.evaluation.sha256,'RESULT_BYTES');
  same(p.input_file_hashes,{study:bytes.study.sha256,evaluation:bytes.evaluation.sha256,evaluation_receipt:bytes.evaluationReceipt.sha256},'PILOT_INPUT_BYTES');
  for(const name of ['protocol','dataset','predictions'])need(bytes[name]&&e.input_file_hashes?.[name]===bytes[name].sha256,'F04_INPUT_BYTES');
  need(instant(artifacts.study.reviewed_at)<=actFinished,'PILOT_REVIEW_ORDER');
  need(artifacts.act.goldCustodyReviewed===true&&artifacts.act.doubleAnnotationReviewed===true&&artifacts.act.consentsReviewed===true&&artifacts.act.representativenessReviewed===true&&r.acceptanceCriteriaReviewed===true,'PILOT_HUMAN_AUDIT');
 }else if(task==='F08-03'){
  const backup=parse(take(fileFor(candidate,'docs/entrega/demo-backup-manifest.json'),false));pitchOracle(artifacts.act,backup);
  const video=take(fileFor(candidate,'docs/entrega/demo-backup.webm'),false);need(video.sha256===backup.video.sha256&&video.bytes.length===backup.video.bytes,'BACKUP_BYTES');
 }else {
  handoffOracle(artifacts.act);need(instant(artifacts.act.nextReviewAt)>current,'NEXT_REVIEW_EXPIRED');
  const source=take(fileFor(candidate,'docs/entrega/BACKLOG.md'),false),ids=[...source.bytes.toString().matchAll(/^\|\s+(ENT-\d+)\s+\//gm)].map(m=>m[1]).sort();
  need(ids.length>0&&artifacts.backlog?.sourceSha256===source.sha256&&r.backlogScopeReviewed===true&&Array.isArray(artifacts.backlog.rows),'BACKLOG_BINDING');
  const rows=artifacts.backlog.rows;same(rows.map(x=>x.id).sort(),ids,'BACKLOG_INVENTORY');
  for(const row of rows)need(['open','closed'].includes(row.status)&&text(row.evidenceReference),'BACKLOG_ROW');
  same(artifacts.act.pending.map(x=>x.id).sort(),rows.filter(x=>x.status==='open').map(x=>x.id).sort(),'BACKLOG_PENDING');
 }
 for(const input of inputs)need(read(input.file,{candidate,privateInput:input.privateInput}).sha256===input.sha256,'INPUT_CHANGED');
 need(now()<expiresAt&&git('rev-parse','HEAD')===head&&git('status','--porcelain')==='','RECHECK_FAILED');
 return {task,candidateSha:head,status:'operator_reviewed_workflow_verified',manifestSha256:mb.sha256,reviewSha256:rb.sha256,formalAcceptance:false,productionValidated:false};
}
