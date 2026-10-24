// Lectores de los precálculos de 20261125000000 (insight_thread_sla, insight_refund_ledger_digest, insight_order_lines_digest).
// Cada lector corre dentro de `guarded` (SAVEPOINT + tope de tiempo): si la tabla no existe (migración sin aplicar), está vacía o el libro cambió después del último
// refresco, devuelve null y el llamador calcula en vivo (exacto, con su tope). Nunca se mezcla un precálculo desfasado con datos nuevos.
import {guarded} from './catalog-overview.mjs';
const TZ = 'America/Mexico_City'; // igual que carga-sla.mjs (se repite para no crear un ciclo de imports)

export const PRECALC_BUDGETS_MS = Object.freeze({sla: 2500, ledger: 2500});

/** Una fila agregada con las mismas columnas que la consulta en vivo de SLA (más `refrescado`), o null si no hay precálculo. */
export async function leerSlaPrecalculado(s, deadline, hoy) {
  const r = await guarded(s, deadline, 'carga_sla_pre', async () => (await s.query(
    `WITH j AS (SELECT created_at AS creado, status AS estado, seen_at AS visto, first_customer_at AS c1, first_agent_at AS a1, extract(epoch FROM first_agent_at-first_customer_at)/3600 AS h, refreshed_at
        FROM public.insight_thread_sla WHERE tenant_id=$1)
     SELECT count(*)::int AS hilos, count(c1)::int AS medibles, count(a1)::int AS con_resp, count(*) FILTER (WHERE a1 IS NOT NULL AND h<=24)::int AS dentro,
       (percentile_cont(0.5) WITHIN GROUP (ORDER BY h) FILTER (WHERE a1 IS NOT NULL))::numeric AS p50_h, (percentile_cont(0.9) WITHIN GROUP (ORDER BY h) FILTER (WHERE a1 IS NOT NULL))::numeric AS p90_h,
       count(*) FILTER (WHERE c1 IS NOT NULL AND a1 IS NULL AND estado='OPEN' AND c1 < $2::timestamptz - interval '24 hours')::int AS abiertos_sin_resp_24,
       count(*) FILTER (WHERE c1 IS NOT NULL AND a1 IS NULL AND estado='OPEN' AND c1 < $2::timestamptz - interval '24 hours' AND c1 >= $2::timestamptz - interval '7 days')::int AS abiertos_1_7,
       count(*) FILTER (WHERE c1 IS NOT NULL AND a1 IS NULL AND estado='OPEN' AND c1 < $2::timestamptz - interval '7 days' AND c1 >= $2::timestamptz - interval '30 days')::int AS abiertos_7_30,
       count(*) FILTER (WHERE c1 IS NOT NULL AND a1 IS NULL AND estado='OPEN' AND c1 < $2::timestamptz - interval '30 days')::int AS abiertos_30,
       count(*) FILTER (WHERE c1 IS NOT NULL AND a1 IS NULL AND estado='CLOSED')::int AS cerrados_sin_resp,
       to_char(min(creado) AT TIME ZONE '${TZ}','YYYY-MM-DD') AS min_creado, to_char(max(creado) AT TIME ZONE '${TZ}','YYYY-MM-DD') AS max_creado, max(visto) AS corte, max(refreshed_at) AS refrescado
     FROM j`, [s.tenantId, hoy.toISOString()])).rows[0]);
  return r && Number(r.hilos) > 0 ? r : null;
}

/**
 * Reembolsos y pedidos del libro SIN corte por fecha, con las mismas formas de fila que las consultas en vivo ({ch,sku,month,status,currency,exponent,n,sinMonto,amount,first_day,last_day}
 * y {kind,ch,sku,month,n,revised}). Solo se usa si el último `recorded_at` del libro coincide con el del precálculo; si no, null (se calcula en vivo).
 */
export async function leerLibroPrecalculado(s, deadline) {
  return guarded(s, deadline, 'fuga_pre', async () => {
    const vivo = (await s.query('SELECT max(recorded_at) AS wm FROM public.economic_ledger_entries WHERE tenant_id=$1', [s.tenantId])).rows[0]?.wm;
    const reembolsos = (await s.query(
      `SELECT ch, sku, month, status, currency, exponent::int AS exponent, n, sin_monto AS "sinMonto", amount_minor::text AS amount, first_day, last_day, refreshed_at, source_watermark
       FROM public.insight_refund_ledger_digest WHERE tenant_id=$1 LIMIT 20000`, [s.tenantId])).rows;
    const lineas = (await s.query('SELECT ch, sku, month, n_all, revised_all, n_latest, revised_latest FROM public.insight_order_lines_digest WHERE tenant_id=$1 LIMIT 20000', [s.tenantId])).rows;
    return vigenteONull({vivo, reembolsos, lineas});
  });
}

/** Puro (probado): decide si el precálculo vale y arma las filas con la forma de la consulta en vivo. */
export function vigenteONull({vivo, reembolsos, lineas}) {
  if (!vivo || !reembolsos?.length) return null; // libro vacío o sin precálculo: que lo diga el cálculo en vivo
  const wm = new Date(vivo).getTime();
  if (reembolsos.some(r => !r.source_watermark || new Date(r.source_watermark).getTime() !== wm)) return null; // el libro cambió después del refresco
  return {
    reembolsos: reembolsos.map(({refreshed_at, source_watermark, ...r}) => r),
    refrescadoAt: new Date(Math.max(...reembolsos.map(r => new Date(r.refreshed_at).getTime()))).toISOString(),
    pedidos: pedidosDe(lineas ?? [], false), pedidosUltima: pedidosDe(lineas ?? [], true),
    hayRevisiones: (lineas ?? []).some(l => Number(l.revised_all) > 0),
  };
}
/** Reconstruye los grupos de la consulta en vivo (GROUPING SETS (ch,sku),(ch,mes),()) a partir del grano ch x sku x mes. */
export function pedidosDe(lineas, ultima) {
  const n = l => Number(ultima ? l.n_latest : l.n_all), rv = l => Number(ultima ? l.revised_latest : l.revised_all);
  const por = new Map(), acc = (k, init, l) => { const o = por.get(k) ?? init; o.n += n(l); o.revised += rv(l); por.set(k, o); };
  let total = {kind: 'total', ch: null, sku: null, month: null, n: 0, revised: 0};
  for (const l of lineas) {
    acc('s|' + l.ch + '|' + l.sku, {kind: 'sku', ch: l.ch, sku: l.sku, month: null, n: 0, revised: 0}, l);
    acc('m|' + l.ch + '|' + l.month, {kind: 'mes', ch: l.ch, sku: null, month: l.month, n: 0, revised: 0}, l);
    total.n += n(l); total.revised += rv(l);
  }
  return [...por.values(), total];
}
