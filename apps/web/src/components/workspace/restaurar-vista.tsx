'use client';
import {useEffect} from 'react';
import {usePathname} from 'next/navigation';
import {guardarVista,leerVista} from '../../lib/workspace/cache.mjs';
/** Posición de desplazamiento por pantalla: al volver, se restaura cuando el contenido (pintado desde la caché) ya la permite; si la persona se mueve antes, se respeta. */
export function RestaurarVista(){
 const pathname=usePathname();
 useEffect(()=>{
  const clave='scroll:'+pathname,previo=leerVista(clave) as {y?:number}|null,destino=previo?.y??0;
  let cancelado=false,tocado=false,intentos=0,timer:ReturnType<typeof setTimeout>|undefined,ultimo=0;
  const alUsuario=()=>{tocado=true;};
  const intentar=()=>{if(cancelado||tocado||!destino)return;const max=document.documentElement.scrollHeight-window.innerHeight;if(max>=destino-2||intentos>60){window.scrollTo(0,Math.min(destino,Math.max(0,max)));return;}intentos++;timer=setTimeout(intentar,50);};
  if(destino>0&&!window.location.hash)intentar();
  const inicio=Date.now();
  // Los primeros 600 ms no se guarda nada: el propio cambio de ruta reinicia el desplazamiento y no es lo que hizo la persona.
  const guardar=()=>{const t=Date.now();if(t-inicio<600||t-ultimo<100)return;ultimo=t;guardarVista(clave,{y:Math.round(window.scrollY)});};
  const fin=()=>guardarVista(clave,{y:Math.round(window.scrollY)});
  window.addEventListener('scroll',guardar,{passive:true});window.addEventListener('wheel',alUsuario,{passive:true});window.addEventListener('touchstart',alUsuario,{passive:true});window.addEventListener('keydown',alUsuario);window.addEventListener('pagehide',fin);
  return()=>{cancelado=true;clearTimeout(timer);window.removeEventListener('scroll',guardar);window.removeEventListener('wheel',alUsuario);window.removeEventListener('touchstart',alUsuario);window.removeEventListener('keydown',alUsuario);window.removeEventListener('pagehide',fin);};
 },[pathname]);
 return null;
}
