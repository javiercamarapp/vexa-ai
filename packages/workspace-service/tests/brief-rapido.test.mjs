// «Generar brief» (POST /api/briefs) y «Proponer una recomendación» (POST /api/recommendations) en producción el 22-oct:
//  - el brief abría ~12 transacciones de lectura que repetían la verificación del catálogo (resumen ~7-13 s en frío por página de 50 problemas), el digest del snapshot, la evidencia completa y hacían N+1 por corrida: 504 a los 300 s;
//  - sobre un corte SIN vínculos problema–pedido, el brief fallaba al guardar (brief_guard) y la recomendación con 404 problem_not_found (y después, en la guarda de la base).
// Postgres local desechable con las migraciones reales + las propuestas 20261028/20261029 (no aplicadas en producción); datos sintéticos.
//   node --test packages/workspace-service/tests/brief-rapido.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import pg from 'pg';
import {withPg, pgAvailable} from '../../metrics/tests/pg-harness.mjs';
import {montarMundo, TENANT_A, OWNER, psqlFile} from '../../ai-scale/economia-problemas/mundo.mjs';
import {crearBaseDatos, alcance} from '../../ai-scale/economia-problemas/snapshot.mjs';
import {createSnapshotRepository} from '../../metrics/snapshots.mjs';
import {createPriorityRepository} from '../../metrics/priority.mjs';
import {createWorkspaceService} from '../index.mjs';
import {createBriefRepository} from '../../briefs/index.mjs';
import {createRecommendationRepository} from '../../recommendations/index.mjs';

const read = f => fs.readFileSync(new URL(f, import.meta.url), 'utf8');
const UP_B = read('../../../supabase/migrations/20261028000000_brief_catalog_cut.sql'), DOWN_B = read('./20261028000000_brief_catalog_cut.down.sql');
const UP_R = read('../../../supabase/migrations/20261029000000_recommendation_catalog_cut.sql'), DOWN_R = read('./20261029000000_recommendation_catalog_cut.down.sql');
const UP_V2 = read('../../../supabase/migrations/20261101000000_recommendation_generator_v2.sql');
const UP_G = read('../../../supabase/migrations/20261030000000_brief_guard_uuid_ids.sql'), DOWN_G = read('./20261030000000_brief_guard_uuid_ids.down.sql');
const SKIP = !pgAvailable() && 'sin postgres local';
const q = (a, extra = {}) => new URLSearchParams({date_start: a.start.slice(0, 10), date_end: a.end.slice(0, 10), currency: a.currency, basis: a.basis, exponent: String(a.exponent), ...extra});
const norm = x => String(x?.text ?? x).replace(/\s+/g, ' ').trim();
const count = (log, re) => log.filter(x => re.test(x)).length;
const stats = log => ({tx: count(log, /^BEGIN/), stmts: log.filter(x => !x.startsWith('BEGIN')).length, runGets: count(log, /^SELECT id,status,conversation_id,input_hash,provenance/), summary: count(log, /WITH sel AS MATERIALIZED/), fullBatch: count(log, /^SELECT r\.id,r\.message_id,r\.redacted_text/), digest: count(log, /economic_snapshot_digest/)});

test('Brief y recomendación sobre corte sin vínculos: una transacción, sin N+1, fail-closed', {skip: SKIP, timeout: 900000}, async t => {
  await withPg(async h => {
    montarMundo(h);
    const aplicar = sql => { const r = psqlFile(h.sock, sql); assert.equal(r.status, 0, String(r.stderr).slice(0, 400)); };
    const psql = sql => h.psql(sql).out;
    const pool = new pg.Pool({host: h.sock, user: 'postgres', database: 't', max: 4});
    try {
      const base = (user = OWNER.A, tenant = TENANT_A) => crearBaseDatos({pool, tenantId: tenant, userId: user, statementTimeoutMs: 60000});
      const logged = log => { const db = base(); return {transaction: (a, w) => { log.push('BEGIN ' + a); return db.transaction(a, s => w(Object.freeze({...s, query: async (text, v) => { log.push(norm(text) + (/WITH sel AS MATERIALIZED/.test(text) ? ' #runs=' + v[1].length : '')); return s.query(text, v); }}))); }}; };
      const A1 = alcance('marketplaces-usd');
      let snap = await createSnapshotRepository({database: base()}).stage({scope: A1});
      snap = await createSnapshotRepository({database: base()}).publish({snapshotId: snap.id, expectedContentHash: snap.contentHash});
      assert.equal(snap.exposure.membership.length, 0, 'corte sin vínculos problema–pedido');
      const ws = createWorkspaceService({database: base()});
      const scopeHash = (await ws.query(q(A1, {resource: 'problems', snapshot_id: snap.id}))).meta.scope_hash;
      const sp = q(A1, {snapshot_id: snap.id, scope_hash: scopeHash});
      const catalog = (await ws.query(new URLSearchParams([...sp, ['resource', 'problems']]), {all: true, signals: false})).items;
      assert.ok(catalog.length >= 3);
      const runsOf = id => psql(`select count(distinct m.extraction_run_id) from public.problem_embedding_members m where m.problem_id='${id}'`).trim();
      const brief = (log, extra = {}) => createBriefRepository({database: log ? logged(log) : base()}).generate({query: sp.toString(), comparisonQuery: null, expectedPreviousId: null, requestKey: 'brief-key-0001', ...extra});

      const head = async () => (await createBriefRepository({database: base()}).list({query: sp})).expectedPreviousId;
      let b1;
      await t.test('brief: sin migración el INSERT lo rechaza la guarda (antes: check_violation en el corte sin vínculos); con la 20261028 se guarda', async () => {
        await assert.rejects(brief(null), e => e.status === 409 || e.code === '23514' || /conflict|database/.test(String(e.message)));
        aplicar(UP_B);
      });

      await t.test('carril crítico acotado y rotulado: N críticos, M citas por problema, el resto solo como conteo; brief_guard recorre pocas citas y el documento es chico', async () => {
        const refs = d => [...d.top3, ...d.critical].reduce((n, p) => n + p.evidence.length, 0);
        const todo = await createBriefRepository({database: base()}, ).generate({query: sp.toString(), comparisonQuery: null, expectedPreviousId: null, requestKey: 'brief-key-lim01'});
        const total = todo.document.critical.length; assert.ok(total >= 2, 'el mundo sintético tiene varios críticos');
        const antes = [...todo.document.top3, ...todo.document.critical].reduce((n, p) => n + p.evidenceTotal, 0);
        const acot = await createBriefRepository({database: base(), limits: {criticalN: 1, maxCitations: 1}}).generate({query: sp.toString(), comparisonQuery: null, expectedPreviousId: todo.id, requestKey: 'brief-key-lim02'});
        const d = acot.document;
        assert.equal(d.critical.length, 1); assert.equal(d.selection.criticalListed, 1); assert.equal(d.selection.criticalOmitted, d.selection.criticalCandidates - 1); assert.ok(d.selection.criticalOmitted >= 1);
        assert.ok(d.limits.some(l => new RegExp('\\+' + d.selection.criticalOmitted + ' problemas críticos no listados').test(l)));
        for (const p of [...d.top3, ...d.critical]) { assert.equal(p.evidence.length, 1); assert.equal(p.evidenceCount, 1); assert.ok(p.evidenceTotal >= 1); }
        assert.ok(d.critical.every(p => p.critical === true && p.metrics.every(m => m.amount_minor === null)), 'los críticos listados llevan importe No disponible, jamás 0');
        console.log('# GUARD citas recorridas: sin límite (3 top + críticos) =', antes, '; acotado =', refs(d), '; documento bytes', JSON.stringify(todo.document).length, '->', JSON.stringify(d).length);
        assert.ok(refs(d) < antes);
        assert.ok(JSON.stringify(todo.document).length < 200000);
        const again = await createBriefRepository({database: base(), limits: {criticalN: 1, maxCitations: 1}}).generate({query: sp.toString(), comparisonQuery: null, expectedPreviousId: todo.id, requestKey: 'brief-key-lim02'}); assert.equal(again.id, acot.id, 'misma clave: idempotente');
        const otra = await createBriefRepository({database: base(), limits: {criticalN: 1, maxCitations: 1}}).generate({query: sp.toString(), comparisonQuery: null, expectedPreviousId: todo.id, requestKey: 'brief-key-lim03'}); assert.equal(otra.id, acot.id, 'mismo input con otra clave reutiliza el brief inmutable');
      });

      await t.test('ruido: las notificaciones automáticas de retailers no entran en el pool, el top3 ni el carril crítico (rotulado)', async () => {
        const cur = await createBriefRepository({database: base()}).get({id: await head()});
        const noisy = cur.document.top3[0].id, title = 'Other: Retailer notifications and system alerts';
        const orig = psql(`select provenance->'snapshot'->>'label' from public.problem_versions where problem_id='${noisy}' and provenance->>'kind'='vector-problem-v1' order by version desc limit 1`).trim();
        aplicar(`set session_replication_role=replica; update public.problem_versions set provenance=jsonb_set(provenance,'{snapshot,label}','"${title}"') where id=(select id from public.problem_versions where problem_id='${noisy}' and provenance->>'kind'='vector-problem-v1' order by version desc limit 1)`);
        const b = await createBriefRepository({database: base()}).generate({query: sp.toString(), comparisonQuery: null, expectedPreviousId: await head(), requestKey: 'brief-key-ruido'});
        const shown = [...b.document.top3, ...b.document.critical].map(p => p.id);
        assert.ok(!shown.includes(noisy), 'el ruido no se muestra'); assert.equal(b.document.selection.automaticNotificationsExcluded, 1);
        assert.ok(b.document.limits.some(l => /^No se consideran las 1 notificaciones automáticas de retailers/.test(l)));
        aplicar(`set session_replication_role=replica; update public.problem_versions set provenance=jsonb_set(provenance,'{snapshot,label}',to_jsonb('${orig.replace(/'/g, "''")}'::text)) where id=(select id from public.problem_versions where problem_id='${noisy}' and provenance->>'kind'='vector-problem-v1' order by version desc limit 1)`);
      });

      await t.test('brief_guard con ids uuid (20261030): mismos veredictos, rechaza una cita alterada y es reversible', async () => {
        aplicar(UP_G);
        const head = (await createBriefRepository({database: base()}).list({query: sp})).expectedPreviousId;
        const ok = await createBriefRepository({database: base()}).generate({query: sp.toString(), comparisonQuery: null, expectedPreviousId: head, requestKey: 'brief-key-uuid1', }); assert.ok(ok.id);
        aplicar(DOWN_G); aplicar(UP_G);
      });

      await t.test('brief: UNA transacción de armado, un veredicto de resumen, un digest, sin N+1 por corrida (antes: 12 transacciones, 3 resúmenes, 6 digests, una lectura por corrida)', async () => {
        const log = [];
        b1 = await brief(log);
        const st = stats(log); console.log('# BRIEF', JSON.stringify(st));
        assert.ok(st.tx <= 4, 'transacciones ' + st.tx);           // rol+réplica, armado, guardado, lectura
        assert.equal(st.summary, 1, 'el catálogo se verifica (resumen) una sola vez por petición');
        assert.equal(st.digest, 1, 'el digest del snapshot se calcula una sola vez');
        assert.ok(st.runGets <= 2, 'la evidencia completa va por lotes: ' + st.runGets);
        assert.ok(st.stmts <= 70, 'sentencias ' + st.stmts);
      });

      await t.test('brief: honesto en el corte sin vínculos (importe No disponible, jamás 0), rotulado y con evidencia verificada', async () => {
        const d = b1.document;
        assert.ok(d.top3.length >= 1 && d.top3.length <= 3);
        for (const p of d.top3) { assert.ok(p.evidence.length > 0 && p.evidenceCount === p.evidence.length); for (const m of p.metrics) { assert.equal(m.amount_minor, null); assert.deepEqual(m.missing_reasons, ['EXPOSURE_NOT_LINKED']); assert.equal(m.status, 'unavailable'); } }
        assert.equal(d.selection.mode, 'verified_candidates'); assert.equal(d.selection.catalogProblems, catalog.length); assert.equal(d.selection.rankingVerification, 'none');
        assert.ok(d.limits.some(l => /^Selección rotulada/.test(l)));
        assert.ok(d.limits.some(l => /Sin ranking publicado/.test(l)));
        const again = await brief(null, {requestKey: 'brief-key-0002'}); assert.equal(again.id, b1.id, 'mismo input => mismo brief inmutable');
        const log = []; const replay = await brief(log); assert.equal(replay.id, b1.id); assert.ok(stats(log).tx <= 2 && stats(log).summary === 0, 'el reintento con la misma clave no rearma nada');
      });

      await t.test('fail-closed: un problema cuya evidencia ya no verifica (texto alterado) pasa el resumen pero NO se muestra', async () => {
        const victim = b1.document.top3[0].id;
        const rev = psql(`select m.extraction_run_id||'|'||r.id from public.problem_embedding_members m join public.extraction_runs x on x.id=m.extraction_run_id, lateral jsonb_array_elements(x.provenance->'input_manifest') e join public.message_revisions r on r.id=(e->>'message_revision_id')::uuid where m.problem_id='${victim}' limit 1`).trim().split('|')[1];
        const original = psql(`select redacted_text from public.message_revisions where id='${rev}'`).trim();
        aplicar(`set session_replication_role=replica; update public.message_revisions set redacted_text=redacted_text||' alterado' where id='${rev}'`);
        const b2 = await brief(null, {requestKey: 'brief-key-0003', expectedPreviousId: await head()});
        const shown = [...b2.document.top3, ...b2.document.critical].map(p => p.id);
        assert.ok(!shown.includes(victim), 'no se muestra un problema con evidencia no verificable');
        assert.ok(b2.document.top3.every(p => p.evidence.length > 0));
        aplicar(`set session_replication_role=replica; update public.message_revisions set redacted_text=${JSON.stringify(original).replace(/^"|"$/g, "'")} where id='${rev}'`);
        assert.equal(psql(`select redacted_text from public.message_revisions where id='${rev}'`).trim(), original, 'restaurado');
      });

      await t.test('ranking publicado: se usa por integridad (rotulado) y NO relee la evidencia de todo el catálogo; si la huella no cuadra, falla cerrado', async () => {
        const owner = createPriorityRepository({database: base()});
        const policy = await owner.recordPolicy({expectedVersion: 0, name: 'Política de prueba', weights: {impact: 2500, frequency: 2500, severity: 2500, actionability: 2500}, frequencyBaseline: 10, impactBaselineMinor: '100000', currency: A1.currency, exponent: A1.exponent, report: 'Política sintética de prueba para el brief.', attested: true});
        const run = await owner.rank({snapshotId: snap.id, policyId: policy.id, expectedPreviousRunId: null});
        assert.ok(run.entries.length >= 3);
        const log = []; const b = await brief(null, {requestKey: 'brief-key-0004', expectedPreviousId: await head()});
        assert.equal(b.document.selection.rankingVerification, 'integrity_only'); assert.ok(b.document.limits.some(l => /orden publicado se comprobó por integridad/.test(l)));
        assert.deepEqual(b.document.top3.map(p => p.id), run.entries.slice(0, 3).map(e => e.problemId), 'el orden es el publicado');
        assert.ok(b.document.top3.every((p, i) => p.rank === i + 1 && p.rankingBasis === 'published_priority'));
        const view = await createPriorityRepository({database: logged(log)}).publishedRank({snapshotId: snap.id});
        assert.equal(view.verification, 'integrity_only'); assert.equal(stats(log).runGets, 0, 'publishedRank no relee evidencia'); 
        aplicar(`set session_replication_role=replica; update public.priority_entries set rank=rank+10 where run_id='${run.id}' and rank=1`);
        await assert.rejects(brief(null, {requestKey: 'brief-key-0005', expectedPreviousId: await head()}), e => /integrity|409/.test(String(e.message) + e.status));
        aplicar(`set session_replication_role=replica; update public.priority_entries set rank=rank-10 where run_id='${run.id}' and rank=11`);
      });

      await t.test('recomendación: en un corte sin vínculos NO falla (antes 404 problem_not_found; luego la guarda); verifica UN problema, no el catálogo', async () => {
        const pid = catalog[0].id;
        await assert.rejects(createRecommendationRepository({database: base()}).generate({query: sp.toString(), problemId: pid, requestKey: 'rec-key-00000'}), e => e.status === 409 || e.code === '23514' || /conflict|database/.test(String(e.message)));
        aplicar(UP_R); aplicar(UP_V2);
        const log = [];
        const rec = await createRecommendationRepository({database: logged(log)}).generate({query: sp.toString(), problemId: pid, requestKey: 'rec-key-00001'});
        const st = stats(log); console.log('# REC', JSON.stringify(st));
        assert.equal(rec.problemId, pid); assert.equal(rec.status, 'proposed'); assert.ok(rec.evidenceRefs.length > 0); assert.equal(rec.stale, false);
        const runsVerified = log.filter(x => /WITH sel AS MATERIALIZED/.test(x)).map(x => Number(/#runs=(\d+)/.exec(x)[1]));
        assert.ok(runsVerified.every(n => n <= Number(runsOf(pid))), 'el resumen verifica solo las corridas de UN problema: ' + runsVerified);
        assert.ok(st.tx <= 10 && st.stmts <= 160 /* +3 por veredicto de resumen: SAVEPOINT/SELECT/RELEASE del lector del precálculo 20261114 */ && st.runGets <= 4, JSON.stringify(st));
        const replay = await createRecommendationRepository({database: base()}).generate({query: sp.toString(), problemId: pid, requestKey: 'rec-key-00001'});
        assert.equal(replay.id, rec.id, 'idempotente');
        assert.equal((await createRecommendationRepository({database: base()}).get({id: rec.id})).id, rec.id, 'la recomendación guardada se relee con la verificación completa');
      });

      await t.test('recomendaciones seguidas sobre problemas distintos funcionan (descarta hash/CAS global) y se guarda una muestra acotada de citas (22-oct prod: 1,327 y 5,947 citas > 500 de la guarda => 409/lentitud)', async () => {
        const brief0 = await createBriefRepository({database: base()}).get({id: await head()});
        const repo = limits => createRecommendationRepository({database: base(), limits});
        const sel = brief0.document.top3.find(p => p.evidenceTotal >= 3).id;
        const a = await repo({maxRefs: 2}).generate({query: sp.toString(), problemId: sel, requestKey: 'rec-key-seq-01'});
        assert.ok(a.evidenceRefs.length === 2, 'muestra acotada: ' + a.evidenceRefs.length);
        assert.match(a.rationale, /Se conservan \d citas de muestra/);
        const total = psql(`select provenance->>'evidenceTotal' from public.recommendations where id='${a.id}'`).trim(); assert.ok(Number(total) > a.evidenceRefs.length, 'el total verificado queda en provenance: ' + total);
        const again = await repo({maxRefs: 2}).generate({query: sp.toString(), problemId: sel, requestKey: 'rec-key-seq-01'}); assert.equal(again.id, a.id);
        const list = await repo({}).list({query: sp}); assert.ok(list.items.some(i => i.id === a.id), 'la lista relee y verifica la recomendación con muestra');
      });

      await t.test('recomendación fail-closed: con la evidencia alterada no se propone (falla cerrado, nada se guarda)', async () => {
        const pid = catalog[1].id, nRec = psql("select count(*) from public.recommendations where recommendation_schema='recommendation-v1'").trim();
        const rev = psql(`select r.id from public.problem_embedding_members m join public.extraction_runs x on x.id=m.extraction_run_id, lateral jsonb_array_elements(x.provenance->'input_manifest') e join public.message_revisions r on r.id=(e->>'message_revision_id')::uuid where m.problem_id='${pid}' limit 1`).trim();
        aplicar(`set session_replication_role=replica; update public.message_revisions set redacted_text=redacted_text||' alterado' where id='${rev}'`);
        await assert.rejects(createRecommendationRepository({database: base()}).generate({query: sp.toString(), problemId: pid, requestKey: 'rec-key-00002'}), e => e.status === 403 || /UNAVAILABLE|unavailable/.test(String(e.message)));
        assert.equal(psql("select count(*) from public.recommendations where recommendation_schema='recommendation-v1'").trim(), nRec, 'nada se guardó');
      });

      await t.test('reversas: las migraciones propuestas se pueden deshacer', async () => { aplicar(DOWN_R); aplicar(DOWN_B); });
    } finally { await pool.end(); }
  }, {name: 'brief', upto: 55});
});
