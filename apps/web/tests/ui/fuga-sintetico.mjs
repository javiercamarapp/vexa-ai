// Vista SINTÉTICA de «Fuga de reembolsos» (SKU DEMO-*, sin datos de clientes). Pasa por el MISMO código del servicio con una base simulada que responde por forma de sentencia.
// Sirve a la auditoría visual (fixtures-extra-F) y a las pruebas de la pantalla y de los archivos de un clic.
import {createRefundLeakRepository} from '../../../../packages/workspace-service/fuga-reembolsos.mjs';

const lcg = seed => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
const SKUS = [['DEMO-LSA-1', 'walmart', 394, 198], ['DEMO-LSB-10', 'walmart', 241, 310], ['DEMO-LSA-4', 'walmart', 348, 211], ['DEMO-LSB-5', 'walmart', 158, 396], ['DEMO-STX-1', 'amazon', 227, 228], ['DEMO-LSB-4', 'walmart', 126, 362],
  ['DEMO-LSA-6', 'walmart', 158, 251], ['DEMO-STE-14', 'amazon', 319, 90], ['DEMO-STX-2', 'amazon', 140, 185], ['DEMO-LSA-14', 'walmart', 90, 285], ['DEMO-GTX-3', 'amazon', 60, 120], ['DEMO-BLA-2', 'amazon', 56, 170], ['DEMO-GTC-4', 'amazon', 48, 133], ['DEMO-LPS-6', 'amazon', 5, 366]];
const COLA = Array.from({length: 80}, (_, i) => ['DEMO-T' + String(i + 1).padStart(2, '0'), i % 3 ? 'walmart' : 'amazon', 24 + (i % 7), 150 + (i % 5) * 10]);
const TODOS = [...SKUS, ...COLA];
const MESES_R = {walmart: ['2026-07', '2026-08', '2026-09', '2026-10'], amazon: ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10']};
const dias = m => ({first_day: m + '-03', last_day: m === '2026-10' ? '2026-10-02' : m + '-28'});
export function filasReembolsos() {
  const r = lcg(7), out = [];
  for (const [sku, ch, n, cents] of TODOS) {
    const meses = MESES_R[ch];
    let resto = n;
    meses.forEach((m, i) => {
      const k = i === meses.length - 1 ? resto : Math.max(0, Math.round((n / meses.length) * (0.6 + r() * 0.8)));
      const q = Math.min(resto, k); resto -= q;
      if (!q) return;
      const cancelados = ch === 'walmart' ? Math.round(q * 0.14) : 0, sinMonto = ch === 'amazon' ? Math.round(q * 0.23) : 0;
      const ok = q - cancelados;
      if (ok > 0) out.push({ch, sku, month: m, status: ch === 'walmart' ? 'settled' : 'unknown', currency: 'USD', exponent: 2, n: ok, sinMonto, amount: String((ok - sinMonto) * cents * 100), ...dias(m)});
      if (cancelados > 0) out.push({ch, sku, month: m, status: 'cancelled', currency: 'USD', exponent: 2, n: cancelados, sinMonto: 0, amount: String(cancelados * cents * 100), ...dias(m)});
    });
  }
  out.push({ch: 'shopify', sku: '', month: '2026-09', status: 'settled', currency: 'USD', exponent: 2, n: 13, sinMonto: 0, amount: '108000', ...dias('2026-09')});
  out.push({ch: 'amazon', sku: 'DEMO-STX-1', month: '2026-09', status: 'unknown', currency: 'CAD', exponent: 2, n: 4, sinMonto: 0, amount: '52000', ...dias('2026-09')});
  return out;
}
const LINEAS_MES = {amazon: {'2025-10': 4417, '2025-11': 7934, '2025-12': 13250, '2026-01': 11053, '2026-02': 1202, '2026-03': 1795, '2026-04': 2087, '2026-05': 1988, '2026-06': 2457, '2026-07': 2082, '2026-08': 4270, '2026-09': 3354, '2026-10': 52},
  walmart: {'2026-04': 1256, '2026-05': 1931, '2026-06': 2467, '2026-07': 3986, '2026-08': 5644, '2026-09': 2404, '2026-10': 49}};
export function filasPedidos() {
  const out = [{kind: 'total', ch: null, sku: null, month: null, n: 78000, revised: 0}];
  for (const [ch, meses] of Object.entries(LINEAS_MES)) for (const [m, n] of Object.entries(meses)) out.push({kind: 'mes', ch, sku: null, month: m, n, revised: 0});
  for (const [sku, ch, n] of SKUS) out.push({kind: 'sku', ch, sku, month: null, n: Math.round(n * (sku === 'DEMO-LSA-1' ? 0.05 : 1.2)) + 15, revised: 0});
  return out;
}
const MOTIVOS = ['Defective', 'Defective', 'Defective', 'Order', 'Warranty', 'Return', 'Shipping', 'Not as expected', 'Change mind'];
const ESTADOS = ['Refunded', 'Refunded', 'Refunded', 'Refunded', 'Older than 180 days', 'Can Not Refund', 'Rejected', 'Submitted'];
export function filasTracker() {
  const r = lcg(11), out = [];
  for (let i = 2; i < 160; i++) {
    const motivo = MOTIVOS[Math.floor(r() * MOTIVOS.length)], estado = ESTADOS[Math.floor(r() * ESTADOS.length)], sku = SKUS[Math.floor(r() * 9)][0];
    out.push({sheet: 'Refunds', fila: i, vinculada: r() < 0.2, o: {SKU: sku, Contact_reason: motivo, Subreason: r() < 0.5 ? 'Tool Replacement' : 'texto libre del cliente con datos personales', Retailer: r() < 0.6 ? 'Walmart :: fulfilled by PILOTO' : 'Amazon', Status: estado, Amount: r() < 0.9 ? (40 + Math.round(r() * 300)).toFixed(2) : '', Request_date: String(46000 + Math.floor(r() * 40))}});
  }
  for (let i = 2; i < 60; i++) out.push({sheet: i % 2 ? 'Warranty Tools' : 'Warranty Parts', fila: i, vinculada: r() < 0.5, o: {SKU: SKUS[Math.floor(r() * 5)][0], 'Contact Reason': 'Warranty', Subreason: 'Tool Replacement', Retailer: 'Walmart'}});
  return out;
}
export const VENTANAS = [
  {name: 'Marketplace Amazon · Pedidos', evidence_type: 'order_export', complete: false, window_start: '2025-10-01', window_end: '2026-10-02', watermark: '2026-10-05'},
  {name: 'Marketplace Amazon · Devoluciones', evidence_type: 'payment_ledger', complete: false, window_start: '2025-10-01', window_end: '2026-10-02', watermark: '2026-10-05'},
  {name: 'Marketplace Walmart · Pedidos', evidence_type: 'order_export', complete: false, window_start: '2026-04-05', window_end: '2026-10-02', watermark: '2026-10-05'},
  {name: 'Marketplace Walmart · Devoluciones', evidence_type: 'payment_ledger', complete: false, window_start: '2026-07-04', window_end: '2026-10-02', watermark: '2026-10-05'},
  {name: 'Shopify · Reembolsos', evidence_type: 'payment_ledger', complete: false, window_start: '2026-08-01', window_end: '2026-10-06', watermark: '2026-10-05'}];
const CONVS = [['2025-08', 4183], ['2025-09', 2672], ['2026-06', 6047], ['2026-07', 8810], ['2026-08', 2576], ['2026-09', 1318]];

/** @param {{sinTracker?:boolean,sinRepetido?:boolean,vacio?:boolean}} o */
export async function vistaSintetica(o = {}) {
  const database = {async transaction(_a, work) {
    const query = async (text, params) => {
      const t = String(text);
      if (/current_setting\('statement_timeout'\)/.test(t)) return {rows: [{v: '0'}]};
      if (/^(SAVEPOINT|RELEASE|ROLLBACK)/.test(t) || /set_config/.test(t)) return {rows: []};
      if (o.vacio) return {rows: []};
      if (/kind='refund'/.test(t) && /economic_ledger_entries/.test(t)) return {rows: filasReembolsos()};
      if (/kind='order'/.test(t)) return {rows: filasPedidos()};
      if (/economic_source_versions/.test(t)) return {rows: VENTANAS.map((w, i) => ({source_id: String(i), active: true, ...w}))};
      if (/tracker_row_revisions/.test(t)) return {rows: o.sinTracker ? [] : filasTracker()};
      if (/contact_repeat_summary/.test(t)) return {rows: o.sinRepetido ? [] : [{refreshed_at: '2026-10-22T06:00:00Z', source_watermark: '2026-10-19T04:37:31Z', contacts: 46661, contacts_ge2_90: 8067, contacts_ge3_90: 3230, linked_tickets: 72720, repeat_tickets_90: 25168, total_tickets: 103744,
        by_category: [{category: 'Subscription: Product Registration', customers: 149, repeaters: 64}, {category: 'Warranty: Part Replacement OT', customers: 88, repeaters: 24}, {category: 'Warranty: Battery Replacement', customers: 202, repeaters: 52}, {category: 'Order: Spare Parts', customers: 394, repeaters: 65}, {category: 'Other: Retailer notifications and system alerts', customers: 483, repeaters: 77}]}]};
      if (/summary_refresh_state/.test(t)) return {rows: [{refreshed_at: '2026-10-22T05:53:59Z'}]};
      if (/FROM public\.insight_state/.test(t)) return params?.[1] === 'conversation_volume' ? {rows: [{status: 'ready', refreshed_at: '2026-10-22T05:53:59Z', source_watermark: '2026-10-19T04:37:31Z', computed_from: {}, detail: {}}]} : {rows: []};
      if (/FROM public\.insight_conversation_volume/.test(t)) return {rows: CONVS.map(([month, n]) => ({period: month + '-01', n}))};
      return {rows: []};
    };
    return work({tenantId: 'syn', query});
  }};
  return createRefundLeakRepository({database, now: () => new Date('2026-10-23T12:00:00Z')}).get();
}
