// Oracle sensitivity only. Never a positive product reference.
import test from 'node:test';import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const worker=fileURLToPath(new URL('./meta-worker.mjs',import.meta.url));
for(const defect of ['ambiguous','null_zero','jpy_rounding','csv_formula','cas_ignored','tenant_header','tenant_body','queued_completed'])test('SYNTHETIC oracle 0 → assertion1 → 0: '+defect,()=>{
 for(const [mutation,expected] of [['0',0],['1',1],['0',0]]){
  const p=spawnSync(process.execPath,[worker,defect,mutation],{encoding:'utf8',timeout:5000});assert.equal(p.status,expected,'META_PROCESS_EXIT');
  if(expected){assert.match(p.stderr,/AssertionError/,'NOT_SETUP_FAILURE');assert.match(p.stderr,new RegExp('ORACLE_'+defect),'TARGET_ASSERTION');}
  console.log(JSON.stringify({kind:'oracle-only',defect,mutation,exit:p.status,product_pass:false}));
 }
});
