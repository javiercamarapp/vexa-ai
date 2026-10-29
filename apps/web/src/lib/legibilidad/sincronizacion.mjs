import {X} from './trad.mjs';
// Texto del panel «Estado de sincronización» (/sources) a partir de GET /api/freshness. Puro y sin PII: claves de fuente, métodos y códigos de error de catálogo.
export const METODOS = Object.freeze({api_poll: 'Consulta periódica por API', webhook: 'Eventos en tiempo real (webhook)', file_drop: 'Carpeta compartida', sheet_sync: 'Hoja de cálculo en línea', manual_upload: 'Carga manual de archivos', stub: 'Aún sin conectar'});
export const FUENTES = Object.freeze({hubspot: 'HubSpot (tickets)', zendesk: 'Zendesk', csv_conversations: 'Conversaciones por archivo', ledger: 'Libro de pedidos y reembolsos', tracker: 'Tracker (Excel)', amazon: 'Amazon', walmart: 'Walmart', bestbuy: 'Best Buy', shopify: 'Shopify'});
export const CALCULOS = Object.freeze({conversation_volume: 'Conversaciones por semana y mes', refund_by_sku_month: 'Reembolsos por SKU, canal y mes', thread_resolution: 'Cierre y reapertura de hilos', tracker_refund_status: 'Estado de reembolsos del Tracker', repeat_contact: 'Contacto repetido', complaint_family_month: 'Quejas por familia y mes', order_revenue_month: 'Ingreso bruto por mes', problem_run_verdict: 'Veredicto de cada corrida de análisis'});
/** Nombre en español de un cálculo precalculado; uno que no esté en la tabla nunca muestra el id interno. */
export const nombreCalculo = (id, t = null) => (CALCULOS[id] ? X(t, 'tr.lg.calc.' + id, CALCULOS[id]) : X(t, 'tr.lg.calc.interno', 'Cálculo interno'));
/** Método de sincronización / nombre de fuente en el idioma del traductor; lo desconocido se muestra tal cual. */
export const nombreMetodo = (m, t = null) => (METODOS[m] ? X(t, 'tr.lg.met.' + m, METODOS[m]) : m);
export const nombreFuente = (k, t = null) => (FUENTES[k] ? X(t, 'tr.lg.fte.' + k, FUENTES[k]) : k);
const ERRORES = Object.freeze({RECONNECT_REQUIRED: 'Hay que volver a conectar la cuenta', CRM_CREDENTIAL_CONFIGURATION_REQUIRED: 'Faltan las credenciales del servidor', SYNC_FAILED: 'La última sincronización falló', RATE_LIMITED: 'El proveedor limitó las peticiones', TIMEOUT: 'La consulta tardó demasiado', 57014: 'La consulta tardó demasiado'});
export const hace = (seg, t = null) => {
  if (seg == null) return null;
  if (seg < 45) return X(t, 'tr.lg.hace.seg', 'hace unos segundos');
  if (seg < 3600) { const n = Math.round(seg / 60); return X(t, 'tr.lg.hace.min', `hace ${n} min`, {n}); }
  if (seg < 172800) { const n = Math.round(seg / 3600); return X(t, 'tr.lg.hace.h', `hace ${n} h`, {n}); }
  const n = Math.round(seg / 86400); return X(t, 'tr.lg.hace.d', `hace ${n} días`, {n});
};
export const dentroDe = (iso, ahora = Date.now(), t = null) => {
  if (!iso) return null; const s = Math.round((new Date(iso).getTime() - ahora) / 1000);
  if (s <= 30) return X(t, 'tr.lg.dentro.ya', 'en cualquier momento');
  if (s < 3600) { const n = Math.max(1, Math.round(s / 60)); return X(t, 'tr.lg.dentro.min', `en ${n} min`, {n}); }
  if (s < 172800) { const n = Math.round(s / 3600); return X(t, 'tr.lg.dentro.h', `en ${n} h`, {n}); }
  const n = Math.round(s / 86400); return X(t, 'tr.lg.dentro.d', `en ${n} días`, {n});
};
export const textoError = (code, t = null) => (code ? (ERRORES[code] ? X(t, 'tr.lg.err.' + code, ERRORES[code]) : X(t, 'tr.lg.err.otro', `Error ${String(code).slice(0, 40)}`, {code: String(code).slice(0, 40)})) : null);
/** -> {disponible, fuentes:[{clave,nombre,metodo,estado,tono,exito,siguiente,error,nuevos,latencia}], calculos:[{clave,nombre,estado,actualizado,pendientes}]} */
export function filasSincronizacion(f, ahora = Date.now(), t = null) {
  if (!f || f.availability !== 'ready') return {disponible: false, fuentes: [], calculos: []};
  const ET = {error: ['Con error', 'bad'], paused: ['En pausa', 'warn'], running: ['Sincronizando', 'info'], never: ['Sin conectar', 'warn'], stale: ['Atrasada', 'warn'], ok: ['Al día', 'ok']};
  const fuentes = f.sources.map(s => {
    const e = s.status === 'error' ? 'error' : s.status === 'paused' ? 'paused' : s.status === 'running' ? 'running' : s.method === 'stub' || s.status === 'never' ? 'never' : s.stale ? 'stale' : 'ok';
    const estado = X(t, 'tr.lg.sync.' + e, ET[e][0]);
    return {clave: s.key, nombre: nombreFuente(s.key, t), metodo: nombreMetodo(s.method, t), estado, tono: ET[e][1],
      exito: s.lastSuccessAt ? hace(Math.max(0, Math.round((ahora - new Date(s.lastSuccessAt).getTime()) / 1000)), t) : X(t, 'tr.lg.sync.nunca', 'Nunca'), siguiente: s.status === 'paused' || s.method === 'manual_upload' ? null : dentroDe(s.nextRunAt, ahora, t),
      error: textoError(s.errorCode, t), nuevos: s.lastNewRecords, latencia: s.latencyMs == null ? null : s.latencyMs < 1000 ? `${s.latencyMs} ms` : `${(s.latencyMs / 1000).toFixed(1)} s`};
  });
  const EC = {ready: 'Al día', partial: 'Parcial', skipped: 'Omitido'};
  const calculos = f.insights.map(i => { const e = EC[i.status] ? i.status : 'failed'; return {clave: i.insight, nombre: nombreCalculo(i.insight, t), estado: X(t, 'tr.lg.calcEstado.' + e, EC[e] ?? 'Falló'),
    actualizado: i.refreshedAt ? hace(Math.max(0, Math.round((ahora - new Date(i.refreshedAt).getTime()) / 1000)), t) : null, pendientes: i.pending}; });
  return {disponible: true, fuentes, calculos};
}
