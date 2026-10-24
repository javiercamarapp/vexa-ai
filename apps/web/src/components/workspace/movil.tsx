'use client';
import Link from './navigation-lifecycle';
import {useEffect,useId,useMemo,useRef,useState,type FormEvent} from 'react';
import {usePathname,useSearchParams} from 'next/navigation';
import {Drawer} from '../ui/overlay';
import {WorkspaceIcon} from './icon';
import {navigationQuery} from './navigation';
import {itemActivo} from '../../lib/workspace/menu.mjs';
import {limpiarTodo} from '../../lib/workspace/swr.mjs';
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
type Destino={href:string;etiqueta:string;icono:string;grupos:string[]};
function destinos(dinero:boolean):Destino[]{
 return [
  {href:'/overview',etiqueta:'Inicio',icono:'overview',grupos:[]},
  dinero?{href:'/cfo',etiqueta:'Dinero',icono:'economics',grupos:['dinero']}:{href:'/confianza',etiqueta:'Datos',icono:'history',grupos:['datos']},
  {href:'/problems',etiqueta:'Clientes',icono:'clientes',grupos:['clientes','operacion']},
  {href:'/recommendations',etiqueta:'Acciones',icono:'recommendations',grupos:['acciones']},
  {href:'/preguntale',etiqueta:'Preguntar',icono:'preguntale',grupos:[]},
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
 const pathname=usePathname(),query=navigationQuery(pathname,useSearchParams().toString());
 const lista=destinos(role==='owner'||role==='analyst');
 return <nav className="workspace-bottom-nav" aria-label="Navegación móvil">{lista.map(d=>{const activo=activoDe(pathname,d);return <Link key={d.href} href={d.href+(query?'?'+query:'')} aria-current={activo?'page':undefined}><span className="bn-icono"><WorkspaceIcon name={d.icono} size={22}/></span><span className="bn-etiqueta">{d.etiqueta}</span></Link>;})}</nav>;
}

function iniciales(nombre:string){return (nombre.trim().slice(0,1)||'?').toUpperCase();}
function leerRecientes():string[]{try{const v=JSON.parse(window.localStorage.getItem(RECIENTES)??'[]');return Array.isArray(v)?v.filter((x:unknown)=>typeof x==='string').slice(0,4):[];}catch{return [];}}
function guardarReciente(id:string){try{const v=[id,...leerRecientes().filter(x=>x!==id)].slice(0,4);window.localStorage.setItem(RECIENTES,JSON.stringify(v));}catch{/* opcional */}}

/** Selector de empresa SIEMPRE visible arriba. Con varias organizaciones es un chip que abre una hoja inferior (buscador + recientes);
    con una sola muestra el nombre sin control. El cambio real lo hace POST /auth/organization, que valida la membresía en el servidor. */
export function SelectorEmpresa({organizations,tenant}:{organizations:Organization[];tenant:string}){
 const [abierto,setAbierto]=useState(false),[q,setQ]=useState(''),[recientes,setRecientes]=useState<string[]>([]);
 const nombre=organizations.find(o=>o.id===tenant)?.name??'Organización',idBuscar=useId(),form=useRef<HTMLFormElement>(null);
 const varias=organizations.length>1;
 const abrir=()=>{setRecientes(leerRecientes());setQ('');setAbierto(true);};
 const norm=(t:string)=>t.toLocaleLowerCase('es').normalize('NFD').replace(/[̀-ͯ]/g,'');
 const filtradas=useMemo(()=>{const n=norm(q.trim());return n?organizations.filter(o=>norm(o.name).includes(n)):organizations;},[q,organizations]);
 const recientesVisibles=useMemo(()=>q.trim()||organizations.length<5?[]:recientes.map(id=>organizations.find(o=>o.id===id)).filter((o):o is Organization=>!!o&&o.id!==tenant).slice(0,3),[q,recientes,organizations,tenant]);
 const alEnviar=(e:FormEvent<HTMLFormElement>)=>{const quien=(e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement|null;if(quien?.value)guardarReciente(quien.value);limpiarTodo();};
 const fila=(o:Organization)=>{const actual=o.id===tenant;return <li key={o.id}>{actual?<button type="button" className="org-fila btn-ghost" aria-current="true" onClick={()=>setAbierto(false)}><span className="org-avatar" aria-hidden="true">{iniciales(o.name)}</span><span className="org-nombre">{o.name}</span><span className="org-marca"><WorkspaceIcon name="check" size={18}/><span className="sr-only">Empresa actual</span></span></button>:<button type="submit" name="tenant_id" value={o.id} className="org-fila btn-ghost"><span className="org-avatar" aria-hidden="true">{iniciales(o.name)}</span><span className="org-nombre">{o.name}</span></button>}</li>;};
 if(!varias)return <div className="empresa-chip empresa-fija" data-testid="selector-empresa"><span className="org-avatar" aria-hidden="true">{iniciales(nombre)}</span><span className="org-nombre"><span className="sr-only">Empresa: </span>{nombre}</span></div>;
 return <>
  <button type="button" className="empresa-chip" data-testid="selector-empresa" aria-haspopup="dialog" aria-expanded={abierto} onClick={abrir}><span className="org-avatar" aria-hidden="true">{iniciales(nombre)}</span><span className="org-nombre"><span className="sr-only">Empresa: </span>{nombre}</span><span className="org-chevron" aria-hidden="true"><WorkspaceIcon name="chevron" size={16}/></span><span className="sr-only">Cambiar de empresa</span></button>
  <Drawer side="bottom" title="Cambiar de empresa" subtitle="Elige el espacio que quieres ver" open={abierto} onClose={()=>setAbierto(false)} className="hoja-empresa">
   <form ref={form} className="empresas" action="/auth/organization" method="post" onSubmit={alEnviar}>
    {organizations.length>5&&<div className="ov-search empresas-buscar"><WorkspaceIcon name="search" size={16}/><label htmlFor={idBuscar} className="sr-only">Buscar empresa</label><input id={idBuscar} type="search" inputMode="search" autoComplete="off" placeholder="Buscar empresa" value={q} onChange={e=>setQ(e.target.value)}/></div>}
    {recientesVisibles.length>0&&<section aria-label="Recientes"><p className="empresas-titulo">Recientes</p><ul className="empresas-lista">{recientesVisibles.map(fila)}</ul></section>}
    <section aria-label="Todas las empresas">{(recientesVisibles.length>0||organizations.length>5)&&<p className="empresas-titulo">Todas</p>}<ul className="empresas-lista">{filtradas.map(fila)}</ul>{filtradas.length===0&&<p className="empresas-vacio" role="status">No hay empresas con ese nombre.</p>}</section>
   </form>
  </Drawer>
 </>;
}

const TEMAS:[Theme,string,string][]=[['light','Claro','sun'],['system','Sistema','monitor'],['dark','Oscuro','moon']];
/** Selector de tema: tres celdas iguales con el mismo icono SVG de 16 px (mismo trazo) centrado; la elegida es una píldora ajustada a su celda. */
export function SelectorTema({valor,onChange,nombre,etiquetas=false}:{valor:Theme;onChange:(t:Theme)=>void;nombre:string;etiquetas?:boolean}){
 return <fieldset className="theme-selector" data-etiquetas={etiquetas||undefined}><legend className="sr-only">Tema de la interfaz</legend>{TEMAS.map(([v,etiqueta,icono])=><label key={v}><input type="radio" className="sr-only" name={nombre} value={v} checked={valor===v} onChange={()=>onChange(v)}/><WorkspaceIcon name={icono} size={16}/><span className={etiquetas?'tema-texto':'sr-only'}>{etiqueta}</span></label>)}</fieldset>;
}
