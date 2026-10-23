import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildCfoReport, ledgerMonthlyFixture, FIXTURE_WATERMARK, serializeReport} from '../../../packages/cfo-copilot/src/index.mjs';
import {explicarVariacion, CAUSA} from '../src/lib/legibilidad/caida.mjs';

const mk = (rows) => serializeReport(buildCfoReport(rows, {watermark: FIXTURE_WATERMARK, now: new Date('2026-10-20T14:00:00Z')}));
const fila = (month, channel, n, amount) => ({month, channel, kind: 'order', status: 'recorded', currency: 'USD', basis: 'marketplace_line_price', exponent: 2, n, known: n, amountMinor: String(amount)});

test('una caída entre dos meses completos se explica con aritmética por canal y termina en «Causa no determinada»', () => {
  const rows = [fila('2026-08', 'amazon', 800, 800 * 3000), fila('2026-08', 'walmart', 200, 200 * 4000), fila('2026-09', 'amazon', 400, 400 * 3000), fila('2026-09', 'walmart', 0, 0), fila('2026-10', 'amazon', 50, 150000)];
  const r = mk(rows), x = explicarVariacion(r, 'USD');
  assert.ok(x, 'debe haber explicación');
  const t = x.lineas.join('\n');
  assert.match(t, /agosto de 2026 y septiembre de 2026 son meses completos/);
  assert.match(t, /Pedidos: 1,?000 → 400 \(−60[.,]0 %\)/);
  assert.match(t, /Amazon −400 pedidos \(67 % de la caída\)/);
  assert.match(t, /Walmart no tiene registros en septiembre de 2026 y tenía 200/);
  assert.match(t, /octubre de 2026 está incompleto/);
  assert.equal(x.causa, CAUSA); assert.match(x.causa, /^Causa no determinada/);
});
test('sin caída material no hay explicación inventada', () => {
  const rows = [fila('2026-08', 'amazon', 100, 300000), fila('2026-09', 'amazon', 98, 294000)];
  assert.equal(explicarVariacion(mk(rows), 'USD'), null);
  assert.equal(explicarVariacion(null, 'USD'), null);
});
test('con los datos de demostración devuelve algo coherente o null, nunca lanza', () => {
  const r = mk(ledgerMonthlyFixture());
  const x = explicarVariacion(r, 'USD');
  if (x) assert.ok(x.lineas.length >= 2 && /^Causa no determinada/.test(x.causa));
});
