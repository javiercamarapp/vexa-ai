'use client';
import {useState} from 'react';
import {Button,LinkButton} from '../ui/button';
import {BarChart} from '../ui/bar-chart';
import {Citation} from '../ui/citation';
import {IdChip} from '../ui/id-chip';
import {KindBadge} from '../ui/kind-badge';
import {answerToMarkdown,blockToCsv} from '../../../../../packages/agent-datos/export.mjs';
import {Icon} from './icons';
import {PARAM_LABELS,copyText,coverageText,download,fmtCell,paramValue,safeInternal} from './format';
import type {Answer,Block,ChatMessage,Figure} from './types';

const REASONS:[string,string][]=[['incorrecto','Incorrecto'],['incompleto','Incompleto'],['sin_fuente','Sin fuente'],['otro','Otro']];
const NOTICE:Partial<Record<Answer['status'],string>>={rate_limited:'Muchas preguntas seguidas.',budget_exceeded:'Se alcanzó el tope de IA de tu organización este mes; lo amplía tu administrador.',forbidden:'Tu rol no tiene acceso a estas consultas.',unavailable:'No disponible por ahora.',invalid_input:'No pude leer esa pregunta.'};
const isAlert=(s:Answer['status'])=>['rate_limited','budget_exceeded','forbidden','unavailable','invalid_input'].includes(s);

function ClassTag({block}:{block:Block}){return block.class==='mixed'?<span className="chip" title="Cada fila indica si es Observado, Estimado o Inferido en la columna «Clase».">Clase por fila</span>:<KindBadge kind={block.class}/>;}

function DataTable({block}:{block:Block}){
 const rows=block.rows;
 return <div className="table-wrap" tabIndex={0} role="region" aria-label={'Tabla: '+block.title}><table><thead><tr>{block.columns.map(c=><th key={c.key} scope="col" className={c.kind==='integer'?'num':undefined}>{c.label}</th>)}</tr></thead>
  <tbody>{rows.map((r,i)=><tr key={i}>{block.columns.map((c,j)=>j===0?<th key={c.key} scope="row">{fmtCell(c.kind,r[c.key])}</th>:<td key={c.key} className={c.kind==='integer'?'num':undefined}>{fmtCell(c.kind,r[c.key])}</td>)}</tr>)}</tbody></table></div>;
}
function BlockView({block}:{block:Block}){
 const chart=block.chart;
 const kind=block.class==='mixed'?'observed':block.class;
 return <section className="card agente-block" aria-label={block.title}>
  <div className="agente-block-head"><h3>{block.title}</h3><span className="agente-block-tags"><ClassTag block={block}/><span className="chip agente-cov" title="Cuánto de lo elegible respalda esta cifra.">{coverageText(block.coverage)}</span></span></div>
  {chart?<><BarChart title={chart.unit} unit="" data={chart.series.map(s=>({key:s.key,label:s.label,value:s.value,display:s.display,kind}))}/><details className="trend-table"><summary>Ver como tabla</summary><DataTable block={block}/></details></>:<DataTable block={block}/>}
  {block.note&&<p className="card-lead agente-note">{block.note}</p>}
  {block.truncated&&<p className="card-lead agente-note">Hay más filas en el sistema que las mostradas.</p>}
 </section>;
}
function FigureCards({figures}:{figures:Figure[]}){
 return <ul className="agente-figures" aria-label="Cifras de la respuesta">{figures.map(f=><li key={f.id} className="component-card"><h4>{f.label}</h4><p className="component-amount">{f.display}</p><span className="agente-block-tags"><KindBadge kind={f.class}/><span className="chip">{coverageText(f.coverage)}</span></span></li>)}</ul>;
}
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

export function AnswerView({message,question,isLast,busy,onAsk,onRegenerate,onFeedback}:{message:ChatMessage;question:string;isLast:boolean;busy:boolean;onAsk:(q:string)=>void;onRegenerate:()=>void;onFeedback:(id:string,v:ChatMessage['feedback'])=>void}){
 const [copied,setCopied]=useState(false),[csvError,setCsvError]=useState(false),[reasonOpen,setReasonOpen]=useState(false),[fbBusy,setFbBusy]=useState(false);
 const a=message.answer;
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
   <span className="agente-mark agente-mark-sm" aria-hidden="true"><Icon name="spark" size={14}/></span>
   {isAlert(a.status)||a.status==='clarify'||a.status==='out_of_catalog'?<div className={'state'+(isAlert(a.status)?' state-error':'')} role={isAlert(a.status)?'alert':undefined}><p className="agente-state-line"><Icon name={isAlert(a.status)?'alert':'info'} size={16}/>{a.text||notice}</p></div>:<p className="agente-text">{a.text}</p>}
  </div>
  {(a.status==='clarify'||a.status==='out_of_catalog'||a.status==='budget_exceeded')&&a.suggestions.length>0&&<div className="agente-chips" role="group" aria-label="Preguntas que sí puedo responder">{a.suggestions.slice(0,3).map(q=><Button key={q} size="sm" disabled={busy} onClick={()=>onAsk(q)}>{q}</Button>)}</div>}
  {a.status==='ok'&&blocksWithRows.length===0&&a.figures.length>0&&<FigureCards figures={a.figures.slice(0,4)}/>}
  {a.status==='ok'&&blocksWithRows.map((b,i)=><BlockView key={b.tool+i} block={b}/>)}
  {a.status==='ok'&&a.citations.length>0&&<section className="agente-citations" aria-label="Citas verificables"><p className="eyebrow" role="heading" aria-level={3}>Citas verificables</p>{a.citations.map(c=><Citation key={c.messageRevisionId} quote={c.quote} role={c.role} messageRevisionId={c.messageRevisionId} category={c.category} source={c.source}/>)}</section>}
  {message.citationsOmitted&&<p className="card-lead agente-note">Las citas de clientes no se guardan en el historial de este navegador; vuelve a preguntar para verlas.</p>}
  {a.missing.length>0&&ok&&<section className="agente-missing card" aria-label="Qué falta cargar"><p className="eyebrow" role="heading" aria-level={3}>Qué falta cargar</p><ul>{a.missing.map(m=><li key={m}>{m}</li>)}</ul><LinkButton href="/imports" size="sm" icon={<Icon name="arrow"/>}>Ir a Importaciones</LinkButton></section>}
  {a.status==='ok'&&a.sources.length>0&&<div className="agente-sources" aria-label="Fuentes"><span className="agente-sources-label">Fuentes</span>{a.sources.map(s=>{const href=safeInternal(s.href);return href?<LinkButton key={s.ref} href={href} size="sm" icon={<Icon name="arrow"/>}>{s.label}</LinkButton>:<span className="chip" key={s.ref}>{s.label}</span>;})}</div>}
  {ok&&a.calc.length>0&&<CalcView answer={a}/>}
  {a.status==='ok'&&a.text.trim()&&<div className="agente-actions" role="group" aria-label="Acciones de la respuesta">
   <Button size="sm" icon={<Icon name={copied?'check':'copy'}/>} onClick={()=>void copy()}>{copied?'Copiado':'Copiar'}</Button>
   {blocksWithRows.map((b,i)=><Button key={b.tool+i} size="sm" icon={<Icon name="sheet"/>} aria-label={blocksWithRows.length>1?`Descargar CSV de ${b.title}`:'Descargar CSV'} onClick={()=>setCsvError(!download(`vexa-${b.tool}.csv`,blockToCsv(b),'text/csv;charset=utf-8'))}>{blocksWithRows.length>1?`CSV: ${b.title}`:'CSV'}</Button>)}
   <Button size="sm" icon={<Icon name="download"/>} onClick={()=>download(`vexa-respuesta-${message.id}.md`,answerToMarkdown({question,answer:a}),'text/markdown;charset=utf-8')}>Exportar</Button>
   {isLast&&<Button size="sm" icon={<Icon name="refresh"/>} disabled={busy} onClick={onRegenerate}>Regenerar</Button>}
   <Button size="sm" icon={<Icon name="up"/>} aria-pressed={message.feedback?.verdict==='up'} disabled={fbBusy} onClick={()=>void sendFeedback('up')}>Útil</Button>
   <Button size="sm" icon={<Icon name="down"/>} aria-pressed={message.feedback?.verdict==='down'} disabled={fbBusy} onClick={()=>setReasonOpen(v=>!v)}>No fue útil</Button>
   {csvError&&<span role="alert" className="agente-inline-error">No se pudo crear el archivo CSV.</span>}
  </div>}
  {reasonOpen&&<div className="agente-chips" role="group" aria-label="¿Qué falló?">{REASONS.map(([k,l])=><Button key={k} size="sm" disabled={fbBusy} onClick={()=>void sendFeedback('down',k)}>{l}</Button>)}</div>}
  {message.feedback&&<p className="agente-fb" role="status">Gracias por tu opinión{message.feedback.persisted?'.':' (guardada solo en este navegador).'}</p>}
  {a.status==='unavailable'&&isLast&&<div><Button size="sm" icon={<Icon name="refresh"/>} disabled={busy} onClick={onRegenerate}>Reintentar</Button></div>}
 </div>;
}
