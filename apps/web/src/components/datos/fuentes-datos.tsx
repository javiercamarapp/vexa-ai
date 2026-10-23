'use client';
import {useMemo} from 'react';
import type {CoverageView} from '../../../../../packages/workspace-service/provenance.mjs';
import type {TrendsView} from '../../../../../packages/workspace-service/trends.mjs';
import {EXPLICACION} from '../../../../../packages/workspace-service/datos-hasta.mjs';
import {tarjetasFuentes,identidad,type TarjetaFuente} from '../../lib/legibilidad/fuentes.mjs';
import {PageHeader} from '../ui/page-header';
import {KindBadge} from '../ui/kind-badge';
import {StatusChip} from '../ui/status-chip';
import {EmptyState} from '../ui/empty-state';
import {SkeletonCards} from '../ui/skeletons';
import {LinkButton,Arrow,Button,Refresh} from '../ui/button';
import {useJson} from '../ui/use-json';
import {nf} from '../ui/format';
import {IdentidadCard} from './identidad-card';
import {EstadoSincronizacion} from './estado-sincronizacion';
import './datos.css';

const acceptCoverage=(j:unknown)=>{const d=(j as {data?:CoverageView})?.data;return Array.isArray(d?.sources)?d as CoverageView:null;};
const acceptTrends=(j:unknown)=>{const d=(j as {data?:TrendsView})?.data;return d?.conversations&&d?.ledger?d:null;};

function Tarjeta({t}:{t:TarjetaFuente}){
 const cargada=t.estado==='cargada',seg=(n:number)=>t.leidas>0?Math.max(n>0?1:0,n*100/t.leidas):0;
 return <li className="dn-source" data-source={t.clave} data-estado={t.estado}>
  <div className="dn-source-head"><h3>{t.nombre}</h3>{cargada?<StatusChip tone="ok">Cargada</StatusChip>:t.estado==='no_disponible'?<StatusChip tone="warn">No disponible ahora</StatusChip>:<StatusChip tone="muted">Sin cargar</StatusChip>}</div>
  {cargada?<>
   <p className="dn-big">{nf.format(t.incorporadas)}<small>{t.unidad}</small></p>
   {t.leidas>0&&(t.rechazadas>0||t.pendientes>0)&&<><div className="dn-bar" role="img" aria-label={`${nf.format(t.incorporadas)} incorporadas, ${nf.format(t.rechazadas)} rechazadas por diseño y ${nf.format(t.pendientes)} pendientes, de ${nf.format(t.leidas)} leídas`}><span className="dn-in" style={{flexBasis:seg(t.incorporadas)+'%'}}/>{t.pendientes>0&&<span className="dn-pen" style={{flexBasis:seg(t.pendientes)+'%'}}/>}{t.rechazadas>0&&<span className="dn-rej" style={{flexBasis:seg(t.rechazadas)+'%'}}/>}</div>
    <ul className="dn-legend"><li><i className="dn-in"/>{nf.format(t.incorporadas)} incorporadas</li>{t.pendientes>0&&<li><i className="dn-pen"/>{nf.format(t.pendientes)} pendientes</li>}{t.rechazadas>0&&<li><i className="dn-rej"/>{nf.format(t.rechazadas)} rechazadas por diseño</li>}</ul></>}
   <dl className="dn-facts dn-facts-sm">
    <div><dt>Datos hasta</dt><dd>{t.datosHasta??'Sin fecha de corte'}</dd></div>
    <div><dt>Última carga</dt><dd>{t.ultimaCarga??'Sin carga por archivo'}</dd></div>
    <div><dt>Rango de fechas</dt><dd>{t.rango??'Sin rango registrado'}</dd></div>
   </dl>
   {t.rangoNota&&<p className="dn-meta">{t.rangoNota}</p>}
   {t.detalle.slice(0,2).map((l,i)=><p key={i} className="dn-meta">{l}</p>)}
   {t.nota&&<p className="dn-meta">{t.nota}</p>}
   <div className="dn-source-head"><KindBadge kind={t.clase==='estimated'?'estimated':'observed'}/>{t.importaciones>0&&<span className="dn-meta">{nf.format(t.importaciones)} {t.importaciones===1?'importación':'importaciones'}{t.abiertas>0?` · ${t.abiertas} en proceso`:''}</span>}</div>
  </>:<>
   <p className="dn-meta">{t.estado==='no_disponible'?'La consulta de esta fuente no respondió a tiempo. No es cero: reintenta.':'Aún no hay datos de esta fuente; su tamaño no se estima.'}</p>
  </>}
 </li>;
}

/** Pantalla «Datos y fuentes»: cobertura de identidad (la cifra que habilita el dinero por problema) y una tarjeta por fuente. */
export function FuentesDatos(){
 const cov=useJson<CoverageView>('/api/coverage',acceptCoverage),tr=useJson<TrendsView>('/api/trends',acceptTrends);
 const tarjetas=useMemo(()=>tarjetasFuentes(cov.data,tr.data),[cov.data,tr.data]);
 const id=useMemo(()=>identidad(cov.data?.sources.find(s=>s.key==='associations')),[cov.data]);
 const cargadas=tarjetas.filter(t=>t.estado==='cargada').length;
 return <section className="task-page stack dn-page">
  <PageHeader eyebrow="Datos y fuentes" title="Cobertura de datos" description="De dónde sale lo que ves: qué fuentes están cargadas, hasta cuándo llegan y cuánto del cliente ya está identificado." actions={<><Button icon={<Refresh/>} loading={cov.busy} onClick={()=>{cov.reload();tr.reload();}}>Actualizar</Button><LinkButton href="/imports" variant="primary" icon={<Arrow/>}>Importar datos</LinkButton></>}/>
  <IdentidadCard id={id} busy={cov.busy&&!cov.data} error={cov.error} onRetry={()=>cov.reload()} enlaceDetalle/>
  <section aria-labelledby="ds-src-t">
   <div className="card-title"><div><h2 id="ds-src-t">Fuentes</h2><p>{cov.data?`${cargadas} de ${tarjetas.length} fuentes con datos cargados. ${EXPLICACION}`:'Cargando cobertura…'}</p></div></div>
   {cov.busy&&!cov.data?<SkeletonCards count={6}/>:cov.error&&!cov.data?<EmptyState art="plug" compact tone="warn" title="No disponible ahora" body={cov.error} action={<Button icon={<Refresh/>} onClick={()=>cov.reload()}>Reintentar</Button>}/>:<ul className="dn-grid">{tarjetas.map(t=><Tarjeta key={t.clave} t={t}/>)}</ul>}
   {tr.error&&<p className="dn-note" role="status">Las fechas «datos hasta» y los rangos no están disponibles ahora: {tr.error}</p>}
  </section>
  <EstadoSincronizacion/>
 </section>;
}
