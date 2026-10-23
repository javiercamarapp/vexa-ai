"use client";
import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {pedirSwr,leerSwr,claveSwr,invalidarSwr} from '../lib/workspace/swr.mjs';
import {LineaCache} from './ui/linea-cache';
import {useVistaPersistente} from './workspace/vista-persistente';
const useAntesDePintar=typeof window==='undefined'?useEffect:useLayoutEffect;
const validaConexiones=(j:unknown)=>Array.isArray((j as {connections?:unknown})?.connections)?j:null;
import {Button,Refresh} from './ui/button';
import {SegmentedControl} from './ui/segmented';
import {StatusChip} from './ui/status-chip';
import {ProgressRing} from './ui/progress-ring';
import {EmptyState} from './ui/empty-state';
import {Icon} from './ui/icons';
import {SkeletonRows} from './ui/skeletons';
import styles from './connections.module.css';
import {useJson} from './ui/use-json';
import {estadoConexion,nombreFuente,type EstadoConexion} from '../lib/connections/estado.mjs';
import type {CoverageView} from '../../../../packages/workspace-service/provenance.mjs';
import type {ConnectionHealth} from '../../../../packages/connectors/health.mjs';
const sourceName=nombreFuente;
const CONFIG_STATUS:Record<string,string>={active:'Activa',paused:'Pausada',disabled:'Deshabilitada',reconnect_required:'Requiere reconexión'};
const lag=(seconds:number)=>seconds<3600?Math.max(1,Math.floor(seconds/60))+' min':seconds<86400?Math.floor(seconds/3600)+' h':Math.floor(seconds/86400)+' d';
const date=(value:string|null,empty='Sin datos')=>value?new Date(value).toLocaleString('es-MX'):empty;
async function read(signal?:AbortSignal):Promise<ConnectionHealth[]>{
 const response=await pedirSwr('/api/connections',{signal,valida:validaConexiones});
 if(response.status<200||response.status>=300)throw Object.assign(new Error(response.status===401||response.status===403?'No tienes acceso a las conexiones de esta organización.':'No se pudo consultar el estado. Intenta actualizar.'),{estado:response.status});
 const data=response.json as {connections?:ConnectionHealth[]};if(!Array.isArray(data?.connections))throw new Error('Respuesta de conexiones no válida.');return data.connections;
}
export function ConnectionHealthPanel(){
 const recheckPending=useRef(false),rowsRef=useRef<ConnectionHealth[]>([]);
 const {data:coverage,busy:coverageBusy}=useJson<CoverageView>('/api/coverage',j=>{const d=(j as {data?:CoverageView})?.data;return Array.isArray(d?.sources)?d as CoverageView:null;});
 const sources=coverage?.sources??null,est=(r:ConnectionHealth):EstadoConexion=>estadoConexion(r,sources);
 const [rows,setRows]=useState<ConnectionHealth[]>([]),[busy,setBusy]=useState(true),[error,setError]=useState(''),[confirmed,setConfirmed]=useState<Record<string,string|null>>({}),[tab,setTab]=useVistaPersistente<'all'|'ok'|'pending'>('conexiones:pestana','all'),[picked,setPicked]=useVistaPersistente<string|null>('conexiones:elegida',null),[edad,setEdad]=useState<number|null>(null),[viejo,setViejo]=useState(false);
 useAntesDePintar(()=>{const g=leerSwr(claveSwr('/api/connections')),v=(g?.datos as {connections?:ConnectionHealth[]}|undefined)?.connections;if(g&&Array.isArray(v)){setRows(v);setEdad(g.edadMs);if(g.fresca)setBusy(false);}},[]);
 useEffect(()=>{const controller=new AbortController();async function load(){try{const g=leerSwr(claveSwr('/api/connections'));if(g?.fresca){setBusy(false);return;}const data=await read(controller.signal);if(!controller.signal.aborted){setRows(data);setEdad(null);setViejo(false);}}catch(e){if(!controller.signal.aborted){const st=(e as {estado?:number}).estado;if(rowsRef.current.length>0&&(st===undefined||st>=500))setViejo(true);else setError(e instanceof Error?e.message:'No se pudo consultar el estado.');}}finally{if(!controller.signal.aborted)setBusy(false);}}void load();return()=>controller.abort();},[]);
useEffect(()=>{rowsRef.current=rows;},[rows]);
 async function refresh(){setBusy(true);setError('');setViejo(false);invalidarSwr({prefijo:'/api/connections'});try{setRows(await read());setEdad(null);}catch(e){const st=(e as {estado?:number}).estado;if(rows.length>0&&(st===undefined||st>=500))setViejo(true);else setError(e instanceof Error?e.message:'No se pudo consultar el estado.');}finally{setBusy(false);}}
 async function recheck(row:ConnectionHealth){if(recheckPending.current)return;recheckPending.current=true;setBusy(true);setError('');try{const response=await fetch('/api/connections/'+row.id+'/recheck',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({confirmedCredentialRotation:Boolean(row.reconnect?.attemptId&&confirmed[row.id]===row.reconnect.attemptId),expectedAttemptId:row.reconnect?.attemptId})});if(!response.ok)throw new Error(response.status===403?'Sólo el propietario puede habilitar el nuevo intento.':'No se pudo habilitar el intento. Actualiza el estado antes de volver a intentarlo.');invalidarSwr({prefijo:'/api/connections'});setRows(await read());setEdad(null);setConfirmed(previous=>({...previous,[row.id]:null}));}catch(e){setError(e instanceof Error?e.message:'No se pudo habilitar el intento.');}finally{recheckPending.current=false;setBusy(false);}}
 const shownRows=rows.filter(r=>tab==='all'||(tab==='ok')===est(r).ok),row=shownRows.find(r=>r.id===picked)??shownRows[0]??null;
 const okCount=rows.filter(r=>est(r).ok).length,e=row?est(row):null;
 return <section className="task-card connection-health" aria-labelledby="connections-title"><div className="card-title"><div><h2 id="connections-title">Estado de las conexiones</h2><p>Cuentas autorizadas de esta organización.</p></div><Button size="sm" icon={<Refresh/>} disabled={busy} onClick={()=>void refresh()}>Actualizar conexiones</Button></div>
 {((busy&&rows.length===0)||(coverageBusy&&!coverage))&&<div role="status"><span className="sr-only">Consultando conexiones…</span><SkeletonRows rows={3}/></div>}{error&&<p role="alert" className="state state-error">{error}</p>}
 {!busy&&!error&&rows.length===0&&<EmptyState art="plug" compact title="Aún no hay conexiones" body="No hay conexiones configuradas. Solicita al propietario configurar una cuenta autorizada."/>}
 {rows.length>0&&<LineaCache edadMs={edad} actualizando={busy} viejo={viejo} onActualizar={()=>void refresh()}/>}
 {!error&&rows.length>0&&!(coverageBusy&&!coverage)&&<>
  <SegmentedControl label="Filtrar conexiones" size="sm" value={tab} onChange={setTab} options={[{value:'all',label:'Todas',count:rows.length},{value:'ok',label:'Conectadas',count:okCount},{value:'pending',label:'Pendientes',count:rows.length-okCount}]}/>
  <div className={styles.master}>
   <ul className={styles.list} aria-label="Integraciones">{shownRows.map(r=><li key={r.id}><button type="button" className={styles.item} aria-pressed={row?.id===r.id} onClick={()=>setPicked(r.id)}><Icon name="plug" size={16}/><span className={styles.name}><strong>{sourceName(r.source)}</strong><small>{r.accountId}</small></span><StatusChip tone={est(r).tone}>{est(r).chip}</StatusChip></button></li>)}{shownRows.length===0&&<li className={styles.none}>Sin conexiones en esta pestaña.</li>}</ul>
   {row&&e&&<article className={styles.detail} key={row.id} aria-label={sourceName(row.source)+' '+row.accountId}><header className={styles.dhead}><h2>{sourceName(row.source)}: {row.accountId}</h2><StatusChip tone={e.tone}>{e.estado}</StatusChip></header>
   <p className={styles.sub}>Configuración: {CONFIG_STATUS[row.connectionStatus]??row.connectionStatus}</p>
   {e.anillo&&<div className={styles.ringRow}><ProgressRing size={56} stroke={6} value={e.anillo.valor} label={e.anillo.pct+'%'} title={e.lineas[0]}/><span>{e.lineas[0]}</span></div>}
   {e.lineas.slice(e.anillo?1:0).length>0&&<ul className={styles.facts}>{e.lineas.slice(e.anillo?1:0).map(l=><li key={l}>{l}</li>)}</ul>}
   <dl className={styles.dl}>
 <dt>Último intento</dt><dd>{date(row.lastAttempt,'Sin intentos registrados')}</dd><dt>{e.ultimo.rotulo}</dt><dd>{date(e.ultimo.valor,e.ultimo.vacio)}</dd>
 {row.lagSeconds!==null&&row.lastSuccess&&<><dt>Tiempo desde el último éxito</dt><dd>{lag(row.lagSeconds)}</dd></>}
 <dt>Permisos del proveedor</dt><dd>{row.permissions==='revoked'?'Revocados':row.permissions==='available'?'Comprobados en el último éxito':'Sin comprobar'}</dd></dl>
 {row.watermark&&<details className={styles.tech}><summary>Detalle técnico</summary><p>Huella del punto de control: <code>{row.watermark.value}</code></p></details>}
 {row.lagSeconds!==null&&row.lastSuccess&&<p className={styles.sub}>El tiempo mostrado mide la antigüedad del último éxito; no estima el retraso de los datos del proveedor.</p>}
 {row.reconnect&&<aside className={styles.reconnect}><h3>Pasos para la reconexión</h3><ol>{row.reconnect.steps.map(step=><li key={step}>{step}</li>)}</ol>{row.reconnect.canRequest&&<><label className="check-chip"><input type="checkbox" checked={Boolean(row.reconnect?.attemptId&&confirmed[row.id]===row.reconnect.attemptId)} onChange={event=>setConfirmed(previous=>({...previous,[row.id]:event.target.checked?row.reconnect?.attemptId??null:null}))}/><span>Confirmo la rotación de credenciales de esta cuenta</span></label><Button variant="primary" size="sm" disabled={busy||!Boolean(row.reconnect?.attemptId&&confirmed[row.id]===row.reconnect.attemptId)} onClick={()=>void recheck(row)}>Permitir nuevo intento</Button></>}</aside>}
   </article>}
  </div></>}</section>;
}
