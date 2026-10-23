// Diccionario de jerga interna -> lenguaje de cliente. Los valores internos (claves de base, tablas) NO cambian: solo se traducen al mostrarlos.
export const BASES = Object.freeze({
  marketplace_line_price: 'Precio de línea de marketplace',
  net: 'Neto',
});
export const TERMINOS = Object.freeze([
  [/economic_fx_versions/g, 'la tabla de versiones de tipo de cambio'],
  [/\bledger económico\b/gi, 'libro económico'],
  [/\bledger\b/gi, 'libro económico'],
  [/\basientos\b/gi, 'registros del libro'],
  [/\basiento\b/gi, 'registro del libro'],
  [/\bAsientos\b/g, 'Registros del libro'],
]);
/** Base económica interna -> nombre legible. Una clave desconocida se muestra sin guiones bajos, nunca inventada. */
export const etiquetaBase = (k) => (k === null || k === undefined || k === '' ? '' : BASES[k] ?? String(k).replace(/_/g, ' '));
/** Traduce términos técnicos dentro de un texto. */
export function sinJerga(texto) {
  let t = String(texto ?? '');
  for (const [re, s] of TERMINOS) t = t.replace(re, (m) => (m[0] === m[0].toUpperCase() && m !== m.toLowerCase() ? s[0].toUpperCase() + s.slice(1) : s));
  return t.replace(/\bBASES_KEY\b/g, '');
}
