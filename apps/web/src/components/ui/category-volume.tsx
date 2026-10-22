'use client';
import {useMemo,useState} from 'react';
import {etiquetaCategoria} from '../../lib/legibilidad/categorias.mjs';
import {separarRuidoCategorias} from '../../lib/legibilidad/ruido.mjs';
import {BarList,type BarListItem} from './bar-list';
import {EmptyState} from './empty-state';
import {NoiseToggle} from './noise-toggle';
import {nf} from './format';
export type CategoryRow={category:string;count:number};
/** Top de categorías de la IA por volumen de INCIDENCIAS (no de problemas agrupados), con etiquetas en español.
 *  Las notificaciones automáticas se ocultan por defecto (solo presentación) con interruptor y contador. */
export function CategoryVolume({rows,reason='Aún no hay incidencias clasificadas para mostrar.',limit=8,title='Categorías con más incidencias'}:{rows:CategoryRow[]|null;reason?:string;limit?:number;title?:string}){
 const [incluir,setIncluir]=useState(false);
 const view=useMemo(()=>{
  const clean=(rows??[]).filter(r=>r&&Number.isFinite(r.count)&&r.count>0);
  const merged=[...clean.reduce((m,r)=>m.set(r.category,(m.get(r.category)??0)+r.count),new Map<string,number>())].map(([category,count])=>({category,count}));
  const sep=separarRuidoCategorias(merged,incluir),sorted=[...sep.visibles].sort((a,b)=>b.count-a.count||a.category.localeCompare(b.category));
  return {sorted,top:sorted.slice(0,limit),total:sorted.reduce((n,r)=>n+r.count,0),ocultas:sep.incidenciasOcultas,hayRuido:merged.some(r=>separarRuidoCategorias([r]).gruposOcultos>0)};
 },[rows,incluir,limit]);
 if(!rows||!rows.length||!view.sorted.length&&!view.hayRuido)return <section className="card" aria-label={title}><div className="card-title"><div><h2>{title}</h2></div></div><EmptyState compact art="chart" title="Aún sin datos" body={reason}/></section>;
 const max=view.top[0]?.count??1;
 const items:BarListItem[]=view.top.map(r=>({key:r.category,label:etiquetaCategoria(r.category),value:r.count*100/max,display:nf.format(r.count),kind:'observed'}));
 return <section className="card" aria-label={title}>
  <div className="card-title"><div><h2>{title}</h2><p>{nf.format(view.total)} incidencias · {nf.format(view.sorted.length)} categorías · las incidencias no son problemas agrupados</p></div></div>
  <div className="stack">
   {view.hayRuido&&<NoiseToggle incluir={incluir} onChange={setIncluir} ocultos={view.ocultas} unidad="incidencias"/>}
   {items.length?<BarList items={items}/>:<p className="state">Solo hay notificaciones automáticas en este alcance. Actívalas con el interruptor para verlas.</p>}
   {view.sorted.length>view.top.length&&<p className="card-lead">Se muestran las {view.top.length} categorías con más incidencias de {nf.format(view.sorted.length)}.</p>}
  </div>
 </section>;
}
