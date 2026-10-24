// Consultas de SOLO LECTURA del puerto real del agente (port.mjs). Cada una corre en la transacción de lectura del tenant (RLS del usuario),
// con SAVEPOINT y tope de tiempo local; si se agota responde con error 57014 (el agente dice «no pudo completarse», jamás «0» ni «no tengo»).
// Reglas: ingreso BRUTO (nunca margen); monedas separadas (jamás se suman); importe desconocido ≠ 0 (se cuenta aparte); sin texto de clientes ni PII.
import { monthWindow } from '../workspace-service/trends.mjs';
import { readLedgerMonthly } from '../workspace-service/summaries.mjs';
import { readConversationVolume } from '../insights/reader.mjs';
import { NOMBRE_CANAL, canalDeFuente } from '../workspace-service/fuga-reembolsos.mjs';

export const BUDGETS_MS = Object.freeze({ ledger: 4500, problems: 6000, categories: 5000, volume: 1500, links: 1500 });
export const HISTORY_MONTHS = 24;
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

const timeoutError = (name) => Object.assign(new Error(`port_timeout:${name}`), { code: '57014' });
/** Corre `work` bajo SAVEPOINT con statement_timeout local. 57014 -> lanza error 57014; cualquier otro error se restaura y se propaga (no se disfraza de «sin datos»). */
export async function bounded(s, name, ms, work) {
  const previous = (await s.query("SELECT current_setting('statement_timeout') AS v")).rows[0]?.v ?? '0';
  await s.query('SAVEPOINT ' + name);
  await s.query("SELECT set_config('statement_timeout',$1,true)", [String(ms)]);
  try {
    const value = await work();
    await s.query('RELEASE SAVEPOINT ' + name);
    return value;
  } catch (e) {
    await s.query('ROLLBACK TO SAVEPOINT ' + name);
    await s.query('RELEASE SAVEPOINT ' + name);
    if (e?.code === '57014') throw timeoutError(name);
    throw e;
  } finally { await s.query("SELECT set_config('statement_timeout',$1,true)", [previous]).catch(() => {}); }
}

/** Ventana de meses terminada en el mes en curso (inclusive). `month` fija un solo mes. */
export function windowFor(now, { month = null, months = 12 } = {}) {
  if (month) {
    if (!MONTH.test(month)) throw Object.assign(new Error('port_input_invalid'), { code: 'port_input_invalid' });
    const start = new Date(`${month}-01T00:00:00Z`), end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
    return { start, end, list: [month] };
  }
  return monthWindow(now, months);
}

// ---------------------------------------------------------------- libro por fuente
const SOURCE_NAMES_SQL = 'SELECT DISTINCT ON (source_id) source_id::text AS source_id, name FROM public.economic_source_versions WHERE tenant_id=$1 ORDER BY source_id, version DESC LIMIT 500';
const LEDGER_LIVE_SQL = `SELECT e.source_id::text AS source_id, e.status, e.basis, e.currency, e.exponent::int AS exponent, count(*)::int AS n, count(e.amount_minor)::int AS known, coalesce(sum(e.amount_minor),0)::text AS amount
  FROM public.economic_ledger_entries e
  WHERE e.tenant_id=$1 AND e.kind=$2 AND e.effective_at>=$3 AND e.effective_at<$4
    AND NOT EXISTS (SELECT 1 FROM public.economic_ledger_entries l2 WHERE l2.tenant_id=e.tenant_id AND l2.entity_id=e.entity_id AND l2.revision>e.revision)
  GROUP BY 1,2,3,4,5 LIMIT 2000`;
const big = (v) => BigInt(String(v ?? '0').split('.')[0] || '0');

/**
 * Filas del libro (por fuente·estado·base·moneda) -> filas por canal y moneda con la forma que consume tools.mjs.
 *  - pedidos: solo estado «registrado» y sin filas «a revisar» (misma regla de /cfo y Tendencias, por fuente);
 *  - reembolsos: TODOS los estados (bruto, como «Fuga de reembolsos»); se separan los liquidados y los cancelados para no llamar «liquidado» a lo que no lo es.
 * Importes sin monto se cuentan aparte (unknown); nunca se suman monedas.
 */
export function shapeLedgerRows(rows, names, kind) {
  const by = new Map();
  for (const r of rows) {
    const review = String(r.basis ?? '').includes('a_revisar');
    if (kind === 'order' && (r.status !== 'recorded' || review)) continue;
    const channel = canalDeFuente(names.get(String(r.source_id)) ?? '');
    const k = channel + ':' + r.currency + ':' + r.exponent;
    const o = by.get(k) ?? { source: channel, sourceLabel: NOMBRE_CANAL[channel] ?? 'Otro', currency: r.currency, exponent: Number(r.exponent), count: 0, amountMinor: 0n, unknown: 0, settledCount: 0, settledAmountMinor: 0n, cancelledCount: 0, cancelledAmountMinor: 0n };
    const n = Number(r.n), amount = big(r.amount ?? r.amount_minor);
    o.count += n; o.amountMinor += amount; o.unknown += n - Number(r.known);
    if (r.status === 'settled') { o.settledCount += n; o.settledAmountMinor += amount; }
    if (r.status === 'cancelled') { o.cancelledCount += n; o.cancelledAmountMinor += amount; }
    by.set(k, o);
  }
  return [...by.values()].filter((o) => o.count > 0).map((o) => {
    const base = { source: o.source, sourceLabel: o.sourceLabel, currency: o.currency, exponent: o.exponent, count: o.count, amountMinor: String(o.amountMinor), unknown: o.unknown };
    return kind === 'refund' ? { ...base, settledCount: o.settledCount, settledAmountMinor: String(o.settledAmountMinor), cancelledCount: o.cancelledCount, cancelledAmountMinor: String(o.cancelledAmountMinor) } : base;
  }).sort((a, b) => a.sourceLabel.localeCompare(b.sourceLabel, 'es') || a.currency.localeCompare(b.currency));
}

export async function readLedgerBySource(s, { kind, month = null, months = 12, now }) {
  if (kind !== 'order' && kind !== 'refund') throw Object.assign(new Error('port_input_invalid'), { code: 'port_input_invalid' });
  const win = windowFor(now, { month, months });
  const names = new Map((await bounded(s, 'agent_src', 1500, async () => (await s.query(SOURCE_NAMES_SQL, [s.tenantId])).rows)).map((r) => [r.source_id, r.name]));
  // Camino rápido: resumen precomputado del libro (<200 ms). Solo si cubre CADA mes de la ventana; un resumen atrasado se rotula, nunca se presenta como exacto.
  const sum = await readLedgerMonthly(s, win).catch(() => ({ availability: 'unavailable', rows: [] }));
  let raw, note = null;
  if (sum.availability === 'ready') {
    raw = sum.rows.filter((r) => r.kind === kind);
    if (sum.freshness !== 'fresh') note = `Resumen del libro al ${String(sum.refreshedAt).slice(0, 10)}: el libro tiene registros posteriores que aún no entran en esta cifra.`;
  } else {
    raw = await bounded(s, 'agent_ledger', BUDGETS_MS.ledger, async () => (await s.query(LEDGER_LIVE_SQL, [s.tenantId, kind, win.start.toISOString(), win.end.toISOString()])).rows);
  }
  const rows = shapeLedgerRows(raw, names, kind);
  return { status: rows.length ? 'ok' : 'empty', kind, months: win.list, basis: kind === 'refund' ? 'all_statuses' : 'recorded', ...(note ? { note } : {}), rows };
}

// ---------------------------------------------------------------- problemas (catálogo vigente) e incidencias por mes
const LATEST = `latest AS (SELECT DISTINCT ON (problem_id) problem_id, provenance->'snapshot' AS snap FROM public.problem_versions
   WHERE tenant_id=$1 AND provenance->>'kind'='vector-problem-v1' ORDER BY problem_id, version DESC)`;
/** Un renglón por etiqueta (varios grupos del catálogo comparten etiqueta): problemId = el grupo más grande. */
export const PROBLEMS_SQL = `WITH ${LATEST}
  SELECT snap->>'label' AS label, (array_agg(problem_id ORDER BY jsonb_array_length(snap->'conversationIds') DESC, problem_id))[1]::text AS problem_id, count(*)::int AS groups
  FROM latest WHERE snap->>'state'='active' AND coalesce(snap->>'label','')<>'' GROUP BY 1 ORDER BY 1 LIMIT 500`;
/** Conversaciones DISTINTAS por etiqueta y mes (y total del mes). La fecha de la conversación es started_at o su primer mensaje, resuelta una vez por conversación. */
export const PROBLEM_MONTHLY_SQL = `WITH ${LATEST},
  act AS (SELECT DISTINCT snap->>'label' AS label, jsonb_array_elements_text(snap->'conversationIds')::uuid AS cid FROM latest WHERE snap->>'state'='active' AND coalesce(snap->>'label','')<>''),
  dated AS (SELECT a.label, a.cid, coalesce(c.started_at, fm.first_at) AS d FROM act a
    JOIN public.conversations c ON c.tenant_id=$1 AND c.id=a.cid AND c.deleted_at IS NULL
    LEFT JOIN LATERAL (SELECT min(m.occurred_at) AS first_at FROM public.messages m WHERE m.tenant_id=$1 AND m.conversation_id=c.id AND m.deleted_at IS NULL) fm ON c.started_at IS NULL)
  SELECT label, month, CASE WHEN grouping(label)=1 THEN count(DISTINCT cid) ELSE count(*) END::int AS n, grouping(label)::int AS is_total
  FROM (SELECT label, cid, to_char(d AT TIME ZONE 'UTC','YYYY-MM') AS month FROM dated WHERE d>=$2 AND d<$3) x
  GROUP BY GROUPING SETS ((label, month),(month)) LIMIT 20000`;
/** Incidencias por familia de categoría (prefijo antes de «:») y mes: filas de issues, y conversaciones distintas con alguna incidencia. */
export const CATEGORY_MONTHLY_SQL = `WITH iss AS (SELECT r.conversation_id, split_part(i.category, ':', 1) AS fam, count(*) AS n FROM public.issues i
    JOIN public.extraction_runs r ON r.tenant_id=i.tenant_id AND r.id=i.extraction_run_id WHERE i.tenant_id=$1 AND coalesce(i.category,'')<>'' GROUP BY 1,2),
  dated AS (SELECT s.conversation_id, s.fam, s.n, coalesce(c.started_at, fm.first_at) AS d FROM iss s
    JOIN public.conversations c ON c.tenant_id=$1 AND c.id=s.conversation_id AND c.deleted_at IS NULL
    LEFT JOIN LATERAL (SELECT min(m.occurred_at) AS first_at FROM public.messages m WHERE m.tenant_id=$1 AND m.conversation_id=c.id AND m.deleted_at IS NULL) fm ON c.started_at IS NULL)
  SELECT fam, month, sum(n)::int AS n, count(DISTINCT conversation_id)::int AS convs, grouping(fam)::int AS is_total
  FROM (SELECT fam, n, conversation_id, to_char(d AT TIME ZONE 'UTC','YYYY-MM') AS month FROM dated WHERE d>=$2 AND d<$3) x
  GROUP BY GROUPING SETS ((fam, month),(month)) LIMIT 5000`;

const CATEGORIA_ES = Object.freeze({ Warranty: 'Garantía', Order: 'Pedido', Shipping: 'Envío', Return: 'Devolución', Subscription: 'Suscripción', Feedback: 'Opiniones', 'Pre-sale': 'Preventa', Dealers: 'Distribuidores', Other: 'Otros' });
export const categoriaEs = (fam) => CATEGORIA_ES[String(fam).trim()] ?? (String(fam).trim() || 'Sin categoría');

/** Conversaciones por mes de insight_conversation_volume (denominador de cobertura). Mapa mes -> n; null si no se pudo leer. */
export async function readVolumeByMonth(s) {
  const v = await readConversationVolume(s, { grain: 'month', timeoutMs: BUDGETS_MS.volume });
  return v?.availability === 'ready' || v?.availability === 'partial' ? new Map(v.points.map((p) => [p.period, p.n])) : null;
}

export const windowHistory = (now) => monthWindow(now, HISTORY_MONTHS);

export async function readProblems(s) {
  const rows = await bounded(s, 'agent_problems', 3000, async () => (await s.query(PROBLEMS_SQL, [s.tenantId])).rows);
  return { status: rows.length ? 'ok' : 'empty', rows: rows.map((r) => ({ problemId: r.problem_id, title: r.label, category: categoriaEs(String(r.label).split(':')[0]) })) };
}

/** Lectura única (24 meses) de incidencias por problema·mes. Se memoiza en el puerto: problemIncidents(a) y (b) comparten el costo. */
export async function readProblemMonthly(s, now) {
  const win = windowHistory(now);
  const catalog = await readProblems(s);
  const raw = await bounded(s, 'agent_incid', BUDGETS_MS.problems, async () => (await s.query(PROBLEM_MONTHLY_SQL, [s.tenantId, win.start.toISOString(), win.end.toISOString()])).rows);
  const volume = await readVolumeByMonth(s).catch(() => null);
  return shapeProblemMonthly({ catalog: catalog.rows, raw, volume, months: win.list });
}
export function shapeProblemMonthly({ catalog, raw, volume, months }) {
  const idOf = new Map(catalog.map((p) => [p.title, p]));
  const byMonth = new Map(months.map((m) => [m, { classified: 0, rows: [] }]));
  for (const r of raw) {
    const slot = byMonth.get(r.month); if (!slot) continue;
    if (Number(r.is_total) === 1) { slot.classified = Number(r.n); continue; }
    const p = idOf.get(r.label); if (!p) continue;
    slot.rows.push({ problemId: p.problemId, title: p.title, incidents: Number(r.n), customers: null });
  }
  return { months, byMonth, volume, catalog };
}
export function problemIncidentsFor(data, month) {
  const slot = data.byMonth.get(month);
  if (!slot) return { status: 'empty', month, rows: [] };
  const eligible = data.volume?.get(month) ?? null;
  // classified (conversaciones con algún problema) no puede exceder las del mes: si el denominador falta, la cobertura queda sin base conocida.
  const classified = slot.classified, base = eligible !== null && eligible >= classified ? eligible : classified;
  return { status: slot.rows.length ? 'ok' : 'empty', month, classified, eligible: base, rows: [...slot.rows].sort((a, b) => b.incidents - a.incidents || a.title.localeCompare(b.title, 'es')) };
}

export async function readCategoryMonthly(s, now, { months = 6 } = {}) {
  const win = windowHistory(now);
  const raw = await bounded(s, 'agent_cat', BUDGETS_MS.categories, async () => (await s.query(CATEGORY_MONTHLY_SQL, [s.tenantId, win.start.toISOString(), win.end.toISOString()])).rows);
  const volume = await readVolumeByMonth(s).catch(() => null);
  return shapeCategoryMonthly({ raw, volume, list: win.list.slice(-months) });
}
export function shapeCategoryMonthly({ raw, volume, list }) {
  const inList = new Set(list), cats = new Map(), tot = new Map();
  for (const r of raw) {
    if (!inList.has(r.month)) continue;
    if (Number(r.is_total) === 1) { tot.set(r.month, Number(r.convs)); continue; }
    const cat = categoriaEs(r.fam), k = cat + '|' + r.month;
    cats.set(k, (cats.get(k) ?? 0) + Number(r.n));
  }
  // Un mes SIN ninguna conversación clasificada no se rellena con ceros: simplemente no entra (no hay dato, no hay cero).
  list = list.filter((m) => (tot.get(m) ?? 0) > 0);
  const names = [...new Set([...cats.keys()].map((k) => k.split('|')[0]))].sort((a, b) => a.localeCompare(b, 'es'));
  const rows = [];
  for (const month of list) for (const category of names) rows.push({ month, category, count: cats.get(category + '|' + month) ?? 0 });
  const classified = list.reduce((a, m) => a + (tot.get(m) ?? 0), 0);
  const elig = list.reduce((a, m) => a + (volume?.get(m) ?? 0), 0);
  // Cobertura por mes (conversaciones con alguna incidencia / conversaciones del mes): permite avisar cuando la clasificación avanza de forma desigual.
  const perMonth = list.map((month) => ({ month, classified: tot.get(month) ?? 0, eligible: volume?.get(month) ?? null }));
  return { status: rows.length ? 'ok' : 'empty', months: list, rows, perMonth, classified, eligible: elig >= classified && volume ? elig : classified };
}

// ---------------------------------------------------------------- exposición (vínculos problema–pedido)
/** Hoy no hay vínculos problema–pedido: la exposición es DESCONOCIDA (no cero). Con vínculos, el cálculo exacto vive en el snapshot publicado (no en una consulta acotada). */
export async function readExposure(s) {
  const n = await bounded(s, 'agent_links', BUDGETS_MS.links, async () => Number((await s.query('SELECT count(*)::int AS n FROM public.economic_problem_links WHERE tenant_id=$1', [s.tenantId])).rows[0]?.n ?? 0));
  return n === 0 ? { status: 'empty', reason: 'no_problem_order_links' } : { status: 'empty', reason: 'exposure_requires_published_snapshot' };
}
