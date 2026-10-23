'use client';
import {UNIDADES} from '../../lib/legibilidad/unidades.mjs';
import {useMemo,useState,type ReactNode} from 'react';
import {etiquetaCategoria} from '../../lib/legibilidad/categorias.mjs';
import {separarRuidoCategorias} from '../../lib/legibilidad/ruido.mjs';
import {BarList,type BarListItem} from './bar-list';
import {ChartState} from './chart-state';
import {EmptyState} from './empty-state';
import {Button,Refresh} from './button';
import {KindBadge} from './kind-badge';
import {NoiseToggle} from './noise-toggle';
import {nf} from './format';
export type CategoryRow={category:string;count:number};
/** Estado de carga de la API (opcional): con él, la tarjeta muestra esqueleto, error con reintento o «no disponible ahora». */
export type CategoryLoad={busy:boolean;error:string;status:number;onRetry:()=>void};
/** Top de categorías de la IA por volumen de INCIDENCIAS (no de problemas agrupados), con etiquetas en español.
 *  Las notificaciones automáticas se ocultan por defecto (solo presentación) con interruptor y contador.
 *  `kind`: Observado (conteo de una corrida) o Inferido (categorías asignadas por la IA sobre todo el alcance). */
export function CategoryVolume({rows,reason='Aún no hay incidencias clasificadas para mostrar.',unavailable=false,limit=8,title='Categorías con más incidencias',kind='observed',load,totalIncidencias,foot}:{rows:CategoryRow[]|null;reason?:string;unavailable?:boolean;limit?:number;title?:string;kind?:'observed'|'inferred';load?:CategoryLoad;totalIncidencias?:number;foot?:ReactNode}){
 const [incluir,setIncluir]=useState(false);
 const view=useMemo(()=>{
  const clean=(rows??[]).filter(r=>r&&Number.isFinite(r.count)&&r.count>0);
  const merged=[...clean.reduce((m,r)=>m.set(r.category,(m.get(r.category)??0)+r.count),new Map<string,number>())].map(([category,count])=>({category,count}));
  const sep=separarRuidoCategorias(merged,incluir),sorted=[...sep.visibles].sort((a,b)=>b.count-a.count||a.category.localeCompare(b.category));
  return {sorted,top:sorted.slice(0,limit),total:sorted.reduce((n,r)=>n+r.count,0),ocultas:sep.incidenciasOcultas,hayRuido:merged.some(r=>separarRuidoCategorias([r]).gruposOcultos>0)};
 },[rows,incluir,limit]);
 const empty=unavailable?<EmptyState compact art="chart" tone="warn" title="No disponible ahora" body={reason} action={load&&<Button size="sm" icon={<Refresh/>} loading={load.busy} onClick={load.onRetry}>Reintentar categorías</Button>}/>:<EmptyState compact art="chart" title="Aún sin datos" body={reason}/>;
 const noData=!rows||!rows.length||!view.sorted.length&&!view.hayRuido;
 const sub=noData?(load?'Incidencias por categoría · no son problemas agrupados':null):`${nf.format(view.total)} incidencias${totalIncidencias!==undefined&&totalIncidencias!==view.total?` de ${nf.format(totalIncidencias)}`:''} · ${nf.format(view.sorted.length)} categorías · las incidencias no son problemas agrupados`;
 const head=<div className="card-title"><div><h2>{title}</h2>{sub&&<p>{sub}</p>}</div>{!noData&&<KindBadge kind={kind}/>}</div>;
 const max=view.top[0]?.count??1;
 const items:BarListItem[]=view.top.map(r=>({key:r.category,label:etiquetaCategoria(r.category),value:r.count*100/max,display:nf.format(r.count),kind,c:7}));
 const content=<div className="stack">
  {view.hayRuido&&<NoiseToggle incluir={incluir} onChange={setIncluir} ocultos={view.ocultas} unidad="incidencias"/>}
  {items.length?<BarList items={items} wrap c={7} sinMeta/>:<p className="state">Solo hay notificaciones automáticas en este alcance. Actívalas con el interruptor para verlas.</p>}
  {view.sorted.length>view.top.length&&<p className="card-lead">Se muestran las {view.top.length} categorías con más incidencias de {nf.format(view.sorted.length)}.</p>}
  {view.sorted.length>0&&<details className="chart-table"><summary>Ver como tabla</summary><div className="table-wrap" tabIndex={0} role="region" aria-label={'Tabla: '+title}><table><thead><tr><th scope="col">Categoría</th><th scope="col" className="num">Incidencias</th></tr></thead><tbody>{view.sorted.map(r=><tr key={r.category}><th scope="row">{etiquetaCategoria(r.category)}</th><td className="num">{nf.format(r.count)}</td></tr>)}</tbody></table></div></details>}
  {!noData&&<p className="card-lead" data-testid="unidad-categorias">{UNIDADES.incidencias}</p>}{foot}
 </div>;
 return <section className="card" aria-label={title}>
  {head}
  {load?<ChartState busy={load.busy} hasData={!noData} error={load.error} status={load.status} que="las categorías" retryLabel="Reintentar categorías" onRetry={load.onRetry} height={160} empty={empty}>{content}</ChartState>:noData?empty:content}
 </section>;
}
