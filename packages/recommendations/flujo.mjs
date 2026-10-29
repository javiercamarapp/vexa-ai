// Dominio PURO del flujo de aprobación de recomendaciones (sin red, sin base de datos, sin React). V1: un humano decide; nada se ejecuta solo.
// Etapas visibles: propuesta -> ajustada -> aprobada -> en curso -> resultado (y «descartada» como salida lateral).
// cliente piloto no comparte costos: NINGÚN campo de este módulo habla de margen o utilidad; el impacto solo puede ser de INGRESO y solo si hay dato observado.

export const ROLES_QUE_DECIDEN = Object.freeze(['owner', 'analyst', 'operator']);
export const puedeDecidir = rol => ROLES_QUE_DECIDEN.includes(rol);
export const PRIORIDADES = Object.freeze(['critical', 'high', 'normal']);
export const PRIORIDAD_TXT = Object.freeze({critical: 'Revisión humana urgente', high: 'Prioridad alta', normal: 'Prioridad normal'});
export const RESULTADOS = Object.freeze(['yes', 'no', 'partial']);
export const RESULTADO_TXT = Object.freeze({yes: 'Sí, se resolvió', no: 'No se resolvió', partial: 'Se resolvió en parte'});
export const ETAPAS = Object.freeze(['propuesta', 'ajustada', 'aprobada', 'en_curso', 'resultado']);
export const ETAPA_TXT = Object.freeze({propuesta: 'Propuesta', ajustada: 'Ajustada', aprobada: 'Aprobada', en_curso: 'En curso', resultado: 'Con resultado', descartada: 'Descartada'});
export const ROTULO_ASOCIACION = 'Asociación temporal, no causa: el cambio entre los dos periodos puede deberse a otros factores.';
export const MIN_COMENTARIO = 20;

const fechaIso = /^\d{4}-\d{2}-\d{2}$/;
const hoyUtc = (ahora = new Date()) => ahora.toISOString().slice(0, 10);
const texto = (v, min, max) => typeof v === 'string' && v.trim() === v && v.length >= min && v.length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v);
const uuid = v => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

/** Fecha de compromiso válida: AAAA-MM-DD real, no anterior a hoy (UTC) y a no más de 2 años. */
export function fechaValida(v, ahora = new Date()) {
  if (typeof v !== 'string' || !fechaIso.test(v)) return false;
  const d = new Date(v + 'T00:00:00Z');
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v) return false;
  if (v < hoyUtc(ahora)) return false;
  return d.getTime() - ahora.getTime() <= 731 * 86400000;
}

/** Errores de validación en español; lista vacía = válido. Cada campo obligatorio dice qué falta. */
export function validarAprobacion(i, ahora = new Date()) {
  const e = [];
  if (!uuid(i?.ownerId)) e.push({campo: 'ownerId', mensaje: 'Elige una persona responsable.'});
  if (!fechaValida(i?.dueDate, ahora)) e.push({campo: 'dueDate', mensaje: 'Indica una fecha de compromiso desde hoy.'});
  if (i?.comment !== undefined && i.comment !== '' && !texto(i.comment, 1, 2000)) e.push({campo: 'comment', mensaje: 'El comentario no puede superar 2,000 caracteres.'});
  return e;
}
export function validarAjuste(i) {
  const e = [];
  if (!texto(i?.action, 20, 2000)) e.push({campo: 'action', mensaje: 'La acción necesita entre 20 y 2,000 caracteres.'});
  if (!texto(i?.rationale, 20, 4000)) e.push({campo: 'rationale', mensaje: 'La razón necesita entre 20 y 4,000 caracteres.'});
  if (!Array.isArray(i?.preconditions) || i.preconditions.length < 1 || i.preconditions.length > 10 || !i.preconditions.every(p => texto(p, 10, 500))) e.push({campo: 'preconditions', mensaje: 'Indica de 1 a 10 supuestos, de al menos 10 caracteres cada uno.'});
  if (i?.ownerId !== null && i?.ownerId !== undefined && !uuid(i.ownerId)) e.push({campo: 'ownerId', mensaje: 'El responsable no es válido.'});
  if (i?.priority !== undefined && i.priority !== null && !PRIORIDADES.includes(i.priority)) e.push({campo: 'priority', mensaje: 'La prioridad no es válida.'});
  if (!texto(i?.comment, MIN_COMENTARIO, 2000)) e.push({campo: 'comment', mensaje: `El comentario es obligatorio (mínimo ${MIN_COMENTARIO} caracteres): explica qué cambias y por qué.`});
  return e;
}
export function validarDescarte(i) {
  return texto(i?.reason, MIN_COMENTARIO, 2000) ? [] : [{campo: 'reason', mensaje: `El motivo es obligatorio (mínimo ${MIN_COMENTARIO} caracteres).`}];
}
export function validarResultado(i) {
  const e = [];
  if (!RESULTADOS.includes(i?.outcome)) e.push({campo: 'outcome', mensaje: 'Elige si se resolvió: sí, no o en parte.'});
  if (!texto(i?.note, MIN_COMENTARIO, 2000)) e.push({campo: 'note', mensaje: `La nota es obligatoria (mínimo ${MIN_COMENTARIO} caracteres): qué pasó y cómo lo sabes.`});
  return e;
}

/** Prioridad vigente: el último ajuste del responsable manda sobre la del generador. */
export function prioridadVigente(item, eventos = []) {
  const aj = [...eventos].reverse().find(ev => ev.kind === 'adjusted' && ev.priority);
  return aj?.priority ?? item?.priority ?? 'normal';
}

/** Etapa actual a partir de lo REAL (estado guardado + eventos). Nunca se infiere una etapa que no tenga evento. */
export function etapaActual(item, eventos = []) {
  if (item?.status === 'dismissed') return 'descartada';
  const k = new Set(eventos.map(e => e.kind));
  if (k.has('resolved')) return 'resultado';
  if (k.has('started')) return 'en_curso';
  if (k.has('approved')) return 'aprobada';
  if (k.has('adjusted') || (item?.history ?? []).some(h => h.version > 1 && h.status !== 'dismissed' && !/^Responsable asignado al aprobar/.test(h.reason ?? ''))) return 'ajustada';
  return 'propuesta';
}

/** Acciones permitidas a quien mira la recomendación, con el motivo cuando una está bloqueada. */
export function accionesPermitidas({item, eventos = [], rol, flujoDisponible = true}) {
  const etapa = etapaActual(item, eventos);
  const decide = puedeDecidir(rol);
  const bloqueo = !decide ? 'Tu rol solo permite consultar.' : item?.stale ? 'El problema o su evidencia cambió: pide una propuesta vigente.' : !flujoDisponible ? 'El flujo de aprobación aún no está habilitado en esta base de datos.' : null;
  const abierta = etapa === 'propuesta' || etapa === 'ajustada';
  return {
    etapa,
    proceder: {permitido: !bloqueo && abierta, motivo: bloqueo ?? (abierta ? null : etapa === 'descartada' ? 'La recomendación está descartada.' : 'Ya fue aprobada.')},
    ajustar: {permitido: !bloqueo && abierta, motivo: bloqueo ?? (abierta ? null : etapa === 'descartada' ? 'Reábrela para ajustar.' : 'Lo aprobado no se edita: queda como registro.')},
    descartar: {permitido: !bloqueo && abierta, motivo: bloqueo ?? (abierta ? null : 'Solo se descarta una propuesta que aún no se aprobó.')},
    iniciar: {permitido: !bloqueo && etapa === 'aprobada', motivo: bloqueo ?? (etapa === 'aprobada' ? null : 'Primero debe estar aprobada.')},
    resultado: {permitido: !bloqueo && (etapa === 'aprobada' || etapa === 'en_curso'), motivo: bloqueo ?? (etapa === 'aprobada' || etapa === 'en_curso' ? null : 'Solo con una intervención aprobada o en curso.')},
  };
}

const ACCION_TXT = {approved: 'Aprobada', adjusted: 'Ajustada', started: 'Puesta en curso', resolved: 'Resultado registrado'};
/** Línea de tiempo ordenada (más antigua primero) con quién y cuándo. `nombre(id)` traduce un id de persona; por omisión «Persona del equipo». */
export function construirLinea({item, eventos = [], nombre = () => 'Persona del equipo'}) {
  const filas = [];
  const historia = [...(item?.history ?? [])].sort((a, b) => a.version - b.version);
  historia.forEach((h, i) => {
    const previo = historia[i - 1];
    let tipo = 'propuesta', titulo = 'Propuesta';
    if (previo) {
      if (h.status === 'dismissed' && previo.status !== 'dismissed') { tipo = 'descartada'; titulo = 'Descartada'; }
      else if (h.status !== 'dismissed' && previo.status === 'dismissed') { tipo = 'reabierta'; titulo = 'Reabierta'; }
      else if (/^Responsable asignado al aprobar/.test(h.reason ?? '')) { tipo = 'responsable'; titulo = 'Responsable asignado'; }
      else { tipo = 'ajustada'; titulo = 'Ajustada'; }
    }
    if (tipo === 'ajustada' && eventos.some(e => e.kind === 'adjusted' && e.recommendationVersion === h.version)) return; // el evento de ajuste ya cuenta esta versión, con la prioridad
    filas.push({clave: 'v' + h.version, tipo, titulo, cuando: h.createdAt, quien: nombre(h.actorId), detalle: h.version === 1 ? null : h.reason ?? null, version: h.version});
  });
  for (const e of eventos) {
    const extra = e.kind === 'approved' ? `Responsable ${nombre(e.ownerId)} · compromiso ${e.dueDate}` : e.kind === 'resolved' ? RESULTADO_TXT[e.outcome] ?? null : e.kind === 'adjusted' && e.priority ? 'Prioridad: ' + (PRIORIDAD_TXT[e.priority] ?? e.priority) : null;
    filas.push({clave: 'e' + e.id, tipo: e.kind, titulo: ACCION_TXT[e.kind] ?? e.kind, cuando: e.createdAt, quien: nombre(e.actorId), detalle: [extra, e.kind === 'resolved' ? e.note : e.comment].filter(Boolean).join(' · ') || null, version: e.recommendationVersion});
  }
  return filas.sort((a, b) => (a.cuando < b.cuando ? -1 : a.cuando > b.cuando ? 1 : a.clave < b.clave ? -1 : 1));
}

/** Pasos del indicador de etapas (propuesta -> ... -> resultado). La etapa «ajustada» solo aparece si ocurrió. */
export function pasosEtapa(etapa) {
  const orden = ['propuesta', 'aprobada', 'en_curso', 'resultado'];
  const idx = etapa === 'ajustada' ? 0 : etapa === 'descartada' ? -1 : orden.indexOf(etapa);
  return orden.map((k, i) => ({clave: k, etiqueta: k === 'propuesta' && etapa === 'ajustada' ? 'Ajustada' : ETAPA_TXT[k], estado: idx < 0 ? 'todo' : i < idx ? 'done' : i === idx ? 'current' : 'todo'}));
}

const dineroMenor = v => (typeof v === 'string' && /^-?\d{1,20}$/.test(v) ? BigInt(v) : null);
/**
 * Comparación antes/después SOLO si la intervención tiene una medición con dato observado en AMBOS periodos.
 * Devuelve null si falta cualquiera (no se inventa). Siempre rotulada como asociación temporal. Solo ingreso/importes: no hay margen ni utilidad.
 */
export function comparacionAntesDespues(medicion) {
  if (!medicion || medicion.status === 'unavailable') return null;
  const a = dineroMenor(medicion.baselineAmountMinor ?? medicion.baselineKnownSubtotalMinor), b = dineroMenor(medicion.postAmountMinor ?? medicion.postKnownSubtotalMinor);
  if (a === null || b === null) return null;
  return {
    antesMinor: String(a), despuesMinor: String(b), deltaMinor: String(b - a), moneda: medicion.currency, exponente: medicion.exponent,
    completa: medicion.status === 'complete', razones: Array.isArray(medicion.reasons) ? medicion.reasons.slice(0, 5) : [],
    publicacionAntes: medicion.baselineSnapshotId ?? null, publicacionDespues: medicion.postSnapshotId ?? null,
    rotulo: ROTULO_ASOCIACION,
  };
}
