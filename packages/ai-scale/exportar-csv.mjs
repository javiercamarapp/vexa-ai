// Resolución del texto de conversaciones de fuente csv: el texto NO está en la base; vive en el archivo importado (Storage, bucket
// privado). Ruta de lectura, idéntica a packages/intelligence/source-reader.mjs:
//   message_revisions.text_ref -> import_rows.payload_ref (import_id, row_ref=línea) -> imports.object_path (objeto en Storage)
//   -> recordsFromBytes(bytes,row) (packages/jobs/durable/records.mjs) -> registro cuyo row_ref coincide -> raw_payload.{text,role}
//   -> contentHash(raw_payload) debe ser igual a message_revisions.hash.
// SOLO lecturas: SQL de solo lectura + HTTP GET a Storage. La llave se lee del archivo, nunca se imprime ni se registra.
import fs from 'node:fs';
import path from 'node:path';
import {recordsFromBytes} from '../jobs/durable/records.mjs';
import {contentHash} from '../ingestion/index.mjs';
import {csvMensajesPagina,importsMeta,TENANT,PROJECT_REF} from './sql.mjs';
import {redact} from './preprocess.mjs';
import {scrub} from './openrouter.mjs';

export const BUCKET='vexa-private';
export function createStorageGet({envFile,fetchImpl=globalThis.fetch,projectRef=PROJECT_REF,tenant=TENANT,timeoutMs=60000}){
  const env=Object.fromEntries(fs.readFileSync(envFile,'utf8').split('\n').map(l=>/^([A-Z_]+)=(.*)$/.exec(l)).filter(Boolean).map(m=>[m[1],m[2].trim().replace(/^["']|["']$/g,'')]));
  if(!env.SUPABASE_URL||!env.SUPABASE_SERVICE_KEY)throw Error('storage env incompleto');
  const host=new URL(env.SUPABASE_URL).hostname;
  if(host!==`${projectRef}.supabase.co`)throw Error('el host de Storage no corresponde al proyecto autorizado'); // verificación por host; no se imprime la URL
  const base=`https://${host}/storage/v1/object/${BUCKET}/`;
  return async function get(objectPath){
    if(typeof objectPath!=='string'||!objectPath.startsWith(tenant+'/imports/')||objectPath.includes('..'))throw Error('ruta de objeto fuera del tenant');
    const res=await fetchImpl(base+objectPath.split('/').map(encodeURIComponent).join('/'),{method:'GET',redirect:'error',headers:{Authorization:'Bearer '+env.SUPABASE_SERVICE_KEY,apikey:env.SUPABASE_SERVICE_KEY},signal:AbortSignal.timeout(timeoutMs)});
    if(res.status===404||res.status===400)return null;
    if(!res.ok)throw Error('storage http '+res.status);
    return new Uint8Array(await res.arrayBuffer());
  };
}

// SIN caché en disco: cada objeto se descarga a memoria, se parsea, se redacta y se descarta antes de pasar al siguiente.
// Archivos temporales que sí existen (SQL de consultas, sin texto): se barren al inicio y en SIGINT/SIGTERM.
export const TEMP_NAMES=['.q.sql','.page.sql','.tax.sql','.cache-storage'];
export function sweepTemp(dir){for(const n of TEMP_NAMES)try{fs.rmSync(path.join(dir,n),{recursive:true,force:true});}catch{}}
export function installCleanup(dir,{exit=code=>process.exit(code)}={}){
  const h=sig=>()=>{sweepTemp(dir);exit(sig==='SIGINT'?130:143);};const hi=h('SIGINT'),ht=h('SIGTERM');
  process.on('SIGINT',hi);process.on('SIGTERM',ht);return()=>{process.off('SIGINT',hi);process.off('SIGTERM',ht);};
}

const pct=(a,p)=>{if(!a.length)return null;const s=[...a].sort((x,y)=>x-y);return s[Math.min(s.length-1,Math.floor(p*s.length))];};
// runSql(sql) -> filas. storageGet(path) -> Uint8Array|null.
export async function resolveCsv({runSql,storageGet,win,tenant=TENANT,pageSize=300,maxConv=Infinity,doRedact=true,log=()=>{}}){
  // 1) metadatos de mensajes por páginas (keyset por conversación)
  const msgs=new Map(),convMeta=new Map(),seenMsg=new Set();let after=null,nConv=0,dupMsgs=0,dupRowsMsgs=0;
  for(;;){
    const rows=await runSql(csvMensajesPagina(win,{after,limit:pageSize}));
    const last=rows.find(r=>r.sentinel===true)?.conversation_id;if(!last)break;
    for(const r of rows){if(r.sentinel===true)continue;
      if(seenMsg.has(r.message_id)){dupMsgs++;continue;} // NUNCA el mismo mensaje dos veces
      seenMsg.add(r.message_id);if(Number(r.n_rows)>1)dupRowsMsgs++;
      if(!msgs.has(r.conversation_id)){msgs.set(r.conversation_id,[]);convMeta.set(r.conversation_id,r.source);nConv++;}
      msgs.get(r.conversation_id).push(r);}
    after=last;log(`metadatos: ${msgs.size} conversaciones`);if(msgs.size>=maxConv)break;
  }
  const duplicados={mensajes_con_varias_import_rows:dupRowsMsgs,filas_repetidas_descartadas:dupMsgs};
  // 2) imports necesarios
  const need=new Map(); // import_id -> [{conv,msg}]
  for(const [cid,list] of msgs)for(const m of list)if(m.import_id)(need.get(m.import_id)??need.set(m.import_id,[]).get(m.import_id)).push({cid,m});
  const importIds=[...need.keys()].sort(),meta=new Map();
  for(let i=0;i<importIds.length;i+=100)for(const r of await runSql(importsMeta(importIds.slice(i,i+100),{tenant})))meta.set(r.import_id,r);
  // 3) texto por import (descarga -> caché -> parseo con el lector de producción)
  const text=new Map(),bad=new Map(); // message_id -> texto redactado | razón
  const imp={objetos:importIds.length,descargados:0,ausentes:0,error_archivo:0,error_mapeo:0,sin_metadatos:0,bytes_descargados:0,memoria_pico_bytes:0};
  for(const id of importIds){
    const items=need.get(id),mt=meta.get(id);
    const failAll=reason=>{for(const {m} of items)bad.set(m.message_id,reason);};
    if(!mt||!mt.object_path){imp.sin_metadatos++;failAll('sin_metadatos_import');continue;}
    let bytes;
    try{bytes=await storageGet(mt.object_path);}catch(e){imp.error_archivo++;failAll('error_descarga');continue;}
    if(!bytes){imp.ausentes++;failAll('objeto_ausente');continue;}
    imp.descargados++;imp.bytes_descargados+=bytes.length;imp.memoria_pico_bytes=Math.max(imp.memoria_pico_bytes,bytes.length);
    let records;
    try{records=await recordsFromBytes(bytes,{size:mt.size,file_hash:mt.file_hash,provenance:mt.provenance,mapping_version:mt.mapping_version,content_type:mt.content_type,tenant_id:mt.tenant_id,connection_id:mt.connection_id,source:mt.source,account_id:mt.account_id,created_at:mt.created_at});}
    catch(e){if(e.code==='INPUT_HASH_MISMATCH')imp.error_archivo++;else imp.error_mapeo++;failAll(e.code==='INPUT_HASH_MISMATCH'?'hash_archivo':'error_mapeo');bytes=null;continue;}
    const byRef=new Map(records.filter(r=>r.raw_payload).map(r=>[String(r.row_ref),r.raw_payload]));
    for(const {m} of items){
      const p=byRef.get(String(m.row_ref));
      if(!p){bad.set(m.message_id,'sin_payload_en_archivo');continue;}
      if(m.rev_hash&&contentHash(p)!==m.rev_hash){bad.set(m.message_id,'hash_distinto');continue;}
      if(p.role!==m.role){bad.set(m.message_id,'rol_distinto');continue;}
      if(typeof p.text!=='string'||!p.text.trim()){bad.set(m.message_id,'vacio');continue;}
      text.set(m.message_id,{t:doRedact?redact(p.text):p.text,raw:p.text.length});
    }
    bytes=null; // se descarta antes del siguiente objeto (un objeto a la vez en memoria)
  }
  // 4) ensamblado: una conversación sale solo si TODOS sus mensajes (no vacíos) se resolvieron
  const convs=[],rep={conversaciones:{total:msgs.size,resueltas:0,no_resueltas:0},no_resueltas_por_causa:{},mensajes:{total:0,resueltos:0,vacios:0,sin_payload:0,otros_no_resueltos:0},imports:imp,duplicados,por_fuente:{}};
  const chars=[],nm=[];
  for(const [cid,list] of msgs){
    rep.mensajes.total+=list.length;let reason=null,empty=0;
    for(const m of list){
      if(!m.import_id){rep.mensajes.sin_payload++;reason??='sin_payload';continue;}
      const b=bad.get(m.message_id);
      if(b==='vacio'){empty++;rep.mensajes.vacios++;continue;}
      if(b){rep.mensajes.otros_no_resueltos++;reason??=b;continue;}
      rep.mensajes.resueltos++;
    }
    const src=convMeta.get(cid)??'csv';const ps=rep.por_fuente[src]??={conversaciones:0,resueltas:0,no_resueltas:0};ps.conversaciones++;
    if(reason){rep.conversaciones.no_resueltas++;ps.no_resueltas++;rep.no_resueltas_por_causa[reason]=(rep.no_resueltas_por_causa[reason]??0)+1;continue;}
    const ms=list.filter(m=>text.has(m.message_id)).map(m=>({id:m.message_id,revision_id:m.revision_id,role:m.role,at:m.at,text:text.get(m.message_id).t}));
    if(!ms.length){rep.conversaciones.no_resueltas++;ps.no_resueltas++;rep.no_resueltas_por_causa.sin_texto=(rep.no_resueltas_por_causa.sin_texto??0)+1;continue;}
    rep.conversaciones.resueltas++;ps.resueltas++;
    chars.push(list.reduce((s,m)=>s+(text.get(m.message_id)?.raw??0),0));nm.push(ms.length);
    convs.push({conversation_id:cid,source:src,first_at:ms[0].at,last_at:ms.at(-1).at,messages:ms});
  }
  rep.estadisticas_medidas={conversations:convs.length,msgs_mean:nm.length?+(nm.reduce((a,b)=>a+b,0)/nm.length).toFixed(2):null,msgs_p50:pct(nm,.5),msgs_p90:pct(nm,.9),chars_mean:chars.length?Math.round(chars.reduce((a,b)=>a+b,0)/chars.length):null,chars_p50:pct(chars,.5),chars_p90:pct(chars,.9)};
  return{convs,report:rep};
}
export const safeErr=e=>scrub(e?.message).slice(0,160);
