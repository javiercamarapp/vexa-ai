// Datos SINTÉTICOS coherentes con los reales (85,361 asientos): NO son datos de ningún cliente.
//   Shopify 883 · Amazon 56,012 pedidos + 3,557 reembolsos · Best Buy CA 1,684 · Best Buy US 2,384 + 111 · Walmart 17,623 + 3,107
//   760 reembolsos sin importe · 4,192 pedidos sin moneda (XXX, diferidos) · USD/CAD/MXN sin conversión.
// Determinista (PRNG con semilla): mismas filas en cada corrida.
export const BASIS = Object.freeze({line: 'marketplace_line_price', refund: 'marketplace_refund_amount', shopify: 'gross_order_including_tax_shipping'});
export const CHANNELS = Object.freeze({
  amazon: {label: 'Amazon', family: 'marketplace'},
  mirakl_bestbuy_us: {label: 'Best Buy US (Mirakl)', family: 'marketplace'},
  mirakl_bestbuy_ca: {label: 'Best Buy CA (Mirakl)', family: 'marketplace'},
  walmart: {label: 'Walmart', family: 'marketplace'},
  shopify: {label: 'Shopify', family: 'tienda'},
});
export const FIXTURE_TOTAL = 85361;
export const FIXTURE_WATERMARK = '2026-10-05T00:00:00.000Z';
export const FIXTURE_MONTHS = ['2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'];
// peso estacional por mes; octubre solo tiene 5 días de datos (corte 2026-10-05)
const WEIGHT = [1.05, 1.28, 0.9, 0.85, 0.95, 0.98, 1.02, 1.0, 1.04, 1.07, 1.1, 0.19];

function prng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
/** Reparte `total` en pesos con el método del resto mayor: la suma es EXACTA. */
export function allocate(total, weights) {
  const sum = weights.reduce((a, b) => a + b, 0), raw = weights.map(w => (total * w) / sum), base = raw.map(Math.floor);
  let left = total - base.reduce((a, b) => a + b, 0);
  raw.map((r, i) => [r - Math.floor(r), i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]).forEach(([, i]) => { if (left > 0) { base[i] += 1; left -= 1; } });
  return base;
}

// [canal, tipo, moneda, estado, total, ticket (unidades menores), faltantes de importe]
// Los «sin moneda» (XXX) llevan importe nulo siempre: la moneda desconocida no se adivina.
const POPULATIONS = [
  ['amazon', 'order', 'USD', 'recorded', 49100, 3840, 150], ['amazon', 'order', 'USD', 'cancelled', 1460, 3840, 0], ['amazon', 'order', 'USD', 'pending', 150, 3840, 0],
  ['amazon', 'order', 'CAD', 'recorded', 1402, 5190, 64], ['amazon', 'order', 'MXN', 'recorded', 600, 64000, 0], ['amazon', 'order', 'XXX', 'recorded', 3300, 0, 3300],
  ['mirakl_bestbuy_us', 'order', 'USD', 'recorded', 2300, 18200, 9], ['mirakl_bestbuy_us', 'order', 'USD', 'cancelled', 84, 18200, 0],
  ['mirakl_bestbuy_ca', 'order', 'CAD', 'recorded', 1630, 20500, 0], ['mirakl_bestbuy_ca', 'order', 'CAD', 'cancelled', 54, 20500, 0],
  ['walmart', 'order', 'USD', 'recorded', 15800, 4410, 61], ['walmart', 'order', 'USD', 'cancelled', 480, 4410, 0], ['walmart', 'order', 'USD', 'pending', 131, 4410, 0],
  ['walmart', 'order', 'CAD', 'recorded', 320, 5830, 0], ['walmart', 'order', 'XXX', 'recorded', 892, 0, 892],
  ['shopify', 'order', 'USD', 'recorded', 861, 9620, 0], ['shopify', 'order', 'USD', 'cancelled', 22, 9620, 0],
  ['amazon', 'refund', 'USD', 'settled', 3180, 3260, 400], ['amazon', 'refund', 'USD', 'pending', 190, 3260, 0], ['amazon', 'refund', 'USD', 'unknown', 67, 3260, 10],
  ['amazon', 'refund', 'CAD', 'settled', 120, 4410, 0],
  ['mirakl_bestbuy_us', 'refund', 'USD', 'settled', 111, 17300, 10],
  ['walmart', 'refund', 'USD', 'settled', 2790, 3750, 320], ['walmart', 'refund', 'USD', 'pending', 160, 3750, 20], ['walmart', 'refund', 'CAD', 'settled', 157, 4970, 0],
];
export const POPULATION_TOTAL = POPULATIONS.reduce((a, p) => a + p[4], 0);

/** Filas agregadas por mes tal como las produce la consulta acotada del repositorio (latest revision por entidad). */
export function ledgerMonthlyFixture() {
  const rows = [];
  POPULATIONS.forEach(([channel, kind, currency, status, total, ticket, missing], pi) => {
    const rnd = prng(1000 + pi * 17);
    const weights = WEIGHT.map((w, mi) => {
      let x = w * (0.94 + rnd() * 0.12);
      if (kind === 'order' && currency === 'CAD' && FIXTURE_MONTHS[mi] === '2026-09') x *= 0.7; // caída de pedidos en CAD que debe alertar
      if (channel === 'walmart' && kind === 'refund' && currency === 'USD' && FIXTURE_MONTHS[mi] === '2026-09') x *= 2.1; // reembolsos anómalos
      return x;
    });
    const perMonth = allocate(total, weights), missingPerMonth = allocate(missing, perMonth.map(n => Math.max(n, 0) + 1e-9));
    perMonth.forEach((n, mi) => {
      if (n === 0) return;
      const miss = Math.min(missingPerMonth[mi], n), known = n - miss;
      let amount = 0n;
      if (known > 0 && ticket > 0) {
        const drift = 1 + (mi - 6) * 0.004 + (rnd() - 0.5) * 0.05;
        amount = BigInt(known) * BigInt(Math.round(ticket * drift));
      }
      const basis = kind === 'refund' ? BASIS.refund : channel === 'shopify' ? BASIS.shopify : BASIS.line;
      rows.push({month: FIXTURE_MONTHS[mi], channel, kind, status, currency, exponent: 2, basis: currency === 'XXX' ? basis + '|multimoneda' : basis, n, known: currency === 'XXX' ? 0 : known, amountMinor: String(currency === 'XXX' ? 0n : amount)});
    });
  });
  return rows;
}
export const exposureFixture = ({attested = false} = {}) => attested
  ? {attestedLinks: 41, coverageComplete: false, rows: [
      {problemId: '5b0b1a9c-0000-4000-8000-000000000001', title: 'Entregas tardías en pedidos de Amazon', currency: 'USD', exponent: 2, exposedMinor: '18425000', linkedOrders: 412, knownOrders: 398},
      {problemId: '5b0b1a9c-0000-4000-8000-000000000002', title: 'Producto distinto al anunciado (Walmart)', currency: 'USD', exponent: 2, exposedMinor: '9120500', linkedOrders: 233, knownOrders: 233},
      {problemId: '5b0b1a9c-0000-4000-8000-000000000003', title: 'Cobro duplicado en Shopify', currency: 'USD', exponent: 2, exposedMinor: '1904000', linkedOrders: 19, knownOrders: 19}]}
  : {attestedLinks: 0, coverageComplete: false, rows: []};
