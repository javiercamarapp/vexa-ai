'use client';
import {useEffect,useState} from 'react';
import {esErrorDeChunk,recargarSiChunk} from '../../lib/chunks/recuperacion.mjs';
/** Para los error boundaries: si el error es un ChunkLoadError recarga la página una vez (guarda en sessionStorage).
 *  `reintentar` hace recarga completa en ese caso (un reset de React no vuelve a pedir el chunk) y reset() en los demás. */
export function useRecuperacionChunk(error:unknown,reset:()=>void){
 const chunk=esErrorDeChunk(error);
 const [recargando,setRecargando]=useState(false);
 useEffect(()=>{
  if(!chunk)return;
  let storage:Storage|null=null;try{storage=window.sessionStorage;}catch{storage=null;}
  if(recargarSiChunk(error,{storage,recargar:()=>window.location.reload()}))void Promise.resolve().then(()=>setRecargando(true));
 },[chunk,error]);
 const reintentar=()=>{if(chunk)window.location.reload();else reset();};
 return {chunk,recargando,reintentar};
}
