import { inflateRawSync } from 'node:zlib';
import path from 'node:path';
import { SaxesParser } from './vendor/saxes/saxes.js';
import { validateDefinedNames, grammar, sheetNS, relNS, officeNS } from './xml-grammar.mjs';
import { IngestionError } from './index.mjs';
function fail(code,line,field=null){const e=new IngestionError(code,field);if(line!==undefined)e.line=line;throw e;}
const crcTable=Uint32Array.from({length:256},(_,c)=>{for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);return c;});
function crc32(b){let c=0xffffffff;for(const x of b)c=(c>>>8)^crcTable[(c^x)&255];return (c^0xffffffff)>>>0;}
function utf8(b){try{return new TextDecoder('utf-8',{fatal:true}).decode(b);}catch{fail('XLSX_ENCODING');}}
function unzip(input,cfg){
 if(!(input instanceof Uint8Array))fail('XLSX_ENCODING');
 if(input.byteLength>cfg.maxBytes)fail('XLSX_LIMIT_BYTES');
 const b=Buffer.from(input.buffer,input.byteOffset,input.byteLength),entries=new Map();
 if(b.length<22)fail('XLSX_TRUNCATED');
 let end=-1;for(let p=b.length-22;p>=Math.max(0,b.length-65557);p--)if(b.readUInt32LE(p)===0x06054b50&&p+22+b.readUInt16LE(p+20)===b.length){end=p;break;}
 if(end<0)fail('XLSX_TRUNCATED');
 const count=b.readUInt16LE(end+10),size=b.readUInt32LE(end+12),start=b.readUInt32LE(end+16);
 if(b.readUInt16LE(end+4)||b.readUInt16LE(end+6)||b.readUInt16LE(end+8)!==count||count===65535||size===0xffffffff||start===0xffffffff)fail('XLSX_ZIP_UNSUPPORTED');
 if(start+size!==end||start>end)fail('XLSX_TRUNCATED');
 if(count>cfg.maxEntries)fail('XLSX_LIMIT_ENTRIES');
 let p=start,expanded=0;const ranges=[];
 for(let i=0;i<count;i++){
  if(p+46>end||b.readUInt32LE(p)!==0x02014b50)fail('XLSX_TRUNCATED');
  const flags=b.readUInt16LE(p+8),method=b.readUInt16LE(p+10),crc=b.readUInt32LE(p+16),compressed=b.readUInt32LE(p+20),raw=b.readUInt32LE(p+24),nl=b.readUInt16LE(p+28),el=b.readUInt16LE(p+30),cl=b.readUInt16LE(p+32),offset=b.readUInt32LE(p+42);
  if(p+46+nl+el+cl>end)fail('XLSX_TRUNCATED');
  const nameBytes=b.subarray(p+46,p+46+nl),name=utf8(nameBytes);
  if(!name||name.includes('\\')||name.startsWith('/')||name.includes(':')||/[\x00-\x1f]/.test(name)||name.split('/').some(s=>s==='..'||s==='.'||s===''))fail('XLSX_PATH');
  if(entries.has(name))fail('XLSX_ZIP_DUPLICATE');
  if(flags&~0x080e||![0,8].includes(method)||b.readUInt16LE(p+34)||raw===0xffffffff||compressed===0xffffffff)fail('XLSX_ZIP_UNSUPPORTED');
  // Symlinks are never spreadsheet parts.
  if((b.readUInt32LE(p+38)>>>16&0xf000)===0xa000)fail('XLSX_PATH');
  expanded+=raw;if(expanded>cfg.maxExpandedBytes)fail('XLSX_LIMIT_EXPANDED');
  if(offset+30>start||b.readUInt32LE(offset)!==0x04034b50)fail('XLSX_TRUNCATED');
  const ln=b.readUInt16LE(offset+26),le=b.readUInt16LE(offset+28),data=offset+30+ln+le;
  if(data+compressed>start)fail('XLSX_TRUNCATED');
  if(b.readUInt16LE(offset+6)!==flags||b.readUInt16LE(offset+8)!==method||!b.subarray(offset+30,offset+30+ln).equals(nameBytes))fail('XLSX_ZIP_MISMATCH');
  const lc=b.readUInt32LE(offset+14),lz=b.readUInt32LE(offset+18),lr=b.readUInt32LE(offset+22);
  let finish=data+compressed;
  if(flags&8){
   if(finish+12>start)fail('XLSX_TRUNCATED');
   if(b.readUInt32LE(finish)===0x08074b50)finish+=4;
   if(finish+12>start)fail('XLSX_TRUNCATED');
   if(b.readUInt32LE(finish)!==crc||b.readUInt32LE(finish+4)!==compressed||b.readUInt32LE(finish+8)!==raw)fail('XLSX_ZIP_MISMATCH');finish+=12;
   if((lc&&lc!==crc)||(lz&&lz!==compressed)||(lr&&lr!==raw))fail('XLSX_ZIP_MISMATCH');
  }else if(lc!==crc||lz!==compressed||lr!==raw)fail('XLSX_ZIP_MISMATCH');
  ranges.push([offset,finish]);entries.set(name,{name,method,crc,compressed,raw,data});p+=46+nl+el+cl;
 }
 if(p!==end)fail('XLSX_ZIP_MISMATCH');
 ranges.sort((a,b)=>a[0]-b[0]);let cursor=0;for(const [a,z]of ranges){if(a!==cursor)fail('XLSX_ZIP_OVERLAP');cursor=z;}if(cursor!==start)fail('XLSX_ZIP_OVERLAP');
 let actual=0;const validated=new Set();
 function read(name){
  const e=entries.get(name);if(!e)fail('XLSX_PART_MISSING');
  let out;
  if(e.method===0)out=b.subarray(e.data,e.data+e.compressed);
  else {try{const inflated=inflateRawSync(b.subarray(e.data,e.data+e.compressed),{maxOutputLength:Math.max(1,Math.min(e.raw,cfg.maxExpandedBytes-actual)),info:true});if(inflated.engine.bytesWritten!==e.compressed)fail('XLSX_ZIP_MISMATCH');out=inflated.buffer;}catch(err){if(err instanceof IngestionError)throw err;fail(err.code==='ERR_BUFFER_TOO_LARGE'?'XLSX_LIMIT_EXPANDED':'XLSX_TRUNCATED');}}
  if(!validated.has(name))actual+=out.length;if(actual>cfg.maxExpandedBytes)fail('XLSX_LIMIT_EXPANDED');
  if(out.length!==e.raw)fail('XLSX_ZIP_MISMATCH');if(crc32(out)!==e.crc)fail('XLSX_CRC');validated.add(name);return out;
 }
 return {entries,read,validated};
}
// Namespace-aware XML 1.0 validation is delegated to unmodified saxes logic.
// Keep only the active scalar/row tree; consumers detach completed rows and si.
function standardParser(){
 const parser=new SaxesParser({xmlns:true,defaultXMLVersion:'1.0',forceXMLVersion:true});
 parser.on('error',()=>fail('XLSX_XML'));
 parser.on('doctype',()=>fail('XLSX_XML'));
 parser.on('processinginstruction',()=>fail('XLSX_XML'));
 parser.on('xmldecl',d=>{if(d.version!=='1.0'||d.encoding&&!/^utf-8$/i.test(d.encoding))fail('XLSX_XML');});
 return parser;
}
function validateUnusedXML(bytes,cfg){
 const parser=standardParser();let depth=0,nodes=0;
 parser.on('opentag',()=>{if(++depth>128||++nodes>cfg.maxXMLNodes)fail('XLSX_LIMIT_XML');});
 parser.on('closetag',()=>{depth--;});
 parser.write(utf8(bytes)).close();
}
function xml(bytes,cfg,onOpen=()=>{},onClose=()=>false){
 const document={children:[],text:''},stack=[document];let nodes=0;
 const rules=grammar(fail),parser=standardParser();
 parser.on('opentag',tag=>{
  if(++nodes>cfg.maxXMLNodes||stack.length>128)fail('XLSX_LIMIT_XML');
  const attrs=Object.create(null);
  for(const attr of Object.values(tag.attributes))if(!attr.uri)attrs[attr.local]=attr.value;
  const node={name:tag.name,tag:tag.local,uri:tag.uri,attributes:tag.attributes,attrs,children:[],text:''};
  const parent=stack.at(-1);rules.open(node,parent);onOpen(node,parent);parent.children.push(node);stack.push(node);
 });
 const text=t=>{if(stack.length>1)stack.at(-1).text+=t;};
 parser.on('text',text);parser.on('cdata',text);
 parser.on('closetag',()=>{const node=stack.pop(),parent=stack.at(-1);rules.close(node);if(onClose(node,parent))parent.children.pop();});
 parser.write(utf8(bytes)).close();
 if(stack.length!==1||document.children.length!==1)fail('XLSX_XML');return document.children[0];
}
const children=(n,tag)=>n.children.filter(c=>c.tag===tag&&c.uri===n.uri);
const child=(n,tag)=>{const matches=children(n,tag);if(matches.length>1)fail('XLSX_XML');return matches[0];};
// Data-bearing paths are a declared subset: unknown wrappers must never hide rows/values.
function structure(n,allowed,singletons=[]){
 if(n.text.trim())fail('XLSX_UNSUPPORTED');
 for(const c of n.children)if(c.uri!==sheetNS||!allowed.includes(c.tag))fail('XLSX_UNSUPPORTED');
 for(const tag of singletons)child(n,tag);
}
function textRuns(n){
 if(n.uri!==sheetNS)fail('XLSX_UNSUPPORTED');
 if(n.tag==='t'){if(n.children.length)fail('XLSX_UNSUPPORTED');return n.text;}
 if(n.tag==='r'){
  structure(n,['rPr','t'],['rPr','t']);const t=child(n,'t');if(!t)fail('XLSX_XML');return textRuns(t);
 }
 if(!['is','si'].includes(n.tag))fail('XLSX_UNSUPPORTED');
 structure(n,['t','r','rPh','phoneticPr'],['t','phoneticPr']);
 if(child(n,'t')&&children(n,'r').length)fail('XLSX_XML');
 for(const phonetic of children(n,'rPh')){structure(phonetic,['t'],['t']);if(!child(phonetic,'t'))fail('XLSX_XML');textRuns(child(phonetic,'t'));}
 return n.children.filter(c=>c.tag==='r'||c.tag==='t').map(textRuns).join('');
}
function resolve(base,target){if(typeof target!=='string'||target.includes('\\')||target.includes('%')||/[?#:\x00-\x1f]/.test(target))fail('XLSX_PATH');const value=path.posix.normalize(target.startsWith('/')?target.slice(1):path.posix.join(path.posix.dirname(base),target));if(value.startsWith('../')||value==='..')fail('XLSX_PATH');return value;}
export function parseXLSX(input,limits={}){
 const cfg={maxBytes:20*1024*1024,maxExpandedBytes:100*1024*1024,maxRows:50000,maxSheets:10,maxColumns:100,maxFieldChars:100000,maxEntries:10000,maxXMLNodes:1000000,...limits};for(const v of Object.values(cfg))if(!Number.isSafeInteger(v)||v<1)fail('INVALID_LIMIT');
 const zip=unzip(input,cfg),parsed=new Set();
 for(const name of zip.entries.keys()){if(/(?:vbaProject|activeX|embeddings|macros)/i.test(name))fail('XLSX_MACROS');if(/externalLinks/i.test(name))fail('XLSX_EXTERNAL_LINK');}
 const tree=(name,onOpen=()=>{},onClose)=>{const root=xml(zip.read(name),cfg,(node,parent)=>{onOpen(node,parent);},onClose);parsed.add(name);return root;};
 const types=tree('[Content_Types].xml');if(types.tag!=='Types'||types.uri!=='http://schemas.openxmlformats.org/package/2006/content-types')fail('XLSX_XML');
 for(const n of types.children)if(/macro|vba|activeX|oleObject/i.test(n.attrs.ContentType||''))fail('XLSX_MACROS');
 const relationships=new Map();
 // Every relationship part is checked, including unused ones. Never dereference remotely.
 for(const name of zip.entries.keys())if(name.endsWith('.rels')){
  const root=tree(name);if(root.tag!=='Relationships'||root.uri!==relNS)fail('XLSX_XML');const rs=new Map();
  for(const r of children(root,'Relationship')){const {Id,Type,Target,TargetMode}=r.attrs;if(!Id||rs.has(Id)||!Type||!Target)fail('XLSX_XML');if(/externalLink/i.test(Type)||TargetMode==='External'||/^[a-z]+:/i.test(Target)||Target.startsWith('//'))fail('XLSX_EXTERNAL_LINK');if(/vba|macro|activeX|oleObject/i.test(Type))fail('XLSX_MACROS');if(TargetMode&&TargetMode!=='Internal')fail('XLSX_XML');rs.set(Id,r.attrs);}relationships.set(name,rs);
 }
 const roots=relationships.get('_rels/.rels');const bookRel=[...(roots?.values()??[])].filter(r=>r.Type===officeNS+'/officeDocument');if(bookRel.length!==1)fail('XLSX_PART_MISSING');const bookPath=resolve('',bookRel[0].Target);
 const workbook=tree(bookPath);if(workbook.tag!=='workbook'||workbook.uri!==sheetNS)fail('XLSX_UNSUPPORTED');const sheetsNode=child(workbook,'sheets');if(!sheetsNode)fail('XLSX_XML');structure(sheetsNode,['sheet']);const sheetDefs=children(sheetsNode,'sheet');if(sheetDefs.length>cfg.maxSheets)fail('XLSX_LIMIT_SHEETS');if(!sheetDefs.length)fail('XLSX_XML');
 validateDefinedNames(workbook,sheetDefs,fail);
 const relPath=path.posix.join(path.posix.dirname(bookPath),'_rels',path.posix.basename(bookPath)+'.rels'),rels=relationships.get(relPath);if(!rels)fail('XLSX_PART_MISSING');
 const ss=[...rels.values()].filter(r=>r.Type===officeNS+'/sharedStrings');if(ss.length>1)fail('XLSX_XML');let strings=[];
 if(ss.length){
  // Consume and detach each completed si; retain only its scalar string, not the SST tree.
  let sstRoot;
  const root=tree(resolve(bookPath,ss[0].Target),(node,parent)=>{
   if(!parent.name)sstRoot=node;
   if(node.tag==='si'&&parent!==sstRoot)fail('XLSX_UNSUPPORTED');
  },(node,parent)=>{
   if(node.tag==='si'&&parent.tag==='sst'&&parent.uri===sheetNS){strings.push(textRuns(node));return true;}return false;
  });
  if(root.tag!=='sst'||root.uri!==sheetNS)fail('XLSX_XML');structure(root,[]);
 }
 const sheets=[],names=new Set(),sheetIds=new Set(),targets=new Set();let totalRows=0;
 for(const def of sheetDefs){
  const sheetId=def.attrs.sheetId;
  if(!/^[0-9]+$/.test(sheetId)||Number(sheetId)<1||Number(sheetId)>4294967295||sheetIds.has(Number(sheetId)))fail('XLSX_XML');sheetIds.add(Number(sheetId));
  const name=def.attrs.name;if(!name||names.has(name))fail('XLSX_XML');names.add(name);
  const rid=Object.values(def.attributes).find(a=>a.uri===officeNS&&a.local==='id')?.value;const relation=rels.get(rid);if(!relation||relation.Type!==officeNS+'/worksheet')fail('XLSX_UNSUPPORTED');const target=resolve(bookPath,relation.Target);if(targets.has(target))fail('XLSX_XML');targets.add(target);
  const rows=[],errors=[];let lastLine=0,cellsInRow=0,currentLine=0,worksheetRoot,sheetData;
  const root=tree(target,(node,parent)=>{
   if(!parent.name)worksheetRoot=node;
   if(node.uri!==sheetNS)return;
   if(node.tag==='sheetData'){
    if(parent!==worksheetRoot)fail('XLSX_UNSUPPORTED');
    if(sheetData)fail('XLSX_XML');sheetData=node;
   }
   if(node.tag==='row'){
    if(parent!==sheetData)fail('XLSX_UNSUPPORTED');
    currentLine=node.attrs.r===undefined?lastLine+1:Number(node.attrs.r);cellsInRow=0;
    if(totalRows+1>cfg.maxRows)fail('XLSX_LIMIT_ROWS',currentLine);
   }
   // Count at opening, before allocating an unbounded row tree (sparse refs checked below).
   if(node.tag==='c'&&++cellsInRow>cfg.maxColumns)fail('XLSX_LIMIT_COLUMNS',currentLine,node.attrs.r);
  },(row,parent)=>{
   if(row.tag!=='row'||parent.tag!=='sheetData'||parent.uri!==sheetNS)return false;
   structure(row,['c']);
   const line=row.attrs.r===undefined?lastLine+1:Number(row.attrs.r);if(!Number.isSafeInteger(line)||line<=lastLine||line>1048576)fail('XLSX_ROW');lastLine=line;if(++totalRows>cfg.maxRows)fail('XLSX_LIMIT_ROWS',line);
   const values=[];let previous=-1;
   for(const cell of children(row,'c')){
    const ref=cell.attrs.r||`${columnName(previous+1)}${line}`,m=/^([A-Z]{1,3})([1-9]\d*)$/.exec(ref);if(!m||Number(m[2])!==line)fail('XLSX_CELL',line,ref);let col=0;for(const char of m[1])col=col*26+char.charCodeAt(0)-64;col--;if(col<=previous)fail('XLSX_CELL',line,ref);if(col>=cfg.maxColumns)fail('XLSX_LIMIT_COLUMNS',line,ref);previous=col;while(values.length<=col)values.push(null);
    structure(cell,['f','v','is'],['f','v','is']);
    for(const scalar of cell.children.filter(n=>n.tag==='v'||n.tag==='f'))if(scalar.children.length)fail('XLSX_UNSUPPORTED',line,ref);
    const inline=child(cell,'is');if(inline)textRuns(inline);
    if(inline&&(cell.attrs.t!=='inlineStr'||child(cell,'v')))fail('XLSX_CELL',line,ref);
    if(child(cell,'f')){errors.push({code:'XLSX_FORMULA',line,field:ref});continue;}
    const value=child(cell,'v')?.text;let result=null;
    switch(cell.attrs.t||'n'){
     case 'inlineStr': {if(child(cell,'v'))fail('XLSX_CELL',line,ref);result=inline?textRuns(inline):null;break;}
     case 's':if(!/^\d+$/.test(value||'')||!Number.isSafeInteger(Number(value))||Number(value)>=strings.length)fail('XLSX_CELL',line,ref);result=strings[Number(value)];break;
     case 'n':if(value!==undefined){if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value))fail('XLSX_CELL',line,ref);result=value;}break;
     case 'b':if(!['0','1'].includes(value))fail('XLSX_CELL',line,ref);result=value;break;
     case 'str': case 'd':result=value??null;break;
     case 'e':errors.push({code:'XLSX_CELL_ERROR',line,field:ref});break;
     default:fail('XLSX_UNSUPPORTED',line,ref);
    }
    if(result!==null&&[...result].length>cfg.maxFieldChars)fail('XLSX_LIMIT_FIELD',line,ref);values[col]=result;
   }rows.push({line,values});return true;
  });
  if(root.tag!=='worksheet'||root.uri!==sheetNS)fail('XLSX_XML');
  structure(root,['sheetPr','dimension','sheetViews','sheetFormatPr','cols','sheetData','sheetCalcPr','sheetProtection','protectedRanges','scenarios','autoFilter','sortState','dataConsolidate','customSheetViews','mergeCells','phoneticPr','conditionalFormatting','dataValidations','hyperlinks','printOptions','pageMargins','pageSetup','headerFooter','rowBreaks','colBreaks','customProperties','cellWatches','ignoredErrors','smartTags','drawing','legacyDrawing','legacyDrawingHF','picture','oleObjects','controls','webPublishItems','tableParts'],['sheetData']);
  const data=child(root,'sheetData');if(!data)fail('XLSX_XML');structure(data,[]);
  sheets.push({name,rows,errors});
 }
 // Validate CRC and actual expansion for every member, including unreferenced padding.
 for(const name of zip.entries.keys()){if(zip.validated.has(name))continue;const bytes=zip.read(name);if(name.endsWith('.xml')&&!parsed.has(name)){validateUnusedXML(bytes,cfg);}}
 return {sheets};
}
function columnName(index){let n=index+1,s='';while(n){n--;s=String.fromCharCode(65+n%26)+s;n=Math.floor(n/26);}return s;}
