import type {CurrencyBlock} from '../../../../../packages/cfo-copilot/src/index.mjs';
import {int} from '../../../../../packages/cfo-copilot/src/format.mjs';
import type {MonthPoint} from './month-bars';
import {traductor, type Traductor, type Idioma} from '../../lib/i18n';

export type Measure = 'ingresos' | 'pedidos' | 'reembolsos' | 'tasa';
/** Serie mensual (la tasa va en puntos base: exponent 2 -> el eje se lee en %). de una medida. `exponent` > 0 indica que `value` viene en unidades menores (centavos) y el eje debe dividirse entre 10^exponent. */
export function seriesPoints(block: CurrencyBlock, measure: Measure, t: Traductor = traductor('es'), idioma?: Idioma): {points: MonthPoint[]; title: string; unit: string; note?: string; exponent: number} {
  const line = block.orderBases[0];
  if (measure === 'ingresos') return {exponent: block.exponent, title: t('cfo.s.ingresos'), unit: block.currency, note: t('cfo.s.ingresosNota', {base: line.label}), points: line.series.map(s => ({month: s.month, partial: s.partial, value: s.known > 0 ? Number(BigInt(s.amount)) : null, label: s.amountDisplay, detail: t('cfo.s.conImporte', {k: int(s.known, idioma), n: int(s.n, idioma)})}))};
  if (measure === 'pedidos') return {exponent: 0, title: t('cfo.s.pedidos'), unit: t('cfo.pro.unidadPedidos'), points: block.ordersAll.map(s => ({month: s.month, partial: s.partial, value: s.n, label: t('cfo.s.nPedidos', {n: int(s.n, idioma)})}))};
  if (measure === 'reembolsos') return {exponent: block.exponent, title: t('cfo.s.reembolsos'), unit: block.currency, note: t('cfo.s.reembNota', {base: block.refunds.label}), points: block.refunds.series.map(s => ({month: s.month, partial: s.partial, value: s.known > 0 ? Number(BigInt(s.amount)) : null, label: s.amountDisplay, detail: t('cfo.s.nReemb', {n: int(s.n, idioma)}) + (s.n - s.known ? t('cfo.s.sinImporte', {n: int(s.n - s.known, idioma)}) : '')}))};
  return {exponent: 2, title: t('cfo.s.tasa'), unit: t('cfo.s.tasaUnidad'), note: t('cfo.s.canales', {lista: block.rate.channels.join(', ') || t('cfo.s.ninguno')}) + (block.rate.excluded.length ? t('cfo.s.sinFuente', {lista: block.rate.excluded.join(', ')}) : '') + '.', points: block.rate.series.map(s => ({month: s.month, partial: s.partial, value: s.bps, label: s.display, detail: t('cfo.s.reembDePedidos', {r: int(s.refunds, idioma), p: int(s.orders, idioma)})}))};
}
