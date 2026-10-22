// Equivalencia de la verificación de evidencia por lote (getMany) con la lectura por corrida (get), y de problemStates (vía readExposure) con el cálculo en serie.
// Postgres local desechable con las migraciones REALES; datos sintéticos.
//   node --test packages/metrics/tests/evidencia-lote.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {withPg, pgAvailable} from './pg-harness.mjs';
import {medida} from './world.mjs';
import {montarMundo, TENANT_A, TENANT_B, OWNER, U} from '../../ai-scale/economia-problemas/mundo.mjs';
import {crearBaseDatos, alcance} from '../../ai-scale/economia-problemas/snapshot.mjs';
import {createEvidenceRepository} from '../../intelligence/evidence-repository.mjs';
import {readExposure} from '../exposure.mjs';

const pg = createRequire(import.meta.url)('pg');
const SKIP = !pgAvailable() && 'sin postgres local';
const NO = '5f5f5f5f-5f5f-4f5f-8f5f-5f5f5f5f5f5f';
const bypass = 'set session_replication_role=replica;';

// Veredicto de get(): evidencia o motivo de rechazo (los errores que get propaga también cuentan como rechazo distinto).
const viaGet = async (repo, id) => { try { return {ok: true, v: await repo.get(id)}; } catch (e) { return {ok: false, why: e.message}; } };

test('getMany == get una por una: válidas, lápida, retención, revisión borrada, hash distinto, estado, otro tenant, inexistentes', {skip: SKIP, timeout: 900000}, async () => {
  await withPg(async h => {
    const {psql, sock} = h;
    montarMundo(h);
    const ok = r => { assert.ok(r.ok, r.err); return r; };
    const pool = new pg.Pool({host: sock, user: 'postgres', database: 't', max: 4});
    try {
      const dbA = crearBaseDatos({pool, tenantId: TENANT_A, userId: OWNER.A, statementTimeoutMs: 60000});
      const dbB = crearBaseDatos({pool, tenantId: TENANT_B, userId: OWNER.B, statementTimeoutMs: 60000});
      const runsA = psql(`select id from public.extraction_runs where tenant_id='${TENANT_A}' order by id`).out.split('\n').filter(Boolean);
      const runsB = psql(`select id from public.extraction_runs where tenant_id='${TENANT_B}' order by id`).out.split('\n').filter(Boolean);
      assert.ok(runsA.length >= 8, 'mundo con suficientes corridas: ' + runsA.length); assert.ok(runsB.length >= 1);
      const meta = id => psql(`select r.conversation_id||'|'||c.external_id||'|'||c.connection_id from public.extraction_runs r join public.conversations c on c.tenant_id=r.tenant_id and c.id=r.conversation_id where r.id='${id}'`).out.split('|');
      const revOf = id => psql(`select (provenance->'input_manifest'->0->>'message_revision_id') from public.extraction_runs where id='${id}'`).out;
      const [r0, r1, r2, r3, r4, r5, r6, r7] = runsA;
      // copia de r0 con otro id para el caso «sin manifiesto»
      const r8 = U(8800);
      ok(psql(`${bypass} insert into public.extraction_runs select (jsonb_populate_record(null::public.extraction_runs, to_jsonb(e)||jsonb_build_object('id','${r8}'))).* from public.extraction_runs e where e.id='${r0}'`));
      runsA.push(r8);
      // 0 intacta | 1 estado failed | 2 conversación borrada | 3 texto alterado (hash distinto) | 4 revisión borrada | 5 lápida | 6 retención | 7 input_hash distinto | 8 sin manifiesto
      ok(psql(`${bypass} update public.extraction_runs set status='failed' where id='${r1}'`));
      ok(psql(`${bypass} update public.conversations set deleted_at=now() where id=(select conversation_id from public.extraction_runs where id='${r2}')`));
      ok(psql(`${bypass} update public.message_revisions set redacted_text=redacted_text||' alterado' where id='${revOf(r3)}'`));
      ok(psql(`${bypass} update public.message_revisions set deleted_at=now() where id='${revOf(r4)}'`));
      const m5 = meta(r5); ok(psql(`${bypass} insert into public.tombstones(tenant_id,deleted_source_key,connection_id,reason) values('${TENANT_A}','${revOf(r5)}','${m5[2]}','prueba')`));
      const m6 = meta(r6); ok(psql(`${bypass} insert into public.retention_ledger(tenant_id,id,connection_id,entity_type,external_id,actor_id,policy_version) values('${TENANT_A}',gen_random_uuid(),'${m6[2]}','conversation','${m6[1]}','${OWNER.A}',1)`));
      ok(psql(`${bypass} update public.extraction_runs set input_hash='${'0'.repeat(64)}' where id='${r7}'`));
      ok(psql(`${bypass} update public.extraction_runs set provenance=provenance-'input_manifest' where id='${r8}'`));

      const ids = [...runsA, runsB[0], NO, 'no-es-uuid', runsA[0].toUpperCase(), runsA[0]];
      const one = dbA.transaction('read', async s => { const repo = createEvidenceRepository({database: {transaction: (_a, fn) => fn(s)}}); const out = []; for (const id of ids) out.push(await viaGet(repo, id)); return out; });
      const many = dbA.transaction('read', async s => createEvidenceRepository({database: {transaction: (_a, fn) => fn(s)}}).getMany(ids));
      const [serial, batch] = [await one, await many];
      ids.forEach((id, i) => {
        const b = batch.get(id);
        if (serial[i].ok) assert.deepEqual(b, serial[i].v, 'misma evidencia para ' + id); else assert.equal(b, null, `rechazo en get (${serial[i].why}) => null en getMany para ${id}`);
      });
      // la prueba no es vacía: hay válidas y rechazadas
      const valid = ids.filter((_, i) => serial[i].ok); assert.ok(valid.length >= 3, 'válidas: ' + valid.length);
      for (const id of [r1, r2, r3, r4, r5, r6, r7, r8, runsB[0], NO, 'no-es-uuid']) assert.equal(batch.get(id), null, 'debe rechazarse ' + id);
      assert.notEqual(batch.get(r0), null);
      // la corrida sin manifiesto: get propaga TypeError (provenance sin input_manifest => fail) o rechaza; en ambos casos getMany la rechaza
      // otro tenant: las corridas de A bajo la sesión de B (y al revés) se rechazan por lote igual que una a una
      const cross = await dbB.transaction('read', async s => { const repo = createEvidenceRepository({database: {transaction: (_a, fn) => fn(s)}}); const m = await repo.getMany([...runsA, runsB[0]]); const g = []; for (const id of [...runsA, runsB[0]]) g.push((await viaGet(repo, id)).ok); return {m, g}; });
      [...runsA, runsB[0]].forEach((id, i) => assert.equal(cross.m.get(id) !== null, cross.g[i], 'tenant B: ' + id));
      assert.equal(cross.m.get(runsB[0]) !== null, true); for (const id of runsA) assert.equal(cross.m.get(id), null);
      // lotes grandes: más de 100 ids (parte en varios lotes) dan el mismo veredicto
      const many150 = Array.from({length: 150}, (_, i) => i < runsA.length ? runsA[i] : U(7000 + i));
      const big = await dbA.transaction('read', async s => createEvidenceRepository({database: {transaction: (_a, fn) => fn(s)}}).getMany(many150));
      for (const id of runsA) assert.equal(big.get(id) === null, batch.get(id) === null);
    } finally { await pool.end(); }
  });
});

test('problemStates (vía readExposure): mismas banderas valid que el cálculo en serie con get; las consultas de evidencia no crecen con las corridas', {skip: SKIP, timeout: 900000}, async () => {
  await withPg(async h => {
    const {psql, sock} = h;
    montarMundo(h);
    const pool = new pg.Pool({host: sock, user: 'postgres', database: 't', max: 4});
    try {
      const mk = () => crearBaseDatos({pool, tenantId: TENANT_A, userId: OWNER.A, statementTimeoutMs: 120000});
      const A1 = alcance('marketplaces-usd');
      // oráculo: el cálculo original (por embedding, get una por una; válido solo si TODAS las corridas son utilizables)
      const oracle = async () => mk().transaction('read', async s => {
        const repo = createEvidenceRepository({database: {transaction: (_a, fn) => fn(s)}});
        const ps = (await s.query("SELECT DISTINCT ON(problem_id) * FROM public.problem_versions WHERE tenant_id=$1 AND provenance->>'kind'='vector-problem-v1' ORDER BY problem_id,version DESC", [s.tenantId])).rows;
        const out = new Map();
        for (const p of ps) {
          const snap = p.provenance?.snapshot; let valid = !!(snap && snap.state === 'active' && Array.isArray(snap.embeddingIds) && snap.embeddingIds.length);
          if (valid) for (const id of snap.embeddingIds) {
            const m = (await s.query('SELECT extraction_run_id FROM public.problem_embedding_members WHERE tenant_id=$1 AND embedding_id=$2 AND problem_id=$3', [s.tenantId, id, p.problem_id])).rows[0];
            if (!m) { valid = false; break; }
            const e = await repo.get(m.extraction_run_id).catch(err => { if (err.message === 'EVIDENCE_UNAVAILABLE') return null; throw err; });
            if (!e || e.state !== 'current' || e.status !== 'succeeded') { valid = false; break; }
          }
          out.set(p.problem_id, valid);
        }
        return out;
      });
      const actual = async () => { const m = medida(mk()); const v = await m.db.transaction('read', s => readExposure(s, {scope: A1})); return {ids: new Set(v.problemOptions.map(p => p.id)), m}; };
      const runs = +psql(`select count(*) from public.extraction_runs where tenant_id='${TENANT_A}'`).out;
      let o = await oracle(), a = await actual();
      assert.ok(o.size >= 3 && [...o.values()].every(Boolean), 'todos los problemas son válidos al inicio');
      assert.deepEqual([...a.ids].sort(), [...o.keys()].sort());
      const evidenceQueries = log => log.filter(x => /FROM public\.extraction_runs/.test(x.text ?? x.sql ?? '')).length;
      const q1 = a.m.log.length;
      // una extracción deja de estar vigente: el problema correspondiente pasa a inválido en ambos cálculos
      assert.ok(psql(`update public.extraction_runs set status='failed' where tenant_id='${TENANT_A}' and id=(select extraction_run_id from public.problem_embedding_members where tenant_id='${TENANT_A}' limit 1)`).ok);
      o = await oracle(); a = await actual();
      assert.ok([...o.values()].includes(false), 'al menos un problema inválido');
      assert.deepEqual([...a.ids].sort(), [...o.entries()].filter(([, v]) => v).map(([k]) => k).sort());
      assert.ok(a.m.log.length <= q1 + 2, `consultas no dependen del nº de corridas (${q1} vs ${a.m.log.length}, ${runs} corridas)`);
      const logText = a.m.log.map(x => JSON.stringify(x));
      assert.equal(logText.filter(t => /FROM public\.extraction_runs/.test(t)).length, 1, 'una sola consulta de corridas');
      assert.equal(logText.filter(t => /FROM public\.tombstones/.test(t)).length, 1, 'una sola consulta de lápidas');
      void evidenceQueries;
    } finally { await pool.end(); }
  });
});
