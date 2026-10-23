'use client';
import {useMemo,useState,type ReactNode} from 'react';
import type {Bundle} from '../../lib/workspace/contracts';
import type {CfoReport} from '../../../../../packages/cfo-copilot/src/index.mjs';
import {formatMinorUnits} from '../../../../../packages/metrics/money.mjs';
import {urlCortePublicado,resumenCorte,serieMensual,tarjetasPorMoneda,filasPorFuente,mesesIncompletos} from '../../lib/legibilidad/dinero.mjs';
import {PageHeader} from '../ui/page-header';
import {StatCard} from '../ui/stat-card';
import {KindBadge} from '../ui/kind-badge';
import {StatusChip} from '../ui/status-chip';
import {ColumnChart,type ColumnDatum} from '../ui/column-chart';
import {SegmentedControl} from '../ui/segmented';
import {EmptyState} from '../ui/empty-state';
import {SkeletonStats,SkeletonChart} from '../ui/skeletons';
import {LinkButton,Arrow,Button,Refresh} from '../ui/button';
import {Icon} from '../ui/icons';
import {useJson} from '../ui/use-json';
import {nf} from '../ui/format';
import './datos.css';

type ReportState={status:'ok';report:CfoReport;synthetic?:boolean}|{status:'empty'|'timeout'};
const acceptBundle=(j:unknown)=>{const d=(j as {data?:Bundle})?.data;return d&&d.meta&&d.meta.scope?d:null;};
const acceptReport=(j:unknown)=>{const d=(j as {data?:ReportState})?.data;return d&&typeof d.status==='string'?d:null;};
const mesCorto=(m:string)=>new Intl.DateTimeFormat('es-MX',{month:'short',timeZone:'UTC'}).format(new Date(m+'-01T00:00:00Z')).replace('.','');
const mesLargo=(m:string)=>new Intl.DateTimeFormat('es-MX',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(m+'-01T00:00:00Z'));
const pctBps=(b:number|null)=>b===null?'No disponible':(b/100).toLocaleString('es-MX',{maximumFractionDigits:1})+' %';

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
 return <section className="task-page stack dn-page">
  <PageHeader eyebrow="Dinero" title="Dinero · Preparar" description="Qué está publicado, qué tan completo es y qué falta antes de publicar un corte nuevo." actions={<Button icon={<Refresh/>} loading={ocupado} onClick={reintentar}>Actualizar</Button>}/>

  <section className="card dn-corte" aria-labelledby="dn-corte-t">
   <div className="card-title"><div><h2 id="dn-corte-t">Corte publicado</h2><p>Lo que hoy leen el Resumen y el Brief ejecutivo.</p></div>{corte.disponible&&<KindBadge kind="observed"/>}</div>
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
  </section>

  {ocupado&&!report?<><SkeletonStats count={4}/><SkeletonChart/></>
   :noDisponible||!report?<EmptyState art="chart" tone="warn" compact title={rep.data?.status==='empty'?'Sin registros en el libro':'No disponible ahora'} body={rep.data?.status==='empty'?'Aún no hay pedidos ni reembolsos registrados para esta organización. Importa una fuente para ver cifras aquí.':rep.error||'La consulta del libro económico no respondió a tiempo o tu rol no puede verla. Reintenta en unos segundos.'} action={rep.data?.status==='empty'?<LinkButton href="/imports" variant="primary" size="sm" icon={<Arrow/>}>Importar datos</LinkButton>:<Button icon={<Refresh/>} onClick={()=>rep.reload()}>Reintentar</Button>}/>
   :<>
    <div className="stat-grid" aria-label="Cifras del libro de registros">
     <StatCard label="Registros del libro" icon="database" kind="observed" value={nf.format(report.quality.totalRows)} foot="Pedidos y reembolsos, última revisión de cada uno · solo los últimos 12 meses (Fuentes cuenta todo el historial)"/>
     {tarjetas.map(t=><StatCard key={t.moneda+t.base} label={t.moneda+' · '+t.baseLegible} icon="dollar" kind="observed"
       value={t.subtotalMinor===null?'No disponible':formatMinorUnits(t.subtotalMinor,t.moneda,t.exponente)}
       foot={<>Subtotal conocido: {nf.format(t.pedidos)} pedidos, {t.cobertura}.{t.base!=='gross_order_including_tax_shipping'&&<> Reembolsos registrados: {t.reembolsos?nf.format(t.reembolsos.n):'Sin cobertura'}.</>}</>}>
     </StatCard>)}
    </div>
    <p className="dn-note"><Icon name="info" size={14}/> USD, CAD y MXN no se suman ni se convierten (no hay tipos de cambio aprobados). Cada moneda y cada base de cálculo se muestra por separado.</p>

    <section className="card" aria-labelledby="dn-serie-t">
     <div className="card-title"><div><h2 id="dn-serie-t">{medida==='pedidos'?'Pedidos por mes':'Subtotal conocido por mes'}</h2><p>Últimos {report.months.length} meses{actual?' · '+actual.moneda+' · '+actual.baseLegible:''}</p></div><KindBadge kind="observed"/></div>
     <div className="dn-controls">
      {claves.length>1&&<SegmentedControl label="Moneda y base" size="sm" value={clave} onChange={setElegida} options={tarjetas.map(t=>({value:t.moneda+'|'+t.base,label:t.moneda+(tarjetas.filter(x=>x.moneda===t.moneda).length>1?' · '+(t.base.includes('gross')?'Shopify':'Marketplace'):'')}))}/>}
      <SegmentedControl label="Medida" size="sm" value={medida} onChange={setMedida} options={[{value:'pedidos',label:'Pedidos'},{value:'subtotal',label:'Subtotal conocido'}]}/>
     </div>
     {datos.length>0?<ColumnChart key={clave+medida} title={medida==='pedidos'?'Pedidos por mes':'Subtotal conocido por mes'} data={datos} unit={medida==='pedidos'?'pedidos':actual?.moneda}/>:<EmptyState art="chart" compact title="Sin meses para mostrar"/>}
     {incompletos.meses.length>0&&<p className="dn-note" role="note">* {incompletos.meses.map(mesLargo).join(', ')}: mes incompleto, los datos llegan {incompletos.datosHasta?'hasta el '+incompletos.datosHasta:'hasta una fecha de corte sin determinar'}. La barra punteada no es una caída ni se compara con meses completos.</p>}
    </section>

    <section className="card" aria-labelledby="dn-cob-t">
     <div className="card-title"><div><h2 id="dn-cob-t">Cobertura y pendientes por fuente</h2><p>Qué tan completo está lo que cargó cada fuente. Lo que falta nunca se cuenta como cero.</p></div></div>
     <div className="table-wrap" tabIndex={0} role="region" aria-label="Tabla de cobertura por fuente">
      <table><thead><tr><th scope="col">Fuente</th><th scope="col" className="num">Registros</th><th scope="col" className="num">Sin moneda</th><th scope="col" className="num">Pedidos sin importe</th><th scope="col" className="num">Reembolsos sin importe</th><th scope="col">Reembolsos</th><th scope="col" className="num">Completitud</th></tr></thead>
       <tbody>{fuentes.map(f=><tr key={f.clave}><th scope="row">{f.fuente}</th><td className="num">{nf.format(f.registros)}</td><td className="num">{nf.format(f.sinMoneda)}</td><td className="num">{nf.format(f.pedidosSinImporte)}</td><td className="num">{f.reembolsosSinImporte===null?'—':nf.format(f.reembolsosSinImporte)}</td>
        <td>{f.reembolsos==='Sin cobertura'?<StatusChip tone="warn" title="Esta fuente no tiene reembolsos cargados: no se sabe cuántos hubo, no es cero.">Sin cobertura</StatusChip>:<StatusChip tone="ok">Con fuente</StatusChip>}</td>
        <td className="num">{pctBps(f.completitudBps)}</td></tr>)}</tbody></table>
     </div>
    </section>
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
