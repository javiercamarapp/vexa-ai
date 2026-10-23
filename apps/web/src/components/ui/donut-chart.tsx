import type {ReactNode} from 'react';
import {BarList} from './bar-list';
/** Máximo de categorías para dibujar dona. */
export const MAX_DONA=5;
export type DonutSegment={key:string;label:string;value:number;display:string;tone?:1|2|3|4|5|'neutral';hatched?:boolean;hint?:string};
/** Dona con el total al centro y una leyenda que repite cada cifra exacta (el color nunca es el único portador). Solo con ≤5 categorías: con más, se sustituye por barras horizontales ordenadas con etiqueta directa (más legibles que una dona de muchos cortes). */
export function DonutChart({segments,centerValue,centerLabel,size=132,stroke=10,title}:{segments:DonutSegment[];centerValue:ReactNode;centerLabel:string;size?:number;stroke?:number;title:string}){
 const total=segments.reduce((a,s)=>a+Math.max(0,s.value),0),r=(size-stroke)/2,gap=segments.filter(s=>s.value>0).length>1?1.4:0;
 if(segments.length>MAX_DONA)return <figure className="donut donut-barras" aria-label={title}><figcaption className="donut-total"><strong>{centerValue}</strong> <span>{centerLabel}</span></figcaption><BarList wrap items={[...segments].sort((a,b)=>b.value-a.value).map(sg=>({key:sg.key,label:sg.label,value:total>0?sg.value*100/total:0,display:sg.display+(total>0?' · '+(sg.value/total*100).toLocaleString('es-MX',{maximumFractionDigits:1})+' %':''),note:sg.hint}))}/></figure>;
 let acc=0;
 return <figure className="donut" aria-label={title}>
  <div className="donut-ring" style={{width:size,height:size}}>
   <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={title+': '+segments.map(s=>`${s.label} ${s.display}`).join(', ')}>
    <circle cx={size/2} cy={size/2} r={r} className="donut-track" strokeWidth={stroke} fill="none"/>
    {total>0&&segments.filter(s=>s.value>0).map((s,i)=>{const len=s.value/total*100,start=acc;acc+=len;return <circle key={s.key} cx={size/2} cy={size/2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="butt" className={'donut-seg'+(s.hatched?' donut-hatch':'')} data-tone={s.tone??(i+1)} pathLength={100} strokeDasharray={`${Math.max(0,len-gap)} ${100-Math.max(0,len-gap)}`} strokeDashoffset={-start} transform={`rotate(-90 ${size/2} ${size/2})`} style={{animationDelay:i*90+'ms'}}><title>{s.label}: {s.display}</title></circle>;})}
   </svg>
   <div className="donut-center"><strong>{centerValue}</strong><span>{centerLabel}</span></div>
  </div>
  <ul className="donut-legend">{segments.map((s,i)=><li key={s.key} title={s.hint}><i className={'sw donut-sw'+(s.hatched?' donut-hatch':'')} data-tone={s.tone??(i+1)}/><span className="donut-name">{s.label}</span><strong>{s.display}</strong>{total>0&&<small>{(s.value/total*100).toLocaleString('es-MX',{maximumFractionDigits:1})} %</small>}</li>)}</ul>
 </figure>;
}
