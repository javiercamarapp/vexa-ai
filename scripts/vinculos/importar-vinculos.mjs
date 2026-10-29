#!/usr/bin/env node
// Importador SEGURO por lotes de vínculos problema <-> fila del libro (public.economic_problem_links).
// Solo dry-run por defecto. Escribe únicamente con --execute y con todas las guardas. Reversible (active=false, nunca borra).
//
//   node importar-vinculos.mjs --csv pares.csv [--supabase-linked | --pg-socket DIR]            # DRY-RUN (lee la base en BEGIN READ ONLY; sin transporte: solo valida el CSV, sin base)
//   node importar-vinculos.mjs --csv pares.csv --supabase-linked --execute --confirmar-proyecto proyecto-ejemplo \
//        --owner <uuid owner activo> --atestacion-archivo F --atestacion-sha256 <sha256 de F> --validos problemas-validos.json [--max 300]
//   node importar-vinculos.mjs --csv pares.csv ... --accion revertir --execute ...                # desactiva (versión+1, active=false) solo lo creado por este importador
//   (--sin-set-role: omite SET LOCAL ROLE vexa_backend si el transporte no puede cambiar de rol; los triggers de 0019 siguen exigiendo owner/tenant/fila vigente)
//   node importar-vinculos.mjs muestra --csv pares.csv --n 100 --semilla S                        # muestra reproducible para revisión humana (sin datos personales)
//
// CSV (cabecera obligatoria, UTF-8): problem_id, ledger_row_id | entity_id, metodo, ticket_ref_hash
//   - problem_id: uuid del problema (vector-problem-v1). ledger_row_id: fila del libro; entity_id: se resuelve a la revisión vigente.
//   - metodo: de la lista cerrada --metodos (por defecto «order_id__c_hubspot»). ticket_ref_hash: sha256 hex (64) de la referencia del ticket; NO es un dato personal.
//   - Es una ASOCIACIÓN DE APOYO (mismo order_id en ticket y pedido), no causalidad ni pérdida.
// Guardas de --execute: proyecto y tenant fijos; transporte solo supabase CLI enlazado (project-ref verificado) o socket Unix local (pruebas);
// owner activo verificado en la base; atestación por archivo + sha256 declarado por quien firma; dry-run previo del MISMO csv; problemas-validos obligatorio;
// lotes atómicos con statement_timeout y tope total de tiempo; recibos locales 0600; idempotente (reintentar es seguro).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {tenantPiloto} from '../../config/cliente-piloto.mjs';

// UUID de la organización piloto: VEXA_TENANT_ID o config local (config/cliente-piloto.mjs). Sin valor real por defecto.
export const TENANT = tenantPiloto();
export const PROJECT_REF = 'proyecto-ejemplo';
export const VERSION = 'v1';
export const MARCA = '[vinculos-importer ' + VERSION; // aparece en cada report; la reversa solo toca lo que lo lleve
export const METODOS_DEFECTO = ['order_id__c_hubspot'];
export const TIPOS_DEFECTO = ['order'];
const UUID = /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const HEX64 = /^[a-f0-9]{64}$/;
export const sha256 = x => createHash('sha256').update(x).digest('hex');
const lit = v => v === null || v === undefined ? 'null' : "'" + String(v).replace(/'/g, "''") + "'";
const scrub = s => String(s ?? '').replace(/postgres(?:ql)?:\/\/\S+/gi, '[url]').replace(/\b\d{9,}\b/g, '[n]');
const sinLiterales = s => s.replace(/\$[a-z]*\$[\s\S]*?\$[a-z]*\$/g, "''").replace(/'(?:[^']|'')*'/g, "''");

// ------------------------------------------------------------------------------------------------ CSV
export function parseCsv(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); cell = ''; if (row.some(x => x !== '')) rows.push(row); row = []; }
    else cell += c;
  }
  if (q) throw new Error('CSV_COMILLAS_SIN_CERRAR');
  row.push(cell); if (row.some(x => x !== '')) rows.push(row);
  return rows;
}

/** Valida forma del CSV (sin base). Devuelve {pares (válidos y únicos), rechazados:[{linea,motivo}]}. */
export function validarCsv(text, {metodos = METODOS_DEFECTO} = {}) {
  const rows = parseCsv(text.replace(/^﻿/, ''));
  if (!rows.length) throw new Error('CSV_VACIO');
  const head = rows[0].map(h => h.trim());
  const col = n => head.indexOf(n);
  if (col('problem_id') < 0 || col('metodo') < 0 || col('ticket_ref_hash') < 0 || (col('ledger_row_id') < 0 && col('entity_id') < 0)) throw new Error('CSV_CABECERA: se requieren problem_id, ledger_row_id|entity_id, metodo, ticket_ref_hash');
  const extra = head.filter(h => !['problem_id', 'ledger_row_id', 'entity_id', 'metodo', 'ticket_ref_hash'].includes(h));
  if (extra.length) throw new Error('CSV_COLUMNAS_DESCONOCIDAS: ' + extra.join(',')); // p. ej. una columna con datos personales no se acepta en silencio
  const pares = [], rechazados = [], visto = new Map();
  rows.slice(1).forEach((r, i) => {
    const linea = i + 2, g = n => (col(n) >= 0 ? (r[col(n)] ?? '').trim() : '');
    const problemId = g('problem_id').toLowerCase(), rowId = g('ledger_row_id').toLowerCase(), entId = g('entity_id').toLowerCase(), metodo = g('metodo'), ref = g('ticket_ref_hash').toLowerCase();
    const bad = m => rechazados.push({linea, motivo: m});
    if (!UUID.test(problemId)) return bad('problem_id_invalido');
    if ((rowId && entId) || (!rowId && !entId)) return bad('indique_solo_uno_de_ledger_row_id_o_entity_id');
    if (rowId && !UUID.test(rowId)) return bad('ledger_row_id_invalido');
    if (entId && !UUID.test(entId)) return bad('entity_id_invalido');
    if (!metodos.includes(metodo)) return bad('metodo_no_permitido');
    if (!HEX64.test(ref)) return bad('ticket_ref_hash_invalido');
    const refKind = rowId ? 'row' : 'entity', refId = rowId || entId, key = problemId + '|' + refKind + '|' + refId;
    if (visto.has(key)) return bad(visto.get(key) === metodo + '|' + ref ? 'duplicado_exacto_en_csv' : 'duplicado_con_metodo_o_ticket_distinto');
    visto.set(key, metodo + '|' + ref);
    pares.push({linea, problemId, refKind, refId, metodo, ref});
  });
  return {pares, rechazados};
}

// ------------------------------------------------------------------------------------------------ SQL
const T = lit(TENANT) + '::uuid';
const values = (pares) => pares.map((p, i) => `(${i},${lit(p.problemId)}::uuid,${lit(p.refKind)},${lit(p.refId)}::uuid)`).join(',\n');

/** SELECT de solo lectura: clasifica cada par contra la base. Una fila JSON por línea tras el marcador VINCULOS_PLAN. */
export function planSql(pares, {tipos = TIPOS_DEFECTO, accion = 'importar', tenant = TENANT} = {}) {
  if (!TENANT||tenant !== TENANT) throw new Error('TENANT_NO_AUTORIZADO');
  if (!pares.length) throw new Error('SIN_PARES');
  const ownerActivo = (u) => `exists(select 1 from public.memberships m where m.tenant_id=${T} and m.user_id=${u} and m.status='active' and m.role='owner')`;
  return `begin read only;
with par(idx,problem_id,ref_kind,ref_id) as (values
${values(pares)}),
sel as (
  select p.idx,p.problem_id,
    case p.ref_kind when 'row' then (select e.id from public.economic_ledger_entries e where e.tenant_id=${T} and e.id=p.ref_id)
                    else (select e.id from public.economic_ledger_entries e where e.tenant_id=${T} and e.entity_id=p.ref_id order by e.revision desc limit 1) end as row_id
  from par p),
det as (
  select s.idx,s.problem_id,s.row_id,e.entity_id,e.kind,e.revision,
    (e.revision=(select max(v.revision) from public.economic_ledger_entries v where v.tenant_id=${T} and v.entity_id=e.entity_id)) as ultima,
    ${ownerActivo('e.actor_id')} as actor_ok,
    exists(select 1 from (select sv.active,sv.actor_id from public.economic_source_versions sv where sv.tenant_id=${T} and sv.source_id=e.source_id order by sv.version desc limit 1) x
           where x.active and ${ownerActivo('x.actor_id')}) as fuente_ok,
    (select pv.provenance from public.problem_versions pv where pv.tenant_id=${T} and pv.problem_id=s.problem_id and pv.provenance->>'kind'='vector-problem-v1' order by pv.version desc limit 1) as prov,
    (select pr.archived_at is not null from public.problems pr where pr.tenant_id=${T} and pr.id=s.problem_id) as archivado,
    (select l.version from public.economic_problem_links l where l.tenant_id=${T} and l.problem_id=s.problem_id and l.entity_id=e.entity_id order by l.version desc limit 1) as prev_version,
    (select l.active from public.economic_problem_links l where l.tenant_id=${T} and l.problem_id=s.problem_id and l.entity_id=e.entity_id order by l.version desc limit 1) as prev_active,
    (select position(${lit(MARCA)} in l.report)>0 from public.economic_problem_links l where l.tenant_id=${T} and l.problem_id=s.problem_id and l.entity_id=e.entity_id order by l.version desc limit 1) as prev_nuestro
  from sel s left join public.economic_ledger_entries e on e.tenant_id=${T} and e.id=s.row_id),
ev as (
  select d.*,
    case when d.prov is null then null
         when jsonb_typeof(d.prov->'snapshot'->'embeddingIds')<>'array' or jsonb_array_length(d.prov->'snapshot'->'embeddingIds')=0 then false
         else not exists(select 1 from jsonb_array_elements_text(d.prov->'snapshot'->'embeddingIds') x(id)
                         where not exists(select 1 from public.problem_embedding_members m join public.extraction_runs r on r.tenant_id=m.tenant_id and r.id=m.extraction_run_id
                                          where m.tenant_id=${T} and m.embedding_id=x.id::uuid and m.problem_id=d.problem_id and r.status='succeeded')) end as evidencia_ok
  from det d)
select 'VINCULOS_PLAN '||json_build_object('idx',idx,'row_id',row_id,'entity_id',entity_id,'prev_version',prev_version,'estado',
  ${accion === 'revertir'
    ? `case when prev_version is null then 'sin_vinculo' when not prev_active then 'ya_inactivo' when not coalesce(prev_nuestro,false) then 'no_creado_por_importador' else 'revertir' end`
    : `case when row_id is null then 'fila_inexistente'
         when not (kind=any(array[${tipos.map(lit).join(',')}])) then 'tipo_no_permitido'
         when not (ultima and actor_ok and fuente_ok) then 'fila_no_vigente'
         when prov is null then 'problema_inexistente'
         when coalesce(archivado,false) then 'problema_archivado'
         when prov->'snapshot'->>'state' is distinct from 'active' or not coalesce(evidencia_ok,false) then 'problema_no_vigente'
         when prev_active then 'ya_vigente'
         when prev_version is not null then 'reactivar'
         else 'nuevo' end`})::text as resultado
from ev order by idx;
rollback;
`;
}

/** Bloque de contexto: tenant fijo, acción configure, actor owner explícito verificado en la base. */
export function contextoSql(owner) {
  if (!UUID.test(owner)) throw new Error('OWNER_INVALIDO');
  return `do $ctx$
begin
  if ${lit(TENANT)}::uuid<>${lit(TENANT)}::uuid then raise exception 'TENANT_NO_AUTORIZADO'; end if;
  perform set_config('vexa.tenant_id',${lit(TENANT)},true);
  perform set_config('vexa.action','configure',true);
  perform set_config('request.jwt.claim.sub',${lit(owner)},true);
  if (select count(*) from public.memberships where tenant_id=${T} and user_id=${lit(owner)}::uuid and role='owner' and status='active')<>1 then raise exception 'OWNER_NO_ACTIVO'; end if;
end $ctx$;`;
}

/** Lote de escritura ATÓMICO. `items`: {problemId, entityId, rowId, expected, report}. activo=false = reversa. Si algún par no inserta (versión cambiada, precondición), se aborta TODO el lote. */
export function loteSql({owner, items, activo, etiqueta, timeoutMs = 60000, lockMs = 10000, setRole = true}) {
  if (!items.length) throw new Error('LOTE_VACIO');
  for (const it of items) { if (![it.problemId, it.entityId, it.rowId].every(x => UUID.test(x)) || !Number.isInteger(it.expected) || it.expected < 0) throw new Error('ITEM_INVALIDO'); if (it.report.length < 20 || it.report.length > 4000) throw new Error('REPORT_FUERA_DE_RANGO'); if (/[$\u0000]/.test(it.report)) throw new Error('REPORT_CARACTER_NO_PERMITIDO'); }
  const vals = items.map(it => `(${lit(it.problemId)}::uuid,${lit(it.entityId)}::uuid,${lit(it.rowId)}::uuid,${it.expected},${lit(it.report)})`).join(',\n');
  return [
    'begin;',
    contextoSql(owner),
    `set local statement_timeout='${Number(timeoutMs)}ms';`,
    `set local lock_timeout='${Number(lockMs)}ms';`,
    `select pg_advisory_xact_lock(hashtextextended(${lit(TENANT)}||':economic-ledger',0));`,
    `select pg_advisory_xact_lock(hashtextextended(${lit(TENANT)}||':economic-relations',0));`,
    ...(setRole ? ['set local role vexa_backend;'] : []),
    `do $lote$
declare n int;
begin
  insert into public.economic_problem_links(tenant_id,problem_id,entity_id,ledger_row_id,version,active,actor_id,report,attested)
  select ${T},p.problem_id,p.entity_id,p.row_id,p.expected+1,${activo ? 'true' : 'false'},${lit(owner)}::uuid,p.report,true
  from (values
${vals}) p(problem_id,entity_id,row_id,expected,report)
  where coalesce((select max(l.version) from public.economic_problem_links l where l.tenant_id=${T} and l.problem_id=p.problem_id and l.entity_id=p.entity_id),0)=p.expected;
  get diagnostics n=row_count;
  if n<>${items.length} then raise exception 'VINCULOS_LOTE_ABORTADO insertados=% esperados=${items.length}',n; end if;
end $lote$;`,
    `select 'VINCULOS_RESULT ${etiqueta} pares=${items.length} insertados=${items.length}' as resultado;`,
    'commit;',
  ].join('\n') + '\n';
}

/** Lista cerrada de sentencias del archivo que se ejecutará. */
export function soloPermitidas(sql) {
  const plano = sql.replace(/do \$(ctx|lote)\$[\s\S]*?\$\1\$;/g, 'do $$$1$$;'); // los cuerpos DO se revisan aparte
  const stm = plano.split(/;\s*\n/).map(s => s.trim()).filter(Boolean);
  const ok = /^(begin( read only)?|commit|rollback|do \$(ctx|lote)\$|set local (statement_timeout|lock_timeout|role vexa_backend)|select pg_advisory_xact_lock|with par\(|select 'VINCULOS_(RESULT|OWNER|PLAN))/i;
  const inserts = sql.match(/insert\s+into\s+[\w.]+/gi) ?? [];
  const sinStr = sql.replace(/'(?:[^']|'')*'/g, "''");
  return stm.every(s => ok.test(s)) && inserts.length <= 1 && inserts.every(i => /^insert\s+into\s+public\.economic_problem_links$/i.test(i)) && !/\b(delete|update|drop|alter|truncate|grant|revoke|create|copy)\b/i.test(sinStr);
}

// ------------------------------------------------------------------------------------------------ transporte
export function ejecutor({socket = null, linked = false, repo = path.join(os.homedir(), 'vexa'), db = 't', user = 'postgres'}) {
  if (!!socket === !!linked) throw new Error('TRANSPORTE: indique exactamente uno de --pg-socket DIR | --supabase-linked');
  if (socket) {
    if (!path.isAbsolute(socket)) throw new Error('--pg-socket debe ser una ruta absoluta (socket Unix local)');
    return {nombre: 'socket-local', remoto: false, run: file => { const r = spawnSync('psql', ['-h', socket, '-U', user, '-d', db, '-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-f', file], {encoding: 'utf8', maxBuffer: 256 * 1024 * 1024}); return {status: r.status, out: (r.stdout ?? '') + '\n' + (r.stderr ?? '')}; }};
  }
  const g = path.join(repo, 'supabase/.temp/project-ref');
  if (!fs.existsSync(g) || fs.readFileSync(g, 'utf8').trim() !== PROJECT_REF) throw new Error(`el proyecto enlazado NO es ${PROJECT_REF}; sin cambios`);
  return {nombre: 'supabase-linked', remoto: true, run: file => { const r = spawnSync('supabase', ['db', 'query', '--linked', '--project-ref', PROJECT_REF, '-f', file], {encoding: 'utf8', cwd: repo, maxBuffer: 256 * 1024 * 1024}); return {status: r.status, out: (r.stdout ?? '') + '\n' + (r.stderr ?? '')}; }};
}

/** true mientras no se haya agotado el tope total (segundos) desde `inicio` (ms). */
export const dentroDeTope = (inicio, topeSeg, ahora = Date.now()) => (ahora - inicio) / 1000 <= topeSeg;
const trozos = (a, n) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };
const escribir = (f, s) => { fs.writeFileSync(f, s, {mode: 0o600}); fs.chmodSync(f, 0o600); return f; };
const parsePlan = out => out.split('\n').filter(l => l.startsWith('VINCULOS_PLAN ')).map(l => JSON.parse(l.slice(14)));

/** Clasifica todos los pares contra la base (solo lectura, en trozos de 2000). */
export function planificar({pares, exec, dir, tipos, accion}) {
  const res = new Array(pares.length);
  trozos(pares.map((p, i) => ({...p, i})), 2000).forEach((tz, k) => {
    const f = escribir(path.join(dir, `plan-${accion}-${String(k).padStart(3, '0')}.sql`), planSql(tz, {tipos, accion}));
    const r = exec.run(f);
    const filas = parsePlan(r.out);
    if (r.status !== 0 || filas.length !== tz.length) throw new Error(`PLAN_FALLIDO (código ${r.status}, filas ${filas.length}/${tz.length}): ${scrub(r.out.split('\n').filter(l => /ERROR/.test(l)).slice(0, 2).join(' | ')).slice(0, 200)}`);
    for (const x of filas) res[tz[x.idx].i] = {...pares[tz[x.idx].i], estado: x.estado, rowId: x.row_id, entityId: x.entity_id, prevVersion: x.prev_version};
  });
  return res;
}

export const conteo = xs => xs.reduce((o, x) => (o[x.estado] = (o[x.estado] ?? 0) + 1, o), {});

export function textoReporte({atestacion, metodo, ref, csvSha}) {
  return `${atestacion.trim()}\n${MARCA} lote=${csvSha.slice(0, 12)} metodo=${metodo} ticket_ref=${ref}]`;
}

// ------------------------------------------------------------------------------------------------ muestra reproducible
/** Muestra aleatoria reproducible: orden por sha256(semilla|problem|ref); sin datos personales (solo ids/hashes). */
export function muestra(pares, {n, semilla}) {
  if (!semilla) throw new Error('--semilla obligatoria (reproducibilidad)');
  return [...pares].map(p => ({p, k: sha256(`${semilla}|${p.problemId}|${p.refKind}|${p.refId}`)})).sort((a, b) => a.k.localeCompare(b.k)).slice(0, n)
    .map((x, i) => ({n: i + 1, problem_id: x.p.problemId, ref_kind: x.p.refKind, ref_id: x.p.refId, metodo: x.p.metodo, ticket_ref_hash: x.p.ref}));
}

// ------------------------------------------------------------------------------------------------ CLI
function argv(a) {
  const flag = n => a.includes('--' + n), opt = (n, d = null) => { const i = a.indexOf('--' + n); return i >= 0 ? a[i + 1] : d; };
  return {flag, opt};
}
const entero = (v, nombre, def) => { if (v === null || v === undefined) return def; if (!/^[1-9]\d{0,8}$/.test(v)) throw new Error(`--${nombre} debe ser un entero positivo`); return Number(v); };

export async function main(a) {
  const {flag, opt} = argv(a);
  if (flag('help') || !a.length) { console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 17).map(l => l.replace(/^\/\/ ?/, '')).join('\n')); return 0; }
  const csvFile = opt('csv'); if (!csvFile) throw new Error('Falta --csv');
  const tenant = opt('tenant', TENANT); if (!TENANT||tenant !== TENANT) throw new Error('TENANT_NO_AUTORIZADO');
  const metodos = (opt('metodos') ?? METODOS_DEFECTO.join(',')).split(',').map(s => s.trim()).filter(Boolean);
  const tipos = (opt('tipos') ?? TIPOS_DEFECTO.join(',')).split(',').map(s => s.trim()).filter(Boolean);
  if (!tipos.every(t => ['order', 'refund', 'reversal', 'replacement', 'support_model'].includes(t))) throw new Error('--tipos inválido');
  const csvText = fs.readFileSync(csvFile, 'utf8'), csvSha = sha256(csvText);
  const v = validarCsv(csvText, {metodos});
  if (a[0] === 'muestra') {
    const m = muestra(v.pares, {n: entero(opt('n'), 'n', 100), semilla: opt('semilla')});
    const cols = ['n', 'problem_id', 'ref_kind', 'ref_id', 'metodo', 'ticket_ref_hash'];
    const salida = [cols.join(','), ...m.map(r => cols.map(c => r[c]).join(','))].join('\n') + '\n';
    const o = opt('salida'); if (o) { escribir(o, salida); console.log(JSON.stringify({muestra: m.length, de: v.pares.length, semilla_sha: sha256(opt('semilla')).slice(0, 12), archivo: o})); } else process.stdout.write(salida);
    return 0;
  }
  const accion = opt('accion', 'importar'); if (!['importar', 'revertir'].includes(accion)) throw new Error('--accion: importar|revertir');
  const execute = flag('execute');
  const recibos = opt('recibos', path.join(os.homedir(), '.vexa-vinculos', 'recibos'));
  const dir = path.join(recibos, csvSha.slice(0, 12)); fs.mkdirSync(dir, {recursive: true, mode: 0o700});
  const max = entero(opt('max'), 'max', 0), chunk = entero(opt('chunk'), 'chunk', 250), topeTotal = entero(opt('tope-total-s'), 'tope-total-s', 600), timeoutMs = entero(opt('timeout-lote-ms'), 'timeout-lote-ms', 60000);
  if (chunk > 250) throw new Error('--chunk máximo 250');
  let pares = v.pares; if (max) pares = pares.slice(0, max);
  const resumen = {version: VERSION, accion, modo: execute ? 'execute' : 'dry-run', csv_sha256: csvSha, pares_csv: v.pares.length + v.rechazados.length, pares_forma_valida: v.pares.length, rechazados_forma: v.rechazados.length, motivos_forma: conteo(v.rechazados.map(r => ({estado: r.motivo}))), considerados: pares.length, tipos, metodos};

  // ---- validos
  let validos = null; const vf = opt('validos');
  if (vf) { const j = JSON.parse(fs.readFileSync(vf, 'utf8')); validos = new Set(j.validos); if (![...validos].every(x => UUID.test(x))) throw new Error('problemas-validos.json inválido'); resumen.validos_sha256 = sha256(fs.readFileSync(vf, 'utf8')); }

  // ---- guardas de ejecución (antes de tocar nada)
  let atestacion = null, owner = null;
  if (execute) {
    if (opt('confirmar-proyecto') !== PROJECT_REF) throw new Error(`--execute exige --confirmar-proyecto ${PROJECT_REF}`);
    owner = opt('owner'); if (!UUID.test(owner ?? '')) throw new Error('Falta --owner <uuid del owner activo>: la atestación la hace una persona, no el programa.');
    const af = opt('atestacion-archivo'); if (!af || !fs.existsSync(af)) throw new Error('Falta --atestacion-archivo con el texto escrito y firmado por el owner.');
    const raw = fs.readFileSync(af, 'utf8'); atestacion = raw.trim();
    if (atestacion.length < 20 || atestacion.length > 3500) throw new Error('La atestación debe tener entre 20 y 3500 caracteres.');
    if (/SIN ATESTAR/i.test(atestacion)) throw new Error('El archivo contiene un marcador de «SIN ATESTAR».');
    if (opt('atestacion-sha256') !== sha256(raw)) throw new Error('--atestacion-sha256 no coincide con el archivo: el owner declara el hash del texto que firmó.');
    if (accion === 'importar' && !validos) throw new Error('--validos (problemas-validos.json de snapshot.mjs) es obligatorio para escribir.');
    if (!fs.existsSync(path.join(dir, `dry-run-${accion}.json`))) throw new Error('Falta un dry-run previo de ESTE csv y acción (recibo dry-run-' + accion + '.json).');
    resumen.atestacion_sha256 = sha256(raw);
  }

  // ---- sin transporte: solo forma del CSV
  const tieneTransporte = !!(opt('pg-socket') || flag('supabase-linked'));
  if (!tieneTransporte) {
    if (execute) throw new Error('--execute exige transporte: --supabase-linked o --pg-socket DIR');
    resumen.validacion = 'SOLO FORMA DEL CSV: NO se validó contra la base (existencia, versión vigente, actor, duplicados con la base).';
    escribir(path.join(dir, `dry-run-${accion}.json`), JSON.stringify({...resumen, parcial_sin_base: true}, null, 1));
    console.log(JSON.stringify(resumen)); return 0;
  }
  const exec = ejecutor({socket: opt('pg-socket'), linked: flag('supabase-linked'), repo: opt('repo', path.join(os.homedir(), 'vexa'))});
  if (execute && !exec.remoto && exec.nombre !== 'socket-local') throw new Error('transporte no autorizado');

  // ---- owner activo (lectura)
  if (execute) {
    const f = escribir(path.join(dir, 'owner-check.sql'), `begin read only;\nselect 'VINCULOS_OWNER '||count(*) from public.memberships where tenant_id=${T} and user_id=${lit(owner)}::uuid and role='owner' and status='active';\nrollback;\n`);
    const r = exec.run(f); if (r.status !== 0 || !/VINCULOS_OWNER 1\b/.test(r.out)) throw new Error('OWNER_NO_ACTIVO en el tenant fijado');
  }

  // ---- plan contra la base
  const plan = planificar({pares, exec, dir, tipos, accion});
  if (validos && accion === 'importar') for (const p of plan) if (['nuevo', 'reactivar', 'ya_vigente'].includes(p.estado) && !validos.has(p.problemId)) p.estado = 'problema_fuera_de_validos';
  resumen.plan = conteo(plan);
  // entidad+problema repetidos vía ledger_row_id y entity_id distintos en el CSV: se cuentan una sola vez
  const vistos = new Set(); for (const p of plan) { const k = p.problemId + '|' + p.entityId; if (['nuevo', 'reactivar', 'revertir'].includes(p.estado)) { if (vistos.has(k)) p.estado = 'duplicado_resuelto_a_la_misma_entidad'; vistos.add(k); } }
  resumen.plan = conteo(plan);
  const accionables = plan.filter(p => accion === 'revertir' ? p.estado === 'revertir' : ['nuevo', 'reactivar'].includes(p.estado));
  resumen.accionables = accionables.length;
  resumen.no_accionables = plan.length - accionables.length;
  if (!execute) {
    escribir(path.join(dir, `dry-run-${accion}.json`), JSON.stringify(resumen, null, 1));
    escribir(path.join(dir, `plan-${accion}.json`), JSON.stringify(plan.map(p => ({linea: p.linea, problem_id: p.problemId, entity_id: p.entityId, estado: p.estado})), null, 1));
    console.log('DRY-RUN. Nada se escribió en la base.', JSON.stringify(resumen)); return 0;
  }

  // ---- ejecución por lotes, con tope de tiempo y recibos
  const inicio = Date.now(); const lotes = []; let hechos = 0;
  let k = 0;
  for (const lote of trozos(accionables, chunk)) {
    if (!dentroDeTope(inicio, topeTotal)) { resumen.detenido_por_tope_total = true; break; }
    k++; const etiqueta = `${accion}-${String(k).padStart(4, '0')}`;
    const items = lote.map(p => ({problemId: p.problemId, entityId: p.entityId, rowId: p.rowId, expected: p.prevVersion ?? 0, report: textoReporte({atestacion, metodo: p.metodo, ref: p.ref, csvSha})}));
    const sql = loteSql({owner, items, activo: accion === 'importar', etiqueta, timeoutMs, setRole: !flag('sin-set-role')});
    if (!soloPermitidas(sql)) throw new Error('SQL con sentencias no permitidas');
    const f = escribir(path.join(dir, `lote-${etiqueta}.sql`), sql), t0 = Date.now();
    const r = exec.run(f); const ok = r.status === 0 && new RegExp(`VINCULOS_RESULT ${etiqueta} pares=${items.length} insertados=${items.length}`).test(r.out);
    const rec = {etiqueta, pares: items.length, ok, ms: Date.now() - t0, sql_sha256: sha256(sql)};
    if (!ok) rec.error = scrub(r.out.split('\n').filter(l => /ERROR|VINCULOS_LOTE_ABORTADO|OWNER_NO_ACTIVO|violat/.test(l)).slice(0, 2).join(' | ')).slice(0, 300);
    lotes.push(rec); escribir(path.join(dir, `recibo-${etiqueta}.json`), JSON.stringify(rec, null, 1));
    if (!ok) { resumen.fallo = rec; break; }
    hechos += items.length; console.log(`${etiqueta} pares=${items.length} ok ms=${rec.ms}`);
  }
  resumen.lotes = lotes.length; resumen.escritos = hechos; resumen.segundos = Math.round((Date.now() - inicio) / 1000);
  escribir(path.join(dir, `recibo-${accion}-final.json`), JSON.stringify({...resumen, lotes}, null, 1));
  console.log(JSON.stringify(resumen));
  return resumen.fallo ? 1 : 0;
}

if (import.meta.url === `file://${process.argv[1]}`) main(process.argv.slice(2)).then(c => process.exit(c)).catch(e => { console.error('ERROR', scrub(e.message).slice(0, 400)); process.exit(1); });
