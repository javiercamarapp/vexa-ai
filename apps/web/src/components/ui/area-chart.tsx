'use client';
import {useId,useState,type KeyboardEvent,type PointerEvent} from 'react';
import {useWidth} from './use-width';
import {nfCompact} from './format';
export type AreaPoint={label:string;long?:string;value:number|null;display:string;detail?:string;/** Mes con datos incompletos: se dibuja punteado y no se confunde con una caída. */partial?:boolean};
export type AreaSeries={name:string;points:AreaPoint[];tone?:'primary'|'compare'|'estimated'};
/** Area/line chart with dotted horizontal grid, crosshair, dark tooltip and keyboard (←/→) support. Values anchor at zero; null = gap. The exact figure is the tooltip text. */
export function AreaChart({series,height=220,title,unit}:{series:AreaSeries[];height?:number;title:string;unit?:string}){
 const [ref,width]=useWidth<HTMLDivElement>(),[active,setActive]=useState<number|null>(null),uid=useId();
 const main=series[0],n=main?.points.length??0;
 const W=Math.max(width,240),padL=50,padR=12,padT=12,padB=24,plotW=W-padL-padR,plotH=height-padT-padB;
 const max=Math.max(0,...series.flatMap(s=>s.points.map(p=>p.value??0)))||1;
 const x=(i:number)=>padL+(n<2?plotW/2:i*plotW/(n-1)),y=(v:number)=>padT+plotH-(v/max)*plotH;
 const path=(s:AreaSeries)=>{let d='',pen=false;s.points.forEach((p,i)=>{if(p.value===null||p.partial){pen=false;return;}d+=`${pen?'L':'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`;pen=true;});return d;};
 const partialPath=(s:AreaSeries)=>s.points.reduce((d,p,i)=>p.partial&&p.value!==null&&i>0&&s.points[i-1].value!==null?d+`M${x(i-1).toFixed(1)},${y(s.points[i-1].value as number).toFixed(1)}L${x(i).toFixed(1)},${y(p.value).toFixed(1)}`:d,'');
 const areaOf=(s:AreaSeries)=>{const pts=s.points.map((p,i)=>[i,p.partial?null:p.value] as const).filter(([,v])=>v!==null) as [number,number][];if(pts.length<2)return '';return `M${x(pts[0][0]).toFixed(1)},${y(0)}`+pts.map(([i,v])=>`L${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('')+`L${x(pts[pts.length-1][0]).toFixed(1)},${y(0)}Z`;};
 const ticks=[0,.25,.5,.75,1].map(t=>t*max);
 const every=Math.max(1,Math.ceil(n/Math.max(2,Math.floor(plotW/56))));
 const pick=(clientX:number,el:SVGSVGElement)=>{const r=el.getBoundingClientRect(),px=clientX-r.left;setActive(Math.max(0,Math.min(n-1,Math.round(n<2?0:(px-padL)/plotW*(n-1)))));};
 const key=(e:KeyboardEvent)=>{if(e.key==='ArrowRight'){e.preventDefault();setActive(a=>Math.min(n-1,(a??-1)+1));}else if(e.key==='ArrowLeft'){e.preventDefault();setActive(a=>Math.max(0,(a??n)-1));}else if(e.key==='Escape')setActive(null);};
 const sel=active===null?null:active;
 const tipLeft=sel===null?0:Math.min(Math.max(x(sel),90),W-90);
 return <figure className="chart area-chart" aria-label={title}>
  <div className="chart-plot" ref={ref}>
   {width>0&&<svg width={W} height={height} viewBox={`0 0 ${W} ${height}`} role="group" aria-label={title+'. Usa las flechas para recorrer los puntos.'} tabIndex={0} onKeyDown={key} onPointerMove={(e:PointerEvent<SVGSVGElement>)=>pick(e.clientX,e.currentTarget)} onPointerLeave={()=>setActive(null)} onBlur={()=>setActive(null)}>
    <defs><linearGradient id={uid} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="currentColor" stopOpacity=".2"/><stop offset="1" stopColor="currentColor" stopOpacity="0"/></linearGradient></defs>
    {ticks.map((t,i)=><g key={i}><line x1={padL} x2={W-padR} y1={y(t)} y2={y(t)} className="chart-grid"/><text x={padL-8} y={y(t)+3} textAnchor="end" className="chart-tick">{nfCompact.format(t)}</text></g>)}
    {main?.points.map((p,i)=>i%every===0&&<text key={i} x={x(i)} y={height-6} textAnchor="middle" className="chart-tick">{p.label}{p.partial?'*':''}</text>)}
    {series.slice().reverse().map(s=><g key={s.name} className="area-series" data-tone={s.tone??'primary'}>{(s.tone??'primary')!=='compare'&&<path d={areaOf(s)} className="area-fill" fill={`url(#${uid})`}/>}<path d={path(s)} className="area-line" pathLength={1}/>{partialPath(s)&&<path d={partialPath(s)} className="area-line-partial"/>}{s.points.map((p,i)=>p.partial&&p.value!==null&&<circle key={i} cx={x(i)} cy={y(p.value)} r="3.5" className="area-partial-dot"/>)}</g>)}
    {sel!==null&&<g className="crosshair"><line x1={x(sel)} x2={x(sel)} y1={padT} y2={padT+plotH}/>{series.map(s=>s.points[sel]?.value!=null&&<circle key={s.name} cx={x(sel)} cy={y(s.points[sel].value as number)} r="4" className="area-dot" data-tone={s.tone??'primary'}/>)}</g>}
   </svg>}
   {sel!==null&&main&&<div className="chart-tip" role="status" style={{left:tipLeft}}><span className="chart-tip-title">{main.points[sel].long??main.points[sel].label}</span>{series.map(s=><span key={s.name} className="chart-tip-row"><i className="sw" data-tone={s.tone??'primary'}/>{series.length>1&&<span>{s.name}</span>}<strong>{s.points[sel]?.display??'—'}</strong>{s.points[sel]?.detail&&<small>{s.points[sel].detail}</small>}</span>)}</div>}
  </div>
  <details className="chart-table"><summary>Ver como tabla</summary><div className="table-wrap" tabIndex={0} role="region" aria-label={'Tabla: '+title}><table><thead><tr><th scope="col">Periodo</th>{series.map(s=><th key={s.name} scope="col" className="num">{s.name}{unit?` (${unit})`:''}</th>)}</tr></thead><tbody>{main?.points.map((p,i)=><tr key={i}><th scope="row">{p.long??p.label}</th>{series.map(s=><td key={s.name} className="num">{s.points[i]?.display??'—'}{s.points[i]?.detail?` · ${s.points[i].detail}`:''}</td>)}</tr>)}</tbody></table></div></details>
 </figure>;
}
