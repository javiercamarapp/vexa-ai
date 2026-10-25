'use client';
import {useEffect,useId,useRef,useState,type KeyboardEvent,type ReactNode} from 'react';
import '../agente/una-pagina.css';

/** Tamaño real (px) de una caja, en vivo: las gráficas de «una página» llenan el alto que sobra en vez de tener un alto fijo. */
export function useCaja<T extends HTMLElement>(){
 const ref=useRef<T>(null),[caja,setCaja]=useState({w:0,h:0});
 useEffect(()=>{const el=ref.current;if(!el)return;const leer=()=>{const r=el.getBoundingClientRect(),w=Math.round(r.width),h=Math.round(r.height);setCaja(c=>c.w===w&&c.h===h?c:{w,h});};const f=requestAnimationFrame(leer);const ro=new ResizeObserver(leer);ro.observe(el);return()=>{cancelAnimationFrame(f);ro.disconnect();};},[]);
 return [ref,caja] as const;
}

/** Cifra corta de un KPI: sin la moneda (la lleva la etiqueta) y sin decimales cuando es larga; la cifra completa queda en el title. */
export const kpiCorto=(d:string)=>(d.length>9?d.replace(/\.\d+/,''):d).replace(/\s?(USD|CAD|MXN)$/,'');
export type KpiUna={key:string;label:string;value:ReactNode;delta?:string|null;t?:'up'|'down';sub?:string;c?:number;title?:string};
/** Indicadores en UNA fila compacta (rejilla en escritorio, deslizable en celular): etiqueta, cifra, variación y base de comparación. Desconocido nunca es 0. */
export function UnaKpis({items,label}:{items:KpiUna[];label:string}){
 return <ul className="una-kpis" aria-label={label}>{items.map(k=><li key={k.key} className="una-kpi" style={k.c?{['--cat' as string]:`var(--chart-${((k.c-1)%8)+1})`}:undefined} title={k.title}>
  <span className="una-kpi-l">{k.label}</span><strong className="una-kpi-v">{k.value}</strong>
  <span className="una-kpi-d"><span className="dg-delta" data-t={k.t}>{k.delta??'sin comparar'}</span>{k.sub&&<small>{k.sub}</small>}</span></li>)}</ul>;
}

export type PestanaUna={id:string;label:string;count?:number;contenido:ReactNode;/** El panel llena el alto restante sin scroll propio (una gráfica). */llena?:boolean};
/** Pestañas accesibles (tablist/tab/tabpanel, flechas, Inicio/Fin). Solo el panel activo se monta; `hash` abre la pestaña que nombre el ancla de la URL. */
export function PestanasUna({items,etiqueta,anclas={}}:{items:PestanaUna[];etiqueta:string;anclas?:Record<string,string>}){
 const uid=useId().replace(/:/g,''),[sel,setSel]=useState(items[0]?.id??''),lista=useRef<HTMLDivElement>(null);
 useEffect(()=>{const h=window.location.hash.replace('#','');const id=anclas[h]??h;if(id&&items.some(i=>i.id===id))setSel(id);},[]);// eslint-disable-line react-hooks/exhaustive-deps
 const actual=items.find(i=>i.id===sel)??items[0];
 if(!actual)return null;
 const mover=(e:KeyboardEvent,i:number)=>{const n=items.length,d=e.key==='ArrowRight'?1:e.key==='ArrowLeft'?-1:e.key==='Home'?-i:e.key==='End'?n-1-i:0;if(!d)return;e.preventDefault();const k=e.key==='Home'?0:e.key==='End'?n-1:(i+d+n)%n;setSel(items[k].id);requestAnimationFrame(()=>lista.current?.querySelector<HTMLElement>('[aria-selected=true]')?.focus());};
 return <div className="una-tabs">
  <div className="una-tablist" role="tablist" aria-label={etiqueta} ref={lista}>{items.map((p,i)=><button key={p.id} type="button" role="tab" id={`${uid}-t-${p.id}`} aria-selected={p.id===actual.id} aria-controls={`${uid}-p`} tabIndex={p.id===actual.id?0:-1} className="ctl ctl-tab" onClick={()=>setSel(p.id)} onKeyDown={e=>mover(e,i)}><span className="ctl-label">{p.label}</span>{p.count!==undefined&&<span className="ctl-count">{p.count}</span>}</button>)}</div>
  <div className="una-panel" role="tabpanel" id={`${uid}-p`} aria-labelledby={`${uid}-t-${actual.id}`} data-llena={actual.llena||undefined} tabIndex={0}>{actual.contenido}</div>
 </div>;
}

/** Selector de una opción (radiogroup, flechas): botones sueltos .ctl con 8 px entre sí (nunca pegados), la elegida en el primario suave. */
export function SegmentoUna<T extends string>({options,value,onChange,label}:{options:{value:T;label:string}[];value:T;onChange:(v:T)=>void;label:string}){
 const ref=useRef<HTMLDivElement>(null);
 const mover=(e:KeyboardEvent,i:number)=>{const d=e.key==='ArrowRight'||e.key==='ArrowDown'?1:e.key==='ArrowLeft'||e.key==='ArrowUp'?-1:0;if(!d)return;e.preventDefault();const n=options[(i+d+options.length)%options.length];onChange(n.value);requestAnimationFrame(()=>ref.current?.querySelector<HTMLElement>('[aria-checked=true]')?.focus());};
 return <div className="una-seg" role="radiogroup" aria-label={label} ref={ref}>{options.map((o,i)=><button key={o.value} type="button" role="radio" className="ctl ctl-tab" aria-checked={o.value===value} tabIndex={o.value===value?0:-1} onClick={()=>onChange(o.value)} onKeyDown={e=>mover(e,i)}><span className="ctl-label">{o.label}</span></button>)}</div>;
}
