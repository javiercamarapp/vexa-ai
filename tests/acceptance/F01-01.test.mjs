// Scaffold/build gate only. Auth, RLS, UI and product require subsequent gates.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import os from 'node:os';
import {candidate} from './foundation.mjs';
import {copyBuildInputs} from './scaffold-copy.mjs';
test('real Next/TypeScript workspace, frozen lock and successful local toolchain', {timeout:240000},()=>{
 const pkg=JSON.parse(fs.readFileSync(path.join(candidate,'apps/web/package.json'),'utf8'));
 assert.ok(pkg.dependencies?.next,'Next dependency required');
 assert.ok(pkg.devDependencies?.typescript||pkg.dependencies?.typescript,'TypeScript required');
 assert.ok(fs.statSync(path.join(candidate,'package-lock.json')).size>100);
 // Builds must not mutate the candidate: signatures protect all its inputs.
 // An operator primes npm's cache interactively from the reviewed lock first.
 const build=fs.mkdtempSync(path.join(os.tmpdir(),'vexa-scaffold-'));
 try {
  copyBuildInputs(candidate,build);
  const install=spawnSync('npm',['ci','--offline','--ignore-scripts','--no-audit','--no-fund'],{cwd:build,encoding:'utf8',timeout:45000,maxBuffer:2*1024*1024});
  assert.ifError(install.error);assert.equal(install.status,0,`Offline cache/dependencies not ready: ${install.stderr}`);
  for(const name of ['lint','typecheck','build']){
   assert.ok(pkg.scripts?.[name],`${name} missing`);
   assert.ok(!/^\s*(echo|true|exit\s+0)\b/.test(pkg.scripts[name]),`${name} is a no-op`);
   const result=spawnSync('npm',['run',name,'--workspace','apps/web'],{cwd:build,encoding:'utf8',timeout:55000,maxBuffer:2*1024*1024});
   assert.ifError(result.error);
   assert.equal(result.status,0,`${name}: ${result.stderr}\n${result.stdout}`);
  }
  assert.ok(fs.statSync(path.join(build,'apps/web/.next/BUILD_ID')).size>0,'Next build artifact missing');
 } finally {fs.rmSync(build,{recursive:true,force:true});}
});
