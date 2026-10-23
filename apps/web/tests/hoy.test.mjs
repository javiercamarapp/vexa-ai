// «Hoy»: titular con periodo, 4 KPI con sello de 4 campos, atención ordenada por dinero, barra observado vs recuperable sin cifra inventada y estados sin dato.
//   cd apps/web && node --require ./tests/server-only-stub.cjs --import tsx --test tests/hoy.test.mjs
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {vistaSintetica} from './ui/fuga-sintetico.mjs';
import {vistaCarga} from './ui/mapa-sintetico.mjs';
import {buildCfoReport, ledgerMonthlyFixture, exposureFixture, FIXTURE_WATERMARK, serializeReport} from '../../../packages/cfo-copilot/src/index.mjs';
import {sello, diaTxt, haceDeIso} from '../src/lib/confianza/sello.mjs';
import {armarHoy, estadoDe, comoSeCalculo, atencionDe, barraDe, siguienteDe} from '../src/components/hoy/hoy-modelo.mjs';

const fuga = await vistaSintetica(), carga = await vistaCarga();
const cfo = {status: 'ok', report: serializeReport(buildCfoReport(ledgerMonthlyFixture(), {watermark: FIXTURE_WATERMARK, now: new Date('2026-10-20T14:00:00Z'), exposure: exposureFixture()}))};
const AHORA = Date.parse('2026-10-23T12:00:00Z');
const todos = {fuga: 'ok', carga: 'ok', cfo: 'ok'};
const vista = armarHoy({fuga, carga, cfo, estado: todos, ahora: AHORA});

test('sello de 4 campos: clase · fuente · hasta · actualizado; lo que falta se dice, no se rellena', () => {
  const s = sello({clase: 'observed', fuente: 'HubSpot API', hasta: '2026-09-20T05:00:00Z', actualizado: '2026-10-23T11:55:00Z', ahora: AHORA});
  assert.equal(s.texto, 'Observado · HubSpot API · hasta 20 sep 2026 · actualizado hace 5 min');
  const vacio = sello({fuente: 'Tracker de Excel', ahora: AHORA});
  assert.match(vacio.hasta, /^sin fecha de corte$/); assert.match(vacio.actualizado, /^sin hora de actualización$/);
  assert.equal(sello({clase: 'raro', fuente: 'x'}).clase, 'observed'); assert.equal(sello({clase: 'estimated', fuente: 'x'}).claseTxt, 'Estimado');
  assert.equal(diaTxt('2026-10-05'), '5 oct 2026'); assert.equal(diaTxt('no'), null); assert.equal(haceDeIso(null), null);
});
test('4 KPI en orden: ingreso bruto, reembolsos, dinero atorado, respuestas >24 h; cada uno con clase y sello completo', () => {
  assert.deepEqual(vista.kpis.map(k => k.id), ['ingreso', 'reembolsos', 'atorado', 'respuestas24']);
  assert.deepEqual(vista.kpis.map(k => k.etiqueta), ['Ingreso bruto', 'Reembolsos', 'Dinero atorado', 'Respuestas >24 h']);
  for (const k of vista.kpis) { assert.equal(k.estado, 'ok', k.id); assert.equal(k.clase, 'observed'); assert.match(k.sello.texto, /^Observado · .+ · (hasta \d.*|sin fecha de corte) · actualizado /, k.id); assert.ok(comoSeCalculo(k.como, vista.ctxComo), k.id); }
  assert.match(vista.kpis[1].valor, /^\$[\d,]+$/); assert.match(vista.kpis[2].valor, /^\d+ casos$/); assert.match(vista.kpis[3].valor, /^\d+ hilos$/);
  assert.equal(vista.kpis[3].sello.fuente, 'HubSpot API'); assert.equal(vista.kpis[2].sello.hasta, 'sin fecha de corte', 'el Tracker no trae corte: se dice');
});
test('nunca margen, nunca SLA de Zendesk, en ninguna cifra ni explicación', () => {
  const todo = JSON.stringify([vista.titular, vista.kpis, vista.atencion, vista.barra, vista.siguiente, ['ingreso', 'reembolsos', 'atorado', 'respuestas24', 'recuperable'].map(i => comoSeCalculo(i, vista.ctxComo))]);
  assert.ok(!/margen|utilidad|ahorro/i.test(todo.replace(/no es margen ni utilidad|nunca un ahorro garantizado|no es margen/gi, '')), 'sin margen/utilidad/ahorro fuera de las negaciones');
  assert.ok(!/SLA de Zendesk/i.test(todo));
  assert.match(comoSeCalculo('respuestas24').noSabemos[0], /Zendesk no se usa/);
});
test('titular narrativo con periodo y cifra de dinero', () => {
  assert.match(vista.titular.texto, /^Se devolvieron \$[\d,]+ brutos del \d+ \w{3} 2026 al \d+ \w{3} 2026\./); assert.ok(vista.titular.periodo);
});
test('«Requiere tu atención»: máximo 3, el mayor dinero primero, los de conteo al final', () => {
  const a = atencionDe({fuga, carga});
  assert.ok(a.length >= 1 && a.length <= 3); assert.equal(a[0].id, 'fuga-sku'); assert.match(a[0].dinero, /^\$/);
  const solo = atencionDe({fuga: null, carga});
  assert.ok(solo.every(x => x.dinero === null));
  assert.deepEqual(atencionDe({fuga: null, carga: null}), []);
});
test('barra observado vs recuperable [E]: lo recuperable NO tiene cifra (sin supuestos tecleados no hay número)', () => {
  const b = barraDe({fuga}); assert.match(b.observado, /^\$/); assert.equal(b.recuperable, null); assert.match(b.recuperableNota, /Sin tus supuestos no hay cifra/);
  assert.equal(barraDe({fuga: null}), null); assert.equal(comoSeCalculo('recuperable').clase, 'estimated');
});
test('siguiente mejor acción: borrador del paquete del SKU #1; sin SKU no hay acción', () => {
  const s = siguienteDe({fuga}); assert.match(s.titulo, /^Preparar el paquete de reclamo de /); assert.match(s.detalle, /no se envía nada/); assert.equal(siguienteDe({fuga: null}), null);
});
test('estados: sin acceso por rol, cargando, error y vacío; desconocido != 0', () => {
  assert.equal(estadoDe(null, {busy: true}), 'cargando'); assert.equal(estadoDe(null, {status: 403}), 'sin_acceso'); assert.equal(estadoDe(null, {error: 'x'}), 'error'); assert.equal(estadoDe({a: 1}), 'ok'); assert.equal(estadoDe(null), 'vacio');
  const sinDinero = armarHoy({fuga: null, carga, cfo: null, estado: {fuga: 'sin_acceso', carga: 'ok', cfo: 'sin_acceso'}, ahora: AHORA});
  assert.deepEqual(sinDinero.kpis.map(k => k.estado), ['sin_acceso', 'sin_acceso', 'sin_acceso', 'ok']); assert.ok(sinDinero.kpis.slice(0, 3).every(k => k.valor === null));
  const cargando = armarHoy({estado: {fuga: 'cargando', carga: 'cargando', cfo: 'cargando'}, ahora: AHORA});
  assert.equal(cargando.cargando, true); assert.ok(cargando.kpis.every(k => k.estado === 'cargando'));
  const error = armarHoy({estado: {fuga: 'error', carga: 'error', cfo: 'error'}, ahora: AHORA});
  assert.equal(error.vacio, true); assert.ok(error.kpis.every(k => k.estado === 'no_disponible' && k.valor === null)); assert.ok(error.kpis.every(k => /No disponible ahora|Todavía no|Aún no|No hay/.test(k.nota)));
  assert.match(error.titular.texto, /Todavía no hay datos suficientes/);
});
test('un fallo en un bloque no apaga los demás', () => {
  const v = armarHoy({fuga, carga: null, cfo, estado: {fuga: 'ok', carga: 'error', cfo: 'ok'}, ahora: AHORA});
  assert.deepEqual(v.kpis.map(k => k.estado), ['ok', 'ok', 'ok', 'no_disponible']);
});
