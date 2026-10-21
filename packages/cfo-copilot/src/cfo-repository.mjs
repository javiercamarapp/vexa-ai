// Lectura acotada del ledger para /cfo. Corre BAJO la sesión y RLS del usuario (database.transaction('read')), nunca con rol de servicio.
// Mismo patrón que packages/workspace-service/trends.mjs: ventana fija de meses, una agregación por tabla, statement_timeout local
// (4.5 s) que se reporta como status «timeout» (nunca como un 0 ni un 503), y SAVEPOINT para no abortar la transacción.
// MEDIR por MCP (SELECT de solo lectura) antes de conectarlo: ver NOTAS.md §Consultas a medir.
import {guarded, monthWindow} from '../../workspace-service/trends.mjs';
import {readLedgerMonthly, summaryMeta} from '../../workspace-service/summaries.mjs';

export const CFO_MONTHS = 12;
export const CFO_TIMEOUT_MS = 4500;
const MAX_ROWS = 2500;

export function channelFromSourceName(name) {
  const n = String(name ?? '').toLowerCase();
  if (n.includes('amazon')) return 'amazon';
  if (n.includes('walmart')) return 'walmart';
  if (n.includes('shopify')) return 'shopify';
  if (n.includes('best buy ca') || n.includes('bestbuy ca') || n.includes('mirakl') && n.includes(' ca')) return 'mirakl_bestbuy_ca';
  if (n.includes('best buy us') || n.includes('bestbuy us') || n.includes('mirakl')) return 'mirakl_bestbuy_us';
  return 'otro';
}

export const LEDGER_MONTHLY_SQL = `
WITH latest AS (
  SELECT DISTINCT ON (entity_id) entity_id,source_id,kind,status,effective_at,currency,exponent,basis,amount_minor
  FROM public.economic_ledger_entries
  WHERE tenant_id=$1 AND kind IN ('order','refund')
  ORDER BY entity_id,revision DESC)
SELECT to_char(effective_at AT TIME ZONE 'UTC','YYYY-MM') AS month,source_id,kind,status,currency,exponent,basis,
  count(*) AS n,count(amount_minor) AS known,coalesce(sum(amount_minor),0)::text AS amount
FROM latest WHERE effective_at>=$2 AND effective_at<$3
GROUP BY 1,2,3,4,5,6,7 ORDER BY 1,2,3,4 LIMIT ${MAX_ROWS}`;
export const SOURCE_NAMES_SQL = `SELECT DISTINCT ON (source_id) source_id,name,watermark FROM public.economic_source_versions WHERE tenant_id=$1 ORDER BY source_id,version DESC LIMIT 100`;
// Vínculos atestados vigentes (última versión por problema·entidad) y el importe de los pedidos vinculados, por problema y moneda.
export const EXPOSURE_SQL = `
WITH cur AS (
  SELECT DISTINCT ON (problem_id,entity_id) problem_id,entity_id,active
  FROM public.economic_problem_links WHERE tenant_id=$1 AND attested ORDER BY problem_id,entity_id,version DESC),
act AS (SELECT problem_id,entity_id FROM cur WHERE active LIMIT 5000),
led AS (
  SELECT DISTINCT ON (l.entity_id) l.entity_id,l.currency,l.exponent,l.amount_minor
  FROM public.economic_ledger_entries l JOIN act a ON a.entity_id=l.entity_id WHERE l.tenant_id=$1 AND l.kind='order' ORDER BY l.entity_id,l.revision DESC)
SELECT a.problem_id,p.title,led.currency,led.exponent,count(*) AS linked,count(led.amount_minor) AS known,coalesce(sum(led.amount_minor),0)::text AS exposed
FROM act a JOIN led ON led.entity_id=a.entity_id LEFT JOIN public.problems p ON p.tenant_id=$1 AND p.id=a.problem_id
GROUP BY 1,2,3,4 ORDER BY 7 DESC LIMIT 200`;

export function createCfoRepository({database, now = () => new Date(), timeoutMs = CFO_TIMEOUT_MS}) {
  return {
    /** Filas agregadas mes·canal·tipo·estado·moneda·base de los últimos `months` meses + corte de la fuente. */
    async ledgerMonthly({months = CFO_MONTHS} = {}) {
      const win = monthWindow(now(), months);
      return database.transaction('read', async s => {
        const names = await guarded(s, async () => (await s.query(SOURCE_NAMES_SQL, [s.tenantId])).rows, timeoutMs);
        const windowOut = {start: win.start.toISOString().slice(0, 10), end: win.end.toISOString().slice(0, 10), months};
        // 1) Resumen precomputado (migración 20261022000000): lectura de decenas de filas. Solo si CADA mes de la ventana fue refrescado.
        const sum = names === null ? {availability: 'skipped'} : await readLedgerMonthly(s, win);
        const summary = summaryMeta(sum);
        // 2) Sin resumen utilizable: consulta directa acotada (camino anterior). Nunca se mezcla un resumen parcial con ceros.
        const rows = names === null ? null : sum.availability === 'ready' ? sum.rows : await guarded(s, async () => (await s.query(LEDGER_MONTHLY_SQL, [s.tenantId, win.start.toISOString(), win.end.toISOString()])).rows, timeoutMs);
        if (rows === null || names === null) return {status: 'timeout', rows: [], watermark: null, window: windowOut, complete: false, summary: {...summary, missingMonths: sum.missingMonths ?? null}};
        const channelOf = new Map(names.map(r => [r.source_id, channelFromSourceName(r.name)]));
        const used = new Set(rows.map(r => r.source_id));
        const marks = names.filter(r => used.has(r.source_id) && r.watermark).map(r => Date.parse(r.watermark));
        return {
          status: rows.length === 0 ? 'empty' : 'ok', complete: rows.length < MAX_ROWS,
          watermark: marks.length ? new Date(Math.max(...marks)).toISOString() : null,
          window: windowOut, summary,
          rows: rows.map(r => ({month: r.month, channel: channelOf.get(r.source_id) ?? 'otro', kind: r.kind, status: r.status, currency: r.currency, exponent: Number(r.exponent), basis: r.basis, n: Number(r.n), known: Number(r.known), amountMinor: String(r.amount)})),
        };
      });
    },
    async exposure() {
      return database.transaction('read', async s => {
        const rows = await guarded(s, async () => (await s.query(EXPOSURE_SQL, [s.tenantId])).rows, timeoutMs);
        if (rows === null) return {status: 'timeout', attestedLinks: 0, rows: [], coverageComplete: false};
        return {status: rows.length ? 'ok' : 'empty', coverageComplete: false, attestedLinks: rows.reduce((a, r) => a + Number(r.linked), 0),
          rows: rows.map(r => ({problemId: r.problem_id, title: r.title || 'Problema sin título', currency: r.currency, exponent: Number(r.exponent), exposedMinor: String(r.exposed), linkedOrders: Number(r.linked), knownOrders: Number(r.known)}))};
      });
    },
  };
}
