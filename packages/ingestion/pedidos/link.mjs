// Unión pedidos <-> tickets <-> envíos por (order_key, retailer) y cobertura. Oráculo puro en JS de las vistas SQL.
// unknown != zero: lo que no trae ID válido es «sin_id»; lo que trae ID y no encuentra par es «sin_ligar»; la cobertura es null sin denominador.
import {normalizeOrderId, normalizeRetailer} from './order-id.mjs';
import {parseDateLoose, stripControls} from './speedship.mjs';

export const TICKET_ID_MAX = 1024; // = CHECK de ticket_order_refs.ticket_external_id (1..1024); fuera de rango se rechaza por fila
const PROPS = {orderId: ['order_id'], retailer: ['retailer'], purchaseDate: ['date_of_purchase'], sku: ['sku'], toolFamily: ['tool_family'], country: ['country'], contactReason: ['contact_reason']};
const clean = (v, n = 120) => { const s = stripControls(v).replace(/\s+/g, ' ').trim(); return s ? s.slice(0, n) : null; };

// purchaseDate: fecha UTC válida (YYYY-MM-DD) o null; acepta ISO, m/d/aaaa y epoch en ms (HubSpot datetime).
/** Extrae del payload de un ticket de HubSpot (objects/tickets) la referencia de pedido. Sin datos personales del cliente. */
export function ticketOrderRef(payload) {
  const p = payload?.properties ?? {}, pick = k => PROPS[k].map(n => p[n]).find(v => v !== undefined && v !== null && v !== '');
  const retailer = normalizeRetailer(pick('retailer'));
  const orderKey = normalizeOrderId(pick('orderId'));
  const ticketId = stripControls(payload?.id).trim();
  return {
    ticketId, rejection: ticketId === '' ? 'TICKET_ID_MISSING' : ticketId.length > TICKET_ID_MAX ? 'TICKET_ID_TOO_LONG' : null, orderKey, retailer: retailer ?? 'unknown',
    purchaseDate: parseDateLoose(pick('purchaseDate')), sku: clean(pick('sku'), 60), toolFamily: clean(pick('toolFamily'), 60),
    country: clean(pick('country'), 40), contactReason: clean(pick('contactReason'), 80),
  };
}

const keyOf = (r, k) => `${r}\u0000${k}`;
// denominador = total - sin_id: lo que no trae ID válido o retailer no puede ligarse y no entra al cociente.
// Cobertura NULL (nunca 0 %) cuando el retailer es 'unknown' o el denominador es 0.
const tally = (items, hasKey, matched, retailer) => {
  const sinId = items.filter(i => !hasKey(i)).length, ligados = items.filter(i => hasKey(i) && matched(i)).length, den = items.length - sinId;
  return {total: items.length, ligados, sin_id: sinId, sin_ligar: items.length - sinId - ligados, denominador: den, cobertura: retailer === 'unknown' || den === 0 ? null : ligados / den};
};

/**
 * orders (ventas del libro): [{entityId, retailer, orderKey}], tickets: [{ticketId, retailer, orderKey}],
 * shipments: [{id, retailer, orderKey, kind}] con kind 'garantia' (por omisión, Speedship = postventa) o 'venta'.
 * Filas por (retailer, entidad, tipo). La cobertura de la fila 'pedidos' (tipo venta) es SIEMPRE null: los envíos son de garantía,
 * así que ligar pedidos de venta no es un % de ventas. Envíos y tickets sí tienen denominador propio (su tipo).
 * Un envío con retailer 'unknown' solo es «candidato» si su llave existe bajo un único retailer.
 */
export function linkCoverage({orders = [], tickets = [], shipments = []}) {
  const sh = shipments.map(x => ({...x, kind: x.kind ?? 'garantia'}));
  const idx = list => { const m = new Map(); for (const x of list) if (x.orderKey && x.retailer && x.retailer !== 'unknown') m.set(keyOf(x.retailer, x.orderKey), true); return m; };
  const O = idx(orders), T = idx(tickets), S = idx(sh);
  const byKey = new Map(); for (const x of [...orders, ...tickets]) if (x.orderKey && x.retailer !== 'unknown') { const q = byKey.get(x.orderKey) ?? new Set(); q.add(x.retailer); byKey.set(x.orderKey, q); }
  const candidate = x => x.retailer === 'unknown' && x.orderKey && byKey.get(x.orderKey)?.size === 1;
  const retailers = new Set([...orders, ...tickets, ...sh].map(x => x.retailer || 'unknown'));
  const rows = [];
  for (const r of [...retailers].sort()) {
    const of = list => list.filter(x => (x.retailer || 'unknown') === r);
    const uniqOrders = [...new Map(of(orders).map(o => [o.orderKey ?? `__${o.entityId}`, o])).values()];
    const known = x => x.orderKey && r !== 'unknown';
    rows.push({retailer: r, entidad: 'pedidos', tipo: 'venta', ...tally(uniqOrders, known, o => T.has(keyOf(r, o.orderKey)) || S.has(keyOf(r, o.orderKey)), r), cobertura: null, con_ticket: uniqOrders.filter(o => known(o) && T.has(keyOf(r, o.orderKey))).length, con_envio: uniqOrders.filter(o => known(o) && S.has(keyOf(r, o.orderKey))).length});
    rows.push({retailer: r, entidad: 'tickets', tipo: 'ticket', ...tally(of(tickets), known, t => O.has(keyOf(r, t.orderKey)) || S.has(keyOf(r, t.orderKey)))});
    for (const kind of ['garantia', 'venta']) { const mine = of(sh).filter(x => x.kind === kind); if (mine.length) rows.push({retailer: r, entidad: 'envios', tipo: kind, ...tally(mine, known, x => O.has(keyOf(r, x.orderKey)) || T.has(keyOf(r, x.orderKey)), r), candidatos: mine.filter(candidate).length}); }
  }
  return rows;
}
