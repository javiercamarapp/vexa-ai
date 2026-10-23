// Regresión 23-oct (QA-2, 504 «Task timed out after 300 seconds» en /api/problems/{id}/causality y 503 en las fichas):
// abrir un problema con miles de miembros verificaba la evidencia UNA VEZ POR MIEMBRO (y por corrida) fuera de una sección de memo:
// 4,195 miembros / 2,338 corridas ≈ 30 mil consultas en una sola transacción que retenía una conexión del pool hasta agotar los 300 s.
// Aquí: mundo sintético pequeño en Postgres local; se cuentan las verificaciones de corridas (la primera consulta de cada evaluación de evidencia).
//   node --test packages/problems/tests/detalle-sin-n-mas-1.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {withPg, pgAvailable} from '../../metrics/tests/pg-harness.mjs';
import {crearBaseDatos} from '../../ai-scale/economia-problemas/snapshot.mjs';
import {createProblemRepository} from '../repository.mjs';
import {createCausalityRepository} from '../causality.mjs';
import {mundoEscala, TENANT_A, OWNER} from './escala-mundo.mjs';

const pg = createRequire(import.meta.url)('pg');
const SKIP = !pgAvailable() && 'sin postgres local';
const bypass = 'set session_replication_role=replica;';
const RUNS = 12, MEMBERS = 24;
/** Base que anota cada consulta con su texto. */
function medir(db) {
  const log = [];
  return {log, db: {transaction: (a, w) => db.transaction(a, s => w({...s, query: async (t, v) => { try { return await s.query(t, v); } finally { log.push(String(t)); } }}))}};
}
const evaluaciones = m => m.log.filter(t => /^\s*SELECT id,status,conversation_id,input_hash,provenance,model_id,created_at FROM public\.extraction_runs/.test(t)).length;

test('un problema con muchos miembros verifica la evidencia por LOTE, no por miembro', {skip: SKIP, timeout: 900000}, async t => {
  await withPg(async h => {
    const w = mundoEscala(h, {runs: RUNS, members: MEMBERS, problems: 1, runsB: 2, membersB: 2, problemsB: 1});
    const convs = w.A.convs, cat = w.A;
    const pool = new pg.Pool({host: h.sock, user: 'postgres', database: 't', max: 4});
    const mk = () => medir(crearBaseDatos({pool, tenantId: TENANT_A, userId: OWNER.A, statementTimeoutMs: 120000}));
    const pid = cat.pid(0);
    try {
      await t.test('detail: ≤2 evaluaciones de evidencia con 24 miembros en 12 corridas (antes 1 + 24)', async () => {
        const m = mk();
        const p = await createProblemRepository({database: m.db}).detail({problemId: pid});
        assert.equal(p.id, pid); assert.equal(p.embeddingIds.length, MEMBERS);
        assert.ok(evaluaciones(m) <= 2, 'evaluaciones de evidencia: ' + evaluaciones(m));
      });
      await t.test('causalidad: ≤2 evaluaciones de evidencia (antes detail + 1 por corrida)', async () => {
        const m = mk();
        const v = await createCausalityRepository({database: m.db}).get({problemId: pid});
        assert.equal(v.problemId, pid);
        assert.ok(evaluaciones(m) <= 2, 'evaluaciones de evidencia: ' + evaluaciones(m));
      });
      await t.test('con más corridas que el tope se usa la verificación de resumen (sin texto) y sigue siendo fail-closed', async () => {
        const m = mk();
        const p = await createProblemRepository({database: m.db}, {verifyMaxRuns: 5}).detail({problemId: pid});
        assert.equal(p.verification, 'summary'); assert.equal(evaluaciones(m), 0);
        assert.ok(!m.log.some(x => /redacted_text/.test(x)), 'el resumen no carga texto');
        const run = convs[3].p.runId;
        assert.ok(h.psql(`${bypass} update public.extraction_runs set status='failed' where id='${run}'`).ok);
        await assert.rejects(createProblemRepository({database: mk().db}, {verifyMaxRuns: 5}).detail({problemId: pid}), /source_unavailable|EVIDENCE_UNAVAILABLE/);
        await assert.rejects(createProblemRepository({database: mk().db}).detail({problemId: pid}), /source_unavailable|EVIDENCE_UNAVAILABLE/);
        const c = mk();
        await assert.rejects(createCausalityRepository({database: c.db}).get({problemId: pid}), /source_unavailable|EVIDENCE_UNAVAILABLE/);
      });
    } finally { await pool.end(); }
  }, {shared: '128MB'});
});
