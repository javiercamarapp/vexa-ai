// Anclaje de alcance: vistas que dependían del Resumen/Problemas completo (Explorador, Intervenciones, Brief, Recomendaciones, Gestionar problemas) en producción el 22-oct:
//  (1) el «anclaje» de alcance (/api/workspace?resource=problems) solo necesita snapshot_id/scope_hash pero ejecutaba el catálogo + señales críticas (16-20 s, 503);
// Postgres local desechable con las migraciones reales; datos sintéticos.
//   node --test packages/workspace-service/tests/anclaje-de-alcance.test.mjs
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

test('anclaje de alcance (metaOnly)', {skip: SKIP, timeout: 600000}, async t => {
  await withPg(async h => {
    montarMundo(h);
    const pool = new pg.Pool({host: h.sock, user: 'postgres', database: 't', max: 4});
    try {
      const base = (user = OWNER.A, tenant = TENANT_A) => crearBaseDatos({pool, tenantId: tenant, userId: user, statementTimeoutMs: 60000});
      const logged = log => { const db = base(); return {transaction: (a, w) => db.transaction(a, s => w(Object.freeze({...s, query: async (text, v) => { log.push(String(text?.text ?? text)); return s.query(text, v); }})))}; };
      const A1 = alcance('marketplaces-usd');
      let snap = await createSnapshotRepository({database: base()}).stage({scope: A1});
      snap = await createSnapshotRepository({database: base()}).publish({snapshotId: snap.id, expectedContentHash: snap.contentHash});
      assert.equal(snap.exposure.membership.length, 0);

      const scopeHash = (await createWorkspaceService({database: base()}).query(q(A1, {resource: 'problems', snapshot_id: snap.id}))).meta.scope_hash;
      await t.test('metaOnly: mismos identificadores que la consulta completa y sin catálogo, evidencia ni señales críticas', async () => {
        const full = await createWorkspaceService({database: base()}).query(q(A1, {resource: 'problems', snapshot_id: snap.id}), {all: true});
        const log = [];
        const ws = createWorkspaceService({database: logged(log)});
        const pin = await ws.query(q(A1, {resource: 'problems', snapshot_id: snap.id}), {metaOnly: true});
        for (const k of ['snapshot_id', 'base_snapshot_id', 'base_scope_hash', 'scope_hash', 'can_manage']) assert.equal(pin.meta[k], full.meta[k], k);
        assert.deepEqual(pin.meta.scope, full.meta.scope); assert.deepEqual(pin.items, []);
        const heavy = log.filter(x => /problem_embedding_members|extraction_runs|priority_|problem_versions/.test(x));
        assert.deepEqual(heavy, [], 'el anclaje no debe leer problemas/evidencia');
        // el anclaje resultante es utilizable: la consulta con ese alcance fijado coincide
        const again = await createWorkspaceService({database: base()}).query(q(A1, {resource: 'problems', snapshot_id: pin.meta.snapshot_id, scope_hash: pin.meta.scope_hash}), {all: true});
        assert.equal(again.meta.scope_hash, full.meta.scope_hash);
        // con alcance ya fijado (Intervenciones): también sin catálogo ni señales críticas, y los identificadores coinciden
        const log2 = [];
        const fixed = await createWorkspaceService({database: logged(log2)}).query(q(A1, {resource: 'problems', snapshot_id: pin.meta.snapshot_id, scope_hash: pin.meta.scope_hash}), {all: true, metaOnly: true});
        assert.equal(fixed.meta.scope_hash, full.meta.scope_hash); assert.deepEqual(fixed.items, []);
        assert.deepEqual(log2.filter(x => /problem_embedding_members|extraction_runs|priority_/.test(x)), []);
      });

    } finally { await pool.end(); }
  });
});
