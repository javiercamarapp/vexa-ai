import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {prepareControl,validateReport,names} from './control.mjs';
const root=path.resolve(fileURLToPath(new URL('../..',import.meta.url)));
test('trusted examiner resolves harness and fixtures outside candidate; exact adaptation contract',()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'f0703-control-check-'));
 try{const files=prepareControl(root,tmp);assert.equal(files.length,7);const harness=fs.readFileSync(path.join(tmp,'harness.mjs'),'utf8'),run=fs.readFileSync(path.join(tmp,'run.mjs'),'utf8');assert.ok(harness.includes(JSON.stringify(path.join(root,'tests/acceptance/support/F02-durable-final/harness.mjs'))));assert.ok(run.includes(JSON.stringify(path.join(root,'support/F06-detail/fixtures.mjs'))));assert.ok(!harness.includes("path.join(candidate,'tests/acceptance/"));assert.ok(!run.includes("path.join(candidate,'support/"));assert.throws(()=>prepareControl(root,tmp),/EEXIST/);}finally{fs.rmSync(tmp,{recursive:true,force:true});}
});
test('report mutations cannot replace missing scenarios, uncertain cost or cleanup',()=>{
 const rows=[];for(let round=1;round<=3;round++)for(const name of names)rows.push({round,name,status:'pass',snapshotUnchanged:true,durationMs:1,backlogBefore:{},backlogAfter:{},accounting:{pending:0},observed:{uniqueRows:350,cursor:350,resumedTail:250,priorLedgerIdentical:true,state:'uncertain',actualMinor:null,attemptCommittedBeforeTransport:true,activeDeletedContent:0,tombstonedRejected:1}});
 const good={status:'measured-pass-review-pending',measuredScenariosPassed:true,repetitions:3,seed:42,results:rows},cleanup={ownResourcesRemoved:true,temporaryPathsRemoved:true,resources:Array.from({length:5},()=>({absent:true}))};assert.equal(validateReport(good,cleanup),true);
 for(const mutate of [r=>r.results.pop(),r=>r.results[0].name='invented',r=>r.results[0].observed.cursor=100,r=>r.results.find(x=>x.name==='llm_timeout_uncertain').observed.actualMinor=0,r=>r.results.find(x=>x.name==='deleted_source_replay').observed.activeDeletedContent=1]){const bad=structuredClone(good);mutate(bad);assert.throws(()=>validateReport(bad,cleanup));}
 assert.throws(()=>validateReport(good,{...cleanup,resources:[{absent:false}]}));
});
