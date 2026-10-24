'use client';
import {useEffect,useState} from 'react';
import {Button,LinkButton} from '../ui/button';
import {Citation} from '../ui/citation';
import {IdChip} from '../ui/id-chip';
import {answerToHtml,answerToMarkdown,blockToCsv} from '../../../../../packages/agent-datos/export.mjs';
import {Icon} from './icons';
import {RovaqMark} from './rovaq-mark';
import {PARAM_LABELS,copyText,download,openReport,paramValue,safeInternal} from './format';
import {BlockView,Kpis} from './blocks';
import {TraceDisclosure} from './trace';
import type {Answer,ChatMessage} from './types';

const REASONS:[string,string][]=[['incorrecto','Incorrecto'],['incompleto','Incompleto'],['sin_fuente','Sin fuente'],['otro','Otro']];
const NOTICE:Partial<Record<Answer['status'],string>>={rate_limited:'Muchas preguntas seguidas.',budget_exceeded:'Se alcanzó el tope de IA de tu organización este mes; lo amplía tu administrador.',forbidden:'Tu rol no tiene acceso a estas consultas.',unavailable:'No disponible por ahora.',invalid_input:'No pude leer esa pregunta.'};
const isAlert=(s:Answer['status'])=>['rate_limited','budget_exceeded','forbidden','unavailable','invalid_input'].includes(s);

function CalcView({answer}:{answer:Answer}){
 return <details className="agente-calc"><summary>Ver cómo lo calculé</summary>
  <ol className="agente-calc-list" aria-label="Pasos del cálculo">
   {answer.calc.map((c,i)=><li key={i} className="agente-calc-step">
    <h4>{c.label}</h4>
    <dl className="agente-dl"><div><dt>Herramienta</dt><dd><IdChip value={c.tool} text={c.tool}/></dd></div>
     <div><dt>Parámetros</dt><dd>{Object.keys(c.args).length?<ul className="agente-params">{Object.entries(c.args).map(([k,v])=><li key={k}><span>{PARAM_LABELS[k]??k}</span> {paramValue(k,v)}</li>)}</ul>:'Sin parámetros'}<IdChip value={JSON.stringify(c.args)} label="JSON" text="copiar"/></dd></div>
     <div><dt>Método</dt><dd>{c.method}</dd></div>
     <div><dt>Lee</dt><dd><ul className="agente-params">{c.reads.map(r=><li key={r}>{r}</li>)}</ul></dd></div>
     <div><dt>Fuentes</dt><dd className="agente-sources">{c.sources.map(s=><span className="chip" key={s.ref} title={s.ref}>{s.label}</span>)}</dd></div>
     <div><dt>Resultado</dt><dd>{c.status==='ok'?`${c.figures} cifras`:'Sin datos'}{c.durationMs!==undefined?` · ${c.durationMs} ms`:''}</dd></div>
    </dl></li>)}
  </ol>
  <p className="card-lead agente-note">Modo: {answer.usage.mode==='deterministic'?'determinista (sin modelo de lenguaje)':'consulta determinista y redacción verificada'} · Llamadas al modelo: {answer.usage.modelCalls} · Costo de IA: {answer.usage.costMinor==='0'?'0':(Number(answer.usage.costMinor)/1e6).toLocaleString('es-MX',{maximumFractionDigits:6})+' USD'}. Las cifras salen de las herramientas, no del modelo.</p>
 </details>;
}

export function AnswerView({message,question,isLast,busy,labels,userContext,escribir=false,onTick,onAsk,onRegenerate,onFeedback}:{escribir?:boolean;onTick?:()=>void;message:ChatMessage;question:string;labels:Record<string,string>;userContext:string[];isLast:boolean;busy:boolean;onAsk:(q:string)=>void;onRegenerate:()=>void;onFeedback:(id:string,v:ChatMessage['feedback'])=>void}){
 const [copied,setCopied]=useState(false),[csvError,setCsvError]=useState(false),[reasonOpen,setReasonOpen]=useState(false),[fbBusy,setFbBusy]=useState(false);
 const a=message.answer;
 const [escrito,setEscrito]=useState(escribir?0:Infinity);
 useEffect(()=>{
  // Escritura progresiva: máx. 4.5 s aunque la respuesta sea larga (≥ 60 caracteres/s); con «reducir movimiento» sale completa.
  const largo=a?.text?.length??0;if(!escribir||!largo||(typeof window!=='undefined'&&window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)){setEscrito(Infinity);return;}
  const ritmo=Math.max(0.06,largo/4500),t0=performance.now();let raf=0;
  const paso=(t:number)=>{const n=Math.min(largo,Math.floor((t-t0)*ritmo));setEscrito(n>=largo?Infinity:n);onTick?.();if(n<largo)raf=requestAnimationFrame(paso);};
  raf=requestAnimationFrame(paso);return()=>cancelAnimationFrame(raf);
 },[escribir,a?.text]);// eslint-disable-line react-hooks/exhaustive-deps
 const listo=escrito===Infinity;
 if(message.cancelled)return <p className="agente-cancelled">Cancelado.</p>;
 if(!a)return null;
 const ok=a.status==='ok'||a.status==='no_data';
 const notice=NOTICE[a.status];
 async function copy(){try{await navigator.clipboard.writeText(copyText(a!));setCopied(true);setTimeout(()=>setCopied(false),1500);}catch{setCopied(false);}}
 async function sendFeedback(verdict:'up'|'down',reason?:string){
  setFbBusy(true);let persisted=false;
  try{const r=await fetch('/api/agent/feedback',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messageId:message.id,verdict,...(reason?{reason}:{})}),cache:'no-store'});if(r.ok){const j=await r.json();persisted=j?.data?.persisted===true;}}catch{/* kept locally */}
  onFeedback(message.id,{verdict,...(reason?{reason}:{}),persisted});setReasonOpen(false);setFbBusy(false);
 }
 const blocksWithRows=a.blocks.filter(b=>b.rows.length>0);
 return <div className="agente-answer">
  <div className="agente-answer-text">
   <RovaqMark size={16}/>
   {isAlert(a.status)||a.status==='clarify'||a.status==='out_of_catalog'?<div className={'state'+(isAlert(a.status)?' state-error':'')} role={isAlert(a.status)?'alert':undefined}><p className="agente-state-line"><Icon name={isAlert(a.status)?'alert':'info'} size={16}/>{a.text||notice}</p></div>:<p className="agente-text" aria-busy={!listo||undefined}>{listo?a.text:a.text.slice(0,escrito)}</p>}
  </div>
  {listo&&(a.status==='clarify'||a.status==='out_of_catalog'||a.status==='budget_exceeded')&&a.suggestions.length>0&&<div className="agente-chips" role="group" aria-label="Preguntas que sí puedo responder">{a.suggestions.slice(0,3).map(q=><Button key={q} size="sm" disabled={busy} onClick={()=>onAsk(q)}>{q}</Button>)}</div>}
  {listo&&a.status==='ok'&&a.figures.filter(f=>f.rank===undefined).length>0&&<Kpis figures={a.figures.filter(f=>f.rank===undefined).slice(0,4)}/>}
  {listo&&a.status==='ok'&&blocksWithRows.map((b,i)=><BlockView key={b.tool+i} block={b}/>)}
  {listo&&a.status==='ok'&&a.citations.length>0&&<section className="agente-citations" aria-label="Citas verificables"><p className="eyebrow" role="heading" aria-level={3}>Citas verificables</p>{a.citations.map(c=><Citation key={c.messageRevisionId} quote={c.quote} role={c.role} messageRevisionId={c.messageRevisionId} category={c.category} source={c.source}/>)}</section>}
  {listo&&message.citationsOmitted&&<p className="card-lead agente-note">Las citas de clientes no se guardan en el historial de este navegador; vuelve a preguntar para verlas.</p>}
  {listo&&a.missing.length>0&&ok&&<section className="agente-missing card" aria-label="Qué falta cargar"><p className="eyebrow" role="heading" aria-level={3}>Qué falta cargar</p><ul>{a.missing.map(m=><li key={m}>{m}</li>)}</ul>{a.missing.some(m=>!/vincul/i.test(m))&&<LinkButton href="/imports" size="sm" icon={<Icon name="arrow"/>}>Ir a Importaciones</LinkButton>}{a.missing.some(m=>/vincul/i.test(m))&&<LinkButton href="/history" size="sm" icon={<Icon name="arrow"/>}>Ver vínculos pedido–conversación</LinkButton>}</section>}
  {listo&&a.status==='ok'&&a.sources.length>0&&<div className="agente-sources" aria-label="Fuentes"><span className="agente-sources-label">Fuentes</span>{a.sources.map(s=>{const href=safeInternal(s.href);return href?<LinkButton key={s.ref} href={href} size="sm" icon={<Icon name="arrow"/>}>{s.label}</LinkButton>:<span className="chip" key={s.ref}>{s.label}</span>;})}</div>}
  {a.notes&&a.notes.length>0&&ok&&a.notes.map(n=><p key={n} className="card-lead agente-note">{n}</p>)}
  {listo&&ok&&a.trace&&a.trace.length>0&&<TraceDisclosure trace={a.trace} labels={labels}/>}
  {listo&&ok&&a.calc.length>0&&<CalcView answer={a}/>}
  {listo&&a.status==='ok'&&a.text.trim()&&<div className="agente-actions" role="group" aria-label="Acciones de la respuesta">
   <Button size="sm" icon={<Icon name={copied?'check':'copy'}/>} onClick={()=>void copy()}>{copied?'Copiado':'Copiar'}</Button>
   {blocksWithRows.map((b,i)=><Button key={b.tool+i} size="sm" icon={<Icon name="sheet"/>} aria-label={blocksWithRows.length>1?`Descargar CSV de ${b.title}`:'Descargar CSV'} onClick={()=>setCsvError(!download(`vexa-${b.tool}.csv`,blockToCsv(b),'text/csv;charset=utf-8'))}>{blocksWithRows.length>1?`CSV: ${b.title}`:'CSV'}</Button>)}
   <Button size="sm" icon={<Icon name="report"/>} title="Abre el reporte en una pestaña nueva; usa Imprimir para guardarlo como PDF." onClick={()=>{const html=answerToHtml({question,answer:a,userContext});if(!openReport(`rovaq-reporte-${message.id}.html`,html))setCsvError(true);}}>Reporte (HTML/PDF)</Button>
   <Button size="sm" icon={<Icon name="download"/>} onClick={()=>download(`vexa-respuesta-${message.id}.md`,answerToMarkdown({question,answer:a}),'text/markdown;charset=utf-8')}>Exportar</Button>
   {isLast&&<Button size="sm" icon={<Icon name="refresh"/>} disabled={busy} onClick={onRegenerate}>Regenerar</Button>}
   <Button size="sm" icon={<Icon name="up"/>} aria-pressed={message.feedback?.verdict==='up'} disabled={fbBusy} onClick={()=>void sendFeedback('up')}>Útil</Button>
   <Button size="sm" icon={<Icon name="down"/>} aria-pressed={message.feedback?.verdict==='down'} disabled={fbBusy} onClick={()=>setReasonOpen(v=>!v)}>No fue útil</Button>
   {csvError&&<span role="alert" className="agente-inline-error">No se pudo crear el archivo.</span>}
  </div>}
  {reasonOpen&&<div className="agente-chips" role="group" aria-label="¿Qué falló?">{REASONS.map(([k,l])=><Button key={k} size="sm" disabled={fbBusy} onClick={()=>void sendFeedback('down',k)}>{l}</Button>)}</div>}
  {message.feedback&&<p className="agente-fb" role="status">Gracias por tu opinión{message.feedback.persisted?'.':' (guardada solo en este navegador).'}</p>}
  {a.status==='unavailable'&&isLast&&<div><Button size="sm" icon={<Icon name="refresh"/>} disabled={busy} onClick={onRegenerate}>Reintentar</Button></div>}
 </div>;
}
