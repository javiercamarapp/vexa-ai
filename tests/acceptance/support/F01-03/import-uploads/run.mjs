// Local deterministic runner; no product writes, downloads, model calls or acceptance.
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const [baseline,product,out]=process.argv.slice(2);
if(!baseline||!product||!out)throw Error('Usage: node run.mjs BASELINE PRODUCT EXISTING_TMP_DIR');
const gate=path.resolve(import.meta.dirname,'../../../F01-03.test.mjs');
const results=[];
for(const [name,candidate,test] of [['baseline',baseline,gate],['product',product,gate],['mutations',product,path.join(import.meta.dirname,'mutations.test.mjs')]]){
  const journal=path.join(out,name+'.resources.jsonl'),log=path.join(out,name+'.log'),broker=randomUUID();
  fs.writeFileSync(journal,'',{mode:0o600,flag:'wx'});
  const fd=fs.openSync(log,'wx',0o600);
  const args=['--test','--test-reporter=tap',test];
  const r=spawnSync(process.execPath,args,{env:{...process.env,VEXA_CANDIDATE:candidate,VEXA_CI_JOURNAL:journal,VEXA_CI_BROKER:broker},stdio:['ignore',fd,fd],timeout:600000});fs.closeSync(fd);
  const resources=fs.readFileSync(journal,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
  const remaining=resources.filter(e=>{
    const check=spawnSync('docker',[e.kind,'inspect',e.name],{encoding:'utf8',timeout:15000});
    if(check.status===0)return true;
    if(check.error||!(/No such (?:object|container|network)/i.test(check.stderr)||check.stderr.trim()===`Error response from daemon: network ${e.name} not found`))throw Error('CLEANUP_INSPECTION_FAILED');
    return false;
  });
  const result={name,command:[process.execPath,...args],candidate,exit:r.status,error:r.error?.code??null,log,journal,broker,resources:resources.length,remaining:remaining.map(e=>e.name),logSHA256:createHash('sha256').update(fs.readFileSync(log)).digest('hex')};
  results.push(result);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2),{mode:0o600});
  console.log(JSON.stringify(result));
  if(remaining.length)throw Error('CLEANUP_FAILED');
}
process.exitCode=results.every(r=>r.exit===0)?0:1;
