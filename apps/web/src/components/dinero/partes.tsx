'use client';
import {ConMarca} from '../ui/brand-mark';
import {useIdioma,useT} from '../i18n/proveedor';
import {porcentaje} from '../../lib/formato/idioma.mjs';
import type {ReactNode} from 'react';
import {color} from '../ui/mini-charts';
import './dinero.css';

/** Fila de la rejilla de 12 columnas: «8-4», «6-6», «4-4-4», «3-3-3-3» o «12». Cada hijo ocupa su tramo y toda la altura de la fila. */
export function Fila({split,children}:{split:'8-4'|'6-6'|'4-4-4'|'3-3-3-3'|'12';children:ReactNode}){return <div className="dg-row" data-split={split}>{children}</div>;}

const cat=(c:number)=>({['--cat' as string]:`var(--chart-${((c-1)%8)+1})`});
/** Chip de variación con signo real; nulo = «sin comparar» (nunca 0). */
export function Delta({p,sufijo}:{p:number|null|undefined;sufijo?:string}){
 const tr=useT(),idioma=useIdioma();
 if(p===null||p===undefined||!Number.isFinite(p))return <span className="dg-delta" title={tr('dinero.sinDosMeses')}>{tr('dinero.sinComparar')}</span>;
 const t=p>0.05?'up':p<-0.05?'down':'flat',txt=porcentaje(p,idioma,{conSigno:true});
 return <span className="dg-delta" data-t={t}>{txt}{sufijo?' '+sufijo:''}</span>;
}
/** Barra fina de porcentaje (0-100) en el color de la métrica, para la nota de un KPI sin serie. */
export function MiniPct({p,c,label}:{p:number|null;c:number;label:string}){
 const tr=useT();
 if(p===null||!Number.isFinite(p))return <span className="dg-mini" role="img" aria-label={label+': '+tr('dinero.sinDato')}/>;
 return <span className="dg-mini" style={cat(c)} role="img" aria-label={label}><i style={{width:Math.max(1.5,Math.min(100,p))+'%'}}/></span>;
}
export type ItemBarra={key:string;etiqueta:ReactNode;sub?:ReactNode;valor:number|null;texto:ReactNode;sub2?:ReactNode;c?:number;estado?:'parcial';marca?:number|null;/** clave/nombre de integración: antepone su logo a la etiqueta */integracion?:string};
/** Lista de barras finas (etiqueta | barra | valor) con una sola escala. `marca` = posición de una referencia (mediana) en la misma escala. */
export function ListaBarras({items,max,c=1,label,apilado=false,vw=false}:{items:ItemBarra[];max?:number;c?:number;label:string;apilado?:boolean;/** columna de valor de ancho fijo: las barras de todas las filas empiezan y acaban igual */vw?:boolean}){
 const m=Math.max(1e-9,max??Math.max(...items.map(i=>i.valor??0),0));
 return <ul className="dg-lista" data-ap={apilado||undefined} data-vw={vw||undefined} aria-label={label}>{items.map(i=><li key={i.key}>
  <span className="dg-lab"><b><ConMarca marca={i.integracion}>{i.etiqueta}</ConMarca></b>{i.sub&&<small>{i.sub}</small>}</span>
  <span className="dg-bar" data-estado={i.estado} style={cat(i.c??c)} role="img" aria-label={`${typeof i.etiqueta==='string'?i.etiqueta:label}: ${typeof i.texto==='string'?i.texto:''}`}><i style={{width:Math.max(1.5,Math.min(100,(i.valor??0)*100/m))+'%'}}/>{i.marca!=null&&<u style={{left:Math.min(100,i.marca*100/m)+'%'}}/>}</span>
  <span className="dg-val">{i.texto}{i.sub2&&<small>{i.sub2}</small>}</span></li>)}</ul>;
}
export function Leyenda({items}:{items:{label:string;c?:number;hatch?:boolean;integracion?:string}[]}){
 return <ul className="dg-leyenda" aria-label="Leyenda">{items.map(i=><li key={i.label}><i data-hatch={i.hatch||undefined} style={i.c?cat(i.c):undefined}/><ConMarca marca={i.integracion}>{i.label}</ConMarca></li>)}</ul>;
}
export function Vacio({children}:{children:ReactNode}){return <div className="dg-vacio" role="status"><p>{children}</p></div>;}

export type PasoCascada={key:string;label:string;valor:number;texto:string;tipo:'total'|'resta'|'aparte';c:number};
/** Puente (waterfall) en SVG: totales anclados a 0, restas flotantes, tramo «aparte» con trama (no se resta). Etiqueta directa en cada barra. */
export function Cascada({pasos,label}:{pasos:PasoCascada[];label:string}){
 const W=560,H=290,pad=22,n=pasos.length,gw=W/n,bw=Math.min(64,gw-18);
 const max=Math.max(1,...pasos.map(p=>p.valor)),Y=(v:number)=>H-22-(v/max)*(H-22-pad);
 const barras=pasos.reduce<(PasoCascada&{top:number;base:number;nivel:number})[]>((acc,p)=>{
  const nivel=acc.length?acc[acc.length-1].nivel:0;
  if(p.tipo==='total')return [...acc,{...p,top:p.valor,base:0,nivel:p.valor}];
  if(p.tipo==='resta'){const base=Math.max(0,nivel-p.valor);return [...acc,{...p,top:nivel,base,nivel:base}];}
  return [...acc,{...p,top:p.valor,base:0,nivel}];
 },[]);
 return <svg className="dg-cascada" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label+': '+pasos.map(p=>p.label+' '+p.texto).join(', ')}>
  <line x1="0" x2={W} y1={Y(0)} y2={Y(0)} stroke="var(--ui-border)"/>
  {barras.map((b,i)=>{const x=i*gw+(gw-bw)/2,y=Y(b.top),h=Math.max(2,Y(b.base)-y);
   return <g key={b.key}>
    <rect className="dg-c-b" x={x} y={y} width={bw} height={h} rx="8" fill={color(b.c-1)} opacity={b.tipo==='aparte'?0.45:1}><title>{b.label+': '+b.texto}</title></rect>
    {b.tipo==='aparte'&&<rect x={x} y={y} width={bw} height={h} rx="8" fill="url(#dg-hatch)"/>}
    <text className="dg-c-v" x={x+bw/2} y={y-6} textAnchor="middle">{b.texto}</text>
    <text x={x+bw/2} y={H-6} textAnchor="middle">{b.label}</text>
    {i<n-1&&barras[i+1].tipo!=='aparte'&&<line x1={x+bw} x2={x+gw} y1={Y(b.tipo==='resta'?b.base:b.top)} y2={Y(b.tipo==='resta'?b.base:b.top)} stroke="var(--ui-line-strong)" strokeDasharray="3 3"/>}
   </g>;})}
  <defs><pattern id="dg-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="var(--ui-surface)" strokeWidth="2"/></pattern></defs>
 </svg>;
}
