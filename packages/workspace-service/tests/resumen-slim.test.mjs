// /overview tardaba ~25 s en resolver «Prioridad con evidencia»: el widget pedía /api/workspace?resource=problems completo (resumen del catálogo + señales críticas + verificación de resumen de miles de corridas, ≈14 s medidos).
// slim=1 pide solo los registros del corte: sin esas tres partes y con el mismo scope_hash.
//   node --test packages/workspace-service/tests/resumen-slim.test.mjs
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

test('Resumen: la lectura slim de problemas no verifica el catálogo ni calcula señales', {skip: SKIP, timeout: 600000}, async () => {
  await withPg(async h => {
    montarMundo(h);
    const pool = new pg.Pool({host: h.sock, user: 'postgres', database: 't', max: 4});
    try {
      const base = () => crearBaseDatos({pool, tenantId: TENANT_A, userId: OWNER.A, statementTimeoutMs: 60000});
      const logged = log => { const db = base(); return {transaction: (a, w) => db.transaction(a, s => w(Object.freeze({...s, query: async (text, v) => { log.push(String(text?.text ?? text)); return s.query(text, v); }})))}; };
      const A1 = alcance('marketplaces-usd');
      let snap = await createSnapshotRepository({database: base()}).stage({scope: A1});
      snap = await createSnapshotRepository({database: base()}).publish({snapshotId: snap.id, expectedContentHash: snap.contentHash});
      const pinned = q(A1, {resource: 'problems', snapshot_id: snap.id});
      const full = [], slim = [];
      const a = await createWorkspaceService({database: logged(full)}).query(pinned, {catalog: true});
      const b = await createWorkspaceService({database: logged(slim)}).query(new URLSearchParams([...pinned, ['slim', '1']]), {catalog: false, signals: false, catalogVerification: 'none'});
      assert.equal(b.meta.scope_hash, a.meta.scope_hash, 'slim no cambia el alcance');
      assert.deepEqual(b.items.map(i => i.id), a.items.map(i => i.id));
      const resumenes = l => l.filter(x => /WITH sel AS MATERIALIZED/.test(x)).length;
      assert.ok(resumenes(full) > 0, 'la lectura completa sí verifica el resumen');
      assert.equal(resumenes(slim), 0); assert.equal(b.meta.catalog, undefined); assert.equal(b.meta.critical_notice, null);
      assert.ok(slim.length < full.length, `menos sentencias: ${slim.length} < ${full.length}`);
    } finally { await pool.end(); }
  });
});
