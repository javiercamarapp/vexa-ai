'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';
import type {TrendsView,LedgerMonth} from '../../../../../packages/workspace-service/trends.mjs';
import {formatMinorUnits} from '../../../../../packages/metrics/money.mjs';
import {ratioBps} from '../workspace/cfo-model.mjs';
import {Button,Refresh} from './button';
import {KindBadge} from './kind-badge';
const nfCount=new Intl.NumberFormat('es-MX'),nfCompact=new Intl.NumberFormat('es-MX',{notation:'compact',maximumFractionDigits:1});
const monthShort=(m:string)=>new Intl.DateTimeFormat('es-MX',{month:'short',timeZone:'UTC'}).format(new Date(m+'-01T00:00:00Z')).replace('.','');
const monthLong=(m:string)=>new Intl.DateTimeFormat('es-MX',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(m+'-01T00:00:00Z'));
type Point={month:string;value:number|null;label:string;detail?:string};
/** Bars anchored at zero, one axis, tooltip on hover/focus, table equivalent. Heights are exact ratios (money via BigInt basis points). */
function Bars({title,unit,points,kind,note}:{title:string;unit:string;points:Point[];kind:'observed'|'estimated';note?:string}){
 const [active,setActive]=useState<number|null>(null);
 const max=Math.max(0,...points.map(p=>p.value??0)),W=480,H=150,top=10,left=34,bottom=22,bw=(W-left)/points.length,plot=H-top-bottom;
 const ticks=max>0?[0,max/2,max]:[0];
 const sel=active===null?null:points[active];
 return <figure className="chart trend">
  <figcaption className="chart-title"><span>{title}</span><span className="trend-meta"><KindBadge kind={kind}/><span>{unit}</span></span></figcaption>
  <div className="trend-plot">
   <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label={title} preserveAspectRatio="xMidYMid meet">
    {ticks.map((t,i)=>{const y=top+plot-(max>0?t/max*plot:0);return <g key={i}><line x1={left} x2={W} y1={y} y2={y} className="grid"/><text x={left-6} y={y+3} textAnchor="end" className="tick">{nfCompact.format(t)}</text></g>;})}
    {points.map((p,i)=>{const h=p.value!==null&&max>0?Math.max(p.value>0?2:0,p.value/max*plot):0,x=left+i*bw+bw*0.16,w=bw*0.68;return <g key={p.month} tabIndex={0} role="img" aria-label={`${monthLong(p.month)}: ${p.label}${p.detail?'. '+p.detail:''}`} className={'bar-col'+(active===i?' is-active':'')} onMouseEnter={()=>setActive(i)} onMouseLeave={()=>setActive(null)} onFocus={()=>setActive(i)} onBlur={()=>setActive(null)}>
     <rect x={left+i*bw} y={top} width={bw} height={plot+bottom} className="hit"/>
     {p.value===null?<rect x={x} y={top+plot-6} width={w} height={6} className="bar-unknown"/>:<rect x={x} y={top+plot-h} width={w} height={h} rx={2} className={'trend-bar trend-'+kind} style={{animationDelay:i*25+'ms'}}/>}
     <text x={x+w/2} y={H-6} textAnchor="middle" className="tick">{monthShort(p.month)}</text></g>;})}
   </svg>
   <div className="trend-tip" role="status" aria-live="polite">{sel?<><strong>{monthLong(sel.month)}</strong><span>{sel.label}</span>{sel.detail&&<span>{sel.detail}</span>}</>:<span className="trend-hint">Pasa el cursor o enfoca una barra para ver el valor exacto.</span>}</div>
  </div>
  {note&&<p className="card-lead">{note}</p>}
  <details className="trend-table"><summary>Ver como tabla</summary><div className="table-wrap" tabIndex={0} role="region" aria-label={'Tabla: '+title}><table><thead><tr><th scope="col">Mes</th><th scope="col" className="num">Valor</th></tr></thead><tbody>{points.map(p=><tr key={p.month}><th scope="row">{monthLong(p.month)}</th><td className="num">{p.label}{p.detail?` · ${p.detail}`:''}</td></tr>)}</tbody></table></div></details>
 </figure>;
}
export function TrendCharts({endpoint='/api/trends'}:{endpoint?:string}){
 const [view,setView]=useState<TrendsView|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(true),[measure,setMeasure]=useState<'orders'|'refunds'>('orders');
 const load=useCallback(async(signal?:AbortSignal)=>{setBusy(true);setError('');try{const r=await fetch(endpoint,{cache:'no-store',signal});if(!r.ok)throw Error(String(r.status));const j=await r.json();if(!j?.data?.conversations||!j?.data?.ledger)throw Error('shape');if(!signal?.aborted)setView(j.data);}catch{if(!signal?.aborted){setView(null);setError('No se pudieron consultar las tendencias. Reintenta.');}}finally{if(!signal?.aborted)setBusy(false);}},[endpoint]);
 useEffect(()=>{const c=new AbortController();void Promise.resolve().then(()=>load(c.signal));const again=()=>void load();window.addEventListener('vexa:refresh',again);return()=>{c.abort();window.removeEventListener('vexa:refresh',again);};},[load]);
 const convPoints=useMemo<Point[]>(()=>view?.conversations.series.map(p=>({month:p.month,value:p.count,label:nfCount.format(p.count)+(view.conversations.sampled?' (estimado)':'')+' conversaciones'}))??[],[view]);
 const led=view?.ledger;
 const ledgerPoints=useMemo<Point[]>(()=>{if(!led||!led.currency||led.exponent===undefined||led.exponent===null)return [];
  const pick=(m:LedgerMonth)=>m[measure];const nonNeg=led.series.map(m=>BigInt(pick(m).amountMinor));const max=nonNeg.reduce((a,n)=>n>a?n:a,0n);
  return led.series.map((m,i)=>{const x=pick(m);return {month:m.month,value:max>0n?ratioBps(nonNeg[i]<0n?-nonNeg[i]:nonNeg[i],max<0n?-max:max)??0:0,label:formatMinorUnits(x.amountMinor,led.currency!,led.exponent!),detail:`${nfCount.format(x.count)} ${measure==='orders'?'pedidos':'reembolsos'}${x.unknownAmounts?` · ${x.unknownAmounts} sin importe conocido (no se suman)`:''}`};});},[led,measure]);
 const convState=view?.conversations,ledState=view?.ledger;
 const message=(s:'ok'|'empty'|'timeout',emptyText:string)=>s==='timeout'?'No disponible ahora: la consulta acotada superó el tiempo permitido. Reintenta en unos segundos.':s==='empty'?emptyText:'';
 return <section className="card trends" aria-labelledby="trends-title" aria-busy={busy}>
  <div className="card-head"><div><p className="eyebrow">Tendencia · últimos 12 meses</p><h2 id="trends-title">Volumen y movimiento por mes</h2></div></div>
  {busy&&!view&&<div className="skeleton-stack" role="status" aria-label="Cargando tendencias"><span className="skeleton skeleton-line"/><span className="skeleton skeleton-chart"/></div>}
  {error&&<p className="state state-error" role="alert">{error} <Button size="sm" icon={<Refresh/>} onClick={()=>void load()}>Reintentar tendencias</Button></p>}
  {view&&<div className="trend-grid">
   <div>{convState&&convState.status==='ok'?<Bars title="Conversaciones por mes" unit="conversaciones" points={convPoints} kind={convState.class} note={[convState.sampled?`Estimado con una muestra del ${convState.samplePercent??''} %.`:null,'Fecha: inicio o primer mensaje.',convState.outsideWindow?`${nfCount.format(convState.outsideWindow)} fuera de la ventana${convState.undated?` (${nfCount.format(convState.undated)} sin fecha)`:''}.`:null,convState.summary?.source==='summary'?convState.summary.label:null].filter(Boolean).join(' ')}/>:<div className="trend-empty"><p className="chip">Conversaciones</p><p className="state">{message(convState?.status??'empty','Sin cargar: no hay conversaciones con fecha en los últimos 12 meses.')}</p></div>}</div>
   <div>{ledState&&ledState.status==='ok'?<><div className="seg" role="group" aria-label="Medida del libro económico"><Button size="sm" aria-pressed={measure==='orders'} onClick={()=>setMeasure('orders')}>Pedidos</Button><Button size="sm" aria-pressed={measure==='refunds'} onClick={()=>setMeasure('refunds')}>Reembolsos</Button></div><Bars title={measure==='orders'?'Pedidos registrados por mes':'Reembolsos liquidados por mes'} unit={ledState.currency??''} points={ledgerPoints} kind={ledState.class as 'observed'} note={[ledState.otherCurrencies?.length?`Otras monedas (${ledState.otherCurrencies.join(', ')}) no se suman ni se convierten.`:null,ledState.summary?.source==='summary'?ledState.summary.label:null].filter(Boolean).join(' ')||undefined}/></>:<div className="trend-empty"><p className="chip">Pedidos y reembolsos</p><p className="state">{message(ledState?.status??'empty','Sin cargar: aún no hay pedidos ni reembolsos registrados en los últimos 12 meses.')}</p></div>}</div>
  </div>}
  {view&&<p className="card-lead trend-note">{view.note}{view.conversations.sampleNote?' '+view.conversations.sampleNote:''}</p>}
 </section>;
}
