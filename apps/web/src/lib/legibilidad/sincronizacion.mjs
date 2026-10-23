// Texto del panel «Estado de sincronización» (/sources) a partir de GET /api/freshness. Puro y sin PII: claves de fuente, métodos y códigos de error de catálogo.
export const METODOS = Object.freeze({api_poll: 'Consulta periódica por API', webhook: 'Eventos en tiempo real (webhook)', file_drop: 'Carpeta compartida', sheet_sync: 'Hoja de cálculo en línea', manual_upload: 'Carga manual de archivos', stub: 'Aún sin conectar'});
export const FUENTES = Object.freeze({hubspot: 'HubSpot (tickets)', zendesk: 'Zendesk', csv_conversations: 'Conversaciones por archivo', ledger: 'Libro de pedidos y reembolsos', tracker: 'Tracker (Excel)', amazon: 'Amazon', walmart: 'Walmart', bestbuy: 'Best Buy', shopify: 'Shopify'});
export const CALCULOS = Object.freeze({conversation_volume: 'Conversaciones por semana y mes', refund_by_sku_month: 'Reembolsos por SKU, canal y mes', thread_resolution: 'Cierre y reapertura de hilos', tracker_refund_status: 'Estado de reembolsos del Tracker', repeat_contact: 'Contacto repetido'});
const ERRORES = Object.freeze({RECONNECT_REQUIRED: 'Hay que volver a conectar la cuenta', CRM_CREDENTIAL_CONFIGURATION_REQUIRED: 'Faltan las credenciales del servidor', SYNC_FAILED: 'La última sincronización falló', RATE_LIMITED: 'El proveedor limitó las peticiones', TIMEOUT: 'La consulta tardó demasiado', 57014: 'La consulta tardó demasiado'});
export const hace = seg => {
  if (seg == null) return null;
  if (seg < 45) return 'hace unos segundos';
  if (seg < 3600) return `hace ${Math.round(seg / 60)} min`;
  if (seg < 172800) return `hace ${Math.round(seg / 3600)} h`;
  return `hace ${Math.round(seg / 86400)} días`;
};
export const dentroDe = (iso, ahora = Date.now()) => {
  if (!iso) return null; const s = Math.round((new Date(iso).getTime() - ahora) / 1000);
  if (s <= 30) return 'en cualquier momento'; if (s < 3600) return `en ${Math.max(1, Math.round(s / 60))} min`; if (s < 172800) return `en ${Math.round(s / 3600)} h`; return `en ${Math.round(s / 86400)} días`;
};
export const textoError = code => (code ? ERRORES[code] ?? `Error ${String(code).slice(0, 40)}` : null);
/** -> {disponible, fuentes:[{clave,nombre,metodo,estado,tono,exito,siguiente,error,nuevos,latencia}], calculos:[{clave,nombre,estado,actualizado,pendientes}]} */
export function filasSincronizacion(f, ahora = Date.now()) {
  if (!f || f.availability !== 'ready') return {disponible: false, fuentes: [], calculos: []};
  const fuentes = f.sources.map(s => {
    const estado = s.status === 'error' ? 'Con error' : s.status === 'paused' ? 'En pausa' : s.status === 'running' ? 'Sincronizando' : s.method === 'stub' || s.status === 'never' ? 'Sin conectar' : s.stale ? 'Atrasada' : 'Al día';
    return {clave: s.key, nombre: FUENTES[s.key] ?? s.key, metodo: METODOS[s.method] ?? s.method, estado, tono: estado === 'Al día' ? 'ok' : estado === 'Con error' ? 'bad' : estado === 'Sincronizando' ? 'info' : 'warn',
      exito: s.lastSuccessAt ? hace(Math.max(0, Math.round((ahora - new Date(s.lastSuccessAt).getTime()) / 1000))) : 'Nunca', siguiente: s.status === 'paused' || s.method === 'manual_upload' ? null : dentroDe(s.nextRunAt, ahora),
      error: textoError(s.errorCode), nuevos: s.lastNewRecords, latencia: s.latencyMs == null ? null : s.latencyMs < 1000 ? `${s.latencyMs} ms` : `${(s.latencyMs / 1000).toFixed(1)} s`};
  });
  const calculos = f.insights.map(i => ({clave: i.insight, nombre: CALCULOS[i.insight] ?? i.insight, estado: i.status === 'ready' ? 'Al día' : i.status === 'partial' ? 'Calculando…' : i.status === 'skipped' ? 'Omitido' : 'Falló',
    actualizado: i.refreshedAt ? hace(Math.max(0, Math.round((ahora - new Date(i.refreshedAt).getTime()) / 1000))) : null, pendientes: i.pending}));
  return {disponible: true, fuentes, calculos};
}
