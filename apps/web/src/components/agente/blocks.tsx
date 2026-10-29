'use client';
import {AreaChart} from '../ui/area-chart';
import {useLocaleIntl,useT} from '../i18n/proveedor';
import {BarChart} from '../ui/bar-chart';
import {DonutChart} from '../ui/donut-chart';
import {KindBadge} from '../ui/kind-badge';
import {coverageText,fmtCell} from './format';
import type {Block,Figure} from './types';

export function ClassTag({block}:{block:Block}){const tx=useT();return block.class==='mixed'?<span className="chip" title={tx('tr.ag.claseAyuda')}>{tx('tr.ag.claseFila')}</span>:<KindBadge kind={block.class}/>;}
export function DataTable({block}:{block:Block}){
 const tx=useT();
 return <div className="table-wrap" tabIndex={0} role="region" aria-label={tx('tr.ui.tabla',{titulo:block.title})}><table><thead><tr>{block.columns.map(c=><th key={c.key} scope="col" className={c.kind==='integer'?'num':undefined}>{c.label}</th>)}</tr></thead>
  <tbody>{block.rows.map((r,i)=><tr key={i}>{block.columns.map((c,j)=>j===0?<th key={c.key} scope="row">{fmtCell(c.kind,r[c.key])}</th>:<td key={c.key} className={c.kind==='integer'?'num':undefined}>{fmtCell(c.kind,r[c.key])}</td>)}</tr>)}</tbody></table></div>;
}
function Chart({block}:{block:Block}){
 const loc=useLocaleIntl();
 const chart=block.chart;if(!chart)return null;
 const kind=block.class==='mixed'?'observed':block.class;
 if(chart.kind==='line')return <AreaChart title={block.title} unit={chart.unit} series={[{name:chart.unit,tone:kind==='estimated'?'estimated':'primary',points:chart.series.map(s=>({label:s.label,value:s.value,display:s.display,partial:s.partial||undefined}))}]}/>;
 if(chart.kind==='donut'){
  const total=chart.series.reduce((a,s)=>a+(s.value??0),0);
  return <DonutChart title={block.title} centerValue={total.toLocaleString(loc)} centerLabel={chart.unit} segments={chart.series.map((s,i)=>({key:s.key,label:s.label,value:s.value??0,display:s.display,tone:(i===0?4:i===1?5:'neutral') as 4|5|'neutral'}))}/>;
 }
 return <BarChart title={chart.unit} unit="" data={chart.series.map(s=>({key:s.key,label:s.label,value:s.value,display:s.display,kind}))}/>;
}
/** Table, chart (bar / line / donut) or both, always with class, coverage and the table equivalent. */
export function BlockView({block}:{block:Block}){
 const tx=useT();
 return <section className="card agente-block" aria-label={block.title}>
  <div className="agente-block-head"><h3>{block.title}</h3><span className="agente-block-tags"><ClassTag block={block}/><span className="chip agente-cov" title={tx('tr.ag.cobAyuda')}>{coverageText(block.coverage,tx)}</span></span></div>
  {block.chart?<><Chart block={block}/><details className="trend-table"><summary className="ctl">{tx('cfo.serie.verTabla')}</summary><DataTable block={block}/></details></>:<DataTable block={block}/>}
  {block.note&&<p className="card-lead agente-note">{block.note}</p>}
  {block.truncated&&<p className="card-lead agente-note">{tx('tr.ag.masFilas')}</p>}
 </section>;
}
/** KPI tiles: one figure each, with its class and coverage. Unknown stays «No disponible», never 0. */
export function Kpis({figures}:{figures:Figure[]}){
 const tx=useT();
 return <ul className="agente-figures" aria-label={tx('tr.ag.cifrasAria')}>{figures.map(f=><li key={f.id} className="component-card"><h4>{f.label}</h4><p className="component-amount">{f.display}</p><span className="agente-block-tags"><KindBadge kind={f.class}/><span className="chip">{coverageText(f.coverage,tx)}</span></span></li>)}</ul>;
}
