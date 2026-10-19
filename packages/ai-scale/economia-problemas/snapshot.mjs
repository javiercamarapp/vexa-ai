#!/usr/bin/env node
// PASO 3 (Node, con conexión Postgres): valida problemas, mide la exposición, prepara y publica el snapshot económico que consumen
// Resumen y Explorador, usando el CÓDIGO REAL del producto (packages/metrics/{exposure,snapshots}.mjs) sobre la misma frontera
// de base de datos que packages/platform/src/db.ts (BEGIN, SET LOCAL ROLE vexa_backend, GUCs de sesión, membresía revalidada).
// Por qué en Node y no en SQL: input_hash/manifest del snapshot se calculan en JS sobre filas del libro y la lectura re-verifica la
// integridad; un SQL equivalente no sería reproducible. Esto requiere una conexión Postgres que SOLO pone Javier:
//   export VEXA_DB_URL='postgresql://postgres.<ref>:<clave>@<pooler>:5432/postgres'   (Supabase > Connect > Session pooler; nunca se imprime)
//
// Subcomandos (todos de SOLO LECTURA salvo los marcados ESCRIBE):
//   problemas-validos --alcance A     lee la exposición y guarda los ids de problemas con evidencia vigente (los únicos que deben llevar vínculos)
//   medir --alcance A                 calcula la exposición viva (readExposure) y la resume (sin snapshot)
//   preparar --alcance A --rollback-test   ESCRIBE y DESHACE: prepara el snapshot en BEGIN..ROLLBACK (verifica triggers/hash/integridad)
//   preparar --alcance A --commit    ESCRIBE: deja el snapshot en borrador (visible solo para owners)
//   cobertura --alcance A --complete true|false --reporte-archivo F [--commit]   ESCRIBE (atestación del owner; ver nota)
//   publicar --snapshot-id U --content-hash H --publicar   ESCRIBE: publica y fija la cabeza del alcance
// Todo lo que escribe exige --owner <uuid> (owner activo del tenant) y falla sin él; nada se infiere ni se fabrica.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import pg from 'pg';
import {createSnapshotRepository} from '../../metrics/snapshots.mjs';
import {readExposure, createExposureRepository} from '../../metrics/exposure.mjs';
import {TENANT, PROJECT_REF} from '../sql.mjs';
import {BASIS_ORDER_MP, BASIS_REFUND_MP, BASIS_SHOPIFY} from './reglas.mjs';
import {OUT_DEFAULT} from './puente.mjs';

const UUID = /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
export const scrub = s => String(s ?? '').replace(/postgres(?:ql)?:\/\/[^\s'"]+/gi, '[url]').replace(/sk-[A-Za-z0-9_-]{8,}/g, '[redactado]').replace(/\b\d{9,}\b/g, '[n]');

// Alcances predefinidos. Un snapshot = UNA moneda y UNA base; los reembolsos de marketplaces tienen otra base que los pedidos (ver informe).
export const ALCANCES = Object.freeze({
  'marketplaces-usd': {start: '2025-10-01T00:00:00.000Z', end: '2026-10-02T00:00:00.000Z', currency: 'USD', exponent: 2, basis: BASIS_ORDER_MP},
  'marketplaces-cad': {start: '2025-10-01T00:00:00.000Z', end: '2026-10-02T00:00:00.000Z', currency: 'CAD', exponent: 2, basis: BASIS_ORDER_MP},
  'devoluciones-usd': {start: '2025-10-01T00:00:00.000Z', end: '2026-10-02T00:00:00.000Z', currency: 'USD', exponent: 2, basis: BASIS_REFUND_MP},
  'shopify-usd': {start: '2026-08-01T00:00:00.000Z', end: '2026-10-06T00:00:00.000Z', currency: 'USD', exponent: 2, basis: BASIS_SHOPIFY},
});
export const alcance = (nombre, extra = {}) => {
  const a = ALCANCES[nombre]; if (!a) throw new Error('ALCANCE_DESCONOCIDO: ' + Object.keys(ALCANCES).join(', '));
  return {...a, ...extra, timezone: 'UTC', dateBasis: 'occurred_at'};
};

/** Frontera idéntica a createDatabase() de packages/platform/src/db.ts (las mismas sentencias), con tiempo límite configurable. */
export function crearBaseDatos({pool, tenantId, userId, statementTimeoutMs = 600000}) {
  if (!UUID.test(tenantId) || !UUID.test(userId)) throw new Error('IDS_INVALIDOS');
  const roles = {read: ['owner', 'analyst', 'operator', 'viewer'], notify: ['owner', 'analyst', 'operator', 'viewer'], materialize: ['owner', 'analyst', 'operator', 'viewer'], import: ['owner', 'analyst'], configure: ['owner'], propose: ['owner', 'analyst', 'operator'], approve: ['owner'], execute: ['owner', 'operator'], retain: ['owner']};
  return Object.freeze({
    async transaction(action, work) {
      if (!Object.hasOwn(roles, action)) throw new Error('ACCION_INVALIDA');
      const c = await pool.connect(); let open = false;
      try {
        await c.query(action === 'read' ? 'BEGIN READ ONLY' : 'BEGIN'); open = true;
        await c.query('SET LOCAL ROLE vexa_backend');
        await c.query("SELECT set_config('request.jwt.claim.sub',$1,true), set_config('vexa.tenant_id',$2,true), set_config('statement_timeout',$3,true), set_config('vexa.action',$4,true)", [userId, tenantId, String(statementTimeoutMs), action]);
        const m = (await c.query("SELECT tenant_id,user_id,role,status,permissions_version FROM public.memberships WHERE tenant_id=$1 AND user_id=$2 AND status='active'", [tenantId, userId])).rows[0];
        if (!m) throw new Error('organization_not_authorized');
        if (!roles[action].includes(m.role)) throw new Error('role_insufficient');
        let active = true;
        const scope = Object.freeze({tenantId: m.tenant_id, userId: m.user_id, role: m.role, permissionsVersion: m.permissions_version, query: (t, v = []) => active ? c.query(t, v) : Promise.reject(new Error('database_scope_expired'))});
        let r; try { r = await work(scope); } finally { active = false; }
        await c.query('COMMIT'); open = false; return r;
      } catch (e) { if (open) { try { await c.query('ROLLBACK'); } catch { /* el error original manda */ } } throw e; }
      finally { c.release(); }
    },
  });
}

/** Ejecuta la escritura completa y la DESHACE (rollback) devolviendo lo que habría resultado. */
export function conReversa(db) {
  let capturado; const SENT = new Error('ECON_ROLLBACK_PRUEBA');
  return {
    db: {async transaction(action, work) {
      try { return await db.transaction(action, async s => { capturado = await work(s); throw SENT; }); }
      catch (e) { if (e === SENT) return capturado; throw e; }
    }},
    resultado: () => capturado,
  };
}

export async function problemasValidos(db, scope) {
  return db.transaction('read', async s => {
    const t0 = Date.now();
    const v = await readExposure(s, {scope});
    const total = +(await s.query("SELECT count(DISTINCT problem_id) n FROM public.problem_versions WHERE tenant_id=$1 AND provenance->>'kind'='vector-problem-v1'", [s.tenantId])).rows[0].n;
    return {validos: v.problemOptions.map(p => p.id).sort(), totalVectoriales: total, segundos: Math.round((Date.now() - t0) / 100) / 10, inputHash: v.inputHash};
  });
}

export function resumenExposicion(v) {
  const m = v.metrics, g = m.global;
  const por = Object.entries(m.byProblem);
  return {
    inputHash: v.inputHash, cobertura: v.coverage ? {version: v.coverage.version, complete: v.coverage.complete, current: v.coverage.current} : null,
    problemas_opcion: v.problemOptions.length, vinculos: v.relations.length, vinculos_vigentes_validos: v.relations.filter(r => r.active && r.valid).length, vinculos_invalidos: v.relations.filter(r => r.active && !r.valid).length,
    todos_los_pedidos: {amount: v.canonicalAllOrders.amountMinor, subtotal: v.canonicalAllOrders.knownSubtotalMinor, status: v.canonicalAllOrders.status, n: v.canonicalAllOrders.totalCount},
    global: {amount: g.amountMinor, subtotal: g.knownSubtotalMinor, status: g.status, conocidos: g.knownCount, total: g.totalCount, motivos: g.missingReasons},
    reembolsos: {amount: m.eventUnion?.global?.refunds?.amountMinor ?? null, subtotal: m.eventUnion?.global?.refunds?.knownSubtotalMinor ?? null, status: m.eventUnion?.global?.refunds?.status ?? null, n: m.eventUnion?.global?.refunds?.totalCount ?? 0},
    problemas_con_exposicion: por.filter(([, x]) => x.totalCount > 0).length,
    no_aditivo: m.problemRowsAreAdditive === false,
  };
}

export async function medirExposicion(db, scope) { return db.transaction('read', async s => resumenExposicion(await readExposure(s, {scope}))); }

export async function prepararSnapshot(db, scope, {fxRateId} = {}) {
  const repo = createSnapshotRepository({database: db});
  return repo.stage({scope, ...(fxRateId ? {fxRateId} : {})});
}
export async function publicarSnapshot(db, {snapshotId, contentHash}) {
  const repo = createSnapshotRepository({database: db});
  return repo.publish({snapshotId, expectedContentHash: contentHash});
}
/** Atestación de cobertura de relaciones (owner). `complete:true` afirma que TODAS las relaciones problema-pedido del alcance están declaradas: no es lo que garantiza esta regla. */
export async function atestarCobertura(db, {scope, complete, report}) {
  const repo = createExposureRepository({database: db});
  const view = await db.transaction('read', async s => readExposure(s, {scope}));
  return repo.recordCoverage({scope, expectedInputHash: view.inputHash, expectedVersion: view.coverage?.version ?? 0, complete, report, attested: true});
}

// ============================================================================================== CLI
export function conexion({urlEnv, socket, database, user}) {
  if (socket) {
    if (!String(socket).startsWith('/private/tmp/claude-501/') && !String(socket).startsWith('/tmp/')) throw new Error('SOCKET_LOCAL_FUERA_DE_TMP');
    return new pg.Pool({host: socket, database: database ?? 't', user: user ?? 'postgres', max: 2});
  }
  const raw = process.env[urlEnv ?? 'VEXA_DB_URL'];
  if (!raw) throw new Error(`Falta la variable ${urlEnv ?? 'VEXA_DB_URL'} (cadena Postgres del pooler de Supabase; la define Javier en su Terminal, no se imprime).`);
  let u; try { u = new URL(raw); } catch { throw new Error('VEXA_DB_URL inválida'); }
  if (!(u.hostname.includes(PROJECT_REF) || decodeURIComponent(u.username).endsWith('.' + PROJECT_REF))) throw new Error(`La conexión no pertenece al proyecto ${PROJECT_REF}: abortado.`);
  return new pg.Pool({connectionString: raw, max: 2, ssl: {rejectUnauthorized: false}});
}

async function cli() {
  const a = process.argv.slice(2), cmd = a[0];
  const flag = n => a.includes('--' + n), opt = (n, d = null) => { const i = a.indexOf('--' + n); return i >= 0 ? a[i + 1] : d; };
  const out = opt('out', OUT_DEFAULT); fs.mkdirSync(out, {recursive: true, mode: 0o700});
  const tenant = opt('tenant', TENANT); if (tenant !== TENANT) throw new Error('TENANT_NO_AUTORIZADO');
  const owner = opt('owner');
  const needOwner = ['preparar', 'cobertura', 'publicar'].includes(cmd) && (flag('commit') || flag('rollback-test') || flag('publicar'));
  if (needOwner && !UUID.test(owner ?? '')) throw new Error('Falta --owner <uuid> (owner activo del tenant). Es la atestación explícita de Javier; no se infiere.');
  const user = owner ?? opt('lector');
  if (!UUID.test(user ?? '')) throw new Error('Indique --owner o --lector <uuid> (miembro activo del tenant que lee).');
  const pool = conexion({urlEnv: opt('db-url-env'), socket: opt('pg-socket'), database: opt('pg-db'), user: opt('pg-user')});
  const db = crearBaseDatos({pool, tenantId: tenant, userId: user, statementTimeoutMs: Number(opt('timeout-ms', '900000'))});
  const nombre = opt('alcance');
  const scope = nombre ? alcance(nombre) : null;
  const write = (f, o) => fs.writeFileSync(path.join(out, f), JSON.stringify(o, null, 1), {mode: 0o600});
  try {
    if (cmd === 'problemas-validos') {
      const r = await problemasValidos(db, scope);
      write('problemas-validos.json', {alcance: nombre, generado: new Date().toISOString(), validos: r.validos});
      console.log(JSON.stringify({validos: r.validos.length, vectoriales_totales: r.totalVectoriales, invalidos_o_sin_evidencia: r.totalVectoriales - r.validos.length, segundos: r.segundos, archivo: path.join(out, 'problemas-validos.json')}));
    } else if (cmd === 'medir') {
      const r = await medirExposicion(db, scope); write(`medicion-${nombre}.json`, r); console.log(JSON.stringify(r));
    } else if (cmd === 'preparar') {
      if (flag('rollback-test') === flag('commit')) throw new Error('Indique exactamente uno: --rollback-test o --commit');
      let r;
      if (flag('rollback-test')) { const c = conReversa(db); await prepararSnapshot(c.db, scope); r = c.resultado(); console.log('ROLLBACK-TEST OK: snapshot preparado y deshecho'); }
      else r = await prepararSnapshot(db, scope);
      const res = {alcance: nombre, modo: flag('commit') ? 'commit' : 'rollback-test', snapshotId: r?.id, status: r?.status, contentHash: r?.contentHash, scopeHash: r?.scopeHash, asOf: r?.asOf, componentes: (r?.components ?? []).map(c => ({metric: c.metric, currency: c.currency, amountMinor: c.amountMinor, knownSubtotalMinor: c.knownSubtotalMinor, status: c.money?.status ?? c.configurationStatus})), modelos: r?.versions?.models?.length ?? null, ts: new Date().toISOString()};
      write(`recibo-snapshot-${nombre}-${res.modo}.json`, res); console.log(JSON.stringify(res));
    } else if (cmd === 'cobertura') {
      const rep = fs.readFileSync(opt('reporte-archivo'), 'utf8').trim();
      if (!flag('commit')) { console.log('DRY-RUN. Se atestaría cobertura complete=' + opt('complete') + ' para ' + nombre + ' con un reporte de ' + rep.length + ' caracteres. Agregue --commit.'); return; }
      const r = await atestarCobertura(db, {scope, complete: opt('complete') === 'true', report: rep});
      write(`recibo-cobertura-${nombre}.json`, {alcance: nombre, ...r, ts: new Date().toISOString()}); console.log(JSON.stringify({version: r.version, complete: r.complete, current: r.current}));
    } else if (cmd === 'publicar') {
      if (!flag('publicar')) { console.log('DRY-RUN. Falta --publicar (confirmación explícita).'); return; }
      const r = await publicarSnapshot(db, {snapshotId: opt('snapshot-id'), contentHash: opt('content-hash')});
      write(`recibo-publicacion-${r.id}.json`, {id: r.id, status: r.status, contentHash: r.contentHash, publishedAt: r.publishedAt}); console.log(JSON.stringify({id: r.id, status: r.status, publishedAt: r.publishedAt}));
    } else { console.log('Uso: node snapshot.mjs problemas-validos|medir|preparar|cobertura|publicar --alcance ' + Object.keys(ALCANCES).join('|') + ' ...'); process.exitCode = 2; }
  } finally { await pool.end(); }
}
if (import.meta.url === `file://${process.argv[1]}`) cli().catch(e => { console.error('ERROR', scrub(e.message).slice(0, 300)); process.exit(1); });
