'use client';
import {ConMarca} from '../ui/brand-mark';
import {useEffect,useState} from 'react';
import {useReducedMotion} from '../ui/browser-state';
import {useT} from '../i18n/proveedor';
import type {Clave} from '../../lib/i18n';
import {Ctl,CtlLink} from './ctl';
import {Citation} from '../ui/citation';
import {IdChip} from '../ui/id-chip';
import {answerToHtml,answerToMarkdown,blockToCsv} from '../../../../../packages/agent-datos/export.mjs';
import {Icon} from './icons';
import {RovaqMark} from './rovaq-mark';
import {PARAM_CLAVES,copyText,download,openReport,paramValue,safeInternal} from './format';
import {BlockView,Kpis} from './blocks';
import {TraceDisclosure} from './trace';
import type {Answer,ChatMessage} from './types';

const REASONS:[string,Clave][]=[['incorrecto','ag.rIncorrecto'],['incompleto','ag.rIncompleto'],['sin_fuente','ag.rSinFuente'],['otro','ag.rOtro']];
const NOTICE:Partial<Record<Answer['status'],Clave>>={rate_limited:'ag.nRate',budget_exceeded:'ag.nBudget',forbidden:'ag.nForbidden',unavailable:'ag.nUnavailable',invalid_input:'ag.nInvalid'};
const isAlert=(s:Answer['status'])=>['rate_limited','budget_exceeded','forbidden','unavailable','invalid_input'].includes(s);

function CalcView({answer}:{answer:Answer}){
 const tx=useT();
 return <details className="agente-calc"><summary className="ctl">{tx('ag.verCalculo')}</summary>
  <ol className="agente-calc-list" aria-label={tx('ag.pasosCalculo')}>
   {answer.calc.map((c,i)=><li key={i} className="agente-calc-step">
    <h4>{c.label}</h4>
    <dl className="agente-dl"><div><dt>{tx('ag.cHerr')}</dt><dd><IdChip value={c.tool} text={c.tool}/></dd></div>
     <div><dt>{tx('ag.parametros')}</dt><dd>{Object.keys(c.args).length?<ul className="agente-params">{Object.entries(c.args).map(([k,v])=><li key={k}><span>{PARAM_CLAVES[k]?tx(PARAM_CLAVES[k]):k}</span> {paramValue(k,v)}</li>)}</ul>:tx('ag.cSinParam')}<IdChip value={JSON.stringify(c.args)} label="JSON" text={tx('ag.cCopiar')}/></dd></div>
     <div><dt>{tx('ag.metodo')}</dt><dd>{c.method}</dd></div>
     <div><dt>{tx('ag.cLee')}</dt><dd><ul className="agente-params">{c.reads.map(r=><li key={r}>{r}</li>)}</ul></dd></div>
     <div><dt>{tx('ag.fuentes')}</dt><dd className="agente-sources">{c.sources.map(s=><span className="chip" key={s.ref} title={s.ref}><ConMarca marca={s.label}>{s.label}</ConMarca></span>)}</dd></div>
     <div><dt>{tx('ag.resultado')}</dt><dd>{c.status==='ok'?tx('ag.nCifras',{n:c.figures}):tx('ag.sinDatos')}{c.durationMs!==undefined?` · ${c.durationMs} ms`:''}</dd></div>
    </dl></li>)}
  </ol>
  <p className="card-lead agente-note">{tx('ag.cModo',{modo:answer.usage.mode==='deterministic'?tx('ag.cModoDet'):tx('ag.cModoMixto'),n:answer.usage.modelCalls,costo:answer.usage.costMinor==='0'?'0':(Number(answer.usage.costMinor)/1e6).toLocaleString('es-MX',{maximumFractionDigits:6})+' USD'})}</p>
 </details>;
}

export function AnswerView({message,question,isLast,busy,labels,userContext,escribir=false,onAsk,onRegenerate,onFeedback}:{escribir?:boolean;message:ChatMessage;question:string;labels:Record<string,string>;userContext:string[];isLast:boolean;busy:boolean;onAsk:(q:string)=>void;onRegenerate:()=>void;onFeedback:(id:string,v:ChatMessage['feedback'])=>void}){
 const tx=useT();
 const [copied,setCopied]=useState(false),[csvError,setCsvError]=useState(false),[reasonOpen,setReasonOpen]=useState(false),[fbBusy,setFbBusy]=useState(false);
 const a=message.answer;
 const reducido=useReducedMotion();
 const [escrito,setEscrito]=useState(escribir?0:Infinity);
 useEffect(()=>{
  // Escritura progresiva: máx. 4.5 s aunque la respuesta sea larga (≥ 60 caracteres/s); con «reducir movimiento» sale completa.
  const largo=a?.text?.length??0;if(!escribir||!largo||reducido)return;
  const ritmo=Math.max(0.06,largo/4500),t0=performance.now();let raf=0;
  const paso=(t:number)=>{const n=Math.min(largo,Math.floor((t-t0)*ritmo));setEscrito(n>=largo?Infinity:n);if(n<largo)raf=requestAnimationFrame(paso);};
  raf=requestAnimationFrame(paso);return()=>cancelAnimationFrame(raf);
 },[escribir,a?.text,reducido]);
 const listo=!escribir||reducido||!a?.text?.length||escrito===Infinity;
 if(message.cancelled)return <p className="agente-cancelled">{tx('ag.cancelado')}</p>;
 if(!a)return null;
 const ok=a.status==='ok'||a.status==='no_data';
 const notice=NOTICE[a.status]?tx(NOTICE[a.status]!):undefined;
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
  {listo&&(a.status==='clarify'||a.status==='out_of_catalog'||a.status==='budget_exceeded')&&a.suggestions.length>0&&<div className="agente-chips" role="group" aria-label={tx('ag.sugRespondo')}>{a.suggestions.slice(0,3).map(q=><Ctl key={q} className="ctl-q" title={q} disabled={busy} onClick={()=>onAsk(q)}>{q}</Ctl>)}</div>}
  {listo&&a.status==='ok'&&a.figures.filter(f=>f.rank===undefined).length>0&&<Kpis figures={a.figures.filter(f=>f.rank===undefined).slice(0,4)}/>}
  {listo&&a.status==='ok'&&blocksWithRows.map((b,i)=><BlockView key={b.tool+i} block={b}/>)}
  {listo&&a.status==='ok'&&a.citations.length>0&&<section className="agente-citations" aria-label={tx('ag.citasVerif')}><p className="eyebrow" role="heading" aria-level={3}>{tx('ag.citasVerif')}</p>{a.citations.map(c=><Citation key={c.messageRevisionId} quote={c.quote} role={c.role} messageRevisionId={c.messageRevisionId} category={c.category} source={c.source}/>)}</section>}
  {listo&&message.citationsOmitted&&<p className="card-lead agente-note">{tx('ag.citasOmitidas')}</p>}
  {listo&&a.missing.length>0&&ok&&<section className="agente-missing card" aria-label={tx('ag.queFalta')}><p className="eyebrow" role="heading" aria-level={3}>{tx('ag.queFalta')}</p><ul>{a.missing.map(m=><li key={m}>{m}</li>)}</ul>{a.missing.some(m=>!/vincul/i.test(m))&&<CtlLink href="/imports" icon={<Icon name="arrow"/>}>{tx('ag.irImport')}</CtlLink>}{a.missing.some(m=>/vincul/i.test(m))&&<CtlLink href="/history" icon={<Icon name="arrow"/>}>{tx('ag.verVinculos')}</CtlLink>}</section>}
  {listo&&a.status==='ok'&&a.sources.length>0&&<div className="agente-sources" aria-label={tx('ag.fuentes')}><span className="agente-sources-label">{tx('ag.fuentes')}</span>{a.sources.map(s=>{const href=safeInternal(s.href);return href?<CtlLink key={s.ref} href={href} icon={<Icon name="arrow"/>}>{s.label}</CtlLink>:<span className="chip" key={s.ref}><ConMarca marca={s.label}>{s.label}</ConMarca></span>;})}</div>}
  {a.notes&&a.notes.length>0&&ok&&a.notes.map(n=><p key={n} className="card-lead agente-note">{n}</p>)}
  {listo&&ok&&a.trace&&a.trace.length>0&&<TraceDisclosure trace={a.trace} labels={labels}/>}
  {listo&&ok&&a.calc.length>0&&<CalcView answer={a}/>}
  {listo&&a.status==='ok'&&a.text.trim()&&<div className="agente-actions" role="group" aria-label={tx('ag.accionesAria')}>
   <Ctl icon={<Icon name={copied?'check':'copy'}/>} onClick={()=>void copy()}>{copied?tx('ag.copiado'):tx('ag.copiar')}</Ctl>
   {blocksWithRows.map((b,i)=><Ctl key={b.tool+i} icon={<Icon name="sheet"/>} aria-label={blocksWithRows.length>1?tx('ag.csvDe',{t:b.title}):tx('ag.csvAria')} onClick={()=>setCsvError(!download(`rovaq-${b.tool}.csv`,blockToCsv(b),'text/csv;charset=utf-8'))}>{blocksWithRows.length>1?tx('ag.csvTit',{t:b.title}):'CSV'}</Ctl>)}
   <Ctl icon={<Icon name="report"/>} title={tx('ag.reporteTip')} onClick={()=>{const html=answerToHtml({question,answer:a,userContext});if(!openReport(`rovaq-reporte-${message.id}.html`,html))setCsvError(true);}}>{tx('ag.reporte')}</Ctl>
   <Ctl icon={<Icon name="download"/>} onClick={()=>download(`rovaq-respuesta-${message.id}.md`,answerToMarkdown({question,answer:a}),'text/markdown;charset=utf-8')}>{tx('ag.exportar')}</Ctl>
   {isLast&&<Ctl solo icon={<Icon name="refresh"/>} disabled={busy} onClick={onRegenerate}>{tx('ag.regenerar')}</Ctl>}
   <Ctl solo icon={<Icon name="up"/>} aria-pressed={message.feedback?.verdict==='up'} disabled={fbBusy} onClick={()=>void sendFeedback('up')}>{tx('ag.util')}</Ctl>
   <Ctl solo icon={<Icon name="down"/>} aria-pressed={message.feedback?.verdict==='down'} disabled={fbBusy} onClick={()=>setReasonOpen(v=>!v)}>{tx('ag.noUtil')}</Ctl>
   {csvError&&<span role="alert" className="agente-inline-error">{tx('ag.noArchivo')}</span>}
  </div>}
  {reasonOpen&&<div className="agente-chips" role="group" aria-label={tx('ag.queFallo')}>{REASONS.map(([k,l])=><Ctl key={k} disabled={fbBusy} onClick={()=>void sendFeedback('down',k)}>{tx(l)}</Ctl>)}</div>}
  {message.feedback&&<p className="agente-fb" role="status">{tx('ag.gracias')}{message.feedback.persisted?'.':tx('ag.graciasLocal')}</p>}
  {a.status==='unavailable'&&isLast&&<div><Ctl variant="soft" icon={<Icon name="refresh"/>} disabled={busy} onClick={onRegenerate}>{tx('ag.reintentar')}</Ctl></div>}
 </div>;
}
