'use client';
import {useState} from 'react';
import {KindBadge} from '../ui/kind-badge';
import {monthLabel, monthShort} from '../../../../../packages/cfo-copilot/src/format.mjs';
import type {Kind} from '../../../../../packages/cfo-copilot/src/index.mjs';

export type MonthPoint = {month: string; value: number | null; label: string; detail?: string; partial?: boolean};
const compact = new Intl.NumberFormat('es-MX', {notation: 'compact', maximumFractionDigits: 1});
/** Barras SVG propias, ancladas a cero, un eje, dato exacto por foco/hover, mes parcial rayado, tabla equivalente. Misma gramática que TrendCharts. */
export function MonthBars({title, unit, points, kind = 'observed', note}: {title: string; unit: string; points: MonthPoint[]; kind?: Exclude<Kind, 'unclassified'>; note?: string}) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(0, ...points.map(p => p.value ?? 0)), W = 480, H = 160, top = 10, left = 40, bottom = 22, bw = (W - left) / Math.max(1, points.length), plot = H - top - bottom;
  const sel = active === null ? null : points[active];
  const ticks = max > 0 ? [0, max / 2, max] : [0];
  return <figure className="chart trend cf-chart">
    <figcaption className="chart-title"><span>{title}</span><span className="trend-meta"><KindBadge kind={kind} /><span>{unit}</span></span></figcaption>
    <div className="trend-plot">
      <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label={title} preserveAspectRatio="xMidYMid meet">
        <defs><pattern id="cf-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="var(--cov-track)" /><line x1="0" y1="0" x2="0" y2="6" stroke="var(--cov-pen)" strokeWidth="3" /></pattern></defs>
        {ticks.map((t, i) => { const y = top + plot - (max > 0 ? t / max * plot : 0); return <g key={i}><line x1={left} x2={W} y1={y} y2={y} className="grid" /><text x={left - 6} y={y + 3} textAnchor="end" className="tick">{compact.format(t)}</text></g>; })}
        {points.map((p, i) => {
          const h = p.value !== null && max > 0 ? Math.max(p.value > 0 ? 2 : 0, p.value / max * plot) : 0, x = left + i * bw + bw * 0.16, w = bw * 0.68;
          return <g key={p.month} tabIndex={0} role="img" aria-label={`${monthLabel(p.month)}${p.partial ? ' (mes incompleto)' : ''}: ${p.label}${p.detail ? '. ' + p.detail : ''}`} className={'bar-col' + (active === i ? ' is-active' : '')} onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)} onFocus={() => setActive(i)} onBlur={() => setActive(null)}>
            <rect x={left + i * bw} y={top} width={bw} height={plot + bottom} className="hit" />
            {p.value === null ? <rect x={x} y={top + plot - 6} width={w} height={6} className="bar-unknown" /> : <rect x={x} y={top + plot - h} width={w} height={h} rx={2} className={'trend-bar trend-' + (p.partial ? 'estimated' : kind)} fill={p.partial ? 'url(#cf-hatch)' : undefined} stroke={p.partial ? 'var(--cov-pen)' : undefined} strokeWidth={p.partial ? 1 : undefined} style={{animationDelay: i * 25 + 'ms'}} />}
            <text x={x + w / 2} y={H - 6} textAnchor="middle" className="tick">{monthShort(p.month)}</text>
          </g>;
        })}
      </svg>
      <div className="trend-tip" role="status" aria-live="polite">{sel ? <><strong>{monthLabel(sel.month)}{sel.partial ? ' · incompleto' : ''}</strong><span>{sel.label}</span>{sel.detail && <span>{sel.detail}</span>}</> : <span className="trend-hint">Pasa el cursor o enfoca una barra para ver el valor exacto.</span>}</div>
    </div>
    {points.some(p => p.partial) && <ul className="legend" aria-label="Leyenda"><li><span className="sw sw-empty" />Rayado: mes incompleto, no comparable</li></ul>}
    {note && <p className="card-lead">{note}</p>}
    <details className="trend-table"><summary>Ver como tabla</summary><div className="table-wrap" tabIndex={0} role="region" aria-label={'Tabla: ' + title}><table><thead><tr><th scope="col">Mes</th><th scope="col" className="num">Valor</th></tr></thead><tbody>{points.map(p => <tr key={p.month}><th scope="row">{monthLabel(p.month)}{p.partial ? ' (incompleto)' : ''}</th><td className="num">{p.label}{p.detail ? ` · ${p.detail}` : ''}</td></tr>)}</tbody></table></div></details>
  </figure>;
}
