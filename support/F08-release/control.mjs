import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {lstat,readFile,realpath} from 'node:fs/promises';
import {isAbsolute,relative} from 'node:path';
import {createReleaseManifest} from '../../packages/release/manifest.mjs';

export const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const requireThat=(value,code)=>{if(!value)throw new Error(code);};
const text=value=>typeof value==='string'&&value.trim().length>=3&&value.length<=500;
export async function privateInput(file,candidate){
 requireThat(typeof file==='string'&&isAbsolute(file),'F0801_PRIVATE_INPUT_REQUIRED');
 const stat=await lstat(file),resolved=await realpath(file),root=await realpath(candidate),rel=relative(root,resolved);
 requireThat(stat.isFile()&&!stat.isSymbolicLink()&&(stat.mode&0o777)===0o600&&stat.size<=4*1024*1024,'F0801_PRIVATE_INPUT_INVALID');
 requireThat(rel==='..'||rel.startsWith('../')||isAbsolute(rel),'F0801_INPUT_INSIDE_CANDIDATE');
 const bytes=await readFile(file);return {bytes,value:JSON.parse(bytes)};
}
export function currentApproval(approval,reference){
 requireThat(approval?.schema==='vexa-release-verification-authorization-v1'&&text(reference)&&approval.approvalReference===reference&&text(approval.operator),'F0801_SUPERVISOR_APPROVAL_REQUIRED');
 const expires=Date.parse(approval.expiresAt);
 requireThat(expires>Date.now()&&expires<=Date.now()+86400000,'F0801_APPROVAL_EXPIRED');
 requireThat(approval.environment==='remote-authorized'&&approval.operation==='read_release_identity','F0801_APPROVAL_SCOPE_INVALID');
 let url;try{url=new URL(approval.origin);}catch{throw new Error('F0801_DESTINATION_INVALID');}
 requireThat(url.origin===approval.origin&&url.protocol==='https:'&&!url.username&&!url.password,'F0801_DESTINATION_INVALID');
}
export function compareInventory(manifest,inventory){
 requireThat(manifest?.schema_version===inventory.schema_version,'F0801_MANIFEST_SCHEMA');
 try{
  assert.deepEqual(manifest.source,inventory.source);
  assert.equal(manifest.build.revision_variable,'VEXA_BUILD_REVISION');
  assert.equal(manifest.build.required_value,inventory.source.commit_sha);
  assert.equal(manifest.build.served_revision_endpoint,'/api/health/version');
  assert.deepEqual(manifest.environment_names.map(({name,exposure})=>({name,exposure})),inventory.environment_names.map(({name,exposure})=>({name,exposure})));
 }catch{throw new Error('F0801_SOURCE_INVENTORY_MISMATCH');}
 for(const item of manifest.environment_names){
  requireThat(typeof item.required_in_target==='boolean','F0801_ENVIRONMENT_REVIEW_REQUIRED');
  if(item.required_in_target)requireThat(text(item.rotation_owner),'F0801_ROTATION_OWNER_REQUIRED');
 }
 for(const role of ['release','database','operations','customer'])requireThat(text(manifest.owners?.[role]),'F0801_OWNERS_REQUIRED');
}
export function compareDestination(manifest,approval){
 const d=manifest.destination;
 requireThat(d?.operator_verified===true&&approval.projectRefsVerified===true,'F0801_PROJECT_REVIEW_REQUIRED');
 requireThat(['preview','production'].includes(d.environment)&&d.environment===approval.targetEnvironment,'F0801_ENVIRONMENT_MISMATCH');
 requireThat(d.url===approval.origin&&manifest.source.commit_sha===approval.releaseSha,'F0801_DESTINATION_BINDING');
 requireThat(/^[a-z]{20}$/.test(d.supabase_project_ref??'')&&/^prj_[A-Za-z0-9]+$/.test(d.vercel_project_id??''),'F0801_PROJECT_IDS_REQUIRED');
 requireThat(d.supabase_project_ref===approval.supabaseProjectRef&&d.vercel_project_id===approval.vercelProjectId,'F0801_PROJECT_IDS_MISMATCH');
 requireThat(approval.separateEnvironmentVerified===true,'F0801_ENVIRONMENT_SEPARATION_REQUIRED');
}
const kinds=['independent_review','critical_findings','restore_drill','local_regressions','remote_smoke','remote_served_sha','production_authorization'];
export async function verifyEvidence(manifest,approval,candidate){
 const verified=[];
 // These are supervisor-reviewed records, not machine-generated permission.
 // Digests bind the exact evidence the supervisor approved; they do not certify its truth.
 for(const kind of kinds){
  const ref=manifest.evidence?.[kind],approved=approval.evidence?.[kind];
  requireThat(ref&&typeof ref==='object'&&/^[a-f0-9]{64}$/.test(ref.sha256??'')&&text(ref.reference),'F0801_EVIDENCE_REQUIRED');
  requireThat(approved?.sha256===ref.sha256&&approved.reference===ref.reference&&approved.reviewed===true,'F0801_EVIDENCE_NOT_APPROVED');
  const {bytes}=await privateInput(ref.file,candidate);
  requireThat(digest(bytes)===ref.sha256,'F0801_EVIDENCE_HASH_MISMATCH');
  verified.push({kind,sha256:ref.sha256});
 }
 const coverage=approval.reviewCoverage;
 requireThat(coverage?.sourceSha===manifest.source.commit_sha&&coverage.entireRelease===true&&coverage.openP0===0&&coverage.openP1===0&&coverage.criticalTestsOmitted===0&&Array.isArray(coverage.excludedScopes)&&coverage.excludedScopes.length===0,'F0801_REVIEW_COVERAGE_INCOMPLETE');
 requireThat(text(coverage.reviewer)&&text(coverage.implementer)&&coverage.reviewer!==coverage.implementer,'F0801_INDEPENDENT_REVIEW_REQUIRED');
 return verified;
}
export async function observeRevision(origin,expectedSha,{authorize=()=>{},timeoutMs=10000}={}){
 authorize();let response;
 try{response=await fetch(new URL('/api/health/version',origin),{method:'GET',redirect:'manual',credentials:'omit',cache:'no-store',headers:{Accept:'application/json'},signal:AbortSignal.timeout(timeoutMs)});}catch{throw new Error('F0801_IDENTITY_TRANSPORT_FAILED');}
 if(response.status!==200||response.redirected){await response.body?.cancel().catch(()=>{});throw new Error('F0801_IDENTITY_HTTP_STATUS');}
 const reader=response.body?.getReader();requireThat(reader,'F0801_IDENTITY_BODY_REQUIRED');
 let length=0;const chunks=[];
 try{while(true){authorize();const {done,value}=await reader.read();if(done)break;length+=value.byteLength;requireThat(length<=16384,'F0801_IDENTITY_BODY_TOO_LARGE');chunks.push(value);}}
 catch(error){if(/^F0801_/.test(error?.message??''))throw error;throw new Error('F0801_IDENTITY_TRANSPORT_FAILED');}
 finally{await reader.cancel().catch(()=>{});}
 authorize();let value;try{value=JSON.parse(Buffer.concat(chunks));}catch{throw new Error('F0801_IDENTITY_JSON_INVALID');}
 requireThat(value.contract_version==='1'&&value.data?.service==='vexa-web'&&value.data?.revision===expectedSha,'F0801_SERVED_SHA_MISMATCH');
 return {expectedSha,observedSha:value.data.revision,bodySha256:digest(Buffer.concat(chunks)),observedAt:new Date().toISOString()};
}
export async function verifyRelease({candidate,manifestFile,authorizationFile,approvalReference}){
 const [{value:manifest,bytes},{value:approval}]=await Promise.all([privateInput(manifestFile,candidate),privateInput(authorizationFile,candidate)]);
 currentApproval(approval,approvalReference);
 const inventory=await createReleaseManifest(candidate);
 compareInventory(manifest,inventory);compareDestination(manifest,approval);
 const evidence=await verifyEvidence(manifest,approval,candidate);
 const observed=await observeRevision(approval.origin,inventory.source.commit_sha,{authorize:()=>currentApproval(approval,approvalReference)});
 // Detect source edits during the remote request instead of certifying a stale inventory.
 const after=await createReleaseManifest(candidate);assert.deepEqual(after.source,inventory.source,'F0801_SOURCE_CHANGED');
 currentApproval(approval,approvalReference);
 return {schema:'vexa-release-binding-verification-v1',status:'verified_binding',mode:'remote-authorized',sourceSha:inventory.source.commit_sha,manifestSha256:digest(bytes),evidence,identity:observed,formalAcceptance:false,productionValidated:false,statement:'Live identity and inventory verified. Human evidence and authorization were supplied and remain subject to independent review.'};
}
