// UNA utilidad de «Datos hasta» por FUENTE (libro económico, conversaciones, CSV...). Cada fuente tiene su propia fecha de corte; nunca se mezclan ni se promedian.
export const FUENTES = Object.freeze({libro: 'Libro económico (pedidos y reembolsos)', conversaciones: 'Conversaciones', csv: 'Archivos CSV', explorador: 'Explorador'});
export const EXPLICACION = 'Cada fuente tiene su propia fecha de corte.';
// Inglés de las mismas piezas (el español es el idioma por omisión y lo fijan las pruebas).
export const FUENTES_EN = Object.freeze({libro: 'Economic ledger (orders and refunds)', conversaciones: 'Conversations', csv: 'CSV files', explorador: 'Explorer'});
export const EXPLICACION_EN = 'Each source has its own cutoff date.';
export const explicacion = (idioma) => (idioma === 'en' ? EXPLICACION_EN : EXPLICACION);
const MESES_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
/** ISO/fecha -> «5 oct 2026» (UTC). Valor vacío o no interpretable: null (desconocido, nunca inventado). */
export function diaCorte(v, idioma = 'es') {
  if (v === null || v === undefined || v === '') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v));
  if (!m || Number(m[2]) < 1 || Number(m[2]) > 12) return null;
  return idioma === 'en' ? `${MESES_EN[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}` : `${Number(m[3])} ${MESES[Number(m[2]) - 1]} ${m[1]}`;
}
/** @param {Record<string, string|null|undefined>} cortes clave de fuente -> fecha. Devuelve una entrada por fuente conocida; las desconocidas dicen «sin fecha de corte». */
export function datosHastaPorFuente(cortes, idioma = 'es') {
  return Object.entries(cortes ?? {}).map(([clave, v]) => {
    const dia = diaCorte(v, idioma), etiqueta = (idioma === 'en' ? FUENTES_EN : FUENTES)[clave] ?? clave;
    return {clave, etiqueta, dia, texto: idioma === 'en' ? `${etiqueta}: ${dia ? 'data through ' + dia : 'no cutoff date'}` : `${etiqueta}: ${dia ? 'datos hasta el ' + dia : 'sin fecha de corte'}`};
  });
}
/** Línea única: «Libro económico: datos hasta el 5 oct 2026 · Conversaciones: datos hasta el 22 oct 2026. Cada fuente tiene su propia fecha de corte.» */
export const lineaDatosHasta = (cortes, idioma = 'es') => {
  const f = datosHastaPorFuente(cortes, idioma);
  return f.length ? f.map((x) => x.texto).join(' · ') + (f.length > 1 ? '. ' + explicacion(idioma) : '') : '';
};
