// «Puntos de dolor» (L1): servicio de LECTURA. Solo SELECT, acotado al tenant, bajo la sesión y la RLS del usuario, sin PII. Reutiliza las lecturas ya existentes
// (insights precalculados de fuga-reembolsos / carga-sla / port-queries) y NO agrega en vivo contra las tablas grandes: cada parte corre en su propio SAVEPOINT con tope de
// tiempo y, si no responde, queda «no disponible ahora» (sinDato.causa = no_disponible), JAMÁS 0. Chargebacks: sin fuente (sinDato), con P1/P2 rotulados como proxy.
import {guarded} from './catalog-overview.mjs';
import {canalDeFuente} from './fuga-reembolsos.mjs';
import {readTrackerRefundStatus, readThreadResolution, readRefundBySkuMonth} from '../insights/reader.mjs';
import {readOrderRevenueMonth} from '../insights/reader-brechas.mjs';
import {attempt} from './summaries.mjs';
import {TEMAS, CLASES, armarPuntos, ordenPuntos, temasDe} from './pain-points-catalogo.mjs';

export {TEMAS, CLASES, armarPuntos};
/** Presupuestos de tiempo (ms) por parte. Cada consulta nueva mide < 3 s en frío (ver apps/web/docs o el informe de la rama). */
export const PAIN_BUDGETS_MS = Object.freeze({tracker: 2000, walmart: 3000, reembolsos: 3000, ordenes: 3000, hilos: 2000, repetido: 2000, garantia: 3000});
export const PAIN_VERSION = 'pain-points-v1';

const listo = r => (r && (r.availability === 'ready' || r.availability === 'partial') ? r : null);
const iso = v => (v == null ? null : new Date(v).toISOString());

/** Reembolsos de Walmart en estado pendiente (USD) leídos del resumen mensual del libro (economic_ledger_monthly): decenas de filas. */
export async function leerWalmartPendiente(s, {timeoutMs = PAIN_BUDGETS_MS.walmart} = {}) {
  const r = await attempt(s, async () => (await s.query(
    `SELECT v.name AS fuente, m.status, m.currency, m.exponent::int AS exponent, sum(m.n)::int AS n, sum(m.known)::int AS known, coalesce(sum(m.amount_minor),0)::text AS amount,
        to_char(min(m.month),'YYYY-MM') AS desde, to_char(max(m.month),'YYYY-MM') AS hasta, max(m.refreshed_at) AS refreshed, max(m.ledger_watermark) AS watermark
     FROM public.economic_ledger_monthly m
     JOIN (SELECT DISTINCT ON (source_id) source_id, name FROM public.economic_source_versions WHERE tenant_id=$1 ORDER BY source_id, version DESC) v ON v.source_id=m.source_id
     WHERE m.tenant_id=$1 AND m.kind='refund' GROUP BY 1,2,3,4 LIMIT 200`, [s.tenantId])).rows, timeoutMs);
  if (r.timeout || r.unavailable) return null;
  const filas = r.value.filter(x => canalDeFuente(x.fuente) === 'walmart' && x.status === 'pending' && x.currency === 'USD' && Number(x.exponent) === 2);
  if (!filas.length) return {n: 0, known: 0, minor: '0', desde: null, hasta: null, refreshedAt: null, watermark: null};
  return {
    n: filas.reduce((a, x) => a + Number(x.n), 0), known: filas.reduce((a, x) => a + Number(x.known), 0), minor: String(filas.reduce((a, x) => a + BigInt(String(x.amount).split('.')[0]), 0n)),
    desde: filas.map(x => x.desde).sort()[0], hasta: filas.map(x => x.hasta).sort().at(-1), refreshedAt: iso(filas.map(x => x.refreshed).sort().at(-1)), watermark: iso(filas.map(x => x.watermark).sort().at(-1)),
  };
}
/** Filas no vacías de las hojas de garantía (sin los espejos WTR/WPR). */
export async function leerGarantia(s, {timeoutMs = PAIN_BUDGETS_MS.garantia} = {}) {
  const r = await attempt(s, async () => (await s.query(
    `SELECT sheet_name AS hoja, count(DISTINCT row_number)::int AS n FROM public.tracker_row_revisions
     WHERE tenant_id=$1 AND ticket_state<>'header' AND sheet_name = ANY($2::text[]) GROUP BY 1 LIMIT 10`, [s.tenantId, ['Warranty Tools', 'Warranty Parts']])).rows, timeoutMs);
  if (r.timeout || r.unavailable) return null;
  const hojas = Object.fromEntries(r.value.map(x => [x.hoja, Number(x.n)]));
  const total = Object.values(hojas).reduce((a, n) => a + n, 0);
  return total > 0 ? {total, hojas} : null;
}
/** Contacto repetido: false = el resumen aún no se calculó; null = no disponible ahora. */
export async function leerRepetido(s, {timeoutMs = PAIN_BUDGETS_MS.repetido} = {}) {
  const r = await attempt(s, async () => (await s.query(
    `SELECT refreshed_at, source_watermark, contacts, contacts_ge2_90, linked_tickets, total_tickets FROM public.contact_repeat_summary WHERE tenant_id=$1`, [s.tenantId])).rows[0] ?? false, timeoutMs);
  if (r.timeout || r.unavailable) return null;
  if (r.value === false) return false;
  const c = Number(r.value.contacts), t = Number(r.value.total_tickets);
  return {contactos: c, contactosDosOMas: Number(r.value.contacts_ge2_90), pct: c > 0 ? Math.round(Number(r.value.contacts_ge2_90) * 1000 / c) / 10 : null,
    pctSinVincular: t > 0 ? Math.round((t - Number(r.value.linked_tickets)) * 1000 / t) / 10 : null, corte: iso(r.value.source_watermark), refreshedAt: iso(r.value.refreshed_at)};
}

export function createPainPointsRepository({database, now = () => new Date(), budgets = PAIN_BUDGETS_MS}) {
  return {
    async get({idioma = 'es'} = {}) {
      const hoy = now();
      return database.transaction('read', async s => {
        const dl = k => Date.now() + budgets[k];
        const tracker = listo(await guarded(s, dl('tracker'), 'pp_tracker', () => readTrackerRefundStatus(s, {timeoutMs: budgets.tracker})));
        const walmart = await guarded(s, dl('walmart'), 'pp_walmart', () => leerWalmartPendiente(s, {timeoutMs: budgets.walmart}));
        const reembolsos = listo(await guarded(s, dl('reembolsos'), 'pp_refunds', () => readRefundBySkuMonth(s, {top: 50, timeoutMs: budgets.reembolsos})));
        const ordenes = listo(await guarded(s, dl('ordenes'), 'pp_orders', () => readOrderRevenueMonth(s, {timeoutMs: budgets.ordenes})));
        const hilosR = listo(await guarded(s, dl('hilos'), 'pp_threads', () => readThreadResolution(s, {timeoutMs: budgets.hilos})));
        const repetido = await guarded(s, dl('repetido'), 'pp_repeat', () => leerRepetido(s, {timeoutMs: budgets.repetido}));
        const garantia = await guarded(s, dl('garantia'), 'pp_warranty', () => leerGarantia(s, {timeoutMs: budgets.garantia}));
        const o = hilosR?.overall ?? null, meses = hilosR?.months ?? [];
        const hilos = o ? {...o, periodo: meses.length ? {desde: meses[0].month, hasta: meses.at(-1).month} : null} : null;
        const puntos = armarPuntos({
          tracker: tracker && {data: tracker, meta: tracker.meta}, walmart, reembolsos: reembolsos && {rows: reembolsos.rows, meta: reembolsos.meta}, ordenes: ordenes && {rows: ordenes.rows, meta: ordenes.meta},
          hilos, hilosMeta: hilosR?.meta ?? null, repetido, garantia,
        }, idioma);
        const partes = {
          tracker: tracker ? 'ok' : 'unavailable', walmart: walmart ? 'ok' : 'unavailable', reembolsos: reembolsos ? 'ok' : 'unavailable', ordenes: ordenes ? 'ok' : 'unavailable',
          hilos: hilos ? 'ok' : 'unavailable', repetido: repetido === false ? 'not_computed' : repetido ? 'ok' : 'unavailable', garantia: garantia ? 'ok' : 'unavailable',
        };
        return {
          version: PAIN_VERSION, generatedAt: hoy.toISOString(), currency: 'USD', exponent: 2, tipoDinero: 'bruto', temas: temasDe(idioma), clases: CLASES,
          puntos: [...puntos].sort(ordenPuntos), partes,
          nota: idioma === 'en' ? 'Gross revenue, never margin. Points that share money (for example a SKU and its channel) are different cuts of the same refund: they are not added to each other.' : 'Ingreso bruto, nunca margen. Los puntos que comparten dinero (por ejemplo un SKU y su canal) son cortes distintos del mismo reembolso: no se suman entre sí.',
        };
      });
    },
  };
}
