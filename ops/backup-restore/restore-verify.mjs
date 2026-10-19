#!/usr/bin/env node
// Restaura un respaldo de backup.mjs en un Postgres LOCAL DESECHABLE (socket unix, sin red) y lo VERIFICA:
//   1. integridad de archivos (sha256 del manifiesto) 2. conteos + hashes por tabla 3. catalogo identico (RLS forzada, politicas,
//   grants, triggers, constraints, funciones) 4. FKs sin huerfanos 5. sondas de RLS con roles reales (extrano = 0 filas, miembro ve lo suyo,
//   vexa_backend con tenant ajeno = 0, anon sin acceso).
//
//   node ops/backup-restore/restore-verify.mjs --backup <carpeta> [--keep] [--report <archivo.json>]
//
// NUNCA se conecta a un servidor existente: siempre levanta su propia instancia en /private/tmp/claude-501/ y la borra al terminar
// (con --keep la deja y muestra como borrarla).
import fs from 'node:fs';
import path from 'node:path';
import {startLocalPg, bin} from '../lib/localpg.mjs';
import {fileURLToPath} from 'node:url';
import {makePsql, metricSelect, CATALOG_SQL, FK_SQL, SESSION, qi, qlit, sha256File, sha256Text, stableStringify} from './lib.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (n, d = null) => { const i = args.indexOf('--' + n); return i < 0 ? d : (args[i + 1] === undefined || args[i + 1].startsWith('--') ? true : args[i + 1]); };
const dir = opt('backup') && path.resolve(opt('backup'));
if (!dir || dir === true) { console.error('Uso: restore-verify.mjs --backup <carpeta> [--keep] [--report archivo.json]'); process.exit(2); }

let pg;
const failures = [];
const fail = (area, msg) => failures.push({area, msg});
const report = {backup: dir, checks: {}};
const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
const T = manifest.tenant;

// 1. Integridad de archivos del respaldo (antes de tocar nada).
{
  let bad = 0;
  for (const t of [...manifest.tables, manifest.authUsers]) if (sha256File(path.join(dir, t.file)) !== t.sha256) { bad++; fail('integridad', `sha256 distinto: ${t.file}`); }
  if (sha256Text(fs.readFileSync(path.join(dir, 'schema.sql'), 'utf8')) !== manifest.schemaSha256) { bad++; fail('integridad', 'schema.sql alterado'); }
  const cat = JSON.parse(fs.readFileSync(path.join(dir, 'catalog.json'), 'utf8'));
  if (sha256Text(stableStringify(cat)) !== manifest.catalogSha256) { bad++; fail('integridad', 'catalog.json alterado'); }
  report.checks.integrity = {files: manifest.tables.length + 3, corrupt: bad};
  if (bad) finish();
}

async function finish() {
  report.failures = failures;
  report.ok = failures.length === 0;
  if (opt('report') && opt('report') !== true) fs.writeFileSync(path.resolve(opt('report')), JSON.stringify(report, null, 1));
  if (pg) {
    if (args.includes('--keep')) console.log(`INSTANCIA_CONSERVADA socket=${pg.sock} puerto=${pg.port} (borrar: pg_ctl -D ${pg.data} -m fast stop; rm -rf ${pg.dir})`);
    else await pg.stop();
  }
  if (failures.length) { for (const f of failures.slice(0, 40)) console.error(`FALLO[${f.area}] ${f.msg}`); console.error(`RESTORE_VERIFY_FALLO fallos=${failures.length}`); process.exit(1); }
  console.log(`RESTORE_VERIFY_OK tablas=${manifest.tables.length} filas=${manifest.totalRows} usuarios=${manifest.authUsers.rows} ` +
    `rls_tablas=${report.checks.catalog?.tablesCompared} fks=${report.checks.fk?.checked} huerfanos=${report.checks.fk?.orphans} sondas_rls=${report.checks.rlsProbe?.probes}`);
  process.exit(0);
}

try {
  pg = await startLocalPg({label: 'restore'});
  pg.createDb('restored');
  const ps = makePsql({bin, conn: ['-h', pg.sock, '-p', pg.port, '-d', 'restored']});

  // 2. Esqueleto Supabase minimo + roles + esquema + datos.
  ps.file(path.join(here, '../lib/stubs.sql'));
  const roles = JSON.parse(fs.readFileSync(path.join(dir, 'roles.json'), 'utf8').trim() || '[]');
  for (const r of roles) ps.sql(`do $$ begin if not exists (select 1 from pg_roles where rolname=${qlit(r.name)}) then create role ${qi(r.name)} nologin ${r.bypassrls ? 'bypassrls' : ''}; end if; end $$`);
  ps.sql('drop schema public cascade');
  ps.file(path.join(dir, 'schema.sql'));
  // Valor por defecto de Supabase para el esquema public (pg_dump no lo incluye al excluir CREATE SCHEMA ACL).
  ps.sql('grant usage on schema public to anon, authenticated, service_role, vexa_backend');
  const load = ['begin;', 'set session_replication_role=replica;', ...SESSION.map(x => x + ';')];
  load.push(`\\copy auth.users(${manifest.authUsers.columns.map(qi).join(',')}) from '${path.join(dir, manifest.authUsers.file)}'`);
  for (const t of manifest.tables) load.push(`\\copy ${t.name.split('.').map(qi).join('.')}(${t.columns.map(qi).join(',')}) from '${path.join(dir, t.file)}'`);
  load.push('commit;');
  const loadFile = path.join(pg.dir, 'load.sql');
  fs.writeFileSync(loadFile, load.join('\n') + '\n');
  ps.file(loadFile);

  // 3. Conteos y hashes por tabla (misma metrica que el respaldo).
  const sess = SESSION.join(';') + ';';
  let ok = 0;
  for (const t of [...manifest.tables, {name: 'auth.users', rows: manifest.authUsers.rows, h1: manifest.authUsers.h1, h2: manifest.authUsers.h2}]) {
    const q = t.name === 'auth.users' ? metricSelect(`(select * from (select ${manifest.authUsers.columns.map(qi).join(',')} from auth.users) a)`) : metricSelect(t.name.split('.').map(qi).join('.'));
    const [rows, h1, h2] = ps.sql(sess + q, {}).split('\n').pop().split('\t');
    if (Number(rows) !== t.rows) fail('conteo', `${t.name}: restauradas ${rows}, esperadas ${t.rows}`);
    else if (h1 !== t.h1 || h2 !== t.h2) fail('hash', `${t.name}: contenido distinto (filas iguales, hash distinto)`);
    else ok++;
  }
  report.checks.rows = {tables: manifest.tables.length + 1, matched: ok};

  // 4. Catalogo: RLS/politicas/grants/triggers/constraints/funciones identicos al origen.
  const src = JSON.parse(fs.readFileSync(path.join(dir, 'catalog.json'), 'utf8'));
  const dst = JSON.parse(ps.sql(CATALOG_SQL.replace(/\s+/g, ' ')));
  let cmp = 0;
  for (const [name, a] of Object.entries(src.tables)) {
    const b = dst.tables[name]; cmp++;
    if (!b) { fail('catalogo', `tabla ausente: ${name}`); continue; }
    if (a.rls !== b.rls || a.force !== b.force) fail('rls', `${name}: RLS enable/force distinto (origen ${a.rls}/${a.force}, restaurado ${b.rls}/${b.force})`);
    for (const k of ['policies', 'grants', 'triggers', 'constraints']) if (stableStringify(a[k]) !== stableStringify(b[k])) fail(k === 'policies' ? 'rls' : 'catalogo', `${name}: ${k} distintos`);
  }
  for (const name of Object.keys(dst.tables)) if (!src.tables[name]) fail('catalogo', `tabla sobrante tras restaurar: ${name}`);
  for (const [name, a] of Object.entries(src.functions)) {
    const b = dst.functions[name];
    if (!b) fail('catalogo', `funcion ausente: ${name}`);
    else if (a.def !== b.def || a.secdef !== b.secdef || a.cfg !== b.cfg || a.acl !== b.acl) fail('catalogo', `funcion distinta: ${name}`);
  }
  const noRls = Object.entries(dst.tables).filter(([, v]) => !v.rls || !v.force).map(([k]) => k);
  report.checks.catalog = {tablesCompared: cmp, functionsCompared: Object.keys(src.functions).length, tablesWithoutForcedRls: noRls};

  // 5. Integridad referencial (con session_replication_role=replica no se validaron al cargar).
  const fks = JSON.parse(ps.sql(FK_SQL.replace(/\s+/g, ' ')));
  let orphans = 0, checked = 0;
  for (const f of fks) {
    const ch = f.child.split('.').map(qi).join('.'), pa = f.parent.split('.').map(qi).join('.');
    const nn = f.cols.map(c => `c.${qi(c)} is not null`).join(' and ');
    const eq = f.cols.map((c, i) => `p.${qi(f.pcols[i])}=c.${qi(c)}`).join(' and ');
    const n = Number(ps.sql(`select count(*) from ${ch} c where ${nn} and not exists (select 1 from ${pa} p where ${eq})`));
    checked++;
    if (n > 0) { orphans += n; fail('fk', `${f.child}(${f.cols}) -> ${f.parent}: ${n} huerfanos`); }
  }
  report.checks.fk = {checked, orphans};

  // 6. Sondas de RLS con roles reales.
  const owner = ps.sql(`select user_id from public.memberships where tenant_id=${qlit(T)}::uuid and role='owner' and status='active' order by user_id limit 1`);
  const stranger = '00000000-0000-0000-0000-00000000dead';
  const probeTables = manifest.tables.filter(t => t.rows > 0 && t.columns.includes('tenant_id') && t.name.startsWith('public.'));
  const runProbe = (role, sub, tenantSetting) => {
    const lines = ['\\set ON_ERROR_STOP off', `set role ${qi(role)};`, `select set_config('request.jwt.claim.sub',${qlit(sub)},false);`, tenantSetting ? `select set_config('vexa.tenant_id',${qlit(tenantSetting)},false);` : ''];
    for (const t of probeTables) lines.push(`select ${qlit(t.name)}||'|'||count(*) from ${t.name.split('.').map(qi).join('.')};`);
    const f = path.join(pg.dir, `probe-${role}.sql`); fs.writeFileSync(f, lines.join('\n') + '\n');
    const r = ps.run(['-At', '-v', 'ON_ERROR_STOP=0', '-f', f], {allowFail: true});
    const seen = new Map(); for (const l of r.stdout.split('\n')) { const m = l.match(/^(public\.[a-z_0-9]+)\|(\d+)$/); if (m) seen.set(m[1], Number(m[2])); }
    return seen; // tablas con error de permiso no aparecen: 0 visibles
  };
  const asStranger = runProbe('authenticated', stranger, null);
  // memberships tiene politica "ver mi propia fila" por diseno: se admite solo las filas del propio usuario.
  const own = (u) => Number(ps.sql(`select count(*) from public.memberships where user_id=${qlit(u)}::uuid`));
  const allowed = (u, n) => (n === 'public.memberships' ? own(u) : 0);
  for (const [n, c] of asStranger) if (c > allowed(stranger, n)) fail('rls-sonda', `extrano (authenticated) ve ${c} filas en ${n}`);
  const asOwner = runProbe('authenticated', owner, null);
  let ownerVisible = 0;
  for (const t of probeTables) { const c = asOwner.get(t.name) ?? 0; if (c > t.rows) fail('rls-sonda', `miembro ve mas filas (${c}) que existen (${t.rows}) en ${t.name}`); ownerVisible += c > 0 ? 1 : 0; }
  if (ownerVisible === 0) fail('rls-sonda', 'sonda vacua: el miembro no ve ninguna tabla (la sonda no prueba nada)');
  const wrongTenant = runProbe('vexa_backend', owner, '99999999-9999-9999-9999-999999999999');
  for (const [n, c] of wrongTenant) if (c > allowed(owner, n)) fail('rls-sonda', `vexa_backend con tenant ajeno ve ${c} filas en ${n}`);
  const rightTenant = runProbe('vexa_backend', owner, T);
  let backendVisible = 0; for (const [, c] of rightTenant) if (c > 0) backendVisible++;
  if (backendVisible === 0) fail('rls-sonda', 'sonda vacua: vexa_backend con el tenant correcto no ve nada');
  const asAnon = runProbe('anon', stranger, null);
  for (const [n, c] of asAnon) if (c > allowed(stranger, n)) fail('rls-sonda', `anon ve ${c} filas en ${n}`);
  report.checks.rlsProbe = {probes: probeTables.length * 5, tables: probeTables.length, memberTablesVisible: ownerVisible, backendTablesVisible: backendVisible, strangerSeen: [...asStranger.values()].reduce((a, b) => a + b, 0), wrongTenantSeen: [...wrongTenant.values()].reduce((a, b) => a + b, 0), anonSeen: [...asAnon.values()].reduce((a, b) => a + b, 0)};
} catch (e) {
  fail('infra', String(e.message).slice(0, 1500));
}
await finish();
