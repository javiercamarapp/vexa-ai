// Shopify: paquete de importación (hash fijado) + opción de pedidos adicionales. Sin red, sin base.
import {readFileSync, lstatSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {configPiloto} from '../../config/cliente-piloto.mjs';
import {sha256hex} from '../../packages/economics/marketplace-map.mjs';
import {mapShopifyOrder, importEntryToBatch, sameEntry, SHOPIFY_BASIS} from '../../packages/economics/shopify-map.mjs';

// Copias fijadas (hash verificado) fuera de iCloud y fuera del repo; los originales no se tocan.
// Ruta, nombres y huellas salen de la configuración local del cliente piloto (config/cliente-piloto.mjs).
export const SHOPIFY_ROOT = configPiloto().shopify.raiz;
export const SHOPIFY_FILES = {
  get importPackage() { return exigirArchivo('importPackage'); },
  get normalized() { return exigirArchivo('normalized'); },
};
function exigirArchivo(clave) {
  const f = configPiloto().shopify[clave];
  if (!f?.rel || !f?.sha256) throw new Error(`Falta shopify.${clave} en config/cliente-piloto.local.json (ver config/cliente-piloto.ejemplo.json)`);
  return f;
}

/** Falla si el archivo es un marcador iCloud no descargado (compressed,dataless). */
export function assertMaterialized(p) {
  try {
    const flags = execFileSync('/bin/ls', ['-lOd', p], {encoding: 'utf8'});
    if (/dataless/.test(flags)) throw new Error('ICLOUD_NO_MATERIALIZADO ' + p);
  } catch (e) { if (/ICLOUD/.test(e.message)) throw e; }
  if (lstatSync(p).size === 0) throw new Error('ARCHIVO_VACIO ' + p);
}

export function readShopifyFile(root, file) {
  const p = path.join(root, file.rel);
  assertMaterialized(p);
  const bytes = readFileSync(p);
  const sha = sha256hex(bytes);
  if (sha !== file.sha256) throw new Error(`HASH_DISTINTO ${file.rel}: ${sha.slice(0, 12)}…`);
  return {bytes, text: bytes.toString('utf8'), sha};
}

/** Carga el paquete verificado y, opcionalmente, un normalized adicional (misma forma) con pedidos nuevos. */
export function loadShopify({root = SHOPIFY_ROOT, extraNormalized = null, readFile = readShopifyFile} = {}) {
  const pkg = JSON.parse(readFile(root, SHOPIFY_FILES.importPackage).text);
  if (pkg.schema !== 'rovaq-economic-import-v1') throw new Error('PAQUETE_SCHEMA');
  const norm = readFile(root, SHOPIFY_FILES.normalized);
  const normalized = JSON.parse(norm.text);
  const sources = pkg.sources.map(s => ({...s}));
  const bySource = new Map(sources.map(s => [s.sourceId, {source: s, entries: []}]));
  for (const e of pkg.entries) {
    const g = bySource.get(e.sourceId);
    if (!g) throw new Error('PAQUETE_FUENTE_DESCONOCIDA');
    if (e.sourceVersion !== 1) throw new Error('PAQUETE_VERSION');
    g.entries.push({entry: importEntryToBatch(e), kind: e.kind});
  }
  // equivalencia del mapeador contra lo ya cargado (todos los pedidos)
  const baselineOrders = pkg.entries.filter(e => e.kind === 'order');
  let exact = 0, different = 0;
  normalized.orders.forEach((o, i) => { const m = mapShopifyOrder(o, i, norm.sha); const b = baselineOrders[i]; if (b && sameEntry(m, importEntryToBatch(b))) exact++; else different++; });
  const extras = [];
  if (extraNormalized) {
    const ex = JSON.parse(readFileSync(extraNormalized.path, 'utf8'));
    const exSha = sha256hex(readFileSync(extraNormalized.path));
    const known = new Set(baselineOrders.map(e => e.externalId));
    ex.orders.forEach((o, i) => { if (!known.has(o.id)) extras.push(mapShopifyOrder(o, i, exSha)); });
  }
  return {package: pkg, normalizedSha: SHOPIFY_FILES.normalized.sha256, groups: [...bySource.values()], sources, equivalence: {orders: normalized.orders.length, exact, different}, extras};
}

export function dryRunShopify({root = SHOPIFY_ROOT, extraNormalized = null} = {}) {
  const s = loadShopify({root, extraNormalized});
  const all = s.groups.flatMap(g => g.entries);
  const count = f => all.reduce((a, x) => { const k = f(x); a[k] = (a[k] ?? 0) + 1; return a; }, {});
  const sum = k => all.filter(x => x.kind === k && x.entry.amountMinor !== null).reduce((a, x) => a + BigInt(x.entry.amountMinor), 0n).toString();
  const win = Math.min(...s.package.sources.map(x => Date.parse(x.windowStart)));
  return {
    paquete: {sha256: SHOPIFY_FILES.importPackage.sha256.slice(0, 16) + '…', entradas: all.length, pedidos: all.filter(x => x.kind === 'order').length, reembolsos: all.filter(x => x.kind === 'refund').length, por_tipo_estado: count(x => x.kind + '/' + x.entry.status), importe_pedidos_minor: sum('order'), importe_reembolsos_minor: sum('refund'), base: SHOPIFY_BASIS, moneda: 'USD'},
    esperado_en_ledger_remoto: configPiloto().shopify.esperadoEnLedger ?? null, // cifras reales: solo en la configuración local
    equivalencia_mapeador_vs_paquete: s.equivalence,
    ventana_actual_fuente_inicio: new Date(win).toISOString().slice(0, 10),
    pedidos_adicionales_a_cargar: s.extras.length,
    nota: 'Con los datos locales actuales todo el paquete ya está en el ledger remoto: el reenvío debe dar todas repetidas y 0 insertadas. Pedidos anteriores al 2026-08-06 requieren obtenerlos de Shopify (fuera de este alcance).',
  };
}
