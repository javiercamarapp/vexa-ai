'use client';
import {RovaqCargando} from './rovaq-cargando';
import {ConfirmationDialog} from './confirmation-dialog';
import {HistoryItems,historyStates,historyReasons} from './history-items';
import {useCallback,useEffect,useLayoutEffect,useRef,useState} from 'react';
import {leerSwr,claveSwr,guardarSwr} from '../lib/workspace/swr.mjs';
import {LineaCache} from './ui/linea-cache';
const useAntesDePintar=typeof window==='undefined'?useEffect:useLayoutEffect;
import {DatosCabecera} from './datos/datos-cabecera';
import {KpiLinea} from './panel-comun/kpi-linea';
import './panel-comun/panel-comun.css';
import {Button} from './ui/button';
import {Drawer} from './ui/overlay';
import {StatusChip} from './ui/status-chip';
import {DonutChart} from './ui/donut-chart';
import {Heatmap,type HeatCell} from './ui/heatmap';
import {Timeline,type TimelineEvent} from './ui/timeline';
import {Icon} from './ui/icons';
import {SkeletonStats,SkeletonRows} from './ui/skeletons';
import {nf} from './ui/format';
import styles from './history.module.css';
import {estadoProcesamiento,tituloLote} from '../lib/history/historico.mjs';
import {nombreFuente} from '../lib/connections/estado.mjs';
type Batch={id:string;createdAt?:string;connectionId:string;state:string;reason:string|null;version:number;enumerated:boolean;counts:Record<string,number>;countsCapped?:boolean};
type Snapshot={batches:Batch[];connections:Array<{id:string;source:string;account_id:string}>;configuration:{ready:boolean;enabled:boolean}};
const GROUP:Record<string,string>={completed:'var(--ink-up)',pending:'var(--ch-4)',extracting:'var(--ch-4)',grouping:'var(--ch-4)',failed:'var(--ink-down)',skipped:'var(--ch-neutral)'};
const DAY=86400000,WEEKDAYS=['L','M','X','J','V','S','D'];
const day=(iso:string)=>{const d=new Date(iso);return Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate());};
const tone=(state:string)=>state==='completed'?'ok':state==='paused'||state==='cancelled'?'warn':state==='active'?'info':'neutral';
/** Calendar heat: batches created per day (UTC), weeks as columns, Monday first. Exact counts only; needs real dates. */
function batchCalendar(batches:Batch[]){
 const dated=batches.filter(b=>b.createdAt&&!Number.isNaN(Date.parse(b.createdAt)));
 if(dated.length<3)return null;
 const per=new Map<number,number>();for(const b of dated)per.set(day(b.createdAt!),(per.get(day(b.createdAt!))??0)+1);
 const last=Math.max(...per.keys()),lastMonday=last-((new Date(last).getUTCDay()+6)%7)*DAY,weeks=Math.min(12,Math.floor((lastMonday-Math.min(...per.keys())+ (((new Date(Math.min(...per.keys())).getUTCDay()+6)%7)*DAY))/(7*DAY))+1);
 const firstMonday=lastMonday-(weeks-1)*7*DAY;
 const columns=Array.from({length:weeks},(_,w)=>new Intl.DateTimeFormat('es-MX',{day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(firstMonday+w*7*DAY)));
 const cells:HeatCell[][]=WEEKDAYS.map((_,r)=>Array.from({length:weeks},(_,w)=>{const t=firstMonday+w*7*DAY+r*DAY;if(t>last)return {value:null,display:'—'};const n=per.get(t)??0;return {value:n,display:String(n)};}));
 return {columns,rows:WEEKDAYS,cells};
}
export function HistoryPanel({destacado}:{destacado?:React.ReactNode}={}){const [snapshot,setSnapshot]=useState<Snapshot|null>(null),[connection,setConnection]=useState(''),[confirmed,setConfirmed]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[selectedBatch,setSelectedBatch]=useState<string|null>(null),[openStart,setOpenStart]=useState(false),[edad,setEdad]=useState<number|null>(null),[viejo,setViejo]=useState(false);const snapRef=useRef<Snapshot|null>(null);useEffect(()=>{snapRef.current=snapshot;},[snapshot]);
 // Antes de pintar: la última lectura del histórico (rotulada); el sondeo de 5 s la reemplaza por la real.
 useAntesDePintar(()=>{const g=leerSwr(claveSwr('/api/history')),v=g?.datos as Snapshot|undefined;if(g&&v&&Array.isArray(v.batches)&&v.configuration){setSnapshot(v);setEdad(g.edadMs);}},[]);const heading=useRef<HTMLHeadingElement>(null);const epoch=useRef(0),requestKey=useRef<string|null>(null),pending=useRef(false);
 const load=useCallback(async(signal?:AbortSignal)=>{const generation=++epoch.current;let failure='No se pudo consultar el histórico. Se reintentará solo.',st=0;setLoading(true);try{const r=await fetch('/api/history',{cache:'no-store',signal});if(!r.ok){st=r.status;failure=r.status===403?'Esta operación requiere el rol propietario.':'No se pudo consultar el histórico.';throw Error('HISTORY_LOAD_FAILED');}const value=await r.json();if(generation===epoch.current&&!signal?.aborted){setSnapshot(value);setError('');setEdad(null);setViejo(false);guardarSwr(claveSwr('/api/history'),value);}}catch{if(!signal?.aborted&&generation===epoch.current){if(snapRef.current&&(st===0||st>=500)){setViejo(true);return;}setSnapshot(null);setSelectedBatch(null);setConfirmed(false);setError(failure);}}finally{if(!signal?.aborted&&generation===epoch.current)setLoading(false);}},[]);
 const invalidate=useCallback(()=>{epoch.current++;},[]);
 // auto-refresh: sondeo propio cada 5 s mientras la vista está abierta (avance de los lotes); no depende del vigilante global.
 useEffect(()=>{const controller=new AbortController();void Promise.resolve().then(()=>load(controller.signal));const timer=setInterval(()=>{if(!pending.current)void load(controller.signal);},5000);return()=>{controller.abort();clearInterval(timer);invalidate();};},[load,invalidate]);
 async function action(body:Record<string,unknown>){if(pending.current)return;pending.current=true;setBusy(true);setError('');let failure='No se pudo modificar el lote. Actualiza su estado antes de volver a intentar.';try{const r=await fetch('/api/history',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});if(!r.ok){failure=r.status===409?'El lote cambió. Revisa su estado antes de continuar.':r.status===403?'La autorización ya no está vigente.':'No se pudo modificar el lote.';throw Error('HISTORY_ACTION_FAILED');}requestKey.current=null;setConfirmed(false);setOpenStart(false);await load();}catch{await load();setConfirmed(false);setError(failure);}finally{pending.current=false;setBusy(false);}}
 const ready=Boolean(snapshot?.configuration.ready&&snapshot.configuration.enabled);
 const totals:Record<string,number>={};let capped=false;
 for(const b of snapshot?.batches??[]){if(b.countsCapped)capped=true;for(const [state,n] of Object.entries(b.counts))totals[state]=(totals[state]??0)+Number(n);}
 const at=capped?'al menos ':'',inFlight=(totals.pending??0)+(totals.extracting??0)+(totals.grouping??0);
 const donut=Object.entries(totals).filter(([,n])=>n>0).map(([state,n],i)=>({key:state,label:historyStates[state]??state,value:n,display:at+nf.format(n),tone:(state==='completed'?1:state==='failed'?5:state==='skipped'?'neutral':(['pending','extracting','grouping'].includes(state)?2:3+i%2)) as 1|2|3|4|5|'neutral'}));
 const calendar=snapshot?batchCalendar(snapshot.batches):null,estado=estadoProcesamiento({lotes:snapshot?.batches.length??0,lista:ready});
 const connectionLabel=(id:string)=>{const c=snapshot?.connections.find(x=>x.id===id);return c?nombreFuente(c.source)+' · '+c.account_id:'Conexión';};
 const events:TimelineEvent[]=(snapshot?.batches??[]).map(b=>({key:b.id,icon:b.state==='completed'?'check':b.state==='paused'?'pause':'clock',
  title:<span className={styles.batchHead}><span>{tituloLote(b.createdAt)}</span><StatusChip tone={tone(b.state)}>{historyStates[b.state]??b.state}</StatusChip></span>,
  meta:<>{connectionLabel(b.connectionId)} · {b.enumerated?'Selección completa':'Selección en curso'}</>,
  body:<div className={styles.batch}>{b.reason&&<p className="state">{historyReasons[b.reason]??'Requiere revisión.'}</p>}
   {Object.keys(b.counts).length>0&&<><div className={styles.stateBar} role="img" aria-label={'Avance del lote: '+Object.entries(b.counts).map(([state,n])=>(historyStates[state]??state)+' '+(b.countsCapped?'al menos ':'')+n).join(', ')}>{Object.entries(b.counts).filter(([,n])=>Number(n)>0).map(([state,n])=><i key={state} style={{flexGrow:Number(n),background:GROUP[state]??'var(--ch-neutral)'}}/>)}</div>
   <ul className={styles.legend}>{Object.entries(b.counts).map(([state,n])=><li key={state}><span className={styles.dot} style={{background:GROUP[state]??'var(--ch-neutral)'}}/><span className="chip">{historyStates[state]??state}: {b.countsCapped?'al menos ':''}{n}</span></li>)}</ul></>}
   {b.countsCapped&&<p className={styles.note}>Lote grande: los conteos son un mínimo (se cuentan hasta 1,000 conversaciones por lote para mantener la vista rápida).</p>}{b.state==='cancelled'&&<p className={styles.note}>Los trabajos pendientes quedan sin autorización para continuar.</p>}
   <div className="btn-group"><Button size="sm" aria-label={'Ver conversaciones del '+tituloLote(b.createdAt).toLowerCase()+' (ref. '+b.id.slice(0,6)+')'} onClick={()=>setSelectedBatch(selectedBatch===b.id?null:b.id)}>{selectedBatch===b.id?'Ocultar conversaciones':'Ver conversaciones'}</Button>{['active','paused'].includes(b.state)&&<Button size="sm" variant="ghost" aria-label={'Cancelar el '+tituloLote(b.createdAt).toLowerCase()+' (ref. '+b.id.slice(0,6)+')'} disabled={busy} onClick={()=>void action({operation:'cancel',batchId:b.id,expectedVersion:b.version})}>Cancelar lote</Button>}{b.state==='paused'&&<ConfirmationDialog returnFocusRef={heading} triggerLabel={'Reautorizar el '+tituloLote(b.createdAt).toLowerCase()+' (ref. '+b.id.slice(0,6)+')'} title="¿Reautorizar este lote?" description={'El '+tituloLote(b.createdAt).toLowerCase()+' continuará con su configuración original y los límites autorizados. Esta acción renueva su autorización.'} confirmLabel="Reautorizar lote" disabled={busy} onConfirm={()=>action({operation:'resume',batchId:b.id,expectedVersion:b.version,confirmed:true})}/>}</div>
   <details className={styles.tech}><summary>Ver detalle técnico</summary><p>Identificador del lote: <code>{b.id}</code></p></details>
   {selectedBatch===b.id&&<HistoryItems key={b.id} batchId={b.id}/>}</div>}));
 if(loading&&!snapshot&&!error)return <RovaqCargando mensaje=""/>;
 return <section className="task-page history-page stack" aria-label="Histórico de conversaciones" aria-busy={loading||busy}><DatosCabecera actual="historico" title="Histórico e identidad" description="Conversaciones anteriores que autorizas analizar por conexión; avanza en segundo plano y no publica cortes." actions={<>{snapshot&&estado.puedeAutorizar&&<Button variant="primary" icon={<Icon name="play" size={14}/>} onClick={()=>setOpenStart(true)}>Autorizar procesamiento</Button>}</>}/><h2 ref={heading} tabIndex={-1} className="sr-only">Acciones del histórico</h2>{destacado}{loading&&!snapshot&&<div role="status" aria-label="Cargando histórico"><SkeletonStats count={4}/><SkeletonRows rows={3}/></div>}{error&&<p className="state state-error" role="alert">{error}</p>}{snapshot&&<LineaCache edadMs={edad} actualizando={loading} viejo={viejo}/>}{snapshot&&<>
  <div className="notice-bar" role="status" data-tone={estado.tone==='ok'?'info':estado.tone}><Icon name={estado.tone==='warn'?'info':'check'} size={14}/><span><strong>{estado.titulo}</strong> {estado.texto}</span></div>
  {snapshot.batches.length===0?<section className="task-card history-batches" aria-label="Lotes históricos"><p className="state" role="status">Aún no hay lotes de procesamiento. {estado.puedeAutorizar?'Usa «Autorizar procesamiento» para analizar el histórico de una conexión.':'Aparecerán aquí cuando se active el análisis del histórico.'}</p></section>:<>
  <KpiLinea label="Indicadores del histórico" items={[
   {label:'Lotes',value:nf.format(snapshot.batches.length),c:5,partes:[{label:'En curso',value:snapshot.batches.filter(b=>b.state==='active').length},{label:'Otros',value:snapshot.batches.filter(b=>b.state!=='active').length}],nota:nf.format(snapshot.batches.filter(b=>b.state==='active').length)+' en curso'},
   {label:'Conversaciones completadas',value:(totals.completed?at:'')+nf.format(totals.completed??0),c:3,partes:[{label:'Completadas',value:totals.completed??0},{label:'En análisis',value:inFlight},{label:'Requieren atención',value:totals.failed??0}],nota:capped?'Mínimo por lote grande':'Observado'},
   {label:'Pendientes y en análisis',value:(inFlight?at:'')+nf.format(inFlight),c:4,partes:[{label:'En análisis',value:inFlight},{label:'Completadas',value:totals.completed??0}],nota:'Observado'},
   {label:'Requieren atención',value:(totals.failed?at:'')+nf.format(totals.failed??0),c:2,chip:(totals.failed??0)>0?{texto:'Revisar',tono:'bad'}:{texto:'Sin fallas',tono:'ok'},partes:[{label:'Con falla',value:totals.failed??0},{label:'Omitidas',value:totals.skipped??0}],nota:totals.skipped?nf.format(totals.skipped)+' omitidas':'Observado'}]}/>
  <div className={styles.twocol}>
   <section className="task-card history-batches" aria-label="Lotes históricos"><div className="card-title"><div><h2>Lotes históricos</h2><p>Del más reciente al más antiguo</p></div></div>
    <Timeline events={events}/>
   </section>
   <div className="stack">
    {donut.length>0&&<section className="card" aria-label="Conversaciones por estado"><div className="card-title"><div><h2>Estado de las conversaciones</h2><p>{capped?'Mínimos: lotes grandes':'Conteos exactos'}</p></div></div><DonutChart title="Conversaciones por estado" centerValue={at+nf.format(Object.values(totals).reduce((a,n)=>a+n,0))} centerLabel="en total" segments={donut}/></section>}
    {calendar&&<section className="card" aria-label="Calendario de lotes"><div className="card-title"><div><h2>Lotes por día</h2><p>Fecha de creación (UTC)</p></div></div><Heatmap title="Lotes creados por día" columns={calendar.columns} rows={calendar.rows} cells={calendar.cells} unit="lotes"/></section>}
   </div>
  </div></>}
  <Drawer open={openStart} onClose={()=>setOpenStart(false)} title="Autorizar procesamiento" subtitle="Elige la conexión y confirma los límites configurados." footer={<Button type="submit" form="history-start" variant="primary" disabled={busy||!confirmed||!connection||!snapshot.configuration.ready||!snapshot.configuration.enabled}>Autorizar lote histórico</Button>}>
   <form id="history-start" className="form-grid history-start" onSubmit={e=>{e.preventDefault();if(!confirmed)return;requestKey.current??=crypto.randomUUID();void action({operation:'start',connectionId:connection,requestKey:requestKey.current,confirmed:true});}}>
    <label className="field field-wide">Conexión del histórico<select aria-label="Conexión del histórico" required disabled={busy} value={connection} onChange={e=>{setConnection(e.target.value);setConfirmed(false);requestKey.current=null;}}><option value="">Selecciona una conexión</option>{snapshot.connections.map(c=><option key={c.id} value={c.id}>{nombreFuente(c.source)} · {c.account_id}</option>)}</select></label>
    <label className="check-chip field-wide"><input type="checkbox" disabled={busy||!connection} checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/><span>Autorizo el análisis y la agrupación de este histórico con los límites configurados.</span></label>
   </form>
  </Drawer>
 </>}</section>;
}
