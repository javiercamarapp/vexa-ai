import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp,mkdir,writeFile,readFile,chmod,symlink,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createReleaseManifest} from '../../packages/release/manifest.mjs';
import {currentApproval,compareInventory,compareDestination,observeRevision,privateInput,verifyEvidence,digest} from './control.mjs';

const sha='a'.repeat(40),ref='SYN-owner-authorized-identity-test-only';
function approval(){return {schema:'vexa-release-verification-authorization-v1',operator:'SYN operator',approvalReference:ref,expiresAt:new Date(Date.now()+60000).toISOString(),environment:'remote-authorized',operation:'read_release_identity',origin:'https://vexa.example',targetEnvironment:'preview',releaseSha:sha,supabaseProjectRef:'a'.repeat(20),vercelProjectId:'prj_SYN',projectRefsVerified:true,separateEnvironmentVerified:true};}
async function server(fn){const sockets=new Set();const s=createServer(fn);s.on('connection',socket=>{sockets.add(socket);socket.on('close',()=>sockets.delete(socket));});await new Promise(r=>s.listen(0,'127.0.0.1',r));return {url:'http://127.0.0.1:'+s.address().port,close:async()=>{for(const socket of sockets)socket.destroy();await new Promise(r=>s.close(r));}};}

test('approval is bound to supervisor reference, operation, origin, expiry and projects',()=>{
 const a=approval();currentApproval(a,ref);
 for(const [key,value,code]of [['approvalReference','another-reference','SUPERVISOR'],['expiresAt','2000-01-01','EXPIRED'],['operation','deploy','SCOPE'],['origin','https://vexa.example/not-an-origin','DESTINATION']])assert.throws(()=>currentApproval({...a,[key]:value},ref),new RegExp(code));
 const manifest={source:{commit_sha:sha},destination:{environment:'preview',url:a.origin,supabase_project_ref:a.supabaseProjectRef,vercel_project_id:a.vercelProjectId,operator_verified:true}};compareDestination(manifest,a);
 for(const delta of [{releaseSha:'b'.repeat(40)},{supabaseProjectRef:'b'.repeat(20)},{targetEnvironment:'production'},{separateEnvironmentVerified:false},{projectRefsVerified:false}])assert.throws(()=>compareDestination(manifest,{...a,...delta}),/F0801_/);
});

test('real Git inventory rejects stale SHA, altered migrations, extra sources and unresolved env ownership',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'f0801-inventory-')),root=join(folder,'candidate');await mkdir(root);
 const git=(...args)=>execFileSync('git',['-C',root,...args],{stdio:'pipe'});
 try{
  const files={'.gitignore':'.env\n','package-lock.json':'{}','apps/web/next.config.ts':'export default {};','apps/web/src/app/api/health/version/route.ts':'export const revision=process.env.VEXA_COMPILED_REVISION;','packages/runtime.mjs':'const key=env.SYN_SERVER_KEY;','supabase/migrations/0001_fixture.sql':'select 1;'};
  for(const [name,value]of Object.entries(files)){await mkdir(join(root,name,'..'),{recursive:true});await writeFile(join(root,name),value);}
  git('init','-q');git('add','.');git('commit','-qm','SYN controller fixture');
  await writeFile(join(root,'.env'),'SYN_SERVER_KEY=DO_NOT_RECORD');
  const inventory=await createReleaseManifest(root),manifest=structuredClone(inventory);
  manifest.environment_names=manifest.environment_names.map(x=>({...x,required_in_target:true,rotation_owner:'SYN operator'}));manifest.owners=Object.fromEntries(['release','database','operations','customer'].map(x=>[x,'SYN owner']));
  compareInventory(manifest,inventory);assert.ok(!JSON.stringify(inventory).includes('DO_NOT_RECORD'));
  const mutations=[x=>x.source.commit_sha='0'.repeat(40),x=>x.source.migration_order=[],x=>x.source.files.push({path:'missing',sha256:'a'.repeat(64)}),x=>x.build.required_value='0'.repeat(40),x=>x.environment_names[0].required_in_target='operator_review_required',x=>x.environment_names[0].rotation_owner=null];
  for(const mutate of mutations){const changed=structuredClone(manifest);mutate(changed);assert.throws(()=>compareInventory(changed,inventory),/F0801_/);}
  await writeFile(join(root,'package-lock.json'),'changed');await assert.rejects(createReleaseManifest(root),/RELEASE_SOURCE_DIRTY/);
 }finally{await rm(folder,{recursive:true,force:true});}
});

test('private evidence must be outside candidate, hash-bound, approved individually and cover all release scopes',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'f0801-evidence-')),candidate=join(folder,'candidate');await mkdir(candidate);
 try{
  const file=join(folder,'evidence.json');await writeFile(file,JSON.stringify({label:'SYN evidence, no human approval'}),{mode:0o600});const bytes=await readFile(file);
  const evidence=Object.fromEntries(['independent_review','critical_findings','restore_drill','local_regressions','remote_smoke','remote_served_sha','production_authorization'].map(kind=>[kind,{file,sha256:digest(bytes),reference:'SYN-'+kind}]));
  const manifest={source:{commit_sha:sha},evidence},a={...approval(),evidence:Object.fromEntries(Object.entries(evidence).map(([kind,value])=>[kind,{...value,reviewed:true}])),reviewCoverage:{sourceSha:sha,entireRelease:true,openP0:0,openP1:0,criticalTestsOmitted:0,excludedScopes:[],reviewer:'SYN reviewer',implementer:'SYN author'}};
  assert.equal((await verifyEvidence(manifest,a,candidate)).length,7);
  for(const mutate of [x=>x.reviewCoverage.openP1=1,x=>x.reviewCoverage.criticalTestsOmitted=1,x=>x.reviewCoverage.excludedScopes=['unreviewed'],x=>x.reviewCoverage.reviewer=x.reviewCoverage.implementer,x=>delete x.evidence.restore_drill]){const changed=structuredClone(a);mutate(changed);await assert.rejects(verifyEvidence(manifest,changed,candidate),/F0801_/);}
  await writeFile(file,'{}');await assert.rejects(verifyEvidence(manifest,a,candidate),/HASH_MISMATCH/);
  await chmod(file,0o644);await assert.rejects(privateInput(file,candidate),/PRIVATE_INPUT_INVALID/);await chmod(file,0o600);
  await symlink(file,join(folder,'link.json'));await assert.rejects(privateInput(join(folder,'link.json'),candidate),/PRIVATE_INPUT_INVALID/);
  const inside=join(candidate,'input.json');await writeFile(inside,'{}',{mode:0o600});await assert.rejects(privateInput(inside,candidate),/INPUT_INSIDE_CANDIDATE/);
 }finally{await rm(folder,{recursive:true,force:true});}
});

test('identity is observed over HTTP, ignores generic READY and refuses redirect without contacting its target',async()=>{
 let redirectHits=0;const target=await server((req,res)=>{redirectHits++;res.end('{}');});
 const app=await server((req,res)=>{assert.equal(req.url,'/api/health/version');assert.equal(req.headers.cookie,undefined);res.setHeader('Content-Type','application/json');res.end(JSON.stringify({contract_version:'1',data:{service:'vexa-web',revision:sha,status:'READY'}}));});
 const ready=await server((req,res)=>res.end('{"status":"READY"}'));
 const redirect=await server((req,res)=>{res.writeHead(302,{Location:target.url});res.end();});
 try{
  const result=await observeRevision(app.url,sha);assert.equal(result.observedSha,sha);
  await assert.rejects(observeRevision(app.url,'b'.repeat(40)),/SERVED_SHA_MISMATCH/);
  await assert.rejects(observeRevision(ready.url,sha),/SERVED_SHA_MISMATCH/);
  await assert.rejects(observeRevision(redirect.url,sha),/IDENTITY_HTTP_STATUS/);assert.equal(redirectHits,0);
 }finally{await Promise.all([target.close(),app.close(),ready.close(),redirect.close()]);}
});

test('bounded HTTP body, actual transport timeout and expiry during response never produce PASS',async()=>{
 let calls=0;const app=await server((req,res)=>{calls++;res.writeHead(200,{'Content-Type':'application/json'});res.write(' '.repeat(20000));res.end();});
 const stalled=await server((req,res)=>{res.writeHead(200);res.write('{');});
 const slow=await server((req,res)=>{res.writeHead(200);res.write('{');setTimeout(()=>res.end('"contract_version":"1","data":{"service":"vexa-web","revision":"'+sha+'"}}'),70).unref();});
 try{
  await assert.rejects(observeRevision(app.url,sha),/BODY_TOO_LARGE/);
  await assert.rejects(observeRevision(stalled.url,sha,{timeoutMs:40}),/TRANSPORT_FAILED/);
  let allowed=true;const timer=setTimeout(()=>{allowed=false;},15);
  await assert.rejects(observeRevision(slow.url,sha,{authorize:()=>{if(!allowed)throw new Error('F0801_APPROVAL_EXPIRED');}}),/APPROVAL_EXPIRED/);clearTimeout(timer);
  const before=calls;await assert.rejects(observeRevision(app.url,sha,{authorize:()=>{throw new Error('F0801_APPROVAL_EXPIRED');}}),/EXPIRED/);assert.equal(calls,before);
 }finally{await Promise.all([app.close(),stalled.close(),slow.close()]);}
});
