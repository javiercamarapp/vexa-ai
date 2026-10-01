// Instrumentation contract only. The fake runtime is not a persistence/capacity test.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fork} from 'node:child_process';
import {once} from 'node:events';

const worker=process.env.VEXA_OBSERVER_WORKER;
assert.ok(worker,'VEXA_OBSERVER_WORKER_REQUIRED');
for(const fails of [false,true])test(`worker observation preserves ${fails?'rejection':'success'} without claiming a failed commit`,{timeout:10000},async()=>{
 const built=fs.mkdtempSync(path.join(os.tmpdir(),'vexa-observation-contract-'));
 const dir=path.join(built,'packages/jobs/durable');fs.mkdirSync(dir,{recursive:true});
 fs.writeFileSync(path.join(dir,'runtime.mjs'),`export async function createRuntime(){return {repository:{heartbeat:async()=>{},commitChunk:async()=>{await new Promise(r=>setTimeout(r,25));${fails?"throw Object.assign(Error('SYN_ONLY'),{code:'SYN_COMMIT_REJECTED'});":"return {unchanged:42};"}}},close:async()=>{}};}`);
 fs.writeFileSync(path.join(dir,'daemon.mjs'),`import assert from 'node:assert/strict';export async function runDaemon({repository}){const result=await repository.commitChunk({id:'SYN_JOB'},{records:[{},{}],checkpoint:{offset:2},done:true});assert.deepEqual(result,{unchanged:42});}`);
 let child,timer;const messages=[];
 try{
  child=fork(worker,[],{execArgv:[],env:{...process.env,F02_BUILT:built},stdio:['ignore','ignore','pipe','ipc']});
  let stderr='';child.stderr.on('data',b=>stderr+=b);
  const reply=new Promise((resolve,reject)=>{
   timer=setTimeout(()=>reject(Error('WORKER_OBSERVATION_TIMEOUT')),5000);
   child.on('error',reject);child.on('exit',()=>reject(Error('WORKER_EXIT:'+stderr)));
   child.on('message',m=>{messages.push(m);if(m.ready)child.send({id:'SYN_CALL',op:'consume'});if(m.id==='SYN_CALL')resolve(m);});
  });
  const result=await reply;
  assert.equal(result.ok,!fails);
  if(fails)assert.equal(result.error.code,'SYN_COMMIT_REJECTED');
  const chunks=messages.filter(m=>m.kind==='chunk');assert.equal(chunks.length,1);
  const c=chunks[0];assert.equal(c.committed,!fails);assert.equal(c.jobId,'SYN_JOB');assert.equal(c.rows,2);assert.equal(c.offset,2);assert.equal(c.done,true);
  assert.ok(Number.isFinite(Date.parse(c.startedAt)));assert.ok(Number.isFinite(Date.parse(c.finishedAt)));
  assert.ok(c.monotonicEndMs>=c.monotonicStartMs);assert.equal(c.commitMs,c.monotonicEndMs-c.monotonicStartMs);
  assert.ok(c.commitMs>=15,'async operation must be included in measurement');
  for(const k of ['user','system'])assert.ok(Number.isSafeInteger(c.cpuMicroseconds[k])&&c.cpuMicroseconds[k]>=0);
  assert.ok(c.maxRssKiB>0);assert.ok(c.memory.rss>0);
 }finally{
  clearTimeout(timer);
  if(child&&child.exitCode===null&&child.signalCode===null){const ended=once(child,'exit');child.kill('SIGKILL');await ended;}
  fs.rmSync(built,{recursive:true,force:true});assert.equal(fs.existsSync(built),false);
 }
});
