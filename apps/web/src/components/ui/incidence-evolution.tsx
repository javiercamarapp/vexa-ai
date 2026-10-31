'use client';
import {useMemo} from 'react';
import {useIdioma,useLocaleIntl,useT} from '../i18n/proveedor';
import type {MonthlyIncidencesView} from '../../../../../packages/workspace-service/incidences.mjs';
import {insightsProblemaSerie} from '../../lib/legibilidad/insights.mjs';
import {mesAbrev} from '../../lib/charts/escala.mjs';
import {Button,Refresh} from './button';
import {ChartState} from './chart-state';
import {ColumnChart,type ColumnDatum} from './column-chart';
import {EmptyState} from './empty-state';
import {InsightList} from './insight-list';
import {KindBadge} from './kind-badge';
import {useJson} from './use-json';
import {nf} from './format';

const monthLong=(m:string,loc:string)=>new Intl.DateTimeFormat(loc,{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(m+'-01T00:00:00Z'));
const accept=(j:unknown)=>{const d=(j as {data?:MonthlyIncidencesView})?.data;return d&&Array.isArray(d.series)&&typeof d.status==='string'?d:null;};
/** Mini-gráfica de evolución mensual de INCIDENCIAS de un problema agrupado, con lecturas (máx. 3), estados de carga/vacío/error y tabla equivalente. */
export function IncidenceEvolution({problemId}:{problemId:string}){
 const t=useT(),loc=useLocaleIntl(),idioma=useIdioma(),r=useJson<MonthlyIncidencesView>('/api/trends/incidences?problem='+encodeURIComponent(problemId),accept);
 const v=r.data,ok=!!v&&v.status==='ok';
 const insights=useMemo(()=>insightsProblemaSerie(v,new Date(),t),[v,t]);
 const data=useMemo<ColumnDatum[]>(()=>ok?v!.series.map(p=>({key:p.month,label:mesAbrev(p.month,idioma),long:monthLong(p.month,loc),value:p.count,display:t(p.count===1?'tr.ui.incUna':'tr.ui.incVarias',{n:nf.format(p.count)})})):[],[ok,v,t,loc,idioma]);
 const timeout=v?.status==='timeout',reason=timeout?t('tr.ui.evolTimeout'):t('tr.ui.evolVacio');
 return <section className="card" aria-label={t('tr.ui.evolAria')}>
  <div className="card-title"><div><h2>{t('tr.ui.evolTitulo')}</h2><p>{t('tr.ui.evolSub',{meses:12})}</p></div>{ok&&<KindBadge kind="inferred"/>}</div>
  <div className="stack">
   <ChartState busy={r.busy} hasData={ok} error={r.error} status={r.status} que={t('tr.ui.queEvol')} retryLabel={t('tr.ui.evolReintentar')} onRetry={r.reload} height={140}
    empty={timeout?<EmptyState compact art="chart" tone="warn" title={t('hoy.noDisponible')} body={reason} action={<Button size="sm" icon={<Refresh/>} loading={r.busy} onClick={r.reload}>{t('tr.ui.evolReintentar')}</Button>}/>:<EmptyState compact art="chart" title={t('prob.aunSinDatos')} body={reason}/>}>
    {ok&&<><ColumnChart title={t('tr.ui.evolGrafica')} kind="inferred" height={140} data={data} unit={t('tr.ui.incidencias')}/>
     <p className="card-lead">{v!.note}</p></>}
   </ChartState>
   {ok&&<InsightList insights={insights} label={t('tr.ui.evolLecturas')}/>}
  </div>
 </section>;
}
