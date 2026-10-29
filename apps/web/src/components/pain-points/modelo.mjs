// Formato y reglas de presentación de «Puntos de dolor» (sin React): dinero en USD bruto, volumen, periodo, clase y KPI. Desconocido se dice «Sin dato», nunca 0.
import {numero, moneda, mesCorto, formatoNum} from '../../lib/formato/idioma.mjs';
// Textos propios de este módulo puro (español canónico que fijan las pruebas, e inglés). El idioma es siempre opcional y por omisión 'es'.
export const TXT = {
  es: {sinDato: 'Sin dato', sinPeriodo: 'Sin periodo definido', devuelto: 'Dinero devuelto (libro)', pendiente: 'Walmart pendiente', negado: 'Negado o vencido', puntos: 'Puntos de dolor',
    reembolsos: 'reembolsos', solicitudes: 'solicitudes', sinCancelados: 'sin cancelados', sinCerrar: 'Reembolsos sin cerrar · proxy, no chargeback', trackerUsd: 'Tracker, USD supuesto', sinDatoN: n => `${n} sin dato (no es 0)`, todos: 'Todos con cifra',
    O: 'Observado', E: 'Estimado', I: 'Inferido'},
  en: {sinDato: 'No data', sinPeriodo: 'No period defined', devuelto: 'Money refunded, ledger', pendiente: 'Walmart pending', negado: 'Denied or expired', puntos: 'Pain points',
    reembolsos: 'refunds', solicitudes: 'requests', sinCancelados: 'excluding cancelled', sinCerrar: 'Open refunds · proxy, not a chargeback', trackerUsd: 'Tracker, USD assumed', sinDatoN: n => `${n} without data, which is not zero`, todos: 'All with a figure',
    O: 'Observed', E: 'Estimated', I: 'Inferred'},
};
const T = idioma => TXT[idioma === 'en' ? 'en' : 'es'];
export const SIN_DATO = TXT.es.sinDato;
export const CLASE_KIND = {O: 'observed', E: 'estimated', I: 'inferred'};
export const CLASE_NOMBRE = {O: 'Observado', E: 'Estimado', I: 'Inferido'};
const usdN = (minor, dec = 0, idioma) => moneda(Number(BigInt(minor)) / 100, 'USD', idioma, {currencyDisplay: 'narrowSymbol', minimumFractionDigits: dec, maximumFractionDigits: dec});
export const usd = (minor, idioma) => usdN(minor, 2, idioma);
const nf3 = formatoNum();
/** $52k, $1.2 M (es) / $1.2M (en), $850 */
export function usdCorto(minor, idioma) {
  const v = Number(BigInt(minor)) / 100, m = idioma === 'en' ? 'M' : ' M';
  if (v >= 1e6) return '$' + nf3.format(Math.round(v / 1e5) / 10) + m;
  if (v >= 1e4) return '$' + nf3.format(Math.round(v / 1000)) + 'k';
  if (v >= 1e3) return '$' + nf3.format(Math.round(v / 100) / 10) + 'k';
  return '$' + nf3.format(Math.round(v));
}
export const num = (n, idioma) => numero(n, idioma);
export const dineroTxt = (d, corto = false, idioma) => (d.sinDato ? T(idioma).sinDato : corto ? usdCorto(d.minor, idioma) : usd(d.minor, idioma));
export const volumenTxt = (v, idioma) => (v.sinDato ? T(idioma).sinDato : num(v.n, idioma) + ' ' + v.unidad);
export function mesTxt(m, idioma) { return mesCorto(m, idioma, {anio: true}) ?? String(m); }
export function periodoTxt(p, idioma) {
  if (!p) return T(idioma).sinPeriodo;
  const a = mesTxt(p.desde, idioma), b = mesTxt(p.hasta, idioma);
  return a === b ? a : a + ' – ' + b;
}
export const valorMostrado = (p, modo, idioma) => (modo === 'volumen' ? (p.volumen.sinDato ? T(idioma).sinDato : num(p.volumen.n, idioma)) : dineroTxt(p.dinero, true, idioma));
/** Etiqueta accesible completa de una burbuja. */
export const etiquetaBurbuja = (p, tema, modo, idioma) => `${tema}, ${p.nombre}, ${modo === 'volumen' ? volumenTxt(p.volumen, idioma) : p.dinero.sinDato ? T(idioma).sinDato : 'USD ' + nf3.format(Number(BigInt(p.dinero.minor)) / 100)}, ${T(idioma)[p.clase] ?? p.clase}`;
/** KPI de la tira: cada uno es un punto distinto (no se suman entre sí: comparten reembolsos). */
export function kpisDe(v, idioma) {
  const x = T(idioma), por = id => v.puntos.find(p => p.id === id);
  const p4 = por('P4'), p1 = por('P1'), p2 = por('P2');
  const dibujables = v.puntos.filter(p => !p.agregado), conCifra = dibujables.filter(p => !p.dinero.sinDato || !p.volumen.sinDato), sinCifra = dibujables.filter(p => p.dinero.sinDato && p.volumen.sinDato);
  return [
    {key: 'devuelto', label: x.devuelto, c: 2, p: p4, valor: p4 ? dineroTxt(p4.dinero, true, idioma) : x.sinDato, nota: p4 ? `${p4.volumen.sinDato ? '' : num(p4.volumen.n, idioma) + ' ' + x.reembolsos + ' · '}${x.sinCancelados}` : ''},
    {key: 'atorado', label: x.pendiente, c: 4, p: p2, valor: p2 ? dineroTxt(p2.dinero, true, idioma) : x.sinDato, nota: p2 ? x.sinCerrar : ''},
    {key: 'negado', label: x.negado, c: 6, p: p1, valor: p1 ? dineroTxt(p1.dinero, true, idioma) : x.sinDato, nota: p1 ? `${p1.volumen.sinDato ? '' : num(p1.volumen.n, idioma) + ' ' + x.solicitudes + ' · '}${x.trackerUsd}` : ''},
    {key: 'sin', label: x.puntos, c: 8, p: null, valor: String(conCifra.length), nota: sinCifra.length ? x.sinDatoN(sinCifra.length) : x.todos},
  ];
}
