// mappings y customer-bindings acotados + exposición bajo demanda, a 85,361 asientos con RLS real. Datos sintéticos.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {withPg, pgAvailable} from './pg-harness.mjs';
import {sembrarBase, cargarAsientos} from './ledger-sintetico.mjs';
import {crearBaseDatos} from '../../ai-scale/economia-problemas/snapshot.mjs';
import {TENANT_A, TENANT_B, OWNER, psqlFile} from '../../ai-scale/economia-problemas/mundo.mjs';
import {createWorkspaceViews} from '../workspace-views.mjs';
import {createEconomicRepository} from '../repository.mjs';
const pg = createRequire(import.meta.url)('pg');
const SKIP = !pgAvailable() && 'sin postgres local';
test('mappings/customer-bindings: páginas ≤100, cursor, búsqueda, <3 s a 85k; exposición bajo demanda mide', {skip: SKIP, timeout: 900000}, async t => {
  await withPg(async h => {
    sembrarBase(h); cargarAsientos(h);
    const REP = 'x'.repeat(30);
    // 130 claves de cliente declaradas (dos órdenes con la misma clave) y 3 decisiones de clasificación / vínculo
    h.psql(`alter table public.economic_order_customers disable trigger user; insert into public.economic_order_customers(tenant_id,entity_id,order_row_id,customer_key,version,actor_id,report,attested)
      select '${TENANT_A}',o.entity_id,o.id,'KEY-'||lpad((row_number() over(order by o.entity_id)%130)::text,4,'0'),1,'${OWNER.A}','${REP}',true from (select distinct on(entity_id) * from public.economic_ledger_entries where kind='order' order by entity_id,revision desc limit 200) o; alter table public.economic_order_customers enable trigger user;`);
    h.psql(`alter table public.workspace_order_dimension_versions disable trigger user; insert into public.workspace_order_dimension_versions(tenant_id,ledger_row_id,version,actor_id,skus,source,active,report,attested) select '${TENANT_A}',id,1,'${OWNER.A}','{SKU-1}','csv',true,'${REP}',true from public.economic_ledger_entries where kind='order' and revision=1 limit 3; alter table public.workspace_order_dimension_versions enable trigger user;`);
    const pool = new pg.Pool({host: h.sock, user: 'postgres', database: 't', max: 4}); t.after(() => pool.end());
    const db = crearBaseDatos({pool, tenantId: TENANT_A, userId: OWNER.A, statementTimeoutMs: 10000});
    const fake = async (_s, id) => id === 'cccccccc-0000-4000-8000-000000000001' ? {label: 'Cliente Uno', source: 'csv'} : null;
    const v = createWorkspaceViews({database: db, sourceCustomer: fake});
    await t.test('mappings: primera página ≤50, resumen agregado, cursor recorre sin repetir, <3 s', async () => {
      const t0 = Date.now(); const a = await v.mappings({}); const ms = Date.now() - t0;
      assert.ok(ms < 3000, ms + ' ms'); assert.equal(a.orders.length, 50); assert.ok(a.nextCursor); assert.ok(a.summary.classifiableOrders > 70000); assert.equal(a.summary.ordersWithDecision, 3); assert.equal(a.recentMappings.length, 3); assert.equal(a.canWrite, true);
      const b = await v.mappings({cursor: a.nextCursor, limit: 100}); assert.equal(b.orders.length, 100);
      const ids = new Set([...a.orders, ...b.orders].map(o => o.ledgerRowId)); assert.equal(ids.size, 150);
      assert.ok(a.orders.every(o => typeof o.sourceName === 'string' && !/^[0-9a-f-]{36}$/.test(o.sourceName)));
    });
    await t.test('mappings: búsqueda por identificador y validaciones', async () => {
      const ext = h.psql("select external_id from public.economic_ledger_entries where kind='order' and revision=1 and status='recorded' limit 1").out;
      const r = await v.mappings({q: ext}); assert.ok(r.orders.length >= 1 && r.orders.every(o => o.externalId.toLowerCase().includes(ext.toLowerCase())));
      await assert.rejects(v.mappings({limit: 101}), e => e.code === 'limit_invalid' && e.status === 400);
      await assert.rejects(v.mappings({cursor: 'zzz'}), e => e.code === 'cursor_invalid');
      assert.equal((await v.mappings({q: '%_'})).orders.length, 0); // comodines escapados
    });
    await t.test('customer-bindings: claves declaradas paginadas (25), cursor, sin enumerar clientes sin búsqueda', async () => {
      const t0 = Date.now(); const a = await v.customerBindings({}); assert.ok(Date.now() - t0 < 3000);
      assert.equal(a.declaredKeys.length, 25); assert.ok(a.nextCursor); assert.equal(a.customers.length, 0); assert.equal(a.summary.declaredKeys, 130);
      const seen = new Set(a.declaredKeys); let c = a.nextCursor, pages = 1; while (c) { const p = await v.customerBindings({cursor: c}); for (const k of p.declaredKeys) { assert.ok(!seen.has(k)); seen.add(k); } c = p.nextCursor; pages++; }
      assert.equal(seen.size, 130); assert.equal(pages, 6);
      assert.deepEqual((await v.customerBindings({q: 'KEY-0007'})).declaredKeys, ['KEY-0007']);
      await assert.rejects(v.customerBindings({limit: 51}), e => e.code === 'limit_invalid');
      await assert.rejects(v.customerBindings({customerQ: 'a'}), e => e.code === 'filter_invalid');
    });
    await t.test('aislamiento: otro tenant ve vacío', async () => {
      const o = createWorkspaceViews({database: crearBaseDatos({pool, tenantId: TENANT_B, userId: OWNER.B}), sourceCustomer: fake});
      const m = await o.mappings({}); assert.equal(m.orders.length, 0); assert.equal(m.summary.classifiableOrders, 0);
      assert.equal((await o.customerBindings({})).declaredKeys.length, 0);
    });
    await t.test('exposición bajo demanda a 85k: se mide (con 10 s y con 120 s) y un timeout sería 504', async () => {
      const scope = {start: '2026-07-01T00:00:00.000Z', end: '2026-10-01T00:00:00.000Z', timezone: 'UTC', dateBasis: 'occurred_at', currency: 'USD', exponent: 2, basis: 'marketplace_line_price'};
      for (const ms of [10000, 120000]) { const repo = createEconomicRepository({database: crearBaseDatos({pool, tenantId: TENANT_A, userId: OWNER.A, statementTimeoutMs: ms})}); const t0 = Date.now(); try { await repo.exposure({scope}); console.log(`# exposure ${ms} ms-timeout: OK ${Date.now() - t0} ms`); } catch (e) { console.log(`# exposure ${ms} ms-timeout: ${e.code} ${e.status} ${Date.now() - t0} ms`); assert.equal(e.code, 'economic_query_timeout'); assert.equal(e.status, 504); } }
    });
  }, {name: 'econ-wsviews'});
});
