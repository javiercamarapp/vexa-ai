import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildCfoReport, ledgerMonthlyFixture, FIXTURE_WATERMARK, serializeReport} from '../../../packages/cfo-copilot/src/index.mjs';
import {rangoLegible, resumenCorte, tarjetasPorMoneda, serieMensual, filasPorFuente, mesesIncompletos} from '../src/lib/legibilidad/dinero.mjs';

const report = serializeReport(buildCfoReport(ledgerMonthlyFixture(), {watermark: FIXTURE_WATERMARK, now: new Date('2026-10-20T14:00:00Z')}));

test('rango legible: el fin es exclusivo y se muestra el último día incluido', () => {
  assert.equal(rangoLegible('2026-08-01T00:00:00.000Z', '2026-09-22T00:00:00.000Z'), '1 ago 2026 al 21 sep 2026');
  assert.equal(rangoLegible('ayer', '2026-09-22'), null);
});

test('resumen del corte: sin publicación no inventa nada; con publicación traduce la base', () => {
  assert.equal(resumenCorte(null).disponible, false);
  assert.equal(resumenCorte({state: 'empty', snapshot_id: null}).disponible, false);
  const c = resumenCorte({state: 'partial', snapshot_id: 'f3937770-aaaa-bbbb-cccc-111122223333', watermark: '2026-10-05T00:00:00.000Z', coverage: 'Corte parcial', scope: {date_start: '2026-08-01T00:00:00.000Z', date_end: '2026-09-22T00:00:00.000Z', currency: 'USD', basis: 'marketplace_line_price'}});
  assert.equal(c.disponible, true);
  assert.equal(c.base, 'Precio de línea de marketplace');
  assert.equal(c.snapshot, 'f3937770');
  assert.equal(c.datosHasta, '5 oct 2026');
  assert.equal(c.estado, 'Publicado con cobertura parcial');
});

test('una tarjeta por moneda y base: las monedas no se suman y los reembolsos ausentes son null, no 0', () => {
  const t = tarjetasPorMoneda(report), monedas = new Set(t.map((x) => x.moneda));
  assert.ok(monedas.has('USD') && monedas.has('CAD'));
  const usd = t.find((x) => x.moneda === 'USD' && x.base === 'marketplace_line_price');
  assert.ok(usd.pedidos > 0 && usd.conImporte <= usd.pedidos && typeof usd.subtotalMinor === 'string');
  assert.ok(t.every((x) => x.reembolsos === null || x.reembolsos.n > 0));
});

test('serie mensual: el mes en curso va rotulado como incompleto y un mes sin importes es null, no 0', () => {
  const s = serieMensual(report, 'USD', 'marketplace_line_price', 'subtotal');
  assert.ok(s.length >= 12);
  assert.equal(s.at(-1).parcial, true);
  assert.equal(s.at(-1).mes, '2026-10');
  assert.ok(s.every((p) => p.valor === null || p.valor >= 0));
  const p = serieMensual(report, 'USD', 'marketplace_line_price', 'pedidos');
  assert.ok(p.every((x) => x.valor === x.pedidos));
  assert.deepEqual(serieMensual(report, 'EUR', 'x', 'pedidos'), []);
});

test('cobertura por fuente: sin fuente de devoluciones dice «Sin cobertura» y no cuenta como 0 pendientes', () => {
  const f = filasPorFuente(report), sinFuente = f.filter((x) => x.reembolsos === 'Sin cobertura');
  assert.ok(f.length >= 4);
  for (const x of sinFuente) assert.equal(x.reembolsosSinImporte, null);
  assert.ok(f.every((x) => x.pendientes >= 0));
  assert.deepEqual(filasPorFuente(null), []);
});

test('meses incompletos con fecha de corte legible', () => {
  const m = mesesIncompletos(report);
  assert.deepEqual(m.meses, ['2026-10']);
  assert.equal(m.datosHasta, '5 oct 2026');
});
