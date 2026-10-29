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
import {useT} from '../i18n/proveedor';
import './datos.css';

const acceptCoverage=(j:unknown)=>{const d=(j as {data?:CoverageView})?.data;return Array.isArray(d?.sources)?d as CoverageView:null;};
const acceptTrends=(j:unknown)=>{const d=(j as {data?:TrendsView})?.data;return d?.conversations&&d?.ledger?d:null;};

/** /connections: además del estado de cada conexión, cuánto trajo cada fuente y hasta cuándo llegan sus datos. */
export function CoberturaConexiones(){
 const tx=useT(),cov=useJson<CoverageView>('/api/coverage',acceptCoverage),tr=useJson<TrendsView>('/api/trends',acceptTrends);
 const t=useMemo(()=>tarjetasFuentes(cov.data,tr.data),[cov.data,tr.data]);
 return <section className="card" aria-labelledby="cc-t">
  <div className="card-title"><div><h2 id="cc-t">{tx('tr.datos.cobFuente')}</h2><p>{tx('tr.datos.ccSub')}</p></div><LinkButton href="/sources" size="sm" icon={<Arrow/>}>{tx('tr.datos.ccDatosFuentes')}</LinkButton></div>
  {cov.busy&&!cov.data?<SkeletonRows rows={5}/>:cov.error&&!cov.data?<p className="dn-note" role="status">{tx('hoy.noDisponible')}: {cov.error} <Button size="sm" icon={<Refresh/>} onClick={()=>cov.reload()}>{tx('hoy.reintentar')}</Button></p>:
  <div className="table-wrap" tabIndex={0} role="region" aria-label={tx('tr.ui.hmScroll',{titulo:tx('tr.datos.cobFuente')})}><table className="dn-tabla"><thead><tr><th scope="col">{tx('conf.hFuente')}</th><th scope="col">{tx('tr.datos.thEstado')}</th><th scope="col" className="num">{tx('tr.datos.thIncorporado')}</th><th scope="col">{tx('tr.datos.thDatosHasta')}</th><th scope="col">{tx('tr.datos.thRango')}</th></tr></thead>
   <tbody>{t.map(f=><tr key={f.clave}><th scope="row"><ConMarca marca={f.clave}>{f.nombre}</ConMarca></th><td>{f.estado==='cargada'?<StatusChip tone="ok">{tx('tr.datos.cargada')}</StatusChip>:f.estado==='no_disponible'?<StatusChip tone="warn">{tx('hoy.noDisponible')}</StatusChip>:<StatusChip tone="muted">{tx('tr.ui.cbSinCargar')}</StatusChip>}</td>
    <td className="num">{f.estado==='cargada'?<>{nf.format(f.incorporadas)} <small className="muted">{f.unidad}{f.bps!==null&&f.leidas>f.incorporadas?' · '+fmtPct(f.bps/100):''}</small></>:'—'}</td>
    <td>{f.estado==='cargada'?f.datosHasta??tx('tr.datos.sinCorte'):'—'}</td><td>{f.estado==='cargada'?f.rango??tx('tr.datos.sinRango'):'—'}</td></tr>)}</tbody></table></div>}
 </section>;
}

/** /history: la cobertura de identidad (relaciones ticket–contacto) va primero; los lotes del histórico son secundarios. */
export function IdentidadHistorial(){
 const cov=useJson<CoverageView>('/api/coverage',acceptCoverage);
 const id=useMemo(()=>identidad(cov.data?.sources.find(s=>s.key==='associations')),[cov.data]);
 return <IdentidadCard id={id} busy={cov.busy&&!cov.data} error={cov.error} onRetry={()=>cov.reload()}/>;
}
