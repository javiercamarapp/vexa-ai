// «Gestionar problemas» a la escala de orden de magnitud similar a la de producción (cientos de problemas, decenas de miles de miembros, miles de corridas): listar NO debe cargar el texto de evidencia de todas las corridas.
// Mide tiempo y número de consultas, compara el veredicto «resumen» con el completo fail-closed (que se conserva) y prueba aislamiento entre tenants.
// Postgres local desechable con migraciones reales; datos sintéticos. Construir el mundo tarda ~1 min.
//   node --test packages/problems/tests/escala-lista.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {withPg, pgAvailable} from '../../metrics/tests/pg-harness.mjs';
import {crearBaseDatos} from '../../ai-scale/economia-problemas/snapshot.mjs';
import {createProblemRepository} from '../repository.mjs';
import {mundoEscala, TENANT_A, TENANT_B, OWNER} from './escala-mundo.mjs';

const pg = createRequire(import.meta.url)('pg');
const SKIP = !pgAvailable() && 'sin postgres local';
const bypass = 'set session_replication_role=replica;';

/** Base que anota cada consulta con su texto completo. */
function medir(db) {
  const log = [];
  return {log, db: {transaction: (a, w) => db.transaction(a, s => w({...s, query: async (t, v) => { const t0 = performance.now(); try { return await s.query(t, v); } finally { log.push({ms: performance.now() - t0, t: String(t)}); } }}))}};
}
const ids = list => list.map(p => p.id).sort();

test('escala: list({verification:"summary"}) <10 s, pocas consultas, sin cargar redacted_text; el modo completo se conserva y coincide; mutaciones; tenants', {skip: SKIP, timeout: 1800000}, async t => {
  await withPg(async h => {
    const t0 = Date.now(); const w = mundoEscala(h); console.log(`# mundo construido en ${((Date.now() - t0) / 1000).toFixed(0)} s`);
    const cnt = sql => Number(h.psql(sql).out);
    assert.ok(cnt(`select count(*) from public.problems where tenant_id='${TENANT_A}'`) >= 394);
    assert.ok(cnt(`select count(*) from public.extraction_runs where tenant_id='${TENANT_A}' and status='succeeded'`) >= 8000);
    assert.ok(cnt(`select count(*) from public.problem_embedding_members where tenant_id='${TENANT_A}'`) >= 14000);
    const pool = new pg.Pool({host: h.sock, user: 'postgres', database: 't', max: 4});
    const mk = (tenant = TENANT_A, user = OWNER.A) => medir(crearBaseDatos({pool, tenantId: tenant, userId: user, statementTimeoutMs: 120000}));
    const textQueries = m => m.log.filter(x => /redacted_text/.test(x.t)).length;
    try {
      let summaryIds, fullIds;
      await t.test('resumen: <10 s, ≤13 consultas, ninguna toca redacted_text; completo: sí carga texto (89 lotes) y devuelve lo mismo', async () => {
        const m = mk(); const repo = createProblemRepository({database: m.db});
        const s0 = performance.now(); const summary = await repo.list({verification: 'summary'}); const ms = performance.now() - s0;
        console.log(`# list(summary): ${ms.toFixed(0)} ms, ${m.log.length} consultas, máx ${Math.max(...m.log.map(x => x.ms)).toFixed(0)} ms, consultas con redacted_text: ${textQueries(m)}`);
        assert.equal(summary.length, 394); assert.ok(ms < 10000, 'list(summary) ' + ms + ' ms'); assert.ok(m.log.length <= 13, 'consultas ' + m.log.length) /* 9 en vivo + SAVEPOINT/SELECT/RELEASE del lector del precálculo 20261114 */; assert.equal(textQueries(m), 0, 'el resumen no debe cargar texto de evidencia');
        const m2 = mk(); const f0 = performance.now(); const full = await createProblemRepository({database: m2.db}).list(); const fms = performance.now() - f0;
        console.log(`# list(full):    ${fms.toFixed(0)} ms, ${m2.log.length} consultas, consultas con redacted_text: ${textQueries(m2)}`);
        assert.ok(textQueries(m2) >= 80, 'el modo completo (por omisión) conserva la verificación con texto: ' + textQueries(m2));
        summaryIds = ids(summary); fullIds = ids(full); assert.deepEqual(summaryIds, fullIds); assert.equal(await createProblemRepository({database: mk().db}).list({verification: 'full'}).then(ids).then(JSON.stringify), JSON.stringify(fullIds));
        await assert.rejects(repo.list({verification: 'otra'}), /input_invalid/);
        const m3 = mk(); const src = await createProblemRepository({database: m3.db}).sources(); assert.equal(src.length, 100); assert.ok(m3.log.length <= 20, 'sources por lote: ' + m3.log.length);
        const m4 = mk(); const jobs = await createProblemRepository({database: m4.db}).jobs(); assert.equal(jobs.length, 0);
      });

      await t.test('mutaciones: el resumen y el completo excluyen lo mismo (corrida fallida, conversación borrada, revisión borrada, hash alterado, lápida, retención, conexión deshabilitada); solo difieren en lo que el resumen no relee (texto)', async () => {
        const run = i => w.A.convs[i].p.runId, conv = i => w.A.convs[i].conv.conversation_id, orig = i => w.A.convs[i].conv.messages[0].revision_id, rev = i => h.psql(`select provenance->'input_manifest'->0->>'message_revision_id' from public.extraction_runs where id='${run(i)}'`).out, pid = i => w.A.pid(i);
        const ok = r => assert.ok(r.ok, r.err);
        ok(h.psql(`${bypass} update public.extraction_runs set status='failed' where id='${run(1)}'`));
        ok(h.psql(`${bypass} update public.conversations set deleted_at=now() where id='${conv(2)}'`));
        ok(h.psql(`${bypass} update public.message_revisions set deleted_at=now() where id='${rev(3)}'`));
        ok(h.psql(`${bypass} update public.message_revisions set hash='${'0'.repeat(64)}' where id='${rev(4)}'`));
        ok(h.psql(`${bypass} update public.message_revisions set deleted_at=now() where id='${orig(9)}'`)); // revisión ORIGINAL borrada
        ok(h.psql(`${bypass} update public.messages set deleted_at=now() where id=(select message_id from public.message_revisions where id='${rev(10)}')`)); // mensaje borrado
        const ext5 = h.psql(`select external_id||'|'||connection_id from public.conversations where id='${conv(5)}'`).out.split('|');
        ok(h.psql(`${bypass} insert into public.tombstones(tenant_id,deleted_source_key,connection_id,reason) values('${TENANT_A}','${ext5[0]}','${ext5[1]}','prueba')`));
        const ext6 = h.psql(`select external_id||'|'||connection_id from public.conversations where id='${conv(6)}'`).out.split('|');
        ok(h.psql(`${bypass} insert into public.retention_ledger(tenant_id,id,connection_id,entity_type,external_id,actor_id,policy_version) values('${TENANT_A}',gen_random_uuid(),'${ext6[1]}','conversation','${ext6[0]}','${OWNER.A}',1)`));
        ok(h.psql(`${bypass} update public.connections set status='disabled' where id=(select connection_id from public.conversations where id='${conv(7)}')`));
        const caso8 = pid(8); // solo el texto cambia, el hash almacenado coincide con el del manifiesto: lo detecta el modo completo (sha256 del texto) y el detalle, no el resumen
        ok(h.psql(`${bypass} update public.message_revisions set redacted_text=redacted_text||' alterado' where id='${rev(8)}'`));
        const m = mk(); const summary = await createProblemRepository({database: m.db}).list({verification: 'summary'}); const full = await createProblemRepository({database: mk().db}).list();
        const gone = [1, 2, 3, 4, 5, 6, 7, 9, 10].map(pid);
        for (const g of gone) { assert.ok(!ids(summary).includes(g), 'resumen debe excluir ' + g); assert.ok(!ids(full).includes(g), 'completo debe excluir ' + g); }
        assert.ok(ids(summary).includes(pid(0)) && ids(full).includes(pid(0)));
        assert.equal(summary.length, 394 - gone.length); assert.equal(full.length, 394 - gone.length - 1);
        assert.deepEqual(ids(summary).filter(x => !ids(full).includes(x)), [caso8], 'única diferencia documentada: texto alterado con hash intacto');
        assert.equal(textQueries(m), 0);
        // …pero el problema afectado NO se abre: el detalle conserva la verificación completa fail-closed
        await assert.rejects(createProblemRepository({database: mk().db}).detail({problemId: caso8}), /source_unavailable|EVIDENCE_UNAVAILABLE/);
        await assert.rejects(createProblemRepository({database: mk().db}).detail({problemId: pid(1)}), /source_unavailable|EVIDENCE_UNAVAILABLE/);
        assert.equal((await createProblemRepository({database: mk().db}).detail({problemId: pid(0)})).id, pid(0));
      });

      await t.test('tenants: B ve solo lo suyo; una versión de A que apunta a embeddings de B queda excluida; B no abre problemas de A', async () => {
        const repoB = createProblemRepository({database: mk(TENANT_B, OWNER.B).db});
        const lb = await repoB.list({verification: 'summary'}); assert.equal(lb.length, 3);
        assert.deepEqual(ids(lb), ids(await repoB.list()));
        assert.ok(lb.every(p => w.B.pids.includes(p.id)) && !lb.some(p => w.A.pids.includes(p.id)));
        await assert.rejects(repoB.detail({problemId: w.A.pid(0)}), /problem_not_found/);
        // la lista de A no se altera por B, y apuntar un problema de A a embeddings de B (otro tenant) lo excluye en ambos modos
        const embB = h.psql(`select id from public.embeddings where tenant_id='${TENANT_B}' limit 1`).out;
        assert.ok(h.psql(`${bypass} update public.problem_versions set provenance=jsonb_set(provenance,'{snapshot,embeddingIds}',jsonb_build_array('${embB}')) where tenant_id='${TENANT_A}' and problem_id='${w.A.pid(9)}'`).ok);
        const a = await createProblemRepository({database: mk().db}).list({verification: 'summary'}), af = await createProblemRepository({database: mk().db}).list();
        assert.ok(!ids(a).includes(w.A.pid(9)) && !ids(af).includes(w.A.pid(9)));
        assert.ok(!a.some(p => w.B.pids.includes(p.id)));
        // sesión de B sobre datos de A: el resumen de B sigue en 3 y no cuenta corridas de A
        assert.equal((await repoB.list({verification: 'summary'})).length, 3);
      });
    } finally { await pool.end(); }
  }, {shared: '256MB'});
});
