// Formato y sello de la pestaña CCO. Puro y probado: no toca el DOM ni la red.
const CLASES = new Set(['observed', 'estimated', 'inferred']);
/** Importe en unidades menores (texto) -> número en unidades mayores, solo para mostrar. Un null sigue siendo null: nunca se vuelve 0. */
export const mayor = (minor, exponente) => (minor === null || minor === undefined ? null : Number(BigInt(minor)) / 10 ** exponente);
/** «2026-09-01» -> «sep 2026» en el idioma pedido (siempre UTC, para que el día no se corra). */
export function mesTxt(iso, locale) {
  const m = /^(\d{4})-(\d{2})/.exec(String(iso ?? ''));
  return m ? new Intl.DateTimeFormat(locale, {month: 'short', year: 'numeric', timeZone: 'UTC'}).format(new Date(`${m[1]}-${m[2]}-01T00:00:00Z`)).replace('.', '') : null;
}
/** Fin de la ventana: el mes `hasta` es el último mes completo, así que se muestra su nombre. */
export const diaTxt = (iso, locale) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ''));
  return m ? new Intl.DateTimeFormat(locale, {day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC'}).format(new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`)).replace(/\./g, '') : null;
};
/**
 * Sello de procedencia de 4 campos con los textos ya traducidos: clase, fuente, hasta fecha, consultado. Lo desconocido se dice («sin fecha de corte»), no se rellena.
 * `tr` = traductor; `claseKey` observed|estimated|inferred|nodata.
 */
export function selloCco(tr, locale, {clase, fuente, corte, consultado}) {
  const k = clase === 'nodata' || !CLASES.has(clase) ? 'nodata' : clase;
  const hasta = diaTxt(corte, locale), cons = consultado ? new Intl.DateTimeFormat(locale, {day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC'}).format(new Date(consultado)).replace(/\./g, '') : null;
  const out = {
    clase: k === 'nodata' ? 'observed' : k, claseTxt: tr(`cco.clase.${k}`), fuente: fuente ? tr(`cco.fuente.${fuente}`) : tr('cco.nd'),
    hasta: hasta ? tr('cco.sello.hasta', {fecha: hasta}) : tr('cco.sello.sinCorte'), actualizado: cons ? tr('cco.sello.consultado', {fecha: `${cons} UTC`}) : '',
  };
  return {...out, texto: [out.claseTxt, out.fuente, out.hasta, out.actualizado].filter(Boolean).join(' · ')};
}
/** Etiqueta de un estado de datos para la insignia. */
export const ESTADOS = Object.freeze(['listo', 'salvedad', 'falta']);
export const tonoDeEstado = (e) => (e === 'listo' ? 'ok' : e === 'salvedad' ? 'warn' : 'bad');
/** Cantidad de un conteo que puede venir oculto por k-anonimato (null): «Menos de 5». */
export const conteoOculto = (n) => (n === null || n === undefined);
