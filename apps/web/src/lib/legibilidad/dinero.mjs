// Lógica pura de la pantalla «Dinero · Preparar» (/economics): estado del corte publicado, cifras por moneda, serie mensual y cobertura por fuente.
// Reglas: USD/CAD/MXN nunca se suman ni se convierten; un importe desconocido es «No disponible», jamás 0; un mes incompleto se rotula.
import {diaCorte} from '../../../../../packages/workspace-service/datos-hasta.mjs';
import {etiquetaBase} from './jerga.mjs';
import {numero} from '../formato/idioma.mjs';
import {X, idiomaDe} from './trad.mjs';

const ESTADOS = Object.freeze({
  ready: {k: 'ready', texto: 'Publicado', tono: 'ok'},
  partial: {k: 'partial', texto: 'Publicado con cobertura parcial', tono: 'warn'},
  stale: {k: 'stale', texto: 'Publicado, desactualizado', tono: 'warn'},
  empty: {k: 'empty', texto: 'Sin corte publicado', tono: 'muted'},
});
const estadoTxt = (e, t) => X(t, 'tr.lg.din.est.' + e.k, e.texto);
/** Base del libro (clave o etiqueta): las tres bases conocidas se traducen; una desconocida conserva la etiqueta que trae el servidor. */
const BASES_LIBRO = Object.freeze({marketplace_line_price: 'Precio de línea de marketplace', gross_order_including_tax_shipping: 'Bruto con impuestos y envío (Shopify)', marketplace_refund_amount: 'Importe reembolsado de marketplace'});
export const baseLibro = (base, etiquetaServidor, t = null) => (BASES_LIBRO[base] ? X(t, 'tr.lg.base.' + base, BASES_LIBRO[base]) : etiquetaServidor);
const dia = (v) => (typeof v === 'string' ? v.slice(0, 10) : '');
const restaDia = (v) => { const t = Date.parse(dia(v) + 'T00:00:00Z'); return Number.isFinite(t) ? new Date(t - 86400000).toISOString().slice(0, 10) : ''; };

/** «2026-08-01» + fin exclusivo «2026-09-22» -> «1 ago 2026 al 21 sep 2026». Si no se puede leer, null (nunca inventado). */
export function rangoLegible(inicio, finExclusivo, t = null) {
  const idioma = idiomaDe(t), a = diaCorte(dia(inicio), idioma), b = diaCorte(restaDia(finExclusivo), idioma);
  return a && b ? X(t, 'tr.lg.din.rango', `${a} al ${b}`, {a, b}) : null;
}

/** Estado del corte publicado a partir de `bundle.meta` de /api/workspace?resource=metrics. Sin meta o sin publicación: no hay corte. */
export function resumenCorte(meta, t = null) {
  if (!meta || typeof meta !== 'object' || !meta.snapshot_id || !meta.scope) return {disponible: false, estado: estadoTxt(ESTADOS.empty, t), tono: ESTADOS.empty.tono};
  const e = ESTADOS[meta.state] ?? ESTADOS.partial, s = meta.scope;
  return {
    disponible: true, estado: estadoTxt(e, t), tono: e.tono,
    rango: rangoLegible(s.date_start, s.date_end, t),
    base: s.basis ? etiquetaBase(s.basis, t) : null,
    moneda: s.currency ?? null,
    snapshot: String(meta.snapshot_id).slice(0, 8),
    datosHasta: diaCorte(meta.watermark, idiomaDe(t)),
    cobertura: typeof meta.coverage === 'string' && !/^Anclaje de alcance/.test(meta.coverage) ? meta.coverage : null,
  };
}

const minor = (v, exp) => (v === null || v === undefined ? null : Number(BigInt(v)) / 10 ** exp);

/** Una tarjeta por moneda y base de ingreso (las bases y las monedas jamás se suman entre sí). Fuente: CfoReport (/cfo/data/report). */
export function tarjetasPorMoneda(report, t = null) {
  const idioma = idiomaDe(t);
  if (!report || !Array.isArray(report.perCurrency)) return [];
  return report.perCurrency.flatMap((pc) => pc.orderBases.map((b) => {
    const n = b.total.n, known = b.total.known;
    return {
      moneda: pc.currency, exponente: pc.exponent, base: b.base, baseLegible: baseLibro(b.base, b.label, t),
      pedidos: n, conImporte: known,
      // desconocido ≠ 0: sin ningún importe conocido no hay subtotal
      subtotalMinor: known > 0 ? String(b.total.amount) : null,
      cobertura: n === 0 ? X(t, 'tr.lg.din.sinRegistros', 'Sin registros') : X(t, 'tr.lg.din.pedConImporte', `${numero(known, 'es')} de ${numero(n, 'es')} pedidos con importe`, {known: numero(known, idioma), n: numero(n, idioma)}),
      completa: n > 0 && known === n,
      reembolsos: pc.refunds.total.n > 0 ? {n: pc.refunds.total.n, conImporte: pc.refunds.total.known} : null,
    };
  }));
}

/** Serie mensual de una moneda y base para la gráfica. `medida`: 'pedidos' | 'subtotal'. Meses incompletos con `parcial`. */
export function serieMensual(report, moneda, base, medida, t = null) {
  const idioma = idiomaDe(t);
  const pc = report?.perCurrency?.find((c) => c.currency === moneda), b = pc?.orderBases.find((x) => x.base === base) ?? pc?.orderBases[0];
  if (!pc || !b) return [];
  return b.series.map((s) => ({
    mes: s.month, parcial: Boolean(s.partial), pedidos: s.n, conImporte: s.known,
    valor: medida === 'pedidos' ? s.n : s.known > 0 ? minor(s.amount, pc.exponent) : null,
    importeMinor: s.known > 0 ? String(s.amount) : null,
    detalle: s.n > 0 && s.known < s.n ? X(t, 'tr.lg.din.conImporte', `${numero(s.known, 'es')} de ${numero(s.n, 'es')} con importe`, {known: numero(s.known, idioma), n: numero(s.n, idioma)}) : undefined,
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
export function mesesIncompletos(report, t = null) {
  const lista = Array.isArray(report?.partialMonths) ? report.partialMonths : [];
  return {meses: lista, datosHasta: diaCorte(report?.watermark, idiomaDe(t))};
}

/**
 * Lectura del corte publicado para «Dinero · Preparar» (resource=problems&meta_only=1: la lectura barata de fijación de alcance que usan Resumen y Brief).
 * El servidor localiza el corte por periodo + moneda + base + exponente. Sin esos parámetros usa el MES EN CURSO con base «net», que no coincide con los cortes
 * publicados (12 meses, base de marketplace): Preparar decía «Aún no hay un corte publicado» mientras Resumen y Brief sí lo leían (A3, QA-2 del 23-oct; el arreglo
 * anterior había quitado también el periodo y la base de la URL). Aquí viajan el periodo, la moneda, la base, el exponente y los filtros del alcance; NO viajan
 * snapshot_id ni scope_hash (un identificador viejo daba 409/400 y «Reintentar» repetía la misma consulta fallida): el corte vigente de ese alcance se resuelve solo.
 */
export const URL_CORTE_PUBLICADO = '/api/workspace?resource=problems&meta_only=1';
const CLAVES_LECTURA = ['date_start', 'date_end', 'currency', 'basis', 'exponent', 'timezone', 'date_basis', 'sku', 'source'];
export function urlCortePublicado(consulta) {
  const origen = new URLSearchParams(typeof consulta === 'string' ? consulta : consulta?.toString?.() ?? '');
  const q = new URLSearchParams({resource: 'problems', meta_only: '1'});
  for (const clave of CLAVES_LECTURA) for (const valor of origen.getAll(clave)) if (valor !== '') q.append(clave, valor);
  return '/api/workspace?' + q.toString();
}
