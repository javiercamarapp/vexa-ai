// Degradación por parte en vistas de solo lectura: el servidor responde 200 con partes `{status:'unavailable'}` cuando una consulta acotada excede su tiempo.
// La pantalla reintenta UNA vez en silencio y solo reemplaza lo pintado si el reintento no es peor (nunca cambia una parte buena por una caída).
/** Cuenta las partes de primer nivel (y las anidadas un nivel) cuyo estado es «unavailable». */
export function partesCaidas(d) {
  if (!d || typeof d !== 'object') return 0;
  let n = 0;
  for (const v of Object.values(d)) {
    if (!v || typeof v !== 'object') continue;
    if (v.status === 'unavailable') { n++; continue; }
    for (const w of Object.values(v)) if (w && typeof w === 'object' && !Array.isArray(w) && w.status === 'unavailable') n++;
  }
  return n;
}
/** ¿Conviene reintentar en silencio? Solo la 1.ª vez y solo si hay partes caídas. */
export const debeReintentar = (d, intento) => intento < 1 && partesCaidas(d) > 0;
/** Elige qué dato pintar: el reintento solo reemplaza al previo si no tiene MÁS partes caídas. */
export const elegirDato = (previo, nuevo) => (previo == null || partesCaidas(nuevo) <= partesCaidas(previo) ? nuevo : previo);
export const ESPERA_REINTENTO_MS = 2500;
