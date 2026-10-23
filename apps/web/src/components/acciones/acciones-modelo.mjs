// Modelo PURO de la pantalla Acciones (Por decidir | En curso | Resultados): agrupa por etapa REAL (estado guardado + eventos), cuenta y arma las
// listas de apoyo. No inventa nada: sin evento no hay etapa, sin dato observado no hay cifra y un desconocido es null (nunca 0).
import {etapaActual} from '../../../../../packages/recommendations/flujo.mjs';

export const GRUPO_DE_ETAPA = Object.freeze({propuesta: 'decidir', ajustada: 'decidir', aprobada: 'curso', en_curso: 'curso', resultado: 'resultado', descartada: 'descartada'});
export const VISTAS = Object.freeze(['por-decidir', 'en-curso', 'resultados']);
export const GRUPO_DE_VISTA = Object.freeze({'por-decidir': 'decidir', 'en-curso': 'curso', resultados: 'resultado'});
const eventosDe = i => i?.flow?.events ?? [];
export const etapaDe = i => etapaActual(i, eventosDe(i));
export const grupoDe = i => GRUPO_DE_ETAPA[etapaDe(i)] ?? 'decidir';
const dia = ms => Math.floor(ms / 86400000);

/** Agrupa las acciones por etapa. Descartadas aparte (se pueden reabrir). */
export function agrupar(items) {
  const g = {decidir: [], curso: [], resultado: [], descartada: []};
  for (const i of items ?? []) g[grupoDe(i)].push(i);
  return g;
}

/** Filtros de la barra: responsable (id | '' | 'sin') y prioridad (critical|high|normal|''). */
export function filtrar(items, {responsable = '', prioridad = ''} = {}) {
  return (items ?? []).filter(i => {
    const dueno = (eventosDe(i).find(e => e.kind === 'approved')?.ownerId) ?? i.ownerId ?? null;
    if (responsable === 'sin' && dueno) return false;
    if (responsable && responsable !== 'sin' && dueno !== responsable) return false;
    return !prioridad || i.priority === prioridad;
  });
}

/** Cuentas de las tres vistas y de sus indicadores. `hoy` solo sirve para vencimientos (se pasa para poder probar). */
export function resumir(items, hoy = new Date()) {
  const g = agrupar(items), h = dia(hoy.getTime());
  const prio = k => g.decidir.filter(i => i.priority === k).length;
  const aprobada = i => eventosDe(i).find(e => e.kind === 'approved');
  const vence = i => { const d = aprobada(i)?.dueDate; return d ? dia(new Date(d + 'T12:00:00Z').getTime()) - h : null; };
  const resultados = g.resultado.map(i => eventosDe(i).find(e => e.kind === 'resolved')).filter(Boolean);
  const conDias = g.curso.map(vence).filter(v => v !== null);
  return {
    total: (items ?? []).length,
    decidir: {n: g.decidir.length, urgentes: prio('critical'), altas: prio('high'), normales: prio('normal'), sinResponsable: g.decidir.filter(i => !i.ownerId).length, citas: g.decidir.reduce((a, i) => a + (i.evidenceCount ?? 0), 0)},
    curso: {n: g.curso.length, aprobadas: g.curso.filter(i => etapaDe(i) === 'aprobada').length, enCurso: g.curso.filter(i => etapaDe(i) === 'en_curso').length, vencidas: conDias.filter(d => d < 0).length, proximas: conDias.filter(d => d >= 0 && d <= 7).length, sinFecha: g.curso.length - conDias.length},
    resultado: {n: g.resultado.length, si: resultados.filter(e => e.outcome === 'yes').length, parcial: resultados.filter(e => e.outcome === 'partial').length, no: resultados.filter(e => e.outcome === 'no').length, conComparacion: resultados.filter(e => e.comparison).length},
    descartadas: g.descartada.length,
  };
}

/** Últimos movimientos (aprobar, ajustar, poner en curso, resultado, descartar) de más nuevo a más viejo. */
export function actividadReciente(items, limite = 6) {
  const out = [], TXT = {approved: 'Aprobada', adjusted: 'Ajustada', started: 'Puesta en curso', resolved: 'Resultado registrado'};
  for (const i of items ?? []) {
    for (const e of eventosDe(i)) out.push({clave: 'e' + e.id, cuando: e.createdAt, tipo: e.kind, titulo: TXT[e.kind] ?? e.kind, accionId: i.id, titulo2: i.title});
    const h = [...(i.history ?? [])].sort((a, b) => a.version - b.version);
    h.forEach((v, k) => { if (k && v.status === 'dismissed' && h[k - 1].status !== 'dismissed') out.push({clave: 'd' + i.id + v.version, cuando: v.createdAt, tipo: 'dismissed', titulo: 'Descartada', accionId: i.id, titulo2: i.title}); });
  }
  return out.sort((a, b) => (a.cuando < b.cuando ? 1 : a.cuando > b.cuando ? -1 : 0)).slice(0, limite);
}

/** Citas verificadas por acción (para la lista de evidencia). */
export const evidenciaPorAccion = items => (items ?? []).map(i => ({id: i.id, titulo: i.title, citas: i.evidenceCount ?? 0, prioridad: i.priority})).sort((a, b) => b.citas - a.citas);

/** Comparación antes/después por acción con resultado: solo con dato observado en ambos periodos; si no, null (sin barra, con la razón). */
export function comparaciones(items) {
  return (items ?? []).filter(i => grupoDe(i) === 'resultado').map(i => {
    const r = eventosDe(i).find(e => e.kind === 'resolved'), c = r?.comparison ?? null;
    const n = v => (typeof v === 'string' && /^-?\d{1,15}$/.test(v) ? Number(v) / Math.pow(10, c?.exponente ?? 2) : null);
    return {id: i.id, titulo: i.title, resultado: r?.outcome ?? null, antes: c ? n(c.antesMinor) : null, despues: c ? n(c.despuesMinor) : null, moneda: c?.moneda ?? null, completa: c?.completa ?? false};
  });
}
