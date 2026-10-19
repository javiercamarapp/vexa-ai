// Corre la ingesta de UNA versión: un job por hoja, lotes <=250, cierre con verificación de conteos.
// El repositorio es un puerto: TrackerLedgerRepository (memoria / dry-run) o TrackerSqlRepository (0052).
import {planSheetJob} from './plan.mjs';
import {TrackerLedger} from './ledger.mjs';
import {createHash} from 'node:crypto';
const stableUuid=parts=>{const h=createHash('sha256').update(JSON.stringify(['tracker-v1',...parts])).digest('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;};
export const versionId=(connectionId,sha256)=>stableUuid([connectionId,sha256]);
export class TrackerLedgerRepository{
 constructor(ledger=new TrackerLedger()){this.ledger=ledger;this.writes=0;this.closed=new Map();}
 async ensureVersion(v){this.ledger.addVersion(v);return v.sha256;}
 async openSheetJob(id,job){this.closed.set(id+'|'+job.sheet,{expected:job.counts.rows,accepted:0,rejected:0});}
 async ingestBatch(id,sheet,rows,rejections){const out=rows.length?this.ledger.applyBatch(id,rows):{inserted:0,revised:0,unchanged:0,replay:0};const c=this.closed.get(id+'|'+sheet);c.accepted+=rows.length;c.rejected+=rejections.length;this.writes++;return {...out,rejected:rejections.length};}
 async closeSheet(id,sheet){const c=this.closed.get(id+'|'+sheet);if(c.accepted+c.rejected!==c.expected)throw Object.assign(new Error('SHEET_COUNT_MISMATCH'),{code:'SHEET_COUNT_MISMATCH'});return c;}
}
export async function ingestVersion({repo,workbook,version,ticketIndex=null,chunkSize=250,sheets=null,onSheet=()=>{}}){
 const id=await repo.ensureVersion(version);const report=[];
 for(const sheet of workbook.sheets){
  if(sheets&&!sheets.includes(sheet.name))continue;
  const job=planSheetJob(sheet,{chunkSize,ticketIndex});
  await repo.openSheetJob(id,job);
  const tot={inserted:0,revised:0,unchanged:0,replay:0,rejected:0,batches:0};
  const add=r=>{for(const k of ['inserted','revised','unchanged','replay','rejected'])tot[k]+=r[k]??0;tot.batches++;};
  for(const b of job.batches)add(await repo.ingestBatch(id,job.sheet,b.rows,[]));
  for(let i=0;i<job.rejections.length;i+=chunkSize)add(await repo.ingestBatch(id,job.sheet,[],job.rejections.slice(i,i+chunkSize)));
  const closed=await repo.closeSheet(id,job.sheet);
  const row={sheet:job.sheet,state:job.state,expected_rows:job.counts.rows,expected_cells:job.counts.cells,...tot,closed:closed.accepted+closed.rejected===job.counts.rows};
  report.push(row);onSheet(row);
 }
 return {version_id:id,sheets:report};
}
