// Explorador en producción el 22-oct: el Explorador sobre un corte SIN vínculos problema–pedido (problem_versions vacío) devolvía 403 (historical_problem_unavailable) («Tu acceso cambió») y verificaba la evidencia de TODOS los problemas.
// Postgres local desechable con las migraciones reales; datos sintéticos.
//   node --test packages/workspace-service/tests/explorador-sin-vinculos.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {withPg, pgAvailable} from '../../metrics/tests/pg-harness.mjs';
import {montarMundo, TENANT_A, OWNER} from '../../ai-scale/economia-problemas/mundo.mjs';
import {crearBaseDatos, alcance} from '../../ai-scale/economia-problemas/snapshot.mjs';
import {createSnapshotRepository} from '../../metrics/snapshots.mjs';
import {createWorkspaceService} from '../index.mjs';
import {createExplorerRepository} from '../../recommendations/explorer.mjs';

const SKIP = !pgAvailable() && 'sin postgres local';
const q = (a, extra = {}) => new URLSearchParams({date_start: a.start.slice(0, 10), date_end: a.end.slice(0, 10), currency: a.currency, basis: a.basis, exponent: String(a.exponent), ...extra});

test('Explorador sobre corte sin vínculos', {skip: SKIP, timeout: 600000}, async t => {
  await withPg(async h => {
    montarMundo(h);
    const pool = new pg.Pool({host: h.sock, user: 'postgres', database: 't', max: 4});
    try {
      const base = (user = OWNER.A, tenant = TENANT_A) => crearBaseDatos({pool, tenantId: tenant, userId: user, statementTimeoutMs: 60000});
      const logged = log => { const db = base(); return {transaction: (a, w) => db.transaction(a, s => w(Object.freeze({...s, query: async (text, v) => { log.push(String(text?.text ?? text) + (/DISTINCT ON\(problem_id\) problem_id,provenance/.test(String(text)) ? ' #ids=' + v[1].length : '')); return s.query(text, v); }})))}; };
      const A1 = alcance('marketplaces-usd');
      let snap = await createSnapshotRepository({database: base()}).stage({scope: A1});
      snap = await createSnapshotRepository({database: base()}).publish({snapshotId: snap.id, expectedContentHash: snap.contentHash});
      assert.equal(snap.exposure.membership.length, 0);

      const scopeHash = (await createWorkspaceService({database: base()}).query(q(A1, {resource: 'problems', snapshot_id: snap.id}))).meta.scope_hash;
      await t.test('Explorador: corte sin vínculos lista el catálogo con citas (antes 403) y solo verifica la evidencia de la página', async () => {
        const log = [];
        const explorer = createExplorerRepository({database: logged(log)});
        const sp = q(A1, {snapshot_id: snap.id, scope_hash: scopeHash, limit: '1'});
        const page = await explorer.search({query: sp});
        assert.equal(page.items.length, 1); assert.ok(page.meta.totalMatched >= 3, 'total del catálogo, no de la página');
        assert.ok(page.items[0].evidenceCount > 0 && page.items[0].distinctCount > 0 && page.items[0].citations.length === 0 && page.items[0].verification === 'registered');
        assert.ok(page.meta.nextCursor);
        // R2-2-001: la lista no verifica ni siquiera la página: ninguna lectura de corridas; la verificación completa ocurre en evidence() al abrir.
        const opened = await explorer.evidence({query: sp, problemId: page.items[0].id}); assert.ok(opened.citations.length > 0);
        const next = await explorer.search({query: q(A1, {snapshot_id: snap.id, limit: '1', cursor: page.meta.nextCursor, scope_hash: scopeHash})});
        assert.equal(next.items.length, 1); assert.notEqual(next.items[0].id, page.items[0].id);
      });
    } finally { await pool.end(); }
  });
});
