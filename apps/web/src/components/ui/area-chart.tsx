'use client';
import {useEffect,useId,useState,type KeyboardEvent,type PointerEvent} from 'react';
import {useT} from '../i18n/proveedor';
import {useWidth} from './use-width';
import {ChartTip} from './chart-parts';
import {cadaCuantas,compactEs,esConteoPequeno,indicesEtiquetados,niceScale,variacionVsAnterior} from '../../lib/charts/escala.mjs';
export type AreaPoint={label:string;long?:string;value:number|null;display:string;detail?:string;/** Mes con datos incompletos: se dibuja punteado y no se confunde con una caída. */partial?:boolean};
export type AreaSeries={name:string;points:AreaPoint[];tone?:'primary'|'compare'|'estimated'};
/** Línea con área degradada muy tenue: 1.75 px, puntos solo en el último valor y en hover, 3 marcas en el eje Y, etiquetas directas del máximo y del último valor.
 *  Valores anclados a cero; null = hueco; parcial = punteado con «parcial». Teclado: ←/→. La cifra exacta es el texto del tooltip. */
export function AreaChart({series,height:alto=168,title,unit}:{series:AreaSeries[];/** «fill»: ocupa toda la altura libre de la tarjeta (el contenedor flexible mide el alto). */height?:number|'fill';title:string;unit?:string}){
 const t=useT(),fill=alto==='fill',[ref,width]=useWidth<HTMLDivElement>(),[medido,setMedido]=useState(0),[active,setActive]=useState<number|null>(null),uid=useId().replace(/:/g,'');
 useEffect(()=>{const el=ref.current;if(!fill||!el)return;const read=()=>{const sv=el.querySelector('svg');if(sv&&getComputedStyle(sv).position!=='absolute'){setMedido(0);return;}setMedido(Math.round(el.getBoundingClientRect().height));};/* en celular el SVG va en flujo (con la cinta de lectura): altura fija, sin medir el contenedor */read();const ro=new ResizeObserver(read);ro.observe(el);return()=>ro.disconnect();},[fill,ref]);
 const height=fill?(medido?Math.max(medido,128):168):alto;
 const main=series[0],n=main?.points.length??0;
 const max0=Math.max(0,...series.flatMap(s=>s.points.map(p=>p.value??0)));
 const sc=niceScale(max0,{integer:esConteoPequeno(series.flatMap(s=>s.points.map(p=>p.value)))}),ticks=sc.ticks.map(t=>t===0?'0':compactEs(t));
 const padL=Math.max(30,Math.max(...ticks.map(t=>t.length))*6.4+14),padR=14,padT=20,padB=22,W=Math.max(width||640,240),plotW=W-padL-padR,plotH=height-padT-padB;
 const x=(i:number)=>padL+(n<2?plotW/2:i*plotW/(n-1)),y=(v:number)=>padT+plotH-(v/sc.max)*plotH;
 const path=(s:AreaSeries)=>{let d='',pen=false;s.points.forEach((p,i)=>{if(p.value===null||p.partial){pen=false;return;}d+=`${pen?'L':'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`;pen=true;});return d;};
 const partialPath=(s:AreaSeries)=>s.points.reduce((d,p,i)=>p.partial&&p.value!==null&&i>0&&s.points[i-1].value!==null?d+`M${x(i-1).toFixed(1)},${y(s.points[i-1].value as number).toFixed(1)}L${x(i).toFixed(1)},${y(p.value).toFixed(1)}`:d,'');
 const areaOf=(s:AreaSeries)=>{const pts=s.points.map((p,i)=>[i,p.partial?null:p.value] as const).filter(([,v])=>v!==null) as [number,number][];if(pts.length<2)return '';return `M${x(pts[0][0]).toFixed(1)},${y(0)}`+pts.map(([i,v])=>`L${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('')+`L${x(pts[pts.length-1][0]).toFixed(1)},${y(0)}Z`;};
 const every=cadaCuantas(n,plotW,44);
 const pick=(clientX:number,el:SVGSVGElement)=>{const r=el.getBoundingClientRect(),px=clientX-r.left;setActive(Math.max(0,Math.min(n-1,Math.round(n<2?0:(px-padL)/plotW*(n-1)))));};
 const key=(e:KeyboardEvent)=>{if(e.key==='ArrowRight'){e.preventDefault();setActive(a=>Math.min(n-1,(a??-1)+1));}else if(e.key==='ArrowLeft'){e.preventDefault();setActive(a=>Math.max(0,(a??n)-1));}else if(e.key==='Escape')setActive(null);};
 const sel=active===null?null:active;
 const labeled=main?indicesEtiquetados(main.points):[];
 return <figure className={'chart area-chart'+(fill?' area-fill-h':'')} aria-label={title}>
  <div className="chart-plot" ref={ref}>
   <svg width={W} height={height} viewBox={`0 0 ${W} ${height}`} style={{maxWidth:'100%'}} role="group" aria-label={t('tr.ui.areaAria',{titulo:title})} tabIndex={0} onKeyDown={key} onPointerMove={(e:PointerEvent<SVGSVGElement>)=>pick(e.clientX,e.currentTarget)} onPointerDown={(e:PointerEvent<SVGSVGElement>)=>pick(e.clientX,e.currentTarget)} onPointerLeave={(e:PointerEvent<SVGSVGElement>)=>{if(e.pointerType!=='touch')setActive(null);}} onBlur={()=>setActive(null)}>
    <defs><linearGradient id={'g'+uid} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="currentColor" stopOpacity=".12"/><stop offset="1" stopColor="currentColor" stopOpacity="0"/></linearGradient></defs>
    {sc.ticks.map((t,i)=><g key={i}><line x1={padL} x2={W-padR} y1={y(t)} y2={y(t)} className={t===0?'chart-axis':'chart-grid'}/><text x={padL-8} y={y(t)+4} textAnchor="end" className="chart-tick">{ticks[i]}</text></g>)}
    {main?.points.map((p,i)=>i%every===0&&<text key={i} x={x(i)} y={height-6} textAnchor="middle" className="chart-tick chart-xtick">{p.label}</text>)}
    {series.slice().reverse().map(s=><g key={s.name} className="area-series" data-tone={s.tone??'primary'}>{(s.tone??'primary')!=='compare'&&<path d={areaOf(s)} className="area-fill" fill={`url(#g${uid})`}/>}<path d={path(s)} className="area-line" pathLength={1}/>{partialPath(s)&&<path d={partialPath(s)} className="area-line-partial"/>}{s.points.map((p,i)=>p.partial&&p.value!==null&&<g key={i}><circle cx={x(i)} cy={y(p.value)} r="3" className="area-partial-dot"/>{sel===null&&<text x={x(i)} y={y(p.value)-9} textAnchor="middle" className="chart-note">{t('tr.ui.parcialChip')}</text>}</g>)}</g>)}
    {sel===null&&main&&labeled.map(i=>{const p=main.points[i];if(p.value===null)return null;const lab=compactEs(p.value),right=x(i)+lab.length*3.4>W;return <g key={'l'+i}>{i===labeled[labeled.length-1]&&<circle cx={x(i)} cy={y(p.value)} r="3.25" className="area-last"/>}<text x={x(i)} y={y(p.value)-9} textAnchor={right?'end':'middle'} className="chart-dlabel">{lab}</text></g>;})}
    {sel!==null&&<g className="crosshair"><line x1={x(sel)} x2={x(sel)} y1={padT} y2={padT+plotH}/>{series.map(s=>s.points[sel]?.value!=null&&<circle key={s.name} cx={x(sel)} cy={y(s.points[sel].value as number)} r="4" className="area-dot" data-tone={s.tone??'primary'}/>)}</g>}
   </svg>
   {sel!==null&&main&&<ChartTip x={x(sel)} width={W} clearance={Math.ceil(n<2?0:plotW/(n-1)/2)+10} title={main.points[sel].long??main.points[sel].label} partial={main.points[sel].partial} kind={(main.tone==='estimated'?'estimated':undefined)} detail={undefined}
     delta={(()=>{const v=variacionVsAnterior(main.points,sel,'pct');return v?{...v,contra:main.points[sel-1].label}:null;})()}>{series.map(s=><span key={s.name} className="chart-tip-line"><i className="sw" data-tone={s.tone??'primary'}/>{series.length>1&&<span>{s.name}</span>}<strong>{s.points[sel]?.display??'—'}</strong>{s.points[sel]?.detail&&<small>{s.points[sel].detail}</small>}</span>)}</ChartTip>}
  </div>
  <details className="chart-table"><summary>{t('cfo.serie.verTabla')}</summary><div className="table-wrap" tabIndex={0} role="region" aria-label={t('tr.ui.tabla',{titulo:title})}><table><thead><tr><th scope="col">{t('tr.ui.thPeriodo')}</th>{series.map(s=><th key={s.name} scope="col" className="num">{s.name}{unit?` (${unit})`:''}</th>)}</tr></thead><tbody>{main?.points.map((p,i)=><tr key={i}><th scope="row">{p.long??p.label}</th>{series.map(s=><td key={s.name} className="num">{s.points[i]?.display??'—'}{s.points[i]?.detail?` · ${s.points[i].detail}`:''}</td>)}</tr>)}</tbody></table></div></details>
 </figure>;
}
