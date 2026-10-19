// Productor sintético de XLSX (sin datos de clientes) para las pruebas del Tracker.
import {deflateRawSync} from 'node:zlib';
const crcT=Uint32Array.from({length:256},(_,c)=>{for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);return c>>>0;});
const crc=b=>{let c=0xffffffff;for(const x of b)c=(c>>>8)^crcT[(c^x)&255];return (c^0xffffffff)>>>0;};
function zip(parts){
 let off=0;const local=[],central=[];
 for(const [name,text] of parts){
  const n=Buffer.from(name),b=Buffer.from(text),z=deflateRawSync(b),h=Buffer.alloc(30),d=Buffer.alloc(46);
  h.writeUInt32LE(0x04034b50);h.writeUInt16LE(20,4);h.writeUInt16LE(8,8);h.writeUInt32LE(crc(b),14);h.writeUInt32LE(z.length,18);h.writeUInt32LE(b.length,22);h.writeUInt16LE(n.length,26);
  d.writeUInt32LE(0x02014b50);d.writeUInt16LE(20,4);d.writeUInt16LE(20,6);d.writeUInt16LE(8,10);d.writeUInt32LE(crc(b),16);d.writeUInt32LE(z.length,20);d.writeUInt32LE(b.length,24);d.writeUInt16LE(n.length,28);d.writeUInt32LE(off,42);
  local.push(h,n,z);central.push(d,n);off+=30+n.length+z.length;
 }
 const cd=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(parts.length,8);end.writeUInt16LE(parts.length,10);end.writeUInt32LE(cd.length,12);end.writeUInt32LE(off,16);
 return new Uint8Array(Buffer.concat([...local,cd,end]));
}
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const NS='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const letters=i=>{let n=i+1,s='';while(n){n--;s=String.fromCharCode(65+n%26)+s;n=Math.floor(n/26);}return s;};
// sheets: [{name,state?,rows:[ [cell...] ]}] ; cell: string | number | {f,v,t?} | {sf:'master'|'dep',si,ref?,f?,v} | {emptyV:true} | null
export function buildXlsx(sheets){
 const sst=[],idx=new Map();const s=t=>{if(!idx.has(t)){idx.set(t,sst.length);sst.push(t);}return idx.get(t);};
 const sheetXml=sh=>`<worksheet xmlns="${NS}"><sheetData>${sh.rows.map((r,ri)=>`<row r="${ri+1}">${r.map((c,ci)=>{
  if(c==null)return '';const ref=letters(ci)+(ri+1);
  if(typeof c==='string')return `<c r="${ref}" t="s"><v>${s(c)}</v></c>`;
  if(typeof c==='number')return `<c r="${ref}"><v>${c}</v></c>`;
  if(c.emptyV)return `<c r="${ref}" t="str"><f>${esc(c.f??'""')}</f><v></v></c>`;
  if(c.sf==='master')return `<c r="${ref}"><f t="shared" ref="${c.ref}" si="${c.si}">${esc(c.f)}</f><v>${c.v}</v></c>`;
  if(c.sf==='dep')return `<c r="${ref}"><f t="shared" si="${c.si}"/><v>${c.v}</v></c>`;
  return `<c r="${ref}"${c.t?` t="${c.t}"`:''}><f>${esc(c.f)}</f><v>${esc(c.v)}</v></c>`;}).join('')}</row>`).join('')}</sheetData></worksheet>`;
 const sheetsXml=sheets.map(sh=>sheetXml(sh));
 return zip([
  ['[Content_Types].xml',`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>`],
  ['_rels/.rels',`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="b" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
  ['xl/workbook.xml',`<workbook xmlns="${NS}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((sh,i)=>`<sheet name="${esc(sh.name)}" sheetId="${i+1}"${sh.state==='hidden'?' state="hidden"':''} r:id="rId${i+1}"/>`).join('')}</sheets></workbook>`],
  ['xl/_rels/workbook.xml.rels',`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}<Relationship Id="rIdS" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>`],
  ['xl/sharedStrings.xml',`<sst xmlns="${NS}">${sst.map(t=>`<si><t>${esc(t)}</t></si>`).join('')}</sst>`],
  ...sheetsXml.map((x,i)=>[`xl/worksheets/sheet${i+1}.xml`,x])
 ]);
}
