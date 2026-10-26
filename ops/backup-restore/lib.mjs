// Utilidades compartidas por backup.mjs y restore-verify.mjs. Solo CLIs locales (psql/pg_dump); nada de red propia.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';

export const SCHEMAS = ['public', 'vexa_platform'];
// Tablas GLOBALES de plataforma (no pertenecen a un tenant) que NO se respaldan por tenant.
// settings (20261126000000) contains deployment-wide switches, including MFA.
// A tenant restore must not replace administrators or global security configuration.
export const GLOBAL_EXCLUDE = new Set(['vexa_platform.administrators', 'vexa_platform.settings']);
// Sesion determinista: la misma salida de texto en origen y destino.
export const SESSION = ["set client_encoding='UTF8'", "set timezone='UTC'", "set datestyle='ISO, MDY'", "set extra_float_digits=1", "set bytea_output='hex'", "set intervalstyle='postgres'"];

export const sha256File = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
export const sha256Text = (s) => crypto.createHash('sha256').update(s).digest('hex');
export const qi = (s) => '"' + String(s).replace(/"/g, '""') + '"';
export const qlit = (s) => "'" + String(s).replace(/'/g, "''") + "'";
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function makePsql({bin, conn = [], env = process.env}) {
  const base = ['-X', '-q', '-v', 'ON_ERROR_STOP=1', ...conn];
  const run = (args, opt = {}) => {
    const r = spawnSync(path.join(bin, 'psql'), [...base, ...args], {encoding: 'utf8', maxBuffer: 1 << 29, env, ...opt});
    if (r.status !== 0 && !opt.allowFail) throw new Error('psql fallo: ' + (r.stderr || r.stdout).slice(0, 2500));
    return r;
  };
  return {
    run,
    sql: (text, opt) => run(['-At', '-F', '\t', '-c', text], opt).stdout.replace(/\n$/, ''),
    json: (text) => JSON.parse(run(['-At', '-c', text]).stdout.trim() || 'null'),
    file: (f, vars = [], opt) => run([...vars.flatMap(([k, v]) => ['-v', `${k}=${v}`]), '-f', f], opt),
  };
}

// Metrica order-independent y en streaming: filas + dos sumas de 60 bits de md5 de la fila (texto). Detecta
// filas perdidas, duplicadas, alteradas o cambiadas de columna sin cargar la tabla en memoria.
export const metricSelect = (from) =>
  `select count(*)::text, coalesce(sum(('x'||substr(md5(t::text),1,15))::bit(60)::bigint::numeric),0)::text, coalesce(sum(('x'||substr(md5(t::text),17,15))::bit(60)::bigint::numeric),0)::text from ${from} t`;

// Consulta de catalogo: huella de RLS/politicas/grants/triggers/funciones. Mismo texto en origen y restauracion.
export const CATALOG_SQL = `
with t as (
  select n.nspname sch, c.relname rel, c.oid, c.relrowsecurity rls, c.relforcerowsecurity frc
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where c.relkind in ('r','p') and n.nspname = any(array['public','vexa_platform'])
), tabs as (
  select sch||'.'||rel as name, rls, frc,
    (select coalesce(jsonb_agg(md5(concat_ws('|',p.policyname,p.cmd,p.permissive,array_to_string(p.roles,','),coalesce(p.qual,''),coalesce(p.with_check,''))) order by p.policyname),'[]'::jsonb) from pg_policies p where p.schemaname=t.sch and p.tablename=t.rel) policies,
    (select coalesce(jsonb_agg(g order by g),'[]'::jsonb) from (select (case when a.grantee=0 then 'PUBLIC' else a.grantee::regrole::text end)||':'||a.privilege_type||':'||a.is_grantable g from aclexplode((select relacl from pg_class where oid=t.oid)) a where a.grantee<>(select relowner from pg_class where oid=t.oid)) x) grants,
    (select coalesce(jsonb_agg(md5(pg_get_triggerdef(tg.oid)) order by tg.tgname),'[]'::jsonb) from pg_trigger tg where tg.tgrelid=t.oid and not tg.tgisinternal) triggers,
    (select coalesce(jsonb_agg(md5(pg_get_constraintdef(k.oid)||k.conname) order by k.conname),'[]'::jsonb) from pg_constraint k where k.conrelid=t.oid) constraints
  from t
), fns as (
  select p.oid::regprocedure::text name, md5(pg_get_functiondef(p.oid)) def, p.prosecdef secdef, coalesce(p.proconfig::text,'') cfg,
    (select coalesce(string_agg((case when a.grantee=0 then 'PUBLIC' else a.grantee::regrole::text end)||':'||a.privilege_type,',' order by 1),'') from aclexplode(p.proacl) a where a.grantee<>p.proowner) acl
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname = any(array['public','vexa_platform']) and p.prokind in ('f','p')
)
select jsonb_build_object(
  'tables',(select jsonb_object_agg(name, jsonb_build_object('rls',rls,'force',frc,'policies',policies,'grants',grants,'triggers',triggers,'constraints',constraints)) from tabs),
  'functions',(select jsonb_object_agg(name, jsonb_build_object('def',def,'secdef',secdef,'cfg',cfg,'acl',acl)) from fns)
)::text`;

export function stableStringify(v) {
  if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + stableStringify(v[k])).join(',') + '}';
  return JSON.stringify(v);
}

// FKs que apuntan a una tabla (para derivar alcance de tablas sin tenant_id) y a auth.users.
export const FK_SQL = `
select coalesce(jsonb_agg(jsonb_build_object(
  'child', cn.nspname||'.'||cc.relname,
  'cols', (select jsonb_agg(a.attname order by u.ord) from unnest(k.conkey) with ordinality u(attnum,ord) join pg_attribute a on a.attrelid=k.conrelid and a.attnum=u.attnum),
  'parent', pn.nspname||'.'||pc.relname,
  'pcols', (select jsonb_agg(a.attname order by u.ord) from unnest(k.confkey) with ordinality u(attnum,ord) join pg_attribute a on a.attrelid=k.confrelid and a.attnum=u.attnum)
) order by cn.nspname,cc.relname,k.conname),'[]'::jsonb)::text
from pg_constraint k join pg_class cc on cc.oid=k.conrelid join pg_namespace cn on cn.oid=cc.relnamespace
join pg_class pc on pc.oid=k.confrelid join pg_namespace pn on pn.oid=pc.relnamespace
where k.contype='f' and cn.nspname = any(array['public','vexa_platform'])`;

export const TABLES_SQL = `
select coalesce(jsonb_agg(jsonb_build_object('name', n.nspname||'.'||c.relname, 'schema', n.nspname, 'table', c.relname,
  'cols', (select jsonb_agg(a.attname order by a.attnum) from pg_attribute a where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped and a.attgenerated=''),
  'hasTenant', exists(select 1 from pg_attribute a where a.attrelid=c.oid and a.attname='tenant_id' and not a.attisdropped)
) order by n.nspname,c.relname),'[]'::jsonb)::text
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where c.relkind='r' and not c.relispartition and n.nspname = any(array['public','vexa_platform'])`;

export const ROLES_SQL = `
select coalesce(jsonb_agg(jsonb_build_object('name',r.rolname,'bypassrls',r.rolbypassrls,'createrole',r.rolcreaterole)),'[]'::jsonb)::text
from pg_roles r where r.rolname !~ '^pg_' and r.rolname not in ('postgres') and not r.rolsuper
  and r.oid in (
    select a.grantee from pg_class c, aclexplode(c.relacl) a where c.relnamespace::regnamespace::text = any(array['public','vexa_platform'])
    union select a.grantee from pg_proc p, aclexplode(p.proacl) a where p.pronamespace::regnamespace::text = any(array['public','vexa_platform'])
    union select unnest(p.polroles) from pg_policy p join pg_class c on c.oid=p.polrelid where c.relnamespace::regnamespace::text = any(array['public','vexa_platform'])
  )`;

// Calcula, para cada tabla, la expresion SQL de alcance (que filas pertenecen al tenant). Devuelve {name -> scopeSql} o lanza.
export function buildScopes(tables, fks, tenant) {
  const byName = new Map(tables.map(t => [t.name, t]));
  const scopes = new Map();
  const T = qlit(tenant);
  for (const t of tables) {
    if (GLOBAL_EXCLUDE.has(t.name)) {
      if (t.hasTenant) throw new Error('Tabla global declarada adquirio alcance tenant: ' + t.name);
      continue;
    }
    if (t.name === 'public.organizations') scopes.set(t.name, `${qi('id')} = ${T}::uuid`);
    else if (t.hasTenant) scopes.set(t.name, `${qi('tenant_id')} = ${T}::uuid`);
  }
  let progress = true;
  while (progress) {
    progress = false;
    for (const t of tables) {
      if (scopes.has(t.name) || GLOBAL_EXCLUDE.has(t.name)) continue;
      const cand = fks.filter(f => f.child === t.name && f.cols.length === 1 && scopes.has(f.parent));
      if (!cand.length) continue;
      const f = cand[0];
      scopes.set(t.name, `${qi(f.cols[0])} in (select ${qi(f.pcols[0])} from ${f.parent.split('.').map(qi).join('.')} where ${scopes.get(f.parent)})`);
      progress = true;
    }
  }
  const missing = tables.filter(t => !scopes.has(t.name) && !GLOBAL_EXCLUDE.has(t.name)).map(t => t.name);
  if (missing.length) throw new Error('Tablas sin regla de alcance por tenant (anadalas a GLOBAL_EXCLUDE o defina su alcance): ' + missing.join(', '));
  return scopes;
}

export const tableFile = (name) => name.replace(/[^a-z0-9_.]/gi, '_') + '.copy';
export function chmodTree(dir) {
  for (const e of fs.readdirSync(dir, {withFileTypes: true})) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { fs.chmodSync(p, 0o700); chmodTree(p); } else fs.chmodSync(p, 0o600);
  }
}

// A failed query on a SELECT-granted table is not an empty RLS result.
export function parseProbeOutput(stdout, readableTables) {
  const seen = new Map();
  for (const line of stdout.split('\n')) {
    const m = line.match(/^(public\.[a-z_0-9]+)\|(\d+)$/);
    if (m) seen.set(m[1], Number(m[2]));
  }
  const missing = readableTables.filter(name => !seen.has(name));
  if (missing.length) throw new Error('Sonda SELECT fallo en tablas autorizadas: ' + missing.join(', '));
  return seen;
}
