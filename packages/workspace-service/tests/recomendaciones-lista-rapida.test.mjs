// QA1-019 (ALTO, 22-oct prod): /recommendations tardaba 85-95 s en frío con 3 guardadas porque cada lectura de la LISTA volvía a verificar por completo
// las citas de cada recomendación (p. ej. «Order: Spare Parts» con 2,338 corridas) y el catálogo con la verificación de resumen (≈7-14 s).
// La guarda recommendation_managed_guard ya verificó las citas al insertar (son inmutables): la lista muestra el vínculo guardado y SOLO get() (al abrir la evidencia) verifica por completo.
// Postgres local desechable con las migraciones reales + las propuestas 20261028/20261029/20261030 (no aplicadas aquí); datos sintéticos.
//   node --test packages/workspace-service/tests/recomendaciones-lista-rapida.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import pg from 'pg';
import {withPg, pgAvailable} from '../../metrics/tests/pg-harness.mjs';
import {montarMundo, TENANT_A, OWNER, psqlFile} from '../../ai-scale/economia-problemas/mundo.mjs';
import {crearBaseDatos, alcance} from '../../ai-scale/economia-problemas/snapshot.mjs';
import {createSnapshotRepository} from '../../metrics/snapshots.mjs';
import {createWorkspaceService} from '../index.mjs';
import {createRecommendationRepository} from '../../recommendations/index.mjs';

const read = f => fs.readFileSync(new URL(f, import.meta.url), 'utf8');
const SQL = ['20261028000000_brief_catalog_cut', '20261030000000_brief_guard_uuid_ids', '20261029000000_recommendation_catalog_cut', '20261101000000_recommendation_generator_v2'].map(n => read('../../../supabase/migrations/' + n + '.sql'));
const SKIP = !pgAvailable() && 'sin postgres local';
const q = (a, extra = {}) => new URLSearchParams({date_start: a.start.slice(0, 10), date_end: a.end.slice(0, 10), currency: a.currency, basis: a.basis, exponent: String(a.exponent), ...extra});
const norm = x => String(x?.text ?? x).replace(/\s+/g, ' ').trim();
const verifies = log => log.filter(x => /^SELECT id,status,conversation_id,input_hash,provenance|WITH sel AS MATERIALIZED/.test(x)).length;

test('Lista de recomendaciones: sin verificación completa; get() la hace al abrir y falla cerrado', {skip: SKIP, timeout: 900000}, async t => {
  await withPg(async h => {
    montarMundo(h);
    for (const sql of SQL) { const r = psqlFile(h.sock, sql); assert.equal(r.status, 0, String(r.stderr).slice(0, 400)); }
    const psql = sql => h.psql(sql).out;
    const pool = new pg.Pool({host: h.sock, user: 'postgres', database: 't', max: 4});
    try {
      const base = () => crearBaseDatos({pool, tenantId: TENANT_A, userId: OWNER.A, statementTimeoutMs: 60000});
      const logged = log => { const db = base(); return {transaction: (a, w) => db.transaction(a, s => w(Object.freeze({...s, query: async (text, v) => { log.push(norm(text)); return s.query(text, v); }})))}; };
      const A1 = alcance('marketplaces-usd');
      let snap = await createSnapshotRepository({database: base()}).stage({scope: A1});
      snap = await createSnapshotRepository({database: base()}).publish({snapshotId: snap.id, expectedContentHash: snap.contentHash});
      const ws = createWorkspaceService({database: base()});
      const scopeHash = (await ws.query(q(A1, {resource: 'problems', snapshot_id: snap.id}))).meta.scope_hash;
      const sp = q(A1, {snapshot_id: snap.id, scope_hash: scopeHash});
      const catalog = (await ws.query(new URLSearchParams([...sp, ['resource', 'problems']]), {all: true, signals: false})).items;
      const saved = await createRecommendationRepository({database: base(), limits: {maxRefs: 2}}).generate({query: sp.toString(), problemId: catalog[0].id, requestKey: 'rec-lista-0001'});
      assert.equal(saved.verification, 'full'); assert.ok(saved.evidenceRefs.length > 0);

      await t.test('la lista no verifica corridas ni resume el catálogo, y no envía texto de citas', async () => {
        const log = [], list = await createRecommendationRepository({database: logged(log)}).list({query: sp});
        const item = list.items.find(i => i.id === saved.id);
        assert.ok(item, 'la recomendación guardada aparece');
        assert.equal(verifies(log), 0, 'cero verificaciones de corridas/resumen:\n' + log.filter(x => /WITH sel|extraction_runs/.test(x)).join('\n').slice(0, 600));
        assert.equal(item.verification, 'saved'); assert.deepEqual(item.evidenceRefs, []); assert.equal(item.evidenceCount, saved.evidenceRefs.length);
        assert.equal(item.stale, false); assert.equal(item.problemVersion, saved.problemVersion);
        assert.ok(list.problemOptions.length >= 3, 'el catálogo para proponer sigue disponible');
      });

      await t.test('get() (al abrir) verifica por completo y devuelve las citas', async () => {
        const log = [], full = await createRecommendationRepository({database: logged(log)}).get({id: saved.id});
        assert.ok(verifies(log) > 0, 'verificación completa al abrir');
        assert.equal(full.verification, 'full'); assert.deepEqual(full.evidenceRefs.map(e => e.quoteHash).sort(), saved.evidenceRefs.map(e => e.quoteHash).sort());
      });

      await t.test('fail-closed: con la evidencia alterada la lista conserva la tarjeta pero get() no muestra citas (403)', async () => {
        const rev = psql(`select r.id from public.problem_embedding_members m join public.extraction_runs x on x.id=m.extraction_run_id, lateral jsonb_array_elements(x.provenance->'input_manifest') e join public.message_revisions r on r.id=(e->>'message_revision_id')::uuid where m.problem_id='${catalog[0].id}' limit 1`).trim();
        const r = psqlFile(h.sock, `set session_replication_role=replica; update public.message_revisions set redacted_text=redacted_text||' alterado' where id='${rev}'`); assert.equal(r.status, 0);
        const repo = createRecommendationRepository({database: base()});
        assert.ok((await repo.list({query: sp})).items.some(i => i.id === saved.id), 'la lista no re-verifica: sigue mostrando el vínculo guardado');
        await assert.rejects(repo.get({id: saved.id}), e => e.status === 403);
      });
    } finally { await pool.end(); }
  }, {name: 'reclista', upto: 55});
});
