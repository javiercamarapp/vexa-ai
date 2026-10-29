'use client';
import {useId,useState,type KeyboardEvent} from 'react';
import {useT} from '../i18n/proveedor';
import {useWidth} from './use-width';
import {ChartLegend,ChartTip,HatchDef} from './chart-parts';
import {cadaCuantas,compactEs,esConteoPequeno,geometriaColumnas,indicesEtiquetados,niceScale,variacionVsAnterior} from '../../lib/charts/escala.mjs';
export type ColumnDatum={key:string;label:string;long?:string;value:number|null;display:string;detail?:string;/** Mes con datos incompletos: trama diagonal y etiqueta «parcial»; nunca se compara. */partial?:boolean;/** Cifra corta para la etiqueta directa (si falta, se compacta el valor). */short?:string};
export type ColumnKind='observed'|'estimated'|'inferred';
/** Etiqueta del eje: valor de la marca y máximo de los datos (el máximo lo necesitan los importes escalados). */
export type AxisFormat=(tick:number,dataMax:number)=>string;
type PlotProps={data:ColumnDatum[];kind?:ColumnKind;height?:number;title:string;axis?:AxisFormat;deltaMode?:'pct'|'pp'|'none';integer?:boolean};
const PAD_T=20,PAD_B=22,PAD_R=6;
/** Columnas finas ancladas a cero (relación barra/hueco 0.6, radio 3): tinta al 85 %, último mes completo en tinta plena, el seleccionado en rojo de marca.
 *  Un eje de 3 marcas, etiquetas directas del máximo y del último mes, tooltip con variación contra el mes anterior. Texto en píxeles reales (nunca escalado). */
export function ColumnPlot({data,kind='observed',height=168,title,axis,deltaMode='pct',integer}:PlotProps){
 const t=useT(),[ref,width]=useWidth<HTMLDivElement>(),[active,setActive]=useState<number|null>(null),uid=useId().replace(/:/g,'');
 const n=data.length,vals=data.map(d=>d.value),dataMax=Math.max(0,...vals.map(v=>v??0));
 const sc=niceScale(dataMax,{integer:integer??esConteoPequeno(vals)});
 const txt=(v:number)=>v===0?'0':axis?axis(v,dataMax):compactEs(v);
 const ticks=sc.ticks.map(txt),padL=Math.max(30,Math.max(...ticks.map(t=>t.length))*6.4+14);
 const W=Math.max(width||640,240),plotW=W-padL-PAD_R,plotH=height-PAD_T-PAD_B,base=PAD_T+plotH,{slot,bw,offset}=geometriaColumnas(n,plotW);
 const y=(v:number)=>PAD_T+plotH-(v/sc.max)*plotH,every=cadaCuantas(n,plotW,34);
 const labeled=indicesEtiquetados(data),last=data.reduce((a,d,i)=>d.value!==null&&!d.partial?i:a,-1);
 const sel=active===null?null:data[active];
 const key=(e:KeyboardEvent)=>{if(e.key==='Escape')setActive(null);};
 /** Táctil: el dedo recorre las columnas; la lectura queda en la cinta fija sobre la gráfica (en celular el CSS la ancla arriba). */
 const escrubir=(clientX:number,el:SVGSVGElement)=>{const r=el.getBoundingClientRect(),i=Math.floor((clientX-r.left-padL)/slot);if(i>=0&&i<n)setActive(i);};
 return <div className="chart-plot" ref={ref} onKeyDown={key}>
  <svg width={W} height={height} viewBox={`0 0 ${W} ${height}`} style={{maxWidth:'100%'}} role="group" aria-label={title} onPointerLeave={e=>{if(e.pointerType!=='touch')setActive(null);}} onPointerDown={e=>{if(e.pointerType==='touch')escrubir(e.clientX,e.currentTarget);}} onPointerMove={e=>{if(e.pointerType==='touch')escrubir(e.clientX,e.currentTarget);}}>
   <defs><HatchDef id={'h'+uid}/></defs>
   {sc.ticks.map((t,i)=><g key={i}><line x1={padL} x2={W-PAD_R} y1={y(t)} y2={y(t)} className={t===0?'chart-axis':'chart-grid'}/><text x={padL-8} y={y(t)+4} textAnchor="end" className="chart-tick">{ticks[i]}</text></g>)}
   {data.map((d,i)=>{const cx=padL+slot*i+slot/2,x0=padL+slot*i+offset,h=d.value===null?0:Math.max(d.value>0?2:0,d.value/sc.max*plotH),top=base-h,r=Math.min(3,bw/2,h);
    const path=h>0?`M${x0.toFixed(1)},${base}V${(top+r).toFixed(1)}Q${x0.toFixed(1)},${top.toFixed(1)} ${(x0+r).toFixed(1)},${top.toFixed(1)}H${(x0+bw-r).toFixed(1)}Q${(x0+bw).toFixed(1)},${top.toFixed(1)} ${(x0+bw).toFixed(1)},${(top+r).toFixed(1)}V${base}Z`:'';
    const lab=labeled.includes(i)&&active===null&&d.value!==null?(d.short??(axis?axis(d.value,dataMax):compactEs(d.value))):null;
    const anchor=lab&&cx+lab.length*3.4>W?'end':lab&&cx-lab.length*3.4<padL?'start':'middle';
    return <g key={d.key} className="col" tabIndex={0} role="img" aria-label={t(d.partial?'tr.ui.colAriaParcial':'tr.ui.colAria',{fecha:d.long??d.label,valor:d.value===null?t('tr.ui.sinDatosMin'):d.display})+(d.detail?'. '+d.detail:'')} data-active={active===i||undefined} data-last={i===last||undefined} onPointerEnter={()=>setActive(i)} onPointerDown={()=>setActive(i)} onFocus={()=>setActive(i)} onBlur={()=>setActive(null)}>
     <rect x={padL+slot*i} y={PAD_T-4} width={slot} height={plotH+PAD_B+4} className="col-hit"/>
     {d.value===null?<text x={cx} y={base-6} textAnchor="middle" className="chart-note">{t('tr.ui.leySd')}</text>
      :<path d={path} className={'col-bar col-'+kind+(d.partial?' col-partial':'')} style={{animationDelay:i*14+'ms',...(d.partial?{fill:`url(#h${uid})`}:{})}}/>}
     {d.partial&&d.value!==null&&active!==i&&<text x={cx} y={top-5} textAnchor={cx+18>W?'end':'middle'} className="chart-note">{t('tr.ui.parcialChip')}</text>}
     {lab&&!d.partial&&<text x={cx} y={top-5} textAnchor={anchor} className="chart-dlabel">{lab}</text>}
     {i%every===0&&<text x={cx} y={height-6} textAnchor="middle" className="chart-tick chart-xtick">{d.label}</text>}
    </g>;})}
  </svg>
  {sel&&active!==null&&<ChartTip x={padL+slot*active+slot/2} width={W} clearance={Math.ceil(slot/2)+8} title={sel.long??sel.label} partial={sel.partial} kind={kind} detail={sel.detail} delta={deltaMode==='none'||sel.value===null?null:(()=>{const v=variacionVsAnterior(data,active,deltaMode);return v?{...v,contra:data[active-1].label}:null;})()}><strong>{sel.value===null?t('tr.ui.sinDatosCap'):sel.display}</strong></ChartTip>}
  <ChartLegend partial={data.some(d=>d.partial&&d.value!==null)} nodata={data.some(d=>d.value===null)}/>
 </div>;
}
/** Columnas mensuales con tabla equivalente. API estable; `axis`, `deltaMode` e `integer` son opcionales. */
export function ColumnChart({data,kind='observed',height=168,title,unit,axis,deltaMode,integer}:{data:ColumnDatum[];kind?:ColumnKind;height?:number;title:string;unit?:string;axis?:AxisFormat;deltaMode?:'pct'|'pp'|'none';integer?:boolean}){
 const t=useT();
 return <figure className="chart column-chart" aria-label={title}>
  <ColumnPlot data={data} kind={kind} height={height} title={title} axis={axis} deltaMode={deltaMode} integer={integer}/>
  <details className="chart-table"><summary>{t('cfo.serie.verTabla')}</summary><div className="table-wrap" tabIndex={0} role="region" aria-label={t('tr.ui.tabla',{titulo:title})}><table><thead><tr><th scope="col">{t('tr.ui.thPeriodo')}</th><th scope="col" className="num">{t('cfo.serie.valor')}{unit?` (${unit})`:''}</th></tr></thead><tbody>{data.map(d=><tr key={d.key}><th scope="row">{d.long??d.label}{d.partial?t('tr.ui.incompleto'):''}</th><td className="num">{d.value===null?t('tr.ui.sinDatosCap'):d.display}{d.detail?` · ${d.detail}`:''}</td></tr>)}</tbody></table></div></details>
 </figure>;
}
