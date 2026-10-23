// UNA sola función de formato es-MX para todas las pantallas (Resumen, CFO, Fuga, Brechas, Problemas, Dinero).
// Misma cifra + mismo periodo => mismo texto. Reglas: miles con coma y decimal con punto (es-MX), un decimal en porcentajes, signo «−» (U+2212),
// redondeo simétrico (mitad alejándose de cero) y fechas siempre en UTC. null/undefined => «—», nunca 0 (unknown ≠ 0).
export const VACIO = '—';
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const ENTERO = new Intl.NumberFormat('es-MX', {maximumFractionDigits: 0});
const UN_DECIMAL = new Intl.NumberFormat('es-MX', {minimumFractionDigits: 1, maximumFractionDigits: 1});
const DOS_DECIMALES = new Intl.NumberFormat('es-MX', {minimumFractionDigits: 2, maximumFractionDigits: 2});
const SIN_DECIMALES_USD = new Intl.NumberFormat('es-MX', {maximumFractionDigits: 0});
const nulo = (v) => v === null || v === undefined || v === '' || (typeof v === 'number' && !Number.isFinite(v));

/** Entero con miles: 104024 -> «104,024». */
export const entero = (n) => (nulo(n) ? VACIO : ENTERO.format(n));
/** Redondeo a n decimales con la mitad alejándose de cero (Math.round redondea -29.35 hacia +∞: de ahí «29.3 %» vs «−29.4 %»). */
export function redondear(x, decimales = 1) { const f = 10 ** decimales; return Math.sign(x) * Math.round(Math.abs(x) * f + 1e-9) / f; }
const signo = (x, mas) => (x < 0 ? '−' : x > 0 && mas ? '+' : '');
/** Porcentaje con un decimal: 29.3 -> «29.3 %»; con {conSigno:true} -> «+29.3 %» / «−29.3 %». */
export function porcentaje(p, {conSigno = false} = {}) {
  if (nulo(p)) return VACIO;
  const r = redondear(p, 1);
  return `${signo(r, conSigno)}${UN_DECIMAL.format(Math.abs(r))} %`;
}
/** Parte de un todo en %, un decimal; null si el todo no es positivo. */
export const proporcion = (parte, todo) => (todo > 0 ? redondear((parte * 100) / todo, 1) : null);

/**
 * Variación porcentual exacta entre dos enteros (BigInt) en DÉCIMAS de punto porcentual, con redondeo simétrico.
 * null si no hay base honesta (anterior <= 0). Es la ÚNICA definición de «cambio vs mes anterior»: Resumen, Caída de ingresos, CFO y Brechas la usan.
 */
export function variacionDecimas(actual, anterior) {
  let a, b; try { a = BigInt(actual); b = BigInt(anterior); } catch { return null; }
  if (b <= 0n) return null;
  const num = (a - b) * 1000n, neg = num < 0n, abs = neg ? -num : num;
  const q = (abs * 2n + b) / (2n * b); // mitad alejándose de cero
  return Number(neg ? -q : q);
}
/** Texto de la variación («−29.4 %»); con diferencia real menor a 0.05 pt no se muestra «0.0 %» engañoso. */
export function variacionTexto(actual, anterior, {conSigno = true} = {}) {
  const d = variacionDecimas(actual, anterior);
  if (d === null) return VACIO;
  if (d === 0 && BigInt(actual) !== BigInt(anterior)) return `${BigInt(actual) > BigInt(anterior) ? (conSigno ? '+' : '') : '−'}0.1 %`;
  return porcentaje(d / 10, {conSigno});
}

/** Dólares desde centavos (string|number|bigint): «[omitido: dato de cliente]»; con {decimales:true} «[omitido: dato de cliente]». Negativo: «−$1,234». */
export function usd(minor, {decimales = false} = {}) {
  if (nulo(minor)) return VACIO;
  const c = BigInt(String(minor).split('.')[0]), neg = c < 0n, abs = neg ? -c : c;
  const v = Number(abs) / 100;
  return `${neg ? '−' : ''}$${(decimales ? DOS_DECIMALES : SIN_DECIMALES_USD).format(v)}`;
}

// Fechas: ISO (AAAA-MM-DD[...]) leído como texto, jamás con la zona del navegador: la misma fecha de corte da el mismo día en todas las pantallas.
const ISO = /^(\d{4})-(\d{2})-(\d{2})/;
/** «2026-09-18T20:00:00Z» -> «18 sep 2026». */
export function dia(iso) { const m = ISO.exec(String(iso ?? '')); return m && Number(m[2]) >= 1 && Number(m[2]) <= 12 ? `${Number(m[3])} ${MESES_CORTOS[Number(m[2]) - 1]} ${m[1]}` : null; }
/** «2026-09» -> «sep 2026». */
export function mes(m) { const [y, mo] = String(m ?? '').split('-').map(Number); return MESES_CORTOS[mo - 1] ? `${MESES_CORTOS[mo - 1]} ${y}` : null; }
/** Día de corte (AAAA-MM-DD) tomado de un instante ISO en UTC: la clave comparable entre pantallas para «datos hasta». */
export function diaDeCorte(valor) { if (nulo(valor)) return null; const t = valor instanceof Date ? valor.toISOString() : String(valor); const m = ISO.exec(t); return m ? m[0] : null; }
