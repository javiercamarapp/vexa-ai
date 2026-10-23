'use client';
import Link from './navigation-lifecycle';
import {useEffect,useId,useRef,useState} from 'react';
import {usePathname,useSearchParams} from 'next/navigation';
import {WorkspaceIcon} from './icon';
import {precalentarEnlace} from '../../lib/workspace/precalentar.mjs';
import {consultaAlcance} from '../../lib/workspace/alcance.mjs';
import {menuVisible,itemActivo,tituloDePantalla,iconoDePantalla,cerradosGuardados,type MenuItem,type MenuEntrada} from '../../lib/workspace/menu.mjs';
const CLAVE_CERRADOS='vexa-nav-cerrados';
/** El menú conserva solo el alcance (periodo, moneda, base, corte, filtros compartidos); los filtros propios de cada pantalla no viajan. */
export function navigationQuery(_pathname:string,raw:string){return consultaAlcance(raw);}
export const workspaceTitle=tituloDePantalla;
export const workspaceIconName=iconoDePantalla;
/** Settings y las pantallas internas no usan el alcance del corte: su enlace va limpio. */
const sinAlcance=(href:string)=>href.startsWith('/settings')||['/evaluation','/migrations'].some(p=>href===p||href.startsWith(p+'/'));
type Corrida={tipo:'sueltos';items:MenuItem[]}|{tipo:'grupo';grupo:Extract<MenuEntrada,{tipo:'grupo'}>};
function corridas(menu:MenuEntrada[]):Corrida[]{
 const salida:Corrida[]=[];
 for(const e of menu){
  if(e.tipo==='grupo')salida.push({tipo:'grupo',grupo:e});
  else{const ultimo=salida[salida.length-1];if(ultimo?.tipo==='sueltos')ultimo.items.push(e);else salida.push({tipo:'sueltos',items:[e]});}
 }
 return salida;
}
export function Navigation({onNavigate,collapsed=false,role,interno=false}:{onNavigate?:()=>void;collapsed?:boolean;role?:string;interno?:boolean}){
 const pathname=usePathname(),query=navigationQuery(pathname,useSearchParams().toString()),id=useId();
 const menu=menuVisible({role,interno}),activo=itemActivo(pathname),raiz=useRef<HTMLElement>(null);
 // Todos los grupos abiertos por defecto; lo que cierre la persona se recuerda en este navegador.
 const [cerrados,setCerrados]=useState<string[]>([]);
 useEffect(()=>{try{const guardado=cerradosGuardados(window.localStorage.getItem(CLAVE_CERRADOS));if(guardado.length){const frame=requestAnimationFrame(()=>setCerrados(guardado));return()=>cancelAnimationFrame(frame);}}catch{/* El estado recordado es opcional. */}},[]);
 // La lista del menú puede desplazarse: el ítem activo siempre debe quedar a la vista al navegar.
 useEffect(()=>{const actual=raiz.current?.querySelector<HTMLElement>('a[aria-current="page"]');if(actual&&typeof actual.scrollIntoView==='function')actual.scrollIntoView({block:'nearest'});},[pathname,cerrados]);
 function alternar(clave:string){const siguiente=cerrados.includes(clave)?cerrados.filter(c=>c!==clave):[...cerrados,clave];setCerrados(siguiente);try{window.localStorage.setItem(CLAVE_CERRADOS,JSON.stringify(siguiente));}catch{/* La elección sigue valiendo en esta sesión. */}}
 function item(link:MenuItem){const destino=link.href+(query&&!sinAlcance(link.href)?'?'+query:''),calentar=()=>{precalentarEnlace(destino);};return <li key={link.href}><Link title={link.titulo??link.etiqueta} aria-label={collapsed?link.etiqueta:undefined} onClick={onNavigate} onPointerEnter={calentar} onFocus={calentar} aria-current={activo?.item.href===link.href?'page':undefined} href={destino}><WorkspaceIcon name={link.icono}/><span className="nav-label">{link.etiqueta}</span></Link></li>;}
 const grupoCerradoActual=!collapsed&&activo?.grupo&&cerrados.includes(activo.grupo);
 return <nav aria-label="Navegación principal" ref={raiz}>
  {grupoCerradoActual&&activo&&<div className="nav-current"><p className="nav-caption">Página actual</p><ul>{item(activo.item)}</ul></div>}
  {corridas(menu).map((corrida,index)=>{
   if(corrida.tipo==='sueltos')return <ul className="nav-root" key={'s'+index}>{corrida.items.map(item)}</ul>;
   const {grupo}=corrida,expanded=!cerrados.includes(grupo.clave),controls=id+'-group-'+grupo.clave;
   return <div className="nav-group" key={grupo.clave}>
    {!collapsed&&<button className="nav-group-toggle" type="button" aria-expanded={expanded} aria-controls={controls} onClick={()=>alternar(grupo.clave)}><span>{grupo.etiqueta}</span><WorkspaceIcon name="chevron"/></button>}
    <ul id={controls} hidden={!collapsed&&!expanded}>{grupo.items.map(item)}</ul>
   </div>;
  })}
 </nav>;
}
