// Fila del Tracker -> registro de ingesta: valor Y fórmula por celda, hash estable, evidencia de ticket y rechazos con motivo.
import {contentHash,IngestionError} from '../index.mjs';
import {colName} from './workbook.mjs';
export const LIMITS=Object.freeze({maxColumns:200,maxCellChars:100000,maxChunk:250});
const TEXT_TYPES=new Set(['s','str','inlineStr']);
export const cellType=t=>TEXT_TYPES.has(t)?'s':t; // sst / inline / resultado de fórmula son el mismo valor
const HUBSPOT=/^hubspot[\s_]*id$/i;
// Celda canónica: ningún dato se descarta (v '' = resultado vacío de fórmula; f null = sin fórmula; fs/fr = fórmula compartida).
export function canonicalCell(c){return [c.col,cellType(c.t),c.v??null,c.f??null,c.fs??null,c.fr??null];}
export function rowHash(cells){return contentHash(cells.map(canonicalCell));}
export function headerColumns(sheet){
 const h=sheet.rows[0];if(!h||h.row!==1)return {hubspot:[],header:null};
 const hubspot=h.cells.filter(c=>typeof c.v==='string'&&HUBSPOT.test(c.v.trim())).map(c=>c.col);
 return {hubspot,header:h};
}
// Evidencia: solo una columna "Hubspot ID" con un id numérico bien formado. Order ID NO enlaza a ticket.
// linked exige el id en el índice de tickets conocido; sin índice o sin coincidencia es candidate (se muestra, no se enlaza).
export function ticketEvidence(cells,hubspotCols,ticketIndex){
 const found=cells.filter(c=>hubspotCols.includes(c.col)&&c.v!=null&&String(c.v).trim()!=='');
 if(!found.length)return {state:'no_ticket'};
 const ids=[];
 for(const c of found){
  const v=String(c.v).trim();
  if(!/^\d{6,20}$/.test(v))return {state:'malformed_id',cell:c.ref+''};
  ids.push({id:v,cell:c.ref,col:colName(c.col)});
 }
 const distinct=[...new Set(ids.map(i=>i.id))];
 if(distinct.length>1)return {state:'conflicting_ids',cell:ids[0].cell};
 const hit=ticketIndex&&ticketIndex.has(distinct[0]);
 return {state:hit?'linked':'candidate',ticket_id:distinct[0],cell:ids[0].cell,column:ids[0].col};
}
// Devuelve {record} o {rejection:{code,field,row_ref}}. Nunca lanza por datos de cliente.
export function buildRow(sheet,row,{hubspot,ticketIndex}){
 const row_ref=`${sheet.name}!${row.row}`;
 const reject=(code,field=null)=>({rejection:{code,field,row_ref,sheet:sheet.name,row_number:row.row,raw_hash:rowHash(row.cells)}});
 if(!Number.isSafeInteger(row.row)||row.row<1||row.row>1048576)return reject('ROW_NUMBER_INVALID');
 if(row.cells.some(c=>c.col>=LIMITS.maxColumns))return reject('ROW_TOO_WIDE');
 const long=row.cells.find(c=>[...(c.v??'')].length>LIMITS.maxCellChars);
 if(long)return reject('CELL_TOO_LONG',long.ref);
 const is_header=row.row===1;
 const cells=row.cells.map(c=>({ref:c.ref,col:c.col,t:cellType(c.t),v:c.v??null,f:c.f??null,...(c.fs!=null?{fs:c.fs,fr:c.fr??null}:{})}));
 return {record:{row_ref,sheet:sheet.name,row_number:row.row,is_header,row_hash:rowHash(row.cells),cells,ticket:is_header?{state:'header'}:ticketEvidence(row.cells,hubspot,ticketIndex)}};
}
export {IngestionError};
