'use client';
import './fuga.css';
/** Esqueleto con la forma del contenido y el tiempo transcurrido (a los 8 s avisa que tarda más de lo normal). */
export function Skeleton({lineas=5,segundos=0,compacto=false}:{lineas?:number;segundos?:number;compacto?:boolean}){
 return <div className="fg-skel" role="status" aria-busy="true" data-compacto={compacto||undefined}>
  <span className="sr-only">Cargando fuga de reembolsos…</span>
  {!compacto&&<div className="fg-skel-big" aria-hidden="true"/>}
  {Array.from({length:lineas},(_,i)=><div key={i} className="fg-skel-l" style={{width:`${92-i*9}%`}} aria-hidden="true"/>)}
  <p className="fg-sm">{segundos<2?'Calculando…':segundos<8?`Calculando… ${segundos} s`:`Calculando… ${segundos} s. Está tardando más de lo normal; sigue intentando.`}</p>
 </div>;
}
