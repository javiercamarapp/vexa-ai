'use client';
import {useState} from 'react';
import {KindBadge as KindBadgeBase} from '../ui/kind-badge';
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
  const [abierto, setAbierto] = useState(false);
  return <div className="cn-menu" onKeyDown={e => { if (e.key === 'Escape') setAbierto(false); }}>
    <button type="button" className="btn btn-sm" aria-expanded={abierto} aria-haspopup="true" onClick={() => setAbierto(v => !v)}><Download /><span className="btn-label">Exportar</span></button>
    {abierto && <div className="cn-menu-list"><a href={HREF_EXPORT('csv')} download="informe-cfo.csv" onClick={() => setAbierto(false)}>Hoja de cálculo (CSV)</a><a href={HREF_EXPORT('pdf')} download="informe-cfo.pdf" onClick={() => setAbierto(false)}>Documento (PDF)</a></div>}
  </div>;
}
/** Briefing de CFO: el primer bloque del copiloto. Un solo titular (h1); el resto son secciones h2 con su clase epistémica, fuente y cobertura. */
export function BriefingCfoView({b, informe, onMoneda, sintetico}: {b: BriefingCfo; informe: (ancla?: string) => string; onMoneda: (m: string) => void; sintetico?: boolean}) {
  const maxCanal = Math.max(1, ...b.canales.map(c => c.shareBps ?? 0));
  return <article className="cn-briefing" aria-label="Informe de CFO">
    <header className="cn-head">
      <p className="cn-eyebrow">CFO · tu copiloto de dinero{sintetico && <span className="chip cn-demo">Datos sintéticos de demostración</span>}</p>
      <h1 className="cn-titular">{b.titular.texto}</h1>
      <p className="cn-fuente"><KindBadge kind={b.titular.kind} /><span>Fuente: {lineaDatosHasta({libro: b.corte})}</span></p>
      {b.parcial && <p className="cn-parcial" role="note">{b.parcial}</p>}
      <div className="cn-acciones">
        {b.monedas.length > 1 && <div className="cn-seg" role="group" aria-label="Moneda del resumen">{b.monedas.map(m => <button key={m} type="button" aria-pressed={m === b.moneda} onClick={() => onMoneda(m)}>{m}</button>)}</div>}
        <G id="ver-detalle"><LinkButton href={informe()} size="sm">Ver detalle</LinkButton></G>
        <G id="exportar"><ExportMenu /></G>
      </div>
    </header>

    <section className="cn-sec" aria-labelledby="cn-kpi"><h2 id="cn-kpi" className="cn-h2">Último mes completo · {b.moneda}</h2>
      <ul className="cn-kpis">{b.kpis.map(k => <li key={k.id} className="cn-kpi"><span className="cn-kpi-l">{k.label}</span><strong className="cn-kpi-v">{k.display}</strong>
        <span className="cn-kpi-d">{k.delta ? <>{k.delta.display} contra {k.delta.vs}</> : 'Sin comparación'}</span><KindBadge kind={k.kind} />{k.cobertura && <small className="cn-kpi-c">{k.cobertura}</small>}</li>)}</ul>
      <p className="cn-nota">{b.avisoMonedas}</p></section>

    <section className="cn-sec" aria-labelledby="cn-alertas"><div className="cn-sec-head"><h2 id="cn-alertas" className="cn-h2">Alertas activas ({b.alertasActivas})</h2><Detalle href={informe('alertas')} /></div>
      {b.alertas.length === 0 ? <p className="cn-vacio">Ninguna regla se activó con los datos actuales.</p> : <ul className="cn-alertas">{b.alertas.map(a => <li key={a.id} data-sev={a.severity}><span className="cn-sev">{a.severidad}</span><div><strong>{a.titulo}</strong><span>{a.detalle}</span></div><KindBadge kind={a.kind} /></li>)}</ul>}</section>

    {b.serie && <section className="cn-sec" aria-labelledby="cn-serie"><div className="cn-sec-head"><h2 id="cn-serie" className="cn-h2">Ingresos de los últimos 12 meses · {b.moneda}</h2><Detalle href={informe('tendencias')} /></div>
      <G id="serie"><SerieNegocio serie={b.serie} titulo={`Ingresos por mes en ${b.moneda}`} unidad={b.moneda} /></G></section>}

    <div className="cn-dos">
      <section className="cn-sec" aria-labelledby="cn-canal"><div className="cn-sec-head"><h2 id="cn-canal" className="cn-h2">Mezcla por canal</h2><Detalle href={informe('mezcla')} /></div>
        <p className="cn-nota">Participación por número de pedidos, 12 meses (no depende de la moneda).</p>
        <ul className="cn-canales">{b.canales.map(c => <li key={c.canal}><span>{c.label}</span><span className="cn-barra" role="img" aria-label={`${c.label}: ${pct(c.shareBps)}`}><span style={{width: Math.max(1, (c.shareBps ?? 0) / maxCanal * 100) + '%'}} /></span><strong>{pct(c.shareBps)}</strong><small>{int(c.n)} pedidos</small></li>)}</ul></section>
      <section className="cn-sec" aria-labelledby="cn-calidad"><div className="cn-sec-head"><h2 id="cn-calidad" className="cn-h2">Calidad de datos</h2><Detalle href={informe('calidad')} /></div>
        <dl className="cn-cal">{b.calidad.cifras.map(f => <div key={f.id}><dt>{f.label}</dt><dd>{f.display}</dd></div>)}<div><dt>Registros del libro</dt><dd>{int(b.calidad.filas)}</dd></div></dl>
        {b.calidad.costo.length > 0 && <div className="cn-costo"><p className="cn-sub">Costo de la mala calidad <KindBadge kind="estimated" /></p>
          <ul>{b.calidad.costo.map(c => <li key={c.id}><span>{c.label}</span><strong>{c.display}</strong></li>)}</ul>
          <p className="cn-nota">Estimado con el ticket promedio conocido de cada canal. No se suma a los ingresos observados.</p></div>}
        {b.calidad.canalMenosCompleto && <p className="cn-nota">Cobertura: {b.calidad.canalesIncompletos} canal(es) con registros incompletos; el menos completo es {b.calidad.canalMenosCompleto.label} ({pct(b.calidad.canalMenosCompleto.completenessBps)}).</p>}</section>
    </div>

    <section className="cn-sec" aria-labelledby="cn-proy"><div className="cn-sec-head"><h2 id="cn-proy" className="cn-h2">Proyección de ingresos · {b.moneda}</h2><Detalle href={informe('proyecciones')} /></div>
      {b.proyeccion ? <>
        <p className="cn-sub"><KindBadge kind="estimated" /> Estimado, nunca observado.</p>
        <ul className="cn-proy">{b.proyeccion.puntos.map(p => <li key={p.month}><span>{p.mes}</span><strong>{p.medio}</strong><small>rango {p.rango}</small></li>)}</ul>
        <details className="cn-supuestos"><summary>Supuestos y método</summary><p>{b.proyeccion.metodo}</p></details>
      </> : <p className="cn-vacio">No estimable: se necesitan al menos 4 meses completos en {b.moneda} para estimar una tendencia.</p>}</section>

    {b.caida && <section className="cn-sec cn-caida" aria-labelledby="cn-caida"><h2 id="cn-caida" className="cn-h2">{b.caida.titulo}</h2>
      <ul>{b.caida.lineas.map((l, i) => <li key={i}>{l}</li>)}</ul>
      <p className="cn-causa"><strong>{b.caida.causa.split(':')[0]}.</strong> {(r => r.charAt(0).toUpperCase() + r.slice(1))(b.caida.causa.split(':').slice(1).join(':').trim())}</p></section>}

    <p className="cn-pie"><a className="cn-link" href={informe()}>Ver informe completo</a> · Observado, Estimado e Inferido se distinguen en cada cifra; si un dato falta se dice «No disponible», nunca 0.</p>
  </article>;
}
