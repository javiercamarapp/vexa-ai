'use client';
import {RovaqCargando} from './rovaq-cargando';
import {useAutoRefresh} from './ui/use-auto-refresh';
import {ScrollTable} from './workspace/scroll-table';
import {PageHeader} from './ui/page-header';
import {KpiLinea} from './panel-comun/kpi-linea';
import './panel-comun/panel-comun.css';
import {Button} from './ui/button';
import {StatCard} from './ui/stat-card';
import {StatusChip} from './ui/status-chip';
import {BarList} from './ui/bar-list';
import {EmptyState} from './ui/empty-state';
import {IdChip} from './ui/id-chip';
import {Icon} from './ui/icons';
import {SkeletonStats} from './ui/skeletons';
import {nf} from './ui/format';
import css from './ops-panels.module.css';
import {useLayoutEffect,useCallback,useEffect,useRef,useState} from 'react';
import type {ComparisonResult,ComparisonSnapshot} from '../../../../packages/connectors/comparability.mjs';
import {useT} from './i18n/proveedor';
import type {Clave,Traductor} from '../lib/i18n';
const reasonLabels:Record<string,Clave>={currency_unit_changed:'tr.mc.rMoneda',scope_changed:'tr.mc.rAlcance',pipeline_changed:'tr.mc.rPipeline',mapping_changed:'tr.mc.rMapeo',taxonomy_changed:'tr.mc.rTaxonomia',channel_coverage_changed:'tr.mc.rCanales',incomplete_evidence:'tr.mc.rIncompleta',empty_dataset:'tr.mc.rVacio'};

function moneyText(value:string|null|undefined,exponent:number|undefined,t:Traductor){if(value==null)return t('tr.mc.desconocido');if(exponent===undefined)return t('tr.mc.unidadSinVerif',{v:value});const negative=value.startsWith('-'),digits=(negative?value.slice(1):value).padStart(exponent+1,'0');return (negative?'-':'')+(exponent?digits.slice(0,-exponent)+'.'+digits.slice(-exponent):digits);}
export function MigrationComparison(){
 const t=useT();
 const requestGeneration=useRef(0);
 const [denied,setDenied]=useState(false);
 const [snapshots,setSnapshots]=useState<ComparisonSnapshot[]>([]),[before,setBefore]=useState(''),[after,setAfter]=useState(''),[result,setResult]=useState<ComparisonResult|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[loaded,setLoaded]=useState(false),[nextCursor,setNextCursor]=useState<string|null>(null);
 const [start,setStart]=useState(''),[end,setEnd]=useState(''),[timezone,setTimezone]=useState('UTC'),[currency,setCurrency]=useState('USD'),[sources,setSources]=useState(''),[channels,setChannels]=useState('');
 const api=useCallback(async(url:string,body?:unknown,signal?:AbortSignal)=>{
  const generation=++requestGeneration.current;
  const response=await fetch('/api/migrations'+url,{method:body===undefined?'GET':'POST',headers:body===undefined?undefined:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),cache:'no-store',signal});
  if(signal?.aborted||generation!==requestGeneration.current)throw new DOMException(t('tr.mc.obsoleta'),'AbortError');
  if([401,403].includes(response.status)){requestGeneration.current++;setDenied(true);setSnapshots([]);setBefore('');setAfter('');setResult(null);setNextCursor(null);setLoaded(false);setStart('');setEnd('');setTimezone('UTC');setCurrency('USD');setSources('');setChannels('');throw Error(t('tr.mc.sinAuth'));}
  if(!response.ok)throw Error(response.status===409?t('tr.mc.e409'):t('tr.mc.eServicio'));
  const data=await response.json();if(signal?.aborted||generation!==requestGeneration.current)throw new DOMException(t('tr.mc.obsoleta'),'AbortError');return data;
 },[t]);
 const refresh=useCallback(async(signal?:AbortSignal)=>{const body=await api('',undefined,signal);setSnapshots(body.snapshots);setNextCursor(body.nextCursor);setLoaded(true);setDenied(false);},[api]);
 useEffect(()=>{const controller=new AbortController();void Promise.resolve().then(()=>refresh(controller.signal)).catch(e=>{if(!controller.signal.aborted&&e.name!=='AbortError')setError(e.message);});return()=>controller.abort();},[refresh]);
 // Datos nuevos: relectura en segundo plano de los cortes; no corre durante una acción.
 const busyRef=useRef(false);useLayoutEffect(()=>{busyRef.current=busy;});
 useAutoRefresh(()=>refresh(),{ocupado:()=>busyRef.current});
 async function action(work:()=>Promise<void>){setError('');setBusy(true);try{await work();}catch(e){if(!(e instanceof Error&&e.name==='AbortError'))setError(e instanceof Error?e.message:t('tr.mc.eComparacion'));}finally{setBusy(false);}}
 const label=(s:ComparisonSnapshot)=>t('tr.mc.optLabel',{id:s.id.slice(0,8),marca:s.watermark,n:s.summary.conversations}); const countLabels:Record<string,string>={conversations:t('tr.mc.cResueltas'),sourceConversations:t('tr.mc.cFuente'),messages:t('tr.mc.cMensajes'),orders:t('tr.mc.cOrdenes')};
 const countIcons:Record<string,string>={conversations:'message',sourceConversations:'database',messages:'mail',orders:'receipt'};
 if(!loaded&&!error)return <RovaqCargando mensaje=""/>;
 return <section className="stack">
  <PageHeader eyebrow={t('tr.mc.interno')} title={t('tr.mc.titulo')} description={t('tr.mc.desc')}/>
  {error&&<p role="alert" className="notice-bar"><Icon name="alert" size={14}/>{error}</p>}
  {!loaded&&!error&&<><p role="status" className="sr-only">{t('tr.mc.cargando')}</p><SkeletonStats count={2}/></>}
  {loaded&&<KpiLinea label={t('tr.mc.indicadores')} items={[
   {label:t('tr.mc.guardados'),value:nf.format(snapshots.length)+(nextCursor?'+':''),c:5,partes:snapshots.map(x=>({key:x.id,label:x.id.slice(0,6),value:Number(x.summary.conversations)})),nota:snapshots.length?t('tr.mc.convPorCorte'):t('tr.mc.sinCortes')},
   {label:t('tr.mc.convUltimo'),value:snapshots[0]?nf.format(snapshots[0].summary.conversations):'—',vacio:!snapshots[0],c:3,partes:snapshots[0]?[{label:t('tr.mc.ultimo'),value:Number(snapshots[0].summary.conversations)}]:undefined,nota:snapshots[0]?t('tr.mc.corteId',{a:snapshots[0].id.slice(0,6),b:snapshots[0].id.slice(-3)}):t('tr.mc.sinCortes')}]}/>}
  {loaded&&!snapshots.length&&<EmptyState art="doc" title={t('tr.mc.aunNo')} body={t('tr.mc.congela')} compact/>}
  <div className="split" data-even>
   <fieldset className="card" disabled={busy||denied} style={{margin:0}}><legend className="sr-only">{t('tr.mc.selGuardados')}</legend>
    <div className="card-title"><div><h2>{t('tr.mc.comparar2')}</h2><p>{t('tr.mc.selBaseline')}</p></div>{nextCursor&&<Button size="sm" variant="ghost" onClick={()=>void action(async()=>{const data=await api('?'+new URLSearchParams({cursor:nextCursor}));setSnapshots(previous=>[...previous,...data.snapshots.filter((s:ComparisonSnapshot)=>!previous.some(p=>p.id===s.id))]);setNextCursor(data.nextCursor);})}>{t('tr.mc.cargarAnt')}</Button>}</div>
    <div className={css.form}>
     <label htmlFor="comparison-before">{t('tr.mc.antes')}</label><select id="comparison-before" value={before} onChange={e=>{setBefore(e.target.value);setResult(null);}}><option value="">{t('tr.mc.selBaselineOpt')}</option>{snapshots.map(s=><option key={s.id} value={s.id}>{label(s)}</option>)}</select>
     <label htmlFor="comparison-after">{t('tr.mc.despues')}</label><select id="comparison-after" value={after} onChange={e=>{setAfter(e.target.value);setResult(null);}}><option value="">{t('tr.mc.selPostOpt')}</option>{snapshots.map(s=><option key={s.id} value={s.id}>{label(s)}</option>)}</select>
     <div><Button variant="primary" size="sm" disabled={!before||!after||before===after} onClick={()=>void action(async()=>setResult(await api('/compare?'+new URLSearchParams({before,after}))))}>{t('tr.mc.compararCortes')}</Button></div>
    </div>
   </fieldset>
   <section className="card" aria-label={t('tr.mc.porTamano')}>
    <div className="card-title"><div><h2>{t('tr.mc.guardados')}</h2><p>{t('tr.mc.recientes')}</p></div></div>
    <BarList c={5} empty={t('tr.mc.sinCortesTodavia')} items={snapshots.slice(0,6).map(s=>({key:s.id,label:s.watermark,value:s.summary.conversations,display:nf.format(s.summary.conversations),kind:'observed' as const}))}/>
   </section>
  </div>
  <form className="card" onSubmit={e=>{e.preventDefault();void action(async()=>{const data=await api('',{dateStart:new Date(start+'T00:00:00Z').toISOString(),dateEnd:new Date(end+'T00:00:00Z').toISOString(),timezone,currency,dateBasis:'conversation',sources:sources.split(',').map(x=>x.trim()).filter(Boolean),channels:channels.split(',').map(x=>x.trim()).filter(Boolean)});setAfter(data.snapshot.id);setResult(null);await refresh();});}}><fieldset disabled={busy||denied} className={css.form} style={{margin:0,padding:0,border:0}}><legend className="sr-only">{t('tr.mc.congelarLegend')}</legend>
   <div className="card-title"><div><h2>{t('tr.mc.congelarNuevo')}</h2><p>{t('tr.mc.propAnalista')}</p></div><Button type="submit" size="sm" variant="primary">{t('tr.mc.congelarCorte')}</Button></div>
   <div className={css.cols}><label>{t('tr.mc.inicioUtc')}<input required type="date" value={start} onChange={e=>setStart(e.target.value)}/></label><label>{t('tr.mc.finUtc')}<input required type="date" value={end} onChange={e=>setEnd(e.target.value)}/></label></div>
   <details><summary>{t('tr.mc.opcionesAlcance')}</summary><div className={css.cols}>
    <label>{t('tr.mc.zonaHoraria')}<input required value={timezone} onChange={e=>setTimezone(e.target.value)}/></label><label>{t('tr.mc.moneda')}<input required maxLength={3} value={currency} onChange={e=>setCurrency(e.target.value.toUpperCase())}/></label>
    <label>{t('tr.mc.fuentesComa')}<input value={sources} onChange={e=>setSources(e.target.value)} placeholder={t('tr.mc.todasVacio')}/></label><label>{t('tr.mc.canalesComa')}<input value={channels} onChange={e=>setChannels(e.target.value)} placeholder={t('tr.mc.todosVacio')}/></label></div></details>
  </fieldset></form>
  {result&&<section aria-label={t('tr.mc.resultadoAria')} className="stack">
   <div className="card"><div className="card-title"><div><h2>{result.state==='comparable'?t('tr.mc.comparable'):t('tr.mc.noComparable')}</h2><p>{result.notice}</p></div><StatusChip tone={result.state==='comparable'?'ok':'warn'}>{result.state==='comparable'?t('tr.mc.aptoComparar'):t('tr.mc.revisarMotivos')}</StatusChip></div>
    <div className={css.flow}><span className={css.flowNode}><span>{t('tr.mc.antes')}</span><IdChip value={result.before.id} head={8} tail={4}/></span><Icon name="arrow-right" size={16}/><span className={css.flowNode}><span>{t('tr.mc.despues')}</span><IdChip value={result.after.id} head={8} tail={4}/></span></div>
    {result.reasons.length>0&&<ul className="row-list" style={{marginTop:'var(--sp-3)'}}>{result.reasons.map(reason=><li key={reason} className="notice-bar"><Icon name="info" size={14}/><p>{reasonLabels[reason]?t(reasonLabels[reason]):reason}</p></li>)}</ul>}
   </div>
   <div className="stat-grid">{Object.entries(result.counts).map(([key,v])=><StatCard key={key} label={countLabels[key]??key} icon={countIcons[key]??'database'} kind="observed" value={nf.format(Number(v.after))} foot={<>{t('tr.mc.diferencia',{a:nf.format(Number(v.before)),d:String(v.delta)})}</>}/>)}</div>
   <div className="split" data-even>
    <section className="card" aria-label={t('tr.mc.coberturaCanalAria')}><div className="card-title"><div><h2>{t('tr.mc.coberturaCanal')}</h2><p>{t('tr.mc.conteosObs')}</p></div></div>
     <ScrollTable label={t('tr.mc.coberturaTabla')}><table className="dtable"><thead><tr><th>{t('tr.mc.thCanal')}</th><th className="num">{t('tr.mc.antes')}</th><th className="num">{t('tr.mc.despues')}</th></tr></thead><tbody>{result.channels.map(c=><tr key={c.channel}><th scope="row">{c.channel}</th><td className="num">{c.before}</td><td className="num">{c.after}</td></tr>)}</tbody></table></ScrollTable></section>
    <section className="card" aria-label={t('tr.mc.importesAria')}><div className="card-title"><div><h2>{t('tr.mc.importesOrdenes')}</h2><p>{t('tr.mc.noSonPerdidas')}</p></div></div>
     {Object.keys(result.money).length===0?<p className="state">{t('tr.mc.sinImportes')}</p>:<ScrollTable label={t('tr.mc.importesMoneda')}><table className="dtable"><thead><tr><th>{t('tr.mc.thMoneda')}</th><th className="num">{t('tr.mc.antes')}</th><th className="num">{t('tr.mc.despues')}</th><th className="num">{t('tr.mc.deltaComp')}</th></tr></thead><tbody>{Object.entries(result.money).map(([code,m])=>{const bx=result.before.method.currencyExponents[code],ax=result.after.method.currencyExponents[code];return <tr key={code}><th scope="row">{code}</th><td className="num">{moneyText(m.before?.amountMinor,bx,t)}<br/><small>{t('tr.mc.conocido',{v:moneyText(m.before?.knownSubtotalMinor,bx,t)})}</small></td><td className="num">{moneyText(m.after?.amountMinor,ax,t)}<br/><small>{t('tr.mc.conocido',{v:moneyText(m.after?.knownSubtotalMinor,ax,t)})}</small></td><td className="num">{m.deltaMinor===null?t('tr.mc.noDisponible'):moneyText(m.deltaMinor,ax,t)}</td></tr>;})}</tbody></table></ScrollTable>}
     <p className={css.muted}>{t('tr.mc.desconocidosPerm')}</p></section>
   </div>
   <details><summary>{t('tr.mc.metodo')}</summary><pre className={css.pre}>{JSON.stringify({before:{scope:result.before.scope,method:result.before.method,watermark:result.before.watermark,inputHash:result.before.inputHash,warnings:result.before.summary.warnings},after:{scope:result.after.scope,method:result.after.method,watermark:result.after.watermark,inputHash:result.after.inputHash,warnings:result.after.summary.warnings}},null,2)}</pre></details>
  </section>}
 </section>;
}
