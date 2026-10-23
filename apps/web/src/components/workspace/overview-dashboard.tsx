'use client';
import {useMemo,useState} from 'react';
import type {Bundle} from '../../lib/workspace/contracts';
import type {TrendsView} from '../../../../../packages/workspace-service/trends.mjs';
import {formatMinorUnits} from '../../../../../packages/metrics/money.mjs';
import {buildCfoModel,kpiHeadline,ratioBps} from './cfo-model.mjs';
import {epistemicKindConCobertura} from '../../lib/epistemic.mjs';
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
import {Icon} from '../ui/icons';
import {WaitStatus} from '../ui/wait-status';
import {ESPERA} from '../../lib/legibilidad/espera.mjs';
import {InsightList} from '../ui/insight-list';
import {ChartState} from '../ui/chart-state';
import {NoiseToggle} from '../ui/noise-toggle';
import {CategoryVolume} from '../ui/category-volume';
import type {CategoriesView} from '../../../../../packages/workspace-service/incidences.mjs';
import {insightsResumen} from '../../lib/legibilidad/insights.mjs';
import {separarRuido} from '../../lib/legibilidad/ruido.mjs';
import {comparacionMensual,ledgerConDatos} from '../../lib/legibilidad/meses.mjs';
import {lineaDatosHasta} from '../../../../../packages/workspace-service/datos-hasta.mjs';
const ICON:Record<string,string>={exposure:'target',allOrders:'receipt',refunds:'refresh',future_scenario:'layers'};
const monthShort=(m:string)=>new Intl.DateTimeFormat('es-MX',{month:'short',timeZone:'UTC'}).format(new Date(m+'-01T00:00:00Z')).replace('.','');
const monthLong=(m:string)=>new Intl.DateTimeFormat('es-MX',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(m+'-01T00:00:00Z'));
const num=(minor:string,exponent:number)=>Number(BigInt(minor))/10**exponent;
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
 const ahora=trends.data?.generatedAt?new Date(trends.data.generatedAt):new Date();
 // Meses completos únicamente: un mes parcial (p. ej. 5 días de octubre) ni se compara ni baja la línea de la tarjeta.
 const cmpOf=(m:'orders'|'refunds',currency:string)=>ledOk&&led!.currency===currency?comparacionMensual(led!.series,m,led!.completeness,ahora):null;
 const parcialLed=led?.completeness?.partialMonths??[],parcialConv=conv?.completeness?.partialMonths??[];
 const dayShort=(d:string)=>new Intl.DateTimeFormat('es-MX',{day:'numeric',month:'long',timeZone:'UTC'}).format(new Date(d+'T00:00:00Z'));
 const exposure=model.rows.find(r=>r.metric.kind==='exposure'&&r.state==='known'),orders=model.rows.find(r=>/^allorders$/i.test(r.metric.kind)&&r.state==='known');
 const headline=exposure&&orders&&exposure.metric.currency===orders.metric.currency?<>El corte expone <strong>{exposure.display}</strong> de ingresos a problemas con evidencia, frente a <strong>{orders.display}</strong> en órdenes registradas.</>:exposure?<>El corte expone <strong>{exposure.display}</strong> de ingresos a problemas con evidencia.</>:<>Cifras del corte publicado, con su cobertura, su clase y su fuente.</>;
 const areaPoints=(m:'orders'|'refunds'):AreaPoint[]=>ledOk?led!.series.map(s=>({label:monthShort(s.month),long:monthLong(s.month),value:num(s[m].amountMinor,led!.exponent!),display:formatMinorUnits(s[m].amountMinor,led!.currency!,led!.exponent!),detail:`${nf.format(s[m].count)} ${m==='orders'?'pedidos':'reembolsos'}${s[m].unknownAmounts?` · ${s[m].unknownAmounts} sin importe conocido (no se suman)`:''}${parcialLed.includes(s.month)?' · mes parcial: no es una caída':''}`,partial:parcialLed.includes(s.month)||undefined})):[];
 const convData:ColumnDatum[]=conv&&conv.status==='ok'?conv.series.map(p=>({key:p.month,label:monthShort(p.month),long:monthLong(p.month)+(parcialConv.includes(p.month)?' (parcial)':''),value:p.count,display:nf.format(p.count)+(conv.sampled?' (estimado)':'')+' conversaciones'+(parcialConv.includes(p.month)?' · mes parcial':''),partial:parcialConv.includes(p.month)||undefined})):[];
 const sepRuido=probs.data?separarRuido(probs.data.items,i=>[i.title,i.summary,...i.details.map(d=>d.value)],incluirRuido):null;
 const picks=probs.data&&sepRuido?topProblems({...probs.data,items:sepRuido.visibles}):[],top=picks[0],maxExp=top?top.exposure:0n;
 const barItems:BarListItem[]=picks.slice(0,5).map(p=>({key:p.id,label:p.title,value:maxExp>0n?(ratioBps(p.exposure<0n?-p.exposure:p.exposure,maxExp)??0)/100:0,display:p.display,kind:'inferred',href:'/problems/'+p.id+'?'+query}));
 const exposureRow=model.rows.find(r=>r.metric.kind==='exposure');
 const share=top&&exposureRow&&exposureRow.state==='known'&&exposureRow.amount&&BigInt(exposureRow.amount)>0n&&top.exposure<=BigInt(exposureRow.amount)?Number(top.exposure*1000n/BigInt(exposureRow.amount))/10:null;
 // Cifras sin registros elegibles: una sola franja que dice qué falta (no cero, no «desconocido» suelto); las cifras con datos (incluidos subtotales parciales rotulados) siguen como tarjetas.
 const sinCob=(row:typeof model.rows[number])=>{const m=/^allorders$/i.test(row.metric.kind)?'orders':row.metric.kind==='refunds'?'refunds':null,cmp=m?cmpOf(m,row.metric.currency):null;return row.coverage.eligible===0||(!!cmp?.sinCobertura&&row.state!=='known');};
 const faltantes=model.rows.filter(sinCob),QUE_FALTA:Record<string,string>={exposure:'faltan los vínculos entre problemas y pedidos',refunds:'no hay reembolsos liquidados elegibles en este corte',allOrders:'no hay pedidos elegibles en este corte'};
 return <div className="stack overview">
  <p className="headline">{headline}</p>
  {faltantes.length>0&&<aside className="notice-bar" data-tone="info" role="note"><Icon name="info" size={14}/><div><strong>{faltantes.length===1?'Una cifra sin cobertura todavía':faltantes.length+' cifras sin cobertura todavía'}</strong><ul>{faltantes.map(f=><li key={f.key}><strong>{f.metric.label}</strong>: {QUE_FALTA[f.metric.kind]??f.coverage.label}. No es cero.</li>)}</ul><p><LinkButton href="/imports" size="sm" icon={<Arrow/>}>Importar datos</LinkButton>{bundle.meta.can_manage&&<> <LinkButton href="/economics" size="sm" variant="ghost" icon={<Arrow/>}>Revisar fuentes y vínculos</LinkButton></>}</p></div></aside>}
  <div className="stat-grid">{model.rows.filter(row=>!sinCob(row)).map(row=>{const h=kpiHeadline(row),m=/^allorders$/i.test(row.metric.kind)?'orders':row.metric.kind==='refunds'?'refunds':null;
   const cmp=m?cmpOf(m,row.metric.currency):null,sinCobertura=row.coverage.eligible===0||!!cmp?.sinCobertura;
   const muestraSinCobertura=row.coverage.eligible===0||(sinCobertura&&row.state!=='known'),kind=epistemicKindConCobertura(row.metric,muestraSinCobertura);
   const delta:Delta|null=!sinCobertura&&cmp?.delta?{...cmp.delta,good:m==='refunds'?'down':'up'}:null,spark=!sinCobertura&&cmp&&m?cmp.meses.map(s=>num(s[m].amountMinor,led!.exponent!)):undefined;
   return <StatCard key={row.key} label={row.metric.label} kind={kind} icon={ICON[row.metric.kind]??'dollar'} highlight={row.metric.kind==='exposure'}
    value={muestraSinCobertura?<strong>Sin cobertura</strong>:row.state==='known'&&!h.label&&row.amount!==null?<CountUpMoney className="stat-value-money" amountMinor={row.amount} currency={row.metric.currency} exponent={row.metric.exponent}/>:<strong>{h.value}</strong>}
    delta={delta??undefined} deltaLabel={`${cmp?.rotulo??'Meses completos'} (libro de registros)`} spark={spark} sparkLabel={`${row.metric.label}: últimos ${spark?.length??0} meses completos`}
    foot={<>{h.label?<><strong>{h.label}</strong> · </>:null}{row.coverage.label}{row.subtotal&&!h.label&&!sinCobertura&&row.coverage.known?` · subtotal ${row.subtotal}`:''}{cmp&&!sinCobertura?<> · <span className="stat-period">{cmp.rotulo}</span></>:null}</>}/>;})}</div>
  <section className="card" aria-label="Lo más importante">
   <div className="card-title"><div><h2>Lo más importante</h2><p>Hasta tres lecturas con su fuente y su cobertura · no son proyecciones</p></div></div>
   {(trends.busy&&!trends.data)||(cats.busy&&!cats.data)?<div role="status" aria-busy="true"><span className="sr-only">Cargando lecturas…</span><SkeletonRows rows={3}/></div>:<InsightList insights={insights}/>}
  </section>
  <div className="split">
   <section className="card trends" aria-label="Pedidos y reembolsos por mes">
    <div className="card-title"><div><h2>{measure==='orders'?'Pedidos registrados por mes':'Reembolsos liquidados por mes'}</h2><p>Últimos 12 meses{led?.currency?` · ${led.currency}`:''}</p></div><div className="toolbar" style={{margin:0}}>{led&&<KindBadge kind={ledOk&&!led.series.some(ledgerConDatos(measure))?'nodata':led.class}/>}<SegmentedControl size="sm" label="Medida del libro económico" value={measure} onChange={setMeasure} options={[{value:'orders',label:'Pedidos'},{value:'refunds',label:'Reembolsos'}]}/></div></div>
    <ChartState busy={trends.busy} hasData={!!trends.data} error={trends.error} status={trends.status} que="las tendencias" retryLabel="Reintentar tendencias" onRetry={trends.reload} height={220}>{trends.data&&(ledOk&&!led!.series.some(ledgerConDatos(measure))?<EmptyState compact art="chart" title="Sin cobertura" body={measure==='orders'?'No hay pedidos registrados en los últimos 12 meses.':'No hay reembolsos registrados en los últimos 12 meses; no se muestra como cero.'}/>:ledOk?<AreaChart title={measure==='orders'?'Pedidos registrados por mes':'Reembolsos liquidados por mes'} series={[{name:measure==='orders'?'Pedidos':'Reembolsos',points:areaPoints(measure)}]} unit={led!.currency??''}/>:<EmptyState compact art="chart" title={led?.status==='timeout'?'No disponible ahora':'Sin cargar'} body={led?.status==='timeout'?'La consulta acotada superó el tiempo permitido. Reintenta en unos segundos.':'Aún no hay pedidos ni reembolsos registrados en los últimos 12 meses.'}/>)}</ChartState>
    {lineaDatosHasta({libro:led?.completeness?.dataThrough,conversaciones:conv?.completeness?.dataThrough})&&<p className="card-lead" data-testid="datos-hasta">{lineaDatosHasta({libro:led?.completeness?.dataThrough,conversaciones:conv?.completeness?.dataThrough})}</p>}
    {parcialLed.length>0?<p className="card-lead">* Mes parcial ({parcialLed.map(monthLong).join(', ')}){led?.completeness?.dataThrough?`: datos hasta el ${dayShort(led.completeness.dataThrough)}`:''}. No es una caída y no se compara con meses completos.</p>:null}{led?.otherCurrencies?.length?<p className="card-lead">Otras monedas ({led.otherCurrencies.join(', ')}) no se suman ni se convierten.</p>:null}{led?.summary?.source==='summary'&&led.summary.label?<p className="card-lead">{led.summary.label}</p>:null}
   </section>
   {top?<InsightCard highlight severity="high" eyebrow="Prioridad con evidencia" title={top.title}
     sentence={<>Concentra <strong>{top.display}</strong> de ingresos expuestos{share!==null?<>, el <strong>{share.toLocaleString('es-MX',{minimumFractionDigits:1,maximumFractionDigits:1})} %</strong> de la exposición global del corte</>:null}. Es una cifra inferida por vínculo de evidencia: no es pérdida.</>}
     signals={[{icon:'message',text:<>{top.evidence} {top.evidence===1?'cita verificable':'citas verificables'}</>},...(top.refunds?[{icon:'refresh',text:<>{top.refunds} en reembolsos liquidados vinculados</>}]:[]),...(top.coverage?[{icon:'database',text:top.coverage}]:[])]}
     footer={<KindBadge kind="inferred"/>} action={<LinkButton href={'/problems/'+top.id+'?'+query} variant="primary" size="sm" icon={<Arrow/>}>Ver evidencia</LinkButton>}/>
    :<section className="card"><div className="card-title"><div><h2>Prioridad con evidencia</h2></div></div>{probs.busy?<WaitStatus {...ESPERA.problemas}/>:<EmptyState compact art="search" title="Sin problemas con importe conocido" body="Cuando un problema tenga exposición publicada, aparecerá aquí con su evidencia. Mientras tanto, los problemas se ordenan por conversaciones." action={<LinkButton href={'/problems?'+query} size="sm" icon={<Arrow/>}>Ver problemas por conversaciones</LinkButton>}/>}</section>}
  </div>
  <div className="split" data-even>
   <section className="card" aria-label="Conversaciones por mes">
    <div className="card-title"><div><h2>Conversaciones por mes</h2><p>Últimos 12 meses · conteo de registros cargados</p></div>{conv&&<KindBadge kind={convData.length?conv.class:'nodata'}/>}</div>
    <ChartState busy={trends.busy} hasData={!!trends.data} error={trends.error} status={trends.status} que="las conversaciones" retryLabel="Reintentar conversaciones" onRetry={trends.reload} height={180}>{trends.data&&(convData.length?<><ColumnChart title="Conversaciones por mes" unit="conversaciones" kind={conv!.class} data={convData}/><p className="card-lead">{[conv!.sampled?`Estimado con una muestra del ${conv!.samplePercent??''} %.`:null,'Fecha: inicio o primer mensaje.',conv!.outsideWindow?`${nf.format(conv!.outsideWindow)} fuera de la ventana${conv!.undated?` (${nf.format(conv!.undated)} sin fecha)`:''}.`:null,conv!.summary?.source==='summary'?conv!.summary.label:null,parcialConv.length?`* Mes parcial (${parcialConv.map(monthLong).join(', ')})${conv!.completeness?.dataThrough?`: datos hasta el ${dayShort(conv!.completeness.dataThrough)}`:''}; no se compara.`:null].filter(Boolean).join(' ')}</p></>:<EmptyState compact art="inbox" title={conv?.status==='timeout'?'No disponible ahora':'Sin cargar'} body={conv?.status==='timeout'?'Reintenta en unos segundos.':'No hay conversaciones con fecha en los últimos 12 meses.'}/>)}</ChartState>
   </section>
   {(probs.busy||!!probs.error||picks.length>0)&&<section className="card" aria-label="Problemas con más exposición">
    <div className="card-title"><div><h2>Problemas agrupados con más exposición</h2><p>Ingresos expuestos · no se suman entre problemas</p></div><LinkButton href={'/problems?'+query} variant="ghost" size="sm" icon={<Arrow/>}>Ver todos</LinkButton></div>
    <ChartState busy={probs.busy} hasData={!!probs.data} error={probs.error} status={probs.status} que="los problemas" onRetry={probs.reload} height={160}>
     {sepRuido&&(sepRuido.ocultosN>0||incluirRuido)&&<NoiseToggle incluir={incluirRuido} onChange={setIncluirRuido} ocultos={sepRuido.ocultosN} unidad="problemas agrupados"/>}
     {probs.data&&<BarList items={barItems} empty="Aún no hay problemas con importe conocido en este corte."/>}
    </ChartState>
   </section>}
  </div>
  <CategoryVolume title="Top categorías" kind="inferred" rows={cats.data?.status==='ok'?cats.data.rows.map(r=>({category:r.category,count:r.count})):null} totalIncidencias={cats.data?.totals?.incidences}
   unavailable={cats.data?.status==='timeout'} reason={cats.data?.status==='timeout'?'La consulta superó el tiempo permitido. Reintenta en unos segundos.':'Aún no hay incidencias clasificadas en este alcance.'}
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
