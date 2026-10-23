import type {ReactNode} from 'react';
import Link from '../workspace/navigation-lifecycle';
import {KindBadge} from './kind-badge';
import type {EpistemicKind} from '../../lib/epistemic.mjs';
export type BarListItem={key:string;label:string;value:number|null;display:string;kind?:EpistemicKind;href?:string;note?:ReactNode;/** 1..8: color fijo de la métrica (sustituye el gris de la clase) */c?:number};
/** Ranking: label left, exact value right, 8 px bar below (one hue per series, anchored at zero). Unknown values show a hatched track, never a zero bar. */
export function BarList({items,max,empty='Sin datos para clasificar.',wrap=false,sinMeta=false}:{items:BarListItem[];max?:number;empty?:string;wrap?:boolean;/** sin insignia de clase por fila (la lleva el encabezado de la tarjeta) */sinMeta?:boolean}){
 if(!items.length)return <p className="state">{empty}</p>;
 const top=max??(Math.max(0,...items.map(i=>i.value??0))||1);
 return <ul className="barlist" data-wrap={wrap||undefined}>{items.map((it,i)=>{const w=it.value===null?0:Math.max(it.value>0?1.5:0,it.value*100/top);
  const head=<><span className="barlist-label" title={it.label}>{it.label}</span><span className="barlist-value">{it.display}</span></>;
  return <li key={it.key} className="barlist-row">
   {it.href?<Link href={it.href} className="barlist-head barlist-link">{head}</Link>:<div className="barlist-head">{head}</div>}
   <div className="barlist-track" data-unknown={it.value===null||undefined}>{it.value!==null&&<span className={'barlist-fill bar-'+(it.kind??'observed')} style={{width:w+'%',animationDelay:i*40+'ms',...(it.c?{background:`var(--chart-${((it.c-1)%8)+1})`}:{})}}/>}</div>
   {((it.kind&&!sinMeta)||it.note)&&<div className="barlist-meta">{it.kind&&!sinMeta&&<KindBadge kind={it.kind}/>}{it.note&&<span>{it.note}</span>}</div>}
  </li>;})}</ul>;
}
