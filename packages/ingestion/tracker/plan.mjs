// Plan de ingesta: una hoja = un job; lotes de <=250 filas; manifiesto de conteos (solo agregados, nunca contenido).
import {contentHash} from '../index.mjs';
import {buildRow,headerColumns,LIMITS} from './rows.mjs';
export const MAPPING_VERSION='tracker-sheet-v1';
export function planSheetJob(sheet,{chunkSize=LIMITS.maxChunk,ticketIndex=null}={}){
 if(!Number.isSafeInteger(chunkSize)||chunkSize<1||chunkSize>LIMITS.maxChunk)throw Object.assign(new Error('INVALID_CHUNK_SIZE'),{code:'INVALID_CHUNK_SIZE'});
 const {hubspot}=headerColumns(sheet),records=[],rejections=[];
 for(const row of sheet.rows){const r=buildRow(sheet,row,{hubspot,ticketIndex});(r.record?records:rejections).push(r.record??r.rejection);}
 const batches=[];for(let i=0;i<records.length;i+=chunkSize)batches.push({index:batches.length,rows:records.slice(i,i+chunkSize)});
 return {sheet:sheet.name,state:sheet.state,sheet_id:sheet.sheetId,mapping_version:`${MAPPING_VERSION}:${sheet.name}`,batches,rejections,counts:sheetCounts(sheet,records,rejections)};
}
export function sheetCounts(sheet,records,rejections){
 const cells=sheet.rows.reduce((a,r)=>a+r.cells.length,0),tk={};
 for(const r of records)tk[r.ticket.state]=(tk[r.ticket.state]??0)+1;
 return {rows:sheet.rows.length,cells,formulas:sheet.rows.reduce((a,r)=>a+r.cells.filter(c=>c.f!=null).length,0),accepted:records.length,rejected:rejections.length,header_rows:records.filter(r=>r.is_header).length,ticket:tk};
}
export function planWorkbook(workbook,opts){return workbook.sheets.map(s=>planSheetJob(s,opts));}
// Manifiesto por hoja (solo agregados) para comparar con el recibo comparacion-version-recibida.json.
export function manifest(workbook,{version,ticketIndex=null}={}){
 const jobs=planWorkbook(workbook,{ticketIndex});
 const sheets=jobs.map(j=>({sheet:j.sheet,state:j.state,nonemptyRows:j.counts.rows,nonemptyCells:j.counts.cells,formulaCells:j.counts.formulas,batches:j.batches.length,maxBatch:Math.max(0,...j.batches.map(b=>b.rows.length)),rejected:j.counts.rejected,ticket:j.counts.ticket}));
 const total=sheets.reduce((a,s)=>({rows:a.rows+s.nonemptyRows,cells:a.cells+s.nonemptyCells,formulas:a.formulas+s.formulaCells,batches:a.batches+s.batches,rejected:a.rejected+s.rejected}),{rows:0,cells:0,formulas:0,batches:0,rejected:0});
 return {version:version??null,mapping_version:MAPPING_VERSION,sheets,total};
}
export const sheetFingerprint=job=>contentHash(job.batches.flatMap(b=>b.rows.map(r=>[r.row_ref,r.row_hash])));
