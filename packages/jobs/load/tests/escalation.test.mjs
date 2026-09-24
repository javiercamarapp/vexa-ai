import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
test('a failed previous load cannot start larger infrastructure',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'vexa-load-escalation-'));try{
  const prior=path.join(root,'failed.json');fs.writeFileSync(prior,JSON.stringify({candidate:'/SYN-not-a-candidate',status:'failed',scales:[{rows:10000,status:'failed',observed:{total:10000,accepted:100,rejected:0,duplicates:0,pending:9900}}]}));
  const result=spawnSync(process.execPath,[fileURLToPath(new URL('../run.mjs',import.meta.url))],{env:{PATH:process.env.PATH,HOME:process.env.HOME,VEXA_CANDIDATE:'/SYN-not-a-candidate',VEXA_LOAD_SCALES:'50000',VEXA_LOAD_PREVIOUS_REPORT:prior},encoding:'utf8',timeout:10000});assert.equal(result.status,1);assert.match(result.stderr,/failed|measured/);assert.doesNotMatch(result.stdout,/LOAD308_RUNNING/);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('port configuration rejects privileged, fractional and overflowing ranges before infrastructure',async()=>{
 const {basePort}=await import('../harness.mjs');for(const p of ['0','1023','65531','62820.5','NaN'])assert.throws(()=>basePort(p),/LOAD_PORT_RANGE/);assert.equal(basePort('62820'),62820);
});
