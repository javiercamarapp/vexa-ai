'use client';
import {VexaBrand} from './vexa-brand';
import {useEffect,useRef,useState} from 'react';
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
 const [access,setAccess]=useState<Access|null>(null),[busy,setBusy]=useState(true),[error,setError]=useState('');
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
  }).catch(()=>{if(active){setError('No pudimos completar el acceso. El enlace puede haber caducado o los permisos del espacio cambiaron. Vuelve a iniciar sesión.');setBusy(false);}});
  return()=>{active=false;};
 },[]);
 async function enter(tenant:string){
  if(busy)return;setBusy(true);setError('');
  try{await selectOrganization(tenant);openDestination('/overview');}
  catch{setAccess(null);setError('El acceso al espacio cambió o la sesión no está disponible. Vuelve a iniciar sesión.');setBusy(false);}
 }
 return <section className="home access-flow access-selection" aria-busy={busy}>
  <header className="access-brand"><VexaBrand/></header><p className="login-kicker">Bienvenido a Rovaq AI</p><h1>{busy?'Abriendo tu espacio':error?'Revisa tu acceso':'Tus espacios de trabajo'}</h1>
  {busy&&<p role="status">Comprobando tu acceso…</p>}{error&&<p role="alert">{error}</p>}
  {access&&access.organizations.length>1&&<div className="access-destination"><h2>Elige el espacio de cliente</h2><p>Cada espacio contiene sus propios datos y equipo. Puedes cambiarlo después desde el menú.</p>{access.organizations.map(org=><button className="access-organization-choice" key={org.id} disabled={busy} onClick={()=>enter(org.id)}>{org.name}<span aria-hidden="true">→</span></button>)}</div>}
  {access?.organizations.length===0&&<p>Tu sesión está iniciada, pero todavía no tienes acceso a un espacio. Si recibiste una invitación, abre su enlace para aceptarla.</p>}
  {access?.platformAccess&&!error&&<div className="access-destination access-platform"><h2>Administración de Rovaq AI</h2><p>Gestiona organizaciones y accesos de la plataforma.</p><a href="/platform">Abrir administración de Rovaq AI <span aria-hidden="true">↗</span></a></div>}
  <a className="access-back" href="/login">Volver al inicio de sesión</a>
 </section>;
}
