// Mes completo / parcial / sin datos para las herramientas del agente. Reutiliza el criterio ÚNICO de packages/metrics/complete-months.mjs
// (el mismo del Resumen y de /cfo): un mes es comparable solo si es anterior al mes en curso y el último dato cargado llega a su último día.
// El umbral es ese: 100 % de los días del mes. Un mes con menos NO se compara (ni con un 79 % ni con un 99 %): se rotula «mes incompleto: no comparable».
import { esMesCompleto } from '../metrics/complete-months.mjs';

export const NO_COMPARABLE = 'mes incompleto: no comparable';
const MES_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const diaIso = (v) => { if (v === null || v === undefined) return null; const t = Date.parse(String(v)); return Number.isFinite(t) ? new Date(t).toISOString().slice(0, 10) : null; };
const largo = (iso) => new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(iso + 'T00:00:00Z'));
const diasDelMes = (m) => { const [y, mo] = m.split('-').map(Number); return new Date(Date.UTC(y, mo, 0)).getUTCDate(); };

/** @returns {{estado:'completo'|'parcial'|'sin_datos', dataThrough:string|null, cubierto:number|null}} `cubierto` = % de días del mes con datos (entero, solo si el corte cae dentro del mes). */
export function estadoMes(month, completeness, ahora = new Date()) {
  const dt = diaIso(completeness?.dataThrough ?? null);
  if (!MES_RE.test(month)) return { estado: 'sin_datos', dataThrough: dt, cubierto: null };
  if (esMesCompleto(month, { dataThrough: dt, ahora })) return { estado: 'completo', dataThrough: dt, cubierto: 100 };
  const corte = dt ? dt.slice(0, 7) : ahora.toISOString().slice(0, 7);
  if (month > corte) return { estado: 'sin_datos', dataThrough: dt, cubierto: 0 };
  return { estado: 'parcial', dataThrough: dt, cubierto: dt && dt.slice(0, 7) === month ? Math.floor((Number(dt.slice(8)) * 100) / diasDelMes(month)) : null };
}
export const comparables = (...estados) => estados.every((e) => e.estado === 'completo');
/** Detalle entre paréntesis: hasta qué fecha llegan los datos y qué parte del mes cubren. */
export function detalleMes(st) {
  const hasta = st.dataThrough ? `datos hasta el ${largo(st.dataThrough)}` : 'sin fecha de corte verificable: se trata como en curso';
  return st.estado === 'parcial' && st.cubierto !== null ? `${hasta}, ${st.cubierto} % del mes` : hasta;
}
/** Frase de advertencia para un mes (la que ve el cliente). */
export function avisoMes(label, st) {
  if (st.estado === 'completo') return null;
  if (st.estado === 'sin_datos') return `${label}: sin datos cargados (${detalleMes(st)}); no es cero, es dato ausente`;
  return `${label}: ${NO_COMPARABLE} (${detalleMes(st)})`;
}
