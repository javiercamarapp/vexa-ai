'use client';
import {ConMarca} from '../ui/brand-mark';
import {useMemo} from 'react';
import {useJson} from '../ui/use-json';
import {StatusChip} from '../ui/status-chip';
import {nf} from '../ui/format';
import {filasSincronizacion} from '../../lib/legibilidad/sincronizacion.mjs';
import {useT} from '../i18n/proveedor';
const accept=(j:unknown)=>{const d=(j as {data?:{availability?:string;sources?:unknown[];insights?:unknown[]}})?.data;return d&&Array.isArray(d.sources)&&Array.isArray(d.insights)?d:null;};
/** Panel «Estado de sincronización»: por fuente su método de entrada, último éxito, siguiente corrida y error; y cuándo se recalculó cada cálculo. Solo lectura de /api/freshness. */
export function EstadoSincronizacion(){
 const tx=useT(),f=useJson('/api/freshness',accept);
 const v=useMemo(()=>filasSincronizacion(f.data),[f.data]);
 if(f.busy&&!f.data)return null;
 return <section aria-labelledby="ds-sync-t" data-testid="estado-sincronizacion">
  <div className="card-title"><div><h2 id="ds-sync-t">{tx('tr.datos.syncTitulo')}</h2><p>{tx('tr.datos.syncSub')}</p></div></div>
  {!v.disponible?<p className="dn-meta">{f.error||tx('tr.datos.syncManual')}</p>:<>
   {v.fuentes.length===0?<p className="dn-meta">{tx('tr.datos.syncNinguna')}</p>:<ul className="dn-grid">{v.fuentes.map(s=><li key={s.clave} className="dn-source" data-source={s.clave}>
    <div className="dn-source-head"><h3><ConMarca marca={s.clave} tamaño={20}>{s.nombre}</ConMarca></h3><StatusChip tone={s.tono}>{s.estado}</StatusChip></div>
    <dl className="dn-facts dn-facts-sm"><div><dt>{tx('tr.datos.syncComoEntra')}</dt><dd>{s.metodo}</dd></div><div><dt>{tx('tr.datos.syncUltimo')}</dt><dd>{s.exito}</dd></div>{s.siguiente&&<div><dt>{tx('tr.datos.syncSiguiente')}</dt><dd>{s.siguiente}</dd></div>}</dl>
    {s.nuevos!==null&&<p className="dn-meta">{tx('tr.datos.syncNuevos',{n:nf.format(s.nuevos)})}{s.latencia?` · ${s.latencia}`:''}</p>}
    {s.error&&<p className="dn-meta" role="status">{s.error}</p>}
   </li>)}</ul>}
   {v.calculos.length>0&&<ul className="dn-legend" aria-label={tx('tr.datos.syncCalculos')}>{v.calculos.map(c=><li key={c.clave}>{c.nombre}: {c.estado}{c.actualizado?` · ${c.actualizado}`:''}{c.pendientes>0?' · '+tx('tr.datos.syncFaltan',{n:c.pendientes}):''}</li>)}</ul>}
  </>}
 </section>;
}
