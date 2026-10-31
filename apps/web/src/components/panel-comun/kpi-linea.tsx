import type {ReactNode} from 'react';
import {Chip,type ChipTone} from '../ui/chip';
import {Sparkline} from '../ui/sparkline';
export type KpiLineaItem={key?:string;label:string;value:ReactNode;/** 1..8: color fijo de la métrica */c:number;nota?:ReactNode;chip?:{texto:string;tono?:ChipTone};/** partes de un total (barra fina de 6 px) */partes?:{key?:string;label:string;value:number;estado?:'real'|'parcial'}[];spark?:number[];/** valor desconocido: se muestra «—» con la razón, nunca 0 */vacio?:boolean};
const col=(c:number)=>`var(--chart-${((c-1)%8)+1})`;
/** UNA tarjeta con 4–5 indicadores: etiqueta 11 px, cifra 26 px, chip de variación/estado, mini-gráfica (barra fina o sparkline) y pie 12 px. */
export function KpiLinea({items,label}:{items:KpiLineaItem[];label?:string}){
 return <ul className="pc-kpis ui-reset" role="list" aria-label={label} style={{['--n' as string]:items.length}}>{items.map(k=>{
  const tot=(k.partes??[]).reduce((a,p)=>a+Math.max(0,p.value),0);
  return <li key={k.key??k.label} className="pc-kpi" style={{['--cat' as string]:col(k.c),listStyle:'none'}}>
   <div className="pc-kpi-top"><span className="pc-kpi-label">{k.label}</span>{k.chip&&<Chip tone={k.chip.tono??'neutral'}>{k.chip.texto}</Chip>}</div>
   <strong className="pc-kpi-valor" data-vacio={k.vacio||undefined}>{k.value}</strong>
   {k.spark&&k.spark.length>1?<Sparkline data={k.spark} label={(label?label+': ':'')+k.label} color={k.c}/>
    :k.partes&&tot>0?<div className="pc-seg" role="img" aria-label={k.label+': '+k.partes.map(p=>p.label+' '+p.value).join(', ')}>{k.partes.filter(p=>p.value>0).map((p,i)=><i key={p.key??p.label} title={p.label+': '+p.value} data-estado={p.estado} style={{flexBasis:(p.value*100/tot)+'%',['--c' as string]:col(((k.c-1+i*0)%8)+1),opacity:1-i*0.28}}/>)}</div>
    :<div className="pc-seg-vacio" aria-hidden="true"/>}
   {k.nota&&<small className="pc-kpi-nota">{k.nota}</small>}
  </li>;})}</ul>;
}
export const BarraParte=({etiqueta,valor,max,c,estado,fin}:{etiqueta:ReactNode;valor:number|null;max:number;c:number;estado?:'real'|'parcial';fin?:ReactNode})=>
 <div className="pc-barra"><span>{etiqueta}</span><span className="pc-pista" data-vacio={valor==null||undefined} role="img" aria-label={valor==null?'sin dato':String(valor)}>{valor!=null&&<i data-estado={estado} style={{width:Math.max(2,valor/Math.max(1,max)*100)+'%',['--c' as string]:col(c)}}/>}</span><b>{fin??(valor==null?'—':valor)}</b></div>;
