import test from 'node:test';
import assert from 'node:assert/strict';
import {filasSincronizacion, hace, dentroDe, textoError} from '../../src/lib/legibilidad/sincronizacion.mjs';
const AHORA = Date.parse('2026-10-23T12:00:00Z');
const src = o => ({key: 'hubspot', method: 'api_poll', status: 'ok', lastSuccessAt: '2026-10-23T11:55:00Z', nextRunAt: '2026-10-23T12:05:00Z', lastNewRecords: 12, latencyMs: 340, errorCode: null, stale: false, ...o});
test('hace / dentroDe', () => { assert.equal(hace(10), 'hace unos segundos'); assert.equal(hace(300), 'hace 5 min'); assert.equal(hace(7200), 'hace 2 h'); assert.equal(hace(86400 * 3), 'hace 3 días'); assert.equal(dentroDe('2026-10-23T12:05:00Z', AHORA), 'en 5 min'); assert.equal(dentroDe('2026-10-23T11:00:00Z', AHORA), 'en cualquier momento'); assert.equal(dentroDe(null), null); });
test('sin /api/freshness disponible no se inventa nada', () => { assert.deepEqual(filasSincronizacion(null), {disponible: false, fuentes: [], calculos: []}); assert.equal(filasSincronizacion({availability: 'unavailable', sources: [], insights: []}).disponible, false); });
test('fila al día, con error, atrasada, pausa y sin conectar', () => {
  const f = {availability: 'ready', sources: [src({}), src({key: 'zendesk', status: 'error', errorCode: 'RECONNECT_REQUIRED'}), src({key: 'tracker', method: 'manual_upload', stale: true, nextRunAt: null}), src({key: 'ledger', status: 'paused'}), src({key: 'shopify', method: 'stub', status: 'never', lastSuccessAt: null, lastNewRecords: null, latencyMs: null, nextRunAt: null})], insights: []};
  const r = filasSincronizacion(f, AHORA).fuentes;
  assert.deepEqual(r.map(x => x.estado), ['Al día', 'Con error', 'Atrasada', 'En pausa', 'Sin conectar']);
  assert.deepEqual([r[0].exito, r[0].siguiente, r[0].latencia, r[0].metodo], ['hace 5 min', 'en 5 min', '340 ms', 'Consulta periódica por API']);
  assert.equal(r[1].error, 'Hay que volver a conectar la cuenta'); assert.equal(r[2].siguiente, null); assert.equal(r[3].siguiente, null); assert.equal(r[4].exito, 'Nunca'); assert.equal(textoError('XYZ'), 'Error XYZ');
});
test('cálculos: al día, parcial con periodos pendientes, omitido, fallido', () => {
  const i = (insight, status, pending = 0) => ({insight, status, refreshedAt: '2026-10-23T11:00:00Z', pending});
  const r = filasSincronizacion({availability: 'ready', sources: [], insights: [i('conversation_volume', 'ready'), i('refund_by_sku_month', 'partial', 3), i('repeat_contact', 'skipped'), i('thread_resolution', 'failed')]}, AHORA).calculos;
  assert.deepEqual(r.map(x => x.estado), ['Al día', 'Parcial', 'Omitido', 'Falló']); assert.equal(r[0].actualizado, 'hace 1 h'); assert.equal(r[1].pendientes, 3);
});
