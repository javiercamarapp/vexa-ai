import type {ReactNode} from 'react';
import {Icon} from './icons';
export type Severity='high'|'medium'|'low'|'info';
const SEV:Record<Severity,string>={high:'Alta',medium:'Media',low:'Baja',info:'Información'};
/** AI-style insight with evidence: severity chip, one sentence with the exact figure in bold, up to 3 signals, a tinted recommendation, citations and ONE primary action. */
export function InsightCard({severity='info',eyebrow='Hallazgo',title,sentence,signals,recommendation,footer,action,highlight=false}:{severity?:Severity;eyebrow?:string;title:string;sentence?:ReactNode;signals?:{text:ReactNode;icon?:string}[];recommendation?:ReactNode;footer?:ReactNode;action?:ReactNode;highlight?:boolean}){
 return <article className="card insight" data-severity={severity} data-highlight={highlight||undefined}>
  <header className="insight-head"><span className="insight-icon" aria-hidden="true"><Icon name="sparkle" size={16}/></span><div className="insight-titles"><span className="insight-eyebrow">{eyebrow}</span><h3>{title}</h3></div><span className="status-chip" data-tone={severity==='high'?'bad':severity==='medium'?'warn':severity==='low'?'ok':'info'}><i/>Prioridad {SEV[severity].toLowerCase()}</span></header>
  {sentence&&<p className="insight-sentence">{sentence}</p>}
  {signals&&signals.length>0&&<ul className="insight-signals">{signals.slice(0,3).map((s,i)=><li key={i}><Icon name={s.icon??'trend'} size={14}/><span>{s.text}</span></li>)}</ul>}
  {recommendation&&<div className="insight-reco"><span>Recomendación</span><p>{recommendation}</p></div>}
  {(footer||action)&&<footer className="insight-foot">{footer&&<div className="insight-cites">{footer}</div>}{action}</footer>}
 </article>;
}
