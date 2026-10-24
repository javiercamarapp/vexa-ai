'use client';
import {ConMarca} from '../ui/brand-mark';
import {useMemo} from 'react';
import type {CoverageView} from '../../../../../packages/workspace-service/provenance.mjs';
import type {TrendsView} from '../../../../../packages/workspace-service/trends.mjs';
import {tarjetasFuentes,identidad} from '../../lib/legibilidad/fuentes.mjs';
import {StatusChip} from '../ui/status-chip';
import {SkeletonRows} from '../ui/skeletons';
import {LinkButton,Arrow,Button,Refresh} from '../ui/button';
import {useJson} from '../ui/use-json';
import {nf,fmtPct} from '../ui/format';
import {IdentidadCard} from './identidad-card';
import './datos.css';

const acceptCoverage=(j:unknown)=>{const d=(j as {data?:CoverageView})?.data;return Array.isArray(d?.sources)?d as CoverageView:null;};
const acceptTrends=(j:unknown)=>{const d=(j as {data?:TrendsView})?.data;return d?.conversations&&d?.ledger?d:null;};

/** /connections: además del estado de cada conexión, cuánto trajo cada fuente y hasta cuándo llegan sus datos. */
export function CoberturaConexiones(){
 const cov=useJson<CoverageView>('/api/coverage',acceptCoverage),tr=useJson<TrendsView>('/api/trends',acceptTrends);
 const t=useMemo(()=>tarjetasFuentes(cov.data,tr.data),[cov.data,tr.data]);
 return <section className="card" aria-labelledby="cc-t">
  <div className="card-title"><div><h2 id="cc-t">Cobertura por fuente</h2><p>Cuánto trajo cada fuente y hasta cuándo llegan sus datos.</p></div><LinkButton href="/sources" size="sm" icon={<Arrow/>}>Datos y fuentes</LinkButton></div>
  {cov.busy&&!cov.data?<SkeletonRows rows={5}/>:cov.error&&!cov.data?<p className="dn-note" role="status">No disponible ahora: {cov.error} <Button size="sm" icon={<Refresh/>} onClick={()=>cov.reload()}>Reintentar</Button></p>:
  <div className="table-wrap" tabIndex={0} role="region" aria-label="Cobertura por fuente, desplazamiento horizontal"><table className="dn-tabla"><thead><tr><th scope="col">Fuente</th><th scope="col">Estado</th><th scope="col" className="num">Incorporado</th><th scope="col">Datos hasta</th><th scope="col">Rango de fechas</th></tr></thead>
   <tbody>{t.map(f=><tr key={f.clave}><th scope="row"><ConMarca marca={f.clave}>{f.nombre}</ConMarca></th><td>{f.estado==='cargada'?<StatusChip tone="ok">Cargada</StatusChip>:f.estado==='no_disponible'?<StatusChip tone="warn">No disponible ahora</StatusChip>:<StatusChip tone="muted">Sin cargar</StatusChip>}</td>
    <td className="num">{f.estado==='cargada'?<>{nf.format(f.incorporadas)} <small className="muted">{f.unidad}{f.bps!==null&&f.leidas>f.incorporadas?' · '+fmtPct(f.bps/100):''}</small></>:'—'}</td>
    <td>{f.estado==='cargada'?f.datosHasta??'Sin fecha de corte':'—'}</td><td>{f.estado==='cargada'?f.rango??'Sin rango registrado':'—'}</td></tr>)}</tbody></table></div>}
 </section>;
}

/** /history: la cobertura de identidad (relaciones ticket–contacto) va primero; los lotes del histórico son secundarios. */
export function IdentidadHistorial(){
 const cov=useJson<CoverageView>('/api/coverage',acceptCoverage);
 const id=useMemo(()=>identidad(cov.data?.sources.find(s=>s.key==='associations')),[cov.data]);
 return <IdentidadCard id={id} busy={cov.busy&&!cov.data} error={cov.error} onRetry={()=>cov.reload()}/>;
}
