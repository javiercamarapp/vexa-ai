// Repositorio SQL de 0052. `s` = sesión de createDatabase (s.query(text,params), s.tenantId), como el resto del repo.
// Una transacción por lote (el llamador abre `database.transaction('import', ...)` por llamada).
import {versionId} from './runner.mjs';
export class TrackerSqlRepository{
 constructor(s,{connectionId}){this.s=s;this.connectionId=connectionId;}
 async ensureVersion(v){
  const id=versionId(this.connectionId,v.sha256);
  await this.s.query('INSERT INTO public.tracker_versions(id,tenant_id,connection_id,file_sha256,label,rank,received_at) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING',[id,this.s.tenantId,this.connectionId,v.sha256,v.label??null,v.rank,v.received_at??null]);
  const r=(await this.s.query('SELECT rank,file_sha256 FROM public.tracker_versions WHERE tenant_id=$1 AND id=$2',[this.s.tenantId,id])).rows[0];
  if(!r||r.file_sha256!==v.sha256||Number(r.rank)!==v.rank)throw Object.assign(new Error('VERSION_CONFLICT'),{code:'VERSION_CONFLICT'});
  return id;
 }
 async openSheetJob(id,job){
  await this.s.query('INSERT INTO public.tracker_sheet_jobs(id,tenant_id,version_id,sheet_name,sheet_state,expected_rows,expected_cells) VALUES(gen_random_uuid(),$1,$2,$3,$4,$5,$6) ON CONFLICT(tenant_id,version_id,sheet_name) DO NOTHING',[this.s.tenantId,id,job.sheet,job.state,job.counts.rows,job.counts.cells]);
 }
 async ingestBatch(id,sheet,rows,rejections){
  const payload=rows.map(r=>({row_number:r.row_number,row_hash:r.row_hash,cells:r.cells,ticket_state:r.ticket.state,ticket_id:r.ticket.ticket_id??null,ticket_cell:r.ticket.cell??null}));
  const rej=rejections.map(r=>({row_number:r.row_number,code:r.code,field:r.field,raw_hash:r.raw_hash}));
  return (await this.s.query('SELECT public.tracker_ingest_batch($1,$2,$3::jsonb,$4::jsonb) AS r',[id,sheet,JSON.stringify(payload),JSON.stringify(rej)])).rows[0].r;
 }
 async closeSheet(id,sheet){
  const r=(await this.s.query('SELECT public.tracker_close_sheet($1,$2) AS r',[id,sheet])).rows[0].r;
  return {accepted:r.accepted,rejected:r.rejected,expected:r.expected};
 }
}
