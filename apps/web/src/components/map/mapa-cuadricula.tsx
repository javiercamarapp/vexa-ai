'use client';
import type {KeyboardEvent} from 'react';
import {PAISES,pasoDeRampa} from './mapa-modelo.mjs';

export type Mosaico={clave:string;nombre:string;n:number};
/** Cartograma de mosaicos en SVG propio: sin librerías, sin teselas ni llamadas de red. Cada mosaico lleva código Y número (nunca solo color). */
export function MapaCuadricula({pais,datos,max,seleccion,onElegir,etiqueta}:{pais:'US'|'MX';datos:Map<string,Mosaico>;max:number;seleccion:string|null;onElegir:(clave:string)=>void;etiqueta:string}){
 const P=PAISES[pais],T=58,W=P.columnas*T,H=P.filas*T;
 const tecla=(e:KeyboardEvent<SVGGElement>,clave:string)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onElegir(clave);}};
 return <div className="mp-lienzo" tabIndex={-1}>
  <svg className="mp-svg" viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="group" aria-label={etiqueta}>
   {P.mosaicos.map(([cod,c,f])=>{
    const clave=`${pais}-${cod}`,d=datos.get(clave),paso=pasoDeRampa(d?.n,max),sel=seleccion===clave,x=c*T,y=f*T;
    const nombre=P.nombres[cod]??cod;
    const props=d?{role:'button' as const,tabIndex:0,'aria-pressed':sel,'aria-label':`${nombre}: ${d.n} casos`,onClick:()=>onElegir(clave),onKeyDown:(e:KeyboardEvent<SVGGElement>)=>tecla(e,clave),className:'mp-m mp-activo'}:{className:'mp-m','aria-hidden':true as const};
    return <g key={cod} {...props} data-paso={paso} data-sel={sel||undefined}>
     <title>{d?`${nombre}: ${d.n} casos`:`${nombre}: sin casos visibles (menos de 5 o sin datos)`}</title>
     <rect x={x+1} y={y+1} width={T-6} height={T-6} rx={9}/>
     <text x={x+(T-4)/2} y={y+(d?23:T/2)} textAnchor="middle" className="mp-cod">{cod}</text>
     {d&&<text x={x+(T-4)/2} y={y+42} textAnchor="middle" className="mp-num">{d.n}</text>}
    </g>;
   })}
  </svg>
 </div>;
}
