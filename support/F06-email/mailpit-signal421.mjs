import test from 'node:test';import assert from 'node:assert/strict';import {fork,spawnSync} from 'node:child_process';import {once} from 'node:events';import fs from 'node:fs';import path from 'node:path';
const bounded=async(p,label)=>{let timer;try{return await Promise.race([p,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(label)),15000);})]);}finally{clearTimeout(timer);}};
test('Mailpit owned container is removed when the runtime signal handler closes its scope',{timeout:30000},async()=>{
 const evidence=path.join(process.env.SYN421_EVIDENCE,process.env.SYN421_FIX==='1'?'mailpit-signal-green':'mailpit-signal-red');fs.mkdirSync(evidence,{recursive:true});let child,id;
 try{
  child=fork(new URL('./mailpit-signal-child421.mjs',import.meta.url),[],{execPath:process.execPath,execArgv:[],env:{...process.env,SYN421_EVIDENCE:evidence},stdio:['ignore','ignore','ignore','ipc']});const ready=await bounded(once(child,'message'),'MAILPIT_READY');assert.equal(ready[0].ready,true);id=ready[0].id;
  const end=once(child,'exit');child.kill('SIGTERM');const [code]=await bounded(end,'SIGNAL_EXIT');assert.equal(code,1);assert.equal(JSON.parse(fs.readFileSync(path.join(evidence,'runtime-close.json'))).closed,true);
  const inspection=spawnSync('docker',['inspect',id],{encoding:'utf8',timeout:15000});fs.writeFileSync(path.join(evidence,'signal-result.json'),JSON.stringify({id,containerAbsent:inspection.status!==0,childExit:code}));assert.notEqual(inspection.status,0,'MAILPIT_REMOVED_BY_SIGNAL_SCOPE');
 }finally{
  if(child&&child.exitCode===null&&child.signalCode===null){const end=once(child,'exit');child.kill('SIGKILL');await bounded(end,'CHILD_CLEANUP');}
  if(id){const inspection=spawnSync('docker',['inspect',id],{encoding:'utf8',timeout:15000});if(inspection.status===0)assert.equal(spawnSync('docker',['rm','-f',id],{encoding:'utf8',timeout:15000}).status,0);assert.notEqual(spawnSync('docker',['inspect',id],{encoding:'utf8',timeout:15000}).status,0);fs.writeFileSync(path.join(evidence,'final-cleanup.json'),JSON.stringify({id,absent:true}));}
 }
});
