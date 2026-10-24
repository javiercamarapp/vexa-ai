'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {fetchCupo} from '../../lib/workspace/cupo.mjs';
import {debeReintentar,elegirDato,ESPERA_REINTENTO_MS} from '../../lib/workspace/reintento-vista.mjs';
const dormir=(ms:number,signal?:AbortSignal)=>new Promise<void>(res=>{const t=setTimeout(res,ms);signal?.addEventListener('abort',()=>{clearTimeout(t);res();},{once:true});});
/** GET de una vista de solo lectura con cronómetro (esqueleto «Calculando… N s»). 403/401 y fallos se dicen en español; jamás se muestra un 0 por un fallo.
 *  Resiliencia (auditoría 24-oct, A3): un fallo del servidor/red en la 1.ª carga se reintenta UNA vez en silencio antes de mostrar error, y si la respuesta llega con
 *  partes «unavailable» (consulta acotada que excedió su tiempo) se reintenta UNA vez en segundo plano, sin spinner: lo bueno ya pintado no se pierde. */
export function useVista<T>(endpoint:string,forma:(d:unknown)=>boolean){
 const [data,setData]=useState<T|null>(null),[error,setError]=useState<{code:'acceso'|'red'|'forma';texto:string}|null>(null),[busy,setBusy]=useState(true),[segundos,setSegundos]=useState(0);
 const tick=useRef<ReturnType<typeof setInterval>|null>(null),actual=useRef<T|null>(null);
 const pedir=useCallback(async(signal?:AbortSignal)=>{
  const r=await fetchCupo(endpoint,{cache:'no-store',signal});
  if(r.status===403||r.status===401)throw Object.assign(Error('acceso'),{code:'acceso'});
  if(!r.ok)throw Object.assign(Error('red'),{code:'red'});
  const j=await r.json() as {data?:unknown};
  if(!j?.data||typeof j.data!=='object'||!forma(j.data))throw Object.assign(Error('forma'),{code:'forma'});
  return j.data as T;
 },[endpoint,forma]);
 const load=useCallback(async(signal?:AbortSignal)=>{
  setBusy(true);setError(null);setSegundos(0);
  const t0=Date.now();if(tick.current)clearInterval(tick.current);tick.current=setInterval(()=>setSegundos(Math.floor((Date.now()-t0)/1000)),1000);
  let pintado:T|null=null;
  try{
   try{pintado=await pedir(signal);}
   catch(e){const code=(e as {code?:string}).code;if(signal?.aborted||code==='acceso'||code==='forma')throw e;await dormir(1500,signal);if(signal?.aborted)return;pintado=await pedir(signal);}
   if(signal?.aborted)return;
   actual.current=pintado;setData(pintado);
  }catch(e){
   if(signal?.aborted)return;
   const code=(e as {code?:string}).code;
   actual.current=null;setData(null);setError(code==='acceso'?{code:'acceso',texto:'Tu rol no tiene acceso a este panel. Lo ven propietarios y analistas.'}:{code:code==='forma'?'forma':'red',texto:'No disponible ahora. No significa que no haya casos: reintenta en un momento.'});
  }finally{if(tick.current){clearInterval(tick.current);tick.current=null;}if(!signal?.aborted)setBusy(false);}
  // Segundo intento en segundo plano si alguna parte llegó caída: sin spinner ni mensaje; solo reemplaza si no es peor.
  if(pintado&&!signal?.aborted&&debeReintentar(pintado,0)){
   await dormir(ESPERA_REINTENTO_MS,signal);if(signal?.aborted)return;
   try{const nuevo=await pedir(signal);if(!signal?.aborted){const elegido=elegirDato(actual.current,nuevo);actual.current=elegido;setData(elegido);}}catch{/* se queda lo ya pintado */}
  }
 },[pedir]);
 useEffect(()=>{const c=new AbortController();void Promise.resolve().then(()=>load(c.signal));const again=()=>void load();window.addEventListener('vexa:refresh',again);return()=>{c.abort();window.removeEventListener('vexa:refresh',again);if(tick.current)clearInterval(tick.current);};},[load]);
 return {data,error,busy,segundos,reload:()=>load()};
}
