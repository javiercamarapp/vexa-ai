// UNA definición de «cobertura» para todas las pantallas (Resumen, /analysis, Fuentes, chat). Siempre «N de M» con su base escrita.
//
//  A) Conversaciones analizadas por la IA = conversaciones DISTINTAS con al menos una ejecución de extracción terminada («succeeded» o «abstained»)
//     de las conversaciones cargadas (todas las fuentes, sin borradas). Base = ese total. Seis análisis de una misma conversación cuentan 1.
//  B) Incorporación de HubSpot = conversaciones incorporadas de las filas leídas con conversación (filas leídas menos registros solo de metadatos).
//     Es OTRA cosa: dice cuánto del export entró, no cuánto analizó la IA. Si el desglose no está disponible, NO hay porcentaje (nunca se cae a
//     «filas leídas», que es otra base y fue lo que hacía bailar la cifra entre 48.3 % y 97.9 %).
const nf = new Intl.NumberFormat('es-MX');
const pf = new Intl.NumberFormat('es-MX', {minimumFractionDigits: 1, maximumFractionDigits: 1});
export const SQL_ANALIZADAS = `SELECT count(DISTINCT er.conversation_id) AS n FROM public.extraction_runs er
  JOIN public.conversations c ON c.id=er.conversation_id AND c.tenant_id=er.tenant_id
  WHERE er.tenant_id=$1 AND er.status IN ('succeeded','abstained') AND c.deleted_at IS NULL`;
export const BASE_ANALISIS = 'conversaciones cargadas (todas las fuentes)';
const entero = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Math.max(0, Math.round(Number(v))));

/** {analizadas, base, estimado} -> {n, de, pct, texto, base, estimado, nota}. Sin numerador o sin base legible: pct null (No disponible, nunca 0). */
export function coberturaAnalisisIA({analizadas, base, estimado = false} = {}) {
  const n = entero(analizadas), de = entero(base);
  if (n === null || de === null || de <= 0) return {n, de, pct: null, texto: n === null ? 'No disponible ahora' : `${nf.format(n)} conversaciones analizadas`, base: BASE_ANALISIS, estimado, nota: 'El total de conversaciones cargadas no está disponible ahora.'};
  const pct = Math.round((Math.min(n, de) * 1000) / de) / 10;
  return {n, de, pct, texto: `${nf.format(n)} de ${estimado ? '≈' : ''}${nf.format(de)} conversaciones (${pf.format(pct)} %)`, base: BASE_ANALISIS, estimado,
    nota: `Conversaciones distintas con un análisis de la IA terminado, sobre ${BASE_ANALISIS}${estimado ? '; el total es un estimado' : ''}.`};
}
/** Fuente HubSpot de /api/coverage -> incorporación estricta o null. */
export function coberturaIncorporacion(hub) {
  const b = hub?.rejectionBreakdown;
  if (!b || b.status !== 'ok') return null;
  const de = entero(b.conversationRows), inc = entero(b.conversationIncorporated);
  if (!de || inc === null) return null;
  const pct = Math.round((Math.min(inc, de) * 1000) / de) / 10;
  return {incorporadas: inc, de, pct, texto: `${nf.format(inc)} de ${nf.format(de)} conversaciones de HubSpot (${pf.format(pct)} %)`, base: 'filas de HubSpot con conversación (filas leídas menos registros solo de metadatos)'};
}
