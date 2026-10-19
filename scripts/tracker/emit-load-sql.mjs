// Prepara (NO ejecuta) la carga real del Tracker: SQL por lote + RUN.sh reanudable. Uso:
//   node emit-load-sql.mjs --tenant <uuid> --out <carpeta privada> [--connection <uuid>] [--only recibida,v06,v07a,v07b]
import {readFileSync,writeFileSync,mkdirSync,chmodSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {readWorkbook,emitVersionSql} from '../../packages/ingestion/tracker/index.mjs';
const arg=(k,d)=>{const i=process.argv.indexOf('--'+k);return i>0?process.argv[i+1]:d;};
const tenant=arg('tenant'),out=arg('out'),root=arg('root',path.join(process.env.HOME,'Desktop/rovaq ai'));
if(!tenant||!out){console.error('Uso: --tenant <uuid> --out <carpeta> [--connection <uuid>] [--only a,b]');process.exit(2);}
const connection=arg('connection',(()=>{const h=createHash('sha256').update('tracker-connection|'+tenant).digest('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;})());
const VERSIONS=[
 {key:'recibida',rank:1,file:'01 Documentos recibidos/CLIENTEX Tracker V2.xlsx',sha256:'ab12cd34',received_at:null},
 {key:'v06',rank:2,file:'06 Tracker original y versiones/CLIENTEX Tracker V2 - 20261005T2312Z.xlsx',sha256:'ab12cd34',received_at:'2026-10-05T23:12:00Z'},
 {key:'v07a',rank:3,file:'07 Actualizaciones de fuentes/20261005T231800827506Z/CLIENTEX Tracker V2.xlsx',sha256:'ab12cd34',received_at:'2026-10-05T23:18:00Z'},
 {key:'v07b',rank:4,file:'07 Actualizaciones de fuentes/20261005T232014403866Z/CLIENTEX Tracker V2.xlsx',sha256:'ab12cd34',received_at:'2026-10-05T23:20:14Z'}];
const only=arg('only')?.split(',');let tickets=null;if(arg('ticket-index'))tickets=new Set(readFileSync(arg('ticket-index'),'utf8').split(/\s+/).filter(Boolean));
mkdirSync(out,{recursive:true,mode:0o700});const run=['#!/bin/bash','# Reanudable: salta lo ya hecho (done.list) y se detiene en el primer error.','set -euo pipefail','cd "$(dirname "$0")"','touch done.list'];
for(const v of VERSIONS){
 if(only&&!only.includes(v.key))continue;
 const bytes=readFileSync(path.join(root,v.file));
 if(createHash('sha256').update(bytes).digest('hex')!==v.sha256){console.error('HASH_MISMATCH '+v.key);process.exit(1);}
 const dir=`${String(v.rank).padStart(2,'0')}-${v.key}`;
 const r=emitVersionSql({workbook:readWorkbook(new Uint8Array(bytes)),version:v,tenantId:tenant,connectionId:connection,dir:path.join(out,dir),ticketIndex:tickets});
 for(const f of r.files)run.push(`f="${dir}/${f}"; grep -qxF "$f" done.list || { echo "$f"; supabase db query --linked -f "$f" >/dev/null && echo "$f" >> done.list; }`);
 console.log(JSON.stringify({version:v.key,files:r.files.length,sheets:r.jobs.length}));
}
writeFileSync(path.join(out,'RUN.sh'),run.join('\n')+'\n');chmodSync(path.join(out,'RUN.sh'),0o700);
