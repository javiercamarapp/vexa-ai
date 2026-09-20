import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {copyBuildInputs,buildEnvironment} from '../acceptance/scaffold-copy.mjs';

test('nested npm configuration and credentials are not inherited by build tools',()=>{
 const env=buildEnvironment({PATH:'/bin',HOME:'/home/test',npm_config_allow_scripts:'*',
  NODE_OPTIONS:'--require=/untrusted',OPENROUTER_API_KEY:'synthetic-not-a-key'},'/tmp/owned-build');
 assert.equal(env.PATH,'/bin');assert.equal(env.HOME,'/home/test');
 for(const key of ['npm_config_allow_scripts','NODE_OPTIONS','OPENROUTER_API_KEY'])assert.equal(env[key],undefined);
 assert.equal(env.NPM_CONFIG_USERCONFIG,'/dev/null');
 assert.equal(env.NPM_CONFIG_GLOBALCONFIG,'/tmp/owned-build/empty-global-npmrc');
});

test('readonly inputs produce writable scratch, preserving original bytes and mode', () => {
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'vexa-copy-readonly-'));
 try {
  const source=path.join(temp,'source'),dest=path.join(temp,'build');
  fs.mkdirSync(path.join(source,'apps/web'),{recursive:true});
  const original=path.join(source,'apps/web/next-env.d.ts');
  fs.writeFileSync(original,'original',{mode:0o444});
  copyBuildInputs(source,dest);
  const copied=path.join(dest,'apps/web/next-env.d.ts');
  assert.equal(fs.statSync(copied).mode & 0o777,0o644,'BUILD_SCRATCH_WRITABLE');
  fs.writeFileSync(copied,'generated');
  assert.equal(fs.readFileSync(original,'utf8'),'original');
  assert.equal(fs.statSync(original).mode & 0o777,0o444);
 } finally {fs.rmSync(temp,{recursive:true,force:true});}
});

test('rejects symlink inputs without changing their target', () => {
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'vexa-copy-link-'));
 try {
  const source=path.join(temp,'source'),dest=path.join(temp,'build');
  fs.mkdirSync(path.join(source,'apps/web'),{recursive:true});
  const target=path.join(temp,'outside');fs.writeFileSync(target,'untouched',{mode:0o444});
  fs.symlinkSync(target,path.join(source,'apps/web/next-env.d.ts'));
  assert.throws(()=>copyBuildInputs(source,dest),/BUILD_INPUT_SYMLINK/);
  assert.equal(fs.readFileSync(target,'utf8'),'untouched');
  assert.equal(fs.statSync(target).mode & 0o777,0o444);
 } finally {fs.rmSync(temp,{recursive:true,force:true});}
});

test('rejects overlapping destinations before creating anything in source', () => {
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'vexa-copy-overlap-'));
 try {
  const source=path.join(temp,'source');fs.mkdirSync(source);
  for (const destination of [source,path.join(source,'build'),temp]) {
    assert.throws(()=>copyBuildInputs(source,destination),/BUILD_DESTINATION_OVERLAP/);
    assert.deepEqual(fs.readdirSync(source),[]);
  }
  fs.symlinkSync(source,path.join(temp,'alias'));
  assert.throws(()=>copyBuildInputs(source,path.join(temp,'alias','build')),/BUILD_DESTINATION_OVERLAP/);
  assert.deepEqual(fs.readdirSync(source),[]);
 } finally {fs.rmSync(temp,{recursive:true,force:true});}
});

test('rejects pre-existing targets instead of overwriting or chmodding them', () => {
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'vexa-copy-existing-'));
 try {
  const source=path.join(temp,'source'),dest=path.join(temp,'build');
  fs.mkdirSync(source);fs.mkdirSync(dest);
  fs.writeFileSync(path.join(source,'package.json'),'source');
  fs.writeFileSync(path.join(dest,'package.json'),'existing',{mode:0o444});
  assert.throws(()=>copyBuildInputs(source,dest),/BUILD_DESTINATION_EXISTS/);
  assert.equal(fs.readFileSync(path.join(dest,'package.json'),'utf8'),'existing');
  assert.equal(fs.statSync(path.join(dest,'package.json')).mode&0o777,0o444);
 } finally {fs.rmSync(temp,{recursive:true,force:true});}
});

test('copies sources even when candidate is under a .runtime ancestor', () => {
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'vexa-copy-test-'));
 try {
  const source=path.join(temp,'.runtime','candidate'),dest=path.join(temp,'build');
  fs.mkdirSync(path.join(source,'apps/web'),{recursive:true});
  fs.writeFileSync(path.join(source,'apps/web/page.tsx'),'source');
  copyBuildInputs(source,dest);
  assert.equal(fs.readFileSync(path.join(dest,'apps/web/page.tsx'),'utf8'),'source');
 } finally {fs.rmSync(temp,{recursive:true,force:true});}
});
test('still excludes generated artifacts inside the candidate', () => {
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'vexa-copy-test-'));
 try {
  const source=path.join(temp,'candidate'),dest=path.join(temp,'build');
  for(const name of ['.next','node_modules','.runtime','.git']){
   fs.mkdirSync(path.join(source,'apps/web',name),{recursive:true});
   fs.writeFileSync(path.join(source,'apps/web',name,'secret'),'do not copy');
  }
  fs.writeFileSync(path.join(source,'apps/web/page.tsx'),'source');copyBuildInputs(source,dest);
  for(const name of ['.next','node_modules','.runtime','.git'])assert.equal(fs.existsSync(path.join(dest,'apps/web',name)),false);
 } finally {fs.rmSync(temp,{recursive:true,force:true});}
});
