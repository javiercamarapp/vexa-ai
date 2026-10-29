// UN solo helper de formato por idioma para cifras, fechas y horas de la interfaz: es-MX en español y en-US en inglés.
// Solo cambia la presentación (separadores, nombres de mes, orden), nunca el valor. Las fechas se leen en UTC, como el resto de la app;
// las monedas conservan su código (USD, MXN...). Núcleo puro (sin Next ni React): lo usan servidor, componentes, módulos .mjs y pruebas.
export const LOCALES = Object.freeze({es: 'es-MX', en: 'en-US'});
/** Locale de Intl del idioma; cualquier valor desconocido cae en español (el idioma canónico de las pruebas). */
export const localeDe = (idioma) => (idioma === 'en' ? LOCALES.en : LOCALES.es);

/**
 * Formateador de números SIN letras ni símbolos que dependan del idioma (enteros y decimales): es-MX y en-US comparten coma de miles y punto decimal
 * (lo fija la prueba tests/formato-idioma.test.ts), así que un formateador de módulo sirve a los dos idiomas. Lo que sí cambia con el idioma
 * (nombres de mes, «%», abreviaturas compactas, moneda) va por las funciones de abajo con el idioma activo.
 */
export const formatoNum = (opciones) => new Intl.NumberFormat(LOCALES.es, opciones);
export const nf = formatoNum();

const memoNum = new Map(), memoFecha = new Map();
const nfDe = (idioma, opciones) => { const k = localeDe(idioma) + JSON.stringify(opciones ?? {}); let f = memoNum.get(k); if (!f) { f = new Intl.NumberFormat(localeDe(idioma), opciones); memoNum.set(k, f); } return f; };
const dfDe = (idioma, opciones) => { const k = localeDe(idioma) + JSON.stringify(opciones); let f = memoFecha.get(k); if (!f) { f = new Intl.DateTimeFormat(localeDe(idioma), {timeZone: 'UTC', ...opciones}); memoFecha.set(k, f); } return f; };
/** Reloj del idioma: 12 horas con AM/PM en inglés, 24 horas en español de México. */
const ciclo = (idioma) => (idioma === 'en' ? 'h12' : 'h23');
const sinPunto = (s) => s.replace('.', '');
const nulo = (v) => v === null || v === undefined || v === '' || (typeof v === 'number' && !Number.isFinite(v));
/** Instante a partir de AAAA-MM-DD (se lee a mediodía UTC: sin saltos de día por zona), ISO completo, Date o epoch. Inválido: null. */
export function aFecha(valor) {
  if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? null : valor;
  if (nulo(valor)) return null;
  const texto = String(valor), d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(texto) ? texto + 'T12:00:00Z' : typeof valor === 'number' ? valor : texto);
  return Number.isNaN(d.getTime()) ? null : d;
}
const deMes = (m) => (/^\d{4}-\d{2}$/.test(String(m ?? '')) ? new Date(m + '-01T00:00:00Z') : null);

/** Número con separadores del idioma: 1234567.5 -> «1,234,567.5» (ambos idiomas usan coma de miles y punto decimal en es-MX y en-US). */
export const numero = (n, idioma, opciones) => (nulo(n) ? '—' : nfDe(idioma, opciones).format(n));
/** Número compacto: 1_200_000 -> «1.2M» (en) / «1.2 M» (es). */
export const compacto = (n, idioma, decimales = 1) => (nulo(n) ? '—' : nfDe(idioma, {notation: 'compact', maximumFractionDigits: decimales}).format(n));
/** Porcentaje con signo opcional: (12.34, 'en') -> «12.3%» (en) / «12.3 %» (es). Recibe el valor ya en puntos porcentuales. */
export function porcentaje(p, idioma, {decimales = 1, conSigno = false} = {}) {
  if (nulo(p)) return '—';
  const cuerpo = nfDe(idioma, {minimumFractionDigits: decimales, maximumFractionDigits: decimales}).format(Math.abs(p));
  return `${p < 0 ? '−' : conSigno && p > 0 ? '+' : ''}${cuerpo}${idioma === 'en' ? '%' : ' %'}`;
}
/** Importe en unidades mayores con el código de la moneda: (1200, 'MXN', 'en') -> «MX$1,200.00» o «MXN 1,200.00» según Intl; el código no se convierte. */
export const moneda = (n, codigo, idioma, opciones) => (nulo(n) ? '—' : nfDe(idioma, {style: 'currency', currency: codigo, ...opciones}).format(n));

/** «2026-09» -> «September 2026» / «septiembre de 2026». */
export const mesLargo = (m, idioma) => { const d = deMes(m); return d ? dfDe(idioma, {month: 'long', year: 'numeric'}).format(d) : null; };
/** «2026-09» -> «Sep» / «sep» (sin punto); con {anio:true}: «Sep 2026» / «sep 2026». */
export const mesCorto = (m, idioma, {anio = false} = {}) => { const d = deMes(m); return d ? sinPunto(dfDe(idioma, anio ? {month: 'short', year: 'numeric'} : {month: 'short'}).format(d)) : null; };
/** «2026-09-18» -> «September 18» / «18 de septiembre»; con {largo:false}: «Sep 18» / «18 sep». */
export const diaMes = (v, idioma, {largo = true} = {}) => { const d = aFecha(v); return d ? sinPunto(dfDe(idioma, {day: 'numeric', month: largo ? 'long' : 'short'}).format(d)) : null; };
/** Fecha corta con año: «Sep 18, 2026» / «18 sep 2026». */
export const fechaCorta = (v, idioma) => { const d = aFecha(v); return d ? sinPunto(dfDe(idioma, {day: 'numeric', month: 'short', year: 'numeric'}).format(d)) : null; };
/** Fecha y hora UTC: «Sep 18, 2026, 08:05 PM» / «18 sep 2026, 20:05». */
export const fechaHora = (v, idioma) => { const d = aFecha(v); return d ? sinPunto(dfDe(idioma, {day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: ciclo(idioma)}).format(d)) : null; };
/** Día y hora sin año: «Sep 18, 08:05 PM» / «18 sep, 20:05». */
export const diaHora = (v, idioma) => { const d = aFecha(v); return d ? sinPunto(dfDe(idioma, {day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: ciclo(idioma)}).format(d)) : null; };
/** Duración en milisegundos: 850 -> «850 ms»; 2400 -> «2.4 s». */
export const duracionMs = (ms, idioma) => (nulo(ms) ? '' : ms < 1000 ? `${numero(ms, idioma)} ms` : `${nfDe(idioma, {maximumFractionDigits: 1}).format(ms / 1000)} s`);
