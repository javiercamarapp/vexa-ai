import test from 'node:test';
import assert from 'node:assert/strict';
import {ingestion,exported,options,header,csvRow,rejected} from './support/F02/common.mjs';
import {workbook} from './support/F02/xlsx.mjs';
const m=await ingestion();
const {xmlCardinalityRegressions}=await import('./support/F02/xml-cardinality-regressions.mjs');
xmlCardinalityRegressions((...args)=>exported(m,'parseXLSX')(...args));
const parse=exported(m,'parseCSV'),normalize=exported(m,'normalizeCSV');
test('F02-01 CSV UTF8 BOM multiline escaped quotes and physical row',()=>{
 const r=parse(Buffer.from('\ufeffid,text\r\n1,"a,b\r\nc ""quoted"""\r\n2,end'));
 assert.deepEqual(r,{rows:[{values:['id','text'],line:1},{values:['1','a,b\nc "quoted"'],line:2},{values:['2','end'],line:4}],errors:[]});
});
for(const [name,input] of [['invalid UTF8',Buffer.from([0xc3,0x28])],['NUL','a\0b'],['surrogate','\ud800']])test(`F02-01 CSV encoding ${name}`,()=>rejected(()=>parse(input),'CSV_ENCODING'));
test('F02-01 CSV truncated quoted record retains reason and line',()=>{
 const r=parse('id,text\n1,"unfinished');assert.equal(r.rows.length,1,'CSV_TRUNCATED_ROW_COUNT');assert.deepEqual(r.errors,[{code:'CSV_SYNTAX',line:2,field:null}]);
});
test('F02-01 CSV byte boundary uses UTF8 bytes',()=>{assert.equal(parse('é',{maxBytes:2}).rows.length,1);rejected(()=>parse('éx',{maxBytes:2}),'CSV_LIMIT_BYTES');});
test('F02-01 CSV column boundary',()=>{assert.deepEqual(parse('a,b',{maxColumns:2}).rows[0].values,['a','b']);rejected(()=>parse('a,b,c',{maxColumns:2}),'CSV_LIMIT_COLUMNS');});
test('F02-01 CSV field boundary',()=>{assert.equal(parse('abcd',{maxFieldChars:4}).rows[0].values[0],'abcd');rejected(()=>parse('abcde',{maxFieldChars:4}),'CSV_LIMIT_FIELD');});
test('F02-01 CSV row boundary precise custom limit',()=>{assert.equal(parse('a\nb',{maxRows:2}).rows.length,2);rejected(()=>parse('a\nb\nc',{maxRows:2}),'CSV_LIMIT_ROWS');});
test('F02-01 50000 data rows accepted; row 50001 rejected with location',()=>{
 const good=header+'\n'+Array.from({length:50000},(_,i)=>csvRow({id:`r${i}`})).join('\n');
 assert.equal(normalize(good,options).records.length,50000,'DATA_ROWS_EXCLUDE_HEADER');
 assert.throws(()=>normalize(good+'\n'+csvRow({id:'overflow'}),options),e=>{assert.equal(e.code,'CSV_LIMIT_ROWS');assert.equal(e.line??e.row,50002,'ROW_LIMIT_LOCATION');return true;},'DATA_ROW_OVERFLOW_REJECTED');
});
test('F02-01 configured 20MiB compressed boundary independent of field size',()=>{
 const bytes=20*1024*1024;const limits={maxBytes:bytes,maxFieldChars:bytes};
 assert.equal(parse('x'.repeat(bytes),limits).rows.length,1);
 rejected(()=>parse('x'.repeat(bytes+1),limits),'CSV_LIMIT_BYTES');
});
test('F02-01 default 20MiB policy accepts 9MiB bounded fields',()=>{
 const row='x'.repeat(1000)+'\n';assert.equal(parse(row.repeat(9500)).rows.length,9500,'PILOT_BYTES_20MIB');
});
test('F02-01 message 2000 allowed and 2001 rejected by row',()=>{
 const r=normalize(header+'\n'+csvRow({text:'x'.repeat(2000)})+'\n'+csvRow({id:'too-long',text:'x'.repeat(2001)}),options);
 assert.equal(r.records.length,1,'MESSAGE_LIMIT_2000');assert.equal(r.errors.length,1);assert.equal(r.errors[0].line,3);assert.ok(r.errors[0].code);
});
test('F02-01 unknown customer/SKU remain null',()=>{const r=normalize(header+'\n'+csvRow(),options);assert.equal(r.records[0].message.customer_id,null);assert.equal(r.records[0].message.sku,null);});
test('F02-01 CSV formulas/HTML are inert strings; no fetch/eval',()=>{
 const payloads=['=HYPERLINK("https://example.invalid/never","x")','<img src=x onerror="globalThis.__F02_EXECUTED=true">','globalThis.__F02_EXECUTED=true'];
 const oldFetch=globalThis.fetch,oldEval=globalThis.eval;let calls=0;globalThis.__F02_EXECUTED=false;
 globalThis.fetch=()=>{calls++;throw Error('NETWORK_EXECUTED');};globalThis.eval=()=>{calls++;throw Error('EVAL_EXECUTED');};
 try {const r=normalize(header+'\n'+payloads.map((text,i)=>csvRow({id:`p${i}`,text})).join('\n'),options);assert.deepEqual(r.records.map(r=>r.message.text),payloads);assert.equal(calls,0,'CSV_EXECUTION');assert.equal(globalThis.__F02_EXECUTED,false,'HTML_EXECUTION');}finally{globalThis.fetch=oldFetch;globalThis.eval=oldEval;delete globalThis.__F02_EXECUTED;}
});
for(const amount of ['invalid','=HYPERLINK("https://example.invalid/never","1")'])test(`F02-01 amount ${amount==='invalid'?'invalid':'formula'} cannot become accounting zero or value`,()=>{
 const zero=normalize(header+',amount,currency\n'+csvRow()+',0,USD',options);assert.equal(zero.records.length,1,'VALID_ZERO_ACCEPTED');assert.deepEqual(zero.errors,[],'VALID_ZERO_NO_ERROR');
 const cell='"'+amount.replaceAll('"','""')+'"';const r=normalize(header+',amount,currency\n'+csvRow()+','+cell+',USD',options);
 assert.equal(r.records.length,0,'ACCOUNTING_AMOUNT_REJECTED');assert.equal(r.errors.length,1);assert.equal(r.errors[0].line,2);assert.equal(r.errors[0].field,'amount');assert.ok(r.errors[0].code);
});
// Proposed additive binding: events preserve parseCSV row/error shapes, see contract.
import {earlyEmission,splitBoundary,cancellation,consumption,collect,tracked,row} from './support/F02/stream.mjs';
for(const [name,oracle]of [['emits before source ends',earlyEmission],['all UTF8 quotes CRLF split positions',splitBoundary],['abort and consumer break',cancellation],['bounded consumption after rejection',consumption]])test(`F02-01 streaming ${name}`,{timeout:5000},()=>oracle(exported(m,'parseCSVStream')));
test('F02-01 streaming malformed UTF8 and truncated quote',async()=>{
 const stream=exported(m,'parseCSVStream');await assert.rejects(()=>collect(stream(tracked([Buffer.from([0xc3])]))),e=>e.code==='CSV_ENCODING');
 assert.deepEqual(await collect(stream(tracked([Buffer.from('h\r'),Buffer.from('\n"unfinished')]))),[row(['h'],1),{type:'error',code:'CSV_SYNTAX',line:2,field:null}]);
});
test('F02-01 message length is Unicode codepoints not UTF8 or UTF16',()=>{
 const r=normalize(header+'\n'+csvRow({text:'😀'.repeat(2000)})+'\n'+csvRow({id:'over',text:'😀'.repeat(2001)}),options);
 assert.equal(r.records.length,1,'MESSAGE_CODEPOINT_LIMIT');assert.equal(r.records[0].message.text,'😀'.repeat(2000));assert.equal(r.errors.length,1);assert.equal(r.errors[0].line,3);
});
test('F02-01 CSV UTF8 bytes distinct from Unicode points',()=>{assert.equal(parse('😀é',{maxBytes:6}).rows[0].values[0],'😀é');rejected(()=>parse('😀é',{maxBytes:5}),'CSV_LIMIT_BYTES');});

import {xlsxCases} from './support/F02/xlsx-oracles.mjs';
for(const [name,oracle]of xlsxCases)test(`F02-01 XLSX ${name}`,()=>oracle(exported(m,'parseXLSX')));
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
test('F02-01 XLSX reject before any observed expansion',()=>{
 const r=spawnSync(process.execPath,[fileURLToPath(new URL('./support/F02/preexpand.mjs',import.meta.url))],{env:process.env,encoding:'utf8',timeout:15000});
 assert.equal(r.status,0,`PREEXPANSION_PROBE_FAILED\n${r.stdout}\n${r.stderr}`);assert.match(r.stdout,/XLSX_PREEXPANSION_OBSERVED/);
});
import {pendingAbort} from './support/F02/stream.mjs';
test('F02-01 streaming abort interrupts a pending read',{timeout:5000},()=>pendingAbort(exported(m,'parseCSVStream')));
test('F02-01 streaming source error remains failure',async()=>{
 const sentinel=Object.assign(new Error('SYNTHETIC_IO_ERROR'),{code:'SYNTHETIC_IO_ERROR'});let closed=false;
 async function* source(){try{yield Buffer.from('h\n');throw sentinel;}finally{closed=true;}}
 await assert.rejects(()=>collect(exported(m,'parseCSVStream')(source())),e=>e===sentinel,'SOURCE_ERROR_PRESERVED');assert.equal(closed,true);
});
test('F02-01 default CSV 20MiB exact and overflow with bounded fields',()=>{
 const limit=20*1024*1024,unit='x'.repeat(999)+'\n',input=unit.repeat(Math.floor(limit/1000))+'x'.repeat(limit%1000);
 assert.equal(Buffer.byteLength(input),limit);assert.equal(parse(input).errors.length,0,'CSV_DEFAULT_20MIB_EXACT');rejected(()=>parse(input+'x'),'CSV_LIMIT_BYTES');
});

// New hostile archives run in a permission-restricted child, never with private reads/network.
import path from 'node:path';
import {candidate} from './support/F02/common.mjs';
import {adverseIds} from './support/F02/adversarial-xlsx.mjs';
for(const id of ['positive-entities',...adverseIds])test(`F02-01 XLSX adversarial ${id}`,()=>{
 const support=fileURLToPath(new URL('./support/F02/',import.meta.url));
 const r=spawnSync(process.execPath,['--permission',`--allow-fs-read=${support}`,`--allow-fs-read=${path.join(candidate,'packages/ingestion')}`,path.join(support,'probe-adversarial.mjs'),id],{env:{PATH:process.env.PATH,VEXA_CANDIDATE:candidate},encoding:'utf8',timeout:15000});
 assert.equal(r.status,0,`ADVERSARIAL_CHILD:${id}\n${r.stdout}\n${r.stderr}`);assert.match(r.stdout,new RegExp(`ADVERSARIAL_OK:${id}`));
});
test('F02-01 XLSX actual expansion observed cap',()=>{
 const r=spawnSync(process.execPath,[fileURLToPath(new URL('./support/F02/probe-expanded.mjs',import.meta.url))],{env:{PATH:process.env.PATH,VEXA_CANDIDATE:candidate},encoding:'utf8',timeout:15000});
 assert.equal(r.status,0,`ACTUAL_EXPANSION_PROBE_FAILED\n${r.stdout}\n${r.stderr}`);assert.match(r.stdout,/ACTUAL_EXPANSION_OBSERVED/);
});

test('F02-01 normalized NFC message counts published codepoints',()=>{
 const text='e\u0301'.repeat(2000);const r=normalize(header+'\n'+csvRow({text})+'\n'+csvRow({id:'over-nfc',text:text+'e\u0301'}),options);
 assert.equal(r.records.length,1,'NFC_MESSAGE_LIMIT');assert.equal(r.records[0].message.text,'é'.repeat(2000),'NFC_PUBLISHED_TEXT');assert.equal(r.errors.length,1);assert.equal(r.errors[0].line,3);
});
