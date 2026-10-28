'use client';
import {RovaqCargando} from '../rovaq-cargando';
import {useAutoRefresh} from '../ui/use-auto-refresh';
import Link from 'next/link';
import {PageHeader} from '../ui/page-header';
import {duracionLegible} from '../../lib/notifications/duracion.mjs';
import {ConfirmationDialog} from '../confirmation-dialog';
import {useLayoutEffect,useCallback,useEffect,useRef,useState} from 'react';
import type {DeliveryPolicy} from '../../../../../packages/notifications/policies.mjs';
import {useT} from '../i18n/proveedor';
import type {Clave,Traductor} from '../../lib/i18n';
const names={inapp:'conx.p.ch.inapp',email:'conx.p.ch.email',push:'conx.p.ch.push'} as const satisfies Record<string,Clave>;
function parse(value:unknown,t:Traductor):DeliveryPolicy[]{
 if(!Array.isArray(value)||value.length!==3||new Set(value.map(p=>p?.channel)).size!==3||value.some(p=>!p||!Object.hasOwn(names,p.channel)||typeof p.enabled!=='boolean'||!['version','intervalMs','digestWindowMs','maxAttempts','lifetimeMs'].every(k=>Number.isSafeInteger(p[k]))||p.version<0||p.intervalMs<1000||p.intervalMs>86400000||p.digestWindowMs<0||p.digestWindowMs>3600000||p.maxAttempts<1||p.maxAttempts>10||p.lifetimeMs<1000||p.lifetimeMs>2592000000))throw Error(t('conx.p.errVerificar'));
 return value;
}
export function DeliveryPolicies(){
 const t=useT(),canal=(c:string)=>t(names[c as keyof typeof names]);
 const [rows,setRows]=useState<DeliveryPolicy[]>([]),[busy,setBusy]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const tRef=useRef(t);useLayoutEffect(()=>{tRef.current=t;});
 const active=useRef<AbortController|null>(null),heading=useRef<HTMLElement>(null),pending=useRef(false),sucio=useRef(false),busyRef=useRef(true);
 const refreshGeneration=useRef(0),refreshController=useRef<AbortController|null>(null);
 const invalidateRefresh=useCallback(()=>{refreshGeneration.current++;refreshController.current?.abort();refreshController.current=null;},[]);
 const request=useCallback(async(signal:AbortSignal,body?:unknown)=>{
  const response=await fetch('/api/notifications/delivery',{method:body===undefined?'GET':'POST',cache:'no-store',signal:AbortSignal.any([signal,AbortSignal.timeout(15000)]),headers:body===undefined?undefined:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  if(!response.ok)throw Error(response.status===409?tRef.current('conx.p.err409'):response.status===403?tRef.current('conx.p.err403'):tRef.current('conx.p.errEstado'));
  const payload=await response.json();if(!payload?.data)throw Error(tRef.current('conx.p.errRespuesta'));return payload.data;
 },[]);
 const load=useCallback(async()=>{
  invalidateRefresh();
  active.current?.abort();const controller=new AbortController();active.current=controller;setBusy(true);setError('');setNotice('');setRows([]);sucio.current=false;
  try{const next=parse(await request(controller.signal),tRef.current);if(!controller.signal.aborted)setRows(next);}
  catch{if(!controller.signal.aborted)setError(tRef.current('conx.p.errConsulta'));}
  finally{if(!controller.signal.aborted){pending.current=false;setBusy(false);}}
 },[request,invalidateRefresh]);
 useEffect(()=>{let mounted=true;void Promise.resolve().then(()=>{if(mounted)void load();});return()=>{mounted=false;active.current?.abort();invalidateRefresh();};},[load,invalidateRefresh]);
 // Datos nuevos: relectura en segundo plano; conserva las filas pintadas y no corre durante una carga o un guardado.
 useLayoutEffect(()=>{busyRef.current=busy;});
 const recargarSilencioso=useCallback(async()=>{
  if(busyRef.current||pending.current||sucio.current)return;
  invalidateRefresh();const generation=refreshGeneration.current,controller=new AbortController();refreshController.current=controller;
  try{const next=parse(await request(controller.signal),tRef.current);if(generation===refreshGeneration.current&&!controller.signal.aborted&&!busyRef.current&&!pending.current&&!sucio.current)setRows(next);}
  catch{/* se conserva lo pintado */}
  finally{if(refreshController.current===controller)refreshController.current=null;}
 },[request,invalidateRefresh]);
 useAutoRefresh(recargarSilencioso,{ocupado:()=>busyRef.current||sucio.current});
 const save=async(row:DeliveryPolicy)=>{
  if(busy||pending.current)return;invalidateRefresh();pending.current=true;active.current?.abort();const controller=new AbortController();active.current=controller;setBusy(true);setError('');setNotice('');
  try{
   const {version,...input}=row;const saved=await request(controller.signal,{...input,expectedVersion:version});const next=parse(await request(controller.signal),t);
   if(controller.signal.aborted)return;
   const actual=next.find(p=>p.channel===row.channel);if(!actual||actual.version!==saved.version||Object.entries(input).some(([k,v])=>actual[k as keyof DeliveryPolicy]!==v))throw Error(t('conx.p.errDurante'));
   sucio.current=false;setRows(next);setNotice(t('conx.p.guardada'));
  }catch{if(!controller.signal.aborted){setRows([]);setError(t('conx.p.errGuardado'));}}
  finally{if(!controller.signal.aborted){pending.current=false;setBusy(false);}}
 };
 const change=(channel:string,delta:Partial<DeliveryPolicy>)=>{invalidateRefresh();sucio.current=true;setRows(previous=>previous.map(row=>row.channel===channel?{...row,...delta}:row));};
 if(busy&&rows.length===0&&!error)return <RovaqCargando mensaje=""/>;
 return <section ref={heading} tabIndex={-1} className="task-page task-grid delivery-page" aria-label={t('conx.p.titulo')} aria-busy={busy}><PageHeader eyebrow={t('conx.p.eyebrow')} title={t('conx.p.titulo')} description={t('conx.p.desc')} actions={<Link prefetch={false} className="btn btn-ghost btn-sm" href="/settings/notifications">{t('conx.p.misPref')}</Link>}/>
  <p className="card-lead">{t('conx.p.lead')}</p>
  {busy&&<p role="status" className="sr-only">{t('conx.p.verificando')}</p>}{error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
  {rows.map(row=><form id={'delivery-policy-'+row.channel} key={row.channel} className="record-card" onSubmit={event=>event.preventDefault()}><fieldset disabled={busy}><legend>{canal(row.channel)}</legend>
   <label style={{display:'flex',alignItems:'center',gap:'.75rem',minHeight:44}}><input style={{width:'1.15rem',height:'1.15rem',padding:0,flexShrink:0}} type="checkbox" checked={row.enabled} onChange={event=>change(row.channel,{enabled:event.target.checked})}/>{t('conx.p.autorizar')}</label>
   <label>{t('conx.p.intervalo')}<input type="number" required min="1" max="86400" step="1" value={row.intervalMs/1000} onChange={event=>change(row.channel,{intervalMs:Number(event.target.value)*1000})}/><small>{t('conx.p.equivale',{d:duracionLegible(row.intervalMs,t)})}</small></label>
   <label>{t('conx.p.agrupar')}<input type="number" required min="0" max="3600" step="1" value={row.digestWindowMs/1000} onChange={event=>change(row.channel,{digestWindowMs:Number(event.target.value)*1000})}/><small>{row.digestWindowMs===0?t('conx.p.sinAgrupar'):t('conx.p.equivale',{d:duracionLegible(row.digestWindowMs,t)})}</small></label>
   <label>{t('conx.p.maxIntentos')}<input type="number" required min="1" max="10" step="1" value={row.maxAttempts} onChange={event=>change(row.channel,{maxAttempts:Number(event.target.value)})}/></label>
   <label>{t('conx.p.vigencia')}<input type="number" required min="1" max="2592000" step="1" value={row.lifetimeMs/1000} onChange={event=>change(row.channel,{lifetimeMs:Number(event.target.value)*1000})}/><small>{t('conx.p.equivale',{d:duracionLegible(row.lifetimeMs,t)})}</small></label>
   <div className="confirmation-actions"><ConfirmationDialog returnFocusRef={heading} triggerLabel={t('conx.p.guardar',{canal:canal(row.channel)})} title={t('conx.p.guardarTitulo',{canal:canal(row.channel)})} description={row.enabled?t('conx.p.descOn'):t('conx.p.descOff')} confirmLabel={t('conx.p.confirmarGuardado')} disabled={busy} onConfirm={()=>{const form=document.getElementById('delivery-policy-'+row.channel) as HTMLFormElement|null;if(form?.reportValidity())return save(row);}}/></div>
  </fieldset></form>)}
 </section>;
}
