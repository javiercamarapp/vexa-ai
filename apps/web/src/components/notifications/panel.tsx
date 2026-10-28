'use client';
import {RovaqCargando} from '../rovaq-cargando';
import {useAutoRefresh} from '../ui/use-auto-refresh';
import {eventosVisibles,textoCanal} from '../../lib/notifications/avisos.mjs';
import {Button,LinkButton,Arrow} from '../ui/button';
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
import {useT} from '../i18n/proveedor';
import type {Clave,Traductor} from '../../lib/i18n';
import type {InboxView,NotificationItem,PreferencesView,Preference} from '../../../../../packages/notifications/index.mjs';

type Status='all'|'unread';
const api='/api/notifications';
const checkboxStyle={width:'1.15rem',height:'1.15rem',padding:0,flexShrink:0};
const CANAL_TXT:Record<string,Clave>={inapp:'conx.a.ch.inapp',email:'conx.a.ch.email',push:'conx.a.ch.push'};
const CANAL_CORTO:Record<string,Clave>={inapp:'conx.a.cc.inapp',email:'conx.a.cc.email',push:'conx.a.cc.push'};
const CANAL_ENLACE:Record<string,[string,Clave]>={inapp:['/notifications','conx.a.en.verNotif'],email:['/settings/notification-delivery','conx.a.en.politica'],push:['/notifications/push','conx.a.en.dispositivo']};
const errorText=(t:Traductor,status:number)=>status===401||status===403?t('conx.a.e401'):status===404?t('conx.a.e404'):status===409?t('conx.a.e409'):status===400?t('conx.a.e400'):t('conx.a.eOtro');
const safeHref=(value:unknown):value is string=>typeof value==='string'&&value.startsWith('/')&&!value.startsWith('//')&&!/[\\\u0000-\u0020]/.test(value);
const validItem=(item:NotificationItem)=>Boolean(item&&typeof item.id==='string'&&typeof item.title==='string'&&typeof item.body==='string'&&typeof item.createdAt==='string'&&(item.readAt===null||typeof item.readAt==='string')&&safeHref(item.href));
function inboxValue(t:Traductor,data:InboxView,status:Status):InboxView{
 if(!data||!Number.isSafeInteger(data.unreadCount)||data.unreadCount<0||!Array.isArray(data.items)||data.items.some(item=>!validItem(item))||data.status!==status||(data.nextCursor!==null&&typeof data.nextCursor!=='string'))throw Error(t('conx.a.errBandeja'));
 return data;
}
function preferenceValue(t:Traductor,data:PreferencesView):PreferencesView{
 if(!data||!Array.isArray(data.catalog)||!Array.isArray(data.channels)||!Array.isArray(data.preferences)||data.preferences.some(p=>typeof p.enabled!=='boolean'||!Number.isInteger(p.version)||p.version<0))throw Error(t('conx.a.errPrefs'));
 return data;
}

export function NotificationPanel({settings=false}:{settings?:boolean}){
 const router=useRouter(),t=useT();
 const [inbox,setInbox]=useState<InboxView|null>(null),[preferences,setPreferences]=useState<PreferencesView|null>(null);
 const [status,setStatus]=useState<Status>('unread'),[busy,setBusy]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const epoch=useRef(0),controller=useRef<AbortController|null>(null),pending=useRef(false),currentStatus=useRef<Status>('unread');
 const invalidate=useCallback(()=>{epoch.current++;controller.current?.abort();pending.current=false;},[]);
 const clear=useCallback(()=>{setInbox(null);setPreferences(null);},[]);
 const begin=useCallback(()=>{controller.current?.abort();const abort=new AbortController();controller.current=abort;const generation=++epoch.current;pending.current=true;setBusy(true);setError('');setNotice('');return {abort,generation};},[]);
 const current=useCallback((operation:{abort:AbortController;generation:number})=>!operation.abort.signal.aborted&&operation.generation===epoch.current,[]);
 const request=useCallback(async(suffix:string,signal:AbortSignal,body?:unknown)=>{
  const response=await fetch(api+suffix,{method:body===undefined?'GET':'POST',cache:'no-store',signal,headers:body===undefined?undefined:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  if(!response.ok)throw Error(errorText(t,response.status));
  const value=await response.json();if(value?.contract_version!=='f06-notifications-v1'||!value.data)throw Error(t('conx.a.errRespuesta'));
  return value.data;
 },[t]);
 const load=useCallback(async(nextStatus:Status=currentStatus.current)=>{
  const op=begin();clear();
  try{
   const data=await request(settings?'/preferences':'?status='+nextStatus,op.abort.signal);
   if(!current(op))return;
   if(settings)setPreferences(preferenceValue(t,data));else{setInbox(inboxValue(t,data,nextStatus));window.dispatchEvent(new Event('vexa-notifications-changed'));}
  }catch(cause){if(current(op)){clear();setError(cause instanceof Error?cause.message:errorText(t,503));}}
  finally{if(current(op)){pending.current=false;setBusy(false);}}
 },[begin,clear,current,request,settings,t]);
 // Revalidación en segundo plano (datos nuevos): no vacía la bandeja ni muestra «Verificando…»; si hay una acción en curso o falla, se queda lo pintado.
 const recargarSilencioso=useCallback(async()=>{
  if(pending.current)return;const abort=new AbortController(),generation=epoch.current;
  try{
   const data=await request(settings?'/preferences':'?status='+currentStatus.current,abort.signal);
   if(pending.current||generation!==epoch.current)return;
   if(settings)setPreferences(preferenceValue(t,data));else{setInbox(inboxValue(t,data,currentStatus.current));window.dispatchEvent(new Event('vexa-notifications-changed'));}
  }catch{/* se conserva lo pintado */}
 },[request,settings,t]);
 useAutoRefresh(recargarSilencioso,{ocupado:()=>pending.current});
 useEffect(()=>{let active=true;void Promise.resolve().then(()=>{if(active)void load();});return()=>{active=false;invalidate();};},[load,invalidate]);
 useEffect(()=>{const refresh=()=>{invalidate();void load();};window.addEventListener('popstate',refresh);return()=>window.removeEventListener('popstate',refresh);},[load,invalidate]);
 const filter=(unread:boolean)=>{const next:Status=unread?'unread':'all';invalidate();currentStatus.current=next;setStatus(next);void load(next);};
 const more=async()=>{
  if(pending.current||!inbox?.nextCursor)return;const previous=inbox,op=begin();
  try{
   const data=inboxValue(t,await request('?'+new URLSearchParams({status:currentStatus.current,cursor:previous.nextCursor!,limit:String(previous.limit)}),op.abort.signal),currentStatus.current);
   if(!current(op))return;
   const ids=new Set(previous.items.map(item=>item.id));if(data.items.some(item=>ids.has(item.id))||data.nextCursor===previous.nextCursor)throw Error(t('conx.a.errBandejaCambio'));
   setInbox({...data,items:[...previous.items,...data.items]});
  }catch(cause){if(current(op)){clear();setError(cause instanceof Error?cause.message:errorText(t,503));}}
  finally{if(current(op)){pending.current=false;setBusy(false);}}
 };
 const save=async(channel:Preference['channel'],eventType:Preference['eventType'],enabled:boolean)=>{
  if(pending.current||!preferences)return;const previous=preferences.preferences.find(p=>p.channel===channel&&p.eventType===eventType),op=begin();
  try{
   await request('/preferences',op.abort.signal,{channel,eventType,enabled,expectedVersion:previous?.version??0});if(!current(op))return;
   const data=preferenceValue(t,await request('/preferences',op.abort.signal));if(!current(op))return;
   const stored=data.preferences.find(p=>p.channel===channel&&p.eventType===eventType);if(!stored||stored.enabled!==enabled)throw Error(t('conx.a.errPrefCambio'));
   setPreferences(data);setNotice(t('conx.a.noticePrefs'));
  }catch(cause){if(current(op)){clear();setError(cause instanceof Error?cause.message:errorText(t,503));}}
  finally{if(current(op)){pending.current=false;setBusy(false);}}
 };
 const markRead=async(item:NotificationItem,openDetail=false)=>{
  if(pending.current||!inbox)return;const op=begin();
  try{
   const value=await request('/'+item.id+'/read',op.abort.signal,{});if(!current(op))return;
   if(value?.id!==item.id||typeof value.readAt!=='string')throw Error(t('conx.a.errLectura'));
   const data=inboxValue(t,await request('?status='+currentStatus.current,op.abort.signal),currentStatus.current);if(!current(op))return;
   setInbox(data);setNotice(t('conx.a.noticeLeido'));window.dispatchEvent(new Event('vexa-notifications-changed'));if(openDetail)router.push(item.href);
  }catch(cause){if(current(op)){clear();setError(cause instanceof Error?cause.message:errorText(t,503));}}
  finally{if(current(op)){pending.current=false;setBusy(false);}}
 };
const heading=settings?t('conx.a.hPrefs'):t('conx.a.hNotifs');
 const fallo=error&&!busy?<ErrorState title={t('conx.a.noCargar')} body={error} onRetry={()=>void load()}/>:null;
 const sinLeer=inbox?.unreadCount??0,cargados=inbox?.items.length??0;
 if(busy&&!(settings?preferences:inbox)&&!error)return <RovaqCargando mensaje=""/>;
 return <section className="task-page notifications-page stack" aria-label={heading}>
  {settings
   ?<PageHeader eyebrow={t('conx.a.eyebrowAdmin')} title={t('conx.a.tituloAvisos')} description={t('conx.a.descAvisos')} actions={<><LinkButton href="/notifications" icon={<Arrow/>}>{t('conx.a.en.verNotif')}</LinkButton></>}/>
   :<PageHeader eyebrow={t('conx.a.eyebrowEspacio')} title={t('conx.a.hNotifs')} description={t('conx.a.descNotifs')} actions={<><LinkButton href="/settings/notifications" variant="secondary">{t('conx.a.configurar')}</LinkButton></>}/>}
  {busy&&!(settings?preferences:inbox)&&<Loading compact message={settings?t('conx.a.verifPrefs'):t('conx.a.verifNotifs')}/>}
  {fallo}{notice&&<p role="status" className="ac-nota">{notice}</p>}
  {!settings&&<FilterBar label={t('conx.a.filtro')}><SegmentedControl label={t('conx.a.tituloAvisos')} value={status} onChange={v=>filter(v==='unread')} options={[{value:'unread',label:t('conx.a.sinLeer'),count:inbox?sinLeer:undefined},{value:'all',label:t('conx.a.todas')}]}/></FilterBar>}
  {settings&&preferences&&<>
   <div className="pc-grid" data-cols="4-4-4">{preferences.channels.map(channel=>{const on=preferences.preferences.some(p=>p.channel===channel.id&&p.eventType==='*'&&p.enabled),[href,txtK]=CANAL_ENLACE[channel.id]??['/notifications','conx.a.en.verNotif'],canalTxt=CANAL_TXT[channel.id]?t(CANAL_TXT[channel.id]):channel.label,txt=t(txtK as Clave);return <section key={channel.id} className="pc-card" aria-label={t('conx.a.canal',{canal:canalTxt})}>
    <div className="pc-card-head"><div><h2>{canalTxt}</h2></div><span className="pc-estado" data-tono={channel.deliveryAvailable?'ok':'off'}>{channel.deliveryAvailable?t('conx.a.disponible'):t('conx.a.pendiente')}</span></div>
    <p className="ac-nota pc-fill">{textoCanal(channel,t as never)}</p>
    <label className="pc-ajuste" style={{minHeight:40,padding:'6px 0',cursor:'pointer'}}><span><h3>{t('conx.a.activarCanal')}</h3></span><input type="checkbox" style={checkboxStyle} disabled={busy} aria-label={t('conx.a.activar',{canal:channel.label})} checked={on} onChange={event=>void save(channel.id,'*',event.target.checked)}/></label>
    <div><LinkButton size="sm" variant="ghost" href={href} icon={<Arrow/>}>{txt}</LinkButton></div></section>;})}</div>
   <section className="pc-card" data-flush aria-labelledby="av-t"><header className="pc-card-head"><div><h2 id="av-t">{t('conx.a.porCanal')}</h2><p>{t('conx.a.porCanalSub')}</p></div></header>
    <div className="ui-table-wrap" tabIndex={0} role="region" aria-label={t('conx.a.matriz')}><table className="ui-table notification-matrix"><caption className="sr-only">{t('conx.a.porCanal')}</caption>
     <thead><tr><th scope="col">{t('conx.a.aviso')}</th>{preferences.channels.map(channel=><th scope="col" key={channel.id} data-align="num" title={channel.label}><span aria-hidden="true">{CANAL_CORTO[channel.id]?t(CANAL_CORTO[channel.id]):channel.label}</span><span className="sr-only">{channel.label}</span></th>)}</tr></thead>
     <tbody>{eventosVisibles(preferences.catalog).map(entry=><tr key={entry.type}><th scope="row" data-align="start"><span className="pc-th-fila">{entry.label}</span><small className="pc-s" style={{display:'block',fontWeight:400}}>{entry.description}</small></th>{preferences.channels.map(channel=><td key={channel.id} data-align="num"><label className="matrix-check"><input type="checkbox" style={checkboxStyle} disabled={busy} aria-label={entry.label+' · '+channel.label} checked={preferences.preferences.some(p=>p.channel===channel.id&&p.eventType===entry.type&&p.enabled)} onChange={event=>void save(channel.id,entry.type,event.target.checked)}/></label></td>)}</tr>)}</tbody></table></div></section>
  </>}
  {!settings&&inbox&&<>
   <KpiLinea label={t('conx.a.kpiLabel')} items={[
    {label:t('conx.a.sinLeer'),value:String(sinLeer),c:6,chip:sinLeer>0?{texto:t('conx.a.k.pendientes'),tono:'warn'}:{texto:t('conx.a.k.alDia'),tono:'ok'},partes:[{label:t('conx.a.sinLeer'),value:sinLeer},{label:t('conx.a.k.leidos'),value:Math.max(0,cargados-sinLeer)}],nota:sinLeer===1?t('conx.a.k.notaUno'):t('conx.a.k.notaVarios')},
    {label:t('conx.a.k.cargados'),value:String(cargados),c:6,partes:[{label:t('conx.a.sinLeer'),value:inbox.items.filter(i=>!i.readAt).length},{label:t('conx.a.k.leidos'),value:inbox.items.filter(i=>i.readAt).length}],nota:inbox.nextCursor?t('conx.a.k.hayMas'):t('conx.a.k.todos')}]}/>
   <section className="pc-card" data-flush aria-label={t('conx.a.disp')}><header className="pc-card-head"><div><h2>{t('conx.a.tituloAvisos')}</h2><p>{status==='unread'?t('conx.a.soloNoLeidos'):t('conx.a.todosDisp')}</p></div></header>
    {!inbox.items.length?<p className="ac-vacio" style={{margin:'0 14px 14px'}}>{status==='unread'?t('conx.a.vacioSinLeer'):t('conx.a.vacio')}</p>
     :<ul className="pc-lista ui-reset" aria-label={t('conx.a.disp')}>{inbox.items.map(item=><li key={item.id} style={{listStyle:'none',padding:'8px 14px'}} data-notification-id={item.id} aria-label={item.title}>
      <i className="pc-punto" data-tono={item.readAt?'off':'bad'}/><span className="pc-grow"><span className="pc-t">{item.title}</span><span className="pc-s">{item.body}</span><span className="pc-s">{item.readAt?t('conx.a.leido'):t('conx.a.sinLeer')} · <time dateTime={item.createdAt}>{item.createdAt.slice(0,19).replace('T',' ')} UTC</time></span></span>
      <span style={{display:'flex',gap:8,flexWrap:'wrap',justifyContent:'flex-end'}}>{item.readAt?<LinkButton size="sm" href={item.href} icon={<Arrow/>}>{t('conx.a.abrir')}</LinkButton>:<Button size="sm" variant="primary" disabled={busy} onClick={()=>void markRead(item,true)}>{t('conx.a.abrir')}</Button>}{!item.readAt&&<Button size="sm" variant="ghost" disabled={busy} onClick={()=>void markRead(item)}>{t('conx.a.marcar')}</Button>}</span></li>)}</ul>}
    {inbox.nextCursor&&<div style={{padding:'8px 14px 14px'}}><Button disabled={busy} onClick={()=>void more()}>{t('conx.a.cargarMas')}</Button></div>}</section>
  </>}
 </section>;
}
