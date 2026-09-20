import {test} from 'node:test';
import assert from 'node:assert/strict';
import {inspectImport,previewImport} from '../../../ingestion/mapping.mjs';
import {archive,parts} from '../../../ingestion/mapping-fixtures.mjs';
test('real workbook discovery keeps explicit selection requirement and selected headers',()=>{
 const row='<row r="1"><c r="A1" t="inlineStr"><is><t>id</t></is></c><c r="B1" t="inlineStr"><is><t>text</t></is></c></row>';
 const entries=parts(row);entries[2][1]=entries[2][1].replace('</sheets>','<sheet name="Other" sheetId="2" r:id="s2"/></sheets>');entries[3][1]=entries[3][1].replace('</Relationships>','<Relationship Id="s2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/other.xml"/></Relationships>');entries.push(['xl/worksheets/other.xml',entries[5][1].replace('<t>text</t>','<t>body</t>')]);
 const bytes=archive(entries),contentType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
 const discovered=inspectImport(bytes,{contentType,discover:true});assert.deepEqual(discovered.sheets,['España 😀','Other']);assert.deepEqual(discovered.headers,[]);
 assert.deepEqual(inspectImport(bytes,{contentType,sheet:'Other'}).headers,['id','body']);assert.throws(()=>inspectImport(bytes,{contentType}),e=>e.code==='SHEET_REQUIRED');assert.throws(()=>inspectImport(bytes,{contentType,sheet:'Invented'}),e=>e.code==='SHEET_NOT_FOUND');
 const context={tenant_id:'11111111-1111-4111-8111-111111111111',connection_id:'22222222-2222-4222-8222-222222222222',source:'csv',source_account_id:'SYNTHETIC'};
 assert.throws(()=>previewImport(bytes,{contentType,mapping:{columns:{id:'id',text:'text'},timezone:'UTC',dateFormat:'iso',currency:null},context,observedAt:'2026-09-20T00:00:00Z'}),e=>e.code==='SHEET_REQUIRED');
});
