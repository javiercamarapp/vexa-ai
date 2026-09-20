// Authoring controls ONLY: Python reader receives actual ZIP bytes, not fixture IDs.
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
import {xlsxCases} from './xlsx-oracles.mjs';import {workbook} from './xlsx.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),out=path.join(here,'evidence/complete01');fs.mkdirSync(out,{recursive:true});const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'vexa-xlsx-control-'));fs.chmodSync(tmp,0o700);
const original=fs.readFileSync(path.join(here,'zip-reader.py'),'utf8');const reader=path.join(tmp,'reader.py'),input=path.join(tmp,'input.xlsx');let last;
function parse(bytes,options={}){fs.writeFileSync(input,bytes);const r=spawnSync('python3',[reader,input,JSON.stringify(options)],{encoding:'utf8',timeout:15000,maxBuffer:1000000});assert.equal(r.status,0,`CONTROL_READER_INFRA:${r.stderr}`);last=JSON.parse(r.stdout);if(last.error)throw Object.assign(new Error(last.error),{code:last.error});return last.value;}
const mutations=[
 ['bytes',1,"if len(data)>cfg.get('maxBytes',20971520):",'if False:','EXPECTED_REJECTION:XLSX_LIMIT_BYTES'],
 ['expanded',2,"if sum(i.file_size for i in infos)>cfg.get('maxExpandedBytes',104857600):",'if False:','EXPECTED_REJECTION:XLSX_LIMIT_EXPANDED'],
 ['zipbomb',3,"if sum(i.file_size for i in infos)>cfg.get('maxExpandedBytes',104857600):",'if False:','EXPECTED_REJECTION:XLSX_LIMIT_EXPANDED'],
 ['sheets',4,"if len(sheets)>cfg.get('maxSheets',10):",'if False:','EXPECTED_REJECTION:XLSX_LIMIT_SHEETS'],
 ['external',5,"if any(r.get('TargetMode')=='External' for r in rel.findall(R+'Relationship')):",'if False:','EXPECTED_REJECTION:XLSX_EXTERNAL_LINK'],
 ['macros',6,"if any(i.filename.endswith('vbaProject.bin') for i in infos):",'if False:','EXPECTED_REJECTION:XLSX_MACROS'],
 ['formula',7,'if formula is not None:','if False:','FORMULA_CACHED_VALUE_FORBIDDEN'],
];
const results=[],fixtures=[];
try{
 fs.writeFileSync(reader,original);
 for(const [name,oracle]of xlsxCases){oracle(parse);results.push({type:'control-positive',name,exit:0});}
 for(const args of [{},{sheets:10},{sheets:11},{formula:true},{external:true},{macro:true},{padding:1024*1024},{label:'OTHER',value:'37'}]){fs.writeFileSync(input,workbook(args));const r=spawnSync('python3',[path.join(here,'fixture-validate.py'),input],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);fixtures.push({args,...JSON.parse(r.stdout)});}
 function run(index,id,stage){const r=spawnSync(process.execPath,[path.join(here,'probe-xlsx.mjs'),String(index),reader,input],{encoding:'utf8',timeout:20000});fs.writeFileSync(path.join(out,`xlsx-${id}-${stage}.log`),r.stdout+r.stderr);return r;}
 mutations.push(['pre-expansion','pre',"infos=z.infolist()","infos=z.infolist()\n            reads.append(infos[-1].filename); z.read(infos[-1])",'PREEXPANSION_ZERO_READS']);
 for(const [id,index,from,to,label]of mutations){
  assert.equal(original.split(from).length,2);fs.writeFileSync(reader,original);const before=run(index,id,'before');assert.equal(before.status,0,before.stderr);
  fs.writeFileSync(reader,original.replace(from,to));const defect=run(index,id,'defect');
  assert.equal(defect.status,1,`MUTANT_NOT_EXIT1:${id}`);assert.match(defect.stderr,/ERR_ASSERTION/);assert.ok(defect.stderr.includes(label),`WRONG_ASSERTION:${id}:${defect.stderr}`);assert.ok(!/CONTROL_READER_INFRA|SyntaxError|MODULE_NOT_FOUND/.test(defect.stderr),'INFRA_NOT_MUTATION');
  fs.writeFileSync(reader,original);const restored=run(index,id,'restored');assert.equal(restored.status,0,restored.stderr);
  results.push({type:'control-mutation',id,before:before.status,defect:defect.status,restored:restored.status,assertion:label,log:`xlsx-${id}-defect.log`});
 }
 console.log(JSON.stringify({controlOnly:true,results,fixtures},null,2));
}finally{fs.writeFileSync(path.join(out,'xlsx-controls.json'),JSON.stringify({controlOnly:true,results,fixtures},null,2));fs.rmSync(tmp,{recursive:true,force:true});}
