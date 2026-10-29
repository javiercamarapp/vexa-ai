// Cargador por lotes del Tracker (0052): guardas, recibo local reanudable, ejecución por archivo SQL.
// Todo efecto remoto pasa por UN ejecutor de archivos SQL (`supabase db query --linked -f` por defecto, reemplazable en pruebas).
// Nunca imprime ni guarda contenido de celdas: solo conteos, nombres de archivo y códigos de error conocidos.
import {spawnSync} from 'node:child_process';
import {existsSync,readFileSync,writeFileSync,mkdirSync,openSync,writeSync,fsyncSync,closeSync,readdirSync,rmSync,mkdtempSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import {readWorkbook} from './workbook.mjs';
import {versionesTracker,cuentaTracker} from '../../../config/cliente-piloto.mjs';
import {planSheetJob} from './plan.mjs';
import {emitVersionSql} from './emit-sql.mjs';
import {versionId} from './runner.mjs';

export const PROJECT_REF='proyecto-ejemplo';
export const DEFAULT_SQL_CMD=['supabase','db','query','--linked','-f'];
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Archivos recibidos (nombre, huella, orden; rango ascendente = orden de recepción, la última manda): config local del cliente piloto, fuera del repo.
export const VERSIONS=versionesTracker();
export const KNOWN_ERRORS=['TENANT_REQUIRED','INVALID_BATCH','BATCH_SIZE_INVALID','VERSION_UNKNOWN','SHEET_JOB_NOT_OPEN','DUPLICATE_ROW_IN_BATCH','ROW_CONFLICT_IN_VERSION','SHEET_COUNT_MISMATCH','SHEET_JOB_UNKNOWN','canceling statement due to statement timeout','row-level security'];
const fail=(code,extra={})=>{throw Object.assign(new Error(code),{code,...extra});};
export const sha256Bytes=b=>createHash('sha256').update(b).digest('hex');

// ---- Guardas -------------------------------------------------------------------------------------------------------
export function readProjectRef(file){return existsSync(file)?readFileSync(file,'utf8').trim():null;}
export function assertProject(file,expected=PROJECT_REF){
 const ref=readProjectRef(file);
 if(ref!==expected)fail('PROJECT_MISMATCH',{found:ref?ref.slice(0,4)+'…':null});
 return ref;
}
// Solo lectura. Un único SELECT que devuelve una línea con fichas fáciles de buscar (independiente del formato de salida).
export function guardSql(tenant){
 if(!UUID.test(tenant))fail('INVALID_TENANT');
 return `select 'TRGUARD tables='||((to_regclass('public.tracker_versions') is not null and to_regclass('public.tracker_sheet_jobs') is not null and to_regclass('public.tracker_row_revisions') is not null and to_regclass('public.tracker_row_observations') is not null and to_regclass('public.tracker_row_rejections') is not null and to_regclass('public.tracker_row_heads') is not null))::text`+
  `||' fns='||((to_regprocedure('public.tracker_ingest_batch(uuid,text,jsonb,jsonb)') is not null and to_regprocedure('public.tracker_close_sheet(uuid,text)') is not null and to_regprocedure('public.tracker_revision_id(uuid,uuid,text,integer,text)') is not null))::text`+
  `||' tenant='||(exists(select 1 from public.organizations where id='${tenant}'))::text`+
  `||' bypass='||coalesce((select (rolsuper or rolbypassrls) from pg_roles where rolname=current_user),false)::text||' END';\n`;
}
export function parseGuard(out){
 const m=/TRGUARD tables=(true|false) fns=(true|false) tenant=(true|false) bypass=(true|false) END/.exec(out);
 if(!m)return {ok:false,reason:'GUARD_UNREADABLE'};
 const [,tables,fns,tenant,bypass]=m.map(x=>x==='true');
 const reason=!tables||!fns?'MIGRATION_0052_NOT_APPLIED':!bypass?'ROLE_CANNOT_BYPASS_RLS':!tenant?'TENANT_NOT_FOUND':null;
 return {ok:!reason,reason,tables,fns,tenant,bypass};
}
export const connSql=tenant=>`select 'TRCONN id='||coalesce((select id::text from public.connections where tenant_id='${tenant}' and source='xlsx' and account_id='${cuentaTracker()}'),'none')||' END';\n`;
export const parseConn=out=>{const m=/TRCONN id=([0-9a-f-]{36}|none) END/.exec(out);return m?(m[1]==='none'?null:m[1]):undefined;};
export const stateSql=(tenant,vid)=>`select 'TRSTATE jobs='||(select count(*) from public.tracker_sheet_jobs where tenant_id='${tenant}' and version_id='${vid}')||' closed='||coalesce((select string_agg(encode(convert_to(sheet_name,'UTF8'),'hex'),',') from public.tracker_sheet_jobs where tenant_id='${tenant}' and version_id='${vid}' and state='closed'),'')||' END';\n`;
export function parseState(out){
 const m=/TRSTATE jobs=(\d+) closed=([0-9a-f,]*) END/.exec(out);if(!m)return null;
 return {jobs:Number(m[1]),closed:new Set(m[2]?m[2].split(',').map(h=>Buffer.from(h,'hex').toString('utf8')):[])};
}
export const verifySql=(tenant,vid)=>`select 'TRVERIFY obs='||(select count(*) from public.tracker_row_observations where tenant_id='${tenant}' and version_id='${vid}')||' rej='||(select count(distinct (sheet_name,row_number)) from public.tracker_row_rejections where tenant_id='${tenant}' and version_id='${vid}')||' closed='||(select count(*) from public.tracker_sheet_jobs where tenant_id='${tenant}' and version_id='${vid}' and state='closed')||' jobs='||(select count(*) from public.tracker_sheet_jobs where tenant_id='${tenant}' and version_id='${vid}')||' heads='||(select count(*) from public.tracker_row_heads where tenant_id='${tenant}')||' END';\n`;
export function parseVerify(out){
 const m=/TRVERIFY obs=(\d+) rej=(\d+) closed=(\d+) jobs=(\d+) heads=(\d+) END/.exec(out);if(!m)return null;
 return {obs:+m[1],rej:+m[2],closed:+m[3],jobs:+m[4],heads:+m[5]};
}

// ---- Ejecutor ------------------------------------------------------------------------------------------------------
export function runSqlFile(argv,file,{timeoutMs=300000}={}){
 const r=spawnSync(argv[0],[...argv.slice(1),file],{encoding:'utf8',maxBuffer:64*1024*1024,timeout:timeoutMs});
 const out=(r.stdout??'')+(r.stderr??'');
 const bad=r.error||r.status!==0||/ERROR:|SQLSTATE/.test(out);
 return {ok:!bad,out,errors:bad?KNOWN_ERRORS.filter(e=>out.includes(e)).concat(r.error?[r.error.code??'SPAWN']:[]):[]};
}
export function batchStats(out){
 const g=k=>{const m=new RegExp(`"?${k}"?\\s*[:=]\\s*(\\d+)`).exec(out);return m?+m[1]:null;};
 return {inserted:g('inserted'),revised:g('revised'),unchanged:g('unchanged'),replay:g('replay'),rejected:g('rejected')};
}

// ---- Recibo local (JSONL, solo conteos) ----------------------------------------------------------------------------
export class Receipts{
 constructor(dir,manifest){
  mkdirSync(dir,{recursive:true,mode:0o700});this.dir=dir;this.file=path.join(dir,'recibo.jsonl');this.mf=path.join(dir,'manifest.json');
  if(existsSync(this.mf)){
   const prev=JSON.parse(readFileSync(this.mf,'utf8'));
   for(const k of Object.keys(manifest))if(JSON.stringify(prev[k])!==JSON.stringify(manifest[k]))fail('RECEIPT_MANIFEST_MISMATCH',{field:k});
  }else writeFileSync(this.mf,JSON.stringify(manifest,null,1),{mode:0o600});
  this.done=new Set();
  if(existsSync(this.file))for(const ln of readFileSync(this.file,'utf8').split('\n')){
   if(!ln.trim())continue;let r;try{r=JSON.parse(ln);}catch{continue;} // línea truncada por un corte: se reintenta
   if(r.status==='ok')this.done.add(r.step);
  }
 }
 has(step){return this.done.has(step);}
 add(rec){
  const fd=openSync(this.file,'a',0o600);
  try{writeSync(fd,JSON.stringify({ts:new Date().toISOString(),...rec})+'\n');fsyncSync(fd);}finally{closeSync(fd);}
  if(rec.status==='ok')this.done.add(rec.step);
 }
}

// ---- Plan (sin escritura) ------------------------------------------------------------------------------------------
export function loadBytes(root,v){
 const p=path.join(root,v.file);
 let b;try{b=readFileSync(p);}catch(e){fail('SOURCE_UNREADABLE',{file:path.basename(p),os:e.code});}
 if(sha256Bytes(b)!==v.sha256)fail('HASH_MISMATCH',{version:v.key});
 return b;
}
export function planVersion(bytes,{ticketIndex=null,chunkSize=250}={}){
 const wb=readWorkbook(new Uint8Array(bytes));
 const jobs=wb.sheets.map(s=>planSheetJob(s,{chunkSize,ticketIndex}));
 const tk={};let rows=0,cells=0,batches=0,rej=0;
 for(const j of jobs){rows+=j.counts.rows;cells+=j.counts.cells;batches+=j.batches.length;rej+=j.rejections.length;for(const [k,n] of Object.entries(j.counts.ticket))tk[k]=(tk[k]??0)+n;}
 return {wb,jobs,summary:{sheets:jobs.length,rows,cells,batches,rejected:rej,max_batch:Math.max(0,...jobs.flatMap(j=>j.batches.map(b=>b.rows.length))),ticket:tk,files:1+batches+jobs.reduce((a,j)=>a+Math.ceil(j.rejections.length/chunkSize),0)+jobs.length}};
}

// ---- Carga ---------------------------------------------------------------------------------------------------------
// opts: {root,tenant,connectionId,versions,ticketIndex,ticketIndexSha,receiptsDir,sqlCmd,projectRefFile,execute,maxFiles,keepSql,log}
export async function loadTracker(o){
 const log=o.log??(()=>{});const sqlCmd=o.sqlCmd??DEFAULT_SQL_CMD;
 if(!UUID.test(o.tenant))fail('INVALID_TENANT');
 const versions=o.versions;
 const loaded=versions.map(v=>({v,bytes:loadBytes(o.root,v)}));        // hash completo antes de todo
 const plans=loaded.map(({v,bytes})=>({v,...planVersion(bytes,{ticketIndex:o.ticketIndex})}));
 const report={mode:o.execute?'EJECUCION':'DRY-RUN (sin escritura)',versions:plans.map(p=>({key:p.v.key,rank:p.v.rank,sha256_prefix:p.v.sha256.slice(0,8),...p.summary}))};
 if(plans.some(p=>p.summary.max_batch>250||p.summary.rejected>0))fail('PLAN_INVALID',{report});
 if(!UUID.test(o.connectionId))fail('INVALID_CONNECTION');
 if(!o.execute){
  if(o.receiptsDir&&existsSync(path.join(o.receiptsDir,'recibo.jsonl'))){
   const done=new Set(readFileSync(path.join(o.receiptsDir,'recibo.jsonl'),'utf8').split('\n').filter(Boolean).map(l=>{try{return JSON.parse(l);}catch{return {};}}).filter(r=>r.status==='ok').map(r=>r.step));
   report.receipt_steps_done=done.size;
  }
  return report;
 }
 assertProject(o.projectRefFile);
 const work=mkdtempSync(path.join(o.workBase??os.tmpdir(),'tracker-carga-'));
 const sh=(file)=>runSqlFile(sqlCmd,file);
 const runText=(name,sql)=>{const f=path.join(work,name);writeFileSync(f,sql,{mode:0o600});const r=sh(f);rmSync(f,{force:true});return r;};
 try{
  const g=runText('guard.sql',guardSql(o.tenant));const gp=g.ok?parseGuard(g.out):{ok:false,reason:'GUARD_QUERY_FAILED'};
  if(!gp.ok)fail(gp.reason,{report});
  report.guard={project_ref:PROJECT_REF,migration_0052:true,tenant_found:true,role_bypasses_rls:true};
  // La conexión del Tracker es única por (tenant,'xlsx',cuenta del Tracker en la config local): si ya existe se reutiliza su id (los ids de versión derivan de ella).
  const cr=runText('conn.sql',connSql(o.tenant));const existing=cr.ok?parseConn(cr.out):undefined;
  if(existing===undefined)fail('CONNECTION_QUERY_FAILED',{report});
  const connectionId=existing??o.connectionId;report.connection_reused=!!existing;
  const manifest={tenant:o.tenant,connection:connectionId,project:PROJECT_REF,versions:versions.map(v=>v.sha256),ticket_index_sha256:o.ticketIndexSha??null};
  const rc=new Receipts(o.receiptsDir,manifest);
  let filesRun=0;report.executed=[];
  for(const p of plans){
   const vid=versionId(connectionId,p.v.sha256),dir=path.join(work,`${String(p.v.rank).padStart(2,'0')}-${p.v.key}`);
   const em=emitVersionSql({workbook:p.wb,version:p.v,tenantId:o.tenant,connectionId,dir,ticketIndex:o.ticketIndex});
   const st=runText('state.sql',stateSql(o.tenant,vid));const state=st.ok?parseState(st.out):null;
   if(!state)fail('STATE_QUERY_FAILED',{version:p.v.key});
   const prefixSheet=new Map(p.jobs.map((j,i)=>[String(i+1).padStart(2,'0')+'-',j.sheet]));
   const agg={files:0,skipped:0,inserted:0,revised:0,unchanged:0,replay:0};
   for(const f of em.files){
    const step=`${p.v.key}/${f}`;
    if(rc.has(step)){agg.skipped++;continue;}
    const sheet=prefixSheet.get(f.slice(0,3));
    if(sheet&&state.closed.has(sheet)){agg.skipped++;rc.add({step,status:'ok',note:'sheet_closed_remote'});continue;} // ya cerrada: sus lotes no se repiten
    if(o.maxFiles!=null&&filesRun>=o.maxFiles){report.stopped_at=step;report.executed.push({...agg,key:p.v.key,partial:true});return finish(report,work,o);}
    const r=sh(path.join(dir,f));
    if(!r.ok){rc.add({step,status:'error',errors:r.errors});fail('BATCH_FAILED',{step,errors:r.errors,report});}
    const s=batchStats(r.out);for(const k of ['inserted','revised','unchanged','replay'])agg[k]+=s[k]??0;
    rc.add({step,status:'ok',stats:s,bytes:statSync(path.join(dir,f)).size});filesRun++;agg.files++;
    if(!o.keepSql)rmSync(path.join(dir,f),{force:true}); // contiene datos de clientes
   }
   const vr=runText('verify.sql',verifySql(o.tenant,vid));const vv=vr.ok?parseVerify(vr.out):null;
   const exp=p.summary.rows;
   if(!vv||vv.obs+vv.rej!==exp||vv.closed!==p.summary.sheets||vv.jobs!==p.summary.sheets)fail('VERIFY_FAILED',{version:p.v.key,expected:{rows:exp,sheets:p.summary.sheets},got:vv,report});
   rc.add({step:`${p.v.key}/verify`,status:'ok',verify:vv});
   report.executed.push({key:p.v.key,...agg,verified:{obs:vv.obs,rej:vv.rej,closed:vv.closed,heads_tenant:vv.heads}});
  }
  return finish(report,work,o);
 }catch(e){e.report??=report;rmSync(work,{recursive:true,force:true});throw e;}
}
function finish(report,work,o){rmSync(work,{recursive:true,force:true});return report;}
