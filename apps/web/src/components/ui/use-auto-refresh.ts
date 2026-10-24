'use client';
import {useEffect,useRef} from 'react';
/**
 * Actualización automática y silenciosa de una vista. ÚNICO origen: el vigilante invisible (workspace/datos-nuevos.tsx), que consulta /api/freshness
 * y dispara «vexa:refresh» cuando entra información nueva; además se revalida al volver a ver la pestaña tras estar oculta un rato.
 * No hace sondeos propios. `recargar` debe ser una lectura EN SEGUNDO PLANO: conserva lo pintado hasta que lleguen los datos nuevos (sin esqueletos,
 * sin vaciar tablas, sin saltos de layout). No se dispara mientras haya una acción del usuario en curso (`ocupado`) ni con la vista desactivada.
 * Antirrebote ~400 ms: varios avisos seguidos se funden en una sola lectura.
 */
export const ANTIRREBOTE_MS=400;
export const OCULTA_MIN_MS=60_000;
export function useAutoRefresh(recargar:()=>unknown,opciones:{ocupado?:()=>boolean;activo?:boolean;ocultaMinMs?:number}={}){
 const fn=useRef(recargar),ocupado=useRef(opciones.ocupado),activo=opciones.activo!==false,ocultaMin=opciones.ocultaMinMs??OCULTA_MIN_MS;
 useEffect(()=>{fn.current=recargar;ocupado.current=opciones.ocupado;});
 useEffect(()=>{
  if(!activo)return;
  let timer:ReturnType<typeof setTimeout>|null=null,ocultaDesde:number|null=null;
  const disparar=()=>{
   if(timer)clearTimeout(timer);
   timer=setTimeout(()=>{timer=null;if(ocupado.current?.())return;void Promise.resolve(fn.current()).catch(()=>{});},ANTIRREBOTE_MS);
  };
  const vis=()=>{
   if(document.visibilityState==='hidden'){ocultaDesde=Date.now();return;}
   const desde=ocultaDesde;ocultaDesde=null;
   if(desde!==null&&Date.now()-desde>=ocultaMin)disparar();
  };
  window.addEventListener('vexa:refresh',disparar);document.addEventListener('visibilitychange',vis);
  return()=>{if(timer)clearTimeout(timer);window.removeEventListener('vexa:refresh',disparar);document.removeEventListener('visibilitychange',vis);};
 },[activo,ocultaMin]);
}
