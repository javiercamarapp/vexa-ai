'use client';
import {useMemo,useState} from 'react';
import type {Bundle} from '../../lib/workspace/contracts';
import type {TrendsView,LedgerMonth} from '../../../../../packages/workspace-service/trends.mjs';
import {formatMinorUnits} from '../../../../../packages/metrics/money.mjs';
import {buildCfoModel,kpiHeadline,ratioBps} from './cfo-model.mjs';
import {epistemicKind} from '../../lib/epistemic.mjs';
import {CountUpMoney} from '../ui/count-up';
import {StatCard,type Delta} from '../ui/stat-card';
import {AreaChart,type AreaPoint} from '../ui/area-chart';
import {ColumnChart,type ColumnDatum} from '../ui/column-chart';
import {BarList,type BarListItem} from '../ui/bar-list';
import {InsightCard} from '../ui/insight-card';
import {SegmentedControl} from '../ui/segmented';
import {KindBadge} from '../ui/kind-badge';
import {SourceRef} from '../ui/source-ref';
import {CoverageBand} from '../ui/coverage-band';
import {EmptyState} from '../ui/empty-state';
import {SkeletonRows} from '../ui/skeletons';
import {LinkButton,Arrow} from '../ui/button';
import {useJson} from '../ui/use-json';
import {nf} from '../ui/format';
import {InsightList} from '../ui/insight-list';
import {ChartState} from '../ui/chart-state';
import {NoiseToggle} from '../ui/noise-toggle';
import {CategoryVolume} from '../ui/category-volume';
import type {CategoriesView} from '../../../../../packages/workspace-service/incidences.mjs';
import {insightsResumen} from '../../lib/legibilidad/insights.mjs';
import {separarRuido} from '../../lib/legibilidad/ruido.mjs';
const ICON:Record<string,string>={exposure:'target',allOrders:'receipt',refunds:'refresh',future_scenario:'layers'};
const monthShort=(m:string)=>new Intl.DateTimeFormat('es-MX',{month:'short',timeZone:'UTC'}).format(new Date(m+'-01T00:00:00Z')).replace('.','');
const monthLong=(m:string)=>new Intl.DateTimeFormat('es-MX',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(m+'-01T00:00:00Z'));
const num=(minor:string,exponent:number)=>Number(BigInt(minor))/10**exponent;
/** Last loaded month vs the previous one, exact via BigInt (one decimal). Null when there is nothing honest to compare. */
function monthDelta(series:LedgerMonth[],measure:'orders'|'refunds'):Delta|null{
 if(series.length<2)return null;const a=BigInt(series[series.length-1][measure].amountMinor),b=BigInt(series[series.length-2][measure].amountMinor);
 if(b<=0n)return null;const tenths=(a-b)*1000n/b,n=Number(tenths)/10;
 return {value:Math.abs(n).toLocaleString('es-MX',{minimumFractionDigits:1,maximumFractionDigits:1})+' %',dir:tenths>0n?'up':tenths<0n?'down':'flat',good:measure==='refunds'?'down':'up'};
}
const acceptTrends=(j:unknown)=>{const d=(j as {data?:TrendsView})?.data;return d?.conversations&&d?.ledger?d:null;};
const acceptCategories=(j:unknown)=>{const d=(j as {data?:CategoriesView})?.data;return d&&Array.isArray(d.rows)&&typeof d.status==='string'?d:null;};
const acceptBundle=(j:unknown)=>{const d=(j as {data?:Bundle})?.data;return d&&Array.isArray(d.items)?d:null;};
type Pick={id:string;title:string;exposure:bigint;display:string;evidence:number;refunds:string|null;coverage:string|null;currency:string;exponent:number};
function topProblems(bundle:Bundle):Pick[]{
 return bundle.items.flatMap(item=>{const m=item.metrics.find(x=>x.kind==='exposure');if(!m||m.amount_minor===null||!/^-?\d+$/.test(m.amount_minor))return [];
  const r=item.metrics.find(x=>x.kind==='refunds'),c=(m as {coverage?:{known_n:number;eligible_n:number}}).coverage;
  return [{id:item.id,title:item.title,exposure:BigInt(m.amount_minor),display:formatMinorUnits(m.amount_minor,m.currency,m.exponent),evidence:item.evidence.length,refunds:r&&r.amount_minor!==null?formatMinorUnits(r.amount_minor,r.currency,r.exponent):null,coverage:c?`${nf.format(c.known_n)} de ${nf.format(c.eligible_n)} registros con importe conocido`:null,currency:m.currency,exponent:m.exponent}];
 }).sort((a,b)=>a.exposure>b.exposure?-1:a.exposure<b.exposure?1:0);
}
export function OverviewDashboard({bundle,pinned}:{bundle:Bundle;pinned:URLSearchParams}){
 const model=useMemo(()=>buildCfoModel(bundle.items),[bundle]);
 const trends=useJson<TrendsView>('/api/trends',acceptTrends);
 const query=pinned.toString();
 const probs=useJson<Bundle>(bundle.meta.snapshot_id?'/api/workspace?resource=problems&'+query:null,acceptBundle);
 const [measure,setMeasure]=useState<'orders'|'refunds'>('orders'),[incluirRuido,setIncluirRuido]=useState(false);
 const cats=useJson<CategoriesView>('/api/trends/categories',acceptCategories);
 const insights=useMemo(()=>insightsResumen({trends:trends.data,categorias:cats.data}),[trends.data,cats.data]);
 if(bundle.meta.state==='empty'||!model.rows.length)return <EmptyState art="chart" title="Sin cifras publicadas para este alcance" body="Revisa el periodo y los filtros, o publica un corte desde las fuentes autorizadas." action={<LinkButton href="/imports" variant="primary" size="sm" icon={<Arrow/>}>Importar datos</LinkButton>} secondary={<LinkButton href="/connections" size="sm">Revisar conexiones</LinkButton>}/>;
 const led=trends.data?.ledger,conv=trends.data?.conversations;
 const ledOk=led&&led.status==='ok'&&led.currency&&led.exponent!==null&&led.exponent!==undefined;
 const sparkOf=(m:'orders'|'refunds',currency:string)=>ledOk&&led!.currency===currency?led!.series.map(s=>num(s[m].amountMinor,led!.exponent!)):undefined;
 const exposure=model.rows.find(r=>r.metric.kind==='exposure'&&r.state==='known'),orders=model.rows.find(r=>/^allorders$/i.test(r.metric.kind)&&r.state==='known');
 const headline=exposure&&orders&&exposure.metric.currency===orders.metric.currency?<>El corte expone <strong>{exposure.display}</strong> de ingresos a problemas con evidencia, frente a <strong>{orders.display}</strong> en órdenes registradas.</>:exposure?<>El corte expone <strong>{exposure.display}</strong> de ingresos a problemas con evidencia.</>:<>Cifras del corte publicado, con su cobertura, su clase y su fuente.</>;
 const areaPoints=(m:'orders'|'refunds'):AreaPoint[]=>ledOk?led!.series.map(s=>({label:monthShort(s.month),long:monthLong(s.month),value:num(s[m].amountMinor,led!.exponent!),display:formatMinorUnits(s[m].amountMinor,led!.currency!,led!.exponent!),detail:`${nf.format(s[m].count)} ${m==='orders'?'pedidos':'reembolsos'}${s[m].unknownAmounts?` · ${s[m].unknownAmounts} sin importe conocido (no se suman)`:''}`})):[];
 const convData:ColumnDatum[]=conv&&conv.status==='ok'?conv.series.map(p=>({key:p.month,label:monthShort(p.month),long:monthLong(p.month),value:p.count,display:nf.format(p.count)+(conv.sampled?' (estimado)':'')+' conversaciones'})):[];
 const sepRuido=probs.data?separarRuido(probs.data.items,i=>[i.title,i.summary,...i.details.map(d=>d.value)],incluirRuido):null;
 const picks=probs.data&&sepRuido?topProblems({...probs.data,items:sepRuido.visibles}):[],top=picks[0],maxExp=top?top.exposure:0n;
 const barItems:BarListItem[]=picks.slice(0,5).map(p=>({key:p.id,label:p.title,value:maxExp>0n?(ratioBps(p.exposure<0n?-p.exposure:p.exposure,maxExp)??0)/100:0,display:p.display,kind:'inferred',href:'/problems/'+p.id+'?'+query}));
 const exposureRow=model.rows.find(r=>r.metric.kind==='exposure');
 const share=top&&exposureRow&&exposureRow.state==='known'&&exposureRow.amount&&BigInt(exposureRow.amount)>0n&&top.exposure<=BigInt(exposureRow.amount)?Number(top.exposure*1000n/BigInt(exposureRow.amount))/10:null;
 return <div className="stack overview">
  <p className="headline">{headline}</p>
  <div className="stat-grid">{model.rows.map(row=>{const h=kpiHeadline(row),kind=epistemicKind(row.metric),m=/^allorders$/i.test(row.metric.kind)?'orders':row.metric.kind==='refunds'?'refunds':null;
   const delta=m&&ledOk&&led!.currency===row.metric.currency?monthDelta(led!.series,m):null,spark=m?sparkOf(m,row.metric.currency):undefined;
   return <StatCard key={row.key} label={row.metric.label} kind={kind} icon={ICON[row.metric.kind]??'dollar'} highlight={row.metric.kind==='exposure'}
    value={row.state==='known'&&!h.label&&row.amount!==null?<CountUpMoney className="stat-value-money" amountMinor={row.amount} currency={row.metric.currency} exponent={row.metric.exponent}/>:<strong>{h.value}</strong>}
    delta={delta??undefined} deltaLabel="Último mes cargado frente al anterior (libro de registros)" spark={spark} sparkLabel={`${row.metric.label}: últimos ${spark?.length??0} meses`}
    foot={<>{h.label?<><strong>{h.label}</strong> · </>:null}{row.coverage.label}{row.subtotal&&!h.label?` · subtotal ${row.subtotal}`:''}</>}/>;})}</div>
  <section className="card" aria-label="Lo más importante">
   <div className="card-title"><div><h2>Lo más importante</h2><p>Hasta tres lecturas con su fuente y su cobertura · no son proyecciones</p></div></div>
   {(trends.busy&&!trends.data)||(cats.busy&&!cats.data)?<div role="status" aria-busy="true"><span className="sr-only">Cargando lecturas…</span><SkeletonRows rows={3}/></div>:<InsightList insights={insights}/>}
  </section>
  <div className="split">
   <section className="card trends" aria-label="Pedidos y reembolsos por mes">
    <div className="card-title"><div><h2>{measure==='orders'?'Pedidos registrados por mes':'Reembolsos liquidados por mes'}</h2><p>Últimos 12 meses{led?.currency?` · ${led.currency}`:''}</p></div><div className="toolbar" style={{margin:0}}>{led&&<KindBadge kind={led.class}/>}<SegmentedControl size="sm" label="Medida del libro económico" value={measure} onChange={setMeasure} options={[{value:'orders',label:'Pedidos'},{value:'refunds',label:'Reembolsos'}]}/></div></div>
    <ChartState busy={trends.busy} hasData={!!trends.data} error={trends.error} status={trends.status} que="las tendencias" retryLabel="Reintentar tendencias" onRetry={trends.reload} height={220}>{trends.data&&(ledOk?<AreaChart title={measure==='orders'?'Pedidos registrados por mes':'Reembolsos liquidados por mes'} series={[{name:measure==='orders'?'Pedidos':'Reembolsos',points:areaPoints(measure)}]} unit={led!.currency??''}/>:<EmptyState compact art="chart" title={led?.status==='timeout'?'No disponible ahora':'Sin cargar'} body={led?.status==='timeout'?'La consulta acotada superó el tiempo permitido. Reintenta en unos segundos.':'Aún no hay pedidos ni reembolsos registrados en los últimos 12 meses.'}/>)}</ChartState>
    {led?.otherCurrencies?.length?<p className="card-lead">Otras monedas ({led.otherCurrencies.join(', ')}) no se suman ni se convierten.</p>:null}{led?.summary?.source==='summary'&&led.summary.label?<p className="card-lead">{led.summary.label}</p>:null}
   </section>
   {top?<InsightCard highlight severity="high" eyebrow="Prioridad con evidencia" title={top.title}
     sentence={<>Concentra <strong>{top.display}</strong> de ingresos expuestos{share!==null?<>, el <strong>{share.toLocaleString('es-MX',{minimumFractionDigits:1,maximumFractionDigits:1})} %</strong> de la exposición global del corte</>:null}. Es una cifra inferida por vínculo de evidencia: no es pérdida.</>}
     signals={[{icon:'message',text:<>{top.evidence} {top.evidence===1?'cita verificable':'citas verificables'}</>},...(top.refunds?[{icon:'refresh',text:<>{top.refunds} en reembolsos liquidados vinculados</>}]:[]),...(top.coverage?[{icon:'database',text:top.coverage}]:[])]}
     footer={<KindBadge kind="inferred"/>} action={<LinkButton href={'/problems/'+top.id+'?'+query} variant="primary" size="sm" icon={<Arrow/>}>Ver evidencia</LinkButton>}/>
    :<section className="card"><div className="card-title"><div><h2>Prioridad con evidencia</h2></div></div>{probs.busy?<SkeletonRows rows={3}/>:<EmptyState compact art="search" title="Sin problemas con importe conocido" body="Cuando un problema tenga exposición publicada, aparecerá aquí con su evidencia."/>}</section>}
  </div>
  <div className="split" data-even>
   <section className="card" aria-label="Conversaciones por mes">
    <div className="card-title"><div><h2>Conversaciones por mes</h2><p>Últimos 12 meses · conteo de registros cargados</p></div>{conv&&<KindBadge kind={conv.class}/>}</div>
    <ChartState busy={trends.busy} hasData={!!trends.data} error={trends.error} status={trends.status} que="las conversaciones" retryLabel="Reintentar conversaciones" onRetry={trends.reload} height={180}>{trends.data&&(convData.length?<><ColumnChart title="Conversaciones por mes" unit="conversaciones" kind={conv!.class} data={convData}/><p className="card-lead">{[conv!.sampled?`Estimado con una muestra del ${conv!.samplePercent??''} %.`:null,'Fecha: inicio o primer mensaje.',conv!.outsideWindow?`${nf.format(conv!.outsideWindow)} fuera de la ventana${conv!.undated?` (${nf.format(conv!.undated)} sin fecha)`:''}.`:null,conv!.summary?.source==='summary'?conv!.summary.label:null].filter(Boolean).join(' ')}</p></>:<EmptyState compact art="inbox" title={conv?.status==='timeout'?'No disponible ahora':'Sin cargar'} body={conv?.status==='timeout'?'Reintenta en unos segundos.':'No hay conversaciones con fecha en los últimos 12 meses.'}/>)}</ChartState>
   </section>
   <section className="card" aria-label="Problemas con más exposición">
    <div className="card-title"><div><h2>Problemas agrupados con más exposición</h2><p>Ingresos expuestos · no se suman entre problemas</p></div><LinkButton href={'/problems?'+query} variant="ghost" size="sm" icon={<Arrow/>}>Ver todos</LinkButton></div>
    <ChartState busy={probs.busy} hasData={!!probs.data} error={probs.error} status={probs.status} que="los problemas" onRetry={probs.reload} height={160}>
     {sepRuido&&(sepRuido.ocultosN>0||incluirRuido)&&<NoiseToggle incluir={incluirRuido} onChange={setIncluirRuido} ocultos={sepRuido.ocultosN} unidad="problemas agrupados"/>}
     {probs.data&&<BarList items={barItems} empty="Aún no hay problemas con importe conocido en este corte."/>}
    </ChartState>
   </section>
  </div>
  <CategoryVolume title="Top categorías" kind="inferred" rows={cats.data?.status==='ok'?cats.data.rows.map(r=>({category:r.category,count:r.count})):null} totalIncidencias={cats.data?.totals?.incidences}
   reason={cats.data?.status==='timeout'?'No disponible ahora: la consulta superó el tiempo permitido. Reintenta en unos segundos.':'Aún no hay incidencias clasificadas en este alcance.'}
   load={{busy:cats.busy,error:cats.error,status:cats.status,onRetry:cats.reload}}
   foot={cats.data?.status==='ok'?<p className="card-lead">{cats.data.note}</p>:undefined}/>
  <CoverageBand/>
  <section className="card" aria-label="Tabla completa de indicadores">
   <div className="card-title"><div><h2>Detalle financiero</h2><p>Valores exactos · los importes no se suman</p></div></div>
   <details className="chart-table"><summary>Ver como tabla</summary><div className="table-wrap" tabIndex={0} role="region" aria-label="Tabla financiera, desplazamiento horizontal"><table><caption className="sr-only">Indicadores del corte y alcance seleccionados. Los importes no se suman.</caption><thead><tr><th scope="col">Indicador</th><th scope="col">Importe total</th><th scope="col">Subtotal conocido</th><th scope="col">Cobertura</th><th scope="col">Procedencia</th></tr></thead><tbody>{model.rows.map(row=><tr key={row.key}><th scope="row">{row.metric.label} <KindBadge metric={row.metric}/><small>{row.recordTitle} · v{row.version}</small></th><td>{row.display}<small>{row.metric.currency} · {String(row.metric.exponent)} decimales</small></td><td>{row.knownSubtotal??'No disponible'}<small>{row.subtotal?'No equivale al total':''}</small></td><td>{row.coverage.label}<small>{(row.metric as {status?:string}).status??(row.state==='known'?'Importe publicado':'No informado')}</small></td><td><SourceRef value={row.metric.source_ref} showLabel={false}/>{row.reasons.length>0&&<small>{row.reasons.join(' · ')}</small>}</td></tr>)}</tbody></table></div></details>
   <details className="chart-table"><summary>Cómo leer estas cifras y su cobertura</summary><p>Los ingresos expuestos no equivalen a pérdida, ahorro ni retorno causal. Órdenes, exposición y reembolsos describen conceptos distintos y no se suman. Un subtotal conocido conserva únicamente los importes disponibles; no sustituye un total desconocido. Un porcentaje de cobertura describe registros con importe conocido, no la proporción del dinero observado.</p><p>{bundle.meta.coverage}</p>{bundle.items.map(item=><div key={item.id}><p>{item.summary}</p><dl className="record-details">{item.details.map((d,i)=><div key={i}><dt>{d.label}</dt><dd>{d.value}</dd></div>)}</dl></div>)}</details>
  </section>
 </div>;
}
