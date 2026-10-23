'use client';
import {porcentaje} from '../../lib/formato/es-mx.mjs';
import {useMemo,useState,type ReactNode} from 'react';
import type {Bundle} from '../../lib/workspace/contracts';
import type {CfoReport} from '../../../../../packages/cfo-copilot/src/index.mjs';
import {formatMinorUnits} from '../../../../../packages/metrics/money.mjs';
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
const mesCorto=(m:string)=>new Intl.DateTimeFormat('es-MX',{month:'short',timeZone:'UTC'}).format(new Date(m+'-01T00:00:00Z')).replace('.','');
const mesLargo=(m:string)=>new Intl.DateTimeFormat('es-MX',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(m+'-01T00:00:00Z'));
const pctBps=(b:number|null)=>b===null?'No disponible':porcentaje(b/100);

/** Pantalla «Dinero · Preparar»: primero el estado de lo publicado y su cobertura; los formularios que escriben quedan plegados abajo. */
export function EconomiaResumen({query='',puedePreparar,children}:{query?:string;puedePreparar:boolean;children?:ReactNode}){
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
 const datos:ColumnDatum[]=serie.map(p=>({key:p.mes,label:mesCorto(p.mes),long:mesLargo(p.mes)+(p.parcial?' (mes incompleto)':''),value:p.valor,partial:p.parcial,
  display:p.valor===null?'No disponible':medida==='pedidos'?nf.format(p.pedidos):formatMinorUnits(p.importeMinor,actual!.moneda,actual!.exponente),
  detail:[p.parcial?'Incompleto: no se compara':'',p.detalle??''].filter(Boolean).join(' · ')||undefined}));
 const ocupado=(bundle.busy&&!bundle.data)||(rep.busy&&!rep.data);
 const noDisponible=(rep.data&&rep.data.status!=='ok')||Boolean(rep.error);
 const reintentar=()=>{bundle.reload();rep.reload();};
 return <section className="dg-page">
  <PageHeader eyebrow="Dinero" title="Dinero · Preparar" description="Qué está publicado, qué tan completo es y qué falta antes de publicar un corte nuevo." actions={<Button icon={<Refresh/>} loading={ocupado} onClick={reintentar}>Actualizar</Button>}/>

  <Card title="Corte publicado" description="Lo que hoy leen el Resumen y el Brief ejecutivo" actions={corte.disponible?<KindBadge kind="observed"/>:undefined}>
   {bundle.busy&&!bundle.data?<SkeletonStats count={4}/>
    :!corte.disponible?<EmptyState art="doc" compact title={bundle.error?'No disponible ahora':'Aún no hay un corte publicado'} body={bundle.error?bundle.error:'Cuando un propietario publique un corte, aquí verás su periodo, su base de cálculo y hasta qué fecha llegan los datos.'} action={bundle.error?<Button icon={<Refresh/>} onClick={()=>bundle.reload()}>Reintentar</Button>:puedePreparar?<a className="btn btn-primary btn-sm" href="#preparar"><span className="btn-label">Preparar un corte</span></a>:undefined}/>
    :<>
     <dl className="dn-facts">
      <div><dt>Estado</dt><dd><StatusChip tone={corte.tono as 'ok'|'warn'|'muted'}>{corte.estado}</StatusChip></dd></div>
      <div><dt>Periodo</dt><dd>{corte.rango??'No disponible'}</dd></div>
      <div><dt>Cómo se calcula el importe</dt><dd>{corte.base??'No disponible'}</dd></div>
      <div><dt>Moneda del corte</dt><dd>{corte.moneda??'No disponible'}</dd></div>
      <div><dt>Datos hasta</dt><dd>{corte.datosHasta??'Sin fecha de corte'}</dd></div>
      <div><dt>Referencia del corte</dt><dd><code className="dn-code" title="Identificador de la publicación">{corte.snapshot}</code></dd></div>
     </dl>
     {corte.cobertura&&<p className="dn-note">{corte.cobertura}</p>}
    </>}
  </Card>

  {ocupado&&!report?<><SkeletonStats count={4}/><SkeletonChart/></>
   :noDisponible||!report?<EmptyState art="chart" tone="warn" compact title={rep.data?.status==='empty'?'Sin registros en el libro':'No disponible ahora'} body={rep.data?.status==='empty'?'Aún no hay pedidos ni reembolsos registrados para esta organización. Importa una fuente para ver cifras aquí.':rep.error||'La consulta del libro económico no respondió a tiempo o tu rol no puede verla. Reintenta en unos segundos.'} action={rep.data?.status==='empty'?<LinkButton href="/imports" variant="primary" size="sm" icon={<Arrow/>}>Importar datos</LinkButton>:<Button icon={<Refresh/>} onClick={()=>rep.reload()}>Reintentar</Button>}/>
   :<>
    <KpiStrip label="Cifras del libro de registros" items={[
     {key:'reg',label:'Registros del libro',c:8,value:nf.format(report.quality.totalRows),note:'Pedidos y reembolsos de los últimos 12 meses'},
     ...tarjetas.map((t):Kpi=>({key:t.moneda+t.base,label:t.moneda+' · '+t.baseLegible,c:t.base.includes('gross')?3:t.moneda==='USD'?1:t.moneda==='CAD'?5:4,
      value:<span title={t.subtotalMinor===null?undefined:formatMinorUnits(t.subtotalMinor,t.moneda,t.exponente)}>{t.subtotalMinor===null?'No disponible':formatMinorUnits(t.subtotalMinor,t.moneda,t.exponente).replace(/\.\d+/,'').replace(/\s?(USD|CAD|MXN)$/,'')}</span>,
      spark:serieMensual(report,t.moneda,t.base,'pedidos').filter(p=>!p.parcial&&p.valor!==null).map(p=>p.valor as number),
      note:<>{nf.format(t.pedidos)} pedidos · {t.cobertura}{t.base!=='gross_order_including_tax_shipping'?` · reembolsos: ${t.reembolsos?nf.format(t.reembolsos.n):'sin cobertura'}`:''}</>}))]}/>
    <Notice tone="info">USD, CAD y MXN no se suman ni se convierten (no hay tipos de cambio aprobados). Cada moneda y cada base de cálculo se muestra por separado.</Notice>
    <Fila split="8-4">
     <Card title={medida==='pedidos'?'Pedidos por mes':'Subtotal conocido por mes'} description={`Últimos ${report.months.length} meses${actual?' · '+actual.moneda+' · '+actual.baseLegible:''}`} actions={<KindBadge kind="observed"/>}>
      <div className="dn-controls">
       {claves.length>1&&<SegmentedControl label="Moneda y base" size="sm" value={clave} onChange={setElegida} options={tarjetas.map(t=>({value:t.moneda+'|'+t.base,label:t.moneda+(tarjetas.filter(x=>x.moneda===t.moneda).length>1?' · '+(t.base.includes('gross')?'Shopify':'Marketplace'):'')}))}/>}
       <SegmentedControl label="Medida" size="sm" value={medida} onChange={setMedida} options={[{value:'pedidos',label:'Pedidos'},{value:'subtotal',label:'Subtotal conocido'}]}/>
      </div>
      {datos.length>0?<div className="dg-colcolor" data-c={medida==='pedidos'?5:1}><ColumnChart height={240} key={clave+medida} title={medida==='pedidos'?'Pedidos por mes':'Subtotal conocido por mes'} data={datos} unit={medida==='pedidos'?'pedidos':actual?.moneda}/></div>:<EmptyState art="chart" compact title="Sin meses para mostrar"/>}
      {incompletos.meses.length>0&&<p className="dg-nota" role="note">* {incompletos.meses.map(mesLargo).join(', ')}: mes incompleto, los datos llegan {incompletos.datosHasta?'hasta el '+incompletos.datosHasta:'hasta una fecha de corte sin determinar'}. La barra punteada no es una caída.</p>}
     </Card>
     <Card title="Completitud por fuente" description="Lo que falta nunca se cuenta como cero" actions={<KindBadge kind="observed"/>}>
      <ListaBarras c={5} max={100} label="Completitud por fuente" apilado items={fuentes.map(f=>({key:f.clave,etiqueta:f.fuente,sub:f.reembolsos==='Sin cobertura'?'Sin fuente de reembolsos':'Con fuente de reembolsos',valor:f.completitudBps===null?null:f.completitudBps/100,texto:pctBps(f.completitudBps)}))}/>
     </Card>
    </Fila>
    <Card title="Cargas y pendientes por fuente" description="Qué tan completo está lo que cargó cada fuente">
     <DataTable caption="Cobertura por fuente" rows={fuentes} rowKey={f=>f.clave} maxHeight="none" columns={[
      {key:'f',header:'Fuente',render:f=><b>{f.fuente}</b>},
      {key:'r',header:'Registros',align:'num',render:f=>nf.format(f.registros)},
      {key:'m',header:'Sin moneda',align:'num',render:f=>nf.format(f.sinMoneda)},
      {key:'p',header:'Pedidos sin importe',align:'num',render:f=>nf.format(f.pedidosSinImporte)},
      {key:'x',header:'Reembolsos sin importe',align:'num',render:f=>f.reembolsosSinImporte===null?'—':nf.format(f.reembolsosSinImporte)},
      {key:'e',header:'Reembolsos',render:f=>f.reembolsos==='Sin cobertura'?<StatusChip tone="warn" title="Esta fuente no tiene reembolsos cargados: no se sabe cuántos hubo, no es cero.">Sin cobertura</StatusChip>:<StatusChip tone="ok">Con fuente</StatusChip>},
      {key:'c',header:'Completitud',align:'num',render:f=>pctBps(f.completitudBps)}]}/>
    </Card>
   </>}

  {puedePreparar&&<Preparar>{children}</Preparar>}
 </section>;
}

/** Los formularios que escriben (importar, clasificar, asociar, publicar) no cargan hasta que se abre la sección. */
function Preparar({children}:{children?:ReactNode}){
 const [abierto,setAbierto]=useState(false);
 return <details id="preparar" className="card dn-preparar" onToggle={e=>{if((e.currentTarget as HTMLDetailsElement).open)setAbierto(true);}}>
  <summary><span><strong>Preparar un corte</strong><small>Importar registros, clasificar pedidos, asociar clientes y publicar. Cada escritura pide tu confirmación.</small></span></summary>
  {abierto?<div className="dn-preparar-body">{children}</div>:null}
 </details>;
}
