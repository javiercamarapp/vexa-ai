// «Señales críticas» con verificación de RESUMEN (23-oct): antes recorrían priority.view -> inputs() con verificación COMPLETA de evidencia (≈13 s en producción, tope 1.5 s)
// y el aviso salía siempre «no calculadas ahora». Ahora: lista de problemas con verification:'summary' + UNA consulta de incidencias por lotes.
//   node --test packages/workspace-service/tests/senales-criticas-resumen.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {withPg, pgAvailable} from '../../metrics/tests/pg-harness.mjs';
import {construirMundo, TENANT_A, OWNER} from '../../metrics/tests/world.mjs';
import {createSnapshotRepository} from '../../metrics/snapshots.mjs';
import {createPriorityRepository} from '../../metrics/priority.mjs';
import {criticalSignals} from '../index.mjs';

const SKIP = !pgAvailable() && 'sin postgres local';

test('señales críticas: número real con verificación de resumen, igual que la vista de prioridades; unavailable (nunca 0) si no alcanza', {skip: SKIP, timeout: 900000}, async t => {
  await withPg(async h => {
    const ctx = await construirMundo(h, {complete: false});
    const owner = () => createSnapshotRepository({database: ctx.db(OWNER.A, TENANT_A, 60000)});
    let snap = await owner().stage({scope: ctx.A1}); snap = await owner().publish({snapshotId: snap.id, expectedContentHash: snap.contentHash});
    // Latencia artificial en cada sentencia que carga TEXTO de evidencia (verificación completa): la vía de resumen no debe emitirla nunca.
    const wrap = (log, fullDelayMs = 0, matchSleep = null, sleepSecs = 0) => { const base = ctx.db(OWNER.A, TENANT_A, 60000); return {transaction: (a, w) => base.transaction(a, s => w(Object.freeze({...s, query: async (q, v) => {
      const text = String(q?.text ?? q); log.push(text);
      if (/redacted_text/.test(text) && fullDelayMs) await s.query('SELECT pg_sleep($1)', [fullDelayMs / 1000]);
      if (matchSleep && matchSleep.test(text)) await s.query('SELECT pg_sleep($1)', [sleepSecs]);
      return s.query(q, v); }})))}; };

    await t.test('mismo conteo que la vista completa de prioridades y sin cargar texto de evidencia', async () => {
      const full = await createPriorityRepository({database: ctx.db(OWNER.A, TENANT_A, 60000)}).view({snapshotId: snap.id});
      const expected = full.problemOptions.filter(p => p.criticalLane).length;
      const log = [];
      const r = await wrap(log).transaction('read', s => criticalSignals(s, snap.id));
      assert.equal(r.status, 'ok'); console.log("# conteo",r.count); assert.equal(r.count, expected);
      assert.deepEqual(log.filter(x => /redacted_text/.test(x)), [], 'la vía de resumen no carga texto de evidencia');
    });
    await t.test('con la verificación completa a 6 s por sentencia (como producción) el aviso sale con número real dentro del presupuesto', async () => {
      const t0 = performance.now();
      const r = await wrap([], 6000).transaction('read', s => criticalSignals(s, snap.id));
      assert.equal(r.status, 'ok'); assert.equal(typeof r.count, 'number'); assert.ok(performance.now() - t0 < 1500, 'dentro del presupuesto');
    });
    await t.test('si el catálogo no alcanza el presupuesto: unavailable, nunca 0', async () => {
      const r = await wrap([], 0, /FROM public\.problem_versions/, 4).transaction('read', s => criticalSignals(s, snap.id, 400));
      assert.deepEqual(r, {status: 'unavailable', count: null});
    });
    await ctx.pool.end();
  }, {name: 'crit', upto: 55});
});
