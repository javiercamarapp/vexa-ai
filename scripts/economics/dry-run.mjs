// DRY-RUN: lee los CSV reales y el paquete Shopify, mapea y emite SOLO conteos/totales (con y sin filas dudosas). NO escribe nada
// (ni base, ni archivos, ni red). Salida: JSON en stdout. Uso: node dry-run.mjs [--root <carpeta VEXA>] [--moneda-desconocida rechazar|XXX] [--sin-shopify]
import {mapAllMarketplaces, DEFAULT_ROOT, PILOT_TENANT} from './fuentes-marketplaces.mjs';
import {packBatches, summarize, MAX_BATCH} from '../../packages/economics/marketplace-map.mjs';
import {dryRunShopify} from './fuentes-shopify.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const root = arg('root', DEFAULT_ROOT), unknownCurrency = arg('moneda-desconocida', 'rechazar');
const r = mapAllMarketplaces({root, unknownCurrency});
const count = (arr, f) => arr.reduce((a, x) => { const k = f(x); a[k] = (a[k] ?? 0) + 1; return a; }, {});
const files = r.perFile.map(p => ({
  archivo: p.spec.key, filas_csv: p.spec.rows, cargadas: p.items.length, rechazadas: p.stats.rejected,
  filas_en_grupos_identicos: p.stats.exactDuplicateGroupRows,
  excedentes_a_revisar: p.items.filter(i => i.meta.dupExtra).length,
  filas_multimoneda: p.items.filter(i => i.meta.multi).length,
  identidades_multimoneda: new Set(p.items.filter(i => i.meta.multi).map(i => i.meta.group)).size,
  moneda_desconocida: p.items.filter(i => i.meta.unknownCurrency).length,
  sin_return_id: p.items.filter(i => i.meta.noReturnId).length,
  vinculadas_a_pedido: p.stats.linked,
  por_estado: count(p.items, i => i.entry.status),
  por_moneda: count(p.items, i => i.entry.currency),
}));
const flagCounts = {};
for (const it of r.items) for (const f of it.meta.flags) flagCounts[f] = (flagCounts[f] ?? 0) + 1;
const ids = new Set(), dupIds = [];
for (const it of r.items) { const k = it.sourceId + '|' + it.entry.kind + '|' + it.entry.externalId; if (ids.has(k)) dupIds.push(1); ids.add(k); }
const batches = packBatches(r.items, MAX_BATCH);
const out = {
  modo: 'dry-run (solo lectura, no escribe)', moneda_desconocida_politica: unknownCurrency,
  totales: {filas_csv: r.perFile.reduce((a, p) => a + p.spec.rows, 0), cargables: r.items.length, rechazadas: r.rejected.length,
    pedidos: r.items.filter(i => i.entry.kind === 'order').length, devoluciones: r.items.filter(i => i.entry.kind === 'refund').length,
    identidades_colisionadas: dupIds.length, tandas_de_hasta_250_y_200KB: batches.length, bytes_max_json_de_tanda: Math.max(...batches.map(b => b.bytes)), rechazadas_por_motivo: count(r.rejected, x => x.motivo), devoluciones_vinculables_diferidas: r.items.filter(i => i.meta.linkable).length, devoluciones_con_orderId_escrito: r.items.filter(i => i.entry.orderId).length, fuentes_a_crear: r.sources.length},
  reglas: {
    a_filas_identicas: {excedentes_a_revisar_fuera_de_totales: r.items.filter(i => i.meta.dupExtra).length, grupos_identicos: new Set(r.items.filter(i => i.meta.inDupGroup).map(i => i.meta.rowSha256)).size, filas_en_grupos_identicos: r.items.filter(i => i.meta.inDupGroup).length, rechazadas_DUPLICADO_EXACTO: r.rejected.filter(x => x.motivo === 'DUPLICADO_EXACTO').length, tienen_identificador_de_linea_los_pedidos: false},
    b_multimoneda: {identidades: new Set(r.items.filter(i => i.meta.multi).map(i => i.meta.group)).size, filas: r.items.filter(i => i.meta.multi).length, monedas_en_esas_filas: count(r.items.filter(i => i.meta.multi), i => i.entry.currency)},
    moneda_desconocida_filas: r.items.filter(i => i.meta.unknownCurrency).length,
    devoluciones_sin_return_id: r.items.filter(i => i.meta.noReturnId).length,
  },
  marcas: flagCounts, archivos: files, totales_por_vista: summarize(r.items),
  fuentes: r.sources.map(s => ({clave: s.key, tipo: s.evidenceType, ventana: s.windowStart.slice(0, 10) + '..' + s.windowEnd.slice(0, 10)})),
};
if (!process.argv.includes('--sin-shopify')) out.shopify = dryRunShopify({tenantId: PILOT_TENANT});
process.stdout.write(JSON.stringify(out, null, 1) + '\n');
