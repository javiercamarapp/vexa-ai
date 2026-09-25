import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtemp, mkdir,writeFile,readFile,rm,chmod,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {hash,validateDossier,verifyClosure,privateFile} from './control.mjs';
const names=['documentation','local_software','synthetic_demo','real_pilot','production'];
function dossier() {return {schema:'vexa-closure-dossier-v1',sourceSha:'a'.repeat(40),pmfValidated:false,pitchDoesNotValidatePmf:true,blockers:[],layers:Object.fromEntries(names.map(domain=>[domain,{domain,status:'pass',evidence:[domain]}])),metrics:[{id:'comprehension',layer:'real_pilot',method:'timed interview',window:'authorized SYN test',status:'observed',numerator:1,denominator:2,value:0.5,evidence:'real_pilot'}],experiments:[{id:'retention',owner:'SYN owner',hypothesis:'Repeated independent use',measure:'retained participants / participants',exitCondition:'Observed cohort after agreed window',agreedDate:null,paymentMinor:null}],processes:[]};}
async function fixture(t) {
 const root=await mkdtemp(join(tmpdir(),'vexa-f0806-test-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const candidate=join(root,'candidate');await mkdir(candidate);
 const files={
  'docs/entrega/acta-cierre.json':'{"status":"historical_blocked","source_commit":"old"}',
  'docs/entrega/proximos-experimentos.md':'SYN experimental protocol, no PMF claim.',
  'docs/entrega/AUDITORIA-20-RUBROS.md':'SYN historical audit. No global pass.',
  'orchestration/graph.json':JSON.stringify({tasks:Array.from({length:60},(_,i)=>({id:`T${i}`}))}),
  'construccion/ESTADO-CONSTRUCCION.json':JSON.stringify({accepted_in_graph:Array.from({length:25},(_,i)=>`T${i}`),technical_ready_external_pending:Array.from({length:24},(_,i)=>`T${i+25}`),technical_ready_formal_pending:[]}),
  'tests/acceptance/trap.mjs':'throw new Error("CANDIDATE_EXECUTED");'
 };
 for(const [p,bytes] of Object.entries(files)){await mkdir(join(candidate,p,'..'),{recursive:true});await writeFile(join(candidate,p),bytes);}
 const git=args=>execFileSync('git',['-C',candidate,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 git(['init','-q']);git(['add','.']);git(['-c','user.name=SYN Test','-c','user.email=syn@example.invalid','commit','-qm','SYN fixture']);
 const d=dossier();d.sourceSha=git(['rev-parse','HEAD']);d.documents=Object.fromEntries(Object.entries(files).filter(([p])=>!p.startsWith('orchestration/')&&!p.startsWith('tests/')).map(([p,b])=>[p,hash(b)]));d.counts={technical:49,formal:25,total:60};d.evidence=[];
 const a={schema:'vexa-closure-authorization-v1',reference:'SYN supervisor fixture only',operator:'SYN operator',reviewer:'SYN independent',implementer:'SYN author',evidenceReviewed:true,operation:'verify_final_closure',expiresAt:new Date(Date.now()+60000).toISOString(),sourceSha:d.sourceSha,evidence:{},artifacts:{},processInventoryReviewed:true};
 for(const layer of names) {
  const artifact=join(root,layer+'-artifact.json'),artifactBytes=JSON.stringify({fixture:'SYN observation, never actual closure'});await writeFile(artifact,artifactBytes,{mode:0o600});a.artifacts[hash(artifactBytes)]=true;
  const receipt={schema:'vexa-closure-observation-v1',sourceSha:d.sourceSha,layer,status:'pass',synthetic:layer==='synthetic_demo',exitCode:0,command:'SYN control fixture',observer:'SYN observer',observedAt:new Date().toISOString(),artifacts:[{file:artifact,sha256:hash(artifactBytes)}],observations:layer==='real_pilot'?[{metric:'comprehension',subject:'SYN one',success:true,method:'timed interview',window:'authorized SYN test'},{metric:'comprehension',subject:'SYN two',success:false,method:'timed interview',window:'authorized SYN test'}]:[]};
  const bytes=JSON.stringify(receipt),file=join(root,layer+'.json');await writeFile(file,bytes,{mode:0o600});d.evidence.push({id:layer,file,sha256:hash(bytes)});a.evidence[layer]=hash(bytes);
 }
 const dossierFile=join(root,'dossier.json'),authorizationFile=join(root,'authorization.json');
 async function save(){const bytes=JSON.stringify(d);a.dossierSha256=hash(bytes);await writeFile(dossierFile,bytes,{mode:0o600});await writeFile(authorizationFile,JSON.stringify(a),{mode:0o600});}
 await save();return {root,candidate,d,a,save,dossierFile,authorizationFile,git,run:()=>verifyClosure({candidate,dossierFile,authorizationFile,approvalReference:a.reference})};
}
test('partial layers and unknown metrics are representable without closing',()=>{const d=dossier();d.layers.production={domain:'production',status:'not_run',owner:'SYN operator',exitCondition:'Observe remote production',evidence:[]};d.metrics=[{...d.metrics[0],status:'not_measured',numerator:null,denominator:null,value:null,evidence:null}];assert.equal(validateDossier(d),d);});
test('rejects unknown-as-zero, invented denominator and pitch-as-PMF',()=>{for(const mutate of [d=>{d.metrics[0]={...d.metrics[0],status:'not_measured',numerator:0,denominator:null,value:null,evidence:null};},d=>{d.metrics[0].denominator=null;},d=>{d.pmfValidated=true;}]){const d=dossier();mutate(d);assert.throws(()=>validateDossier(d),/F0806_(UNKNOWN_NOT_ZERO|METRIC_DENOMINATOR|PMF_CLAIM)/);}});
test('requires accountable blockers and genuine agreement references',()=>{let d=dossier();d.blockers=[{id:'pending',exitCondition:'Review'}];assert.throws(()=>validateDossier(d),/BLOCKER_OWNER_EXIT/);d=dossier();d.experiments[0].agreedDate='2026-10-01';assert.throws(()=>validateDossier(d),/DATE_WITHOUT_AGREEMENT/);});
test('bound SYN evidence and 49/60 remains formally blocked; candidate trap is never loaded',async t=>{const f=await fixture(t);await assert.rejects(f.run(),/CLOSURE_BLOCKED/);});
test('fake all-60 count does not override actual candidate task inventory',async t=>{const f=await fixture(t);f.d.counts.technical=60;await f.save();await assert.rejects(f.run(),/COUNT_MISMATCH/);});
test('source SHA and document hash mismatch reject before closure',async t=>{const f=await fixture(t);f.d.sourceSha='b'.repeat(40);await f.save();await assert.rejects(f.run(),/DOSSIER_SHA/);f.d.sourceSha=f.a.sourceSha;f.d.documents['docs/entrega/acta-cierre.json']='f'.repeat(64);await f.save();await assert.rejects(f.run(),/DOCUMENT_HASH/);});
test('not_run observation cannot count as pass',async t=>{const f=await fixture(t),ref=f.d.evidence[0],receipt=JSON.parse(await readFile(ref.file));receipt.status='not_run';const bytes=JSON.stringify(receipt);await writeFile(ref.file,bytes);ref.sha256=hash(bytes);f.a.evidence[ref.id]=ref.sha256;await f.save();await assert.rejects(f.run(),/OBSERVATION_NOT_PASS/);});
test('cross-layer evidence cannot turn SYN demo into real pilot',async t=>{const f=await fixture(t);f.d.layers.real_pilot.evidence=['synthetic_demo'];await f.save();await assert.rejects(f.run(),/CROSS_LAYER_EVIDENCE/);});
test('metrics are recalculated from distinct observations',async t=>{const f=await fixture(t);f.d.metrics[0].numerator=2;f.d.metrics[0].value=1;await f.save();await assert.rejects(f.run(),/METRIC_NUMERATOR/);});
test('expired approval and same author/reviewer reject',async t=>{const f=await fixture(t);f.a.expiresAt=new Date(0).toISOString();await f.save();await assert.rejects(f.run(),/APPROVAL_EXPIRED/);f.a.expiresAt=new Date(Date.now()+60000).toISOString();f.a.reviewer=f.a.implementer;await f.save();await assert.rejects(f.run(),/INDEPENDENT_REVIEW/);});
test('live PID cannot be marked collected; signal zero does not kill it',async t=>{const f=await fixture(t);f.d.processes=[{pid:process.pid,role:'SYN test process',host:'local',status:'collected',receipt:'local_software'}];await f.save();await assert.rejects(f.run(),/PROCESS_STILL_PRESENT/);assert.doesNotThrow(()=>process.kill(process.pid,0));});
test('private inputs reject symlinks, candidate paths, broad modes and oversize',async t=>{const f=await fixture(t);const link=join(f.root,'link');await symlink(f.dossierFile,link);await assert.rejects(privateFile(link,f.candidate),/PRIVATE_FILE/);await chmod(f.dossierFile,0o644);await assert.rejects(privateFile(f.dossierFile,f.candidate),/PRIVATE_FILE/);const inside=join(f.candidate,'inside.json');await writeFile(inside,'{}',{mode:0o600});await assert.rejects(privateFile(inside,f.candidate),/PRIVATE_OUTSIDE/);const large=join(f.root,'large.json');await writeFile(large,Buffer.alloc(4*1024*1024+1),{mode:0o600});await assert.rejects(privateFile(large,f.candidate),/PRIVATE_FILE/);});

test('altered artifact is rejected even when a receipt still says pass',async t=>{const f=await fixture(t),r=JSON.parse(await readFile(f.d.evidence[0].file));await writeFile(r.artifacts[0].file,'changed');await assert.rejects(f.run(),/ARTIFACT_HASH/);});
test('incomplete layers stay blocked even with exact source and reviewed observations',async t=>{const f=await fixture(t);f.d.layers.production={domain:'production',status:'blocked',owner:'SYN operator',exitCondition:'Actual deployment',evidence:[]};await f.save();await assert.rejects(f.run(),/CLOSURE_BLOCKED/);});
test('indexed source flags cannot hide modifications',async t=>{const f=await fixture(t);f.git(['update-index','--assume-unchanged','docs/entrega/acta-cierre.json']);await writeFile(join(f.candidate,'docs/entrega/acta-cierre.json'),'tampered');await assert.rejects(f.run(),/HIDDEN_INDEX/);});
test('agreement receipt must contain the claimed date and owner',async t=>{const f=await fixture(t);f.d.experiments[0].agreedDate='2026-10-01';f.d.experiments[0].agreementEvidence='real_pilot';await f.save();await assert.rejects(f.run(),/AGREEMENT_NOT_OBSERVED/);});
