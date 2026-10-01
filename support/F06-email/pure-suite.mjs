import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
export async function emailPureSuite(t,h,evidence){
 await t.test('email pure security and configuration regressions use installed runtime copy',()=>{
  const names=['webhook-auth','webhook-independent','webhook-deadline','email-ca','email-replyto','email-build'];const files=names.map(name=>fileURLToPath(new URL('./'+name+'.test.mjs',import.meta.url)));
  const childEnv={...process.env,VEXA_CANDIDATE:h.tmp};delete childEnv.NODE_TEST_CONTEXT;
  const result=spawnSync(process.execPath,['--test','--test-reporter=tap',...files],{cwd:h.tmp,env:childEnv,encoding:'utf8',timeout:45000,maxBuffer:4*1024*1024});const tap=result.stdout+result.stderr;fs.writeFileSync(path.join(evidence,'email-pure-suite.tap'),tap,{mode:0o600});
  const summary={exitCode:result.status,node:process.versions.node,root:'installed temporary runtime copy',tests:Number(tap.match(/^# tests (\d+)$/m)?.[1]),pass:Number(tap.match(/^# pass (\d+)$/m)?.[1]),fail:Number(tap.match(/^# fail (\d+)$/m)?.[1]),skipped:Number(tap.match(/^# skipped (\d+)$/m)?.[1])};fs.writeFileSync(path.join(evidence,'email-pure-suite.json'),JSON.stringify(summary,null,2));t.diagnostic('EMAIL_PURE_SUITE '+JSON.stringify(summary));assert.equal(result.error,undefined,result.error?.message);assert.equal(result.status,0,tap);assert.equal(summary.tests,25);assert.equal(summary.pass,25);assert.equal(summary.fail,0);assert.equal(summary.skipped,0);
 });
}
