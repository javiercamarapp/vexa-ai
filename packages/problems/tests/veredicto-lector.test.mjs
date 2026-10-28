// Lector del veredicto precalculado (repository.mjs: usableRunsPrecalculado / veredictoVigente) y su integración con list({verification:'summary'}).
// Unitarias con sesión simulada + una prueba contra Postgres local desechable (migraciones reales + 20261114000000).
//   node --test packages/problems/tests/veredicto-lector.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {createRequire} from 'node:module';
import {withPg, pgAvailable} from '../../metrics/tests/pg-harness.mjs';
import {crearBaseDatos} from '../../ai-scale/economia-problemas/snapshot.mjs';
import {createProblemRepository, veredictoVigente, usableRunsPrecalculado} from '../repository.mjs';
import {mundoEscala, TENANT_A, OWNER} from './escala-mundo.mjs';

const pg = createRequire(import.meta.url)('pg');
const SKIP = !pgAvailable() && 'sin postgres local';
const MIGRACION = path.join(import.meta.dirname, '../../../supabase/migrations/20261114000000_problem_run_verdict.sql');
const A = 'aaaaaaaa-0000-4000-8000-000000000001', B = 'aaaaaaaa-0000-4000-8000-000000000002', C = 'aaaaaaaa-0000-4000-8000-000000000003';
const sesion = (respuesta) => { const log = []; return {log, tenantId: 't', query: async (q) => { log.push(q); if (/^SELECT v\./.test(q)) { if (respuesta instanceof Error) throw respuesta; return {rows: respuesta}; } return {rows: []}; }}; };

test('veredictoVigente: vigente -> Set de utilizables; falta una corrida -> null; vacío -> null', () => {
  assert.deepEqual([...veredictoVigente([A, B], [{extraction_run_id: A, usable: true}, {extraction_run_id: B, usable: false}])], [A]);
  assert.equal(veredictoVigente([A, B], [{extraction_run_id: A, usable: true}]), null, 'falta B: en vivo');
  assert.equal(veredictoVigente([A], []), null);
  assert.equal(veredictoVigente([], []), null);
  assert.deepEqual([...veredictoVigente([A.toUpperCase()], [{extraction_run_id: A, usable: true}])], [A], 'mayúsculas no cambian el veredicto');
  assert.equal(veredictoVigente([A], [{extraction_run_id: A, usable: null}]).size, 0, 'solo usable===true cuenta (fail-closed)');
});
test('usableRunsPrecalculado: vigente usa el precálculo dentro de un savepoint; vacío/desfasado (sin filas del epoch) -> null; error -> null y savepoint revertido', async () => {
  const ok = sesion([{extraction_run_id: A, usable: true}, {extraction_run_id: B, usable: true}]);
  assert.deepEqual([...await usableRunsPrecalculado(ok, [A, B])].sort(), [A, B]);
  assert.deepEqual(ok.log.map(q => q.split(' ')[0]), ['SAVEPOINT', 'SELECT', 'RELEASE']);
  assert.match(ok.log[1], /v\.epoch/, 'une con el epoch vigente del tenant');
  assert.equal(await usableRunsPrecalculado(sesion([]), [A, B]), null, 'tabla vacía o epoch desfasado: la consulta no devuelve filas');
  assert.equal(await usableRunsPrecalculado(sesion([{extraction_run_id: A, usable: true}]), [A, C]), null, 'una corrida sin fila: en vivo');
  const roto = sesion(Object.assign(new Error('relation "public.insight_problem_run_verdict" does not exist'), {code: '42P01'}));
  assert.equal(await usableRunsPrecalculado(roto, [A]), null);
  assert.deepEqual(roto.log.map(q => q.split(' ')[0]), ['SAVEPOINT', 'SELECT', 'ROLLBACK', 'RELEASE']);
  assert.equal(await usableRunsPrecalculado(sesion([]), []), null);
});

test('integración: list(summary) usa el precálculo vigente (sin la consulta agregada), cae a en vivo si el epoch está desfasado y da el mismo resultado', {skip: SKIP, timeout: 900000}, async () => {
  await withPg(async h => {
    const w = mundoEscala(h, {runs: 12, members: 24, problems: 4, runsB: 2, membersB: 2, problemsB: 1});
    assert.ok(h.psql(`create function public.insights_authorized(uuid) returns boolean language sql as 'select true';
      create table public.insight_state(tenant_id uuid not null, insight text not null, status text not null, refreshed_at timestamptz not null, source_rows bigint not null default 0, duration_ms integer not null default 0, computed_from jsonb not null default '{}', error_code text, primary key(tenant_id,insight), constraint insight_state_insight_check check(insight in('conversation_volume')));`).ok);
    const r = h.file(MIGRACION); assert.equal(r.status, 0, String(r.stderr).slice(0, 600));
    const pool = new pg.Pool({host: h.sock, user: 'postgres', database: 't', max: 3});
    const enVivo = {n: 0};
    const db = () => { const base = crearBaseDatos({pool, tenantId: TENANT_A, userId: OWNER.A, statementTimeoutMs: 120000});
      return {transaction: (a, work) => base.transaction(a, s => work(Object.create(s, {query: {value: (q, ...x) => { if (/WITH sel AS MATERIALIZED/.test(String(q))) enVivo.n++; return s.query(q, ...x); }}})))}; };
    const ids = async () => (await createProblemRepository({database: db()}).list({verification: 'summary'})).map(p => p.id).sort();
    try {
      // sin precálculo (tabla vacía): en vivo
      enVivo.n = 0; const vivo = await ids(); assert.equal(vivo.length, 4); assert.equal(enVivo.n, 1);
      // tras el refresco: precálculo, sin consulta agregada, mismo resultado
      assert.equal(JSON.parse(h.psql(`select public.refresh_problem_run_verdicts('${TENANT_A}')`).out).status, 'done');
      enVivo.n = 0; assert.deepEqual(await ids(), vivo); assert.equal(enVivo.n, 0, 'servido desde insight_problem_run_verdict');
      // una escritura que invalida (desactivar conexión) sube el epoch: se descarta el precálculo y el resultado refleja el cambio en vivo
      assert.ok(h.psql(`update public.connections set status='disabled' where id=(select connection_id from public.conversations where id='${w.A.convs[0].conv.conversation_id}')`).ok);
      enVivo.n = 0; const tras = await ids(); assert.equal(enVivo.n, 1, 'epoch desfasado: en vivo');
      assert.ok(tras.length < vivo.length, 'el problema con la corrida inutilizable ya no aparece');
    } finally { await pool.end(); }
  }, {shared: '128MB'});
});
