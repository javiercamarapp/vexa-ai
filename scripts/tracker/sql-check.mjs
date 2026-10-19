// Prueba 0052 contra un Postgres local desechable con datos SINTÉTICOS. Uso: node sql-check.mjs <socketdir> <port>
import {spawnSync} from 'node:child_process';
import {randomUUID,createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {buildXlsx} from '../../packages/ingestion/tracker/xlsx-fixture.mjs';
import {readWorkbook,ingestVersion,TrackerSqlRepository,TrackerLedgerRepository,TrackerLedger,planWorkbook} from '../../packages/ingestion/tracker/index.mjs';
const [host,port]=process.argv.slice(2);
const T=randomUUID(),C=randomUUID();
const lit=v=>v===null||v===undefined?'NULL':typeof v==='number'?String(v):`$q$${String(v)}$q$`;
function psql(sql,{asBackend=true}={}){
 const pre=asBackend?`set role vexa_backend; select set_config('vexa.tenant_id','${T}',false);`:'';
 const r=spawnSync('psql',['-X','-q','-A','-t','-h',host,'-p',port,'-d','vexa_test','-v','ON_ERROR_STOP=1'],{input:pre+sql,encoding:'utf8',maxBuffer:1<<28});
 if(r.status!==0)throw Object.assign(new Error((r.stderr.match(/ERROR:\s+([A-Z_]+)/)||[,'SQL'])[1]),{stderr:r.stderr});
 return r.stdout;
}
const s={tenantId:T,query(text,params=[]){
 const sql=text.replace(/\$(\d+)(::\w+)?/g,(_,n,c)=>lit(params[n-1])+(c??''));
 // una sentencia por llamada; set_config imprime una línea que se descarta
 const out=psql(sql).trim().split('\n').filter(Boolean);const last=out.at(-1);
 let row;try{row=/^[\[{]/.test(last??'')?{r:JSON.parse(last)}:last?.includes('|')?{rank:Number(last.split('|')[0]),file_sha256:last.split('|')[1]}:{};}catch{row={};}
 return {rows:text.trim().toUpperCase().startsWith('SELECT')?[row]:[]};
}};
psql(`insert into public.organizations values('${T}');insert into public.connections values('${C}','${T}','xlsx','tracker');`,{asBackend:false});
const sha=x=>createHash('sha256').update(x).digest('hex');
const HEAD=['Requester','Hubspot ID','Request Date','Order ID','Notes'];
const mk=(n,mut={})=>readWorkbook(buildXlsx([{name:'Tools',rows:[HEAD,...Array.from({length:n},(_,i)=>['u'+i,String(10000000000+i),1+i,'O'+i,mut[i]??'n'+i])]},{name:'Oculta',state:'hidden',rows:[HEAD,['a','',1,'x','y']]},{name:'Formulas',rows:[['h'],[{f:'1+1',v:2}],[{emptyV:true}]]}]));
const A=mk(600),B=mk(602,{3:'cambiada',5:'otra'});
const idx=new Set(['10000000001']);
const repo=new TrackerSqlRepository(s,{connectionId:C});
const va={sha256:sha('A'),rank:1,label:'anterior'},vb={sha256:sha('B'),rank:2,label:'mas reciente'};
// dos veces la misma versión: idempotente
const r1=await ingestVersion({repo,workbook:A,version:va,ticketIndex:idx});
const r1b=await ingestVersion({repo,workbook:A,version:va,ticketIndex:idx}).catch(e=>e);
console.log('A primera:',JSON.stringify(r1.sheets.map(x=>[x.sheet,x.inserted,x.batches,x.closed])));
assert.ok(r1b instanceof Error&&r1b.message==='SHEET_JOB_NOT_OPEN','reintento tras cerrar la hoja debe negarse (hoja cerrada)');
const count=q=>Number(psql(q).trim().split('\n').at(-1));
assert.equal(count(`select count(*) from public.tracker_row_revisions`),601+2+3);
const r2=await ingestVersion({repo,workbook:B,version:vb,ticketIndex:idx});
const tools=r2.sheets.find(x=>x.sheet==='Tools');
console.log('B:',JSON.stringify(tools));
assert.equal(tools.inserted,2);assert.equal(tools.revised,2);assert.equal(tools.unchanged,598+1);
assert.equal(count(`select count(*) from public.tracker_row_heads where head_rank=2`),603+2+3);
assert.equal(count(`select count(*) from public.tracker_row_heads where head_rank=1`),0);
assert.equal(count(`select count(*) from public.tracker_row_revisions where ticket_state='linked'`),1);
// la versión anterior aplicada después no mueve la cabeza
const vc={sha256:sha('C'),rank:0};
await ingestVersion({repo,workbook:mk(600,{7:'vieja'}),version:vc});
assert.equal(count(`select count(*) from public.tracker_row_heads where head_rank=0`),0);
// equivalencia con el ledger en memoria
const L=new TrackerLedgerRepository();
await ingestVersion({repo:L,workbook:A,version:va,ticketIndex:idx});const m=await ingestVersion({repo:L,workbook:B,version:vb,ticketIndex:idx});
assert.equal(psql(`select count(*) from public.tracker_row_revisions`).trim().split('\n').at(-1),String(L.ledger.revisionCount+1)); // +1 por la versión C
// permisos: sin UPDATE/DELETE sobre revisiones
for(const q of [`update public.tracker_row_revisions set row_hash=row_hash`,`delete from public.tracker_row_observations`,`update public.tracker_versions set rank=9`]){
 assert.throws(()=>psql(q),e=>/permiso denegado|permission denied/i.test(e.stderr),q);
}
// tamaño de lote
const vid=await repo.ensureVersion(va);
assert.throws(()=>psql(`select public.tracker_ingest_batch('${vid}','Tools','[${Array(251).fill('{"row_number":1}').join(',')}]'::jsonb)`),/BATCH_SIZE_INVALID/);
// otro tenant no ve nada
const other=spawnSync('psql',['-X','-q','-A','-t','-h',host,'-p',port,'-d','vexa_test'],{input:`set role vexa_backend; select set_config('vexa.tenant_id','${randomUUID()}',false); select count(*) from public.tracker_row_revisions;`,encoding:'utf8'}).stdout.trim().split('\n').at(-1);
assert.equal(other,'0');
console.log('SQL OK');
