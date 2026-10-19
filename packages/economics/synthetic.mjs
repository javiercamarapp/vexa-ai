// Datos 100 % SINTÉTICOS con el mismo volumen y las mismas peculiaridades que los 8 CSV reales de marketplaces
// (88,666 filas; 43 copias idénticas excedentes; 13 identidades con moneda conocida + vacía; monedas vacías; devoluciones sin return_id…).
// Ningún valor sale de datos de clientes: todos los identificadores empiezan por SYN. Determinista (semilla fija).
import {MARKETPLACE_FILES} from './marketplace-map.mjs';

const ORDER_HEADER = ['marketplace', 'order_id', 'order_date', 'order_status', 'line_status', 'sku', 'quantity', 'unit_price', 'line_price', 'item_tax', 'shipping_price', 'discount', 'commission', 'currency', 'refund_amount', 'refund_state', 'refund_date', 'refund_reason_code'];
const RETURN_HEADER = ['marketplace', 'return_id', 'order_id', 'order_line_id', 'return_date', 'last_modified', 'return_status', 'refund_status', 'delivery_status', 'return_reason_code', 'return_reason_text', 'return_method', 'resolution', 'sku', 'quantity', 'refunded_quantity', 'unit_price', 'line_total', 'total_refund_amount', 'refunded_amount', 'currency', 'refund_covered_by', 'fast_replacement', 'keep_it', 'a_to_z_claim'];

export function makeRng(seed = 20261019) { let s = seed >>> 0; const rnd = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32; return {rnd, int: n => Math.floor(rnd() * n), pick: a => a[Math.floor(rnd() * a.length)]}; }
const money = (rng, max = 30000) => { const c = 1 + rng.int(max); return (Math.floor(c / 100) + '.' + String(c % 100).padStart(2, '0')); };
const esc = v => /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
export const toCsv = (header, rows) => '﻿' + [header.join(','), ...rows.map(r => header.map(h => esc(r[h] ?? '')).join(','))].join('\r\n') + '\r\n';
const pad = (n, w = 6) => String(n).padStart(w, '0');
const iso = (rng, fmt) => { const t = Date.UTC(2025, 9, 1) + rng.int(360 * 86400000); const d = new Date(t); const s = d.toISOString(); return fmt === 'amazon' ? s.slice(0, 19) + '+00:00' : fmt === 'z' ? s.slice(0, 19) + 'Z' : s; };

function ordersFile(spec, rng) {
  const rows = [];
  const mk = spec.marketplace;
  const base = {marketplace: mk};
  const total = spec.rows;
  const plan = {
    amazon: {extras: 4, groupsOf2: 4, empty: 3796, mixed: 13, cad: 304, mxn: 13, repeatDistinct: 6, dateFmt: 'amazon', st: [['Shipped', 'Shipped'], ['Shipped', ''], ['Cancelled', ''], ['Pending', ''], ['Shipped', 'Unshipped'], ['Shipped', 'Cancelled']]},
    mirakl_bestbuy_ca: {extras: 0, cad: total, dateFmt: 'z', st: [['RECEIVED', 'RECEIVED'], ['CLOSED', 'REFUNDED'], ['CANCELED', 'CANCELED'], ['SHIPPED', 'SHIPPED']]},
    mirakl_bestbuy_us: {extras: 39, groupsOf3: 11, groupsOf2: 17, usd: true, dateFmt: 'z', repeatDistinct: 24, st: [['RECEIVED', 'RECEIVED'], ['CLOSED', 'REFUNDED'], ['CANCELED', 'CANCELED'], ['REFUSED', 'REFUSED'], ['WAITING_ACCEPTANCE', 'WAITING_ACCEPTANCE'], ['SHIPPED', 'INCIDENT_OPEN']]},
    walmart: {extras: 0, usd: true, dateFmt: 'ms', mismatch: 89, st: [['Delivered', 'Delivered'], ['Cancelled', 'Cancelled'], ['Shipped', 'Shipped'], ['Acknowledged', 'Acknowledged']]},
  }[mk];
  let n = 0;
  const line = (orderId, sku, o = {}) => {
    const qty = 1 + rng.int(3), up = money(rng, 20000), upCents = Math.round(parseFloat(up) * 100);
    const lp = (upCents * qty / 100).toFixed(2);
    const [os, ls] = rng.pick(plan.st);
    return {...base, order_id: orderId, order_date: iso(rng, plan.dateFmt), order_status: os, line_status: ls, sku, quantity: String(qty), unit_price: mk === 'amazon' ? '' : up, line_price: lp, item_tax: mk === 'walmart' ? money(rng, 2000) : mk === 'amazon' ? money(rng, 2000) : 'SYN-TAX:1.00', shipping_price: mk === 'amazon' ? '' : money(rng, 1500), discount: '', commission: mk === 'amazon' || mk === 'walmart' ? '' : money(rng, 3000), currency: o.currency ?? (plan.cad === total ? 'CAD' : 'USD'), refund_amount: '', refund_state: '', refund_date: '', refund_reason_code: ''};
  };
  const extrasWanted = plan.extras ?? 0;
  const fixed = [];
  // 13 identidades «mixtas»: una línea USD con importe y una línea con moneda e importe vacíos (solo Amazon)
  if (plan.mixed) for (let i = 0; i < plan.mixed; i++) { const id = `SYN-A-MIX-${pad(i)}`; fixed.push(line(id, `SYN-SKU-M${i}a`, {currency: 'USD'})); const e = line(id, `SYN-SKU-M${i}b`, {currency: ''}); e.line_price = ''; e.currency = ''; fixed.push(e); }
  // líneas sin moneda ni importe (3,796 en total; 13 ya están en las mixtas)
  if (plan.empty) for (let i = 0; i < plan.empty - plan.mixed; i++) { const e = line(`SYN-A-EMPTY-${pad(i)}`, 'SYN-SKU-E'); e.line_price = ''; e.currency = ''; e.order_status = rng.pick(['Cancelled', 'Pending']); e.line_status = ''; fixed.push(e); }
  // CAD / MXN en Amazon
  if (plan.cad && mk === 'amazon') for (let i = 0; i < plan.cad; i++) fixed.push(line(`SYN-A-CAD-${pad(i)}`, `SYN-SKU-C${i % 40}`, {currency: 'CAD'}));
  if (plan.mxn) for (let i = 0; i < plan.mxn; i++) fixed.push(line(`SYN-A-MXN-${pad(i)}`, `SYN-SKU-X${i}`, {currency: 'MXN'}));
  // misma (pedido, sku) con contenido distinto
  const rep = plan.repeatDistinct ?? 0;
  for (let i = 0; i < rep; i++) { const id = `SYN-${mk}-REP-${pad(i)}`; fixed.push(line(id, 'SYN-SKU-R'), line(id, 'SYN-SKU-R')); }
  // grupos de copias idénticas
  const dupGroups = [];
  const g3 = plan.groupsOf3 ?? 0, g2 = plan.groupsOf2 ?? 0;
  for (let i = 0; i < g3 + g2; i++) { const l = line(`SYN-${mk}-DUP-${pad(i)}`, i % 5 === 0 ? 'SYN,SKU "comillas"' : `SYN-SKU-D${i}`); const copies = i < g3 ? 3 : 2; for (let c = 0; c < copies; c++) dupGroups.push({...l}); }
  if (!(g3 + g2) && extrasWanted) throw new Error('plan inconsistente');
  const rest = total - fixed.length - dupGroups.length;
  if (rest < 0) throw new Error('volumen insuficiente ' + mk);
  const mism = plan.mismatch ?? 0;
  for (let i = 0; i < rest; i++) {
    const l = line(`SYN-${mk}-${pad(Math.floor(i / 2))}`, `SYN-SKU-${i % 2}-${pad(Math.floor(i / 2), 6)}`);
    if (i < mism) l.line_price = (parseFloat(l.line_price) + 0.01).toFixed(2);
    fixed.push(l);
  }
  rows.push(...fixed, ...dupGroups);
  // desordenar de forma determinista para que las copias idénticas no queden contiguas
  for (let i = rows.length - 1; i > 0; i--) { const j = rng.int(i + 1); [rows[i], rows[j]] = [rows[j], rows[i]]; }
  return toCsv(ORDER_HEADER, rows);
}

function returnsFile(spec, rng, orderTexts) {
  const rows = []; const mk = spec.marketplace;
  if (spec.rows === 0) return toCsv(RETURN_HEADER, []);
  for (let i = 0; i < spec.rows; i++) {
    const x = rng.int(2000);
    const r = {marketplace: mk, return_id: `SYN-R-${mk}-${pad(i)}`, order_id: `SYN-${mk}-${pad(x)}`, order_line_id: '', quantity: '1', sku: `SYN-SKU-${i % 2}-${pad(x, 6)}`};
    if (mk === 'amazon') {
      r.return_date = new Date(Date.UTC(2025, 10, 1) + rng.int(300 * 86400000)).toISOString().slice(0, 10);
      r.return_status = rng.pick(['Approved', 'Approved', 'Approved', 'PendingApproval', 'Closed']); r.resolution = rng.pick(['StandardRefund', 'RefundAtFirstScan', 'Replacement']);
      r.currency = i < 285 ? '' : 'USD';
      r.refunded_amount = i < 92 ? money(rng, 20000) : i < 285 ? '' : i % 4 === 3 ? '' : money(rng, 20000);
      if (i >= 3557 - 43) r.return_id = '';
    } else if (mk === 'mirakl_bestbuy_us') {
      r.return_date = new Date(Date.UTC(2026, 1, 20) + rng.int(200 * 86400000)).toISOString(); r.return_status = rng.pick(['IN_PROGRESS', 'CLOSED']); r.order_line_id = `SYN-L-${pad(i)}`; r.currency = '';
    } else {
      r.return_date = new Date(Date.UTC(2026, 6, 4) + rng.int(90 * 86400000)).toISOString(); r.return_status = rng.pick(['COMPLETED', 'COMPLETED', 'INITIATED']);
      r.refund_status = rng.pick(['REFUND_COMPLETED', 'REFUND_INITIATED', 'CANCELLED', 'NOT_REFUNDED']); r.order_line_id = `SYN-L-${pad(i)}`; r.currency = 'USD';
      const up = money(rng, 20000), upC = Math.round(parseFloat(up) * 100); r.unit_price = up; r.line_total = ((upC + (i % 11 === 0 ? 0 : 137)) / 100).toFixed(2); r.total_refund_amount = r.line_total; r.refunded_quantity = '1'; r.refund_covered_by = rng.pick(['Seller', 'Walmart']);
    }
    rows.push(r);
  }
  return toCsv(RETURN_HEADER, rows);
}

/** Devuelve Map rel -> texto CSV con el mismo número de filas por archivo que los reales. */
export function syntheticMarketplaceTexts(seed = 20261019) {
  const rng = makeRng(seed); const out = new Map();
  for (const spec of MARKETPLACE_FILES.filter(s => s.kind === 'order')) out.set(spec.rel, ordersFile(spec, rng));
  for (const spec of MARKETPLACE_FILES.filter(s => s.kind === 'refund')) out.set(spec.rel, returnsFile(spec, rng, out));
  return out;
}

/** Valores que la construcción sintética garantiza (para que las pruebas los comparen con el mapeador y con la base). */
export const SYNTHETIC_EXPECTED = Object.freeze({
  rows: 88666, orders: 81891, refunds: 6775, dupExtras: 43, dupGroups: 32, dupGroupRows: 75, multiIdentities: 13, multiRows: 26,
  unknownCurrencyRows: 3796 + 285 + 111, noReturnId: 43,
});
