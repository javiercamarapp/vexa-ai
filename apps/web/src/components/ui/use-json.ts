'use client';
import {useCallback,useEffect,useLayoutEffect,useRef,useState} from 'react';
import {claveSwr,leerSwr,pedirSwr,invalidarSwr} from '../../lib/workspace/swr.mjs';
// Antes de pintar (sin avisos de hidratación en el servidor): la primera lectura sale de la caché si la hay.
const useAntesDePintar=typeof window==='undefined'?useEffect:useLayoutEffect;
/**
 * GET de un endpoint JSON con caché «stale-while-revalidate» (swr.mjs): si ya se leyó en esta sesión, el último dato bueno se pinta al instante
 * (`edadMs` dice su antigüedad) y se revalida en segundo plano sin vaciar la pantalla; si la revalidación falla, el dato viejo se conserva
 * (`viejo`) y NO se reemplaza por un error. `error` solo se llena cuando no hay nada que mostrar. «vexa:refresh» y reload() fuerzan la lectura.
 */
export function useJson<T>(endpoint:string|null,accept:(json:unknown)=>T|null){
 const keep=useRef(accept);useEffect(()=>{keep.current=accept;});
 const [data,setData]=useState<T|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(Boolean(endpoint)),[status,setStatus]=useState(0),[edadMs,setEdadMs]=useState<number|null>(null),[viejo,setViejo]=useState(false);
 const tiene=useRef(false);
 const load=useCallback(async(signal?:AbortSignal,forzar=false)=>{
  if(!endpoint)return;
  const g=forzar?null:leerSwr(claveSwr(endpoint)),guardado=g?keep.current(g.datos):null;
  // Dato de caché aunque sea viejo: se pinta ya. Si además está fresco (≤5 min) no se vuelve a pedir.
  const previo=guardado!==null?{v:guardado,edad:g!.edadMs,fresca:g!.fresca}:null;
  if(previo){tiene.current=true;setData(previo.v);setEdadMs(previo.edad);setStatus(200);setViejo(false);setError('');if(previo.fresca){setBusy(false);return;}}
  setBusy(true);if(!previo)setError('');
  // Un reintento automático tras una pausa si falla la red o el servidor (R2-3-001: «Failed to fetch» tras la redirección de /login); 4xx no se reintenta.
  const intento=async()=>{const r=await pedirSwr(endpoint,{signal,valida:keep.current});setStatus(r.status);if(r.status<200||r.status>=300)throw Object.assign(Error(String(r.status)),{estado:r.status});const v=keep.current(r.json);if(v===null)throw Error('shape');return v;};
  try{let v:T;try{v=await intento();}catch(e){const st=(e as {estado?:number}).estado;if(signal?.aborted||(st!==undefined&&st<500))throw e;await new Promise(res=>setTimeout(res,1500));if(signal?.aborted)throw e;v=await intento();}
   if(!signal?.aborted){tiene.current=true;setData(v);setEdadMs(null);setViejo(false);setError('');}}
  catch(e){if(!signal?.aborted){
   // Sin dato viejo que conservar: error. Con dato viejo: se queda, rotulado, y se avisa que no se pudo actualizar.
   if(tiene.current||previo){setViejo(true);setError('');}
   else{setData(null);tiene.current=false;setError(e instanceof TypeError?'No se pudo conectar con el servicio. Pulsa Actualizar para reintentar.':'No se pudo consultar. Reintenta.');}}}
  finally{if(!signal?.aborted)setBusy(false);}
 },[endpoint]);
 // Al cambiar de endpoint (otro alcance) lo que había era de otro alcance: no se arrastra.
 useAntesDePintar(()=>{tiene.current=false;if(!endpoint){setData(null);setEdadMs(null);setViejo(false);return;}
  const g=leerSwr(claveSwr(endpoint)),v=g?keep.current(g.datos):null;
  if(g&&v!==null){tiene.current=true;setData(v);setEdadMs(g.edadMs);setStatus(200);setBusy(!g.fresca);}else{setData(null);setEdadMs(null);}
  setViejo(false);},[endpoint]);
 useEffect(()=>{const c=new AbortController();void Promise.resolve().then(()=>load(c.signal));const again=()=>{if(endpoint)invalidarSwr({prefijo:endpoint.split('?')[0]});void load(undefined,true);};window.addEventListener('vexa:refresh',again);return()=>{c.abort();window.removeEventListener('vexa:refresh',again);};},[load,endpoint]);
 return {data,error,busy,status,edadMs,viejo,actualizando:busy&&edadMs!==null,reload:()=>load(undefined,true)};
}
