// Disparo del refresco de insights desde la aplicación. Solo llama a public.refresh_insights bajo la sesión del worker (acción 'import'); nunca rol de servicio.
// Reglas: jamás rompe el flujo que lo invoca (devuelve {status:'error'}), tope de tiempo propio, y es barato cuando nada cambió (el SQL responde 'noop' con una lectura de índice).
export const SOURCES = Object.freeze(['ledger', 'conversations', 'hubspot', 'tracker', 'contacts', 'all']);
/** Fuente de origen de una importación/sincronización -> qué insights recalcular. */
export const SOURCE_TO_REFRESH = Object.freeze({
  hubspot: ['hubspot', 'conversations', 'contacts'], zendesk: ['conversations', 'contacts'], csv_conversations: ['conversations', 'contacts'],
  imports: ['all'], ledger: ['ledger'], economic_import: ['ledger'], tracker: ['tracker'], all: ['all'],
});
export async function refreshInsights(database, {source = 'all', since = null, budgetMs = 8000} = {}) {
  if (!SOURCES.includes(source)) throw Object.assign(Error('INSIGHT_SOURCE_INVALID'), {code: 'INSIGHT_SOURCE_INVALID'});
  if (!Number.isInteger(budgetMs) || budgetMs < 500 || budgetMs > 600000) throw Object.assign(Error('INSIGHT_BUDGET_INVALID'), {code: 'INSIGHT_BUDGET_INVALID'});
  return database.transaction('import', async s => {
    const r = await s.query('SELECT public.refresh_insights($1::uuid,$2::text,$3::timestamptz,$4::integer) AS r', [s.tenantId, source, since, budgetMs]);
    return r.rows[0].r;
  });
}
/** Qué precálculos de rendimiento (20261125000000) toca cada destino de refresco: SLA depende de HubSpot/conversaciones; los digests del libro, del libro. */
export function perfFrioQue(targets) {
  const t = new Set(targets);
  const sla = t.has('all') || t.has('hubspot') || t.has('conversations'), ledger = t.has('all') || t.has('ledger');
  return sla && ledger ? 'all' : sla ? 'sla' : ledger ? 'ledger' : null;
}
/** Recalcula los precálculos de /api/workload y /api/refunds. Sin la migración devuelve {status:'absent'}; jamás lanza (no debe romper el trabajo que lo invoca). */
export async function refreshPerfFrio(database, {what = 'all'} = {}) {
  try {
    return await database.transaction('import', async s => (await s.query('SELECT public.refresh_perf_frio($1::uuid,$2::text) AS r', [s.tenantId, what])).rows[0].r);
  } catch (e) { return {status: /refresh_perf_frio/.test(String(e?.message)) && /does not exist|no existe/.test(String(e?.message)) ? 'absent' : 'error', code: e?.code ?? null}; }
}
/** Anota el estado de una fuente (éxito/fallo, nuevos, latencia, siguiente corrida). */
export async function recordSourceSync(database, {source, method, ok, newRecords = null, error = null, latencyMs = null, nextRunAt = null, expectedEverySeconds = null, dataWatermark = null}) {
  return database.transaction('import', s => s.query('SELECT public.record_source_sync($1::uuid,$2,$3,$4,$5,$6,$7,$8::timestamptz,$9,$10::timestamptz)',
    [s.tenantId, source, method, ok, newRecords, error, latencyMs, nextRunAt, expectedEverySeconds, dataWatermark]));
}
/**
 * Gancho para los manejadores alojados (imports, CRM): tras un trabajo con avance anota la fuente y refresca los insights afectados.
 * Nunca lanza: el trabajo principal ya terminó y su resultado no depende de esto. `enabled` apaga el gancho por completo (VEXA_INSIGHTS_REFRESH=enabled).
 */
export function createAfterWork({source, method, enabled = false, budgetMs = 8000, refresh = refreshInsights, record = recordSourceSync, now = Date.now, warm = null, expectedEverySeconds = null, progressed = r => r && r.state !== 'idle'} = {}) {
  return async function afterWork(database, result, {error = null, startedAt = now()} = {}) {
    if (enabled !== true || !database) return {status: 'disabled'};
    const out = {status: 'ok'};
    try {
      const ok = !error && !(result && result.state === 'blocked');
      await record(database, {source, method, ok, newRecords: Number.isSafeInteger(result?.pages) ? result.pages : null, error: ok ? null : (result?.code ?? error?.code ?? 'SYNC_FAILED'), latencyMs: Math.max(0, now() - startedAt), expectedEverySeconds});
      if (ok && progressed(result)) {
        const targets = SOURCE_TO_REFRESH[source] ?? ['all'];
        out.refreshed = [];
        for (const t of targets) out.refreshed.push(await refresh(database, {source: t, budgetMs}));
        // Calentar los precálculos de rendimiento (no-op si el corte no cambió). Solo si la ruta lo pidió (`warm`); un fallo aquí no cambia el resultado.
        const que = warm ? perfFrioQue(targets) : null;
        if (que) out.perfFrio = await warm(database, {what: que});
      }
    } catch (e) { out.status = 'error'; out.code = e?.code ?? 'INSIGHTS_HOOK_FAILED'; }
    return out;
  };
}
