'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
/** GET a JSON endpoint, validate its shape, expose busy/error and reload (also on the global «vexa:refresh» event). */
export function useJson<T>(endpoint:string|null,accept:(json:unknown)=>T|null){
 const keep=useRef(accept);useEffect(()=>{keep.current=accept;});
 const [data,setData]=useState<T|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(Boolean(endpoint)),[status,setStatus]=useState(0);
 const load=useCallback(async(signal?:AbortSignal)=>{
  if(!endpoint)return;setBusy(true);setError('');
  try{const r=await fetch(endpoint,{cache:'no-store',signal});setStatus(r.status);if(!r.ok)throw Error(String(r.status));const j=await r.json();const v=keep.current(j);if(v===null)throw Error('shape');if(!signal?.aborted)setData(v);}
  catch{if(!signal?.aborted){setData(null);setError('No se pudo consultar. Reintenta.');}}
  finally{if(!signal?.aborted)setBusy(false);}
 },[endpoint]);
 useEffect(()=>{const c=new AbortController();void Promise.resolve().then(()=>load(c.signal));const again=()=>void load();window.addEventListener('vexa:refresh',again);return()=>{c.abort();window.removeEventListener('vexa:refresh',again);};},[load]);
 return {data,error,busy,status,reload:()=>load()};
}
