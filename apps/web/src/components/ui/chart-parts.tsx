'use client';
import {useRef,type ReactNode} from 'react';
import {useT} from '../i18n/proveedor';
import {KindBadge} from './kind-badge';
import {posicionTooltip} from '../../lib/charts/escala.mjs';
import {useTipPosicion} from './use-tip-posicion';
export type TipDelta={dir:'up'|'down'|'flat';texto:string;contra:string};
/** Tarjeta de tooltip del sistema de gráficas: mes, cifra tabular, variación contra el mes anterior (solo entre meses completos) e insignia de clase.
 *  Va dentro de un contenedor posicionado (`.chart-plot`); `x` es la columna del punto en ese contenedor y `width` su ancho. La posición final la fija useTipPosicion
 *  sobre el DOM ya medido (junto al punto, volteada a izquierda/derecha y acotada al viewport); el `left` inicial solo es la primera estimación del servidor.
 *  Ancho: 160–280 px por contenido (CSS), nunca el espacio libre a la derecha del punto. */
export function ChartTip({x,width,top=2,clearance=12,title,children,delta,kind,partial,detail}:{x:number;width:number;top?:number;/** px desde el centro del punto hasta el tooltip: mitad de la zona que captura el cursor + holgura, para no taparlo. */clearance?:number;title:string;children:ReactNode;delta?:TipDelta|null;kind?:'observed'|'estimated'|'inferred';partial?:boolean;detail?:string}){
 const t=useT(),right=x>width*.55,ref=useRef<HTMLDivElement>(null);
 useTipPosicion(ref,true,()=>{const el=ref.current,cb=el?.offsetParent as HTMLElement|null;if(!el||!cb)return null;const r=cb.getBoundingClientRect();return {ax:r.left+x,ay:r.top+top,modo:'lado',sep:clearance,ty:r.top+top};});
 return <div ref={ref} className="chart-tip" role="status" data-side={right?'left':'right'} style={{left:right?Math.max(110,x-12):posicionTooltip(x+12,width,0,0),top}}>
  <span className="chart-tip-head"><span className="chart-tip-title">{title}</span>{partial&&<span className="chart-tip-chip">{t('tr.ui.parcialChip')}</span>}</span>
  <span className="chart-tip-row">{children}</span>
  {delta&&<span className="chart-tip-delta" data-dir={delta.dir}><i aria-hidden="true">{delta.dir==='up'?'▲':delta.dir==='down'?'▼':'–'}</i>{delta.texto}<small>{t('tr.ui.contra',{contra:delta.contra})}</small></span>}
  {partial&&!delta&&<span className="chart-tip-delta">{t('tr.ui.sinVariacion')}</span>}
  {detail&&<small className="chart-tip-detail">{detail}</small>}
  {kind&&<span className="chart-tip-kind"><KindBadge kind={kind}/></span>}
 </div>;
}
/** Leyenda fina: trama diagonal = parcial; «s/d» = sin datos. Nunca una barra gris ni un cero. */
export function ChartLegend({partial,nodata}:{partial?:boolean;nodata?:boolean}){
 const t=useT();
 if(!partial&&!nodata)return null;
 return <p className="chart-legend">{partial&&<span><i className="chart-legend-hatch" aria-hidden="true"/>{t('tr.ui.leyParcial')}</span>}{nodata&&<span><b aria-hidden="true">{t('tr.ui.leySd')}</b>{t('tr.ui.leySinDatos')}</span>}</p>;
}
/** Patrón de trama diagonal fina para valores parciales. */
export function HatchDef({id}:{id:string}){
 return <pattern id={id} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="5" height="5" fill="var(--chart-surface)" fillOpacity=".55"/><line x1="0" y1="0" x2="0" y2="5" stroke="var(--chart-hatch)" strokeWidth="1.4"/></pattern>;
}
