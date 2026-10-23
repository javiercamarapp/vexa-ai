import type {ReactNode} from 'react';
import Link from '../workspace/navigation-lifecycle';
import {KindBadge} from './kind-badge';
import {Sparkline} from './sparkline';
import {Icon} from './icons';
import type {KindOrNoData} from '../../lib/epistemic.mjs';
export type Delta={value:string;dir:'up'|'down'|'flat';good?:'up'|'down'};
/** ▲/▼ chip: colour says good/bad, the arrow and the text say direction (never colour alone). */
export function DeltaChip({delta,label}:{delta:Delta;label?:string}){
 const good=delta.dir==='flat'?'flat':delta.dir===(delta.good??'up')?'good':'bad';
 return <span className="delta" data-tone={good} title={label}><Icon name={delta.dir==='up'?'arrow-up':delta.dir==='down'?'arrow-down':'minus'} size={11}/>{delta.value}{label&&<span className="sr-only"> {label}</span>}</span>;
}
/** KPI tile: icon, label, epistemic badge, exact value (any node, e.g. CountUpMoney), optional delta + sparkline, footer note. */
export function StatCard({label,value,kind,delta,deltaLabel,spark,sparkLabel,foot,icon='dollar',href,highlight=false,tone,kindHint,children}:{label:string;kindHint?:string;value:ReactNode;kind?:KindOrNoData;delta?:Delta;deltaLabel?:string;spark?:number[];sparkLabel?:string;foot?:ReactNode;icon?:string;href?:string;highlight?:boolean;tone?:'up'|'down';children?:ReactNode}){
 const body=<>
  <div className="stat-head"><span className="stat-icon" aria-hidden="true"><Icon name={icon} size={16}/></span><span className="stat-label">{label}</span></div>
  <div className="stat-main"><div className="stat-value">{value}</div>{spark&&spark.length>1&&<Sparkline data={spark} label={sparkLabel??'Tendencia'} tone={tone??'auto'}/>}</div>
  {(delta||foot||kind)&&<div className="stat-foot">{delta&&<DeltaChip delta={delta} label={deltaLabel}/>}{foot&&<span className="stat-note">{foot}</span>}{kind&&<KindBadge kind={kind} hint={kindHint}/>}</div>}
  {children}
 </>;
 return href?<Link href={href} className="card stat-card" data-lift data-highlight={highlight||undefined}>{body}</Link>:<article className="card stat-card" data-highlight={highlight||undefined}>{body}</article>;
}
