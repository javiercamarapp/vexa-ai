#!/usr/bin/env node
// PASO 1 (local, sin red, sin base): construye los pares ticket -> línea del libro a partir de archivos con HASH FIJADO.
//   node puente.mjs                      # escribe pares-economia.jsonl (0600) + puente-resumen.json (solo conteos)
//   node puente.mjs --aceptar-sku-distinto   # añade la clase C (inferida); por defecto NO
// Entradas (solo lectura): economia-tickets.csv (cliente piloto), los 8 CSV de marketplaces (los mismos que cargó economico-carga) y el
// paquete/normalizado de Shopify. El libro real se mapea con los MISMOS mapeadores que lo cargaron (marketplace-map.mjs / shopify-map.mjs),
// así que los entity_id coinciden con los de producción; el SQL de vinculos.mjs lo vuelve a verificar contra la base antes de insertar.
// Nunca imprime identificadores de pedidos, tickets ni clientes: solo conteos.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {parseCsv} from '../../economics/csv.mjs';
import {entityId, sha256hex} from '../../economics/marketplace-map.mjs';
import {mapAllMarketplaces, DEFAULT_ROOT, PILOT_TENANT} from '../../../scripts/economics/fuentes-marketplaces.mjs';
import {loadShopify, SHOPIFY_ROOT} from '../../../scripts/economics/fuentes-shopify.mjs';
import {construirPares, pedidoClave, BASIS_ORDER_MP, BASIS_REFUND_MP, BASIS_SHOPIFY, REGLA_VERSION} from './reglas.mjs';

export const TICKETS_FILE = {rel: 'economia-tickets.csv', sha256: 'cfa61ff9e26ffa2f81da3e395a3ae033de62def38111c3e1434e200f98666acc', rows: 102206};
export const OUT_DEFAULT = path.join(os.homedir(), '.codex-work/rovaq-cierre-20261007/ia-escala-20261019/economia-problemas');

const stripSuffix = s => s.replace(/~dup\d+$/, '').replace(/#[a-f0-9]{12}$/, '');

/** Índice de pedidos elegibles de marketplaces: «mk|order_id» -> [{sku, entityId}]. Solo recorded, base limpia, importe y moneda conocidos. */
export function indexarMarketplaces(items, tenantId = PILOT_TENANT) {
  const pedidos = new Map(), reembolsos = new Map(), stats = {pedidos_elegibles: 0, pedidos_no_elegibles: 0, reembolsos_elegibles: 0, reembolsos_no_elegibles: 0};
  for (const it of items) {
    const e = it.entry;
    if (e.kind === 'order') {
      const [mk, oid, sku] = stripSuffix(e.externalId).split('|');
      const ok = e.status === 'recorded' && e.basis === BASIS_ORDER_MP && e.amountMinor !== null && e.currency !== 'XXX';
      if (!ok) { stats.pedidos_no_elegibles++; continue; }
      const k = mk + '|' + oid;
      (pedidos.get(k) ?? pedidos.set(k, []).get(k)).push({sku, entityId: entityId(tenantId, it.sourceId, 'order', e.externalId), currency: e.currency, amountMinor: e.amountMinor});
      stats.pedidos_elegibles++;
    } else if (e.kind === 'refund') {
      // La clave del libro de devoluciones es mk|return_id|line|sku; pedido y SKU salen del texto generado por el mapeador (report).
      const m = /devolución [^;]*; pedido ([^;]*); línea [^;]*; sku (.*?)\. Procedencia/.exec(e.report);
      const ok = m && e.status === 'settled' && e.basis === BASIS_REFUND_MP && e.amountMinor !== null && e.currency !== 'XXX';
      if (!ok) { stats.reembolsos_no_elegibles++; continue; }
      const mk = e.externalId.split('|')[0];
      const k = mk + '|' + m[1].trim();
      (reembolsos.get(k) ?? reembolsos.set(k, []).get(k)).push({sku: m[2].trim(), entityId: entityId(tenantId, it.sourceId, 'refund', e.externalId), currency: e.currency, amountMinor: e.amountMinor});
      stats.reembolsos_elegibles++;
    }
  }
  return {pedidos, reembolsos, stats};
}

/** Pedidos de Shopify: «shopify|<número sin #>» -> [{sku:null, skus:[...], entityId}] (una «línea» por pedido; el libro guarda el pedido completo). */
export function indexarShopify({normalized, packageEntries, tenantId = PILOT_TENANT}) {
  const porGid = new Map(packageEntries.filter(e => e.kind === 'order').map(e => [e.externalId, e]));
  const out = new Map();
  let elegibles = 0, noElegibles = 0;
  for (const o of normalized.orders) {
    const e = porGid.get(o.id);
    if (!e || e.status !== 'recorded' || e.basis !== BASIS_SHOPIFY || e.amountMinor === null) { noElegibles++; continue; }
    const nombre = pedidoClave('shopify', o.name);
    if (!nombre) { noElegibles++; continue; }
    const skus = (o.lineItems?.nodes ?? o.lineItems ?? []).map(l => (l.sku ?? '').trim()).filter(Boolean);
    const k = 'shopify|' + nombre;
    (out.get(k) ?? out.set(k, []).get(k)).push({sku: null, skus: [...new Set(skus)], entityId: entityId(tenantId, e.sourceId, 'order', e.externalId), currency: 'USD', amountMinor: e.amountMinor});
    elegibles++;
  }
  // nombres duplicados en Shopify serían ambiguos: se quedan con 2 «líneas» y elegirLinea los rechaza
  return {pedidos: out, stats: {shopify_elegibles: elegibles, shopify_no_elegibles: noElegibles}};
}

export function leerTickets(root = DEFAULT_ROOT, file = TICKETS_FILE) {
  const bytes = fs.readFileSync(path.join(root, file.rel));
  const sha = sha256hex(bytes);
  if (sha !== file.sha256) throw new Error(`HASH_DISTINTO ${file.rel}: ${sha.slice(0, 12)}…`);
  const t = parseCsv(bytes.toString('utf8'));
  if (file.rows !== undefined && t.rows.length !== file.rows) throw new Error('FILAS_INESPERADAS ' + file.rel);
  for (const c of ['hubspot_ticket_id', 'gorgias_id', 'marketplace', 'retailer', 'order_id', 'sku', 'merged_ticket_ids']) if (!t.header.includes(c)) throw new Error('COLUMNA_AUSENTE ' + c);
  return {rows: t.rows, sha256: sha};
}

export function construirTodo({root = DEFAULT_ROOT, shopifyRoot = SHOPIFY_ROOT, aceptarSkuDistinto = false, tenantId = PILOT_TENANT, now = new Date()} = {}) {
  const tickets = leerTickets(root);
  const mp = mapAllMarketplaces({root, tenantId, now});
  const idxMp = indexarMarketplaces(mp.items, tenantId);
  const sh = loadShopify({root: shopifyRoot});
  const normalized = JSON.parse(fs.readFileSync(path.join(shopifyRoot, 'shopify-normalized-private.json'), 'utf8'));
  const idxSh = indexarShopify({normalized, packageEntries: sh.groups.flatMap(g => g.entries.map(x => ({...x.entry, kind: x.kind, sourceId: g.source.sourceId}))), tenantId});
  const pedidos = new Map([...idxMp.pedidos, ...idxSh.pedidos]);
  const r = construirPares({ticketRows: tickets.rows, pedidos, reembolsos: idxMp.reembolsos, aceptarSkuDistinto});
  return {pares: r.pares, stats: r.stats, ledger: {...idxMp.stats, ...idxSh.stats}, ticketsSha: tickets.sha256, regla: REGLA_VERSION};
}

/** Resumen SIN identificadores: conteos de pares, tickets y entidades distintas por clase y marketplace. */
export function resumir(pares, extra = {}) {
  const por = {};
  for (const p of pares) {
    const k = `${p.kind}|${p.mk}|${p.tier}`;
    por[k] = (por[k] ?? 0) + 1;
  }
  const tickets = new Set(pares.map(p => p.ticket));
  return {pares: pares.length, tickets_distintos: tickets.size, entidades_distintas: new Set(pares.map(p => p.entityId)).size, por_tipo_marketplace_clase: por, ...extra};
}

async function cli() {
  const a = process.argv.slice(2), opt = (n, d) => { const i = a.indexOf('--' + n); return i >= 0 ? a[i + 1] : d; };
  const out = opt('out', OUT_DEFAULT);
  const r = construirTodo({root: opt('root', DEFAULT_ROOT), aceptarSkuDistinto: a.includes('--aceptar-sku-distinto')});
  fs.mkdirSync(out, {recursive: true, mode: 0o700});
  const file = path.join(out, 'pares-economia.jsonl');
  fs.writeFileSync(file, r.pares.map(p => JSON.stringify(p)).join('\n') + '\n', {mode: 0o600});
  const resumen = {regla: r.regla, tickets_sha256: r.ticketsSha, acepta_sku_distinto: a.includes('--aceptar-sku-distinto'), ...resumir(r.pares, {fuente: r.stats, ledger: r.ledger}), archivo_pares_sha256: createHash('sha256').update(fs.readFileSync(file)).digest('hex')};
  fs.writeFileSync(path.join(out, 'puente-resumen.json'), JSON.stringify(resumen, null, 1), {mode: 0o600});
  console.log(JSON.stringify(resumen, null, 1));
}
if (import.meta.url === `file://${process.argv[1]}`) cli().catch(e => { console.error('ERROR', String(e.message).slice(0, 200)); process.exit(1); });
