'use client';
import {RovaqCargando} from './rovaq-cargando';
import {RovaqLogo} from './rovaq-logo';
import {useEffect,useRef,useState} from 'react';
import {useT} from './i18n/proveedor';
import type {Clave} from '../lib/i18n';
import {tokensDeFragmento} from '../lib/auth-confirmacion';
type Organization={id:string;name:string};
type Access={organizations:Organization[];platformAccess:boolean};
async function selectOrganization(tenant:string){
 const form=new FormData();form.set('tenant_id',tenant);
 const response=await fetch('/auth/organization',{method:'POST',signal:AbortSignal.timeout(15000),body:form});
 if(!response.ok||new URL(response.url).origin!==window.location.origin||!['/','/overview'].includes(new URL(response.url).pathname))throw new Error('selection_failed');
}
function openDestination(path:'/overview'|'/platform'){
 // Fresh session cookies require discarding the pre-login Router cache.
 window.location.assign(path);
}
export function EmailLoginComplete(){
 const t=useT();
 const [access,setAccess]=useState<Access|null>(null),[busy,setBusy]=useState(true),[error,setError]=useState<Clave|''>('');
 const establishment=useRef<Promise<Access>|null>(null);
 const leido=useRef<ReturnType<typeof tokensDeFragmento>|undefined>(undefined);
 const [pendiente,setPendiente]=useState<{accessToken:string;refreshToken:string;correo:string|null}|null>(null);
 // R2-07: al abrir el enlace NO se instala ninguna sesión. Se leen los tokens del fragmento (y se borran de la URL) y se pide confirmar «Entrar como <correo>».
 useEffect(()=>{
  let active=true;
  // El modo estricto de React ejecuta el efecto dos veces: la primera lectura (que además borra el fragmento de la URL) se conserva en la referencia.
  if(leido.current===undefined){leido.current=tokensDeFragmento(location.hash);history.replaceState(null,'',location.pathname);}
  const leidos=leido.current;
  if(!leidos||leidos.conError||!leidos.accessToken){setError('tr.login.errCompletar');setBusy(false);}
  else if(active&&!establishment.current){setPendiente({accessToken:leidos.accessToken,refreshToken:leidos.refreshToken,correo:leidos.correo});setBusy(false);}
  return()=>{active=false;};
 },[]); // eslint-disable-line react-hooks/exhaustive-deps
 function establecer(accessToken:string,refreshToken:string){
  setBusy(true);setError('');
  establishment.current=(async()=>{
   const response=await fetch('/auth/email/session',{method:'POST',signal:AbortSignal.timeout(15000),headers:{'content-type':'application/json'},body:JSON.stringify({accessToken,refreshToken})});
   const result=await response.json();if(!response.ok||!Array.isArray(result.organizations))throw new Error();
   const next:Access={organizations:result.organizations,platformAccess:result.platformAccess===true};
   if(next.organizations.length===1)await selectOrganization(next.organizations[0].id);
   return next;
  })();
  establishment.current.then(next=>{
   if(next.organizations.length===1){openDestination('/overview');return;}
   if(next.organizations.length===0&&next.platformAccess){openDestination('/platform');return;}
   setAccess(next);setBusy(false);
  }).catch(()=>{setError('tr.login.errCompletar');setBusy(false);});
 }
 async function confirmar(){if(!pendiente||busy)return;const p=pendiente;setPendiente(null);establecer(p.accessToken,p.refreshToken);}
 async function enter(tenant:string){
  if(busy)return;setBusy(true);setError('');
  try{await selectOrganization(tenant);openDestination('/overview');}
  catch{setAccess(null);setError('tr.login.errCambio');setBusy(false);}
 }
 return <section className="home access-flow access-selection" aria-busy={busy}>
  <header className="access-brand"><RovaqLogo variante="horizontal" ancho={132} espacioLibre={false}/></header><p className="login-kicker">{t('tr.login.bienvenida')}</p><h1>{busy?t('tr.login.abriendo'):error?t('tr.login.revisa'):pendiente?t('tr.login.bienvenida'):t('tr.login.espacios')}</h1>
  {pendiente&&<div className="access-destination"><h2>{t('tr.login.confirmaTitulo')}</h2><p>{t('tr.login.confirmaCuerpo')}</p><button type="button" disabled={busy} onClick={confirmar}>{t('tr.login.confirmaEntrar',{correo:pendiente.correo??'…'})}</button> <a className="access-back" href="/login">{t('tr.login.confirmaCancelar')}</a></div>}
  {busy&&<RovaqCargando compacto mensaje={t('tr.login.comprobando')}/>}{error&&<p role="alert">{t(error)}</p>}
  {access&&access.organizations.length>1&&<div className="access-destination"><h2>{t('tr.login.elige')}</h2><p>{t('tr.login.eligeCuerpo')}</p>{access.organizations.map(org=><button className="access-organization-choice" key={org.id} disabled={busy} onClick={()=>enter(org.id)}>{org.name}<span aria-hidden="true">→</span></button>)}</div>}
  {access?.organizations.length===0&&<p>{t('tr.login.sinEspacio')}</p>}
  {access?.platformAccess&&!error&&<div className="access-destination access-platform"><h2>{t('shell.admin')}</h2><p>{t('tr.login.adminCuerpo')}</p><a href="/platform">{t('tr.login.abrirAdmin')} <span aria-hidden="true">↗</span></a></div>}
  <a className="access-back" href="/login">{t('tr.login.volver')}</a>
 </section>;
}
