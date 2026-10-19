// Mundo sintético para las pruebas de escala: conversaciones -> problemas -> libro económico (fuentes, pedidos, devoluciones, un pedido Shopify con reembolso)
// -> vínculos problema-pedido hechos con el repositorio REAL del producto. Reutiliza los generadores de packages/ai-scale/economia-problemas (solo datos sintéticos).
import pg from 'pg';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {montarMundo, TENANT_A, TENANT_B, OWNER, ANALYST_A, SECOND_OWNER_A, U, psqlFile} from '../../ai-scale/economia-problemas/mundo.mjs';
import {crearBaseDatos, alcance} from '../../ai-scale/economia-problemas/snapshot.mjs';
import {batchSql} from '../../economics/emit-sql.mjs';
import {entityId} from '../../economics/marketplace-map.mjs';
import {createExposureRepository, readExposure} from '../exposure.mjs';

export {TENANT_A, TENANT_B, OWNER, ANALYST_A, SECOND_OWNER_A, U, psqlFile, alcance, batchSql, entityId};
export const OWNER2 = U(9005), OUTSIDER = U(9006), OWNER3 = U(9007);
export const ATEST = 'SYN prueba: el owner de prueba atesta haber revisado la regla determinista y una muestra sintética de pares.';
export const REP = 'SYN libro: registro sintético de prueba con procedencia documentada, sin datos de clientes.';
export const HERE = path.dirname(fileURLToPath(import.meta.url));

/** Mundo base + segundo owner + un usuario sin membresía; vínculos de los tres problemas; cobertura atestada si las fuentes son completas. */
export async function construirMundo(h, {complete = false} = {}) {
  const {psql, sock} = h;
  const w = montarMundo(h, {complete});
  psql(`insert into auth.users(id) values('${OWNER2}'),('${OUTSIDER}'),('${OWNER3}') on conflict do nothing`);
  psql(`insert into public.memberships(tenant_id,user_id,role,status,permissions_version) values('${TENANT_A}','${OWNER2}','owner','active',1),('${TENANT_A}','${OWNER3}','owner','active',1)`);
  const pool = new pg.Pool({host: sock, user: 'postgres', database: 't', max: 4});
  const db = (user = OWNER.A, tenant = TENANT_A, ms = 10000) => crearBaseDatos({pool, tenantId: tenant, userId: user, statementTimeoutMs: ms});
  const A1 = alcance('marketplaces-usd'), A2 = alcance('shopify-usd'), A3 = alcance('devoluciones-usd');
  const ids = w.libro.ids;
  const prob = t => psql(`select id from public.problems where tenant_id='${TENANT_A}' and title='${t}'`).out;
  const rowOf = e => psql(`select id from public.economic_ledger_entries where entity_id='${e}' order by revision desc limit 1`).out;
  const links = createExposureRepository({database: db(OWNER.A, TENANT_A, 120000)});
  for (const [t, es] of [['Envío: No recibido', [ids.O1, ids.O2, ids.S1]], ['Pago: Cobro duplicado', [ids.O3a]], ['Garantía: Batería', [ids.R1]]])
    for (const e of es) await links.record({problemId: prob(t), ledgerRowId: rowOf(e), expectedVersion: 0, active: true, report: ATEST, attested: true});
  if (complete) for (const a of [A1, A2, A3]) {
    const v = await db(OWNER.A, TENANT_A, 120000).transaction('read', s => readExposure(s, {scope: a}));
    await links.recordCoverage({scope: a, expectedInputHash: v.inputHash, expectedVersion: v.coverage?.version ?? 0, complete: true, report: 'SYN: el owner de prueba declara la cobertura de relaciones revisada para la prueba.', attested: true});
  }
  const query = (a, extra = {}) => new URLSearchParams({date_start: a.start.slice(0, 10), date_end: a.end.slice(0, 10), currency: a.currency, basis: a.basis, exponent: String(a.exponent), ...extra});
  return {h, w, pool, db, A1, A2, A3, ids, prob, rowOf, query, psql, sock, f: w.libro.fuentes};
}

/** Un pedido extra aportado por otro owner (lo que luego se revoca). */
export function pedidoDeOtroOwner(ctx, {externalId = 'amazon|SYN-111-0000005|SKU-E', amount = '3333', actor = OWNER2, currency = 'USD', basis = 'marketplace_line_price'} = {}) {
  const entry = {externalId, kind: 'order', effectiveAt: '2026-03-11T12:00:00.000Z', basis, amountMinor: amount, status: 'recorded', expectedRevision: 0, orderId: null, reversalOf: null, details: {}, report: REP, attested: true, exponent: 2, currency};
  const r = psqlFile(ctx.sock, batchSql(TENANT_A, {sourceId: ctx.f.amazonP.sourceId, entries: [entry], label: 'owner2'}, actor));
  if (r.status !== 0) throw Error(r.stderr.slice(0, 300));
  return entityId(TENANT_A, ctx.f.amazonP.sourceId, 'order', externalId);
}
/** Muchos pedidos sintéticos (≥ 3 mil) para comprobar que el número de sentencias NO crece con el libro. */
export function llenarLibro(ctx, n, {prefix = 'FILL'} = {}) {
  const per = 200;
  for (let start = 0; start < n; start += per) {
    const entries = Array.from({length: Math.min(per, n - start)}, (_, i) => ({externalId: `amazon|SYN-${prefix}-${start + i}|SKU-F${(start + i) % 50}`, kind: 'order', effectiveAt: '2026-03-12T12:00:00.000Z', basis: 'marketplace_line_price', amountMinor: String(100 + ((start + i) % 900)), status: 'recorded', expectedRevision: 0, orderId: null, reversalOf: null, details: {}, report: REP, attested: true, exponent: 2, currency: 'USD'}));
    const r = psqlFile(ctx.sock, batchSql(TENANT_A, {sourceId: ctx.f.amazonP.sourceId, entries, label: 'fill' + start}, OWNER.A));
    if (r.status !== 0) throw Error(r.stderr.slice(0, 300));
  }
}
/** Envuelve una base para contar y medir cada sentencia que la aplicación emite. */
export function medida(db, {tz = null} = {}) {
  const log = [];
  const wrapped = Object.freeze({
    async transaction(action, work) {
      return db.transaction(action, async s => { if (tz) await s.query("SELECT set_config('TimeZone',$1,true)", [tz]); return work(Object.freeze({tenantId: s.tenantId, userId: s.userId, role: s.role, permissionsVersion: s.permissionsVersion, query: async (t, v) => { const t0 = performance.now(); try { return await s.query(t, v); } finally { log.push({ms: performance.now() - t0, sql: String(t).replace(/\s+/g, ' ').slice(0, 120)}); } }})); });
    },
  });
  return {db: wrapped, log, max: () => Math.max(0, ...log.map(x => x.ms)), count: () => log.length, reset: () => { log.length = 0; }};
}

/** Ejecuta SQL de solo lectura como el rol de la aplicación (vexa_backend) con la sesión de `user` y `tenant` (misma frontera que packages/platform/src/db.ts). Devuelve la última línea. */
export function comoUsuario(ctx, {user, tenant, action = 'read', sql}) {
  const q = v => "'" + String(v).replace(/'/g, "''") + "'";
  const script = `begin read only; set local role vexa_backend; select set_config('request.jwt.claim.sub',${q(user)},true),set_config('vexa.tenant_id',${tenant ? q(tenant) : "''"},true),set_config('vexa.action',${q(action)},true) \\gset\n${sql};\nrollback;`;
  const r = spawnSync('psql', ['-h', ctx.sock, '-U', 'postgres', '-d', 't', '-X', '-At', '-v', 'ON_ERROR_STOP=1'], {input: script, encoding: 'utf8'});
  if (r.status !== 0) throw new Error(r.stderr.slice(0, 300));
  return r.stdout.split('\n').filter(l => l && !/^(SET|BEGIN|ROLLBACK)$/.test(l)).pop();
}
