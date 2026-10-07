import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawn,spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';

const control=path.resolve(fileURLToPath(new URL('../..',import.meta.url)));
const sha=value=>createHash('sha256').update(value).digest('hex');
const configPath=fileURLToPath(new URL('./security-components.json',import.meta.url));

export function parseTap(text){
  const names=[...text.matchAll(/^\s*# Subtest: (.+)$/gm)].map(match=>match[1]);
  const fileOnly=name=>path.isAbsolute(name)||/\.(?:mjs|cjs|js|tsx?)$/.test(name);
  const result={namedTests:names.filter(name=>!fileOnly(name)).length,fileOnlyTests:names.filter(fileOnly).length};
  for(const key of ['tests','pass','fail','cancelled','skipped','todo']){
    const matches=[...text.matchAll(new RegExp('^# '+key+' (\\d+)\\s*$','gm'))];
    result[key]=matches.length?Number(matches.at(-1)[1]):null;
  }
  return result;
}
export function successfulComponent(result,minTests=1){
  const t=result.tap;
  return result.exitCode===0&&result.signal===null&&!result.timedOut&&!result.spawnError&&
    t.tests!==null&&t.tests>=minTests&&t.pass===t.tests&&t.namedTests>0&&t.fileOnlyTests===0&&
    ['fail','cancelled','skipped','todo'].every(key=>t[key]===0);
}
function inside(root,relative){
  assert.equal(typeof relative,'string');
  const absolute=path.resolve(root,relative);
  assert.ok(absolute.startsWith(root+path.sep)&&!relative.split('/').some(x=>['private','.runtime','.git'].includes(x)),'UNSAFE_COMPONENT_PATH');
  assert.ok(fs.statSync(absolute).isFile(),'COMPONENT_FILE_REQUIRED:'+relative);
  return absolute;
}
function snapshot(root){
  const git=(args)=>{const r=spawnSync('git',['-C',root,...args],{encoding:'utf8',maxBuffer:32*1024*1024});assert.equal(r.status,0,'SOURCE_GIT_INVENTORY');return r.stdout;};
  const files=git(['ls-files','-z','--cached','--others','--exclude-standard']).split('\0').filter(Boolean)
    .filter(name=>!name.split('/').some(x=>['private','.runtime','.git','node_modules','.next'].includes(x)))
    .filter(name=>root===control? /^(?:tests\/acceptance|support|packages)\//.test(name)||['package.json','package-lock.json'].includes(name):/^(?:apps|packages|supabase|tests\/acceptance|support)\//.test(name)||['package.json','package-lock.json'].includes(name));
  const entries=[...new Set(files)].sort().map(name=>{const file=path.join(root,name),s=fs.lstatSync(file);assert.ok(!s.isSymbolicLink(),'SOURCE_SYMLINK:'+name);return{name,sha256:sha(fs.readFileSync(file))};});
  return{head:git(['rev-parse','HEAD']).trim(),sha256:sha(JSON.stringify(entries)),files:entries};
}
export async function runComponent(component,{candidate,evidence}){
  const root=component.source==='candidate'?candidate:control;
  const files=component.files.map(file=>inside(root,file));
  const log=path.join(evidence,component.id+'.log'),fd=fs.openSync(log,'wx',0o600);
  const args=['--experimental-strip-types','--test','--test-concurrency=1','--test-reporter=tap',...files];
  const env={...process.env,VEXA_CANDIDATE:candidate,VEXA_CONTROL_ROOT:control};
  // Outer node:test flags and arbitrary Node preload code must not filter children.
  delete env.NODE_OPTIONS;delete env.NODE_TEST_CONTEXT;delete env.F02_CASE_FILTER;delete env.HISTORY_FOCAL;
  const started=Date.now();let timedOut=false,spawnError=null,timer,killTimer;
  const child=spawn(process.execPath,args,{cwd:root,env,stdio:['ignore',fd,fd],detached:true});
  const kill=signal=>{if(!child.pid)return;try{process.kill(-child.pid,signal);}catch(e){if(e.code!=='ESRCH')throw e;}};
  const stop=()=>{if(timedOut)return;timedOut=true;kill('SIGTERM');killTimer=setTimeout(()=>kill('SIGKILL'),component.terminationGraceMs??2000);};
  const interrupted=()=>stop();
  process.once('SIGTERM',interrupted);process.once('SIGINT',interrupted);
  timer=setTimeout(stop,component.timeoutMs);
  const result=await new Promise(resolve=>{
    child.once('error',error=>{spawnError=error.message;});
    child.once('close',(exitCode,signal)=>resolve({exitCode,signal}));
  });
  clearTimeout(timer);clearTimeout(killTimer);
  process.removeListener('SIGTERM',interrupted);process.removeListener('SIGINT',interrupted);
  // No subprocess group from this component may outlive its verdict.
  if(child.pid)kill('SIGKILL');
  fs.closeSync(fd);
  const text=fs.readFileSync(log,'utf8');
  const receipt={id:component.id,command:[process.execPath,...args],cwd:root,log,logSha256:sha(text),durationMs:Date.now()-started,...result,timedOut,spawnError,tap:parseTap(text)};
  receipt.status=successfulComponent(receipt,component.minTests??1)?'PASS':'FAIL';
  fs.writeFileSync(path.join(evidence,component.id+'.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx',mode:0o600});
  return receipt;
}
export async function runSecurityComponents(){
  assert.ok(process.env.VEXA_CANDIDATE,'VEXA_CANDIDATE_REQUIRED');
  const candidate=fs.realpathSync(process.env.VEXA_CANDIDATE);
  assert.notEqual(candidate,control,'PRODUCT_AND_CONTROL_MUST_BE_DISJOINT');
  const config=JSON.parse(fs.readFileSync(configPath,'utf8'));
  assert.equal(config.schema,'rovaq-local-security-components-v1');
  assert.ok(Array.isArray(config.components)&&config.components.length>0);
  assert.equal(new Set(config.components.map(x=>x.id)).size,config.components.length);
  for(const c of config.components){assert.match(c.id,/^[a-z0-9-]+$/);assert.ok(['control','candidate'].includes(c.source));assert.ok(Number.isSafeInteger(c.timeoutMs)&&c.timeoutMs>0&&c.timeoutMs<=900000);assert.ok(c.files.length>0);if(c.terminationGraceMs!==undefined)assert.ok(c.id==='history-runtime'&&c.terminationGraceMs===180000,'SCOPED_HISTORY_RECOVERY_GRACE');}
  const evidence=fs.mkdtempSync(path.join(os.tmpdir(),'rovaq-f07-components-'));fs.chmodSync(evidence,0o700);
  const report={schema:config.schema,status:'FAIL',reason:'not completed',evidence,node:process.version,candidate,control,startedAt:new Date().toISOString(),components:[],coverageGaps:config.coverageGaps,accepted:false,production:false};
  const save=()=>fs.writeFileSync(path.join(evidence,'report.json'),JSON.stringify(report,null,2)+'\n',{mode:0o600});
  console.log('F07_SECURITY_EVIDENCE:'+evidence);save();
  try{
    assert.match(process.versions.node,/^22\./,'NODE22_REQUIRED');
    for(const c of config.components)for(const file of c.files)inside(c.source==='candidate'?candidate:control,file);
    report.before={candidate:snapshot(candidate),control:snapshot(control)};save();
    for(const component of config.components){
      console.log('F07_COMPONENT_START:'+component.id);
      const result=await runComponent(component,{candidate,evidence});report.components.push(result);save();
      console.log('F07_COMPONENT_RESULT:'+component.id+':'+result.status);
      if(result.status!=='PASS')throw Error('COMPONENT_FAILED:'+component.id);
    }
    const after={candidate:snapshot(candidate),control:snapshot(control)};
    report.sourcesUnchanged=Object.keys(after).every(key=>after[key].sha256===report.before[key].sha256&&after[key].head===report.before[key].head);
    assert.ok(report.sourcesUnchanged,'SOURCE_CHANGED_DURING_SECURITY_RUN');
    assert.ok(Array.isArray(config.coverageGaps),'COVERAGE_LEDGER_REQUIRED');
    assert.equal(config.coverageGaps.length,0,'REQUIRED_SECURITY_COVERAGE_INCOMPLETE');
    report.status='PASS';report.reason='all required components passed, sources unchanged, coverage closed';
  }catch(error){report.reason=error.message;}
  finally{
    if(report.before){try{report.after={candidate:snapshot(candidate),control:snapshot(control)};report.sourcesUnchanged=Object.keys(report.after).every(key=>report.after[key].sha256===report.before[key].sha256&&report.after[key].head===report.before[key].head);if(!report.sourcesUnchanged){report.status='FAIL';report.reason+='; SOURCE_CHANGED_DURING_SECURITY_RUN';}}catch(error){report.status='FAIL';report.reason+='; SOURCE_RECHECK_FAILED:'+error.message;}}
    report.finishedAt=new Date().toISOString();report.notRun=config.components.filter(c=>!report.components.some(r=>r.id===c.id)).map(c=>c.id);save();}
  return report;
}
