import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {prepareEvidence,validateProcess,boundedWait} from './guards.mjs';
import {adaptHarness} from './harness.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');

test('CLI rejects existing, overlapping and symlink evidence before infrastructure without changing prior receipt',()=>{
 const tmp=fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()),'chaos-guard-'));
 try{
  const existing=path.join(tmp,'existing');fs.mkdirSync(existing);fs.writeFileSync(path.join(existing,'chaos-report.json'),'original');
  const link=path.join(tmp,'link');fs.symlinkSync(root,link,'dir');
  const external=path.join(tmp,'external');fs.mkdirSync(external);const externalLink=path.join(tmp,'external-link');fs.symlinkSync(external,externalLink,'dir');
  for(const [target,code]of [[existing,'EVIDENCE_EXISTS'],[root,'EVIDENCE_OVERLAP'],[path.join(root,'uncreated-evidence359'),'EVIDENCE_OVERLAP'],[path.join(link,'child'),'EVIDENCE_SYMLINK'],[path.join(externalLink,'child'),'EVIDENCE_SYMLINK']]){
   const result=spawnSync(process.execPath,[path.join(root,'packages/jobs/chaos/run.mjs'),'--synthetic-local','--candidate',root,'--evidence',target],{encoding:'utf8',timeout:5000});
   assert.equal(result.status,1);assert.equal(result.signal,null);assert.equal(result.error,undefined);assert.equal(result.stdout,'');const report=JSON.parse(result.stderr.trim());assert.deepEqual(report,{status:'rejected',code});
  }
  assert.equal(fs.readFileSync(path.join(existing,'chaos-report.json'),'utf8'),'original');assert.deepEqual(fs.readdirSync(existing),['chaos-report.json']);assert.deepEqual(fs.readdirSync(external),[]);
  const fresh=prepareEvidence(root,path.join(tmp,'fresh'));assert.equal(fs.statSync(fresh).mode&0o777,0o700);assert.deepEqual(fs.readdirSync(fresh),[]);assert.throws(()=>prepareEvidence(root,fresh),/EVIDENCE_EXISTS/);
 }finally{fs.rmSync(tmp,{recursive:true,force:true});}
});

test('adapter rejects missing transformation contracts and validates generated build guards',()=>{
 const base=pathToFileURL(path.join(root,'tests/acceptance/support/F02-durable-final/harness.mjs')),source=fs.readFileSync(base,'utf8'),adapted=adaptHarness(source,base);
 assert.match(adapted,/validateProcess\(r,'BUILD_'/);assert.match(adapted,/validateProcess\(build,'REAL_CLI_BUILD'/);assert.match(adapted,/encoding:'utf8',timeout:150000/);
 const syntax=spawnSync(process.execPath,['--check','--input-type=module'],{input:adapted,encoding:'utf8',timeout:5000});assert.equal(syntax.status,0);assert.equal(syntax.signal,null);assert.equal(syntax.error,undefined);
 for(const point of ["assert.equal(r.status,0,'BUILD_'+args[0]);","assert.equal(build.status,0,'REAL_CLI_BUILD');","{cwd:tmp,env,encoding:'utf8'});","h.built=built;h.common=common;"]){assert.ok(source.includes(point));assert.throws(()=>adaptHarness(source.replace(point,'/*changed upstream*/'),base),/HARNESS_CONTRACT_/);}
});

test('status zero cannot mask signal or spawn error; bounded wait rejects and clears timer',async()=>{
 validateProcess({status:0,signal:null},'positive');
 assert.throws(()=>validateProcess({status:0,signal:'SIGTERM'},'signal'),/PROCESS_SIGNAL/);
 assert.throws(()=>validateProcess({status:0,signal:null,error:{code:'ETIMEDOUT'}},'timeout'),/PROCESS_ERROR/);
 assert.throws(()=>validateProcess({status:1,signal:null},'exit'),/PROCESS_STATUS/);
 const began=performance.now();await assert.rejects(boundedWait(new Promise(()=>{}),20,'START_TIMEOUT'),/START_TIMEOUT/);assert.ok(performance.now()-began<2000);
 assert.equal(await boundedWait(Promise.resolve('ready'),10000,'unneeded'),'ready');
});
