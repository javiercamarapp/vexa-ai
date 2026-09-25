import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {lstat,readFile,readdir,realpath} from 'node:fs/promises';
import {isAbsolute,join,relative} from 'node:path';

export const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const need=(ok,code)=>{if(!ok)throw new Error('F0804_'+code);};
const text=v=>typeof v==='string'&&v.trim().length>=3&&v.length<=1000;
const hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const within=(root,path)=>{const r=relative(root,path);return r===''||(!r.startsWith('../')&&r!=='..'&&!isAbsolute(r));};
const kinds=['company_name','logo','customer_data','case_study','quotation','customer_metrics'];
const ordered=(v,allowed)=>Array.isArray(v)&&v.length<=100&&v.every(x=>text(x)&&(!allowed||allowed.includes(x)))&&new Set(v).size===v.length&&JSON.stringify(v)===JSON.stringify([...v].sort());
function equal(a,b,code){try{assert.deepEqual(a,b);}catch{throw new Error('F0804_'+code);}}
export async function privateBytes(file,candidate){
 need(isAbsolute(file??''),'PRIVATE_PATH_REQUIRED');
 const s=await lstat(file),p=await realpath(file);
 need(s.isFile()&&!s.isSymbolicLink()&&(s.mode&0o777)===0o600&&s.size>0&&s.size<=16*1024*1024,'PRIVATE_FILE_INVALID');
 need(!within(await realpath(candidate),p),'PRIVATE_INPUT_INSIDE_CANDIDATE');
 return readFile(p);
}
export async function inventory(candidate,directory){
 need(typeof directory==='string'&&/^[a-zA-Z0-9_.-]+(?:\/[a-zA-Z0-9_.-]+)*$/.test(directory)&&!directory.split('/').some(x=>x==='.'||x==='..'||x==='.git'),'MATERIAL_DIRECTORY_INVALID');
 const root=await realpath(candidate);let path=root;
 for(const component of directory.split('/')){path=join(path,component);const s=await lstat(path);need(s.isDirectory()&&!s.isSymbolicLink(),'MATERIAL_DIRECTORY_INVALID');}
 const files=[];let total=0,nodes=0;
 async function walk(dir,prefix='',depth=0){
  need(depth<=20,'PACKAGE_TOO_DEEP');
  for(const name of (await readdir(dir)).sort()){
   need(!/[\x00-\x1f\x7f]/.test(name),'ASSET_PATH_INVALID');
   need(++nodes<=2000,'PACKAGE_TOO_LARGE');
   const p=join(dir,name),s=await lstat(p),rel=prefix+name;
   need(!s.isSymbolicLink(),'ASSET_SYMLINK');
   if(s.isDirectory())await walk(p,rel+'/',depth+1);
   else {need(s.isFile()&&s.size<=256*1024*1024,'ASSET_TYPE_OR_SIZE');total+=s.size;need(total<=512*1024*1024&&files.length<500,'PACKAGE_TOO_LARGE');const b=await readFile(p);need(b.length===s.size,'ASSET_CHANGED_DURING_READ');files.push({path:rel,bytes:b.length,sha256:digest(b)});}
  }
 }
 await walk(path);need(files.length>0,'EMPTY_PACKAGE');return files.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
}
function current(a,reference,now){
 need(a?.schema==='vexa-publication-review-v1'&&text(reference)&&a.approvalReference===reference&&text(a.operator),'OPERATOR_REVIEW_REQUIRED');
 const start=Date.parse(a.reviewedAt),end=Date.parse(a.expiresAt);
 need(Number.isFinite(start)&&start<=now&&end>now&&end-start<=86400000,'REVIEW_EXPIRED');
 need(a.operation==='verify_material_permissions'&&a.documentsActuallyCompared===true&&a.completePackageVisuallyReviewed===true&&a.claimsComparedToSources===true&&a.revocationChecked===true,'OPERATOR_COTEJO_REQUIRED');
 need(text(a.withdrawalOwner),'WITHDRAWAL_OWNER_REQUIRED');
}
function scope(s){need(s&&text(s.purpose)&&ordered(s.audiences)&&s.audiences.length>0&&ordered(s.channels)&&s.channels.length>0&&ordered(s.territories)&&s.territories.length>0,'SCOPE_REQUIRED');}
function claims(asset){
 need(Array.isArray(asset.claims),'CLAIMS_REQUIRED');
 for(const c of asset.claims){
  need(text(c.text)&&['synthetic_fixture','scenario','proposal','observed','not_measured'].includes(c.classification),'CLAIM_CLASSIFICATION');
  need(c.causalSavingClaimed===false,'CAUSAL_SAVING_UNVERIFIED');
  if(c.classification==='scenario')need(c.presentedAs==='scenario'&&text(c.assumptions)&&text(c.cutoff)&&text(c.sourceReference),'FORECAST_IS_NOT_TRACTION');
  if(c.classification==='proposal')need(c.presentedAs==='proposal'&&c.signedAgreementClaimed===false,'PROPOSAL_IS_NOT_SIGNED');
  if(c.classification==='synthetic_fixture')need(c.presentedAs==='synthetic_fixture'&&c.commercialTractionClaimed===false,'SYN_IS_NOT_TRACTION');
  if(c.classification==='not_measured')need(c.presentedAs==='not_measured','UNMEASURED_CLAIM');
  if(c.classification==='observed')need(c.presentedAs==='observed'&&hash(c.evidenceSha256),'OBSERVED_EVIDENCE_REQUIRED');
 }
}
export async function verifyPermissions({candidate,manifestFile,authorizationFile,approvalReference,now=()=>Date.now()}){
 const [mb,ab]=await Promise.all([privateBytes(manifestFile,candidate),privateBytes(authorizationFile,candidate)]);
 const m=JSON.parse(mb),a=JSON.parse(ab);current(a,approvalReference,now());
 need(m?.schema==='vexa-publication-materials-v1'&&Array.isArray(m.assets)&&m.assets.length>0,'MANIFEST_REQUIRED');
 need(a.manifestSha256===digest(mb),'MANIFEST_BINDING');scope(m.scope);equal(a.scope,m.scope,'SCOPE_MISMATCH');
 need(['synthetic_vexa','identifiable_material'].includes(m.mode),'MODE_INVALID');
 const actual=await inventory(candidate,m.directory);
 equal(m.assets.map(({path,bytes,sha256})=>({path,bytes,sha256})),actual,'ASSET_INVENTORY_MISMATCH');
 need(Array.isArray(a.evidence)&&Array.isArray(a.permissions),'EVIDENCE_REGISTER_REQUIRED');
 const seen=new Set(),evidence=[];
 for(const e of a.evidence){
  need(hash(e.sha256)&&!seen.has(e.sha256)&&text(e.reference)&&e.reviewed===true&&['explicit_publication_permission','claim_source'].includes(e.kind),'EVIDENCE_NOT_PUBLICATION_PERMISSION');seen.add(e.sha256);
  const b=await privateBytes(e.file,candidate);need(digest(b)===e.sha256,'EVIDENCE_HASH_MISMATCH');evidence.push({file:e.file,sha256:e.sha256});
 }
 let identifiable=0;
 for(const asset of m.assets){
  need(ordered(asset.identifiers,kinds),'IDENTIFIERS_REQUIRED');claims(asset);
  if(m.mode==='synthetic_vexa')need(asset.identifiers.length===0&&asset.brand==='VEXA'&&asset.dataKind==='synthetic'&&asset.syntheticLabelVisible===true,'SYNTHETIC_SCOPE_INVALID');
  if(asset.recorded===true)need(asset.recordedLabelVisible===true,'RECORDED_LABEL_REQUIRED');
  for(const c of asset.claims.filter(c=>c.classification==='observed'))need(a.evidence.some(e=>e.sha256===c.evidenceSha256&&e.kind==='claim_source'),'OBSERVED_SOURCE_UNREVIEWED');
  if(asset.identifiers.length){
   identifiable++;
   const permits=a.permissions.filter(p=>p.assetPath===asset.path&&p.assetSha256===asset.sha256);
   need(permits.length===1,'ASSET_PERMISSION_REQUIRED');const p=permits[0];
   need(p.status==='approved'&&p.revoked===false&&p.holderIdentityAndAuthorityVerified===true&&text(p.conditions)&&p.conditionsChecked===true,'ASSET_PERMISSION_UNAPPROVED');
   equal(p.rights,asset.identifiers,'PERMISSION_RIGHTS_INCOMPLETE');equal(p.scope,m.scope,'PERMISSION_SCOPE_INCOMPLETE');
   need(Date.parse(p.approvedAt)<=now()&&Date.parse(p.startsAt)<=now()&&Date.parse(p.expiresAt)>now(),'ASSET_PERMISSION_EXPIRED');
   need(a.evidence.some(e=>e.sha256===p.documentSha256&&e.kind==='explicit_publication_permission'),'EXPLICIT_PUBLICATION_DOCUMENT_REQUIRED');
  }
 }
 need(a.permissions.length===identifiable,'EXTRA_OR_DUPLICATE_PERMISSION');
 if(m.mode==='identifiable_material')need(identifiable>0,'IDENTIFIABLE_SCOPE_EMPTY');
 // Recheck all bound bytes immediately before returning. No executable candidate imports.
 equal(await inventory(candidate,m.directory),actual,'MATERIAL_CHANGED_DURING_CHECK');
 for(const e of evidence)need(digest(await privateBytes(e.file,candidate))===e.sha256,'EVIDENCE_CHANGED_DURING_CHECK');
 need(digest(await privateBytes(manifestFile,candidate))===digest(mb)&&digest(await privateBytes(authorizationFile,candidate))===digest(ab),'REVIEW_INPUT_CHANGED');current(a,approvalReference,now());
 for(const p of a.permissions)need(Date.parse(p.approvedAt)<=now()&&Date.parse(p.startsAt)<=now()&&Date.parse(p.expiresAt)>now(),'ASSET_PERMISSION_EXPIRED');
 return {schema:'vexa-publication-binding-result-v1',status:m.mode==='synthetic_vexa'?'synthetic_material_binding_verified':'reviewed_document_binding_verified',manifestSha256:digest(mb),packageSha256:digest(JSON.stringify(actual)),assetCount:actual.length,mode:m.mode,checkedAt:new Date(now()).toISOString(),formalAcceptance:false,publicationAuthorizedByThisTool:false,customerConsentProvenByThisTool:false,productionValidated:false};
}
