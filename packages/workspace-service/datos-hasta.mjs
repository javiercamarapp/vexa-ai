// UNA utilidad de «Datos hasta» por FUENTE (libro económico, conversaciones, CSV...). Cada fuente tiene su propia fecha de corte; nunca se mezclan ni se promedian.
export const FUENTES = Object.freeze({libro: 'Libro económico (pedidos y reembolsos)', conversaciones: 'Conversaciones', csv: 'Archivos CSV', explorador: 'Explorador'});
export const EXPLICACION = 'Cada fuente tiene su propia fecha de corte.';
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
/** ISO/fecha -> «5 oct 2026» (UTC). Valor vacío o no interpretable: null (desconocido, nunca inventado). */
export function diaCorte(v) {
  if (v === null || v === undefined || v === '') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v));
  if (!m || Number(m[2]) < 1 || Number(m[2]) > 12) return null;
  return `${Number(m[3])} ${MESES[Number(m[2]) - 1]} ${m[1]}`;
}
/** @param {Record<string, string|null|undefined>} cortes clave de fuente -> fecha. Devuelve una entrada por fuente conocida; las desconocidas dicen «sin fecha de corte». */
export function datosHastaPorFuente(cortes) {
  return Object.entries(cortes ?? {}).map(([clave, v]) => {
    const dia = diaCorte(v), etiqueta = FUENTES[clave] ?? clave;
    return {clave, etiqueta, dia, texto: `${etiqueta}: ${dia ? 'datos hasta el ' + dia : 'sin fecha de corte'}`};
  });
}
/** Línea única: «Libro económico: datos hasta el 5 oct 2026 · Conversaciones: datos hasta el 22 oct 2026. Cada fuente tiene su propia fecha de corte.» */
export const lineaDatosHasta = (cortes) => {
  const f = datosHastaPorFuente(cortes);
  return f.length ? f.map((x) => x.texto).join(' · ') + (f.length > 1 ? '. ' + EXPLICACION : '') : '';
};
