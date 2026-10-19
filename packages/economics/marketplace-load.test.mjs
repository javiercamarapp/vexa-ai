// Pruebas de la carga económica (marketplaces + Shopify) sobre datos 100 % SINTÉTICOS del mismo volumen que los reales.
// Parte pura (siempre corre) + parte con Postgres LOCAL desechable (esquema real 0001..0051 sobre stubs de Supabase):
//   scripts/economics/pg-local-up.sh <datos> /tmp/vxe-econ 59462          (levanta la plantilla «vexa»)
//   VEXA_ECON_PG_SOCKET=/tmp/vxe-econ VEXA_ECON_PG_PORT=59462 VEXA_ECON_PG_TEMPLATE=vexa \
//   VEXA_ECON_PG_MODULE=<ruta>/node_modules/pg node --test packages/economics/marketplace-load.test.mjs
// Sin esas variables la parte con Postgres se omite. Nunca toca una base compartida ni de producción.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {writeFileSync, mkdtempSync, rmSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {parseCsv, CsvError} from './csv.mjs';
import {mapMarketplaceFile, toMinor, toInstant, packBatches, summarize, MARKETPLACE_FILES, entityId, SUFFIX} from './marketplace-map.mjs';
import {mapShopifyOrder} from './shopify-map.mjs';
import {syntheticMarketplaceTexts, SYNTHETIC_EXPECTED, toCsv} from './synthetic.mjs';
import {contextSql, batchSql, sourcesSql} from './emit-sql.mjs';
import {mapAllMarketplaces} from '../../scripts/economics/fuentes-marketplaces.mjs';
import {prepareMarketplaces, prepareShopify, verificationQueries} from '../../scripts/economics/preparar.mjs';
import {createEconomicRepository} from '../metrics/repository.mjs';

const T = '00000000-0000-4000-8000-0000000000a1', OWNER = '00000000-0000-4000-8000-0000000000a2', ANALYST = '00000000-0000-4000-8000-0000000000a3', OWNER2 = '00000000-0000-4000-8000-0000000000a4', T2 = '00000000-0000-4000-8000-0000000000b1';
const sha = s => createHash('sha256').update(s).digest('hex');
const texts = syntheticMarketplaceTexts();
const readSynthetic = (root, spec) => { const text = texts.get(spec.rel); return {text, sha: sha(text), bytes: Buffer.from(text)}; };
const mapped = (unknownCurrency = 'XXX') => mapAllMarketplaces({root: 'sintetico', tenantId: T, readFile: readSynthetic, unknownCurrency});

// ---------------------------------------------------------------- parte pura
test('CSV: comillas, saltos de línea dentro de campos, BOM y filas mal formadas', () => {
  const r = parseCsv('﻿a,b,c\r\n1,"x,y","l1\nl2"\r\n"q""z",,3\r\n');
  assert.deepEqual(r.header, ['a', 'b', 'c']);
  assert.deepEqual(r.rows, [{a: '1', b: 'x,y', c: 'l1\nl2'}, {a: 'q"z', b: '', c: '3'}]);
  assert.throws(() => parseCsv('a,b\n1\n'), CsvError);
  assert.throws(() => parseCsv('a,b\n"1,2\n'), CsvError);
  assert.throws(() => parseCsv('a,a\n1,2\n'), CsvError);
});

test('importes: minor units exactos; vacío/negativo/no canónico/sub-centavo => null con marca (nunca 0)', () => {
  assert.deepEqual(toMinor('12.34', 2), {minor: '1234', flag: null});
  assert.deepEqual(toMinor('12', 2), {minor: '1200', flag: null});
  assert.deepEqual(toMinor('0.5', 2), {minor: '50', flag: null});
  assert.deepEqual(toMinor('1.500', 2), {minor: '150', flag: null});
  assert.equal(toMinor('', 2).minor, null); assert.equal(toMinor('-1.00', 2).flag, 'negativo');
  assert.equal(toMinor('1.234', 2).flag, 'sub_unidad_menor'); assert.equal(toMinor('1,23', 2).flag, 'no_canonico');
  assert.equal(toMinor('99999999999999999999.99', 2).minor, '9999999999999999999999');
});

test('fechas: UTC estricto; offsets y fecha sola se convierten; imposibles se rechazan', () => {
  assert.equal(toInstant('2025-10-27T01:22:37+00:00'), '2025-10-27T01:22:37.000Z');
  assert.equal(toInstant('2025-10-27T01:22:37-08:00'), '2025-10-27T09:22:37.000Z');
  assert.equal(toInstant('2026-07-27T19:20:41.5Z'), '2026-07-27T19:20:41.500Z');
  assert.equal(toInstant('2025-11-24'), '2025-11-24T00:00:00.000Z');
  for (const bad of ['', '2026-02-30', '2026-13-01T00:00:00Z', '2026-01-01T24:00:00Z', 'ayer', '2026-01-01T00:00:00+25:00']) assert.equal(toInstant(bad), null, bad);
});

test('volumen sintético: mismas cifras que los reales (88,666 = 81,891 + 6,775; 43 excedentes; 13 identidades; 4,192 sin moneda)', () => {
  const r = mapped();
  const E = SYNTHETIC_EXPECTED;
  assert.equal(r.items.length, E.rows); assert.equal(r.rejected.length, 0);
  assert.equal(r.items.filter(i => i.entry.kind === 'order').length, E.orders);
  assert.equal(r.items.filter(i => i.entry.kind === 'refund').length, E.refunds);
  assert.equal(r.items.filter(i => i.meta.dupExtra).length, E.dupExtras, '(a) excedentes idénticos');
  assert.equal(r.items.filter(i => i.meta.inDupGroup).length, E.dupGroupRows);
  assert.equal(r.items.filter(i => i.meta.multi).length, E.multiRows);
  assert.equal(new Set(r.items.filter(i => i.meta.multi).map(i => i.meta.group)).size, E.multiIdentities, '(b) identidades multimoneda');
  assert.equal(r.items.filter(i => i.meta.unknownCurrency).length, E.unknownCurrencyRows);
  assert.equal(r.items.filter(i => i.meta.noReturnId).length, E.noReturnId);
  const batches = packBatches(r.items);
  assert.ok(batches.length >= 358);
  for (const b of batches) assert.ok(b.items.length <= 250 && b.bytes <= 200000 && new Set(b.items.map(x => x.sourceId)).size === 1);
});

test('política por defecto: moneda desconocida se DIFIERE (rechazo MONEDA_DESCONOCIDA, no se escribe) y las devoluciones salen con orderId=null', () => {
  const r = mapped('rechazar');
  assert.equal(r.items.length, 88666 - 4192); assert.equal(r.rejected.length, 4192);
  assert.ok(r.rejected.every(x => x.motivo === 'MONEDA_DESCONOCIDA' && /^[a-f0-9]{64}$/.test(x.rowSha256)));
  assert.ok(r.items.every(i => i.entry.currency !== 'XXX' && i.entry.orderId === null));
  assert.ok(r.items.filter(i => i.meta.linkable).length > 1000, 'el enlace queda reconstruible por externalId (meta.linkable), pero no se escribe');
  const mirakl = r.items.filter(i => i.meta.file.startsWith('mirakl') && i.meta.flags.includes('reembolso_incrustado_en_origen'));
  assert.ok(mirakl.length > 0 && mirakl.every(i => i.entry.basis.includes('|a_revisar:reembolso_en_origen') && i.entry.status !== 'recorded'), 'pedidos Mirakl reembolsados: fuera de totales y no «recorded»');
});

test('reglas de negocio: (a) excedentes sin id de línea => separados, «a revisar», fuera de totales por basis; (b) multimoneda no se suma', () => {
  const r = mapped();
  const extras = r.items.filter(i => i.meta.dupExtra);
  assert.ok(extras.every(i => i.entry.basis.includes(SUFFIX.dup) && /~dup\d+$/.test(i.entry.externalId)));
  const firsts = r.items.filter(i => i.meta.inDupGroup && !i.meta.dupExtra);
  assert.equal(firsts.length, 32); assert.ok(firsts.every(i => !i.entry.basis.includes(SUFFIX.dup)));
  const multi = r.items.filter(i => i.meta.multi);
  assert.ok(multi.every(i => i.entry.basis.endsWith(SUFFIX.multi)));
  assert.ok(multi.every(i => i.entry.currency === 'XXX' ? i.entry.amountMinor === null : i.entry.currency === 'USD'), 'cada línea en su moneda; la vacía sin importe');
  const s = summarize(r.items);
  assert.ok(s.sin_dudosas && s.todo && s.sin_multimoneda && s.sin_duplicados_excedentes);
  // todo - sin_duplicados = importes de los excedentes
  const sumUsd = v => Object.entries(v).filter(([k]) => k.startsWith('order|USD|')).reduce((a, [, x]) => a + BigInt(x.importe_conocido_minor), 0n);
  assert.ok(sumUsd(s.todo) > sumUsd(s.sin_duplicados_excedentes));
  // unknown != 0
  assert.ok(r.items.filter(i => i.entry.currency === 'XXX').every(i => i.entry.amountMinor === null && i.entry.exponent === 0));
});

test('reglas de negocio: (a) con identificador de línea y repetido => UNA cargada, las demás DUPLICADO_EXACTO con hash', () => {
  const spec = {...MARKETPLACE_FILES.find(s => s.key === 'walmart-devoluciones'), rows: 4, sha256: 'a'.repeat(64)};
  const header = parseCsv(texts.get(spec.rel)).header;
  const base = {marketplace: 'walmart', return_id: 'SYN-R-1', order_id: 'SYN-O-1', order_line_id: 'SYN-L-1', return_date: '2026-07-27T19:20:41.000Z', return_status: 'COMPLETED', refund_status: 'REFUND_COMPLETED', sku: 'SYN-SKU', quantity: '1', refunded_quantity: '1', unit_price: '10.00', line_total: '10.00', total_refund_amount: '10.00', currency: 'USD'};
  const text = toCsv(header, [base, {...base}, {...base}, {...base, return_id: 'SYN-R-2', order_line_id: 'SYN-L-2'}]);
  const r = mapMarketplaceFile({spec, text, tenantId: T});
  assert.equal(r.items.length, 2); assert.equal(r.rejected.length, 2);
  assert.ok(r.rejected.every(x => x.motivo === 'DUPLICADO_EXACTO' && /^[a-f0-9]{64}$/.test(x.rowSha256) && x.firstRow === 2));
  assert.equal(r.stats.rejected.DUPLICADO_EXACTO, 2);
});

test('rechazos explícitos con motivo: fecha imposible/futura, moneda no soportada, identidad vacía; política «rechazar» para moneda desconocida', () => {
  const spec = {...MARKETPLACE_FILES.find(s => s.key === 'walmart-pedidos'), rows: 5, sha256: 'a'.repeat(64)};
  const header = parseCsv(texts.get(spec.rel)).header;
  const ok = {marketplace: 'walmart', order_id: 'SYN-1', order_date: '2026-04-11T22:59:59.070Z', order_status: 'Delivered', line_status: 'Delivered', sku: 'S', quantity: '1', unit_price: '1.00', line_price: '1.00', currency: 'USD'};
  const rows = [ok, {...ok, order_id: 'SYN-2', order_date: '2026-02-30T00:00:00Z'}, {...ok, order_id: 'SYN-3', order_date: '2999-01-01T00:00:00Z'}, {...ok, order_id: 'SYN-4', currency: 'EUR'}, {...ok, order_id: '', sku: 'S'}];
  const r = mapMarketplaceFile({spec, text: toCsv(header, rows), tenantId: T});
  assert.equal(r.items.length, 1);
  assert.deepEqual(r.rejected.map(x => x.motivo).sort(), ['FECHA_FUTURA', 'FECHA_INVALIDA', 'IDENTIDAD_VACIA', 'MONEDA_NO_SOPORTADA']);
  const rr = mapMarketplaceFile({spec, text: toCsv(header, [{...ok, currency: ''}, ok, ok, ok, ok].map((x, i) => ({...x, order_id: 'SYN-' + i}))), tenantId: T, unknownCurrency: 'rechazar'});
  assert.equal(rr.rejected.filter(x => x.motivo === 'MONEDA_DESCONOCIDA').length, 1);
});

test('estados: solo mapas explícitos; lo no listado queda unknown; nada se infiere como settled/recorded', () => {
  const r = mapped();
  const returns = r.items.filter(i => i.entry.kind === 'refund');
  const amazon = returns.filter(i => i.meta.file === 'amazon-devoluciones');
  assert.ok(amazon.every(i => i.entry.status === 'unknown'), 'refund_status vacío => unknown');
  assert.ok(returns.filter(i => i.meta.file === 'mirakl-us-devoluciones').every(i => i.entry.status === 'unknown' && i.entry.amountMinor === null));
  const walmartStatuses = new Set(returns.filter(i => i.meta.file === 'walmart-devoluciones').map(i => i.entry.status));
  assert.deepEqual([...walmartStatuses].sort(), ['cancelled', 'pending', 'settled', 'unknown']);
});

test('identidad estable: id único por fuente/tipo; orderId siempre null (enlace diferido) y 200 caracteres máx.', () => {
  const r = mapped();
  const ids = new Set(); for (const i of r.items) { const k = i.sourceId + '|' + i.entry.kind + '|' + i.entry.externalId; assert.ok(!ids.has(k)); ids.add(k); assert.ok(i.entry.externalId.length <= 200); }
  assert.ok(r.items.every(i => i.entry.orderId === null));
});

test('Shopify: el mapeador reproduce la redacción, estado e importe de los pedidos ya cargados', () => {
  const order = {id: 'gid://shopify/Order/1', createdAt: '2026-08-06T21:03:11Z', cancelledAt: null, displayFinancialStatus: 'PAID', totalPriceSet: {shopMoney: {minorUnits: '3900', currency: 'USD', sourceDecimal: '39.0'}}};
  const e = mapShopifyOrder(order, 0, 'f'.repeat(64));
  assert.equal(e.amountMinor, '3900'); assert.equal(e.status, 'recorded'); assert.equal(e.effectiveAt, '2026-08-06T21:03:11.000Z'); assert.equal(e.basis, 'gross_order_including_tax_shipping');
  assert.match(e.report, /Estado financiero PAID; cancelación no registrada\./);
  assert.equal(mapShopifyOrder({...order, cancelledAt: '2026-08-07T00:00:00Z', displayFinancialStatus: 'VOIDED'}, 1, 'f'.repeat(64)).status, 'cancelled');
  assert.throws(() => mapShopifyOrder({...order, totalPriceSet: {shopMoney: {minorUnits: '-1', currency: 'USD', sourceDecimal: '-0.01'}}}, 0, 'f'));
  assert.throws(() => mapShopifyOrder({...order, totalPriceSet: {shopMoney: {minorUnits: '1', currency: 'MXN', sourceDecimal: '0.01'}}}, 0, 'f'));
});

test('SQL emitido: tandas ≤250, una fuente por archivo, contexto con actor owner y resultado en una fila', () => {
  const p = prepareMarketplaces({tenantId: T, actorId: null, root: 'sintetico', readFile: readSynthetic});
  assert.equal(p.files.filter(f => f.kind === 'tanda').reduce((a, f) => a + f.entries, 0), 88666 - 4192);
  assert.ok(p.files.filter(f => f.kind === 'tanda').every(f => f.entries <= 250 && Buffer.byteLength(f.sql) < 205000 && /ECON_BATCH_RESULT/.test(f.sql) && /economic_batch_import/.test(f.sql)));
  assert.match(contextSql(T, null), /ACTOR_OWNER_AMBIGUO/); assert.match(contextSql(T, OWNER), new RegExp(OWNER));
  assert.throws(() => contextSql('no-uuid'));
});

// ---------------------------------------------------------------- parte con Postgres local
const env = process.env, enabled = Boolean(env.VEXA_ECON_PG_SOCKET && env.VEXA_ECON_PG_PORT && env.VEXA_ECON_PG_TEMPLATE && env.VEXA_ECON_PG_MODULE);
const opts = {skip: enabled ? false : 'defina VEXA_ECON_PG_* para correr contra un Postgres local desechable', timeout: 1800000};
const pg = enabled ? createRequire(import.meta.url)(env.VEXA_ECON_PG_MODULE) : null;
const connect = db => new pg.Pool({host: env.VEXA_ECON_PG_SOCKET, port: Number(env.VEXA_ECON_PG_PORT), database: db, max: 3});
let admin; const created = [];
async function freshDb(name, {twoOwners = false} = {}) {
  admin ??= connect('postgres'); await admin.query(`DROP DATABASE IF EXISTS ${name}`); await admin.query(`CREATE DATABASE ${name} TEMPLATE ${env.VEXA_ECON_PG_TEMPLATE}`); created.push(name);
  const pool = connect(name);
  await pool.query('INSERT INTO auth.users(id) VALUES($1),($2),($3)', [OWNER, ANALYST, OWNER2]);
  await pool.query("INSERT INTO organizations(id,name) VALUES($1,'SYN'),($2,'SYN2')", [T, T2]);
  await pool.query("INSERT INTO memberships(tenant_id,user_id,role,status,permissions_version) VALUES($1,$2,'owner','active',1),($1,$3,'analyst','active',1)", [T, OWNER, ANALYST]);
  if (twoOwners) await pool.query("INSERT INTO memberships(tenant_id,user_id,role,status,permissions_version) VALUES($1,$2,'owner','active',1)", [T, OWNER2]);
  return pool;
}
// Ejecuta un archivo SQL tal como lo haría `supabase db query --linked -f` (rol privilegiado, protocolo simple, multi-sentencia).
async function runSql(pool, sql) { const c = await pool.connect(); try { const res = await c.query(sql); const all = Array.isArray(res) ? res : [res]; const last = [...all].reverse().find(x => x.rows?.length); return last?.rows[0]?.resultado ?? null; } catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e; } finally { c.release(); } }
const parseResult = r => { const m = /^ECON_BATCH_RESULT (\S+) (\d+) (\d+) (\d+)$/.exec(r ?? ''); assert.ok(m, 'resultado inesperado: ' + r); return {label: m[1], processed: +m[2], inserted: +m[3], replayed: +m[4]}; };
async function runAll(pool, files) { const tot = {processed: 0, inserted: 0, replayed: 0, tandas: 0}; for (const f of files) { const r = await runSql(pool, f.sql); if (f.kind === 'tanda') { const x = parseResult(r); assert.equal(x.processed, f.entries); tot.processed += x.processed; tot.inserted += x.inserted; tot.replayed += x.replayed; tot.tandas++; } else assert.match(r, /^ECON_SOURCES_RESULT/); } return tot; }
const digest = async (pool, where = 'true') => { const r = await pool.query(`SELECT count(*)::int n, md5(string_agg(to_jsonb(x)::text, '|' ORDER BY x.entity_id, x.revision)) d FROM (SELECT * FROM public.economic_ledger_entries WHERE ${where}) x`); return r.rows[0]; };
const dumpCols = 'entity_id,source_id,source_version,revision,actor_id,external_id,kind,effective_at,currency,exponent,basis,amount_minor,status,order_id,reversal_of,details,report,report_hash,attested';
const compareDump = async (pool, ids) => (await pool.query(`SELECT count(*)::int n, md5(string_agg(to_jsonb(x)::text,'|' ORDER BY x.entity_id,x.revision)) d FROM (SELECT ${dumpCols} FROM public.economic_ledger_entries WHERE entity_id = ANY($1::uuid[])) x`, [ids])).rows[0];

test('PG: carga completa de marketplaces a volumen real sintético, verificada con las consultas SELECT, idempotente y con recibo', opts, async () => {
  const pool = await freshDb('econ_mk_a');
  try {
    const prep = prepareMarketplaces({tenantId: T, actorId: null, root: 'sintetico', readFile: readSynthetic, unknownCurrency: 'XXX'});
    const t0 = Date.now(); const first = await runAll(pool, prep.files); const ms = Date.now() - t0;
    assert.deepEqual({p: first.processed, i: first.inserted, r: first.replayed, t: first.tandas}, {p: 88666, i: 88666, r: 0, t: prep.files.length - 1});
    assert.equal((await pool.query('SELECT count(*)::int n FROM public.economic_ledger_entries')).rows[0].n, 88666);
    assert.equal((await pool.query('SELECT count(*)::int n FROM public.economic_source_versions')).rows[0].n, prep.sources.length);
    const q = Object.fromEntries(verificationQueries(T, prep.items, prep.sources).map(x => [x.name, x.sql]));
    assert.equal((await pool.query(q.V2)).rows.length, 0, 'V2: sin diferencias contra lo esperado por fuente/tipo/moneda/base/estado');
    const v3 = (await pool.query(q.V3)).rows[0]; assert.equal(Number(v3.entidades_repetidas), 0); assert.equal(Number(v3.revision_distinta_de_1), 0);
    const v4 = (await pool.query(q.V4)).rows[0]; assert.equal(Number(v4.sin_procedencia), 0); assert.equal(Number(v4.total), 88666);
    const v5 = (await pool.query(q.V5)).rows[0];
    assert.deepEqual([v5.excedentes_identicos, v5.devoluciones_sin_return_id, v5.multimoneda, v5.moneda_desconocida, v5.moneda_desconocida_con_importe_error, v5.con_order_id].map(Number), [43, 43, 26, 4192, 0, 0]);
    assert.equal(Number((await pool.query(q.V6)).rows[0].filas_en_otro_tenant), 0);
    const v1 = (await pool.query(q.V1)).rows; assert.equal(v1.length, prep.sources.length);
    // «fuera de totales»: con la base estándar los excedentes y las multimoneda no se cuentan
    const std = (await pool.query("SELECT count(*)::int n FROM public.economic_ledger_entries WHERE basis IN ('marketplace_line_price','marketplace_refund_amount')")).rows[0].n;
    assert.equal(std, prep.items.filter(i => ['marketplace_line_price', 'marketplace_refund_amount'].includes(i.entry.basis)).length);
    // totales por moneda sin mezclar monedas y con importes null intactos (unknown != 0)
    const nulls = (await pool.query('SELECT count(*)::int n FROM public.economic_ledger_entries WHERE amount_minor IS NULL')).rows[0].n;
    assert.equal(nulls, prep.items.filter(i => i.entry.amountMinor === null).length);
    const before = await digest(pool);
    // idempotencia: correr dos veces = mismo resultado
    const second = await runAll(pool, prep.files);
    assert.deepEqual({p: second.processed, i: second.inserted, r: second.replayed}, {p: 88666, i: 0, r: 88666});
    assert.deepEqual(await digest(pool), before, 'tabla idéntica tras el segundo pase');
    console.log(`# carga 88,666 filas en ${ms} ms (358 tandas, Postgres local)`);
  } finally { await pool.end(); }
});

test('PG: atomicidad, conflicto de contenido, autorización y actor ambiguo (sin escrituras parciales)', opts, async () => {
  const pool = await freshDb('econ_mk_b', {twoOwners: true});
  try {
    const sample = prepareMarketplaces({tenantId: T, actorId: OWNER, root: 'sintetico', readFile: readSynthetic});
    await runSql(pool, sample.files[0].sql); // fuentes
    const tandas = sample.files.filter(f => f.kind === 'tanda');
    // actor ambiguo (dos owners) sin VEXA_ACTOR
    const noActor = prepareMarketplaces({tenantId: T, actorId: null, root: 'sintetico', readFile: readSynthetic});
    await assert.rejects(runSql(pool, noActor.files[1].sql), /ACTOR_OWNER_AMBIGUO/);
    // analista: sin permiso
    const asAnalyst = prepareMarketplaces({tenantId: T, actorId: ANALYST, root: 'sintetico', readFile: readSynthetic});
    await assert.rejects(runSql(pool, asAnalyst.files[1].sql), /insufficient_privilege|42501/);
    assert.equal((await pool.query('SELECT count(*)::int n FROM public.economic_ledger_entries')).rows[0].n, 0);
    // carga la primera tanda y reenvía una versión con UNA fila alterada: conflicto y nada cambia
    parseResult(await runSql(pool, tandas[0].sql));
    const before = await digest(pool);
    const altered = tandas[0].sql.replace(/"amountMinor":"(\d+)"/, (m, d) => `"amountMinor":"${d}9"`);
    assert.notEqual(altered, tandas[0].sql);
    await assert.rejects(runSql(pool, altered), /ECONOMIC_BATCH_CONFLICT/);
    assert.deepEqual(await digest(pool), before);
    // un lote con una entrada inválida al final no escribe nada (fecha futura => trigger a mitad de escritura)
    const k = tandas[1].sql.lastIndexOf('"effectiveAt":"'), kEnd = tandas[1].sql.indexOf('"', k + 15);
    const bad = tandas[1].sql.slice(0, k) + '"effectiveAt":"2999-01-01T00:00:00.000Z"' + tandas[1].sql.slice(kEnd + 1);
    await assert.rejects(runSql(pool, bad), /./);
    assert.deepEqual(await digest(pool), before);
    // fuente inexistente / versión vieja
    const wrongVersion = tandas[1].sql.replace('"sourceVersion":1', '"sourceVersion":2');
    await assert.rejects(runSql(pool, wrongVersion), /ECONOMIC_BATCH_SOURCE_UNAVAILABLE/);
    // tenant ajeno: owner de otro tenant no puede cargar en T
    await pool.query("INSERT INTO memberships(tenant_id,user_id,role,status,permissions_version) VALUES($1,$2,'owner','active',1)", [T2, OWNER2]);
    const otherTenantSql = tandas[1].sql.replace(new RegExp(T, 'g'), T2);
    await assert.rejects(runSql(pool, otherTenantSql), /./);
    assert.deepEqual(await digest(pool), before);
  } finally { await pool.end(); }
});

test('PG: equivalencia con el importador por registro (EconomicRepository.record) sobre una muestra de 1,500 filas', opts, async () => {
  const A = await freshDb('econ_eq_a'), B = await freshDb('econ_eq_b');
  try {
    const prep = prepareMarketplaces({tenantId: T, actorId: OWNER, root: 'sintetico', readFile: readSynthetic, unknownCurrency: 'XXX'});
    await runAll(A, prep.files.slice(0, 1)); // solo fuentes
    const session = (pool, action = 'configure') => async work => { const c = await pool.connect(); try { await c.query('BEGIN'); await c.query('SET LOCAL ROLE vexa_backend'); await c.query("SET LOCAL statement_timeout='30000ms'"); await c.query("SELECT set_config('vexa.tenant_id',$1,true),set_config('vexa.action',$2,true),set_config('request.jwt.claim.sub',$3,true)", [T, action, OWNER]); const s = {tenantId: T, userId: OWNER, role: 'owner', permissionsVersion: 1, query: (q, a) => c.query(q, a)}; const r = await work(s); await c.query('COMMIT'); return r; } catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e; } finally { c.release(); } };
    const repo = createEconomicRepository({database: {transaction: (action, work) => session(B, action)(work)}});
    for (const s of prep.sources) await repo.recordSource({sourceId: s.sourceId, expectedVersion: 0, name: s.name, evidenceType: s.evidenceType, active: s.active, complete: s.complete, windowStart: s.windowStart, windowEnd: s.windowEnd, watermark: s.watermark, report: s.report, attested: true});
    // muestra: 500 pedidos Amazon + 100 excedentes/multimoneda + todas las devoluciones Mirakl US (111) + 800 devoluciones Walmart/Amazon
    const pick = [...prep.items.filter(i => i.meta.file === 'amazon-pedidos').slice(0, 500), ...prep.items.filter(i => i.meta.dupExtra || i.meta.multi).slice(0, 100), ...prep.items.filter(i => i.meta.file === 'mirakl-us-devoluciones'), ...prep.items.filter(i => i.meta.file === 'walmart-devoluciones').slice(0, 500), ...prep.items.filter(i => i.meta.file === 'amazon-devoluciones').slice(0, 300)];
    const sample = [...new Map(pick.map(i => [i.sourceId + i.entry.kind + i.entry.externalId, i])).values()];
    for (const it of sample) await repo.record({sourceId: it.sourceId, sourceVersion: 1, ...it.entry});
    // mismas filas por lote en A (agrupadas por fuente, ≤250)
    for (const b of packBatches(sample)) await runSql(A, batchSql(T, {sourceId: b.sourceId, sourceVersion: 1, entries: b.items.map(x => x.entry), label: 'muestra'}, OWNER));
    const ids = sample.map(i => entityId(T, i.sourceId, i.entry.kind, i.entry.externalId));
    const da = await compareDump(A, ids), db = await compareDump(B, ids);
    assert.equal(da.n, sample.length); assert.equal(db.n, sample.length);
    assert.equal(da.d, db.d, 'misma fila, mismas columnas (menos id/recorded_at) por lote y por registro');
  } finally { await A.end(); await B.end(); }
});

test('PG: Shopify — reenvío del paquete cargado = todo repetido; ampliación hacia atrás crea versión 2 de la fuente e inserta solo lo nuevo', opts, async () => {
  const pool = await freshDb('econ_shop');
  const dir = mkdtempSync(path.join(os.tmpdir(), 'econ-shop-'));
  try {
    // paquete sintético con la MISMA forma que clientex-shopify-economic-import-20261006.json (redacción escrita aquí de forma independiente)
    const NORM_SHA = 'e'.repeat(64);
    const SO = '3d47b75d-0023-5bda-a102-5cc351b33edd', SR = 'b3ba2126-fb69-5f4e-aeef-c3caf395e27d';
    const srcBase = {expectedVersion: 0, active: true, complete: false, windowStart: '2026-08-01T00:00:00.000Z', windowEnd: '2026-10-06T00:00:00.000Z', watermark: '2026-10-05T21:25:04.753Z'};
    const sources = [{...srcBase, sourceId: SO, name: 'SYN Shopify Pedidos', evidenceType: 'order_export', report: 'Exportación sintética de pedidos para pruebas, sin datos reales.'}, {...srcBase, sourceId: SR, name: 'SYN Shopify Reembolsos', evidenceType: 'payment_ledger', report: 'Exportación sintética de reembolsos para pruebas, sin datos reales.'}];
    const orders = Array.from({length: 857}, (_, i) => ({id: `gid://shopify/Order/${9000000 + i}`, createdAt: new Date(Date.UTC(2026, 7, 6) + i * 3600000 * 1.7).toISOString().slice(0, 19) + 'Z', cancelledAt: i % 50 === 7 ? '2026-09-01T00:00:00Z' : null, displayFinancialStatus: i % 50 === 7 ? 'VOIDED' : 'PAID', totalPriceSet: {shopMoney: {minorUnits: String(1000 + i * 7), currency: 'USD', sourceDecimal: ((1000 + i * 7) / 100).toFixed(1)}}}));
    const entries = orders.map((o, i) => ({sourceId: SO, sourceVersion: 1, expectedRevision: 0, externalId: o.id, kind: 'order', effectiveAt: o.createdAt.replace('Z', '.000Z'), currency: 'USD', exponent: 2, basis: 'gross_order_including_tax_shipping', amountMinor: o.totalPriceSet.shopMoney.minorUnits, status: o.cancelledAt ? 'cancelled' : 'recorded', orderId: null, reversalOf: null, details: {}, report: `Shopify pedido ${o.id}; totalPriceSet.shopMoney original ${o.totalPriceSet.shopMoney.sourceDecimal} USD. Estado financiero ${o.displayFinancialStatus}; ${o.cancelledAt ? 'cancelación ' + o.cancelledAt : 'cancelación no registrada'}. Importe bruto, no pérdida, margen ni cobro bancario conciliado. shopify-normalized-private.json orders[${i}], SHA-256 ${NORM_SHA}.`}));
    for (let i = 0; i < 26; i++) entries.push({sourceId: SR, sourceVersion: 1, expectedRevision: 0, externalId: `gid://shopify/OrderTransaction/${8000000 + i}`, kind: 'refund', effectiveAt: '2026-08-11T00:38:47.000Z', currency: 'USD', exponent: 2, basis: 'gross_order_including_tax_shipping', amountMinor: String(500 + i), status: ['settled', 'pending', 'unknown'][i % 3], orderId: null, reversalOf: null, details: {}, report: `Shopify reembolso sintético ${i}; pedido ${orders[i].id}. No acredita conciliación bancaria. shopify-refund-details-private.json[${i}], SHA-256 ${NORM_SHA}.`});
    const pkg = {schema: 'rovaq-economic-import-v1', tenantId: T, scope: {}, currencyConfiguration: {}, sources, entries};
    const readFile = (root, file) => ({text: file.rel.includes('import-20261006') ? JSON.stringify(pkg) : JSON.stringify({orders, refunds: []}), sha: NORM_SHA});
    // 1) carga inicial «como el 6-oct» (fuentes + paquete)
    await runSql(pool, sourcesSql(T, sources, OWNER));
    const p1 = prepareShopify({tenantId: T, actorId: OWNER, root: 'x', readFile});
    assert.equal(p1.shopify.equivalence.exact, 857, 'el mapeador reproduce exactamente los pedidos del paquete'); assert.equal(p1.shopify.equivalence.different, 0);
    const t1 = await runAll(pool, p1.files); assert.deepEqual({i: t1.inserted, r: t1.replayed}, {i: 883, r: 0});
    // 2) reenvío (lo que haría cargar-shopify.sh hoy): todo repetido, tabla intacta
    const before = await digest(pool); const t2 = await runAll(pool, prepareShopify({tenantId: T, actorId: OWNER, root: 'x', readFile}).files);
    assert.deepEqual({i: t2.inserted, r: t2.replayed}, {i: 0, r: 883}); assert.deepEqual(await digest(pool), before);
    // 3) ampliación: 40 pedidos anteriores al 6-ago + el paquete (que se repite)
    const older = Array.from({length: 40}, (_, i) => ({id: `gid://shopify/Order/${7000000 + i}`, createdAt: new Date(Date.UTC(2026, 5, 1) + i * 86400000 / 3).toISOString().slice(0, 19) + 'Z', cancelledAt: null, displayFinancialStatus: 'PAID', totalPriceSet: {shopMoney: {minorUnits: String(2000 + i), currency: 'USD', sourceDecimal: ((2000 + i) / 100).toFixed(1)}}}));
    const extraPath = path.join(dir, 'extra.json'); writeFileSync(extraPath, JSON.stringify({orders: [...older, orders[0]], refunds: []}));
    const p3 = prepareShopify({tenantId: T, actorId: OWNER, root: 'x', extraNormalized: {path: extraPath}, readFile});
    assert.equal(p3.shopify.extras.length, 40, 'el pedido ya cargado no cuenta como nuevo');
    assert.equal(p3.files[0].name, '00-ampliar-ventana-fuente-pedidos.sql');
    const t3 = await runAll(pool, p3.files);
    assert.deepEqual({i: t3.inserted, r: t3.replayed}, {i: 40, r: 883});
    const v = (await pool.query('SELECT version, window_start FROM public.economic_source_versions WHERE source_id=$1 ORDER BY version', [SO])).rows;
    assert.deepEqual(v.map(x => x.version), [1, 2]); assert.ok(v[1].window_start <= new Date('2026-06-01T00:00:00Z'));
    assert.equal((await pool.query('SELECT count(*)::int n FROM public.economic_ledger_entries')).rows[0].n, 923);
    // 4) rerun de la ampliación: nada nuevo
    const t4 = await runAll(pool, p3.files.slice(1)); assert.deepEqual({i: t4.inserted, r: t4.replayed}, {i: 0, r: 923});
  } finally { await pool.end(); rmSync(dir, {recursive: true, force: true}); }
});

test.after(async () => { if (admin) { for (const n of created) await admin.query(`DROP DATABASE IF EXISTS ${n}`).catch(() => {}); await admin.end(); } });
