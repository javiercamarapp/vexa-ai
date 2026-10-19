#!/usr/bin/env node
// Prueba LOCAL de rollbacks de 0054, 0053, 0052, 0051 y 0049 (orden seguro: del mas nuevo al mas viejo).
//   node ops/rollback/test.mjs
// Para cada paso compara la huella `pg_dump --schema-only` del esquema revertido con la de un esquema construido SIN esas
// migraciones; luego vuelve a aplicar las migraciones (subir-bajar-subir) y exige la huella original. Tambien prueba las
// guardas de perdida de datos, la idempotencia y lo irreversible (ledger solo-insercion).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {startLocalPg, listMigrations, migrationsDir, tool} from '../lib/localpg.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const results = [];
const check = (name, pass, detail = '') => { results.push(pass); console.log((pass ? 'PASS ' : 'FAIL ') + name + (detail ? ' ' + detail : '')); };
const ORDER = ['0054', '0053', '0052', '0051', '0049']; // orden de rollback
const all = listMigrations();
const mig = (n) => all.find(f => f.startsWith(n + '_'));
const down = (n) => path.join(here, `${n}.down.sql`);
const base = '/private/tmp/claude-501';
const before = new Set(fs.readdirSync(base).filter(n => n.startsWith('vexa-ops-')));

const fingerprint = (pg, db) => {
  const r = spawnSync(tool('pg_dump'), ['-h', pg.sock, '-p', pg.port, '-d', db, '-s', '-n', 'public', '-n', 'vexa_platform', '--no-owner', '--no-comments'], {encoding: 'utf8', maxBuffer: 1 << 28});
  if (r.status !== 0) throw new Error(r.stderr);
  return crypto.createHash('sha256').update(r.stdout.split('\n').filter(l => !/^\\(un)?restrict /.test(l)).join('\n')).digest('hex');
};
const build = async (label, only) => { const pg = await startLocalPg({label}); pg.createDb('d'); pg.applySchema('d', {only}); return pg; };

try {
  for (const n of ORDER) check(`archivos presentes: ${n}.down.sql y migracion ${n}`, fs.existsSync(down(n)) && !!mig(n));

  // Esquemas esperados E_k = todas las migraciones menos las k primeras de ORDER.
  const expected = [];
  for (let k = 0; k <= ORDER.length; k++) {
    const removed = new Set(ORDER.slice(0, k).map(mig));
    const pg = await build('exp' + k, all.filter(f => !removed.has(f)));
    expected.push(fingerprint(pg, 'd')); await pg.stop();
  }
  check('control: las huellas esperadas son todas distintas (cada migracion cambia el esquema)', new Set(expected).size === expected.length);

  // Camino completo: full -> down en orden, comparando en cada paso.
  const full = await startLocalPg({label: 'full'}); full.createDb('d'); full.applySchema('d');
  check('esquema completo coincide con E_0', fingerprint(full, 'd') === expected[0]);
  ORDER.forEach(() => {});
  for (let k = 0; k < ORDER.length; k++) {
    const n = ORDER[k];
    const r = full.psql('d', ['-f', down(n)], {allowFail: true});
    check(`rollback ${n}: ejecuta sin error`, r.status === 0, (r.stderr || '').slice(0, 300));
    check(`rollback ${n}: esquema == esquema sin las migraciones ${ORDER.slice(0, k + 1).join(',')}`, fingerprint(full, 'd') === expected[k + 1]);
    const again = full.psql('d', ['-f', down(n)], {allowFail: true});
    check(`rollback ${n}: idempotente (segunda ejecucion sin error)`, again.status === 0, (again.stderr || '').slice(0, 200));
  }
  // Subir otra vez en el orden original (0049, 0051, 0052, 0053, 0054).
  const tmp = path.join(full.dir, 'redo'); fs.mkdirSync(tmp);
  for (const n of [...ORDER].reverse()) { const f = path.join(tmp, mig(n)); fs.writeFileSync(f, fs.readFileSync(path.join(migrationsDir, mig(n)), 'utf8').replace(/^create extension if not exists vector.*$/m, '')); full.file('d', f); }
  check('subir-bajar-subir: reaplicar 0049..0054 devuelve la huella del esquema completo', fingerprint(full, 'd') === expected[0]);
  await full.stop();

  // Guardas de perdida de datos y lo irreversible, con datos sinteticos.
  const g = await build('guard', all); const TA = crypto.createHash('md5').update('tenant-A').digest('hex').replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5');
  g.file('d', path.join(here, '../backup-restore/synthetic-fixture.sql'), [['na', '500'], ['nc', '50']]);
  const cnt = (t) => Number(g.sql('d', `select count(*) from public.${t}`));
  const withConfirm = (n) => { const f = path.join(g.dir, `confirm-${n}.sql`); fs.writeFileSync(f, `set vexa.rollback_confirm_drop_data='yes';\n\\i ${down(n)}\n`); return f; };

  const ledger0 = cnt('economic_ledger_entries');
  const d51 = g.psql('d', ['-f', down('0051')], {allowFail: true});
  check('0051: rollback conserva los asientos del ledger (solo-insercion; irreversible por diseno)', d51.status === 0 && cnt('economic_ledger_entries') === ledger0 && ledger0 > 0, `ledger=${ledger0}`);
  const del = g.psql('d', ['-c', 'delete from public.economic_ledger_entries'], {allowFail: true});
  check('0051: el ledger sigue sin permitir DELETE tras el rollback (trigger economic_append_guard)', del.status !== 0 && cnt('economic_ledger_entries') === ledger0, (del.stderr || '').trim().split('\n')[0]);
  const upd = g.psql('d', ['-c', "update public.economic_ledger_entries set report='cambio-no-permitido-xxxxxxxxxxxxx'"], {allowFail: true});
  check('0051: el ledger sigue sin permitir UPDATE', upd.status !== 0);
  const refs = g.sql('d', "select count(*) from pg_proc where prosrc ilike '%economic_batch_%'");
  check('0051: ninguna funcion restante referencia las funciones eliminadas', refs === '0', 'referencias=' + refs);

  const tv = cnt('tracker_versions');
  const d52 = g.psql('d', ['-f', down('0052')], {allowFail: true});
  check('0052: con datos y sin confirmacion ABORTA (ROLLBACK_0052_ABORTADO) y no borra nada', d52.status !== 0 && /ROLLBACK_0052_ABORTADO/.test(d52.stderr) && cnt('tracker_versions') === tv && tv > 0, (d52.stderr || '').trim().split('\n')[0]);
  const d52b = g.psql('d', ['-f', withConfirm('0052')], {allowFail: true});
  check('0052: con vexa.rollback_confirm_drop_data=yes elimina las tablas', d52b.status === 0 && g.sql('d', "select to_regclass('public.tracker_versions') is null") === 't', (d52b.stderr || '').slice(0, 200));

  const ab = cnt('attachment_blobs');
  const d53 = g.psql('d', ['-f', down('0053')], {allowFail: true});
  check('0053: con datos y sin confirmacion ABORTA y no borra nada', d53.status !== 0 && /ROLLBACK_0053_ABORTADO/.test(d53.stderr) && cnt('attachment_blobs') === ab && ab > 0);
  const d53b = g.psql('d', ['-f', withConfirm('0053')], {allowFail: true});
  check('0053: con confirmacion elimina las tablas de adjuntos', d53b.status === 0 && g.sql('d', "select to_regclass('public.attachment_blobs') is null and to_regclass('public.attachment_links') is null") === 't');
  check('0052/0053: el resto de datos del tenant queda intacto', cnt("messages where tenant_id='" + TA + "'") === 500 && cnt("conversations where tenant_id='" + TA + "'") === 50 && cnt("customers where tenant_id='" + TA + "'") === 50 && cnt('economic_ledger_entries') === ledger0, '');

  // 0054: la funcion revertida devuelve exactamente lo mismo que 0049 sobre datos reales sinteticos (equivalencia funcional ya la prueba
  // supabase/tests/association-candidates/run.mjs; aqui basta la identidad de definicion, verificada arriba por huella).
  await g.stop();
} catch (e) {
  console.error(e); check('infra', false);
} finally {
  const left = fs.readdirSync(base).filter(n => n.startsWith('vexa-ops-') && !before.has(n));
  for (const l of left) { try { const d = path.join(base, l); const p = spawnSync(tool('pg_ctl'), ['-D', path.join(d, 'data'), '-m', 'immediate', 'stop']); fs.rmSync(d, {recursive: true, force: true}); } catch {} }
  check('limpieza: no quedan clusters ni carpetas temporales', fs.readdirSync(base).filter(n => n.startsWith('vexa-ops-') && !before.has(n)).length === 0);
}
const ok = results.length > 0 && results.every(Boolean);
console.log(ok ? 'ALL PASS' : 'FAILED');
process.exitCode = ok ? 0 : 1;
