import {deflateRawSync} from 'node:zlib';
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
