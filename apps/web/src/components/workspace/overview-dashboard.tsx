'use client';
import {RovaqCargando} from '../rovaq-cargando';
import {useEffect,useMemo,useState,type ReactNode} from 'react';
import type {Bundle} from '../../lib/workspace/contracts';
import type {TrendsView} from '../../../../../packages/workspace-service/trends.mjs';
import {formatMinorUnits} from '../../lib/formato/dinero-pantalla.mjs';
import {buildCfoModel,ratioBps} from './cfo-model.mjs';
import {AreaChart,type AreaPoint} from '../ui/area-chart';
import {ColumnChart,type ColumnDatum} from '../ui/column-chart';
import {BarList,type BarListItem} from '../ui/bar-list';
import {InsightCard} from '../ui/insight-card';
import {SegmentedControl} from '../ui/segmented';
import {KindBadge} from '../ui/kind-badge';
import {SourceRef} from '../ui/source-ref';
import {CoverageBand} from '../ui/coverage-band';
import {EmptyState} from '../ui/empty-state';
import {LineaCache} from '../ui/linea-cache';
import {useVistaPersistente} from './vista-persistente';
import {LinkButton,Arrow} from '../ui/button';
import {useJson} from '../ui/use-json';
import {nf} from '../ui/format';
import {Icon} from '../ui/icons';
import {Chip,ChipList} from '../ui/chip';
import {InsightList} from '../ui/insight-list';
import {ChartState} from '../ui/chart-state';
import {NoiseToggle} from '../ui/noise-toggle';
import {CategoryVolume} from '../ui/category-volume';
import type {CategoriesView} from '../../../../../packages/workspace-service/incidences.mjs';
import {insightsResumen} from '../../lib/legibilidad/insights.mjs';
import {separarRuido} from '../../lib/legibilidad/ruido.mjs';
import {comparacionMensual,ledgerConDatos} from '../../lib/legibilidad/meses.mjs';
import {precalentarPantallas,PANTALLAS_PRINCIPALES} from '../../lib/workspace/precalentar.mjs';
import {consultaAlcance} from '../../lib/workspace/alcance.mjs';
import {lineaAvisos} from '../../lib/legibilidad/resumen-ejecutivo.mjs';
import {StatusStrip,TopProblems,HowCalculated,useCriticos,acceptCoverage} from './executive';
import type {CoverageView} from '../../../../../packages/workspace-service/provenance.mjs';
import {kpiConversaciones,estadoFuentes,mesesCoberturaBaja,coberturaDeTendencias,avisosCoherentes} from '../../lib/legibilidad/resumen-ejecutivo.mjs';
import {useT,useIdioma,useLocaleIntl} from '../i18n/proveedor';
import {fecha} from '../../lib/i18n/formato';
import type {Traductor} from '../../lib/i18n';
const monthShortL=(loc:string,m:string)=>new Intl.DateTimeFormat(loc,{month:'short',timeZone:'UTC'}).format(new Date(m+'-01T00:00:00Z')).replace('.','');
const monthLongL=(loc:string,m:string)=>new Intl.DateTimeFormat(loc,{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(m+'-01T00:00:00Z'));
const num=(minor:string,exponent:number)=>Number(BigInt(minor))/10**exponent;
const acceptTrends=(j:unknown)=>{const d=(j as {data?:TrendsView})?.data;return d?.conversations&&d?.ledger?d:null;};
const acceptCategories=(j:unknown)=>{const d=(j as {data?:CategoriesView})?.data;return d&&Array.isArray(d.rows)&&typeof d.status==='string'?d:null;};
const acceptBundle=(j:unknown)=>{const d=(j as {data?:Bundle})?.data;return d&&Array.isArray(d.items)?d:null;};
type Pick={id:string;title:string;exposure:bigint;display:string;evidence:number;refunds:string|null;coverage:string|null;currency:string;exponent:number};
function topProblems(bundle:Bundle,t:Traductor):Pick[]{
 return bundle.items.flatMap(item=>{const m=item.metrics.find(x=>x.kind==='exposure');if(!m||m.amount_minor===null||!/^-?\d+$/.test(m.amount_minor))return [];
  const r=item.metrics.find(x=>x.kind==='refunds'),c=(m as {coverage?:{known_n:number;eligible_n:number}}).coverage;
  return [{id:item.id,title:item.title,exposure:BigInt(m.amount_minor),display:formatMinorUnits(m.amount_minor,m.currency,m.exponent),evidence:item.evidence.length,refunds:r&&r.amount_minor!==null?formatMinorUnits(r.amount_minor,r.currency,r.exponent):null,coverage:c?t('res.cobImporteConocido',{a:nf.format(c.known_n),b:nf.format(c.eligible_n)}):null,currency:m.currency,exponent:m.exponent}];
 }).sort((a,b)=>a.exposure>b.exposure?-1:a.exposure<b.exposure?1:0);
}
export function OverviewDashboard({bundle,pinned,avisos=[],cache}:{bundle:Bundle;pinned:URLSearchParams;avisos?:{key:string;node:ReactNode}[];cache?:{edadMs:number|null;actualizando:boolean;viejo:boolean}}){
 const t=useT(),idioma=useIdioma(),loc=useLocaleIntl(),monthShort=(m:string)=>monthShortL(loc,m),monthLong=(m:string)=>monthLongL(loc,m),pct1=(v:number)=>v.toLocaleString(loc,{minimumFractionDigits:1,maximumFractionDigits:1});
 const model=useMemo(()=>buildCfoModel(bundle.items),[bundle]);
 const trends=useJson<TrendsView>('/api/trends',acceptTrends);
 const query=pinned.toString();
 const probs=useJson<Bundle>(bundle.meta.snapshot_id?'/api/workspace?resource=problems&slim=1&'+query:null,acceptBundle);
 const [measure,setMeasure]=useVistaPersistente<'orders'|'refunds'>('resumen:medida','orders'),[incluirRuido,setIncluirRuido]=useState(false);
 const cats=useJson<CategoriesView>('/api/trends/categories',acceptCategories);
 const cobertura=useJson<CoverageView>('/api/coverage',acceptCoverage),crit=useCriticos(query),[verCobertura,setVerCobertura]=useState(false);
 // Con el Resumen ya pintado, en inactividad: precalienta (prioridad baja, máx. 2 a la vez) las pantallas principales para que abran al instante.
 // Solo cuando las lecturas propias del Resumen terminaron: el precalentamiento nunca compite con ellas.
 const quieto=!trends.busy&&!probs.busy&&!cats.busy&&!cobertura.busy;
 useEffect(()=>{if(!quieto)return;const alcance=consultaAlcance(query);const ir=()=>{precalentarPantallas(PANTALLAS_PRINCIPALES,alcance);};const w=window as Window&{requestIdleCallback?:(f:()=>void,o?:{timeout:number})=>number;cancelIdleCallback?:(h:number)=>void};if(w.requestIdleCallback){const h=w.requestIdleCallback(ir,{timeout:4000});return()=>w.cancelIdleCallback?.(h);}const tm=setTimeout(ir,1500);return()=>clearTimeout(tm);},[query,quieto]);
 const insights=insightsResumen({trends:trends.data,categorias:cats.data,t,loc});
 if(bundle.meta.state==='empty'||!model.rows.length)return <EmptyState art="chart" title={t('res.sinCifras')} body={t('res.revisaPeriodo')} action={<LinkButton href="/imports" variant="primary" size="sm" icon={<Arrow/>}>{t('res.importarDatos')}</LinkButton>} secondary={<LinkButton href="/connections" size="sm">{t('res.revisarConexiones')}</LinkButton>}/>;
 const led=trends.data?.ledger,conv=trends.data?.conversations;
 const ledOk=led&&led.status==='ok'&&led.currency&&led.exponent!==null&&led.exponent!==undefined;
 const ahora=trends.data?.generatedAt?new Date(trends.data.generatedAt):new Date();
 // Meses completos únicamente: un mes parcial (p. ej. 5 días de octubre) ni se compara ni baja la línea de la tarjeta.
 const cmpOf=(m:'orders'|'refunds',currency:string)=>ledOk&&led!.currency===currency?comparacionMensual(led!.series,m,led!.completeness,ahora):null;
 const parcialLed=led?.completeness?.partialMonths??[],parcialConv=conv?.completeness?.partialMonths??[],bajaConv=[...mesesCoberturaBaja(conv,ahora).keys()];
 const dayShort=(d:string)=>new Intl.DateTimeFormat(loc,{day:'numeric',month:'long',timeZone:'UTC'}).format(new Date(d+'T00:00:00Z'));
 const exposure=model.rows.find(r=>r.metric.kind==='exposure'&&r.state==='known');
 const areaPoints=(m:'orders'|'refunds'):AreaPoint[]=>ledOk?led!.series.map(s=>({label:monthShort(s.month),long:monthLong(s.month),value:num(s[m].amountMinor,led!.exponent!),display:formatMinorUnits(s[m].amountMinor,led!.currency!,led!.exponent!),detail:`${nf.format(s[m].count)} ${m==='orders'?t('res.pedidosMin'):t('res.reembolsosMin')}${s[m].unknownAmounts?' · '+t('res.sinImporteConocido',{n:s[m].unknownAmounts}):''}${parcialLed.includes(s.month)?' · '+t('res.mesParcialNoCaida'):''}`,partial:parcialLed.includes(s.month)||undefined})):[];
 const convData:ColumnDatum[]=conv&&conv.status==='ok'?conv.series.map(p=>({key:p.month,label:monthShort(p.month),long:monthLong(p.month)+(parcialConv.includes(p.month)?' '+t('res.parcialP'):bajaConv.includes(p.month)?' '+t('res.coberturaBajaP'):''),value:p.count,display:nf.format(p.count)+(conv.sampled?' '+t('res.estimadoP'):'')+' '+t('prob.convN')+(parcialConv.includes(p.month)?' · '+t('res.mesParcial'):bajaConv.includes(p.month)?' · '+t('res.coberturaBajaNota'):''),partial:parcialConv.includes(p.month)||bajaConv.includes(p.month)||undefined})):[];
 const sepRuido=probs.data?separarRuido(probs.data.items,i=>[i.title,i.summary,...i.details.map(d=>d.value)],incluirRuido):null;
 const picks=probs.data&&sepRuido?topProblems({...probs.data,items:sepRuido.visibles},t):[],top=picks[0],maxExp=top?top.exposure:0n;
 const barItems:BarListItem[]=picks.slice(0,5).map(p=>({key:p.id,label:p.title,value:maxExp>0n?(ratioBps(p.exposure<0n?-p.exposure:p.exposure,maxExp)??0)/100:0,display:p.display,kind:'inferred',c:7,note:`${p.evidence} ${t(p.evidence===1?'res.citaVerif1':'res.citaVerifN')}${p.refunds?' · '+t('res.enReembolsosVinc',{x:p.refunds}):''}`,href:'/problems/'+p.id+'?'+query}));
 const exposureRow=model.rows.find(r=>r.metric.kind==='exposure');
 const share=top&&exposureRow&&exposureRow.state==='known'&&exposureRow.amount&&BigInt(exposureRow.amount)>0n&&top.exposure<=BigInt(exposureRow.amount)?Number(top.exposure*1000n/BigInt(exposureRow.amount))/10:null;
 // Cifras sin registros elegibles: una sola franja que dice qué falta (no cero, no «desconocido» suelto); las cifras con datos (incluidos subtotales parciales rotulados) siguen como tarjetas.
 const sinCob=(row:typeof model.rows[number])=>{const m=/^allorders$/i.test(row.metric.kind)?'orders':row.metric.kind==='refunds'?'refunds':null,cmp=m?cmpOf(m,row.metric.currency):null;return row.coverage.eligible===0||(!!cmp?.sinCobertura&&row.state!=='known');};
 const faltantes=model.rows.filter(sinCob),QUE_FALTA:Record<string,string>={exposure:t('res.faltaExposure'),refunds:t('res.faltaRefunds'),allOrders:t('res.faltaOrders')};

 const kc=kpiConversaciones(conv,ahora,{t,loc}),cobA=coberturaDeTendencias(conv),fuentes=estadoFuentes(cobertura.data,{libro:led?.completeness?.dataThrough??null,conversaciones:conv?.completeness?.dataThrough??null,t,loc});
 const lineaHasta=(()=>{const parts=[['libro',led?.completeness?.dataThrough],['conversaciones',conv?.completeness?.dataThrough]] as const;const xs=parts.filter(([,v])=>v!==undefined).map(([k,v])=>{const m=typeof v==='string'?/^(\d{4})-(\d{2})-(\d{2})/.exec(v):null;const dia=m&&Number(m[2])>=1&&Number(m[2])<=12?fecha(idioma,v as string):null;const et=t(k==='libro'?'res.fuenteLibro':'res.fuenteConv');return et+': '+(dia?t('res.datosHastaEl',{dia}):t('res.sinFechaCorte'));});return xs.length?xs.join(' · ')+(xs.length>1?'. '+t('res.cadaFuente'):''):'';})();
 const cc=bundle.meta.critical_counts??null,conteoCriticos=crit.datos?{groups:crit.datos.groups??0,signals:crit.datos.signals}:cc&&typeof cc.groups==='number'?{groups:cc.groups,signals:cc.signals??null}:null;
 const avisosOk=avisosCoherentes(avisos,conteoCriticos);
 // Una sola línea para todo lo que salió de la caché (en vez de una por tarjeta): la más antigua manda.
 const lecturas=[trends,probs,cats,cobertura,...(cache?[cache]:[])],conCache=lecturas.filter(l=>l.edadMs!==null),edadMax=conCache.length?Math.max(...conCache.map(l=>l.edadMs as number)):null,algunaActualizando=conCache.some(l=>l.actualizando),algunaVieja=lecturas.some(l=>l.viejo);
 return <div className="stack overview">
  <StatusStrip linea={lineaAvisos({critico:avisos.some(a=>a.key==='critico'),pendiente:avisosOk.some(a=>a.key==='pendiente'),parcialCarga:avisos.some(a=>a.key==='parcial'),faltantes:faltantes.map(f=>f.metric.label),conv,led,ahora,t,loc})} fuentes={fuentes} cargando={cobertura.busy} dineroDisponible={!!exposure} onCobertura={()=>setVerCobertura(v=>!v)} avisos={[...avisosOk,...(faltantes.length>0?[{key:'faltantes',node:<aside className="notice-bar" data-tone="info" role="note"><Icon name="info" size={14}/><div><strong>{faltantes.length===1?t('res.unaCifraSinCob'):t('res.nCifrasSinCob',{n:faltantes.length})}</strong><ul>{faltantes.map(f=><li key={f.key}><strong>{f.metric.label}</strong>: {QUE_FALTA[f.metric.kind]??f.coverage.label}. {t('res.noEsCero')}</li>)}</ul><p><LinkButton href="/imports" size="sm" icon={<Arrow/>}>{t('res.importarDatos')}</LinkButton>{bundle.meta.can_manage&&<> <LinkButton href="/economics" size="sm" variant="ghost" icon={<Arrow/>}>{t('prob.revisarFuentes')}</LinkButton></>}</p></div></aside>}]:[])]}/>
  {verCobertura&&<CoverageBand/>}
  <div className="ov-fila ov-6-6 ov-r1">
   <section className="card trends" aria-label={t('res.pedidosYReembolsos')}>
    <div className="card-title"><div><h2>{measure==='orders'?t('res.pedidosPorMes'):t('res.reembolsosPorMes')}</h2><p>{t('res.ultimos12M')}{led?.currency?` · ${led.currency}`:''}</p></div><div className="toolbar" style={{margin:0}}>{led&&<KindBadge kind={ledOk&&!led.series.some(ledgerConDatos(measure))?'nodata':led.class}/>}<SegmentedControl size="sm" label={t('res.medidaLibro')} value={measure} onChange={setMeasure} options={[{value:'orders',label:t('res.pedidos')},{value:'refunds',label:t('res.reembolsos')}]}/></div></div>
    <ChartState busy={trends.busy} hasData={!!trends.data} error={trends.error} status={trends.status} que={t('res.lasTendencias')} retryLabel={t('res.reintentarTendencias')} onRetry={trends.reload} height={150}>{trends.data&&(ledOk&&!led!.series.some(ledgerConDatos(measure))?<EmptyState compact art="chart" title={t('res.sinCobertura')} body={measure==='orders'?t('res.noHayPedidos12'):t('res.noHayReembolsos12')}/>:ledOk?<AreaChart height="fill" title={measure==='orders'?t('res.pedidosPorMes'):t('res.reembolsosPorMes')} series={[{name:measure==='orders'?t('res.pedidos'):t('res.reembolsos'),points:areaPoints(measure)}]} unit={led!.currency??''}/>:<EmptyState compact art="chart" title={led?.status==='timeout'?t('prob.noDispAhoraC'):t('res.sinCargar')} body={led?.status==='timeout'?t('res.consultaAcotada'):t('res.aunNoPedidosNiReemb')}/>)}</ChartState>
    {lineaHasta&&<p className="card-lead" data-testid="datos-hasta">{lineaHasta}</p>}
    {parcialLed.length>0?<p className="card-lead">* {t('res.mesParcialLbl')} ({parcialLed.map(monthLong).join(', ')}){led?.completeness?.dataThrough?`: ${t('res.datosHastaEl',{dia:dayShort(led.completeness.dataThrough)})}`:''}. {t('res.noEsCaidaNoCompara')}</p>:null}{led?.otherCurrencies?.length?<p className="card-lead">{t('res.otrasMonedas',{m:led.otherCurrencies.join(', ')})}</p>:null}{led?.summary?.source==='summary'&&led.summary.label?<p className="card-lead">{led.summary.label}</p>:null}
   </section>
  <TopProblems items={probs.data?probs.data.items:null} query={query} cargando={probs.busy} error={probs.error} onRetry={probs.reload} criticos={conteoCriticos}/>
  </div>
  <div className="ov-fila ov-4-4-4 ov-r2">
   <section className="card" aria-label={t('prob.convPorMes')}>
    <div className="card-title"><div><h2>{t('prob.convPorMes')}</h2><p>{t('res.ultimos12Conteo')}</p></div>{conv&&<KindBadge kind={convData.length?conv.class:'nodata'}/>}</div>
    {(kc||cobA.pct!==null)&&<ChipList label={t('res.cifrasConv')} items={[...(kc&&kc.valor!==null?[{key:'v',node:<Chip categoria={5}>{nf.format(kc.valor)} {t('prob.convN')}{kc.delta?' · '+kc.delta.value:''}</Chip>}]:[]),...(cobA.pct!==null?[{key:'ia',node:<Chip categoria={5}>{t('res.analizadasIA')} {pct1(cobA.pct)} %</Chip>}]:[])]}/>}
    <ChartState busy={trends.busy} hasData={!!trends.data} error={trends.error} status={trends.status} que={t('res.lasConversaciones')} retryLabel={t('res.reintentarConv')} onRetry={trends.reload} height={180}>{trends.data&&(convData.length?<><ColumnChart title={t('prob.convPorMes')} unit={t('prob.convUnidad')} kind={conv!.class} data={convData}/><p className="card-lead">{[conv!.sampled?t('res.estimadoMuestra',{p:conv!.samplePercent??''}):null,t('res.fechaInicio'),conv!.outsideWindow?t('res.fueraVentana',{n:nf.format(conv!.outsideWindow)})+(conv!.undated?' ('+t('res.sinFecha',{n:nf.format(conv!.undated)})+')':'')+'.':null,conv!.summary?.source==='summary'?conv!.summary.label:null,parcialConv.length?`* ${t('res.mesParcialLbl')} (${parcialConv.map(monthLong).join(', ')})${conv!.completeness?.dataThrough?`: ${t('res.datosHastaEl',{dia:dayShort(conv!.completeness.dataThrough)})}`:''}; ${t('res.noSeCompara')}`:null,bajaConv.length?`* ${t('res.coberturaBajaDetalle',{meses:bajaConv.map(monthLong).join(', ')})}`:null].filter(Boolean).join(' ')}</p></>:<EmptyState compact art="inbox" title={conv?.status==='timeout'?t('prob.noDispAhoraC'):t('res.sinCargar')} body={conv?.status==='timeout'?t('res.reintentaSegundos'):t('res.noConvFecha12')}/>)}</ChartState>
   </section>
   {(probs.busy||!!probs.error||picks.length>0)&&<section className="card" aria-label={t('res.problemasMasExposicion')}>
    <div className="card-title"><div><h2>{t('res.problemasAgrupMasExp')}</h2><p>{t('res.ingresosExpNoSuman')}</p></div><KindBadge kind="inferred"/></div>
    <ChartState busy={probs.busy} hasData={!!probs.data} error={probs.error} status={probs.status} que={t('res.losProblemas')} onRetry={probs.reload} height={160}>
     {sepRuido&&(sepRuido.ocultosN>0||incluirRuido)&&<NoiseToggle incluir={incluirRuido} onChange={setIncluirRuido} ocultos={sepRuido.ocultosN} unidad={t('res.problemasAgrupados')}/>}
     {probs.data&&<BarList items={barItems} sinMeta empty={t('res.aunNoProbImporte')}/>}
     <div className="ov-pie-link"><LinkButton href={'/problems?'+query} variant="ghost" size="sm" icon={<Arrow/>}>{t('res.verTodosProblemas')}</LinkButton></div>
    </ChartState>
   </section>}
   {top?<InsightCard highlight severity="high" eyebrow={t('res.prioridadEvidencia')} title={top.title}
     sentence={<>{t('res.concentra')} <strong>{top.display}</strong> {t('res.deIngresosExp')}{share!==null?<>, {t('res.el')} <strong>{pct1(share)} %</strong> {t('res.deExpGlobal')}</>:null}. {t('res.cifraInferida')}</>}
     signals={[{icon:'message',text:<>{top.evidence} {t(top.evidence===1?'res.citaVerif1':'res.citaVerifN')}</>},...(top.refunds?[{icon:'refresh',text:<>{t('res.enReembolsosLiq',{x:top.refunds})}</>}]:[]),...(top.coverage?[{icon:'database',text:top.coverage}]:[])]}
     footer={<KindBadge kind="inferred"/>} action={<LinkButton href={'/problems/'+top.id+'?'+query} variant="primary" size="sm" icon={<Arrow/>}>{t('res.verEvidencia')}</LinkButton>}/>
    :null}
  </div>
  <div className="ov-fila ov-6-6 ov-r3">
  <CategoryVolume limit={6} title={t('res.topCategorias')} kind="inferred" rows={cats.data?.status==='ok'?cats.data.rows.map(r=>({category:r.category,count:r.count})):null} totalIncidencias={cats.data?.totals?.incidences}
   unavailable={cats.data?.status==='timeout'} reason={cats.data?.status==='timeout'?t('res.consultaSuperoTiempo'):t('res.aunNoIncidencias')}
   load={{busy:cats.busy,error:cats.error,status:cats.status,onRetry:cats.reload}}
   foot={cats.data?.status==='ok'?<p className="card-lead">{cats.data.note}</p>:undefined}/>
  <section className="card" aria-label={t('prob.loMasImportante')}>
   <div className="card-title"><div><h2>{t('prob.loMasImportante')}</h2><p>{t('res.hastaTresLecturas')}</p></div></div>
   {(trends.busy&&!trends.data)||(cats.busy&&!cats.data)?<RovaqCargando compacto mensaje={t('res.cargandoLecturas')}/>:<InsightList insights={insights}/>}
  </section>
  </div>
  <div className="ov-pie">
  <LineaCache edadMs={edadMax} actualizando={algunaActualizando} viejo={algunaVieja}/>
  <HowCalculated><section aria-label={t('res.tablaCompleta')}>
   <div className="card-title"><div><h2>{t('res.detalleFin')}</h2><p>{t('res.valoresExactos')}</p></div></div>
   <details className="chart-table"><summary>{t('res.verComoTabla')}</summary><div className="table-wrap" tabIndex={0} role="region" aria-label={t('res.tablaFinScroll')}><table><caption className="sr-only">{t('res.captionIndicadores')}</caption><thead><tr><th scope="col">{t('res.indicador')}</th><th scope="col">{t('res.importeTotal')}</th><th scope="col">{t('res.subtotalConocido')}</th><th scope="col">{t('res.cobertura')}</th><th scope="col">{t('res.procedencia')}</th></tr></thead><tbody>{model.rows.map(row=><tr key={row.key}><th scope="row">{row.metric.label} <KindBadge metric={row.metric}/><small>{row.recordTitle} · v{row.version}</small></th><td>{row.display}<small>{row.metric.currency} · {t('res.decimales',{n:String(row.metric.exponent)})}</small></td><td>{row.knownSubtotal??t('prob.noDisp')}<small>{row.subtotal?t('res.noEquivaleTotal'):''}</small></td><td>{row.coverage.label}<small>{(row.metric as {status?:string}).status??(row.state==='known'?t('res.importePublicado'):t('res.noInformado'))}</small></td><td><SourceRef value={row.metric.source_ref} showLabel={false}/>{row.reasons.length>0&&<small>{row.reasons.join(' · ')}</small>}</td></tr>)}</tbody></table></div></details>
   <details className="chart-table"><summary>{t('res.comoLeer')}</summary><p>{t('res.comoLeerTexto')}</p><p>{bundle.meta.coverage}</p>{bundle.items.map(item=><div key={item.id}><p>{item.summary}</p><dl className="record-details">{item.details.map((d,i)=><div key={i}><dt>{d.label}</dt><dd>{d.value}</dd></div>)}</dl></div>)}</details>
  </section></HowCalculated>
  </div>
 </div>;
}
