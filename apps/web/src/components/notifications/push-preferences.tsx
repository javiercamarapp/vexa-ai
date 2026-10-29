'use client';
import {RovaqCargando} from '../rovaq-cargando';
import {useAutoRefresh} from '../ui/use-auto-refresh';
import {useLayoutEffect,useCallback,useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {useT} from '../i18n/proveedor';
import type {Clave} from '../../lib/i18n';
import type {PushDevice} from '../../../../../packages/notifications/push.mjs';
type View={observedAt:number;devices:PushDevice[];configured:boolean;publicKey:string|null;currentDeviceId:string|null};
const keyBytes=(s:string)=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
async function readyWorker(signal:AbortSignal){
 signal.throwIfAborted();
 let timer:ReturnType<typeof setTimeout>|undefined;
 let abort:()=>void=()=>{};
 const interrupted=new Promise<never>((_,reject)=>{abort=()=>reject(signal.reason);signal.addEventListener('abort',abort,{once:true});timer=setTimeout(()=>reject(Error('worker_ready_timeout')),15000);});
 try{return await Promise.race([(async()=>{const registration=await navigator.serviceWorker.register('/service-worker.js',{scope:'/'});signal.throwIfAborted();await navigator.serviceWorker.ready;return registration;})(),interrupted]);}
 finally{clearTimeout(timer);signal.removeEventListener('abort',abort);}
}
export function PushPreferences(){
 const tx=useT();
 const [view,setView]=useState<View|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState<Clave|''>(''),[permission,setPermission]=useState<NotificationPermission|null>(null),[supported,setSupported]=useState<boolean|null>(null),[observedAt,setObservedAt]=useState(0),[loading,setLoading]=useState(true);const generation=useRef(0),lifetime=useRef<AbortController|null>(null);
 const read=useCallback(async(signal:AbortSignal|undefined=lifetime.current?.signal)=>{
  const epoch=++generation.current;setLoading(true);setMessage('');
  try{const r=await fetch('/api/notifications/push',{cache:'no-store',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(15000)]):AbortSignal.timeout(15000)});if(!r.ok)throw Error('PUSH_READ_FAILED');const body=await r.json();if(signal?.aborted||epoch!==generation.current)return false;if(!body.data||!Array.isArray(body.data.devices)||typeof body.data.configured!=='boolean'||!Number.isFinite(body.data.observedAt))throw Error('PUSH_READ_INVALID');setView(body.data as View);setObservedAt(body.data.observedAt);return true;}
  catch{if(!signal?.aborted&&epoch===generation.current){setView(null);setMessage('tr.push.errEstado');}return false;}
  finally{if(!signal?.aborted&&epoch===generation.current)setLoading(false);}
 },[]);
 // Datos nuevos o al volver a la pestaña (p. ej. tras cambiar el permiso en los ajustes del navegador): relectura en segundo plano sin vaciar lo pintado.
 const busyRef=useRef(false);useLayoutEffect(()=>{busyRef.current=busy||loading;});
 const recargarSilencioso=useCallback(async()=>{if('Notification' in window)setPermission(Notification.permission);if(busyRef.current)return;const epoch=generation.current;try{const r=await fetch('/api/notifications/push',{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!r.ok)return;const body=await r.json();if(epoch!==generation.current||busyRef.current||!body.data||!Array.isArray(body.data.devices)||typeof body.data.configured!=='boolean'||!Number.isFinite(body.data.observedAt))return;setView(body.data as View);setObservedAt(body.data.observedAt);}catch{/* se conserva lo pintado */}},[]);
 useAutoRefresh(recargarSilencioso,{ocupado:()=>busyRef.current,ocultaMinMs:0});
 useEffect(()=>{const controller=new AbortController();lifetime.current=controller;void Promise.resolve().then(()=>{if(controller.signal.aborted)return;setSupported(window.isSecureContext&&'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window);if('Notification' in window)setPermission(Notification.permission);return read(controller.signal);});return()=>{controller.abort();};},[read]);
 async function post(body:unknown,signal:AbortSignal){const r=await fetch('/api/notifications/push',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.any([signal,AbortSignal.timeout(15000)])});if(!r.ok)throw Error('No se confirmó el cambio. Vuelve a intentarlo en unos segundos; el estado se comprueba solo.');return r.json();}
 async function enable(){
  const signal=lifetime.current?.signal;if(!signal||signal.aborted||!view?.configured||!view.publicKey||busy||permission==='denied')return;
  setBusy(true);setMessage('');let subscription:PushSubscription|null=null,registrationAttempted=false,permissionRejected=false;
  try{
   const permission=await Notification.requestPermission();signal.throwIfAborted();setPermission(permission);if(permission!=='granted'){permissionRejected=true;throw Error('permission_not_granted');}
   const registration=await readyWorker(signal);signal.throwIfAborted();
   subscription=await registration.pushManager.getSubscription();signal.throwIfAborted();
   if(subscription){const oldKey=subscription.options.applicationServerKey;if(!oldKey||btoa(String.fromCharCode(...new Uint8Array(oldKey))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')!==view.publicKey){await subscription.unsubscribe();subscription=null;}}
   subscription??=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:keyBytes(view.publicKey)});
   signal.throwIfAborted();registrationAttempted=true;await post({op:'register',consent:true,subscription:subscription.toJSON()},signal);if(!await read(signal))return;setMessage('tr.push.regOk');
  }catch{if(signal.aborted)return;if(subscription&&!registrationAttempted)await subscription.unsubscribe().catch(()=>false);setView(null);setMessage(permissionRejected?'tr.push.permisoNo':'tr.push.noActivacion');}finally{if(!signal.aborted)setBusy(false);}
 }
 async function revoke(device:PushDevice){const signal=lifetime.current?.signal;if(!signal||signal.aborted||busy)return;setBusy(true);setMessage('');try{await post({op:'revoke',id:device.id},signal);signal.throwIfAborted();if(device.deviceId===view?.currentDeviceId){const registration=await navigator.serviceWorker.getRegistration('/');const subscription=await registration?.pushManager.getSubscription();signal.throwIfAborted();await subscription?.unsubscribe();}if(!await read(signal))return;setMessage('tr.push.desactivada');}catch{if(signal.aborted)return;setView(null);setMessage('tr.push.noDesactivacion');}finally{if(!signal.aborted)setBusy(false);}}
 if(loading&&!view&&!message)return <RovaqCargando mensaje=""/>;
 return <section aria-labelledby="push-title" aria-busy={loading||busy}><p className="eyebrow">{tx('tr.push.eyebrow')}</p><h1 id="push-title">{tx('tr.push.titulo')}</h1><p>{tx('tr.push.intro')}</p><p>{tx('tr.push.autoriza')}</p><p><Link prefetch={false} href="/settings/notifications">{tx('tr.push.prefEvento')}</Link> · <Link prefetch={false} href="/notifications">{tx('tr.push.volverNotifs')}</Link></p>{supported===true&&<div className="record-card"><h2>{tx('tr.push.permisoTit')}</h2><p>{permission==='granted'?tx('tr.push.permitido'):permission==='denied'?tx('tr.push.bloqueado'):tx('tr.push.sinSolicitar')}</p><p>{tx('tr.push.independientes')}</p></div>}{loading&&<RovaqCargando compacto mensaje={tx('tr.push.cargandoEstado')}/>}{supported===false&&<p>{tx('tr.push.sinWebPush')}</p>}{view&&!view.configured&&<p>{tx('tr.push.sinConfig')}</p>}<button disabled={supported!==true||permission==='denied'||!view?.configured||busy||loading} onClick={()=>void enable()}>{tx('tr.push.activar')}</button><p role="status" aria-live="polite">{message?tx(message):''}</p>{view&&<ul aria-label={tx('tr.push.dispAria')} style={{listStyle:'none',padding:0,display:'grid',gap:'1rem'}}>{!view.devices.length&&<li>{tx('tr.push.sinDisp')}</li>}{view.devices.map((d,i)=><li className="record-card" key={d.id}>{tx('tr.push.dispFila',{n:i+1,este:d.deviceId===view.currentDeviceId?tx('tr.push.esteNav'):'',estado:d.status==='revoked'?tx('tr.push.desactivado'):new Date(d.expiresAt).getTime()<=observedAt?tx('tr.push.caducado'):tx('tr.push.activo'),fecha:new Date(d.expiresAt).toLocaleString()})} <button disabled={busy||loading||d.status==='revoked'} onClick={()=>void revoke(d)}>{tx('tr.push.desactivar')}</button></li>)}</ul>}</section>;
}
