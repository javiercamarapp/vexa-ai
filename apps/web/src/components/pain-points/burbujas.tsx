'use client';
import {useMemo,useRef,useState,type KeyboardEvent,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {useTipPosicion} from '../ui/use-tip-posicion';
import type {PainVista,PuntoPP} from '../../../../../packages/workspace-service/pain-points.d.mts';
import {disponerBurbujas,type Burbuja} from './burbujas-modelo.mjs';
import {etiquetaBurbuja,num,usdCorto,valorMostrado,CLASE_NOMBRE} from './modelo.mjs';
import {useWidth} from '../ui/use-width';

const cat=(c:number)=>`var(--chart-${((c-1)%8)+1})`;
/** Parte un nombre en hasta 2 líneas de ~`max` caracteres (con elipsis); la tabla trae el nombre completo. */
function lineas(t:string,max:number){
 const w=t.split(/\s+/),out:string[]=[''];
 for(const x of w){const l=out[out.length-1];if((l+' '+x).trim().length<=max)out[out.length-1]=(l+' '+x).trim();else if(out.length<2)out.push(x);else{out[1]=(out[1]+' '+x).trim();}}
 return out.map((l,i)=>i===1&&l.length>max?l.slice(0,Math.max(1,max-1))+'…':l).slice(0,2);
}
/** Mapa de burbujas SVG: área ∝ valor (radio = raíz), un cúmulo por tema, posiciones deterministas. Cada burbuja es un botón; el color es el tema y la clase va en el trazo. */
export function Burbujas({vista,modo,seleccion,onElegir,visibles}:{vista:PainVista;modo:'dinero'|'volumen';seleccion:string|null;onElegir:(id:string)=>void;visibles:Set<string>|null}){
 const [ref,w]=useWidth<HTMLDivElement>(),ancho=Math.max(320,w||840);
 const puntos=useMemo(()=>vista.puntos.filter(p=>!visibles||visibles.has(p.tema)),[vista,visibles]);
 const D=useMemo(()=>disponerBurbujas({puntos,modo,ancho}),[puntos,modo,ancho]);
 const porId=useMemo(()=>new Map(vista.puntos.map(p=>[p.id,p])),[vista]);
 const tema=(id:string)=>vista.temas.find(t=>t.id===id)!;
 const [hover,setHover]=useState<string|null>(null),refs=useRef<Record<string,SVGGElement|null>>({});
 const orden=useMemo(()=>[...D.burbujas,...D.masPorTema],[D]);
 const hay=D.burbujas.length>0;
 function tecla(e:KeyboardEvent,i:number,b:Burbuja){
  const d=e.key==='ArrowRight'||e.key==='ArrowDown'?1:e.key==='ArrowLeft'||e.key==='ArrowUp'?-1:0;
  if(d){e.preventDefault();const n=orden[(i+d+orden.length)%orden.length];refs.current[n.id]?.focus();}
  else if(e.key==='Enter'||e.key===' '){e.preventDefault();if(b.tipo==='punto')onElegir(b.id);else onElegir(b.ids![0]);}
 }
 const tip=hover?orden.find(b=>b.id===hover):null,tp=tip&&tip.tipo==='punto'?porId.get(tip.id):null;
 const vis=D.clusters.filter(c=>!visibles||visibles.has(c.id));
 return <div className="pp-mapa" ref={ref}>
  <svg className="pp-svg" viewBox={`0 0 ${D.ancho} ${D.alto}`} width="100%" height={D.alto} role="group" aria-label="Mapa de burbujas de puntos de dolor, agrupadas por tema. Tamaño proporcional al valor. La tabla de al lado trae las mismas cifras.">
   <defs><pattern id="pp-rayas" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" fill="var(--ui-surface)"/><rect width="4" height="8" fill="var(--pp-trama,var(--soft-4))"/></pattern></defs>
   {vis.map(c=>{const t=tema(c.id);return <g key={c.id}>
    <text x={c.etiquetaX} y={c.etiquetaY} className="pp-tema" fill={`var(--ink-${t.c})`}>{t.nombre}{c.total>0?' · '+(modo==='dinero'?usdCorto(String(Math.round(c.total*100))):num(c.total)):''}</text>
    {c.n===0&&<circle cx={c.centro.x} cy={c.centro.y} r={34} className="pp-vacio"/>}
   </g>;})}
   {orden.map((b,i)=>{
    const t=tema(b.tema),p=b.tipo==='punto'?porId.get(b.id)!:null,sel=seleccion===b.id,etiqueta=p?etiquetaBurbuja(p,t.nombre,modo):`${t.nombre}, ${b.n} puntos más`;
    const dash=b.tipo==='mas'||b.minimo?'2 3':p?.clase==='I'?'6 3':p?.clase==='E'?'6 3':undefined;
    const fill=p?.clase==='E'?'url(#pp-rayas)':`var(--soft-${t.c})`;
    return <g key={b.id} ref={el=>{refs.current[b.id]=el;}} className="pp-burbuja" data-sel={sel||undefined} tabIndex={0} role="button" aria-label={etiqueta} aria-pressed={sel} transform={`translate(${b.cx} ${b.cy})`}
     onClick={()=>onElegir(b.tipo==='punto'?b.id:b.ids![0])} onKeyDown={e=>tecla(e,i,b)} onMouseEnter={()=>setHover(b.id)} onMouseLeave={()=>setHover(null)} onFocus={()=>setHover(b.id)} onBlur={()=>setHover(null)} style={{['--pp-trama' as string]:`var(--soft-${t.c})`}}>
     <circle r={b.r} fill={fill} stroke={sel?'var(--ink-8)':cat(t.c)} strokeWidth={sel?3:1.5} strokeDasharray={dash}/>
     {b.r>=34&&p&&<text textAnchor="middle" className="pp-txt" fill={`var(--ink-${t.c})`}>{lineas(p.nombre.replace(/^Dinero devuelto · /,''),Math.floor(b.r/4.6)).map((l,k,a)=><tspan key={k} x={0} dy={k===0?(a.length===1?-2:-14):14}>{l}</tspan>)}<tspan x={0} dy={a_dy(p.nombre,b.r)} className="pp-val">{valorMostrado(p,modo)}</tspan></text>}
     {b.tipo==='mas'&&<text textAnchor="middle" className="pp-txt" fill={`var(--ink-${t.c})`}><tspan x={0} dy={-2}>+{b.n} más</tspan><tspan x={0} dy={14} className="pp-val">{modo==='dinero'?usdCorto(String(Math.round(b.valor*100))):num(b.valor)}</tspan></text>}
    </g>;
   })}
  </svg>
  {!hay&&<p className="pp-vacio-txt">Sin puntos de dolor con cifra en este filtro. Cambia de tema o de medida (Dinero / Volumen).</p>}
  {tip&&tp&&typeof document!=='undefined'&&createPortal(<TipBurbuja ancla={()=>{const r=refs.current[tip.id]?.getBoundingClientRect();return r?{ax:r.left+r.width/2,ay:r.top+r.height/2,modo:'arriba' as const,sep:r.height/2+8}:null;}}><b>{tp.nombre}</b><span>{modo==='dinero'?(tp.dinero.sinDato?'Sin dato':'USD '+(Number(BigInt(tp.dinero.minor))/100).toLocaleString('es-MX',{minimumFractionDigits:2})):(tp.volumen.sinDato?'Sin dato':num(tp.volumen.n)+' '+tp.volumen.unidad)}</span><span>{CLASE_NOMBRE[tp.clase]}</span></TipBurbuja>,document.body)}
  <ul className="pp-leyenda" aria-label="Leyenda"><li><i className="pp-l-o"/>Observado: contorno sólido</li><li><i className="pp-l-i"/>Inferido o mínimo visible: discontinuo</li><li><i className="pp-l-e"/>Estimado: rayado</li><li>Escala: área ∝ valor · máx. {num(Math.round(D.escala.vmax))}{modo==='dinero'?' USD':''}</li></ul>
 </div>;
}
function a_dy(nombre:string,r:number){const n=lineas(nombre.replace(/^Dinero devuelto · /,''),Math.floor(r/4.6)).length;return n===1?16:14;}
export type {PuntoPP};

/** Tooltip de burbuja: portal a <body> con position:fixed (ni el SVG ni la tarjeta lo recortan), centrado sobre la burbuja, volteado debajo si arriba no cabe y acotado al viewport. */
function TipBurbuja({ancla,children}:{ancla:()=>{ax:number;ay:number;modo:'arriba';sep:number}|null;children:ReactNode}){
 const ref=useRef<HTMLDivElement>(null);
 useTipPosicion(ref,true,ancla);
 return <div ref={ref} className="pp-tip" role="presentation">{children}</div>;
}
