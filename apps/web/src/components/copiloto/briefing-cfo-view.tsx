'use client';
import {KindBadge as KindBadgeBase} from '../ui/kind-badge';
import {Card} from '../ui/card';
import {Chip} from '../ui/chip';
import {FilterBar, FilterSpacer} from '../ui/filter-bar';
import {KpiStrip, type Kpi} from '../ui/kpi-strip';
import {Notice} from '../ui/notice';
import {Popover} from '../ui/overlay';
import {SegmentedControl} from '../ui/segmented';
import {Fila, ListaBarras, Vacio} from '../dinero/partes';
import '../dinero/dinero.css';
import {ContenedorErrores} from './contenedor-errores';
import {LinkButton, Download} from '../ui/button';
import {pct, int} from '../../../../../packages/cfo-copilot/src/format.mjs';
import {lineaDatosHasta} from '../../../../../packages/workspace-service/datos-hasta.mjs';
import {SerieNegocio} from './serie-negocio';
import type {BriefingCfo} from './briefing-cfo.mjs';

/** Aísla cada pieza: si una falla se marca con data-fallo en vez de tumbar todo el resumen. */
const G = ({id, children}: {id: string; children: React.ReactNode}) => <ContenedorErrores alFallar={<span data-fallo={id} />}>{children}</ContenedorErrores>;
const KindBadge = (p: React.ComponentProps<typeof KindBadgeBase>) => <G id="kind"><KindBadgeBase {...p} /></G>;
const HREF_EXPORT = (f: 'csv' | 'pdf') => `/cfo/data/export?format=${f}`;
function Detalle({href, children = 'Ver detalle'}: {href: string; children?: string}) { return <a className="cn-link" href={href}>{children}<span className="sr-only"> en el informe completo</span></a>; }

function ExportMenu() {
  return <Popover label="Exportar" align="end" width={220} triggerClassName="btn btn-secondary btn-sm" trigger={<><Download /><span className="btn-label">Exportar</span></>}>
    <ul className="ui-reset" style={{listStyle: 'none', margin: 0, padding: 4, display: 'grid', gap: 4}}>
      <li><a className="btn btn-sm" href={HREF_EXPORT('csv')} download="informe-cfo.csv">Hoja de cálculo (CSV)</a></li>
      <li><a className="btn btn-sm" href={HREF_EXPORT('pdf')} download="informe-cfo.pdf">Documento (PDF)</a></li></ul></Popover>;
}
/** Resumen del mes de CFO (dentro del copiloto): titular, KPI en color, serie de 12 meses, alertas, mezcla por canal, calidad y proyección, con los mismos primitivos que el informe completo. */
export function BriefingCfoView({b, informe, onMoneda, sintetico}: {b: BriefingCfo; informe: (ancla?: string) => string; onMoneda: (m: string) => void; sintetico?: boolean}) {
  const spark = b.serie ? b.serie.principal.filter(p => !p.partial && p.value != null).map(p => p.value as number) : [];
  const kpis: Kpi[] = b.kpis.map(k => {
    const refund = k.id.startsWith('refund'), t = (k.delta as {bps?: number | null} | null)?.bps ?? null;
    return {key: k.id, label: k.label, c: refund ? 2 : 1, value: k.display, spark: !refund && k.id.includes('ingres') ? spark : undefined,
      note: <span className="dg-kpi-nota"><span className="dg-delta" data-t={refund || t == null ? undefined : t > 0 ? 'up' : t < 0 ? 'down' : undefined}>{k.delta ? k.delta.display : 'sin comparar'}</span><span>{k.delta ? 'vs ' + k.delta.vs : 'Sin comparación'}</span></span>};
  });
  return <article className="dg-page" aria-label="Informe de CFO">
    <h2 className="dg-titular">{b.titular.texto}</h2>
    <FilterBar label="Moneda y acciones">
      {b.monedas.length > 1 && <SegmentedControl label="Moneda del resumen" size="sm" value={b.moneda} options={b.monedas.map(m => ({value: m, label: m}))} onChange={onMoneda} />}
      <G id="kind-t"><KindBadgeBase kind={b.titular.kind} /></G>
      {sintetico && <Chip tone="warn">Datos sintéticos de demostración</Chip>}
      <FilterSpacer />
      <G id="ver-detalle"><LinkButton href={informe()} size="sm">Ver detalle</LinkButton></G>
      <G id="exportar"><ExportMenu /></G>
    </FilterBar>
    {b.parcial && <Notice tone="info">{b.parcial}</Notice>}
    <KpiStrip items={kpis} label={`Último mes completo en ${b.moneda}`} />
    <p className="dg-nota" style={{margin: 0}}>{b.avisoMonedas} Fuente: {lineaDatosHasta({libro: b.corte})}</p>
    <Fila split="8-4">
      <Card title={`Ingresos de los últimos 12 meses · ${b.moneda}`} actions={<Detalle href={informe('tendencias')} />}>
        {b.serie ? <G id="serie"><SerieNegocio serie={b.serie} titulo={`Ingresos por mes en ${b.moneda}`} unidad={b.moneda} /></G> : <Vacio>Sin serie de ingresos en {b.moneda}.</Vacio>}</Card>
      <Card title={`Alertas activas (${b.alertasActivas})`} actions={<Detalle href={informe('alertas')} />}>
        {b.alertas.length === 0 ? <Vacio>Ninguna regla se activó con los datos actuales.</Vacio> : <ul className="dg-lista" data-cols="dos" aria-label="Alertas">{b.alertas.map(a => <li key={a.id}><span className="dg-lab"><b>{a.titulo}</b><small>{a.detalle}</small></span><Chip tone={a.severity === 'alta' ? 'bad' : a.severity === 'media' ? 'warn' : 'info'}>{a.severidad}</Chip></li>)}</ul>}</Card>
    </Fila>
    <Fila split="4-4-4">
      <Card title="Mezcla por canal" description="Participación por pedidos, 12 meses" actions={<Detalle href={informe('mezcla')} />}>
        <ListaBarras c={1} max={100} label="Pedidos por canal" items={b.canales.map(c => ({key: c.canal, etiqueta: c.label, sub: `${int(c.n)} pedidos`, valor: (c.shareBps ?? 0) / 100, texto: pct(c.shareBps)}))} /></Card>
      <Card title="Calidad de datos" actions={<Detalle href={informe('calidad')} />}>
        <ul className="dg-lista" data-cols="dos" aria-label="Cifras de calidad">{[...b.calidad.cifras.map(f => ({id: f.id, label: f.label, display: f.display})), {id: 'filas', label: 'Registros del libro', display: int(b.calidad.filas)}].map(f => <li key={f.id}><span className="dg-lab"><b>{f.label}</b></span><span className="dg-val">{f.display}</span></li>)}</ul>
        {b.calidad.canalMenosCompleto && <p className="dg-nota">{b.calidad.canalesIncompletos} canal(es) incompletos; el menos completo es {b.calidad.canalMenosCompleto.label} ({pct(b.calidad.canalMenosCompleto.completenessBps)}).</p>}
        {b.calidad.costo.length > 0 && <p className="dg-nota"><KindBadge kind="estimated" /> {b.calidad.costo.map(c => `${c.label}: ${c.display}`).join(' · ')}. Estimado; no suma a lo observado.</p>}</Card>
      <Card title={`Proyección · ${b.moneda}`} description="Estimado, nunca observado" actions={<Detalle href={informe('proyecciones')} />}>
        {b.proyeccion ? <><ul className="dg-lista" data-cols="dos" aria-label="Proyección de ingresos">{b.proyeccion.puntos.map(p => <li key={p.month}><span className="dg-lab"><b>{p.mes}</b><small>rango {p.rango}</small></span><span className="dg-val">{p.medio}</span></li>)}</ul><p className="dg-nota">{b.proyeccion.metodo}</p></>
          : <Vacio>No estimable: se necesitan al menos 4 meses completos en {b.moneda}.</Vacio>}</Card>
    </Fila>
    {b.caida && <Notice tone="warn" title={b.caida.titulo}><ul style={{margin: '4px 0', paddingLeft: 18}}>{b.caida.lineas.map((l, i) => <li key={i}>{l}</li>)}</ul>
      <strong>{b.caida.causa.split(':')[0]}.</strong> {(r => r.charAt(0).toUpperCase() + r.slice(1))(b.caida.causa.split(':').slice(1).join(':').trim())}</Notice>}
    <p className="dg-nota" style={{margin: 0}}><a className="cn-link" href={informe()}>Ver informe completo</a> · Observado, Estimado e Inferido se distinguen en cada cifra; si un dato falta se dice «No disponible», nunca 0.</p>
  </article>;
}
