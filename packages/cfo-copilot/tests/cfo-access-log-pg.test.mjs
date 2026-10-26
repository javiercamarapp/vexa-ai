// La bitácora del Copiloto CFO (supabase/propuestas/20261128000000_cfo_access_log.sql) contra Postgres LOCAL desechable con las migraciones REALES y el rol vexa_backend
// con RLS FORCE, con el mismo contexto que fija packages/platform/src/db.ts (SET LOCAL ROLE + request.jwt.claim.sub, vexa.tenant_id, vexa.action).
//   node --test packages/cfo-copilot/tests/cfo-access-log-pg.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {withPg, pgAvailable} from '../../metrics/tests/pg-harness.mjs';
import {TENANT_A, TENANT_B, OWNER, ANALYST_A, SECOND_OWNER_A, sembrarUsuarios} from '../../ai-scale/economia-problemas/mundo.mjs';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../supabase/propuestas');
const UP = join(DIR, '20261128000000_cfo_access_log.sql'), DOWN = join(DIR, '20261128000000_cfo_access_log.down.sql');
const OPERATOR_A = '00000000-0000-4000-8000-000000009005';
const HASH = 'a'.repeat(64);

test('cfo_access_log: quién escribe y lee, solo-anexar, aislamiento y reversa', {skip: !pgAvailable() && 'sin postgres local', timeout: 600000}, async () => {
  await withPg(async h => {
    const {psql, file} = h;
    const must = sql => { const r = psql(sql); assert.ok(r.ok, r.err.slice(0, 300) + ' :: ' + sql.slice(0, 90)); return r.out; };
    must(`insert into public.organizations(id,name) values('${TENANT_A}','SYN A'),('${TENANT_B}','SYN B') on conflict do nothing`);
    sembrarUsuarios(h);
    must(`insert into auth.users(id) values('${OPERATOR_A}') on conflict do nothing`);
    must(`insert into public.memberships(tenant_id,user_id,role,status,permissions_version) values('${TENANT_A}','${OPERATOR_A}','operator','active',1)`);

    // 0) aplicar la migración
    const up = file(UP); assert.equal(up.status, 0, String(up.stderr).slice(0, 300));
    assert.equal(must(`select count(*) from public.cfo_access_log`), '0');

    // como la app: una transacción por llamada, rol vexa_backend y contexto fijado con set_config local
    const como = (user, tenant, action, sentencia) => psql(`begin; set local role vexa_backend; select set_config('request.jwt.claim.sub','${user}',true), set_config('vexa.tenant_id','${tenant}',true), set_config('vexa.action','${action}',true); ${sentencia}; commit;`);
    const insertar = (user, tenant, action, actor = user, tenantFila = tenant) => como(user, tenant, action, `insert into public.cfo_access_log(tenant_id,actor_id,tool,args_hash,outcome) values('${tenantFila}','${actor}','resumen_mes','${HASH}','ok')`);

    // 1) el INSERT exacto de access.ts funciona para owner y analyst con la acción propose
    assert.ok(insertar(OWNER.A, TENANT_A, 'propose').ok, 'owner debe poder registrar');
    assert.ok(insertar(ANALYST_A, TENANT_A, 'propose').ok, 'analyst debe poder registrar');
    assert.equal(must(`select count(*) from public.cfo_access_log`), '2');
    // 2) quien no puede, no puede: operator (rol insuficiente), viewer, acción equivocada, otro actor, otra organización
    for (const [nombre, r] of [
      ['operator', insertar(OPERATOR_A, TENANT_A, 'propose')],
      ['viewer', insertar(SECOND_OWNER_A, TENANT_A, 'propose')],
      ['acción read', insertar(OWNER.A, TENANT_A, 'read')],
      ['actor distinto del usuario', insertar(OWNER.A, TENANT_A, 'propose', ANALYST_A)],
      ['organización ajena (RLS)', insertar(OWNER.A, TENANT_A, 'propose', OWNER.A, TENANT_B)],
      ['owner de B en A', insertar(OWNER.B, TENANT_A, 'propose')],
    ]) assert.ok(!r.ok && /row-level security|violates|foreign key|permission denied/i.test(r.err), `${nombre} debía rechazarse: ${r.err.slice(0, 160)}`);
    assert.equal(must(`select count(*) from public.cfo_access_log`), '2', 'los rechazos no deben dejar filas');
    // 3) restricciones de forma: huella de 64 hex y resultado en minúsculas
    assert.ok(!como(OWNER.A, TENANT_A, 'propose', `insert into public.cfo_access_log(tenant_id,actor_id,tool,args_hash,outcome) values('${TENANT_A}','${OWNER.A}','resumen_mes','no-es-hex','ok')`).ok);
    assert.ok(!como(OWNER.A, TENANT_A, 'propose', `insert into public.cfo_access_log(tenant_id,actor_id,tool,args_hash,outcome) values('${TENANT_A}','${OWNER.A}','resumen_mes','${HASH}','MAL RESULTADO')`).ok);
    // 4) lectura: solo owner de su organización
    const leer = (user, tenant) => como(user, tenant, 'read', `select count(*) from public.cfo_access_log`);
    assert.match(leer(OWNER.A, TENANT_A).out, /\b2\b/, 'owner ve las 2 filas de su organización');
    assert.doesNotMatch(leer(ANALYST_A, TENANT_A).out, /\b2\b/, 'analyst no lee la bitácora');
    assert.doesNotMatch(leer(OWNER.B, TENANT_B).out, /\b2\b/, 'otra organización no ve filas ajenas');
    // 5) solo-anexar: ni la app (sin permiso) ni un superusuario (disparador) pueden modificar o borrar
    assert.ok(!como(OWNER.A, TENANT_A, 'propose', `update public.cfo_access_log set outcome='ok'`).ok);
    assert.ok(!como(OWNER.A, TENANT_A, 'propose', `delete from public.cfo_access_log`).ok);
    const upd = psql(`update public.cfo_access_log set outcome='x'`); assert.ok(!upd.ok && /cfo_access_log_append_only/.test(upd.err), upd.err.slice(0, 160));
    const del = psql(`delete from public.cfo_access_log`); assert.ok(!del.ok && /cfo_access_log_append_only/.test(del.err), del.err.slice(0, 160));
    assert.equal(must(`select count(*) from public.cfo_access_log`), '2');
    // 6) reversa: quita tabla, función y disparador
    const dn = file(DOWN); assert.equal(dn.status, 0, String(dn.stderr).slice(0, 300));
    assert.equal(must(`select count(*) from pg_class where relname='cfo_access_log'`), '0');
    assert.equal(must(`select count(*) from pg_proc where proname='cfo_access_log_append_only'`), '0');
    // 7) tras la reversa vuelve el fallo que hoy ve producción: 42P01 (tabla inexistente), como el db-fallo registrado
    const sin = insertar(OWNER.A, TENANT_A, 'propose'); assert.ok(!sin.ok && /does not exist/.test(sin.err), sin.err.slice(0, 160));
  });
});
