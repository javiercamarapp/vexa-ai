// Sello de procedencia de 4 campos: clase · fuente · hasta fecha · actualizado hace. Puro y probado.
// Regla: una cifra jamás va sin su sello. Lo que no se sabe se dice («sin fecha de corte»), nunca se rellena.
import {hace} from '../legibilidad/sincronizacion.mjs';
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const CLASE = Object.freeze({observed: 'Observado', estimated: 'Estimado', inferred: 'Inferido'});
/** «2026-09-20…» -> «20 sep 2026» (sin zona horaria: se lee el texto, para que el día no se corra). null si no es fecha. */
export function diaTxt(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ''));
  return m && MESES[Number(m[2]) - 1] ? `${Number(m[3])} ${MESES[Number(m[2]) - 1]} ${m[1]}` : null;
}
/** Antigüedad de una marca de tiempo ISO: «hace 5 min». null si no hay marca válida. */
export function haceDeIso(iso, ahora = Date.now()) {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? hace(Math.max(0, Math.round((ahora - t) / 1000))) : null;
}
/** @returns {{clase, claseTxt, fuente, hasta, actualizado, texto}} los 4 campos ya redactados. */
export function sello({clase = 'observed', fuente, hasta = null, actualizado = null, ahora = Date.now()} = {}) {
  const k = clase in CLASE ? clase : 'observed';
  const dia = diaTxt(hasta), edad = haceDeIso(actualizado, ahora);
  const out = {clase: k, claseTxt: CLASE[k], fuente: fuente || 'Fuente no registrada', hasta: dia ? `hasta ${dia}` : 'sin fecha de corte', actualizado: edad ? `actualizado ${edad}` : 'sin hora de actualización'};
  return {...out, texto: [out.claseTxt, out.fuente, out.hasta, out.actualizado].join(' · ')};
}
