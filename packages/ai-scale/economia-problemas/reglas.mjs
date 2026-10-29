// REGLAS PURAS (sin E/S) del vínculo problema -> pedido/reembolso del libro económico (exposición económica por problema).
//
// Cadena de evidencia (cada eslabón y su clase epistémica):
//   problema  --(membresía vectorial, IA: INFERIDO)-->  conversación (hubspot:<ticket> | gorgias:<id>)
//   conversación --(mismo ticket)--> fila de economia-tickets.csv (cliente piloto, hash fijado)  [OBSERVADO en la fuente del cliente piloto]
//   fila --(marketplace + order_id [+ sku], identificadores EXACTOS)--> línea del libro (economic_ledger_entries)  [OBSERVADO]
// El importe es el del libro (observado). La relación problema->dinero hereda el carácter INFERIDO de la agrupación por IA.
//
// Lo que NO se hace (por diseño): nada de coincidencias aproximadas, por nombre/dirección/teléfono, por fecha ni por importe;
// no se infiere marketplace desde la forma del order_id; no se ligan pedidos multilínea sin SKU coincidente.
import {tiendaPropia} from '../../../config/cliente-piloto.mjs';
// Dominio de la tienda propia del cliente piloto: viene de la configuración local (config/cliente-piloto.mjs), no del repo.
export const rxDominioTienda = () => tiendaPropia().dominio.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const RX_TIENDA_PROPIA_SHOPIFY = new RegExp('^' + rxDominioTienda() + '\\b.*Shopify', 'i');

export const REGLA_VERSION = 'econ-problemas-r1';
export const BASIS_ORDER_MP = 'marketplace_line_price';
export const BASIS_REFUND_MP = 'marketplace_refund_amount';
export const BASIS_SHOPIFY = 'gross_order_including_tax_shipping';
export const MARKETPLACES = Object.freeze(['amazon', 'walmart', 'mirakl_bestbuy_us', 'mirakl_bestbuy_ca', 'shopify']);

// Clases de relación (lo que la UI/el informe debe decir, no una nota al pie):
export const CLASE = Object.freeze({
  A: 'observada: pedido+SKU idénticos en el ticket y el libro',
  B: 'observada a nivel pedido: el ticket no trae SKU utilizable y el pedido tiene UNA sola línea elegible',
  C: 'inferida: el SKU del ticket difiere del único SKU del pedido (solo con --aceptar-sku-distinto)',
});

const trim = v => (v ?? '').trim();

// «Pending», «NA», «Other»… son marcadores de «sin dato», no SKUs (verificado en los datos: 30,733 «Pending»).
const PLACEHOLDER = /^(pending|na|n\/a|none|null|unknown|tbd|other|-+|\?+)$/i;
export const skuUtil = s => { const v = trim(s); return v === '' || PLACEHOLDER.test(v) ? null : v; };

/** Marketplace del libro para una fila del puente. Solo texto explícito, nunca la forma del order_id. */
export function marketplaceDe(row) {
  const mk = trim(row.marketplace).toLowerCase(), ret = trim(row.retailer);
  const porRetailer = (() => {
    if (/^Amazon\s*::/i.test(ret)) return 'amazon';
    if (/^Walmart\s*::/i.test(ret)) return 'walmart';
    if (/^Best Buy\s*::\s*USA$/i.test(ret)) return 'mirakl_bestbuy_us';
    if (/^Best Buy\s*::\s*CAN$/i.test(ret)) return 'mirakl_bestbuy_ca';
    if (RX_TIENDA_PROPIA_SHOPIFY.test(ret)) return 'shopify';
    return null;
  })();
  if (MARKETPLACES.includes(mk)) {
    if (porRetailer && porRetailer !== mk) return null;                 // columnas contradictorias: no se liga
    return {mk, via: 'columna'};
  }
  if (mk === 'bestbuy') return porRetailer && porRetailer.startsWith('mirakl_bestbuy') ? {mk: porRetailer, via: 'retailer'} : null; // CA/US solo por retailer explícito
  if (mk === '' && porRetailer) return {mk: porRetailer, via: 'retailer'};
  return null;                                                          // lowes, vacío sin retailer, etc.: sin libro
}

/** order_id canónico por marketplace (solo recorte/«#» de Shopify). */
export function pedidoClave(mk, orderId) {
  const v = trim(orderId);
  if (v === '') return null;
  return mk === 'shopify' ? v.replace(/^#/, '') : v;
}

/** ids de tickets fusionados («a;b», «a,b», «a b»): solo dígitos. */
export function parseFusionados(s) {
  return [...new Set(trim(s).split(/[^0-9]+/).filter(x => /^\d{5,20}$/.test(x)))];
}

/**
 * Elige UNA línea del libro para (ticket, pedido). lineas = líneas ELEGIBLES del pedido: [{sku, entityId, ...}].
 * Devuelve {tier:'A'|'B'|'C', linea} o {tier:null, motivo}.
 */
export function elegirLinea(skuTicket, lineas, {aceptarSkuDistinto = false} = {}) {
  if (!lineas || lineas.length === 0) return {tier: null, motivo: 'sin_linea_elegible'};
  const sku = skuUtil(skuTicket);
  if (sku) {
    const iguales = lineas.filter(l => l.sku === sku || (Array.isArray(l.skus) && l.skus.includes(sku)));
    if (iguales.length === 1) return {tier: 'A', linea: iguales[0]};
    if (iguales.length > 1) return {tier: null, motivo: 'sku_repetido_en_pedido'};
    if (lineas.length === 1 && aceptarSkuDistinto) return {tier: 'C', linea: lineas[0]};
    return {tier: null, motivo: lineas.length === 1 ? 'sku_distinto_linea_unica' : 'sku_sin_coincidencia_multilinea'};
  }
  if (lineas.length === 1) return {tier: 'B', linea: lineas[0]};
  return {tier: null, motivo: 'sin_sku_multilinea'};
}

/**
 * Construye los pares ticket -> línea del libro.
 *   ticketRows: filas de economia-tickets.csv ya parseadas (objetos por columna).
 *   pedidos: Map «mk|orderKey» -> [{sku, entityId}]   (SOLO líneas elegibles: recorded, base limpia, importe conocido)
 *   reembolsos: Map «mk|orderKey» -> [{sku, entityId}] (SOLO reembolsos settled con base limpia)
 * Devuelve {pares, stats}. Un par = {ticket, gorgias, fusionados, mk, via, kind, tier, entityId}.
 */
export function construirPares({ticketRows, pedidos, reembolsos, aceptarSkuDistinto = false}) {
  const stats = {filas: ticketRows.length, sin_marketplace: 0, sin_pedido_id: 0, motivos: {}, pares: {order: {A: 0, B: 0, C: 0}, refund: {A: 0, B: 0, C: 0}}, via: {columna: 0, retailer: 0}};
  const pares = [];
  const vistos = new Set();
  const motivo = (k, m) => { const key = k + ':' + m; stats.motivos[key] = (stats.motivos[key] ?? 0) + 1; };
  for (const r of ticketRows) {
    const ticket = trim(r.hubspot_ticket_id);
    if (!/^\d{5,20}$/.test(ticket)) { motivo('fila', 'ticket_invalido'); continue; }
    const m = marketplaceDe(r);
    if (!m) { stats.sin_marketplace++; continue; }
    const ok = pedidoClave(m.mk, r.order_id);
    if (!ok) { stats.sin_pedido_id++; continue; }
    stats.via[m.via]++;
    for (const [kind, indice] of [['order', pedidos], ['refund', reembolsos]]) {
      const lineas = indice.get(m.mk + '|' + ok);
      if (!lineas) { motivo(kind, 'pedido_no_esta_en_libro'); continue; }
      const sel = elegirLinea(r.sku, lineas, {aceptarSkuDistinto});
      if (!sel.tier) { motivo(kind, sel.motivo); continue; }
      const key = ticket + '|' + kind + '|' + sel.linea.entityId;
      if (vistos.has(key)) { motivo(kind, 'par_repetido'); continue; }
      vistos.add(key);
      stats.pares[kind][sel.tier]++;
      pares.push({ticket, fecha: trim(r.effective_date).slice(0, 10) || null, gorgias: trim(r.gorgias_id) || null, fusionados: parseFusionados(r.merged_ticket_ids), mk: m.mk, via: m.via, kind, tier: sel.tier, entityId: sel.linea.entityId});
    }
  }
  return {pares, stats};
}

/** Redacta el texto de `report` de cada vínculo: lo atestado por el owner + la regla aplicada (sin datos de clientes). */
export function textoReporte({atestacion, kind, tiers, fuenteSha}) {
  const que = kind === 'refund' ? 'reembolso' : 'pedido';
  const clases = [...tiers].sort().map(t => `${t}: ${CLASE[t]}`).join('; ');
  const r = `${String(atestacion).trim()}\n[${REGLA_VERSION}] Vínculo problema->${que} derivado de forma determinista: conversación del problema (membresía vectorial, inferida por IA) -> ticket hubspot:/gorgias: -> fila de economia-tickets.csv (sha256 ${fuenteSha.slice(0, 12)}) -> ${que} del libro por marketplace+order_id exactos. Clases de relación: ${clases}. El importe es el del libro; no es pérdida ni causalidad probada.`;
  if (r.length < 20 || r.length > 4000) throw new Error('REPORTE_FUERA_DE_RANGO');
  return r;
}

/** Normaliza la sentencia: solo para pruebas de lista cerrada. */
export const sinLiterales = s => s.replace(/\$([a-z0-9]*)\$[\s\S]*?\$\1\$/gi, "''").replace(/'(?:[^']|'')*'/g, "''");
