'use client';
import {useState} from 'react';
import {useWidth} from './use-width';
import {nfCompact} from './format';
export type ColumnDatum={key:string;label:string;long?:string;value:number|null;display:string;detail?:string};
/** Vertical bars anchored at zero; the active bar takes the series colour (rest grey), Estimado = hatched. Tooltip shows the exact figure. */
export function ColumnChart({data,kind='observed',height=180,title,unit}:{data:ColumnDatum[];kind?:'observed'|'estimated'|'inferred';height?:number;title:string;unit?:string}){
 const [ref,width]=useWidth<HTMLDivElement>(),[active,setActive]=useState<number|null>(null);
 const n=data.length,W=Math.max(width,240),padL=50,padR=8,padT=10,padB=22,plotW=W-padL-padR,plotH=height-padT-padB,slot=plotW/Math.max(1,n),bw=Math.min(28,slot*.62);
 const max=Math.max(0,...data.map(d=>d.value??0))||1,every=Math.max(1,Math.ceil(n/Math.max(2,Math.floor(plotW/40))));
 const sel=active===null?null:data[active];
 return <figure className="chart column-chart" aria-label={title}>
  <div className="chart-plot" ref={ref}>
   {width>0&&<svg width={W} height={height} viewBox={`0 0 ${W} ${height}`} role="group" aria-label={title} onPointerLeave={()=>setActive(null)}>
    {[0,.5,1].map(t=>{const yy=padT+plotH-t*plotH;return <g key={t}><line x1={padL} x2={W-padR} y1={yy} y2={yy} className="chart-grid"/><text x={padL-8} y={yy+3} textAnchor="end" className="chart-tick">{nfCompact.format(t*max)}</text></g>;})}
    {data.map((d,i)=>{const h=d.value===null?0:Math.max(d.value>0?2:0,d.value/max*plotH),cx=padL+slot*i+slot/2;
     return <g key={d.key} tabIndex={0} role="img" aria-label={`${d.long??d.label}: ${d.display}${d.detail?'. '+d.detail:''}`} className="col" data-active={active===i||undefined} onPointerEnter={()=>setActive(i)} onFocus={()=>setActive(i)} onBlur={()=>setActive(null)}>
      <rect x={padL+slot*i} y={padT} width={slot} height={plotH+padB} className="col-hit"/>
      {d.value===null?<rect x={cx-bw/2} y={padT+plotH-6} width={bw} height={6} className="col-unknown"/>:<rect x={cx-bw/2} y={padT+plotH-h} width={bw} height={h} rx={5} className={'col-bar col-'+kind} style={{animationDelay:i*20+'ms'}}/>}
      {i%every===0&&<text x={cx} y={height-6} textAnchor="middle" className="chart-tick">{d.label}</text>}
     </g>;})}
   </svg>}
   {sel&&active!==null&&<div className="chart-tip" role="status" style={{left:Math.min(Math.max(padL+slot*active+slot/2,80),W-80)}}><span className="chart-tip-title">{sel.long??sel.label}</span><span className="chart-tip-row"><strong>{sel.display}</strong>{sel.detail&&<small>{sel.detail}</small>}</span></div>}
  </div>
  <details className="chart-table"><summary>Ver como tabla</summary><div className="table-wrap" tabIndex={0} role="region" aria-label={'Tabla: '+title}><table><thead><tr><th scope="col">Periodo</th><th scope="col" className="num">Valor{unit?` (${unit})`:''}</th></tr></thead><tbody>{data.map(d=><tr key={d.key}><th scope="row">{d.long??d.label}</th><td className="num">{d.display}{d.detail?` · ${d.detail}`:''}</td></tr>)}</tbody></table></div></details>
 </figure>;
}
