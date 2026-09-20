import assert from 'node:assert/strict';
import {workbook} from './xlsx.mjs';
import {rejected} from './common.mjs';
export function expandedSize(input){const end=input.length-22;assert.equal(input.readUInt32LE(end),0x06054b50);let p=input.readUInt32LE(end+16),total=0;for(let n=0;n<input.readUInt16LE(end+10);n++){assert.equal(input.readUInt32LE(p),0x02014b50);total+=input.readUInt32LE(p+24);p+=46+input.readUInt16LE(p+28)+input.readUInt16LE(p+30)+input.readUInt16LE(p+32);}return total;}
export const xlsxCases=[
 ['valid actual cells and 10 sheets',x=>{for(const [label,value]of [['SYNTHETIC','1001'],['OTHER','37']]){const r=x(workbook({sheets:10,label,value}));assert.equal(r.sheets.length,10,'XLSX_SHEETS_POSITIVE');for(let i=0;i<10;i++){assert.equal(r.sheets[i].name,`S${i+1}`);assert.deepEqual(r.sheets[i].rows,[{line:1,values:[label,value]}],'XLSX_ACTUAL_CELLS');assert.deepEqual(r.sheets[i].errors,[]);}}}],
 ['compressed bytes exact and minus one',x=>{const b=workbook();assert.equal(x(b,{maxBytes:b.length}).sheets.length,1);rejected(()=>x(b,{maxBytes:b.length-1}),'XLSX_LIMIT_BYTES');}],
 ['expanded bytes every member exact and minus one',x=>{const b=workbook({padding:1000}),total=expandedSize(b);assert.equal(x(b,{maxExpandedBytes:total}).sheets.length,1);rejected(()=>x(b,{maxExpandedBytes:total-1}),'XLSX_LIMIT_EXPANDED');}],
 ['zipbomb real compressed content',x=>{const b=workbook({padding:1024*1024});assert.ok(b.length<10000);assert.ok(expandedSize(b)>1024*1024);rejected(()=>x(b,{maxExpandedBytes:100000}),'XLSX_LIMIT_EXPANDED');}],
 ['11 sheets',x=>rejected(()=>x(workbook({sheets:11})),'XLSX_LIMIT_SHEETS')],
 ['external refs',x=>rejected(()=>x(workbook({external:true})),'XLSX_EXTERNAL_LINK')],
 ['macro part and relationship',x=>rejected(()=>x(workbook({macro:true})),'XLSX_MACROS')],
 ['cached formula blocked',x=>{const r=x(workbook({formula:true}));assert.equal(r.sheets[0].rows[0].values[1],null,'FORMULA_CACHED_VALUE_FORBIDDEN');assert.deepEqual(r.sheets[0].errors,[{code:'XLSX_FORMULA',line:1,field:'B1'}],'FORMULA_LOCATION');}],
 ['truncated ZIP',x=>rejected(()=>x(workbook().subarray(0,60)),'XLSX_TRUNCATED')],
 ['default compressed 20MiB',x=>{const overhead=workbook({padding:1,store:true}).length-1;const exact=workbook({padding:20*1024*1024-overhead,store:true});assert.equal(exact.length,20*1024*1024);assert.equal(x(exact).sheets.length,1);rejected(()=>x(workbook({padding:20*1024*1024-overhead+1,store:true})),'XLSX_LIMIT_BYTES');}],
 ['default expanded 100MiB',x=>{const base=workbook({padding:1}),overhead=expandedSize(base)-1;const exact=workbook({padding:100*1024*1024-overhead});assert.equal(expandedSize(exact),100*1024*1024);assert.equal(x(exact).sheets.length,1);rejected(()=>x(workbook({padding:100*1024*1024-overhead+1})),'XLSX_LIMIT_EXPANDED');}],
];
