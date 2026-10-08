// Run from the installed temporary web workspace used by web.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const hook=fileURLToPath(new URL('./server-context.mjs',import.meta.url));
function run(code,server=true){
 const result=spawnSync(process.execPath,[...(server?['--import',hook]:[]),'-e',code],{cwd:process.cwd(),env:process.env,encoding:'utf8',timeout:5000});
 assert.ifError(result.error);return result;
}
test('server marker resolves to the installed Next server entry',()=>{
 const result=run("const assert=require('node:assert/strict');assert.deepEqual(require('server-only'),{});assert.ok(require.cache[require.resolve('next/dist/compiled/server-only/empty.js')]);");
 assert.equal(result.status,0,result.stderr);
});
test('client poison entry still throws with the server test hook',()=>{
 const result=run("require('next/dist/compiled/server-only/index.js')");
 assert.notEqual(result.status,0);assert.match(result.stderr,/cannot be imported from a Client Component/);
});
test('unrelated missing modules are not replaced',()=>{
 const result=run("require('rovaq-missing-server-marker-control')");
 assert.notEqual(result.status,0);assert.match(result.stderr,/MODULE_NOT_FOUND/);assert.match(result.stderr,/rovaq-missing-server-marker-control/);
});
test('hook stays local to the explicitly configured test process',()=>{
 const result=run("require('server-only')",false);
 assert.notEqual(result.status,0);assert.match(result.stderr,/MODULE_NOT_FOUND/);
});
