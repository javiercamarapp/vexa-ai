// Lector de libro XLSX para el Tracker: conserva valor Y fórmula por celda y el estado (visible/oculta) de cada hoja.
// parseXLSX descarta las fórmulas y limita a 10 hojas; este lector es solo para el Tracker. Reutiliza el unzip endurecido.
import path from 'node:path';
import {SaxesParser} from '../vendor/saxes/saxes.js';
import {unzipXLSX} from '../xlsx.mjs';
import {IngestionError} from '../index.mjs';
const NS='http://schemas.openxmlformats.org/spreadsheetml/2006/main',RELNS='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const fail=(code,field=null)=>{throw new IngestionError(code,field);};
const LIMITS={maxBytes:64*1024*1024,maxExpandedBytes:512*1024*1024,maxEntries:10000};
const text=b=>new TextDecoder('utf-8',{fatal:true}).decode(b);
function sax(bytes,onOpen,onClose,onText){
 const p=new SaxesParser({xmlns:true});
 p.on('error',()=>fail('XLSX_XML'));p.on('doctype',()=>fail('XLSX_XML'));
 p.on('opentag',t=>{if(t.uri===NS||t.uri==='http://schemas.openxmlformats.org/package/2006/relationships')onOpen(t);});
 p.on('closetag',t=>{if(t.uri===NS)onClose(t);});p.on('text',onText);
 p.write(text(bytes)).close();
}
export function colIndex(ref){const m=/^([A-Z]{1,3})([1-9]\d*)$/.exec(ref);if(!m)fail('XLSX_CELL',ref);let c=0;for(const ch of m[1])c=c*26+ch.charCodeAt(0)-64;return {col:c-1,row:Number(m[2])};}
export function colName(i){let n=i+1,s='';while(n){n--;s=String.fromCharCode(65+n%26)+s;n=Math.floor(n/26);}return s;}
function sharedStrings(bytes){
 const out=[];let cur=null,inT=false,phon=0;
 sax(bytes,t=>{if(t.local==='si'){cur='';}else if(t.local==='rPh')phon++;else if(t.local==='t')inT=true;},
  t=>{if(t.local==='si'){out.push(cur);cur=null;}else if(t.local==='rPh')phon--;else if(t.local==='t')inT=false;},
  s=>{if(cur!==null&&inT&&!phon)cur+=s;});
 return out;
}
// Cada celda: {ref,col,row,t,v,f,fs}. t: s|str|n|b|e|d|inlineStr|z(vacía con estilo). v: lexema crudo (texto resuelto para cadenas).
function sheetCells(bytes,strings,onRow){
 let row=null,cell=null,field=null,lastRow=0;
 sax(bytes,t=>{
  if(t.local==='row'){const r=t.attributes.r?Number(t.attributes.r.value):lastRow+1;row={row:r,cells:[]};lastRow=r;}
  else if(t.local==='c'&&row){const ref=t.attributes.r.value,{col}=colIndex(ref);cell={ref,col,row:row.row,t:t.attributes.t?.value??'n',v:null,f:null,fs:null,inl:''};}
  else if(cell&&t.local==='v'){field='v';cell.v='';}
  else if(cell&&t.local==='f'){field='f';cell.f='';if(t.attributes.t?.value==='shared'){cell.fs=t.attributes.si?.value??'?';if(t.attributes.ref)cell.fr=t.attributes.ref.value;}}
  else if(cell&&t.local==='t'&&cell.t==='inlineStr')field='inl';
 },t=>{
  if(t.local==='c'&&cell){
   if(cell.t==='s'){if(!/^\d+$/.test(cell.v??'')||Number(cell.v)>=strings.length)fail('XLSX_CELL',cell.ref);cell.v=strings[Number(cell.v)];}
   else if(cell.t==='inlineStr'){cell.v=cell.inl||null;}
   delete cell.inl;row.cells.push(cell);cell=null;field=null;
  }else if(t.local==='row'&&row){onRow(row);row=null;}
  else if(['v','f','t'].includes(t.local))field=null;
 },s=>{if(!cell||!field)return;if(field==='inl')cell.inl+=s;else cell[field]=(cell[field]??'')+s;});
}
// Presente = tiene <v> (aun vacío: resultado "" de fórmula) o <f>. Es la definición del recibo comparacion-version-recibida.json (verificada: 40,599 en Warranty Tools).
export const isNonEmpty=c=>c.v!=null||c.f!=null;
// readWorkbook(bytes) -> {sheets:[{name,sheetId,state,rows:[{row,cells:[no vacías]}]}]}
export function readWorkbook(bytes){
 if(!(bytes instanceof Uint8Array))fail('XLSX_ENCODING');
 const zip=unzipXLSX(bytes,LIMITS);
 for(const n of zip.entries.keys())if(/(?:vbaProject|activeX|macros)/i.test(n))fail('XLSX_MACROS');
 const rels=n=>{const m=new Map();if(!zip.entries.has(n))return m;sax(zip.read(n),t=>{if(t.local==='Relationship')m.set(t.attributes.Id.value,{type:t.attributes.Type.value,target:t.attributes.Target.value,mode:t.attributes.TargetMode?.value});},()=>{},()=>{});return m;};
 const defs=[];
 sax(zip.read('xl/workbook.xml'),t=>{if(t.local==='sheet'){const a=t.attributes,rid=Object.values(a).find(x=>x.uri===RELNS&&x.local==='id')?.value;defs.push({name:a.name.value,sheetId:Number(a.sheetId.value),state:a.state?.value??'visible',rid});}},()=>{},()=>{});
 const wr=rels('xl/_rels/workbook.xml.rels');
 const sst=[...wr.values()].find(r=>/\/sharedStrings$/.test(r.type));
 const strings=sst?sharedStrings(zip.read(path.posix.join('xl',sst.target.replace(/^\/?(xl\/)?/,'')))):[];
 const sheets=[];
 for(const d of defs){
  const r=wr.get(d.rid);if(!r||!/\/worksheet$/.test(r.type)||r.mode==='External')fail('XLSX_UNSUPPORTED',d.name);
  const target=r.target.startsWith('/')?r.target.slice(1):path.posix.join('xl',r.target);
  const rows=[];
  sheetCells(zip.read(target),strings,row=>{const cells=row.cells.filter(isNonEmpty);if(cells.length)rows.push({row:row.row,cells});});
  sheets.push({name:d.name,sheetId:d.sheetId,state:d.state==='visible'?'visible':'hidden',rows});
 }
 return {sheets};
}
