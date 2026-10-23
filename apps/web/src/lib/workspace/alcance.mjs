// Alcance del espacio de trabajo en la URL: lo que la barra global muestra y lo que el menú conserva al navegar.
// Puro (sin DOM): lo prueba tests/alcance.test.mjs.
/** Claves de alcance que viajan entre pantallas. Los filtros propios de cada pantalla (q, status, cursor...) NO viajan. */
export const CLAVES_ALCANCE = Object.freeze(['date_start', 'date_end', 'currency', 'basis', 'snapshot_id', 'scope_hash', 'date_basis', 'timezone', 'exponent', 'sku', 'source']);
/** Pantallas donde el periodo cambia lo que se ve (en el resto la barra lo muestra como referencia, sin selector). */
const CON_PERIODO = ['/overview', '/problems', '/recommendations', '/explorer', '/interventions', '/briefs', '/cfo', '/refunds', '/economics', '/customers'];
export const periodoAplica = (pathname) => CON_PERIODO.some((p) => pathname === p || pathname.startsWith(p + '/'));
/** Query solo con el alcance (valores repetidos incluidos). Devuelve '' si no hay nada que conservar. */
export function consultaAlcance(raw) {
  const origen = new URLSearchParams(typeof raw === 'string' ? raw : raw?.toString?.() ?? '');
  const salida = new URLSearchParams();
  for (const clave of CLAVES_ALCANCE) for (const valor of origen.getAll(clave)) if (valor !== '') salida.append(clave, valor);
  return salida.toString();
}
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const dia = (v) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v ?? '')); if (!m) return null; const mes = Number(m[2]); if (mes < 1 || mes > 12) return null; const d = new Date(Date.UTC(Number(m[1]), mes - 1, Number(m[3]))); return Number.isNaN(d.getTime()) || d.getUTCDate() !== Number(m[3]) ? null : d; };
const etiqueta = (d, conAnio) => `${d.getUTCDate()} ${MESES[d.getUTCMonth()]}${conAnio ? ' ' + d.getUTCFullYear() : ''}`;
/** Rango legible a partir de [inicio, fin) con fin EXCLUSIVO: «1 oct – 31 oct 2026». Sin fechas válidas: null (desconocido, no inventado). */
export function periodoLegible(inicio, fin) {
  const a = dia(inicio), b = dia(fin);
  if (!a || !b || b.getTime() <= a.getTime()) return null;
  const ultimo = new Date(b.getTime() - 86400000);
  if (ultimo.getTime() === a.getTime()) return etiqueta(a, true);
  return a.getUTCFullYear() === ultimo.getUTCFullYear() ? `${etiqueta(a, false)} – ${etiqueta(ultimo, true)}` : `${etiqueta(a, true)} – ${etiqueta(ultimo, true)}`;
}
const iso = (d) => d.toISOString().slice(0, 10);
const suma = (d, n) => new Date(d.getTime() + n * 86400000);
/** Periodos rápidos [inicio, fin exclusivo) en UTC, los mismos de la barra de cada pantalla. */
export function periodosRapidos(ahora = new Date()) {
  const hoy = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate())), manana = suma(hoy, 1);
  return {
    month: [iso(new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), 1))), iso(new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth() + 1, 1)))],
    '30d': [iso(suma(manana, -30)), iso(manana)], '90d': [iso(suma(manana, -90)), iso(manana)], '12m': [iso(suma(manana, -365)), iso(manana)],
  };
}
export const ETIQUETAS_PERIODO = Object.freeze({ month: 'Este mes', '30d': '30 días', '90d': '90 días', '12m': '12 meses' });
/** Alcance leído de la URL. `hayAlcance` es false cuando la URL aún no fija periodo (la pantalla usa el último corte publicado). */
export function alcanceDeConsulta(raw, ahora = new Date()) {
  const q = new URLSearchParams(typeof raw === 'string' ? raw : raw?.toString?.() ?? '');
  const inicio = q.get('date_start'), fin = q.get('date_end');
  const legible = periodoLegible(inicio, fin);
  const rapidos = periodosRapidos(ahora);
  const clave = legible ? (Object.keys(rapidos).find((k) => rapidos[k][0] === inicio?.slice(0, 10) && rapidos[k][1] === fin?.slice(0, 10)) ?? 'custom') : null;
  return { inicio: legible ? inicio.slice(0, 10) : null, fin: legible ? fin.slice(0, 10) : null, periodo: legible, clave, moneda: /^[A-Z]{3}$/.test(q.get('currency') ?? '') ? q.get('currency') : null, base: q.get('basis') || null, snapshot: q.get('snapshot_id') || null, hayAlcance: Boolean(legible) };
}
/** URL del mismo lugar con otro periodo. Un periodo nuevo suelta la publicación fijada (snapshot_id/scope_hash/cursor), igual que los filtros de cada pantalla. */
export function consultaConPeriodo(raw, inicio, fin) {
  const q = new URLSearchParams(typeof raw === 'string' ? raw : raw?.toString?.() ?? '');
  for (const clave of ['snapshot_id', 'scope_hash', 'cursor']) q.delete(clave);
  q.set('date_start', inicio); q.set('date_end', fin);
  return q;
}
