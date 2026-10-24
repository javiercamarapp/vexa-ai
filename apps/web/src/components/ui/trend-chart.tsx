'use client';
import {RovaqCargando} from '../rovaq-cargando';
import {useCallback,useEffect,useMemo,useState} from 'react';
import type {TrendsView,LedgerMonth} from '../../../../../packages/workspace-service/trends.mjs';
import {formatMinorUnits} from '../../lib/formato/dinero-pantalla.mjs';
import {ratioBps} from '../workspace/cfo-model.mjs';
import {axisLabel} from '../../../../../packages/cfo-copilot/src/format.mjs';
import {mesAbrev} from '../../lib/charts/escala.mjs';
import {Button,Refresh} from './button';
import {KindBadge} from './kind-badge';
import {ColumnPlot,type ColumnDatum} from './column-chart';
import {fetchCupo} from '../../lib/workspace/cupo.mjs';
const nfCount=new Intl.NumberFormat('es-MX');
/** Puntos de importes: altura = fracción exacta del máximo (bps, BigInt); `axis` rotula el eje en unidades mayores de la moneda. */
export function ledgerAxis(maxMinor:bigint,exponent:number){return (t:number,max:number)=>axisLabel(max>0?Number(maxMinor)*(t/max):0,exponent);}
const monthShort=(m:string)=>mesAbrev(m);
const monthLong=(m:string)=>new Intl.DateTimeFormat('es-MX',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(m+'-01T00:00:00Z'));
type Point={month:string;value:number|null;label:string;detail?:string};
/** Bars anchored at zero, one axis, tooltip on hover/focus, table equivalent. Heights are exact ratios (money via BigInt basis points). Drawn by the shared ColumnPlot. */
export function Bars({title,unit,points,kind,note,tickLabel}:{title:string;unit:string;points:Point[];kind:'observed'|'estimated';note?:string;/** Rotula el eje cuando la altura no está en la unidad mostrada (p. ej. importes como fracción del máximo). */tickLabel?:(tick:number,max:number)=>string}){
 const data:ColumnDatum[]=points.map(p=>({key:p.month,label:monthShort(p.month),long:monthLong(p.month),value:p.value,display:p.label,detail:p.detail}));
 return <figure className="chart trend">
  <figcaption className="chart-title"><span>{title}</span><span className="trend-meta"><KindBadge kind={kind}/><span>{unit}</span></span></figcaption>
  <ColumnPlot data={data} kind={kind} title={title} axis={tickLabel}/>
  {note&&<p className="card-lead">{note}</p>}
  <details className="trend-table"><summary>Ver como tabla</summary><div className="table-wrap" tabIndex={0} role="region" aria-label={'Tabla: '+title}><table><thead><tr><th scope="col">Mes</th><th scope="col" className="num">Valor</th></tr></thead><tbody>{points.map(p=><tr key={p.month}><th scope="row">{monthLong(p.month)}</th><td className="num">{p.label}{p.detail?` · ${p.detail}`:''}</td></tr>)}</tbody></table></div></details>
 </figure>;
}
export function TrendCharts({endpoint='/api/trends'}:{endpoint?:string}){
 const [view,setView]=useState<TrendsView|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(true),[measure,setMeasure]=useState<'orders'|'refunds'>('orders');
 const load=useCallback(async(signal?:AbortSignal)=>{setBusy(true);setError('');try{const r=await fetchCupo(endpoint,{cache:'no-store',signal});if(!r.ok)throw Error(String(r.status));const j=await r.json();if(!j?.data?.conversations||!j?.data?.ledger)throw Error('shape');if(!signal?.aborted)setView(j.data);}catch{if(!signal?.aborted){setView(null);setError('No se pudieron consultar las tendencias. Reintenta.');}}finally{if(!signal?.aborted)setBusy(false);}},[endpoint]);
 useEffect(()=>{const c=new AbortController();void Promise.resolve().then(()=>load(c.signal));const again=()=>void load();window.addEventListener('vexa:refresh',again);return()=>{c.abort();window.removeEventListener('vexa:refresh',again);};},[load]);
 const convPoints=useMemo<Point[]>(()=>view?.conversations.series.map(p=>({month:p.month,value:p.count,label:nfCount.format(p.count)+(view.conversations.sampled?' (estimado)':'')+' conversaciones'}))??[],[view]);
 const led=view?.ledger;
 const ledgerPoints=useMemo<Point[]>(()=>{if(!led||!led.currency||led.exponent===undefined||led.exponent===null)return [];
  const pick=(m:LedgerMonth)=>m[measure];const nonNeg=led.series.map(m=>BigInt(pick(m).amountMinor));const max=nonNeg.reduce((a,n)=>n>a?n:a,0n);
  return led.series.map((m,i)=>{const x=pick(m);return {month:m.month,value:max>0n?ratioBps(nonNeg[i]<0n?-nonNeg[i]:nonNeg[i],max<0n?-max:max)??0:0,label:formatMinorUnits(x.amountMinor,led.currency!,led.exponent!),detail:`${nfCount.format(x.count)} ${measure==='orders'?'pedidos':'reembolsos'}${x.unknownAmounts?` · ${x.unknownAmounts} sin importe conocido (no se suman)`:''}`};});},[led,measure]);
 const ledgerMax=useMemo<bigint>(()=>led&&led.currency&&led.exponent!==undefined&&led.exponent!==null?led.series.map(m=>BigInt(m[measure].amountMinor)).reduce((a,n)=>n>a?n:a,0n):0n,[led,measure]);
 const convState=view?.conversations,ledState=view?.ledger;
 const message=(s:'ok'|'empty'|'timeout',emptyText:string)=>s==='timeout'?'No disponible ahora: la consulta acotada superó el tiempo permitido. Reintenta en unos segundos.':s==='empty'?emptyText:'';
 return <section className="card trends" aria-labelledby="trends-title" aria-busy={busy}>
  <div className="card-head"><div><p className="eyebrow">Tendencia · últimos 12 meses</p><h2 id="trends-title">Volumen y movimiento por mes</h2></div></div>
  {busy&&!view&&<RovaqCargando compacto mensaje="Cargando tendencias"/>}
  {error&&<p className="state state-error" role="alert">{error} <Button size="sm" icon={<Refresh/>} onClick={()=>void load()}>Reintentar tendencias</Button></p>}
  {view&&<div className="trend-grid">
   <div>{convState&&convState.status==='ok'?<Bars title="Conversaciones por mes" unit="conversaciones" points={convPoints} kind={convState.class} note={[convState.sampled?`Estimado con una muestra del ${convState.samplePercent??''} %.`:null,'Fecha: inicio o primer mensaje.',convState.outsideWindow?`${nfCount.format(convState.outsideWindow)} fuera de la ventana${convState.undated?` (${nfCount.format(convState.undated)} sin fecha)`:''}.`:null,convState.summary?.source==='summary'?convState.summary.label:null].filter(Boolean).join(' ')}/>:<div className="trend-empty"><p className="chip">Conversaciones</p><p className="state">{message(convState?.status??'empty','Sin cargar: no hay conversaciones con fecha en los últimos 12 meses.')}</p></div>}</div>
   <div>{ledState&&ledState.status==='ok'?<><div className="seg" role="group" aria-label="Medida del libro económico"><Button size="sm" aria-pressed={measure==='orders'} onClick={()=>setMeasure('orders')}>Pedidos</Button><Button size="sm" aria-pressed={measure==='refunds'} onClick={()=>setMeasure('refunds')}>Reembolsos</Button></div><Bars title={measure==='orders'?'Pedidos registrados por mes':'Reembolsos liquidados por mes'} unit={ledState.currency??''} points={ledgerPoints} tickLabel={ledgerAxis(ledgerMax,ledState.exponent??0)} kind={ledState.class as 'observed'} note={[ledState.otherCurrencies?.length?`Otras monedas (${ledState.otherCurrencies.join(', ')}) no se suman ni se convierten.`:null,ledState.summary?.source==='summary'?ledState.summary.label:null].filter(Boolean).join(' ')||undefined}/></>:<div className="trend-empty"><p className="chip">Pedidos y reembolsos</p><p className="state">{message(ledState?.status??'empty','Sin cargar: aún no hay pedidos ni reembolsos registrados en los últimos 12 meses.')}</p></div>}</div>
  </div>}
  {view&&<p className="card-lead trend-note">{view.note}{view.conversations.sampleNote?' '+view.conversations.sampleNote:''}</p>}
 </section>;
}
