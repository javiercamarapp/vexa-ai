import test from 'node:test';
import assert from 'node:assert/strict';
import {deflateRawSync} from 'node:zlib';
import * as m from './index.mjs';
// Independent synthetic ZIP/OOXML producer, no copied external oracle.
function crc(b){let c=0xffffffff;for(const x of b){c^=x;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;}
export function archive(parts,{stored=false,descriptor=false,trailing=false}={}){
 let offset=0;const local=[],central=[];
 for(const [name,text]of parts){
  const n=Buffer.from(name),b=Buffer.from(text),compressed=stored?b:deflateRawSync(b),z=trailing?Buffer.concat([compressed,Buffer.from([0])]):compressed;
  const h=Buffer.alloc(30),d=Buffer.alloc(46),tail=descriptor?Buffer.alloc(16):Buffer.alloc(0);
  h.writeUInt32LE(0x04034b50);h.writeUInt16LE(20,4);h.writeUInt16LE(descriptor?8:0,6);h.writeUInt16LE(stored?0:8,8);
  if(!descriptor){h.writeUInt32LE(crc(b),14);h.writeUInt32LE(z.length,18);h.writeUInt32LE(b.length,22);}
  h.writeUInt16LE(n.length,26);d.writeUInt32LE(0x02014b50);d.writeUInt16LE(20,4);d.writeUInt16LE(20,6);d.writeUInt16LE(descriptor?8:0,8);d.writeUInt16LE(stored?0:8,10);d.writeUInt32LE(crc(b),16);d.writeUInt32LE(z.length,20);d.writeUInt32LE(b.length,24);d.writeUInt16LE(n.length,28);d.writeUInt32LE(offset,42);
  if(descriptor){tail.writeUInt32LE(0x08074b50);tail.writeUInt32LE(crc(b),4);tail.writeUInt32LE(z.length,8);tail.writeUInt32LE(b.length,12);}
  local.push(h,n,z,tail);central.push(d,n);offset+=30+n.length+z.length+tail.length;
 }
 const cd=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(parts.length,8);end.writeUInt16LE(parts.length,10);end.writeUInt32LE(cd.length,12);end.writeUInt32LE(offset,16);return Buffer.concat([...local,cd,end]);
}
const ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
export function parts(sheet='<row r="7"><c r="A7" t="s"><v>0</v></c><c r="C7"><v>9007199254740993.12</v></c><c r="D7"><f>1+1</f><v>2</v></c></row>') {return [
 ['[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/></Types>'],
 ['_rels/.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="book" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
 ['xl/workbook.xml',`<workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="España 😀" sheetId="1" r:id="s"/></sheets></workbook>`],
 ['xl/_rels/workbook.xml.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="s" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/data.xml"/><Relationship Id="str" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>'],
 ['xl/sharedStrings.xml',`<sst xmlns="${ns}"><si><r><t>é&amp;</t></r><r><t>😀</t></r></si></sst>`],
 ['xl/worksheets/data.xml',`<worksheet xmlns="${ns}"><sheetData>${sheet}</sheetData></worksheet>`]
 ];}
test('XLSX actual shared/rich strings, sparse cells, exact numeric lexeme, formula blocked',()=>{
 const r=m.parseXLSX(archive(parts()));assert.equal(r.sheets[0].name,'España 😀');assert.deepEqual(r.sheets[0].rows,[{line:7,values:['é&😀',null,'9007199254740993.12',null]}]);assert.deepEqual(r.sheets[0].errors,[{code:'XLSX_FORMULA',line:7,field:'D7'}]);
});
test('XLSX rejects corrupt CRC, overlapping entries, path traversal, DTD, malformed XML',()=>{
 const b=archive(parts()),end=b.length-22,central=b.readUInt32LE(end+16);const bad=Buffer.from(b);bad.writeUInt32LE(123,14);bad.writeUInt32LE(123,central+16);assert.throws(()=>m.parseXLSX(bad),/XLSX_CRC/);
 const overlap=Buffer.from(b);const second=central+46+overlap.readUInt16LE(central+28);overlap.writeUInt32LE(0,second+42);assert.throws(()=>m.parseXLSX(overlap),/XLSX_/);
 assert.throws(()=>m.parseXLSX(archive([...parts(),['../evil','x']])),/XLSX_PATH/);
 for(const xml of ['<!DOCTYPE x [<!ENTITY a SYSTEM "file:///etc/passwd">]><worksheet/>','<worksheet><a></worksheet>','<worksheet>&unknown;</worksheet>']){const p=parts();p[p.length-1][1]=xml;assert.throws(()=>m.parseXLSX(archive(p)),/XLSX_XML/);}
});
test('XLSX expansion declaration lie, oversized row index and maxRows fail closed',()=>{
 const b=archive(parts()),central=b.readUInt32LE(b.length-6);b.writeUInt32LE(1,22);b.writeUInt32LE(1,central+24);assert.throws(()=>m.parseXLSX(b),/XLSX_/);
 assert.throws(()=>m.parseXLSX(archive(parts('<row r="1"/><row r="2"/>')),{maxRows:1}),/XLSX_LIMIT_ROWS/);
 assert.throws(()=>m.parseXLSX(archive(parts('<row r="1048577"/>'))),/XLSX_/);
});
test('XLSX refuses namespace tricks, invalid entities, duplicate attributes and out-of-order cells',()=>{
 for(const body of ['<row r="1" r="2"/>','<row r="1"><c r="A1" t="inlineStr"><is><t>&#xD800;</t></is></c></row>','<row r="1"><c r="B1"/><c r="A1"/></row>'])assert.throws(()=>m.parseXLSX(archive(parts(body))),/XLSX_/);
 const p=parts();p[3][1]=p[3][1].replace('Target="sharedStrings.xml"','Target="https&#58;//example.invalid/evil"');assert.throws(()=>m.parseXLSX(archive(p)),/XLSX_EXTERNAL_LINK/);
});
test('XLSX exact configured expansion and missing closing XML',()=>{
 const p=parts(),total=p.reduce((sum,[,s])=>sum+Buffer.byteLength(s),0),b=archive(p);
 assert.equal(m.parseXLSX(b,{maxExpandedBytes:total}).sheets.length,1);
 assert.throws(()=>m.parseXLSX(b,{maxExpandedBytes:total-1}),/XLSX_LIMIT_EXPANDED/);
 const broken=parts();broken[5][1]=broken[5][1].replace('</worksheet>','');assert.throws(()=>m.parseXLSX(archive(broken)),/XLSX_XML/);
});
test('XLSX stored ZIP entries, prefixed XML elements and numeric entities are supported',()=>{
 const p=parts('<x:row xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main" r="3"><x:c r="B3" t="inlineStr"><x:is><x:t>&#128512;&#xE9;</x:t></x:is></x:c></x:row>');
 const b=archive(p);assert.deepEqual(m.parseXLSX(b).sheets[0].rows,[{line:3,values:[null,'😀é']}]);
 // One stored non-XML part exercises method 0 without replacing any worksheet bytes.
 const z=archive([['synthetic.bin','abcd']]);const end=z.length-22,cd=z.readUInt32LE(end+16),nameLen=z.readUInt16LE(26),data=30+nameLen,compressed=z.readUInt32LE(18);
 const h=Buffer.from(z.subarray(0,data)),d=Buffer.from(z.subarray(cd,end)),e=Buffer.from(z.subarray(end));h.writeUInt16LE(0,8);h.writeUInt32LE(4,18);d.writeUInt16LE(0,10);d.writeUInt32LE(4,20);e.writeUInt32LE(data+4,16);
 // This is a valid stored ZIP but no workbook: error must be missing part, not ZIP decoding.
 assert.throws(()=>m.parseXLSX(Buffer.concat([h,Buffer.from('abcd'),d,e])),{code:'XLSX_PART_MISSING'});assert.ok(compressed>0);
});

test('XLSX full workbooks stored/deflated with descriptors; consumed deflate bytes checked',()=>{
 for(const options of [{stored:true},{descriptor:true},{stored:true,descriptor:true}])assert.equal(m.parseXLSX(archive(parts(),options)).sheets[0].rows[0].values[0],'é&😀');
 assert.throws(()=>m.parseXLSX(archive(parts(),{trailing:true})),{code:'XLSX_ZIP_MISMATCH'});
 const bad=archive(parts(),{descriptor:true}),descriptor=bad.indexOf(Buffer.from([0x50,0x4b,0x07,0x08]));bad.writeUInt32LE(123,descriptor+4);assert.throws(()=>m.parseXLSX(bad),{code:'XLSX_ZIP_MISMATCH'});
});

// Corrective regressions authored locally, independent of reviewer fixtures.
for(const [name,change] of [
 ['duplicate sheetData',p=>p[5][1]=p[5][1].replace('</worksheet>','<sheetData><row r="9"/></sheetData></worksheet>')],
 ['duplicate cell value',p=>p[5][1]=p[5][1].replace('<v>9007199254740993.12</v>','<v>9007199254740993.12</v><v>99</v>')],
 ['alternate content',p=>p[5][1]=`<worksheet xmlns="${ns}" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"><sheetData/><mc:AlternateContent><mc:Fallback><sheetData><row r="1"/></sheetData></mc:Fallback></mc:AlternateContent></worksheet>`],
 ['foreign inline text',p=>p[5][1]=`<worksheet xmlns="${ns}"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t xmlns="urn:foreign">invented</t></is></c></row></sheetData></worksheet>`],
 ['foreign shared run',p=>p[4][1]=`<sst xmlns="${ns}"><si><r xmlns="urn:foreign"><t>invented</t></r></si></sst>`],
 ['duplicate inline string',p=>p[5][1]=`<worksheet xmlns="${ns}"><sheetData><row r="1"><c t="inlineStr"><is><t>a</t></is><is><t>b</t></is></c></row></sheetData></worksheet>`],
 ['unknown row wrapper',p=>p[5][1]=`<worksheet xmlns="${ns}"><sheetData><wrapper><row r="1"/></wrapper></sheetData></worksheet>`],
 ['nested value markup',p=>p[5][1]=p[5][1].replace('<v>9007199254740993.12</v>','<v>1<t>2</t></v>')],
 ['mixed rich and plain text',p=>p[4][1]=`<sst xmlns="${ns}"><si><t>a</t><r><t>b</t></r></si></sst>`],
])test('XLSX corrective rejects '+name,()=>{const p=parts();change(p);assert.throws(()=>m.parseXLSX(archive(p)),e=>e.code?.startsWith('XLSX_'));});
test('XLSX corrective preserves prefixed rich text, whitespace, phonetics and exact lexemes',()=>{
 const p=parts('<row r="1"><c t="s"><v>0</v></c><c r="B1"><v>00012.3400</v></c><c r="D1" t="inlineStr"><is><t xml:space="preserve">  😀  </t></is></c></row>');
 p[4][1]=`<x:sst xmlns:x="${ns}"><x:si><x:r><x:rPr><x:b/></x:rPr><x:t xml:space="preserve"> é </x:t></x:r><x:r><x:t>😀</x:t></x:r><x:rPh sb="0" eb="1"><x:t>phonetic</x:t></x:rPh><x:phoneticPr fontId="0"/></x:si></x:sst>`;
 assert.deepEqual(m.parseXLSX(archive(p)).sheets[0].rows,[{line:1,values:[' é 😀','00012.3400',null,'  😀  ']}]);
});
test('XLSX event consumption preserves shared string indices, empty entries and final row',()=>{
 const p=parts(Array.from({length:500},(_,i)=>`<row r="${i+1}"><c t="s"><v>${i===0?0:i===499?9999:i}</v></c></row>`).join(''));
 p[4][1]=`<sst xmlns="${ns}">${Array.from({length:10000},(_,i)=>i===0?'<si/>':`<si><t>s${i}😀</t></si>`).join('')}</sst>`;
 const r=m.parseXLSX(archive(p));assert.equal(r.sheets[0].rows.length,500);assert.equal(r.sheets[0].rows[0].values[0],'');assert.equal(r.sheets[0].rows[237].values[0],'s237😀');assert.deepEqual(r.sheets[0].rows[499],{line:500,values:['s9999😀']});
 assert.throws(()=>m.parseXLSX(archive(p),{maxXMLNodes:19999}),{code:'XLSX_LIMIT_XML'});
});
test('XLSX explicit unsupported extensions reject rather than omit data',()=>{
 for(const modify of [p=>p[5][1]=p[5][1].replace('</worksheet>','<extLst><ext uri="fixture"/></extLst></worksheet>'),p=>p[4][1]=p[4][1].replace('</sst>','<extLst/></sst>')]){const p=parts();modify(p);assert.throws(()=>m.parseXLSX(archive(p)),{code:'XLSX_UNSUPPORTED'});}
});
test('XLSX malformed tail after streamed rows/shared strings remains fatal',()=>{
 for(const index of [4,5]){const p=parts();p[index][1]+='<secondRoot/>';assert.throws(()=>m.parseXLSX(archive(p)),{code:'XLSX_XML'});}
});
test('XLSX event consumers reject nested fake worksheet/SST roots',()=>{
 const a=parts();a[5][1]=`<worksheet xmlns="${ns}"><sheetPr><worksheet><sheetData><row r="1"><c><v>99</v></c></row></sheetData></worksheet></sheetPr><sheetData/></worksheet>`;
 const b=parts();b[4][1]=`<sst xmlns="${ns}"><si><r><rPr><sst><si><t>injected</t></si></sst></rPr><t>real</t></r></si></sst>`;
 for(const p of [a,b])assert.throws(()=>m.parseXLSX(archive(p)),{code:'XLSX_UNSUPPORTED'});
});

// XML-standard / explicit-grammar regressions, independent synthetic producer.
for(const [label,index,from,to] of [
 ['duplicate sheets',2,'</sheets>','</sheets><sheets/>'],
 ['workbook metadata hiding a list',2,'<sheets>','<bookViews><workbookView><sheets/></workbookView></bookViews><sheets>'],
 ['worksheet metadata hiding values',5,'<sheetData>','<sheetPr><outlinePr><v>secret</v></outlinePr></sheetPr><sheetData>'],
 ['scalar property with non-whitespace text',4,'<r><t>','<r><rPr><b>ambiguous</b></rPr><t>'],
 ['duplicate run formatting',4,'<r><t>','<r><rPr><b/><b/></rPr><t>'],
 ['foreign attribute is not a local attribute',2,'name="','q:name="x" xmlns:q="urn:other" name="'],
 ['unbound attribute prefix',2,'name="','q:unknown="x" name="'],
 ['reserved namespace binding',2,'<workbook ','<workbook xmlns:xml="urn:wrong" '],
 ['invalid double colon QName',4,'<r><t>','<r><a:b:t>'],
 ['unknown metadata subtree',2,'<sheets>','<unknown><value>hidden</value></unknown><sheets>'],
 ['definedNames cannot hide cell data',2,'</sheets>','</sheets><definedNames><definedName name="range"><c><v>99</v></c></definedName></definedNames>'],
 ['ambiguous relationship wrapper',3,'<Relationship Id="s"','<wrapper/><Relationship Id="s"'],
 ['unknown content types node',0,'</Types>','<Unknown/></Types>'],
])test('XLSX grammar rejects '+label,()=>{
 const p=parts();assert.ok(p[index][1].includes(from));p[index][1]=p[index][1].replace(from,to);
 assert.throws(()=>m.parseXLSX(archive(p)),e=>e.code?.startsWith('XLSX_'));
});
test('XLSX arbitrary Unicode namespace prefixes and formatting order retain rich text',()=>{
 const p=parts();p[2][1]=p[2][1].replaceAll('xmlns:r=','xmlns:関係=').replaceAll('r:id=','関係:id=');
 p[4][1]=`<字:sst xmlns:字="${ns}"><字:si><字:r><字:rPr><字:sz val="12"/><字:b/><字:rFont val="Example"/></字:rPr><字:t xml:space="preserve">  😀&#13;\n尾 </字:t></字:r></字:si></字:sst>`;
 assert.equal(m.parseXLSX(archive(p)).sheets[0].rows[0].values[0],'  😀\r\n尾 ');
});
test('XLSX supported metadata is structurally validated while retaining data',()=>{
 const p=parts();p[2][1]=p[2][1].replace('<sheets>','<workbookPr date1904="0"/><bookViews><workbookView activeTab="0"/></bookViews><sheets>');
 p[5][1]=p[5][1].replace('<sheetData>','<sheetPr><outlinePr summaryBelow="1"/></sheetPr><dimension ref="A7:D7"/><sheetViews><sheetView workbookViewId="0"><selection activeCell="A7" sqref="A7"/></sheetView></sheetViews><sheetData>');
 assert.deepEqual(m.parseXLSX(archive(p)).sheets[0].rows[0].values,['é&😀',null,'9007199254740993.12',null]);
});
test('XLSX required metadata attributes and unique sheet IDs are enforced',()=>{
 for(const mutate of [
  p=>p[2][1]=p[2][1].replace('sheetId="1"',''),
  p=>p[2][1]=p[2][1].replace('sheetId="1"','sheetId="0"'),
  p=>p[4][1]=p[4][1].replace('<r><t>','<r><rPr><rFont/></rPr><t>'),
  p=>p[2][1]=p[2][1].replace('</sheets>','<sheet name="second" sheetId="01" r:id="s"/></sheets>'),
 ]){const p=parts();mutate(p);assert.throws(()=>m.parseXLSX(archive(p)),{code:'XLSX_XML'});}
});
test('XLSX validates XML well-formedness in unconsumed parts without building a DOM',()=>{
 for(const extra of ['<unused><x></unused>','<unused xmlns:q="urn:x" xmlns:r="urn:x" q:id="a" r:id="b"/>']){
  assert.throws(()=>m.parseXLSX(archive([...parts(),['docProps/custom.xml',extra]])),{code:'XLSX_XML'});
 }
 assert.equal(m.parseXLSX(archive([...parts(),['docProps/custom.xml','<q:metadata xmlns:q="urn:fixture">synthetic</q:metadata>']])).sheets[0].rows[0].values[0],'é&😀');
});
