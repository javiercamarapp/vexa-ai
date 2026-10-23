// UNA definición de los ingresos del libro económico para TODAS las pantallas (Resumen, Dinero /cfo, chat).
// Es la misma regla que usa el modelo CFO (packages/cfo-copilot/src/cfo-model.mjs): una prueba compara ambos con las mismas filas.
//  1. Filas «a_revisar» (duplicados exactos, reembolso en origen) NO cuentan: están aparte, por revisar.
//  2. Los pedidos son los «recorded» de UNA sola base por moneda: la principal («Precio de línea de marketplace»). Nunca se suman bases
//     (p. ej. Shopify «bruto con impuestos y envío» es otra magnitud) ni monedas.
//  3. Los reembolsos son los «settled» (todas las bases de reembolso, ya que cada reembolso es de un solo canal), sin filas a revisar.
//  4. La moneda principal es la que tiene más pedidos «recorded» (como Dinero).
export const BASE_LINEA = 'marketplace_line_price';
export const BASE_REEMBOLSO = 'marketplace_refund_amount';
export const BASE_SHOPIFY = 'gross_order_including_tax_shipping';
export const ETIQUETA_BASE = Object.freeze({
  [BASE_LINEA]: 'Precio de línea de marketplace',
  [BASE_SHOPIFY]: 'Bruto con impuestos y envío (Shopify)',
  [BASE_REEMBOLSO]: 'Importe reembolsado de marketplace',
});
export const baseDe = (basis) => String(basis ?? '').split('|')[0];
export const esARevisar = (basis) => String(basis ?? '').includes('|a_revisar');
const esPedidoOk = (r) => r.kind === 'order' && r.status === 'recorded';
const esReembolsoOk = (r) => r.kind === 'refund' && r.status === 'settled';
const total = (rows) => rows.reduce((a, r) => a + Number(r.n ?? 0), 0);

/**
 * rows = filas mensuales del libro {month, kind, status, currency, exponent, basis, n, known, ...}.
 * Devuelve {filas, moneda, exponente, base, etiquetaBase, otrasBases, otrasMonedas, aRevisar}: `filas` son SOLO las que cuentan
 * (pedidos de la base principal de la moneda principal + reembolsos liquidados de esa moneda), con `basis` sin sufijos.
 */
export function ingresosDelLibro(rows) {
  const lista = Array.isArray(rows) ? rows : [];
  const usadas = lista.filter((r) => !esARevisar(r.basis)).map((r) => ({...r, basis: r.basis === undefined || r.basis === null ? r.basis : baseDe(r.basis)}));
  const aRevisar = total(lista.filter((r) => esARevisar(r.basis)));
  const pedidos = usadas.filter(esPedidoOk);
  const monedas = [...new Set(pedidos.map((r) => r.currency))].sort((a, b) => total(pedidos.filter((r) => r.currency === b)) - total(pedidos.filter((r) => r.currency === a)) || String(a).localeCompare(String(b)));
  const moneda = monedas[0] ?? null;
  if (moneda === null) return {filas: [], moneda: null, exponente: null, base: null, etiquetaBase: null, otrasBases: [], otrasMonedas: [], aRevisar};
  const propios = pedidos.filter((r) => r.currency === moneda);
  const bases = [...new Set(propios.map((r) => r.basis))].sort((a, b) => (a === BASE_LINEA ? -1 : b === BASE_LINEA ? 1 : String(a).localeCompare(String(b))));
  const base = bases[0];
  const exponente = propios[0]?.exponent ?? null;
  const filas = usadas.filter((r) => r.currency === moneda && ((esPedidoOk(r) && r.basis === base) || esReembolsoOk(r)));
  return {
    filas, moneda, exponente: exponente === null ? null : Number(exponente), base: base ?? null, etiquetaBase: ETIQUETA_BASE[base] ?? base ?? null,
    otrasBases: bases.slice(1).map((b) => ({base: b, etiqueta: ETIQUETA_BASE[b] ?? b})), otrasMonedas: monedas.slice(1), aRevisar,
  };
}
