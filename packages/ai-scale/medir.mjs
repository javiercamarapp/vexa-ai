#!/usr/bin/env node
// Harness de medición de extracción con LLM vía OpenRouter. SOLO fixtures sintéticas. Node >= 20, sin dependencias.
// Uso:
//   node medir.mjs --dry                                   # construye prompts, estima tamaños y costo máx.; sin red de inferencia
//   node medir.mjs --models a,b --limit 5                   # corrida real (gasta; respeta el libro gasto.json)
//   node medir.mjs --models a,b,c,d                         # corrida completa
//   node medir.mjs --embeddings                             # mide costo real de embeddings con las fixtures
// Llave: se lee DENTRO del proceso desde OPENROUTER_ENV_FILE (por defecto ~/.codex-work/rovaq-cierre-20261007/.env.openrouter).
// Nunca se imprime, registra ni pasa por argumentos. Solo viaja en la cabecera Authorization hacia https://openrouter.ai/api/v1.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {extractionSchema} from '../intelligence/index.mjs';
import {FIXTURES,materialize} from './fixtures.mjs';
import {TAXONOMY} from './taxonomy.mjs';

const HERE=path.dirname(fileURLToPath(import.meta.url));
const OUT=process.env.IA_ESCALA_OUT||path.join(os.homedir(),'.codex-work/rovaq-cierre-20261007/ia-escala-20261019');
const ENV_FILE=process.env.OPENROUTER_ENV_FILE||path.join(os.homedir(),'.codex-work/rovaq-cierre-20261007/.env.openrouter');
const BASE='https://openrouter.ai/api/v1';
const CAP=2.00,ABORT_AT=1.80,MAX_TOKENS=1500;
const LEDGER=path.join(OUT,'gasto.json');
const args=process.argv.slice(2);const flag=n=>args.includes('--'+n);const opt=(n,d)=>{const i=args.indexOf('--'+n);return i>=0?args[i+1]:d;};

// ---------- libro de gasto (se reescribe tras CADA llamada) ----------
function loadLedger(){try{return JSON.parse(fs.readFileSync(LEDGER,'utf8'));}catch{return{cap_usd:CAP,abort_at_usd:ABORT_AT,total_usd:0,calls:[]};}}
const ledger=loadLedger();let inflightMax=0;
function saveLedger(){fs.mkdirSync(OUT,{recursive:true});fs.writeFileSync(LEDGER+'.tmp',JSON.stringify(ledger,null,1));fs.renameSync(LEDGER+'.tmp',LEDGER);}
class BudgetAbort extends Error{}
function reserve(maxCost){ // aborta si acumulado + en vuelo + costo máx. de esta llamada superaría el tope
  if(ledger.total_usd+inflightMax+maxCost>ABORT_AT)throw new BudgetAbort(`gasto ${ledger.total_usd.toFixed(4)} + en vuelo ${inflightMax.toFixed(4)} + máx. ${maxCost.toFixed(4)} > ${ABORT_AT}`);
  inflightMax+=maxCost;return()=>{inflightMax-=maxCost;};
}

// ---------- llave (nunca se imprime) ----------
function readKey(){const t=fs.readFileSync(ENV_FILE,'utf8');const m=/^OPENROUTER_API_KEY=(.*)$/m.exec(t);if(!m)throw Error('OPENROUTER_API_KEY no encontrada');return m[1].trim().replace(/^["']|["']$/g,'');}
let KEY=null;const auth=()=>({Authorization:'Bearer '+(KEY??=readKey()),'Content-Type':'application/json','X-Title':'vexa-medicion-sintetica'});

// ---------- prompt EXACTO del gateway (se lee del código para no divergir) ----------
function productionPrompt(){
  const src=fs.readFileSync(path.join(HERE,'../gateway/index.mjs'),'utf8');
  const pick=n=>{const m=new RegExp('^const '+n+'=(.*);$','m').exec(src);if(!m)throw Error('no se halló '+n);return m[1];};
  return new Function(`const SYSTEM=${pick('SYSTEM')};const ENTITY_RULES=${pick('ENTITY_RULES')};const CONTEXT_RULES=${pick('CONTEXT_RULES')};return SYSTEM+ENTITY_RULES+CONTEXT_RULES;`)();
}

// ---------- port de referenceGrounding (packages/gateway/index.mjs ~L60-120), misma lógica ----------
function availableEvidence(r){const pts=Array.from(r.text),spans=[];for(let s=0;s<pts.length;s+=3800){const e=Math.min(s+4000,pts.length);spans.push({message_revision_id:r.message_revision_id,start:s,end:e,quote:pts.slice(s,e).join(''),role:r.role});if(e===pts.length)break;}return spans;}
function markerIntervals(t){return[...t.matchAll(/\[(?:PII|REDACTED)\]/g)].map(m=>[m.index,m.index+m[0].length]);}
function outsideMarkers(mk,s,e){let lo=0,hi=mk.length;while(lo<hi){const mid=(lo+hi)>>>1;if(mk[mid][1]<=s)lo=mid+1;else hi=mid;}return lo===mk.length||mk[lo][0]>=e;}
function entityCandidates(text,markers){
  const atoms=[[],[]],phrases=[],sa=new Set(),sp=new Set(),tail=[];let overflow=false;
  const pat=/[\p{L}\p{N}\p{M}]+(?:[-./_][\p{L}\p{N}\p{M}]+)*|[\p{Extended_Pictographic}]/gu;let m;
  const add=(list,seen,s,e)=>{if(!outsideMarkers(markers,s,e))return;const v=text.slice(s,e);if(seen.has(v)||Array.from(v).length>200)return;if(list.length>=33){overflow=true;return;}seen.add(v);list.push(v);};
  while((m=pat.exec(text))){const tk={start:m.index,end:m.index+m[0].length};const code=/\p{L}/u.test(m[0])&&/\p{N}/u.test(m[0]);add(atoms[code?0:1],sa,tk.start,tk.end);tail.push(tk);if(tail.length>3)tail.shift();for(let l=2;l<=tail.length;l++)add(phrases,sp,tail[tail.length-l].start,tk.end);}
  return{atoms:atoms.flat(),phrases,overflow,selected:new Set()};
}
function referenceGrounding(revs){
  const evidence=new Map(),values=new Map(),sources=new Map(),cands=[];let total=0;
  const projected=revs.map((r,ri)=>{const ae=availableEvidence(r).map((sp,i)=>{const ref='r'+ri+'s'+i;evidence.set(ref,sp);return{ref,...sp};});const mk=markerIntervals(r.text);sources.set(r.message_revision_id,{text:r.text,markers:mk});cands.push(entityCandidates(r.text,mk));return{message_revision_id:r.message_revision_id,role:r.role,text:r.text,available_evidence:ae,available_values:[],entity_values_limited:false};});
  for(const kind of['atoms','phrases'])for(let rank=0;rank<(kind==='atoms'?66:33)&&total<96;rank++)for(let i=0;i<projected.length&&total<96;i++){const row=projected[i],o=cands[i],v=o[kind][rank];if(v===undefined||row.available_values.length>=32||o.selected.has(v))continue;const ref='r'+i+'v'+row.available_values.length;values.set(ref,{value:v,message_revision_id:row.message_revision_id});row.available_values.push({ref,value:v});o.selected.add(v);total++;}
  projected.forEach((row,i)=>{const c=cands[i];row.entity_values_limited=c.overflow||[...c.atoms,...c.phrases].some(v=>!c.selected.has(v));});
  return{revisions:projected,evidence,values,sources};
}
function referenceSchema(taxonomy,refs){
  const schema=extractionSchema(taxonomy,{modelOutput:true});
  for(const f of['issues','entities']){const ev=schema.properties[f].items.properties.evidence;if(refs.evidence.size)ev.items={anyOf:[ev.items,{type:'string',enum:[...refs.evidence.keys()]}]};}
  if(refs.values.size){const en=schema.properties.entities.items.properties;en.value={anyOf:[en.value,{type:'object',additionalProperties:false,required:['ref'],properties:{ref:{type:'string',enum:[...refs.values.keys()]}}}]};}
  return schema;
}

// ---------- validador JSON-Schema acotado (mismo subconjunto que construye extractionSchema) ----------
function matches(v,s){
  if(s.anyOf)return s.anyOf.some(x=>matches(v,x));
  if(s.type==='null')return v===null;
  if(s.type==='object')return v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===s.required.length&&s.required.every(k=>Object.hasOwn(v,k)&&matches(v[k],s.properties[k]));
  if(s.type==='array')return Array.isArray(v)&&v.length>=(s.minItems??0)&&v.length<=s.maxItems&&v.every(x=>matches(x,s.items));
  if(s.type==='integer')return Number.isSafeInteger(v)&&v>=s.minimum;
  if(s.type==='string')return typeof v==='string'&&(!s.enum||s.enum.includes(v))&&(!s.minLength||[...v].length>=s.minLength)&&(!s.maxLength||[...v].length<=s.maxLength)&&(!s.pattern||new RegExp(s.pattern).test(v));
  return false;
}

// ---------- una llamada ----------
const PROMPT=productionPrompt();
let VARIANT=''; // '' = como el gateway actual; 'compact' = sin quote duplicado ni available_values; 'cache' = prefijo estable con cache_control
function buildRequest(model,fx){
  const revs=materialize(fx),refs=referenceGrounding(revs),schema=referenceSchema(TAXONOMY,refs);
  let revsOut=refs.revisions;
  if(VARIANT.includes('compact'))revsOut=refs.revisions.map(r=>({message_revision_id:r.message_revision_id,role:r.role,text:r.text,available_evidence:r.available_evidence.map(e=>e.ref)}));
  const payload={taxonomy:TAXONOMY,revisions:revsOut};
  let messages=[{role:'system',content:PROMPT},{role:'user',content:JSON.stringify(payload)}];
  if(VARIANT.includes('cache'))messages=[{role:'system',content:[{type:'text',text:PROMPT}]},{role:'user',content:[{type:'text',text:'Taxonomy (supplied categories): '+JSON.stringify(TAXONOMY),cache_control:{type:'ephemeral'}},{type:'text',text:JSON.stringify({revisions:revsOut})}]}];
  const body={model,messages,response_format:{type:'json_schema',json_schema:{name:'vexa_extraction_v1',strict:true,schema}},max_tokens:MAX_TOKENS,temperature:0,usage:{include:true},provider:{data_collection:'deny'}};
  if(/gpt-oss/.test(model))body.reasoning={effort:'low'};
  else if(/deepseek|qwen|glm/.test(model)||VARIANT.includes('noreason'))body.reasoning={enabled:false};
  return{body,refs,schema,revs};
}
const estIn=body=>Math.ceil(Buffer.byteLength(JSON.stringify(body))/2.2); // conservador: ~2.2 bytes/token en español+JSON
function maxCost(price,body){return estIn(body)*price.in+MAX_TOKENS*price.out;}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function post(endpoint,body){
  let last;for(let a=0;a<3;a++){
    try{const t0=Date.now();const res=await fetch(BASE+endpoint,{method:'POST',headers:auth(),body:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(120000)});const txt=await res.text();let json=null;try{json=JSON.parse(txt);}catch{}
      if((res.status===429||res.status>=500)&&a<2){last={status:res.status};await sleep(1500*(a+1));continue;}
      return{status:res.status,json,ms:Date.now()-t0,retries:a};}
    catch(e){last={status:0,err:String(e.message).slice(0,120)};if(a<2){await sleep(1500*(a+1));continue;}return{status:0,json:null,ms:0,retries:a,err:last.err};}
  }return{status:last?.status??0,json:null,ms:0,retries:2};
}

function score(fx,out,revs,refs,schema){
  const r={json_valid:false,schema_valid:false,pred:[],cite_fail:0,cite_checked:0,support_ok:0,tp:0,fp:0,fn:0,abstained:false};
  if(!out){return r;}
  r.json_valid=true;r.schema_valid=matches(out,schema);
  if(!r.schema_valid)return r;
  r.abstained=out.abstention!==null;
  const idxOf=id=>revs.findIndex(x=>x.message_revision_id===id);
  const refIdx=ref=>{const m=/^r(\d+)s\d+$/.exec(ref);return m?+m[1]:-1;};
  const evCheck=ev=>{r.cite_checked++;
    if(typeof ev==='string'){if(!refs.evidence.has(ev)){r.cite_fail++;return -1;}return refIdx(ev);}
    const rev=revs[idxOf(ev.message_revision_id)];const pts=rev?Array.from(rev.text):[];
    if(!rev||ev.role!==rev.role||ev.end<=ev.start||ev.end>pts.length||pts.slice(ev.start,ev.end).join('')!==ev.quote){r.cite_fail++;return -1;}return idxOf(ev.message_revision_id);};
  const used=new Set();
  for(const it of out.issues){const cited=it.evidence.map(evCheck);r.pred.push({category:it.category,cited});}
  for(const en of out.entities){en.evidence.forEach(evCheck);r.cite_checked++;
    if(en.value&&typeof en.value==='object'){const rv=refs.values.get(en.value.ref);if(!rv||!en.evidence.some(e=>typeof e==='string'&&refs.evidence.get(e)?.quote.includes(rv.value)))r.cite_fail++;}}
  for(const p of r.pred){const t=fx.truth.find(([c])=>c===p.category);
    if(t&&!used.has(p.category)){used.add(p.category);r.tp++;if(p.cited.some(i=>t[1].includes(i)))r.support_ok++;}else r.fp++;}
  r.fn=fx.truth.filter(([c])=>!used.has(c)).length;
  return r;
}

async function runOne(model,price,fx){
  const {body,refs,schema,revs}=buildRequest(model,fx);
  const mc=maxCost(price,body);const release=reserve(mc);let res;
  try{res=await post('/chat/completions',body);}finally{release();}
  const u=res.json?.usage||{};const cost=typeof u.cost==='number'?u.cost:null;
  // La API cobra aun con salida inválida: se registra el costo real devuelto (y si falta, se asume el máximo para no subestimar).
  const charged=res.status===200;const booked=cost??(charged?mc:0);
  ledger.total_usd=+(ledger.total_usd+booked).toFixed(8);
  const content=res.json?.choices?.[0]?.message?.content;let out=null;
  if(typeof content==='string'){try{out=JSON.parse(content);}catch{out=null;}}
  const sc=score(fx,out,revs,refs,schema);
  const rec={ts:new Date().toISOString(),model,conv:fx.id,kind:fx.kind,http:res.status,retries:res.retries,ms:res.ms,variant:VARIANT,cached_tokens:u.prompt_tokens_details?.cached_tokens??null,cache_write_tokens:u.prompt_tokens_details?.cache_write_tokens??null,cost_usd:cost,cost_assumed_max:cost===null&&charged,prompt_tokens:u.prompt_tokens??null,completion_tokens:u.completion_tokens??null,reasoning_tokens:u.completion_tokens_details?.reasoning_tokens??null,provider:res.json?.provider??null,finish:res.json?.choices?.[0]?.finish_reason??null,err:res.json?.error?{code:res.json.error.code,msg:String(res.json.error.message||'').slice(0,160)}:(res.err||null),...sc,out_chars:content?.length??0,n_msgs:revs.length,in_chars:revs.reduce((a,m)=>a+m.text.length,0),raw:out};
  ledger.calls.push({ts:rec.ts,model,conv:fx.id,http:rec.http,cost_usd:cost,booked_usd:booked,prompt_tokens:rec.prompt_tokens,completion_tokens:rec.completion_tokens});
  saveLedger(); // tras CADA llamada
  return rec;
}

// ---------- precios (GET /models, solo lectura) ----------
async function loadPrices(){
  const res=await fetch(BASE+'/models',{headers:{Accept:'application/json'}});const j=await res.json();
  fs.mkdirSync(OUT,{recursive:true});fs.writeFileSync(path.join(OUT,'models-snapshot.json'),JSON.stringify(j.data.map(m=>({id:m.id,ctx:m.context_length,pricing:m.pricing,params:m.supported_parameters,modality:m.architecture?.modality})),null,0));
  return new Map(j.data.map(m=>[m.id,{in:+m.pricing.prompt,out:+m.pricing.completion,ctx:m.context_length,params:m.supported_parameters||[]}]));
}
const pct=(a,p)=>{if(!a.length)return null;const s=[...a].sort((x,y)=>x-y);return s[Math.min(s.length-1,Math.floor(p*s.length))];};
function summarize(recs){
  const by={};for(const r of recs)(by[r.model]??=[]).push(r);
  return Object.fromEntries(Object.entries(by).map(([model,rs])=>{
    const n=rs.length,ok=rs.filter(r=>r.schema_valid),pos=rs.filter(r=>r.kind==='positive'),neg=rs.filter(r=>r.kind!=='positive');
    const tp=sum(rs,'tp'),fp=sum(rs,'fp'),fn=sum(rs,'fn');
    // Una llamada inválida cuenta como fallo de cobertura: sus problemas verdaderos son FN.
    const fnAll=rs.reduce((a,r)=>a+(r.schema_valid?r.fn:(FIXTURES.find(f=>f.id===r.conv).truth.length)),0);
    const cost=rs.reduce((a,r)=>a+(r.cost_usd??0),0);
    const prec=tp+fp?tp/(tp+fp):null,rec=tp+fnAll?tp/(tp+fnAll):null;
    return[model,{n,http_ok:rs.filter(r=>r.http===200).length,json_invalid:rs.filter(r=>r.http===200&&!r.json_valid).length,schema_invalid:rs.filter(r=>r.http===200&&r.json_valid&&!r.schema_valid).length,invalid_rate:+(rs.filter(r=>!r.schema_valid).length/n).toFixed(4),
      tp,fp,fn:fnAll,precision:prec&&+prec.toFixed(3),recall:rec&&+rec.toFixed(3),f1:prec&&rec?+(2*prec*rec/(prec+rec)).toFixed(3):null,
      support_ok_of_tp:tp?+(sum(rs,'support_ok')/tp).toFixed(3):null,
      neg_cases:neg.length,neg_false_positive_cases:neg.filter(r=>r.schema_valid&&r.pred.length>0).length,neg_abstain_ok:neg.filter(r=>r.schema_valid&&r.pred.length===0).length,
      cite_checked:sum(rs,'cite_checked'),cite_fail:sum(rs,'cite_fail'),
      cost_total_usd:+cost.toFixed(6),cost_per_conv_usd:+(cost/n).toFixed(6),prompt_tokens_mean:mean(rs,'prompt_tokens'),completion_tokens_mean:mean(rs,'completion_tokens'),reasoning_tokens_mean:mean(rs,'reasoning_tokens'),
      latency_ms_p50:pct(rs.map(r=>r.ms),0.5),latency_ms_p95:pct(rs.map(r=>r.ms),0.95),retries_total:sum(rs,'retries'),providers:[...new Set(rs.map(r=>r.provider).filter(Boolean))],errors:[...new Set(rs.filter(r=>r.err).map(r=>JSON.stringify(r.err)))].slice(0,4)}];
  }));
}
const sum=(a,k)=>a.reduce((x,r)=>x+(r[k]??0),0);const mean=(a,k)=>{const v=a.map(r=>r[k]).filter(x=>x!=null);return v.length?Math.round(v.reduce((x,y)=>x+y,0)/v.length):null;};

async function embeddingsStep(){
  const models=(opt('embed-models','openai/text-embedding-3-small,openai/text-embedding-3-large')).split(',');
  const texts=FIXTURES.flatMap(f=>materialize(f).map(m=>m.text));
  const out={};
  for(const model of models){
    const input=texts.slice(0,64);const est=input.reduce((a,t)=>a+Buffer.byteLength(t),0)/2.2*0.00000013+0.00001; // techo holgado (modelo más caro ~US$0.13/M)
    const release=reserve(est);let res;try{res=await post('/embeddings',{model,input,encoding_format:'float',provider:{data_collection:'deny'}});}finally{release();}
    const cost=res.json?.usage?.cost??null;ledger.total_usd=+(ledger.total_usd+(cost??0)).toFixed(8);
    ledger.calls.push({ts:new Date().toISOString(),model,conv:'embeddings:64msgs',http:res.status,cost_usd:cost,booked_usd:cost??0,prompt_tokens:res.json?.usage?.prompt_tokens??null,completion_tokens:0});saveLedger();
    out[model]={http:res.status,rows:input.length,prompt_tokens:res.json?.usage?.prompt_tokens??null,cost_usd:cost,dims:res.json?.data?.[0]?.embedding?.length??null,ms:res.ms,err:res.json?.error?.message?.slice(0,120)??null};
  }
  fs.writeFileSync(path.join(OUT,'embeddings-medicion.json'),JSON.stringify(out,null,1));console.log(JSON.stringify(out,null,1));
}

async function batchTest(prices){
  // Prueba mínima del Batch API (50 % de descuento, ventana 24 h): 4 solicitudes sintéticas con Haiku ':batch'.
  const model='anthropic/claude-haiku-5.5',ids=['f01','f12','f33','f35'];VARIANT='compact';
  const reqs=ids.map(id=>{const {body}=buildRequest(model,FIXTURES.find(f=>f.id===id));delete body.model;delete body.usage;return{custom_id:id,body};});
  const p=prices.get(model);const mc=reqs.reduce((a,r)=>a+maxCost(p,r.body),0);const release=reserve(mc);
  let res;try{res=await post('/batches',{endpoint:'/v1/chat/completions',model:model+':batch',requests:reqs});}finally{release();}
  console.log('submit http',res.status,JSON.stringify(res.json).slice(0,300));if(!res.json?.id)return;
  const bid=res.json.id;let b=res.json;const t0=Date.now();
  while(!['completed','failed','expired','cancelled'].includes(b.status)&&Date.now()-t0<25*60000){await sleep(30000);b=await fetch(BASE+'/batches/'+bid,{headers:auth()}).then(r=>r.json());process.stdout.write(`batch ${b.status} ${JSON.stringify(b.request_counts)}\n`);}
  const cost=b.usage?.cost??null;if(cost!=null){ledger.total_usd=+(ledger.total_usd+cost).toFixed(8);}else if(['completed'].includes(b.status)){ledger.total_usd=+(ledger.total_usd+mc).toFixed(8);}
  ledger.calls.push({ts:new Date().toISOString(),model:model+':batch',conv:'batch-test:'+bid,http:res.status,cost_usd:cost,booked_usd:cost??0,pending:!['completed','failed','expired','cancelled'].includes(b.status)});saveLedger();
  fs.writeFileSync(path.join(OUT,'batch-test.json'),JSON.stringify({id:bid,status:b.status,seconds:Math.round((Date.now()-t0)/1000),counts:b.request_counts,usage:b.usage,error:b.error},null,1));
  console.log('batch final',b.status,'seconds',Math.round((Date.now()-t0)/1000),'usage',JSON.stringify(b.usage));
}
async function main(){
  const prices=await loadPrices();
  if(flag('batchtest')){await batchTest(prices);console.log('gasto',ledger.total_usd);return;}
  if(flag('embeddings')){await embeddingsStep();console.log('gasto acumulado',ledger.total_usd);return;}
  const models=(opt('models','anthropic/claude-haiku-5.5')).split(',').filter(Boolean);
  VARIANT=opt('variant','');const only=opt('only',null);const limit=+opt('limit',FIXTURES.length);const fx=only?FIXTURES.filter(f=>only.split(',').includes(f.id)):FIXTURES.slice(0,limit);
  for(const m of models)if(!prices.has(m))throw Error('modelo no está en el catálogo: '+m);
  if(flag('dry')){
    for(const m of models){const p=prices.get(m);let tokIn=0,mc=0;for(const f of fx){const {body}=buildRequest(m,f);tokIn+=estIn(body);mc+=maxCost(p,body);}
      console.log(m.padEnd(34),'conv',fx.length,'tok_in_est/conv',Math.round(tokIn/fx.length),'costo_máx_total_est US$',mc.toFixed(3),'(incluye max_tokens=1500 por llamada; el real será mucho menor)');}
    return;
  }
  // Verificación cruzada de uso de la llave (solo lectura; no se imprime la llave).
  const kr=await fetch(BASE+'/key',{headers:auth()}).then(r=>r.json()).catch(()=>null);
  console.log('llave: límite',kr?.data?.limit,'uso',kr?.data?.usage,'| libro local',ledger.total_usd);
  const recs=[];const queue=[];for(const m of models)for(const f of fx)queue.push([m,f]);
  const conc=Math.min(+opt('concurrency',3),3);let abort=null;
  const workers=Array.from({length:conc},async()=>{while(queue.length&&!abort){const [m,f]=queue.shift();
    try{const r=await runOne(m,prices.get(m),f);recs.push(r);process.stdout.write(`${m.split('/')[1]} ${f.id} http=${r.http} ok=${r.schema_valid} $${(r.cost_usd??0).toFixed(5)} tp=${r.tp} fp=${r.fp} fn=${r.fn}\n`);}
    catch(e){if(e instanceof BudgetAbort){abort=e.message;}else throw e;}}});
  await Promise.all(workers);
  const tag=opt('tag','run-'+new Date().toISOString().replace(/[:.]/g,'-'));
  const summary=summarize(recs);
  fs.writeFileSync(path.join(OUT,tag+'.json'),JSON.stringify({generated:new Date().toISOString(),prompt_sha_note:'prompt leído de packages/gateway/index.mjs',aborted:abort,summary,records:recs},null,1));
  console.log(JSON.stringify(summary,null,1));
  const kr2=await fetch(BASE+'/key',{headers:auth()}).then(r=>r.json()).catch(()=>null);
  console.log('ABORTADO:',abort,'| gasto libro US$',ledger.total_usd,'| uso de la llave según API',kr2?.data?.usage);
}
main().catch(e=>{console.error('ERROR',String(e.message).replace(/sk-[A-Za-z0-9_-]+/g,'[redactado]'));process.exit(1);});
