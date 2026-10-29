// Sello de procedencia de 4 campos: clase · fuente · hasta fecha · actualizado hace. Puro y probado.
// Regla: una cifra jamás va sin su sello. Lo que no se sabe se dice («sin fecha de corte»), nunca se rellena.
// El traductor `t` (de useT) es opcional: sin él sale el español canónico que fijan las pruebas.
import {hace} from '../legibilidad/sincronizacion.mjs';
import {X, idiomaDe} from '../legibilidad/trad.mjs';
import {fechaCorta} from '../formato/idioma.mjs';
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const CLASE = Object.freeze({observed: 'Observado', estimated: 'Estimado', inferred: 'Inferido'});
/** «2026-09-20…» -> «20 sep 2026» (en inglés «Sep 20, 2026»). Sin zona horaria: se lee el texto, para que el día no se corra. null si no es fecha. */
export function diaTxt(iso, t = null) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ''));
  if (!m || !MESES[Number(m[2]) - 1]) return null;
  if (idiomaDe(t) === 'en') return fechaCorta(`${m[1]}-${m[2]}-${m[3]}`, 'en');
  return `${Number(m[3])} ${MESES[Number(m[2]) - 1]} ${m[1]}`;
}
/** Antigüedad de una marca de tiempo ISO: «hace 5 min». null si no hay marca válida. */
export function haceDeIso(iso, ahora = Date.now(), t = null) {
  const ms = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(ms) ? hace(Math.max(0, Math.round((ahora - ms) / 1000)), t) : null;
}
/** @returns {{clase, claseTxt, fuente, hasta, actualizado, texto, hastaCorto, actualizadoCorto, hastaIso, actualizadoIso, fuenteCruda, ahora}} los 4 campos ya redactados (+ versiones cortas y los datos crudos para volver a redactarlos en otro idioma). */
export function sello({clase = 'observed', fuente, hasta = null, actualizado = null, ahora = Date.now(), t = null} = {}) {
  const k = clase in CLASE ? clase : 'observed';
  const dia = diaTxt(hasta, t), edad = haceDeIso(actualizado, ahora, t);
  const claseTxt = t ? t('tr.lg.k.' + k + '.label') : CLASE[k];
  const out = {clase: k, claseTxt, fuente: fuente || X(t, 'tr.lg.sello.sinFuente', 'Fuente no registrada'),
    hasta: dia ? X(t, 'tr.lg.sello.hasta', `hasta ${dia}`, {dia}) : X(t, 'tr.lg.sello.sinCorte', 'sin fecha de corte'),
    actualizado: edad ? X(t, 'tr.lg.sello.actualizado', `actualizado ${edad}`, {edad}) : X(t, 'tr.lg.sello.sinHora', 'sin hora de actualización')};
  // Versión compacta de las dos líneas: sin el año de «hasta» y sin la palabra «actualizado».
  const diaCorto = dia ? (idiomaDe(t) === 'en' ? dia.replace(/,\s\d{4}$/, '') : dia.replace(/ \d{4}$/, '')) : null;
  const hastaCorto = diaCorto ? X(t, 'tr.lg.sello.hasta', `hasta ${diaCorto}`, {dia: diaCorto}) : out.hasta;
  const actualizadoCorto = edad ? edad : X(t, 'tr.lg.sello.sinHoraCorto', 'sin hora');
  return {...out, texto: [out.claseTxt, out.fuente, out.hasta, out.actualizado].join(' · '), hastaCorto, actualizadoCorto,
    hastaIso: hasta, actualizadoIso: actualizado, fuenteCruda: fuente, ahora};
}
