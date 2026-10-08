import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
import {spawn,spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {recoverOwnedResources} from './history-cleanup.mjs';

const control=path.resolve(fileURLToPath(new URL('../..',import.meta.url)));
const sha=value=>createHash('sha256').update(value).digest('hex');
const configPath=fileURLToPath(new URL('./security-components.json',import.meta.url));

function validateComponents(config){
  assert.equal(config.schema,'rovaq-local-security-components-v1');
  assert.ok(Array.isArray(config.components)&&config.components.length>0);
  assert.equal(new Set(config.components.map(x=>x.id)).size,config.components.length);
  for(const c of config.components){
    assert.match(c.id,/^[a-z0-9-]+$/);assert.ok(['control','candidate'].includes(c.source));
    assert.ok(Number.isSafeInteger(c.timeoutMs)&&c.timeoutMs>0&&(c.timeoutMs<=900000||c.id==='sql-isolation'&&c.timeoutMs===2160000),'SCOPED_COMPONENT_TIMEOUT');
    assert.ok(Array.isArray(c.files)&&c.files.length>0);
    if(c.terminationGraceMs!==undefined)assert.ok(c.id==='history-runtime'&&c.terminationGraceMs===180000,'SCOPED_HISTORY_RECOVERY_GRACE');
  }
}
export function securityTimeoutMs(config=JSON.parse(fs.readFileSync(configPath,'utf8'))){
  validateComponents(config);
  // Existing case deadlines stay inside their component. The outer controller
  // also needs bounded signal grace, owned-resource recovery and receipt time.
  return config.components.reduce((total,c)=>total+c.timeoutMs+(c.terminationGraceMs??2000)+90000,60000);
}

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
    !(result.lifecycleErrors?.length)&&!result.recoveryError&&result.processGroupAbsent!==false&&
    t.tests!==null&&t.tests>=minTests&&t.pass===t.tests&&t.namedTests>0&&t.fileOnlyTests===0&&
    ['fail','cancelled','skipped','todo'].every(key=>t[key]===0);
}
export function inspectProcessGroup(pgid){
  const result=spawnSync('ps',['-axo','pid=,pgid='],{encoding:'utf8',timeout:5000,killSignal:'SIGKILL',maxBuffer:4*1024*1024});
  if(result.error||result.status!==0)return {state:'unknown',error:result.error?.code??'PS_FAILED'};
  const rows=result.stdout.trim().split('\n').filter(Boolean).map(line=>line.trim().split(/\s+/));
  if(!rows.length||rows.some(row=>row.length!==2||row.some(value=>!/^\d+$/.test(value))))return {state:'unknown',error:'PS_INVALID'};
  const pids=rows.filter(row=>Number(row[1])===pgid).map(row=>Number(row[0]));
  return {state:pids.length?'present':'absent',pids};
}
export function signalProcessGroup(pgid,signal,{kill=process.kill.bind(process),inspect=inspectProcessGroup}={}){
  try{kill(-pgid,signal);return {signal,state:'sent'};}
  catch(error){
    if(error.code==='ESRCH')return {signal,state:'absent',code:error.code};
    const group=inspect(pgid);
    // macOS can report EPERM for an already-disappeared process group. Only an
    // independent successful process inventory makes that condition benign.
    if(error.code==='EPERM'&&group.state==='absent')return {signal,state:'absent',code:error.code,group};
    return {signal,state:'failed',code:error.code??'SIGNAL_FAILED',group};
  }
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
  const log=path.join(evidence,component.id+'.log');
  const args=['--experimental-strip-types','--test','--test-concurrency=1','--test-reporter=tap',...files];
  const broker=randomUUID(),journal=path.join(evidence,component.id+'-resources.jsonl');
  fs.writeFileSync(journal,'',{flag:'wx',mode:0o600});
  const env={...process.env,VEXA_CANDIDATE:candidate,VEXA_CONTROL_ROOT:control,VEXA_CI_BROKER:broker,VEXA_CI_JOURNAL:journal};
  // Outer node:test flags and arbitrary Node preload code must not filter children.
  delete env.NODE_OPTIONS;delete env.NODE_TEST_CONTEXT;delete env.F02_CASE_FILTER;delete env.HISTORY_FOCAL;
  const started=Date.now(),receipt={id:component.id,command:[process.execPath,...args],cwd:root,log,broker,journal,status:'FAIL',reason:'component running',signals:[],lifecycleErrors:[],exitCode:null,signal:null,timedOut:false,spawnError:null,tap:parseTap('')};
  const receiptPath=path.join(evidence,component.id+'.json');
  fs.writeFileSync(receiptPath,JSON.stringify(receipt,null,2)+'\n',{flag:'wx',mode:0o600});
  const save=()=>{receipt.durationMs=Date.now()-started;fs.writeFileSync(receiptPath,JSON.stringify(receipt,null,2)+'\n',{mode:0o600});};
  let child,fd,timer,killTimer,abandonTimer,resolveCompletion;
  const kill=signal=>{
    if(!child?.pid)return;
    const outcome=signalProcessGroup(child.pid,signal);receipt.signals.push(outcome);
    if(outcome.state==='failed')receipt.lifecycleErrors.push('SIGNAL_'+signal+':'+outcome.code);
    save();
  };
  const stop=()=>{
    if(receipt.timedOut)return;receipt.timedOut=true;save();kill('SIGTERM');
    killTimer=setTimeout(()=>{
      kill('SIGKILL');
      // Even a live group that cannot be signalled must leave a durable FAIL
      // receipt, rather than keeping the controller waiting indefinitely.
      abandonTimer=setTimeout(()=>{
        receipt.lifecycleErrors.push('PROCESS_CLOSE_UNCONFIRMED');save();
        child?.unref();resolveCompletion?.();
      },2000);
    },component.terminationGraceMs??2000);
  };
  const interrupted=()=>stop();
  try{
    fd=fs.openSync(log,'wx',0o600);
    child=spawn(process.execPath,args,{cwd:root,env,stdio:['ignore',fd,fd],detached:true});
    receipt.pid=child.pid??null;save();
    process.once('SIGTERM',interrupted);process.once('SIGINT',interrupted);
    timer=setTimeout(stop,component.timeoutMs);
    await new Promise(resolve=>{
      resolveCompletion=resolve;
      child.once('error',error=>{receipt.spawnError=error.message;save();});
      child.once('close',(exitCode,signal)=>{receipt.exitCode=exitCode;receipt.signal=signal;resolve();});
    });
  }catch(error){receipt.lifecycleErrors.push(error.message);}
  finally{
    clearTimeout(timer);clearTimeout(killTimer);clearTimeout(abandonTimer);
    process.removeListener('SIGTERM',interrupted);process.removeListener('SIGINT',interrupted);
    if(child?.pid){
      kill('SIGKILL');
      const deadline=Date.now()+2000;let group=inspectProcessGroup(child.pid);
      while(group.state==='present'&&Date.now()<deadline){await new Promise(resolve=>setTimeout(resolve,50));group=inspectProcessGroup(child.pid);}
      receipt.processGroup=group;receipt.processGroupAbsent=group.state==='absent';
      if(!receipt.processGroupAbsent)receipt.lifecycleErrors.push('PROCESS_GROUP_NOT_ABSENT:'+group.state);
    }else receipt.processGroupAbsent=true;
    if(fd!==undefined)try{fs.closeSync(fd);}catch(error){receipt.lifecycleErrors.push('LOG_CLOSE:'+error.message);}
    try{const text=fs.readFileSync(log,'utf8');receipt.logSha256=sha(text);receipt.tap=parseTap(text);}catch(error){receipt.lifecycleErrors.push('LOG_READ:'+error.message);}
    receipt.status=successfulComponent(receipt,component.minTests??1)?'PASS':'FAIL';
    receipt.reason=receipt.status==='PASS'?'completed':'component or lifecycle failed';save();
    if(receipt.status==='FAIL'){
      receipt.recoveryEvidence=path.join(evidence,component.id+'-recovery.json');
      if(!receipt.processGroupAbsent)receipt.recoveryError='RECOVERY_BLOCKED_LIVE_OR_UNKNOWN_PROCESS_GROUP';
      else try{recoverOwnedResources({journal,broker,evidence:receipt.recoveryEvidence});receipt.recoveryComplete=true;}
      catch(error){receipt.recoveryError=error.message;receipt.recoveryComplete=false;}
      // Recovery never promotes a timeout, failed test or failed signal to PASS.
      save();
    }
  }
  return receipt;
}
export async function runSecurityComponents(){
  assert.ok(process.env.VEXA_CANDIDATE,'VEXA_CANDIDATE_REQUIRED');
  const candidate=fs.realpathSync(process.env.VEXA_CANDIDATE);
  assert.notEqual(candidate,control,'PRODUCT_AND_CONTROL_MUST_BE_DISJOINT');
  const config=JSON.parse(fs.readFileSync(configPath,'utf8'));
  validateComponents(config);
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
