// QA2-006/007/008 (Explorador): en un corte sin vínculos problema–pedido el catálogo se lista SIN la verificación de resumen de todas las corridas
// (≈14 s medidos en producción por petición) y solo la página visible se verifica por completo (fail-closed); «Ver evidencia» ya no verifica el catálogo entero.
// Postgres local desechable con las migraciones reales; datos sintéticos.
//   node --test packages/workspace-service/tests/explorador-rendimiento.test.mjs
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
const norm = t => String(t?.text ?? t).replace(/\s+/g, ' ');

test('Explorador: lista sin verificar el catálogo, página verificada, búsqueda por SQL', {skip: SKIP, timeout: 600000}, async t => {
  await withPg(async h => {
    montarMundo(h);
    const pool = new pg.Pool({host: h.sock, user: 'postgres', database: 't', max: 4});
    try {
      const base = () => crearBaseDatos({pool, tenantId: TENANT_A, userId: OWNER.A, statementTimeoutMs: 60000});
      const logged = log => { const db = base(); return {transaction: (a, w) => db.transaction(a, s => w(Object.freeze({...s, query: async (text, v) => { log.push({t: norm(text), n: Array.isArray(v?.[1]) ? v[1].length : null}); return s.query(text, v); }})))}; };
      const A1 = alcance('marketplaces-usd');
      let snap = await createSnapshotRepository({database: base()}).stage({scope: A1});
      snap = await createSnapshotRepository({database: base()}).publish({snapshotId: snap.id, expectedContentHash: snap.contentHash});
      const scopeHash = (await createWorkspaceService({database: base()}).query(q(A1, {resource: 'problems', snapshot_id: snap.id}))).meta.scope_hash;
      const sp = (extra = {}) => q(A1, {snapshot_id: snap.id, scope_hash: scopeHash, ...extra});
      const summaryRuns = log => log.filter(x => /WITH sel AS MATERIALIZED/.test(x.t));

      await t.test('listar, ordenar y paginar NO ejecutan la verificación de resumen del catálogo; la fila trae categoría, grupo, conversaciones (sin extracto)', async () => {
        const log = [], explorer = createExplorerRepository({database: logged(log)});
        const page = await explorer.search({query: sp({limit: '2'})});
        assert.equal(summaryRuns(log).length, 0, 'la lista no debe verificar todas las corridas del catálogo');
        assert.ok(page.meta.totalMatched >= 3); assert.equal(page.meta.catalogSize, page.meta.totalMatched); assert.equal(page.meta.unverifiedOmitted, 0);
        for (const it of page.items) {
          assert.ok(it.categoria && !/^[A-Z][a-z-]+: /.test(it.categoria) || it.categoria === it.title, 'categoría traducida o tal cual si es desconocida');
          assert.ok(it.grupo && it.grupo.n >= 1 && it.grupo.de >= it.grupo.n, 'grupo N de M');
          assert.ok(Number.isInteger(it.conversaciones) && it.conversaciones > 0, 'conversaciones observadas');
          assert.ok(it.distinctCount >= 1 && it.distinctCount <= it.evidenceCount);
          assert.equal('extracto' in it, false, 'privacidad: la fila no lleva texto de conversación');
        }
        const next = await explorer.search({query: sp({limit: '2', cursor: page.meta.nextCursor})});
        assert.equal(summaryRuns(log).length, 0); assert.ok(next.items.length >= 1); assert.ok(!next.items.some(i => page.items.some(p => p.id === i.id)));
        const byId = await explorer.search({query: sp({limit: '50', order: 'id_asc'})});
        assert.deepEqual(byId.items.map(i => i.id), [...byId.items.map(i => i.id)].sort());
      });

      await t.test('solo la página se verifica: evidencia por lote de ≤ límite problemas', async () => {
        const log = [], explorer = createExplorerRepository({database: logged(log)});
        await explorer.search({query: sp({limit: '1'})});
        const lotes = log.filter(x => /DISTINCT ON\(problem_id\) problem_id,provenance FROM public\.problem_versions WHERE tenant_id=\$1 AND problem_id=ANY/.test(x.t));
        assert.equal(lotes.length, 1); assert.equal(lotes[0].n, 1);
      });

      await t.test('«Ver evidencia» verifica solo el resumen de ESE problema, no el catálogo entero', async () => {
        const log = [], explorer = createExplorerRepository({database: logged(log)});
        const first = (await explorer.search({query: sp({limit: '1'})})).items[0], before = log.length;
        const ev = await explorer.evidence({query: sp(), problemId: first.id});
        assert.equal(ev.problemId, first.id); assert.ok(ev.citations.length >= 1);
        const runs = summaryRuns(log.slice(before)); assert.ok(runs.length <= 1, 'una sola verificación acotada');
        for (const r of runs) assert.ok(r.n === null || r.n <= 5, 'acotada a las corridas de un problema: ' + r.n);
        await assert.rejects(explorer.evidence({query: sp(), problemId: '99999999-9999-4999-8999-999999999999'}), e => e.status === 404);
      });

      await t.test('búsqueda de texto: por título/categoría y por texto de la evidencia, sin verificar todo el catálogo; sin coincidencias vacío', async () => {
        const log = [], explorer = createExplorerRepository({database: logged(log)});
        const all = await explorer.search({query: sp({limit: '50'})}), one = all.items[0];
        const word = one.citations[0].quote.trim().slice(0, 6).toLowerCase();
        const byQuote = await explorer.search({query: sp({q: word, limit: '50'})});
        assert.ok(byQuote.items.some(i => i.id === one.id), 'encuentra el problema por el texto de su cita: ' + word);
        const byCategory = await explorer.search({query: sp({q: one.categoria.split(':')[0].toLowerCase(), limit: '50'})});
        assert.ok(byCategory.items.some(i => i.id === one.id), 'encuentra por categoría traducida');
        const none = await explorer.search({query: sp({q: 'zzz-no-existe-zzz'})});
        assert.equal(none.items.length, 0); assert.equal(none.meta.totalMatched, 0); assert.equal(none.meta.state, 'empty');
        await explorer.search({query: sp({q: '100%_'})}); // comodines de LIKE escapados: no revienta ni coincide con todo
        assert.equal(summaryRuns(log).length, 0);
        const lotes = log.filter(x => /DISTINCT ON\(problem_id\) problem_id,provenance FROM public\.problem_versions WHERE tenant_id=\$1 AND problem_id=ANY/.test(x.t));
        assert.ok(lotes.every(l => l.n <= 50));
      });

      await t.test('fail-closed: un problema cuya evidencia deja de ser utilizable se EXCLUYE de la página y se cuenta; nunca se muestra', async () => {
        const explorer = createExplorerRepository({database: logged([])});
        const all = await explorer.search({query: sp({limit: '50'})}), victim = all.items[0];
        const run = h.psql(`select extraction_run_id from public.problem_embedding_members where tenant_id='${TENANT_A}' and problem_id='${victim.id}' limit 1`).out;
        assert.ok(h.psql(`set session_replication_role=replica; update public.extraction_runs set status='failed' where id='${run}'`).ok);
        const after = await explorer.search({query: sp({limit: '50'})});
        assert.ok(!after.items.some(i => i.id === victim.id), 'el problema no verificable no se muestra');
        assert.equal(after.meta.unverifiedOmitted, 1);
        await assert.rejects(explorer.evidence({query: sp(), problemId: victim.id}), e => [403, 404].includes(e.status));
      });
    } finally { await pool.end(); }
  });
});
