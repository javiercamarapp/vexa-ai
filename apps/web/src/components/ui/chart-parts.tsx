import type {ReactNode} from 'react';
import {KindBadge} from './kind-badge';
import {posicionTooltip} from '../../lib/charts/escala.mjs';
export type TipDelta={dir:'up'|'down'|'flat';texto:string;contra:string};
/** Tarjeta de tooltip del sistema de gráficas: mes, cifra tabular, variación contra el mes anterior (solo entre meses completos) e insignia de clase. */
export function ChartTip({x,width,top=2,title,children,delta,kind,partial,detail}:{x:number;width:number;top?:number;title:string;children:ReactNode;delta?:TipDelta|null;kind?:'observed'|'estimated'|'inferred';partial?:boolean;detail?:string}){
 const right=x>width*.55;
 return <div className="chart-tip" role="status" data-side={right?'left':'right'} style={{left:right?Math.max(110,x-12):posicionTooltip(x+12,width,0,0),top}}>
  <span className="chart-tip-title">{title}{partial&&<em> · parcial</em>}</span>
  <span className="chart-tip-row">{children}</span>
  {delta&&<span className="chart-tip-delta" data-dir={delta.dir}><i aria-hidden="true">{delta.dir==='up'?'▲':delta.dir==='down'?'▼':'–'}</i>{delta.texto}<small> vs {delta.contra}</small></span>}
  {partial&&!delta&&<span className="chart-tip-delta">Sin variación: mes incompleto</span>}
  {detail&&<small className="chart-tip-detail">{detail}</small>}
  {kind&&<span className="chart-tip-kind"><KindBadge kind={kind}/></span>}
 </div>;
}
/** Leyenda fina: trama diagonal = parcial; «s/d» = sin datos. Nunca una barra gris ni un cero. */
export function ChartLegend({partial,nodata}:{partial?:boolean;nodata?:boolean}){
 if(!partial&&!nodata)return null;
 return <p className="chart-legend">{partial&&<span><i className="chart-legend-hatch" aria-hidden="true"/>parcial: mes incompleto, no comparable</span>}{nodata&&<span><b aria-hidden="true">s/d</b>sin datos</span>}</p>;
}
/** Patrón de trama diagonal fina para valores parciales. */
export function HatchDef({id}:{id:string}){
 return <pattern id={id} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="5" height="5" fill="var(--chart-surface)" fillOpacity=".55"/><line x1="0" y1="0" x2="0" y2="5" stroke="var(--chart-hatch)" strokeWidth="1.4"/></pattern>;
}
