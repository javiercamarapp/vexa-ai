// Resumen y Dinero comparten UNA definición de ingresos: este test corre las mismas filas (agregados reales de vexa-ai, sep-ago 2026, sin PII)
// por la regla compartida y por el modelo CFO de /cfo y exige que coincidan; así no pueden divergir.
//   node --test packages/workspace-service/tests/cifras-libro.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {ingresosDelLibro, BASE_LINEA, ETIQUETA_BASE} from '../cifras-libro.mjs';
import {buildCfoReport, BASIS_LABEL} from '../../cfo-copilot/src/cfo-model.mjs';

const L = 'marketplace_line_price', S = 'gross_order_including_tax_shipping', R = 'marketplace_refund_amount';
const f = (month, kind, status, currency, basis, n, amountMinor, channel) => ({month, kind, status, currency, exponent: 2, basis, n, known: n, amount: String(amountMinor), amountMinor: String(amountMinor), channel});
const FILAS = [
  f('2026-08', 'order', 'recorded', 'USD', L, 9982, 113799766, 'amazon'), f('2026-08', 'order', 'recorded', 'CAD', L, 64, 1627900, 'mirakl_bestbuy_ca'),
  f('2026-08', 'order', 'recorded', 'USD', S, 422, 6229612, 'shopify'), f('2026-08', 'refund', 'settled', 'USD', R, 733, 11704948, 'walmart'),
  f('2026-08', 'refund', 'settled', 'USD', S, 10, 124357, 'shopify'),
  f('2026-09', 'order', 'recorded', 'USD', L, 6315, 80393717, 'amazon'), f('2026-09', 'order', 'recorded', 'USD', L + '|multimoneda', 1, 4499, 'amazon'),
  f('2026-09', 'order', 'recorded', 'USD', L + '|a_revisar:duplicado_exacto_sin_id_linea', 11, 78900, 'amazon'),
  f('2026-09', 'order', 'recorded', 'USD', S, 378, 6723605, 'shopify'), f('2026-09', 'order', 'recorded', 'CAD', L, 92, 2705887, 'mirakl_bestbuy_ca'),
  f('2026-09', 'order', 'cancelled', 'USD', L, 102, 1379513, 'amazon'), f('2026-09', 'refund', 'settled', 'USD', R, 534, 8745892, 'walmart'),
  f('2026-09', 'refund', 'settled', 'USD', S, 11, 205770, 'shopify'),
];
const suma = (filas, kind, mes) => filas.filter(r => r.kind === kind && r.month === mes).reduce((a, r) => a + BigInt(r.amount), 0n);

test('ingresos del mes: Resumen (regla compartida) == Dinero (modelo CFO), en pedidos y reembolsos', () => {
  const ing = ingresosDelLibro(FILAS), cfo = buildCfoReport(FILAS, {watermark: '2026-10-05T00:00:00Z'});
  const usd = cfo.perCurrency.find(c => c.currency === 'USD'), linea = usd.orderBases.find(b => b.base === L);
  assert.equal(ing.moneda, 'USD'); assert.equal(ing.base, L); assert.equal(ing.etiquetaBase, 'Precio de línea de marketplace');
  for (const mes of ['2026-08', '2026-09']) {
    assert.equal(suma(ing.filas, 'order', mes), linea.series.find(s => s.month === mes).amount, 'pedidos ' + mes);
    assert.equal(suma(ing.filas, 'refund', mes), usd.refunds.series.find(s => s.month === mes).amount, 'reembolsos ' + mes);
  }
  assert.equal(suma(ing.filas, 'order', '2026-09'), 80398216n, '803,982.16 USD: lo que dice Dinero');
  assert.equal(suma(ing.filas, 'refund', '2026-09'), 8951662n, 'reembolsos liquidados de septiembre: 89,516.62 USD');
});
test('nunca se suman bases ni monedas, y las filas a revisar quedan fuera', () => {
  const ing = ingresosDelLibro(FILAS);
  assert.ok(!ing.filas.some(r => r.currency === 'CAD'), 'CAD aparte');
  assert.deepEqual(ing.otrasMonedas, ['CAD']);
  assert.deepEqual(ing.otrasBases.map(b => b.base), [S], 'Shopify bruto es otra base: se lista, no se suma');
  assert.equal(ing.aRevisar, 11);
  assert.notEqual(suma(ing.filas, 'order', '2026-09'), 80398216n + 6723605n + 78900n, 'la suma de bases (872,007.21) ya no es posible');
});
test('las etiquetas de base son las mismas en Resumen y Dinero', () => assert.deepEqual({...ETIQUETA_BASE}, {...BASIS_LABEL}));
test('sin pedidos: no hay moneda ni base (no se inventa un 0)', () => {
  const ing = ingresosDelLibro([]); assert.equal(ing.moneda, null); assert.deepEqual(ing.filas, []);
});
test('sin base declarada (consultas viejas) todo cuenta como una sola base', () => {
  const ing = ingresosDelLibro([{month: '2026-09', kind: 'order', status: 'recorded', currency: 'USD', exponent: 2, n: 3, amount: '300'}]);
  assert.equal(ing.filas.length, 1); assert.equal(BASE_LINEA, L);
});
