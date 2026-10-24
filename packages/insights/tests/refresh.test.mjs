import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizarSku} from '../sku.mjs';
import {createAfterWork, refreshInsights} from '../refresh.mjs';

test('SKU base: mayúsculas, sin -WMxx / FBA / -NEW; PENDING y vacío son null', () => {
  assert.equal(normalizarSku(' skup-l1-wm12 '), 'SKUP-L1'); assert.equal(normalizarSku('GTX6-M-001A-001'), 'GTX6-M'); assert.equal(normalizarSku('STX2-M1-NEW'), 'STX2-M1');
  assert.equal(normalizarSku('S78560'), 'S78560'); assert.equal(normalizarSku('pending'), null); assert.equal(normalizarSku(''), null); assert.equal(normalizarSku(null), null);
});
test('refreshInsights valida fuente y presupuesto antes de tocar la base', async () => {
  const db = {transaction() { throw Error('no debe llamarse'); }};
  await assert.rejects(refreshInsights(db, {source: 'x'}), /INSIGHT_SOURCE_INVALID/); await assert.rejects(refreshInsights(db, {budgetMs: 10}), /INSIGHT_BUDGET_INVALID/);
});
test('refreshInsights usa la sesión del worker (acción import) con tenant, fuente, desde y presupuesto', async () => {
  const calls = []; const db = {transaction: async (a, w) => w({tenantId: 'T', query: async (sql, args) => { calls.push([a, sql, args]); return {rows: [{r: {status: 'done'}}]}; }})};
  assert.deepEqual(await refreshInsights(db, {source: 'ledger', budgetMs: 1000}), {status: 'done'}); assert.equal(calls[0][0], 'import'); assert.deepEqual(calls[0][2], ['T', 'ledger', null, 1000]);
});
test('gancho: apagado no hace nada; encendido anota y refresca solo con avance; nunca lanza', async () => {
  const log = [], refresh = async (_, o) => { log.push(['refresh', o.source]); return {status: 'done'}; }, record = async (_, o) => { log.push(['record', o.source, o.ok, o.newRecords, o.error]); };
  assert.deepEqual(await createAfterWork({source: 'hubspot', method: 'api_poll', refresh, record})({}, {state: 'done'}), {status: 'disabled'}); assert.equal(log.length, 0);
  const on = createAfterWork({source: 'hubspot', method: 'api_poll', enabled: true, refresh, record, now: () => 1000});
  const a = await on({}, {state: 'done', pages: 4}); assert.equal(a.status, 'ok'); assert.deepEqual(log, [['record', 'hubspot', true, 4, null], ['refresh', 'hubspot'], ['refresh', 'conversations'], ['refresh', 'contacts']]);
  log.length = 0; await on({}, {state: 'idle'}); assert.deepEqual(log, [['record', 'hubspot', true, null, null]]);
  log.length = 0; await on({}, {state: 'blocked', code: 'RECONNECT_REQUIRED'}); assert.deepEqual(log, [['record', 'hubspot', false, null, 'RECONNECT_REQUIRED']]);
  const boom = createAfterWork({source: 'tracker', method: 'manual_upload', enabled: true, refresh: async () => { throw Object.assign(Error('x'), {code: '57014'}); }, record});
  assert.deepEqual(await boom({}, {state: 'done'}), {status: 'error', code: '57014', refreshed: []});
});
test('calentar precálculos de rendimiento: solo si la ruta pasa `warm`, con el alcance correcto, y un fallo no rompe el gancho', async () => {
  const {perfFrioQue, refreshPerfFrio} = await import('../refresh.mjs');
  assert.equal(perfFrioQue(['hubspot', 'conversations', 'contacts']), 'sla'); assert.equal(perfFrioQue(['ledger']), 'ledger'); assert.equal(perfFrioQue(['all']), 'all'); assert.equal(perfFrioQue(['tracker']), null);
  const llamadas = [], warm = async (_, o) => { llamadas.push(o.what); return {status: 'ok'}; }, refresh = async () => ({status: 'done'}), record = async () => {};
  const sin = createAfterWork({source: 'hubspot', method: 'api_poll', enabled: true, refresh, record}); assert.equal((await sin({}, {state: 'done', pages: 1})).perfFrio, undefined);
  const con = createAfterWork({source: 'hubspot', method: 'api_poll', enabled: true, refresh, record, warm}); assert.deepEqual((await con({}, {state: 'done', pages: 1})).perfFrio, {status: 'ok'}); assert.deepEqual(llamadas, ['sla']);
  const db = {transaction: async () => { throw Object.assign(new Error('function public.refresh_perf_frio(uuid, text) does not exist'), {code: '42883'}); }};
  assert.equal((await refreshPerfFrio(db)).status, 'absent');
  assert.equal((await refreshPerfFrio({transaction: async () => { throw Object.assign(new Error('boom'), {code: '57014'}); }})).status, 'error');
});
