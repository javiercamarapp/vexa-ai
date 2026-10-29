// Validación SIN ESCRITURA del Tracker: lee los XLSX (solo lectura), compara con los recibos y simula la ingesta en memoria.
// Imprime solo agregados (conteos, hashes, nombres de hoja). No abre red, base de datos ni escribe archivos.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {exigirVersionesTracker,configPiloto} from '../../config/cliente-piloto.mjs';
import {readWorkbook,manifest,ingestVersion,TrackerLedgerRepository,TrackerLedger,planWorkbook} from '../../packages/ingestion/tracker/index.mjs';
const arg=(k,d)=>{const i=process.argv.indexOf('--'+k);return i>0?process.argv[i+1]:d;};
const ROOT=arg('root',path.join(process.env.HOME,'Desktop/rovaq ai'));
const P={
 versions:exigirVersionesTracker(), // rango ascendente = orden de recepción; la última manda. Nombres y huellas: config local del cliente piloto
 receipt:'06 Tracker original y versiones/comparacion-version-recibida.json',
 verification:'07 Actualizaciones de fuentes/20261005T232014403866Z/verificacion.json'};
const checks=[],unverifiable=[];
const check=(name,ok,detail)=>{checks.push({name,ok:!!ok,...(detail!==undefined?{detail}:{})});};
function load(rel){
 try{return readFileSync(path.join(ROOT,rel));}
 catch(e){if(['EDEADLK','EPERM','EACCES','ENOENT','EIO','ETIMEDOUT'].includes(e.code)){unverifiable.push({file:path.basename(rel),code:e.code});return null;}throw e;}
}
const sha=b=>createHash('sha256').update(b).digest('hex');
const receiptBytes=load(P.receipt),verifBytes=load(P.verification);
const receipt=receiptBytes&&JSON.parse(receiptBytes),verif=verifBytes&&JSON.parse(verifBytes);
const chosen=P.versions.at(-1);
if(verif)check('hash completo del elegido = verificacion.json',verif.tracker.sha256===chosen.sha256,chosen.sha256.slice(0,8)+'…'+chosen.sha256.slice(-7));
let tickets=null;const ti=arg('ticket-index');if(ti)tickets=new Set(readFileSync(ti,'utf8').split(/\s+/).filter(Boolean));
const ledger=new TrackerLedger(),repo=new TrackerLedgerRepository(ledger),manifests={},ingest={};
for(const v of P.versions){
 const b=load(v.file);if(!b){check(`versión ${v.key} legible`,false,'no verificable');continue;}
 check(`sha256 ${v.key} = esperado`,sha(b)===v.sha256,v.sha256.slice(0,8));
 const wb=readWorkbook(new Uint8Array(b));
 const m=manifest(wb,{version:{key:v.key,sha256:v.sha256,rank:v.rank},ticketIndex:tickets});manifests[v.key]=m;
 check(`${v.key}: lotes <=250 y 0 rechazos`,m.sheets.every(s=>s.maxBatch<=250)&&m.total.rejected===0,{maxBatch:Math.max(...m.sheets.map(s=>s.maxBatch)),rejected:m.total.rejected});
 const r=await ingestVersion({repo,workbook:wb,version:{sha256:v.sha256,label:v.key,rank:v.rank},ticketIndex:tickets});
 ingest[v.key]={inserted:r.sheets.reduce((a,s)=>a+s.inserted,0),revised:r.sheets.reduce((a,s)=>a+s.revised,0),unchanged:r.sheets.reduce((a,s)=>a+s.unchanged,0),allClosed:r.sheets.every(s=>s.closed)};
 check(`${v.key}: todas las hojas cierran (aceptadas+rechazadas = filas del archivo)`,ingest[v.key].allClosed);
 // idempotencia: reaplicar los mismos lotes no cambia nada
 const before=ledger.revisionCount;let replay=0;for(const j of planWorkbook(wb,{ticketIndex:tickets}))for(const bt of j.batches)replay+=ledger.applyBatch(v.sha256,bt.rows).replay;
 check(`${v.key}: reintento idempotente`,ledger.revisionCount===before&&replay===m.total.rows,{replay});
}
// Equivalencia con el recibo comparacion-version-recibida.json (que corresponde a la versión de 06, no a la elegida).
const cmp=(mk)=>{const m=manifests[mk];if(!m||!receipt)return null;const diffs=[];for(const r of receipt){const s=m.sheets.find(x=>x.sheet===r.sheet);if(!s||s.nonemptyRows!==r.nonemptyRows||s.nonemptyCells!==r.nonemptyCells||s.state!==r.state)diffs.push({sheet:r.sheet,rowsΔ:s&&s.nonemptyRows-r.nonemptyRows,cellsΔ:s&&s.nonemptyCells-r.nonemptyCells});}return diffs;};
const rcpt={};
for(const k of ['v06','v07b']){const d=cmp(k);if(d)rcpt[k]=d.length?d:'igual';}
if(receipt&&manifests.v06)check('recibo: filas/celdas por hoja (16) = versión de 06',rcpt.v06==='igual',rcpt.v06);
if(receipt&&manifests.v06)check('recibo: totales de filas y celdas (config local trackerRecibo)',!!configPiloto().trackerRecibo&&manifests.v06.total.rows===configPiloto().trackerRecibo.rows&&manifests.v06.total.cells===configPiloto().trackerRecibo.cells);
let changes=null;
if(receipt&&ledger.versions.length===4){
 const at=k=>P.versions.find(v=>v.key===k).sha256;
 const d06=ledger.diff(at('recibida'),at('v06')),dch=ledger.diff(at('recibida'),at('v07b'));
 const want=Object.fromEntries(receipt.filter(r=>r.changedCells).map(r=>[r.sheet,r.changedCells]));
 check('recibo: 1,166 celdas cambiadas recibida->06, por hoja',d06.changedCells===1166&&JSON.stringify(d06.perSheet)===JSON.stringify(Object.fromEntries(Object.entries(want).filter(([k])=>k in d06.perSheet)))||(d06.changedCells===1166&&Object.entries(want).every(([k,v])=>d06.perSheet[k]===v)),d06.perSheet);
 changes={recibida_a_06:d06,recibida_a_elegida:dch,v06_a_elegida:ledger.diff(at('v06'),at('v07b')),v07a_a_elegida:ledger.diff(at('v07a'),at('v07b'))};
 check('cabeza = versión elegida (mayor rango) en todas las filas',ledger.heads().every(([,h])=>h.version===chosen.sha256),ledger.heads().length+' filas');
 check('ninguna revisión se perdió (todas legibles)',ledger.revisionCount>=manifests.v07b.total.rows,ledger.revisionCount);
}
const failed=checks.filter(c=>!c.ok);
console.log(JSON.stringify({mode:'DRY-RUN (sin escritura)',chosen:{key:chosen.key,sha256_prefix:chosen.sha256.slice(0,8),manifest:manifests.v07b??null},receipt_vs_versions:rcpt,changes,ingest,revisions:ledger.revisionCount,checks,unverifiable,ok:!failed.length&&!unverifiable.length,writes:repo.writes===undefined?0:'solo memoria'},null,1));
process.exit(failed.length||unverifiable.length?1:0);
