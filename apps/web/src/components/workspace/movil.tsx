'use client';
import Link from './navigation-lifecycle';
import {useEffect,useId,useMemo,useRef,useState,type FormEvent} from 'react';
import {usePathname,useSearchParams} from 'next/navigation';
import {Drawer} from '../ui/overlay';
import {WorkspaceIcon} from './icon';
import {navigationQuery} from './navigation';
import {itemActivo} from '../../lib/workspace/menu.mjs';
import {limpiarTodo} from '../../lib/workspace/swr.mjs';
import {useT} from '../i18n/proveedor';
import type {Clave} from '../../lib/i18n';
import './movil.css';

export type Organization={id:string;name:string};
export type Theme='light'|'system'|'dark';
const RECIENTES='vexa-recent-orgs';

/** Teclado en pantalla: publica --teclado (px cubiertos) y data-teclado en <html>. Lee visualViewport (iOS no encoge el viewport de diseño) y
    detecta también el caso Android «resizes-content» (el viewport encoge): hay teclado si un campo editable tiene el foco y la altura cae > 120 px. */
export function useTeclado(){
 useEffect(()=>{
  const root=document.documentElement,vv=window.visualViewport;let base=vv?.height??window.innerHeight,raf=0;
  const editable=()=>{const a=document.activeElement as HTMLElement|null;return !!a&&(a.isContentEditable||(a.tagName==='TEXTAREA')||(a.tagName==='INPUT'&&!/^(checkbox|radio|button|submit|range|file|color)$/.test((a as HTMLInputElement).type)));};
  const actualizar=()=>{
   cancelAnimationFrame(raf);
   raf=requestAnimationFrame(()=>{
    const alto=vv?.height??window.innerHeight,top=vv?.offsetTop??0;
    if(!editable())base=Math.max(base,alto,window.innerHeight);
    const cubierto=Math.max(0,Math.round(window.innerHeight-alto-top));
    const abierto=editable()&&(cubierto>120||alto<base-120);
    root.style.setProperty('--teclado',(abierto?cubierto:0)+'px');
    root.dataset.teclado=abierto?'abierto':'cerrado';
   });
  };
  const alEnfocar=(e:FocusEvent)=>{actualizar();const t=e.target as HTMLElement;if(t&&t.matches?.('textarea,input'))window.setTimeout(()=>{try{t.scrollIntoView({block:'nearest'});}catch{/* opcional */}},250);};
  vv?.addEventListener('resize',actualizar);vv?.addEventListener('scroll',actualizar);window.addEventListener('resize',actualizar);
  document.addEventListener('focusin',alEnfocar);document.addEventListener('focusout',actualizar);
  actualizar();
  return()=>{cancelAnimationFrame(raf);vv?.removeEventListener('resize',actualizar);vv?.removeEventListener('scroll',actualizar);window.removeEventListener('resize',actualizar);document.removeEventListener('focusin',alEnfocar);document.removeEventListener('focusout',actualizar);root.style.removeProperty('--teclado');delete root.dataset.teclado;};
 },[]);
}

/** Cinco destinos fijos, con etiqueta y posiciones estables. Quien no ve «Dinero» (rol sin acceso) conserva la ranura con «Datos». */
type Destino={href:string;etiqueta:Clave;icono:string;grupos:string[]};
function destinos(dinero:boolean):Destino[]{
 return [
  {href:'/overview',etiqueta:'movil.inicio',icono:'overview',grupos:[]},
  dinero?{href:'/cfo',etiqueta:'movil.dinero',icono:'economics',grupos:['dinero']}:{href:'/confianza',etiqueta:'movil.datos',icono:'history',grupos:['datos']},
  {href:'/problems',etiqueta:'movil.clientes',icono:'clientes',grupos:['clientes','operacion']},
  {href:'/recommendations',etiqueta:'movil.acciones',icono:'recommendations',grupos:['acciones']},
  {href:'/preguntale',etiqueta:'movil.preguntar',icono:'preguntale',grupos:[]},
 ];
}
function activoDe(pathname:string,d:Destino){
 if(d.href==='/overview')return pathname==='/overview'||pathname.startsWith('/overview/')||pathname.startsWith('/briefs');
 if(d.href==='/preguntale')return pathname.startsWith('/preguntale');
 if(d.href==='/problems'&&pathname.startsWith('/customers'))return true;
 const a=itemActivo(pathname);return !!a?.grupo&&d.grupos.includes(a.grupo);
}
/** Barra inferior flotante (solo celular). Cada destino mide ≥ 44 px de alto y ocupa 1/5 del ancho; la etiqueta se trunca con elipsis. */
export function BarraInferior({role}:{role:string}){
 const pathname=usePathname(),query=navigationQuery(pathname,useSearchParams().toString()),t=useT();
 const lista=destinos(role==='owner'||role==='analyst');
 return <nav className="workspace-bottom-nav" aria-label={t('shell.navMovil')}>{lista.map(d=>{const activo=activoDe(pathname,d);return <Link key={d.href} href={d.href+(query?'?'+query:'')} aria-current={activo?'page':undefined}><span className="bn-icono"><WorkspaceIcon name={d.icono} size={22}/></span><span className="bn-etiqueta">{t(d.etiqueta)}</span></Link>;})}</nav>;
}

/** Iniciales del monograma: dos palabras → 1.ª letra de cada una; una palabra → sus dos primeras letras. Ignora paréntesis y conectores («de», «la»…). */
export function iniciales(nombre:string){
 const limpio=nombre.replace(/\([^)]*\)/g,' ').replace(/[^\p{L}\p{N}\s]/gu,' ');
 const todas=limpio.split(/\s+/).filter(Boolean),utiles=todas.filter(p=>!/^(de|del|la|las|los|el|y|e|en|the|of|and)$/i.test(p));
 const pal=utiles.length?utiles:todas;
 const r=pal.length>=2?pal[0].slice(0,1)+pal[1].slice(0,1):pal[0]?.slice(0,2)??'?';
 return r.toLocaleUpperCase('es');
}
/** Monograma de identidad (empresa o cuenta): rectángulo redondeado con tinte suave y iniciales; nunca un círculo con una letra suelta. */
export function Monograma({nombre,className=''}:{nombre:string;className?:string}){return <span className={'monograma'+(className?' '+className:'')} aria-hidden="true">{iniciales(nombre)}</span>;}
function leerRecientes():string[]{try{const v=JSON.parse(window.localStorage.getItem(RECIENTES)??'[]');return Array.isArray(v)?v.filter((x:unknown)=>typeof x==='string').slice(0,4):[];}catch{return [];}}
function guardarReciente(id:string){try{const v=[id,...leerRecientes().filter(x=>x!==id)].slice(0,4);window.localStorage.setItem(RECIENTES,JSON.stringify(v));}catch{/* opcional */}}

/** Selector de empresa: con varias organizaciones es un control pequeño (monograma + chevron) que abre una hoja inferior con los nombres completos (buscador + recientes);
    con una sola no hay control y el nombre vive en la hoja «Más». El cambio real lo hace POST /auth/organization, que valida la membresía en el servidor. */
export function SelectorEmpresa({organizations,tenant}:{organizations:Organization[];tenant:string}){
 const t=useT(),[abierto,setAbierto]=useState(false),[q,setQ]=useState(''),[recientes,setRecientes]=useState<string[]>([]);
 const nombre=organizations.find(o=>o.id===tenant)?.name??t('shell.organizacion'),idBuscar=useId(),form=useRef<HTMLFormElement>(null);
 const varias=organizations.length>1;
 const abrir=()=>{setRecientes(leerRecientes());setQ('');setAbierto(true);};
 const norm=(x:string)=>x.toLocaleLowerCase('es').normalize('NFD').replace(/[̀-ͯ]/g,'');
 const filtradas=useMemo(()=>{const n=norm(q.trim());return n?organizations.filter(o=>norm(o.name).includes(n)):organizations;},[q,organizations]);
 const recientesVisibles=useMemo(()=>q.trim()||organizations.length<5?[]:recientes.map(id=>organizations.find(o=>o.id===id)).filter((o):o is Organization=>!!o&&o.id!==tenant).slice(0,3),[q,recientes,organizations,tenant]);
 const alEnviar=(e:FormEvent<HTMLFormElement>)=>{const quien=(e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement|null;if(quien?.value)guardarReciente(quien.value);limpiarTodo();};
 const fila=(o:Organization)=>{const actual=o.id===tenant;return <li key={o.id}>{actual?<button type="button" className="org-fila btn-ghost" aria-current="true" onClick={()=>setAbierto(false)}><Monograma nombre={o.name} className="monograma-fila"/><span className="org-nombre">{o.name}</span><span className="org-marca"><WorkspaceIcon name="check" size={18}/><span className="sr-only">{t('movil.empresaActualSr')}</span></span></button>:<button type="submit" name="tenant_id" value={o.id} className="org-fila btn-ghost"><Monograma nombre={o.name} className="monograma-fila"/><span className="org-nombre">{o.name}</span></button>}</li>;};
 // Con una sola organización no hay nada que cambiar: la barra no lleva control (el nombre vive en la hoja «Más»).
 if(!varias)return null;
 return <>
  <button type="button" className="empresa-chip" data-testid="selector-empresa" aria-haspopup="dialog" aria-expanded={abierto} aria-label={t('movil.empresaActual',{nombre})} onClick={abrir}><Monograma nombre={nombre}/><span className="org-chevron" aria-hidden="true"><WorkspaceIcon name="chevron" size={14}/></span></button>
  <Drawer side="bottom" title={t('movil.cambiarEmpresa')} subtitle={t('movil.cambiarEmpresaSub')} open={abierto} onClose={()=>setAbierto(false)} className="hoja-empresa">
   <form ref={form} className="empresas" action="/auth/organization" method="post" onSubmit={alEnviar}>
    {organizations.length>5&&<div className="ov-search empresas-buscar"><WorkspaceIcon name="search" size={16}/><label htmlFor={idBuscar} className="sr-only">{t('movil.buscarEmpresa')}</label><input id={idBuscar} type="search" inputMode="search" autoComplete="off" placeholder={t('movil.buscarEmpresa')} value={q} onChange={e=>setQ(e.target.value)}/></div>}
    {recientesVisibles.length>0&&<section aria-label={t('movil.recientes')}><p className="empresas-titulo">{t('movil.recientes')}</p><ul className="empresas-lista">{recientesVisibles.map(fila)}</ul></section>}
    <section aria-label={t('movil.todasEmpresas')}>{(recientesVisibles.length>0||organizations.length>5)&&<p className="empresas-titulo">{t('movil.todas')}</p>}<ul className="empresas-lista">{filtradas.map(fila)}</ul>{filtradas.length===0&&<p className="empresas-vacio" role="status">{t('movil.sinEmpresas')}</p>}</section>
   </form>
  </Drawer>
 </>;
}

const TEMAS:[Theme,Clave,string][]=[['light','shell.temaClaro','sun'],['system','shell.temaSistema','monitor'],['dark','shell.temaOscuro','moon']];
/** Selector de tema: tres celdas iguales con el mismo icono SVG de 16 px (mismo trazo) centrado; la elegida es una píldora ajustada a su celda. */
export function SelectorTema({valor,onChange,nombre,etiquetas=false}:{valor:Theme;onChange:(t:Theme)=>void;nombre:string;etiquetas?:boolean}){
 const t=useT();
 return <fieldset className="theme-selector" data-etiquetas={etiquetas||undefined}><legend className="sr-only">{t('shell.tema')}</legend>{TEMAS.map(([v,etiqueta,icono])=><label key={v}><input type="radio" className="sr-only" name={nombre} value={v} checked={valor===v} onChange={()=>onChange(v)}/><WorkspaceIcon name={icono} size={16}/><span className={etiquetas?'tema-texto':'sr-only'}>{t(etiqueta)}</span></label>)}</fieldset>;
}
