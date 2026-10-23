'use client';
import {useEffect,useRef} from 'react';
import {crearVigilante} from '../../lib/workspace/vivos.mjs';
import {invalidarSwr} from '../../lib/workspace/swr.mjs';
/**
 * Vigilante invisible de datos nuevos. Vigila la marca ligera /api/freshness (cada 30 s, con retroceso, solo con la pestaña visible); al cambiar,
 * marca la caché SWR como obsoleta y dispara «vexa:refresh» (cada vista revalida en segundo plano y conserva lo pintado mientras tanto). No muestra nada.
 * No hace ninguna otra petición.
 */
export function DatosNuevos(){
 const vig=useRef<ReturnType<typeof crearVigilante>|null>(null);
 useEffect(()=>{
  // Cuando llega información nueva el software se actualiza solo y en segundo plano: no hay botón ni aviso en ninguna pantalla.
  const aplicar=()=>{invalidarSwr({});window.dispatchEvent(new Event('vexa:refresh'));vig.current?.reconocer();};
  const v=crearVigilante({visible:()=>document.visibilityState==='visible',onCambio:aplicar});
  vig.current=v;v.iniciar();
  const vis=()=>v.visibilidad();document.addEventListener('visibilitychange',vis);
  return()=>{document.removeEventListener('visibilitychange',vis);v.detener();vig.current=null;};
 },[]);
 return null;
}
