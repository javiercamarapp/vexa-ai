// Consultas de SOLO LECTURA del puerto real del agente (port.mjs). Cada una corre en la transacción de lectura del tenant (RLS del usuario),
// con SAVEPOINT y tope de tiempo local; si se agota responde con error 57014 (el agente dice «no pudo completarse», jamás «0» ni «no tengo»).
// Reglas: ingreso BRUTO (nunca margen); monedas separadas (jamás se suman); importe desconocido ≠ 0 (se cuenta aparte); sin texto de clientes ni PII.
import { monthWindow } from '../workspace-service/trends.mjs';
import { readLedgerMonthly } from '../workspace-service/summaries.mjs';
import { NOMBRE_CANAL, canalDeFuente } from '../workspace-service/fuga-reembolsos.mjs';

export const BUDGETS_MS = Object.freeze({ ledger: 4500 });
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

