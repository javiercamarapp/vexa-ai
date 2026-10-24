// Puerto REAL (createWorkspacePort) contra un `database` simulado: forma, monedas separadas, unknown ≠ 0, límites y honestidad ante topes de tiempo.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkspacePort, assertPort, createAgent, contractViolations, executeTool } from '../index.mjs';
import { shapeLedgerRows } from '../port-queries.mjs';
import { ctxFor } from './helpers.mjs';

const NOW = new Date('2026-10-23T12:00:00Z');
const T = '00000000-0000-4000-8000-0000000000aa';
const SRC = { amazon: '67520fdd-0000-0000-0000-000000000001', walmart: '2e5c3942-0000-0000-0000-000000000002', shopify: '3d47b75d-0000-0000-0000-000000000003', bbCA: 'd35cdfa9-0000-0000-0000-000000000004', bbUS: 'a4eaa69c-0000-0000-0000-000000000005', amzRef: '8107854d-0000-0000-0000-000000000006', wmRef: 'e331c8c6-0000-0000-0000-000000000007' };
const NAMES = [
  { source_id: SRC.amazon, name: 'Marketplace Amazon · Pedidos (export recibido 2026-10-05)' }, { source_id: SRC.walmart, name: 'Marketplace Walmart · Pedidos (export recibido 2026-10-05)' },
  { source_id: SRC.shopify, name: 'Shopify CLIENTEX · Pedidos disponibles al 5 oct 2026' }, { source_id: SRC.bbCA, name: 'Marketplace Best Buy CA (Mirakl) · Pedidos (export recibido 2026-10-05)' },
  { source_id: SRC.bbUS, name: 'Marketplace Best Buy US (Mirakl) · Pedidos (export recibido 2026-10-05)' },
  { source_id: SRC.amzRef, name: 'Marketplace Amazon · Devoluciones (export recibido 2026-10-05)' }, { source_id: SRC.wmRef, name: 'Marketplace Walmart · Devoluciones (export recibido 2026-10-05)' },
];
const L = (source_id, status, basis, currency, n, known, amount) => ({ source_id, status, basis, currency, exponent: 2, n, known, amount });
const LIVE_REFUNDS = [
  L(SRC.amzRef, 'unknown', 'marketplace_refund_amount', 'USD', 3000, 2400, '31000000'), L(SRC.wmRef, 'settled', 'marketplace_refund_amount', 'USD', 1700, 1700, '28000000'),
  L(SRC.wmRef, 'cancelled', 'marketplace_refund_amount', 'USD', 600, 600, '11500000'), L(SRC.wmRef, 'pending', 'marketplace_refund_amount', 'USD', 600, 600, '13700000'),
];
const LIVE_ORDERS = [
  L(SRC.amazon, 'recorded', 'marketplace_line_price', 'USD', 3287, 3287, '49359852'), L(SRC.amazon, 'recorded', 'marketplace_line_price', 'CAD', 28, 28, '1102187'),
  L(SRC.amazon, 'cancelled', 'marketplace_line_price', 'USD', 100, 100, '999999'), L(SRC.amazon, 'recorded', 'marketplace_line_price|a_revisar:duplicado_exacto_sin_id_linea', 'USD', 5, 5, '5000'),
  L(SRC.bbCA, 'recorded', 'marketplace_line_price', 'CAD', 64, 64, '1603700'), L(SRC.bbUS, 'recorded', 'marketplace_line_price', 'USD', 649, 649, '7782074'),
  L(SRC.walmart, 'recorded', 'marketplace_line_price', 'USD', 2380, 2380, '23256290'), L(SRC.shopify, 'recorded', 'gross_order_including_tax_shipping', 'USD', 378, 370, '6723605'),
];

/** `database` simulado: despacha por el texto del SQL. `calls` registra cada consulta de datos; `fail` hace que una consulta lance un error con ese código. */
function fakeDb({ summary = null, live = {}, problems = [], monthly = [], categories = [], volume = [], links = 0, fail = null, calls = [] } = {}) {
  const s = {
    tenantId: T,
    async query(sql) {
      const q = String(sql);
      if (/current_setting\('statement_timeout'\)/.test(q)) return { rows: [{ v: '0' }] };
      if (/^(SAVEPOINT|RELEASE|ROLLBACK)/.test(q) || /set_config/.test(q)) return { rows: [] };
      const hit = (name) => { calls.push(name); if (fail?.[name]) throw Object.assign(new Error('boom'), { code: fail[name] }); };
      if (/economic_source_versions/.test(q)) { hit('names'); return { rows: NAMES }; }
      if (/summary_refresh_state/.test(q)) { hit('state'); return { rows: summary ? summary.states : [] }; }
      if (/max\(recorded_at\)/.test(q)) return { rows: [{ wm: summary?.currentWm ?? null, n: '1' }] };
      if (/FROM public\.economic_ledger_monthly/.test(q)) { hit('monthly'); return { rows: summary.rows }; }
      if (/FROM public\.economic_ledger_entries e/.test(q)) { hit('ledger'); return { rows: live[this.lastKind] ?? [] }; }
      if (/economic_problem_links/.test(q)) { hit('links'); return { rows: [{ n: links }] }; }
      if (/array_agg\(problem_id/.test(q)) { hit('problems'); return { rows: problems }; }
      if (/GROUPING SETS \(\(label, month\)/.test(q)) { hit('incid'); return { rows: monthly }; }
      if (/GROUPING SETS \(\(fam, month\)/.test(q)) { hit('cat'); return { rows: categories }; }
      if (/FROM public\.insight_state/.test(q)) return { rows: [{ status: 'ready', refreshed_at: NOW, source_watermark: NOW, computed_from: {}, detail: {} }] };
      if (/FROM public\.insight_conversation_volume/.test(q)) return { rows: volume };
      throw new Error('consulta no esperada: ' + q.slice(0, 80));
    },
  };
  return { s, calls, async transaction(action, fn) { assert.equal(action, 'read'); return fn(s); } };
}
// Selección del lote «vivo» según el parámetro `kind` ($2) de la consulta del libro.
function withKinds(db, live) { const q = db.s.query.bind(db.s); db.s.query = async (sql, params) => { if (/FROM public\.economic_ledger_entries e/.test(String(sql))) { db.calls.push('ledger'); return { rows: live[params[1]] ?? [] }; } return q(sql, params); }; return db; }
const portOf = (db) => assertPort(createWorkspacePort({ database: db, tenantId: T, now: () => NOW }));

test('ledgerBySource(refund): bruto por canal y moneda, con liquidado y cancelado aparte; unknown no es 0', async () => {
  const db = withKinds(fakeDb(), { refund: LIVE_REFUNDS });
  const r = await portOf(db).ledgerBySource({ kind: 'refund', months: 12 });
  assert.equal(r.status, 'ok'); assert.equal(r.basis, 'all_statuses'); assert.equal(r.months.length, 12);
  const amz = r.rows.find((x) => x.source === 'amazon'), wm = r.rows.find((x) => x.source === 'walmart');
  assert.deepEqual([amz.sourceLabel, amz.currency, amz.exponent, amz.count, amz.amountMinor, amz.unknown], ['Amazon', 'USD', 2, 3000, '31000000', 600]);
  assert.equal(typeof wm.amountMinor, 'string'); assert.equal(wm.amountMinor, String(28000000 + 11500000 + 13700000)); assert.equal(wm.count, 2900);
  assert.deepEqual([wm.settledCount, wm.settledAmountMinor, wm.cancelledCount, wm.cancelledAmountMinor], [1700, '28000000', 600, '11500000']);
  for (const x of r.rows) assert.deepEqual(Object.keys(x).filter((k) => ['source', 'sourceLabel', 'currency', 'exponent', 'count', 'amountMinor', 'unknown'].includes(k)).length, 7);
});
test('ledgerBySource(order): solo «registrado» y sin filas «a revisar»; monedas y Best Buy CA/US NO se mezclan', async () => {
  const db = withKinds(fakeDb(), { order: LIVE_ORDERS });
  const r = await portOf(db).ledgerBySource({ kind: 'order', month: '2026-09' });
  assert.deepEqual(r.months, ['2026-09']);
  const key = (x) => `${x.source}:${x.currency}`;
  assert.deepEqual(r.rows.map(key).sort(), ['amazon:CAD', 'amazon:USD', 'bestbuy:CAD', 'bestbuy:USD', 'shopify:USD', 'walmart:USD']);
  assert.equal(r.rows.find((x) => key(x) === 'amazon:USD').count, 3287, 'no cuenta cancelados ni «a revisar»');
  assert.equal(r.rows.find((x) => key(x) === 'shopify:USD').unknown, 8, 'importes ausentes se cuentan aparte');
  assert.ok(r.rows.every((x) => !('settledCount' in x)));
});
test('ledgerBySource: con resumen precomputado al día no toca el libro; atrasado se rotula; sin resumen cae al libro', async () => {
  const states = Array.from({ length: 12 }, (_, i) => ({ month: `${i < 2 ? '2025' : '2026'}-${String(((i + 10) % 12) + 1).padStart(2, '0')}`, refreshed_at: NOW, wm: '2026-10-19 06:32:20.376252', source_watermark: NOW, source_count: '1', source_rows: 1, detail: {} }));
  const rows = [{ month: '2026-09', source_id: SRC.amazon, kind: 'order', status: 'recorded', currency: 'USD', exponent: 2, basis: 'marketplace_line_price', n: 10, known: 10, amount: '12345' }, { month: '2026-09', source_id: SRC.amzRef, kind: 'refund', status: 'settled', currency: 'USD', exponent: 2, basis: 'x', n: 1, known: 1, amount: '100' }];
  const fresh = fakeDb({ summary: { states, rows, currentWm: '2026-10-19 06:32:20.376252' } });
  const a = await portOf(fresh).ledgerBySource({ kind: 'order', months: 12 });
  assert.equal(a.rows.length, 1); assert.equal(a.rows[0].amountMinor, '12345'); assert.ok(!fresh.calls.includes('ledger')); assert.equal(a.note, undefined);
  const stale = fakeDb({ summary: { states, rows, currentWm: '2026-10-20 00:00:00.000000' } });
  const b = await portOf(stale).ledgerBySource({ kind: 'order', months: 12 });
  assert.match(b.note, /registros posteriores/); assert.ok(!stale.calls.includes('ledger'));
  const absent = withKinds(fakeDb(), { order: LIVE_ORDERS }); await portOf(absent).ledgerBySource({ kind: 'order', months: 12 });
  assert.ok(absent.calls.includes('ledger'));
});
test('ledgerBySource: tope de tiempo => error 57014 (nunca 0 ni «sin datos»); un error distinto se propaga; entrada inválida se rechaza', async () => {
  const slow = fakeDb({ fail: { ledger: '57014' } });
  await assert.rejects(() => portOf(slow).ledgerBySource({ kind: 'refund', months: 12 }), (e) => e.code === '57014');
  const broken = fakeDb({ fail: { ledger: '42703' } });
  await assert.rejects(() => portOf(broken).ledgerBySource({ kind: 'refund', months: 12 }), (e) => e.code === '42703');
  await assert.rejects(() => portOf(fakeDb()).ledgerBySource({ kind: 'refund', month: '2026-13' }), /port_input_invalid/);
  await assert.rejects(() => portOf(fakeDb()).ledgerBySource({ kind: 'x', months: 3 }), /port_input_invalid/);
  const empty = withKinds(fakeDb(), { refund: [] });
  assert.equal((await portOf(empty).ledgerBySource({ kind: 'refund', months: 3 })).status, 'empty');
});
test('el agente contesta reembolsos por marketplace con el puerto real (monedas separadas, sin inventar)', async () => {
  const db = withKinds(fakeDb(), { refund: LIVE_REFUNDS });
  const a = await createAgent().answer({ ctx: ctxFor('owner', T), port: portOf(db), question: '¿Cuánto dinero en reembolsos tuvimos por marketplace?' });
  assert.equal(a.status, 'ok', a.text); assert.deepEqual(contractViolations(a), []);
  assert.match(a.text, /Amazon/); assert.match(a.text, /Walmart/); assert.doesNotMatch(a.text, /No tengo/);
  const block = a.blocks[0]; assert.ok(block.columns.some((c) => c.key === 'liquidado')); assert.match(block.note, /bruto/);
  assert.ok(block.rows.length <= 50);
});
test('ledger_por_fuente (pedidos de septiembre) con el puerto real: una fila por canal y moneda', async () => {
  const db = withKinds(fakeDb(), { order: LIVE_ORDERS });
  const r = await executeTool({ name: 'ledger_por_fuente', args: { kind: 'order', month: '2026-09' }, port: portOf(db), ctx: ctxFor('owner', T) });
  assert.equal(r.status, 'ok'); assert.match(r.summary, /Pedidos registrados/); assert.equal(r.blocks[0].rows.length, 6);
  assert.match(r.blocks[0].note, /no se suman/);
});

test('shapeLedgerRows: fuente desconocida cae en «Otro» y no se mezcla con canales conocidos', () => {
  const rows = shapeLedgerRows([L('zzz', 'recorded', 'b', 'USD', 2, 2, '10'), L(SRC.amazon, 'recorded', 'b', 'USD', 1, 1, '5')], new Map([[SRC.amazon, NAMES[0].name]]), 'order');
  assert.deepEqual(rows.map((x) => [x.sourceLabel, x.amountMinor]), [['Amazon', '5'], ['Otro', '10']]);
});
