'use client';
import Link from 'next/link';
import {ConfirmationDialog} from '../confirmation-dialog';
import {useCallback,useEffect,useRef,useState} from 'react';
import type {DeliveryPolicy} from '../../../../../packages/notifications/policies.mjs';
const names={inapp:'Centro de notificaciones',email:'Correo electrónico',push:'Web Push'};
function parse(value:unknown):DeliveryPolicy[]{
 if(!Array.isArray(value)||value.length!==3||new Set(value.map(p=>p?.channel)).size!==3||value.some(p=>!p||!Object.hasOwn(names,p.channel)||typeof p.enabled!=='boolean'||!['version','intervalMs','digestWindowMs','maxAttempts','lifetimeMs'].every(k=>Number.isSafeInteger(p[k]))||p.version<0||p.intervalMs<1000||p.intervalMs>86400000||p.digestWindowMs<0||p.digestWindowMs>3600000||p.maxAttempts<1||p.maxAttempts>10||p.lifetimeMs<1000||p.lifetimeMs>2592000000))throw Error('No se pudo verificar la política recibida.');
 return value;
}
export function DeliveryPolicies(){
 const [rows,setRows]=useState<DeliveryPolicy[]>([]),[busy,setBusy]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const active=useRef<AbortController|null>(null),heading=useRef<HTMLHeadingElement>(null),pending=useRef(false);
 const request=useCallback(async(signal:AbortSignal,body?:unknown)=>{
  const response=await fetch('/api/notifications/delivery',{method:body===undefined?'GET':'POST',cache:'no-store',signal:AbortSignal.any([signal,AbortSignal.timeout(15000)]),headers:body===undefined?undefined:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  if(!response.ok)throw Error(response.status===409?'La política cambió. Actualiza antes de guardar.':response.status===403?'Sólo una persona propietaria puede configurar los envíos.':'No se pudo verificar el estado guardado. Actualiza antes de reintentar.');
  const payload=await response.json();if(!payload?.data)throw Error('No se pudo verificar la respuesta. Actualiza antes de volver a intentar.');return payload.data;
 },[]);
 const load=useCallback(async()=>{
  active.current?.abort();const controller=new AbortController();active.current=controller;setBusy(true);setError('');setNotice('');setRows([]);
  try{const next=parse(await request(controller.signal));if(!controller.signal.aborted)setRows(next);}
  catch{if(!controller.signal.aborted)setError('No se pudo consultar la política. Actualiza para volver a comprobarla.');}
  finally{if(!controller.signal.aborted){pending.current=false;setBusy(false);}}
 },[request]);
 useEffect(()=>{let mounted=true;void Promise.resolve().then(()=>{if(mounted)void load();});return()=>{mounted=false;active.current?.abort();};},[load]);
 const save=async(row:DeliveryPolicy)=>{
  if(busy||pending.current)return;pending.current=true;active.current?.abort();const controller=new AbortController();active.current=controller;setBusy(true);setError('');setNotice('');
  try{
   const {version,...input}=row;const saved=await request(controller.signal,{...input,expectedVersion:version});const next=parse(await request(controller.signal));
   if(controller.signal.aborted)return;
   const actual=next.find(p=>p.channel===row.channel);if(!actual||actual.version!==saved.version||Object.entries(input).some(([k,v])=>actual[k as keyof DeliveryPolicy]!==v))throw Error('La política cambió durante el guardado. Actualiza para verificarla.');
   setRows(next);setNotice('Política guardada y verificada. Las preferencias de cada usuario siguen siendo necesarias.');
  }catch{if(!controller.signal.aborted){setRows([]);setError('No se confirmó el guardado. Actualiza para comprobar si se guardó antes de volver a intentarlo.');}}
  finally{if(!controller.signal.aborted){pending.current=false;setBusy(false);}}
 };
 const change=(channel:string,delta:Partial<DeliveryPolicy>)=>setRows(previous=>previous.map(row=>row.channel===channel?{...row,...delta}:row));
 return <section className="task-page task-grid delivery-page" aria-label="Política de envío" aria-busy={busy}><p className="eyebrow">Configuración de la organización</p><h1 ref={heading} tabIndex={-1}>Política de envío</h1>
  <p>Autoriza canales y define límites para los avisos futuros. Cada persona debe activar sus preferencias; Web Push también requiere permiso del navegador. Habilitar una política no confirma que el proveedor esté conectado.</p>
  <p><Link href="/settings/notifications">Mis preferencias</Link></p><button disabled={busy} onClick={()=>void load()}>Actualizar políticas</button>
  {busy&&<p role="status">Verificando políticas…</p>}{error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
  {rows.map(row=><form id={'delivery-policy-'+row.channel} key={row.channel} className="record-card" onSubmit={event=>event.preventDefault()}><fieldset disabled={busy}><legend>{names[row.channel]}</legend>
   <label style={{display:'flex',alignItems:'center',gap:'.75rem',minHeight:44}}><input style={{width:'1.15rem',height:'1.15rem',padding:0,flexShrink:0}} type="checkbox" checked={row.enabled} onChange={event=>change(row.channel,{enabled:event.target.checked})}/> Autorizar este canal</label>
   <label>Intervalo mínimo entre envíos (segundos)<input type="number" required min="1" max="86400" step="1" value={row.intervalMs/1000} onChange={event=>change(row.channel,{intervalMs:Number(event.target.value)*1000})}/></label>
   <label>Agrupar avisos durante (segundos; 0 para no agrupar)<input type="number" required min="0" max="3600" step="1" value={row.digestWindowMs/1000} onChange={event=>change(row.channel,{digestWindowMs:Number(event.target.value)*1000})}/></label>
   <label>Máximo de intentos<input type="number" required min="1" max="10" step="1" value={row.maxAttempts} onChange={event=>change(row.channel,{maxAttempts:Number(event.target.value)})}/></label>
   <label>Vigencia del aviso (segundos)<input type="number" required min="1" max="2592000" step="1" value={row.lifetimeMs/1000} onChange={event=>change(row.channel,{lifetimeMs:Number(event.target.value)*1000})}/></label>
   <div className="confirmation-actions"><ConfirmationDialog returnFocusRef={heading} triggerLabel={'Guardar '+names[row.channel]} title={'¿Guardar la política de '+names[row.channel]+'?'} description={row.enabled?'Este canal quedará autorizado para los avisos futuros, sujeto a las preferencias y permisos de cada persona.':'Este canal quedará desactivado para los avisos futuros.'} confirmLabel="Confirmar guardado" disabled={busy} onConfirm={()=>{const form=document.getElementById('delivery-policy-'+row.channel) as HTMLFormElement|null;if(form?.reportValidity())return save(row);}}/></div>
  </fieldset></form>)}
 </section>;
}
