'use client';
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
type Job={id:string;runId:string|null;conversationId:string;state:string;runStatus:string|null;reason:string|null;createdAt?:string};
type Reservation={id:string;state:string;version:number;actualMinor:string|null;heldMinor:string;reportedMinor:string};
type PageMeta={next_cursor:string|null;hasMore:boolean};
type Snapshot={pagination:{jobs:PageMeta;conversations:PageMeta};jobs:Job[];conversations:{id:string;source:string}[];canSubmit:boolean;canConfigure:boolean;configuration:{ready:boolean;enabled:boolean;window:string|null};limits:{purpose:string;limit_minor:string;version:number}[];reservations:Reservation[]};
const reasons:Record<string,string>={reconciliation_required:'La ejecución fue interrumpida. Revisa el consumo con el proveedor antes de solicitar otro análisis.',runtime_disabled:'La conexión con el proveedor de IA está desactivada.',configuration_changed:'La configuración cambió. Revisa los límites antes de crear otra solicitud.',budget_exceeded:'No hay saldo disponible en los límites de esta ventana.',ambiguous:'El contenido no permite una clasificación fiable.',invalid_output:'La respuesta del proveedor quedó en cuarentena.',policy_blocked:'La política del proveedor o su catálogo necesitan revisión.'};
function usd(minor:string){const value=BigInt(minor);return `${value/1000000n}.${String(value%1000000n).padStart(6,'0')}`;}
export function ExtractionPanel(){
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
   if(!response.ok)throw Error(body.error?.code==='configuration_required'?'Falta configurar el servicio de análisis.':'No se pudo consultar el análisis.');
   if(!signal?.aborted&&generation===refreshGeneration.current){setSnapshot(body);setError('');setEdad(null);setViejo(false);if(!query.size)guardarSwr(claveSwr('/api/extraction'),body);setSelected(current=>{if(body.conversations.some((c:{id:string})=>c.id===current))return current;requestKey.current=null;return '';});}
  }catch(e){
   if(signal?.aborted||generation!==refreshGeneration.current)return;
   setSnapshot(null);clearSelection();throw e;
  }
 },[pages,clearSelection]);
 useEffect(()=>{const controller=new AbortController();const update=()=>reload(controller.signal).catch(e=>{if(!controller.signal.aborted)setError(e.message);});void update();const timer=setInterval(update,10000);return()=>{controller.abort();clearInterval(timer);};},[reload]);
 async function action(body:Record<string,unknown>){if(busy)return;setBusy(true);setError('');try{const response=await fetch('/api/extraction',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});if(!response.ok){if(response.status===401||response.status===403){++refreshGeneration.current;setSnapshot(null);clearSelection();}const value=await response.json();throw Error(response.status===409?'La configuración cambió o la solicitud entró en conflicto. Actualiza y vuelve a revisar.':value.error?.code==='role_insufficient'?'Esta acción requiere un propietario.':'No se pudo completar la acción.');}if(body.action==='submit')requestKey.current=null;if(body.action==='reconcile'){setConfirmed(false);setEvidence('');setActual('');}await reload();}catch(e){setError(e instanceof Error?e.message:'No se pudo completar la acción.');}finally{setBusy(false);}} const jobs=snapshot?.jobs??[];
 const blocked=snapshot?submitBlock(snapshot.configuration,snapshot.canConfigure,!!selected):null;
 const nQueuedRunning=jobs.filter(j=>['queued','running'].includes(j.state)).length,nDone=jobs.filter(j=>j.state==='succeeded').length,nAttention=jobs.filter(j=>j.state==='failed').length,nClassified=jobs.filter(j=>j.runStatus==='succeeded').length;
 const pending=snapshot?.reservations.filter(r=>['reserved','uncertain'].includes(r.state))??[];
 return <section className="stack" aria-labelledby="analysis-title">
  <span id="analysis-title" className="sr-only">Análisis de conversaciones</span>
  <DatosCabecera actual="analisis" title="Análisis" description="Qué se analizó con IA y cuánto falta; los importes inciertos quedan reservados hasta contrastarlos." actions={snapshot?.canConfigure&&snapshot.configuration.window?<Button size="sm" onClick={()=>setBudgetOpen(true)}>Límites y conciliación</Button>:undefined}/>
  {snapshot&&<LineaCache edadMs={edad} viejo={viejo} actualizando={edad!==null&&!viejo}/>}
  {error&&<><p role="alert" className="notice-bar"><Icon name="alert" size={14}/>{error}</p><div><Button size="sm" disabled={busy} onClick={firstPage}>Volver a la primera página</Button></div></>}
  {!snapshot?(error?<p role="status" className="muted">No hay datos verificados para mostrar.</p>:<><p role="status" className="sr-only">Cargando estado…</p><SkeletonStats count={4}/></>):<>
  {blocked&&(!snapshot.configuration.ready||!snapshot.configuration.enabled)?<p role="status" className="notice-bar"><Icon name="info" size={14}/>{blocked}</p>:null}
  <KpiLinea label="Indicadores del análisis" items={[
   {label:'Trabajos en la página',value:nf.format(jobs.length),c:8,partes:[{label:'En cola o analizando',value:nQueuedRunning},{label:'Terminados',value:nDone},{label:'Requieren atención',value:nAttention}],nota:'Solo los de esta página'},
   {label:'En cola o analizando',value:nf.format(nQueuedRunning),c:8,partes:[{label:'En cola o analizando',value:nQueuedRunning},{label:'Otros',value:jobs.length-nQueuedRunning}],nota:'Se ejecutan en segundo plano'},
   {label:'Terminados',value:nf.format(nDone),c:8,partes:[{label:'Terminados',value:nDone},{label:'Con clasificación',value:nClassified}],nota:nf.format(nClassified)+' con clasificación'},
   {label:'Requieren atención',value:nf.format(nAttention),c:8,chip:nAttention>0?{texto:'Revisar',tono:'bad'}:{texto:'Sin fallas',tono:'ok'},partes:[{label:'Con falla',value:nAttention},{label:'Sin falla',value:jobs.length-nAttention}],nota:'Análisis fallidos o con motivo de rechazo'}]}/>
  <div className="pc-grid" data-cols={jobs.length>0&&snapshot.canSubmit?"6-6":undefined}>
  {jobs.length>0&&<section className="card" aria-label="Embudo de análisis"><div className="card-title"><div><h2>Avance de los trabajos</h2><p>Conteos de esta página</p></div></div><FunnelChart title="Trabajos solicitados, terminados y clasificados" stages={[{key:'all',label:'Solicitados',value:jobs.length,display:nf.format(jobs.length)},{key:'done',label:'Terminados',value:nDone,display:nf.format(nDone)},{key:'cls',label:'Con clasificación',value:nClassified,display:nf.format(nClassified)}]}/></section>}
  {snapshot.canSubmit&&<section className="card" id="analysis-request" aria-label="Solicitar análisis"><div className="card-title"><div><h2>Solicitar análisis</h2><p>Elige una conversación</p></div></div>
   <form className={css.form} onSubmit={event=>{event.preventDefault();requestKey.current??=crypto.randomUUID();void action({action:'submit',conversationId:selected,requestKey:requestKey.current});}}><div className={css.row}><label className={css.grow}>Conversación<select aria-label="Conversación" value={selected} onChange={event=>{setSelected(event.target.value);requestKey.current=null;}}><option value="">Selecciona una conversación</option>{snapshot.conversations.map(c=><option key={c.id} value={c.id}>{c.source} · {c.id.slice(0,8)}</option>)}</select></label><Button type="submit" size="sm" variant="primary" disabled={busy||!selected||!snapshot.configuration.ready||!snapshot.configuration.enabled}>Solicitar análisis</Button></div>{blocked&&snapshot.configuration.ready&&snapshot.configuration.enabled&&<p className={css.muted} role="note">{blocked}</p>}</form>
   <nav aria-label="Páginas de conversaciones" className={css.pager}><p>Página de conversaciones {pages.conversations.length}</p><Button size="sm" variant="ghost" disabled={busy||pages.conversations.length===1} onClick={()=>navigate('conversations',false)}>Conversaciones anteriores</Button><Button size="sm" variant="ghost" disabled={busy||!snapshot.pagination.conversations.hasMore} onClick={()=>navigate('conversations',true)}>Conversaciones siguientes</Button></nav></section>}
  </div>
  <div className="card-title"><div><h2>Trabajos</h2></div><nav aria-label="Páginas de trabajos" className={css.pager}><p>Página de trabajos {pages.jobs.length}</p><Button size="sm" variant="ghost" disabled={busy||pages.jobs.length===1} onClick={()=>navigate('jobs',false)}>Trabajos anteriores</Button><Button size="sm" variant="ghost" disabled={busy||!snapshot.pagination.jobs.hasMore} onClick={()=>navigate('jobs',true)}>Trabajos siguientes</Button></nav></div>
  {jobs.length===0?<EmptyState art="search" compact title="Aún no hay análisis solicitados" body="Elige una conversación para lanzar el primero." action={snapshot.canSubmit?<LinkButton href="#analysis-request" size="sm" variant="primary" icon={<Arrow/>}>Elegir una conversación</LinkButton>:undefined}/>:<>
  <HallazgosAnalisis jobs={jobs} fuentes={Object.fromEntries(snapshot.conversations.map(c=>[c.id,c.source]))} masPaginas={snapshot.pagination.jobs.hasMore||pages.jobs.length>1}/>
  {jobs.filter(job=>job.reason).slice(0,2).map(job=><p key={job.id} role="note" className="notice-bar" data-tone="calm"><Icon name="info" size={14}/>{reasons[job.reason as string]??'Revisa la configuración y el registro de la ejecución.'}</p>)}
  {jobs.some(job=>['queued','running'].includes(job.state))&&<div className={css.jobFoot}>{jobs.filter(job=>['queued','running'].includes(job.state)).map(job=><Button key={job.id} size="sm" variant="ghost" disabled={busy} onClick={()=>void action({action:'cancel',jobId:job.id})}>Cancelar análisis {job.conversationId.slice(0,8)}</Button>)}</div>}</>}
  {snapshot.canConfigure&&snapshot.configuration.window&&<Drawer open={budgetOpen} onClose={()=>setBudgetOpen(false)} title="Límites y conciliación" subtitle={'Ventana: '+snapshot.configuration.window+' · importes en USD'}>
   <div className="stack">
    <div className="cols" style={{display:'grid',gap:'var(--sp-3)',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))'}}>{snapshot.limits.map(item=><StatCard key={item.purpose} label={item.purpose==='all'?'Límite global':'Límite de extracción'} icon="dollar" kind="observed" value={'$'+usd(item.limit_minor)}/>)}</div>
    <form className={css.form} onSubmit={event=>{event.preventDefault();const current=snapshot.limits.find(item=>item.purpose===purpose);void action({action:'budget',purpose,limitUsd:limit,...(current?{expectedVersion:current.version}:{})});}}>
     <p className={css.muted}>Deben existir un límite global y otro de extracción.</p>
     <label>Tipo de límite<select aria-label="Tipo de límite" value={purpose} onChange={e=>setPurpose(e.target.value)}><option value="extraction">Extracción</option><option value="all">Global</option></select></label>
     <label>Límite en USD<input required inputMode="decimal" pattern="[0-9]+([.][0-9]{1,6})?" value={limit} onChange={e=>setLimit(e.target.value)}/></label>
     <div><Button type="submit" size="sm" variant="primary" disabled={busy}>Guardar límite</Button></div>
    </form>
    <h3>Reservas pendientes de conciliación</h3>
    {pending.length===0?<p className="state">No hay reservas pendientes.</p>:<div className="table-wrap" tabIndex={0} role="region" aria-label="Reservas pendientes, desplazamiento horizontal"><table className="dtable"><thead><tr><th>Reserva</th><th className="num">Reservado</th><th className="num">Reportado</th><th className="num">Costo final</th></tr></thead><tbody>{pending.map(r=><tr key={r.id}><th scope="row"><IdChip value={r.id} head={6} tail={4}/></th><td className="num">${usd(r.heldMinor)} <KindBadge kind="observed"/></td><td className="num">${usd(r.reportedMinor)}</td><td className="num">{r.actualMinor===null?'desconocido':'$'+usd(r.actualMinor)}</td></tr>)}</tbody></table></div>}
    <form className={css.form} onSubmit={event=>{event.preventDefault();const row=snapshot.reservations.find(r=>r.id===reservation);if(row)void action({action:'reconcile',reservationId:row.id,expectedVersion:row.version,actualUsd:actual,evidenceHash:evidence,confirmedProviderEvidence:confirmed});}}>
     <label>Reserva<select aria-label="Reserva" required value={reservation} onChange={e=>{setReservation(e.target.value);setConfirmed(false);}}><option value="">Selecciona una reserva</option>{pending.map(r=><option key={r.id} value={r.id}>{r.id.slice(0,8)}</option>)}</select></label>
     <label>Costo confirmado en USD<input required inputMode="decimal" pattern="[0-9]+([.][0-9]{1,6})?" value={actual} onChange={e=>setActual(e.target.value)}/></label>
     <label>Huella SHA-256 del recibo del proveedor<input required pattern="[a-f0-9]{64}" value={evidence} onChange={e=>setEvidence(e.target.value)}/></label>
     <label className="check"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>Contrasté este costo con evidencia del proveedor.</label>
     <div><Button type="submit" size="sm" variant="primary" disabled={busy||!confirmed||!reservation}>Conciliar costo</Button></div>
    </form>
   </div>
  </Drawer>}
  </>}
 </section>;
}
