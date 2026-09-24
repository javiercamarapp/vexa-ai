import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {spawn} from 'node:child_process';import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';import {prepareControl,validateReport} from './control.mjs';
export async function launch(){
 assert.ok(process.env.VEXA_CANDIDATE,'VEXA_CANDIDATE_REQUIRED');
 assert.ok(!process.env.VEXA_CI_JOURNAL&&!process.env.VEXA_CI_BROKER,'EXCLUSIVE_RESOURCE_JOURNAL_REQUIRED');
 const root=path.resolve(fileURLToPath(new URL('../..',import.meta.url))),candidate=fs.realpathSync(process.env.VEXA_CANDIDATE);
 for(const name of ['packages/recovery/index.mjs','packages/jobs/durable/runtime.mjs','supabase/migrations/0035_retention_storage.sql'])assert.ok(fs.existsSync(path.join(candidate,name)),'CHAOS_IMPLEMENTATION_MISSING:'+name);
 const out=fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()),'f0703-external-'));fs.chmodSync(out,0o700);const driver=path.join(out,'control');fs.mkdirSync(driver,{mode:0o700});const evidence=path.join(out,'evidence');
 const controls=prepareControl(root,driver),env={...process.env};delete env.NODE_TEST_CONTEXT;
 fs.writeFileSync(path.join(out,'control-source.json'),JSON.stringify(controls,null,2)+'\n',{mode:0o600});
 const log=fs.openSync(path.join(out,'run.log'),'wx',0o600);console.log('F07-03 evidence: '+out);
 const child=spawn(process.execPath,[path.join(driver,'run.mjs'),'--synthetic-local','--candidate',candidate,'--evidence',evidence,'--repetitions','3'],{env,stdio:['ignore',log,log]});fs.closeSync(log);
 const timer=setTimeout(()=>child.kill('SIGTERM'),700000);let result;
 try{result=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',(code,signal)=>resolve({code,signal}));});}finally{clearTimeout(timer);}
 fs.writeFileSync(path.join(out,'process.json'),JSON.stringify({pid:child.pid,...result})+'\n',{mode:0o600});
 assert.equal(result.signal,null,'CHAOS_PROCESS_SIGNAL');assert.equal(result.code,0,'CHAOS_PROCESS_FAILED:'+out);
 validateReport(JSON.parse(fs.readFileSync(path.join(evidence,'chaos-report.json'))),JSON.parse(fs.readFileSync(path.join(evidence,'cleanup.json'))));
 for(const row of controls)assert.equal(createHash('sha256').update(fs.readFileSync(path.join(root,row.path))).digest('hex'),row.original_sha256,'CONTROL_CHANGED');
 return out;
}
