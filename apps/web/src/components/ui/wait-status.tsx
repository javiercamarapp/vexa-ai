'use client';
import {useEffect,useState} from 'react';
import {RovaqCargando} from '../rovaq-cargando';
/** Segundos transcurridos desde que se montó (la espera sólo existe mientras el componente está en pantalla). */
export function useElapsed(){
 const [s,setS]=useState(0);
 useEffect(()=>{const t0=Date.now();const id=window.setInterval(()=>setS(Math.floor((Date.now()-t0)/1000)),1000);return()=>window.clearInterval(id);},[]);
 return s;
}
/** Espera larga: solo el logo animado (sin texto visible). El título se conserva como etiqueta para lectores de pantalla; `detalle` y `children` ya no se muestran. */
export function WaitStatus({titulo}:{titulo:string;detalle?:string;children?:React.ReactNode}){
 return <RovaqCargando mensaje={titulo}/>;
}

/** Una lectura en vuelo: solo el logo animado (sin texto visible; `que` va como etiqueta para lectores de pantalla). */
export function EsperaEsqueleto({que}:{que:string;filas?:number}){
 return <RovaqCargando compacto mensaje={'Cargando '+que}/>;
}
/** Cifra en vuelo dentro de una tarjeta o franja (no es un cero ni un «No disponible»): hueco discreto sin texto, solo para lectores de pantalla. */
export function CifraCargando({ancho='5ch'}:{ancho?:string}){return <span className="skeleton skel-inline" style={{width:ancho}} role="status" aria-busy="true"><span className="sr-only">Cargando</span></span>;}
