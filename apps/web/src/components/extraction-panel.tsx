'use client';
import {PageHeader} from './ui/page-header';
import {Button,LinkButton,Arrow} from './ui/button';
import {StatCard} from './ui/stat-card';
import {StatusChip} from './ui/status-chip';
import {FunnelChart} from './ui/funnel-chart';
import {Stepper} from './ui/stepper';
import {Drawer} from './ui/overlay';
import {IdChip} from './ui/id-chip';
import {KindBadge} from './ui/kind-badge';
import {EmptyState} from './ui/empty-state';
import {Icon} from './ui/icons';
import {SkeletonStats} from './ui/skeletons';
import {nf} from './ui/format';
import css from './ops-panels.module.css';
import {useCallback,useEffect,useRef,useState} from 'react';
type Job={id:string;runId:string|null;conversationId:string;state:string;runStatus:string|null;reason:string|null};
type Reservation={id:string;state:string;version:number;actualMinor:string|null;heldMinor:string;reportedMinor:string};
type PageMeta={next_cursor:string|null;hasMore:boolean};
type Snapshot={pagination:{jobs:PageMeta;conversations:PageMeta};jobs:Job[];conversations:{id:string;source:string}[];canSubmit:boolean;canConfigure:boolean;configuration:{ready:boolean;enabled:boolean;window:string|null};limits:{purpose:string;limit_minor:string;version:number}[];reservations:Reservation[]};
const stateLabels:Record<string,string>={queued:'En cola',running:'Analizando',succeeded:'Terminado',failed:'Requiere atención',cancelled:'Cancelado'};
const reasons:Record<string,string>={reconciliation_required:'La ejecución fue interrumpida. Revisa el consumo con el proveedor antes de solicitar otro análisis.',runtime_disabled:'La conexión con el proveedor de IA está desactivada.',configuration_changed:'La configuración cambió. Revisa los límites antes de crear otra solicitud.',budget_exceeded:'No hay saldo disponible en los límites de esta ventana.',ambiguous:'El contenido no permite una clasificación fiable.',invalid_output:'La respuesta del proveedor quedó en cuarentena.',policy_blocked:'La política del proveedor o su catálogo necesitan revisión.'};
function usd(minor:string){const value=BigInt(minor);return `${value/1000000n}.${String(value%1000000n).padStart(6,'0')}`;}
export function ExtractionPanel(){
 const [snapshot,setSnapshot]=useState<Snapshot|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[selected,setSelected]=useState(''),[limit,setLimit]=useState(''),[purpose,setPurpose]=useState('extraction'),[reservation,setReservation]=useState(''),[actual,setActual]=useState(''),[evidence,setEvidence]=useState(''),[confirmed,setConfirmed]=useState(false),[budgetOpen,setBudgetOpen]=useState(false);
 const requestKey=useRef<string|null>(null),refreshGeneration=useRef(0);
 const [pages,setPages]=useState<{conversations:(string|null)[];jobs:(string|null)[]}>({conversations:[null],jobs:[null]});
 const clearSelection=useCallback(()=>{setSelected('');requestKey.current=null;setReservation('');setActual('');setEvidence('');setConfirmed(false);},[]);
 function firstPage(){++refreshGeneration.current;setSnapshot(null);clearSelection();setError('');setPages({conversations:[null],jobs:[null]});}
 function navigate(kind:'conversations'|'jobs',next:boolean){if(busy||!snapshot)return;const cursor=snapshot.pagination[kind].next_cursor;if(next&&!cursor)return;++refreshGeneration.current;setSnapshot(null);clearSelection();setError('');setPages(current=>({...current,[kind]:next?[...current[kind],cursor]:current[kind].slice(0,-1)}));}
 const reload=useCallback(async(signal?:AbortSignal)=>{
  const generation=++refreshGeneration.current;
  try{
   const query=new URLSearchParams();const conversationCursor=pages.conversations.at(-1),jobCursor=pages.jobs.at(-1);if(conversationCursor)query.set('conversation_cursor',conversationCursor);if(jobCursor)query.set('job_cursor',jobCursor);
   const response=await fetch('/api/extraction'+(query.size?'?'+query:''),{cache:'no-store',signal}),body=await response.json();
   if(!response.ok)throw Error(body.error?.code==='configuration_required'?'Falta configurar el servicio de análisis.':'No se pudo consultar el análisis.');
   if(!signal?.aborted&&generation===refreshGeneration.current){setSnapshot(body);setError('');setSelected(current=>{if(body.conversations.some((c:{id:string})=>c.id===current))return current;requestKey.current=null;return '';});}
  }catch(e){
   if(signal?.aborted||generation!==refreshGeneration.current)return;
   setSnapshot(null);clearSelection();throw e;
  }
 },[pages,clearSelection]);
 useEffect(()=>{const controller=new AbortController();const update=()=>reload(controller.signal).catch(e=>{if(!controller.signal.aborted)setError(e.message);});void update();const timer=setInterval(update,10000);return()=>{controller.abort();clearInterval(timer);};},[reload]);
 async function action(body:Record<string,unknown>){if(busy)return;setBusy(true);setError('');try{const response=await fetch('/api/extraction',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});if(!response.ok){if(response.status===401||response.status===403){++refreshGeneration.current;setSnapshot(null);clearSelection();}const value=await response.json();throw Error(response.status===409?'La configuración cambió o la solicitud entró en conflicto. Actualiza y vuelve a revisar.':value.error?.code==='role_insufficient'?'Esta acción requiere un propietario.':'No se pudo completar la acción.');}if(body.action==='submit')requestKey.current=null;if(body.action==='reconcile'){setConfirmed(false);setEvidence('');setActual('');}await reload();}catch(e){setError(e instanceof Error?e.message:'No se pudo completar la acción.');}finally{setBusy(false);}} const jobs=snapshot?.jobs??[];
 const nQueuedRunning=jobs.filter(j=>['queued','running'].includes(j.state)).length,nDone=jobs.filter(j=>j.state==='succeeded').length,nAttention=jobs.filter(j=>j.state==='failed').length,nClassified=jobs.filter(j=>j.runStatus==='succeeded').length;
 const tone=(state:string):'ok'|'warn'|'info'|'muted'=>state==='succeeded'?'ok':state==='failed'?'warn':state==='cancelled'?'muted':'info';
 const stepsFor=(state:string)=>[{key:'queued',label:'En cola'},{key:'running',label:'Analizando'},{key:'succeeded',label:'Terminado'}].map((st,i)=>{const at=state==='queued'?0:state==='running'?1:2;return {...st,state:(state==='succeeded'?'done':i<at?'done':i===at?'current':'todo') as 'done'|'current'|'todo'};});
 const pending=snapshot?.reservations.filter(r=>['reserved','uncertain'].includes(r.state))??[];
 return <section className="stack" aria-labelledby="analysis-title">
  <span id="analysis-title" className="sr-only">Análisis de conversaciones</span>
  <PageHeader title="Análisis de conversaciones" description="Se ejecutan en segundo plano; los importes inciertos quedan reservados hasta contrastarlos con el proveedor." actions={snapshot?.canConfigure&&snapshot.configuration.window?<Button size="sm" onClick={()=>setBudgetOpen(true)}>Límites y conciliación</Button>:undefined}/>
  {error&&<><p role="alert" className="notice-bar"><Icon name="alert" size={14}/>{error}</p><div><Button size="sm" disabled={busy} onClick={firstPage}>Volver a la primera página</Button></div></>}
  {!snapshot?(error?<p role="status" className="muted">No hay datos verificados para mostrar.</p>:<><p role="status" className="sr-only">Cargando estado…</p><SkeletonStats count={4}/></>):<>
  {!snapshot.configuration.ready&&<p role="status" className="notice-bar"><Icon name="info" size={14}/>La configuración de IA necesita revisión o actualización antes de solicitar nuevos análisis.</p>}{snapshot.configuration.ready&&!snapshot.configuration.enabled&&<p role="status" className="notice-bar"><Icon name="info" size={14}/>El proveedor de IA está desactivado. Actívalo sólo después de autorizar la política y el consumo.</p>}
  <div className="stat-grid">
   <StatCard label="Trabajos en la página" icon="layers" kind="observed" value={nf.format(jobs.length)}/>
   <StatCard label="En cola o analizando" icon="clock" kind="observed" value={nf.format(nQueuedRunning)}/>
   <StatCard label="Terminados" icon="check" kind="observed" value={nf.format(nDone)}/>
   <StatCard label="Requieren atención" icon="alert" kind="observed" value={nf.format(nAttention)}/>
  </div>
  {jobs.length>0&&<section className="card" aria-label="Embudo de análisis"><div className="card-title"><div><h2>Avance de los trabajos</h2><p>Conteos de esta página</p></div></div><FunnelChart title="Trabajos solicitados, terminados y clasificados" stages={[{key:'all',label:'Solicitados',value:jobs.length,display:nf.format(jobs.length)},{key:'done',label:'Terminados',value:nDone,display:nf.format(nDone)},{key:'cls',label:'Con clasificación',value:nClassified,display:nf.format(nClassified)}]}/></section>}
  {snapshot.canSubmit&&<section className="card" id="analysis-request" aria-label="Solicitar análisis"><div className="card-title"><div><h2>Solicitar análisis</h2><p>Elige una conversación</p></div></div>
   <form className={css.form} onSubmit={event=>{event.preventDefault();requestKey.current??=crypto.randomUUID();void action({action:'submit',conversationId:selected,requestKey:requestKey.current});}}><div className={css.row}><label className={css.grow}>Conversación<select aria-label="Conversación" value={selected} onChange={event=>{setSelected(event.target.value);requestKey.current=null;}}><option value="">Selecciona una conversación</option>{snapshot.conversations.map(c=><option key={c.id} value={c.id}>{c.source} · {c.id.slice(0,8)}</option>)}</select></label><Button type="submit" size="sm" variant="primary" disabled={busy||!selected||!snapshot.configuration.ready||!snapshot.configuration.enabled}>Solicitar análisis</Button></div></form>
   <nav aria-label="Páginas de conversaciones" className={css.pager}><p>Página de conversaciones {pages.conversations.length}</p><Button size="sm" variant="ghost" disabled={busy||pages.conversations.length===1} onClick={()=>navigate('conversations',false)}>Conversaciones anteriores</Button><Button size="sm" variant="ghost" disabled={busy||!snapshot.pagination.conversations.hasMore} onClick={()=>navigate('conversations',true)}>Conversaciones siguientes</Button></nav></section>}
  <div className="card-title"><div><h2>Trabajos</h2></div><nav aria-label="Páginas de trabajos" className={css.pager}><p>Página de trabajos {pages.jobs.length}</p><Button size="sm" variant="ghost" disabled={busy||pages.jobs.length===1} onClick={()=>navigate('jobs',false)}>Trabajos anteriores</Button><Button size="sm" variant="ghost" disabled={busy||!snapshot.pagination.jobs.hasMore} onClick={()=>navigate('jobs',true)}>Trabajos siguientes</Button></nav></div>
  {jobs.length===0?<EmptyState art="search" compact title="Aún no hay análisis solicitados" body="Elige una conversación para lanzar el primero." action={snapshot.canSubmit?<LinkButton href="#analysis-request" size="sm" variant="primary" icon={<Arrow/>}>Elegir una conversación</LinkButton>:undefined}/>:
  <ul className={css.jobList} style={{listStyle:'none',margin:0,padding:0}}>{jobs.map(job=><li key={job.id} className={'card '+css.job}>
   <div className={css.jobHead}><StatusChip tone={tone(job.state)}>{stateLabels[job.state]??job.state}</StatusChip><IdChip value={job.conversationId} label="Conversación" head={8} tail={4}/></div>
   {['queued','running','succeeded'].includes(job.state)&&<Stepper label="Avance del análisis" steps={stepsFor(job.state)}/>}
   {job.runStatus==='abstained'&&<span className="chip">Sin clasificación concluyente</span>}
   {job.reason&&<p className={css.muted}>{reasons[job.reason]??'Revisa la configuración y el registro de la ejecución.'}</p>}
   <div className={css.jobFoot}>{job.runId&&['succeeded','abstained'].includes(job.runStatus??'')&&<LinkButton href={'/analysis/'+job.runId} size="sm" icon={<Arrow/>}>Ver evidencia</LinkButton>}{['queued','running'].includes(job.state)&&<Button size="sm" variant="ghost" disabled={busy} onClick={()=>void action({action:'cancel',jobId:job.id})}>Cancelar análisis</Button>}</div>
  </li>)}</ul>}
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
