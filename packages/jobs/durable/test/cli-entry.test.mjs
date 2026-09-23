import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,symlink,rm,writeFile,readFile,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=process.env.VEXA_CANDIDATE||fileURLToPath(new URL('../../../../',import.meta.url));
const env=Object.fromEntries(['PATH','HOME','TMPDIR'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));
const run=args=>spawnSync(process.execPath,args,{env,encoding:'utf8',timeout:5000});
test('daemon and evaluator invoke through path aliases; module imports do not start either CLI',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'vexa-cli-entry-')),alias=join(folder,'alias con espacio ü');
 try{
  await symlink(await realpath(root),alias,'dir');
  for(const relative of ['packages/jobs/durable/daemon.mjs','packages/intelligence/evaluation/cli.mjs']){
   const direct=run([resolve(root,relative)]),indirect=run([join(alias,relative)]);
   assert.equal(direct.status,1,'UNCONFIGURED_DIRECT_IS_NOT_SUCCESS');
   assert.equal(indirect.status,1,'ALIAS_MUST_INVOKE_ENTRY');
   assert.equal(indirect.stderr,direct.stderr,'ALIAS_MUST_HAVE_SAME_CONFIG_ERROR');
   assert.equal(indirect.stdout,'');
   const imported=run(['--input-type=module','-e',`await import(${JSON.stringify(pathToFileURL(join(alias,relative)).href)})`]);
   assert.equal(imported.status,0,'IMPORT_MUST_NOT_START_CLI');assert.equal(imported.stdout,'');assert.equal(imported.stderr,'');
  }
  const dataset=join(folder,'dataset.json'),spec=join(folder,'spec.json'),out=join(folder,'protocol.json');
  await writeFile(dataset,JSON.stringify({dataset_id:'SYN-empty-entry-fixture',kind:'synthetic',cases:[]}));
  await writeFile(spec,JSON.stringify({protocol_id:'SYN-entry',taxonomy:{version:'1',labels:['SYN']},cutoff:'2020-01-01T00:00:00Z'}));
  const freeze=run([join(alias,'packages/intelligence/evaluation/cli.mjs'),'freeze','--dataset',dataset,'--spec',spec,'--out',out]);
  assert.equal(freeze.status,0,freeze.stderr);assert.equal(JSON.parse(await readFile(out,'utf8')).protocol_id,'SYN-entry','ALIAS_MUST_CREATE_REAL_OUTPUT');
  assert.ok(freeze.stdout.trim(),'CLI_MUST_RETURN_RECEIPT');
 }finally{await rm(folder,{recursive:true,force:true});}
});
