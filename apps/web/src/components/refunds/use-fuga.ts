'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import type {FugaVista} from '../../../../../packages/workspace-service/fuga-reembolsos.mjs';
/** Endpoint de /api/refunds con SOLO el periodo del alcance (date_start/date_end válidos); sin periodo = todo el libro. */
export function endpointFuga(raw:string|URLSearchParams|null|undefined){
 const q=new URLSearchParams(typeof raw==='string'?raw:raw?.toString()??''),out=new URLSearchParams();
 const ok=(v:string|null)=>v&&/^\d{4}-\d{2}-\d{2}/.test(v)?v.slice(0,10):null;
 const a=ok(q.get('date_start')),b=ok(q.get('date_end'));
 if(a&&b&&a<b){out.set('date_start',a);out.set('date_end',b);}
 const s=out.toString();return '/api/refunds'+(s?'?'+s:'');
}
/** GET /api/refunds con cronómetro (para el esqueleto «Calculando… N s»). Un 403 o 503 se dice en español; jamás se muestra un 0 por un fallo. */
export function useFuga(endpoint:string|null='/api/refunds'){
 const [data,setData]=useState<FugaVista|null>(null),[error,setError]=useState<{code:'acceso'|'red'|'forma';texto:string}|null>(null),[busy,setBusy]=useState(Boolean(endpoint)),[segundos,setSegundos]=useState(0);
 const tick=useRef<ReturnType<typeof setInterval>|null>(null);
 const load=useCallback(async(signal?:AbortSignal)=>{
  if(!endpoint)return;setBusy(true);setError(null);setSegundos(0);
  const t0=Date.now();if(tick.current)clearInterval(tick.current);tick.current=setInterval(()=>setSegundos(Math.floor((Date.now()-t0)/1000)),1000);
  try{
   const r=await fetch(endpoint,{cache:'no-store',signal});
   if(r.status===403||r.status===401)throw Object.assign(Error('acceso'),{code:'acceso'});
   if(!r.ok)throw Object.assign(Error('red'),{code:'red'});
   const j=await r.json() as {data?:FugaVista};
   if(!j?.data||typeof j.data!=='object'||!('titular' in j.data))throw Object.assign(Error('forma'),{code:'forma'});
   if(!signal?.aborted)setData(j.data);
  }catch(e){
   if(signal?.aborted)return;
   const code=(e as {code?:string}).code;
   setData(null);setError(code==='acceso'?{code:'acceso',texto:'Tu rol no tiene acceso a este panel. Lo ven propietarios y analistas.'}:{code:code==='forma'?'forma':'red',texto:'No disponible ahora. No significa que no haya reembolsos: reintenta en un momento.'});
  }finally{if(tick.current){clearInterval(tick.current);tick.current=null;}if(!signal?.aborted)setBusy(false);}
 },[endpoint]);
 useEffect(()=>{const c=new AbortController();void Promise.resolve().then(()=>load(c.signal));const again=()=>void load();window.addEventListener('vexa:refresh',again);return()=>{c.abort();window.removeEventListener('vexa:refresh',again);if(tick.current)clearInterval(tick.current);};},[load]);
 return {data,error,busy,segundos,reload:()=>load()};
}
