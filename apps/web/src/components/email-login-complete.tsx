'use client';
import {RovaqCargando} from './rovaq-cargando';
import {RovaqLogo} from './rovaq-logo';
import {useEffect,useRef,useState} from 'react';
import {useT} from './i18n/proveedor';
import type {Clave} from '../lib/i18n';
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
 useEffect(()=>{
  let active=true;
  if(!establishment.current){
   const fragment=new URLSearchParams(location.hash.slice(1));history.replaceState(null,'',location.pathname);
   establishment.current=(async()=>{
    const accessToken=fragment.get('access_token'),refreshToken=fragment.get('refresh_token');
    if(!accessToken||!refreshToken||fragment.has('error'))throw new Error();
    const response=await fetch('/auth/email/session',{method:'POST',signal:AbortSignal.timeout(15000),headers:{'content-type':'application/json'},body:JSON.stringify({accessToken,refreshToken})});
    const result=await response.json();if(!response.ok||!Array.isArray(result.organizations))throw new Error();
    const next:Access={organizations:result.organizations,platformAccess:result.platformAccess===true};
    if(next.organizations.length===1)await selectOrganization(next.organizations[0].id);
    return next;
   })();
  }
  establishment.current.then(next=>{
   if(!active)return;
   if(next.organizations.length===1){openDestination('/overview');return;}
   if(next.organizations.length===0&&next.platformAccess){openDestination('/platform');return;}
   setAccess(next);setBusy(false);
  }).catch(()=>{if(active){setError('tr.login.errCompletar');setBusy(false);}});
  return()=>{active=false;};
 },[]);
 async function enter(tenant:string){
  if(busy)return;setBusy(true);setError('');
  try{await selectOrganization(tenant);openDestination('/overview');}
  catch{setAccess(null);setError('tr.login.errCambio');setBusy(false);}
 }
 return <section className="home access-flow access-selection" aria-busy={busy}>
  <header className="access-brand"><RovaqLogo variante="horizontal" ancho={132} espacioLibre={false}/></header><p className="login-kicker">{t('tr.login.bienvenida')}</p><h1>{busy?t('tr.login.abriendo'):error?t('tr.login.revisa'):t('tr.login.espacios')}</h1>
  {busy&&<RovaqCargando compacto mensaje={t('tr.login.comprobando')}/>}{error&&<p role="alert">{t(error)}</p>}
  {access&&access.organizations.length>1&&<div className="access-destination"><h2>{t('tr.login.elige')}</h2><p>{t('tr.login.eligeCuerpo')}</p>{access.organizations.map(org=><button className="access-organization-choice" key={org.id} disabled={busy} onClick={()=>enter(org.id)}>{org.name}<span aria-hidden="true">→</span></button>)}</div>}
  {access?.organizations.length===0&&<p>{t('tr.login.sinEspacio')}</p>}
  {access?.platformAccess&&!error&&<div className="access-destination access-platform"><h2>{t('shell.admin')}</h2><p>{t('tr.login.adminCuerpo')}</p><a href="/platform">{t('tr.login.abrirAdmin')} <span aria-hidden="true">↗</span></a></div>}
  <a className="access-back" href="/login">{t('tr.login.volver')}</a>
 </section>;
}
