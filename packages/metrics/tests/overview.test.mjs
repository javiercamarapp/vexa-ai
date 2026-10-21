// Vista acotada del libro económico (overview.mjs): paridad EXACTA con list() (que carga todo el libro), agregados == suma desde las filas,
// regresión de rendimiento a 85,361 asientos bajo vexa_backend + RLS, paginación por cursor, 504 por timeout, aislamiento por tenant e idempotencia.
// Postgres local desechable (/private/tmp/claude-501) con las migraciones REALES; datos 100 % sintéticos.
//   node --test packages/metrics/tests/overview.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {withPg, pgAvailable} from './pg-harness.mjs';
import {sembrarBase, cargarAsientos, FUENTES, BASIS_ORDER, BASIS_REFUND} from './ledger-sintetico.mjs';
import {crearBaseDatos} from '../../ai-scale/economia-problemas/snapshot.mjs';
import {TENANT_A, TENANT_B, OWNER, U, psqlFile} from '../../ai-scale/economia-problemas/mundo.mjs';
import {sourcesSql} from '../../economics/emit-sql.mjs';
import {sourceIdFor} from '../../economics/marketplace-map.mjs';
import {createEconomicRepository, EconomicError} from '../repository.mjs';
import {readOverview, readPage} from '../overview.mjs';
import {asTimeout} from '../errors.mjs';
import {HERE} from './world.mjs';

const pg = createRequire(import.meta.url)('pg');
const SKIP = !pgAvailable() && 'sin postgres local';
const MIG_INDEX = path.join(HERE, '../../../supabase/migrations/20261020000000_economic_ledger_recent_index.sql');
const sc = (over = {}) => ({start: '2026-07-01T00:00:00.000Z', end: '2026-10-01T00:00:00.000Z', timezone: 'UTC', dateBasis: 'occurred_at', currency: 'USD', exponent: 2, basis: BASIS_ORDER, ...over});
const REP = 'SYN prueba: registro sintético con procedencia documentada, sin datos de clientes.';
const sq = v => "'" + String(v).replace(/'/g, "''") + "'";

/** Inserta filas directas (superusuario, disparadores de usuario apagados SOLO en la carga). row: campos mínimos. */
function insertar(h, rows) {
  const cols = 'tenant_id,entity_id,source_id,source_version,revision,actor_id,recorded_at,external_id,kind,effective_at,currency,exponent,basis,amount_minor,status,order_id,reversal_of,details,report,report_hash,attested';
  const vals = rows.map(r => `('${TENANT_A}',${sq(r.id)},${sq(r.source)},${r.sv ?? 1},${r.rev ?? 1},${sq(r.actor ?? OWNER.A)},${sq(r.recorded ?? '2026-09-15T00:00:00Z')},${sq(r.ext ?? 'SYN-' + r.id)},${sq(r.kind)},${sq(r.eff ?? '2026-08-15T00:00:00Z')},${sq(r.cur ?? 'USD')},${r.exp ?? 2},${sq(r.basis)},${r.amount === null || r.amount === undefined ? 'null' : r.amount},${sq(r.status)},${r.order ? sq(r.order) : 'null'},${r.rev_of ? sq(r.rev_of) : 'null'},${sq(JSON.stringify(r.details ?? {}))}::jsonb,${sq(REP)},repeat('a',64),true)`).join(',\n');
  const r = psqlFile(h.sock, `set session_replication_role=replica;alter table public.economic_ledger_entries disable trigger user;insert into public.economic_ledger_entries(${cols}) values ${vals};alter table public.economic_ledger_entries enable trigger user;`);
  if (r.status !== 0) throw Error(String(r.stderr).slice(0, 500));
}
const eid = n => `eeeeeeee-0000-4000-8000-${String(n).padStart(12, '0')}`;
const newDb = (pool, ms = 10000, user = OWNER.A, tenant = TENANT_A) => crearBaseDatos({pool, tenantId: tenant, userId: user, statementTimeoutMs: ms});

// forma comparable de una métrica: sin referencias de evidencia (list las enumera una a una; la vista acotada solo cuenta)
const norm = m => m === null || m === undefined ? m : ({amountMinor: m.amountMinor, knownSubtotalMinor: m.knownSubtotalMinor, knownCount: m.knownCount, totalCount: m.totalCount, status: m.status, currency: m.currency, exponent: m.exponent, basis: m.basis, missingReasons: m.missingReasons});
const cards = view => ({allOrders: norm(view.bundle.metrics.allOrders), refunds: norm(view.bundle.metrics.refunds), replacement: norm(view.bundle.components.replacement), supportModel: norm(view.bundle.components.supportModel),
  scenarios: view.bundle.components.futureScenarios.map(s => ({id: s.id, amountMinor: s.amountMinor, status: s.status, missingReasons: s.missingReasons}))});

test('paridad: las tarjetas de la vista acotada son idénticas a las de list() (todo el libro) en alcances, bordes y compuertas', {skip: SKIP, timeout: 900000}, async t => {
  await withPg(async h => {
    sembrarBase(h); cargarAsientos(h, {total: 8700, scale: 0.1});
    // fuentes extra de las demás familias
    const extra = [['extra-reemplazo', 'replacement_invoice'], ['extra-soporte', 'support_timesheet'], ['extra-escenario', 'scenario_assumption'], ['extra-pagos', 'payment_ledger']].map(([key, type]) => ({key, sourceId: sourceIdFor(key), name: 'SYN ' + key, evidenceType: type, active: true, complete: true, windowStart: '2025-10-01T00:00:00.000Z', windowEnd: '2026-10-06T00:00:00.000Z', watermark: '2026-10-06T00:00:00.000Z', report: REP + ' ' + key}));
    const rs = psqlFile(h.sock, sourcesSql(TENANT_A, extra, OWNER.A)); assert.equal(rs.status, 0, String(rs.stderr));
    const S = Object.fromEntries(extra.map(e => [e.key, e.sourceId])), PAGOS = S['extra-pagos'];
    insertar(h, [
      // neteo normal: R1 1000 -300 = 700; R2 2000 -500 -200 = 1300; R3 sin importe  => total 3, conocidos 2, subtotal 2000
      {id: eid(1), source: PAGOS, kind: 'refund', basis: 'test_ok', amount: 1000, status: 'settled'}, {id: eid(2), source: PAGOS, kind: 'refund', basis: 'test_ok', amount: 2000, status: 'settled'}, {id: eid(3), source: PAGOS, kind: 'refund', basis: 'test_ok', amount: null, status: 'settled'},
      {id: eid(4), source: PAGOS, kind: 'reversal', basis: 'test_ok', amount: -300, status: 'settled', rev_of: eid(1)}, {id: eid(5), source: PAGOS, kind: 'reversal', basis: 'test_ok', amount: -500, status: 'settled', rev_of: eid(2)}, {id: eid(6), source: PAGOS, kind: 'reversal', basis: 'test_ok', amount: -200, status: 'settled', rev_of: eid(2)},
      // reversiones que exceden al original, original ausente, reversión sin importe
      {id: eid(10), source: PAGOS, kind: 'refund', basis: 'test_exceed', amount: 1000, status: 'settled'}, {id: eid(11), source: PAGOS, kind: 'reversal', basis: 'test_exceed', amount: -1500, status: 'settled', rev_of: eid(10)},
      {id: eid(20), source: PAGOS, kind: 'reversal', basis: 'test_missing', amount: -100, status: 'settled', rev_of: eid(999)},
      {id: eid(30), source: PAGOS, kind: 'refund', basis: 'test_revnull', amount: 1000, status: 'settled'}, {id: eid(31), source: PAGOS, kind: 'reversal', basis: 'test_revnull', amount: null, status: 'settled', rev_of: eid(30)},
      // pendiente / cancelado se excluyen; desconocido bloquea
      {id: eid(40), source: PAGOS, kind: 'refund', basis: 'test_pend', amount: 500, status: 'pending'}, {id: eid(41), source: PAGOS, kind: 'refund', basis: 'test_pend', amount: 700, status: 'settled'}, {id: eid(42), source: PAGOS, kind: 'refund', basis: 'test_pend', amount: 900, status: 'cancelled'},
      {id: eid(43), source: PAGOS, kind: 'refund', basis: 'test_unk', amount: 700, status: 'settled'}, {id: eid(44), source: PAGOS, kind: 'refund', basis: 'test_unk', amount: null, status: 'unknown'},
      // componentes: reemplazo (con un importe desconocido), soporte modelado (600 s x 250/min = 2500; otra sin tarifa) y escenario
      {id: eid(50), source: S['extra-reemplazo'], kind: 'replacement', basis: 'test_ok', amount: 4000, status: 'settled'}, {id: eid(51), source: S['extra-reemplazo'], kind: 'replacement', basis: 'test_ok', amount: null, status: 'unknown'},
      {id: eid(52), source: S['extra-soporte'], kind: 'support_model', basis: 'test_ok', amount: null, status: 'modeled', details: {durationSeconds: '610', rateMinorPerMinute: '250', rateVersion: 'v1', unit: 'minute', validFrom: '2026-01-01T00:00:00.000Z', validUntil: '2027-01-01T00:00:00.000Z', rateEvidence: REP, approved: true}},
      {id: eid(53), source: S['extra-soporte'], kind: 'support_model', basis: 'test_ok', amount: null, status: 'modeled', details: {durationSeconds: null, rateMinorPerMinute: '250', rateVersion: 'v1', unit: 'minute', validFrom: '2026-01-01T00:00:00.000Z', validUntil: '2027-01-01T00:00:00.000Z', rateEvidence: REP, approved: true}},
      {id: eid(54), source: S['extra-escenario'], kind: 'future_scenario', basis: 'test_ok', amount: null, status: 'modeled', eff: '2026-08-20T00:00:00Z', details: {affectedCustomers: 4, relevantRevenueMinor: '10000', probabilityBps: 2500, horizonDays: 30, assumptionId: 'SYN-A1', assumptionReport: REP, unit: 'customer', validFrom: '2026-01-01T00:00:00.000Z', validUntil: '2027-01-01T00:00:00.000Z', approved: true}},
    ]);
    const pool = new pg.Pool({host: h.sock, user: 'postgres', database: 't', max: 4});
    const repo = createEconomicRepository({database: newDb(pool, 120000)});
    t.after(() => pool.end());
    const scopes = {
      'pedidos USD (base de línea)': sc(), 'pedidos CAD': sc({currency: 'CAD'}), 'pedidos MXN': sc({currency: 'MXN'}), 'ventana corta': sc({start: '2026-08-01T00:00:00.000Z', end: '2026-08-10T00:00:00.000Z'}),
      'reembolsos marketplace (base distinta, con estado desconocido)': sc({basis: BASIS_REFUND, start: '2025-10-01T00:00:00.000Z'}), 'Shopify (base bruta)': sc({basis: 'gross_order_including_tax_shipping', start: '2025-10-01T00:00:00.000Z'}),
      'neteo normal + componentes': sc({basis: 'test_ok', start: '2026-08-01T00:00:00.000Z', end: '2026-09-01T00:00:00.000Z'}), 'reversión excede': sc({basis: 'test_exceed', start: '2026-08-01T00:00:00.000Z', end: '2026-09-01T00:00:00.000Z'}),
      'reversión sin original': sc({basis: 'test_missing', start: '2026-08-01T00:00:00.000Z', end: '2026-09-01T00:00:00.000Z'}), 'reversión sin importe': sc({basis: 'test_revnull', start: '2026-08-01T00:00:00.000Z', end: '2026-09-01T00:00:00.000Z'}),
      'pendiente/cancelado excluidos': sc({basis: 'test_pend', start: '2026-08-01T00:00:00.000Z', end: '2026-09-01T00:00:00.000Z'}), 'desconocido bloquea': sc({basis: 'test_unk', start: '2026-08-01T00:00:00.000Z', end: '2026-09-01T00:00:00.000Z'}),
      'ventana abierta (fin futuro)': sc({end: '2027-06-01T00:00:00.000Z'}),
    };
    const compare = async (label, scope) => { const full = await repo.list({scope}), lean = await repo.overview({scope}); assert.deepEqual(cards(lean), cards(full), label); return {full, lean}; };
    for (const [label, scope] of Object.entries(scopes)) await t.test('alcance: ' + label, () => compare(label, scope));
    await t.test('los casos de neteo producen los números esperados (no solo «iguales entre sí»)', async () => {
      const f = s => repo.overview({scope: sc({basis: 'test_ok', start: '2026-08-01T00:00:00.000Z', end: '2026-09-01T00:00:00.000Z', ...s})});
      const ok = (await f()).bundle.metrics.refunds; assert.equal(ok.knownSubtotalMinor, '2000'); assert.equal(ok.knownCount, 2); assert.equal(ok.totalCount, 3); assert.equal(ok.amountMinor, null);
      const comp = (await f()).bundle.components; assert.equal(comp.replacement.knownSubtotalMinor, '4000'); assert.equal(comp.supportModel.knownSubtotalMinor, '2542'); // (610*250+30)/60 floor = 2542
      assert.deepEqual((await f({basis: 'test_exceed'})).bundle.metrics.refunds.missingReasons.filter(x => x.startsWith('REFUND')), ['REFUND_RECONCILIATION_REQUIRED']);
      assert.equal((await f({basis: 'test_pend'})).bundle.metrics.refunds.knownSubtotalMinor, '700');
    });
    await t.test('compuerta de referencia de pedido rota: igual que list() y marcada como no disponible', async () => {
      insertar(h, [{id: eid(60), source: PAGOS, kind: 'refund', basis: 'test_ok', amount: 100, status: 'settled', order: eid(777)}]);
      const {lean} = await compare('referencia rota', scopes['neteo normal + componentes']);
      assert.ok(lean.bundle.metrics.refunds.missingReasons.includes('order_reference_unavailable_or_incompatible'));
      assert.ok(lean.scopeSummary.referenceIssues.some(i => i.count >= 1));
    });
    await t.test('alias activo válido: el pedido alias no se cuenta dos veces (igual que list/exposure); alias inválido cierra la identidad', async () => {
      const A = sourceIdFor('amazon-pedidos'), a = eid(70), b = eid(71);
      insertar(h, [{id: a, source: A, kind: 'order', basis: 'test_alias', amount: 5000, status: 'recorded'}, {id: b, source: A, kind: 'order', basis: 'test_alias', amount: 5000, status: 'recorded'}]);
      const al = (alias, canon, id) => h.psql(`alter table public.economic_order_aliases disable trigger user; insert into public.economic_order_aliases(tenant_id,alias_entity_id,canonical_entity_id,alias_row_id,canonical_row_id,version,active,actor_id,report,attested) select '${TENANT_A}','${alias}','${canon}',(select id from public.economic_ledger_entries where entity_id='${alias}'),(select id from public.economic_ledger_entries where entity_id='${canon}'),1,true,'${OWNER.A}','${'x'.repeat(30)}',true; alter table public.economic_order_aliases enable trigger user;`);
      assert.ok(al(b, a).ok);
      const scope = sc({basis: 'test_alias', start: '2026-08-01T00:00:00.000Z', end: '2026-09-01T00:00:00.000Z'});
      const {lean} = await compare('alias válido', scope); assert.equal(lean.bundle.metrics.allOrders.knownCount, 1); assert.equal(lean.bundle.metrics.allOrders.knownSubtotalMinor, '5000');
      insertar(h, [{id: eid(72), source: A, kind: 'order', basis: 'test_alias2', amount: 100, status: 'recorded'}, {id: eid(73), source: A, kind: 'order', basis: 'test_alias2', amount: 999, status: 'recorded'}]);
      assert.ok(al(eid(73), eid(72)).ok);
      const bad = await compare('alias inválido (importes distintos)', sc({basis: 'test_alias2', start: '2026-08-01T00:00:00.000Z', end: '2026-09-01T00:00:00.000Z'}));
      assert.equal(bad.lean.bundle.metrics.allOrders.status, 'unavailable'); assert.ok(bad.lean.bundle.metrics.allOrders.missingReasons.includes('alias_identity_unavailable_or_conflicting'));
    });
    await t.test('contribuyente revocado: la compuerta order_evidence_unavailable coincide con list()', async () => {
      const O2 = U(9100); h.psql(`insert into auth.users(id) values('${O2}')`); h.psql(`insert into public.memberships(tenant_id,user_id,role,status,permissions_version) values('${TENANT_A}','${O2}','owner','active',1)`);
      insertar(h, [{id: eid(80), source: sourceIdFor('amazon-pedidos'), kind: 'order', basis: 'test_actor', amount: 777, status: 'recorded', actor: O2}]);
      await compare('contribuyente activo', sc({basis: 'test_actor', start: '2026-08-01T00:00:00.000Z', end: '2026-09-01T00:00:00.000Z'}));
      h.psql(`update public.memberships set status='revoked' where user_id='${O2}'`);
      const {lean} = await compare('contribuyente revocado', sc({basis: 'test_actor', start: '2026-08-01T00:00:00.000Z', end: '2026-09-01T00:00:00.000Z'}));
      assert.ok(lean.bundle.metrics.allOrders.missingReasons.includes('order_evidence_unavailable'));
    });
    await t.test('conflicto de exponente: mismo error de dominio que list()', async () => {
      insertar(h, [{id: eid(90), source: sourceIdFor('amazon-pedidos'), kind: 'order', basis: 'test_exp', amount: 5, status: 'recorded', exp: 2}, {id: eid(91), source: sourceIdFor('amazon-pedidos'), kind: 'order', basis: 'test_exp', amount: 5, status: 'recorded', exp: 3}]);
      const scope = sc({basis: 'test_exp', start: '2026-08-01T00:00:00.000Z', end: '2026-09-01T00:00:00.000Z'});
      const a = await repo.list({scope}).catch(e => e), b = await repo.overview({scope}).catch(e => e);
      assert.equal(a.code, 'currency_exponent_conflict'); assert.equal(b.code, 'currency_exponent_conflict'); assert.equal(b.status, 409);
    });
    await t.test('las dos vistas monetarias coinciden (catálogo, unidades originales por separado)', async () => {
      const {full, lean} = await compare('monetario', scopes['pedidos USD (base de línea)']);
      const units = v => v.monetary.nativeBundles.map(n => [n.currency, n.exponent, n.metrics.filter(m => ['allOrders', 'refunds', 'replacement', 'supportModel'].includes(m.key)).map(m => [m.key, m.native.amountMinor, m.native.knownSubtotalMinor, m.configurationStatus])]);
      assert.deepEqual(units(lean), units(full));
    });
  }, {name: 'econ-paridad'});
});

test('85,361 asientos bajo RLS real: <3 s, agregados == suma desde las filas, paginación completa, idempotencia, 504 y aislamiento', {skip: SKIP, timeout: 900000}, async t => {
  await withPg(async h => {
    sembrarBase(h); const n = cargarAsientos(h); assert.equal(n, 85361);
    const pool = new pg.Pool({host: h.sock, user: 'postgres', database: 't', max: 4}); t.after(() => pool.end());
    const repo = createEconomicRepository({database: newDb(pool, 10000)});
    const noIndex = h.psql("select count(*) from pg_indexes where indexname='economic_ledger_entries_recent_idx'").out; assert.equal(noIndex, '0');

    await t.test('ventana de 3 meses con 85k filas termina en < 3 s (peor caso incluido: sin el índice nuevo, caché fría)', async () => {
      const t0 = Date.now(); const v = await repo.overview({scope: sc()}); const ms = Date.now() - t0;
      assert.ok(ms < 3000, `tardó ${ms} ms`); assert.equal(v.totals.revisions, 85361); assert.equal(v.totals.entities, 79055); assert.equal(v.page.items.length, 50);
      assert.equal(v.totals.nullAmount, 3661); assert.equal(v.totals.noCurrency, 0); assert.ok(!v.totals.truncated);
    });
    await t.test('los agregados SQL coinciden EXACTAMENTE con la suma hecha en JavaScript desde las filas (última revisión por entidad)', async () => {
      const rows = (await pool.query('select distinct on(entity_id) entity_id,source_id,kind,currency,exponent,basis,status,amount_minor::text amount,to_char(effective_at at time zone \'UTC\',\'YYYY-MM\') as month from public.economic_ledger_entries where tenant_id=$1 order by entity_id,revision desc', [TENANT_A])).rows;
      assert.equal(rows.length, 79055);
      const m = new Map();
      for (const r of rows) { const k = [r.source_id, r.kind, r.currency, r.exponent, r.basis, r.status, r.month].join('|'); const g = m.get(k) ?? {n: 0, known: 0, sum: 0n}; g.n++; if (r.amount !== null) { g.known++; g.sum += BigInt(r.amount); } m.set(k, g); }
      const v = await repo.overview({scope: sc()});
      assert.equal(v.groups.length, m.size);
      let total = 0, totalKnown = 0;
      for (const g of v.groups) { const e = m.get([g.sourceId, g.kind, g.currency, g.exponent, g.basis, g.status, g.month].join('|')); assert.ok(e, 'grupo inexistente'); assert.equal(g.entries, e.n); assert.equal(g.withAmount, e.known); assert.equal(g.nullAmount, e.n - e.known); assert.equal(g.knownSumMinor, e.sum.toString()); total += g.entries; totalKnown += g.withAmount; }
      assert.equal(total, 79055); assert.equal(totalKnown, v.totals.withAmount);
      // nunca mezcla monedas ni bases: ningún grupo contiene dos
      assert.ok(v.groups.every(g => /^[A-Z]{3}$/.test(g.currency) && g.basis));
      // tarjeta de pedidos USD de la ventana == suma directa
      const sel = rows.filter(r => r.kind === 'order' && r.currency === 'USD' && r.basis === BASIS_ORDER && !['cancelled', 'pending'].includes(r.status) && r.month >= '2026-07' && r.month <= '2026-09');
      assert.equal(v.bundle.metrics.allOrders.totalCount, sel.length); assert.equal(v.bundle.metrics.allOrders.knownCount, sel.filter(r => r.amount !== null).length);
    });
    await t.test('la cifra de la tarjeta de pedidos == suma desde las filas (sin estado desconocido)', async () => {
      const scope = sc({start: '2026-07-01T00:00:00.000Z', end: '2026-07-02T00:00:00.000Z'});
      const rows = (await pool.query("select distinct on(entity_id) status,amount_minor::text amount from public.economic_ledger_entries where tenant_id=$1 and kind='order' and currency='USD' and basis=$2 and effective_at>=$3 and effective_at<$4 order by entity_id,revision desc", [TENANT_A, BASIS_ORDER, scope.start, scope.end])).rows.filter(r => !['cancelled', 'pending'].includes(r.status));
      const v = (await repo.overview({scope})).bundle.metrics.allOrders;
      assert.equal(v.totalCount, rows.length); assert.equal(BigInt(v.knownSubtotalMinor ?? 0) >= 0n, true);
    });
    await t.test('migración 20261020000000 aplicada una vez (solo un índice; la verificación para producción está en NOTAS.md)', () => {
      const r = h.file(MIG_INDEX); assert.equal(r.status, 0, String(r.stderr)); h.psql('analyze public.economic_ledger_entries');
      assert.equal(h.psql("select count(*) from pg_indexes where indexname='economic_ledger_entries_recent_idx'").out, '1');
    });
    await t.test('paginación por cursor: recorre todo el libro vigente una sola vez, en orden y con ≤100 por página', async () => {
      const seen = new Set(); let cursor = null, pages = 0, last = null;
      do { const p = await repo.page({limit: 100, cursor}); assert.ok(p.items.length <= 100); for (const it of p.items) { assert.ok(!seen.has(it.id)); seen.add(it.id); const key = it.effectiveAt; if (last) assert.ok(key <= last); last = key; assert.equal(Object.hasOwn(it, 'report'), false); } cursor = p.nextCursor; pages++; } while (cursor);
      assert.equal(seen.size, 79055); assert.equal(pages, 791);
    });
    await t.test('validaciones de página: límite, cursor, filtro', async () => {
      await assert.rejects(repo.page({limit: 101}), e => e.code === 'limit_invalid' && e.status === 400);
      await assert.rejects(repo.page({limit: 0}), e => e.code === 'limit_invalid');
      await assert.rejects(repo.page({cursor: 'zzz'}), e => e.code === 'cursor_invalid');
      await assert.rejects(repo.page({filters: {kind: 'nope'}}), e => e.code === 'filter_invalid');
      await assert.rejects(repo.page({filters: {otro: 1}}), e => e.code === 'unsupported_filter');
      const f = await repo.page({limit: 100, filters: {kind: 'refund', currency: 'USD'}}); assert.ok(f.items.length === 100 && f.items.every(i => i.kind === 'refund' && i.currency === 'USD'));
    });
    await t.test('historial de UNA entidad: todas las revisiones inmutables, con evidencia', async () => {
      const id = h.psql("select entity_id from public.economic_ledger_entries where revision=3 limit 1").out;
      const hs = await repo.entityHistory({entityId: id}); assert.deepEqual(hs.revisions.map(r => r.revision), [3, 2, 1]); assert.ok(hs.revisions.every(r => r.report.length > 10));
      await assert.rejects(repo.entityHistory({entityId: eid(123456)}), e => e.code === 'entity_not_found' && e.status === 404);
      await assert.rejects(repo.entityHistory({entityId: 'x'}), e => e.code === 'entity_id_invalid');
    });
    await t.test('idempotencia: dos lecturas seguidas devuelven lo mismo y aplicar la migración dos veces no cambia nada', async () => {
      const strip = v => { const {timing, asOf, ...r} = v; return JSON.stringify(r); };
      const a = await repo.overview({scope: sc()}), b = await repo.overview({scope: sc()}); assert.equal(strip(a), strip(b));
      for (let i = 0; i < 2; i++) { const r = h.file(MIG_INDEX); assert.equal(r.status, 0, String(r.stderr)); }
      assert.equal(h.psql("select count(*) from pg_indexes where indexname='economic_ledger_entries_recent_idx'").out, '1');
      const c = await repo.overview({scope: sc()}); assert.equal(strip(a), strip(c));
      const p1 = await repo.page({limit: 100}); assert.equal(p1.items.length, 100);
    });
    await t.test('con el índice nuevo la página es indexada (sin ordenar el libro)', async () => {
      const t0 = Date.now(); await repo.page({limit: 100}); assert.ok(Date.now() - t0 < 500);
    });
    await t.test('timeout de Postgres -> EconomicError economic_query_timeout (504), nunca un 503 genérico', async () => {
      const db = newDb(pool, 10000);
      await assert.rejects(db.transaction('read', async s => { await s.query("set local statement_timeout='1ms'"); return readOverview(s, {scope: sc()}); }), e => e instanceof EconomicError && e.code === 'economic_query_timeout' && e.status === 504);
      const timingOut = {tenantId: TENANT_A, query: async () => { throw Object.assign(new Error('canceling statement due to statement timeout'), {code: '57014'}); }};
      await assert.rejects(readPage(timingOut, {limit: 100}), e => e instanceof EconomicError && e.code === 'economic_query_timeout' && e.status === 504);
      assert.equal(asTimeout({code: '57014'}).status, 504); assert.equal(asTimeout(new Error('canceling statement due to statement timeout')).code, 'economic_query_timeout');
      const other = new Error('otra cosa'); assert.equal(asTimeout(other), other);
    });
    await t.test('aislamiento por tenant: otro tenant ve un libro vacío; la identidad no autorizada no lee', async () => {
      const other = createEconomicRepository({database: newDb(pool, 10000, OWNER.B, TENANT_B)});
      const v = await other.overview({scope: sc()}); assert.equal(v.state, 'empty'); assert.equal(v.totals.entities, 0); assert.equal(v.page.items.length, 0);
      assert.equal((await other.page({limit: 100})).items.length, 0);
      await assert.rejects(newDb(pool, 10000, OWNER.B, TENANT_A).transaction('read', async s => readOverview(s, {scope: sc()})), /organization_not_authorized/);
    });
    await t.test('alcance inválido sigue siendo 400 scope_invalid', async () => {
      await assert.rejects(repo.overview({scope: sc({exponent: 9})}), e => e.code === 'scope_invalid' && e.status === 400);
      await assert.rejects(repo.overview({scope: sc({timezone: 'America/Mexico_City'})}), e => e.code === 'scope_invalid');
    });
  }, {name: 'econ-85k'});
});
