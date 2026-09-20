// Read-only candidates. No npm, model, cloud or Git mutation. Run real child tests.
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const [baseline,candidate,out,mode]=process.argv.slice(2);
if(mode&&mode!=='--sql-only')throw Error('Unknown mode');
if(!baseline||!candidate||!out)throw Error('Usage: node run.mjs BASELINE006 CANDIDATE007 EXISTING_TMP_OUTPUT');
const results=[];
const port=Number(process.env.VEXA_F01_03_PORT_BASE??58310);if(!Number.isInteger(port)||port<58310||port>58347)throw Error('EXCLUSIVE_PORT_RANGE');
for(const [name,root,file,mutation] of [
 ['baseline006',baseline,path.resolve(import.meta.dirname,'../../../F01-03.test.mjs'),false],
 ['candidate007',candidate,path.join(import.meta.dirname,'sql.test.mjs'),false],
 ['mutants007',candidate,path.join(import.meta.dirname,'sql.test.mjs'),true],
].filter(([name])=>mode!=='--sql-only'||name!=='baseline006')){
 const journal=path.join(out,name+'.resources.jsonl'),log=path.join(out,name+'.tap');fs.writeFileSync(journal,'',{mode:0o600,flag:'wx'});
 const env={...process.env,VEXA_CANDIDATE:root,VEXA_CI_JOURNAL:journal,VEXA_CI_BROKER:randomUUID(),VEXA_F01_03_PORT_BASE:process.env.VEXA_F01_03_PORT_BASE??'58310',VEXA_WORKER_MUTATIONS:mutation?'1':'0',VEXA_F01_03_CLEANUP:path.join(out,name+'.cleanup-ids.json')};delete env.NODE_TEST_CONTEXT;delete env.VEXA_WORKER_MUTANT_ONLY;
 const fd=fs.openSync(log,'wx',0o600),args=['--test','--test-isolation=none','--test-reporter=tap',file];
 const r=spawnSync(process.execPath,args,{env,stdio:['ignore',fd,fd],timeout:300000});fs.closeSync(fd);
 const cleanup=[];
 for(const e of fs.readFileSync(journal,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse)){
  const inspect=spawnSync('docker',[e.kind,'inspect',e.name,'--format',`{{.Id}}|{{index ${e.kind==='network'?'.Labels':'.Config.Labels'} "vexa.ci.broker"}}`],{encoding:'utf8',timeout:15000});
  if(inspect.status===0){const [id,owner]=inspect.stdout.trim().split('|');if(owner!==e.broker||!/^[a-f0-9]{64}$/.test(id))throw Error('CLEANUP_OWNER');const rm=spawnSync('docker',e.kind==='network'?['network','rm',id]:['container','rm','-f','-v',id],{encoding:'utf8',timeout:15000});if(rm.status!==0)throw Error('CLEANUP_REMOVE');cleanup.push({id,removed:true});}
  else if(inspect.error||!/No such|not found/.test(inspect.stderr))throw Error('CLEANUP_INSPECT');
  const verify=spawnSync('docker',[e.kind,'inspect',e.name],{encoding:'utf8',timeout:15000});if(verify.status===0||verify.error||!/No such|not found/.test(verify.stderr))throw Error('CLEANUP_VERIFY');cleanup.push({kind:e.kind,name:e.name,absent:true});
 }
 const result={name,command:[process.execPath,...args],candidate:root,exit:r.status,signal:r.signal,error:r.error?.code??null,log,logSHA256:createHash('sha256').update(fs.readFileSync(log)).digest('hex'),cleanup};results.push(result);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(result));
}
process.exitCode=results.every(r=>r.exit===0)?0:1;
