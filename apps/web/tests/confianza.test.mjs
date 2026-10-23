// «Datos y confianza»: alerta de frescura (>3x la cadencia), bloques desde datos reales y «qué no sabemos» sin cifras inventadas.
//   cd apps/web && node --require ./tests/server-only-stub.cjs --import tsx --test tests/confianza.test.mjs
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {vistaSintetica} from './ui/fuga-sintetico.mjs';
import {vistaCarga} from './ui/mapa-sintetico.mjs';
import {nivelFuente, bloqueFuentes, bloqueFrescura, bloqueVentanas, queNoSabemos} from '../src/components/confianza/confianza-modelo.mjs';

const AHORA = Date.parse('2026-10-23T12:00:00Z'), H = 3600 * 1000;
const src = (o) => ({key: 'hubspot', method: 'api_poll', status: 'idle', lastSuccessAt: new Date(AHORA - 5 * 60000).toISOString(), expectedEverySeconds: 300, nextRunAt: new Date(AHORA + 60000).toISOString(), lastNewRecords: 4, errorCode: null, dataWatermark: '2026-10-23T11:00:00Z', ...o});
const fresh = {availability: 'ready', version: 'x', sources: [src({}), src({key: 'tracker', method: 'manual_upload', expectedEverySeconds: null, nextRunAt: null})],
  insights: [{insight: 'refund_by_sku_month', status: 'ready', refreshedAt: new Date(AHORA - H).toISOString(), sourceWatermark: '2026-09-20T00:00:00Z', rows: 1200, pending: 0}, {insight: 'thread_resolution', status: 'failed', refreshedAt: null, sourceWatermark: null, rows: 0, pending: 0}]};

test('alerta de frescura: >3x la cadencia es alerta, entre 2x y 3x atrasada; manual no alerta; error siempre alerta', () => {
  assert.equal(nivelFuente(src({}), AHORA), 'ok');
  assert.equal(nivelFuente(src({lastSuccessAt: new Date(AHORA - 700 * 1000).toISOString()}), AHORA), 'atrasada');
  assert.equal(nivelFuente(src({lastSuccessAt: new Date(AHORA - 1000 * 1000).toISOString()}), AHORA), 'alerta');
  assert.equal(nivelFuente(src({lastSuccessAt: null}), AHORA), 'alerta', 'cadencia esperada y nunca corrió: alerta, no «al día»');
  assert.equal(nivelFuente(src({expectedEverySeconds: null}), AHORA), 'manual');
  assert.equal(nivelFuente(src({status: 'error'}), AHORA), 'alerta'); assert.equal(nivelFuente(src({status: 'paused'}), AHORA), 'pausa');
  assert.equal(nivelFuente(src({method: 'stub', status: 'never', lastSuccessAt: null}), AHORA), 'sin_datos');
});
test('bloques 1 y 2 salen de /api/freshness; sin disponibilidad se dice, no se inventa', () => {
  const b1 = bloqueFuentes(fresh, AHORA); assert.equal(b1.disponible, true); assert.equal(b1.filas[0].exito, 'hace 5 min'); assert.equal(b1.filas[0].hasta, '23 oct 2026'); assert.equal(b1.filas[1].estado, 'Carga manual');
  const b2 = bloqueFrescura(fresh, AHORA); assert.equal(b2.filas.length, 2); assert.equal(b2.filas[1].estado, 'Falló'); assert.equal(b2.filas[1].corte, null); assert.equal(b2.alertas, 1);
  assert.equal(bloqueFuentes({availability: 'unavailable', sources: [], insights: []}).disponible, false); assert.equal(bloqueFrescura(null).disponible, false);
});
test('bloque 3: ventanas por canal desde la vista de Fuga', async () => {
  const fuga = await vistaSintetica(), v = bloqueVentanas(fuga);
  assert.equal(v.disponible, true); assert.match(v.linea, /ventana/i); assert.ok(v.filas.length > 0); assert.ok(v.filas.every(w => ['Reembolsos', 'Pedidos'].includes(w.tipo)));
  assert.equal(bloqueVentanas(null).disponible, false);
});
test('bloque 4: qué no sabemos son tareas con afecta/cierra y salen de datos reales', async () => {
  const fuga = await vistaSintetica(), carga = await vistaCarga();
  const t = queNoSabemos({fuga, carga, cobertura: {sources: [{key: 'zendesk', label: 'Zendesk', loaded: false, status: 'empty'}]}, frescura: fresh, ahora: AHORA});
  for (const x of t) { assert.ok(x.titulo && x.afecta && x.cierra && x.base, x.clave); }
  const claves = t.map(x => x.clave);
  for (const k of ['ventanas', 'cantidad', 'tracker-moneda', 'zendesk', 'sin-cargar-zendesk']) assert.ok(claves.includes(k), k);
  assert.ok(!claves.includes('alerta-hubspot'), 'hubspot al día no genera tarea');
  assert.ok(queNoSabemos({frescura: {sources: [src({lastSuccessAt: new Date(AHORA - 3600 * 1000).toISOString()})]}, ahora: AHORA}).some(x => x.clave === 'alerta-hubspot'));
  assert.deepEqual(queNoSabemos({}), []);
  assert.ok(!/margen|SLA de Zendesk/i.test(JSON.stringify(t)));
});
