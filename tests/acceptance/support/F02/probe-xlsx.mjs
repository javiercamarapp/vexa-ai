// Subprocess assertion runner for independent-reader mutations. Not product.
import fs from 'node:fs';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';import {xlsxCases} from './xlsx-oracles.mjs';import {workbook} from './xlsx.mjs';
const [index,reader,input]=process.argv.slice(2);let last;
function parse(bytes,options={}){fs.writeFileSync(input,bytes);const r=spawnSync('python3',[reader,input,JSON.stringify(options)],{encoding:'utf8',timeout:15000,maxBuffer:1000000});assert.equal(r.status,0,`CONTROL_READER_INFRA:${r.stderr}`);last=JSON.parse(r.stdout);if(last.error)throw Object.assign(new Error(last.error),{code:last.error});return last.value;}
if(index==='pre'){
 assert.throws(()=>parse(workbook({padding:1024*1024}),{maxExpandedBytes:100000}),e=>e.code==='XLSX_LIMIT_EXPANDED');assert.deepEqual(last.reads,[],'PREEXPANSION_ZERO_READS');
}else xlsxCases[Number(index)][1](parse);
