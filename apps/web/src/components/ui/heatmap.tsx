'use client';
import {useState} from 'react';
import {useT} from '../i18n/proveedor';
export type HeatCell={value:number|null;display:string};
/** Grid heatmap (calendar weeks × weekday, or hour × day). 5 levels of one hue; empty cells are dotted. Every cell carries its exact value in title and aria-label. */
export function Heatmap({columns,rows,cells,title,unit,legend=true}:{columns:string[];rows:string[];cells:HeatCell[][];title:string;unit?:string;legend?:boolean}){
 const t=useT(),[sel,setSel]=useState<[number,number]|null>(null);
 const max=Math.max(0,...cells.flat().map(c=>c.value??0));
 const level=(v:number|null)=>v===null?-1:v<=0||max===0?0:Math.min(4,1+Math.floor(v/max*3.999));
 return <figure className="heat" aria-label={title}>
  <div className="heat-scroll" tabIndex={0} role="region" aria-label={t('tr.ui.hmScroll',{titulo:title})}>
   <div className="heat-grid" style={{gridTemplateColumns:`auto repeat(${columns.length},var(--cell))`}} role="table" aria-label={title}>
    <span className="heat-corner"/>{columns.map((c,i)=><span key={i} className="heat-col" role="columnheader"><span className="heat-col-t">{c}</span></span>)}
    {rows.map((r,ri)=><div key={ri} className="heat-rowwrap" role="row">
     <span className="heat-row" role="rowheader">{r}</span>
     {cells[ri]?.map((c,ci)=><i key={ci} role="cell" className="heat-cell" data-level={level(c.value)} data-sel={sel&&sel[0]===ri&&sel[1]===ci?'':undefined} onClick={()=>setSel([ri,ci])} onPointerEnter={e=>{if(e.pointerType!=='mouse')setSel([ri,ci]);}} title={`${columns[ci]} · ${r}: ${c.display}${unit?' '+unit:''}`} aria-label={`${columns[ci]} ${r}: ${c.display}`}/>)}
    </div>)}
   </div>
  </div>
  <p className="heat-sel" role="status">{sel&&cells[sel[0]]?.[sel[1]]?`${columns[sel[1]]} · ${rows[sel[0]]}: ${cells[sel[0]][sel[1]].display}${unit?' '+unit:''}`:t('tr.ui.hmToca')}</p>
  {legend&&<div className="heat-legend" aria-hidden="true"><span>{t('carga.menos')}</span>{[0,1,2,3,4].map(l=><i key={l} className="heat-cell" data-level={l}/>)}<span>{t('carga.mas')}</span></div>}
 </figure>;
}
