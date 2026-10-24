// Modelo de «Datos y confianza»: 4 bloques con datos que YA existen en el código (frescura y cobertura reales), sin inventar cifras.
//  1 fuentes conectadas · 2 frescura por cifra con alerta · 3 cobertura con ventanas · 4 «qué no sabemos» como lista de tareas.
// Regla de alerta: una fuente con cadencia esperada se marca ALERTA si pasó más de 3 veces su cadencia sin éxito (o tiene error); entre 2 y 3 veces está «atrasada».
import {FUENTES, METODOS, nombreCalculo, textoError, dentroDe} from '../../lib/legibilidad/sincronizacion.mjs';
import {diaTxt, haceDeIso} from '../../lib/confianza/sello.mjs';
import {lineaVentanas, NOMBRE, num, pct} from '../refunds/fuga-modelo.mjs';

export const FACTOR_ALERTA = 3;
const ok = p => p && p.status === 'ok';
const disponible = f => f && f.availability === 'ready' && Array.isArray(f.sources) && Array.isArray(f.insights);

/** Nivel de una fuente: 'alerta' | 'atrasada' | 'ok' | 'manual' | 'pausa' | 'sin_datos'. */
export function nivelFuente(s, ahora = Date.now()) {
  if (s.status === 'paused') return 'pausa';
  if (s.status === 'error') return 'alerta';
  if (s.method === 'stub' || s.status === 'never') return 'sin_datos';
  if (!s.expectedEverySeconds) return s.lastSuccessAt ? 'manual' : 'sin_datos';
  const edad = s.lastSuccessAt ? (ahora - Date.parse(s.lastSuccessAt)) / 1000 : Infinity;
  return edad > FACTOR_ALERTA * s.expectedEverySeconds ? 'alerta' : edad > 2 * s.expectedEverySeconds ? 'atrasada' : 'ok';
}
export const NIVEL_TXT = Object.freeze({alerta: 'Alerta', atrasada: 'Atrasada', ok: 'Al día', manual: 'Carga manual', pausa: 'En pausa', sin_datos: 'Sin datos'});

/** Bloque 1. @returns {disponible, filas:[{clave,nombre,metodo,nivel,estado,exito,siguiente,nuevos,hasta,error}]} */
export function bloqueFuentes(f, ahora = Date.now()) {
  if (!disponible(f)) return {disponible: false, filas: []};
  return {disponible: true, filas: f.sources.map(s => { const nivel = nivelFuente(s, ahora);
    return {clave: s.key, nombre: FUENTES[s.key] ?? s.key, metodo: METODOS[s.method] ?? s.method, nivel, estado: NIVEL_TXT[nivel],
      exito: s.lastSuccessAt ? haceDeIso(s.lastSuccessAt, ahora) : 'nunca', siguiente: nivel === 'pausa' || s.method === 'manual_upload' ? null : dentroDe(s.nextRunAt, ahora),
      nuevos: s.lastNewRecords, hasta: diaTxt(s.dataWatermark), error: textoError(s.errorCode)}; })};
}
/** Bloque 2: un renglón por cálculo precalculado (cifra), con su corte y su estado. */
export function bloqueFrescura(f, ahora = Date.now()) {
  if (!disponible(f)) return {disponible: false, filas: []};
  const filas = f.insights.map(i => { const nivel = i.status === 'failed' ? 'alerta' : i.status === 'partial' || i.status === 'skipped' ? 'atrasada' : 'ok';
    return {clave: i.insight, nombre: nombreCalculo(i.insight), nivel, estado: i.status === 'ready' ? 'Al día' : i.status === 'partial' ? 'Parcial' : i.status === 'skipped' ? 'Omitido' : 'Falló',
      actualizado: i.refreshedAt ? haceDeIso(i.refreshedAt, ahora) : 'nunca', corte: diaTxt(i.sourceWatermark), filas: i.rows, pendientes: i.pending}; });
  const alertas = filas.filter(x => x.nivel === 'alerta').length + f.sources.filter(s => nivelFuente(s, ahora) === 'alerta').length;
  return {disponible: true, filas, alertas};
}
/** Bloque 3: ventanas de exportación por canal (de Fuga) en una línea y en filas. */
export function bloqueVentanas(fuga) {
  const v = fuga?.ventanas;
  if (!Array.isArray(v)) return {disponible: false, linea: '', filas: []};
  return {disponible: true, linea: lineaVentanas(fuga), filas: v.map(w => ({canal: NOMBRE[w.canal] ?? w.canal, tipo: w.tipo === 'refund' ? 'Reembolsos' : 'Pedidos', completa: w.completa, desde: diaTxt(w.inicio), hasta: diaTxt(w.fin), corte: diaTxt(w.corte), inicioIso: w.inicio ?? null, finIso: w.fin ?? null, corteIso: w.corte ?? null}))};
}

/** Bloque 4: «qué no sabemos» como lista de tareas. Cada fila sale de un dato real (conteo o estado); las limitaciones fijas citan la nota del código que las documenta. */
export function queNoSabemos({fuga = null, carga = null, cobertura = null, frescura = null, ahora = Date.now()} = {}) {
  const t = [];
  const add = (clave, titulo, afecta, cierra, base) => t.push({clave, titulo, afecta, cierra, base});
  if (fuga) {
    const ti = fuga.titular;
    if (ok(ti) && ti.sinMonto > 0) add('sin-monto', `${num(ti.sinMonto)} reembolsos del libro no traen monto`, 'Dinero devuelto: es un piso, no el total', 'Que el canal exporte el monto del reembolso', 'Observado');
    if (ok(ti) && ti.otrasMonedas?.length) add('otras-monedas', `${ti.otrasMonedas.map(o => o.currency).join(' y ')} no se suman a USD (${num(ti.otrasMonedas.reduce((a, o) => a + o.n, 0))} reembolsos)`, 'Dinero devuelto total entre monedas', 'Aprobar un tipo de cambio', 'Observado');
    if (fuga.todasParciales || (fuga.ventanas ?? []).some(w => !w.completa)) add('ventanas', 'Las ventanas de exportación son parciales', 'Periodo cubierto por canal; cualquier comparación entre canales', 'Pedir la exportación completa de cada canal', 'Observado');
    if (fuga.intensidad?.status === 'ok') add('cantidad', 'El libro no trae cantidad por línea', 'La tasa real de devolución no se puede calcular; solo la intensidad', 'Pedir la cantidad (quantity) por línea en la exportación de pedidos', 'Nota fija del cálculo');
    if (ok(fuga.tracker)) add('tracker-moneda', 'El Tracker de Excel no declara moneda ni fecha de corte', 'Dinero atorado: se supone USD y no se sabe hasta cuándo está al día', 'Agregar columnas de moneda y fecha de corte al Tracker', 'Nota fija del cálculo');
    if (ok(fuga.tracker) && fuga.tracker.filasReembolsos > fuga.tracker.conMonto) add('tracker-sin-monto', `${num(fuga.tracker.filasReembolsos - fuga.tracker.conMonto)} solicitudes del Tracker sin monto`, 'Dinero atorado en dólares', 'Completar el monto en el Tracker', 'Observado');
    const r = fuga.contactoRepetido;
    if (ok(r) && r.pctSinVincular != null && r.pctSinVincular > 0) add('sin-vincular', `${pct(r.pctSinVincular)} de los tickets sin vincular a un cliente`, 'Contacto repetido (es un piso)', 'Cerrar las asociaciones ticket–contacto en HubSpot', 'Observado');
  }
  if (carga) {
    const s = carga.sla;
    if (ok(s) && s.hilos > s.medibles) add('hilos-sin-mensaje', `${num(s.hilos - s.medibles)} de ${num(s.hilos)} hilos de HubSpot sin mensaje del cliente`, 'Respuestas de más de 24 h: esos hilos no se pueden medir', 'Cargar los mensajes de esos hilos', 'Observado');
    if (carga.canal?.status === 'ok' && !carga.canal.derivable) add('canal', `Solo ${num(carga.canal.conCanal)} de ${num(carga.canal.total)} conversaciones traen canal`, 'Respuestas >24 h y carga por canal: hoy solo hay el total', 'Marcar el canal en las conversaciones', 'Observado');
    add('zendesk', 'Zendesk no se usa mientras su configuración esté en transición', 'Todo SLA o primera respuesta: la fuente es HubSpot', 'Terminar la migración de configuración de Zendesk', 'Nota fija del cálculo');
  }
  for (const s of cobertura?.sources ?? []) if (s.loaded === false && s.status !== 'timeout') add('sin-cargar-' + s.key, `${s.label} sin cargar`, 'Todo lo que dependa de esa fuente', 'Conectar la fuente o importar un archivo', 'Observado');
  for (const s of frescura?.sources ?? []) if (nivelFuente(s, ahora) === 'alerta') add('alerta-' + s.key, `${FUENTES[s.key] ?? s.key} lleva más de ${FACTOR_ALERTA} veces su cadencia sin actualizarse`, 'Las cifras que salen de esa fuente', 'Revisar la sincronización o volver a conectar la cuenta', 'Observado');
  return t;
}
