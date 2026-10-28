'use client';
import Link from './navigation-lifecycle';
import {useEffect,useId,useRef,useState} from 'react';
import {usePathname,useSearchParams} from 'next/navigation';
import {WorkspaceIcon} from './icon';
import {precalentarEnlace} from '../../lib/workspace/precalentar.mjs';
import {consultaAlcance} from '../../lib/workspace/alcance.mjs';
import {menuVisible,itemActivo,tituloDePantalla,iconoDePantalla,grupoAbiertoPorDefecto,type MenuItem,type MenuEntrada} from '../../lib/workspace/menu.mjs';
import {useT} from '../i18n/proveedor';
import {etiquetaItem,tituloItem,etiquetaGrupo} from '../../lib/i18n/menu';
import type {Traductor} from '../../lib/i18n';
/** El menú conserva solo el alcance (periodo, moneda, base, corte, filtros compartidos); los filtros propios de cada pantalla no viajan. */
export function navigationQuery(_pathname:string,raw:string){return consultaAlcance(raw);}
export const workspaceTitle=tituloDePantalla;
/** Título del encabezado en el idioma activo: el del ítem del menú o, para pantallas sin ítem, el de su ruta. */
export function tituloTraducido(pathname:string,t:Traductor){
 const a=itemActivo(pathname);if(a)return tituloItem(t,a.item);
 for(const [ruta,clave] of [['/notifications','nav.titulo.notifications'],['/briefs','nav.titulo.briefs'],['/customers','nav.titulo.customers']] as const)if(pathname===ruta||pathname.startsWith(ruta+'/'))return t(clave);
 return t('nav.titulo.defecto');
}
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
 const pathname=usePathname(),query=navigationQuery(pathname,useSearchParams().toString()),id=useId(),t=useT();
 const menu=menuVisible({role,interno}),activo=itemActivo(pathname),raiz=useRef<HTMLElement>(null);
 // Acordeón: un solo grupo abierto. Por defecto el de la página actual (o el primero); lo que la persona abra vale mientras no cambie de página.
 const porDefecto=grupoAbiertoPorDefecto(menu,activo);
 const [manual,setManual]=useState<{ruta:string;clave:string|null}|null>(null);
 const abierto=manual&&manual.ruta===pathname?manual.clave:porDefecto;
 // La lista del menú puede desplazarse: el ítem activo siempre debe quedar a la vista al navegar.
 useEffect(()=>{const actual=raiz.current?.querySelector<HTMLElement>('a[aria-current="page"]');if(actual&&typeof actual.scrollIntoView==='function')actual.scrollIntoView({block:'nearest'});},[pathname,abierto]);
 function alternar(clave:string){setManual({ruta:pathname,clave:abierto===clave?null:clave});}
 function item(link:MenuItem){const destino=link.href+(query&&!sinAlcance(link.href)?'?'+query:''),calentar=()=>{precalentarEnlace(destino);};return <li key={link.href}><Link data-tour={'menu:'+link.href} title={tituloItem(t,link)} aria-label={collapsed?etiquetaItem(t,link):undefined} onClick={onNavigate} onPointerEnter={calentar} onFocus={calentar} aria-current={activo?.item.href===link.href?'page':undefined} href={destino}><WorkspaceIcon name={link.icono}/><span className="nav-label">{etiquetaItem(t,link)}</span></Link></li>;}
 const grupoCerradoActual=!collapsed&&activo?.grupo&&abierto!==activo.grupo;
 return <nav aria-label={t('shell.navPrincipal')} ref={raiz}>
  {grupoCerradoActual&&activo&&<div className="nav-current"><p className="nav-caption">{t('shell.paginaActual')}</p><ul>{item(activo.item)}</ul></div>}
  {corridas(menu).map((corrida,index)=>{
   if(corrida.tipo==='sueltos')return <ul className="nav-root" key={'s'+index}>{corrida.items.map(item)}</ul>;
   const {grupo}=corrida,expanded=abierto===grupo.clave,controls=id+'-group-'+grupo.clave;
   return <div className="nav-group" key={grupo.clave}>
    {!collapsed&&<button className="nav-group-toggle" type="button" aria-expanded={expanded} aria-controls={controls} onClick={()=>alternar(grupo.clave)}><span>{etiquetaGrupo(t,grupo)}</span><WorkspaceIcon name="chevron"/></button>}
    <ul id={controls} hidden={!collapsed&&!expanded}>{grupo.items.map(item)}</ul>
   </div>;
  })}
 </nav>;
}
