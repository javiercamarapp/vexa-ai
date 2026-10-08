import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {runComponent,signalProcessGroup,successfulComponent,securityTimeoutMs,inspectProcessGroup} from './security-components.mjs';
import {recoverOwnedResources} from './history-cleanup.mjs';
import {runHistoryChild} from './history-process.mjs';

const base=fs.mkdtempSync(path.join(os.tmpdir(),'rovaq-f07-runner-calibration-'));
console.log('F07_RUNNER_CALIBRATION:'+base);
function fixture(id,body){
  const candidate=path.join(base,id),evidence=path.join(candidate,'evidence');fs.mkdirSync(evidence,{recursive:true,mode:0o700});
  fs.writeFileSync(path.join(candidate,'case.test.mjs'),body);
  return {component:{id,source:'candidate',files:['case.test.mjs'],timeoutMs:5000,minTests:1},options:{candidate,evidence}};
}
const receipt=f=>JSON.parse(fs.readFileSync(path.join(f.options.evidence,f.component.id+'.json'),'utf8'));
const eperm=()=>{throw Object.assign(new Error('kill EPERM'),{code:'EPERM'});};

test('outer deadline includes component budgets, scoped grace, recovery and receipts',()=>{
  const config={schema:'rovaq-local-security-components-v1',components:[
    {id:'sql-isolation',source:'control',files:['sql.test.mjs'],timeoutMs:2160000},
    {id:'history-runtime',source:'control',files:['history.test.mjs'],timeoutMs:900000,terminationGraceMs:180000},
  ]};
  assert.equal(securityTimeoutMs(config),2160000+900000+2000+180000+2*90000+60000);
});
test('SQL deadline exception cannot expand other components or arbitrary case budgets',()=>{
  const component={id:'other',source:'control',files:['case.test.mjs'],timeoutMs:2160000};
  const config=c=>({schema:'rovaq-local-security-components-v1',components:[c]});
  for(const c of [component,{...component,id:'sql-isolation',timeoutMs:2160001},{...component,id:'sql-isolation',timeoutMs:1000000},{...component,timeoutMs:0},{...component,timeoutMs:100,terminationGraceMs:180000}])
    assert.throws(()=>securityTimeoutMs(config(c)),/SCOPED_COMPONENT_TIMEOUT|SCOPED_HISTORY_RECOVERY_GRACE/);
});

test('EPERM is benign only after an independent absent group inventory',()=>{
  for(const state of ['present','unknown','absent']){
    const result=signalProcessGroup(123,'SIGKILL',{kill:eperm,inspect:()=>({state,pids:state==='present'?[456]:[]})});
    assert.equal(result.code,'EPERM');assert.equal(result.state,state==='absent'?'absent':'failed');
  }
});
test('ordinary child keeps exact PASS TAP and an exclusive 0600 journal',async()=>{
  const f=fixture('positive',"import test from 'node:test';test('actual positive',()=>{});");
  const r=await runComponent(f.component,f.options);
  assert.equal(r.status,'PASS');assert.equal(r.tap.tests,1);assert.equal(r.processGroupAbsent,true);
  assert.match(r.broker,/^[0-9a-f-]{36}$/);assert.equal(fs.statSync(r.journal).mode&0o777,0o600);assert.equal(receipt(f).status,'PASS');
});
test('post-exit EPERM still writes the final receipt and preserves its evidence',async()=>{
  const f=fixture('post-exit-eperm',"import test from 'node:test';test('actual positive',()=>{});");
  const original=process.kill;
  process.kill=function(pid,signal){if(pid<0&&signal==='SIGKILL')return eperm();return original.call(process,pid,signal);};
  try{
    const r=await runComponent(f.component,f.options);
    assert.equal(r.status,'PASS');assert.ok(r.signals.some(s=>s.code==='EPERM'&&s.state==='absent'));
    assert.equal(receipt(f).logSha256,r.logSha256);assert.equal(receipt(f).processGroupAbsent,true);
  }finally{process.kill=original;}
});
test('standalone history records post-exit EPERM and proves owned group absent',async()=>{
  const directory=path.join(base,'standalone-history');fs.mkdirSync(directory);
  const fd=fs.openSync(path.join(directory,'child.log'),'wx',0o600),receiptPath=path.join(directory,'lifecycle.json');
  const original=process.kill;process.kill=function(pid,signal){if(pid<0&&signal==='SIGKILL')return eperm();return original.call(process,pid,signal);};
  try{
    const r=await runHistoryChild({args:['-e',''],cwd:directory,env:process.env,fd,sharedGroup:false,receiptPath,timeoutMs:3000});
    assert.equal(r.mode,'owned-group');assert.equal(r.processGroupAbsent,true);assert.equal(r.exitCode,0);assert.equal(r.deferredRecovery,false);assert.deepEqual(r.lifecycleErrors,[]);
    assert.ok(r.signals.some(s=>s.code==='EPERM'&&s.state==='absent'));assert.equal(JSON.parse(fs.readFileSync(receiptPath,'utf8')).processGroupAbsent,true);
  }finally{process.kill=original;fs.closeSync(fd);}
});
test('real child timeout remains FAIL after empty owned-journal recovery',async()=>{
  const f=fixture('timeout',"import test from 'node:test';test('held operation',async()=>{await new Promise(()=>{});});setInterval(()=>{},1000);");
  f.component.timeoutMs=500;
  const r=await runComponent(f.component,f.options);
  assert.equal(r.timedOut,true);assert.equal(r.status,'FAIL');assert.equal(r.processGroupAbsent,true);
  assert.equal(r.recoveryComplete,true);assert.equal(receipt(f).status,'FAIL');
  assert.equal(JSON.parse(fs.readFileSync(r.recoveryEvidence,'utf8')).recorded,0);
});
test('foreign broker journal fails closed before any Docker recovery command',async()=>{
  const f=fixture('wrong-owner',"import test from 'node:test';import fs from 'node:fs';test('failed fixture',()=>{fs.appendFileSync(process.env.VEXA_CI_JOURNAL,JSON.stringify({kind:'container',name:'vexa-f01-03-11111111-1111-1111-1111-111111111111-db',broker:'22222222-2222-2222-2222-222222222222'})+'\\n');throw Error('SYN_EXPECTED_FAILURE');});");
  const r=await runComponent(f.component,f.options);
  assert.equal(r.status,'FAIL');assert.match(r.recoveryError,/RECOVERY_BROKER_MISMATCH/);assert.equal(r.recoveryComplete,false);
  assert.equal(receipt(f).recoveryError,r.recoveryError);
});
test('a live or unknown group permission failure cannot promote valid TAP to PASS',()=>{
  const passing={exitCode:0,signal:null,timedOut:false,spawnError:null,processGroupAbsent:true,lifecycleErrors:[],tap:{tests:1,pass:1,namedTests:1,fileOnlyTests:0,fail:0,cancelled:0,skipped:0,todo:0}};
  assert.equal(successfulComponent(passing),true);
  assert.equal(successfulComponent({...passing,lifecycleErrors:['SIGNAL_SIGKILL:EPERM']}),false);
  assert.equal(successfulComponent({...passing,processGroupAbsent:false}),false);
  assert.equal(successfulComponent({...passing,recoveryError:'RECOVERY_LABEL_MISMATCH'}),false);
});

test('composed history descendant shares group and dies before owned recovery inspects resources',async()=>{
  const f=fixture('nested-history',''),runtime=path.join(f.options.candidate,'runtime.mjs'),grandchild=path.join(f.options.candidate,'grandchild.pid');
  const helper=new URL('./history-process.mjs',import.meta.url).href;
  fs.writeFileSync(runtime,`import {spawn} from 'node:child_process';import fs from 'node:fs';const c=spawn(process.execPath,['-e',"process.on('SIGTERM',()=>{});setInterval(()=>{},1000)"],{stdio:'ignore'});fs.writeFileSync(${JSON.stringify(grandchild)},String(c.pid));setInterval(()=>{},1000);`);
  const lifecycle=path.join(f.options.candidate,'lifecycle.json');
  fs.writeFileSync(path.join(f.options.candidate,'case.test.mjs'),`import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {runHistoryChild} from ${JSON.stringify(helper)};
test('history watchdog leaves descendants to controller',async()=>{
  fs.appendFileSync(process.env.VEXA_CI_JOURNAL,JSON.stringify({kind:'container',name:'vexa-f01-03-11111111-1111-1111-1111-111111111111-db',broker:process.env.VEXA_CI_BROKER})+'\\n');
  const fd=fs.openSync(${JSON.stringify(path.join(f.options.candidate,'runtime.log'))},'w');
  const r=await runHistoryChild({args:[${JSON.stringify(runtime)}],cwd:process.cwd(),env:process.env,fd,sharedGroup:true,timeoutMs:500,graceMs:100,receiptPath:${JSON.stringify(lifecycle)}});fs.closeSync(fd);
  assert.equal(r.mode,'component-group');assert.equal(r.deferredRecovery,true);
  process.kill(Number(fs.readFileSync(${JSON.stringify(grandchild)},'utf8')),0);
  assert.equal(r.timedOut,false,'SYN_EXPECTED_TIMEOUT_AFTER_PROVING_DESCENDANT_ALIVE');
});`);
  const bin=path.join(f.options.candidate,'bin'),observed=path.join(f.options.candidate,'inspected-after-absence');fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin,'docker'),`#!${process.execPath}
const fs=require('node:fs');const pid=Number(fs.readFileSync(${JSON.stringify(grandchild)},'utf8'));try{process.kill(pid,0);console.error('DESCENDANT_STILL_ALIVE');process.exit(7);}catch(e){if(e.code!=='ESRCH')throw e;}fs.writeFileSync(${JSON.stringify(observed)},'absent');console.error('No such container');process.exitCode=1;
`,{mode:0o700});
  const original=process.env.PATH;process.env.PATH=bin+path.delimiter+original;
  try{
    const r=await runComponent(f.component,f.options);
    assert.equal(r.status,'FAIL');assert.equal(r.processGroupAbsent,true);assert.equal(r.recoveryComplete,true);assert.equal(r.recoveryError,undefined);
    assert.equal(fs.readFileSync(observed,'utf8'),'absent');
    const childReceipt=JSON.parse(fs.readFileSync(lifecycle,'utf8'));assert.equal(childReceipt.mode,'component-group');assert.equal(childReceipt.processGroupAbsent,null);
  }finally{
    process.env.PATH=original;
    // Emergency cleanup only for the exact synthetic PID created by this test.
    if(fs.existsSync(grandchild))try{process.kill(Number(fs.readFileSync(grandchild,'utf8')),'SIGKILL');}catch(error){if(error.code!=='ESRCH')throw error;}
  }
});

test('ps and cleanup command deadlines kill a local CLI that ignores SIGTERM',{timeout:25000},()=>{
  const directory=path.join(base,'ignores-term');fs.mkdirSync(directory);
  const script=`#!${process.execPath}\nprocess.on('SIGTERM',()=>{});setInterval(()=>{},1000);\n`;
  for(const name of ['ps','docker'])fs.writeFileSync(path.join(directory,name),script,{mode:0o700});
  const broker=randomUUID(),journal=path.join(directory,'resources.jsonl'),evidence=path.join(directory,'recovery.json');
  fs.writeFileSync(journal,JSON.stringify({kind:'container',name:'vexa-f01-03-11111111-1111-1111-1111-111111111111-db',broker})+'\n',{mode:0o600});
  const original=process.env.PATH;process.env.PATH=directory+path.delimiter+original;
  try{
    const start=Date.now(),group=inspectProcessGroup(process.pid);assert.equal(group.state,'unknown');assert.equal(group.error,'ETIMEDOUT');assert.ok(Date.now()-start<8000);
    const cleanupStart=Date.now();assert.throws(()=>recoverOwnedResources({journal,broker,evidence}),/RECOVERY_DOCKER_COMMAND/);assert.ok(Date.now()-cleanupStart<13000);
    assert.equal(JSON.parse(fs.readFileSync(evidence,'utf8')).complete,false);
  }finally{process.env.PATH=original;}
});
