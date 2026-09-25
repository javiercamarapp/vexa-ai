import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,symlink,chmod} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {digest,inventory,verifyPermissions} from './control.mjs';
const epoch=Date.parse('2026-09-25T12:00:00Z');
const stamp=n=>new Date(epoch+n).toISOString();
async function fixture(t,identifiable=false){
 const base=await mkdtemp(join(tmpdir(),'vexa-f0804-test-')),candidate=join(base,'candidate'),pkg=join(candidate,'pitch');
 t.after(()=>rm(base,{recursive:true,force:true}));await mkdir(pkg,{recursive:true});
 await writeFile(join(pkg,'deck.txt'),'VEXA SYN ONLY — scenario, not observed revenue.');
 const manifestFile=join(base,'materials.json'),authorizationFile=join(base,'review.json'),doc=join(base,'document.txt');
 await writeFile(doc,'SYN DOCUMENT ONLY: does not authorize any actual publication.',{mode:0o600});
 const documentSha256=digest(await readFile(doc));
 const scope={purpose:'synthetic test',audiences:['SYN audience'],channels:['local fixture'],territories:['SYN territory']};
 const m={schema:'vexa-publication-materials-v1',mode:identifiable?'identifiable_material':'synthetic_vexa',directory:'pitch',scope,assets:(await inventory(candidate,'pitch')).map(x=>({...x,identifiers:identifiable?['company_name','logo']:[],brand:'VEXA',dataKind:'synthetic',syntheticLabelVisible:true,recorded:true,recordedLabelVisible:true,claims:[{text:'SYN forecast',classification:'scenario',presentedAs:'scenario',assumptions:'SYN price only',cutoff:'2026-09-25',sourceReference:'SYN model',causalSavingClaimed:false}]}))};
 const a={schema:'vexa-publication-review-v1',approvalReference:'SYN test review, not permission',operator:'SYN operator',reviewedAt:stamp(-1000),expiresAt:stamp(60000),operation:'verify_material_permissions',documentsActuallyCompared:true,completePackageVisuallyReviewed:true,claimsComparedToSources:true,revocationChecked:true,withdrawalOwner:'SYN owner',scope,evidence:identifiable?[{file:doc,sha256:documentSha256,reference:'SYN explicit publication record',reviewed:true,kind:'explicit_publication_permission'}]:[],permissions:identifiable?[{assetPath:m.assets[0].path,assetSha256:m.assets[0].sha256,status:'approved',revoked:false,holderIdentityAndAuthorityVerified:true,conditions:'SYN only',conditionsChecked:true,rights:['company_name','logo'],scope,approvedAt:stamp(-1000),startsAt:stamp(-1000),expiresAt:stamp(60000),documentSha256}]:[]};
 const save=async()=>{const b=JSON.stringify(m);a.manifestSha256=digest(b);await writeFile(manifestFile,b,{mode:0o600});await writeFile(authorizationFile,JSON.stringify(a),{mode:0o600});};await save();
 return {base,candidate,pkg,doc,m,a,save,args:{candidate,manifestFile,authorizationFile,approvalReference:a.approvalReference,now:()=>epoch}};
}
test('SYN complete exact package yields technical binding only; candidate examiner trap never runs',async t=>{
 const f=await fixture(t);await mkdir(join(f.candidate,'support/F08-permissions'),{recursive:true});await writeFile(join(f.candidate,'support/F08-permissions/control.mjs'),'throw new Error("CANDIDATE_EXAMINER_EXECUTED");');
 const r=await verifyPermissions(f.args);assert.equal(r.status,'synthetic_material_binding_verified');assert.equal(r.assetCount,1);assert.equal(r.publicationAuthorizedByThisTool,false);assert.equal(r.customerConsentProvenByThisTool,false);assert.equal(r.formalAcceptance,false);
});
test('SYN identifiable fixture binds reviewed document bytes without proving consent',async t=>{
 const f=await fixture(t,true);const r=await verifyPermissions(f.args);assert.equal(r.status,'reviewed_document_binding_verified');assert.equal(r.customerConsentProvenByThisTool,false);
});
test('added, removed and modified real files fail exact inventory; absent product fails',async t=>{
 for(const mode of ['added','removed','modified','absent'])await t.test(mode,async t=>{const f=await fixture(t);if(mode==='added')await writeFile(join(f.pkg,'hidden.txt'),'new identity');if(mode==='removed')await rm(join(f.pkg,'deck.txt'));if(mode==='modified')await writeFile(join(f.pkg,'deck.txt'),'changed');if(mode==='absent')await rm(f.pkg,{recursive:true});await assert.rejects(verifyPermissions(f.args),mode==='removed'?/F0804_EMPTY_PACKAGE/:mode==='absent'?/ENOENT/:/F0804_ASSET_INVENTORY_MISMATCH/);});
});
test('approval absence, mismatch, expiry, scope and operator cotejo fail closed',async t=>{
 const cases=[['missing note',f=>f.args.approvalReference='',/OPERATOR_REVIEW_REQUIRED/],['expired',f=>f.a.expiresAt=stamp(0),/REVIEW_EXPIRED/],['future review',f=>f.a.reviewedAt=stamp(1),/REVIEW_EXPIRED/],['overlong',f=>f.a.expiresAt=stamp(86400001),/REVIEW_EXPIRED/],['scope',f=>f.a.scope={...f.a.scope,channels:['another channel']},/SCOPE_MISMATCH/],['no cotejo',f=>f.a.documentsActuallyCompared=false,/OPERATOR_COTEJO_REQUIRED/],['no visual review',f=>f.a.completePackageVisuallyReviewed=false,/OPERATOR_COTEJO_REQUIRED/],['no claims review',f=>f.a.claimsComparedToSources=false,/OPERATOR_COTEJO_REQUIRED/],['revocation unchecked',f=>f.a.revocationChecked=false,/OPERATOR_COTEJO_REQUIRED/]];
 for(const [name,mutate,code] of cases)await t.test(name,async t=>{const f=await fixture(t);mutate(f);await f.save();await assert.rejects(verifyPermissions(f.args),code);});
});
test('NDA, missing grant, expired, revoked, partial rights and scope do not permit an identifiable asset',async t=>{
 const cases=[['NDA',f=>f.a.evidence[0].kind='nda_access',/EVIDENCE_NOT_PUBLICATION_PERMISSION/],['missing',f=>f.a.permissions=[],/ASSET_PERMISSION_REQUIRED/],['unapproved',f=>f.a.permissions[0].status='proposed',/ASSET_PERMISSION_UNAPPROVED/],['expired',f=>f.a.permissions[0].expiresAt=stamp(0),/ASSET_PERMISSION_EXPIRED/],['revoked',f=>f.a.permissions[0].revoked=true,/ASSET_PERMISSION_UNAPPROVED/],['authority',f=>f.a.permissions[0].holderIdentityAndAuthorityVerified=false,/ASSET_PERMISSION_UNAPPROVED/],['partial rights',f=>f.a.permissions[0].rights=['logo'],/PERMISSION_RIGHTS_INCOMPLETE/],['scope',f=>f.a.permissions[0].scope={...f.m.scope,territories:['another territory']},/PERMISSION_SCOPE_INCOMPLETE/],['duplicate',f=>f.a.permissions.push({...f.a.permissions[0]}),/ASSET_PERMISSION_REQUIRED/],['claim source not permission',f=>f.a.evidence[0].kind='claim_source',/EXPLICIT_PUBLICATION_DOCUMENT_REQUIRED/]];
 for(const [name,mutate,code] of cases)await t.test(name,async t=>{const f=await fixture(t,true);mutate(f);await f.save();await assert.rejects(verifyPermissions(f.args),code);});
});
test('forecast, proposal, synthetic and unmeasured claims cannot be presented as traction or signed agreements',async t=>{
 for(const kind of ['scenario','proposal','synthetic_fixture','not_measured'])await t.test(kind,async t=>{const f=await fixture(t);f.m.assets[0].claims[0]={text:'SYN claim',classification:kind,presentedAs:'observed',causalSavingClaimed:false};await f.save();await assert.rejects(verifyPermissions(f.args),/F0804_(FORECAST_IS_NOT_TRACTION|PROPOSAL_IS_NOT_SIGNED|SYN_IS_NOT_TRACTION|UNMEASURED_CLAIM)/);});
 const f=await fixture(t);f.m.assets[0].claims[0].causalSavingClaimed=true;await f.save();await assert.rejects(verifyPermissions(f.args),/CAUSAL_SAVING_UNVERIFIED/);
});
test('observed claim needs separately hashed reviewed source',async t=>{
 const f=await fixture(t);f.m.assets[0].claims=[{text:'SYN observed assertion',classification:'observed',presentedAs:'observed',causalSavingClaimed:false,evidenceSha256:digest('absent')}];await f.save();await assert.rejects(verifyPermissions(f.args),/OBSERVED_SOURCE_UNREVIEWED/);
});
test('synthetic mode rejects identifiable content classification and missing labels',async t=>{
 for(const type of ['identity','synthetic label','recorded label'])await t.test(type,async t=>{const f=await fixture(t);if(type==='identity')f.m.assets[0].identifiers=['logo'];if(type==='synthetic label')f.m.assets[0].syntheticLabelVisible=false;if(type==='recorded label')f.m.assets[0].recordedLabelVisible=false;await f.save();await assert.rejects(verifyPermissions(f.args),/SYNTHETIC_SCOPE_INVALID|RECORDED_LABEL_REQUIRED/);});
});
test('manifest/document byte mutations, private file mode, inside candidate and symlinks rejected',async t=>{
 for(const type of ['manifest','document','mode','inside','symlink','directory escape'])await t.test(type,async t=>{
  const f=await fixture(t,true);let code;
  if(type==='manifest'){f.m.assets[0].claims=[];await writeFile(f.args.manifestFile,JSON.stringify(f.m));code=/MANIFEST_BINDING/;}
  if(type==='document'){await writeFile(f.doc,'changed');code=/EVIDENCE_HASH_MISMATCH/;}
  if(type==='mode'){await chmod(f.args.manifestFile,0o644);code=/PRIVATE_FILE_INVALID/;}
  if(type==='inside'){f.args.manifestFile=join(f.candidate,'review.json');await writeFile(f.args.manifestFile,JSON.stringify(f.m),{mode:0o600});code=/PRIVATE_INPUT_INSIDE_CANDIDATE/;}
  if(type==='symlink'){await symlink(f.doc,join(f.pkg,'link'));code=/ASSET_SYMLINK/;}
  if(type==='directory escape'){f.m.directory='../outside';await f.save();code=/MATERIAL_DIRECTORY_INVALID/;}
  await assert.rejects(verifyPermissions(f.args),code);
 });
});
test('expiry during inventory/doc recheck does not yield a favorable result',async t=>{
 const f=await fixture(t,true);let calls=0;f.args.now=()=>++calls<=4?epoch:epoch+60001;await assert.rejects(verifyPermissions(f.args),/REVIEW_EXPIRED|ASSET_PERMISSION_EXPIRED/);
});
test('acceptance entry without external pointers fails before candidate execution',()=>{
 const env={...process.env};delete env.NODE_TEST_CONTEXT;for(const k of Object.keys(env))if(k.startsWith('VEXA_'))delete env[k];
 const r=spawnSync(process.execPath,['--test',resolve('tests/acceptance/F08-04.test.mjs')],{env,encoding:'utf8',timeout:10000});assert.equal(r.status,1);assert.match(r.stdout+r.stderr,/F0804_EXTERNAL_BLOCKED/);
});
test('permission expiry alone during final recheck is rejected while operator review remains current',async t=>{
 const f=await fixture(t,true);f.a.expiresAt=stamp(120000);await f.save();let calls=0;f.args.now=()=>++calls<=4?epoch:epoch+60001;await assert.rejects(verifyPermissions(f.args),/ASSET_PERMISSION_EXPIRED/);
});
test('real acceptance entry yields only a private SYN binding receipt; no external publication',async t=>{
 const f=await fixture(t);const now=Date.now();f.a.reviewedAt=new Date(now-1000).toISOString();f.a.expiresAt=new Date(now+60000).toISOString();await f.save();
 const env={...process.env,VEXA_CANDIDATE:f.candidate,VEXA_PERMISSIONS_MANIFEST:f.args.manifestFile,VEXA_PERMISSIONS_AUTHORIZATION:f.args.authorizationFile,VEXA_PERMISSIONS_APPROVAL_REFERENCE:f.args.approvalReference};delete env.NODE_TEST_CONTEXT;
 const r=spawnSync(process.execPath,['--test',resolve('tests/acceptance/F08-04.test.mjs')],{env,encoding:'utf8',timeout:10000});assert.equal(r.status,0,r.stdout+r.stderr);
 const match=(r.stdout+r.stderr).match(/F08-04 evidence: ([^\r\n]+)/);assert.ok(match);const out=match[1].trim();t.after(()=>rm(out,{recursive:true,force:true}));
 const report=JSON.parse(await readFile(join(out,'report.json')));assert.equal(report.mode,'synthetic_vexa');assert.equal(report.publicationAuthorizedByThisTool,false);assert.equal(report.customerConsentProvenByThisTool,false);
});
