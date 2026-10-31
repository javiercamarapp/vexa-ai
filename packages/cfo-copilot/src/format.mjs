// Formato y aritmética exacta. El dinero NUNCA pasa por Number: todo en BigInt sobre unidades menores.
import {formatMinorUnits} from '../../metrics/money.mjs';

const LOC = {es: 'es-MX', en: 'en-US'};
const loc = idioma => LOC[idioma] ?? LOC.es;
const NO_DISPONIBLE = idioma => (idioma === 'en' ? 'Not available' : 'No disponible');
export const money = (minor, currency, exponent = 2, idioma) => (minor === null || minor === undefined ? NO_DISPONIBLE(idioma) : formatMinorUnits(String(minor), currency, exponent, loc(idioma)));
// `idioma` es opcional ('es' por omisión): solo cambia la presentación (meses, símbolo %, separadores), nunca el valor numérico.
const decimal1 = idioma => new Intl.NumberFormat(loc(idioma), {minimumFractionDigits: 1, maximumFractionDigits: 1});
const pctSufijo = idioma => (idioma === 'en' ? '%' : ' %');
export const int = (n, idioma) => (n === null || n === undefined ? NO_DISPONIBLE(idioma) : new Intl.NumberFormat(loc(idioma)).format(n));
/** bps (entero, puntos base) -> «12.3 %» (en: «12.3%»). */
export const pct = (bps, idioma) => (bps === null || bps === undefined ? NO_DISPONIBLE(idioma) : decimal1(idioma).format(bps / 100) + pctSufijo(idioma));
export const signedPct = (bps, idioma) => (bps === null || bps === undefined ? NO_DISPONIBLE(idioma) : (bps > 0 ? '+' : bps < 0 ? '−' : '') + decimal1(idioma).format(Math.abs(bps) / 100) + pctSufijo(idioma));
/** Diferencia de dos tasas en puntos porcentuales. */
export const signedPp = (bps, idioma) => (bps === null || bps === undefined ? NO_DISPONIBLE(idioma) : (bps > 0 ? '+' : bps < 0 ? '−' : '') + decimal1(idioma).format(Math.abs(bps) / 100) + ' pp');
const MONTHS = {es: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'], en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']};
const months = idioma => MONTHS[idioma] ?? MONTHS.es;
export const monthLabel = (key, idioma) => (/^\d{4}-\d{2}$/.test(key) ? months(idioma)[Number(key.slice(5)) - 1] + ' ' + key.slice(0, 4) : key);
export const monthShort = (key, idioma) => (/^\d{4}-\d{2}$/.test(key) ? months(idioma)[Number(key.slice(5)) - 1] : key);

/** Cociente entero redondeado a la mitad hacia arriba (positivos). null si el divisor es 0. */
export function divRound(numerator, denominator) {
  const n = BigInt(numerator), d = BigInt(denominator);
  if (d <= 0n) return null;
  const neg = n < 0n, a = neg ? -n : n, q = (a * 2n + d) / (d * 2n);
  return neg ? -q : q;
}
/** Razón en puntos base (entero) con n/d pequeños (conteos). null si d=0. */
export const ratioBps = (n, d) => (d > 0 ? Number((BigInt(n) * 10000n * 2n + BigInt(d)) / (BigInt(d) * 2n)) : null);
/** Variación porcentual en bps entre dos cantidades BigInt/enteros (previo>0). */
export function changeBps(current, previous) {
  const c = BigInt(current), p = BigInt(previous);
  if (p <= 0n) return null;
  const diff = (c - p) * 10000n, neg = diff < 0n, a = neg ? -diff : diff, q = (a * 2n + p) / (p * 2n);
  return Number(neg ? -q : q);
}
const axisCompact = idioma => new Intl.NumberFormat(loc(idioma), {notation: 'compact', maximumFractionDigits: 1});
/** Etiqueta compacta de eje para un importe en unidades menores (centavos): divide entre 10^exponent para coincidir con tarjeta y tooltip. exponent=0 si el valor ya está en unidades mayores o es un conteo. */
export const axisLabel = (value, exponent = 0, idioma) => axisCompact(idioma).format(Number(value) / 10 ** exponent);
export const baseOf = basis => String(basis ?? '').split('|')[0];
export const toReviewBasis = basis => String(basis ?? '').includes('|a_revisar');
