'use client';
import {useEffect,useRef,useState} from 'react';
import {crearVigilante,type CambioDatos} from '../../lib/workspace/vivos.mjs';
import {invalidarSwr} from '../../lib/workspace/swr.mjs';
import './datos-nuevos.css';
const AUTO_KEY='vexa-datos-auto';
/**
 * Píldora discreta «Datos nuevos · actualizar». Vigila la marca ligera /api/freshness (cada 30 s, con retroceso, solo con la pestaña visible); al cambiar,
 * avisa y, al pulsar, marca la caché SWR como obsoleta y dispara «vexa:refresh» (cada vista revalida en segundo plano y conserva lo pintado mientras tanto).
 * Por omisión actualiza sola, sin avisar ni mostrar nada en el encabezado; con localStorage 'vexa-datos-auto'='false' muestra la píldora. No hace ninguna otra petición.
 */
export function DatosNuevos(){
 const [nuevo,setNuevo]=useState<CambioDatos|null>(null);
 const vig=useRef<ReturnType<typeof crearVigilante>|null>(null);
 useEffect(()=>{
  const aplicar=()=>{invalidarSwr({});window.dispatchEvent(new Event('vexa:refresh'));vig.current?.reconocer();setNuevo(null);};
  const auto=()=>{try{return window.localStorage.getItem(AUTO_KEY)!=='false';}catch{return true;}}; // por omisión se actualiza sola, sin botón ni aviso; 'false' vuelve a mostrar la píldora
  const v=crearVigilante({visible:()=>document.visibilityState==='visible',onCambio:e=>{if(auto())aplicar();else setNuevo(e);}});
  vig.current=v;v.iniciar();
  const vis=()=>v.visibilidad();document.addEventListener('visibilitychange',vis);
  return()=>{document.removeEventListener('visibilitychange',vis);v.detener();vig.current=null;};
 },[]);
 if(!nuevo)return null;
 const cuales=nuevo.fuentes.length?` (${nuevo.fuentes.length} ${nuevo.fuentes.length===1?'fuente':'fuentes'})`:'';
 return <button type="button" className="datos-nuevos" data-testid="datos-nuevos" title={'Llegaron datos nuevos'+cuales+'. Se actualizan en segundo plano sin perder lo que ves.'}
  onClick={()=>{invalidarSwr({});window.dispatchEvent(new Event('vexa:refresh'));vig.current?.reconocer();setNuevo(null);}}>
  <span className="datos-nuevos-punto" aria-hidden="true"/>Datos nuevos · actualizar
 </button>;
}
