import assert from 'node:assert/strict';
import {csv,row,xlsx,mapping,options} from './fixtures.mjs';
import {coverage,rejectsDomain,money,instant,safeExport} from './oracles.mjs';
export async function pureExam(t,m){
 const preview=(bytes=csv(),patch={})=>m.previewImport(bytes,{...options,...patch});
 await t.test('USD exact, null distinct from observed zero, mixed currencies explicit',async()=>{
  const r=await preview(csv([row(),row({id:'null',amount:''}),row({id:'zero',amount:'0'}),row({id:'yen',amount:'10',currency:'JPY'})]));coverage(r,4);assert.equal(r.coverage.accepted,4);
  const rows=r.sample.rows;money(rows[0],{amount_minor:'1001',currency:'USD',exponent:2});money(rows[1],null);money(rows[2],{amount_minor:'0',currency:'USD',exponent:2});money(rows[3],{amount_minor:'10',currency:'JPY',exponent:0});
 });
 for(const amount of ['10.01','0.01','-10.01'])await t.test('JPY fraction rejected '+amount,()=>rejectsDomain(()=>preview(csv([row({amount,currency:'JPY'})])),'JPY_NO_ROUNDING'));
 await t.test('USD above Number safe integer exact',async()=>{const r=await preview(csv([row({amount:'90071992547409.93'})]));money(r.sample.rows[0],{amount_minor:'9007199254740993',currency:'USD',exponent:2});});
 for(const [label,patch,date] of [
  ['ambiguous missing format',{dateFormat:undefined},'01/02/2026'],['missing timezone',{timezone:undefined},'2026-02-01T00:00:00'],
  ['invalid calendar',{dateFormat:'ymd'},'2026-02-30'],['DST gap',{timezone:'America/New_York'},'2026-03-08T02:30:00'],['DST fold',{timezone:'America/New_York'},'2026-11-01T01:30:00']
 ])await t.test(label,()=>rejectsDomain(()=>preview(csv([row({date})]),{mapping:{...mapping,...patch}}),'DATE_EXPLICIT_'+label));
 for(const [format,date,zone,expected] of [
  ['dmy','01/02/2026','UTC','2026-02-01T00:00:00.000Z'],['mdy','01/02/2026','UTC','2026-01-02T00:00:00.000Z'],
  ['ymd','2026-02-01','America/Mexico_City','2026-02-01T06:00:00.000Z'],['iso','2026-11-01T01:30:00-04:00','America/New_York','2026-11-01T05:30:00.000Z'],
  ['iso','2026-11-01T01:30:00-05:00','UTC','2026-11-01T06:30:00.000Z']
 ])await t.test('exact instant '+format+date,async()=>{const r=await preview(csv([row({date})]),{mapping:{...mapping,dateFormat:format,timezone:zone}});coverage(r,1);assert.equal(r.coverage.accepted,1);instant(r.sample.rows[0],expected);});
 await t.test('currency absent is not inferred',()=>rejectsDomain(()=>preview(csv(),{mapping:{...mapping,columns:{...mapping.columns,currency:null}}}),'CURRENCY_EXPLICIT'));
 await t.test('constant explicit USD',async()=>{const r=await preview(csv(),{mapping:{...mapping,currency:'USD',columns:{...mapping.columns,currency:null}}});money(r.sample.rows[0],{amount_minor:'1001',currency:'USD',exponent:2});});
 await t.test('no amount has explicit null money',async()=>{const r=await preview(csv(),{mapping:{...mapping,columns:{...mapping.columns,amount:null,currency:null}}});money(r.sample.rows[0],null);});
 await t.test('duplicate literal header',()=>rejectsDomain(()=>preview(csv([row()],['id','text','date','amount','amount'])),'HEADER_DUPLICATE'));
 await t.test('missing selected column',()=>rejectsDomain(()=>preview(csv(),{mapping:{...mapping,columns:{...mapping.columns,text:'NONEXISTENT'}}}),'HEADER_MISSING'));
 await t.test('mapping hash canonical order and changes',async()=>{
  const a=await preview(),b=await preview(csv(),{mapping:Object.fromEntries(Object.entries(mapping).reverse())});assert.equal(a.mapping_version,b.mapping_version,'CANONICAL_HASH');
  const c=await preview(csv(),{mapping:{...mapping,timezone:'America/New_York'}});assert.notEqual(a.mapping_version,c.mapping_version,'MAPPING_VERSION_CHANGES');
 });
 await t.test('10000 rows, full counters with bounded sample and errors after sample',async()=>{
  const r=await preview(csv(Array.from({length:10000},(_,i)=>row({id:'SYN-'+i,amount:i>=9990?'invalid':'10.01'}))),{sampleLimit:7});coverage(r,10000);assert.equal(r.sample.limit,7);assert.equal(r.sample.rows.length,7);assert.equal(r.coverage.accepted,9990);assert.equal(r.coverage.rejected,10);assert.equal(r.errors.length,10);assert.ok(r.errors.some(e=>e.line===10001),'TAIL_NOT_TRUNCATED');
 });
 await t.test('PII absent in errors and RFC4180 formula neutralization',async()=>{
  const attacks=['=1+1',' +SUM(1,2)','\t-2','\r\n@SUM(1,2)','\u0001=1','comma,quote"\r\nnext'];
  const errors=attacks.map((field,i)=>({line:i+2,field,code:attacks[(i+1)%attacks.length],text:'SYNTHETIC_PRIVATE_PAYLOAD',value:'syn-private@example.test'}));safeExport(await m.exportRowErrors(errors),errors.length);
  const r=await preview(csv([row({amount:'invalid',text:'SYNTHETIC_PRIVATE_PAYLOAD syn-private@example.test'})]));assert.doesNotMatch(JSON.stringify(r.errors),/PRIVATE_PAYLOAD|syn-private/);safeExport(await m.exportRowErrors(r.errors),1);
 });
 const headers=['id','text','date','amount','currency'];const book=xlsx([{name:'SYN_A',rows:[headers,row({amount:'1.23'})]},{name:'SYN_B',rows:[headers,row({amount:'4.56'})]}]);
 const xoptions={contentType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'};
 await t.test('multisheet explicit choice mandatory',()=>rejectsDomain(()=>preview(book,xoptions),'SHEET_REQUIRED'));
 await t.test('multisheet selected by literal name',async()=>{const r=await preview(book,{...xoptions,mapping:{...mapping,sheet:'SYN_B'}});coverage(r,1);money(r.sample.rows[0],{amount_minor:'456',currency:'USD',exponent:2});});
 await t.test('Excel numeric serial date explicitly unsupported',async()=>{
  const result=await preview(xlsx([{name:'SYN_SERIAL',rows:[headers,row({date:'46054'})]}]),{...xoptions,mapping:{...mapping,sheet:'SYN_SERIAL'}});coverage(result,1);assert.equal(result.coverage.rejected,1);assert.equal(result.errors[0].code,'UNSUPPORTED_EXCEL_DATE');
 });
 await t.test('sample retains source line and literal text',async()=>{const r=await preview();assert.equal(r.sample.rows[0].row_ref,2);assert.equal(r.sample.rows[0].line,2);assert.equal(r.sample.rows[0].text,'SYNTHETIC <img src=x onerror=alert(1)>');});
 await t.test('unknown sheet rejected',()=>rejectsDomain(()=>preview(book,{...xoptions,mapping:{...mapping,sheet:'absent'}}),'SHEET_ABSENT'));
}
