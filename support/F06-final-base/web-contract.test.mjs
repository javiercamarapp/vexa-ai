import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateWebPackage} from '../../tests/acceptance/support/ci/web-contract.mjs';

const pkg=JSON.parse(fs.readFileSync(new URL('../../apps/web/package.json',import.meta.url),'utf8'));
const lock=JSON.parse(fs.readFileSync(new URL('../../package-lock.json',import.meta.url),'utf8'));
test('web-quality accepts the reviewed exact package and lock versions',()=>{
 for(const [key,file] of [['next','node_modules/next'],['typescript','node_modules/typescript'],['eslint','node_modules/eslint']]){
  const declared={...pkg.dependencies,...pkg.devDependencies}[key];
  assert.equal(lock.packages[file].version,declared,'LOCK_RESOLVED_VERSION:'+key);
  assert.equal({...lock.packages['apps/web'].dependencies,...lock.packages['apps/web'].devDependencies}[key],declared,'LOCK_WORKSPACE_VERSION:'+key);
 }
 validateWebPackage(pkg);
});
test('other versions and no-op scripts remain rejected',()=>{
 for(const key of ['next','typescript','eslint']){
  const bad=structuredClone(pkg);const section=Object.hasOwn(bad.dependencies,key)?'dependencies':'devDependencies';bad[section][key]='0.0.0';
  assert.throws(()=>validateWebPackage(bad),/WEB_TOOL_VERSION/);
 }
 for(const key of ['lint','typecheck','build']){
  const bad=structuredClone(pkg);bad.scripts[key]='true';assert.throws(()=>validateWebPackage(bad),new RegExp('WEB_SCRIPT_CONTRACT:'+key));
 }
});
