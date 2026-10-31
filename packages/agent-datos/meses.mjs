// Mes completo / parcial / sin datos para las herramientas del agente. Reutiliza el criterio ÚNICO de packages/metrics/complete-months.mjs
// (el mismo del Resumen y de /cfo): un mes es comparable solo si es anterior al mes en curso y el último dato cargado llega a su último día.
// El umbral es ese: 100 % de los días del mes. Un mes con menos NO se compara (ni con un 79 % ni con un 99 %): se rotula «mes incompleto: no comparable».
import { esMesCompleto } from '../metrics/complete-months.mjs';

export const NO_COMPARABLE = 'mes incompleto: no comparable';
export const NO_COMPARABLE_EN = 'incomplete month: not comparable';
const loc = (idioma) => (idioma === 'en' ? 'en-US' : 'es-MX');
const MES_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const diaIso = (v) => { if (v === null || v === undefined) return null; const t = Date.parse(String(v)); return Number.isFinite(t) ? new Date(t).toISOString().slice(0, 10) : null; };
const largo = (iso, idioma = 'es') => new Intl.DateTimeFormat(loc(idioma), { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(iso + 'T00:00:00Z'));
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
const UMBRAL_DENSIDAD = 0.25;
/** Estados por mes de una serie de conteos. Un mes «completo» por fecha cuyo volumen es < 25 % de la mediana de los demás meses completos (≥ 2) se trata como parcial por cobertura baja:
 *  probablemente la carga de ese mes está incompleta. Heurística explícita y rotulada; nunca emite 0 ni variación %. */
export function estadosDeSerie(series, completeness, ahora = new Date()) {
  const base = (series ?? []).map((x) => ({ x, st: estadoMes(x.month, completeness, ahora) }));
  const completos = base.filter((b) => b.st.estado === 'completo').map((b) => Number(b.x.count)).filter(Number.isFinite);
  return new Map(base.map(({ x, st }) => {
    const otros = completos.filter((n, i, arr) => !(n === Number(x.count) && arr.indexOf(n) === i));
    if (st.estado !== 'completo' || otros.length < 2) return [x.month, st];
    const o = [...otros].sort((p, q) => p - q), med = o.length % 2 ? o[(o.length - 1) / 2] : (o[o.length / 2 - 1] + o[o.length / 2]) / 2;
    return med > 0 && Number(x.count) < UMBRAL_DENSIDAD * med ? [x.month, { ...st, estado: 'parcial', baja: true, proporcion: Math.round((Number(x.count) * 100) / med) }] : [x.month, st];
  }));
}
export const comparables = (...estados) => estados.every((e) => e.estado === 'completo');
/** Detalle entre paréntesis: hasta qué fecha llegan los datos y qué parte del mes cubren. */
export function detalleMes(st, idioma = 'es') {
  const en = idioma === 'en';
  if (st.baja) return en ? `low coverage: the month's volume is ≈ ${st.proporcion}% of the usual; the load may be incomplete` : `cobertura baja: el volumen del mes es ≈ ${st.proporcion} % del habitual; posible carga incompleta`;
  const hasta = st.dataThrough ? (en ? `data through ${largo(st.dataThrough, idioma)}` : `datos hasta el ${largo(st.dataThrough)}`) : (en ? 'no verifiable cutoff date: treated as in progress' : 'sin fecha de corte verificable: se trata como en curso');
  return st.estado === 'parcial' && st.cubierto !== null ? (en ? `${hasta}, ${st.cubierto}% of the month` : `${hasta}, ${st.cubierto} % del mes`) : hasta;
}
/** Frase de advertencia para un mes (la que ve el cliente). */
export function avisoMes(label, st, idioma = 'es') {
  if (st.estado === 'completo') return null;
  if (idioma === 'en') return st.estado === 'sin_datos' ? `${label}: no data loaded (${detalleMes(st, idioma)}); it is not zero, the data is absent` : `${label}: ${NO_COMPARABLE_EN} (${detalleMes(st, idioma)})`;
  if (st.estado === 'sin_datos') return `${label}: sin datos cargados (${detalleMes(st)}); no es cero, es dato ausente`;
  return `${label}: ${NO_COMPARABLE} (${detalleMes(st)})`;
}

const etiquetaMes = (m, idioma = 'es') => new Intl.DateTimeFormat(loc(idioma), { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(m + '-01T00:00:00Z'));
const mesAnterior = (m) => { const [y, mo] = m.split('-').map(Number); const t = y * 12 + (mo - 1) - 1; return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`; };
/**
 * «Este mes» sin mes explícito: el mes en curso casi nunca tiene datos completos (A4, 23-oct: octubre sin datos, septiembre parcial, y la pregunta
 * estrella respondía «No tengo ese dato»). Se resuelve al último mes COMPLETO con datos (mismo criterio único de estadoMes) y se dice qué se saltó.
 * Sin fecha de corte verificable no se inventa nada: se conserva el mes en curso.
 * @returns {{month:string, nota:string|null, resuelto:boolean}}
 */
export function mesPorDefecto(completeness, ahora = new Date(), idioma = 'es') {
  const en = idioma === 'en', etiquetaMes_ = (m) => etiquetaMes(m, idioma);
  const actual = ahora.toISOString().slice(0, 7), dt = diaIso(completeness?.dataThrough ?? null);
  if (!dt) return { month: actual, nota: null, resuelto: false };
  const mesDato = dt.slice(0, 7), saltos = [];
  if (actual > mesDato) saltos.push(en ? `${etiquetaMes_(actual)} has no data yet` : `${etiquetaMes(actual)} aún no tiene datos`);
  let m = mesDato < actual ? mesDato : actual;
  for (let i = 0; i < 24 && estadoMes(m, completeness, ahora).estado !== 'completo'; i++) {
    const st = estadoMes(m, completeness, ahora);
    if (st.estado === 'parcial') saltos.push(en ? `${etiquetaMes_(m)} is partial` : `${etiquetaMes(m)} está parcial`);
    m = mesAnterior(m);
  }
  const nota = `${[...saltos, en ? `using ${etiquetaMes_(m)}` : `uso ${etiquetaMes(m)}`].join('; ')}`;
  return { month: m, nota: m === actual ? null : nota.charAt(0).toUpperCase() + nota.slice(1), resuelto: m !== actual };
}
