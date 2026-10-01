import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {spawnSync} from 'node:child_process';
export async function pushHttpContract(t,h,evidence){await t.test('push request bounded input and logout contract regressions on installed runtime copy',()=>{
 const env={...process.env,VEXA_CANDIDATE:h.tmp};delete env.NODE_TEST_CONTEXT;
 const result=spawnSync(process.execPath,['--import',fileURLToPath(new URL('./server-only-hook.mjs',import.meta.url)),'--import',path.join(h.tmp,'node_modules/tsx/dist/loader.mjs'),'--test','--test-reporter=tap',fileURLToPath(new URL('./http-contract.test.mts',import.meta.url))],{cwd:h.tmp,env,encoding:'utf8',timeout:15000,maxBuffer:2*1024*1024});const tap=result.stdout+result.stderr;fs.writeFileSync(path.join(evidence,'http-contract.tap'),tap,{mode:0o600});
 assert.equal(result.status,0,tap);assert.match(tap,/^# tests 3$/m);assert.match(tap,/^# pass 3$/m);assert.match(tap,/^# fail 0$/m);assert.match(tap,/^# skipped 0$/m);t.diagnostic('PUSH_HTTP_CONTRACT 3/3 PASS (official SDK, synthetic Auth HTTP fixture)');
});}
