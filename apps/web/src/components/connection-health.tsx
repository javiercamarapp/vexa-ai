"use client";
import {useEffect,useRef,useState} from 'react';
import {Button,Refresh} from './ui/button';
import {SegmentedControl} from './ui/segmented';
import {StatusChip} from './ui/status-chip';
import {ProgressRing} from './ui/progress-ring';
import {EmptyState} from './ui/empty-state';
import {Icon} from './ui/icons';
import {nf} from './ui/format';
import {SkeletonRows} from './ui/skeletons';
import styles from './connections.module.css';
import type {ConnectionHealth} from '../../../../packages/connectors/health.mjs';
const labels:Record<string,string>={unknown:'Sin sincronización comprobada',running:'Sincronización en curso',healthy:'Última sincronización completada',partial:'Cobertura parcial',stale:'Sincronización pendiente de recuperar',reconnect_required:'Reconexión requerida'};
const isOk=(row:ConnectionHealth)=>['healthy','running','partial'].includes(row.state)&&row.errorCode!=='RECONNECT_REQUESTED';
const tone=(row:ConnectionHealth)=>row.state==='healthy'&&row.errorCode!=='RECONNECT_REQUESTED'?'ok':row.state==='reconnect_required'?'bad':row.state==='unknown'?'muted':'warn';
const date=(value:string|null)=>value?new Date(value).toLocaleString('es-MX'):'Sin datos';
async function read(signal?:AbortSignal):Promise<ConnectionHealth[]>{
 const response=await fetch('/api/connections',{cache:'no-store',signal});
 if(!response.ok)throw new Error(response.status===401||response.status===403?'No tienes acceso a las conexiones de esta organización.':'No se pudo consultar el estado. Intenta actualizar.');
 const data=await response.json();if(!Array.isArray(data.connections))throw new Error('Respuesta de conexiones no válida.');return data.connections;
}
export function ConnectionHealthPanel(){
 const recheckPending=useRef(false);
 const [rows,setRows]=useState<ConnectionHealth[]>([]),[busy,setBusy]=useState(true),[error,setError]=useState(''),[confirmed,setConfirmed]=useState<Record<string,string|null>>({}),[tab,setTab]=useState<'all'|'ok'|'pending'>('all'),[picked,setPicked]=useState<string|null>(null);
 useEffect(()=>{const controller=new AbortController();async function load(){try{const data=await read(controller.signal);if(!controller.signal.aborted)setRows(data);}catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'No se pudo consultar el estado.');}finally{if(!controller.signal.aborted)setBusy(false);}}void load();return()=>controller.abort();},[]);
 async function refresh(){setBusy(true);setError('');try{setRows(await read());}catch(e){setError(e instanceof Error?e.message:'No se pudo consultar el estado.');}finally{setBusy(false);}}
 async function recheck(row:ConnectionHealth){if(recheckPending.current)return;recheckPending.current=true;setBusy(true);setError('');try{const response=await fetch('/api/connections/'+row.id+'/recheck',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({confirmedCredentialRotation:Boolean(row.reconnect?.attemptId&&confirmed[row.id]===row.reconnect.attemptId),expectedAttemptId:row.reconnect?.attemptId})});if(!response.ok)throw new Error(response.status===403?'Sólo el propietario puede habilitar el nuevo intento.':'No se pudo habilitar el intento. Actualiza el estado antes de volver a intentarlo.');setRows(await read());setConfirmed(previous=>({...previous,[row.id]:null}));}catch(e){setError(e instanceof Error?e.message:'No se pudo habilitar el intento.');}finally{recheckPending.current=false;setBusy(false);}}
 const shownRows=rows.filter(r=>tab==='all'||(tab==='ok')===isOk(r)),row=shownRows.find(r=>r.id===picked)??shownRows[0]??null;
 const okCount=rows.filter(isOk).length;
 return <section className="task-card connection-health" aria-labelledby="connections-title"><div className="card-title"><div><h2 id="connections-title">Estado de las conexiones</h2><p>Cuentas autorizadas de esta organización.</p></div><Button size="sm" icon={<Refresh/>} disabled={busy} onClick={()=>void refresh()}>Actualizar conexiones</Button></div>
 {busy&&<div role="status"><span className="sr-only">Consultando conexiones…</span><SkeletonRows rows={3}/></div>}{error&&<p role="alert" className="state state-error">{error}</p>}
 {!busy&&!error&&rows.length===0&&<EmptyState art="plug" compact title="Aún no hay conexiones" body="No hay conexiones configuradas. Solicita al propietario configurar una cuenta autorizada."/>}
 {!error&&rows.length>0&&<>
  <SegmentedControl label="Filtrar conexiones" size="sm" value={tab} onChange={setTab} options={[{value:'all',label:'Todas',count:rows.length},{value:'ok',label:'Conectadas',count:okCount},{value:'pending',label:'Pendientes',count:rows.length-okCount}]}/>
  <div className={styles.master}>
   <ul className={styles.list} aria-label="Integraciones">{shownRows.map(r=><li key={r.id}><button type="button" className={styles.item} aria-pressed={row?.id===r.id} onClick={()=>setPicked(r.id)}><Icon name="plug" size={16}/><span className={styles.name}><strong>{r.source}</strong><small>{r.accountId}</small></span><StatusChip tone={tone(r)}>{isOk(r)?'Conectada':'Pendiente'}</StatusChip></button></li>)}{shownRows.length===0&&<li className={styles.none}>Sin conexiones en esta pestaña.</li>}</ul>
   {row&&<article className={styles.detail} key={row.id} aria-label={row.source+' '+row.accountId}><header className={styles.dhead}><h2>{row.source}: {row.accountId}</h2><StatusChip tone={tone(row)}>{row.errorCode==='RECONNECT_REQUESTED'?'Permisos pendientes de comprobar':labels[row.state]??'Estado pendiente de comprobar'}</StatusChip></header>
   <p className={styles.sub}>Configuración: {row.connectionStatus}</p>
   {row.coverage&&row.coverage.observed>0&&<div className={styles.ringRow}><ProgressRing size={56} stroke={6} value={row.coverage.accepted/row.coverage.observed} label={Math.round(row.coverage.accepted*100/row.coverage.observed)+'%'} title={`Aceptados: ${nf.format(row.coverage.accepted)} de ${nf.format(row.coverage.observed)} registros`}/><span>{nf.format(row.coverage.accepted)} de {nf.format(row.coverage.observed)} registros aceptados</span></div>}
   <dl className={styles.dl}>
 <dt>Último intento</dt><dd>{date(row.lastAttempt)}</dd><dt>Último éxito</dt><dd>{date(row.lastSuccess)}</dd>
 <dt>Tiempo desde el último éxito</dt><dd>{row.lagSeconds===null?'Sin datos':Math.floor(row.lagSeconds/60)+' minutos'}</dd>
 <dt>Permisos del proveedor</dt><dd>{row.permissions==='revoked'?'Revocados':row.permissions==='available'?'Comprobados en el último éxito':'Sin comprobar'}</dd>
 <dt>Cobertura observada</dt><dd>{row.coverage?`${row.coverage.observed} registros únicos; ${row.coverage.accepted} aceptados, ${row.coverage.rejected} rechazados.`:'Sin datos de cobertura'}</dd>
 <dt>Punto de continuación</dt><dd>{row.watermark?'Huella del punto de control: '+row.watermark.value:'Sin punto de control comprobado'}</dd></dl>
 <p className={styles.sub}>El tiempo mostrado mide la antigüedad del último éxito; no estima el retraso de los datos del proveedor.</p>
 {row.reconnect&&<aside className={styles.reconnect}><h3>Pasos para la reconexión</h3><ol>{row.reconnect.steps.map(step=><li key={step}>{step}</li>)}</ol>{row.reconnect.canRequest&&<><label className="check-chip"><input type="checkbox" checked={Boolean(row.reconnect?.attemptId&&confirmed[row.id]===row.reconnect.attemptId)} onChange={event=>setConfirmed(previous=>({...previous,[row.id]:event.target.checked?row.reconnect?.attemptId??null:null}))}/><span>Confirmo la rotación de credenciales de esta cuenta</span></label><Button variant="primary" size="sm" disabled={busy||!Boolean(row.reconnect?.attemptId&&confirmed[row.id]===row.reconnect.attemptId)} onClick={()=>void recheck(row)}>Permitir nuevo intento</Button></>}</aside>}
   </article>}
  </div></>}</section>;
}
