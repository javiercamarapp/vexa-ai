'use client';
import {useRouter} from 'next/navigation';
import {useT} from '../i18n/proveedor';
import type {Clave} from '../../lib/i18n';
import type {ExplorerQuestion} from '../../../../../packages/recommendations/explorer.mjs';
import {formatMinorUnits} from '../../lib/formato/dinero-pantalla.mjs';
import {Button,LinkButton,Arrow} from '../ui/button';
import {KindBadge} from '../ui/kind-badge';
import {SourceRef} from '../ui/source-ref';
import {Icon} from '../ui/icons';
import styles from './query-card.module.css';

const missingLabels:Record<string,Clave>={basis:'exp.qBase',currency:'exp.qMoneda',period:'exp.qPeriodo',published_scope:'exp.qPubAlcance',measure:'exp.qMedida'};
const suggestions=['¿Qué reembolsos constan en este corte?','¿Cuánto se registró en órdenes en este periodo?','¿Cuál es la cobertura de los importes?'];
const headline=(status:ExplorerQuestion['status']):Clave=>status==='answered'?'exp.qHAnswered':status==='clarification_required'?'exp.qHClarif':status==='abstained'?'exp.qHAbstained':'exp.qHOtro';
/** «Consultar» lleva al chat «Pregúntale a tus datos» con la pregunta ya enviada: ahí vive el agente, con su pensamiento en vivo y su respuesta. */
export function QueryCard({question,onChange,answer}:{question:string;onChange:(value:string)=>void;onSubmit:()=>void;busy:boolean;answer:ExplorerQuestion|null}){
 const router=useRouter(),tx=useT();
 const alChat=(q:string)=>{const t=q.trim();if(t)router.push('/preguntale?enviar=1&q='+encodeURIComponent(t.slice(0,2000)));};
 return <section className={styles.card} aria-label={tx('exp.qConsulta')}>
  <form className={styles.composer} aria-label={tx('exp.qForm')} onSubmit={event=>{event.preventDefault();alChat(question);}}>
   <label htmlFor="explorer-question" className="sr-only">{tx('exp.qTuPregunta')}</label>
   <div className={styles.inputRow}>
    <span className={styles.spark} aria-hidden="true"><Icon name="sparkle" size={16}/></span>
    <textarea id="explorer-question" value={question} onChange={event=>onChange(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();alChat(question);}}} required maxLength={2000} rows={1} placeholder={tx('exp.qPlaceholder')}/>
    <span className={styles.ro} title={tx('exp.qSoloLecturaTip')}><Icon name="lock" size={12}/>{tx('exp.qSoloLectura')}</span>
    <Button type="submit" variant="primary" size="sm" disabled={!question.trim()} aria-label={tx('exp.qConsultarAria')} icon={<Arrow/>}>{tx('exp.qConsultar')}</Button>
   </div>
   <div className={styles.suggestions} role="group" aria-label={tx('exp.qSugAria')}>{suggestions.map(text=><Button key={text} size="sm" variant="secondary" className={styles.chip} onClick={()=>alChat(text)}>{text}</Button>)}</div>
  </form>
  {answer&&<div className={styles.conversation} aria-live="polite">
   <p className={styles.question}>{answer.question}</p>
   <section className={styles.answer} aria-label={tx('exp.qRespAria')} data-status={answer.status}><h3>{tx(headline(answer.status))}</h3>
    <p>{answer.message}</p>{answer.answer&&<p className={styles.lead}>{answer.answer}</p>}
    {answer.missing.length>0&&<p>{tx('exp.qFalta',{x:answer.missing.map(key=>missingLabels[key]?tx(missingLabels[key]):key).join(', ')})}</p>}
    {answer.metrics.length>0&&<dl className={styles.metrics}>{answer.metrics.map((metric,i)=><div key={i}><dt>{metric.label} <KindBadge metric={metric}/></dt><dd>{metric.amount_minor===null?tx('exp.desconocido'):formatMinorUnits(metric.amount_minor,metric.currency,metric.exponent)}{metric.amount_minor===null&&metric.known_subtotal!==null&&<small>{tx('exp.subtotalConocido',{x:formatMinorUnits(metric.known_subtotal,metric.currency,metric.exponent)})}</small>}</dd></div>)}</dl>}
    {answer.coverage&&<p className={styles.coverage}>{tx('exp.qCobertura',{x:answer.coverage})}</p>}
    {answer.references.length>0&&<details className={styles.references}><summary>{tx('exp.qVerFuentes',{n:answer.references.length})}</summary><ul>{answer.references.map((reference,i)=><li key={reference.sourceRef+':'+i}><span className={styles.refText}><span>{reference.label}</span><SourceRef value={reference.sourceRef}/></span>{reference.href.startsWith('/')&&!reference.href.startsWith('//')&&<LinkButton href={reference.href} size="sm" icon={<Arrow/>}>{tx('exp.verDetalle')}</LinkButton>}</li>)}</ul></details>}
   </section>
  </div>}
 </section>;
}
