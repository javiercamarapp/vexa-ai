// Coherencia de cifras ENTRE pantallas (Resumen, Caída/CFO, Fuga, Brechas): la misma cifra con el mismo valor y periodo da el mismo texto.
// Una sola función de formato es-MX (src/lib/formato/es-mx.mjs); las pantallas la usan o la reexportan. Corre en CI.
//   cd apps/web && node --require ./tests/server-only-stub.cjs --import tsx --test tests/cifras-coherencia.test.mjs
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync, statSync} from 'node:fs';
import {join} from 'node:path';
import * as F from '../src/lib/formato/es-mx.mjs';
import {variacion as variacionInsights} from '../src/lib/legibilidad/insights.mjs';
import {explicarVariacion} from '../src/lib/legibilidad/caida.mjs';
import * as Fuga from '../src/components/refunds/fuga-modelo.mjs';
import * as Brechas from '../src/components/gaps/gaps-modelo.mjs';
import {fmtPct, pct as pctCuentas} from '../src/components/ui/format.ts';

const PARES = [[7064, 10000], [7065, 10000], [7066, 10000], [10000, 7064], [3, 1], [1, 3], [2, 3], [1000, 999], [999, 1000], [1, 1000]];

test('«−29.4 %» (o «29.3 %»): la variación es la misma en Resumen, caída de ingresos y Brechas, con redondeo simétrico', () => {
  assert.equal(F.variacionTexto(7064, 10000), '−29.4 %');
  assert.equal(F.variacionTexto(7065, 10000), '−29.4 %', 'la mitad se aleja de cero, no hacia +∞ como Math.round');
  assert.equal(F.variacionTexto(12935, 10000), '+29.4 %');
  for (const [a, b] of PARES) {
    const esperado = F.variacionDecimas(a, b), ins = variacionInsights(a, b);
    assert.equal(ins.texto, F.porcentaje(Math.abs(esperado) / 10), `Resumen ${a}/${b}`);
    if (esperado !== 0) assert.equal(ins.dir, esperado > 0 ? 'sube' : 'baja');
    assert.equal(Brechas.variacion(esperado / 10), F.porcentaje(esperado / 10, {conSigno: true}), `Brechas ${a}/${b}`);
  }
});
test('la explicación de caída usa la misma variación que Resumen (pedidos, subtotal y ticket)', () => {
  const serie = (antes, despues) => ({perCurrency: [{currency: 'USD', exponent: 2, orderBases: [{series: [{month: '2026-07', n: antes.n, known: 10, amount: String(antes.amount)}, {month: '2026-08', n: despues.n, known: 10, amount: String(despues.amount)}], channelSeries: []}]}], prevComplete: '2026-07', lastComplete: '2026-08', partialMonths: [], watermark: '2026-09-18T20:00:00Z'});
  const r = explicarVariacion(serie({n: 10000, amount: 5000000}, {n: 7065, amount: 3000000}), 'USD');
  const linea = r.lineas.find(l => l.startsWith('Pedidos:'));
  assert.ok(linea.includes(`(${F.variacionTexto(7065, 10000)})`), linea);
  assert.ok(linea.includes(`(${F.variacionTexto(3000000, 5000000)})`), linea);
  assert.match(r.lineas[0], /hasta el 18 sep 2026/, 'los datos llegan hasta el mismo día de corte (UTC) que en las demás pantallas');
});
test('dinero: Fuga, Brechas y la función compartida dan el mismo texto para los mismos centavos (null = «—», nunca $0)', () => {
  for (const m of ['12345600', 12345600, 10499, '0', '-123400', 5n]) {
    assert.equal(Fuga.usd(m), F.usd(m)); assert.equal(Brechas.usd(m), F.usd(m));
    assert.equal(Fuga.usd(m, {decimals: true}), F.usd(m, {decimales: true}));
  }
  assert.equal(F.usd('12345600'), 'US$123,456'); assert.equal(F.usd(null), '—'); assert.equal(Fuga.usd(undefined), '—');
});
test('enteros y porcentajes: 104,024 se escribe igual en todas partes; un decimal siempre; 0 de N no es «—»', () => {
  assert.equal(F.entero(104024), '104,024'); assert.equal(Fuga.num(104024), '104,024'); assert.equal(Brechas.num(104024), '104,024');
  assert.equal(F.entero(null), '—'); assert.equal(F.entero(0), '0');
  for (const p of [0, 8, 29.34, 59.3, 100]) { assert.equal(Fuga.pct(p), F.porcentaje(p)); assert.equal(fmtPct(p), F.porcentaje(p)); assert.equal(Brechas.pct(p), F.porcentaje(p)); }
  assert.equal(F.porcentaje(8), '8.0 %'); assert.equal(fmtPct(null), '—'); assert.equal(pctCuentas(1, 0), null);
  assert.equal(pctCuentas(1, 3), 33.3);
});
test('«datos hasta»: el mismo instante da el mismo día en todas las pantallas (UTC, nunca la zona del navegador)', () => {
  for (const iso of ['2026-09-18T20:00:00Z', '2026-09-18T01:30:00.000Z', '2026-09-17T23:59:59Z', '2026-09-18']) {
    const d = F.diaDeCorte(iso);
    assert.equal(d, iso.slice(0, 10)); assert.equal(Fuga.dia(iso), F.dia(iso));
    assert.equal(F.dia(iso), `${Number(d.slice(8))} sep 2026`);
  }
  assert.equal(F.diaDeCorte(new Date('2026-09-18T01:30:00Z')), '2026-09-18');
  assert.equal(F.diaDeCorte(null), null);
});
test('conversation_monthly (obsoleta) ya no se lee en ningún código de la app ni de los paquetes', () => {
  const raiz = join(import.meta.dirname, '../../..'), malos = [];
  const recorre = (d) => { for (const n of readdirSync(d)) { if (['node_modules', '.next', 'tests', 'test', 'supabase', 'migrations'].includes(n)) continue; const p = join(d, n); if (statSync(p).isDirectory()) recorre(p); else if (/\.(mjs|ts|tsx|js)$/.test(n) && !/\.test\./.test(n)) { const t = readFileSync(p, 'utf8'); if (/(FROM|JOIN)\s+public\.conversation_monthly/i.test(t) || /readConversationMonthly\b(?!FromInsights)/.test(t)) malos.push(p.replace(raiz, '')); } } };
  recorre(join(raiz, 'apps/web/src')); recorre(join(raiz, 'packages'));
  assert.deepEqual(malos, []);
});
