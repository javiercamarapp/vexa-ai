'use client';
import {RovaqCargando} from '../rovaq-cargando';
import {useCallback,useEffect,useMemo,useState} from 'react';
import {useIdioma,useLocaleIntl,useT} from '../i18n/proveedor';
import type {Clave} from '../../lib/i18n';
import type {TrendsView,LedgerMonth} from '../../../../../packages/workspace-service/trends.mjs';
import {formatMinorUnits} from '../../lib/formato/dinero-pantalla.mjs';
import {ratioBps} from '../workspace/cfo-model.mjs';
import {axisLabel} from '../../../../../packages/cfo-copilot/src/format.mjs';
import {mesAbrev} from '../../lib/charts/escala.mjs';
import {Button,Refresh} from './button';
import {KindBadge} from './kind-badge';
import {ColumnPlot,type ColumnDatum} from './column-chart';
import {fetchCupo} from '../../lib/workspace/cupo.mjs';
import {nf} from '../../lib/formato/idioma.mjs';
const nfCount=nf;
/** Puntos de importes: altura = fracción exacta del máximo (bps, BigInt); `axis` rotula el eje en unidades mayores de la moneda. */
export function ledgerAxis(maxMinor:bigint,exponent:number){return (t:number,max:number)=>axisLabel(max>0?Number(maxMinor)*(t/max):0,exponent);}
const monthLong=(m:string,loc:string)=>new Intl.DateTimeFormat(loc,{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(m+'-01T00:00:00Z'));
type Point={month:string;value:number|null;label:string;detail?:string};
/** Bars anchored at zero, one axis, tooltip on hover/focus, table equivalent. Heights are exact ratios (money via BigInt basis points). Drawn by the shared ColumnPlot. */
export function Bars({title,unit,points,kind,note,tickLabel}:{title:string;unit:string;points:Point[];kind:'observed'|'estimated';note?:string;/** Rotula el eje cuando la altura no está en la unidad mostrada (p. ej. importes como fracción del máximo). */tickLabel?:(tick:number,max:number)=>string}){
 const t=useT(),loc=useLocaleIntl(),idioma=useIdioma();
 const data:ColumnDatum[]=points.map(p=>({key:p.month,label:mesAbrev(p.month,idioma),long:monthLong(p.month,loc),value:p.value,display:p.label,detail:p.detail}));
 return <figure className="chart trend">
  <figcaption className="chart-title"><span>{title}</span><span className="trend-meta"><KindBadge kind={kind}/><span>{unit}</span></span></figcaption>
  <ColumnPlot data={data} kind={kind} title={title} axis={tickLabel}/>
  {note&&<p className="card-lead">{note}</p>}
  <details className="trend-table"><summary>{t('cfo.serie.verTabla')}</summary><div className="table-wrap" tabIndex={0} role="region" aria-label={t('tr.ui.tabla',{titulo:title})}><table><thead><tr><th scope="col">{t('cfo.serie.mes')}</th><th scope="col" className="num">{t('cfo.serie.valor')}</th></tr></thead><tbody>{points.map(p=><tr key={p.month}><th scope="row">{monthLong(p.month,loc)}</th><td className="num">{p.label}{p.detail?` · ${p.detail}`:''}</td></tr>)}</tbody></table></div></details>
 </figure>;
}
export function TrendCharts({endpoint='/api/trends'}:{endpoint?:string}){
 const t=useT();
 const [view,setView]=useState<TrendsView|null>(null),[error,setError]=useState<Clave|''>(''),[busy,setBusy]=useState(true),[measure,setMeasure]=useState<'orders'|'refunds'>('orders');
 const load=useCallback(async(signal?:AbortSignal)=>{setBusy(true);setError('');try{const r=await fetchCupo(endpoint,{cache:'no-store',signal});if(!r.ok)throw Error(String(r.status));const j=await r.json();if(!j?.data?.conversations||!j?.data?.ledger)throw Error('shape');if(!signal?.aborted)setView(j.data);}catch{if(!signal?.aborted){setView(null);setError('tr.ui.trErr');}}finally{if(!signal?.aborted)setBusy(false);}},[endpoint]);
 useEffect(()=>{const c=new AbortController();void Promise.resolve().then(()=>load(c.signal));const again=()=>void load();window.addEventListener('vexa:refresh',again);return()=>{c.abort();window.removeEventListener('vexa:refresh',again);};},[load]);
 const convPoints=useMemo<Point[]>(()=>view?.conversations.series.map(p=>({month:p.month,value:p.count,label:t(view.conversations.sampled?'tr.ui.trConvEst':'tr.ui.trConv',{n:nfCount.format(p.count)})}))??[],[view,t]);
 const led=view?.ledger;
 const ledgerPoints=useMemo<Point[]>(()=>{if(!led||!led.currency||led.exponent===undefined||led.exponent===null)return [];
  const pick=(m:LedgerMonth)=>m[measure];const nonNeg=led.series.map(m=>BigInt(pick(m).amountMinor));const max=nonNeg.reduce((a,n)=>n>a?n:a,0n);
  return led.series.map((m,i)=>{const x=pick(m);return {month:m.month,value:max>0n?ratioBps(nonNeg[i]<0n?-nonNeg[i]:nonNeg[i],max<0n?-max:max)??0:0,label:formatMinorUnits(x.amountMinor,led.currency!,led.exponent!),detail:t(measure==='orders'?'tr.ui.trPedidos':'tr.ui.trReembolsos',{n:nfCount.format(x.count)})+(x.unknownAmounts?' · '+t('tr.ui.trSinImporte',{u:x.unknownAmounts}):'')};});},[led,measure,t]);
 const ledgerMax=useMemo<bigint>(()=>led&&led.currency&&led.exponent!==undefined&&led.exponent!==null?led.series.map(m=>BigInt(m[measure].amountMinor)).reduce((a,n)=>n>a?n:a,0n):0n,[led,measure]);
 const convState=view?.conversations,ledState=view?.ledger;
 const message=(s:'ok'|'empty'|'timeout',emptyText:string)=>s==='timeout'?t('tr.ui.trTimeout'):s==='empty'?emptyText:'';
 return <section className="card trends" aria-labelledby="trends-title" aria-busy={busy}>
  <div className="card-head"><div><p className="eyebrow">{t('tr.ui.trEyebrow',{meses:12})}</p><h2 id="trends-title">{t('tr.ui.trTitulo')}</h2></div></div>
  {busy&&!view&&<RovaqCargando compacto mensaje={t('tr.ui.trCargando')}/>}
  {error&&<p className="state state-error" role="alert">{t(error)} <Button size="sm" icon={<Refresh/>} onClick={()=>void load()}>{t('res.reintentarTendencias')}</Button></p>}
  {view&&<div className="trend-grid">
   <div>{convState&&convState.status==='ok'?<Bars title={t('tr.ui.trConvMes')} unit={t('tr.ui.convMin')} points={convPoints} kind={convState.class} note={[convState.sampled?t('tr.ui.trMuestra',{p:convState.samplePercent??''}):null,t('tr.ui.trFecha'),convState.outsideWindow?(convState.undated?t('tr.ui.trFueraSinFecha',{n:nfCount.format(convState.outsideWindow),u:nfCount.format(convState.undated)}):t('tr.ui.trFuera',{n:nfCount.format(convState.outsideWindow)})):null,convState.summary?.source==='summary'?convState.summary.label:null].filter(Boolean).join(' ')}/>:<div className="trend-empty"><p className="chip">{t('tr.ui.trChipConv')}</p><p className="state">{message(convState?.status??'empty',t('tr.ui.trVacioConv',{meses:12}))}</p></div>}</div>
   <div>{ledState&&ledState.status==='ok'?<><div className="seg" role="group" aria-label={t('tr.ui.trMedida')}><Button size="sm" aria-pressed={measure==='orders'} onClick={()=>setMeasure('orders')}>{t('res.pedidos')}</Button><Button size="sm" aria-pressed={measure==='refunds'} onClick={()=>setMeasure('refunds')}>{t('res.reembolsos')}</Button></div><Bars title={measure==='orders'?t('tr.ui.trPedMes'):t('tr.ui.trReembMes')} unit={ledState.currency??''} points={ledgerPoints} tickLabel={ledgerAxis(ledgerMax,ledState.exponent??0)} kind={ledState.class as 'observed'} note={[ledState.otherCurrencies?.length?t('tr.ui.trOtrasMonedas',{lista:ledState.otherCurrencies.join(', ')}):null,ledState.summary?.source==='summary'?ledState.summary.label:null].filter(Boolean).join(' ')||undefined}/></>:<div className="trend-empty"><p className="chip">{t('tr.ui.trChipLibro')}</p><p className="state">{message(ledState?.status??'empty',t('tr.ui.trVacioLibro',{meses:12}))}</p></div>}</div>
  </div>}
  {view&&<p className="card-lead trend-note">{view.note}{view.conversations.sampleNote?' '+view.conversations.sampleNote:''}</p>}
 </section>;
}
