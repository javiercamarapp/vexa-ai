import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {copyBuildInputs} from '../acceptance/scaffold-copy.mjs';

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
