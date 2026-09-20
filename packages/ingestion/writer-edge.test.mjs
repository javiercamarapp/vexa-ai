import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseXLSX} from './index.mjs';
const input=name=>readFileSync(new URL(`./test-fixtures/writer-edge/${name}.xlsx`,import.meta.url));
for(const name of ['empty','protected'])test(`real writer preserves blank inline cell as null with ${name} metadata`,()=>{
 const result=parseXLSX(input(name));
 assert.deepEqual(result.sheets[0].rows.map(row=>row.values),[['id','amount','message','customer'],['row-1','12.34','SYNTHETIC',null]]);
 assert.deepEqual(result.sheets[0].errors,[]);
});
for(const name of ['inline-value','protection-duplicate','protection-nested-cell','protection-foreign','protection-bool','protection-hash-group','protection-password'])test(`malformed writer variant fails closed: ${name}`,()=>{
 assert.throws(()=>parseXLSX(input(name)),e=>['XLSX_CELL','XLSX_XML','XLSX_UNSUPPORTED'].includes(e.code));
});
