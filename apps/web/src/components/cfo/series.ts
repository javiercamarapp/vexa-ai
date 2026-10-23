import type {CurrencyBlock} from '../../../../../packages/cfo-copilot/src/index.mjs';
import {int} from '../../../../../packages/cfo-copilot/src/format.mjs';
import type {MonthPoint} from './month-bars';

export type Measure = 'ingresos' | 'pedidos' | 'reembolsos' | 'tasa';
/** Serie mensual (la tasa va en puntos base: exponent 2 -> el eje se lee en %). de una medida. `exponent` > 0 indica que `value` viene en unidades menores (centavos) y el eje debe dividirse entre 10^exponent. */
export function seriesPoints(block: CurrencyBlock, measure: Measure): {points: MonthPoint[]; title: string; unit: string; note?: string; exponent: number} {
  const line = block.orderBases[0];
  if (measure === 'ingresos') return {exponent: block.exponent, title: 'Ingresos por mes', unit: block.currency, note: `Base: ${line.label}. Pedidos sin importe no suman (ver Calidad de datos).`, points: line.series.map(s => ({month: s.month, partial: s.partial, value: s.known > 0 ? Number(BigInt(s.amount)) : null, label: s.amountDisplay, detail: `${int(s.known)} de ${int(s.n)} pedidos con importe`}))};
  if (measure === 'pedidos') return {exponent: 0, title: 'Pedidos registrados por mes', unit: 'pedidos', points: block.ordersAll.map(s => ({month: s.month, partial: s.partial, value: s.n, label: int(s.n) + ' pedidos'}))};
  if (measure === 'reembolsos') return {exponent: block.exponent, title: 'Importe reembolsado por mes', unit: block.currency, note: `Base: ${block.refunds.label}. No se resta de los ingresos.`, points: block.refunds.series.map(s => ({month: s.month, partial: s.partial, value: s.known > 0 ? Number(BigInt(s.amount)) : null, label: s.amountDisplay, detail: `${int(s.n)} reembolsos${s.n - s.known ? ` · ${int(s.n - s.known)} sin importe` : ''}`}))};
  return {exponent: 2, title: 'Tasa de reembolso por mes', unit: '% por conteo', note: `Canales incluidos: ${block.rate.channels.join(', ') || 'ninguno'}${block.rate.excluded.length ? `. Sin fuente de devoluciones: ${block.rate.excluded.join(', ')}` : ''}.`, points: block.rate.series.map(s => ({month: s.month, partial: s.partial, value: s.bps, label: s.display, detail: `${int(s.refunds)} reembolsos de ${int(s.orders)} pedidos`}))};
}
