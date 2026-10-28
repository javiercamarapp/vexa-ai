'use client';
import {useT,useIdioma} from '../i18n/proveedor';
import {LOCALE_INTL} from '../../lib/i18n';
import {ConMarca} from '../ui/brand-mark';
import {RovaqCargando} from '../rovaq-cargando';
import {porcentaje} from '../../lib/formato/es-mx.mjs';
import {useMemo,useState,type ReactNode} from 'react';
import type {Bundle} from '../../lib/workspace/contracts';
import type {CfoReport} from '../../../../../packages/cfo-copilot/src/index.mjs';
import {formatMinorUnits} from '../../lib/formato/dinero-pantalla.mjs';
import {urlCortePublicado,resumenCorte,serieMensual,tarjetasPorMoneda,filasPorFuente,mesesIncompletos} from '../../lib/legibilidad/dinero.mjs';
import {PageHeader} from '../ui/page-header';
import {Card} from '../ui/card';
import {KpiStrip,type Kpi} from '../ui/kpi-strip';
import {Notice} from '../ui/notice';
import {DataTable} from '../ui/data-table';
import {Fila,ListaBarras} from '../dinero/partes';
import {KindBadge} from '../ui/kind-badge';
import {StatusChip} from '../ui/status-chip';
import {ColumnChart,type ColumnDatum} from '../ui/column-chart';
import {SegmentedControl} from '../ui/segmented';
import {EmptyState} from '../ui/empty-state';
import {SkeletonStats,SkeletonChart} from '../ui/skeletons';
import '../dinero/dinero.css';
import {LinkButton,Arrow,Button,Refresh} from '../ui/button';
import {useJson} from '../ui/use-json';
import {nf} from '../ui/format';
import './datos.css';

type ReportState={status:'ok';report:CfoReport;synthetic?:boolean}|{status:'empty'|'timeout'};
const acceptBundle=(j:unknown)=>{const d=(j as {data?:Bundle})?.data;return d&&d.meta&&d.meta.scope?d:null;};
const acceptReport=(j:unknown)=>{const d=(j as {data?:ReportState})?.data;return d&&typeof d.status==='string'?d:null;};
const mesCorto=(m:string,loc='es-MX')=>new Intl.DateTimeFormat(loc,{month:'short',timeZone:'UTC'}).format(new Date(m+'-01T00:00:00Z')).replace('.','');
const mesLargo=(m:string,loc='es-MX')=>new Intl.DateTimeFormat(loc,{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(m+'-01T00:00:00Z'));
const pctBps=(b:number|null,nd='No disponible')=>b===null?nd:porcentaje(b/100);

/** Pantalla «Cortes publicados»: primero el estado de lo publicado y su cobertura; los formularios que escriben quedan plegados abajo. */
export function EconomiaResumen({query='',puedePreparar,soloPropietario=false,children}:{query?:string;puedePreparar:boolean;soloPropietario?:boolean;children?:ReactNode}){
 const tr=useT(),idioma=useIdioma(),loc=LOCALE_INTL[idioma];
 const nd=tr('econ.noDisp');
 const bundle=useJson<Bundle>(urlCortePublicado(query),acceptBundle);
 const rep=useJson<ReportState>('/cfo/data/report',acceptReport);
 const corte=useMemo(()=>resumenCorte(bundle.data?.meta),[bundle.data]);
 const report=rep.data?.status==='ok'?rep.data.report:null;
 const tarjetas=useMemo(()=>tarjetasPorMoneda(report),[report]);
 const fuentes=useMemo(()=>filasPorFuente(report),[report]);
 const incompletos=useMemo(()=>mesesIncompletos(report),[report]);
 const claves=useMemo(()=>tarjetas.map(t=>t.moneda+'|'+t.base),[tarjetas]);
 const [elegida,setElegida]=useState(''),[medida,setMedida]=useState<'pedidos'|'subtotal'>('pedidos');
 const clave=claves.includes(elegida)?elegida:claves[0]??'';
 const actual=tarjetas.find(t=>t.moneda+'|'+t.base===clave);
 const serie=useMemo(()=>actual?serieMensual(report,actual.moneda,actual.base,medida):[],[report,actual,medida]);
 const datos:ColumnDatum[]=serie.map(p=>({key:p.mes,label:mesCorto(p.mes,loc),long:mesLargo(p.mes,loc)+(p.parcial?tr('econ.mesIncompleto'):''),value:p.valor,partial:p.parcial,
  display:p.valor===null?nd:medida==='pedidos'?nf.format(p.pedidos):formatMinorUnits(p.importeMinor,actual!.moneda,actual!.exponente),
  detail:[p.parcial?tr('econ.incompletoNoComp'):'',p.detalle??''].filter(Boolean).join(' · ')||undefined}));
 const ocupado=(bundle.busy&&!bundle.data)||(rep.busy&&!rep.data);
 const noDisponible=(rep.data&&rep.data.status!=='ok')||Boolean(rep.error);
 if(ocupado&&!report)return <RovaqCargando mensaje=""/>;
 return <section className="dg-page">
  <PageHeader eyebrow={tr('econ.eyebrow')} title={tr('econ.titulo')} description={tr('econ.desc')}/>

  <Card title={tr('econ.cCorte')} description={tr('econ.cCorteD')} actions={corte.disponible?<KindBadge kind="observed"/>:undefined}>
   {bundle.busy&&!bundle.data?<SkeletonStats count={4}/>
    :!corte.disponible?<EmptyState art="doc" compact title={bundle.error?tr('econ.noDispAhora'):tr('econ.sinCorte')} body={bundle.error?bundle.error:tr('econ.sinCorteB')} action={bundle.error?<Button icon={<Refresh/>} onClick={()=>bundle.reload()}>{tr('econ.reintentar')}</Button>:puedePreparar?<a className="btn btn-primary btn-sm" href="#preparar"><span className="btn-label">{tr('econ.preparar')}</span></a>:undefined}/>
    :<>
     <dl className="dn-facts">
      <div><dt>{tr('econ.fEstado')}</dt><dd><StatusChip tone={corte.tono as 'ok'|'warn'|'muted'}>{corte.estado}</StatusChip></dd></div>
      <div><dt>{tr('econ.fPeriodo')}</dt><dd>{corte.rango??nd}</dd></div>
      <div><dt>{tr('econ.fBase')}</dt><dd>{corte.base??nd}</dd></div>
      <div><dt>{tr('econ.fMoneda')}</dt><dd>{corte.moneda??nd}</dd></div>
      <div><dt>{tr('econ.fHasta')}</dt><dd>{corte.datosHasta??tr('econ.sinFechaCorte')}</dd></div>
      <div><dt>{tr('econ.fRef')}</dt><dd><code className="dn-code" title={tr('econ.idPub')}>{corte.snapshot}</code></dd></div>
     </dl>
     {corte.cobertura&&<p className="dn-note">{corte.cobertura}</p>}
    </>}
  </Card>

  {ocupado&&!report?<><SkeletonStats count={4}/><SkeletonChart/></>
   :noDisponible||!report?<EmptyState art="chart" tone="warn" compact title={rep.data?.status==='empty'?tr('econ.libroVacio'):tr('econ.noDispAhora')} body={rep.data?.status==='empty'?tr('econ.libroVacioB'):rep.error||tr('econ.consultaNoResp')} action={rep.data?.status==='empty'?<LinkButton href="/imports" variant="primary" size="sm" icon={<Arrow/>}>{tr('econ.importar')}</LinkButton>:<Button icon={<Refresh/>} onClick={()=>rep.reload()}>{tr('econ.reintentar')}</Button>}/>
   :<>
    <KpiStrip label={tr('econ.cifrasAria')} items={[
     {key:'reg',label:tr('econ.kRegistros'),c:8,value:nf.format(report.quality.totalRows),note:tr('econ.kRegNota')},
     ...tarjetas.map((t):Kpi=>({key:t.moneda+t.base,label:t.moneda+' · '+t.baseLegible,c:t.base.includes('gross')?3:t.moneda==='USD'?1:t.moneda==='CAD'?5:4,
      value:<span title={t.subtotalMinor===null?undefined:formatMinorUnits(t.subtotalMinor,t.moneda,t.exponente)}>{t.subtotalMinor===null?nd:formatMinorUnits(t.subtotalMinor,t.moneda,t.exponente).replace(/\.\d+/,'').replace(/\s?(USD|CAD|MXN)$/,'')}</span>,
      spark:serieMensual(report,t.moneda,t.base,'pedidos').filter(p=>!p.parcial&&p.valor!==null).map(p=>p.valor as number),
      note:<>{tr('econ.pedidosN',{n:nf.format(t.pedidos)})} · {t.cobertura}{t.base!=='gross_order_including_tax_shipping'?' · '+tr('econ.reembolsos',{x:t.reembolsos?nf.format(t.reembolsos.n):tr('econ.sinCobertura')}):''}</>}))]}/>
    <Notice tone="info">{tr('econ.noSuma')}</Notice>
    <Fila split="8-4">
     <Card title={medida==='pedidos'?tr('econ.pedidosMes'):tr('econ.subtotalMes')} description={tr('econ.ultimosMeses',{n:report.months.length})+(actual?' · '+actual.moneda+' · '+actual.baseLegible:'')} actions={<KindBadge kind="observed"/>}>
      <div className="dn-controls">
       {claves.length>1&&<SegmentedControl label={tr('econ.monedaBase')} size="sm" value={clave} onChange={setElegida} options={tarjetas.map(t=>({value:t.moneda+'|'+t.base,label:t.moneda+(tarjetas.filter(x=>x.moneda===t.moneda).length>1?' · '+(t.base.includes('gross')?'Shopify':'Marketplace'):'')}))}/>}
       <SegmentedControl label={tr('econ.medida')} size="sm" value={medida} onChange={setMedida} options={[{value:'pedidos',label:tr('econ.pedidos')},{value:'subtotal',label:tr('econ.subtotal')}]}/>
      </div>
      {datos.length>0?<div className="dg-colcolor" data-c={medida==='pedidos'?5:1}><ColumnChart height={240} key={clave+medida} title={medida==='pedidos'?tr('econ.pedidosMes'):tr('econ.subtotalMes')} data={datos} unit={medida==='pedidos'?tr('econ.pedidosU'):actual?.moneda}/></div>:<EmptyState art="chart" compact title={tr('econ.sinMeses')}/>}
      {incompletos.meses.length>0&&<p className="dg-nota" role="note">* {tr('econ.notaIncompleto',{meses:incompletos.meses.map(m=>mesLargo(m,loc)).join(', '),hasta:incompletos.datosHasta?tr('econ.hastaEl',{fecha:incompletos.datosHasta}):tr('econ.hastaSinFecha')})}</p>}
     </Card>
     <Card title={tr('econ.completitud')} description={tr('econ.completitudD')} actions={<KindBadge kind="observed"/>}>
      <ListaBarras c={5} max={100} label={tr('econ.completitud')} apilado items={fuentes.map(f=>({key:f.clave,etiqueta:f.fuente,integracion:f.fuente,sub:f.reembolsos==='Sin cobertura'?tr('econ.sinFuenteReemb'):tr('econ.conFuenteReemb'),valor:f.completitudBps===null?null:f.completitudBps/100,texto:pctBps(f.completitudBps,nd)}))}/>
     </Card>
    </Fila>
    <Card title={tr('econ.cargasT')} description={tr('econ.cargasD')}>
     <DataTable caption={tr('econ.coberturaFuente')} rows={fuentes} rowKey={f=>f.clave} maxHeight="none" columns={[
      {key:'f',header:tr('econ.hFuente'),render:f=><b><ConMarca marca={f.fuente}>{f.fuente}</ConMarca></b>},
      {key:'r',header:tr('econ.hRegistros'),align:'num',render:f=>nf.format(f.registros)},
      {key:'m',header:tr('econ.hSinMoneda'),align:'num',render:f=>nf.format(f.sinMoneda)},
      {key:'p',header:tr('econ.hPedSinImp'),align:'num',render:f=>nf.format(f.pedidosSinImporte)},
      {key:'x',header:tr('econ.hReembSinImp'),align:'num',render:f=>f.reembolsosSinImporte===null?'—':nf.format(f.reembolsosSinImporte)},
      {key:'e',header:tr('econ.hReemb'),render:f=>f.reembolsos==='Sin cobertura'?<StatusChip tone="warn" title={tr('econ.sinCoberturaTip')}>{tr('econ.sinCoberturaChip')}</StatusChip>:<StatusChip tone="ok">{tr('econ.conFuente')}</StatusChip>},
      {key:'c',header:tr('econ.hComplet'),align:'num',render:f=>pctBps(f.completitudBps,nd)}]}/>
    </Card>
   </>}

  {puedePreparar&&<Preparar>{children}</Preparar>}
  {!puedePreparar&&soloPropietario&&<p className="ac-nota" role="note" data-tour="corte-propietario">{tr('rol.econ.soloProp')}</p>}
 </section>;
}

/** Los formularios que escriben (importar, clasificar, asociar, publicar) no cargan hasta que se abre la sección. */
function Preparar({children}:{children?:ReactNode}){
 const tr=useT();
 const [abierto,setAbierto]=useState(false);
 return <details id="preparar" className="card dn-preparar" onToggle={e=>{if((e.currentTarget as HTMLDetailsElement).open)setAbierto(true);}}>
  <summary><span><strong>{tr('econ.prepararT')}</strong><small>{tr('econ.prepararD')}</small></span></summary>
  {abierto?<div className="dn-preparar-body">{children}</div>:null}
 </details>;
}
