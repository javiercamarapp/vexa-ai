#!/usr/bin/env node
// Prueba de extremo a extremo (LOCAL, datos sinteticos): respaldo -> restauracion en Postgres desechable -> verificacion,
// mas pruebas de mutacion que demuestran que la verificacion FALLA cuando algo se corrompe.
//   node ops/backup-restore/test.mjs          (~1 min; usa /private/tmp/claude-501/, se limpia solo)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {startLocalPg} from '../lib/localpg.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const results = [];
const check = (name, pass, detail = '') => { results.push(pass); console.log((pass ? 'PASS ' : 'FAIL ') + name + (detail ? ' ' + detail : '')); };
const u = (s) => crypto.createHash('md5').update(s).digest('hex').replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5');
const TA = u('tenant-A'), TB = u('tenant-B');
const base = '/private/tmp/claude-501';
const work = fs.mkdtempSync(path.join(base, 'vexa-ops-bktest-'));
const node = (script, a, env = {}) => spawnSync(process.execPath, [path.join(here, script), ...a], {encoding: 'utf8', env: {...process.env, ...env}, maxBuffer: 1 << 28});
const before = new Set(fs.readdirSync(base).filter(n => n.startsWith('vexa-ops-')));
let pg;
try {
  pg = await startLocalPg({label: 'bksrc'});
  pg.createDb('src');
  pg.applySchema('src');
  pg.file('src', path.join(here, 'synthetic-fixture.sql'), [['na', '8000'], ['nc', '600']]);
  pg.sql('src', `insert into vexa_platform.settings(key,value) values('syn_backup_global','{"marker":"SYN_GLOBAL_NOT_TENANT"}'::jsonb)`);
  const env = {PGHOST: pg.sock, PGPORT: pg.port, PGDATABASE: 'src'};
  const bk = (out, extra = []) => node('backup.mjs', ['--tenant', TA, '--out', out, ...extra], env);
  const rv = (dir, extra = []) => node('restore-verify.mjs', ['--backup', dir, ...extra]);

  // 1. Camino feliz.
  const b1 = path.join(work, 'bk1');
  const r1 = bk(b1);
  check('backup: termina OK', r1.status === 0 && /BACKUP_OK/.test(r1.stdout), r1.stdout.trim().slice(0, 160) + r1.stderr.slice(0, 300));
  const m = JSON.parse(fs.readFileSync(path.join(b1, 'manifest.json'), 'utf8'));
  const row = (n) => m.tables.find(t => t.name === 'public.' + n)?.rows;
  check('backup: cubre todas las tablas del esquema (excepto las globales declaradas)', m.tables.length >= 120, `tablas=${m.tables.length}`);
  check('backup: conteos sinteticos esperados (A) y sin filas del tenant B', row('messages') === 8000 && row('customers') === 600 && row('economic_ledger_entries') === 300 && row('organizations') === 1 && row('embeddings') === 50 && row('attachment_blobs') === 100 && row('tracker_versions') === 2, JSON.stringify({m: row('messages'), c: row('customers'), e: row('embeddings')}));
  check('backup: configuracion global declarada, sin archivo de datos ni marcador', m.excludedGlobalTables.includes('vexa_platform.settings') && !m.tables.some(t => t.name === 'vexa_platform.settings') && !fs.existsSync(path.join(b1, 'data/vexa_platform.settings.copy')) && !fs.readdirSync(path.join(b1, 'data')).some(f => fs.readFileSync(path.join(b1, 'data', f), 'utf8').includes('SYN_GLOBAL_NOT_TENANT')));
  check('backup: weekly/CFO y recibos via FK conservan A y excluyen B', row('weekly_report_outbox') === 1 && row('notification_email_messages') === 1 && row('notification_email_receipts') === 1 && row('cfo_access_log') === 1 && !fs.readFileSync(path.join(b1, 'data/public.notification_email_receipts.copy'), 'utf8').includes('SYN_receipt_B'));
  const leaked = fs.readdirSync(path.join(b1, 'data')).filter(f => fs.readFileSync(path.join(b1, 'data', f), 'utf8').includes(TB));
  check('backup: ningun archivo de datos contiene el id del tenant B', leaked.length === 0, leaked.join(','));
  const modes = [b1, path.join(b1, 'manifest.json'), path.join(b1, 'data/public.messages.copy')].map(p => (fs.statSync(p).mode & 0o777).toString(8));
  check('backup: permisos 700/600 (contiene PII sintetica)', modes[0] === '700' && modes[1] === '600' && modes[2] === '600', modes.join('/'));
  check('backup: no se sobrescribe una carpeta existente', bk(b1).status === 2);
  check('backup: host remoto exige --allow-remote (aborta antes de conectar)', node('backup.mjs', ['--tenant', TA, '--out', path.join(work, 'x')], {PGHOST: 'db.ejemplo-invalido.supabase.co'}).status === 2 && !fs.existsSync(path.join(work, 'x')));
  check('backup: tenant inexistente aborta y no deja carpeta', (() => { const o = path.join(work, 'none'); const r = node('backup.mjs', ['--tenant', u('nadie'), '--out', o], env); return r.status === 2 && !fs.existsSync(o); })());

  const t0 = Date.now();
  const v1 = rv(b1, ['--report', path.join(work, 'rep1.json')]);
  check('restore+verify: pasa en Postgres local desechable', v1.status === 0 && /RESTORE_VERIFY_OK/.test(v1.stdout), (v1.stdout + v1.stderr).trim().slice(0, 300));
  const rep = JSON.parse(fs.readFileSync(path.join(work, 'rep1.json'), 'utf8'));
  check('verify: todas las tablas coinciden en conteo y hash', rep.checks.rows.matched === rep.checks.rows.tables, JSON.stringify(rep.checks.rows));
  check('verify: RLS activa y forzada en todas las tablas restauradas', rep.checks.catalog.tablesWithoutForcedRls.length === 0 && rep.checks.catalog.tablesCompared >= 120, JSON.stringify(rep.checks.catalog).slice(0, 160));
  check('verify: sin FKs huerfanas', rep.checks.fk.orphans === 0 && rep.checks.fk.checked > 300, JSON.stringify(rep.checks.fk));
  const p = rep.checks.rlsProbe;
  check('verify: sondas RLS no vacuas (miembro y backend ven lo suyo) y negativas (extrano/otro tenant/anon = 0)', p.memberTablesVisible >= 5 && p.backendTablesVisible >= 10 && p.strangerSeen === 0 && p.anonSeen === 0 && p.wrongTenantSeen <= 1, JSON.stringify(p));
  console.log(`  (restauracion+verificacion: ${((Date.now() - t0) / 1000).toFixed(1)} s para ${m.totalRows} filas)`);

  // 2. Pruebas de mutacion: cada corrupcion debe ser detectada.
  const clone = (name) => { const d = path.join(work, name); fs.cpSync(b1, d, {recursive: true}); return d; };
  const manifestOf = (d) => JSON.parse(fs.readFileSync(path.join(d, 'manifest.json'), 'utf8'));
  const saveManifest = (d, mm) => fs.writeFileSync(path.join(d, 'manifest.json'), JSON.stringify(mm));
  const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
  const failedWith = (r, area) => r.status === 1 && new RegExp(`FALLO\\[${area}\\]`).test(r.stderr);

  { // a) un byte alterado: lo ve el sha256 del manifiesto
    const d = clone('mut-a'); const f = path.join(d, 'data/public.messages.copy'); const buf = fs.readFileSync(f); buf[200] ^= 1; fs.writeFileSync(f, buf);
    check('mutacion a: byte alterado en datos -> integridad', failedWith(rv(d), 'integridad'));
  }
  { // b) fila alterada Y sha corregido en manifiesto: lo ve el hash de contenido
    const d = clone('mut-b'); const f = path.join(d, 'data/public.customers.copy');
    fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace('Cliente A 10', 'Cliente A 10X'));
    const mm = manifestOf(d); mm.tables.find(t => t.name === 'public.customers').sha256 = sha(f); saveManifest(d, mm);
    check('mutacion b: fila alterada (sha ajustado) -> hash de contenido', failedWith(rv(d), 'hash'));
  }
  { // c) fila perdida con sha ajustado: lo ve el conteo
    const d = clone('mut-c'); const f = path.join(d, 'data/public.economic_ledger_entries.copy');
    const lines = fs.readFileSync(f, 'utf8').split('\n'); lines.splice(5, 1); fs.writeFileSync(f, lines.join('\n'));
    const mm = manifestOf(d); mm.tables.find(t => t.name === 'public.economic_ledger_entries').sha256 = sha(f); saveManifest(d, mm);
    check('mutacion c: asiento del ledger perdido -> conteo', failedWith(rv(d), 'conteo'));
  }
  { // d) politica RLS eliminada del esquema (con sha del esquema ajustado)
    const d = clone('mut-d'); const f = path.join(d, 'schema.sql'); let s = fs.readFileSync(f, 'utf8');
    const i = s.indexOf('CREATE POLICY member_read ON public.messages'); const j = s.indexOf(';\n', i);
    s = s.slice(0, i) + s.slice(j + 2); fs.writeFileSync(f, s);
    const mm = manifestOf(d); mm.schemaSha256 = sha(f); saveManifest(d, mm);
    const r = rv(d);
    check('mutacion d: politica RLS borrada del esquema -> rls', i > 0 && failedWith(r, 'rls'), r.stderr.split('\n')[0]);
  }
  { // e) FORCE RLS desactivado en una tabla
    const d = clone('mut-e'); const f = path.join(d, 'schema.sql'); let s = fs.readFileSync(f, 'utf8');
    const needle = 'ALTER TABLE ONLY public.messages FORCE ROW LEVEL SECURITY;';
    const had = s.includes(needle); s = s.replace(needle, ''); fs.writeFileSync(f, s);
    const mm = manifestOf(d); mm.schemaSha256 = sha(f); saveManifest(d, mm);
    check('mutacion e: FORCE RLS quitado -> rls', had && failedWith(rv(d), 'rls'));
  }
  { // f) grants ampliados: authenticated con SELECT sobre una tabla solo-backend
    const d = clone('mut-f'); const f = path.join(d, 'schema.sql'); let s = fs.readFileSync(f, 'utf8');
    s += '\nGRANT SELECT ON TABLE public.economic_ledger_entries TO authenticated;\n'; fs.writeFileSync(f, s);
    const mm = manifestOf(d); mm.schemaSha256 = sha(f); saveManifest(d, mm);
    check('mutacion f: grant extra a authenticated -> catalogo', failedWith(rv(d), 'catalogo'));
  }
  { // g) origen inconsistente (cliente borrado con conversaciones que lo referencian): FK huerfana
    pg.sql('src', "set session_replication_role=replica; delete from public.customers where id in (select id from public.customers where tenant_id='" + TA + "' order by id limit 1)");
    const d = path.join(work, 'mut-g'); const r = bk(d);
    const v = rv(d);
    check('mutacion g: FK huerfana en origen -> fk (y solo fk)', r.status === 0 && failedWith(v, 'fk') && !/FALLO\[(hash|conteo|rls)\]/.test(v.stderr), v.stderr.split('\n')[0]);
  }
} catch (e) {
  console.error(e); check('infra', false);
} finally {
  if (pg) await pg.stop();
  fs.rmSync(work, {recursive: true, force: true});
  const left = fs.readdirSync(base).filter(n => n.startsWith('vexa-ops-') && !before.has(n));
  check('limpieza: no quedan clusters ni carpetas temporales de la prueba', left.length === 0, left.join(','));
}
const ok = results.length > 0 && results.every(Boolean);
console.log(ok ? 'ALL PASS' : 'FAILED');
process.exitCode = ok ? 0 : 1;
