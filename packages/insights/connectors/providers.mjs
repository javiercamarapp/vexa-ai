// Esqueletos de conectores de marketplaces/soporte. SIN llamadas reales: el transporte por defecto está apagado (EXTERNAL_CALLS_DISABLED) y el secreto es solo una referencia.
// Cada conector implementa: parsePage (respuesta del proveedor -> {records, cursor, done}) y toLedger (registro -> candidatos de libro con external_id/SKU/quantity).
// Las FORMAS de respuesta están modeladas con las APIs públicas documentadas y verificadas SOLO contra fixtures sintéticos (tests/fixtures): al conectar una cuenta real hay que validarlas con una muestra autorizada.
// external_id sigue el formato del libro actual (DATOS.md §1.2): pedido canal|id|SKU; reembolso Walmart canal|id|línea|SKU; reembolso Amazon canal|clave||SKU; Mirakl canal|id|SKU; Shopify gid://.
import {defineConnector} from './contract.mjs';
import {toMinor} from './money.mjs';
import {assertSecretRef, createSecretResolver, transportApagado} from './secrets.mjs';

const EXP = 2; // USD/CAD/MXN: 2 decimales (mismo supuesto del libro actual)
const qty = v => { const n = Number(v); return Number.isInteger(n) && n >= 1 ? n : 1; };
const iso = v => (typeof v === 'number' ? new Date(v).toISOString() : v);
const mkPage = (records, cursor, done) => ({records, cursor: cursor ?? null, done: Boolean(done)});

function base({key, channel, method = 'api_poll', secretRef, secrets, transport = transportApagado, service, parsePage, toLedger, initCheck}) {
  assertSecretRef(secretRef);
  const resolver = secrets ? createSecretResolver(secrets) : null;
  const call = async (ctx, operation, params) => {
    const credential = resolver ? await resolver.resolve(secretRef) : undefined; // el valor viaja solo al transporte, nunca se guarda
    return transport.request({service, operation, params, credential, signal: ctx?.signal});
  };
  return defineConnector({
    key, channel, method, secretRef,
    async init(ctx) { if (initCheck) await initCheck(call, ctx); return {ok: true}; },
    async backfill(ctx, {from, to, cursor}) { return parsePage(await call(ctx, 'backfill', {from, to, cursor})); },
    async incremental(ctx, {cursor}) { return parsePage(await call(ctx, 'incremental', {cursor})); },
    toLedger,
  });
}

/** Amazon SP-API: Orders v0 (getOrders + getOrderItems) y Finances (RefundEventList). Cursor = NextToken / LastUpdatedAfter. */
export function createAmazonSpApiConnector(opts) {
  return base({...opts, key: opts.key ?? 'amazon', channel: 'amazon', service: 'amazon-sp-api',
    parsePage(raw) { const p = raw?.payload ?? {}; return mkPage([...(p.Orders ?? []).map(o => ({t: 'order', o})), ...((p.FinancialEvents?.RefundEventList) ?? []).map(r => ({t: 'refund', r}))], p.NextToken ?? raw?.cursor, !p.NextToken); },
    toLedger(rec) {
      if (rec.t === 'order') {
        const o = rec.o, status = ({Canceled: 'cancelled', Pending: 'pending'})[o.OrderStatus] ?? 'recorded';
        return (o.OrderItems ?? []).map(it => ({externalId: `amazon|${o.AmazonOrderId}|${it.SellerSKU}`, kind: 'order', sku: it.SellerSKU, quantity: qty(it.QuantityOrdered), currency: it.ItemPrice?.CurrencyCode ?? 'XXX',
          amountMinor: it.ItemPrice ? toMinor(it.ItemPrice.Amount, EXP) : null, effectiveAt: o.PurchaseDate, status}));
      }
      const r = rec.r;
      return (r.ShipmentItemAdjustmentList ?? []).map(it => {
        const principal = (it.ItemChargeAdjustmentList ?? []).find(c => c.ChargeType === 'Principal');
        return {externalId: `amazon|${r.AmazonOrderId}-${it.OrderAdjustmentItemId ?? it.SellerSKU}||${it.SellerSKU}`, kind: 'refund', sku: it.SellerSKU, quantity: qty(Math.abs(Number(it.QuantityShipped ?? 1))),
          currency: principal?.ChargeAmount?.CurrencyCode ?? 'XXX', amountMinor: principal ? toMinor(String(Math.abs(Number(principal.ChargeAmount.CurrencyAmount))), EXP) : null, effectiveAt: r.PostedDate, status: 'unknown'};
      });
    }});
}
/** Walmart Marketplace: GET /v3/orders (cursor nextCursor) con líneas y reembolsos por línea. Walmart: pedido = purchaseOrderId (15 díg.), reembolso lleva otro id de 18 díg. -> alias pendiente. */
export function createWalmartConnector(opts) {
  return base({...opts, key: opts.key ?? 'walmart', channel: 'walmart', service: 'walmart-marketplace',
    parsePage(raw) { const l = raw?.list ?? {}; return mkPage((l.elements?.order ?? []), l.meta?.nextCursor, !l.meta?.nextCursor); },
    toLedger(o) {
      const out = [];
      for (const ln of o.orderLines?.orderLine ?? []) {
        const sku = ln.item?.sku, prod = (ln.charges?.charge ?? []).find(c => c.chargeType === 'PRODUCT'), cancelled = (ln.orderLineStatuses?.orderLineStatus ?? []).every(s => s.status === 'Cancelled');
        out.push({externalId: `walmart|${o.purchaseOrderId}|${sku}`, kind: 'order', sku, quantity: qty(ln.orderLineQuantity?.amount), currency: prod?.chargeAmount?.currency ?? 'XXX', amountMinor: prod ? toMinor(String(prod.chargeAmount.amount), EXP) : null, effectiveAt: iso(o.orderDate), status: cancelled ? 'cancelled' : 'recorded'});
        for (const rf of ln.refund?.refundCharges?.refundCharge ?? []) {
          const amt = rf.charge?.chargeAmount;
          out.push({externalId: `walmart|${rf.refundId ?? o.purchaseOrderId}|${ln.lineNumber}|${sku}`, kind: 'refund', sku, quantity: qty(ln.orderLineQuantity?.amount), currency: amt?.currency ?? 'XXX', amountMinor: amt ? toMinor(String(Math.abs(Number(amt.amount))), EXP) : null, effectiveAt: iso(rf.refundDate ?? o.orderDate), status: 'settled'});
        }
      }
      return out;
    }});
}
/** Mirakl (Best Buy US/CA): OR11 /api/orders con paginación por offset/token y filtro last_updated_from. SKU Mirakl numérico (S#####) sin catálogo de equivalencias: se conserva tal cual. */
export function createMiraklConnector(opts) {
  const marketplace = opts.marketplace ?? 'mirakl_bestbuy_us';
  return base({...opts, key: opts.key ?? marketplace, channel: marketplace, service: 'mirakl',
    parsePage(raw) { return mkPage(raw?.orders ?? [], raw?.next_page_token, !raw?.next_page_token); },
    toLedger(o) {
      const out = [];
      for (const ln of o.order_lines ?? []) {
        const sku = String(ln.offer_sku ?? ln.product_sku ?? ''), cancelled = ['CANCELED', 'REFUSED'].includes(ln.order_line_state);
        out.push({externalId: `${marketplace}|${o.order_id}|${sku}`, kind: 'order', sku, quantity: qty(ln.quantity), currency: o.currency_iso_code ?? 'XXX', amountMinor: toMinor(String(ln.total_price ?? ''), EXP), effectiveAt: o.created_date, status: cancelled ? 'cancelled' : ln.order_line_state === 'REFUNDED' ? 'recorded' : 'recorded'});
        for (const rf of ln.refunds ?? []) out.push({externalId: `${marketplace}|${o.order_id}-${rf.id}|${sku}`, kind: 'refund', sku, quantity: qty(ln.quantity), currency: o.currency_iso_code ?? 'XXX', amountMinor: toMinor(String(rf.amount ?? ''), EXP), effectiveAt: rf.created_date ?? o.last_updated_date ?? o.created_date, status: rf.state === 'REFUNDED' ? 'settled' : 'pending'});
      }
      return out;
    }});
}
/** Shopify Admin GraphQL: orders(query: "updated_at:>…") con cursor de conexión. Sin SKU en el libro actual (0 %): aquí sí viene en lineItem.sku. */
export function createShopifyConnector(opts) {
  const nodes = c => (c?.edges ?? []).map(e => e.node);
  return base({...opts, key: opts.key ?? 'shopify', channel: 'shopify', service: 'shopify-admin',
    parsePage(raw) { const c = raw?.data?.orders; return mkPage(nodes(c), c?.pageInfo?.hasNextPage ? c.pageInfo.endCursor : null, !c?.pageInfo?.hasNextPage); },
    toLedger(o) {
      const out = [], cancelled = Boolean(o.cancelledAt);
      for (const li of nodes(o.lineItems)) {
        const m = li.originalUnitPriceSet?.shopMoney, q = qty(li.quantity);
        out.push({externalId: `${o.id}|${li.sku || 'SIN-SKU'}`, kind: 'order', sku: li.sku || 'SIN-SKU', quantity: q, currency: m?.currencyCode ?? o.currencyCode ?? 'XXX', amountMinor: m && toMinor(m.amount, EXP) !== null ? String(BigInt(toMinor(m.amount, EXP)) * BigInt(q)) : null, effectiveAt: o.createdAt, status: cancelled ? 'cancelled' : 'recorded'});
      }
      for (const rf of o.refunds ?? []) for (const rl of nodes(rf.refundLineItems)) {
        const m = rl.subtotalSet?.shopMoney;
        out.push({externalId: `${rf.id}|${rl.lineItem?.sku ?? 'SIN-SKU'}`, kind: 'refund', sku: rl.lineItem?.sku || 'SIN-SKU', quantity: qty(rl.quantity), currency: m?.currencyCode ?? 'XXX', amountMinor: m ? toMinor(m.amount, EXP) : null, effectiveAt: rf.createdAt, status: 'settled'});
      }
      return out;
    }});
}
/**
 * Zendesk: tickets por exportación incremental (cursor after_cursor). NO genera libro económico (toLedger = []): sus tickets son conversaciones. La ingesta real ya existe
 * (packages/connectors/zendesk.mjs + sync.mjs, vía el tick CRM); este esqueleto solo declara la fuente en source_sync_state con la interfaz común.
 */
export function createZendeskConnector(opts) {
  return base({...opts, key: opts.key ?? 'zendesk', channel: 'zendesk', service: 'zendesk',
    parsePage(raw) { return mkPage(raw?.tickets ?? [], raw?.end_of_stream ? raw?.after_cursor : raw?.after_cursor, Boolean(raw?.end_of_stream)); }, toLedger: () => []});
}
export const PROVIDERS = Object.freeze({amazon: createAmazonSpApiConnector, walmart: createWalmartConnector, mirakl: createMiraklConnector, shopify: createShopifyConnector, zendesk: createZendeskConnector});
