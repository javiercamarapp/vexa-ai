import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {pureExam} from './support/F02-preview/pure.mjs';
const candidate=path.resolve(process.env.VEXA_CANDIDATE??fileURLToPath(new URL('../..',import.meta.url)));
test('F02-03 real mapping, HTTP and browser; acceptance remains external',{timeout:450000},async t=>{
 const entry=path.join(candidate,'packages/ingestion/mapping.mjs');
 assert.ok(fs.existsSync(entry),'IMPLEMENTATION_MISSING: packages/ingestion/mapping.mjs');
 assert.ok(!fs.lstatSync(entry).isSymbolicLink(),'CANDIDATE_SYMLINK');
 if(process.env.F02_PREVIEW_ISOLATED!=='1'){
  const runner=fileURLToPath(new URL('./support/F02-preview/run.py',import.meta.url));
  const result=spawnSync('python3',['-B',runner,process.execPath,'--test','--test-reporter=tap',fileURLToPath(import.meta.url)],{env:{...process.env,PYTHONDONTWRITEBYTECODE:'1',VEXA_CANDIDATE:candidate},encoding:'utf8',timeout:420000,maxBuffer:16*1024*1024});
  if(result.stdout)process.stdout.write(result.stdout);if(result.stderr)process.stderr.write(result.stderr);
  assert.ifError(result.error);assert.equal(result.status,0,'F02_PREVIEW_REAL_EXAM_FAILED');
  assert.ok(result.stdout.includes('F02_PREVIEW_COMPLETE'),'F02_PREVIEW_EXAM_NOT_EXECUTED');
  assert.match(result.stdout,/# skipped 0\b/,'F02_PREVIEW_NO_SKIPS');return;
 }
 assert.ok(process.env.F02_PREVIEW_HARNESS&&process.env.F02_PREVIEW_ARTIFACTS,'ISOLATED_HARNESS_REQUIRED');
 const m=await import(pathToFileURL(entry));
 for(const name of ['previewImport','exportRowErrors'])assert.equal(typeof m[name],'function','IMPLEMENTATION_MISSING: '+name);
 await pureExam(t,m);
 const {httpExam}=await import('./support/F02-preview/http.mjs');await t.test('real Auth/Pg/Storage HTTP',()=>httpExam(candidate));
 const {ssrExam}=await import('./support/F02-preview/ssr.mjs');await t.test('real Next SSR Chromium',()=>ssrExam(candidate));
 console.log('F02_PREVIEW_COMPLETE');
});
