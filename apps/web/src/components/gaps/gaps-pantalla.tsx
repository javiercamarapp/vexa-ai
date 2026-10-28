'use client';
import {useT} from '../i18n/proveedor';
import {ConMarca} from '../ui/brand-mark';
import {RovaqCargando} from '../rovaq-cargando';
import {useState} from 'react';
import {PageHeader} from '../ui/page-header';
import {FilterBar,FilterSpacer} from '../ui/filter-bar';
import {SegmentedControl} from '../ui/segmented';
import {Button,Download,LinkButton} from '../ui/button';
import {Card} from '../ui/card';
import {KpiStrip,type Kpi} from '../ui/kpi-strip';
import {MenuList,Popover} from '../ui/overlay';
import {ErrorState} from '../ui/error-state';
import {Loading} from '../ui/loading';
import {KindBadge} from '../ui/kind-badge';
import {Icon} from '../ui/icons';
import {NoDisponible} from '../refunds/fuga-partes';
import {bajar} from '../refunds/fuga-pantalla';
import {Delta,Fila,MiniPct,Vacio} from '../dinero/partes';
import {CierraBrecha,filtrarIngresos,Familias,GraficoMeses,Intensidad,PanelCanales,PanelFamilias,Puente,TresColumnas,serieVentas,variacionVentas} from './gaps-bloques';
import {EstimadorBrecha,type Supuesto} from './gaps-recs';
import {csvIngresos,csvIntensidad,csvRecomendaciones,proveniencia,resumenHtml} from './gaps-archivos.mjs';
import {NOMBRE,num} from './gaps-modelo.mjs';
import {useGaps} from './use-gaps';
import '../dinero/dinero.css';

const big=(m:string)=>Number(BigInt(m)/100n);
const corto=(n:number)=>n>=1_000_000?`US$${(n/1_000_000).toFixed(2)}M`:n>=1000?`US$${Math.round(n/1000)}k`:`US$${n}`;

/** Pantalla «Brechas de ingreso»: titular, KPI en color, puente de ventas a ingreso retenido, dónde gano / pierdo / podría ganar, tabla «Cierra esta brecha» y ventas vs quejas. Siempre ingreso bruto, nunca margen. */
export function GapsPantalla({organization}:{organization?:string}){
 const t=useT(),g=useGaps(),v=g.data;
 const [per,setPer]=useState<'1'|'3'|'6'|'12'|'todo'>('todo'),[off,setOff]=useState<string[]>([]);
 const [aviso,setAviso]=useState(''),[supuesto,setSupuesto]=useState<Supuesto|null>(null);
 const irA=(id:string)=>{const el=document.getElementById('rec-'+id)??document.getElementById('gp-brecha');el?.scrollIntoView({behavior:'smooth',block:'center'});};
 const bajarArchivo=(a:{nombre:string;mime:string;contenido:string;total:number})=>{bajar(a);setAviso(t('brechas.descargado',{nombre:a.nombre}));};
 const ok=v?.ingresos.status==='ok'?v.ingresos:null;
 const CANAL_C:Record<string,number>={amazon:1,walmart:5,bestbuy:4,shopify:3};
 const todosCanales=ok?[...new Set(ok.meses.flatMap(m=>Object.keys(m.canales)))].sort((a,b)=>(CANAL_C[a]??8)-(CANAL_C[b]??8)):[];
 const activos=todosCanales.filter(c=>!off.includes(c));
 const filtrado=ok?filtrarIngresos(ok,per==='todo'?null:Number(per),activos):null;
 const r=v?.perdidas.reembolsos,c=v?.perdidas.cancelaciones,tr=v?.perdidas.tracker;
 const ventas=ok&&c?.status==='ok'?big(ok.activoMinor)+big(c.canceladoMinor):null;
 const kpis:Kpi[]=v?[
  {label:t('brechas.kVentas'),c:1,value:ok?corto(ventas??big(ok.activoMinor)):'—',spark:serieVentas(ok),note:<span className="dg-kpi-nota"><Delta p={variacionVentas(ok)} sufijo={t('brechas.vsPrevio')}/></span>},
  {label:t('brechas.kCancel'),c:2,value:c?.status==='ok'?corto(big(c.canceladoMinor)):'—',note:c?.status==='ok'?<><MiniPct c={2} p={ventas?big(c.canceladoMinor)*100/ventas:null} label={t('brechas.cancelSobre')}/><span>{t('brechas.lineasPct',{n:num(c.lineas),pct:c.pct!==null?t('brechas.pctLineas',{pct:c.pct.toLocaleString('es-MX',{maximumFractionDigits:1})}):t('brechas.sinDato')})}</span></>:t('brechas.noDisp')},
  {label:t('brechas.kReemb'),c:2,value:r?.status==='ok'?corto(big(r.brutoMinor)):'—',note:r?.status==='ok'?<><MiniPct c={2} p={ok?big(r.activoMinor)*100/Math.max(1,big(ok.activoMinor)):null} label={t('brechas.reembSobre')}/><span>{t('brechas.reembN',{n:num(r.n)})}{r.sinMonto>0?t('brechas.sinMonto',{n:num(r.sinMonto)}):''}</span></>:t('brechas.noDisp')},
  {label:t('brechas.kNoRec'),c:4,value:tr?.status==='ok'?corto(big(tr.negadosMinor)):'—',note:tr?.status==='ok'?<><MiniPct c={4} p={tr.total?tr.negados*100/tr.total:null} label={t('brechas.negadasAria')}/><span>{t('brechas.solicitudesMuestra',{a:num(tr.negados),b:num(tr.total)})}</span></>:t('brechas.sinTracker')},
 ]:[];
 const titular=v&&ok&&r?.status==='ok'&&ventas?t('brechas.titular',{ventas:corto(ventas),quedan:corto(Math.max(0,big(ok.activoMinor)-big(r.activoMinor))),pct:(big(r.activoMinor)*100/Math.max(1,big(ok.activoMinor))).toLocaleString('es-MX',{maximumFractionDigits:1})}):null;
 const exportar=v&&<Popover label={t('brechas.exportarArchivos')} align="end" width={260} triggerClassName="btn btn-secondary" trigger={<><Download/><span className="btn-label">{t('brechas.exportar')}</span></>}>
  <MenuList>
   <li><Button size="sm" icon={<Download/>} disabled={!ok} onClick={()=>bajarArchivo(resumenHtml(v))}>{t('brechas.resumenHtml')}</Button></li>
   <li><Button size="sm" icon={<Download/>} disabled={v.ranking.status!=='ok'} onClick={()=>bajarArchivo(csvIngresos(v))}>{t('brechas.ingresoSku')}</Button></li>
   <li><Button size="sm" icon={<Download/>} disabled={v.intensidad.status!=='ok'} onClick={()=>bajarArchivo(csvIntensidad(v))}>{t('brechas.intensidadCsv')}</Button></li>
   <li><Button size="sm" icon={<Download/>} disabled={v.recomendaciones.items.length===0} onClick={()=>bajarArchivo(csvRecomendaciones(v))}>{t('brechas.recsCsv')}</Button></li></MenuList></Popover>;
 if(!v&&g.busy)return <RovaqCargando mensaje=""/>;
 return <div className="dg-page">
  <PageHeader eyebrow={t('brechas.eyebrow')+(organization?t('brechas.sintetico'):'')} title={t('brechas.titulo')} description={t('brechas.desc')}
   actions={<><LinkButton href="/refunds" variant="secondary">{t('brechas.verFuga')}</LinkButton>{exportar}</>}/>
  {!v&&g.busy&&<Card><Loading message={g.segundos<8?t('brechas.calculando'):t('brechas.calculandoLento',{s:g.segundos})}/></Card>}
  {!v&&!g.busy&&g.error&&<Card><ErrorState title={g.error.code==='acceso'?t('vista.sinAcceso'):t('vista.noDisponible')} body={g.error.texto} onRetry={g.error.code==='acceso'?undefined:()=>g.reload()}/></Card>}
  {v&&<>
   {titular&&<p className="dg-titular">{titular}</p>}
   <KpiStrip items={kpis} label={t('brechas.kpisAria')}/>
   {ok&&todosCanales.length>0&&<FilterBar label={t('brechas.filtrosAria')}>
    <SegmentedControl size="sm" label={t('brechas.periodo')} value={per} onChange={setPer} options={[{value:'1',label:t('brechas.p1')},{value:'3',label:t('brechas.p3')},{value:'6',label:t('brechas.p6')},{value:'12',label:t('brechas.p12')},{value:'todo',label:t('brechas.todo')}]}/>
    {todosCanales.map(c=>{const on=!off.includes(c);return <button key={c} type="button" className="dg-fchip ui-reset" aria-pressed={on} style={{['--cat' as string]:`var(--chart-${CANAL_C[c]??8})`}} onClick={()=>setOff(on?(activos.length>1?[...off,c]:off):off.filter(x=>x!==c))}><ConMarca marca={c}>{NOMBRE[c]??c}</ConMarca></button>;})}
    <FilterSpacer/><span className="dg-sello">{t('brechas.aplica')}</span>
   </FilterBar>}
   <Fila split="8-4">
    <Card title={t('brechas.cIngresoMes')} description={t('brechas.cIngresoMesD')} actions={<KindBadge kind="observed"/>}>
     {v.ingresos.status==='unavailable'?<NoDisponible onRetry={()=>g.reload()}/>:!ok?<Vacio>{t('brechas.sinPedidos')}</Vacio>:<GraficoMeses ing={filtrado??ok}/>}</Card>
    <Card title={t('brechas.cPorCanal')} description={t('brechas.cPorCanalD')} actions={<KindBadge kind="observed"/>}>{ok?<PanelCanales ing={filtrado??ok}/>:<Vacio>{t('brechas.sinCanales')}</Vacio>}</Card>
   </Fila>
   <Fila split="6-6">
    <Card title={t('brechas.cPuente')} description={t('brechas.cPuenteD')} actions={<KindBadge kind="inferred"/>}><Puente v={v}/></Card>
    <Card title={t('brechas.cIntens')} description={t('brechas.cIntensD')} actions={<KindBadge kind="observed"/>}><Intensidad v={v} onReintentar={()=>g.reload()}/></Card>
   </Fila>
   <TresColumnas v={v} onReintentar={()=>g.reload()} irA={irA}/>
   <Card id="gp-brecha" title={t('brechas.cCierra')} description={t('brechas.cCierraD')} actions={<KindBadge kind="inferred"/>}><CierraBrecha v={v} onReintentar={()=>g.reload()} supuesto={supuesto}/></Card>
   <Fila split="8-4">
    <Card title={t('brechas.cFamilias')} description={t('brechas.cFamiliasD')} actions={<KindBadge kind="observed"/>}><Familias v={v} onReintentar={()=>g.reload()}/></Card>
    <Card title={t('brechas.cCobertura')} description={t('brechas.cCoberturaD')}><PanelFamilias v={v}/></Card>
   </Fila>
   <Fila split="6-6">
    <Card title={t('brechas.cRecuperar')} description={t('brechas.cRecuperarD')} actions={<KindBadge kind="estimated"/>}><EstimadorBrecha recs={v.recomendaciones.items} onSupuestos={setSupuesto}/></Card>
    <Card title={t('brechas.cComo')} description={t('brechas.consultaDel',{fecha:v.generatedAt.slice(0,10)})}>
     <ul style={{margin:0,paddingLeft:18,fontSize:13,lineHeight:1.55,color:'var(--ui-secondary)'}}>
      {proveniencia(v).map((x,i)=><li key={i}>{x}</li>)}
      <li>{t('brechas.mesCompleto')}</li>
      <li>{t('brechas.noCalcula')}</li></ul>
     <p className="dg-nota" role="status" aria-live="polite"><Icon name="info" size={12}/> {aviso||t('brechas.avisoArchivos')}</p></Card>
   </Fila>
  </>}
 </div>;
}
