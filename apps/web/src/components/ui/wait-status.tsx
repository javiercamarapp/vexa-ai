'use client';
import {useEffect,useState} from 'react';
import {tiempoTranscurrido} from '../../lib/legibilidad/espera.mjs';
/** Segundos transcurridos desde que se montó (la espera sólo existe mientras el componente está en pantalla). */
export function useElapsed(){
 const [s,setS]=useState(0);
 useEffect(()=>{const t0=Date.now();const id=window.setInterval(()=>setS(Math.floor((Date.now()-t0)/1000)),1000);return()=>window.clearInterval(id);},[]);
 return s;
}
/** Espera larga honesta: qué se está verificando, que puede tardar y cuánto lleva. No promete una duración exacta.
 *  El mensaje se anuncia una vez (role=status, aria-live polite); el tiempo visible no se anuncia cada segundo, sólo cada 30 s. */
export function WaitStatus({titulo,detalle,children}:{titulo:string;detalle:string;children?:React.ReactNode}){
 const s=useElapsed(),anuncio=Math.floor(s/30)*30;
 return <div className="wait-status" role="status" aria-live="polite" aria-busy="true">
  <span className="wait-bar" aria-hidden="true"><span/></span>
  <div className="wait-text"><strong>{titulo}</strong><p>{detalle}</p>{children}</div>
  <span className="wait-elapsed" aria-hidden="true">Llevamos {tiempoTranscurrido(s)}</span>
  <span className="sr-only">{anuncio>0?`Sigue verificando: ${tiempoTranscurrido(anuncio)} transcurridos.`:''}</span>
 </div>;
}
