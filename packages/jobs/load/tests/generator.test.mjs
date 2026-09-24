import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {createHash} from 'node:crypto';import {generateDataset,LIMITS} from '../generator.mjs';
test('independent fixed seed datasets account for every raw row without raising product limits',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'vexa-load-generator-'));
 try{for(const rows of [10000,50000,150000]){const m=generateDataset({rows,seed:308+rows,directory:path.join(root,String(rows))});assert.deepEqual(m.expected,{total:rows,accepted:rows*.98,rejected:rows*.01,duplicates:rows*.01,pending:0});assert.equal(m.files.length,Math.ceil(rows/50000));let observed=0;
 for(const file of m.files){const bytes=fs.readFileSync(path.join(root,String(rows),file.filename)),lines=bytes.toString().trimEnd().split('\n');assert.equal(lines.length-1,file.rows);assert.ok(file.rows<=LIMITS.rowsPerFile&&bytes.length<=LIMITS.bytesPerFile);assert.equal(createHash('sha256').update(bytes).digest('hex'),file.sha256);for(let i=1;i<lines.length;i++){const ordinal=observed+i-1;if(ordinal%100===99)assert.equal(lines[i],lines[i-1]);if(ordinal%100===49)assert.ok(lines[i].includes(',SYN-invalid-date,'));}observed+=file.rows;}assert.equal(observed,rows);
 const repeat=generateDataset({rows,seed:308+rows,directory:path.join(root,rows+'-repeat')});assert.equal(repeat.sha256,m.sha256);}}
 finally{fs.rmSync(root,{recursive:true,force:true});}
});
