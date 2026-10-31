// Vista SINTÉTICA de «Brechas de ingreso» (SKU de marcas inventadas KORA/MILO/TERA/NOVA/RUBI/PIKA, sin datos de clientes). Genera lecturas con la MISMA forma que packages/insights/reader*.mjs
// y las pasa por armarVista, el mismo código de la pantalla real. Sirve a la auditoría visual (fixtures-extra-brechas) y a las pruebas.
import {armarVista} from '../../../../packages/workspace-service/brechas.mjs';

const SKUS = [ // [sku, [[canal, líneas base/mes, precio USD, tasa de reembolso, crecimiento mensual]]]
  ['KORA-10', [['amazon', 900, 189, 0.035, 0.01], ['walmart', 380, 189, 0.04, 0]]],
  ['KORA-12', [['amazon', 520, 249, 0.03, 0.012]]],
  ['MILO-3', [['walmart', 700, 329, 0.27, 0], ['amazon', 300, 329, 0.025, 0]]],
  ['MILO-5', [['walmart', 420, 299, 0.25, 0]]],
  ['TERA-2', [['amazon', 640, 129, 0.085, 0]]],
  ['NOVA-5', [['amazon', 260, 219, 0.022, 0.05]]],
  ['NOVA-7', [['amazon', 210, 279, 0.018, 0.07], ['walmart', 120, 279, 0.03, 0.02]]],
  ['RUBI-1', [['amazon', 760, 89, 0.05, -0.01]]],
  ['RUBI-4', [['walmart', 540, 119, 0.06, 0]]],
  ['PIKA-9', [['amazon', 180, 449, 0.045, 0.02]]],
  ['PIKA-11', [['walmart', 150, 499, 0.05, 0]]],
  ['LUMA-2', [['amazon', 330, 159, 0.03, 0.01]]],
];
const MESES_A = ['2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'];
const dia = (m, d) => m + '-' + String(d).padStart(2, '0');
const finMes = m => { const [y, mo] = m.split('-').map(Number); return new Date(Date.UTC(y, mo, 0)).getUTCDate(); };
const lcg = seed => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
const SEASON = {'2025-11': 1.2, '2025-12': 1.45, '2026-01': 1.1, '2026-02': 0.95, '2026-03': 0.9, '2026-04': 1, '2026-05': 1.15, '2026-06': 1.1, '2026-07': 1.05, '2026-08': 1.12, '2026-09': 1.12, '2026-10': 1};
const INICIO_PEDIDOS = {amazon: '2025-10', walmart: '2026-04'}, INICIO_REEMBOLSOS = {amazon: '2025-10', walmart: '2026-07'};

export function leerOrdenes() {
  const rnd = lcg(7), rows = [];
  for (const [sku, canales] of SKUS) for (const [canal, base, precio, , g] of canales) for (const [i, m] of MESES_A.entries()) {
    if (m < INICIO_PEDIDOS[canal]) continue;
    let n = Math.round(base * (SEASON[m] ?? 1) * (1 + g * i) * (0.9 + rnd() * 0.2));
    if (canal === 'amazon' && m === '2026-02') n = Math.round(n * 0.12); // hueco de exportación, como en la realidad
    if (canal === 'walmart' && m === '2026-09') n = Math.round(n * 0.4);
    if (m === '2026-10') n = Math.max(1, Math.round(n * 0.04));
    const canc = Math.round(n * 0.024);
    const desde = canal === 'walmart' && m === '2026-04' ? dia(m, 6) : dia(m, 1), hasta = m === '2026-10' ? dia(m, 1) : dia(m, finMes(m));
    rows.push({month: m, channel: canal, sku, currency: 'USD', exponent: 2, n, nCancelled: canc, nReview: 0, amountMinor: String(n * precio * 100), cancelledMinor: String(canc * precio * 100), reviewMinor: '0', firstDay: desde, lastDay: hasta});
  }
  // canales sin SKU del vendedor
  for (const [canal, base, precio, ini] of [['shopify', 220, 160, '2026-08'], ['bestbuy', 260, 380, '2026-02']]) for (const m of MESES_A) {
    if (m < ini) continue; const n = m === '2026-10' ? 10 : Math.round(base * (0.9 + rnd() * 0.2)), canc = Math.round(n * 0.03);
    rows.push({month: m, channel: canal, sku: null, currency: 'USD', exponent: 2, n, nCancelled: canc, nReview: 0, amountMinor: String(n * precio * 100), cancelledMinor: String(canc * precio * 100), reviewMinor: '0', firstDay: m === ini ? dia(m, 8) : dia(m, 1), lastDay: m === '2026-10' ? dia(m, 1) : dia(m, finMes(m))});
  }
  rows.push({month: '2026-03', channel: 'bestbuy', sku: null, currency: 'CAD', exponent: 2, n: 120, nCancelled: 3, nReview: 0, amountMinor: '4100000', cancelledMinor: '90000', reviewMinor: '0', firstDay: '2026-03-01', lastDay: '2026-03-31'});
  return rows;
}
export function leerReembolsos(ordenes) {
  const rnd = lcg(11), rows = [];
  for (const [sku, canales] of SKUS) for (const [canal, , precio, tasa] of canales) for (const m of MESES_A) {
    if (m < INICIO_REEMBOLSOS[canal]) continue;
    const o = ordenes.find(r => r.sku === sku && r.channel === canal && r.month === m); if (!o) continue;
    const n = Math.max(1, Math.round(o.n * tasa * (0.85 + rnd() * 0.3))), canc = canal === 'walmart' ? Math.round(n * 0.12) : 0, conMonto = canal === 'amazon' ? Math.round(n * 0.77) : n;
    const monto = conMonto * precio * 100, cancelado = canc * precio * 100;
    rows.push({month: m, channel: canal, sku, currency: 'USD', exponent: 2, n, nKnown: conMonto, nCancelled: canc, amountMinor: String(monto), activeMinor: String(monto - cancelado)});
  }
  return rows;
}
const TRACKER = [['reembolsado', 'warranty', 'amazon', 33, 32, 739532], ['reembolsado', 'order', 'amazon', 24, 23, 446858], ['reembolsado', 'shipping', 'amazon', 24, 20, 270168], ['reembolsado', 'return', 'amazon', 21, 19, 503850],
  ['vencido', 'defective', 'walmart', 15, 15, 351287], ['vencido', 'otro', 'walmart', 11, 11, 331306], ['vencido', 'price_match', 'walmart', 7, 7, 27445], ['vencido', 'defective', 'amazon', 6, 6, 95164],
  ['no_reembolsable', 'not_as_expected', 'amazon', 9, 9, 130473], ['no_reembolsable', 'defective', 'amazon', 8, 8, 170380], ['no_reembolsable', 'change_mind', 'amazon', 4, 4, 41684],
  ['rechazado', 'warranty', 'amazon', 2, 2, 79116], ['rechazado', 'order', 'walmart', 4, 3, 9082], ['enviado', 'order', 'amazon', 2, 2, 26958]];
export const leerTracker = () => ({availability: 'ready', meta: {refreshedAt: '2026-10-23T17:20:12Z'}, total: TRACKER.reduce((a, r) => a + r[3], 0), assumedCurrency: 'USD', byStatus: {},
  rows: TRACKER.map(([status, reason, retailer, n, nAmount, amountMinor]) => ({status, reason, retailer, n, nAmount, amountMinor: String(amountMinor)}))});

/** Conversaciones por mes y familia. Tasas distintas por familia para que "quien más se vende" no sea "quien más queja" (y a veces sí). */
const FAMILIAS_Q = {'cod:KORA': 0.045, 'cod:MILO': 0.16, 'cod:TERA': 0.07, 'cod:NOVA': 0.02, 'cod:RUBI': 0.05, 'cod:PIKA': 0.09, 'cod:LUMA': 0.03};
export function leerQuejas(ordenes) {
  const rnd = lcg(23), rows = [], meses = ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08'];
  for (const m of meses) {
    const analizadas = Math.round(2100 * (0.9 + rnd() * 0.2)); let conFam = 0;
    for (const [fam, tasa] of Object.entries(FAMILIAS_Q)) {
      const prefijo = fam.slice(4), lineas = ordenes.filter(r => r.month === m && r.sku?.startsWith(prefijo + '-')).reduce((a, r) => a + r.n, 0);
      const n = Math.max(0, Math.round((lineas * tasa) * 0.62)); if (n) { rows.push({month: m, family: fam, n}); conFam += n; }
    }
    for (const [cat, n] of [['cat:bateria', 210], ['cat:cargador', 120], ['cat:cuchilla', 150], ['cat:cortacesped', 330], ['cat:desbrozadora', 140]]) { const v = Math.round(n * (0.85 + rnd() * 0.3)); rows.push({month: m, family: cat, n: v}); conFam += v; }
    rows.push({month: m, family: '*', n: analizadas}, {month: m, family: '+', n: Math.min(analizadas, Math.round(conFam * 0.8))});
  }
  return {availability: 'ready', meta: {refreshedAt: '2026-10-23T19:00:00Z'}, rows};
}

export function entradasSinteticas({variante = ''} = {}) {
  const base = {availability: 'ready', meta: {refreshedAt: '2026-10-23T17:20:02Z', sourceWatermark: '2026-10-19T06:32:20Z'}};
  if (variante === 'vacio') return {ordenes: {...base, rows: []}, reembolsos: {...base, rows: []}, tracker: {availability: 'absent'}, quejas: {availability: 'absent'}, pares: {availability: 'absent'}, progreso: {availability: 'ready', v2: 0, objetivo: 94000, avancePct: 0, conFamilias: 0, conversacionesCargadas: 104024}};
  const ordenes = leerOrdenes(), reembolsos = leerReembolsos(ordenes);
  const pendiente = variante === 'pendiente';
  return {
    ordenes: variante === 'sinordenes' ? {availability: 'unavailable'} : {...base, rows: ordenes}, reembolsos: {...base, rows: reembolsos},
    tracker: variante === 'sintracker' ? {availability: 'unavailable'} : leerTracker(),
    quejas: pendiente ? {availability: 'absent'} : leerQuejas(ordenes),
    pares: pendiente ? {availability: 'absent'} : {availability: 'ready', pairs: [{a: 'cod:KORA', b: 'cat:bateria', n: 84}, {a: 'cod:NOVA', b: 'cat:cargador', n: 52}, {a: 'cod:MILO', b: 'cat:cuchilla', n: 41}, {a: 'cat:aceite_combustible', b: 'cat:cortacesped', n: 90}, {a: 'cod:PIKA', b: 'cat:bujia', n: 12}]},
    progreso: pendiente ? {availability: 'ready', v2: 0, objetivo: 94000, avancePct: 0, conFamilias: 0, conversacionesCargadas: 104024} : {availability: 'ready', v2: 58300, objetivo: 94000, avancePct: 62, conFamilias: 36700, conversacionesCargadas: 104024},
  };
}
export const vistaSintetica = (o = {}) => armarVista({...entradasSinteticas(o), ahora: new Date('2026-10-23T20:00:00Z')});
