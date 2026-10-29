// «Puntos de dolor» (L1 y L3): servicio de lectura y evidencia contra una base SIMULADA (sin Postgres): forma, monedas separadas, desconocido ≠ 0, sin PII, presupuesto de tiempo,
// total verificable, paginación y CSV. Datos 100 % sintéticos con las cifras ancla de RESPONSABLE_A-PRODUCTO-DATOS (98 de 276 negados, 637 pendientes de Walmart, etc.).
//   node --test packages/workspace-service/tests/pain-points.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {createPainPointsRepository, PAIN_BUDGETS_MS} from '../pain-points.mjs';
import {armarPuntos, TEMAS, agregarReembolsos, agregarOrdenes} from '../pain-points-catalogo.mjs';
import {createPainEvidenceRepository, definicionDe, soloPermitidas, COLUMNAS_PERMITIDAS, codificarCursor, decodificarCursor, aCsv, verificar, armarCruce, sqlPaginaLibro, sqlTotalLibro, PAGINA, TOPE_CSV} from '../pain-points-evidencia.mjs';

const T = '00000000-0000-4000-8000-000000000001';
const ST = {tenant_id: T, status: 'ready', refreshed_at: '2026-10-23T17:20:00Z', source_watermark: '2026-10-19T06:00:00Z', computed_from: {}};
const trackerStatus = [
  ['reembolsado', 'Defectuoso', 'amazon', 107, 98, 2063190], ['vencido', 'Defectuoso', 'walmart', 38, 38, 884940], ['vencido', 'Defectuoso', 'amazon', 8, 7, 114113],
  ['no_reembolsable', 'Pedido', 'amazon', 28, 27, 398013], ['no_reembolsable', 'Pedido', 'bestbuy', 1, 1, 55888], ['no_reembolsable', 'Pedido', 'tienda', 1, 1, 26999], ['no_reembolsable', 'Pedido', 'walmart', 3, 2, 45117],
  ['rechazado', 'Garantía', 'amazon', 5, 4, 127963], ['rechazado', 'Garantía', 'bestbuy', 1, 1, 49210], ['rechazado', 'Garantía', 'tienda', 2, 2, 37800], ['rechazado', 'Garantía', 'walmart', 11, 8, 105369],
].map(([status_class, reason_class, retailer_class, n, n_amount, amount]) => ({status_class, reason_class, retailer_class, n, n_amount, amount, assumed_currency: 'USD'}));
const refundSku = [
  {month: '2026-08-01', channel: 'walmart', sku_base: 'SKUS-M10', currency: 'USD', exponent: 2, n: 100, n_known: 100, n_cancelled: 20, amount: 4000000, active: 3000000},
  {month: '2026-09-01', channel: 'walmart', sku_base: 'SKUS-M10', currency: 'USD', exponent: 2, n: 50, n_known: 50, n_cancelled: 10, amount: 1500000, active: 1200000},
  {month: '2026-09-01', channel: 'amazon', sku_base: 'SKUP-L1', currency: 'USD', exponent: 2, n: 80, n_known: 60, n_cancelled: 0, amount: 2000000, active: 2000000},
  {month: '2026-09-01', channel: 'amazon', sku_base: 'SKUP-L1', currency: 'CAD', exponent: 2, n: 3, n_known: 3, n_cancelled: 0, amount: 90000, active: 90000},
  {month: '2026-10-01', channel: 'shopify', sku_base: '', currency: 'USD', exponent: 2, n: 4, n_known: 4, n_cancelled: 0, amount: 12000, active: 12000},
];
const orders = [
  {month: '2026-09-01', channel: 'amazon', sku_base: 'SKUP-L1', currency: 'USD', exponent: 2, n: 500, n_cancelled: 10, n_review: 0, amount: 50000000, cancelled: 700000},
  {month: '2026-09-01', channel: 'walmart', sku_base: 'SKUS-M10', currency: 'USD', exponent: 2, n: 300, n_cancelled: 5, n_review: 0, amount: 30000000, cancelled: 300000},
  {month: '2026-09-01', channel: 'amazon', sku_base: 'SKUP-L1', currency: 'CAD', exponent: 2, n: 20, n_cancelled: 2, n_review: 0, amount: 900000, cancelled: 100000},
  {month: '2026-05-01', channel: 'amazon', sku_base: 'SKUP-L1', currency: 'MXN', exponent: 2, n: 13, n_cancelled: 13, n_review: 0, amount: 355237, cancelled: 355237},
];
const threads = [{grain: 'all', period: '0001-01-01', threads: 3000, closed: 2500, reopened_threads: 150, close_p50_hours: 44.8, close_p90_hours: 1001, closed_lt_1h: 100, closed_gt_7d: 710, status_events: 9000},
  {grain: 'month', period: '2026-07-01', threads: 1000, closed: 900, reopened_threads: 50, close_p50_hours: 40, close_p90_hours: 900, closed_lt_1h: 30, closed_gt_7d: 300, status_events: 3000}];
const walmartMensual = [
  {fuente: 'Marketplace Walmart · Devoluciones (export recibido 2026-10-05)', status: 'pending', currency: 'USD', exponent: 2, n: 637, known: 637, amount: '13756830', desde: '2026-07', hasta: '2026-09', refreshed: '2026-10-23T17:00:00Z', watermark: '2026-10-19T06:00:00Z'},
  {fuente: 'Marketplace Walmart · Devoluciones (export recibido 2026-10-05)', status: 'cancelled', currency: 'USD', exponent: 2, n: 620, known: 620, amount: '11500593', desde: '2026-07', hasta: '2026-09', refreshed: '2026-10-23T17:00:00Z', watermark: null},
  {fuente: 'Shopify PILOTO · Transacciones de reembolso', status: 'pending', currency: 'USD', exponent: 2, n: 1, known: 1, amount: '27900', desde: '2026-10', hasta: '2026-10', refreshed: '2026-10-23T17:00:00Z', watermark: null},
];

/** Base simulada: responde por patrón de SQL. `fallan` = tablas cuyo SELECT agota el tiempo (57014). `registro` guarda lo ejecutado. */
function dbSimulada({fallan = [], extra = {}, registro = []} = {}) {
  const s = {tenantId: T, async query(text, p = []) {
    registro.push({text, p});
    if (/^\s*(SAVEPOINT|RELEASE|ROLLBACK)/i.test(text)) return {rows: []};
    if (/current_setting\('statement_timeout'\)/.test(text)) return {rows: [{v: '0'}]};
    if (/set_config\(/.test(text)) return {rows: []};
    for (const t of fallan) if (text.includes(t)) throw Object.assign(new Error('timeout'), {code: '57014'});
    for (const [patron, rows] of Object.entries(extra)) if (text.includes(patron)) return {rows: typeof rows === 'function' ? rows(text, p) : rows};
    if (/FROM public\.insight_state/.test(text)) return {rows: [ST]};
    if (/FROM public\.insight_tracker_refund_status/.test(text)) return {rows: trackerStatus};
    if (/FROM public\.economic_ledger_monthly/.test(text)) return {rows: walmartMensual};
    if (/FROM public\.insight_refund_by_sku_month/.test(text)) return {rows: refundSku.map(r => ({...r, amount: String(r.amount), active: String(r.active)}))};
    if (/FROM public\.insight_order_revenue_month/.test(text)) return {rows: orders.map(r => ({...r, amount: String(r.amount), cancelled: String(r.cancelled), review: '0'}))};
    if (/FROM public\.insight_thread_resolution/.test(text)) return {rows: threads};
    if (/FROM public\.contact_repeat_summary/.test(text)) return {rows: [{refreshed_at: '2026-10-23T17:00:00Z', source_watermark: '2026-10-19T04:00:00Z', contacts: 100, contacts_ge2_90: 17, linked_tickets: 70, total_tickets: 100}]};
    if (/FROM public\.tracker_row_revisions/.test(text) && /count\(DISTINCT row_number\)/.test(text)) return {rows: [{hoja: 'Warranty Tools', n: 2000}, {hoja: 'Warranty Parts', n: 1700}]};
    return {rows: []};
  }};
  return {transaction: async (_m, fn) => fn(s)};
}
const get = (o) => createPainPointsRepository({database: dbSimulada(o), now: () => new Date('2026-10-24T12:00:00Z')}).get();
const por = (v, id) => v.puntos.find(p => p.id === id);

test('forma: cada punto trae id, tema, nombre, dinero, volumen, clase O/E/I, cobertura, fuente y periodo; los temas son los 6 fijos', async () => {
  const v = await get();
  assert.deepEqual(v.temas.map(t => t.id), ['devoluciones', 'garantia', 'logistica', 'canales', 'ubicaciones', 'sku']);
  assert.equal(v.tipoDinero, 'bruto'); assert.equal(v.currency, 'USD');
  const temas = new Set(TEMAS.map(t => t.id));
  for (const p of v.puntos) {
    assert.match(p.id, /^P\d{1,2}(~[A-Za-z0-9._-]+)?$/); assert.ok(temas.has(p.tema), p.id); assert.ok(p.nombre, p.id); assert.ok(['O', 'E', 'I'].includes(p.clase), p.id);
    assert.equal(typeof p.dinero.sinDato, 'boolean'); assert.equal(typeof p.volumen.sinDato, 'boolean');
    if (!p.dinero.sinDato) { assert.equal(typeof p.dinero.minor, 'string'); assert.match(p.dinero.minor, /^\d+$/); assert.equal(p.dinero.currency, 'USD'); assert.equal(p.dinero.tipo, 'bruto'); } else { assert.ok(['sin_fuente', 'no_disponible', 'no_aplica'].includes(p.dinero.causa)); assert.ok(p.dinero.motivo); }
    assert.ok(p.fuente.etiqueta, p.id); assert.ok('periodo' in p && 'cobertura' in p && 'evidencia' in p && Array.isArray(p.calculo) && Array.isArray(p.noSabemos), p.id);
  }
  assert.equal(new Set(v.puntos.map(p => p.id)).size, v.puntos.length, 'ids únicos');
});
test('cifras ancla: 98 negados con US$18,454.12 (supuesto USD), 637 pendientes de Walmart US$137,568.30, dinero devuelto sin cancelados y pedidos cancelados en USD', async () => {
  const v = await get();
  const p1 = por(v, 'P1'); assert.equal(p1.dinero.minor, '1845412'); assert.equal(p1.dinero.supuesta, true); assert.equal(p1.volumen.n, 98);
  const p2 = por(v, 'P2'); assert.equal(p2.dinero.minor, '13756830'); assert.equal(p2.volumen.n, 637, 'solo Walmart: el pendiente de Shopify no entra');
  assert.deepEqual(p2.periodo, {desde: '2026-07', hasta: '2026-09'});
  const p4 = por(v, 'P4'); assert.equal(p4.agregado, true); assert.equal(p4.dinero.minor, String(3000000 + 1200000 + 2000000 + 12000)); assert.equal(p4.dinero.conCancelados, String(4000000 + 1500000 + 2000000 + 12000));
  const m10 = por(v, 'P4~SKUS-M10'); assert.equal(m10.dinero.minor, '4200000'); assert.equal(m10.volumen.n, 120); assert.equal(m10.detalle.ingresoMinor, String(30000000 - 300000)); assert.equal(m10.detalle.retenidoMinor, String(30000000 - 300000 - 4200000));
  const p5 = por(v, 'P5'); assert.equal(p5.dinero.minor, String(700000 + 300000)); assert.equal(p5.volumen.n, 15);
});
test('monedas separadas: CAD y MXN nunca se suman al USD (van en otrasMonedas)', async () => {
  const v = await get();
  assert.deepEqual(por(v, 'P5').otrasMonedas.map(m => [m.currency, m.minor, m.n]).sort(), [['CAD', '100000', 2], ['MXN', '355237', 13]]);
  assert.deepEqual(por(v, 'P4').otrasMonedas.map(m => [m.currency, m.minor]), [['CAD', '90000']]);
  assert.equal(por(v, 'P5').dinero.minor, '1000000', 'solo USD');
  const r = agregarReembolsos(refundSku.map(x => ({month: x.month, channel: x.channel, sku: x.sku_base, currency: x.currency, exponent: x.exponent, n: x.n, nKnown: x.n_known, nCancelled: x.n_cancelled, amountMinor: String(x.amount), activeMinor: String(x.active)})));
  assert.equal(r.tot.active, 6212000n); assert.equal(r.otras.length, 1);
  const o = agregarOrdenes(orders.map(x => ({month: x.month, channel: x.channel, sku: x.sku_base, currency: x.currency, exponent: x.exponent, n: x.n, nCancelled: x.n_cancelled, amountMinor: String(x.amount), cancelledMinor: String(x.cancelled)})));
  assert.equal(o.tot.cancelledMinor, 1000000n);
});
test('desconocido ≠ 0: chargebacks, Best Buy, ubicaciones, SLA y contacto repetido salen como sinDato explícito (jamás 0)', async () => {
  const v = await get();
  for (const id of ['P3', 'P9', 'P12', 'P10~bestbuy', 'P6', 'P7', 'P8']) { const p = por(v, id); assert.equal(p.dinero.sinDato, true, id); assert.ok(!('minor' in p.dinero), id + ' no inventa un monto'); }
  assert.equal(por(v, 'P3').dinero.causa, 'sin_fuente'); assert.equal(por(v, 'P3').volumen.sinDato, true);
  assert.match(por(v, 'P10~bestbuy').dinero.motivo, /no es cero/i);
  assert.equal(por(v, 'P7').volumen.n, 710); assert.equal(por(v, 'P8').volumen.n, 17); assert.equal(por(v, 'P6').volumen.n, 3700);
  assert.equal(por(v, 'P7').dinero.causa, 'no_aplica');
});
test('chargebacks: P3 sin dato; P1 y P2 son PROXY rotulado y ningún texto llama chargeback a un proxy', async () => {
  const v = await get();
  assert.deepEqual(por(v, 'P3').proxies, ['P1', 'P2']);
  for (const id of ['P1', 'P2']) { const p = por(v, id); assert.equal(p.proxy.de, 'P3'); assert.match(p.proxy.rotulo, /NO es un chargeback/); assert.doesNotMatch(p.nombre + p.descripcion, /chargeback/i, id + ' no se nombra chargeback'); }
});
test('una parte que agota el tiempo queda «no disponible ahora» (no 0) y las demás partes siguen', async () => {
  const v = await get({fallan: ['FROM public.insight_tracker_refund_status']});
  assert.equal(v.partes.tracker, 'unavailable'); assert.equal(v.partes.reembolsos, 'ok');
  const p1 = por(v, 'P1'); assert.equal(p1.dinero.sinDato, true); assert.equal(p1.dinero.causa, 'no_disponible'); assert.equal(p1.volumen.causa, 'no_disponible');
  assert.equal(por(v, 'P2').dinero.minor, '13756830');
  assert.ok(JSON.stringify(v).includes('"unavailable"'), 'la lectura degradada se marca para que la memoria no la guarde');
  const bueno = await get(); assert.ok(!JSON.stringify(bueno).includes('"unavailable"'), 'una lectura completa no contiene la marca');
});
test('todo caído: ningún punto inventa dinero y todos dicen no disponible', async () => {
  const v = await get({fallan: ['FROM public.insight_state', 'FROM public.economic_ledger_monthly', 'FROM public.contact_repeat_summary', 'count(DISTINCT row_number)']});
  assert.ok(Object.values(v.partes).every(x => x === 'unavailable'));
  for (const p of v.puntos) if (['P1', 'P2', 'P4', 'P5'].includes(p.id)) assert.equal(p.dinero.sinDato, true, p.id);
  assert.ok(!v.puntos.some(p => !p.dinero.sinDato && p.dinero.minor === '0'), 'jamás un cero por un fallo');
});
test('presupuesto: cada parte corre en su SAVEPOINT con el tope de tiempo restante (≤ su presupuesto) y se restaura', async () => {
  const registro = [];
  await get({registro});
  const topes = registro.filter(r => /set_config\('statement_timeout',\$1,true\)/.test(r.text)).map(r => r.p[0]).filter(x => /ms$/.test(String(x)) && x !== '0ms').map(x => Number(String(x).replace('ms', '')));
  assert.ok(topes.length >= 7, 'una por parte'); assert.ok(topes.every(ms => ms <= Math.max(...Object.values(PAIN_BUDGETS_MS)) && ms > 0));
  assert.ok(Object.values(PAIN_BUDGETS_MS).every(ms => ms <= 3000), 'cada consulta nueva < 3 s');
  assert.equal(registro.filter(r => /^SAVEPOINT pp_/.test(r.text)).length, 7);
  assert.ok(registro.every(r => !/^\s*(INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)/i.test(r.text)), 'solo lectura');
  assert.ok(registro.filter(r => /FROM public\./.test(r.text) && !/pg_|information_schema/.test(r.text)).every(r => !/economic_ledger_entries/.test(r.text)), 'la lectura general no agrega en vivo contra el libro de 85 mil filas');
});
test('sin PII: ni claves ni valores de datos personales, y el SQL solo toca agregados', async () => {
  const registro = [];
  const v = await get({registro, extra: {'FROM public.contact_repeat_summary': [{refreshed_at: '2026-10-23T17:00:00Z', source_watermark: null, contacts: 10, contacts_ge2_90: 2, linked_tickets: 5, total_tickets: 10, customer_email: 'ana@example.com', phone: '+52 55 1234 5678'}]}});
  const j = JSON.stringify(v);
  assert.doesNotMatch(j, /@[a-z0-9-]+\.[a-z]{2,}/i); assert.doesNotMatch(j, /\b\d{2}[ -]\d{4}[ -]\d{4}\b/);
  assert.ok(!/customer|email|phone|address|nombre_cliente|order_id/i.test(Object.keys(JSON.parse(j)).join()));
  const claves = []; (function rec(o) { if (o && typeof o === 'object') for (const [k, x] of Object.entries(o)) { claves.push(k); rec(x); } })(v);
  assert.ok(!claves.some(k => /customer|email|phone|address|tracking|serial|order_?id/i.test(k)), 'sin claves personales: ' + claves.filter(k => /customer|email|phone/i.test(k)));
  assert.ok(registro.every(r => !/\b(c->>'v'|messages|customer_email)\b/.test(r.text) || /tracker_row_revisions/.test(r.text)));
});
test('armarPuntos es puro: mismas entradas → mismas salidas (determinista) y tolera todas las partes nulas', () => {
  const a = armarPuntos({tracker: null, walmart: null, reembolsos: null, ordenes: null, hilos: null, repetido: null, garantia: null});
  assert.deepEqual(a, armarPuntos({tracker: null, walmart: null, reembolsos: null, ordenes: null, hilos: null, repetido: null, garantia: null}));
  assert.ok(a.every(p => p.dinero.sinDato), 'sin ninguna lectura no hay ni un monto');
  assert.ok(a.filter(p => p.id.startsWith('P4~')).length === 0);
});

// ------------------------------------------------------------------ evidencia
const filaLibroDb = (i, extra = {}) => ({eff: `2026-09-${String(28 - (i % 28)).padStart(2, '0')}T12:00:00.${String(100000 + i).slice(-6)}Z`, entity: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`, fecha: `2026-09-${String(28 - (i % 28)).padStart(2, '0')}`,
  canal: 'walmart', sku: 'SKUS-H5', status: 'pending', moneda: 'USD', importe: String(10000 + i), a_revisar: false, ref: 'ab12cd34', ...extra});
const libroN = 120, libroTotal = Array.from({length: libroN}, (_, i) => 10000 + i).reduce((a, b) => a + b, 0);
function dbEvidencia({pii = true, totalMinor = libroTotal, registro = []} = {}) {
  return dbSimulada({registro, extra: {
    'FROM public.economic_ledger_entries e WHERE': (text, p) => {
      if (/count\(\*\)::int AS n/.test(text)) return [{n: libroN, conmonto: libroN, total: String(totalMinor)}];
      const lim = Number(/LIMIT (\d+)/.exec(text)[1]);
      const cursorado = /\(e\.effective_at, e\.entity_id\) </.test(text);
      const desde = cursorado ? 50 : 0;
      return Array.from({length: Math.min(lim, libroN - desde)}, (_, k) => filaLibroDb(desde + k, pii ? {customer_name: 'Ana Pérez', email: 'ana@example.com', address: 'Calle 1 #2', order_id: '111-2223334-5556667', external_id: 'walmart|9999999999|SKUS-H5', tracking: '1Z999AA10123456784'} : {}));
    },
    'FROM public.insight_refund_by_sku_month': [{month: '2026-09', channel: 'walmart', sku: 'SKUS-H5', n: 44, nCancelled: 4, activeMinor: '1668324'}],
  }});
}
const trackerFilas = [
  // fila, estado (Status), sku, retailer, monto, fecha serie Excel 46300 = 2026-09-?? (se usa ISO para no depender de Excel)
  ['Refunds', 10, {SKU: 'SKUS-H5', Status: 'Rejected', Retailer: 'Walmart', Amount: '$169.00', Request_date: '2026-09-24', Contact_reason: 'Warranty', Subreason: 'Texto libre con nombre Ana Pérez', Customer_name: 'Ana Pérez', Phone: '+52 55 1234 5678', Order_ID: '111-2223334-5556667'}],
  ['Refunds', 11, {SKU: 'SKUS-H5', Status: 'Older than 180 days', Retailer: 'Walmart', Amount: '352.26', Request_date: '2026-09-22'}],
  ['Refunds', 12, {SKU: 'SKUS-H5', Status: 'Refunded', Retailer: 'Amazon', Amount: '10.00', Request_date: '2026-09-20'}],
  ['Refunds', 13, {SKU: 'STMG-L', Status: 'Can not refund', Retailer: 'Amazon', Request_date: '2026-09-18'}],
].map(([sheet, fila, o]) => ({sheet, fila, o}));
const cuerpoP1 = [{status_class: 'rechazado', reason_class: 'x', retailer_class: 'walmart', n: 1, n_amount: 1, amount: 16900, assumed_currency: 'USD'}, {status_class: 'vencido', reason_class: 'x', retailer_class: 'walmart', n: 1, n_amount: 1, amount: 35226, assumed_currency: 'USD'}, {status_class: 'no_reembolsable', reason_class: 'x', retailer_class: 'amazon', n: 1, n_amount: 0, amount: 0, assumed_currency: 'USD'}];
const dbTracker = (o = {}) => dbSimulada({...o, extra: {'FROM public.insight_tracker_refund_status': cuerpoP1.map(r => ({...r, amount: String(r.amount)})), 'FROM public.tracker_row_revisions r, jsonb_array_elements': () => trackerFilas, 'FROM public.insight_refund_by_sku_month': [{month: '2026-09', channel: 'walmart', sku: 'SKUS-H5', n: 44, nCancelled: 4, activeMinor: '1668324'}], ...(o.extra ?? {})}});
// P1 usa la lectura general como cifra: se le da una vista fija para aislar la evidencia
const vistaFija = (cifras) => async () => ({puntos: armarPuntos({tracker: {data: {total: 4, byStatus: {rechazado: {n: 1, nAmount: 1, amountMinor: '16900'}, vencido: {n: 1, nAmount: 1, amountMinor: '35226'}, no_reembolsable: {n: 1, nAmount: 0, amountMinor: '0'}}}, meta: {}},
  walmart: {n: libroN, known: libroN, minor: String(cifras.libro ?? libroTotal), desde: '2026-07', hasta: '2026-09', refreshedAt: null, watermark: null}, reembolsos: {rows: [], meta: {}}, ordenes: {rows: [], meta: {}}, hilos: null, repetido: null, garantia: null})});

test('evidencia del libro (P2): 50 filas por página, cursor con microsegundos, total del filtro y verificación ✓ contra la cifra del punto', async () => {
  const registro = [];
  const repo = createPainEvidenceRepository({database: dbEvidencia({registro}), resumen: vistaFija({})});
  const p1 = await repo.get({id: 'P2'});
  assert.equal(p1.estado, 'ok'); assert.equal(p1.filas.length, PAGINA); assert.ok(p1.nextCursor);
  assert.equal(p1.total.n, libroN); assert.equal(p1.total.minor, String(libroTotal)); assert.equal(p1.verificacion.marca, '✓'); assert.equal(p1.verificacion.coincide, true);
  const c = decodificarCursor('P2', p1.nextCursor); assert.match(c.t, /\.\d{6}Z$/, 'microsegundos: sin perder filas con el mismo milisegundo');
  const sql = registro.map(r => r.text).find(r => /LIMIT 51/.test(r)); assert.match(sql, /ORDER BY e\.effective_at DESC, e\.entity_id DESC/);
  const p2 = await repo.get({id: 'P2', cursor: p1.nextCursor});
  assert.equal(p2.filas.length, 50); assert.equal(p2.total, null, 'el total solo se calcula en la primera página'); assert.equal(p2.cruce.length, 0);
  assert.ok(registro.some(r => /\(e\.effective_at, e\.entity_id\) < \(\$\d+::timestamptz, \$\d+::uuid\)/.test(r.text) && r.p.includes(c.t) && r.p.includes(c.e)), 'el cursor viaja como parámetro, no pegado al SQL');
});
test('verificación ✗ cuando la suma de las filas no iguala la cifra (muestra la diferencia) y — cuando no se pudo comprobar', async () => {
  const mal = createPainEvidenceRepository({database: dbEvidencia({totalMinor: libroTotal + 500}), resumen: vistaFija({})});
  const r = await mal.get({id: 'P2'});
  assert.equal(r.verificacion.marca, '✗'); assert.equal(r.verificacion.coincide, false); assert.equal(r.verificacion.diferenciaMinor, '500');
  const sinTotal = await createPainEvidenceRepository({database: dbSimulada({fallan: ['count(*)::int AS n'], extra: {'FROM public.economic_ledger_entries e WHERE': (t) => Array.from({length: 3}, (_, i) => filaLibroDb(i))}}), resumen: vistaFija({})}).get({id: 'P2'});
  assert.equal(sinTotal.total, null); assert.equal(sinTotal.verificacion.marca, '—', 'sin total no se afirma ✓');
  assert.deepEqual(verificar(null, '5'), {cifraMinor: null, sumaMinor: '5', coincide: null, marca: '—', diferenciaMinor: null});
});
test('sin PII: la lista blanca descarta nombre, correo, dirección, número de orden, tracking y external_id aunque la consulta los trajera', async () => {
  const repo = createPainEvidenceRepository({database: dbEvidencia({pii: true}), resumen: vistaFija({})});
  const r = await repo.get({id: 'P2'});
  for (const f of r.filas) assert.deepEqual(Object.keys(f).sort(), [...COLUMNAS_PERMITIDAS].sort());
  const j = JSON.stringify(r);
  assert.doesNotMatch(j, /Ana P|example\.com|Calle 1|111-2223334|9999999999|1Z999AA/);
  assert.deepEqual(Object.keys(soloPermitidas({customer_name: 'X', fecha: '2026-01-01', email: 'a@b.co'})).sort(), [...COLUMNAS_PERMITIDAS].sort());
  assert.equal(soloPermitidas({customer_name: 'X'}).fecha, null);
  const csv = (await repo.csv({id: 'P2'})).contenido;
  assert.doesNotMatch(csv, /Ana P|example\.com|Calle 1|111-2223334|9999999999|1Z999AA/);
});
test('evidencia del Tracker (P1): solo negados, catálogo cerrado (texto libre → «Otro»), total = cifra ✓, y cruce con el libro por SKU y mes rotulado', async () => {
  const repo = createPainEvidenceRepository({database: dbTracker(), resumen: vistaFija({})});
  const r = await repo.get({id: 'P1'});
  assert.equal(r.estado, 'ok'); assert.equal(r.filas.length, 3, 'rechazado, vencido y no reembolsable; el reembolsado no es evidencia');
  assert.equal(r.total.n, 3); assert.equal(r.total.conMonto, 2); assert.equal(r.total.sinMonto, 1); assert.equal(r.total.minor, '52126'); assert.equal(r.total.supuesta, true);
  assert.equal(r.verificacion.marca, '✓'); assert.equal(r.verificacion.sumaMinor, '52126');
  assert.deepEqual(r.filas.map(f => f.ref), ['Fila 10', 'Fila 11', 'Fila 13'], 'orden por fecha descendente'); assert.equal(r.filas[0].fecha, '2026-09-24');
  assert.equal(r.filas[0].motivo, 'Garantía · Otro (texto libre omitido)', 'el texto libre del Tracker jamás sale');
  assert.doesNotMatch(JSON.stringify(r), /Ana P|\+52 55|111-2223334/);
  assert.ok(r.cruce.length > 0 && r.cruce.every(c => c.sku && c.mes && 'libro' in c && 'tracker' in c));
  assert.ok(r.cruce.some(c => c.sku === 'SKUS-H5' && c.mes === '2026-09' && c.libro.n === 40 && c.tracker.negados === 2), 'unión por SKU y mes');
  assert.match(r.nota, /USD/);
});
test('CSV: mismas columnas, BOM, comillas, a prueba de fórmulas y con tope; el nombre lleva el id y la fecha', async () => {
  const repo = createPainEvidenceRepository({database: dbEvidencia(), resumen: vistaFija({}), now: () => new Date('2026-10-24T12:00:00Z')});
  const out = await repo.csv({id: 'P2'});
  assert.equal(out.nombre, 'puntos-de-dolor-P2-2026-10-24.csv'); assert.equal(out.filas, 120); assert.equal(out.truncado, false); assert.equal(out.verificacion.marca, '✓');
  const lineas = out.contenido.replace(/^﻿/, '').trim().split('\r\n');
  assert.equal(lineas[0], 'Fecha,Canal,SKU,Estado,Motivo,Moneda,Importe (unidades menores),Referencia,Origen,Clase,Fuente,Corte'); assert.equal(lineas.length, 121);
  const csv = aCsv([soloPermitidas({fecha: '2026-01-01', sku: '=HYPERLINK("x")', motivo: 'a,"b"', importeMinor: '-500'}), soloPermitidas({sku: '+1', motivo: '@x'})]);
  assert.match(csv, /"'=HYPERLINK\(""x""\)"/); assert.match(csv, /"a,""b"""/); assert.match(csv, /,-500,/); assert.match(csv, /,'\+1,/); assert.match(csv, /,'@x,/);
  assert.equal(TOPE_CSV, 5000);
});
test('puntos sin filas o sin dato responden con su motivo (no con una tabla vacía): chargebacks, SLA, contacto repetido, ubicaciones', async () => {
  const repo = createPainEvidenceRepository({database: dbTracker(), now: () => new Date('2026-10-24T12:00:00Z')});
  for (const id of ['P3', 'P7', 'P8', 'P9', 'P12', 'P6']) { const r = await repo.get({id}); assert.ok(['sin_dato', 'sin_filas'].includes(r.estado), id + ' ' + r.estado); assert.ok(r.motivo, id); assert.deepEqual(r.filas, []); assert.equal(r.total, null); }
  assert.equal((await repo.get({id: 'P3'})).estado, 'sin_dato');
  await assert.rejects(repo.get({id: 'P99'}), e => e.code === 'pain_point_not_found' && e.status === 404);
  for (const mal of ['', 'DROP TABLE', "P1'; --", 'P1~' + 'x'.repeat(80), '../P1']) await assert.rejects(repo.get({id: mal}), e => e.code === 'pain_point_invalid' && e.status === 400, mal);
});
test('cursor: ligado a su punto, validado y sin SQL; un cursor ajeno o manipulado se rechaza', () => {
  const ok = codificarCursor('P2', {t: '2026-09-19T12:00:00.123456Z', e: '00000000-0000-4000-8000-000000000001'});
  assert.deepEqual(decodificarCursor('P2', ok), {t: '2026-09-19T12:00:00.123456Z', e: '00000000-0000-4000-8000-000000000001'});
  assert.throws(() => decodificarCursor('P4', ok), e => e.code === 'cursor_scope_conflict');
  assert.throws(() => decodificarCursor('P2', 'no-es-base64-json!!'), e => e.code === 'cursor_invalid');
  assert.throws(() => decodificarCursor('P2', codificarCursor('P2', {t: "2026'; DROP TABLE x;--", e: 'x'})), e => e.code === 'cursor_invalid');
  assert.throws(() => decodificarCursor('P2', codificarCursor('P2', {i: -1})), e => e.code === 'cursor_invalid');
  assert.deepEqual(decodificarCursor('P1', codificarCursor('P1', {i: 50})), {i: 50}); assert.equal(decodificarCursor('P2', null), null); assert.equal(decodificarCursor('P2', ''), null);
});
test('SQL del libro: parámetros (nada interpolado), solo la última revisión de cada asiento, USD, sin cancelados donde corresponde y SKU/canal por parámetro', () => {
  for (const id of ['P2', 'P4', 'P4~SKUS-M10', 'P5', 'P10~amazon']) {
    const def = definicionDe(id), pag = sqlPaginaLibro(def, {cursor: null, limite: 51}), tot = sqlTotalLibro(def);
    for (const q of [pag, tot]) { assert.match(q.sql, /NOT EXISTS \(SELECT 1 FROM public\.economic_ledger_entries l2/); assert.match(q.sql, /e\.currency='USD'/); assert.ok(!/SKUS-M10/.test(q.sql) && !/e\.external_id LIKE '/.test(q.sql.split(' WHERE ')[1]), id + ': filtros por parámetro, no pegados al SQL'); assert.ok(!/(customer|email|phone|address)/i.test(q.sql)); }
    assert.ok(!/external_id[^,)]*AS\s+ref|e\.external_id AS/i.test(pag.sql), 'el external_id crudo no se selecciona (solo su hash corto)');
    assert.match(pag.sql, /left\(md5\(e\.external_id\),8\) AS ref/);
  }
  assert.match(sqlPaginaLibro(definicionDe('P4'), {cursor: null, limite: 51}).sql, /e\.status<>'cancelled'/);
  assert.ok(sqlPaginaLibro(definicionDe('P4~SKUS-M10'), {cursor: null, limite: 51}).p.includes('SKUS-M10'));
  assert.ok(sqlPaginaLibro(definicionDe('P10~amazon'), {cursor: null, limite: 51}).p.includes('amazon|%'));
  assert.equal(definicionDe('P3'), null); assert.equal(definicionDe('P10~inventado'), null);
});
test('cruce: une libro y Tracker por SKU y mes y no los presenta como la misma orden', () => {
  const x = armarCruce({skus: ['A'], libro: [{sku: 'A', month: '2026-09', channel: 'walmart', n: 10, nCancelled: 2, activeMinor: '5000'}], tracker: [{sku: 'A', fecha: '2026-09-03', retailer: 'walmart', montoMinor: 700, estado: 'rechazado'}, {sku: 'A', fecha: '2026-08-03', retailer: 'amazon', montoMinor: 100, estado: 'reembolsado'}, {sku: 'B', fecha: '2026-09-03', retailer: 'walmart', montoMinor: 1, estado: 'rechazado'}], canal: 'walmart'});
  assert.deepEqual(x, [{sku: 'A', mes: '2026-09', libro: {n: 8, minor: '5000'}, tracker: {n: 1, minor: '700', negados: 1}}]);
});
