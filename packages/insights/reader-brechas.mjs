// Lectura de los agregados de «Brechas de ingreso» (migración PROPUESTA 20261110000000_insight_gaps): SOLO SELECT sobre insight_*, bajo la RLS del usuario.
// Mismo contrato de honestidad que reader.mjs: 'unavailable' (sin tabla/permiso), 'absent' (nunca calculado), 'timeout'; JAMÁS un cero inferido.
import {load, rowsOf} from './reader.mjs';
import {attempt} from '../workspace-service/summaries.mjs';
const big = v => String(v ?? '0').split('.')[0];
const day = v => (v == null ? null : new Date(v).toISOString().slice(0, 10));

/** Ingreso bruto del libro por mes × canal × SKU base × moneda (todas las monedas; el llamador filtra, nunca se suman). */
export const readOrderRevenueMonth = (s, {timeoutMs} = {}) => load(s, 'order_revenue_month',
  `SELECT to_char(month,'YYYY-MM') AS month,channel,sku_base,currency,exponent,n,n_cancelled,n_review,amount_minor::text AS amount,amount_cancelled_minor::text AS cancelled,amount_review_minor::text AS review,first_day,last_day
   FROM public.insight_order_revenue_month WHERE tenant_id=$1 ORDER BY month,channel,sku_base,currency LIMIT 20000`, [s.tenantId],
  rows => ({rows: rows.map(r => ({month: r.month, channel: r.channel, sku: r.sku_base || null, currency: r.currency, exponent: Number(r.exponent), n: Number(r.n), nCancelled: Number(r.n_cancelled), nReview: Number(r.n_review),
    amountMinor: big(r.amount), cancelledMinor: big(r.cancelled), reviewMinor: big(r.review), firstDay: day(r.first_day), lastDay: day(r.last_day)}))}), timeoutMs ?? 3000);

/** Conversaciones por mes y familia (taxonomía v2). family '*' = analizadas; '+' = con alguna familia. */
export const readComplaintFamilyMonth = (s, {timeoutMs} = {}) => load(s, 'complaint_family_month',
  `SELECT to_char(month,'YYYY-MM') AS month,family,conversations FROM public.insight_complaint_family_month WHERE tenant_id=$1 ORDER BY month,family LIMIT 20000`, [s.tenantId],
  rows => ({rows: rows.map(r => ({month: r.month, family: r.family, n: Number(r.conversations)}))}), timeoutMs ?? 3000);

export const readFamilyPairs = (s, {timeoutMs} = {}) => load(s, 'complaint_family_month',
  `SELECT family_a,family_b,conversations FROM public.insight_family_pair WHERE tenant_id=$1 ORDER BY conversations DESC LIMIT 500`, [s.tenantId],
  rows => ({pairs: rows.map(r => ({a: r.family_a, b: r.family_b, n: Number(r.conversations)}))}), timeoutMs ?? 3000);

/**
 * Avance del análisis del histórico con la taxonomía v2: corridas v2 / (conversaciones cargadas - corridas ya hechas con la taxonomía anterior).
 * Son conteos baratos (extraction_runs ~10 mil filas hoy); si no responden a tiempo, 'unavailable' (nunca 0).
 */
export async function readAnalysisProgress(s, {timeoutMs = 2500} = {}) {
  const runs = await attempt(s, async () => (await s.query(
    `SELECT count(*)::bigint AS total, count(*) FILTER (WHERE provenance->>'taxonomy_version' LIKE 'v2%')::bigint AS v2,
            count(*) FILTER (WHERE provenance->>'taxonomy_version' LIKE 'v2%' AND jsonb_typeof(provenance->'product_families')='array')::bigint AS con_familias
     FROM public.extraction_runs WHERE tenant_id=$1`, [s.tenantId])).rows[0], timeoutMs);
  const vol = await rowsOf(s, `SELECT detail->>'total' AS total FROM public.insight_state WHERE tenant_id=$1 AND insight='conversation_volume'`, [s.tenantId], timeoutMs);
  if (runs.timeout || runs.unavailable || !runs.value || !vol.rows) return {availability: 'unavailable'};
  const total = Number(vol.rows[0]?.total ?? NaN), hechasAntes = Number(runs.value.total) - Number(runs.value.v2), v2 = Number(runs.value.v2);
  const objetivo = Number.isFinite(total) ? Math.max(0, total - hechasAntes) : null;
  return {availability: 'ready', v2, conFamilias: Number(runs.value.con_familias), corridasTotales: Number(runs.value.total), conversacionesCargadas: Number.isFinite(total) ? total : null, objetivo,
    avancePct: objetivo ? Math.min(100, Math.round((v2 * 1000) / objetivo) / 10) : null};
}
