// Integracion de cierre 29-oct: la cadena COMPLETA de migraciones (0001 ... 20261201000000 ... 20261206000500) en un Postgres LOCAL efimero y su reversion.
//   node --test supabase/tests/cierre-cadena.test.mjs
// Comprueba: prefijos unicos y estrictamente posteriores a 20261205000700; la cadena aplica de cero; los objetos que verifica el script
// 2-aplicar-migraciones-cierre.sh existen; la reversion (F1 down + rollback de F5) deja el esquema igual al de 20261205000700 (salvo comentarios).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {startLocalPg, listMigrations, migrationsDir, root} from '../../ops/lib/localpg.mjs';

const BASE = '20261205000700_default_privileges_and_trigger_functions.sql';
const NUEVAS = ['20261206000000', '20261206000100', '20261206000200', '20261206000300', '20261206000400', '20261206000500'];
const DOWN_F1 = root + '/packages/workspace-service/tests/20261206000500_problem_conversations_link.down.sql';
const ROLLBACK_F5 = root + '/supabase/operations/20261206_f5_seguridad.rollback.sql';
const norm = s => s.split('\n').filter(l => !/^\\(un)?restrict /.test(l) && !/^\s*--/.test(l)).join('\n');

test('prefijos de migracion: unicos, ordenados, y las nuevas son estrictamente posteriores a 20261205000700', () => {
  const todas = listMigrations();
  const v = todas.map(n => n.split('_')[0]);
  assert.equal(new Set(v).size, v.length, 'hay prefijos repetidos: ' + v.filter((x, i) => v.indexOf(x) !== i));
  assert.deepEqual(todas.filter(n => n > BASE).map(n => n.split('_')[0]), NUEVAS);
  assert.ok(todas.some(n => n.startsWith('20261201000000')), 'la cadena incluye 20261201000000');
  for (const n of NUEVAS) assert.ok(n > '20261205000700');
});

test('cadena completa de migraciones aplica de cero, expone lo que el script verifica, y la reversion restituye el esquema previo', {timeout: 900000}, async () => {
  const pg = await startLocalPg({label: 'cierre'});
  try {
    pg.createDb('d');
    pg.applySchema('d', {upTo: BASE});
    const dump = () => norm(pg.run('pg_dump', ['-h', pg.sock, '-p', pg.port, '-s', '-x', '-d', 'd']).stdout);
    const base = dump();
    for (const n of listMigrations().filter(n => n > BASE)) pg.file('d', migrationsDir + '/' + n);
    // lo mismo que verifica el script 2-aplicar-migraciones-cierre.sh
    const q = sql => pg.sql('d', sql);
    assert.equal(q(`select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname,p.proname) in (('vexa_platform','require_admin_aal1'),('vexa_platform','platform_manage_core'),('vexa_platform','security_events_retain'),('public','org_security'),('public','owner_mfa_required'),('public','agent_turn_admit'),('public','refresh_problem_conversations'))`), '7');
    assert.equal(q(`select count(*) from information_schema.columns where table_schema='public' and table_name='email_auth_events' and column_name='ip_hash'`), '1');
    assert.equal(q(`select count(*) from pg_tables where schemaname='public' and tablename in ('organization_security','agent_turn_counters')`), '2');
    assert.equal(q(`select value::text from vexa_platform.settings where key='mfa_required'`), 'false');
    assert.equal(q(`select count(*) from public.organization_security where require_owner_mfa`), '0');
    assert.equal(q(`select count(*) from public.problem_conversations`), '0');
    // reversion: F1 primero, luego F5 (el archivo de F5 ya trae el orden interno correcto)
    pg.file('d', DOWN_F1);
    pg.file('d', ROLLBACK_F5);
    assert.equal(q(`select to_regprocedure('public.refresh_problem_conversations(uuid,boolean)') is null`), 't');
    assert.equal(dump(), base, 'tras la reversion el esquema debe ser identico al de 20261205000700');
    // y se puede volver a aplicar la cadena nueva sobre el esquema revertido
    for (const n of listMigrations().filter(n => n > BASE)) pg.file('d', migrationsDir + '/' + n);
    assert.equal(q(`select count(*) from pg_proc where proname='refresh_problem_conversations'`), '1');
  } finally { await pg.stop(); }
});
