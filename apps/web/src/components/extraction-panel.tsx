'use client';
import {RovaqCargando} from './rovaq-cargando';
import {useAutoRefresh} from './ui/use-auto-refresh';
import {DatosCabecera} from './datos/datos-cabecera';
import {KpiLinea} from './panel-comun/kpi-linea';
import './panel-comun/panel-comun.css';
import {Button,LinkButton,Arrow} from './ui/button';
import {StatCard} from './ui/stat-card';
import {FunnelChart} from './ui/funnel-chart';
import {Drawer} from './ui/overlay';
import {IdChip} from './ui/id-chip';
import {KindBadge} from './ui/kind-badge';
import {EmptyState} from './ui/empty-state';
import {Icon} from './ui/icons';
import {SkeletonStats} from './ui/skeletons';
import {nf} from './ui/format';
import css from './ops-panels.module.css';
import {useCallback,useEffect,useLayoutEffect,useRef,useState} from 'react';
import {leerSwr,claveSwr,guardarSwr} from '../lib/workspace/swr.mjs';
import {LineaCache} from './ui/linea-cache';
const useAntesDePintar=typeof window==='undefined'?useEffect:useLayoutEffect;
import {submitBlock} from '../lib/analysis-jobs';
import {HallazgosAnalisis} from './datos/analisis-hallazgos';
import {useIdioma,useT} from './i18n/proveedor';
import type {Clave} from '../lib/i18n';
type Job={id:string;runId:string|null;conversationId:string;state:string;runStatus:string|null;reason:string|null;createdAt?:string};
type Reservation={id:string;state:string;version:number;actualMinor:string|null;heldMinor:string;reportedMinor:string};
type PageMeta={next_cursor:string|null;hasMore:boolean};
type Snapshot={pagination:{jobs:PageMeta;conversations:PageMeta};jobs:Job[];conversations:{id:string;source:string}[];canSubmit:boolean;canConfigure:boolean;configuration:{ready:boolean;enabled:boolean;window:string|null};limits:{purpose:string;limit_minor:string;version:number}[];reservations:Reservation[]};
const reasons:Record<string,Clave>={reconciliation_required:'tr.ext.rReconc',runtime_disabled:'tr.ext.rRuntime',configuration_changed:'tr.ext.rConfig',budget_exceeded:'tr.ext.rBudget',ambiguous:'tr.ext.rAmbiguo',invalid_output:'tr.ext.rInvalid',policy_blocked:'tr.ext.rPolicy'};
function usd(minor:string){const value=BigInt(minor);return `${value/1000000n}.${String(value%1000000n).padStart(6,'0')}`;}
export function ExtractionPanel(){
 const t=useT(),idioma=useIdioma();
 const [snapshot,setSnapshot]=useState<Snapshot|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[selected,setSelected]=useState(''),[limit,setLimit]=useState(''),[purpose,setPurpose]=useState('extraction'),[reservation,setReservation]=useState(''),[actual,setActual]=useState(''),[evidence,setEvidence]=useState(''),[confirmed,setConfirmed]=useState(false),[budgetOpen,setBudgetOpen]=useState(false);
 const requestKey=useRef<string|null>(null),refreshGeneration=useRef(0),[edad,setEdad]=useState<number|null>(null),[viejo,setViejo]=useState(false),snapRef=useRef<Snapshot|null>(null);
 useEffect(()=>{snapRef.current=snapshot;},[snapshot]);
 // Antes de pintar: la última lectura de la primera página (rotulada) mientras llega la real; el sondeo de 10 s la reemplaza.
 useAntesDePintar(()=>{const g=leerSwr(claveSwr('/api/extraction')),v=g?.datos as Snapshot|undefined;if(g&&v&&Array.isArray(v.jobs)&&Array.isArray(v.conversations)&&v.pagination){setSnapshot(v);setEdad(g.edadMs);}},[]);
 const [pages,setPages]=useState<{conversations:(string|null)[];jobs:(string|null)[]}>({conversations:[null],jobs:[null]});
 const clearSelection=useCallback(()=>{setSelected('');requestKey.current=null;setReservation('');setActual('');setEvidence('');setConfirmed(false);},[]);
 function firstPage(){++refreshGeneration.current;setSnapshot(null);clearSelection();setError('');setPages({conversations:[null],jobs:[null]});}
 function navigate(kind:'conversations'|'jobs',next:boolean){if(busy||!snapshot)return;const cursor=snapshot.pagination[kind].next_cursor;if(next&&!cursor)return;++refreshGeneration.current;setSnapshot(null);clearSelection();setError('');setPages(current=>({...current,[kind]:next?[...current[kind],cursor]:current[kind].slice(0,-1)}));}
 const reload=useCallback(async(signal?:AbortSignal)=>{
  const generation=++refreshGeneration.current;
  try{
   const query=new URLSearchParams();const conversationCursor=pages.conversations.at(-1),jobCursor=pages.jobs.at(-1);if(conversationCursor)query.set('conversation_cursor',conversationCursor);if(jobCursor)query.set('job_cursor',jobCursor);
   const response=await fetch('/api/extraction'+(query.size?'?'+query:''),{cache:'no-store',signal}).catch(e=>{if(!signal?.aborted&&snapRef.current&&generation===refreshGeneration.current){setViejo(true);return null;}throw e;});if(!response)return;const body=await response.json();
   if(!response.ok&&response.status>=500&&snapRef.current&&!signal?.aborted&&generation===refreshGeneration.current){setViejo(true);return;}
   if(!response.ok)throw Error(body.error?.code==='configuration_required'?t('tr.ext.faltaConfig'):t('tr.ext.noConsulta'));
   if(!signal?.aborted&&generation===refreshGeneration.current){setSnapshot(body);setError('');setEdad(null);setViejo(false);if(!query.size)guardarSwr(claveSwr('/api/extraction'),body);setSelected(current=>{if(body.conversations.some((c:{id:string})=>c.id===current))return current;requestKey.current=null;return '';});}
  }catch(e){
   if(signal?.aborted||generation!==refreshGeneration.current)return;
   setSnapshot(null);clearSelection();throw e;
  }
 },[pages,clearSelection,t]);
 useEffect(()=>{const controller=new AbortController();const update=()=>reload(controller.signal).catch(e=>{if(!controller.signal.aborted)setError(e.message);});void update();const timer=setInterval(update,10000);return()=>{controller.abort();clearInterval(timer);};},[reload]);
 async function action(body:Record<string,unknown>){if(busy)return;setBusy(true);setError('');try{const response=await fetch('/api/extraction',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});if(!response.ok){if(response.status===401||response.status===403){++refreshGeneration.current;setSnapshot(null);clearSelection();}const value=await response.json();throw Error(response.status===409?t('tr.ext.conflicto'):value.error?.code==='role_insufficient'?t('tr.ext.requierePropietario'):t('tr.ext.noAccion'));}if(body.action==='submit')requestKey.current=null;if(body.action==='reconcile'){setConfirmed(false);setEvidence('');setActual('');}await reload();}catch(e){setError(e instanceof Error?e.message:t('tr.ext.noAccion'));}finally{setBusy(false);}} const jobs=snapshot?.jobs??[];
 const blocked=snapshot?submitBlock(snapshot.configuration,snapshot.canConfigure,!!selected,idioma):null;
 const nQueuedRunning=jobs.filter(j=>['queued','running'].includes(j.state)).length,nDone=jobs.filter(j=>j.state==='succeeded').length,nAttention=jobs.filter(j=>j.state==='failed').length,nClassified=jobs.filter(j=>j.runStatus==='succeeded').length;
 const pending=snapshot?.reservations.filter(r=>['reserved','uncertain'].includes(r.state))??[];
 // Datos nuevos: relectura en segundo plano (reload conserva el análisis pintado si falla el servicio); no corre durante una acción.
 const busyRef=useRef(true);useLayoutEffect(()=>{busyRef.current=busy;});
 useAutoRefresh(()=>reload(),{ocupado:()=>busyRef.current});
 if(!snapshot&&!error)return <RovaqCargando mensaje=""/>;
 return <section className="stack" aria-labelledby="analysis-title">
  <span id="analysis-title" className="sr-only">{t('tr.ext.analisisConv')}</span>
  <DatosCabecera actual="analisis" title={t('tr.ext.analisis')} description={t('tr.ext.descCab')} actions={snapshot?.canConfigure&&snapshot.configuration.window?<Button size="sm" onClick={()=>setBudgetOpen(true)}>{t('tr.ext.limitesConc')}</Button>:undefined}/>
  {snapshot&&<LineaCache edadMs={edad} viejo={viejo} actualizando={edad!==null&&!viejo}/>}
  {error&&<><p role="alert" className="notice-bar"><Icon name="alert" size={14}/>{error}</p><div><Button size="sm" disabled={busy} onClick={firstPage}>{t('tr.ext.primeraPag')}</Button></div></>}
  {!snapshot?(error?<p role="status" className="muted">{t('tr.ext.sinDatos')}</p>:<><p role="status" className="sr-only">{t('tr.ext.cargandoEstado')}</p><SkeletonStats count={4}/></>):<>
  {blocked&&(!snapshot.configuration.ready||!snapshot.configuration.enabled)?<p role="status" className="notice-bar"><Icon name="info" size={14}/>{blocked}</p>:null}
  <KpiLinea label={t('tr.ext.indicadores')} items={[
   {label:t('tr.ext.trabajosPag'),value:nf.format(jobs.length),c:7,partes:[{label:t('tr.ext.colaOAnal'),value:nQueuedRunning},{label:t('tr.ext.terminados'),value:nDone},{label:t('tr.ext.requierenAt'),value:nAttention}],nota:t('tr.ext.soloPagina')},
   {label:t('tr.ext.colaOAnal'),value:nf.format(nQueuedRunning),c:4,partes:[{label:t('tr.ext.colaOAnal'),value:nQueuedRunning},{label:t('tr.ext.otros'),value:jobs.length-nQueuedRunning}],nota:t('tr.ext.segundoPlano')},
   {label:t('tr.ext.terminados'),value:nf.format(nDone),c:3,partes:[{label:t('tr.ext.terminados'),value:nDone},{label:t('tr.ext.conClasif'),value:nClassified}],nota:t('tr.ext.nConClasif',{n:nf.format(nClassified)})},
   {label:t('tr.ext.requierenAt'),value:nf.format(nAttention),c:2,chip:nAttention>0?{texto:t('tr.ext.revisar'),tono:'bad'}:{texto:t('tr.ext.sinFallas'),tono:'ok'},partes:[{label:t('tr.ext.conFalla'),value:nAttention},{label:t('tr.ext.sinFalla'),value:jobs.length-nAttention}],nota:t('tr.ext.fallidos')}]}/>
  <div className="pc-grid" data-cols={jobs.length>0&&snapshot.canSubmit?"6-6":undefined}>
  {jobs.length>0&&<section className="card an-embudo" aria-label={t('tr.ext.embudoAria')}><div className="card-title"><div><h2>{t('tr.ext.avanceTrabajos')}</h2><p>{t('tr.ext.conteosPag')}</p></div></div><FunnelChart title={t('tr.ext.embudoTitulo')} stages={[{key:'all',label:t('tr.ext.solicitados'),value:jobs.length,display:nf.format(jobs.length)},{key:'done',label:t('tr.ext.terminados'),value:nDone,display:nf.format(nDone)},{key:'cls',label:t('tr.ext.conClasif'),value:nClassified,display:nf.format(nClassified)}]}/></section>}
  {snapshot.canSubmit&&<section className="card" id="analysis-request" aria-label={t('tr.ext.solicitarAnalisis')}><div className="card-title"><div><h2>{t('tr.ext.solicitarAnalisis')}</h2><p>{t('tr.ext.eligeConv')}</p></div></div>
   <form className={css.form} onSubmit={event=>{event.preventDefault();requestKey.current??=crypto.randomUUID();void action({action:'submit',conversationId:selected,requestKey:requestKey.current});}}><div className={css.row}><label className={css.grow}>{t('tr.ext.conversacion')}<select aria-label={t('tr.ext.conversacion')} value={selected} onChange={event=>{setSelected(event.target.value);requestKey.current=null;}}><option value="">{t('tr.ext.seleccionaConv')}</option>{snapshot.conversations.map(c=><option key={c.id} value={c.id}>{c.source} · {c.id.slice(0,8)}</option>)}</select></label><Button type="submit" size="sm" variant="primary" disabled={busy||!selected||!snapshot.configuration.ready||!snapshot.configuration.enabled}>{t('tr.ext.solicitarAnalisis')}</Button></div>{blocked&&snapshot.configuration.ready&&snapshot.configuration.enabled&&<p className={css.muted} role="note">{blocked}</p>}</form>
   {(pages.conversations.length>1||snapshot.pagination.conversations.hasMore)&&<nav aria-label={t('tr.ext.pagConvAria')} className={css.pager}><p>{t('tr.ext.pagConv',{n:pages.conversations.length})}</p><Button size="sm" variant="ghost" disabled={busy||pages.conversations.length===1} onClick={()=>navigate('conversations',false)}>{t('tr.ext.convAnt')}</Button><Button size="sm" variant="ghost" disabled={busy||!snapshot.pagination.conversations.hasMore} onClick={()=>navigate('conversations',true)}>{t('tr.ext.convSig')}</Button></nav>}</section>}
  </div>
  {(pages.jobs.length>1||snapshot.pagination.jobs.hasMore)&&<div className="card-title an-pager"><div><h2>{t('tr.ext.trabajos')}</h2></div><nav aria-label={t('tr.ext.pagTrabAria')} className={css.pager}><p>{t('tr.ext.pagTrab',{n:pages.jobs.length})}</p><Button size="sm" variant="ghost" disabled={busy||pages.jobs.length===1} onClick={()=>navigate('jobs',false)}>{t('tr.ext.trabAnt')}</Button><Button size="sm" variant="ghost" disabled={busy||!snapshot.pagination.jobs.hasMore} onClick={()=>navigate('jobs',true)}>{t('tr.ext.trabSig')}</Button></nav></div>}
  {jobs.length===0?<EmptyState art="search" compact title={t('tr.ext.aunNo')} body={t('tr.ext.eligePrimero')} action={snapshot.canSubmit?<LinkButton href="#analysis-request" size="sm" variant="primary" icon={<Arrow/>}>{t('tr.ext.elegirConv')}</LinkButton>:undefined}/>:<>
  <HallazgosAnalisis jobs={jobs} fuentes={Object.fromEntries(snapshot.conversations.map(c=>[c.id,c.source]))} masPaginas={snapshot.pagination.jobs.hasMore||pages.jobs.length>1}/>
  {jobs.filter(job=>job.reason).slice(0,2).map(job=><p key={job.id} role="note" className="notice-bar" data-tone="calm"><Icon name="info" size={14}/>{t(reasons[job.reason as string]??'tr.ext.rDefault')}</p>)}
  {jobs.some(job=>['queued','running'].includes(job.state))&&<div className={css.jobFoot+" an-cancel"}><span>{t('tr.ext.enCurso')}</span>{jobs.filter(job=>['queued','running'].includes(job.state)).map(job=><Button key={job.id} size="sm" variant="ghost" disabled={busy} onClick={()=>void action({action:'cancel',jobId:job.id})}>{t('tr.ext.cancelarAn',{id:job.conversationId.slice(0,8)})}</Button>)}</div>}</>}
  {snapshot.canConfigure&&snapshot.configuration.window&&<Drawer open={budgetOpen} onClose={()=>setBudgetOpen(false)} title={t('tr.ext.limitesConc')} subtitle={t('tr.ext.ventana',{v:snapshot.configuration.window})}>
   <div className="stack">
    <div className="cols" style={{display:'grid',gap:'var(--sp-3)',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))'}}>{snapshot.limits.map(item=><StatCard key={item.purpose} label={item.purpose==='all'?t('tr.ext.limGlobal'):t('tr.ext.limExtraccion')} icon="dollar" kind="observed" value={'$'+usd(item.limit_minor)}/>)}</div>
    <form className={css.form} onSubmit={event=>{event.preventDefault();const current=snapshot.limits.find(item=>item.purpose===purpose);void action({action:'budget',purpose,limitUsd:limit,...(current?{expectedVersion:current.version}:{})});}}>
     <p className={css.muted}>{t('tr.ext.debenExistir')}</p>
     <label>{t('tr.ext.tipoLimite')}<select aria-label={t('tr.ext.tipoLimite')} value={purpose} onChange={e=>setPurpose(e.target.value)}><option value="extraction">{t('tr.ext.extraccion')}</option><option value="all">{t('tr.ext.global')}</option></select></label>
     <label>{t('tr.ext.limiteUsd')}<input required inputMode="decimal" pattern="[0-9]+([.][0-9]{1,6})?" value={limit} onChange={e=>setLimit(e.target.value)}/></label>
     <div><Button type="submit" size="sm" variant="primary" disabled={busy}>{t('tr.ext.guardarLimite')}</Button></div>
    </form>
    <h3>{t('tr.ext.reservasPend')}</h3>
    {pending.length===0?<p className="state">{t('tr.ext.sinReservas')}</p>:<div className="table-wrap" tabIndex={0} role="region" aria-label={t('tr.ext.reservasAria')}><table className="dtable"><thead><tr><th>{t('tr.ext.reserva')}</th><th className="num">{t('tr.ext.reservado')}</th><th className="num">{t('tr.ext.reportado')}</th><th className="num">{t('tr.ext.costoFinal')}</th></tr></thead><tbody>{pending.map(r=><tr key={r.id}><th scope="row"><IdChip value={r.id} head={6} tail={4}/></th><td className="num">${usd(r.heldMinor)} <KindBadge kind="observed"/></td><td className="num">${usd(r.reportedMinor)}</td><td className="num">{r.actualMinor===null?t('tr.ext.desconocidoMin'):'$'+usd(r.actualMinor)}</td></tr>)}</tbody></table></div>}
    <form className={css.form} onSubmit={event=>{event.preventDefault();const row=snapshot.reservations.find(r=>r.id===reservation);if(row)void action({action:'reconcile',reservationId:row.id,expectedVersion:row.version,actualUsd:actual,evidenceHash:evidence,confirmedProviderEvidence:confirmed});}}>
     <label>{t('tr.ext.reserva')}<select aria-label={t('tr.ext.reserva')} required value={reservation} onChange={e=>{setReservation(e.target.value);setConfirmed(false);}}><option value="">{t('tr.ext.seleccionaReserva')}</option>{pending.map(r=><option key={r.id} value={r.id}>{r.id.slice(0,8)}</option>)}</select></label>
     <label>{t('tr.ext.costoConfirmado')}<input required inputMode="decimal" pattern="[0-9]+([.][0-9]{1,6})?" value={actual} onChange={e=>setActual(e.target.value)}/></label>
     <label>{t('tr.ext.huella')}<input required pattern="[a-f0-9]{64}" value={evidence} onChange={e=>setEvidence(e.target.value)}/></label>
     <label className="check"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>{t('tr.ext.contraste')}</label>
     <div><Button type="submit" size="sm" variant="primary" disabled={busy||!confirmed||!reservation}>{t('tr.ext.conciliar')}</Button></div>
    </form>
   </div>
  </Drawer>}
  </>}
 </section>;
}
