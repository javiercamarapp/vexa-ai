// Vista «Problemas» cuando el corte publicado NO trae membresía de exposición (0 vínculos problema–pedido, como en producción el 22-oct):
// lista los problemas vigentes del catálogo con el importe NO DISPONIBLE (EXPOSURE_NOT_LINKED), nunca 0.00; con vínculos el comportamiento no cambia.
// Postgres local desechable con las migraciones reales; datos sintéticos.
//   node --test packages/workspace-service/tests/problemas-sin-vinculos.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {withPg, pgAvailable} from '../../metrics/tests/pg-harness.mjs';
import {montarMundo, TENANT_A, TENANT_B, OWNER} from '../../ai-scale/economia-problemas/mundo.mjs';
import {construirMundo} from '../../metrics/tests/world.mjs';
import {crearBaseDatos, alcance} from '../../ai-scale/economia-problemas/snapshot.mjs';
import {createSnapshotRepository} from '../../metrics/snapshots.mjs';
import {createWorkspaceService} from '../index.mjs';
import {createDetailService} from '../detail.mjs';

const SKIP = !pgAvailable() && 'sin postgres local';
const q = (a, extra = {}) => new URLSearchParams({date_start: a.start.slice(0, 10), date_end: a.end.slice(0, 10), currency: a.currency, basis: a.basis, exponent: String(a.exponent), ...extra});

test('sin membresía: lista el catálogo vigente ordenado por incidencias, importe NO DISPONIBLE con razón, aviso explícito, detalle abre; otro tenant no ve nada', {skip: SKIP, timeout: 600000}, async () => {
  await withPg(async h => {
    montarMundo(h); // conversaciones, problemas (3: Envío x5 conv, Pago x2, Garantía x1) y libro; SIN vínculos problema–pedido
    const pool = new pg.Pool({host: h.sock, user: 'postgres', database: 't', max: 4});
    try {
      const db = (user = OWNER.A, tenant = TENANT_A) => crearBaseDatos({pool, tenantId: tenant, userId: user, statementTimeoutMs: 60000});
      const A1 = alcance('marketplaces-usd');
      const repo = createSnapshotRepository({database: db()});
      let snap = await repo.stage({scope: A1}); snap = await repo.publish({snapshotId: snap.id, expectedContentHash: snap.contentHash});
      assert.equal(snap.status, 'published'); assert.equal(snap.exposure.membership.length, 0, 'el corte no trae membresía');
      const ws = createWorkspaceService({database: db()});
      const list = await ws.query(q(A1, {resource: 'problems', snapshot_id: snap.id}), {all: true});
      assert.equal(list.meta.state, 'partial'); assert.match(list.meta.coverage, /Sin vínculos problema–pedido: la exposición no se calcula/);
      assert.deepEqual(list.items.map(i => i.title), ['Envío: No recibido', 'Pago: Cobro duplicado', 'Garantía: Batería'], 'orden por incidencias');
      assert.equal(list.items[0].details.find(d => d.label.startsWith('Incidencias')).value, '5');
      for (const it of list.items) {
        const m = it.metrics[0];
        assert.equal(m.kind, 'exposure'); assert.equal(m.amount_minor, null, 'desconocido, nunca 0.00'); assert.equal(m.known_subtotal, null);
        assert.equal(m.status, 'unavailable'); assert.deepEqual(m.missing_reasons, ['EXPOSURE_NOT_LINKED']); assert.equal(it.problem_id, it.id);
      }
      // paginación con cursor sobre el orden por incidencias (no por id)
      const p1 = await ws.query(q(A1, {resource: 'problems', snapshot_id: snap.id, limit: '2'}));
      assert.equal(p1.items.length, 2); assert.ok(p1.meta.next_cursor);
      const p2 = await ws.query(q(A1, {resource: 'problems', snapshot_id: snap.id, limit: '2', cursor: p1.meta.next_cursor}));
      assert.deepEqual([...p1.items, ...p2.items].map(i => i.id), list.items.map(i => i.id)); assert.equal(p2.meta.next_cursor, null);
      // el Resumen no cambia (no es la vista de problemas)
      const res = await ws.query(q(A1, {resource: 'metrics', snapshot_id: snap.id}));
      assert.equal(res.items.length, 1); assert.doesNotMatch(String(res.meta.coverage), /Sin vínculos problema–pedido/);
      // con filtros de SKU/fuente NO se aplica el catálogo (los filtros no tienen sentido sin vínculos): comportamiento anterior
      const filtered = await ws.query(q(A1, {resource: 'problems', snapshot_id: snap.id, sku: 'SKU-A'}), {all: true});
      assert.equal(filtered.items.length, 0);
      // el detalle abre: todos los componentes no disponibles, ninguno en cero
      const detail = createDetailService({database: db()});
      const envio = list.items[0];
      const d = await detail.get({kind: 'problem', id: envio.id, query: q(A1, {snapshot_id: snap.id, scope_hash: list.meta.scope_hash})});
      assert.equal(d.kind, 'problem'); assert.equal(d.title, 'Envío: No recibido'); assert.ok(d.components.length >= 3);
      for (const c of d.components) { assert.equal(c.money.amount_minor, null, c.metric); assert.equal(c.money.status, 'unavailable'); assert.deepEqual(c.money.missing_reasons, ['EXPOSURE_NOT_LINKED']); assert.equal(c.event_count, 0); }
      // un id que no es del catálogo vigente sigue dando 404
      await assert.rejects(detail.get({kind: 'problem', id: '00000000-0000-4000-8000-0000000000ff', query: q(A1, {snapshot_id: snap.id, scope_hash: list.meta.scope_hash})}), e => e.status === 404);
      // otro tenant: sin corte publicado => vacío, sin filtrar problemas ajenos; y el scope de A no abre detalle en B
      const wsB = createWorkspaceService({database: db(OWNER.B, TENANT_B)});
      const vacio = await wsB.query(q(A1, {resource: 'problems'}), {all: true});
      assert.equal(vacio.items.length, 0); assert.equal(vacio.meta.snapshot_id, null);
      await assert.rejects(createDetailService({database: db(OWNER.B, TENANT_B)}).get({kind: 'problem', id: envio.id, query: q(A1, {snapshot_id: snap.id, scope_hash: list.meta.scope_hash})}));
    } finally { await pool.end(); }
  });
});

test('con membresía el comportamiento no cambia: solo los problemas vinculados y su importe del snapshot; nunca EXPOSURE_NOT_LINKED', {skip: SKIP, timeout: 600000}, async () => {
  await withPg(async h => {
    const ctx = await construirMundo(h, {complete: false});
    try {
      const repo = createSnapshotRepository({database: ctx.db()});
      let snap = await repo.stage({scope: ctx.A1}); snap = await repo.publish({snapshotId: snap.id, expectedContentHash: snap.contentHash});
      assert.ok(snap.exposure.membership.length > 0);
      const ws = createWorkspaceService({database: ctx.db()});
      const list = await ws.query(ctx.query(ctx.A1, {resource: 'problems', snapshot_id: snap.id}), {all: true});
      assert.deepEqual(list.items.map(i => i.title).sort(), ['Envío: No recibido', 'Pago: Cobro duplicado'], 'solo los vinculados en este alcance');
      assert.ok(list.items.every(i => !i.metrics[0].missing_reasons.includes('EXPOSURE_NOT_LINKED')));
      assert.equal(list.items.find(i => i.title === 'Envío: No recibido').metrics[0].known_subtotal, '35000');
      assert.doesNotMatch(String(list.meta.coverage), /Sin vínculos problema–pedido/);
    } finally { await ctx.pool.end(); }
  });
});
