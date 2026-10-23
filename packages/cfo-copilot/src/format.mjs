// Formato y aritmética exacta. El dinero NUNCA pasa por Number: todo en BigInt sobre unidades menores.
import {formatMinorUnits} from '../../metrics/money.mjs';

export const money = (minor, currency, exponent = 2) => (minor === null || minor === undefined ? 'No disponible' : formatMinorUnits(String(minor), currency, exponent));
export const int = n => (n === null || n === undefined ? 'No disponible' : new Intl.NumberFormat('es-MX').format(n));
const oneDecimal = new Intl.NumberFormat('es-MX', {minimumFractionDigits: 1, maximumFractionDigits: 1});
/** bps (entero, puntos base) -> «12.3 %». */
export const pct = bps => (bps === null || bps === undefined ? 'No disponible' : oneDecimal.format(bps / 100) + ' %');
export const signedPct = bps => (bps === null || bps === undefined ? 'No disponible' : (bps > 0 ? '+' : bps < 0 ? '−' : '') + oneDecimal.format(Math.abs(bps) / 100) + ' %');
/** Diferencia de dos tasas en puntos porcentuales. */
export const signedPp = bps => (bps === null || bps === undefined ? 'No disponible' : (bps > 0 ? '+' : bps < 0 ? '−' : '') + oneDecimal.format(Math.abs(bps) / 100) + ' pp');
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const monthLabel = key => (/^\d{4}-\d{2}$/.test(key) ? MONTHS[Number(key.slice(5)) - 1] + ' ' + key.slice(0, 4) : key);
export const monthShort = key => (/^\d{4}-\d{2}$/.test(key) ? MONTHS[Number(key.slice(5)) - 1] : key);

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
const axisCompact = new Intl.NumberFormat('es-MX', {notation: 'compact', maximumFractionDigits: 1});
/** Etiqueta compacta de eje para un importe en unidades menores (centavos): divide entre 10^exponent para coincidir con tarjeta y tooltip. exponent=0 si el valor ya está en unidades mayores o es un conteo. */
export const axisLabel = (value, exponent = 0) => axisCompact.format(Number(value) / 10 ** exponent);
export const baseOf = basis => String(basis ?? '').split('|')[0];
export const toReviewBasis = basis => String(basis ?? '').includes('|a_revisar');
