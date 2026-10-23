// Lógica pura de la pantalla «Dinero · Preparar» (/economics): estado del corte publicado, cifras por moneda, serie mensual y cobertura por fuente.
// Reglas: USD/CAD/MXN nunca se suman ni se convierten; un importe desconocido es «No disponible», jamás 0; un mes incompleto se rotula.
import {diaCorte} from '../../../../../packages/workspace-service/datos-hasta.mjs';
import {etiquetaBase} from './jerga.mjs';

const ESTADOS = Object.freeze({
  ready: {texto: 'Publicado', tono: 'ok'},
  partial: {texto: 'Publicado con cobertura parcial', tono: 'warn'},
  stale: {texto: 'Publicado, desactualizado', tono: 'warn'},
  empty: {texto: 'Sin corte publicado', tono: 'muted'},
});
const dia = (v) => (typeof v === 'string' ? v.slice(0, 10) : '');
const restaDia = (v) => { const t = Date.parse(dia(v) + 'T00:00:00Z'); return Number.isFinite(t) ? new Date(t - 86400000).toISOString().slice(0, 10) : ''; };

/** «2026-08-01» + fin exclusivo «2026-09-22» -> «1 ago 2026 al 21 sep 2026». Si no se puede leer, null (nunca inventado). */
export function rangoLegible(inicio, finExclusivo) {
  const a = diaCorte(dia(inicio)), b = diaCorte(restaDia(finExclusivo));
  return a && b ? `${a} al ${b}` : null;
}

/** Estado del corte publicado a partir de `bundle.meta` de /api/workspace?resource=metrics. Sin meta o sin publicación: no hay corte. */
export function resumenCorte(meta) {
  if (!meta || typeof meta !== 'object' || !meta.snapshot_id || !meta.scope) return {disponible: false, estado: ESTADOS.empty.texto, tono: ESTADOS.empty.tono};
  const e = ESTADOS[meta.state] ?? ESTADOS.partial, s = meta.scope;
  return {
    disponible: true, estado: e.texto, tono: e.tono,
    rango: rangoLegible(s.date_start, s.date_end),
    base: s.basis ? etiquetaBase(s.basis) : null,
    moneda: s.currency ?? null,
    snapshot: String(meta.snapshot_id).slice(0, 8),
    datosHasta: diaCorte(meta.watermark),
    cobertura: typeof meta.coverage === 'string' && !/^Anclaje de alcance/.test(meta.coverage) ? meta.coverage : null,
  };
}

const minor = (v, exp) => (v === null || v === undefined ? null : Number(BigInt(v)) / 10 ** exp);

/** Una tarjeta por moneda y base de ingreso (las bases y las monedas jamás se suman entre sí). Fuente: CfoReport (/cfo/data/report). */
export function tarjetasPorMoneda(report) {
  if (!report || !Array.isArray(report.perCurrency)) return [];
  return report.perCurrency.flatMap((pc) => pc.orderBases.map((b) => {
    const n = b.total.n, known = b.total.known;
    return {
      moneda: pc.currency, exponente: pc.exponent, base: b.base, baseLegible: b.label,
      pedidos: n, conImporte: known,
      // desconocido ≠ 0: sin ningún importe conocido no hay subtotal
      subtotalMinor: known > 0 ? String(b.total.amount) : null,
      cobertura: n === 0 ? 'Sin registros' : `${known.toLocaleString('es-MX')} de ${n.toLocaleString('es-MX')} pedidos con importe`,
      completa: n > 0 && known === n,
      reembolsos: pc.refunds.total.n > 0 ? {n: pc.refunds.total.n, conImporte: pc.refunds.total.known} : null,
    };
  }));
}

/** Serie mensual de una moneda y base para la gráfica. `medida`: 'pedidos' | 'subtotal'. Meses incompletos con `parcial`. */
export function serieMensual(report, moneda, base, medida) {
  const pc = report?.perCurrency?.find((c) => c.currency === moneda), b = pc?.orderBases.find((x) => x.base === base) ?? pc?.orderBases[0];
  if (!pc || !b) return [];
  return b.series.map((s) => ({
    mes: s.month, parcial: Boolean(s.partial), pedidos: s.n, conImporte: s.known,
    valor: medida === 'pedidos' ? s.n : s.known > 0 ? minor(s.amount, pc.exponent) : null,
    importeMinor: s.known > 0 ? String(s.amount) : null,
    detalle: s.n > 0 && s.known < s.n ? `${s.known.toLocaleString('es-MX')} de ${s.n.toLocaleString('es-MX')} con importe` : undefined,
  }));
}

/** Cobertura por fuente (canal) desde la calidad de datos del CfoReport. Reembolsos: sin fuente = «Sin cobertura», no 0. */
export function filasPorFuente(report) {
  if (!report?.quality?.byChannel) return [];
  return report.quality.byChannel.map((c) => ({
    clave: c.channel, fuente: c.label, registros: c.rows, sinMoneda: c.noCurrency, pedidosSinImporte: c.ordersNoAmount,
    reembolsosSinImporte: c.hasRefundSource ? c.refundsNoAmount : null,
    reembolsos: c.hasRefundSource ? 'Con fuente' : 'Sin cobertura',
    completitudBps: c.completenessBps,
    pendientes: c.noCurrency + c.ordersNoAmount + (c.hasRefundSource ? c.refundsNoAmount : 0),
  }));
}

/** Meses incompletos del reporte (corte de la fuente anterior al cierre del mes) con la fecha de corte legible. */
export function mesesIncompletos(report) {
  const lista = Array.isArray(report?.partialMonths) ? report.partialMonths : [];
  return {meses: lista, datosHasta: diaCorte(report?.watermark)};
}

/**
 * Lectura del corte publicado para «Dinero · Preparar». Es el corte ACTIVO (el que leen Resumen y Brief), no uno filtrado por la URL:
 * pasar date_start/date_end/snapshot_id de un enlace viejo daba 409/400 y «Reintentar» repetía la misma consulta fallida (A3, 23-oct).
 * resource=problems&meta_only=1 es la lectura barata de fijación de alcance (misma URL y misma caché que precalienta el menú).
 */
export const URL_CORTE_PUBLICADO = '/api/workspace?resource=problems&meta_only=1';
