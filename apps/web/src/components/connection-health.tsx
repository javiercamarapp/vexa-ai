"use client";
import {useEffect,useState} from 'react';
import type {ConnectionHealth} from '../../../../packages/connectors/health.mjs';
const labels:Record<string,string>={unknown:'Sin sincronización comprobada',running:'Sincronización en curso',healthy:'Última sincronización completada',partial:'Cobertura parcial',stale:'Sincronización pendiente de recuperar',reconnect_required:'Reconexión requerida'};
const date=(value:string|null)=>value?new Date(value).toLocaleString('es-MX'):'Sin datos';
async function read(signal?:AbortSignal):Promise<ConnectionHealth[]>{
 const response=await fetch('/api/connections',{cache:'no-store',signal});
 if(!response.ok)throw new Error(response.status===401||response.status===403?'No tienes acceso a las conexiones de esta organización.':'No se pudo consultar el estado. Intenta actualizar.');
 const data=await response.json();if(!Array.isArray(data.connections))throw new Error('Respuesta de conexiones no válida.');return data.connections;
}
export function ConnectionHealthPanel(){
 const [rows,setRows]=useState<ConnectionHealth[]>([]),[busy,setBusy]=useState(true),[error,setError]=useState(''),[confirmed,setConfirmed]=useState<string[]>([]);
 useEffect(()=>{const controller=new AbortController();async function load(){try{const data=await read(controller.signal);if(!controller.signal.aborted)setRows(data);}catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'No se pudo consultar el estado.');}finally{if(!controller.signal.aborted)setBusy(false);}}void load();return()=>controller.abort();},[]);
 async function refresh(){setBusy(true);setError('');try{setRows(await read());}catch(e){setError(e instanceof Error?e.message:'No se pudo consultar el estado.');}finally{setBusy(false);}}
 async function recheck(row:ConnectionHealth){setBusy(true);setError('');try{const response=await fetch('/api/connections/'+row.id+'/recheck',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({confirmedCredentialRotation:confirmed.includes(row.id),expectedAttemptId:row.reconnect?.attemptId})});if(!response.ok)throw new Error(response.status===403?'Sólo el propietario puede habilitar el nuevo intento.':'No se pudo habilitar el intento. Actualiza el estado antes de volver a intentarlo.');setRows(await read());setConfirmed(previous=>previous.filter(id=>id!==row.id));}catch(e){setError(e instanceof Error?e.message:'No se pudo habilitar el intento.');}finally{setBusy(false);}}
 return <section aria-labelledby="connections-title"><h1 id="connections-title">Conexiones</h1><p>Estado de las cuentas autorizadas de esta organización.</p><button disabled={busy} onClick={()=>void refresh()}>Actualizar conexiones</button>
 {busy&&<p role="status">Consultando conexiones…</p>}{error&&<p role="alert">{error}</p>}
 {!busy&&!error&&rows.length===0&&<p>No hay conexiones configuradas. Solicita al propietario configurar una cuenta autorizada.</p>}
 {!error&&rows.map(row=><article key={row.id} aria-label={row.source+' '+row.accountId}><h2>{row.source}: {row.accountId}</h2><p>{row.errorCode==='RECONNECT_REQUESTED'?'Permisos pendientes de comprobar':labels[row.state]??'Estado pendiente de comprobar'} · Configuración: {row.connectionStatus}</p><dl>
 <dt>Último intento</dt><dd>{date(row.lastAttempt)}</dd><dt>Último éxito</dt><dd>{date(row.lastSuccess)}</dd>
 <dt>Tiempo desde el último éxito</dt><dd>{row.lagSeconds===null?'Sin datos':Math.floor(row.lagSeconds/60)+' minutos'}</dd>
 <dt>Permisos del proveedor</dt><dd>{row.permissions==='revoked'?'Revocados':row.permissions==='available'?'Comprobados en el último éxito':'Sin comprobar'}</dd>
 <dt>Cobertura observada</dt><dd>{row.coverage?`${row.coverage.observed} registros únicos; ${row.coverage.accepted} aceptados, ${row.coverage.rejected} rechazados.`:'Sin datos de cobertura'}</dd>
 <dt>Punto de continuación</dt><dd>{row.watermark?'Huella del checkpoint: '+row.watermark.value:'Sin checkpoint comprobado'}</dd></dl>
 <p>El tiempo mostrado mide la antigüedad del último éxito; no estima el retraso de los datos del proveedor.</p>
 {row.reconnect&&<aside><h3>Pasos para la reconexión</h3><ol>{row.reconnect.steps.map(step=><li key={step}>{step}</li>)}</ol>{row.reconnect.canRequest&&<><label><input type="checkbox" checked={confirmed.includes(row.id)} onChange={event=>setConfirmed(previous=>event.target.checked?[...previous,row.id]:previous.filter(id=>id!==row.id))}/>Confirmo la rotación de credenciales de esta cuenta</label><button disabled={busy||!confirmed.includes(row.id)} onClick={()=>void recheck(row)}>Permitir nuevo intento</button></>}</aside>}
 </article>)}</section>;
}
