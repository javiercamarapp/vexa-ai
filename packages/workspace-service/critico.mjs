// UNA sola definición de «crítico» para Resumen, Problemas, Brief y recomendaciones. Módulo puro (sin red, base ni React).
//
// Señal crítica = una EVIDENCIA (cita) de una conversación cuya extracción la IA marcó con severidad alta o crítica,
//   o cuya categoría es de seguridad, privacidad, fraude o fuego. Se cuenta sin importar el importe.
// Grupo con revisión crítica = un GRUPO DE PROBLEMAS (un problema del catálogo) con al menos una señal crítica.
//
// Por qué un grupo de severidad «Baja» puede tener una señal crítica: la severidad del grupo es la registrada para el grupo entero
// (resume muchas conversaciones); la revisión crítica se activa con UNA sola conversación crítica, aunque el resto sea leve.
// Por eso la tabla muestra el motivo y «N de M conversaciones», y la severidad del grupo no se reescribe.
export const SEVERIDADES_CRITICAS = Object.freeze(['high', 'critical']);
export const CATEGORIA_CRITICA_FUENTE = 'safety|privacy|fraud|seguridad|privacidad|humo|smoke|fire|incendio|quemadura|injur|burn';
export const CATEGORIA_CRITICA = new RegExp(CATEGORIA_CRITICA_FUENTE, 'i');

export const DEFINICION = Object.freeze({
  senal: 'Señal crítica: una evidencia (cita) de una conversación marcada por la IA con severidad alta o crítica, o de una categoría de seguridad, privacidad, fraude o fuego. Se cuenta sin importar el importe.',
  grupo: 'Grupo con revisión crítica: un grupo de problemas con al menos una señal crítica. Basta una conversación crítica para pedir revisión, por eso un grupo de severidad baja puede tenerla.',
});

/** Una fila {severity, category} (de una extracción) es señal crítica. */
export const esSenalCritica = r => SEVERIDADES_CRITICAS.includes(r?.severity) || CATEGORIA_CRITICA.test(r?.category ?? '');
/** 'severity' | 'category' | 'both' | null: por qué la fila es crítica. */
export function motivoSenal(r) {
  const sev = SEVERIDADES_CRITICAS.includes(r?.severity), cat = CATEGORIA_CRITICA.test(r?.category ?? '');
  return sev && cat ? 'both' : sev ? 'severity' : cat ? 'category' : null;
}
/** Resume las filas {pid,category,severity,spans} que ya leyó el cálculo de señales: grupos críticos (por pid), evidencias críticas y motivo por grupo. */
export function resumirSenales(filas) {
  const por = new Map();
  for (const r of filas ?? []) {
    const m = motivoSenal(r);
    if (!m) continue;
    const g = por.get(r.pid) ?? {signals: 0, severity: false, category: false};
    g.signals += Number(r.spans) || 0;
    if (m === 'severity' || m === 'both') g.severity = true;
    if (m === 'category' || m === 'both') g.category = true;
    por.set(r.pid, g);
  }
  let senales = 0;
  for (const g of por.values()) senales += g.signals;
  const motivo = g => (g.severity && g.category ? 'both' : g.severity ? 'severity' : 'category');
  return {grupos: por.size, senales, porGrupo: new Map([...por].map(([pid, g]) => [pid, {signals: g.signals, reason: motivo(g)}]))};
}
const nf = n => new Intl.NumberFormat('es-MX').format(n);
const plural = (n, uno, varios) => `${nf(n)} ${n === 1 ? uno : varios}`;
/** Frase única con unidades: «53 grupos de problemas con revisión crítica (120 señales críticas, evidencias)». */
export function fraseCriticos({grupos, senales = null}) {
  const g = plural(grupos, 'grupo de problemas con revisión crítica', 'grupos de problemas con revisión crítica');
  return senales === null || senales === undefined ? g : `${g} (${plural(senales, 'señal crítica, evidencia', 'señales críticas, evidencias')})`;
}
export const etiquetaMotivo = m => m === 'both' ? 'severidad alta o crítica y categoría sensible' : m === 'severity' ? 'una conversación con severidad alta o crítica' : m === 'category' ? 'categoría de seguridad, privacidad, fraude o fuego' : null;
