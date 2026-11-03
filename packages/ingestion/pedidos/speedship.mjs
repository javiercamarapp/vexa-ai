// Importador de envíos Speedship (CSV/XLSX ya parseados a filas). Solo conserva lo necesario para ligar y medir:
// transportista, tracking, fechas, motivo, SKU y pedido. NO se guarda nombre, empresa, dirección ni zip del receptor
// (no hacen falta para la unión y son datos personales de clientes finales).
import {createHash} from 'node:crypto';
import {normalizeOrderId, orderFormat, retailerFromFormat} from './order-id.mjs';

const COLS = {
  carrier: ['carrier'], tracking: ['pro/tracking#', 'pro/tracking', 'tracking', 'tracking number'],
  shipDate: ['ship date'], createdDate: ['created date'], ref1: ['reference 1'], ref2: ['reference 2'],
};
const norm = h => String(h ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
const stripLabel = v => String(v ?? '').normalize('NFKC').trim().replace(/^reference\s*\d*\s*-\s*/i, '').trim();
const SKU = /^(?=.*[A-Z])(?=.*\d)[A-Z0-9][A-Z0-9-]{2,}$/;

export function parseDateLoose(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  const s = String(raw).trim();
  if (/^\d{5}(?:\.\d+)?$/.test(s)) { const n = Number(s); if (n > 36526 && n < 80000) return new Date(Date.UTC(1899, 11, 30) + Math.floor(n) * 864e5).toISOString().slice(0, 10); return null; }
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s); if (m) return valid(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s); if (m) return valid(+m[3], +m[1], +m[2]);
  return null;
}
function valid(y, mo, d) { const t = new Date(Date.UTC(y, mo - 1, d)); return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d ? t.toISOString().slice(0, 10) : null; }

export function normalizeCarrier(raw) {
  const k = String(raw ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!k) return null;
  if (k.startsWith('unitedparcel') || k === 'ups') return 'ups';
  if (k.startsWith('fedex')) return 'fedex';
  return k.slice(0, 40);
}

/** «Reference 1 - Defective - SKUP-L5» -> {reason:'Defective', sku:'SKUP-L5'}; un pedido en Reference 1 (filas viejas intercambiadas) se detecta aparte. */
export function parseReference1(raw) {
  const body = stripLabel(raw);
  if (!body) return {reason: null, sku: null, orderLike: null};
  const whole = normalizeOrderId(body);
  if (whole && orderFormat(whole) !== 'otro') return {reason: null, sku: null, orderLike: whole};
  const parts = body.split(/\s+-\s+/).map(p => p.trim()).filter(Boolean);
  let sku = null, reasonParts = parts;
  const lastPart = parts[parts.length - 1] ?? '', lastTok = lastPart.toUpperCase().split(/\s+/).pop() ?? '';
  if (SKU.test(lastTok)) { sku = lastTok; reasonParts = [...parts.slice(0, -1), lastPart.replace(/\s*\S+$/, '').trim()].filter(Boolean); }
  const reason = reasonParts.join(' - ').replace(/\s+/g, ' ').slice(0, 80) || null;
  return {reason, sku, orderLike: null};
}

export function parseShipments(rows) {
  const out = {shipments: [], rejections: [], duplicates: 0};
  if (!Array.isArray(rows) || rows.length < 2) return {...out, rejections: [{row: 0, code: 'EMPTY_FILE'}]};
  const header = rows[0].map(norm), idx = {};
  for (const [k, names] of Object.entries(COLS)) idx[k] = header.findIndex(h => names.includes(h));
  if (idx.tracking < 0) return {...out, rejections: [{row: 1, code: 'TRACKING_COLUMN_MISSING'}]};
  const seen = new Set();
  rows.slice(1).forEach((r, i) => {
    const get = k => (idx[k] >= 0 ? r[idx[k]] : null);
    const tracking = String(get('tracking') ?? '').replace(/\s+/g, '').toUpperCase();
    if (!tracking) { out.rejections.push({row: i + 2, code: 'TRACKING_MISSING'}); return; }
    const carrier = normalizeCarrier(get('carrier')) ?? 'desconocido';
    const dedup = `${carrier}|${tracking}`;
    if (seen.has(dedup)) { out.duplicates++; return; }
    const r1 = parseReference1(get('ref1'));
    let orderKey = normalizeOrderId(stripLabel(get('ref2'))), orderSource = orderKey ? 'reference_2' : null;
    if (!orderKey && r1.orderLike) { orderKey = r1.orderLike; orderSource = 'reference_1'; }
    const retailer = retailerFromFormat(orderKey);
    const s = {
      carrier, tracking, shipDate: parseDateLoose(get('shipDate')), createdDate: parseDateLoose(get('createdDate')),
      reason: r1.reason, sku: r1.sku, orderKey, orderFormat: orderFormat(orderKey), orderSource,
      retailer: retailer ?? 'unknown', retailerBasis: retailer ? 'format' : 'unknown',
    };
    s.rowHash = createHash('sha256').update(JSON.stringify(s)).digest('hex');
    seen.add(dedup); out.shipments.push(s);
  });
  return out;
}

export function shipmentBatches(shipments, size = 250) {
  if (!Number.isSafeInteger(size) || size < 1 || size > 250) throw new Error('INVALID_BATCH_SIZE');
  const b = []; for (let i = 0; i < shipments.length; i += size) b.push(shipments.slice(i, i + size)); return b;
}
