#!/usr/bin/env node
// Respaldo LOGICO de un tenant: esquema (public + vexa_platform), datos del tenant, usuarios referenciados,
// huellas de catalogo (RLS/politicas/grants/triggers/funciones) y manifiesto con conteos y hashes por tabla.
//
//   node ops/backup-restore/backup.mjs --tenant <uuid> --out <carpeta nueva> [--allow-remote] [--statement-timeout 600s]
//
// Conexion: variables libpq estandar (PGHOST, PGPORT, PGUSER, PGDATABASE, PGPASSWORD o PGSERVICE). El script NUNCA
// imprime ni guarda credenciales. Es SOLO LECTURA (transaccion READ ONLY + default_transaction_read_only=on) y toma
// todas las lecturas en UNA transaccion REPEATABLE READ (instantanea consistente entre tablas).
// Contra un host que no sea local exige --allow-remote (decision de Javier: lee produccion).
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {
  SESSION, makePsql, metricSelect, CATALOG_SQL, FK_SQL, TABLES_SQL, ROLES_SQL, buildScopes, tableFile, qi, qlit, UUID,
  sha256File, sha256Text, stableStringify, chmodTree, GLOBAL_EXCLUDE,
} from './lib.mjs';

const args = process.argv.slice(2);
const opt = (name, def = null) => { const i = args.indexOf('--' + name); return i < 0 ? def : (args[i + 1]?.startsWith('--') || args[i + 1] === undefined ? true : args[i + 1]); };
const tenant = String(opt('tenant', '')).toLowerCase();
const out = opt('out');
if (!UUID.test(tenant) || !out || out === true) { console.error('Uso: backup.mjs --tenant <uuid> --out <carpeta nueva> [--allow-remote]'); process.exit(2); }
const host = process.env.PGHOST ?? '';
const isLocal = host === '' || host.startsWith('/') || ['localhost', '127.0.0.1', '::1'].includes(host);
if (!isLocal && !args.includes('--allow-remote')) { console.error('BACKUP_ABORTADO: PGHOST no es local; use --allow-remote solo con autorizacion para leer ese servidor.'); process.exit(2); }
const bin = process.env.PG_BIN ?? (() => { const r = spawnSync('pg_config', ['--bindir'], {encoding: 'utf8'}); return r.status === 0 ? r.stdout.trim() : '/opt/homebrew/opt/postgresql@17/bin'; })();
const timeout = opt('statement-timeout', '600s');
const env = {...process.env, PGOPTIONS: `-c default_transaction_read_only=on -c statement_timeout=${timeout} -c lock_timeout=5s ${process.env.PGOPTIONS ?? ''}`, PGAPPNAME: 'vexa-ops-backup'};
const psql = makePsql({bin, env});
const abs = path.resolve(out);
if (fs.existsSync(abs) && fs.readdirSync(abs).length) { console.error('BACKUP_ABORTADO: la carpeta de salida ya existe y no esta vacia (no se sobrescribe).'); process.exit(2); }
const started = new Date().toISOString();

// 0. Salvaguardas: sin BYPASSRLS/superuser el respaldo saldria silenciosamente incompleto por RLS.
const who = psql.sql("select rolname||E'\\t'||(rolsuper or rolbypassrls)::text from pg_roles where rolname=current_user").split('\t');
if (who[1] !== 'true') { console.error('BACKUP_ABORTADO: el rol de conexion no tiene BYPASSRLS/superuser; la RLS ocultaria filas y el respaldo quedaria incompleto.'); process.exit(2); }
const serverVersion = psql.sql('show server_version');
if (psql.sql(`select count(*) from public.organizations where id=${qlit(tenant)}::uuid`) !== '1') { console.error('BACKUP_ABORTADO: el tenant no existe en organizations.'); process.exit(2); }

fs.mkdirSync(path.join(abs, 'data'), {recursive: true});
fs.mkdirSync(path.join(abs, 'metrics'), {recursive: true});

let manifest;
try {
// 1. Descubrimiento.
const tables = psql.json(TABLES_SQL), fks = psql.json(FK_SQL);
const scopes = buildScopes(tables, fks, tenant);
const included = tables.filter(t => scopes.has(t.name));
const authRefs = fks.filter(f => f.parent === 'auth.users' && scopes.has(f.child) && f.cols.length === 1);
const authScope = authRefs.length
  ? authRefs.map(f => `select ${qi(f.cols[0])} from ${f.child.split('.').map(qi).join('.')} where ${scopes.get(f.child)} and ${qi(f.cols[0])} is not null`).join(' union ')
  : 'select null::uuid where false';
const authCols = ['id', 'email', 'created_at', 'raw_user_meta_data', 'deleted_at', 'banned_until'];

// 2. Un solo script psql, una sola transaccion (instantanea consistente): COPY + metricas.
const lines = ['begin isolation level repeatable read read only;', ...SESSION.map(x => x + ';')];
const dataDir = path.join(abs, 'data'), metDir = path.join(abs, 'metrics');
const items = [];
for (const t of included) {
  const from = t.name.split('.').map(qi).join('.');
  const where = scopes.get(t.name);
  const cols = t.cols.map(qi).join(',');
  const file = tableFile(t.name);
  items.push({...t, scope: where, file});
  lines.push(`\\copy (select ${cols} from ${from} where ${where}) to '${path.join(dataDir, file)}'`);
  lines.push(`\\copy (${metricSelect(`(select * from ${from} where ${where})`)}) to '${path.join(metDir, file)}'`);
}
lines.push(`\\copy (select ${authCols.map(qi).join(',')} from auth.users where id in (${authScope})) to '${path.join(dataDir, 'auth.users.copy')}'`);
lines.push(`\\copy (${metricSelect(`(select * from (select ${authCols.map(qi).join(',')} from auth.users where id in (${authScope})) a)`)}) to '${path.join(metDir, 'auth.users.copy')}'`);
// JSON de catalogo/roles: salida alineada=off a archivo (COPY escaparia las barras invertidas).
lines.push('\\t on', '\\pset format unaligned');
lines.push(`\\o ${path.join(abs, 'catalog.json')}`, CATALOG_SQL.replace(/\s+/g, ' ') + ';', '\\o');
lines.push(`\\o ${path.join(abs, 'roles.json')}`, ROLES_SQL.replace(/\s+/g, ' ') + ';', '\\o');
lines.push('commit;');
const script = path.join(abs, '.export.sql');
fs.writeFileSync(script, lines.join('\n') + '\n');
psql.file(script);
fs.unlinkSync(script);

// 3. Esquema (pg_dump no filtra filas; aqui solo estructura + privilegios + politicas).
const d = spawnSync(path.join(bin, 'pg_dump'), ['-s', '-n', 'public', '-n', 'vexa_platform', '--no-owner', '--no-comments', '--no-sync'], {encoding: 'utf8', env, maxBuffer: 1 << 28});
if (d.status !== 0) { console.error('BACKUP_ABORTADO: pg_dump fallo: ' + d.stderr.slice(0, 500)); process.exit(1); }
const schema = d.stdout.split('\n').filter(l => !/^\\(un)?restrict /.test(l)).join('\n');
fs.writeFileSync(path.join(abs, 'schema.sql'), schema);

// 4. Manifiesto.
const readMetric = (f) => { const [rows, h1, h2] = fs.readFileSync(path.join(metDir, f), 'utf8').trim().split('\t'); return {rows: Number(rows), h1, h2}; };
manifest = {
  format: 'vexa-tenant-backup-v1', tenant, startedAt: started, finishedAt: new Date().toISOString(), serverVersion,
  excludedGlobalTables: [...GLOBAL_EXCLUDE], note: 'Storage (bytes de adjuntos) y secretos NO estan incluidos; ver docs/operacion/03-RESPALDOS-Y-RESTAURACION.md',
  schemaSha256: sha256Text(schema), catalogSha256: sha256Text(stableStringify(JSON.parse(fs.readFileSync(path.join(abs, 'catalog.json'), 'utf8')))),
  tables: items.map(t => ({name: t.name, columns: t.cols, scope: t.scope, file: 'data/' + t.file, bytes: fs.statSync(path.join(dataDir, t.file)).size, sha256: sha256File(path.join(dataDir, t.file)), ...readMetric(t.file)})),
  authUsers: {columns: authCols, file: 'data/auth.users.copy', sha256: sha256File(path.join(dataDir, 'auth.users.copy')), ...readMetric('auth.users.copy')},
  foreignKeys: fks.length,
};
manifest.totalRows = manifest.tables.reduce((s, t) => s + t.rows, 0);
fs.writeFileSync(path.join(abs, 'manifest.json'), JSON.stringify(manifest, null, 1));
fs.rmSync(metDir, {recursive: true, force: true});
chmodTree(abs); fs.chmodSync(abs, 0o700);
} catch (e) {
  fs.rmSync(abs, {recursive: true, force: true}); // no dejar un respaldo parcial (con PII) en disco
  console.error('BACKUP_ABORTADO: ' + String(e.message).slice(0, 800));
  process.exit(1);
}
const nonEmpty = manifest.tables.filter(t => t.rows > 0).length;
console.log(`BACKUP_OK tenant=${tenant} tablas=${manifest.tables.length} (con datos ${nonEmpty}) filas=${manifest.totalRows} usuarios=${manifest.authUsers.rows} carpeta=${abs}`);
