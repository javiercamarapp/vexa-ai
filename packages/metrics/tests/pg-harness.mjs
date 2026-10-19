// Postgres LOCAL desechable (initdb en /private/tmp/claude-501) con las migraciones REALES 0001..N de supabase/migrations (N configurable; por defecto 55, la de escala).
// Sustitutos mínimos solo para lo que el entorno local no tiene: auth, storage y pgvector (el tipo vector se declara como text).
// Se destruye al terminar. Todos los datos son sintéticos (identificadores SYN / uuid de prueba).
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const MIG = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../../supabase/migrations');
export const pgAvailable = () => spawnSync('which', ['initdb']).status === 0 && spawnSync('which', ['psql']).status === 0;
export const UPTO = 55;

export async function withPg(fn, {name = 'econ', shared = '64MB', upto = UPTO} = {}) {
  fs.mkdirSync('/private/tmp/claude-501', {recursive: true});
  const root = fs.mkdtempSync(`/private/tmp/claude-501/${name}-`), data = path.join(root, 'data');
  const run = (cmd, args, opt = {}) => spawnSync(cmd, args, {encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, ...opt});
  const psql = (sql, db = 't') => { const r = run('psql', ['-h', root, '-U', 'postgres', '-d', db, '-At', '-v', 'ON_ERROR_STOP=1', '-c', sql]); return {ok: r.status === 0, out: r.stdout.trim(), err: r.stderr.trim()}; };
  const file = (f, db = 't') => run('psql', ['-h', root, '-U', 'postgres', '-d', db, '-q', '-v', 'ON_ERROR_STOP=1', '-f', f]);
  try {
    if (run('initdb', ['-D', data, '-U', 'postgres', '--auth=trust', '-E', 'UTF8', '--no-locale']).status !== 0) throw Error('initdb falló');
    if (run('pg_ctl', ['-D', data, '-o', `-k ${root} -c listen_addresses= -c fsync=off -c synchronous_commit=off -c full_page_writes=off -c shared_buffers=${shared} -c max_connections=30`, '-l', path.join(root, 'log'), '-w', 'start']).status !== 0) throw Error('pg_ctl falló');
    psql('create database t', 'postgres');
    for (const r of ['anon', 'authenticated', 'service_role']) psql(`create role ${r}`, 'postgres');
    const stub = psql(`create schema auth; create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz, created_at timestamptz default now(), raw_user_meta_data jsonb default '{}'::jsonb, deleted_at timestamptz, banned_until timestamptz, is_anonymous boolean default false);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      create function auth.role() returns text language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.role',true),''),'anon') $$;
      create function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb $$;
      create table auth.sessions(id uuid primary key default gen_random_uuid(), user_id uuid, not_after timestamptz, created_at timestamptz default now(), aal text);
      grant usage on schema auth to anon,authenticated,service_role;
      create schema storage; create table storage.buckets(id text primary key,name text,public boolean default false,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner uuid,owner_id text,metadata jsonb,created_at timestamptz default now(),updated_at timestamptz default now(),version text);
      alter table storage.objects enable row level security;
      create function storage.allow_any_operation(text[]) returns boolean language sql stable as $$ select false $$;
      create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name,'/') $$;
      grant usage on schema storage to anon,authenticated,service_role;
      create schema extensions; grant usage on schema extensions to anon,authenticated,service_role;
      create function extensions.fakedist(text,text) returns float8 language sql as 'select 0::float8'; create operator extensions.<=> (leftarg=text,rightarg=text,function=extensions.fakedist);`);
    if (!stub.ok) throw Error('stubs: ' + stub.err);
    const tmp = path.join(root, 'mig'); fs.mkdirSync(tmp);
    for (const f of fs.readdirSync(MIG).filter(x => /^00\d\d_.*\.sql$/.test(x) && Number(x.slice(0, 4)) <= upto).sort()) {
      fs.writeFileSync(path.join(tmp, f), fs.readFileSync(path.join(MIG, f), 'utf8').replace(/create extension if not exists vector with schema extensions;/g, '').replace(/extensions\.vector_dims\([a-z_]+\)/g, 'dim').replace(/extensions\.vector(\(\d+\))?/g, 'text'));
      const r = file(path.join(tmp, f)); if (r.status !== 0) throw Error(`migración ${f}: ${String(r.stderr).split('\n').slice(0, 3).join(' ')}`);
    }
    return await fn({psql, file, root, sock: root});
  } finally { run('pg_ctl', ['-D', data, '-m', 'immediate', 'stop']); fs.rmSync(root, {recursive: true, force: true}); }
}
