// Formato y reglas de presentación de «Puntos de dolor» (sin React): dinero en USD bruto, volumen, periodo, clase y KPI. Desconocido se dice «Sin dato», nunca 0.
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const SIN_DATO = 'Sin dato';
export const CLASE_KIND = {O: 'observed', E: 'estimated', I: 'inferred'};
export const CLASE_NOMBRE = {O: 'Observado', E: 'Estimado', I: 'Inferido'};
const usdN = (minor, dec = 0) => new Intl.NumberFormat('es-MX', {style: 'currency', currency: 'USD', currencyDisplay: 'narrowSymbol', minimumFractionDigits: dec, maximumFractionDigits: dec}).format(Number(BigInt(minor)) / 100);
export const usd = minor => usdN(minor, 2);
/** $52k, $1.2M, $850 */
export function usdCorto(minor) {
  const v = Number(BigInt(minor)) / 100;
  if (v >= 1e6) return '$' + (Math.round(v / 1e5) / 10).toLocaleString('es-MX') + ' M';
  if (v >= 1e4) return '$' + Math.round(v / 1000).toLocaleString('es-MX') + 'k';
  if (v >= 1e3) return '$' + (Math.round(v / 100) / 10).toLocaleString('es-MX') + 'k';
  return '$' + Math.round(v).toLocaleString('es-MX');
}
export const num = n => new Intl.NumberFormat('es-MX').format(n);
export const dineroTxt = (d, corto = false) => (d.sinDato ? SIN_DATO : corto ? usdCorto(d.minor) : usd(d.minor));
export const volumenTxt = v => (v.sinDato ? SIN_DATO : num(v.n) + ' ' + v.unidad);
export function mesTxt(m) { const [y, mo] = String(m).split('-').map(Number); return MESES[mo - 1] ? `${MESES[mo - 1]} ${y}` : String(m); }
export function periodoTxt(p) {
  if (!p) return 'Sin periodo definido';
  const a = mesTxt(p.desde), b = mesTxt(p.hasta);
  return a === b ? a : a + ' – ' + b;
}
export const valorMostrado = (p, modo) => (modo === 'volumen' ? (p.volumen.sinDato ? SIN_DATO : num(p.volumen.n)) : dineroTxt(p.dinero, true));
/** Etiqueta accesible completa de una burbuja. */
export const etiquetaBurbuja = (p, tema, modo) => `${tema}, ${p.nombre}, ${modo === 'volumen' ? volumenTxt(p.volumen) : p.dinero.sinDato ? SIN_DATO : 'USD ' + (Number(BigInt(p.dinero.minor)) / 100).toLocaleString('es-MX')}, ${CLASE_NOMBRE[p.clase]}`;
/** KPI de la tira: cada uno es un punto distinto (no se suman entre sí: comparten reembolsos). */
export function kpisDe(v) {
  const por = id => v.puntos.find(p => p.id === id);
  const p4 = por('P4'), p1 = por('P1'), p2 = por('P2');
  const dibujables = v.puntos.filter(p => !p.agregado), conCifra = dibujables.filter(p => !p.dinero.sinDato || !p.volumen.sinDato), sinCifra = dibujables.filter(p => p.dinero.sinDato && p.volumen.sinDato);
  return [
    {key: 'devuelto', label: 'Dinero devuelto (libro)', c: 2, p: p4, valor: p4 ? dineroTxt(p4.dinero, true) : SIN_DATO, nota: p4 ? `${p4.volumen.sinDato ? '' : num(p4.volumen.n) + ' reembolsos · '}sin cancelados` : ''},
    {key: 'atorado', label: 'Walmart pendiente', c: 4, p: p2, valor: p2 ? dineroTxt(p2.dinero, true) : SIN_DATO, nota: p2 ? 'Reembolsos sin cerrar · proxy, no chargeback' : ''},
    {key: 'negado', label: 'Negado o vencido', c: 6, p: p1, valor: p1 ? dineroTxt(p1.dinero, true) : SIN_DATO, nota: p1 ? `${p1.volumen.sinDato ? '' : num(p1.volumen.n) + ' solicitudes · '}Tracker, USD supuesto` : ''},
    {key: 'sin', label: 'Puntos de dolor', c: 8, p: null, valor: String(conCifra.length), nota: sinCifra.length ? `${sinCifra.length} sin dato (no es 0)` : 'Todos con cifra'},
  ];
}
