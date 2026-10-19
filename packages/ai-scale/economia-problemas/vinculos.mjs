#!/usr/bin/env node
// PASO 2: vínculos problema -> pedido/reembolso (public.economic_problem_links). SQL solo-INSERT, idempotente, con DRY-RUN por defecto.
//   node vinculos.mjs                                   # DRY-RUN: lee pares-economia.jsonl, escribe los .sql a disco, imprime conteos; NO toca la base
//   node vinculos.mjs --medir [--max 2000]              # SELECT de solo lectura contra la base (conteos agregados; sin identificadores)
//   node vinculos.mjs --run --rollback-test --owner U --atestacion-archivo F --max 300     # INSERT real dentro de una transacción que se DESHACE (dispara todos los triggers/guardas)
//   node vinculos.mjs --run --commit --owner U --atestacion-archivo F --max 300            # CANARIO: escribe de verdad solo --max pares
//   node vinculos.mjs --run --commit --owner U --atestacion-archivo F                      # todo (lotes de --chunk pares; reanudable)
// ATESTACIÓN: economic_problem_links exige que un OWNER atestigüe cada vínculo (columnas actor_id/report/attested). Este programa NO la fabrica:
//   --owner <uuid del owner activo> y --atestacion-archivo <texto de al menos 20 caracteres escrito por Javier> son obligatorios para escribir.
// Guardas: proyecto proyecto-ejemplo y tenant ab12cd34-... fijos; lista cerrada de sentencias; solo INSERT en economic_problem_links; los problemas
// sin evidencia vigente (problemas-validos.json de snapshot.mjs) NO reciben vínculos (uno solo inválido deja sin cifras a todo el alcance).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {TENANT, PROJECT_REF, insertarSql, pruebaReversaSql, medirSql, cteNuevo, soloPermitidas, lit, verificacionSql, DIAG} from './sqlgen.mjs';
import {textoReporte, REGLA_VERSION} from './reglas.mjs';
import {OUT_DEFAULT, TICKETS_FILE} from './puente.mjs';

const UUID = /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const scrub = s => String(s ?? '').replace(/\b\d{9,}\b/g, '[n]').replace(/postgres(?:ql)?:\/\/\S+/gi, '[url]');
const intOpt = (v, name, def) => { if (v === null || v === undefined) return def; if (!/^[1-9]\d{0,8}$/.test(v)) throw new Error(`--${name} debe ser un entero positivo`); return Number(v); };

export function leerPares(file) { return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)); }
export const trozos = (arr, n) => { const o = []; for (let i = 0; i < arr.length; i += n) o.push(arr.slice(i, i + n)); return o; };

/** Orden estable (ticket, tipo, entidad) y recorte de canario. */
export function seleccionar(pares, {kind, max, desde = null}) {
  // Más recientes primero (fecha efectiva del ticket en economia-tickets.csv): son las más probables dentro de la cohorte de «últimos 3 meses».
  let p = pares.filter(x => (kind === 'all' || x.kind === kind) && (!desde || (x.fecha && x.fecha >= desde)))
    .sort((a, b) => ((b.fecha ?? '') + '').localeCompare((a.fecha ?? '') + '') || (a.ticket + a.kind + a.entityId).localeCompare(b.ticket + b.kind + b.entityId));
  if (max) p = p.slice(0, max);
  return p;
}

export function reportes({atestacion, kind, fuenteSha}) {
  return Object.fromEntries(['A', 'B', 'C'].map(t => [t, textoReporte({atestacion, kind, tiers: [t], fuenteSha})]));
}

// ---- ejecutores
export function ejecutorSupabase({repo, ref = PROJECT_REF}) {
  return file => {
    const g = path.join(repo, 'supabase/.temp/project-ref');
    if (!fs.existsSync(g) || fs.readFileSync(g, 'utf8').trim() !== ref) throw new Error(`el proyecto enlazado NO es ${ref}; sin cambios`);
    const r = spawnSync('supabase', ['db', 'query', '--linked', '--project-ref', ref, '-f', file], {encoding: 'utf8', cwd: repo, maxBuffer: 64 * 1024 * 1024});
    return {status: r.status, out: (r.stdout ?? '') + '\n' + (r.stderr ?? '')};
  };
}
export function ejecutorPsql({socket, db = 't', user = 'postgres'}) {
  return file => {
    const r = spawnSync('psql', ['-h', socket, '-U', user, '-d', db, '-X', '-q', '-1', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-f', file], {encoding: 'utf8', maxBuffer: 64 * 1024 * 1024});
    return {status: r.status, out: (r.stdout ?? '') + '\n' + (r.stderr ?? '')};
  };
}

const parseLinks = out => { const m = /ECON_LINKS_RESULT (\S+) (\S+) pares=(\d+) candidatos=(\d+) insertados=(\d+) ya_existian=(\d+)/.exec(out); return m ? {etiqueta: m[1], kind: m[2], pares: +m[3], candidatos: +m[4], insertados: +m[5], ya_existian: +m[6]} : null; };
const parseRollback = out => { const m = /ECON_ROLLBACK_TEST insertados_en_la_transaccion=(\d+)/.exec(out); return m ? +m[1] : null; };
export const parseTop = out => { const m = /ECON_TOP ([0-9a-f,-]*)/.exec(out); return m ? m[1].split(',').filter(Boolean) : null; };

/** SELECT de solo lectura: ids de los N problemas con más entidades ligadas (para acotar el trabajo del snapshot). */
export function rankTopSql({tenant, kind, pares, validos, n}) {
  return `${cteNuevo({tenant, kind, pares, validos})}
select 'ECON_TOP '||coalesce(string_agg(problem_id::text,',' order by e desc,problem_id),'') as resultado
from (select problem_id,count(distinct entity_id) as e from nuevo group by 1 order by e desc,problem_id limit ${Number(n)}) r;`;
}

async function cli() {
  const a = process.argv.slice(2), flag = n => a.includes('--' + n), opt = (n, d = null) => { const i = a.indexOf('--' + n); return i >= 0 ? a[i + 1] : d; };
  const out = opt('out', OUT_DEFAULT), repo = opt('repo', path.join(os.homedir(), 'vexa'));
  const tenant = opt('tenant', TENANT); if (tenant !== TENANT) throw new Error('TENANT_NO_AUTORIZADO');
  const kind = opt('tipo', 'all'); if (!['order', 'refund', 'all'].includes(kind)) throw new Error('--tipo: order|refund|all');
  const max = intOpt(opt('max'), 'max', 0), chunk = intOpt(opt('chunk'), 'chunk', 1500), top = intOpt(opt('top-problemas'), 'top-problemas', 0);
  const run = flag('run'), commit = flag('commit'), rb = flag('rollback-test'), medir = flag('medir');
  const desde = opt('desde'); if (desde && !/^\d{4}-\d{2}-\d{2}$/.test(desde)) throw new Error('--desde debe ser YYYY-MM-DD');
  if (run && commit === rb) throw new Error('--run exige exactamente uno: --rollback-test o --commit');
  const resumenPares = fs.existsSync(path.join(out, 'puente-resumen.json')) ? JSON.parse(fs.readFileSync(path.join(out, 'puente-resumen.json'), 'utf8')) : null;
  const fuenteSha = resumenPares?.tickets_sha256 ?? TICKETS_FILE.sha256;
  const todos = leerPares(opt('pares', path.join(out, 'pares-economia.jsonl')));
  if (resumenPares && createHash('sha256').update(fs.readFileSync(opt('pares', path.join(out, 'pares-economia.jsonl')))).digest('hex') !== resumenPares.archivo_pares_sha256) throw new Error('pares-economia.jsonl no coincide con puente-resumen.json: repita puente.mjs');
  let validos = null;
  const vf = opt('validos', path.join(out, 'problemas-validos.json'));
  if (fs.existsSync(vf) && !flag('sin-validos')) { validos = JSON.parse(fs.readFileSync(vf, 'utf8')).validos; if (!validos.every(v => UUID.test(v))) throw new Error('problemas-validos.json inválido'); }
  const escribe = run;
  let atestacion = null, owner = null;
  if (escribe) {
    owner = opt('owner'); if (!UUID.test(owner ?? '')) throw new Error('Falta --owner <uuid del owner activo>: la atestación la hace una persona, no el programa.');
    const af = opt('atestacion-archivo'); if (!af || !fs.existsSync(af)) throw new Error('Falta --atestacion-archivo F con el texto de atestación escrito por Javier (≥20 caracteres).');
    atestacion = fs.readFileSync(af, 'utf8').trim(); if (atestacion.length < 20 || atestacion.length > 2500) throw new Error('La atestación debe tener entre 20 y 2500 caracteres.');
    if (!validos) throw new Error('Falta problemas-validos.json (corra snapshot.mjs problemas-validos) o indique --sin-validos bajo su responsabilidad.');
  }
  fs.mkdirSync(path.join(out, 'sql-vinculos'), {recursive: true, mode: 0o700});
  const dir = path.join(out, 'sql-vinculos'); for (const f of fs.readdirSync(dir)) fs.rmSync(path.join(dir, f));
  const w = (n, s) => { const f = path.join(dir, n); fs.writeFileSync(f, s, {mode: 0o600}); return f; };
  const exec = !(run || medir || top) ? null : opt('pg-socket') ? ejecutorPsql({socket: opt('pg-socket'), db: opt('pg-db', 't')}) : ejecutorSupabase({repo});

  let elegidos = seleccionar(todos, {kind, max, desde});
  // Acotar a los N problemas con más entidades (limita el trabajo del snapshot: cada lectura revalida la evidencia de TODOS los mensajes de los problemas con vínculos)
  if (top) {
    const rk = [];
    for (const k of ['order', 'refund']) { const ps = elegidos.filter(p => p.kind === k); if (!ps.length) continue; const f = w(`rank-${k}.sql`, rankTopSql({tenant, kind: k, pares: ps, validos, n: top})); const r = exec(f); const t = parseTop(r.out); if (!t) throw new Error('rank sin resultado'); rk.push(...t); }
    validos = [...new Set(rk)]; fs.writeFileSync(path.join(out, 'problemas-top.json'), JSON.stringify({top, validos}), {mode: 0o600});
  }
  const conteo = {regla: REGLA_VERSION, modo: run ? (commit ? 'commit' : 'rollback-test') : medir ? 'medir' : 'dry-run', pares_totales: todos.length, pares_elegidos: elegidos.length, tickets: new Set(elegidos.map(p => p.ticket)).size, problemas_permitidos: validos ? validos.length : null, max: max || null, desde: desde || null, chunk, top: top || null};
  const porKind = {};
  for (const k of ['order', 'refund']) { const ps = elegidos.filter(p => p.kind === k); if (ps.length) porKind[k] = ps; }
  const stmts = [];
  const recibo = {...conteo, lotes: []};
  for (const [k, ps] of Object.entries(porKind)) {
    const rep = escribe ? reportes({atestacion, kind: k, fuenteSha}) : reportes({atestacion: 'SIN ATESTAR (dry-run): este texto no se ejecuta.', kind: k, fuenteSha});
    let i = 0;
    for (const lote of trozos(ps, chunk)) {
      i++;
      const o = {tenant, owner: owner ?? '00000000-0000-4000-8000-000000000000', kind: k, pares: lote, validos, reportes: rep, etiqueta: `${k}-${String(i).padStart(4, '0')}`};
      const sql = run ? (commit ? insertarSql(o) : pruebaReversaSql(o)) : insertarSql(o);
      if (!soloPermitidas(sql.filter(s => s !== 'begin;' && s !== 'rollback;')) ) throw new Error('SQL con sentencias no permitidas');
      const f = w(`${k}-${String(i).padStart(4, '0')}.sql`, sql.join('\n') + '\n');
      stmts.push({file: f, kind: k, pares: lote.length, etiqueta: o.etiqueta});
      if (medir) { const mf = w(`medir-${k}-${String(i).padStart(4, '0')}.sql`, medirSql({tenant, kind: k, pares: lote, validos, etiqueta: o.etiqueta})); stmts[stmts.length - 1].medir = mf; }
    }
  }
  if (!run && !medir) { console.log('DRY-RUN. Nada se ejecutó.', JSON.stringify({...conteo, archivos_sql: stmts.length, directorio: dir, nota: 'Los .sql contienen identificadores de tickets/pedidos: carpeta privada 0700.'})); return; }
  if (medir) {
    // una sola sentencia con TODOS los pares de cada tipo (conteos distintos exactos); si no cabe, use --max
    for (const [k, ps] of Object.entries(porKind)) {
      const f = w(`medir-${k}-completo.sql`, medirSql({tenant, kind: k, pares: ps, validos, etiqueta: 'completo-' + k}));
      const r = exec(f); const line = r.out.split('\n').find(l => /ECON_MEDICION/.test(l));
      if (r.status !== 0 || !line) { console.error(`medición ${k} falló (código ${r.status}). No se imprime stderr.`); process.exit(1); }
      console.log(`medición ${k} (${ps.length} pares):`, line.replace(/\s+/g, ' ').trim());
    }
    return;
  }
  let ins = 0, ya = 0, cand = 0, done = 0;
  for (const s of stmts) {
    const r = exec(s.file);
    if (rb) {
      const n = parseRollback(r.out);
      if (n === null) { console.error(`rollback-test ${path.basename(s.file)} falló (código ${r.status}); stderr omitido (puede contener datos).`); console.error(scrub(r.out.split('\n').filter(l => /ERROR|error|violat|OWNER|TENANT/.test(l)).slice(0, 2).join(' | ')).slice(0, 300)); process.exit(1); }
      ins += n; done++; recibo.lotes.push({etiqueta: s.etiqueta, pares: s.pares, insertados_y_deshechos: n}); console.log(`rollback-test ${s.etiqueta}: ${n} vínculos habrían entrado (deshecho)`);
    } else {
      const p = parseLinks(r.out);
      if (r.status !== 0 || !p) { console.error(`lote ${path.basename(s.file)} falló (código ${r.status}); detenido. Reanudar es seguro (idempotente).`); console.error(scrub(r.out.split('\n').filter(l => /ERROR|error|violat|OWNER|TENANT/.test(l)).slice(0, 2).join(' | ')).slice(0, 300)); process.exit(1); }
      if (p.pares !== s.pares) throw new Error('pares procesados distintos de los esperados');
      ins += p.insertados; ya += p.ya_existian; cand += p.candidatos; done++; recibo.lotes.push({etiqueta: p.etiqueta, pares: p.pares, candidatos: p.candidatos, insertados: p.insertados, ya_existian: p.ya_existian});
      console.log(`${s.etiqueta} pares=${p.pares} candidatos=${p.candidatos} insertados=${p.insertados} ya_existian=${p.ya_existian}`);
    }
  }
  recibo.resumen = {lotes: done, insertados: ins, ya_existian: ya, candidatos: cand, ts: new Date().toISOString()};
  fs.writeFileSync(path.join(out, `recibo-vinculos-${recibo.modo}.json`), JSON.stringify(recibo, null, 1), {mode: 0o600});
  if (commit) { const vf2 = w('verificacion.sql', verificacionSql({tenant})); console.log('Verificación de solo lectura escrita en', vf2); }
  console.log(JSON.stringify(recibo.resumen));
}
if (import.meta.url === `file://${process.argv[1]}`) cli().catch(e => { console.error('ERROR', scrub(e.message).slice(0, 300)); process.exit(1); });
export {DIAG};
