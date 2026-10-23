'use client';
import {useMemo} from 'react';
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
const monthShort=(m:string)=>mesAbrev(m);
const monthLong=(m:string)=>new Intl.DateTimeFormat('es-MX',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(m+'-01T00:00:00Z'));
const accept=(j:unknown)=>{const d=(j as {data?:MonthlyIncidencesView})?.data;return d&&Array.isArray(d.series)&&typeof d.status==='string'?d:null;};
/** Mini-gráfica de evolución mensual de INCIDENCIAS de un problema agrupado, con lecturas (máx. 3), estados de carga/vacío/error y tabla equivalente. */
export function IncidenceEvolution({problemId}:{problemId:string}){
 const r=useJson<MonthlyIncidencesView>('/api/trends/incidences?problem='+encodeURIComponent(problemId),accept);
 const v=r.data,ok=!!v&&v.status==='ok';
 const insights=useMemo(()=>insightsProblemaSerie(v),[v]);
 const data=useMemo<ColumnDatum[]>(()=>ok?v!.series.map(p=>({key:p.month,label:monthShort(p.month),long:monthLong(p.month),value:p.count,display:nf.format(p.count)+(p.count===1?' incidencia':' incidencias')})):[],[ok,v]);
 const timeout=v?.status==='timeout',reason=timeout?'La consulta superó el tiempo permitido. Reintenta en unos segundos.':'Este problema aún no tiene incidencias con conversación fechada.';
 return <section className="card" aria-label="Evolución mensual de incidencias del problema">
  <div className="card-title"><div><h2>Evolución mensual de incidencias</h2><p>Últimos 12 meses · incidencias, no problemas agrupados</p></div>{ok&&<KindBadge kind="inferred"/>}</div>
  <div className="stack">
   <ChartState busy={r.busy} hasData={ok} error={r.error} status={r.status} que="la evolución mensual" retryLabel="Reintentar evolución" onRetry={r.reload} height={140}
    empty={timeout?<EmptyState compact art="chart" tone="warn" title="No disponible ahora" body={reason} action={<Button size="sm" icon={<Refresh/>} loading={r.busy} onClick={r.reload}>Reintentar evolución</Button>}/>:<EmptyState compact art="chart" title="Aún sin datos" body={reason}/>}>
    {ok&&<><ColumnChart title="Incidencias por mes de este problema" kind="inferred" height={140} data={data} unit="incidencias"/>
     <p className="card-lead">{v!.note}</p></>}
   </ChartState>
   {ok&&<InsightList insights={insights} label="Lecturas de la evolución"/>}
  </div>
 </section>;
}
