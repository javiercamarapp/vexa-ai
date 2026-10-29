// Mapeo PURO de Shopify al contrato de economic_batch_import. Reproduce EXACTAMENTE las entradas que se cargaron el 6-oct
// (shopify-economic-import.json) para que su reenvío sea `replayed` (idempotente) y para que pedidos
// adicionales (p. ej. anteriores al 6-ago, si algún día se obtienen) entren con la misma identidad, base y redacción.
import {sha256hex} from './marketplace-map.mjs';

export const SHOPIFY_BASIS = 'gross_order_including_tax_shipping';
export const SHOPIFY_NORMALIZED_NAME = 'shopify-normalized-private.json';
const CONTRACT_KEYS = ['expectedRevision', 'externalId', 'kind', 'effectiveAt', 'currency', 'exponent', 'basis', 'amountMinor', 'status', 'orderId', 'reversalOf', 'details', 'report'];

const iso = z => { const t = Date.parse(z); if (!Number.isFinite(t)) return null; const d = new Date(t).toISOString(); return d; };

/** Pedido normalizado de Shopify (orders[i]) -> entrada del lote. Importes en minor units tal cual Shopify (shopMoney.minorUnits). */
export function mapShopifyOrder(order, index, normalizedSha256) {
  const money = order?.totalPriceSet?.shopMoney;
  if (!money || money.currency !== 'USD' || !/^(0|[1-9][0-9]{0,36})$/.test(String(money.minorUnits))) throw new Error('SHOPIFY_IMPORTE_NO_VALIDO ' + index);
  const effectiveAt = iso(order.createdAt);
  if (!effectiveAt) throw new Error('SHOPIFY_FECHA_INVALIDA ' + index);
  const cancelled = Boolean(order.cancelledAt);
  const cancel = cancelled ? `cancelación ${order.cancelledAt}` : 'cancelación no registrada';
  return {
    expectedRevision: 0, externalId: order.id, kind: 'order', effectiveAt, currency: 'USD', exponent: 2, basis: SHOPIFY_BASIS,
    amountMinor: String(money.minorUnits), status: cancelled ? 'cancelled' : 'recorded', orderId: null, reversalOf: null, details: {},
    report: `Shopify pedido ${order.id}; totalPriceSet.shopMoney original ${money.sourceDecimal} ${money.currency}. Estado financiero ${order.displayFinancialStatus}; ${cancel}. Importe bruto, no pérdida, margen ni cobro bancario conciliado. ${SHOPIFY_NORMALIZED_NAME} orders[${index}], SHA-256 ${normalizedSha256}.`,
    attested: true,
  };
}

/** Entrada del paquete rovaq-economic-import-v1 (con sourceId/sourceVersion) -> entrada del lote (14 claves, sin esas dos). */
export function importEntryToBatch(e) {
  const out = {};
  for (const k of CONTRACT_KEYS) { if (!(k in e)) throw new Error('PAQUETE_SIN_CLAVE ' + k); out[k] = e[k]; }
  out.attested = true;
  return out;
}

export const sameEntry = (a, b) => CONTRACT_KEYS.every(k => JSON.stringify(a[k]) === JSON.stringify(b[k]));
export { sha256hex };
