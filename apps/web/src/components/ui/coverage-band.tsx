'use client';
import {useCallback,useEffect,useState} from 'react';
import type {CoverageSource,CoverageView} from '../../../../../packages/workspace-service/provenance.mjs';
import {Button,Refresh} from './button';
const nf=new Intl.NumberFormat('es-MX');
const pct=(part:number,whole:number)=>whole>0?Math.round(part*1000/whole)/10:null;
const fmtPct=(p:number|null)=>p===null?'—':p.toLocaleString('es-MX',{maximumFractionDigits:1})+' %';
const when=(iso:string|null)=>iso?new Intl.DateTimeFormat('es-MX',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(iso))+' UTC':null;
function Row({s}:{s:CoverageSource}){
 const inc=pct(s.incorporated,s.total);
 const seg=(n:number)=>s.total>0?(n*100/s.total):0;
 return <li className="cov-row" data-loaded={s.loaded}>
  <div className="cov-row-head"><span className="cov-name">{s.label}</span><span className="cov-figure">{s.loaded?<><strong>{fmtPct(inc)}</strong> incorporado</>:<span className="cov-none">Sin cargar</span>}</span></div>
  {s.loaded?<div className="cov-track" role="img" aria-label={`${s.label}: ${nf.format(s.incorporated)} incorporadas, ${nf.format(s.rejected)} rechazadas, ${nf.format(s.pending)} pendientes, de ${nf.format(s.total)} filas`}>
   {s.incorporated>0&&<span className="cov-seg cov-in" style={{flexBasis:seg(s.incorporated)+'%'}}/>}
   {s.rejected>0&&<span className="cov-seg cov-rej" style={{flexBasis:Math.max(seg(s.rejected),1)+'%'}}/>}
   {s.pending>0&&<span className="cov-seg cov-pen" style={{flexBasis:Math.max(seg(s.pending),1)+'%'}}/>}
  </div>:<div className="cov-track cov-track-empty" aria-hidden="true"/>}
  <p className="cov-meta">{s.loaded?<>{nf.format(s.incorporated)} de {nf.format(s.total)} filas · {nf.format(s.rejected)} rechazadas · {nf.format(s.pending)} pendientes · {s.imports} importaciones{s.openImports>0?` (${s.openImports} en curso)`:''}{when(s.lastUpdate)?' · '+when(s.lastUpdate):''}</>:'Aún no hay importaciones de esta fuente; su tamaño no se estima.'}</p>
 </li>;
}
/** Which part of the historical information is incorporated and which is missing, per source (from registered imports). */
export function CoverageBand({endpoint='/api/coverage'}:{endpoint?:string}){
 const [view,setView]=useState<CoverageView|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(true);
 const load=useCallback(async(signal?:AbortSignal)=>{setBusy(true);setError('');try{const r=await fetch(endpoint,{cache:'no-store',signal});if(!r.ok)throw Error(String(r.status));const j=await r.json();if(!Array.isArray(j?.data?.sources))throw Error('shape');if(!signal?.aborted)setView(j.data);}catch{if(!signal?.aborted){setView(null);setError('No se pudo consultar la cobertura. Reintenta.');}}finally{if(!signal?.aborted)setBusy(false);}},[endpoint]);
 useEffect(()=>{const c=new AbortController();void Promise.resolve().then(()=>load(c.signal));return()=>c.abort();},[load]);
 const loaded=view?.sources.filter(s=>s.loaded).length??0;
 return <section className="card coverage" aria-labelledby="coverage-title" aria-busy={busy}>
  <div className="card-head"><div><p className="eyebrow">Cobertura</p><h2 id="coverage-title">Información histórica incorporada</h2></div><Button size="sm" icon={<Refresh/>} disabled={busy} onClick={()=>void load()}>Actualizar cobertura</Button></div>
  {busy&&!view&&<div className="skeleton-stack" role="status" aria-label="Cargando cobertura"><span className="skeleton skeleton-line"/><span className="skeleton skeleton-bar"/><span className="skeleton skeleton-line"/><span className="skeleton skeleton-bar"/></div>}
  {error&&<p className="state state-error" role="alert">{error}</p>}
  {view&&<>
   <p className="card-lead">{loaded} de {view.sources.length} fuentes con datos cargados. {view.note}</p>
   <ul className="cov-list">{view.sources.map(s=><Row key={s.key} s={s}/>)}</ul>
   <ul className="legend" aria-label="Leyenda de cobertura"><li><i className="sw cov-in"/>Incorporadas</li><li><i className="sw cov-rej"/>Rechazadas</li><li><i className="sw cov-pen"/>Pendientes</li><li><i className="sw sw-empty"/>Sin cargar</li></ul>
   <details className="cov-table"><summary>Ver como tabla</summary><div className="table-wrap" tabIndex={0} role="region" aria-label="Cobertura por fuente"><table><thead><tr><th scope="col">Fuente</th><th scope="col" className="num">Filas</th><th scope="col" className="num">Incorporadas</th><th scope="col" className="num">Rechazadas</th><th scope="col" className="num">Pendientes</th></tr></thead><tbody>{view.sources.map(s=><tr key={s.key}><th scope="row">{s.label}</th><td className="num">{s.loaded?nf.format(s.total):'Sin cargar'}</td><td className="num">{s.loaded?nf.format(s.incorporated):'—'}</td><td className="num">{s.loaded?nf.format(s.rejected):'—'}</td><td className="num">{s.loaded?nf.format(s.pending):'—'}</td></tr>)}</tbody></table></div></details>
  </>}
 </section>;
}
