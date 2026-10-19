// Carga por lotes del Tracker. DRY-RUN por defecto (solo lee los XLSX y cuenta); --execute escribe vía el ejecutor SQL.
// Uso: node load-tracker.mjs --tenant <uuid> [--only v07b|recibida,v06,v07a,v07b] [--ticket-index ids.txt] [--root <rovaq ai>]
//        [--receipts <dir>] [--execute] [--max-files N] [--keep-sql] [--sql-cmd "supabase db query --linked -f"] [--project-ref-file f]
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {loadTracker,VERSIONS,DEFAULT_SQL_CMD,sha256Bytes} from '../../packages/ingestion/tracker/loader.mjs';
const here=path.dirname(new URL(import.meta.url).pathname),repo=path.resolve(here,'../..');
const arg=(k,d)=>{const i=process.argv.indexOf('--'+k);return i>0?process.argv[i+1]:d;};
const flag=k=>process.argv.includes('--'+k);
const tenant=arg('tenant');
if(!tenant){console.error('Uso: --tenant <uuid> [--only a,b] [--ticket-index ids.txt] [--receipts dir] [--execute] [--max-files N] [--keep-sql]');process.exit(2);}
const root=arg('root',path.join(process.env.HOME,'Desktop/rovaq ai'));
const only=arg('only')?.split(',');
if(only&&only.some(k=>!VERSIONS.some(v=>v.key===k))){console.error('--only desconocido');process.exit(2);}
const versions=VERSIONS.filter(v=>!only||only.includes(v.key));
let ticketIndex=null,ticketIndexSha=null;
if(arg('ticket-index')){const b=readFileSync(arg('ticket-index'));ticketIndexSha=sha256Bytes(b);ticketIndex=new Set(b.toString('utf8').split(/\s+/).filter(Boolean));}
const connectionId=arg('connection',(()=>{const h=createHash('sha256').update('tracker-connection|'+tenant).digest('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;})());
const receiptsDir=arg('receipts',path.join(process.env.HOME,'.codex-work/rovaq-cierre-20261007/tracker-adjuntos-carga-20261019/tracker-recibos'));
const sqlCmd=arg('sql-cmd')?arg('sql-cmd').split(/\s+/).filter(Boolean):DEFAULT_SQL_CMD;
try{
 const rep=await loadTracker({root,tenant,connectionId,versions,ticketIndex,ticketIndexSha,receiptsDir,sqlCmd,execute:flag('execute'),
  maxFiles:arg('max-files')!=null?Number(arg('max-files')):null,keepSql:flag('keep-sql'),projectRefFile:arg('project-ref-file',path.join(repo,'supabase/.temp/project-ref'))});
 console.log(JSON.stringify({ok:true,ticket_index:ticketIndex?{ids:ticketIndex.size,sha256_prefix:ticketIndexSha.slice(0,8)}:null,...rep},null,1));
}catch(e){
 console.error(JSON.stringify({ok:false,code:e.code??'ERROR',message:e.code?undefined:String(e.message).slice(0,200),step:e.step,errors:e.errors,expected:e.expected,got:e.got,version:e.version,field:e.field,file:e.file,os:e.os,report:e.report},null,1));
 process.exit(1);
}
