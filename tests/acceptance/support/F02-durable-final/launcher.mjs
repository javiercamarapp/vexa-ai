import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {spawn} from 'node:child_process';
import {validateResult} from './inventory.mjs';
export async function launch(entry){
 assert.ok(process.env.VEXA_CANDIDATE,'VEXA_CANDIDATE_REQUIRED');
 const evidence=fs.mkdtempSync(path.join(os.tmpdir(),entry.toLowerCase()+'-entry-'));fs.chmodSync(evidence,0o700);
 const env={...process.env,F02_FINAL_EVIDENCE:evidence};delete env.NODE_TEST_CONTEXT;delete env.F02_CASE_FILTER;
 const child=spawn(process.execPath,[new URL('./run.mjs',import.meta.url).pathname],{env,stdio:['ignore','pipe','pipe']});
 child.stdout.on('data',b=>process.stdout.write(b));child.stderr.on('data',b=>process.stderr.write(b));
 const timer=setTimeout(()=>child.kill('SIGTERM'),760000);let code;
 try{code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});}finally{clearTimeout(timer);}
 assert.equal(code,0,'FULL_EXTERNAL_EXAM: '+evidence);
 const result=JSON.parse(fs.readFileSync(path.join(evidence,'result.json')));
 const mutations=Object.fromEntries(['fence','atomic','health'].map(k=>[k,JSON.parse(fs.readFileSync(path.join(evidence,'mutation-'+k+'.json')))]));
 validateResult(result,mutations);
 const cleanup=JSON.parse(fs.readFileSync(path.join(evidence,'cleanup.json')));assert.equal(cleanup.ownResourcesRemoved,true);assert.equal(cleanup.temporaryPathsRemoved,true);assert.ok(cleanup.resources.length>0);assert.ok(cleanup.resources.every(r=>r.absent===true));
}
