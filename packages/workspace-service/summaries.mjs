// Lectura de los RESÚMENES PRECOMPUTADOS (migración 20261022000000): tablas economic_ledger_monthly, economic_ledger_counts, conversation_monthly y association_counts,
// con summary_refresh_state. Corre BAJO la sesión y RLS del usuario (nunca rol de servicio) y es de solo lectura; el refresco lo hace un operador (public.refresh_*).
// Reglas de honestidad:
//  - sin tablas (migración sin aplicar), sin permiso o sin fila de estado => 'absent'/'unavailable': el llamador usa su camino anterior; JAMÁS se infiere un cero.
//  - 'ready' + frescura 'fresh'  => el resumen coincide con el libro actual (ningún asiento posterior al corte): se puede rotular «Observado» con su fecha de corte.
//  - 'ready' + frescura 'stale'  => hay registros posteriores al corte: se muestra «Resumen al <fecha>» y NUNCA como exacto.
//  - 'ready' + frescura 'unknown'=> no se pudo comprobar (tiempo agotado): igual que 'stale', con otra frase.
//  - 'partial' => faltan meses de la ventana: no se mezclan con ceros; el llamador cae a su camino anterior.
export const SUMMARY_TIMEOUT_MS = 1500;
const ZERO_SCOPE = '0001-01-01';
const ts = v => (v == null ? null : new Date(v).toISOString());
const day = v => (v == null ? null : new Date(v).toISOString().slice(0, 10));
const TXT = 'YYYY-MM-DD HH24:MI:SS.US'; // microsegundos: Date de JS los trunca a ms y confundiría «posterior» con «igual»

/** Ejecuta `work` con tope de tiempo y SAVEPOINT. 57014 => {timeout}; tabla/permiso ausentes => {unavailable}; cualquier otro error se propaga. */
export async function attempt(s, work, timeoutMs = SUMMARY_TIMEOUT_MS) {
  const previous = (await s.query("SELECT current_setting('statement_timeout') AS v")).rows[0].v; // se restaura: el tope de esta lectura no debe filtrarse a las siguientes sentencias
  await s.query("SELECT set_config('statement_timeout',$1,true)", [String(timeoutMs)]);
  await s.query('SAVEPOINT summary_read');
  try {
    const value = await work(); await s.query('RELEASE SAVEPOINT summary_read'); return {value};
  } catch (e) {
    if (e?.code === '57014' || e?.code === '42P01' || e?.code === '42501') { await s.query('ROLLBACK TO SAVEPOINT summary_read'); return e.code === '57014' ? {timeout: true} : {unavailable: true}; }
    throw e;
  } finally { await s.query("SELECT set_config('statement_timeout',$1,true)", [previous]).catch(() => {}); }
}

/** Estado + obsolescencia de un resumen. `current` es una expresión SQL escalar (con $1 = tenant) del último corte del origen; `count` opcional del conteo del origen. */
async function readState(s, {summary, from = ZERO_SCOPE, to = '9999-12-01', current, count = null, timeoutMs}) {
  const st = await attempt(s, async () => (await s.query(
    `SELECT to_char(scope_month,'YYYY-MM') AS month,refreshed_at,to_char(source_watermark AT TIME ZONE 'UTC','${TXT}') AS wm,source_watermark,source_count,source_rows,detail
     FROM public.summary_refresh_state WHERE tenant_id=$1 AND summary=$2 AND scope_month>=$3::date AND scope_month<$4::date ORDER BY scope_month`, [s.tenantId, summary, from, to])).rows, timeoutMs);
  if (st.timeout) return {availability: 'timeout'};
  if (st.unavailable) return {availability: 'unavailable'};
  const states = st.value;
  if (!states.length) return {availability: 'absent', states};
  // Corte actual del origen (una lectura de índice) y, si el resumen lo guarda, el conteo del origen.
  const cur = await attempt(s, async () => (await s.query(
    `SELECT to_char(${current} AT TIME ZONE 'UTC','${TXT}') AS wm${count ? `,${count} AS n` : ''}`, [s.tenantId])).rows[0], timeoutMs);
  let freshness = 'unknown', currentWatermark = null;
  if (cur.value) {
    currentWatermark = cur.value.wm;
    const newer = states.some(r => (cur.value.wm !== null && (r.wm === null || cur.value.wm > r.wm)));
    const changed = count ? states.some(r => r.source_count !== null && String(r.source_count) !== String(cur.value.n)) : false;
    freshness = newer || changed ? 'stale' : 'fresh';
  }
  const refreshedAt = states.map(r => new Date(r.refreshed_at).getTime()).reduce((a, b) => Math.min(a, b));
  const cutoffs = states.map(r => r.source_watermark).filter(Boolean).map(v => new Date(v).getTime());
  return {availability: 'ready', states, freshness, refreshedAt: new Date(refreshedAt).toISOString(), cutoff: cutoffs.length ? new Date(Math.min(...cutoffs)).toISOString() : null};
}

/** Texto para la pantalla (es-MX), siempre con la fecha del resumen. */
export function summaryLabel({freshness, refreshedAt, cutoff}) {
  const when = day(refreshedAt);
  if (freshness === 'fresh') return `Observado · resumen al ${when}${cutoff ? ` (corte del libro ${day(cutoff)})` : ''}; no hay registros posteriores.`;
  if (freshness === 'stale') return `Resumen al ${when}: el origen tiene registros posteriores. Las cifras pueden estar desactualizadas hasta el próximo refresco.`;
  return `Resumen al ${when}: no se pudo comprobar si hay registros posteriores. No se presenta como exacto.`;
}
export const summaryMeta = (r, source = 'summary') => r.availability === 'ready'
  ? {source, freshness: r.freshness, refreshedAt: r.refreshedAt, cutoff: r.cutoff, label: summaryLabel(r)}
  : {source: 'direct', freshness: r.availability, refreshedAt: null, cutoff: null, label: null};

const LEDGER_NOW = '(SELECT max(recorded_at) FROM public.economic_ledger_entries WHERE tenant_id=$1)';
const LEDGER_COUNT = '(SELECT count(*) FROM public.economic_ledger_entries WHERE tenant_id=$1)';

/** Meses de la ventana + filas. 'ready' solo si CADA mes de la ventana tiene estado; si faltan: 'partial' (con la lista) y sin filas. */
export async function readLedgerMonthly(s, win, {timeoutMs = SUMMARY_TIMEOUT_MS} = {}) {
  const from = win.start.toISOString().slice(0, 10), to = win.end.toISOString().slice(0, 10);
  const r = await readState(s, {summary: 'ledger_monthly', from, to, current: LEDGER_NOW, count: LEDGER_COUNT, timeoutMs});
  if (r.availability !== 'ready') return {...r, rows: []};
  const have = new Set(r.states.map(x => x.month)), missing = win.list.filter(m => !have.has(m));
  if (missing.length) return {availability: 'partial', missingMonths: missing, refreshedMonths: [...have], rows: []};
  const rows = await attempt(s, async () => (await s.query(
    `SELECT to_char(month,'YYYY-MM') AS month,source_id,kind,status,currency,exponent,basis,n,known,amount_minor::text AS amount FROM public.economic_ledger_monthly
     WHERE tenant_id=$1 AND month>=$2::date AND month<$3::date ORDER BY 1,2,3,4,5,6,7 LIMIT 5000`, [s.tenantId, from, to])).rows, timeoutMs);
  if (rows.timeout) return {availability: 'timeout', rows: []};
  if (rows.unavailable) return {availability: 'unavailable', rows: []};
  return {...r, missingMonths: [], rows: rows.value};
}

/** Conversaciones por mes (todas las fechas) + sin fecha. */
export async function readConversationMonthly(s, {timeoutMs = SUMMARY_TIMEOUT_MS} = {}) {
  const r = await readState(s, {summary: 'conversation_monthly', current: `greatest((SELECT max(created_at) FROM public.conversations WHERE tenant_id=$1),(SELECT max(created_at) FROM public.messages WHERE tenant_id=$1))`, timeoutMs});
  if (r.availability !== 'ready') return {...r, months: []};
  const rows = await attempt(s, async () => (await s.query(`SELECT to_char(month,'YYYY-MM') AS month,n FROM public.conversation_monthly WHERE tenant_id=$1 ORDER BY month LIMIT 2000`, [s.tenantId])).rows, timeoutMs);
  if (rows.timeout) return {availability: 'timeout', months: []};
  if (rows.unavailable) return {availability: 'unavailable', months: []};
  const d = r.states[0].detail ?? {};
  return {...r, months: rows.value.map(x => ({month: x.month, n: Number(x.n)})), undated: Number(d.undated ?? 0), total: Number(d.total ?? 0)};
}

/** Conteos del libro por fuente·moneda·tipo (cobertura). */
export async function readLedgerCounts(s, {timeoutMs = SUMMARY_TIMEOUT_MS} = {}) {
  const r = await readState(s, {summary: 'ledger_counts', current: LEDGER_NOW, count: LEDGER_COUNT, timeoutMs});
  if (r.availability !== 'ready') return {...r, groups: []};
  const rows = await attempt(s, async () => (await s.query(`SELECT source_id,currency,kind,entities,revisions FROM public.economic_ledger_counts WHERE tenant_id=$1 ORDER BY 1,2,3 LIMIT 500`, [s.tenantId])).rows, timeoutMs);
  if (rows.timeout) return {availability: 'timeout', groups: []};
  if (rows.unavailable) return {availability: 'unavailable', groups: []};
  return {...r, groups: rows.value.map(x => ({sourceId: x.source_id, currency: x.currency, kind: x.kind, entities: Number(x.entities), revisions: Number(x.revisions)}))};
}

/** Hechos por estado y vínculos activos de las asociaciones HubSpot. */
export async function readAssociationCounts(s, {timeoutMs = SUMMARY_TIMEOUT_MS} = {}) {
  const current = `greatest((SELECT max(updated_at) FROM public.native_customer_associations WHERE tenant_id=$1),(SELECT max(created_at) FROM public.conversation_customer_association_bindings WHERE tenant_id=$1),(SELECT max(deactivated_at) FROM public.conversation_customer_association_bindings WHERE tenant_id=$1 AND deactivated_at IS NOT NULL))`;
  const r = await readState(s, {summary: 'association_counts', current, timeoutMs});
  if (r.availability !== 'ready') return {...r, counts: {}};
  const rows = await attempt(s, async () => (await s.query(`SELECT metric,n FROM public.association_counts WHERE tenant_id=$1`, [s.tenantId])).rows, timeoutMs);
  if (rows.timeout) return {availability: 'timeout', counts: {}};
  if (rows.unavailable) return {availability: 'unavailable', counts: {}};
  return {...r, counts: Object.fromEntries(rows.value.map(x => [x.metric, Number(x.n)]))};
}
