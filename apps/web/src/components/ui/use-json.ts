'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
/** GET a JSON endpoint, validate its shape, expose busy/error and reload (also on the global «vexa:refresh» event). */
export function useJson<T>(endpoint:string|null,accept:(json:unknown)=>T|null){
 const keep=useRef(accept);useEffect(()=>{keep.current=accept;});
 const [data,setData]=useState<T|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(Boolean(endpoint)),[status,setStatus]=useState(0);
 const load=useCallback(async(signal?:AbortSignal)=>{
  if(!endpoint)return;setBusy(true);setError('');
  // Un reintento automático tras una pausa si falla la red o el servidor (R2-3-001: «Failed to fetch» tras la redirección de /login); 4xx no se reintenta.
  const intento=async()=>{const r=await fetch(endpoint,{cache:'no-store',signal});setStatus(r.status);if(!r.ok)throw Object.assign(Error(String(r.status)),{estado:r.status});const j=await r.json();const v=keep.current(j);if(v===null)throw Error('shape');return v;};
  try{let v:T;try{v=await intento();}catch(e){const st=(e as {estado?:number}).estado;if(signal?.aborted||(st!==undefined&&st<500))throw e;await new Promise(res=>setTimeout(res,1500));if(signal?.aborted)throw e;v=await intento();}if(!signal?.aborted)setData(v);}
  catch(e){if(!signal?.aborted){setData(null);setError(e instanceof TypeError?'No se pudo conectar con el servicio. Pulsa Actualizar para reintentar.':'No se pudo consultar. Reintenta.');}}
  finally{if(!signal?.aborted)setBusy(false);}
 },[endpoint]);
 useEffect(()=>{const c=new AbortController();void Promise.resolve().then(()=>load(c.signal));const again=()=>void load();window.addEventListener('vexa:refresh',again);return()=>{c.abort();window.removeEventListener('vexa:refresh',again);};},[load]);
 return {data,error,busy,status,reload:()=>load()};
}
