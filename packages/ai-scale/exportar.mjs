#!/usr/bin/env node
// Exporta la cohorte (SOLO LECTURA) a un JSONL local, ya REDACTADO. Pensado como script `!` de Javier: el contenido real
// nunca pasa por el chat. Por defecto es DRY-RUN: muestra el SQL de la primera página y no ejecuta nada.
//   node exportar.mjs --from 2026-07-01 --to 2026-11-01 --basis first [--out DIR] [--run]
// Guardas: proyecto y tenant fijos (se rechaza cualquier otro valor); el SQL generado se verifica sin palabras de escritura.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {exportarPagina,taxonomia,TENANT,PROJECT_REF,WRITE_WORDS} from './sql.mjs';
import {redact} from './preprocess.mjs';
import {intOpt} from './cli-util.mjs';
import {resolveCsv,createStorageGet,sweepTemp,installCleanup,safeErr} from './exportar-csv.mjs';
import {csvMensajesPagina,importsMeta} from './sql.mjs';

const args=process.argv.slice(2);const flag=n=>args.includes('--'+n);const opt=(n,d)=>{const i=args.indexOf('--'+n);return i>=0?args[i+1]:d;};
const DEFAULT_OUT=path.join(os.homedir(),'.codex-work/rovaq-cierre-20261007/ia-escala-20261019/cohorte');
export function parseRows(stdout){ // tolera {rows:[...]}, [...] o {result:[...]}
  let j;try{j=JSON.parse(stdout);}catch{throw Error('salida de supabase no es JSON');}
  const rows=Array.isArray(j)?j:Array.isArray(j?.rows)?j.rows:Array.isArray(j?.result)?j.result:Array.isArray(j?.data)?j.data:null;
  if(!rows)throw Error('forma de salida desconocida');return rows;
}
export function groupRows(rows,{doRedact=true,stats=null}={}){ // filas por mensaje -> conversaciones {conversation_id, first_at, last_at, messages[]}
  const by=new Map(),seen=new Set();
  for(const r of rows){
    if(seen.has(r.message_id)){if(stats)stats.duplicados=(stats.duplicados??0)+1;continue;} // NUNCA el mismo mensaje dos veces
    seen.add(r.message_id);if(stats&&Number(r.n_rows)>1)stats.varias_filas=(stats.varias_filas??0)+1;
    if(typeof r.text!=='string'||!r.text.trim())continue;
    if(r.payload_role&&r.payload_role!==r.role)continue; // mismo control que source-reader (rol del payload = rol de la revisión)
    let c=by.get(r.conversation_id);if(!c){c={conversation_id:r.conversation_id,messages:[]};by.set(r.conversation_id,c);}
    c.messages.push({id:r.message_id,revision_id:r.revision_id,role:r.role,at:r.at,text:doRedact?redact(r.text):r.text});
  }
  return [...by.values()].map(c=>({...c,first_at:c.messages[0]?.at??null,last_at:c.messages.at(-1)?.at??null}));
}
export function extractTaxonomy(stdout){
  const rows=parseRows(stdout);let t=rows[0]?.taxonomy;if(typeof t==='string')t=JSON.parse(t);
  if(!Array.isArray(t)||!t.length||t.length>100||t.some(x=>typeof x!=='string'||!x||x.length>80)||new Set(t).size!==t.length)throw Error('taxonomía inválida o ausente');return t;
}
function runSqlCli(ref,out){ // ejecuta SQL de solo lectura con la CLI de supabase y devuelve filas (stderr jamás se imprime)
  return async sql=>{if(WRITE_WORDS.test(sql.split('\n').filter(l=>!l.trim().startsWith('--')).join('\n')))throw Error('el SQL contiene palabras de escritura');
    const tmp=path.join(out,'.q.sql');fs.writeFileSync(tmp,sql,{mode:0o600});
    const r=spawnSync('supabase',['db','query','--linked','--project-ref',ref,'-f',tmp,'-o','json'],{encoding:'utf8',maxBuffer:512*1024*1024});
    try{fs.unlinkSync(tmp);}catch{}
    if(r.status!==0)throw Error('supabase db query falló (código '+r.status+')');return parseRows(r.stdout);};
}
export async function exportCsvCli({o,ref,out,run}){
  const envFile=opt('storage-env',path.join(os.homedir(),'.vexa-storage.env'));
  if(!run){console.log(`DRY-RUN csv. Leería metadatos (SQL de solo lectura) y objetos de Storage por GET con la llave de ${path.basename(envFile)} (host verificado contra el proyecto ${ref}). Sin caché en disco: un objeto a la vez en memoria. Use --run.`);return;}
  fs.mkdirSync(out,{recursive:true,mode:0o700});
  sweepTemp(out);const uninstall=installCleanup(out);
  try{
    const storageGet=createStorageGet({envFile,projectRef:ref,tenant:o.tenant});
    const {convs,report}=await resolveCsv({runSql:runSqlCli(ref,out),storageGet,win:o,tenant:o.tenant,maxConv:intOpt(args,'max',Infinity),log:m=>process.stdout.write(m+'\n')});
    const file=path.join(out,'entrada-csv.jsonl');fs.writeFileSync(file,convs.map(c=>JSON.stringify(c)).join('\n')+(convs.length?'\n':''),{mode:0o600});
    fs.writeFileSync(path.join(out,'estadisticas-medidas-csv.json'),JSON.stringify(report.estadisticas_medidas,null,1),{mode:0o600});
    fs.writeFileSync(path.join(out,'recibo-exportacion-csv.json'),JSON.stringify({...report,ts:new Date().toISOString()},null,1),{mode:0o600});
    console.log('RESUMEN csv (solo conteos):',JSON.stringify(report));console.log(`LISTO: ${convs.length} conversaciones csv -> ${file} (texto ya redactado; no lo comparta ni lo suba a git).`);
  }catch(e){throw Error(safeErr(e));}
  finally{uninstall();sweepTemp(out);}
}
export async function main(){
  if(flag('taxonomia')){ // lee la taxonomía vigente (solo lectura) y la guarda en taxonomia.json
    const ref0=opt('project-ref',PROJECT_REF);if(ref0!==PROJECT_REF)throw Error('proyecto no autorizado');
    const out0=opt('out',DEFAULT_OUT);fs.mkdirSync(out0,{recursive:true,mode:0o700});const f=path.join(out0,'.tax.sql');fs.writeFileSync(f,taxonomia());
    const r=spawnSync('supabase',['db','query','--linked','--project-ref',ref0,'-f',f,'-o','json'],{encoding:'utf8'});if(r.status!==0)throw Error('supabase db query falló');
    const t=extractTaxonomy(r.stdout);fs.writeFileSync(path.join(out0,'taxonomia.json'),JSON.stringify(t,null,1));fs.rmSync(f,{force:true});console.log(`taxonomia.json guardada (${t.length} categorías)`);return;}
  const o={from:opt('from'),to:opt('to'),basis:opt('basis','first'),tenant:opt('tenant',TENANT)};
  const ref=opt('project-ref',PROJECT_REF);
  if(ref!==PROJECT_REF)throw Error('proyecto no autorizado');
  if(o.tenant!==TENANT)throw Error('tenant no autorizado');
  const out=opt('out',DEFAULT_OUT);const limit=intOpt(args,'limit',200);const maxConv=intOpt(args,'max',Infinity);
  const fuente=opt('fuente','todas');if(!['todas','hubspot','csv'].includes(fuente))throw Error('--fuente: todas|hubspot|csv');
  if(fuente==='csv'){await exportCsvCli({o,ref,out,run:flag('run')});return;}
  const sql0=exportarPagina(o,{limit});
  if(WRITE_WORDS.test(sql0.split('\n').filter(l=>!l.trim().startsWith('--')).join('\n')))throw Error('el SQL contiene palabras de escritura');
  if(!flag('run')){console.log(`DRY-RUN. Proyecto ${ref}, tenant ${o.tenant}, ventana [${o.from}, ${o.to}) por ${o.basis} mensaje. SQL de la 1a página (${sql0.length} car.) verificado de solo lectura. Use --run para ejecutar.`);if(fuente==='todas')await exportCsvCli({o,ref,out,run:false});return;}
  fs.mkdirSync(out,{recursive:true,mode:0o700});
  const file=path.join(out,'entrada.jsonl'),cursorFile=path.join(out,'entrada.cursor');
  let after=fs.existsSync(cursorFile)?fs.readFileSync(cursorFile,'utf8').trim()||null:null;let nConv=0,nMsg=0;const hstats={};
  for(;;){
    const sql=exportarPagina(o,{after,limit});const tmp=path.join(out,'.page.sql');fs.writeFileSync(tmp,sql,{mode:0o600});
    const r=spawnSync('supabase',['db','query','--linked','--project-ref',ref,'-f',tmp,'-o','json'],{encoding:'utf8',maxBuffer:512*1024*1024});
    if(r.status!==0)throw Error('supabase db query falló (código '+r.status+')'); // no se imprime stderr: podría contener contenido
    const rows=parseRows(r.stdout);const pageLast=rows.find(x=>x.sentinel===true)?.conversation_id??null;
    if(!pageLast)break;
    const convs=groupRows(rows.filter(x=>x.sentinel!==true),{stats:hstats});
    if(convs.length)fs.appendFileSync(file,convs.map(c=>JSON.stringify(c)).join('\n')+'\n',{mode:0o600});
    after=pageLast;fs.writeFileSync(cursorFile,after,{mode:0o600});
    nConv+=convs.length;nMsg+=convs.reduce((a,c)=>a+c.messages.length,0);
    process.stdout.write(`exportadas ${nConv} conversaciones, ${nMsg} mensajes\n`);
    if(nConv>=maxConv)break;
  }
  try{fs.unlinkSync(path.join(out,'.page.sql'));}catch{}
  console.log(`LISTO: ${nConv} conversaciones, ${nMsg} mensajes -> ${file} (texto ya redactado; no lo comparta ni lo suba a git).`);
  fs.writeFileSync(path.join(out,'recibo-exportacion-hubspot.json'),JSON.stringify({conversaciones:nConv,mensajes:nMsg,duplicados_descartados:hstats.duplicados??0,mensajes_con_varias_filas:hstats.varias_filas??0,ts:new Date().toISOString()},null,1),{mode:0o600});
  if(fuente==='todas')await exportCsvCli({o,ref,out,run:true});
}
if(import.meta.url===`file://${process.argv[1]}`)main().catch(e=>{console.error('ERROR',String(e.message).slice(0,200));process.exit(1);});
