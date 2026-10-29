// Genera archivos SQL (uno por lote <=250 filas) para cargar una versión con `supabase db query --linked -f`.
// Cada archivo es una transacción y es reintentable. NO ejecuta nada. Contiene datos del cliente: guardarlo privado.
import {mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {planSheetJob} from './plan.mjs';
import {versionId} from './runner.mjs';
import {cuentaTracker} from '../../../config/cliente-piloto.mjs';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const q=v=>v==null?'null':`'${String(v).replaceAll("'","''")}'`;
function json(v){const text=JSON.stringify(v);let tag;do{tag='j'+randomBytes(6).toString('hex');}while(text.includes('$'+tag+'$'));return `$${tag}$${text}$${tag}$::jsonb`;}
const slug=s=>s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const tx=(tenant,body)=>`begin;\nselect set_config('vexa.tenant_id',${q(tenant)},true);\nset local statement_timeout='60000ms';\n${body}\ncommit;\n`;
export function emitVersionSql({workbook,version,tenantId,connectionId,dir,ticketIndex=null,chunkSize=250}){
 if(!uuid.test(tenantId)||!uuid.test(connectionId))throw Object.assign(new Error('INVALID_ID'),{code:'INVALID_ID'});
 const vid=versionId(connectionId,version.sha256),files=[];
 mkdirSync(dir,{recursive:true});
 const put=(name,sql)=>{writeFileSync(path.join(dir,name),sql,{mode:0o600});files.push(name);};
 const jobs=workbook.sheets.map(s=>planSheetJob(s,{chunkSize,ticketIndex}));
 put('000-version.sql',tx(tenantId,
  `insert into public.connections(id,tenant_id,source,account_id) values(${q(connectionId)},${q(tenantId)},'xlsx',${q(cuentaTracker())}) on conflict do nothing;\n`+
  `insert into public.tracker_versions(id,tenant_id,connection_id,file_sha256,label,rank,received_at) values(${q(vid)},${q(tenantId)},${q(connectionId)},${q(version.sha256)},${q(version.label)},${version.rank},${q(version.received_at)}) on conflict do nothing;\n`+
  jobs.map(j=>`insert into public.tracker_sheet_jobs(id,tenant_id,version_id,sheet_name,sheet_state,expected_rows,expected_cells) values(gen_random_uuid(),${q(tenantId)},${q(vid)},${q(j.sheet)},${q(j.state)},${j.counts.rows},${j.counts.cells}) on conflict(tenant_id,version_id,sheet_name) do nothing;`).join('\n')));
 jobs.forEach((j,ji)=>{
  const base=String(ji+1).padStart(2,'0')+'-'+slug(j.sheet);
  const call=(rows,rej)=>`select public.tracker_ingest_batch(${q(vid)},${q(j.sheet)},${json(rows.map(r=>({row_number:r.row_number,row_hash:r.row_hash,cells:r.cells,ticket_state:r.ticket.state,ticket_id:r.ticket.ticket_id??null,ticket_cell:r.ticket.cell??null})))},${json(rej.map(r=>({row_number:r.row_number,code:r.code,field:r.field,raw_hash:r.raw_hash})))});`;
  j.batches.forEach(b=>put(`${base}-${String(b.index+1).padStart(3,'0')}.sql`,tx(tenantId,call(b.rows,[]))));
  for(let i=0;i<j.rejections.length;i+=chunkSize)put(`${base}-rej-${String(i/chunkSize+1).padStart(3,'0')}.sql`,tx(tenantId,call([],j.rejections.slice(i,i+chunkSize))));
  put(`${base}-zz-close.sql`,tx(tenantId,`select public.tracker_close_sheet(${q(vid)},${q(j.sheet)});`));
 });
 return {version_id:vid,files,jobs:jobs.map(j=>({sheet:j.sheet,rows:j.counts.rows,batches:j.batches.length,rejected:j.rejections.length}))};
}
