// Authoring controls on a private copy of the real source. Never a candidate fallback.
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';import {createHash} from 'node:crypto';
const source=path.resolve(process.argv[2]||'');assert.ok(process.argv[2],'SOURCE_REQUIRED');
const support=path.dirname(new URL(import.meta.url).pathname),evidence=path.join(support,'evidence/close01',process.env.EVIDENCE_RUN||'');fs.mkdirSync(evidence,{recursive:true});
const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'vexa-close01-')));fs.chmodSync(root,0o700);
const files=['index.mjs','csv.mjs','xlsx.mjs'];const originals=Object.fromEntries(files.map(f=>[f,fs.readFileSync(path.join(source,'packages/ingestion',f),'utf8')]));
const hash=s=>createHash('sha256').update(s).digest('hex');const hashes=()=>Object.fromEntries(files.map(f=>[f,hash(fs.readFileSync(path.join(source,'packages/ingestion',f)))]));
const beforeHashes=hashes();const results=[];
const cases=[
 ['cancel-ignored','streaming abort and consumer break','csv.mjs','const c=config(options),s=new CSVState(c)', 'options={...options,signal:undefined};const c=config(options),s=new CSVState(c)','STREAM_CANCEL_REASON'],
 ['backpressure','streaming abort and consumer break','csv.mjs','for(const char of text){check();const e=s.step(char);if(e)yield e;}','for(const char of text){check();const e=s.step(char);if(e){await iterator.next();yield e;}}','STREAM_BACKPRESSURE'],
 ['nfc','normalized NFC message counts','index.mjs',"[...data.text.normalize('NFC')].length>2000","[...data.text].length>2000",'NFC_MESSAGE_LIMIT'],
 ['cancel-close','streaming abort and consumer break','csv.mjs','Promise.resolve(iterator.return?.()).catch(()=>{});','Promise.resolve().catch(()=>{});','STREAM_CANCEL_CLOSE'],
 ['break-close','streaming abort and consumer break','csv.mjs','else await iterator.return?.();','else void 0;','STREAM_BREAK_CLOSE'],
 ['pending-abort','streaming abort interrupts a pending read','csv.mjs',"const abort=()=>{const e=new IngestionError('CSV_CANCELLED');","const abort=()=>{const e=new IngestionError('CSV_ENCODING');",'STREAM_PENDING_ABORT'],
 ['consumption','streaming bounded consumption after rejection','csv.mjs','}finally{','}catch(error){await iterator.next();throw error;}finally{','STREAM_CONSUMPTION_CSV_LIMIT_BYTES'],
 ['rows-normalized','50000 data rows accepted','index.mjs','? 50001 : limits.maxRows+1','? 50002 : limits.maxRows+1','DATA_ROW_OVERFLOW_REJECTED'],
 ['unicode','message length is Unicode codepoints','index.mjs',"[...data.text.normalize('NFC')].length>2000","data.text.normalize('NFC').length>2000",'MESSAGE_CODEPOINT_LIMIT'],
 ['message-limit','message 2000 allowed','index.mjs',"[...data.text.normalize('NFC')].length>2000","[...data.text.normalize('NFC')].length>2001",'MESSAGE_LIMIT_2000'],
 ['invalid-zero','amount invalid cannot','index.mjs',"fail('INVALID_AMOUNT','amount');","return {amount_minor:'0',currency,exponent:2};",'ACCOUNTING_AMOUNT_REJECTED',2],
 ['formula-zero','amount formula cannot','index.mjs',"fail('INVALID_AMOUNT','amount');","return {amount_minor:'0',currency,exponent:2};",'ACCOUNTING_AMOUNT_REJECTED',2],
 ['pre-expansion','XLSX reject before any observed expansion','xlsx.mjs',"if(input.byteLength>cfg.maxBytes)fail('XLSX_LIMIT_BYTES');","if(input.byteLength>cfg.maxBytes)fail('XLSX_LIMIT_BYTES');\n const premature=Buffer.from(input);if(premature.readUInt16LE(8)===8)inflateRawSync(premature.subarray(30+premature.readUInt16LE(26)+premature.readUInt16LE(28),30+premature.readUInt16LE(26)+premature.readUInt16LE(28)+premature.readUInt32LE(18)));",'XLSX_PREEXPANSION_NO_INFLATE'],
];
const pathGuard=originals['xlsx.mjs'].split('\n').find(line=>line.trimStart().startsWith('if(!name||'));assert.ok(pathGuard);
cases.push(
 ['crc','XLSX adversarial crc','xlsx.mjs',"if(crc32(out)!==e.crc)fail('XLSX_CRC');",'', 'ADVERSE_REJECT:crc'],
 ['size-small','XLSX adversarial declared-small','xlsx.mjs',"if(out.length!==e.raw)fail('XLSX_ZIP_MISMATCH');",'', 'ADVERSE_REJECT:declared-small'],
 ['size-large','XLSX adversarial declared-large','xlsx.mjs',"if(out.length!==e.raw)fail('XLSX_ZIP_MISMATCH');",'', 'ADVERSE_REJECT:declared-large'],
 ['duplicate','XLSX adversarial duplicate','xlsx.mjs',"if(entries.has(name))fail('XLSX_ZIP_DUPLICATE');",'', 'ADVERSE_REJECT:duplicate'],
 ['path-alias','XLSX adversarial alias-dot','xlsx.mjs',pathGuard,'', 'ADVERSE_REJECT:alias-dot'],
 ['actual-budget','XLSX actual expansion observed cap','xlsx.mjs','maxOutputLength:Math.max(1,Math.min(e.raw,cfg.maxExpandedBytes-actual))','maxOutputLength:2147483647','ACTUAL_EXPANSION_CAP']
);
function run(dir,pattern,label){const args=['--test','--test-reporter=tap',`--test-name-pattern=${pattern}`,'tests/acceptance/F02-01.test.mjs'];const r=spawnSync(process.execPath,args,{env:{PATH:process.env.PATH,VEXA_CANDIDATE:dir},encoding:'utf8',timeout:60000,maxBuffer:4e6});fs.writeFileSync(path.join(evidence,label+'.log'),(r.stdout||'')+(r.stderr||''));return {exit:r.status,signal:r.signal,error:r.error?.message,command:[process.execPath,...args],output:(r.stdout||'')+(r.stderr||'')};}
try{
 for(const [id,pattern,file,from,to,expected,count=1]of cases){
  if(process.env.CONTROL_IDS&&!process.env.CONTROL_IDS.split(',').includes(id))continue;
  assert.equal(originals[file].split(from).length-1,count,`EXACT_EDIT_TARGET:${id}`);
  const dir=path.join(root,id),target=path.join(dir,'packages/ingestion');fs.mkdirSync(target,{recursive:true});for(const f of files)fs.writeFileSync(path.join(target,f),originals[f]);
  const stages=[];for(const stage of ['before','mutant','after']){const content=stage==='mutant'?originals[file].replace(from,to):originals[file];fs.writeFileSync(path.join(target,file),content);const r=run(dir,pattern,id+'-'+stage);stages.push({...r,output:undefined,sourceHash:hash(content)});if(stage==='mutant'){assert.equal(r.exit,1,`MUTANT_EXIT:${id}`);assert.equal(r.signal,null);assert.match(r.output,/ERR_ASSERTION/);assert.ok(r.output.includes(expected),`SPECIFIC_ASSERTION:${id}`);assert.match(r.output,/^# fail 1$/m);assert.doesNotMatch(r.output,/SyntaxError|ERR_MODULE_NOT_FOUND|IMPLEMENTATION_MISSING|INSTRUMENTATION_UNAVAILABLE|STREAM_ABORT_TIMEOUT|testTimeoutFailure/);}else{assert.equal(r.exit,0,`HEALTHY:${id}`);assert.match(r.output,/^# tests 1$/m);}}
  const result={id,file,from,to,replacement:'first occurrence only',expected,stages,killed:true};results.push(result);console.log(id+': 0 -> 1 assertion -> 0');
 }
}finally{const afterHashes=hashes();fs.writeFileSync(path.join(evidence,(process.env.CONTROL_IDS?'prototype-controls-additional.json':'prototype-controls.json')),JSON.stringify({source,beforeHashes,afterHashes,sourceUnchanged:JSON.stringify(beforeHashes)===JSON.stringify(afterHashes),controlOnly:false,gateHash:hash(fs.readFileSync('tests/acceptance/F02-01.test.mjs')),results},null,2)+'\n');fs.rmSync(root,{recursive:true,force:true});assert.deepEqual(afterHashes,beforeHashes,'SOURCE_CHANGED');}
