import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {spawnSync} from 'node:child_process';
export function pureMutants(candidate,evidence){
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'f0306-mutants-')),file=path.join(tmp,'packages/connectors/comparability.mjs'),results=[];
 try{for(const dir of ['connectors','ingestion','economics'])fs.cpSync(path.join(candidate,'packages',dir),path.join(tmp,'packages',dir),{recursive:true});const original=fs.readFileSync(file,'utf8');
 const run=name=>{const env={...process.env,VEXA_CANDIDATE:tmp};delete env.NODE_TEST_CONTEXT;const r=spawnSync(process.execPath,['--test',new URL('./contract.mjs',import.meta.url).pathname],{env,encoding:'utf8',timeout:20000});fs.writeFileSync(path.join(evidence,name+'.log'),r.stdout+r.stderr);const text=r.stdout+r.stderr;assert.match(text,/(?:ℹ|#) tests 9\b/,'MUTANT_TESTS_MUST_RUN');assert.match(text,/(?:ℹ|#) skipped 0\b/,'MUTANT_NO_SKIPS');return {status:r.status,text};};
 assert.equal(run('mutant-baseline').status,0,'MUTANT_BASELINE_REQUIRED');
 for(const [name,needle,replacement,oracle]of [
  ['channels','if(channels.some','if(false&&channels.some','lost channel denies business deltas'],
  ['method','if(stable(before.method[field])!==stable(after.method[field]))','if(false&&stable(before.method[field])!==stable(after.method[field]))','different taxonomy'],
  ['money','(BigInt(b.amountMinor)-BigInt(a.amountMinor)).toString()','String(Number(b.amountMinor)-Number(a.amountMinor))','bigint stays exact']
 ]){assert.ok(original.includes(needle),'MUTANT_TARGET_'+name);fs.writeFileSync(file,original.replace(needle,replacement));const bad=run('mutant-'+name+'-red');assert.notEqual(bad.status,0,'MUTANT_SURVIVED_'+name);assert.ok(bad.text.includes(oracle)&&bad.text.includes('AssertionError'),'MUTANT_ORACLE_'+name);fs.writeFileSync(file,original);assert.equal(run('mutant-'+name+'-restored').status,0,'MUTANT_RESTORE_'+name);results.push(name+':0-1-0');}
 fs.writeFileSync(path.join(evidence,'product-mutants.json'),JSON.stringify(results));return results;
 }finally{fs.rmSync(tmp,{recursive:true,force:true});}
}
