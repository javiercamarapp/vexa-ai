'use client';
import {useEffect,useState} from 'react';
import {createPortal} from 'react-dom';
/** Mejoras de CONTENIDO para el celular (< 820 px). No cambian el escritorio: solo anotan el DOM con atributos que el CSS de movil-contenido.css usa en @media(max-width:819px).
 *  1. Tablas -> tarjeta-fila: cada celda recibe `data-label` (la cabecera de su columna), la primera es el título y la primera cifra es la principal. Atributos solo; React no se entera.
 *  2. Cifras de KPI que no caben en una línea reciben `data-abrev` (es-MX: «US$11.6M»); el CSS pinta la abreviatura y el lector de pantalla sigue leyendo la cifra completa.
 *  3. Un interruptor «Tarjetas | Comparar columnas» (preferencia del navegador) cuando la pantalla tiene tablas de 3+ columnas. */
const CLAVE='vexa:tablas-movil';
const MQ='(max-width: 819px)';
const NUM=/^[\s$€£]*(?:US|CA|MX)?[\s$€£]*[-+−–]?[\d.,]+\s*(?:%|k|M|mil|MDP|USD|CAD|MXN|pts?|h|min|d|días?)?\s*$/i;

/** «US$11,580,000» -> «US$11.6M»; «295,167.54 USD» -> «295k USD»; null si no hay número que abreviar. */
export function abreviarCifra(texto:string):string|null{
 const m=/^([^\d\-−–+]*)([-+−–]?)([\d,]+(?:\.\d+)?)(.*)$/.exec(texto.trim());
 if(!m)return null;
 const n=Number(m[3].replace(/,/g,''));
 if(!Number.isFinite(n)||n<10000)return null;
 const corto=(v:number)=>String(Number(v.toPrecision(3)));
 const cuerpo=n>=1e9?corto(n/1e9)+'B':n>=1e6?corto(n/1e6)+'M':corto(n/1e3)+'k';
 return m[1].trim().replace(/\s+$/,'')+m[2]+cuerpo+(m[4]?m[4].replace(/^\s*/,' '):'');
}

function preparar(t:HTMLTableElement){
 const cab=[...t.querySelectorAll('thead tr:last-child > th')].flatMap(th=>{const s=Math.max(1,Number((th as HTMLTableCellElement).colSpan)||1);const x=(th.textContent||'').trim();return Array<string>(s).fill(x);});
 const filas=[...t.querySelectorAll('tbody > tr')] as HTMLTableRowElement[];
 if(!filas.length)return;
 t.setAttribute('role','table');
 t.querySelectorAll('thead,tbody').forEach(g=>g.setAttribute('role','rowgroup'));
 t.querySelectorAll('thead tr').forEach(r=>r.setAttribute('role','row'));
 t.querySelectorAll('thead th').forEach(c=>c.setAttribute('role','columnheader'));
 for(const f of filas){
  f.setAttribute('role','row');
  const celdas=[...f.children].filter(c=>c.tagName==='TD'||c.tagName==='TH') as HTMLTableCellElement[];
  if(celdas.some(c=>c.colSpan>1)){f.setAttribute('data-sin-tarjeta','');continue;}
  let principal=-1;
  const t0=Math.max(0,celdas.findIndex(c=>!c.classList.contains('pf-check'))); // la casilla de selección (consola de plataforma) nunca es el título de la tarjeta
  celdas.forEach((c,i)=>{
   c.setAttribute('role',c.tagName==='TH'?'rowheader':'cell');
   c.setAttribute('data-label',cab[i]??'');
   if(i===t0)c.setAttribute('data-titulo','');
   if(principal<0&&i>t0&&i<=t0+4&&!c.querySelector('button,a,input,select')&&NUM.test((c.textContent||'').trim()))principal=i;
  });
  celdas.forEach((c,i)=>{if(i===principal)c.setAttribute('data-principal','');else c.removeAttribute('data-principal');});
 }
 t.setAttribute('data-mv',String(cab.length||filas[0]?.children.length||0));
}

/** Pestañas con scroll horizontal: la activa queda centrada (una vez por pestaña) */
function centrarActivas(root:ParentNode){
 root.querySelectorAll<HTMLElement>('.pc-tabs,[role=tablist]').forEach(c=>{
  if(c.dataset.centrada||c.scrollWidth<=c.clientWidth+1)return;
  const a=c.querySelector<HTMLElement>('[aria-current=page],[aria-selected=true]');if(!a)return;
  c.dataset.centrada='1';c.scrollLeft=a.offsetLeft-(c.clientWidth-a.offsetWidth)/2;
 });
}

/** Contenedores con scroll horizontal: marcan data-mas-izq / data-mas-der para desvanecer el borde donde hay más contenido (pista de que se desliza). */
function vigilarScroll(root:ParentNode){
 const marca=(c:HTMLElement)=>{const max=c.scrollWidth-c.clientWidth;if(max<=1){c.removeAttribute('data-mas-der');c.removeAttribute('data-mas-izq');return;}
  if(c.scrollLeft<max-2)c.setAttribute('data-mas-der','');else c.removeAttribute('data-mas-der');
  if(c.scrollLeft>2)c.setAttribute('data-mas-izq','');else c.removeAttribute('data-mas-izq');};
 root.querySelectorAll<HTMLElement>('.segmented,.ui-filterbar,.pc-tabs,[role=tablist],.mp-seg').forEach(c=>{
  if(!c.dataset.mvScroll){c.dataset.mvScroll='1';c.addEventListener('scroll',()=>marca(c),{passive:true});}
  marca(c);
 });
}

function ajustarCifras(root:ParentNode){
 const sel='.pc-kpi-valor,.hoy-kpi-valor,.ui-kpi-value,.stat-value,.pfig-value,.kpi-valor';
 root.querySelectorAll<HTMLElement>(sel).forEach(e=>{
  e.removeAttribute('data-abrev');e.removeAttribute('data-largo');
  if(e.scrollWidth<=e.clientWidth+1)return;
  const a=abreviarCifra(e.textContent||'');
  if(a){e.setAttribute('data-abrev',a);return;}
  e.setAttribute('data-largo','');// texto largo en lugar de cifra: se permite envolver
 });
}

type Estado={ancla:HTMLTableElement|null};
const oyentes=new Set<(e:Estado)=>void>();
let acoplados=0,parar:(()=>void)|null=null,ultimo:Estado={ancla:null};
/** Un solo observador para toda la página (PageHeader y KpiStrip se acoplan; el primero lo arranca y el último lo apaga). */
function acoplar(){
 if(acoplados++===0){
  const mq=window.matchMedia(MQ);
  const raiz=document.querySelector('.workspace-content')??document.body;
  let raf=0;
  const correr=()=>{
   raf=0;
   const tablas=[...raiz.querySelectorAll('table')].filter(t=>!t.closest('dialog:not([open])')&&!t.hasAttribute('data-sin-tarjeta')) as HTMLTableElement[];
   tablas.forEach(preparar);
   const ancla=mq.matches?tablas.find(t=>Number(t.getAttribute('data-mv')||0)>=3)??null:null;
   if(mq.matches){ajustarCifras(raiz);centrarActivas(raiz);vigilarScroll(raiz);}
   ultimo={ancla};oyentes.forEach(f=>f(ultimo));
  };
  const agenda=()=>{if(!raf)raf=requestAnimationFrame(correr);};
  agenda();
  const mo=new MutationObserver(agenda);mo.observe(raiz,{childList:true,subtree:true,characterData:true});
  window.addEventListener('resize',agenda);
  parar=()=>{mo.disconnect();window.removeEventListener('resize',agenda);if(raf)cancelAnimationFrame(raf);ultimo={ancla:null};};
 }
 return()=>{if(--acoplados===0){parar?.();parar=null;}};
}

/** `solo="cifras"`: únicamente ajusta cifras/pestañas/tablas (sin interruptor); sin prop: además pinta «Tarjetas | Comparar columnas» junto a la primera tabla. */
export function MovilContenido({solo}:{solo?:'cifras'}={}){
 const [slot,setSlot]=useState<HTMLElement|null>(null),[modo,setModo]=useState<'tarjetas'|'comparar'>('tarjetas');
 useEffect(()=>{if(solo)return;try{if(localStorage.getItem(CLAVE)==='comparar')setModo('comparar');}catch{/* sin almacenamiento: tarjetas */}},[solo]);
 useEffect(()=>{if(solo)return;document.documentElement.dataset.tablasMovil=modo;try{localStorage.setItem(CLAVE,modo);}catch{/* solo esta sesión */}},[modo,solo]);
 useEffect(()=>{
  const fuera=acoplar();
  if(solo)return fuera;
  const alCambiar=({ancla}:Estado)=>{
   document.querySelectorAll('.mv-slot').forEach(x=>{const sig=x.nextElementSibling;if(!ancla||!sig||!(sig===ancla||sig.contains(ancla)))x.remove();});
   if(!ancla){setSlot(null);return;}
   const caja=(ancla.closest('.ui-table-wrap,.table-wrap,.table-scroll,.pc-tabla,[role=region]')??ancla) as HTMLElement;
   let sl=caja.previousElementSibling as HTMLElement|null;
   if(!sl||!sl.classList.contains('mv-slot')){sl=document.createElement('div');sl.className='mv-slot';caja.parentElement?.insertBefore(sl,caja);}
   setSlot(prev=>prev===sl?prev:sl);
  };
  oyentes.add(alCambiar);alCambiar(ultimo);
  return()=>{oyentes.delete(alCambiar);fuera();};
 },[solo]);
 if(solo||!slot)return null;
 return createPortal(<div className="mv-modo-tablas" role="group" aria-label="Cómo ver las tablas">
  <button type="button" aria-pressed={modo==='tarjetas'} onClick={()=>setModo('tarjetas')}>Tarjetas</button>
  <button type="button" aria-pressed={modo==='comparar'} onClick={()=>setModo('comparar')}>Comparar columnas</button>
 </div>,slot);
}
