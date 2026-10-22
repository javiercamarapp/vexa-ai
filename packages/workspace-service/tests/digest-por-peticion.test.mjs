// Una petición con alcance SIN fijar (sin scope_hash) hacía dos transacciones de lectura y, con ellas, dos verificaciones completas del snapshot (dos economic_snapshot_digest sobre un manifiesto de 27 MB).
// Ahora comparten una transacción cuando no hay nada que materializar; el resultado es idéntico y la verificación sigue completa.
//   node --test packages/workspace-service/tests/digest-por-peticion.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {withPg, pgAvailable} from '../../metrics/tests/pg-harness.mjs';
import {montarMundo, TENANT_A, OWNER} from '../../ai-scale/economia-problemas/mundo.mjs';
import {crearBaseDatos, alcance} from '../../ai-scale/economia-problemas/snapshot.mjs';
import {createSnapshotRepository} from '../../metrics/snapshots.mjs';
import {createWorkspaceService} from '../index.mjs';

const SKIP = !pgAvailable() && 'sin postgres local';
const q = (a, extra = {}) => new URLSearchParams({date_start: a.start.slice(0, 10), date_end: a.end.slice(0, 10), currency: a.currency, basis: a.basis, exponent: String(a.exponent), ...extra});

test('alcance sin fijar: una sola verificación del snapshot por petición', {skip: SKIP, timeout: 600000}, async t => {
  await withPg(async h => {
    montarMundo(h);
    const pool = new pg.Pool({host: h.sock, user: 'postgres', database: 't', max: 4});
    try {
      const base = () => crearBaseDatos({pool, tenantId: TENANT_A, userId: OWNER.A, statementTimeoutMs: 60000});
      const logged = log => { const db = base(); return {transaction: (a, w) => { log.tx++; return db.transaction(a, s => w(Object.freeze({...s, query: async (text, v) => { log.q.push(String(text?.text ?? text)); return s.query(text, v); }}))); }}; };
      const A1 = alcance('marketplaces-usd');
      let snap = await createSnapshotRepository({database: base()}).stage({scope: A1});
      snap = await createSnapshotRepository({database: base()}).publish({snapshotId: snap.id, expectedContentHash: snap.contentHash});
      const digests = log => log.q.filter(x => /economic_snapshot_digest/.test(x)).length;
      // Primera petición: crea el binding (materializa). Las siguientes ya lo encuentran.
      await createWorkspaceService({database: base()}).query(q(A1, {resource: 'problems', snapshot_id: snap.id}), {all: true});
      await t.test('sin scope_hash y sin nada que materializar: 1 transacción, 1 digest, mismo resultado que con el alcance fijado', async () => {
        const log = {tx: 0, q: []};
        const unpinned = await createWorkspaceService({database: logged(log)}).query(q(A1, {resource: 'problems'}), {all: true});
        assert.equal(digests(log), 1, 'un solo digest por petición'); assert.equal(log.tx, 1, 'una sola transacción');
        const log2 = {tx: 0, q: []};
        const pinned = await createWorkspaceService({database: logged(log2)}).query(q(A1, {resource: 'problems', snapshot_id: unpinned.meta.snapshot_id, scope_hash: unpinned.meta.scope_hash}), {all: true});
        assert.equal(digests(log2), 1);
        assert.deepEqual(unpinned, pinned);
      });
      await t.test('con snapshot_id pero sin scope_hash (lo que envía el Explorador): también una sola verificación', async () => {
        const log = {tx: 0, q: []};
        await createWorkspaceService({database: logged(log)}).query(q(A1, {resource: 'problems', snapshot_id: snap.id}), {all: true});
        assert.equal(digests(log), 1);
      });
      await t.test('catálogo + señales críticas en la misma petición: el veredicto de resumen se calcula UNA vez (≈6.5 s en frío en producción); signals:false no calcula señales', async () => {
        const log = {tx: 0, q: []};
        const r = await createWorkspaceService({database: logged(log)}).query(q(A1, {resource: 'problems', snapshot_id: snap.id}), {all: true});
        const usable = l => l.q.filter(x => /WITH sel AS MATERIALIZED/.test(x)).length;
        assert.equal(usable(log), 1, 'un solo cálculo de corridas utilizables'); assert.equal(r.meta.critical_notice_state, 'ok');
        const log2 = {tx: 0, q: []};
        const r2 = await createWorkspaceService({database: logged(log2)}).query(q(A1, {resource: 'problems', snapshot_id: snap.id}), {all: true, signals: false});
        assert.equal(log2.q.filter(x => /evidence_spans/.test(x)).length, 0, 'sin señales no se leen incidencias'); assert.equal(r2.meta.critical_notice_state, 'unavailable');
        assert.deepEqual(r2.items, r.items);
      });
      await t.test('alcance con filtro nuevo (hay que materializar): sigue el flujo de tres transacciones y funciona', async () => {
        const log = {tx: 0, q: []};
        const r = await createWorkspaceService({database: logged(log)}).query(q(A1, {resource: 'problems', source: 'zendesk'}), {all: true});
        assert.ok(r.meta.scope_hash); assert.ok(log.tx >= 2);
      });
    } finally { await pool.end(); }
  });
});
