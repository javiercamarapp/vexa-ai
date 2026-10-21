// Valida la PROPUESTA sql/platform_observe.proposal.sql contra Postgres local con las migraciones reales 0001..0055 + la migración de
// administración de plataforma: solo administradores, agregados exactos, sin texto de clientes, sin escrituras.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {withPg, pgAvailable} from '../../metrics/tests/pg-harness.mjs';
import {TENANT_A, TENANT_B, OWNER, ANALYST_A, SECOND_OWNER_A, sembrarUsuarios, U} from '../../ai-scale/economia-problemas/mundo.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MIG = path.join(HERE, '../../../supabase/migrations/20260930224057_platform_administration.sql');
const PROPOSAL = path.join(HERE, '../sql/platform_observe.proposal.sql');
const ADMIN = U(9100), SESSION = '99999999-9999-4999-8999-999999999999';

test('platform_observe (propuesta): solo administradores, agregados correctos, solo lectura', {skip: !pgAvailable() && 'sin postgres local', timeout: 600000}, async () => {
  await withPg(async h => {
    const {psql, sock} = h;
    const must = sql => { const r = psql(sql); if (!r.ok) throw new Error(r.err.slice(0, 500) + ' :: ' + sql.slice(0, 120)); return r; };
    const file = f => { const r = spawnSync('psql', ['-h', sock, '-U', 'postgres', '-d', 't', '-q', '-v', 'ON_ERROR_STOP=1', '-f', f], {encoding: 'utf8'}); if (r.status !== 0) throw new Error(f + ': ' + r.stderr.slice(0, 600)); };
    must(`insert into public.organizations(id,name) values('${TENANT_A}','SYN Org A'),('${TENANT_B}','SYN Org B') on conflict do nothing`);
    sembrarUsuarios(h);
    must("alter table auth.users add column if not exists banned_until timestamptz");
    must(`create or replace function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$`);
    must(`update auth.users set email_confirmed_at=now() where true`);
    must(`insert into auth.users(id,email,email_confirmed_at) values('${ADMIN}','admin@syn.test',now())`);
    must(`insert into auth.sessions(id,user_id) values('${SESSION}','${ADMIN}')`);
    file(MIG);
    must(`insert into vexa_platform.administrators(user_id) values('${ADMIN}')`);
    file(PROPOSAL);
    // datos sintéticos: 2 jobs fallidos + 1 atascado en A, imports, ledger, invitaciones
    must(`insert into public.jobs(tenant_id,type,state,input_ref,input_hash,version,lease_until) values
      ('${TENANT_A}','extraction','failed','r1','h1','v1',null),('${TENANT_A}','import','failed','r2','h2','v1',null),('${TENANT_A}','embedding','running','r3','h3','v1',now()-interval '2 hours'),('${TENANT_A}','import','queued','r4','h4','v1',null),('${TENANT_B}','import','succeeded','r5','h5','v1',null)`);
    must(`insert into public.connections(tenant_id,source,account_id) values('${TENANT_A}','hubspot','acct-1')`);
    must(`insert into public.imports(tenant_id,file_hash,mapping_version,state,idempotency_key,connection_id,total,accepted,duplicates,rejected,pending) select '${TENANT_A}','fh','v1','succeeded','k1',c.id,100,90,5,3,2 from public.connections c where c.tenant_id='${TENANT_A}'`);
    must(`insert into public.team_invitations(tenant_id,request_id,email,role,created_by,expires_at) values('${TENANT_A}',gen_random_uuid(),'a@syn.test','viewer','${OWNER.A}',now()+interval '3 days'),('${TENANT_A}',gen_random_uuid(),'b@syn.test','viewer','${OWNER.A}',now()+interval '3 days')`);
    const asAdmin = (sql, user = ADMIN, session = SESSION) => {
      const script = `begin;set local role authenticated;select set_config('request.jwt.claim.sub','${user}',true),set_config('request.jwt.claims','{"session_id":"${session}","sub":"${user}"}',true) \\gset\n${sql};\nrollback;`;
      return spawnSync('psql', ['-h', sock, '-U', 'postgres', '-d', 't', '-X', '-At', '-v', 'ON_ERROR_STOP=1'], {input: script, encoding: 'utf8'});
    };
    const call = (user, session) => asAdmin(`select public.platform_observe('{"operation":"snapshot"}'::jsonb)`, user, session);
    const ok = call();
    assert.equal(ok.status, 0, ok.stderr);
    const json = JSON.parse(ok.stdout.split('\n').filter(l => l.startsWith('{')).pop());
    const a = json.organizations.find(o => o.name === 'SYN Org A'), b = json.organizations.find(o => o.name === 'SYN Org B');
    assert.equal(a.jobs.failed, 2); assert.equal(a.jobs.stuck, 1); assert.equal(a.jobs.queued, 1); assert.equal(a.jobs.running, 1);
    assert.equal(b.jobs.succeeded24h, 1); assert.equal(b.jobs.failed, 0);
    assert.equal(a.invitationsPending, 2);
    assert.equal(a.members.total, 3); assert.equal(a.members.owner, 1); assert.equal(b.members.total, 1);
    assert.deepEqual({t: a.sources.hubspot.total, i: a.sources.hubspot.incorporated, r: a.sources.hubspot.rejected, p: a.sources.hubspot.pending, l: a.sources.hubspot.loaded}, {t: 100, i: 95, r: 3, p: 2, l: true});
    assert.equal(a.sources.csv.loaded, false);
    assert.equal(json.failedJobs.length, 3); // 2 fallidos + 1 atascado
    assert.ok(json.failedJobs.every(j => !('payload' in j) && j.errorCode === null));
    assert.doesNotMatch(ok.stdout, /@syn\.test/, 'sin correos');
    // no administrador / sesión inválida / usuario sin sesión: 42501
    for (const [u, s] of [[OWNER.A, SESSION], [ADMIN, '00000000-0000-4000-8000-000000000000'], [ANALYST_A, SESSION], [SECOND_OWNER_A, SESSION]]) {
      const r = call(u, s); assert.notEqual(r.status, 0); assert.match(r.stderr, /platform_access_denied/);
    }
    // entradas inválidas
    for (const bad of ['{"operation":"snapshot","x":1}', '{"operation":"drop"}', '[]']) { const r = asAdmin(`select public.platform_observe('${bad}'::jsonb)`); assert.notEqual(r.status, 0); assert.match(r.stderr, /platform_input_invalid/); }
    // anon no puede ejecutarla
    const anon = spawnSync('psql', ['-h', sock, '-U', 'postgres', '-d', 't', '-X', '-At'], {input: `set role anon; select public.platform_observe('{"operation":"snapshot"}'::jsonb);`, encoding: 'utf8'});
    assert.match(anon.stderr, /permission denied/);
    // bitácora del copiloto: solo administradores, validada, una fila por consulta
    const aud = (input, user = ADMIN, session = SESSION) => asAdmin(`select public.platform_copilot_audit('${input}'::jsonb)`, user, session);
    assert.equal(aud('{"tool":"costos_ia","outcome":"allowed","argsHash":"' + 'a'.repeat(64) + '"}').status, 0);
    assert.equal(must("select count(*) from vexa_platform.audit where operation='copilot_query'").out, '0', 'la prueba usa ROLLBACK: no persiste');
    for (const bad of ['{"tool":"x; drop","outcome":"allowed"}', '{"tool":"ok","outcome":"allowed","extra":1}', '{"tool":"ok","outcome":"allowed","argsHash":"zz"}']) assert.match(aud(bad).stderr, /platform_input_invalid/);
    assert.match(aud('{"tool":"ok","outcome":"allowed"}', OWNER.A).stderr, /platform_access_denied/);
    // solo lectura: la función no cambia ninguna tabla
    const before = must(`select (select count(*) from public.jobs)||'/'||(select count(*) from public.imports)||'/'||(select count(*) from vexa_platform.audit)`).out;
    call();
    assert.equal(must(`select (select count(*) from public.jobs)||'/'||(select count(*) from public.imports)||'/'||(select count(*) from vexa_platform.audit)`).out, before);
  }, {name: 'platobs', shared: '64MB'});
});
