// F1-citas (29-oct): public.refresh_problem_conversations deriva los vinculos problema-conversacion-hallazgo de la membresia REAL de los problemas.
// Postgres LOCAL desechable con las migraciones reales 0001..0055 + la propuesta 20261206000500; mundo sintetico (ai-scale/economia-problemas/mundo.mjs: SYN*, sin datos de clientes).
//   node --test supabase/tests/problem-conversations-link.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {withPg, pgAvailable} from '../../packages/metrics/tests/pg-harness.mjs';
import {montarMundo, TENANT_A, TENANT_B} from '../../packages/ai-scale/economia-problemas/mundo.mjs';

const MIG = path.join(path.dirname(fileURLToPath(import.meta.url)), '../migrations/20261206000500_problem_conversations_link.sql');
const SKIP = !pgAvailable() && 'sin postgres local';
const run = (h, t, dry = false) => JSON.parse(h.psql(`select public.refresh_problem_conversations('${t}',${dry})`).out);
const n = (h, sql) => Number(h.psql(sql).out);
const ACT = `(select distinct on (v.problem_id) v.problem_id from public.problem_versions v where v.tenant_id='@T' and v.provenance->>'kind'='vector-problem-v1' and v.provenance->'snapshot'->>'state'='active' order by v.problem_id, v.version desc)`;

test('vinculos problema-conversacion: ensayo no escribe, la corrida real iguala la membresia, es idempotente y sigue los cambios sin borrar historia', {skip: SKIP, timeout: 900000}, async t => {
  await withPg(async h => {
    montarMundo(h);
    // ANTES: la tabla esta vacia y la funcion no existe (el defecto de produccion).
    assert.equal(n(h, 'select count(*) from public.problem_conversations'), 0);
    assert.equal(h.psql(`select to_regprocedure('public.refresh_problem_conversations(uuid,boolean)') is null`).out, 't');
    const r = h.file(MIG); assert.equal(r.status, 0, String(r.stderr));
    const esperado = tenant => n(h, `select count(*) from (select distinct m.problem_id, m.conversation_id from public.problem_embedding_members m join public.extraction_runs r on r.tenant_id=m.tenant_id and r.id=m.extraction_run_id and r.status='succeeded' join public.conversations c on c.tenant_id=m.tenant_id and c.id=m.conversation_id and c.deleted_at is null where m.tenant_id='${tenant}' and m.problem_id in ${ACT.replace('@T', tenant)}) x`);
    const A = esperado(TENANT_A), B = esperado(TENANT_B);
    assert.ok(A >= 8, 'el mundo trae conversaciones agrupadas en problemas vigentes (A=' + A + ')');

    await t.test('ensayo: informa lo que haria y no escribe nada', () => {
      const d = run(h, TENANT_A, true);
      assert.equal(d.dry_run, true); assert.equal(d.desired_links, A); assert.equal(d.inserted, A); assert.equal(d.closed, 0);
      assert.equal(n(h, 'select count(*) from public.problem_conversations'), 0);
    });

    await t.test('corrida real: una fila vigente por (problema vigente, conversacion), solo del tenant pedido, con procedencia', () => {
      const d = run(h, TENANT_A);
      assert.equal(d.inserted, A); assert.equal(d.unchanged, 0);
      assert.equal(n(h, `select count(*) from public.problem_conversations where tenant_id='${TENANT_A}' and valid_until is null`), A);
      assert.equal(n(h, `select count(*) from public.problem_conversations where tenant_id='${TENANT_B}'`), 0, 'no toca otro tenant');
      assert.equal(n(h, `select count(*) from public.problem_conversations where provenance->>'kind'<>'problem-link-v1' or provenance->>'source'<>'problem_embedding_members'`), 0);
      // cada vinculo existe en la membresia (nada inventado) y cada hallazgo vinculado tiene un evidence_span sobre un mensaje de la conversacion
      assert.equal(n(h, `select count(*) from public.problem_conversations l where not exists(select 1 from public.problem_embedding_members m where m.tenant_id=l.tenant_id and m.problem_id=l.problem_id and m.conversation_id=l.conversation_id)`), 0);
      assert.ok(d.with_issue > 0 && d.with_issue <= A, 'hay hallazgos vinculados (with_issue=' + d.with_issue + ')');
      assert.equal(n(h, `select count(*) from public.problem_conversations l where l.issue_id is not null and not exists(select 1 from public.issues i join public.extraction_runs r on r.tenant_id=i.tenant_id and r.id=i.extraction_run_id where i.tenant_id=l.tenant_id and i.id=l.issue_id and r.conversation_id=l.conversation_id)`), 0, 'el hallazgo es de esa conversacion');
      // la lectura de la ficha (problem-facts.mjs) funciona sobre el esquema real y suma lo mismo que la corrida
      const leido = h.psql(`select coalesce(sum(c),0)||'|'||coalesce(sum(w),0) from (select count(*)::int c, count(*) filter (where issue_id is not null)::int w from public.problem_conversations where tenant_id='${TENANT_A}' and valid_until is null group by problem_id) x`).out.split('|').map(Number);
      assert.deepEqual(leido, [A, d.with_issue]);
      assert.equal(d.with_order_on_conversation, 0, 'el pedido NO se vincula aqui: las conversaciones sinteticas no traen order_id');
    });

    await t.test('idempotente: repetir no inserta, no cierra, no duplica', () => {
      const d = run(h, TENANT_A);
      assert.equal(d.inserted, 0); assert.equal(d.closed, 0); assert.equal(d.unchanged, A);
      assert.equal(n(h, `select count(*) from public.problem_conversations where tenant_id='${TENANT_A}'`), A);
    });

    await t.test('otro tenant: su corrida solo crea los suyos', () => {
      const d = run(h, TENANT_B); assert.equal(d.inserted, B);
      assert.equal(n(h, `select count(*) from public.problem_conversations where tenant_id='${TENANT_B}' and valid_until is null`), B);
      assert.equal(n(h, `select count(*) from public.problem_conversations where tenant_id='${TENANT_A}' and valid_until is null`), A);
    });

    await t.test('reasignar una conversacion a otro problema: cierra el vinculo viejo (queda la historia) y abre el nuevo', () => {
      const m = h.psql(`select m.problem_id||'|'||m.conversation_id from public.problem_embedding_members m where m.tenant_id='${TENANT_A}' order by m.conversation_id limit 1`).out.split('|');
      const otro = h.psql(`select id from public.problems where tenant_id='${TENANT_A}' and id<>'${m[0]}' and archived_at is null limit 1`).out;
      // ¿otros miembros de esa conversacion en el problema de origen? (pueden ser varios embeddings)
      assert.ok(h.psql(`update public.problem_embedding_members set problem_id='${otro}' where tenant_id='${TENANT_A}' and problem_id='${m[0]}' and conversation_id='${m[1]}'`).ok);
      // el problema destino debe seguir vigente en problem_versions: ya lo es (mundo sintetico)
      const d = run(h, TENANT_A);
      assert.equal(d.closed, 1); assert.equal(d.inserted >= 1, true);
      assert.equal(n(h, `select count(*) from public.problem_conversations where tenant_id='${TENANT_A}' and problem_id='${m[0]}' and conversation_id='${m[1]}' and valid_until is not null`), 1, 'el viejo se cierra, no se borra');
      assert.equal(n(h, `select count(*) from public.problem_conversations where tenant_id='${TENANT_A}' and problem_id='${otro}' and conversation_id='${m[1]}' and valid_until is null`), 1);
      assert.equal(run(h, TENANT_A).inserted, 0, 'estable otra vez');
    });

    await t.test('un problema retirado (archivado) deja de tener vinculos vigentes; conversacion borrada o corrida fallida tampoco vincula', () => {
      const p = h.psql(`select problem_id from public.problem_conversations where tenant_id='${TENANT_A}' and valid_until is null group by 1 order by count(*) desc limit 1`).out;
      const antes = n(h, `select count(*) from public.problem_conversations where tenant_id='${TENANT_A}' and problem_id='${p}' and valid_until is null`);
      assert.ok(antes > 0);
      const hist = n(h, `select count(*) from public.problem_conversations where tenant_id='${TENANT_A}' and problem_id='${p}'`);
      assert.ok(h.psql(`update public.problems set archived_at=clock_timestamp() where tenant_id='${TENANT_A}' and id='${p}'`).ok);
      const d = run(h, TENANT_A);
      assert.equal(d.closed, antes);
      assert.equal(n(h, `select count(*) from public.problem_conversations where tenant_id='${TENANT_A}' and problem_id='${p}' and valid_until is null`), 0);
      assert.equal(n(h, `select count(*) from public.problem_conversations where tenant_id='${TENANT_A}' and problem_id='${p}'`), hist, 'la historia sigue');
      // conversacion borrada
      const c = h.psql(`select conversation_id from public.problem_conversations where tenant_id='${TENANT_A}' and valid_until is null limit 1`).out;
      const vivos = n(h, `select count(*) from public.problem_conversations where tenant_id='${TENANT_A}' and valid_until is null`);
      assert.ok(h.psql(`update public.conversations set deleted_at=clock_timestamp() where tenant_id='${TENANT_A}' and id='${c}'`).ok);
      const d2 = run(h, TENANT_A);
      assert.ok(d2.closed >= 1);
      assert.equal(n(h, `select count(*) from public.problem_conversations where tenant_id='${TENANT_A}' and conversation_id='${c}' and valid_until is null`), 0);
      assert.ok(n(h, `select count(*) from public.problem_conversations where tenant_id='${TENANT_A}' and valid_until is null`) < vivos);
      // corrida de extraccion que deja de ser 'succeeded' -> su conversacion deja de vincularse
      const c2 = h.psql(`select conversation_id||'|'||problem_id from public.problem_conversations where tenant_id='${TENANT_A}' and valid_until is null limit 1`).out.split('|');
      const w = h.psql(`update public.extraction_runs set status='failed' where tenant_id='${TENANT_A}' and conversation_id='${c2[0]}'`); assert.ok(w.ok, w.err);
      assert.ok(run(h, TENANT_A).closed >= 1);
      assert.equal(n(h, `select count(*) from public.problem_conversations where tenant_id='${TENANT_A}' and conversation_id='${c2[0]}' and valid_until is null`), 0);
    });

    await t.test('issue_id solo si EXACTAMENTE un hallazgo tiene cita sobre el mensaje del miembro: con dos queda NULL, no se adivina', () => {
      const fila = h.psql(`select l.problem_id||'|'||l.conversation_id||'|'||l.issue_id from public.problem_conversations l where l.tenant_id='${TENANT_B}' and l.valid_until is null and l.issue_id is not null limit 1`).out.split('|');
      assert.equal(fila.length, 3, 'hay un vinculo con hallazgo en B');
      // segundo hallazgo de la MISMA corrida con cita sobre la MISMA revision que el primero
      const sql = `with i as (select i.* from public.issues i where i.tenant_id='${TENANT_B}' and i.id='${fila[2]}'),
        nuevo as (insert into public.issues(tenant_id,category,severity,extraction_run_id) select tenant_id,'SYN: otro tema','low',extraction_run_id from i returning id)
        insert into public.evidence_spans(tenant_id,"start","end",quote_hash,message_revision_id,issue_id)
        select es.tenant_id,es."start",es."end",es.quote_hash,es.message_revision_id,(select id from nuevo) from public.evidence_spans es where es.tenant_id='${TENANT_B}' and es.issue_id='${fila[2]}' limit 1`;
      const w = h.psql(sql); assert.ok(w.ok, w.err);
      const d = run(h, TENANT_B);
      assert.equal(d.closed, 1); assert.equal(d.inserted, 1);
      assert.equal(n(h, `select count(*) from public.problem_conversations where tenant_id='${TENANT_B}' and problem_id='${fila[0]}' and conversation_id='${fila[1]}' and valid_until is null and issue_id is null`), 1);
      assert.equal(run(h, TENANT_B).inserted, 0, 'estable');
    });

    await t.test('permisos: solo quien salta RLS; anon, authenticated, service_role y vexa_backend no ejecutan la funcion', () => {
      for (const role of ['anon', 'authenticated', 'service_role', 'vexa_backend']) {
        const x = h.psql(`begin; set local role ${role}; select public.refresh_problem_conversations('${TENANT_A}',true); commit;`);
        assert.equal(x.ok, false, role); assert.match(x.err, /permission denied|does not exist|must be owner/i, role);
      }
      assert.equal(h.psql(`select public.refresh_problem_conversations(null,true)`).ok, false);
      assert.equal(h.psql(`select public.refresh_problem_conversations('00000000-0000-4000-8000-00000000dead',true)`).ok, false, 'tenant inexistente');
    });

    await t.test('reversa: borra solo lo derivado y quita la funcion', () => {
      h.psql(`insert into public.problem_conversations(tenant_id,problem_id,conversation_id,provenance) select tenant_id,problem_id,conversation_id,'{"kind":"manual"}' from public.problem_conversations where tenant_id='${TENANT_B}' and valid_until is null limit 1 on conflict do nothing`);
      // fila manual con otro valid_from para no chocar con la unica (tenant,problem,conv,valid_from)
      const down = new URL('../../packages/workspace-service/tests/20261206000500_problem_conversations_link.down.sql', import.meta.url).pathname;
      const manual = n(h, `select count(*) from public.problem_conversations where provenance->>'kind'='manual'`);
      const r = h.file(down); assert.equal(r.status, 0, String(r.stderr));
      assert.equal(n(h, `select count(*) from public.problem_conversations where provenance->>'kind'='problem-link-v1'`), 0);
      assert.equal(n(h, `select count(*) from public.problem_conversations where provenance->>'kind'='manual'`), manual);
      assert.equal(h.psql(`select to_regprocedure('public.refresh_problem_conversations(uuid,boolean)') is null`).out, 't');
    });
  }, {name: 'f1citas', upto: 55});
});

// Esquema COMPLETO (todas las migraciones vigentes hasta 20261205000700, con RLS por rol y privilegios por defecto cerrados): la propuesta se aplica y corre.
import {startLocalPg} from '../../ops/lib/localpg.mjs';
test('esquema completo: la migracion se aplica sobre todas las vigentes, corre sin datos (ceros, no error) y sigue cerrada a los roles de la app', {timeout: 900000}, async () => {
  const pg = await startLocalPg({label: 'f1citas'});
  try {
    pg.createDb('f1'); pg.applySchema('f1', {upTo: '20261205000700_default_privileges_and_trigger_functions.sql'});
    pg.file('f1', MIG);
    pg.sql('f1', `insert into public.organizations(id,name) values ('${TENANT_A}','SYN') on conflict do nothing`);
    const d = JSON.parse(pg.sql('f1', `select public.refresh_problem_conversations('${TENANT_A}',false)`));
    assert.deepEqual([d.desired_links, d.inserted, d.closed, d.unchanged], [0, 0, 0, 0]);
    for (const role of ['anon', 'authenticated', 'service_role', 'vexa_backend'])
      assert.throws(() => pg.sql('f1', `begin; set local role ${role}; select public.refresh_problem_conversations('${TENANT_A}',true); commit;`), /permission denied/, role);
  } finally { await pg.stop(); }
});
