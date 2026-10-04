 'use client';
import {VexaBrand} from './vexa-brand';
import {FormEvent,useEffect,useRef,useState} from 'react';
export function EmailLogin({enabled=true}:{enabled?:boolean}){const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[remaining,setRemaining]=useState(0);const active=useRef(true),inFlight=useRef(false);
useEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
useEffect(()=>{if(remaining<=0)return;const timer=setTimeout(()=>setRemaining(remaining-1),1000);return()=>clearTimeout(timer);},[remaining]);
async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();if(!enabled||inFlight.current||remaining>0)return;inFlight.current=true;setBusy(true);setMessage('');const email=new FormData(event.currentTarget).get('email');try{const response=await fetch('/auth/email/request',{method:'POST',signal:AbortSignal.timeout(15000),headers:{'content-type':'application/json'},body:JSON.stringify({email})});if(active.current)setMessage(response.status===202?'Si la cuenta existe, intentaremos enviar un enlace. Revisa tu bandeja de entrada y correo no deseado antes de solicitar otro.':'No se pudo solicitar el acceso. Verifica el correo y la configuración del servicio.');}catch{if(active.current)setMessage('No se pudo confirmar la solicitud. Revisa tu correo antes de solicitar otro enlace.');}finally{inFlight.current=false;if(active.current){setBusy(false);setRemaining(60);}}}
return <form className="login-email login-entra" onSubmit={submit} aria-busy={busy} aria-label="Acceder por correo">
<label className="sr-only" htmlFor="email-login-address">Correo</label>
<input className="login-campo" id="email-login-address" name="email" type="email" placeholder="tu@empresa.com" autoComplete="email" required maxLength={254} disabled={!enabled||busy} aria-describedby={!enabled?'email-availability':undefined}/>
<button className="login-btn login-btn-tinta" aria-busy={busy} disabled={!enabled||busy||remaining>0}><span className="login-glifo" aria-hidden="true"><VexaBrand/></span><span>{busy?'Solicitando…':remaining>0?`Reintentar en ${remaining} s`:'Continuar con correo'}</span></button>
{!enabled&&<p id="email-availability" className="login-hint">Acceso por correo: pendiente de configurar.</p>}
<p className="login-message login-email-status" role="status">{message}</p></form>;}
