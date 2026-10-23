'use client';
import {KindBadge} from '../ui/kind-badge';
import {ColumnPlot, type ColumnDatum} from '../ui/column-chart';
import {axisLabel, monthLabel, monthShort} from '../../../../../packages/cfo-copilot/src/format.mjs';
import type {Kind} from '../../../../../packages/cfo-copilot/src/index.mjs';

export type MonthPoint = {month: string; value: number | null; label: string; detail?: string; partial?: boolean};
/** Barras mensuales del tablero CFO: el mismo trazado que el resto del producto (ColumnPlot), ancladas a cero, un eje, tooltip por foco/hover, mes parcial con trama, tabla equivalente. */
/** `c` = color de la métrica (1..8, ingreso = 1); `height` = alto del trazado. */
export function MonthBars({title, unit, points, kind = 'observed', note, exponent = 0, c = 1, height}: {title: string; unit: string; points: MonthPoint[]; /** Decimales de la moneda cuando `value` viene en unidades menores (centavos); 0 si ya está en unidades mayores o son conteos. */ exponent?: number; kind?: Exclude<Kind, 'unclassified'>; note?: string; c?: number; height?: number}) {
  const data: ColumnDatum[] = points.map(p => ({key: p.month, label: monthShort(p.month), long: monthLabel(p.month), value: p.value, display: p.label, detail: p.detail, partial: p.partial}));
  return <figure className="chart trend cf-chart" data-c={c} style={{['--cfc' as string]: `var(--chart-${((c - 1) % 8) + 1})`}}>
    <figcaption className="chart-title"><span>{title}</span><span className="trend-meta"><KindBadge kind={kind} /><span>{unit}</span></span></figcaption>
    <ColumnPlot height={height} data={data} kind={kind === 'observed' || kind === 'estimated' || kind === 'inferred' ? kind : 'observed'} title={title} axis={t => axisLabel(t, exponent)} deltaMode={unit.startsWith('%') ? 'pp' : 'pct'} />
    {note && <p className="card-lead">{note}</p>}
    <details className="trend-table"><summary>Ver como tabla</summary><div className="table-wrap" tabIndex={0} role="region" aria-label={'Tabla: ' + title}><table><thead><tr><th scope="col">Mes</th><th scope="col" className="num">Valor</th></tr></thead><tbody>{points.map(p => <tr key={p.month}><th scope="row">{monthLabel(p.month)}{p.partial ? ' (incompleto)' : ''}</th><td className="num">{p.label}{p.detail ? ` · ${p.detail}` : ''}</td></tr>)}</tbody></table></div></details>
  </figure>;
}
