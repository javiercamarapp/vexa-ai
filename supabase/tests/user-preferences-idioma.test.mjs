// T48: public.user_preferences (idioma por persona) en un Postgres LOCAL desechable con la cadena REAL de migraciones.
//   node --test supabase/tests/user-preferences-idioma.test.mjs
// Comprueba: aplica sobre la cadena completa; RLS forzada; cada persona lee/escribe solo su fila (también el upsert); el with check impide mover la fila; check es|en;
// anon sin acceso; el rol de servicio (vexa_backend / vexa_email_service) lee idioma pero no escribe; updated_at lo fija el trigger; borrar el usuario borra su fila; la reversa limpia y es re-aplicable.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {startLocalPg, migrationsDir, root} from '../../ops/lib/localpg.mjs';

const MIG = '20261209000000_user_preferences_idioma.sql';
const ROLLBACK = root + '/supabase/operations/20261209000000_user_preferences_idioma.rollback.sql';
const U1 = '11111111-1111-4111-8111-111111111111', U2 = '22222222-2222-4222-8222-222222222222', U3 = '33333333-3333-4333-8333-333333333333';

test('esquema: la migración nueva es la última, con prefijo único', () => {
  const todas = fs.readdirSync(migrationsDir).filter(n => n.endsWith('.sql')).sort();
  assert.equal(todas.at(-1), MIG);
  const v = todas.map(n => n.split('_')[0]); assert.equal(new Set(v).size, v.length);
});

test('user_preferences: RLS por persona, lectura de servicio, trigger, check y reversa', {timeout: 900000}, async () => {
  const pg = await startLocalPg({label: 'idioma'});
  try {
    pg.createDb('d'); pg.applySchema('d');
    const q = sql => pg.sql('d', sql);
    // Como una sesión de la API: rol + sub del JWT.
    const como = (rol, uid, sql, opt = {}) => pg.psql('d', ['-At', '-c', `set role ${rol}; ${uid ? `select set_config('request.jwt.claim.sub','${uid}',false);` : ''} ${sql}`], opt);
    const falla = (rol, uid, sql, patron) => { const r = como(rol, uid, sql, {allowFail: true}); assert.notEqual(r.status, 0, 'debía fallar: ' + sql); assert.match(r.stderr, patron, sql); };
    q(`insert into auth.users(id,email) values('${U1}','a@example.test'),('${U2}','b@example.test'),('${U3}','c@example.test')`);

    assert.equal(q(`select relrowsecurity and relforcerowsecurity from pg_class where oid='public.user_preferences'::regclass`), 't');
    assert.equal(q(`select count(*) from pg_policies where schemaname='public' and tablename='user_preferences'`), '4');
    assert.equal(q(`select count(*) from pg_policies where schemaname='public' and tablename='user_preferences' and cmd in('INSERT','UPDATE') and with_check is null`), '0', 'toda política de escritura lleva with check');

    // Cada persona escribe su fila (insert y luego upsert como lo hace PostgREST).
    como('authenticated', U1, `insert into public.user_preferences(user_id,idioma) values('${U1}','en')`);
    como('authenticated', U1, `insert into public.user_preferences(user_id,idioma) values('${U1}','es') on conflict(user_id) do update set user_id=excluded.user_id, idioma=excluded.idioma`);
    assert.equal(q(`select idioma from public.user_preferences where user_id='${U1}'`), 'es');
    como('authenticated', U2, `insert into public.user_preferences(user_id,idioma) values('${U2}','en')`);

    // No puede escribir por otra persona, ni mover su fila, ni salirse del check.
    // U3 es una persona real SIN fila: así el rechazo solo puede venir de la política (with check), no de una llave duplicada.
    falla('authenticated', U1, `insert into public.user_preferences(user_id,idioma) values('${U3}','es')`, /row-level security/);
    falla('authenticated', U1, `update public.user_preferences set user_id='${U3}' where user_id='${U1}'`, /row-level security/);
    assert.equal(q(`select count(*) from public.user_preferences where user_id='${U3}'`), '0');
    falla('authenticated', U1, `update public.user_preferences set idioma='fr' where user_id='${U1}'`, /check constraint/);
    // Mismo intento SIN WHERE: la política SELECT no puede enmascarar un with check laxo (ahí sí se movería la fila).
    falla('authenticated', U1, `update public.user_preferences set user_id='${U3}'`, /row-level security/);
    assert.equal(q(`select count(*) from public.user_preferences where user_id='${U3}'`), '0', 'sin WHERE tampoco se mueve la fila');
    assert.equal(q(`select idioma from public.user_preferences where user_id='${U2}'`), 'en', 'la fila ajena no cambia');
    // update de la fila ajena: 0 filas (RLS la oculta), sin error.
    assert.doesNotMatch(como('authenticated', U1, `update public.user_preferences set idioma='es' where user_id='${U2}' returning 1`).stdout, /^1$/m, 'RLS oculta la fila ajena: 0 filas actualizadas');
    assert.equal(q(`select idioma from public.user_preferences where user_id='${U2}'`), 'en');
    // Lee solo la suya; sin sesión (sub nulo) no ve nada; no puede borrar; no puede tocar updated_at.
    assert.equal(como('authenticated', U1, `select count(*) from public.user_preferences`).stdout.trim().split('\n').at(-1), '1');
    assert.equal(como('authenticated', null, `select count(*) from public.user_preferences`).stdout.trim().split('\n').at(-1), '0');
    falla('authenticated', U1, `delete from public.user_preferences where user_id='${U1}'`, /permission denied/);
    falla('authenticated', U1, `update public.user_preferences set updated_at=now() where user_id='${U1}'`, /permission denied/);
    // anon: nada.
    // Sin ningún privilegio (ni siquiera de columna) para anon, service_role ni public: con RLS un select permitido daría 0 filas sin error, así que se mira el ACL.
    for (const rol of ['anon', 'service_role']) assert.equal(q(`select has_any_column_privilege('${rol}','public.user_preferences','select,insert,update,references')`), 'f', rol);
    assert.equal(q(`select count(*) from information_schema.role_table_grants where table_name='user_preferences' and grantee='PUBLIC'`), '0');
    falla('anon', null, `select * from public.user_preferences`, /permission denied/);
    falla('anon', null, `insert into public.user_preferences(user_id,idioma) values('${U1}','es')`, /permission denied/);
    falla('service_role', null, `select * from public.user_preferences`, /permission denied/);

    // El rol de servicio lee user_id e idioma de todas las personas, pero no escribe ni lee updated_at.
    for (const rol of ['vexa_backend', 'vexa_email_service']) {
      assert.equal(como(rol, null, `select string_agg(user_id||':'||idioma, ',' order by user_id) from public.user_preferences`).stdout.trim().split('\n').at(-1), `${U1}:es,${U2}:en`, rol);
      falla(rol, null, `update public.user_preferences set idioma='en'`, /permission denied/);
      falla(rol, null, `insert into public.user_preferences(user_id,idioma) values('${U1}','es')`, /permission denied/);
      falla(rol, null, `select updated_at from public.user_preferences`, /permission denied/);
    }

    // updated_at lo fija el trigger en cada update.
    q(`update public.user_preferences set updated_at='2020-01-01' where user_id='${U1}'`);
    como('authenticated', U1, `update public.user_preferences set idioma='en' where user_id='${U1}'`);
    assert.equal(q(`select updated_at > now() - interval '1 minute' from public.user_preferences where user_id='${U1}'`), 't');

    // Borrar el usuario borra su fila.
    q(`delete from auth.users where id='${U2}'`);
    assert.equal(q(`select count(*) from public.user_preferences`), '1');

    // Reversa: deja el esquema sin la tabla ni el trigger, y se puede volver a aplicar.
    pg.file('d', ROLLBACK);
    assert.equal(q(`select to_regclass('public.user_preferences') is null and to_regprocedure('public.user_preferences_touch()') is null`), 't');
    pg.file('d', migrationsDir + '/' + MIG);
    pg.file('d', migrationsDir + '/' + MIG); // idempotente
    assert.equal(q(`select count(*) from pg_policies where tablename='user_preferences'`), '4');
  } finally { await pg.stop(); }
});
