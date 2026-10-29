'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {useT} from '../i18n/proveedor';
import type {BrechasVista} from '../../../../../packages/workspace-service/brechas.mjs';
/** GET /api/gaps con cronómetro (para el esqueleto «Calculando… N s»). Un 403 o 503 se dice en español; jamás se muestra un 0 por un fallo. */
export function useGaps(endpoint:string|null='/api/gaps'){
 const t=useT();
 const [data,setData]=useState<BrechasVista|null>(null),[err,setErr]=useState<{code:'acceso'|'red'|'forma'}|null>(null),[busy,setBusy]=useState(Boolean(endpoint)),[segundos,setSegundos]=useState(0);
 const tick=useRef<ReturnType<typeof setInterval>|null>(null);
 const load=useCallback(async(signal?:AbortSignal)=>{
  if(!endpoint)return;setBusy(true);setErr(null);setSegundos(0);
  const t0=Date.now();if(tick.current)clearInterval(tick.current);tick.current=setInterval(()=>setSegundos(Math.floor((Date.now()-t0)/1000)),1000);
  try{
   const r=await fetch(endpoint,{cache:'no-store',signal});
   if(r.status===403||r.status===401)throw Object.assign(Error('acceso'),{code:'acceso'});
   if(!r.ok)throw Object.assign(Error('red'),{code:'red'});
   const j=await r.json() as {data?:BrechasVista};
   if(!j?.data||typeof j.data!=='object'||!('ingresos' in j.data))throw Object.assign(Error('forma'),{code:'forma'});
   if(!signal?.aborted)setData(j.data);
  }catch(e){
   if(signal?.aborted)return;
   const code=(e as {code?:string}).code;
   setData(null);setErr(code==='acceso'?{code:'acceso'}:{code:code==='forma'?'forma':'red'});
  }finally{if(tick.current){clearInterval(tick.current);tick.current=null;}if(!signal?.aborted)setBusy(false);}
 },[endpoint]);
 useEffect(()=>{const c=new AbortController();void Promise.resolve().then(()=>load(c.signal));const again=()=>void load();window.addEventListener('vexa:refresh',again);return()=>{c.abort();window.removeEventListener('vexa:refresh',again);if(tick.current)clearInterval(tick.current);};},[load]);
 const error=err?{code:err.code,texto:err.code==='acceso'?t('vista.errAcceso'):t('tr.brecha.errRed')}:null;
 return {data,error,busy,segundos,reload:()=>load()};
}
