import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

function preflightFixture(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'vexa-load-preflight-')),benchmark=path.join(root,'packages/jobs/load');
 for(const dir of ['apps','supabase/migrations','tests/acceptance/support','packages/jobs/load/tests'])fs.mkdirSync(path.join(root,dir),{recursive:true});
 const sources=['apps/source.txt','tests/acceptance/scaffold-copy.mjs','package.json','package-lock.json'];
 for(const name of sources)fs.writeFileSync(path.join(root,name),'{}');
 for(const name of ['run.mjs','generator.mjs','harness.mjs'])fs.copyFileSync(new URL('../'+name,import.meta.url),path.join(benchmark,name));
 for(const name of ['README.md','summarize.mjs','worker.mjs','tests/escalation.test.mjs','tests/generator.test.mjs'])fs.writeFileSync(path.join(benchmark,name),'');
 fs.writeFileSync(path.join(benchmark,'dependencies.json'),JSON.stringify({files:sources.map(name=>({path:name,sha256:createHash('sha256').update(fs.readFileSync(path.join(root,name))).digest('hex')}))}));
 return {root,run(args=['--preflight'],extraEnv={}){return spawnSync(process.execPath,[path.join(benchmark,'run.mjs'),...args],{env:{PATH:process.env.PATH,HOME:process.env.HOME,VEXA_CANDIDATE:root,...extraEnv},encoding:'utf8',timeout:10000,killSignal:'SIGKILL'});},close(){fs.rmSync(root,{recursive:true,force:true});}};
}

test('preflight validates sources and exits without starting infrastructure',()=>{
 const f=preflightFixture();try{const r=f.run();assert.equal(r.error,undefined);assert.equal(r.signal,null);assert.equal(r.status,0,r.stderr);assert.deepEqual({...JSON.parse(r.stdout),dependencyManifestSha256:null},{status:'source-preflight-only',files:4,dependencyManifestSha256:null,priorEvidence:null,infrastructureStarted:false,capacityMeasured:false});assert.doesNotMatch(r.stdout,/LOAD308_RUNNING/);}finally{f.close();}
});

for(const [name,mutate,expected] of [
 ['unlisted source',root=>fs.writeFileSync(path.join(root,'apps/new.test.mjs'),''),'LOAD_SOURCE_INVENTORY_CHANGED'],
 ['missing source',root=>fs.unlinkSync(path.join(root,'apps/source.txt')),'LOAD_SOURCE_INVENTORY_CHANGED'],
 ['changed source',root=>fs.writeFileSync(path.join(root,'apps/source.txt'),'changed'),'LOAD_SOURCE_CHANGED'],
 ['symlink source',root=>{fs.unlinkSync(path.join(root,'apps/source.txt'));fs.symlinkSync('../package.json',path.join(root,'apps/source.txt'));},'LOAD_SOURCE_SYMLINK'],
 ['unlisted benchmark',root=>fs.writeFileSync(path.join(root,'packages/jobs/load/extra.mjs'),''),'LOAD_BENCHMARK_INVENTORY_CHANGED'],
])test('preflight refuses '+name+' before infrastructure',()=>{const f=preflightFixture();try{mutate(f.root);const r=f.run();assert.equal(r.error,undefined);assert.equal(r.signal,null);assert.equal(r.status,1);assert.match(r.stderr,new RegExp(expected));assert.doesNotMatch(r.stdout,/LOAD308_RUNNING/);}finally{f.close();}});

test('preflight cannot skip escalation prerequisites or silently accept arguments',()=>{
 const f=preflightFixture();try{for(const [args,env,expected] of [[['--preflight'],{VEXA_LOAD_SCALES:'50000'},'SUCCESSFUL_PREVIOUS_SCALE_REQUIRED'],[['--prefight'],{},'LOAD_ARGUMENTS'],[['--preflight','extra'],{},'LOAD_ARGUMENTS']]){const r=f.run(args,env);assert.equal(r.status,1);assert.match(r.stderr,new RegExp(expected));assert.doesNotMatch(r.stdout,/LOAD308_RUNNING/);}}finally{f.close();}
});
test('a failed previous load cannot start larger infrastructure',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'vexa-load-escalation-'));try{
  const prior=path.join(root,'failed.json');fs.writeFileSync(prior,JSON.stringify({candidate:'/SYN-not-a-candidate',status:'failed',scales:[{rows:10000,status:'failed',observed:{total:10000,accepted:100,rejected:0,duplicates:0,pending:9900}}]}));
  const result=spawnSync(process.execPath,[fileURLToPath(new URL('../run.mjs',import.meta.url))],{env:{PATH:process.env.PATH,HOME:process.env.HOME,VEXA_CANDIDATE:'/SYN-not-a-candidate',VEXA_LOAD_SCALES:'50000',VEXA_LOAD_PREVIOUS_REPORT:prior},encoding:'utf8',timeout:10000});assert.equal(result.status,1);assert.match(result.stderr,/failed|measured/);assert.doesNotMatch(result.stdout,/LOAD308_RUNNING/);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('port configuration rejects privileged, fractional and overflowing ranges before infrastructure',async()=>{
 const {basePort}=await import('../harness.mjs');for(const p of ['0','1023','65531','62820.5','NaN'])assert.throws(()=>basePort(p),/LOAD_PORT_RANGE/);assert.equal(basePort('62820'),62820);
});
