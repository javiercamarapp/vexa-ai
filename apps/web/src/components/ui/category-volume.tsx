'use client';
import {UNIDADES} from '../../lib/legibilidad/unidades.mjs';
import {useMemo,useState,type ReactNode} from 'react';
import {useT} from '../i18n/proveedor';
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
export function CategoryVolume({rows,reason,unavailable=false,limit=8,title,kind='observed',load,totalIncidencias,foot}:{rows:CategoryRow[]|null;reason?:string;unavailable?:boolean;limit?:number;title?:string;kind?:'observed'|'inferred';load?:CategoryLoad;totalIncidencias?:number;foot?:ReactNode}){
 const t=useT(),[incluir,setIncluir]=useState(false);
 const razon=reason??t('tr.ui.catSinInc'),titulo=title??t('tr.ui.catTitulo');
 const view=useMemo(()=>{
  const clean=(rows??[]).filter(r=>r&&Number.isFinite(r.count)&&r.count>0);
  const merged=[...clean.reduce((m,r)=>m.set(r.category,(m.get(r.category)??0)+r.count),new Map<string,number>())].map(([category,count])=>({category,count}));
  const sep=separarRuidoCategorias(merged,incluir),sorted=[...sep.visibles].sort((a,b)=>b.count-a.count||a.category.localeCompare(b.category));
  return {sorted,top:sorted.slice(0,limit),total:sorted.reduce((n,r)=>n+r.count,0),ocultas:sep.incidenciasOcultas,hayRuido:merged.some(r=>separarRuidoCategorias([r]).gruposOcultos>0)};
 },[rows,incluir,limit]);
 const empty=unavailable?<EmptyState compact art="chart" tone="warn" title={t('hoy.noDisponible')} body={razon} action={load&&<Button size="sm" icon={<Refresh/>} loading={load.busy} onClick={load.onRetry}>{t('tr.ui.catReintentar')}</Button>}/>:<EmptyState compact art="chart" title={t('prob.aunSinDatos')} body={razon}/>;
 const noData=!rows||!rows.length||!view.sorted.length&&!view.hayRuido;
 const sub=noData?(load?t('tr.ui.catSubVacio'):null):totalIncidencias!==undefined&&totalIncidencias!==view.total?t('tr.ui.catSubDe',{n:nf.format(view.total),total:nf.format(totalIncidencias),k:nf.format(view.sorted.length)}):t('tr.ui.catSub',{n:nf.format(view.total),k:nf.format(view.sorted.length)});
 const head=<div className="card-title"><div><h2>{titulo}</h2>{sub&&<p>{sub}</p>}</div>{!noData&&<KindBadge kind={kind}/>}</div>;
 const max=view.top[0]?.count??1;
 const items:BarListItem[]=view.top.map(r=>({key:r.category,label:etiquetaCategoria(r.category),value:r.count*100/max,display:nf.format(r.count),kind,c:7}));
 const content=<div className="stack">
  {view.hayRuido&&<NoiseToggle incluir={incluir} onChange={setIncluir} ocultos={view.ocultas} unidad={t('tr.ui.incidencias')}/>}
  {items.length?<BarList items={items} wrap c={7} sinMeta/>:<p className="state">{t('tr.ui.catSoloAuto')}</p>}
  {view.sorted.length>view.top.length&&<p className="card-lead">{t('tr.ui.catMuestra',{n:view.top.length,total:nf.format(view.sorted.length)})}</p>}
  {view.sorted.length>0&&<details className="chart-table"><summary>{t('cfo.serie.verTabla')}</summary><div className="table-wrap" tabIndex={0} role="region" aria-label={t('tr.ui.tabla',{titulo})}><table><thead><tr><th scope="col">{t('tr.ui.thCategoria')}</th><th scope="col" className="num">{t('tr.ui.thIncidencias')}</th></tr></thead><tbody>{view.sorted.map(r=><tr key={r.category}><th scope="row">{etiquetaCategoria(r.category)}</th><td className="num">{nf.format(r.count)}</td></tr>)}</tbody></table></div></details>}
  {!noData&&<p className="card-lead" data-testid="unidad-categorias">{UNIDADES.incidencias}</p>}{foot}
 </div>;
 return <section className="card" aria-label={titulo}>
  {head}
  {load?<ChartState busy={load.busy} hasData={!noData} error={load.error} status={load.status} que={t('tr.ui.queCategorias')} retryLabel={t('tr.ui.catReintentar')} onRetry={load.onRetry} height={160} empty={empty}>{content}</ChartState>:noData?empty:content}
 </section>;
}
