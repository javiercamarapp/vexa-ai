import test from 'node:test';
import assert from 'node:assert/strict';
import {failureSnapshot} from '../load/harness.mjs';
test('failure snapshot preserves later jobs and null checkpoint for unstarted job',()=>{
 const values=[{id:'j1',state:'succeeded'},{pending:0},{done:true},{id:'j2',state:'failed'},{pending:100},{done:false},{id:'j3',state:'queued'},{pending:100},null];
 const files=[1,2,3].map(n=>({jobId:'j'+n,importId:'i'+n}));const result=failureSnapshot({json:()=>({value:values.shift()})},files);
 assert.equal(result.length,3);assert.equal(result[1].job.state,'failed');assert.equal(result[2].job.state,'queued');assert.equal(result[2].checkpoint,null);assert(result.every(r=>r.errors.length===0));
});
test('SQL error stays distinct from missing and does not discard other resource values',()=>{
 let calls=0;const error=Object.assign(new Error('permission denied'),{code:'42501'});
 const rows=failureSnapshot({json:()=>{calls++;if(calls===2)throw error;return {value:calls===1?{state:'failed'}:{offset:48100}};}},[{jobId:'j2',importId:'i2'}]);
 assert.equal(rows[0].job.state,'failed');assert.equal(rows[0].checkpoint.offset,48100);assert.equal(Object.hasOwn(rows[0],'import'),false);assert.deepEqual(rows[0].errors,[{resource:'import',message:'permission denied',code:'42501'}]);assert.equal(rows[0].jobId,'j2');assert.equal(rows[0].importId,'i2');
});
test('missing resources remain explicit null without invented zero counters',()=>{
 const result=failureSnapshot({json:()=>({value:null})},[{jobId:'missing',importId:'missing'}]);assert.deepEqual(result,[{jobId:'missing',importId:'missing',errors:[],job:null,import:null,checkpoint:null}]);
});
