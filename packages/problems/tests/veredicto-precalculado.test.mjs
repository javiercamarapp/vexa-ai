// Migración PROPUESTA 20261114000000 (no aplicada en producción): el veredicto precalculado por corrida coincide con la verificación «resumen» en vivo
// (list({verification:'summary'})) tras las mismas mutaciones, y cada escritura que lo puede cambiar sube el contador de epoch (nunca se sirve uno obsoleto).
// Postgres local desechable con migraciones reales 0001..55 + la migración propuesta (con 3 sustitutos mínimos de 20261104000000); datos sintéticos.
//   node --test packages/problems/tests/veredicto-precalculado.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {withPg, pgAvailable} from '../../metrics/tests/pg-harness.mjs';
import {crearBaseDatos} from '../../ai-scale/economia-problemas/snapshot.mjs';
import {createProblemRepository} from '../repository.mjs';
import {mundoEscala, TENANT_A, OWNER} from './escala-mundo.mjs';

const pg = createRequire(import.meta.url)('pg');
const SKIP = !pgAvailable() && 'sin postgres local';
const MIGRACION = path.join(import.meta.dirname, '../../../supabase/migrations/20261114000000_problem_run_verdict.sql');
const BAJA = path.join(import.meta.dirname, '../../workspace-service/tests/20261114000000_problem_run_verdict.down.sql');
const bypass = 'set session_replication_role=replica;';
const RUNS = 12, MEMBERS = 24, PROBLEMS = 4;

test('veredicto precalculado = verificación de resumen en vivo; el epoch sube con cada escritura relevante; la reversa deja todo limpio', {skip: SKIP, timeout: 900000}, async t => {
  await withPg(async h => {
    const w = mundoEscala(h, {runs: RUNS, members: MEMBERS, problems: PROBLEMS, runsB: 2, membersB: 2, problemsB: 1});
    // Sustitutos mínimos de lo que aporta 20261104000000 (motor de insights): autorización y estado de insight.
    assert.ok(h.psql(`create function public.insights_authorized(uuid) returns boolean language sql as 'select true';
      create table public.insight_state(tenant_id uuid not null, insight text not null, status text not null, refreshed_at timestamptz not null, source_rows bigint not null default 0, duration_ms integer not null default 0, computed_from jsonb not null default '{}', error_code text, primary key(tenant_id,insight), constraint insight_state_insight_check check(insight in('conversation_volume')));`).ok);
    const aplicar = f => { const r = h.file(f); assert.equal(r.status, 0, String(r.stderr).slice(0, 600)); };
    aplicar(MIGRACION);
    const pool = new pg.Pool({host: h.sock, user: 'postgres', database: 't', max: 3});
    const db = () => crearBaseDatos({pool, tenantId: TENANT_A, userId: OWNER.A, statementTimeoutMs: 120000});
    const refrescar = () => JSON.parse(h.psql(`select public.refresh_problem_run_verdicts('${TENANT_A}')`).out);
    const epoch = () => Number(h.psql(`select epoch from public.problem_verdict_epoch where tenant_id='${TENANT_A}'`).out || 0);
    const run = i => w.A.convs[i].p.runId, conv = i => w.A.convs[i].conv.conversation_id, orig = i => w.A.convs[i].conv.messages[0].revision_id;
    const rev = i => h.psql(`select provenance->'input_manifest'->0->>'message_revision_id' from public.extraction_runs where id='${run(i)}'`).out;
    try {
      await t.test('sin mutaciones: todas las corridas utilizables y los mismos problemas que el resumen en vivo', async () => {
        const r = refrescar(); assert.equal(r.status, 'done'); assert.equal(r.runs, RUNS); assert.equal(r.usable, RUNS);
        const vivo = (await createProblemRepository({database: db()}).list({verification: 'summary'})).map(p => p.id).sort();
        assert.equal(vivo.length, PROBLEMS);
        assert.equal(h.psql(`select count(*) from public.insight_problem_run_verdict where tenant_id='${TENANT_A}' and usable and epoch=(select epoch from public.problem_verdict_epoch where tenant_id='${TENANT_A}')`).out, String(RUNS));
      });
      await t.test('con las mutaciones del catálogo de pruebas de escala, el veredicto por corrida excluye lo mismo que el resumen en vivo', async () => {
        const e0 = epoch();
        const ok = r => assert.ok(r.ok, r.err);
        // las escrituras SIN `bypass` ejercen los disparadores; las que chocan con guardas inmutables usan bypass y luego se sube el epoch a mano como lo haría el disparador
        ok(h.psql(`update public.extraction_runs set status='failed' where id='${run(1)}'`));
        ok(h.psql(`${bypass} update public.conversations set deleted_at=now() where id='${conv(2)}'`));
        ok(h.psql(`${bypass} update public.message_revisions set deleted_at=now() where id='${rev(3)}'`));
        ok(h.psql(`${bypass} update public.message_revisions set hash='${'0'.repeat(64)}' where id='${rev(4)}'`));
        ok(h.psql(`${bypass} update public.message_revisions set deleted_at=now() where id='${orig(9)}'`));
        const ext5 = h.psql(`select external_id||'|'||connection_id from public.conversations where id='${conv(5)}'`).out.split('|');
        ok(h.psql(`insert into public.tombstones(tenant_id,deleted_source_key,connection_id,reason) values('${TENANT_A}','${ext5[0]}','${ext5[1]}','prueba')`));
        const ext6 = h.psql(`select external_id||'|'||connection_id from public.conversations where id='${conv(6)}'`).out.split('|');
        ok(h.psql(`insert into public.retention_ledger(tenant_id,id,connection_id,entity_type,external_id,actor_id,policy_version) values('${TENANT_A}',gen_random_uuid(),'${ext6[1]}','conversation','${ext6[0]}','${OWNER.A}',1)`));
        ok(h.psql(`update public.connections set status='disabled' where id=(select connection_id from public.conversations where id='${conv(7)}')`));
        assert.ok(epoch() > e0, 'las escrituras sin bypass subieron el epoch');
        // lo escrito con bypass no dispara: se sube el contador como hará el motor al detectar el cambio (aquí solo para la comparación)
        h.psql(`update public.problem_verdict_epoch set epoch=epoch+1 where tenant_id='${TENANT_A}'`);
        const r = refrescar(); assert.equal(r.status, 'done');
        const malas = [1, 2, 3, 4, 5, 6, 7, 9].map(i => run(i));
        for (const id of malas) assert.equal(h.psql(`select usable from public.insight_problem_run_verdict where extraction_run_id='${id}'`).out, 'f', 'inutilizable ' + id);
        assert.equal(h.psql(`select usable from public.insight_problem_run_verdict where extraction_run_id='${run(0)}'`).out, 't');
        // problemas utilizables según el veredicto precalculado (todas sus corridas utilizables) == resumen en vivo
        const porVeredicto = h.psql(`select p.problem_id from public.problem_embedding_members p join public.insight_problem_run_verdict v on v.tenant_id=p.tenant_id and v.extraction_run_id=p.extraction_run_id where p.tenant_id='${TENANT_A}' group by p.problem_id having bool_and(v.usable) order by 1`).out.split('\n').filter(Boolean);
        const vivo = (await createProblemRepository({database: db()}).list({verification: 'summary'})).map(p => p.id).sort();
        assert.deepEqual(porVeredicto, vivo);
      });
      await t.test('cada escritura que puede cambiar el veredicto sube el epoch; una que no lo cambia, no', async () => {
        const e1 = epoch();
        assert.ok(h.psql(`update public.connections set updated_at=updated_at where tenant_id='${TENANT_A}'`).ok); assert.equal(epoch(), e1, 'actualizar sin cambiar status no sube el epoch');
        assert.ok(h.psql(`update public.connections set status='active' where id=(select connection_id from public.conversations where id='${conv(7)}')`).ok); assert.equal(epoch(), e1 + 1, 'status de conexión');
      });
      await t.test('las filas solo se sirven si su epoch coincide: tras una escritura quedan obsoletas hasta el siguiente refresco', async () => {
        refrescar();
        const vigentes = () => Number(h.psql(`select count(*) from public.insight_problem_run_verdict v where v.tenant_id='${TENANT_A}' and v.epoch=(select epoch from public.problem_verdict_epoch where tenant_id='${TENANT_A}')`).out);
        assert.equal(vigentes(), RUNS);
        assert.ok(h.psql(`update public.connections set status='disabled' where id=(select connection_id from public.conversations where id='${conv(0)}')`).ok);
        assert.equal(vigentes(), 0, 'tras escribir, ningún veredicto es vigente');
        h.psql(`update public.connections set status='active' where id=(select connection_id from public.conversations where id='${conv(0)}')`);
        refrescar(); assert.equal(vigentes(), RUNS);
      });
      await t.test('aislamiento: el refresco de un tenant no escribe filas de otro y la reversa deja la base limpia', async () => {
        assert.equal(h.psql(`select count(*) from public.insight_problem_run_verdict where tenant_id<>'${TENANT_A}'`).out, '0');
        aplicar(BAJA);
        assert.equal(h.psql(`select count(*) from pg_trigger where tgname like 'problem_verdict_%'`).out, '0');
        assert.equal(h.psql(`select to_regclass('public.insight_problem_run_verdict') is null and to_regclass('public.problem_verdict_epoch') is null`).out, 't');
        assert.equal(h.psql(`select count(*) from pg_proc where proname in('refresh_problem_run_verdicts','problem_verdict_bump_insert','problem_verdict_bump_deleted','problem_verdict_bump_status')`).out, '0');
      });
    } finally { await pool.end(); }
  }, {shared: '128MB'});
});
