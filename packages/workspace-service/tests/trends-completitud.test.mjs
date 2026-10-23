// Tendencias: el payload declara hasta dónde llegan los datos y qué meses son parciales (octubre con 5 días no es una caída).
// Base simulada (sin Postgres): responde por forma de sentencia; los resúmenes precomputados no existen => camino directo.
//   node --test packages/workspace-service/tests/trends-completitud.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {createTrendsRepository,monthWindow} from '../trends.mjs';

const NOW = new Date('2026-10-22T12:00:00Z');
const fakeDb = ({ledger, conv, states = {}, monthly = [], last = null}) => ({async transaction(_a, work) {
  const query = async (text, args = []) => {
    if (/current_setting/.test(text)) return {rows: [{v: '0'}]};
    if (/summary_refresh_state/.test(text)) return {rows: states[args[1]] ?? []};
    if (/AS wm/.test(text)) return {rows: [{wm: '2026-10-19 12:00:00.000000', n: '1'}]};
    if (/FROM public\.economic_ledger_monthly/.test(text)) return {rows: monthly};
    if (/^SELECT max\(effective_at\) AS last_at/.test(text)) return {rows: [{last_at: last}]};
    if (/FROM \(SELECT 1 FROM public\.conversations/.test(text)) return {rows: [{n: 10}]};
    if (/coalesce\(c\.started_at/.test(text)) return {rows: conv};
    if (/economic_ledger_entries/.test(text)) return {rows: ledger};
    return {rows: []};
  };
  return work({tenantId: 't', query});
}});

test('libro: octubre con 5 días queda como mes parcial y la marca de datos es el último asiento', async () => {
  const ledger = [
    {month: '2026-08', kind: 'order', status: 'recorded', currency: 'USD', exponent: 2, n: 300, amount: '94100000', unknown: 0, last_at: new Date('2026-08-31T20:00:00Z')},
    {month: '2026-09', kind: 'order', status: 'recorded', currency: 'USD', exponent: 2, n: 320, amount: '104500000', unknown: 0, last_at: new Date('2026-09-30T22:00:00Z')},
    {month: '2026-10', kind: 'order', status: 'recorded', currency: 'USD', exponent: 2, n: 220, amount: '2650000', unknown: 0, last_at: new Date('2026-10-05T10:00:00Z')},
  ];
  const v = await createTrendsRepository({database: fakeDb({ledger, conv: []}), now: () => NOW}).monthly();
  assert.deepEqual(v.ledger.completeness, {basis: 'data', dataThrough: '2026-10-05', partialMonth: '2026-10', partialMonths: ['2026-10']});
  assert.equal(v.ledger.series.find(p => p.month === '2026-10').orders.count, 220);
  assert.deepEqual(v.ledger.series.map(p => p.refunds.count).filter(Boolean), [], 'sin reembolsos: la serie lleva 0 registros, no un dato');
});

test('conversaciones: septiembre con datos hasta el 14 es parcial junto con octubre', async () => {
  const conv = [{month: '2026-08', n: 100, undated: 0, last_at: new Date('2026-08-30T00:00:00Z')}, {month: '2026-09', n: 40, undated: 0, last_at: new Date('2026-09-14T09:00:00Z')}];
  const v = await createTrendsRepository({database: fakeDb({ledger: [], conv}), now: () => NOW}).monthly();
  assert.equal(v.conversations.completeness.dataThrough, '2026-09-14');
  assert.deepEqual(v.conversations.completeness.partialMonths, ['2026-09']);
});

test('libro con resumen precomputado: la marca de datos es la fecha efectiva más reciente, no la fecha de carga', async () => {
  const win = monthWindow(NOW), st = win.list.map(m => ({month: m, refreshed_at: '2026-10-19T12:00:00Z', wm: '2026-10-19 12:00:00.000000', source_watermark: '2026-10-19T12:00:00Z', source_count: '1', source_rows: 1, detail: {}}));
  const monthly = [{month: '2026-09', source_id: 's', kind: 'order', status: 'recorded', currency: 'USD', exponent: 2, basis: 'net', n: 320, known: 320, amount: '104500000'},
    {month: '2026-10', source_id: 's', kind: 'order', status: 'recorded', currency: 'USD', exponent: 2, basis: 'net', n: 220, known: 220, amount: '2650000'}];
  const v = await createTrendsRepository({database: fakeDb({ledger: [], conv: [], states: {ledger_monthly: st}, monthly, last: new Date('2026-10-05T10:00:00Z')}), now: () => NOW}).monthly();
  assert.equal(v.ledger.summary.source, 'summary');
  assert.deepEqual(v.ledger.completeness, {basis: 'data', dataThrough: '2026-10-05', partialMonth: '2026-10', partialMonths: ['2026-10']});
});
test('libro con resumen y sin consulta de fecha: cae a la marca de agua del resumen', async () => {
  const win = monthWindow(NOW), st = win.list.map(m => ({month: m, refreshed_at: '2026-10-19T12:00:00Z', wm: '2026-10-19 12:00:00.000000', source_watermark: '2026-10-19T12:00:00Z', source_count: '1', source_rows: 1, detail: {}}));
  const monthly = [{month: '2026-09', source_id: 's', kind: 'order', status: 'recorded', currency: 'USD', exponent: 2, basis: 'net', n: 1, known: 1, amount: '100'}];
  const v = await createTrendsRepository({database: fakeDb({ledger: [], conv: [], states: {ledger_monthly: st}, monthly, last: null}), now: () => NOW}).monthly();
  assert.equal(v.ledger.completeness.dataThrough, '2026-10-19');
  assert.equal(v.ledger.completeness.basis, 'data');
});

test('conversaciones con resumen: «datos hasta» es el mensaje n.º 200 más reciente (acotado por índice), no la marca del resumen', async () => {
  const win = monthWindow(NOW), st = win.list.map(m => ({month: m, refreshed_at: '2026-10-19T12:00:00Z', wm: '2026-10-19 12:00:00.000000', source_watermark: '2026-10-19T12:00:00Z', source_count: '1', source_rows: 1, detail: {}}));
  const seen = [];
  const db = {async transaction(_a, work) { return work({tenantId: 't', query: async (text, args = []) => {
    if (/current_setting/.test(text)) return {rows: [{v: '0'}]};
    if (/summary_refresh_state/.test(text)) return {rows: []};
    if (/AS wm/.test(text)) return {rows: [{wm: '2026-10-19 12:00:00.000000', saved: '2026-10-19 12:00:00.000000', n: '1'}]};
    if (/FROM public\.insight_state/.test(text)) return {rows: args[1] === 'conversation_volume' ? [{status: 'ready', refreshed_at: '2026-10-19T12:00:00Z', source_watermark: '2026-10-19T12:00:00Z', computed_from: {}, detail: {undated: 0, total: 3894}}] : []};
    if (/FROM public\.insight_conversation_volume/.test(text)) return {rows: [{period: '2026-08-01', n: 2576}, {period: '2026-09-01', n: 1318}]};
    if (/FROM public\.messages WHERE tenant_id=\$1 AND deleted_at IS NULL AND occurred_at IS NOT NULL/.test(text)) { seen.push(text); return {rows: [{last_at: new Date('2026-09-18T20:00:00Z')}]}; }
    return {rows: []};
  }}); }};
  const v = await createTrendsRepository({database: db, now: () => NOW}).monthly();
  assert.equal(v.conversations.summary.source, 'summary');
  assert.equal(v.conversations.completeness.dataThrough, '2026-09-18');
  assert.deepEqual(v.conversations.completeness.partialMonths, ['2026-09']);
  assert.match(seen[0], /OFFSET 199 LIMIT 1/);
});
