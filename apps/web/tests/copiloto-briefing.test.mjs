import test from 'node:test';
import assert from 'node:assert/strict';
import {buildCfoReport, exposureFixture, FIXTURE_WATERMARK, ledgerMonthlyFixture} from '../../../packages/cfo-copilot/src/index.mjs';
import {briefingCfo, monedaElegida, serieIngresos, mesLargo, parametrosConMoneda} from '../src/components/copiloto/briefing-cfo.mjs';

const report = buildCfoReport(ledgerMonthlyFixture(), {watermark: FIXTURE_WATERMARK, now: new Date('2026-10-20T14:00:00Z'), exposure: exposureFixture({})});
test('titular: un mes completo, una moneda, clase Observado y fuente; el mes en curso se dice en una línea', () => {
  const b = briefingCfo(report, 'USD');
  assert.match(b.titular.texto, /^En septiembre de 2026: .*USD de ingresos y .* pedidos/); assert.equal(b.titular.kind, 'observed'); assert.match(b.titular.fuente, /Libro económico/);
  assert.match(b.parcial, /oct 2026 está incompleto/);
  assert.equal(b.kpis.length, 5); assert.ok(b.kpis.every(k => k.id.endsWith(':USD') && k.display.includes('USD') || k.id.startsWith('orders') || k.id.startsWith('rate')));
});
test('nunca suma monedas: cada briefing es de UNA moneda y cambiar de moneda no mezcla cifras', () => {
  const usd = briefingCfo(report, 'USD'), cad = briefingCfo(report, 'CAD');
  assert.notEqual(usd.titular.texto, cad.titular.texto); assert.ok(cad.kpis.every(k => !k.display.includes('USD')));
  assert.match(usd.avisoMonedas, /no se suman ni se convierten/);
  assert.equal(monedaElegida(report, 'EUR'), 'USD'); assert.equal(monedaElegida(report, 'MXN'), 'MXN'); assert.equal(monedaElegida(null, 'USD'), null);
});
test('serie: principal + comparativas de la misma moneda; sin importe es null (no 0); resalta la mayor caída o el último mes completo', () => {
  const s = serieIngresos(report, 'CAD');
  assert.equal(s.principal.length, 12); assert.equal(serieIngresos(report, 'USD').comparativas.length, 1); assert.equal(s.resaltado, '2026-09'); assert.equal(s.motivoResaltado, 'caida');
  assert.equal(s.principal.at(-1).partial, true);
  const sinImporte = structuredClone(report); sinImporte.perCurrency[0].orderBases[0].series[2].known = 0;
  assert.equal(serieIngresos(sinImporte, 'USD').principal[2].value, null);
});
test('caída explicada solo con causa verificable: «Causa no determinada» cuando no hay causa', () => {
  const cad = briefingCfo(report, 'CAD'); assert.ok(cad.caida); assert.match(cad.caida.causa, /^Causa no determinada/);
  assert.equal(briefingCfo(report, 'USD').caida, null);
});
test('proyección Estimada con método; calidad con costo Estimado; siguientes preguntas por reglas con consulta directa', () => {
  const b = briefingCfo(report, 'USD');
  assert.equal(b.proyeccion.kind, 'estimated'); assert.equal(b.proyeccion.puntos.length, 3); assert.ok(b.proyeccion.metodo.length > 10);
  assert.ok(b.calidad.costo.length >= 2 && b.calidad.costo.every(c => c.label.length));
  assert.ok(b.siguientes.length >= 2 && b.siguientes.length <= 4);
  assert.ok(b.siguientes.every(s => s.pregunta.startsWith('¿') && s.directa.tool && s.motivo));
  assert.ok(b.siguientes.some(s => s.pregunta === '¿Qué canal sin importes pesa más?'));
  assert.ok(briefingCfo(report, 'CAD').siguientes.some(s => s.pregunta === '¿Por qué cayó septiembre?'));
});
test('alertas activas excluyen las informativas y se ordenan por severidad', () => {
  const b = briefingCfo(report, 'USD');
  assert.equal(b.alertasActivas, report.alerts.filter(a => a.severity !== 'info').length); assert.equal(b.alertas[0].severity, 'alta'); assert.ok(b.alertas.length <= 3);
});
test('mesLargo', () => { assert.equal(mesLargo('2026-09'), 'septiembre de 2026'); assert.equal(mesLargo(null), ''); });

test('cambiar la moneda descarta el corte (snapshot_id/scope_hash) del alcance anterior y conserva el resto', () => {
  const q = new URLSearchParams(parametrosConMoneda('date_start=2026-08-01&date_end=2026-09-21&currency=USD&basis=marketplace_line_price&snapshot_id=f3937770-c59a&scope_hash=5220&date_basis=order', 'CAD'));
  assert.equal(q.get('currency'), 'CAD');
  assert.equal(q.get('snapshot_id'), null); assert.equal(q.get('scope_hash'), null);
  assert.equal(q.get('date_start'), '2026-08-01'); assert.equal(q.get('date_end'), '2026-09-21'); assert.equal(q.get('basis'), 'marketplace_line_price'); assert.equal(q.get('date_basis'), 'order');
});
test('parametrosConMoneda: sin parámetros previos solo fija la moneda; vuelve a USD sin corte', () => {
  assert.equal(parametrosConMoneda('', 'USD'), 'currency=USD');
  assert.equal(parametrosConMoneda(undefined, 'MXN'), 'currency=MXN');
  assert.equal(parametrosConMoneda('currency=CAD&snapshot_id=a&scope_hash=b', 'USD'), 'currency=USD');
});
