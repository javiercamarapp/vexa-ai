import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
if(process.env.F02_CANONICAL_ISOLATED==='1')await import('./support/F02-canonical/exam.mjs');
else test('F02-04 isolated full direct entry',{timeout:480000},async()=>{
 const env={...process.env,EXAM_NODE:process.execPath,PYTHONDONTWRITEBYTECODE:'1'};delete env.NODE_TEST_CONTEXT;
 const result=await new Promise((resolve,reject)=>{const p=spawn('python3',['-B',fileURLToPath(new URL('./support/F02-canonical/run.py',import.meta.url))],{env});let output='';p.stdout.on('data',b=>output+=b);p.stderr.on('data',b=>output+=b);p.on('error',reject);p.on('close',code=>resolve({code,output}));});
 console.log(result.output);assert.equal(result.code,0,'ISOLATED_FULL_FAILURE');assert.match(result.output,/F02_04_COMPLETO/);assert.match(result.output,/# skipped 0/);
});
