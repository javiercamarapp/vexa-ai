// LECTURA RÁPIDA de insights precalculados: SOLO SELECT sobre insight_* / source_sync_state (decenas a pocos miles de filas), sin agregar en vivo contra las tablas grandes.
// Corre BAJO la sesión y RLS del usuario (initplan vexa_member), de solo lectura. Honestidad: sin migración o sin permiso => 'unavailable'; sin fila de estado => 'absent'
// (el llamador usa su camino anterior); JAMÁS se infiere un cero. Cada respuesta lleva su marca de frescura (refreshedAt, sourceWatermark, partial).
import {createHash} from 'node:crypto';
import {attempt} from '../workspace-service/summaries.mjs';
export const INSIGHT_TIMEOUT_MS = 1500;
export const INSIGHTS = Object.freeze(['conversation_volume', 'refund_by_sku_month', 'thread_resolution', 'tracker_refund_status', 'repeat_contact']);
const iso = v => (v == null ? null : new Date(v).toISOString());
const age = (v, now) => (v == null ? null : Math.max(0, Math.round((now - new Date(v).getTime()) / 1000)));
export const meta = (st, now = Date.now()) => ({source: 'insight', status: st.status, refreshedAt: iso(st.refreshed_at), sourceWatermark: iso(st.source_watermark), ageSeconds: age(st.refreshed_at, now), partial: st.status === 'partial', computedFrom: st.computed_from ?? {}});

async function state(s, insight, timeoutMs) {
  const r = await attempt(s, async () => (await s.query('SELECT * FROM public.insight_state WHERE tenant_id=$1 AND insight=$2', [s.tenantId, insight])).rows[0] ?? null, timeoutMs);
  if (r.timeout) return {availability: 'timeout'};
  if (r.unavailable) return {availability: 'unavailable'};
  if (!r.value || r.value.status === 'failed' || r.value.status === 'skipped') return {availability: 'absent', state: r.value};
  return {availability: 'ready', state: r.value};
}
export async function rowsOf(s, sql, args, timeoutMs) {
  const r = await attempt(s, async () => (await s.query(sql, args)).rows, timeoutMs);
  return r.timeout ? {availability: 'timeout'} : r.unavailable ? {availability: 'unavailable'} : {rows: r.value};
}
export async function load(s, insight, sql, args, shape, timeoutMs = INSIGHT_TIMEOUT_MS) {
  const st = await state(s, insight, timeoutMs);
  if (st.availability !== 'ready') return {availability: st.availability, insight, meta: null};
  const rows = await rowsOf(s, sql, args, timeoutMs);
  if (!rows.rows) return {availability: rows.availability, insight, meta: null};
  return {availability: st.state.status === 'partial' ? 'partial' : 'ready', insight, meta: meta(st.state), ...shape(rows.rows, st.state)};
}
const big = v => String(v ?? '0').split('.')[0];

export const readConversationVolume = (s, {grain = 'month', timeoutMs} = {}) => {
  if (!['week', 'month'].includes(grain)) throw Object.assign(Error('insight_input_invalid'), {code: 'insight_input_invalid', status: 400});
  return load(s, 'conversation_volume', `SELECT to_char(period,'YYYY-MM-DD') AS period,n FROM public.insight_conversation_volume WHERE tenant_id=$1 AND grain=$2 ORDER BY period LIMIT 2000`, [s.tenantId, grain],
    (rows, st) => ({grain, points: rows.map(r => ({period: grain === 'month' ? r.period.slice(0, 7) : r.period, n: Number(r.n)})), undated: Number(st.detail?.undated ?? 0), total: Number(st.detail?.total ?? 0)}), timeoutMs);
};
/** Reembolsos del libro: filas por mes×canal×SKU×moneda (acotadas) + resumen por moneda y Top-N de SKUs de la moneda pedida. Nunca suma monedas. */
export const readRefundBySkuMonth = (s, {from = null, to = null, currency = 'USD', top = 10, timeoutMs} = {}) => {
  if (!/^[A-Z]{3}$/.test(currency) || !Number.isInteger(top) || top < 1 || top > 50 || [from, to].some(x => x !== null && !/^\d{4}-\d{2}-\d{2}$/.test(x))) throw Object.assign(Error('insight_input_invalid'), {code: 'insight_input_invalid', status: 400});
  return load(s, 'refund_by_sku_month',
    `SELECT to_char(month,'YYYY-MM') AS month,channel,sku_base,currency,exponent,n,n_known,n_cancelled,amount_minor::text AS amount,amount_active_minor::text AS active
     FROM public.insight_refund_by_sku_month WHERE tenant_id=$1 AND ($2::date IS NULL OR month>=$2::date) AND ($3::date IS NULL OR month<$3::date) ORDER BY month,channel,sku_base,currency LIMIT 5000`, [s.tenantId, from, to],
    rows => {
      const per = new Map(), sku = new Map();
      for (const r of rows) {
        const c = per.get(r.currency) ?? {currency: r.currency, exponent: Number(r.exponent), n: 0, nKnown: 0, nCancelled: 0, gross: 0n, active: 0n}; c.n += Number(r.n); c.nKnown += Number(r.n_known); c.nCancelled += Number(r.n_cancelled); c.gross += BigInt(big(r.amount)); c.active += BigInt(big(r.active)); per.set(r.currency, c);
        if (r.currency === currency && r.sku_base) { const k = r.sku_base, o = sku.get(k) ?? {sku: k, n: 0, gross: 0n, active: 0n, channels: {}}; o.n += Number(r.n); o.gross += BigInt(big(r.amount)); o.active += BigInt(big(r.active)); o.channels[r.channel] = (o.channels[r.channel] ?? 0) + Number(r.n); sku.set(k, o); }
      }
      const cur = per.get(currency), topSkus = [...sku.values()].sort((a, b) => (b.gross > a.gross ? 1 : b.gross < a.gross ? -1 : a.sku.localeCompare(b.sku))).slice(0, top);
      const topGross = topSkus.reduce((a, x) => a + x.gross, 0n);
      return {
        rows: rows.map(r => ({month: r.month, channel: r.channel, sku: r.sku_base || null, currency: r.currency, exponent: Number(r.exponent), n: Number(r.n), nKnown: Number(r.n_known), nCancelled: Number(r.n_cancelled), amountMinor: big(r.amount), activeMinor: big(r.active)})),
        currencies: [...per.values()].map(c => ({...c, gross: c.gross.toString(), active: c.active.toString()})),
        top: {currency, skus: topSkus.map(x => ({...x, gross: x.gross.toString(), active: x.active.toString()})), sharePercent: cur && cur.gross > 0n ? Number((topGross * 1000n) / cur.gross) / 10 : null},
      };
    }, timeoutMs);
};
export const readThreadResolution = (s, {timeoutMs} = {}) => load(s, 'thread_resolution',
  `SELECT grain,to_char(period,'YYYY-MM-DD') AS period,threads,closed,reopened_threads,close_p50_hours,close_p90_hours,closed_lt_1h,closed_gt_7d,status_events FROM public.insight_thread_resolution WHERE tenant_id=$1 ORDER BY grain,period LIMIT 500`, [s.tenantId],
  rows => {
    const f = r => ({threads: Number(r.threads), closed: Number(r.closed), reopenedThreads: Number(r.reopened_threads), closeP50Hours: r.close_p50_hours == null ? null : Number(r.close_p50_hours), closeP90Hours: r.close_p90_hours == null ? null : Number(r.close_p90_hours), closedUnder1h: Number(r.closed_lt_1h), closedOver7d: Number(r.closed_gt_7d), statusEvents: Number(r.status_events)});
    const all = rows.find(r => r.grain === 'all'), overall = all ? f(all) : null;
    return {overall: overall && {...overall, reopenedPercent: overall.threads ? Math.round((overall.reopenedThreads * 1000) / overall.threads) / 10 : null}, months: rows.filter(r => r.grain === 'month').map(r => ({month: r.period.slice(0, 7), ...f(r)}))};
  }, timeoutMs);
export const readTrackerRefundStatus = (s, {timeoutMs} = {}) => load(s, 'tracker_refund_status',
  `SELECT status_class,reason_class,retailer_class,n,n_amount,amount_minor::text AS amount,assumed_currency FROM public.insight_tracker_refund_status WHERE tenant_id=$1 ORDER BY status_class,reason_class,retailer_class LIMIT 500`, [s.tenantId],
  rows => {
    const byStatus = {}; let total = 0;
    for (const r of rows) { const o = (byStatus[r.status_class] ??= {n: 0, nAmount: 0, amountMinor: 0n}); o.n += Number(r.n); o.nAmount += Number(r.n_amount); o.amountMinor += BigInt(big(r.amount)); total += Number(r.n); }
    return {total, assumedCurrency: rows[0]?.assumed_currency ?? 'USD', byStatus: Object.fromEntries(Object.entries(byStatus).map(([k, v]) => [k, {...v, amountMinor: v.amountMinor.toString()}])),
      rows: rows.map(r => ({status: r.status_class, reason: r.reason_class, retailer: r.retailer_class, n: Number(r.n), nAmount: Number(r.n_amount), amountMinor: big(r.amount)}))};
  }, timeoutMs);

/** Marca de frescura por fuente + por insight, y una `version` corta: cambia solo si algún corte/estado cambió (el navegador la compara sin descargar datos). */
export async function readFreshness(s, {now = Date.now(), timeoutMs = INSIGHT_TIMEOUT_MS} = {}) {
  const src = await rowsOf(s, 'SELECT * FROM public.source_sync_state WHERE tenant_id=$1 ORDER BY source_key LIMIT 200', [s.tenantId], timeoutMs);
  const ins = await rowsOf(s, 'SELECT insight,status,refreshed_at,source_watermark,source_rows,duration_ms,cursor,error_code FROM public.insight_state WHERE tenant_id=$1 ORDER BY insight LIMIT 50', [s.tenantId], timeoutMs);
  if (!src.rows && !ins.rows) return {availability: src.availability ?? ins.availability, sources: [], insights: [], version: null};
  const sources = (src.rows ?? []).map(r => {
    const every = r.expected_every_seconds, last = r.last_success_at ? new Date(r.last_success_at).getTime() : null;
    const stale = r.status === 'paused' ? false : every && last != null ? now - last > every * 2000 : last == null;
    return {key: r.source_key, method: r.method, status: r.status, lastAttemptAt: iso(r.last_attempt_at), lastSuccessAt: iso(r.last_success_at), ageSeconds: age(r.last_success_at, now), lastNewRecords: r.last_new_records == null ? null : Number(r.last_new_records),
      errorCode: r.last_error_code, latencyMs: r.last_latency_ms, nextRunAt: iso(r.next_run_at), expectedEverySeconds: every, dataWatermark: iso(r.data_watermark), stale: Boolean(stale)};
  });
  const insights = (ins.rows ?? []).map(r => ({insight: r.insight, status: r.status, refreshedAt: iso(r.refreshed_at), sourceWatermark: iso(r.source_watermark), ageSeconds: age(r.refreshed_at, now), rows: Number(r.source_rows), durationMs: r.duration_ms, pending: r.cursor?.months?.length ?? 0, errorCode: r.error_code}));
  const version = createHash('sha256').update(JSON.stringify([sources.map(x => [x.key, x.status, x.lastSuccessAt, x.dataWatermark]), insights.map(x => [x.insight, x.status, x.refreshedAt, x.sourceWatermark])])).digest('hex').slice(0, 16);
  return {availability: 'ready', sources, insights, version};
}
export function createInsightsReader({database}) {
  const run = fn => database.transaction('read', fn);
  return Object.freeze({
    conversationVolume: o => run(s => readConversationVolume(s, o)), refundBySkuMonth: o => run(s => readRefundBySkuMonth(s, o)),
    threadResolution: o => run(s => readThreadResolution(s, o)), trackerRefundStatus: o => run(s => readTrackerRefundStatus(s, o)), freshness: o => run(s => readFreshness(s, o)),
    async all(o = {}) { return run(async s => ({conversations: await readConversationVolume(s, {grain: 'month'}), refunds: await readRefundBySkuMonth(s, o), threads: await readThreadResolution(s), tracker: await readTrackerRefundStatus(s)})); },
  });
}
