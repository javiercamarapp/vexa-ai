'use client';
import {useId, useState} from 'react';
import {useT, useIdioma} from '../i18n/proveedor';
import {KindBadge} from '../ui/kind-badge';
import {axisLabel, monthLabel, monthShort} from '../../../../../packages/cfo-copilot/src/format.mjs';
import {useCaja} from '../cfo/una-ui';
import type {PuntoSerie, SerieIngresos} from './briefing-cfo.mjs';

const W0 = 640, H0 = 230, L = 46, R = 12, T = 14, B = 26;
/** Líneas SVG propias (gramática de la marca): serie principal en negro, comparativas en gris, el mes resaltado en rojo con rótulo.
 *  Un solo eje, anclado en cero; los meses sin importe conocido cortan la línea (desconocido no es cero); el mes incompleto va punteado. */
export function SerieNegocio({serie, titulo, unidad, llena = false}: {serie: SerieIngresos; titulo: string; unidad: string; /** Llena el alto que le deja su contenedor (pantalla única): el trazado se mide en píxeles reales, sin escalar el texto. */ llena?: boolean}) {
  const t = useT(), idioma = useIdioma(), [activo, setActivo] = useState<number | null>(null), id = useId(), [caja, medida] = useCaja<HTMLDivElement>();
  const W = llena && medida.w > 0 ? Math.max(medida.w, 260) : W0, H = llena && medida.h > 0 ? Math.max(medida.h, 120) : H0;
  const n = serie.principal.length;
  const todas = [serie.principal, ...serie.comparativas.map(c => c.puntos)];
  const max = Math.max(0, ...todas.flatMap(s => s.map(p => p.value ?? 0)));
  const x = (i: number) => L + (n <= 1 ? 0 : i * (W - L - R) / (n - 1)), y = (v: number) => T + (H - T - B) * (1 - (max > 0 ? v / max : 0));
  const trazos = (pts: PuntoSerie[]) => {
    // Segmentos continuos de meses conocidos; el tramo que llega a un mes incompleto se dibuja aparte (punteado).
    const out: {d: string; parcial: boolean}[] = [];
    for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i]; if (a.value == null || b.value == null) continue; out.push({d: `M${x(i - 1)},${y(a.value)}L${x(i)},${y(b.value)}`, parcial: b.partial || a.partial}); }
    return out;
  };
  const iRes = serie.resaltado ? serie.principal.findIndex(p => p.month === serie.resaltado) : -1;
  const pRes = iRes >= 0 ? serie.principal[iRes] : null;
  const rotuloRes = serie.motivoResaltado === 'caida' ? t('cop.s.mayorCaida') : t('cop.s.ultimoMes');
  const ticks = max > 0 ? [0, max / 2, max] : [0];
  const sel = activo === null ? null : activo;
  return <figure className="cn-serie" data-llena={llena || undefined} aria-labelledby={id + '-t'}>
    <figcaption id={id + '-t'} className="cn-serie-cap"><span>{titulo}</span><span className="cn-serie-meta"><KindBadge kind="observed" /><span>{unidad}</span></span></figcaption>
    <div className="cn-serie-plot">
      <div className="cn-serie-caja" ref={caja}>
      <svg viewBox={`0 0 ${W} ${H}`} width={llena ? W : undefined} height={llena ? H : undefined} role="group" aria-label={`${titulo}: ${serie.etiquetaPrincipal}${serie.comparativas.length ? t('cop.s.y') + t('cop.s.basesComp', {n: serie.comparativas.length}) : ''}`} preserveAspectRatio="xMidYMid meet">
        {ticks.map((t, i) => <g key={i}><line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className="cn-grid" /><text x={L - 6} y={y(t) + 3} textAnchor="end" className="cn-tick">{axisLabel(t, 0)}</text></g>)}
        {serie.comparativas.map(c => <g key={c.etiqueta} className="cn-comp">{trazos(c.puntos).map((t, i) => <path key={i} d={t.d} strokeDasharray={t.parcial ? '2 4' : undefined} />)}</g>)}
        <g className="cn-main">{trazos(serie.principal).map((t, i) => <path key={i} d={t.d} strokeDasharray={t.parcial ? '3 4' : undefined} />)}
          {serie.principal.map((p, i) => p.value == null ? null : <circle key={p.month} cx={x(i)} cy={y(p.value)} r={p.partial ? 3.6 : 3} className={'cn-dot' + (p.partial ? ' is-partial' : '')} />)}</g>
        {pRes && pRes.value != null && <g className="cn-res"><circle cx={x(iRes)} cy={y(pRes.value)} r={6.5} /><text x={Math.min(Math.max(x(iRes), L + 40), W - R - 40)} y={Math.max(y(pRes.value) - 12, 10)} textAnchor="middle">{rotuloRes}</text></g>}
        {serie.principal.map((p, i) => <text key={p.month} x={x(i)} y={H - 8} textAnchor="middle" className="cn-tick">{n > 8 && i % 2 === 1 ? '' : monthShort(p.month, idioma)}</text>)}
        {serie.principal.map((p, i) => <g key={'h' + p.month} tabIndex={0} role="img" aria-label={`${monthLabel(p.month, idioma)}${p.partial ? t('cop.s.incompleto') : ''}: ${p.value == null ? t('cop.s.sinImporte') : p.display}`} className={'cn-hit' + (sel === i ? ' is-active' : '')} onMouseEnter={() => setActivo(i)} onMouseLeave={() => setActivo(null)} onFocus={() => setActivo(i)} onBlur={() => setActivo(null)}>
          <rect x={x(i) - (W - L - R) / Math.max(1, n - 1) / 2} y={T} width={(W - L - R) / Math.max(1, n - 1)} height={H - T - B} />{sel === i && <line x1={x(i)} x2={x(i)} y1={T} y2={H - B} className="cn-cross" />}</g>)}
      </svg>
      </div>
      <div className="cn-tip" role="status" aria-live="polite">{sel !== null ? <><strong>{monthLabel(serie.principal[sel].month, idioma)}{serie.principal[sel].partial ? t('cop.s.incompletoCorto') : ''}</strong><span>{serie.etiquetaPrincipal}: {serie.principal[sel].value == null ? t('cop.s.sinImporte') : serie.principal[sel].display}</span>{serie.comparativas.map(c => <span key={c.etiqueta} className="cn-tip-comp">{c.etiqueta}: {c.puntos[sel]?.value == null ? t('cop.s.sinImporte') : c.puntos[sel].display}</span>)}</> : <span className="cn-hint">{t('cop.s.hint')}</span>}</div>
    </div>
    <ul className="cn-legend" aria-label={t('cop.s.leyenda')}>
      <li><span className="cn-sw cn-sw-main" aria-hidden="true" />{serie.etiquetaPrincipal}</li>
      {serie.comparativas.map(c => <li key={c.etiqueta}><span className="cn-sw cn-sw-comp" aria-hidden="true" />{c.etiqueta} <small>{t('cop.s.otraBase')}</small></li>)}
      {pRes && <li><span className="cn-sw cn-sw-res" aria-hidden="true" />{rotuloRes}: {monthLabel(pRes.month, idioma)}</li>}
      {serie.principal.some(p => p.partial) && <li><span className="cn-sw cn-sw-part" aria-hidden="true" />{t('cop.s.punteado')}</li>}
    </ul>
    <details className="trend-table"><summary className="ctl">{t('cop.s.verTabla')}</summary><div className="table-wrap" tabIndex={0} role="region" aria-label={t('cop.s.tabla', {titulo})}><table><thead><tr><th scope="col">{t('cop.s.mes')}</th><th scope="col" className="num">{serie.etiquetaPrincipal}</th>{serie.comparativas.map(c => <th scope="col" className="num" key={c.etiqueta}>{c.etiqueta}</th>)}</tr></thead>
      <tbody>{serie.principal.map((p, i) => <tr key={p.month}><th scope="row">{monthLabel(p.month)}{p.partial ? ' (incompleto)' : ''}</th><td className="num">{p.value == null ? 'No disponible' : p.display}</td>{serie.comparativas.map(c => <td className="num" key={c.etiqueta}>{c.puntos[i]?.value == null ? t('cop.s.noDisp') : c.puntos[i].display}</td>)}</tr>)}</tbody></table></div></details>
  </figure>;
}
