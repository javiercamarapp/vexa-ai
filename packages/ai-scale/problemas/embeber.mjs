#!/usr/bin/env node
// PASO 1 (opcional, solo si faltan vectores). Genera con OpenRouter los embeddings que NO existen todavía para la evidencia de los issues persistidos.
// Por defecto (modo 'mensaje') REUTILIZA los vectores que cohorte.mjs ya calculó (cohorte/embeddings.jsonl): costo 0. Solo se envía a la red lo que falte.
//   node embeber.mjs --taxonomy taxonomia.json                       # DRY-COUNT (default): cuenta filas, faltantes y estima costo. No llama a la API.
//   node embeber.mjs --taxonomy taxonomia.json --send                # pide escribir ENVIAR en la terminal; solo entonces envía TEXTO REDACTADO de clientes a OpenRouter.
//   --texto mensaje|quote   mensaje (default): texto del mensaje redactado (lo ya embebido). quote: la cita de la evidencia (idéntico al worker oficial; re-embebe todo, ~US$0.05).
// Garantías: texto ya redactado; provider azure fijo + data_collection:'deny'; <=32 filas por llamada; libro de gasto propio con tope DURO US$0.20 (HARD_CAP_USD);
// idempotente (los vectores se guardan en embeddings-problemas.jsonl con hash del texto; lo ya guardado no se reenvía); la llave se lee dentro del proceso y no se imprime.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import {sha256} from '../../intelligence/index.mjs';
import {createLedger,BudgetAbort} from '../spend.mjs';
import {createClient,scrub} from '../openrouter.mjs';
import {bookedCost} from '../cohorte.mjs';
import {intOpt,moneyOpt} from '../cli-util.mjs';
import {cargarCohorte,construirFilas,leerVectores,adjuntarVectores,f32ToB64,EMBED_MODEL,EMBED_DIM,EMBED_USD_PER_TOKEN,HARD_CAP_USD,MODES,defaultVersion,TENANT} from './nucleo.mjs';

const ROOT=process.env.IA_ESCALA_OUT||path.join(os.homedir(),'.codex-work/rovaq-cierre-20261007/ia-escala-20261019');
const append=(f,o)=>fs.appendFileSync(f,JSON.stringify(o)+'\n',{mode:0o600});
export const estimar=faltantes=>{const bytes=faltantes.reduce((a,r)=>a+Buffer.byteLength(r.text),0);const tokens=Math.ceil(bytes/2.2)+faltantes.length*4; // techo conservador (español redactado ~3.5 B/token; aquí 2.2)
  return{filas:faltantes.length,bytes,tokens_techo:tokens,usd_techo:+(tokens*EMBED_USD_PER_TOKEN).toFixed(6),llamadas:Math.ceil(faltantes.length/32)};};

// confirm: async ()=>boolean. client: {post(endpoint,body)}. Escribe vectores en outFile (jsonl).
export async function embeberFaltantes({faltantes,client,ledger,outFile,mode,confirm,log=()=>{}}){
  const est=estimar(faltantes);
  if(!faltantes.length)return{...est,enviadas:0,gasto:ledger.summary()};
  if(est.usd_techo>ledger.capTotalUsd)throw Error(`el techo estimado US$${est.usd_techo} supera el tope de esta etapa US$${ledger.capTotalUsd}`);
  if(!(await confirm(est)))throw Error('no confirmado: no se envió nada');
  let enviadas=0,fallidas=0;
  for(let i=0;i<faltantes.length;i+=32){
    const lote=faltantes.slice(i,i+32);
    const body={model:EMBED_MODEL,input:lote.map(r=>r.text),encoding_format:'float',provider:{only:['azure'],allow_fallbacks:false,data_collection:'deny'}};
    const ceiling=Math.ceil(Buffer.byteLength(JSON.stringify(body))/2)*EMBED_USD_PER_TOKEN*2+0.00001;
    let release;try{release=ledger.reserve(ceiling);}catch(e){if(e instanceof BudgetAbort){log('ABORTO por tope: '+e.message);break;}throw e;}
    let res;try{res=await client.post('/embeddings',body);}finally{release();}
    const usd=bookedCost(res.json?.usage?.cost,res.status,ceiling);
    ledger.record({task:'problemas-embed:'+i,kind:'embed',usd,pt:res.json?.usage?.prompt_tokens??null,http:res.status});
    const data=res.json?.data;
    if(res.status===200&&Array.isArray(data)&&data.length===lote.length&&data.every(d=>Array.isArray(d.embedding)&&d.embedding.length===EMBED_DIM&&d.embedding.every(Number.isFinite))){
      lote.forEach((r,k)=>{const d=data.find(x=>x.index===k)??data[k];append(outFile,{task_key:r.taskKey,message_id:r.prepId,mode,model:EMBED_MODEL,dim:EMBED_DIM,text_hash:r.textHash,label:r.label,severity:r.severity,vec_f32_b64:f32ToB64(d.embedding)});});
      enviadas+=lote.length;
    }else{fallidas+=lote.length;log(`lote ${i/32+1} falló (http ${res.status}); se puede reanudar`);if(fallidas>=96)break;}
    if(usd>ceiling*1.0001){log('cost_overrun: se detiene');break;}
  }
  return{...est,enviadas,fallidas,gasto:ledger.summary()};
}

async function confirmarENVIAR(est){
  if(!process.stdin.isTTY){console.error('Se requiere una terminal interactiva para confirmar (escribir ENVIAR).');return false;}
  const rl=readline.createInterface({input:process.stdin,output:process.stdout});
  const ans=await new Promise(r=>rl.question(`Se enviarán ${est.filas} textos REDACTADOS de clientes (~${est.bytes} bytes, techo US$${est.usd_techo}, ${est.llamadas} llamadas) a OpenRouter (azure, data_collection deny).\nEscriba ENVIAR para continuar: `,r));rl.close();
  return ans.trim()==='ENVIAR';
}

async function cli(){
  const a=process.argv.slice(2);const flag=n=>a.includes('--'+n);const opt=(n,d)=>{const i=a.indexOf('--'+n);return i>=0?a[i+1]:d;};
  const base=path.join(ROOT,'cohorte');const out=opt('out',path.join(ROOT,'problemas'));
  const mode=opt('texto','mensaje');if(!MODES.includes(mode))throw Error('--texto debe ser mensaje o quote');
  const resF=opt('results',path.join(base,'resultados.jsonl')),inF=opt('input',path.join(base,'entrada.jsonl')+','+path.join(base,'entrada-csv.jsonl')).split(',');
  const taxonomy=JSON.parse(fs.readFileSync(opt('taxonomy'),'utf8'));
  const tenant=opt('tenant',TENANT);if(!TENANT||tenant!==TENANT)throw Error('tenant no autorizado');
  const version=opt('embedding-version',defaultVersion(mode));
  const {items}=cargarCohorte({resultsFile:resF,inputFiles:inF,taxonomy,max:intOpt(a,'max',Infinity)});
  const {rows,descartadasSeveridad,textoInvalido}=construirFilas(items,{mode,tenant,version});
  const files=[path.join(base,'embeddings.jsonl'),path.join(out,'embeddings-problemas.jsonl')];
  const vecs=await leerVectores(files,{mode,needed:new Set(rows.map(r=>r.taskKey+'|'+r.prepId))});
  const {sinVector,obsoletos}=adjuntarVectores(rows,vecs,{mode});
  const faltantes=rows.filter(r=>!r.vec);
  const est=estimar(faltantes);
  const resumen={conversaciones:items.length,filas_candidatas:rows.length,con_vector:rows.length-faltantes.length,faltantes:faltantes.length,vectores_obsoletos:obsoletos,descartadas_severidad_desconocida:descartadasSeveridad,texto_invalido:textoInvalido,modo:mode,estimacion:est,tope_usd:HARD_CAP_USD};
  if(!flag('send')){console.log('DRY-COUNT. No se llamó a ninguna API.',JSON.stringify(resumen));return;}
  if(!faltantes.length){console.log('No faltan vectores: nada que enviar.',JSON.stringify(resumen));return;}
  if(!(await confirmarENVIAR(est))){console.error('No confirmado: no se envió nada.');process.exit(2);} // la confirmación va ANTES de cualquier llamada de red (incluso /key)
  fs.mkdirSync(out,{recursive:true,mode:0o700});
  const cap=Math.min(moneyOpt(a,'cap',0.05),HARD_CAP_USD);
  const client=createClient({rps:4});
  const key=await client.get('/key');const lim=key.json?.data?.limit,use=key.json?.data?.usage;
  if(typeof lim==='number'&&typeof use==='number'&&lim-use<cap){console.error(`La llave no tiene margen (límite ${lim}, uso ${use}). Abortado.`);process.exit(3);}
  const ledger=createLedger({dir:out,file:'gasto-embeddings-problemas.jsonl',capTotalUsd:cap,capBatchUsd:cap,batchId:'problemas-'+new Date().toISOString().slice(0,10)});
  const r=await embeberFaltantes({faltantes,client,ledger,outFile:path.join(out,'embeddings-problemas.jsonl'),mode,confirm:async()=>true,log:console.log});
  const receipt={...resumen,enviadas:r.enviadas,fallidas:r.fallidas,gasto:r.gasto,ts:new Date().toISOString()};
  fs.writeFileSync(path.join(out,'recibo-embeber.json'),JSON.stringify(receipt,null,1),{mode:0o600});console.log(JSON.stringify(receipt));
}
if(import.meta.url===`file://${process.argv[1]}`)cli().catch(e=>{console.error('ERROR',scrub(e.message).slice(0,200));process.exit(1);});
