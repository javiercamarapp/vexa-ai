// Fixture ÚNICO y coherente para las capturas de la landing (rama capturas-29oct). Solo `next dev` con VEXA_UI_FIXTURES=1 + Playwright.
// Organización FICTICIA «Organización de ejemplo», un solo periodo (ago-oct 2026, 90 días), cifras idénticas en todas las pantallas:
//   ingreso bruto de octubre 480,000 USD · reembolsos devueltos 36,000 USD (10 SKU HM-120..HM-210, canales A/B/C) · dinero atorado 9,000 USD · 14 hilos >24 h.
// Reutiliza el MISMO código de los servicios (Fuga, Carga, informe CFO, agente) con una base simulada; el resto de rutas sale de fixtures.mjs.
// NADA de config/cliente-piloto ni de VEXA_TENANT_ID: todo se inventa aquí. Las claves internas de canal (amazon/walmart/bestbuy) son las que exige el servicio;
// el rotulado visible («Marketplace A/B/C») se aplica en la captura (tools de capturar-landing.mjs) y se verifica con una búsqueda de marcas.
import {respond as respondBase} from './fixtures.mjs';
import {createRefundLeakRepository} from '../../../../packages/workspace-service/fuga-reembolsos.mjs';
import {createWorkloadRepository} from '../../../../packages/workspace-service/carga-sla.mjs';
import {armarCco} from '../../../../packages/workspace-service/cco.mjs';
import {buildCfoReport, serializeReport} from '../../../../packages/cfo-copilot/src/index.mjs';
import {createAgent, createSyntheticPort, SYNTHETIC_TENANTS, TOOLS, LIMITS, buildSuggestions} from '../../../../packages/agent-datos/index.mjs';
import {buildDataset} from '../../../../packages/agent-datos/synthetic.mjs';
import {filasCarga} from './mapa-sintetico.mjs';

// ---------- Cifras (misma fuente que apps/web/src/components/sitio/mocks/datos.ts) ----------
export const INGRESO_BRUTO = 480_000; // octubre de 2026
export const REEMBOLSOS = 36_000;
export const DINERO_ATORADO = 9_000;
export const HILOS_MAS_24H = 14;
export const EXPOSICION_SUBTOTAL = 21_600;
export const INGRESO_EN_JUEGO = 8_200;
export const PARETO = [['HM-210', 9800], ['HM-160', 7200], ['HM-130', 5400], ['HM-190', 4100], ['HM-150', 2900], ['HM-120', 2200], ['HM-180', 1700], ['HM-140', 1300], ['HM-170', 900], ['HM-200', 500]];
export const CANALES = {amazon: [5900, 6200, 6400], walmart: [3500, 3700, 4000], bestbuy: [2000, 2100, 2200]}; // A, B, C por mes
export const ETIQUETA_CANAL = {amazon: 'Marketplace A', walmart: 'Marketplace B', bestbuy: 'Marketplace C'};
export const MESES = ['2026-08', '2026-09', '2026-10'];
const AHORA = '2026-11-04T14:00:00.000Z'; // corte de la captura: Date.now() se fija en el navegador a este instante
const CORTE = '2026-11-03T22:00:00.000Z';
const FIN_MES = {'2026-08': '2026-08-31', '2026-09': '2026-09-30', '2026-10': '2026-10-31'};
const TENANT = SYNTHETIC_TENANTS.A;
const suma = xs => xs.reduce((a, b) => a + b, 0);

/** Matriz SKU x (canal, mes) en dólares enteros con márgenes exactos: filas = PARETO, columnas = CANALES (redondeo por déficits). */
export function matrizReembolsos() {
  const cols = Object.entries(CANALES).flatMap(([ch, v]) => v.map((x, i) => ({ch, mes: MESES[i], total: x})));
  const F = PARETO.map(([, v]) => cols.map(c => (v * c.total) / REEMBOLSOS)), M = F.map(r => r.map(Math.floor));
  const dr = PARETO.map(([, v], i) => v - suma(M[i])), dc = cols.map((c, j) => c.total - suma(M.map(r => r[j])));
  while (suma(dr) > 0) {
    let best = null;
    for (let i = 0; i < dr.length; i++) if (dr[i] > 0) for (let j = 0; j < dc.length; j++) if (dc[j] > 0) { const fr = F[i][j] - M[i][j]; if (!best || fr > best.fr) best = {i, j, fr}; }
    M[best.i][best.j]++; dr[best.i]--; dc[best.j]--;
  }
  return {cols, M};
}
const PRECIO = i => 58 + i * 6; // ticket promedio por reembolso, determinista

export function filasReembolsos() {
  const {cols, M} = matrizReembolsos(), out = [];
  PARETO.forEach(([sku], i) => cols.forEach((c, j) => {
    const d = M[i][j]; if (!d) return;
    out.push({ch: c.ch, sku, month: c.mes, status: 'settled', currency: 'USD', exponent: 2, n: Math.max(1, Math.round(d / PRECIO(i))), sinMonto: 0, amount: String(d * 100), first_day: c.mes + '-01', last_day: FIN_MES[c.mes]});
  }));
  return out;
}
const nReembolsos = (filter = () => true) => filasReembolsos().filter(filter).reduce((a, r) => a + r.n, 0);
const LINEAS_MES = {amazon: [2400, 2550, 2700], walmart: [1500, 1580, 1650], bestbuy: [820, 860, 900]};
export function filasPedidos() {
  const rows = filasReembolsos(), out = [];
  let total = 0;
  for (const [ch, v] of Object.entries(LINEAS_MES)) v.forEach((n, i) => { out.push({kind: 'mes', ch, sku: null, month: MESES[i], n, revised: 0}); total += n; });
  out.unshift({kind: 'total', ch: null, sku: null, month: null, n: total, revised: 0});
  PARETO.forEach(([sku], i) => {
    const pct = 0.074 - i * 0.0054; // HM-210 ≈ 7.4 % (como la pantalla de recomendación), la cola ≈ 2.5 %
    for (const ch of Object.keys(CANALES)) {
      const n = rows.filter(r => r.sku === sku && r.ch === ch).reduce((a, r) => a + r.n, 0);
      if (n) out.push({kind: 'sku', ch, sku, month: null, n: Math.round(n / pct), revised: 0});
    }
  });
  return out;
}
const VENTANAS = Object.entries(ETIQUETA_CANAL).flatMap(([ch, nom], i) => ['order_export', 'payment_ledger'].map(t => ({name: 'Marketplace ' + ['Amazon', 'Walmart', 'Best Buy'][i] + (t === 'order_export' ? ' · Pedidos' : ' · Devoluciones'),
  evidence_type: t, complete: false, window_start: '2026-08-01', window_end: '2026-11-02', watermark: '2026-11-03'})));
const ESTADOS_NEG = ['Older than 180 days', 'Can Not Refund', 'Rejected'];
export function filasTracker() {
  const out = [];
  const motivos = ['Defective', 'Defective', 'Shipping', 'Warranty', 'Return', 'Order'], ret = ['Amazon', 'Walmart', 'Best Buy'];
  for (let i = 0; i < 18; i++) out.push({sheet: 'Refunds', fila: i + 2, vinculada: i % 3 === 0, o: {SKU: PARETO[i % 10][0], Contact_reason: motivos[i % 6], Subreason: i % 2 ? 'Damaged' : 'Tool Replacement', Retailer: ret[i % 3], Status: ESTADOS_NEG[i % 3], Amount: '500.00', Request_date: String(46030 + i * 3)}});
  for (let i = 0; i < 42; i++) out.push({sheet: 'Refunds', fila: i + 30, vinculada: i % 4 === 0, o: {SKU: PARETO[i % 10][0], Contact_reason: motivos[i % 6], Subreason: 'Damaged', Retailer: ret[i % 3], Status: i % 7 === 0 ? 'Submitted' : 'Refunded', Amount: (48 + (i * 7) % 90).toFixed(2), Request_date: String(46040 + i)}});
  return out;
}
const dbBase = resolver => ({async transaction(_a, work) {
  const query = async (text, params) => {
    const t = String(text);
    if (/current_setting\('statement_timeout'\)/.test(t)) return {rows: [{v: '0'}]};
    if (/^(SAVEPOINT|RELEASE|ROLLBACK)/.test(t) || /set_config/.test(t)) return {rows: []};
    return resolver(t, params);
  };
  return work({tenantId: 'syn', query});
}});
const CONVS = [['2026-05', 1150], ['2026-06', 1240], ['2026-07', 1310], ['2026-08', 1420], ['2026-09', 1560], ['2026-10', 1690]];
export async function vistaFuga() {
  const db = dbBase((t, params) => {
    if (/kind='refund'/.test(t) && /economic_ledger_entries/.test(t)) return {rows: filasReembolsos()};
    if (/kind='order'/.test(t)) return {rows: filasPedidos()};
    if (/economic_source_versions/.test(t)) return {rows: VENTANAS.map((w, i) => ({source_id: String(i), active: true, ...w}))};
    if (/tracker_row_revisions/.test(t)) return {rows: filasTracker()};
    if (/contact_repeat_summary/.test(t)) return {rows: [{refreshed_at: '2026-11-04T06:00:00Z', source_watermark: CORTE, contacts: 9800, contacts_ge2_90: 1470, contacts_ge3_90: 520, linked_tickets: 14100, repeat_tickets_90: 3900, total_tickets: 18000,
      by_category: [{category: 'Shipping: Delivery Not Received', customers: 410, repeaters: 118}, {category: 'Order: Wrong Item', customers: 260, repeaters: 61}, {category: 'Return: No Longer Wanted', customers: 190, repeaters: 30}, {category: 'Shipping: Damaged in Transit', customers: 150, repeaters: 41}]}]};
    if (/summary_refresh_state/.test(t)) return {rows: [{refreshed_at: '2026-11-04T05:50:00Z'}]};
    if (/FROM public\.insight_state/.test(t)) return params?.[1] === 'conversation_volume' ? {rows: [{status: 'ready', refreshed_at: '2026-11-04T05:50:00Z', source_watermark: CORTE, computed_from: {}, detail: {}}]} : {rows: []};
    if (/FROM public\.insight_conversation_volume/.test(t)) return {rows: CONVS.map(([m, n]) => ({period: m + '-01', n}))};
    return {rows: []};
  });
  return createRefundLeakRepository({database: db, now: () => new Date(AHORA)}).get();
}
export async function vistaCarga() {
  const db = dbBase((t, params) => {
    if (/FROM public\.insight_conversation_volume/.test(t)) return {rows: CONVS.map(([m, n]) => ({period: m + '-01', n}))};
    if (/FROM public\.insight_state/.test(t) && params?.[1] === 'conversation_volume') return {rows: [{status: 'ready', refreshed_at: '2026-11-04T05:50:00Z', source_watermark: CORTE, computed_from: {}, detail: {}}]};
    if (/FROM public\.insight_state/.test(t)) return params?.[1] === 'thread_resolution' ? {rows: [{status: 'ready', refreshed_at: '2026-11-04T13:10:00Z', source_watermark: '2026-11-04T13:00:00Z', computed_from: {}}]} : {rows: []};
    if (/FROM public\.insight_thread_resolution/.test(t)) return {rows: [{grain: 'all', period: '0001-01-01', threads: 1690, closed: 1610, reopened_threads: 40, close_p50_hours: '6.2', close_p90_hours: '30.1', closed_lt_1h: 300, closed_gt_7d: 20, status_events: 3200}]};
    if (/summary_refresh_state/.test(t)) return {rows: [{refreshed_at: '2026-11-04T05:50:00Z'}]};
    if (/conversation_monthly/.test(t)) return {rows: CONVS.map(([month, n]) => ({month, n}))};
    if (/insight_inbound_load/.test(t)) return {rows: []};
    if (/extract\(isodow/.test(t)) return {rows: filasCarga()};
    if (/FROM public\.conversations WHERE tenant_id=\$1 AND deleted_at IS NULL/.test(t)) return {rows: [{total: 8420, con_canal: 0}]};
    if (/WITH t AS/.test(t)) return {rows: [{hilos: 1690, medibles: 1650, con_resp: 1560, dentro: 1480, p50_h: '1.4', p90_h: '19.8', abiertos_sin_resp_24: HILOS_MAS_24H, abiertos_1_7: 0, abiertos_7_30: 0, abiertos_30: 0, cerrados_sin_resp: 76,
      min_creado: '2026-08-01', max_creado: '2026-11-03', corte: CORTE}]};
    return {rows: []};
  });
  return createWorkloadRepository({database: db, now: () => new Date(AHORA)}).get();
}

// ---------- Informe CFO (ingreso bruto) ----------
const MESES_CFO = ['2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'];
const INGRESO_MES = [380_000, 395_000, 410_000, 425_000, 438_000, 450_000, 465_000, 472_000, INGRESO_BRUTO];
const REEMB_MES = [9_100, 9_600, 10_200, 10_700, 11_000, 11_100, 11_400, 12_000, 12_600]; // ago-oct = 11,400 + 12,000 + 12,600 = 36,000
export function ledgerCfo() {
  const rows = [], reparto = {amazon: 0.62, walmart: 0.26, bestbuy: 0.12};
  MESES_CFO.forEach((month, i) => {
    for (const [kind, total, ticket] of [['order', INGRESO_MES[i], 6400], ['refund', REEMB_MES[i], 6200]]) {
      let usado = 0;
      Object.entries(reparto).forEach(([channel, p], k, a) => {
        const amount = k === a.length - 1 ? total - usado : Math.round(total * p); usado += amount;
        const n = Math.round(amount / (ticket / 100));
        rows.push({month, channel, kind, status: kind === 'order' ? 'recorded' : 'settled', currency: 'USD', exponent: 2, basis: kind === 'order' ? 'marketplace_line_price' : 'marketplace_refund_amount', n, known: n, amountMinor: String(amount * 100)});
      });
    }
  });
  return rows;
}
export function informeCfo() {
  const r = buildCfoReport(ledgerCfo(), {watermark: CORTE, now: new Date(AHORA), exposure: {attestedLinks: 0, coverageComplete: false, rows: []}});
  return {data: {status: 'ok', synthetic: true, exposureStatus: 'ok', report: serializeReport(r)}};
}

// ---------- Agente (Pregúntale) sobre el mismo libro ----------
function datasetAgente() {
  const d = buildDataset({tenantId: TENANT});
  const MESES12 = ['2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'];
  const ing = [330_000, 360_000, 340_000, 380_000, 395_000, 410_000, 425_000, 438_000, 450_000, 465_000, 472_000, INGRESO_BRUTO];
  const ref = [8_200, 9_100, 8_500, 9_100, 9_600, 10_200, 10_700, 11_000, 11_100, 11_400, 12_000, 12_600];
  const porCanal = {A: {m: CANALES.amazon, p: 0.62}, B: {m: CANALES.walmart, p: 0.26}, C: {m: CANALES.bestbuy, p: 0.12}};
  const led = [];
  MESES12.forEach((month, i) => {
    let uo = 0, ur = 0;
    Object.entries(porCanal).forEach(([id, c], k, a) => {
      const last = k === a.length - 1, o = last ? ing[i] - uo : Math.round(ing[i] * c.p); uo += o;
      const r = i >= 9 ? c.m[i - 9] : last ? ref[i] - ur : Math.round(ref[i] * (c.m[0] / 11_400)); ur += r;
      const key = 'marketplace_' + id.toLowerCase(), label = 'Marketplace ' + id;
      led.push({source: key, sourceLabel: label, currency: 'USD', exponent: 2, month, kind: 'order', count: Math.round(o / 64), amountMinor: String(o * 100), unknown: 0});
      led.push({source: key, sourceLabel: label, currency: 'USD', exponent: 2, month, kind: 'refund', count: Math.round(r / 62), amountMinor: String(r * 100), unknown: 0});
    });
  });
  d.ledger = led.filter(r => r.month >= '2026-08'); // el libro de ejemplo solo cubre ago-oct: «los últimos 12 meses» del agente suman 36,000
  const usd = kind => MESES12.map(month => d.ledger.filter(r => r.month === month && r.kind === kind).reduce((a, r) => ({count: a.count + r.count, amount: a.amount + BigInt(r.amountMinor), unknown: 0}), {count: 0, amount: 0n, unknown: 0}));
  const O = usd('order'), R = usd('refund');
  d.trends.ledger.series = MESES12.map((month, i) => ({month, orders: {count: O[i].count, amountMinor: String(O[i].amount), unknownAmounts: 0}, refunds: {count: R[i].count, amountMinor: String(R[i].amount), unknownAmounts: 0}}));
  d.trends.ledger.otherCurrencies = []; d.trends.ledger.currencies = ['USD:2'];
  const TIT = ['Entrega marcada como completa sin recibirse', 'Pieza distinta a la publicada', 'Cobro duplicado'];
  const CAS = [124, 86, 41];
  d.problems.forEach((p, i) => { if (i < 3) { p.title = TIT[i]; p.customers = CAS[i]; } else { p.title = ['Reembolso tardío tras devolución', 'Talla incorrecta', 'Caja abierta al recibir'][i - 3]; p.customers = [38, 22, 15][i - 3]; } });
  d.exposure.rows = [[0, '1240000', null, 124, 124], [1, '920000', null, 86, 86], [2, null, null, 0, 41]].map(([i, amt, kn, k, e]) => ({problemId: d.problems[i].problemId, title: d.problems[i].title, amountMinor: amt, knownSubtotalMinor: kn, known_n: k, eligible_n: e}));
  const src = (key, label, cls, total, inc, rej, imports, detail = []) => ({key, label, loaded: true, status: 'ok', class: cls, imports, openImports: 0, total, incorporated: inc, rejected: rej, pending: 0, lastUpdate: '2026-11-04T05:50:00.000Z', detail});
  d.coverage.sources = [src('hubspot', 'HubSpot (conversaciones, contactos)', 'observed', 8420, 8420, 0, 0), src('ledger', 'Exportes de marketplace (libro de registros)', 'observed', 14260, 14260, 0, 3, ['Marketplace A, B y C · USD', 'Carga manual desde exportes de marketplace']),
    src('csv', 'Archivos CSV (importaciones)', 'observed', 640, 640, 0, 2)];
  d.associations = {status: 'ok', class: 'observed', total: 8420, resolved: 8100, pending: 320, review: 0, held: 0, activeLinks: 7600, sampled: false};
  d.tracker = {status: 'ok', class: 'observed', version: 'v1', rank: 1, versions: 1, sha: 'ab12cd34', rows: 60, rejected: 0, sheetsClosed: 1, sheetsTotal: 1};
  return d;
}
const store = new Map([[TENANT, datasetAgente()]]);
const agentPort = () => createSyntheticPort(store, {tenantId: TENANT, now: AHORA});
const agentCtx = () => ({tenantId: TENANT, userId: 'fixture-user', role: 'owner', now: new Date(AHORA)});
async function agentState() {
  const cov = await agentPort().coverage();
  return {available: true, mode: 'deterministic', role: 'owner', scope: '00000000', toolLabels: Object.fromEntries(TOOLS.map(t => [t.name, t.label])), canSeeEvidence: true, suggestions: buildSuggestions(cov, 'owner'),
    limits: {maxQuestionChars: LIMITS.maxQuestionChars, maxHistory: LIMITS.maxHistory, maxTurnsPerConversation: LIMITS.maxTurnsPerConversation}, note: 'Las respuestas salen de herramientas de consulta deterministas sobre datos agregados; nada de texto crudo de clientes se envía a un modelo.'};
}
async function agentTurn(body) {
  const answer = await createAgent().answer({ctx: agentCtx(), port: agentPort(), question: body?.question, history: body?.history, directa: body?.directa, conversationTurns: body?.conversationTurns});
  const {violations, ...wire} = answer; void violations;
  return {t: 'fin', respuesta: wire};
}

// ---------- CCO con SKU HM-xxx ----------
export async function vistaCco() {
  const ok = rows => ({rows});
  const cell = (d1, d2, n, es_otros = false) => ({d1, d2, n, es_otros});
  const vent = [['amazon', true, 3], ['walmart', true, 3], ['bestbuy', true, 3]].map(([channel, ra, months]) => ({channel, refunds_available: ra, orders_from: '2026-08-01', orders_to: '2026-11-02', refunds_from: '2026-08-01', refunds_to: '2026-11-02', months}));
  const lineas = filasPedidos().filter(r => r.kind === 'sku'), rf = filasReembolsos();
  const sku = (s, ch) => {
    const l = lineas.find(r => r.sku === s && r.ch === ch), rr = rf.filter(r => r.sku === s && r.ch === ch);
    return l && rr.length ? {channel: ch, sku_base: s, currency: 'USD', exponent: 2, month_from: '2026-08-01', month_to: '2026-10-01', months: 3, window_complete: false, refunds_available: true, order_lines: l.n, order_gross_minor: String(l.n * 6400),
      refund_n: suma(rr.map(r => r.n)), refund_n_unknown_amount: 0, refund_amount_minor: String(suma(rr.map(r => Number(r.amount)))), refunds_per_100_lines: Math.round(suma(rr.map(r => r.n)) * 10000 / l.n) / 100} : null;
  };
  const filas = PARETO.flatMap(([s]) => Object.keys(CANALES).map(ch => sku(s, ch))).filter(Boolean);
  const sinV = (s, last, w) => ({sku_base: s, first_sale_month: '2026-08-01', last_sale_month: last, months_without_sale: w, lines_last_3m: 0, lines_last_6m: 0, lines_last_9m: 4, channels: ['amazon'], skus_with_sales: 10, reference_month: '2026-10-01', data_through: '2026-11-03'});
  const raw = {ventanas: ok(vent), skuCanal: ok(filas), sinVenta: ok([sinV('HM-110', '2026-08-01', 2), sinV('HM-100', '2026-08-01', 2)]),
    defecto: ok([cell('HM-210', 'defectuoso', 11), cell('HM-210', 'danado', 6), cell('HM-160', 'defectuoso', 7)]), hoja: ok([cell('HM-210', 'garantia', 12), cell('HM-210', 'reembolso', 7)]),
    subcanal: ok([cell('amazon_com', null, 310), cell('walmart_cumplido_por_walmart', null, 190), cell('amazon_cumplido_por_amazon', null, 90)]),
    bodLat: ok([cell(null, null, 9, true)]), bodMot: ok([]), cob: ok([{rows_total: 480, with_retailer: 470, with_sku: 470, with_warehouse: 0, with_latency: 0, with_address: 0, sheets: 1, cutoff: '2026-11-03T00:00:00Z'}])};
  return armarCco(raw, null, {now: new Date(AHORA)});
}

// ---------- Ajustes a las respuestas base (problemas, conexiones, cobertura) ----------
const PROB = [
  {t: 'Entrega marcada como completa sin recibirse', s: 'Pedidos que figuran como entregados y que el cliente dice no haber recibido.', expo: '1240000', ref: '460000', n: 124, cita: 'Mi pedido figura como entregado y no llegó. Ya escribí dos veces por correo.', cita2: 'Pedí el reembolso hace una semana y sigo sin respuesta.', sev: 'high'},
  {t: 'Pieza distinta a la publicada', s: 'El producto recibido no coincide con la publicación del canal.', expo: '920000', ref: '310000', n: 86, cita: 'Es la segunda vez que pido el reemplazo. Dejé mi teléfono y nadie llamó.', cita2: 'La pieza que llegó no es la de la foto de la publicación.', sev: 'medium'},
  {t: 'Cobro duplicado', s: 'El cliente reporta dos cargos por el mismo pedido.', expo: null, ref: null, n: 41, cita: 'Me cobraron dos veces el mismo pedido y no veo el reverso.', cita2: 'Revisé mi estado de cuenta: aparece el cargo duplicado.', sev: 'medium'},
];
const PID = i => `00000000-0000-4000-8000-00000000010${i + 1}`;
function parcheMetrics(ms, p) {
  return ms.map(m => m.kind === 'exposure' ? {...m, amount_minor: p.expo, known_subtotal: null, status: p.expo ? 'complete' : 'unavailable', coverage: {known_n: p.expo ? p.n : 0, eligible_n: p.n}, missing_reasons: p.expo ? [] : ['relacion_sin_cobertura']}
    : m.kind === 'refunds' ? {...m, amount_minor: p.ref ?? '0', coverage: {known_n: Math.round(p.n / 3), eligible_n: Math.round(p.n / 3)}} : m);
}
function parcheRecord(rec, i) {
  const p = PROB[i];
  const ev = i === 2 ? [] : [{...(rec.evidence?.[0] ?? {id: '00000000-0000-4000-8000-00000000100' + i, source_ref: 'conv:00000000-0000-4000-8000-00000000080' + (i + 1) + '#m1', role: 'customer'}), quote: p.cita}, {...(rec.evidence?.[1] ?? rec.evidence?.[0] ?? {id: '00000000-0000-4000-8000-00000000110' + i, source_ref: 'conv:00000000-0000-4000-8000-00000000090' + (i + 1) + '#m2', role: 'customer'}), quote: p.cita2, id: '00000000-0000-4000-8000-00000000110' + i}];
  return {...rec, title: p.t, summary: p.s, status: i === 2 ? 'partial' : 'ready', metrics: parcheMetrics(rec.metrics?.length ? rec.metrics : [{label: 'Ingresos expuestos', kind: 'exposure', currency: 'USD', exponent: 2, source_ref: 'snapshot:exposure.' + PID(i)}, {label: 'Reembolsos liquidados', kind: 'refunds', currency: 'USD', exponent: 2, source_ref: 'snapshot:refunds.' + PID(i), status: 'complete', missing_reasons: []}], p),
    evidence: ev, details: [{label: 'Conversaciones', value: `${p.n} · ${ev.length} con cita verificable`}]};
}
const CONN = (id, source, accountId, extra = {}) => ({id, source, accountId, connectionStatus: 'active', state: 'ok', lastAttempt: '2026-11-04T13:55:00.000Z', lastSuccess: '2026-11-04T13:55:00.000Z', watermark: null, coverage: null, lagSeconds: 300, lagBasis: 'time_since_success', permissions: 'available', errorCode: null, reconnect: null, ...extra});

export async function respond(url, method, bodyText) {
  const u = new URL(url, 'http://x'), p = u.pathname, q = u.searchParams, ok = data => [200, {contract_version: 'f06-workspace-v1', data, meta: {trace_id: 'fixture'}}];
  if (method === 'GET') {
    if (p === '/api/refunds') return [200, {data: await (cacheFuga ??= vistaFuga())}];
    if (p === '/api/workload') return [200, {data: await (cacheCarga ??= vistaCarga())}];
    if (p === '/api/cco') return [200, await (cacheCco ??= vistaCco())];
    if (p === '/cfo/data/report') return [200, informeCfo()];
    if (p === '/api/onboarding/estado') return [200, {data: {pista: 'owner', derivados: [], completados: []}}];
    if (p === '/api/connections') return [200, {connections: [CONN('00000000-0000-4000-8000-000000003002', 'hubspot', 'Portal de ejemplo', {coverage: {observed: 8420, accepted: 8420, rejected: 0}, watermark: {kind: 'checkpoint_hash', value: 'a1b2c3d4e5f6'}}),
      CONN('00000000-0000-4000-8000-000000003007', 'csv', 'Exporte de marketplace A', {lastAttempt: '2026-11-03T20:00:00.000Z', lastSuccess: '2026-11-03T20:00:00.000Z', lagSeconds: null, permissions: 'unknown'}),
      CONN('00000000-0000-4000-8000-000000003008', 'csv', 'Exporte de marketplace B', {lastAttempt: '2026-11-03T20:10:00.000Z', lastSuccess: '2026-11-03T20:10:00.000Z', lagSeconds: null, permissions: 'unknown'}),
      CONN('00000000-0000-4000-8000-000000003009', 'csv', 'Exporte de marketplace C', {lastAttempt: '2026-11-03T20:20:00.000Z', lastSuccess: '2026-11-03T20:20:00.000Z', lagSeconds: null, permissions: 'unknown'})]}];
    if (p === '/api/connections/settings') return [200, {canConfigure: true, settings: [{connectionId: '00000000-0000-4000-8000-000000003002', source: 'hubspot', accountId: 'Portal de ejemplo', credentialRef: 'ref-ejemplo', historyFrom: '2026-08-01T00:00:00.000Z', enabled: true, overlapSeconds: 60, pollSeconds: 300, version: 1, errorCode: null, failureCount: 0}]}];
    if (p === '/api/freshness') {
      const ago = s => new Date(Date.parse(AHORA) - s * 1000).toISOString();
      return [200, {data: {availability: 'ready', version: 'demo', sources: [{key: 'hubspot', method: 'api_poll', status: 'idle', lastAttemptAt: ago(300), lastSuccessAt: ago(300), ageSeconds: 300, lastNewRecords: 12, errorCode: null, latencyMs: 820, nextRunAt: ago(-60), expectedEverySeconds: 300, dataWatermark: ago(360), stale: false},
        {key: 'tracker', method: 'manual_upload', status: 'idle', lastAttemptAt: ago(86400), lastSuccessAt: ago(86400), ageSeconds: 86400, lastNewRecords: null, errorCode: null, latencyMs: null, nextRunAt: null, expectedEverySeconds: null, dataWatermark: null, stale: false}], insights: []}}];
    }
    if (p === '/api/coverage') return ok(store.get(TENANT).coverage);
    if (p === '/api/agent/state') return [200, {data: await agentState()}];
    if (p === '/api/trends/categories') {
      const [, j] = await respondBase(url, method, bodyText), rows = [['Shipping: Delivery Not Received', 1204], ['Order: Wrong Item', 655], ['Billing: Duplicate Charge', 388], ['Shipping: Damaged in Transit', 342], ['Return: No Longer Wanted', 288], ['Shipping: Arrived Late', 171]].map(([category, count], i) => ({category, count, runs: 6 - (i >> 1)}));
      return [200, {...j, data: {...j.data, rows, totals: {incidences: suma(rows.map(r => r.count)), categories: rows.length, runs: 18}}}];
    }
  }
  if (p === '/api/agent/turn') return [200, await agentTurn(bodyText ? JSON.parse(bodyText) : null)];
  const hit = await respondBase(url, method, bodyText);
  if (!hit || hit[0] !== 200) return hit;
  const [st, j] = hit, clone = structuredClone(j);
  if (p === '/api/workspace' && q.get('resource') === 'problems' && clone.data?.items) {
    clone.data.items = clone.data.items.slice(0, 3).map((it, i) => ({...parcheRecord(it, i), id: PID(i), problem_id: PID(i)}));
    clone.data.meta = {...clone.data.meta, coverage: 'Corte de ejemplo: la exposición se muestra como subtotal conocido, no como total.', watermark: CORTE, state: 'partial'};
    return [st, clone];
  }
  if (p === '/api/problems' && clone.problems) { clone.problems = clone.problems.slice(0, 3).map((x, i) => ({...x, id: PID(i), label: PROB[i].t})); return [st, clone]; }
  const m = p.match(/^\/api\/workspace\/detail\/problem\/(.+)$/);
  if (m && clone.data?.record) {
    const i = Math.max(0, [0, 1, 2].findIndex(k => PID(k) === m[1]));
    clone.data.id = PID(i); clone.data.title = PROB[i].t; clone.data.record = {...parcheRecord(clone.data.record, i), id: PID(i), problem_id: PID(i)};
    clone.data.components = (clone.data.components ?? []).map(c => ({...c, money: c.money && PROB[i].ref ? {...c.money, amount_minor: PROB[i].ref} : c.money}));
    clone.data.customers = []; clone.data.conversations = (clone.data.conversations ?? []).map(c => ({...c, label: 'Conversación de ejemplo', citations: (c.citations ?? []).map((x, k) => ({...x, quote: k ? PROB[i].cita2 : PROB[i].cita}))}));
    return [st, clone];
  }
  const f = p.match(/^\/api\/problems\/([0-9a-f-]{36})\/facts$/);
  if (f && clone.data) {
    const i = Math.max(0, [0, 1, 2].findIndex(k => PID(k) === f[1])), pr = PROB[i];
    Object.assign(clone.data, {problemId: PID(i), label: pr.t, conversations: pr.n, citations: pr.n * 2, severity: pr.sev, severityMix: {high: i === 0 ? pr.n : 0, medium: i === 0 ? 0 : pr.n, low: 0}, critical: {critical: i === 0, signals: i === 0 ? 12 : 0, reason: 'severity'},
      themes: [{category: ['Shipping: Delivery Not Received', 'Order: Wrong Item', 'Billing: Duplicate Charge'][i], count: pr.n}], grupo: {n: i + 1, de: 3},
      recommendations: {state: 'ok', items: [{id: '00000000-0000-4000-8000-000000000301', title: pr.t, status: 'proposed', version: 1, action: 'Revisar', intervention: null}]},
      attachments: {state: 'ok', total: 0, conversaciones: 0, porClase: {}, cobertura: {enlazados: 0, total: 0}}});
    return [st, clone];
  }
  if (/^\/api\/trends\/incidences/.test(p) && clone.data) {
    const i = Math.max(0, [0, 1, 2].findIndex(k => PID(k) === q.get('problem'))), esc = [0.6, 0.45, 0.25][i];
    clone.data.series = clone.data.series.filter(s => s.month >= '2025-11').map(s => ({...s, count: Math.max(1, Math.round(s.count * esc)), conversations: Math.max(1, Math.round(s.conversations * esc))}));
    clone.data.completeness = {...clone.data.completeness, dataThrough: CORTE, partialMonth: null, partialMonths: []};
    return [st, clone];
  }
  return hit;
}
let cacheFuga, cacheCarga, cacheCco;
