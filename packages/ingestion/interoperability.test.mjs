import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import {parseXLSX} from './index.mjs';
const parse=name=>parseXLSX(readFileSync(new URL(`./test-fixtures/${name}.xlsx`,import.meta.url)));
test('real openpyxl basic worksheet preserves message and numeric text',()=>{
 const result=parse('openpyxl-basic');assert.equal(result.sheets.length,1);
 assert.deepEqual(result.sheets[0].rows.map(r=>r.values),[['message','amount'],['SYNTHETIC: café 😀\nsegunda línea','12.34']]);
});
for(const name of ['openpyxl-multiple-rich-formula','openpyxl-metadata','openpyxl-custom-filter','openpyxl-hidden-and-named-formula'])test(name+' preserves all sheets and ignores no data behind metadata',()=>{
 const result=parse(name);assert.equal(result.sheets.length,2);
 assert.deepEqual(result.sheets[0].rows[2].values,['inicio 尾😀 fin',null]);
 assert.deepEqual(result.sheets[0].errors,[{code:'XLSX_FORMULA',line:3,field:'B3'}]);
 assert.deepEqual(result.sheets[1].rows[1].values,['SYNTHETIC segunda hoja','-99']);
});
for(const name of Object.keys(JSON.parse(readFileSync(new URL('./test-fixtures/manifest.json',import.meta.url))).files_sha256).filter(n=>n.startsWith('bad-')))test('paired malicious writer: '+name,()=>assert.throws(()=>parse(name),e=>e.code?.startsWith('XLSX_')));
