'use client';
import Link from 'next/link';
import {useCallback,useEffect,useRef,useState} from 'react';
import type {InboxView,NotificationItem,PreferencesView,Preference} from '../../../../../packages/notifications/index.mjs';

type Status='all'|'unread';
const api='/api/notifications';
const checkboxStyle={width:'1.15rem',height:'1.15rem',padding:0,flexShrink:0};
const labelStyle={display:'flex',alignItems:'center',gap:'.75rem',minHeight:'44px'};
const errorText=(status:number)=>status===401||status===403?'Tu acceso cambió. Vuelve a iniciar sesión o selecciona una organización autorizada.':status===404?'Este aviso o su recurso ya no está disponible con tus permisos.':status===409?'La versión cambió. Actualiza para comprobar el estado guardado antes de volver a intentarlo.':status===400?'La solicitud no es válida. Actualiza y revisa la selección.':'No se pudo verificar la operación. Actualiza para comprobar el estado guardado.';
const safeHref=(value:unknown):value is string=>typeof value==='string'&&value.startsWith('/')&&!value.startsWith('//')&&!/[\\\u0000-\u0020]/.test(value);
const validItem=(item:NotificationItem)=>Boolean(item&&typeof item.id==='string'&&typeof item.title==='string'&&typeof item.body==='string'&&typeof item.createdAt==='string'&&(item.readAt===null||typeof item.readAt==='string')&&safeHref(item.href));
function inboxValue(data:InboxView,status:Status):InboxView{
 if(!data||!Array.isArray(data.items)||data.items.some(item=>!validItem(item))||data.status!==status||(data.nextCursor!==null&&typeof data.nextCursor!=='string'))throw Error('No se pudo verificar la bandeja recibida.');
 return data;
}
function preferenceValue(data:PreferencesView):PreferencesView{
 if(!data||!Array.isArray(data.catalog)||!Array.isArray(data.channels)||!Array.isArray(data.preferences)||data.preferences.some(p=>typeof p.enabled!=='boolean'||!Number.isInteger(p.version)||p.version<0))throw Error('No se pudieron verificar las preferencias recibidas.');
 return data;
}

export function NotificationPanel({settings=false}:{settings?:boolean}){
 const [inbox,setInbox]=useState<InboxView|null>(null),[preferences,setPreferences]=useState<PreferencesView|null>(null);
 const [status,setStatus]=useState<Status>('all'),[busy,setBusy]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const epoch=useRef(0),controller=useRef<AbortController|null>(null),pending=useRef(false),currentStatus=useRef<Status>('all');
 const invalidate=useCallback(()=>{epoch.current++;controller.current?.abort();pending.current=false;},[]);
 const clear=useCallback(()=>{setInbox(null);setPreferences(null);},[]);
 const begin=useCallback(()=>{controller.current?.abort();const abort=new AbortController();controller.current=abort;const generation=++epoch.current;pending.current=true;setBusy(true);setError('');setNotice('');return {abort,generation};},[]);
 const current=useCallback((operation:{abort:AbortController;generation:number})=>!operation.abort.signal.aborted&&operation.generation===epoch.current,[]);
 const request=useCallback(async(suffix:string,signal:AbortSignal,body?:unknown)=>{
  const response=await fetch(api+suffix,{method:body===undefined?'GET':'POST',cache:'no-store',signal,headers:body===undefined?undefined:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  if(!response.ok)throw Error(errorText(response.status));
  const value=await response.json();if(value?.contract_version!=='f06-notifications-v1'||!value.data)throw Error('No se pudo verificar la respuesta del servidor.');
  return value.data;
 },[]);
 const load=useCallback(async(nextStatus:Status=currentStatus.current)=>{
  const op=begin();clear();
  try{
   const data=await request(settings?'/preferences':'?status='+nextStatus,op.abort.signal);
   if(!current(op))return;
   if(settings)setPreferences(preferenceValue(data));else setInbox(inboxValue(data,nextStatus));
  }catch(cause){if(current(op)){clear();setError(cause instanceof Error?cause.message:errorText(503));}}
  finally{if(current(op)){pending.current=false;setBusy(false);}}
 },[begin,clear,current,request,settings]);
 useEffect(()=>{let active=true;void Promise.resolve().then(()=>{if(active)void load();});return()=>{active=false;invalidate();};},[load,invalidate]);
 useEffect(()=>{const refresh=()=>{invalidate();void load();};window.addEventListener('popstate',refresh);return()=>window.removeEventListener('popstate',refresh);},[load,invalidate]);
 const filter=(unread:boolean)=>{const next:Status=unread?'unread':'all';invalidate();currentStatus.current=next;setStatus(next);void load(next);};
 const more=async()=>{
  if(pending.current||!inbox?.nextCursor)return;const previous=inbox,op=begin();
  try{
   const data=inboxValue(await request('?'+new URLSearchParams({status:currentStatus.current,cursor:previous.nextCursor!,limit:String(previous.limit)}),op.abort.signal),currentStatus.current);
   if(!current(op))return;
   const ids=new Set(previous.items.map(item=>item.id));if(data.items.some(item=>ids.has(item.id))||data.nextCursor===previous.nextCursor)throw Error('La bandeja cambió. Actualiza antes de cargar más avisos.');
   setInbox({...data,items:[...previous.items,...data.items]});
  }catch(cause){if(current(op)){clear();setError(cause instanceof Error?cause.message:errorText(503));}}
  finally{if(current(op)){pending.current=false;setBusy(false);}}
 };
 const save=async(channel:Preference['channel'],eventType:Preference['eventType'],enabled:boolean)=>{
  if(pending.current||!preferences)return;const previous=preferences.preferences.find(p=>p.channel===channel&&p.eventType===eventType),op=begin();
  try{
   await request('/preferences',op.abort.signal,{channel,eventType,enabled,expectedVersion:previous?.version??0});if(!current(op))return;
   const data=preferenceValue(await request('/preferences',op.abort.signal));if(!current(op))return;
   const stored=data.preferences.find(p=>p.channel===channel&&p.eventType===eventType);if(!stored||stored.enabled!==enabled)throw Error('La preferencia cambió durante el guardado. Actualiza para comprobarla.');
   setPreferences(data);setNotice('Preferencias guardadas y verificadas.');
  }catch(cause){if(current(op)){clear();setError(cause instanceof Error?cause.message:errorText(503));}}
  finally{if(current(op)){pending.current=false;setBusy(false);}}
 };
 const markRead=async(item:NotificationItem)=>{
  if(pending.current||!inbox)return;const op=begin();
  try{
   const value=await request('/'+item.id+'/read',op.abort.signal,{});if(!current(op))return;
   if(value?.id!==item.id||typeof value.readAt!=='string')throw Error('No se pudo comprobar la lectura del aviso.');
   const data=inboxValue(await request('?status='+currentStatus.current,op.abort.signal),currentStatus.current);if(!current(op))return;
   setInbox(data);setNotice('Aviso marcado como leído.');
  }catch(cause){if(current(op)){clear();setError(cause instanceof Error?cause.message:errorText(503));}}
  finally{if(current(op)){pending.current=false;setBusy(false);}}
 };
 const heading=settings?'Preferencias de notificaciones':'Notificaciones';
 return <section aria-label={heading}>
  <p className="eyebrow">Tu espacio de trabajo</p><h1>{heading}</h1>
  <p>{settings?'Elige los avisos y canales que deseas recibir en esta organización.':'Avisos de esta organización disponibles con tu acceso actual.'}</p>
  <p><Link href={settings?'/notifications':'/settings/notifications'}>{settings?'Ver notificaciones':'Configurar avisos'}</Link></p>
  <button disabled={busy} onClick={()=>void load()}>{settings?'Actualizar preferencias':'Actualizar notificaciones'}</button>
  {busy&&<p role="status">{settings?'Verificando preferencias…':'Verificando notificaciones…'}</p>}
  {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
  {!settings&&<label style={labelStyle}><input type="checkbox" style={checkboxStyle} checked={status==='unread'} disabled={busy} onChange={event=>filter(event.target.checked)}/>Mostrar sólo avisos sin leer</label>}
  {settings&&preferences&&<>
   {preferences.channels.some(channel=>!channel.deliveryAvailable)&&<p>Los canales indicados como pendientes todavía no envían avisos. Puedes guardar tus preferencias para cuando estén disponibles.</p>}
   <div style={{display:'grid',gap:'1.5rem'}}>{preferences.channels.map(channel=><fieldset key={channel.id} className="record-card" disabled={busy}>
    <legend>{channel.label}</legend><p>{channel.deliveryAvailable?'Canal disponible.':'Activación pendiente.'}</p>
    <label style={labelStyle}><input type="checkbox" style={checkboxStyle} checked={preferences.preferences.some(p=>p.channel===channel.id&&p.eventType==='*'&&p.enabled)} onChange={event=>void save(channel.id,'*',event.target.checked)}/>{'Activar '+channel.label}</label>
    {preferences.catalog.map(entry=><div key={entry.type}>
     <label style={labelStyle}><input type="checkbox" style={checkboxStyle} checked={preferences.preferences.some(p=>p.channel===channel.id&&p.eventType===entry.type&&p.enabled)} onChange={event=>void save(channel.id,entry.type,event.target.checked)}/>{entry.label}</label>
     <p className="muted">{entry.description}{!entry.connected?' · Este aviso todavía no está activado.':''}</p>
    </div>)}
   </fieldset>)}</div>
  </>}
  {!settings&&inbox&&<>
   {!inbox.items.length&&<p>{status==='unread'?'No hay avisos sin leer disponibles.':'No hay avisos disponibles.'}</p>}
   <ul aria-label="Avisos disponibles" style={{listStyle:'none',padding:0,display:'grid',gap:'1rem'}}>{inbox.items.map(item=><li key={item.id}>
    <article className="record-card" aria-label={item.title} data-notification-id={item.id}>
     <p className="muted">{item.readAt?'Leído':'Sin leer'} · <time dateTime={item.createdAt}>{item.createdAt.slice(0,19).replace('T',' ')} UTC</time></p>
     <h2>{item.title}</h2><p>{item.body}</p>
     <div style={{display:'flex',gap:'1rem',flexWrap:'wrap',alignItems:'center'}}><Link href={item.href}>Abrir detalle</Link>{!item.readAt&&<button style={{width:'auto'}} disabled={busy} onClick={()=>void markRead(item)}>Marcar como leído</button>}</div>
    </article>
   </li>)}</ul>
   {inbox.nextCursor&&<button disabled={busy} onClick={()=>void more()}>Cargar más avisos</button>}
  </>}
 </section>;
}
