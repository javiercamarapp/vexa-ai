#!/usr/bin/env node
// Runner de extracción para una cohorte de conversaciones (ventana de fechas). Node >= 20, sin dependencias externas.
//
//  node cohorte.mjs --emit-sql --from 2026-07-01 --to 2026-11-01 --basis first|last [--out DIR]
//  node cohorte.mjs --dry-count --stats ESTADISTICAS.json [--cap-total 30]           # NO llama a la API
//  node cohorte.mjs --fixtures [--limit N]                                           # valida calidad con las 47 fixtures sintéticas (gasta poco)
//  node cohorte.mjs --input entrada.jsonl --taxonomy taxonomia.json --pilot 200 --yes-send-real-text
//  node cohorte.mjs --input entrada.jsonl --taxonomy taxonomia.json --resume --yes-send-real-text
//
// Garantías: texto SIEMPRE redactado antes de enviar; provider fijo + data_collection:'deny'; taskKey idempotente por
// conversación (reanudable sin reenviar); libro de gasto con tope por lote y total (<= US$30 forzado); aborto tras 3 fallos consecutivos.
// QUÉ SE GUARDA DONDE (corregido tras la revisión independiente):
//  - logs y recibos (recibo-*.json, informe-piloto.json): solo conteos, tasas, nombres de categoría e ids. Sin texto.
//  - resultados.jsonl: categoría, severidad, sentimiento, offsets, quote_hash Y `entities[].value`, que es TEXTO LITERAL redactado
//    (nombres de producto, números de pedido cortos) tomado del cliente. Archivo 0600 en disco local; no lo suba a git ni lo comparta.
//  - embeddings.jsonl: vectores (derivados del texto redactado de los mensajes citados), sin texto.
//  - persistir.mjs SÍ escribe texto redactado en la base: message_revisions.redacted_text (mensajes enviados) y
//    extraction_runs.provenance.result (incluye `quote` literal de cada evidencia), igual que el flujo oficial de extracción.
// LÍMITES CONOCIDOS: (1) conversaciones de >40 mensajes se truncan a los 6 PRIMEROS + 34 ÚLTIMOS; además tope de 3800 caracteres por
// mensaje y 24000 por conversación (se omite lo que excede). (2) Se omiten por regla las notificaciones automáticas y los mensajes que
// son solo cita/firma. (3) Riesgo residual ACEPTADO por la autorización de Javier: nombres de personas, direcciones, códigos postales,
// fechas de nacimiento y números escritos con palabras NO se redactan (sin heurísticas frágiles).
// VENTANA: por defecto [2026-07-01, 2026-11-01) = 3.6 meses reales de datos (hasta 19-oct); es parametrizable con FROM/TO/BASIS.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {sha256} from '../intelligence/index.mjs';
import {prepareConversation,learnBoilerplate} from './preprocess.mjs';
import {buildRequest,resolveAndValidate,promptHash,schemaHash} from './compact.mjs';
import {createLedger,BudgetAbort} from './spend.mjs';
import {createClient,scrub} from './openrouter.mjs';
import * as SQL from './sql.mjs';
import {intOpt,moneyOpt} from './cli-util.mjs';

const HERE=path.dirname(fileURLToPath(import.meta.url));
const ROOT=process.env.IA_ESCALA_OUT||path.join(os.homedir(),'.codex-work/rovaq-cierre-20261007/ia-escala-20261019');
export const DEFAULT_MODEL='anthropic/claude-haiku-5.5';
export const EMBED_MODEL='openai/text-embedding-3-small';
// Precios USD/token de Haiku 5.5 en OpenRouter (models-snapshot.json, 18-oct): se usan solo para techos por llamada.
export const PRICES={in:1e-7,out:5e-7,cacheWrite:1.25e-7,cacheRead:1e-8,embed:2e-8};
export const HARD_CAP_USD=30;
export const ALLOWED_MODELS=Object.freeze(['anthropic/claude-haiku-5.5']);
export const ALLOWED_PROVIDERS=Object.freeze(['azure']);
// Costo a registrar: el reportado si es un número finito >= 0; si falta/es inválido y la llamada pudo procesarse (200, 5xx, timeout/red) se cobra el TECHO.
export function bookedCost(reported,status,ceiling){
  const c=typeof reported==='string'&&/^\d+(\.\d+)?(e-?\d+)?$/i.test(reported)?Number(reported):reported;
  if(typeof c==='number'&&Number.isFinite(c)&&c>=0)return Math.min(c,Number.MAX_SAFE_INTEGER);
  return status===200||status===0||status>=500?ceiling:0; // 4xx/429 rechazados antes de procesar: sin cobro
}
// Pies/firmas repetidos: se aprenden UNA vez sobre TODA la entrada (no sobre el piloto) y se congelan en boilerplate.json;
// cohorte (piloto y resto) y persistir leen el mismo archivo, así los task_key coinciden.
export const windowHash=w=>sha256(JSON.stringify({from:w.from,to:w.to,basis:w.basis}));
// Con `cfg` (hash de configuración) se EXIGE coherencia: si boilerplate.json falta teniendo ya resultados, o su configuración/ventana
// difiere, se ABORTA (reaprender en silencio cambiaría los task_key y se reenviaría/cobraría de nuevo).
export function loadOrLearnBoilerplate(outDir,convsAll,{cfg=null,window=null,allowLearn=true}={}){
  const f=path.join(outDir,'boilerplate.json');
  if(fs.existsSync(f)){
    const j=JSON.parse(fs.readFileSync(f,'utf8'));
    if(cfg!==null){
      if(j.config_hash!==cfg)throw Error('boilerplate.json fue congelado con OTRA configuración (modelo/proveedor/taxonomía/prompt/esquema). Abortado para no reenviar ni cobrar de nuevo: restaure la configuración original o archive el directorio de resultados para empezar una cohorte nueva.');
      if(window!==null&&j.window_hash!==windowHash(window))throw Error('boilerplate.json fue congelado con OTRA ventana (FROM/TO/BASIS). Abortado: use la misma ventana de la cohorte original o archive el directorio de resultados.');
    }
    return new Set(j.lines);
  }
  if(cfg!==null){
    const hasResults=fs.existsSync(path.join(outDir,'resultados.jsonl'))&&fs.statSync(path.join(outDir,'resultados.jsonl')).size>0;
    if(!allowLearn||hasResults)throw Error('Falta boilerplate.json'+(hasResults?' pero ya existen resultados':'')+': no se reaprende en silencio (cambiaría los task_key y se reenviaría/cobraría de nuevo). Recupere el archivo original.');
  }
  const set=learnBoilerplate(convsAll.flatMap(c=>c.messages.map(m=>m.text)));
  const lines=[...set].sort();fs.mkdirSync(outDir,{recursive:true,mode:0o700});
  fs.writeFileSync(f,JSON.stringify({version:2,hash:sha256(JSON.stringify(lines)),config_hash:cfg,window_hash:window?windowHash(window):null,window,n:lines.length,lines},null,1),{mode:0o600});
  return set;
}
// Libro de gasto en ruta FIJA por tenant+ventana (independiente de --out), para que otro --out no reinicie el tope de la cohorte.
export function cohortLedger({root=ROOT,tenant=SQL.TENANT,window,batchId,capTotalUsd,capBatchUsd,outDir=null}){
  const dir=path.join(root,'gasto');const file=`gasto-${tenant}_${window.from}_${window.to}_${window.basis}.jsonl`;
  return createLedger({dir,file,capTotalUsd:Math.min(capTotalUsd,HARD_CAP_USD),capBatchUsd,batchId,alsoRead:outDir?[path.join(outDir,'gasto-cohorte.jsonl')]:[]});
}
const SEV=['unknown','low','medium','high','critical'];

// ---------------------------------------------------------------- proyección (--dry-count)
export function projectCost(stats,opts={}){ // admite estadísticas por fuente: {por_fuente:{csv:{...},hubspot:{...}}}
  if(!stats.por_fuente)return projectOne(stats,opts);
  const parts=Object.entries(stats.por_fuente).map(([k,v])=>[k,projectOne(v,opts)]);
  const out={conversations:parts.reduce((a,[,p])=>a+p.conversations,0),enviadas_estimadas:parts.reduce((a,[,p])=>a+p.enviadas_estimadas,0),supuestos:parts[0][1].supuestos,por_fuente:Object.fromEntries(parts.map(([k,p])=>[k,{conversations:p.conversations,escenarios:p.escenarios}])),escenarios:{}};
  for(const sc of Object.keys(parts[0][1].escenarios)){out.escenarios[sc]={};for(const key of Object.keys(parts[0][1].escenarios[sc])){if(key.startsWith('usd_por_conv'))out.escenarios[sc][key]=+(parts.reduce((a,[,p])=>a+p.escenarios[sc][key]*p.enviadas_estimadas,0)/out.enviadas_estimadas).toFixed(6);else out.escenarios[sc][key]=+parts.reduce((a,[,p])=>a+p.escenarios[sc][key],0).toFixed(2);}}
  return out;
}
function projectOne(stats,{prices=PRICES,cal={}}={}){
  const c={fixedTokens:5300,tokensPerChar:0.32,perMsgTokens:14,completion:450,embedTokensPerConv:260,hitWarm:0.97,margin:1.2,batchFactor:0.52,autoShare:0,...cal};
  const N=Math.round(stats.conversations*(1-(stats.auto_share??c.autoShare)));
  const scen={base:1,pesimista:1.5};const out={conversations:stats.conversations,enviadas_estimadas:N,supuestos:c,escenarios:{}};
  for(const [name,mult] of Object.entries(scen)){
    const chars=(stats.chars_mean??stats.chars_p50)*mult,msgs=stats.msgs_mean??stats.msgs_p50;
    const varTok=chars*c.tokensPerChar+msgs*c.perMsgTokens;
    const row=h=>{const inUsd=c.fixedTokens*(h*prices.cacheRead+(1-h)*prices.cacheWrite)+varTok*prices.in;return inUsd+c.completion*prices.out+c.embedTokensPerConv*prices.embed;};
    const warm=row(c.hitWarm),cold=row(0);
    out.escenarios[name]={usd_por_conv_tibio:+warm.toFixed(6),usd_por_conv_frio:+cold.toFixed(6),total_tibio_con_margen:+(warm*N*c.margin).toFixed(2),total_frio_con_margen:+(cold*N*c.margin).toFixed(2),total_batch_estimado:+(warm*N*c.margin*c.batchFactor).toFixed(2)};
  }
  return out;
}

// ---------------------------------------------------------------- utilidades de resultados
const readJsonl=f=>fs.existsSync(f)?fs.readFileSync(f,'utf8').split('\n').filter(Boolean).map(l=>{try{return JSON.parse(l);}catch{return null;}}).filter(Boolean):[];
const pct=(a,p)=>{if(!a.length)return null;const s=[...a].sort((x,y)=>x-y);return s[Math.min(s.length-1,Math.floor(p*s.length))];};
export const configHash=({model,provider,taxonomy})=>sha256(JSON.stringify({v:'ia-escala-cohorte-v1',model,provider,prompt:promptHash(),schema:schemaHash(taxonomy)}));
export const taskKeyFor=(cfg,convId,inputHash)=>'ext1:'+sha256(cfg+'|'+convId+'|'+inputHash).slice(0,40);
export function pickPilot(convs,n){ // muestra determinista y repetible, independiente del orden de entrada
  return [...convs].sort((a,b)=>sha256('pilot|'+a.conversation_id).localeCompare(sha256('pilot|'+b.conversation_id))).slice(0,n);
}
function embeddingRows(prep,data){ // como problems/runtime.mjs: por mensaje citado, la mayor severidad; máx. 32
  const byMsg=new Map();
  for(const issue of data.issues)for(const ev of issue.evidence){
    const p=byMsg.get(ev.message_revision_id);
    if(!p||SEV.indexOf(issue.severity)>SEV.indexOf(p.severity))byMsg.set(ev.message_revision_id,{message_id:ev.message_revision_id,label:issue.category,severity:issue.severity});
  }
  const text=new Map(prep.revisions.map(r=>[r.message_id,r.text]));
  return [...byMsg.values()].filter(r=>['low','medium','high','critical'].includes(r.severity)).sort((a,b)=>a.message_id.localeCompare(b.message_id)).slice(0,32).map(r=>({...r,text:text.get(r.message_id)}));
}
const f32b64=v=>Buffer.from(new Float32Array(v).buffer).toString('base64');

// ---------------------------------------------------------------- núcleo
export async function runCohort(o){
  const {convs,taxonomy,outDir,client,model=DEFAULT_MODEL,provider='azure',concurrency=12,embed=true,maxTokens=1500,
    capTotalUsd0=30,capBatchUsd0=30,batchId='lote-'+new Date().toISOString().replace(/[:.]/g,'-'),maxConsecutiveFailures=3,
    maxAttempts=2,skipAutomatic=true,log=()=>{},scoreFn=null,prices=PRICES,fileTag=''}=o;
  if(!ALLOWED_MODELS.includes(model))throw Error('modelo no permitido (lista cerrada)');
  if(!ALLOWED_PROVIDERS.includes(provider))throw Error('proveedor no permitido (lista cerrada)');
  for(const [n,v] of [['tope total',capTotalUsd0],['tope del lote',capBatchUsd0]])if(!Number.isFinite(v)||v<=0)throw Error(n+' inválido');
  const capTotalUsd=Math.min(capTotalUsd0,HARD_CAP_USD),capBatchUsd=Math.min(capBatchUsd0,capTotalUsd);
  fs.mkdirSync(outDir,{recursive:true,mode:0o700});
  const ledger=o.ledger??createLedger({dir:outDir,capTotalUsd,capBatchUsd,batchId});
  const resFile=path.join(outDir,`resultados${fileTag}.jsonl`),embFile=path.join(outDir,`embeddings${fileTag}.jsonl`);
  const cfg=configHash({model,provider,taxonomy});
  const prior=readJsonl(resFile),done=new Set(),fails=new Map();
  for(const r of prior){if(['ok','abstained','skipped'].includes(r.status))done.add(r.task_key);else fails.set(r.task_key,(fails.get(r.task_key)??0)+1);}
  const boilerplate=o.boilerplate??learnBoilerplate(convs.flatMap(c=>c.messages.map(m=>m.text)));
  const st={total:convs.length,already_done:0,skipped:{},ok:0,abstained:0,failed:0,gave_up:0,not_attempted:0,embedded_rows:0,aborted:null,cached_tokens:0,prompt_tokens:0,completion_tokens:0,cache_write_tokens:0,lat:[],cats:{},issues:0,entities:0,fail_reasons:{},chars_sent:0,msgs_sent:0,invalid_refs:0};
  let idx=0,consecutive=0,stop=false;const collected=[];
  const append=(f,obj)=>fs.appendFileSync(f,JSON.stringify(obj)+'\n',{mode:0o600});
  const noteFail=(key,convId,reason,extra={})=>{st.failed++;st.fail_reasons[reason]=(st.fail_reasons[reason]??0)+1;append(resFile,{task_key:key,conversation_id:convId,status:'failed',reason,model,config:cfg.slice(0,12),batch:batchId,ts:new Date().toISOString(),...extra});
    consecutive++;if(consecutive>=maxConsecutiveFailures&&!st.aborted){st.aborted=`${consecutive} fallos consecutivos (último: ${reason})`;stop=true;}};
  async function one(conv){
    const prep=prepareConversation(conv,{boilerplate,skipAutomatic,...(o.redactFn?{redactFn:o.redactFn}:{})});
    if(prep.status==='skipped'){
      const key=taskKeyFor(cfg,conv.conversation_id,sha256('skipped|'+prep.reason+'|'+prep.stats.msgs_in));
      if(done.has(key)){st.already_done++;return;}
      st.skipped[prep.reason]=(st.skipped[prep.reason]??0)+1;append(resFile,{task_key:key,conversation_id:conv.conversation_id,status:'skipped',reason:prep.reason,batch:batchId,ts:new Date().toISOString(),stats:prep.stats});return;
    }
    const key=taskKeyFor(cfg,conv.conversation_id,prep.input_hash);
    if(done.has(key)){st.already_done++;return;}
    if((fails.get(key)??0)>=maxAttempts){st.gave_up++;return;}
    const body=buildRequest(prep.revisions,taxonomy,{model,provider,maxTokens});
    const tokUpper=Math.ceil(Buffer.byteLength(JSON.stringify(body))/2)+4000;
    const ceiling=tokUpper*prices.cacheWrite+maxTokens*prices.out;
    let release;try{release=ledger.reserve(ceiling);}catch(e){if(e instanceof BudgetAbort){st.aborted=e.message;stop=true;st.not_attempted++;return;}throw e;}
    let res;try{res=await client.post('/chat/completions',body);}finally{release();}
    const u=res.json?.usage??{};const usd=bookedCost(u.cost,res.status,ceiling);
    ledger.record({task:key,kind:'chat',usd,pt:u.prompt_tokens??null,ct:u.completion_tokens??null,cached:u.prompt_tokens_details?.cached_tokens??null,cw:u.prompt_tokens_details?.cache_write_tokens??null,http:res.status});
    if(usd>ceiling*1.0001&&!st.aborted){st.aborted=`cost_overrun: costo real ${usd.toFixed(5)} > techo ${ceiling.toFixed(5)}`;stop=true;}
    st.lat.push(res.ms);st.prompt_tokens+=u.prompt_tokens??0;st.completion_tokens+=u.completion_tokens??0;st.cached_tokens+=u.prompt_tokens_details?.cached_tokens??0;st.cache_write_tokens+=u.prompt_tokens_details?.cache_write_tokens??0;
    st.chars_sent+=prep.stats.chars_out;st.msgs_sent+=prep.stats.msgs_out;
    const choice=res.json?.choices?.[0];
    if(res.status!==200||!choice||choice.finish_reason!=='stop'||typeof choice.message?.content!=='string')return noteFail(key,conv.conversation_id,res.status===200?'finish_'+(choice?.finish_reason??'none'):'http_'+res.status,{cost_usd:usd,http_msg:scrub(res.json?.error?.message??res.err??'').slice(0,200)});
    let raw;try{raw=JSON.parse(choice.message.content);}catch{return noteFail(key,conv.conversation_id,'json_invalido',{cost_usd:usd});}
    const v=resolveAndValidate(raw,prep.revisions,taxonomy);
    if(!v.ok){if(v.code==='invalid_reference')st.invalid_refs++;return noteFail(key,conv.conversation_id,v.code,{cost_usd:usd});}
    consecutive=0;
    const data=v.data;const status=data.abstention?'abstained':'ok';st[status]++;
    st.issues+=data.issues.length;st.entities+=data.entities.length;for(const i of data.issues)st.cats[i.category]=(st.cats[i.category]??0)+1;
    const rec={task_key:key,conversation_id:conv.conversation_id,status,reason:data.abstention?.reason??null,model,provider,config:cfg.slice(0,12),batch:batchId,ts:new Date().toISOString(),cost_usd:usd,
      usage:{prompt:u.prompt_tokens??null,completion:u.completion_tokens??null,cached:u.prompt_tokens_details?.cached_tokens??null,cache_write:u.prompt_tokens_details?.cache_write_tokens??null},
      sentiment:data.sentiment,intent:data.intent,urgency:data.urgency,n_msgs:prep.stats.msgs_out,stats:prep.stats,
      issues:data.issues.map(i=>({category:i.category,severity:i.severity,evidence:i.evidence.map(e=>({message_id:e.message_revision_id,start:e.start,end:e.end,quote_hash:e.quote_hash,role:e.role}))})),
      entities:data.entities.map(e=>({type:e.type,value:e.value,evidence:e.evidence.map(x=>({message_id:x.message_revision_id,start:x.start,end:x.end,quote_hash:x.quote_hash}))}))};
    if(scoreFn)collected.push({conv,prep,data,rec});
    // embeddings de la evidencia citada (mismo criterio que el runtime de problemas)
    if(embed&&data.issues.length){
      const rows=embeddingRows(prep,data);
      if(rows.length){
        const eb={model:EMBED_MODEL,input:rows.map(r=>r.text),encoding_format:'float',provider:{only:[provider],allow_fallbacks:false,data_collection:'deny'}};
        const ec=Math.ceil(Buffer.byteLength(JSON.stringify(eb))/2)*prices.embed*2+0.00001;
        let rel2;try{rel2=ledger.reserve(ec);}catch(e){if(e instanceof BudgetAbort){st.aborted=e.message;stop=true;append(resFile,{...rec,embedded:false});return;}throw e;}
        let er;try{er=await client.post('/embeddings',eb);}finally{rel2();}
        const ecost=bookedCost(er.json?.usage?.cost,er.status,ec);
        ledger.record({task:key,kind:'embed',usd:ecost,pt:er.json?.usage?.prompt_tokens??null,http:er.status});
        const vecs=er.json?.data;
        if(er.status===200&&Array.isArray(vecs)&&vecs.length===rows.length&&vecs.every(d=>Array.isArray(d.embedding)&&d.embedding.length===1536)){
          for(let i=0;i<rows.length;i++){const d=vecs.find(x=>x.index===i)??vecs[i];append(embFile,{task_key:key,conversation_id:conv.conversation_id,message_id:rows[i].message_id,label:rows[i].label,severity:rows[i].severity,model:EMBED_MODEL,dim:1536,vec_f32_b64:f32b64(d.embedding)});}
          st.embedded_rows+=rows.length;rec.embedded=true;
        }else{rec.embedded=false;rec.embed_reason='http_'+er.status;}
      }
    }
    append(resFile,rec);
  }
  const worker=async()=>{while(!stop){const i=idx++;if(i>=convs.length)return;try{await one(convs[i]);}catch(e){if(e instanceof BudgetAbort){st.aborted=e.message;stop=true;}else{st.aborted='error interno: '+scrub(e.message).slice(0,100);stop=true;}}}};
  const prevSigint=()=>{stop=true;st.aborted??='interrumpido (SIGINT): reanude con --resume';};process.once('SIGINT',prevSigint);
  const t0=Date.now();
  // Calentamiento: la primera llamada escribe el caché del prefijo; el resto en paralelo lo lee.
  if(convs.length>1){const first=idx++;try{await one(convs[first]);}catch(e){st.aborted=e instanceof BudgetAbort?e.message:'error interno: '+scrub(e.message).slice(0,100);stop=true;}}
  await Promise.all(Array.from({length:Math.min(concurrency,Math.max(1,convs.length))},worker));
  process.off('SIGINT',prevSigint);
  st.not_attempted+=Math.max(0,convs.length-Math.min(idx,convs.length));
  const receipt={batch:batchId,model,provider,config:cfg.slice(0,12),prompt_hash:promptHash().slice(0,12),schema_hash:schemaHash(taxonomy).slice(0,12),
    conversaciones_en_entrada:st.total,ya_hechas_omitidas:st.already_done,omitidas_por_regla:st.skipped,ok:st.ok,abstenciones:st.abstained,fallidas:st.failed,fallos_por_causa:st.fail_reasons,
    sin_intentar_por_aborto:st.not_attempted,abandonadas_tras_reintentos:st.gave_up,abort:st.aborted,issues:st.issues,entidades:st.entities,filas_embedding:st.embedded_rows,categorias:st.cats,
    tokens:{prompt:st.prompt_tokens,completion:st.completion_tokens,cached:st.cached_tokens,cache_write:st.cache_write_tokens,
      tasa_cache:st.prompt_tokens?+(st.cached_tokens/st.prompt_tokens).toFixed(3):null},
    chars_enviados:st.chars_sent,mensajes_enviados:st.msgs_sent,latencia_ms:{p50:pct(st.lat,.5),p90:pct(st.lat,.9)},segundos:Math.round((Date.now()-t0)/1000),gasto:ledger.summary()};
  fs.writeFileSync(path.join(outDir,`recibo-${batchId}.json`),JSON.stringify(receipt,null,1),{mode:0o600});
  return{receipt,collected,ledger};
}

// ---------------------------------------------------------------- CLI
const args=process.argv.slice(2);const flag=n=>args.includes('--'+n);const opt=(n,d)=>{const i=args.indexOf('--'+n);return i>=0?args[i+1]:d;};
async function cli(){
  const out=opt('out',path.join(ROOT,'cohorte'));
  const win={from:opt('from','2026-07-01'),to:opt('to','2026-11-01'),basis:opt('basis','first')};
  if(flag('emit-sql')){
    fs.mkdirSync(out,{recursive:true});
    const files={'0-taxonomia.sql':SQL.taxonomia(),'1-conteos.sql':SQL.seleccionConteos(win),'2-estadisticas.sql':SQL.estadisticas(win),'3-verificacion.sql':SQL.verificacion(win),'3b-corridas-previas.sql':SQL.corridasPrevias(win)};
    for(const [f,q] of Object.entries(files)){if(SQL.WRITE_WORDS.test(q.split('\n').filter(l=>!l.trim().startsWith('--')).join('\n')))throw Error('SQL con escritura: '+f);fs.writeFileSync(path.join(out,f),q);}
    console.log('SQL de solo lectura escrito en',out,Object.keys(files).join(', '));return;
  }
  if(flag('dry-count')){
    const stats=JSON.parse(fs.readFileSync(opt('stats'),'utf8'));
    const calF=path.join(ROOT,'calibracion.json');const cal=fs.existsSync(calF)?JSON.parse(fs.readFileSync(calF,'utf8')):{};
    const p=projectCost(stats,{cal});const cap=moneyOpt(args,'cap-total',30);
    p.tope_cohorte_usd=cap;p.cabe_en_tope={tibio_base:p.escenarios.base.total_tibio_con_margen<=cap,frio_pesimista:p.escenarios.pesimista.total_frio_con_margen<=cap};
    console.log(JSON.stringify(p,null,1));return;
  }
  if(flag('probe')){ // diagnóstico con UNA fixture sintética: qué combinación de parámetros acepta el enrutador
    const {FIXTURES,materialize}=await import('./fixtures.mjs');const {TAXONOMY}=await import('./taxonomy.mjs');
    const f=FIXTURES[0];const prep=prepareConversation({conversation_id:f.id,messages:materialize(f).map((m,i)=>({id:m.message_revision_id,role:m.role,text:m.text,at:String(i)}))});
    const client=createClient({rps:2});const combos=[['only+schema pattern, sin require_parameters',{provider:opt('provider','azure'),requireParameters:false}],['sin only, require_parameters',{provider:null}],['only+require_parameters+enum',{provider:opt('provider','azure'),refMode:'enum'}],['only+require_parameters, sin temperature',{provider:opt('provider','azure'),requireParameters:true,temperature:null}]];
    for(const [name,v] of combos){const body=buildRequest(prep.revisions,TAXONOMY,{model:DEFAULT_MODEL,maxTokens:900,...v});const r=await client.post('/chat/completions',body);
      console.log(name,'->',r.status,r.json?.provider??'',r.json?.error?.message?scrub(r.json.error.message).slice(0,140):'ok',typeof r.json?.usage?.cost==='number'?'$'+r.json.usage.cost:'');}
    return;}
  if(flag('calibrate')){ // calibra la proyección con la corrida de fixtures (regresión prompt_tokens ~ fijo + k*chars + m*msgs)
    const rs=readJsonl(path.join(ROOT,'fixtures-compact/resultados-fixtures.jsonl')).filter(r=>r.usage?.prompt&&r.stats);
    const n=rs.length,mx=rs.reduce((a,r)=>a+r.stats.chars_out,0)/n,my=rs.reduce((a,r)=>a+r.usage.prompt,0)/n;
    const k=rs.reduce((a,r)=>a+(r.stats.chars_out-mx)*(r.usage.prompt-my),0)/rs.reduce((a,r)=>a+(r.stats.chars_out-mx)**2,0);
    const cal={fixedTokens:Math.round(my-k*mx),tokensPerChar:+k.toFixed(3),perMsgTokens:0,completion:Math.round(rs.reduce((a,r)=>a+(r.usage.completion??0),0)/n),muestra:n,fuente:'fixtures-compact (sintéticas)'};
    fs.writeFileSync(path.join(ROOT,'calibracion.json'),JSON.stringify(cal,null,1));console.log(cal);return;}
  if(flag('fixtures')){const {runFixtures}=await import('./validar-fixtures.mjs');await runFixtures({limit:intOpt(args,'limit',47),out:path.join(ROOT,'fixtures-compact'),cap:moneyOpt(args,'cap',0.5)});return;}
  // ---- corrida real
  if(!flag('yes-send-real-text')){console.error('Falta --yes-send-real-text: este comando enviará texto REDACTADO de clientes a OpenRouter (provider fijo, data_collection:deny). Autorizado por Javier el 19-oct; confírmelo con la bandera.');process.exit(2);}
  const inputs=opt('input',null)?opt('input').split(','):['entrada.jsonl','entrada-csv.jsonl'].map(f=>path.join(out,f)).filter(f=>fs.existsSync(f));
  if(!inputs.length){console.error('No hay archivos de entrada. Corra primero ./ejecutar-cohorte.sh export');process.exit(2);}
  const taxonomy=JSON.parse(fs.readFileSync(opt('taxonomy'),'utf8'));
  const seen=new Set();let convs=inputs.flatMap(readJsonl).filter(c=>!seen.has(c.conversation_id)&&seen.add(c.conversation_id));
  // ventana por fecha de PRIMER/ÚLTIMO mensaje (segundo filtro local, además del SQL)
  const basis=opt('basis',null);if(basis){const from=opt('from'),to=opt('to');convs=convs.filter(c=>{const d=String(basis==='first'?c.first_at:c.last_at??'').slice(0,10);return (!from||d>=from)&&(!to||d<to);});}
  const model0=opt('model',DEFAULT_MODEL),provider0=opt('provider','azure');
  let boilerplate;try{boilerplate=loadOrLearnBoilerplate(out,convs,{cfg:configHash({model:model0,provider:provider0,taxonomy}),window:win});}catch(e){console.error('ABORTADO:',e.message);process.exit(2);} // aprendido sobre TODA la entrada, antes de elegir el piloto
  const pilot=intOpt(args,'pilot',0);if(pilot)convs=pickPilot(convs,pilot);
  const model=opt('model',DEFAULT_MODEL),provider=opt('provider','azure');
  if(!ALLOWED_MODELS.includes(model)||!ALLOWED_PROVIDERS.includes(provider)){console.error('Modelo/proveedor fuera de la lista cerrada.');process.exit(2);}
  const batchId=opt('batch',pilot?'piloto-'+pilot:'resto');
  const capTotal=Math.min(moneyOpt(args,'cap-total',30),HARD_CAP_USD),capBatch=moneyOpt(args,'cap-batch',pilot?1.0:capTotal);
  if(!Number.isFinite(capTotal)||!Number.isFinite(capBatch)||capTotal<=0||capBatch<=0){console.error('Topes inválidos');process.exit(2);}
  const client=createClient({rps:intOpt(args,'rps',6)});
  const key=await client.get('/key');const lim=key.json?.data?.limit,use=key.json?.data?.usage;
  if(typeof lim==='number'&&typeof use==='number'&&lim-use<capTotal){console.error(`La llave no tiene margen: límite ${lim}, uso ${use}, tope de cohorte ${capTotal}. Abortado.`);process.exit(3);}
  console.log(`conversaciones: ${convs.length} | lote ${batchId} | tope lote US$${capBatch} | tope cohorte US$${capTotal} | modelo ${model} | provider ${provider}`);
  const {receipt}=await runCohort({convs,taxonomy,outDir:out,client,model,provider,concurrency:Math.min(intOpt(args,'concurrency',12),16),embed:!flag('no-embed'),capTotalUsd0:capTotal,capBatchUsd0:capBatch,batchId,boilerplate,ledger:cohortLedger({window:win,batchId,capTotalUsd:capTotal,capBatchUsd:capBatch,outDir:out}),log:console.log});
  console.log(JSON.stringify(receipt,null,1));
  if(receipt.abort)process.exit(4);
}
if(import.meta.url===`file://${process.argv[1]}`)cli().catch(e=>{console.error('ERROR',scrub(e.message).slice(0,200));process.exit(1);});
