'use client';
import type {ExplorerQuestion} from '../../../../../packages/recommendations/explorer.mjs';
import {formatMinorUnits} from '../../../../../packages/metrics/money.mjs';
import {Button,LinkButton,Arrow} from '../ui/button';
import {KindBadge} from '../ui/kind-badge';
import styles from './query-card.module.css';

const missingLabels={basis:'base de los importes',currency:'moneda',period:'periodo',published_scope:'publicación y alcance',measure:'medida financiera'};
const suggestions=['¿Qué reembolsos constan en este corte?','¿Cuánto se registró en órdenes en este periodo?','¿Cuál es la cobertura de los importes?'];
export function QueryCard({question,onChange,onSubmit,busy,answer}:{question:string;onChange:(value:string)=>void;onSubmit:()=>void;busy:boolean;answer:ExplorerQuestion|null}){
 return <section className={styles.card} aria-label="Consulta tus datos">
  <header className={styles.header}><div><span className={styles.caption}>CONSULTA EJECUTIVA</span><h2>Pregunta a tus datos</h2></div><span className={styles.badge}>Sólo lectura</span></header>
  {answer?<div className={styles.conversation} aria-live="polite">
   <p className={styles.question}>{answer.question}</p>
   <section className={styles.answer} aria-label="Respuesta de la consulta"><h3>{answer.status==='answered'?'Esto muestran los datos':answer.status==='clarification_required'?'Necesito un poco más de contexto':answer.status==='abstained'?'La evidencia no permite esa conclusión':'Esta consulta necesita otros datos'}</h3>
    <p>{answer.message}</p>{answer.answer&&<p className={styles.lead}>{answer.answer}</p>}
    {answer.missing.length>0&&<p>Falta precisar: {answer.missing.map(key=>missingLabels[key]).join(', ')}.</p>}
    {answer.metrics.length>0&&<dl className={styles.metrics}>{answer.metrics.map((metric,i)=><div key={i}><dt>{metric.label} <KindBadge metric={metric}/></dt><dd>{metric.amount_minor===null?'Desconocido':formatMinorUnits(metric.amount_minor,metric.currency,metric.exponent)}{metric.amount_minor===null&&metric.known_subtotal!==null&&<small>Subtotal conocido: {formatMinorUnits(metric.known_subtotal,metric.currency,metric.exponent)}; no es el total.</small>}</dd></div>)}</dl>}
    {answer.coverage&&<p className={styles.coverage}>Cobertura: {answer.coverage}</p>}
    {answer.references.length>0&&<details className={styles.references}><summary>Ver fuentes ({answer.references.length})</summary><ul>{answer.references.map((reference,i)=><li key={reference.sourceRef+':'+i}><span className={styles.refText}><span>{reference.label}</span><code title={reference.sourceRef}>{reference.sourceRef}</code></span>{reference.href.startsWith('/')&&!reference.href.startsWith('//')&&<LinkButton href={reference.href} size="sm" icon={<Arrow/>}>Ver detalle</LinkButton>}</li>)}</ul></details>}
   </section>
  </div>:<div className={styles.empty}><p>Consulta los importes y la cobertura de la publicación seleccionada. Cada respuesta conserva sus fuentes y cada cita enlaza a su origen.</p><div className={styles.suggestions} role="group" aria-label="Preguntas sugeridas">{suggestions.map(text=><Button key={text} size="sm" disabled={busy} onClick={()=>onChange(text)}>{text}</Button>)}</div></div>}
  <form className={styles.composer} aria-label="Consulta ejecutiva" onSubmit={event=>{event.preventDefault();if(!busy&&question.trim())onSubmit();}}>
   <label htmlFor="explorer-question">Tu pregunta</label><div className={styles.inputRow}><textarea id="explorer-question" value={question} onChange={event=>onChange(event.target.value)} required maxLength={2000} rows={2} placeholder="¿Qué reembolsos constan en este corte?"/><Button type="submit" variant="primary" loading={busy} disabled={!question.trim()} aria-label="Consultar datos" icon={<Arrow/>}>Consultar</Button></div>
   <details className={styles.limit}><summary>Alcance de las respuestas</summary><p>Consulta determinística: muestra datos verificables del alcance seleccionado. Una comparación o una explicación causal necesita evidencia adicional. No ejecuta acciones externas.</p></details>
  </form>
 </section>;
}
