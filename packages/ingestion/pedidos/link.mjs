// Unión pedidos <-> tickets <-> envíos por (order_key, retailer) y cobertura. Oráculo puro en JS de las vistas SQL.
// unknown != zero: lo que no trae ID válido es «sin_id»; lo que trae ID y no encuentra par es «sin_ligar»; la cobertura es null sin denominador.
import {normalizeOrderId, normalizeRetailer} from './order-id.mjs';

const PROPS = {orderId: ['order_id'], retailer: ['retailer'], purchaseDate: ['date_of_purchase'], sku: ['sku'], toolFamily: ['tool_family'], country: ['country'], contactReason: ['contact_reason']};
const clean = (v, n = 120) => { const s = String(v ?? '').replace(/\s+/g, ' ').trim(); return s ? s.slice(0, n) : null; };

/** Extrae del payload de un ticket de HubSpot (objects/tickets) la referencia de pedido. Sin datos personales del cliente. */
export function ticketOrderRef(payload) {
  const p = payload?.properties ?? {}, pick = k => PROPS[k].map(n => p[n]).find(v => v !== undefined && v !== null && v !== '');
  const retailer = normalizeRetailer(pick('retailer'));
  const orderKey = normalizeOrderId(pick('orderId'));
  return {
    ticketId: String(payload?.id ?? ''), orderKey, retailer: retailer ?? 'unknown',
    purchaseDate: clean(pick('purchaseDate'), 10), sku: clean(pick('sku'), 60), toolFamily: clean(pick('toolFamily'), 60),
    country: clean(pick('country'), 40), contactReason: clean(pick('contactReason'), 80),
  };
}

const keyOf = (r, k) => `${r}\u0000${k}`;
const tally = (items, hasKey, matched) => {
  const sinId = items.filter(i => !hasKey(i)).length, ligados = items.filter(i => hasKey(i) && matched(i)).length;
  return {total: items.length, ligados, sin_id: sinId, sin_ligar: items.length - sinId - ligados, cobertura: items.length ? ligados / items.length : null};
};

/**
 * orders: [{entityId, retailer, orderKey}] (pedidos del libro, un registro por línea; se deduplican por llave),
 * tickets: [{ticketId, retailer, orderKey}], shipments: [{id, retailer, orderKey}].
 * Cobertura por retailer y entidad. Un envío con retailer 'unknown' solo es «candidato» si su llave existe bajo un único retailer.
 */
export function linkCoverage({orders = [], tickets = [], shipments = []}) {
  const idx = list => { const m = new Map(); for (const x of list) if (x.orderKey && x.retailer && x.retailer !== 'unknown') m.set(keyOf(x.retailer, x.orderKey), true); return m; };
  const O = idx(orders), T = idx(tickets), S = idx(shipments);
  const byKey = new Map(); for (const x of [...orders, ...tickets]) if (x.orderKey && x.retailer !== 'unknown') { const s = byKey.get(x.orderKey) ?? new Set(); s.add(x.retailer); byKey.set(x.orderKey, s); }
  const candidate = s => s.retailer === 'unknown' && s.orderKey && byKey.get(s.orderKey)?.size === 1;
  const retailers = new Set([...orders, ...tickets, ...shipments].map(x => x.retailer || 'unknown'));
  const rows = [];
  for (const r of [...retailers].sort()) {
    const of = list => list.filter(x => (x.retailer || 'unknown') === r);
    const uniqOrders = [...new Map(of(orders).map(o => [o.orderKey ?? `__${o.entityId}`, o])).values()];
    const known = x => x.orderKey && r !== 'unknown';
    rows.push({retailer: r, entidad: 'pedidos', ...tally(uniqOrders, known, o => T.has(keyOf(r, o.orderKey)) || S.has(keyOf(r, o.orderKey))), con_ticket: uniqOrders.filter(o => known(o) && T.has(keyOf(r, o.orderKey))).length, con_envio: uniqOrders.filter(o => known(o) && S.has(keyOf(r, o.orderKey))).length});
    rows.push({retailer: r, entidad: 'tickets', ...tally(of(tickets), known, t => O.has(keyOf(r, t.orderKey)) || S.has(keyOf(r, t.orderKey)))});
    rows.push({retailer: r, entidad: 'envios', ...tally(of(shipments), known, s => O.has(keyOf(r, s.orderKey)) || T.has(keyOf(r, s.orderKey))), candidatos: of(shipments).filter(candidate).length});
  }
  return rows;
}
