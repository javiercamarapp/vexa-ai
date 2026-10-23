// Lectura rápida de insight_* bajo la sesión y RLS reales (rol vexa_backend): exactitud contra la verdad en JS, marca de frescura, aislamiento y milisegundos.
//   node --test packages/insights/tests/reader.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {createRequire} from 'node:module';
import {withPg, pgAvailable} from '../../metrics/tests/pg-harness.mjs';
import {sembrarBase} from '../../metrics/tests/ledger-sintetico.mjs';
import {crearBaseDatos} from '../../ai-scale/economia-problemas/snapshot.mjs';
import {TENANT_A, TENANT_B, OWNER} from '../../ai-scale/economia-problemas/mundo.mjs';
import {HERE} from '../../metrics/tests/world.mjs';
import {refunds, insertRefunds, sembrarOtros, sembrarTracker, q, BASE} from './seed.mjs';
import {createInsightsReader} from '../reader.mjs';
import {refreshInsights, recordSourceSync} from '../refresh.mjs';

const pg = createRequire(import.meta.url)('pg');
const SKIP = !pgAvailable() && 'sin postgres local';
const MIG = path.join(HERE, '../../../supabase/migrations/20261104000000_insights_engine.sql');

test('lectura de insights: exacta, con frescura, aislada por tenant y en milisegundos', {skip: SKIP, timeout: 600000}, async t => {
  await withPg(async h => {
    sembrarBase(h); sembrarOtros(h); sembrarTracker(h);
    const rows = refunds(); insertRefunds(h, rows);
    const pool = new pg.Pool({host: h.sock, user: 'postgres', database: 't', max: 4}); t.after(() => pool.end());
    const db = (tenant, user) => crearBaseDatos({pool, tenantId: tenant, userId: user, statementTimeoutMs: 10000});

    await t.test('sin migración: unavailable (nunca ceros)', async () => {
      const r = createInsightsReader({database: db(TENANT_A, OWNER.A)});
      assert.equal((await r.refundBySkuMonth({})).availability, 'unavailable');
      assert.equal((await r.freshness()).availability, 'unavailable');
    });
    assert.equal(h.file(MIG).status, 0);
    const reader = createInsightsReader({database: db(TENANT_A, OWNER.A)});
    await t.test('migración sin refrescar: absent', async () => {
      assert.equal((await reader.refundBySkuMonth({})).availability, 'absent');
      assert.equal((await reader.conversationVolume({})).availability, 'absent');
    });
    const res = await refreshInsights(db(TENANT_A, OWNER.A), {source: 'all'});
    assert.equal(res.status, 'done');

    await t.test('reembolsos: totales por moneda y Top-N coinciden con la verdad; ms', async () => {
      await reader.refundBySkuMonth({});
      const t0 = process.hrtime.bigint(), v = await reader.refundBySkuMonth({}); const ms = Number(process.hrtime.bigint() - t0) / 1e6;
      assert.equal(v.availability, 'ready'); assert.equal(v.meta.source, 'insight'); assert.ok(v.meta.refreshedAt); assert.ok(ms < 150, 'ms ' + ms);
      const usd = rows.filter(r => r.cur === 'USD'), gross = usd.reduce((a, r) => a + (r.amt ?? 0), 0), active = usd.filter(r => r.status !== 'cancelled').reduce((a, r) => a + (r.amt ?? 0), 0);
      const c = v.currencies.find(x => x.currency === 'USD'); assert.equal(Number(c.gross), gross); assert.equal(Number(c.active), active); assert.ok(v.currencies.find(x => x.currency === 'CAD'), 'CAD aparte');
      const bySku = new Map(); for (const r of usd) bySku.set(BASE(r.sku), (bySku.get(BASE(r.sku)) ?? 0) + (r.amt ?? 0));
      const exp = [...bySku].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
      assert.deepEqual(v.top.skus.map(x => [x.sku, Number(x.gross)]), exp.slice(0, 10));
      assert.equal(v.top.sharePercent, Math.floor(exp.slice(0, 10).reduce((a, x) => a + x[1], 0) * 1000 / gross) / 10);
      const filtered = await reader.refundBySkuMonth({from: '2026-08-01', to: '2026-09-01'}); assert.ok(filtered.rows.every(r => r.month === '2026-08'));
      await assert.rejects(reader.refundBySkuMonth({currency: 'usd'}), /insight_input_invalid/);
    });
    await t.test('conversaciones, hilos HubSpot y Tracker leen de insight_*', async () => {
      const c = await reader.conversationVolume({grain: 'week'}); assert.equal(c.points.reduce((a, p) => a + p.n, 0), 30); assert.equal(c.undated, 5);
      const th = await reader.threadResolution({}); assert.equal(th.overall.threads, 6); assert.equal(th.overall.reopenedPercent, 16.7); assert.equal(th.overall.closeP50Hours, 5);
      const tr = await reader.trackerRefundStatus({}); assert.equal(tr.total, 5); assert.equal(tr.byStatus.reembolsado.amountMinor, '14050'); assert.equal(tr.assumedCurrency, 'USD');
    });
    await t.test('otro tenant no ve nada (absent) y las tablas no se escriben desde la lectura', async () => {
      const b = createInsightsReader({database: db(TENANT_B, OWNER.B)});
      assert.equal((await b.refundBySkuMonth({})).availability, 'absent'); assert.deepEqual((await b.freshness()).insights, []);
    });
    await t.test('frescura: versión estable, cambia al registrar una fuente y marca atraso', async () => {
      const f1 = await reader.freshness(); assert.equal(f1.availability, 'ready'); assert.ok(f1.insights.length >= 4); assert.equal((await reader.freshness()).version, f1.version);
      await recordSourceSync(db(TENANT_A, OWNER.A), {source: 'hubspot', method: 'api_poll', ok: true, newRecords: 3, latencyMs: 250, nextRunAt: new Date(Date.now() + 300000).toISOString(), expectedEverySeconds: 300});
      const f2 = await reader.freshness(); assert.notEqual(f2.version, f1.version);
      const s = f2.sources.find(x => x.key === 'hubspot'); assert.equal(s.method, 'api_poll'); assert.equal(s.stale, false); assert.equal(s.lastNewRecords, 3);
      const old = await reader.freshness({now: Date.now() + 3600 * 1000}); assert.equal(old.sources.find(x => x.key === 'hubspot').stale, true);
      q(h, `update public.source_sync_state set status='paused'`); assert.equal((await reader.freshness({now: Date.now() + 3600 * 1000})).sources[0].stale, false);
    });
  });
});
