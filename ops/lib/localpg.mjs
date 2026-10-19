// Postgres 17 local, efimero, solo socket unix (sin red). Nunca toca Supabase ni Vercel.
// Uso: const pg = await startLocalPg({label:'backup'}); ... await pg.stop();
// Los datos viven en /private/tmp/claude-501/ y se borran en stop().
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
export const root = path.resolve(here, '../..');
export const migrationsDir = path.join(root, 'supabase/migrations');
const base = process.env.VEXA_OPS_TMP ?? '/private/tmp/claude-501';
const findBin = () => {
  if (process.env.PG_BIN) return process.env.PG_BIN;
  const r = spawnSync('pg_config', ['--bindir'], {encoding: 'utf8'});
  return r.status === 0 ? r.stdout.trim() : '/opt/homebrew/opt/postgresql@17/bin';
};
export const bin = findBin();
export const tool = (name) => path.join(bin, name);
export function listMigrations({upTo = null, only = null} = {}) {
  return fs.readdirSync(migrationsDir).filter(n => /\.sql$/.test(n)).sort()
    .filter(n => !upTo || n <= upTo).filter(n => !only || only.includes(n));
}
export async function startLocalPg({label = 'ops', port = null} = {}) {
  fs.mkdirSync(base, {recursive: true});
  const dir = fs.mkdtempSync(path.join(base, `vexa-ops-${label}-`));
  const data = path.join(dir, 'data'), sock = path.join(dir, 's');
  fs.mkdirSync(sock);
  port = port ?? String(59500 + Math.floor(Math.random() * 400));
  const run = (cmd, args, opt = {}) => {
    const r = spawnSync(tool(cmd), args, {encoding: 'utf8', maxBuffer: 1 << 28, ...opt});
    if (r.status !== 0 && !opt.allowFail) throw new Error(`${cmd} fallo: ${(r.stderr || r.stdout).slice(0, 3000)}`);
    return r;
  };
  run('initdb', ['-D', data, '-A', 'trust', '--no-locale', '-E', 'UTF8']);
  run('pg_ctl', ['-D', data, '-l', path.join(dir, 'pg.log'), '-o',
    `-k ${sock} -p ${port} -c listen_addresses='' -c shared_buffers=128MB -c max_locks_per_transaction=256 -c fsync=off`, '-w', 'start']);
  const common = ['-h', sock, '-p', port, '-X', '-q', '-v', 'ON_ERROR_STOP=1'];
  const api = {
    dir, data, sock, port,
    psql: (db, args, opt = {}) => run('psql', [...common, '-d', db, ...args], opt),
    sql: (db, text, opt = {}) => run('psql', [...common, '-d', db, '-At', '-c', text], opt).stdout.trim(),
    file: (db, f, vars = []) => run('psql', [...common, '-d', db, ...vars.flatMap(([k, v]) => ['-v', `${k}=${v}`]), '-f', f]).stdout,
    run,
    createDb: (name) => api.sql('postgres', `create database ${name}`),
    // Esquema equivalente a Supabase: stubs de auth/storage/vector + todas las migraciones en orden.
    applySchema(db, {upTo = null, only = null} = {}) {
      api.file(db, path.join(here, 'stubs.sql'));
      const tmp = path.join(dir, 'mig'); fs.mkdirSync(tmp, {recursive: true});
      for (const n of listMigrations({upTo, only})) {
        const f = path.join(tmp, n);
        fs.writeFileSync(f, fs.readFileSync(path.join(migrationsDir, n), 'utf8').replace(/^create extension if not exists vector.*$/m, ''));
        try { api.file(db, f); } catch (e) { throw new Error(`migracion ${n}: ${e.message.slice(0, 1500)}`); }
      }
    },
    async stop() {
      spawnSync(tool('pg_ctl'), ['-D', data, '-m', 'fast', '-w', 'stop']);
      fs.rmSync(dir, {recursive: true, force: true});
    },
  };
  return api;
}
