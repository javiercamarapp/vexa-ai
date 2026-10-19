// Prepara (NO ejecuta) la carga económica: un SQL por tanda (≤250) + fuentes + MANIFEST.json + consultas SOLO SELECT de verificación.
// Uso: node preparar.mjs --modo marketplaces|shopify --tenant <uuid> --out <carpeta> [--actor <uuid>] [--moneda-desconocida rechazar|XXX] [--extra-normalized <json>] [--root <carpeta CSV>]
// No usa red ni base. La carpeta de salida queda con permisos 700 (contiene identificadores de pedidos).
import {writeFileSync, mkdirSync, chmodSync, readdirSync, rmSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {packBatches, MAX_BATCH, summarize} from '../../packages/economics/marketplace-map.mjs';
import {batchSql, sourcesSql, sourceExtendSql} from '../../packages/economics/emit-sql.mjs';
import {mapAllMarketplaces, DEFAULT_ROOT, CLIENTEX_TENANT} from './fuentes-marketplaces.mjs';
import {loadShopify, SHOPIFY_ROOT} from './fuentes-shopify.mjs';
import {syntheticMarketplaceTexts} from '../../packages/economics/synthetic.mjs';

const sha = s => createHash('sha256').update(s).digest('hex');
const lit = s => "'" + String(s).replace(/'/g, "''") + "'";

export function prepareMarketplaces({tenantId, actorId = null, root = DEFAULT_ROOT, unknownCurrency = 'rechazar', now = new Date(), readFile}) {
  const r = mapAllMarketplaces({root, tenantId, unknownCurrency, now, ...(readFile ? {readFile} : {})});
  if (r.rejected.length && unknownCurrency === 'XXX') { /* los rechazos explícitos se reportan; no abortan */ }
  const files = [];
  files.push({name: '00-fuentes.sql', sql: sourcesSql(tenantId, r.sources, actorId), kind: 'fuentes', entries: 0, source: null});
  const byKey = new Map(r.perFile.filter(p => p.source).map(p => [p.source.sourceId, p.spec.key]));
  const counters = {};
  packBatches(r.items, MAX_BATCH).forEach((b, i) => {
    const key = byKey.get(b.sourceId); counters[key] = (counters[key] ?? 0) + 1;
    const label = `${key}-${String(counters[key]).padStart(3, '0')}`;
    files.push({name: `${String(i + 1).padStart(4, '0')}-${label}.sql`, sql: batchSql(tenantId, {sourceId: b.sourceId, sourceVersion: 1, entries: b.items.map(x => x.entry), label}, actorId), kind: 'tanda', entries: b.items.length, source: key});
  });
  return {files, items: r.items, rejected: r.rejected, sources: r.sources, perFile: r.perFile, summary: summarize(r.items)};
}

export function prepareShopify({tenantId, actorId = null, root = SHOPIFY_ROOT, extraNormalized = null, readFile}) {
  const s = loadShopify({root, extraNormalized, ...(readFile ? {readFile} : {})});
  const files = [];
  let n = 0, version = 1;
  const extras = s.extras;
  const orderSource = s.package.sources.find(x => x.evidenceType === 'order_export');
  if (extras.length) {
    const first = extras.map(e => e.effectiveAt).sort()[0];
    const wsCurrent = orderSource.windowStart;
    if (first < wsCurrent) { version = 2; files.push({name: '00-ampliar-ventana-fuente-pedidos.sql', sql: sourceExtendSql(tenantId, {sourceId: orderSource.sourceId, toVersion: 2, windowStart: first.slice(0, 10) + 'T00:00:00.000Z', windowEnd: orderSource.windowEnd}, actorId), kind: 'fuentes', entries: 0, source: 'shopify-pedidos'}); }
  }
  for (const g of s.groups) {
    const base = g.entries.map(x => x.entry);
    const isOrder = g.source.evidenceType === 'order_export';
    const all = isOrder ? [...base, ...extras] : base;
    const label0 = isOrder ? 'shopify-pedidos' : 'shopify-reembolsos';
    let k = 0;
    for (let i = 0; i < all.length; i += MAX_BATCH) {
      k++; n++;
      const chunk = all.slice(i, i + MAX_BATCH);
      files.push({name: `${String(n).padStart(4, '0')}-${label0}-${String(k).padStart(3, '0')}.sql`, sql: batchSql(tenantId, {sourceId: g.source.sourceId, sourceVersion: isOrder ? version : 1, entries: chunk, label: `${label0}-${String(k).padStart(3, '0')}`}, actorId), kind: 'tanda', entries: chunk.length, source: label0});
    }
  }
  const items = s.groups.flatMap(g => g.entries.map(x => ({sourceId: g.source.sourceId, entry: x.entry}))).concat(extras.map(e => ({sourceId: orderSource.sourceId, entry: e})));
  return {files, shopify: s, items, sources: s.groups.map(g => g.source)};
}

/** Consultas SOLO SELECT: comparan el ledger real con lo esperado (derivado de los mismos datos). Cero filas en «diferencias» = correcto. */
export function verificationQueries(tenantId, items, sources, {provenance = true, flags = true} = {}) {
  const ids = sources.map(s => lit(s.sourceId) + '::uuid').join(',');
  const agg = new Map();
  for (const {sourceId, entry} of items) {
    const k = [sourceId, entry.kind, entry.currency, entry.basis, entry.status].join('\u0001');
    const a = agg.get(k) ?? {n: 0, sum: 0n, unk: 0}; a.n++; if (entry.amountMinor === null) a.unk++; else a.sum += BigInt(entry.amountMinor); agg.set(k, a);
  }
  const values = [...agg.entries()].sort().map(([k, a]) => { const [sid, kind, cur, basis, st] = k.split('\u0001'); return `(${lit(sid)}::uuid,${lit(kind)},${lit(cur)},${lit(basis)},${lit(st)},${a.n},${a.sum.toString()}::numeric,${a.unk})`; }).join(',\n    ');
  const T = lit(tenantId) + '::uuid';
  const Q = [];
  Q.push({name: 'V1', sql: `-- V1 totales por fuente (kind, filas, revisión máxima, entidades distintas)
select s.name, e.kind, count(*) filas, max(e.revision) rev_max, count(distinct e.entity_id) entidades
from public.economic_ledger_entries e join public.economic_source_versions s on s.tenant_id=e.tenant_id and s.source_id=e.source_id and s.version=1
where e.tenant_id=${T} and e.source_id in (${ids}) group by 1,2 order by 1,2;
`});
  Q.push({name: 'V2', sql: `-- V2 DIFERENCIAS contra lo esperado por (fuente, tipo, moneda, base, estado): filas, suma de importes conocidos, importes desconocidos
with esperado(source_id,kind,currency,basis,status,filas,suma,desconocidos) as (values
    ${values}),
real as (select source_id,kind,currency,basis,status,count(*)::bigint filas,coalesce(sum(amount_minor),0) suma,count(*) filter (where amount_minor is null)::bigint desconocidos
  from public.economic_ledger_entries where tenant_id=${T} and source_id in (${ids}) group by 1,2,3,4,5)
select 'diferencias' as chequeo,coalesce(e.source_id,r.source_id) source_id,coalesce(e.kind,r.kind) kind,coalesce(e.currency,r.currency) currency,coalesce(e.basis,r.basis) basis,coalesce(e.status,r.status) status,e.filas esperado_filas,r.filas real_filas,e.suma esperado_suma,r.suma real_suma,e.desconocidos esperado_desc,r.desconocidos real_desc
from esperado e full outer join real r using(source_id,kind,currency,basis,status)
where e.filas is distinct from r.filas or e.suma is distinct from r.suma or e.desconocidos is distinct from r.desconocidos;
`});
  Q.push({name: 'V3', sql: `-- V3 identidad única y sin segundas revisiones (esperado: 0 y 0)
select count(*)-count(distinct entity_id) as entidades_repetidas, count(*) filter (where revision<>1) as revision_distinta_de_1
from public.economic_ledger_entries where tenant_id=${T} and source_id in (${ids});
`});
  if (provenance) Q.push({name: 'V4', sql: `-- V4 procedencia: cada fila cita archivo, hash de archivo y hash de fila (esperado: sin_procedencia = 0)
select count(*) filter (where report !~ 'archivo [^ ]+ \\(SHA-256 [a-f0-9]{64}\\), fila CSV [0-9]+, SHA-256 de la fila [a-f0-9]{64}') as sin_procedencia, count(*) as total
from public.economic_ledger_entries where tenant_id=${T} and source_id in (${ids});
`});
  if (flags) Q.push({name: 'V5', sql: `-- V5 filas marcadas (esperado: ver NOTAS.md): a revisar fuera de totales, multimoneda, sin moneda
select count(*) filter (where basis like '%|a_revisar:duplicado_exacto_sin_id_linea%') excedentes_identicos,
       count(*) filter (where basis like '%|a_revisar:sin_return_id%') devoluciones_sin_return_id,
       count(*) filter (where basis like '%|multimoneda%') multimoneda,
       count(*) filter (where basis like '%|a_revisar:reembolso_en_origen%') reembolso_en_origen,
       count(*) filter (where order_id is not null) con_order_id,
       count(*) filter (where currency='XXX') moneda_desconocida,
       count(*) filter (where currency='XXX' and amount_minor is not null) moneda_desconocida_con_importe_ERROR
from public.economic_ledger_entries where tenant_id=${T} and source_id in (${ids});
`});
  Q.push({name: 'V6', sql: `-- V6 el tenant: ninguna fila de estas fuentes en otro tenant (esperado: 0)
select count(*) as filas_en_otro_tenant from public.economic_ledger_entries where source_id in (${ids}) and tenant_id<>${T};
`});
  Q.push({name: 'V7', sql: `-- V7 intactas: filas del ledger de Shopify que no son de esta carga (esperado: 883 si ya estaba cargado)
select count(*) as filas_otras_fuentes_del_tenant from public.economic_ledger_entries where tenant_id=${T} and source_id not in (${ids});
`});
  return Q;
}
export const verificationSql = (tenantId, items, sources, o) => `-- SOLO SELECT. Resultado esperado: «diferencias» sin filas; las demás consultas, los números indicados en NOTAS.md.\n` + verificationQueries(tenantId, items, sources, o).map(q => q.sql).join('');

function write(out, files) {
  mkdirSync(out, {recursive: true, mode: 0o700}); chmodSync(out, 0o700);
  for (const f of readdirSync(out)) if (/\.sql$/.test(f)) rmSync(path.join(out, f));
  const manifest = [];
  for (const f of files) { const p = path.join(out, f.name); writeFileSync(p, f.sql, {mode: 0o600}); manifest.push({file: f.name, sha256: sha(f.sql), bytes: Buffer.byteLength(f.sql), kind: f.kind, entries: f.entries, source: f.source}); }
  return manifest;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
  const modo = arg('modo'), tenantId = arg('tenant', CLIENTEX_TENANT), out = arg('out'), actorId = arg('actor', process.env.VEXA_ACTOR || null);
  if (!modo || !out) { console.error('Uso: --modo marketplaces|shopify --out <carpeta> [--tenant uuid] [--actor uuid]'); process.exit(2); }
  let files, extra = {};
  if (modo === 'marketplaces') {
    // --sintetico: SOLO PARA PRUEBAS LOCALES (datos inventados del mismo volumen; no lee los CSV reales ni verifica sus hashes).
    let readFile; if (process.argv.includes('--sintetico')) { const t = syntheticMarketplaceTexts(); readFile = (_r, spec) => { const text = t.get(spec.rel); return {text, sha: sha(text)}; }; }
    const p = prepareMarketplaces({tenantId, actorId, root: arg('root', DEFAULT_ROOT), unknownCurrency: arg('moneda-desconocida', 'rechazar'), readFile});
    files = p.files;
    files.push({name: 'VERIFICAR-solo-select.sql', sql: verificationSql(tenantId, p.items, p.sources), kind: 'verificacion', entries: 0, source: null});
    extra = {rechazadas: p.rejected.length, esperado: p.summary};
  } else if (modo === 'shopify') {
    const extraPath = arg('extra-normalized', null);
    const p = prepareShopify({tenantId, actorId, extraNormalized: extraPath ? {path: extraPath} : null});
    files = p.files; extra = {pedidos_adicionales: p.shopify.extras.length};
    files.push({name: 'VERIFICAR-shopify-solo-select.sql', sql: verificationSql(tenantId, p.items, p.sources, {provenance: false, flags: false}), kind: 'verificacion', entries: 0, source: null});
  } else { console.error('modo inválido'); process.exit(2); }
  if (process.argv.includes('--solo-verificar')) { mkdirSync(out, {recursive: true, mode: 0o700}); const v = files.find(f => f.kind === 'verificacion'); writeFileSync(path.join(out, v.name), v.sql, {mode: 0o600}); writeFileSync(path.join(out, 'esperado-' + modo + '.json'), JSON.stringify({modo, tenant: tenantId, ...extra}, (k, x) => typeof x === 'bigint' ? x.toString() : x, 1), {mode: 0o600}); console.log(JSON.stringify({modo, solo_verificar: true, archivo: v.name})); process.exit(0); }
  const manifest = write(out, files.filter(f => f.kind !== 'verificacion'));
  const ver = files.find(f => f.kind === 'verificacion');
  if (ver) writeFileSync(path.join(out, ver.name), ver.sql, {mode: 0o600});
  writeFileSync(path.join(out, 'lista.tsv'), manifest.filter(m => m.kind !== 'verificacion').map(m => [m.file, m.entries, m.kind, m.sha256].join('\t')).join('\n') + '\n', {mode: 0o600});
  const tandas = manifest.filter(m => m.kind === 'tanda');
  const doc = {modo, tenant: tenantId, generado: new Date().toISOString(), archivos: manifest.length, tandas: tandas.length, entradas: tandas.reduce((a, m) => a + m.entries, 0), ...extra, manifest};
  writeFileSync(path.join(out, 'MANIFEST.json'), JSON.stringify(doc, null, 1), {mode: 0o600});
  console.log(JSON.stringify({modo, archivos: manifest.length, tandas: tandas.length, entradas: doc.entradas, ...(extra.rechazadas !== undefined ? {rechazadas: extra.rechazadas} : {}), ...(extra.pedidos_adicionales !== undefined ? {pedidos_adicionales: extra.pedidos_adicionales} : {})}));
}
