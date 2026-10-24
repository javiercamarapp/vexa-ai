'use client';
import type {ExplorerQuestion} from '../../../../../packages/recommendations/explorer.mjs';
import {formatMinorUnits} from '../../../../../packages/metrics/money.mjs';
import {Button,LinkButton,Arrow} from '../ui/button';
import {KindBadge} from '../ui/kind-badge';
import {SourceRef} from '../ui/source-ref';
import {Icon} from '../ui/icons';
import styles from './query-card.module.css';

const missingLabels={basis:'base de los importes',currency:'moneda',period:'periodo',published_scope:'publicación y alcance',measure:'medida financiera'};
const suggestions=['¿Qué reembolsos constan en este corte?','¿Cuánto se registró en órdenes en este periodo?','¿Cuál es la cobertura de los importes?'];
const headline=(status:ExplorerQuestion['status'])=>status==='answered'?'Esto muestran los datos':status==='clarification_required'?'Necesito un poco más de contexto':status==='abstained'?'La evidencia no permite esa conclusión':'Esta consulta necesita otros datos';
/** «Consultar» lleva al chat «Pregúntale a tus datos» con la pregunta ya enviada: ahí vive el agente, con su pensamiento en vivo y su respuesta. */
const alChat=(q:string)=>{const t=q.trim();if(t)window.location.assign('/preguntale?enviar=1&q='+encodeURIComponent(t.slice(0,2000)));};
export function QueryCard({question,onChange,onSubmit,busy,answer}:{question:string;onChange:(value:string)=>void;onSubmit:()=>void;busy:boolean;answer:ExplorerQuestion|null}){
 return <section className={styles.card} aria-label="Consulta tus datos">
  <form className={styles.composer} aria-label="Consulta ejecutiva" onSubmit={event=>{event.preventDefault();alChat(question);}}>
   <label htmlFor="explorer-question" className="sr-only">Tu pregunta</label>
   <div className={styles.inputRow}>
    <span className={styles.spark} aria-hidden="true"><Icon name="sparkle" size={16}/></span>
    <textarea id="explorer-question" value={question} onChange={event=>onChange(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();alChat(question);}}} required maxLength={2000} rows={1} placeholder="Pregunta a tus datos: ¿qué reembolsos constan en este corte?"/>
    <span className={styles.ro} title="Consulta determinística de solo lectura: muestra datos verificables del alcance seleccionado y no ejecuta acciones externas."><Icon name="lock" size={12}/>Solo lectura</span>
    <Button type="submit" variant="primary" size="sm" disabled={!question.trim()} aria-label="Consultar datos en el chat" icon={<Arrow/>}>Consultar</Button>
   </div>
   <div className={styles.suggestions} role="group" aria-label="Preguntas sugeridas">{suggestions.map(text=><Button key={text} size="sm" variant="secondary" className={styles.chip} onClick={()=>alChat(text)}>{text}</Button>)}</div>
  </form>
  {answer&&<div className={styles.conversation} aria-live="polite">
   <p className={styles.question}>{answer.question}</p>
   <section className={styles.answer} aria-label="Respuesta de la consulta" data-status={answer.status}><h3>{headline(answer.status)}</h3>
    <p>{answer.message}</p>{answer.answer&&<p className={styles.lead}>{answer.answer}</p>}
    {answer.missing.length>0&&<p>Falta precisar: {answer.missing.map(key=>missingLabels[key]).join(', ')}.</p>}
    {answer.metrics.length>0&&<dl className={styles.metrics}>{answer.metrics.map((metric,i)=><div key={i}><dt>{metric.label} <KindBadge metric={metric}/></dt><dd>{metric.amount_minor===null?'Desconocido':formatMinorUnits(metric.amount_minor,metric.currency,metric.exponent)}{metric.amount_minor===null&&metric.known_subtotal!==null&&<small>Subtotal conocido: {formatMinorUnits(metric.known_subtotal,metric.currency,metric.exponent)}; no es el total.</small>}</dd></div>)}</dl>}
    {answer.coverage&&<p className={styles.coverage}>Cobertura: {answer.coverage}</p>}
    {answer.references.length>0&&<details className={styles.references}><summary>Ver fuentes ({answer.references.length})</summary><ul>{answer.references.map((reference,i)=><li key={reference.sourceRef+':'+i}><span className={styles.refText}><span>{reference.label}</span><SourceRef value={reference.sourceRef}/></span>{reference.href.startsWith('/')&&!reference.href.startsWith('//')&&<LinkButton href={reference.href} size="sm" icon={<Arrow/>}>Ver detalle</LinkButton>}</li>)}</ul></details>}
   </section>
  </div>}
 </section>;
}
