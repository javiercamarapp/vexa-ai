// Fixtures de /api/freshness para «Datos y confianza» (y el panel de sincronización). Solo auditoría visual. FRESCURA_VARIANT = sinactivar | alerta.
export async function respondExtra(url, method) {
  const p = new URL(url, 'http://x').pathname;
  if (p !== '/api/freshness' || method !== 'GET') return null;
  const v = process.env.FRESCURA_VARIANT ?? '', now = Date.now(), ago = (s) => new Date(now - s * 1000).toISOString();
  if (v === 'sinactivar') return [200, {data: {availability: 'unavailable', sources: [], insights: [], version: null}}];
  const hub = v === 'alerta' ? ago(3600) : ago(240);
  return [200, {data: {availability: 'ready', version: 'demo', sources: [
    {key: 'hubspot', method: 'api_poll', status: 'idle', lastAttemptAt: hub, lastSuccessAt: hub, ageSeconds: 240, lastNewRecords: 12, errorCode: null, latencyMs: 820, nextRunAt: new Date(now + 60000).toISOString(), expectedEverySeconds: 300, dataWatermark: ago(300), stale: v === 'alerta'},
    {key: 'tracker', method: 'manual_upload', status: 'idle', lastAttemptAt: ago(86400 * 6), lastSuccessAt: ago(86400 * 6), ageSeconds: 86400 * 6, lastNewRecords: null, errorCode: null, latencyMs: null, nextRunAt: null, expectedEverySeconds: null, dataWatermark: null, stale: false}],
   insights: [{insight: 'conversation_volume', status: 'ready', refreshedAt: ago(1800), sourceWatermark: ago(3600), ageSeconds: 1800, rows: 42, durationMs: 300, pending: 0, errorCode: null},
    {insight: 'refund_by_sku_month', status: 'partial', refreshedAt: ago(7200), sourceWatermark: ago(86400 * 3), ageSeconds: 7200, rows: 1180, durationMs: 900, pending: 2, errorCode: null}]}}];
}
