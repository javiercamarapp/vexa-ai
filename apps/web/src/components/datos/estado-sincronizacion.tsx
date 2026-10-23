'use client';
import {useMemo} from 'react';
import {useJson} from '../ui/use-json';
import {StatusChip} from '../ui/status-chip';
import {nf} from '../ui/format';
import {filasSincronizacion} from '../../lib/legibilidad/sincronizacion.mjs';
const accept=(j:unknown)=>{const d=(j as {data?:{availability?:string;sources?:unknown[];insights?:unknown[]}})?.data;return d&&Array.isArray(d.sources)&&Array.isArray(d.insights)?d:null;};
/** Panel «Estado de sincronización»: por fuente su método de entrada, último éxito, siguiente corrida y error; y cuándo se recalculó cada cálculo. Solo lectura de /api/freshness. */
export function EstadoSincronizacion(){
 const f=useJson('/api/freshness',accept);
 const v=useMemo(()=>filasSincronizacion(f.data),[f.data]);
 if(f.busy&&!f.data)return null;
 return <section aria-labelledby="ds-sync-t" data-testid="estado-sincronizacion">
  <div className="card-title"><div><h2 id="ds-sync-t">Estado de sincronización</h2><p>Cómo entra cada fuente y cuándo se actualizó por última vez. Los cálculos se rehacen solos cuando llegan datos nuevos.</p></div></div>
  {!v.disponible?<p className="dn-meta">{f.error||'La actualización automática aún no está activada para esta organización: las cargas siguen siendo manuales.'}</p>:<>
   {v.fuentes.length===0?<p className="dn-meta">Todavía no se registró ninguna sincronización.</p>:<ul className="dn-grid">{v.fuentes.map(s=><li key={s.clave} className="dn-source" data-source={s.clave}>
    <div className="dn-source-head"><h3>{s.nombre}</h3><StatusChip tone={s.tono}>{s.estado}</StatusChip></div>
    <dl className="dn-facts dn-facts-sm"><div><dt>Cómo entra</dt><dd>{s.metodo}</dd></div><div><dt>Último éxito</dt><dd>{s.exito}</dd></div>{s.siguiente&&<div><dt>Siguiente corrida</dt><dd>{s.siguiente}</dd></div>}</dl>
    {s.nuevos!==null&&<p className="dn-meta">{nf.format(s.nuevos)} registros nuevos en la última corrida{s.latencia?` · ${s.latencia}`:''}</p>}
    {s.error&&<p className="dn-meta" role="status">{s.error}</p>}
   </li>)}</ul>}
   {v.calculos.length>0&&<ul className="dn-legend" aria-label="Cálculos precalculados">{v.calculos.map(c=><li key={c.clave}>{c.nombre}: {c.estado}{c.actualizado?` · ${c.actualizado}`:''}{c.pendientes>0?` · faltan ${c.pendientes} periodos`:''}</li>)}</ul>}
  </>}
 </section>;
}
