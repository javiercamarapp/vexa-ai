'use client';
import {KindBadge as KindBadgeBase} from '../ui/kind-badge';
import {Chip} from '../ui/chip';
import {MenuList, Popover} from '../ui/overlay';
import {ListaBarras, Vacio} from '../dinero/partes';
import '../dinero/dinero.css';
import {ContenedorErrores} from './contenedor-errores';
import {Download} from '../ui/button';
import {CtlLink} from '../agente/ctl';
import {UnaKpis, PestanasUna, SegmentoUna, kpiCorto, type KpiUna, type PestanaUna} from '../cfo/una-ui';
import {pct, int} from '../../../../../packages/cfo-copilot/src/format.mjs';
import {lineaDatosHasta} from '../../../../../packages/workspace-service/datos-hasta.mjs';
import {SerieNegocio} from './serie-negocio';
import type {BriefingCfo} from './briefing-cfo.mjs';

/** Aísla cada pieza: si una falla se marca con data-fallo en vez de tumbar todo el resumen. */
const G = ({id, children}: {id: string; children: React.ReactNode}) => <ContenedorErrores alFallar={<span data-fallo={id} />}>{children}</ContenedorErrores>;
const HREF_EXPORT = (f: 'csv' | 'pdf') => `/cfo/data/export?format=${f}`;

/** Acciones del encabezado del copiloto de CFO: moneda, abrir el informe completo y exportar. Mismos controles compactos que el resto de la pantalla. */
export function AccionesCfo({b, informe, onMoneda, sintetico}: {b: BriefingCfo; informe: (ancla?: string) => string; onMoneda: (m: string) => void; sintetico?: boolean}) {
  return <div className="una-acciones" role="group" aria-label="Moneda y acciones del resumen">
    {b.monedas.length > 1 && <SegmentoUna label="Moneda del resumen" value={b.moneda} options={b.monedas.map(m => ({value: m, label: m}))} onChange={onMoneda} />}
    {sintetico && <span className="una-demo"><Chip tone="warn">Datos sintéticos</Chip></span>}
    <G id="ver-detalle"><CtlLink href={informe()} variant="soft">Ver informe</CtlLink></G>
    <G id="exportar"><Popover label="Exportar" align="end" width={220} triggerClassName="ctl ctl-solo" trigger={<><Download /><span className="ctl-label una-solo-vis">Exportar</span><span className="sr-only una-solo-sr">Exportar</span></>}>
      <MenuList>
        <li><a className="ctl" href={HREF_EXPORT('csv')} download="informe-cfo.csv">Hoja de cálculo (CSV)</a></li>
        <li><a className="ctl" href={HREF_EXPORT('pdf')} download="informe-cfo.pdf">Documento (PDF)</a></li></MenuList></Popover></G>
  </div>;
}

/** Resumen del mes de CFO en UNA pantalla: KPI en una fila y el detalle (tendencia, alertas, canales, calidad, proyección) en pestañas; el panel activo llena el alto restante. */
export function BriefingCfoUna({b, informe}: {b: BriefingCfo; informe: (ancla?: string) => string}) {
  const kpis: KpiUna[] = b.kpis.map(k => {
    const refund = k.id.startsWith('refund'), t = (k.delta as {bps?: number | null} | null)?.bps ?? null;
    return {key: k.id, label: `${k.label} · ${b.moneda}`, c: refund ? 2 : 1, value: kpiCorto(k.display), title: k.display + ' · ' + k.how, delta: k.delta ? k.delta.display : null, t: refund || t == null ? undefined : t > 0 ? 'up' : t < 0 ? 'down' : undefined, sub: k.delta ? 'vs ' + k.delta.vs : 'Sin comparación'};
  });
  const pie = (ancla: string) => <div className="una-pie"><CtlLink href={informe(ancla)} variant="ghost">Ver detalle en el informe<span className="sr-only"> completo</span></CtlLink></div>;
  const tabs: PestanaUna[] = [
    {id: 'tendencia', label: 'Tendencia', llena: true, contenido: b.serie ? <G id="serie"><SerieNegocio llena serie={b.serie} titulo={`Ingresos de los últimos 12 meses · ${b.moneda}`} unidad={b.moneda} /></G> : <Vacio>Sin serie de ingresos en {b.moneda}.</Vacio>},
    {id: 'alertas', label: 'Alertas', count: b.alertasActivas, contenido: <>
      {b.caida && <div className="una-caida" role="note"><strong>{b.caida.titulo}</strong><ul>{b.caida.lineas.map((l, i) => <li key={i}>{l}</li>)}</ul><p><strong>{b.caida.causa.split(':')[0]}.</strong> {(r => r.charAt(0).toUpperCase() + r.slice(1))(b.caida.causa.split(':').slice(1).join(':').trim())}</p></div>}
      {b.alertas.length === 0 ? <Vacio>Ninguna regla se activó con los datos actuales.</Vacio> : <ul className="dg-lista" data-cols="dos" aria-label="Alertas">{b.alertas.map(a => <li key={a.id}><span className="dg-lab"><b>{a.titulo}</b><small>{a.detalle}</small></span><Chip tone={a.severity === 'alta' ? 'bad' : a.severity === 'media' ? 'warn' : 'info'}>{a.severidad}</Chip></li>)}</ul>}
      {pie('alertas')}</>},
    {id: 'canales', label: 'Canales', contenido: <><p className="dg-nota" style={{margin: '0 0 8px'}}>Participación por pedidos, 12 meses</p><ListaBarras c={1} max={100} label="Pedidos por canal" items={b.canales.map(c => ({key: c.canal, etiqueta: c.label, sub: `${int(c.n)} pedidos`, valor: (c.shareBps ?? 0) / 100, texto: pct(c.shareBps)}))} />{pie('mezcla')}</>},
    {id: 'calidad', label: 'Calidad', contenido: <>
      <p className="dg-nota" style={{margin: '0 0 10px'}}>{b.parcial ? b.parcial + ' ' : ''}{b.avisoMonedas} Fuente: {lineaDatosHasta({libro: b.corte})}</p>
      <ul className="dg-lista" data-cols="dos" aria-label="Cifras de calidad">{[...b.calidad.cifras.map(f => ({id: f.id, label: f.label, display: f.display})), {id: 'filas', label: 'Registros del libro', display: int(b.calidad.filas)}].map(f => <li key={f.id}><span className="dg-lab"><b>{f.label}</b></span><span className="dg-val">{f.display}</span></li>)}</ul>
      {b.calidad.canalMenosCompleto && <p className="dg-nota">{b.calidad.canalesIncompletos} canal(es) incompletos; el menos completo es {b.calidad.canalMenosCompleto.label} ({pct(b.calidad.canalMenosCompleto.completenessBps)}).</p>}
      {b.calidad.costo.length > 0 && <p className="dg-nota"><G id="kind"><KindBadgeBase kind="estimated" /></G> {b.calidad.costo.map(c => `${c.label}: ${c.display}`).join(' · ')}. Estimado; no suma a lo observado.</p>}
      {pie('calidad')}</>},
    {id: 'proyeccion', label: 'Proyección', contenido: <>
      {b.proyeccion ? <><p className="dg-nota" style={{margin: '0 0 8px'}}><G id="kind-p"><KindBadgeBase kind="estimated" /></G> Estimado, nunca observado · {b.moneda}</p><ul className="dg-lista" data-cols="dos" aria-label="Proyección de ingresos">{b.proyeccion.puntos.map(p => <li key={p.month}><span className="dg-lab"><b>{p.mes}</b><small>rango {p.rango}</small></span><span className="dg-val">{p.medio}</span></li>)}</ul><p className="dg-nota">{b.proyeccion.metodo}</p></>
        : <Vacio>No estimable: se necesitan al menos 4 meses completos en {b.moneda}.</Vacio>}
      {pie('proyecciones')}</>},
  ];
  return <div className="una-cfo" role="region" aria-label="Informe de CFO">
    <h2 className="sr-only">{b.titular.texto}</h2>
    <UnaKpis items={kpis} label={`Último mes completo en ${b.moneda}`} />
    <p className="una-nota" title={`${b.titular.texto} ${b.avisoMonedas}`}><G id="kind-t"><KindBadgeBase kind={b.titular.kind} /></G><span className="una-nota-t"><strong>{b.titular.texto}</strong> {b.parcial ? b.parcial + ' ' : ''}{b.avisoMonedas} Fuente: {lineaDatosHasta({libro: b.corte})}</span></p>
    <PestanasUna items={tabs} etiqueta="Detalle del resumen de CFO" anclas={{tendencias: 'tendencia', mezcla: 'canales', proyecciones: 'proyeccion'}} />
  </div>;
}
