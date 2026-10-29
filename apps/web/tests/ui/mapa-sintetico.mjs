// Vistas SINTÉTICAS de «Mapa de problemas» y «Carga y SLA» (todo DEMO, sin datos de clientes). Pasan por el MISMO código de los servicios con una base simulada.
import {createGeoMapRepository} from '../../../../packages/workspace-service/mapa-problemas.mjs';
import {createWorkloadRepository} from '../../../../packages/workspace-service/carga-sla.mjs';

const lcg = seed => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
const ESTADOS = [['TX', 'Austin', '78701', 220], ['CA', 'Fresno', '93650', 190], ['FL', 'Miami', '33101', 150], ['NY', 'Albany', '12201', 90], ['IL', 'Peoria', '61602', 70], ['GA', 'Macon', '31201', 60], ['OH', 'Akron', '44301', 48],
  ['PA', 'Erie', '16501', 40], ['AZ', 'Tucson', '85701', 36], ['NC', 'Raleigh', '27601', 30], ['WA', 'Spokane', '99201', 22], ['CO', 'Pueblo', '81003', 15], ['MI', 'Flint', '48502', 9], ['NV', 'Reno', '89501', 6], ['VT', 'Barre', '05641', 3], ['WY', 'Casper', '82601', 2], ['HI', 'Hilo', '96720', 1]];
const MX = [['Jalisco', 22], ['Nuevo León', 14], ['Ciudad de México', 11], ['Querétaro', 6], ['Yucatán', 3]];
const HOJAS = ['Warranty Tools', 'Warranty Parts', 'Refunds', 'Return Labels', 'Quotes', 'Waitlist', 'Refunds Requests'];
const MOT = ['Defective', 'Warranty', 'Return', 'Order', 'Shipping', 'Missing parts'], RET = ['Walmart :: x', 'Amazon', 'Amazon', 'Walmart :: x', 'Best Buy', 'PILOTO'];
export function filasMapa(o = {}) {
  const r = lcg(5), out = [];
  for (const [st, ciudad, zip, n] of ESTADOS) for (let i = 0; i < n; i++) out.push({sheet: HOJAS[Math.floor(r() * 4)], tiene: true,
    o: {'Customer Address': `DEMO-${st}-${i} Calle ${i}, ${ciudad}, ${st} ${zip}`, Contact_reason: MOT[Math.floor(r() * MOT.length)], Retailer: RET[Math.floor(r() * RET.length)]}});
  for (const [nom, n] of MX) for (let i = 0; i < n; i++) out.push({sheet: 'Quotes', tiene: true, o: {Customer_address: `DEMO-MX-${i} Colonia Centro, ${nom}, México`, Retailer: RET[Math.floor(r() * RET.length)]}});
  for (let i = 0; i < 230; i++) out.push({sheet: HOJAS[Math.floor(r() * HOJAS.length)], tiene: true, o: {Customer_address: `DEMO-SIN-ESTADO-${i} dirección incompleta`, Retailer: RET[Math.floor(r() * RET.length)]}});
  for (let i = 0; i < 2400; i++) out.push({sheet: HOJAS[Math.floor(r() * HOJAS.length)], tiene: true, o: {Retailer: RET[Math.floor(r() * RET.length)]}});
  return o.pocos ? out.filter((_, i) => i % 40 === 0) : out;
}
const dbBase = (resolver) => ({async transaction(_a, work) {
  const query = async (text, params) => {
    const t = String(text);
    if (/current_setting\('statement_timeout'\)/.test(t)) return {rows: [{v: '0'}]};
    if (/^(SAVEPOINT|RELEASE|ROLLBACK)/.test(t) || /set_config/.test(t)) return {rows: []};
    return resolver(t, params);
  };
  return work({tenantId: 'syn', query});
}});
export async function vistaMapa(o = {}) {
  if (o.error) throw new Error('fallo');
  const db = dbBase(t => (/tracker_row_revisions/.test(t) ? {rows: o.vacio ? [] : filasMapa(o)} : {rows: []}));
  return createGeoMapRepository({database: db, now: () => new Date('2026-10-23T12:00:00Z')}).get();
}
const MESES = [['2026-02', 1785], ['2026-03', 2833], ['2026-04', 3939], ['2026-05', 5192], ['2026-06', 5748], ['2026-07', 8742], ['2026-08', 2063], ['2026-09', 1089]];
export function filasCarga() {
  const r = lcg(9), out = [];
  const peso = h => (h < 6 ? 0.15 : h < 9 ? 0.6 : h < 12 ? 1.5 : h < 14 ? 1.1 : h < 19 ? 1.4 : h < 22 ? 0.7 : 0.3);
  for (let dow = 1; dow <= 7; dow++) for (let hour = 0; hour < 24; hour++) out.push({dow, hour, n: Math.round(peso(hour) * (dow >= 6 ? 14 : 40) * (0.8 + r() * 0.4))});
  return out;
}
export async function vistaCarga(o = {}) {
  const db = dbBase((t, params) => {
    if (o.error) throw new Error('57014');
    if (/FROM public\.insight_conversation_volume/.test(t)) return {rows: MESES.map(([month, n]) => ({period: month + '-01', n}))};
    if (/FROM public\.insight_state/.test(t) && params?.[1] === 'conversation_volume') return {rows: [{status: 'ready', refreshed_at: '2026-10-22T05:53:59Z', source_watermark: '2026-10-19T04:37:31Z', computed_from: {}, detail: {}}]};
    if (/FROM public\.insight_state/.test(t)) return params?.[1] === 'thread_resolution' ? {rows: [{status: 'ready', refreshed_at: '2026-10-23T19:10:47Z', source_watermark: '2026-10-23T19:00:00Z', computed_from: {}}]} : {rows: []};
    if (/FROM public\.insight_thread_resolution/.test(t)) return {rows: [{grain: 'all', period: '0001-01-01', threads: 3017, closed: 1744, reopened_threads: 175, close_p50_hours: '44.2', close_p90_hours: '1001.3', closed_lt_1h: 300, closed_gt_7d: 400, status_events: 5000}]};
    if (/summary_refresh_state/.test(t)) return {rows: [{refreshed_at: '2026-10-22T05:53:59Z'}]};
    if (/conversation_monthly/.test(t)) return {rows: MESES.map(([month, n]) => ({month, n}))};
    if (/insight_inbound_load/.test(t)) return {rows: []};
    if (/extract\(isodow/.test(t)) return {rows: filasCarga()};
    if (/FROM public\.conversations WHERE tenant_id=\$1 AND deleted_at IS NULL/.test(t)) return {rows: [{total: 104024, con_canal: 0}]};
    if (/WITH t AS/.test(t)) return {rows: [{hilos: 3018, medibles: 2858, con_resp: 424, dentro: 291, p50_h: '0.0063', p90_h: '384.03', abiertos_sin_resp_24: 966, abiertos_1_7: 0, abiertos_7_30: 0, abiertos_30: 966, cerrados_sin_resp: 1468,
      min_creado: '2026-07-10', max_creado: '2026-07-20', corte: '2026-10-23T19:20:37Z'}]};
    return {rows: []};
  });
  return createWorkloadRepository({database: db, now: () => new Date('2026-10-23T12:00:00Z')}).get();
}
