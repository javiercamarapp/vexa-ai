'use client';
import {eventosVisibles,textoCanal} from '../../lib/notifications/avisos.mjs';
import {Button,LinkButton,Refresh,Arrow} from '../ui/button';
import {PageHeader} from '../ui/page-header';
import {SegmentedControl} from '../ui/segmented';
import {FilterBar} from '../ui/filter-bar';
import {ErrorState} from '../ui/error-state';
import {Loading} from '../ui/loading';
import {KpiLinea} from '../panel-comun/kpi-linea';
import '../panel-comun/panel-comun.css';
import '../datos/datos.css';
import {useRouter} from 'next/navigation';
import {useCallback,useEffect,useRef,useState} from 'react';
import type {InboxView,NotificationItem,PreferencesView,Preference} from '../../../../../packages/notifications/index.mjs';

type Status='all'|'unread';
const api='/api/notifications';
const checkboxStyle={width:'1.15rem',height:'1.15rem',padding:0,flexShrink:0};
const CANAL_TXT:Record<string,string>={inapp:'Centro de notificaciones',email:'Correo electrónico',push:'Notificaciones push'};
const CANAL_CORTO:Record<string,string>={inapp:'Centro',email:'Correo',push:'Push'};
const CANAL_ENLACE:Record<string,[string,string]>={inapp:['/notifications','Ver notificaciones'],email:['/settings/notification-delivery','Política de envío de la organización'],push:['/notifications/push','Notificaciones en este dispositivo']};
const errorText=(status:number)=>status===401||status===403?'Tu acceso cambió. Vuelve a iniciar sesión o selecciona una organización autorizada.':status===404?'Este aviso o su recurso ya no está disponible con tus permisos.':status===409?'La versión cambió. Actualiza para comprobar el estado guardado antes de volver a intentarlo.':status===400?'La solicitud no es válida. Actualiza y revisa la selección.':'No se pudo verificar la operación. Actualiza para comprobar el estado guardado.';
const safeHref=(value:unknown):value is string=>typeof value==='string'&&value.startsWith('/')&&!value.startsWith('//')&&!/[\\\u0000-\u0020]/.test(value);
const validItem=(item:NotificationItem)=>Boolean(item&&typeof item.id==='string'&&typeof item.title==='string'&&typeof item.body==='string'&&typeof item.createdAt==='string'&&(item.readAt===null||typeof item.readAt==='string')&&safeHref(item.href));
function inboxValue(data:InboxView,status:Status):InboxView{
 if(!data||!Number.isSafeInteger(data.unreadCount)||data.unreadCount<0||!Array.isArray(data.items)||data.items.some(item=>!validItem(item))||data.status!==status||(data.nextCursor!==null&&typeof data.nextCursor!=='string'))throw Error('No se pudo verificar la bandeja recibida.');
 return data;
}
function preferenceValue(data:PreferencesView):PreferencesView{
 if(!data||!Array.isArray(data.catalog)||!Array.isArray(data.channels)||!Array.isArray(data.preferences)||data.preferences.some(p=>typeof p.enabled!=='boolean'||!Number.isInteger(p.version)||p.version<0))throw Error('No se pudieron verificar las preferencias recibidas.');
 return data;
}

export function NotificationPanel({settings=false}:{settings?:boolean}){
 const router=useRouter();
 const [inbox,setInbox]=useState<InboxView|null>(null),[preferences,setPreferences]=useState<PreferencesView|null>(null);
 const [status,setStatus]=useState<Status>('unread'),[busy,setBusy]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const epoch=useRef(0),controller=useRef<AbortController|null>(null),pending=useRef(false),currentStatus=useRef<Status>('unread');
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
   if(settings)setPreferences(preferenceValue(data));else{setInbox(inboxValue(data,nextStatus));window.dispatchEvent(new Event('vexa-notifications-changed'));}
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
 const markRead=async(item:NotificationItem,openDetail=false)=>{
  if(pending.current||!inbox)return;const op=begin();
  try{
   const value=await request('/'+item.id+'/read',op.abort.signal,{});if(!current(op))return;
   if(value?.id!==item.id||typeof value.readAt!=='string')throw Error('No se pudo comprobar la lectura del aviso.');
   const data=inboxValue(await request('?status='+currentStatus.current,op.abort.signal),currentStatus.current);if(!current(op))return;
   setInbox(data);setNotice('Aviso marcado como leído.');window.dispatchEvent(new Event('vexa-notifications-changed'));if(openDetail)router.push(item.href);
  }catch(cause){if(current(op)){clear();setError(cause instanceof Error?cause.message:errorText(503));}}
  finally{if(current(op)){pending.current=false;setBusy(false);}}
 };
const heading=settings?'Preferencias de notificaciones':'Notificaciones';
 const fallo=error&&!busy?<ErrorState title="No se pudo cargar" body={error} onRetry={()=>void load()}/>:null;
 const sinLeer=inbox?.unreadCount??0,cargados=inbox?.items.length??0;
 return <section className="task-page notifications-page stack" aria-label={heading}>
  {settings
   ?<PageHeader eyebrow="Administración" title="Avisos" description="Elige qué avisos y por qué canal los recibes en esta organización." actions={<><LinkButton href="/notifications" icon={<Arrow/>}>Ver notificaciones</LinkButton><Button icon={<Refresh/>} loading={busy} onClick={()=>void load()}>Actualizar</Button></>}/>
   :<PageHeader eyebrow="Tu espacio de trabajo" title="Notificaciones" description="Avisos de esta organización disponibles con tu acceso actual." actions={<><LinkButton href="/settings/notifications" variant="secondary">Configurar avisos</LinkButton><Button icon={<Refresh/>} loading={busy} onClick={()=>void load()}>Actualizar</Button></>}/>}
  {busy&&!(settings?preferences:inbox)&&<Loading compact message={settings?'Verificando preferencias…':'Verificando notificaciones…'}/>}
  {fallo}{notice&&<p role="status" className="ac-nota">{notice}</p>}
  {!settings&&<FilterBar label="Filtro de avisos"><SegmentedControl label="Avisos" value={status} onChange={v=>filter(v==='unread')} options={[{value:'unread',label:'Sin leer',count:inbox?sinLeer:undefined},{value:'all',label:'Todas'}]}/></FilterBar>}
  {settings&&preferences&&<>
   <div className="pc-grid" data-cols="4-4-4">{preferences.channels.map(channel=>{const on=preferences.preferences.some(p=>p.channel===channel.id&&p.eventType==='*'&&p.enabled),[href,txt]=CANAL_ENLACE[channel.id]??['/notifications','Ver notificaciones'];return <section key={channel.id} className="pc-card" aria-label={'Canal: '+(CANAL_TXT[channel.id]??channel.label)}>
    <div className="pc-card-head"><div><h2>{CANAL_TXT[channel.id]??channel.label}</h2></div><span className="pc-estado" data-tono={channel.deliveryAvailable?'ok':'off'}>{channel.deliveryAvailable?'Disponible':'Pendiente'}</span></div>
    <p className="ac-nota pc-fill">{textoCanal(channel)}</p>
    <label className="pc-ajuste" style={{minHeight:40,padding:'6px 0',cursor:'pointer'}}><span><h3>Activar el canal</h3></span><input type="checkbox" style={checkboxStyle} disabled={busy} aria-label={'Activar '+channel.label} checked={on} onChange={event=>void save(channel.id,'*',event.target.checked)}/></label>
    <div><LinkButton size="sm" variant="ghost" href={href} icon={<Arrow/>}>{txt}</LinkButton></div></section>;})}</div>
   <section className="pc-card" data-flush aria-labelledby="av-t"><header className="pc-card-head"><div><h2 id="av-t">Avisos por canal</h2><p>Cada aviso, en los canales donde quieres recibirlo</p></div></header>
    <div className="ui-table-wrap" tabIndex={0} role="region" aria-label="Matriz de avisos y canales"><table className="ui-table notification-matrix"><caption className="sr-only">Avisos por canal</caption>
     <thead><tr><th scope="col">Aviso</th>{preferences.channels.map(channel=><th scope="col" key={channel.id} data-align="num" title={channel.label}><span aria-hidden="true">{CANAL_CORTO[channel.id]??channel.label}</span><span className="sr-only">{channel.label}</span></th>)}</tr></thead>
     <tbody>{eventosVisibles(preferences.catalog).map(entry=><tr key={entry.type}><th scope="row" data-align="start"><span className="pc-th-fila">{entry.label}</span><small className="pc-s" style={{display:'block',fontWeight:400}}>{entry.description}</small></th>{preferences.channels.map(channel=><td key={channel.id} data-align="num"><label className="matrix-check"><input type="checkbox" style={checkboxStyle} disabled={busy} aria-label={entry.label+' · '+channel.label} checked={preferences.preferences.some(p=>p.channel===channel.id&&p.eventType===entry.type&&p.enabled)} onChange={event=>void save(channel.id,entry.type,event.target.checked)}/></label></td>)}</tr>)}</tbody></table></div></section>
  </>}
  {!settings&&inbox&&<>
   <KpiLinea label="Indicadores de notificaciones" items={[
    {label:'Sin leer',value:String(sinLeer),c:6,chip:sinLeer>0?{texto:'Pendientes',tono:'warn'}:{texto:'Al día',tono:'ok'},partes:[{label:'Sin leer',value:sinLeer},{label:'Leídos',value:Math.max(0,cargados-sinLeer)}],nota:sinLeer===1?'aviso sin leer':'avisos sin leer'},
    {label:'Cargados',value:String(cargados),c:6,partes:[{label:'Sin leer',value:inbox.items.filter(i=>!i.readAt).length},{label:'Leídos',value:inbox.items.filter(i=>i.readAt).length}],nota:inbox.nextCursor?'Hay más: usa «Cargar más»':'Todos los que tienes disponibles'}]}/>
   <section className="pc-card" data-flush aria-label="Avisos disponibles"><header className="pc-card-head"><div><h2>Avisos</h2><p>{status==='unread'?'Solo los que no has leído':'Todos los disponibles'}</p></div></header>
    {!inbox.items.length?<p className="ac-vacio" style={{margin:'0 14px 14px'}}>{status==='unread'?'No hay avisos sin leer disponibles.':'No hay avisos disponibles.'}</p>
     :<ul className="pc-lista ui-reset" aria-label="Avisos disponibles">{inbox.items.map(item=><li key={item.id} style={{listStyle:'none',padding:'8px 14px'}} data-notification-id={item.id} aria-label={item.title}>
      <i className="pc-punto" data-tono={item.readAt?'off':'bad'}/><span className="pc-grow"><span className="pc-t">{item.title}</span><span className="pc-s">{item.body}</span><span className="pc-s">{item.readAt?'Leído':'Sin leer'} · <time dateTime={item.createdAt}>{item.createdAt.slice(0,19).replace('T',' ')} UTC</time></span></span>
      <span style={{display:'flex',gap:6,flexWrap:'wrap',justifyContent:'flex-end'}}>{item.readAt?<LinkButton size="sm" href={item.href} icon={<Arrow/>}>Abrir detalle</LinkButton>:<Button size="sm" variant="primary" disabled={busy} onClick={()=>void markRead(item,true)}>Abrir detalle</Button>}{!item.readAt&&<Button size="sm" variant="ghost" disabled={busy} onClick={()=>void markRead(item)}>Marcar como leído</Button>}</span></li>)}</ul>}
    {inbox.nextCursor&&<div style={{padding:'8px 14px 14px'}}><Button disabled={busy} onClick={()=>void more()}>Cargar más avisos</Button></div>}</section>
  </>}
 </section>;
}
