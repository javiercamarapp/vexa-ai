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
// Textos de este módulo puro: español canónico (lo que fijan las pruebas) e inglés. El idioma es siempre opcional y por omisión 'es'.
export const TXT = {
  es: {nivel: {alerta: 'Alerta', atrasada: 'Atrasada', ok: 'Al día', manual: 'Carga manual', pausa: 'En pausa', sin_datos: 'Sin datos'}, nunca: 'nunca', fresca: {ready: 'Al día', partial: 'Parcial', skipped: 'Omitido', failed: 'Falló'},
    reembolsos: 'Reembolsos', pedidos: 'Pedidos', observado: 'Observado', notaFija: 'Nota fija del cálculo', y: ' y ',
    sinMonto: n => `${n} reembolsos del libro no traen monto`, sinMontoA: 'Dinero devuelto: es un piso, no el total', sinMontoC: 'Que el canal exporte el monto del reembolso',
    otras: (l, n) => `${l} no se suman a USD (${n} reembolsos)`, otrasA: 'Dinero devuelto total entre monedas', otrasC: 'Aprobar un tipo de cambio',
    ventanas: 'Las ventanas de exportación son parciales', ventanasA: 'Periodo cubierto por canal; cualquier comparación entre canales', ventanasC: 'Pedir la exportación completa de cada canal',
    cantidad: 'El libro no trae cantidad por línea', cantidadA: 'La tasa real de devolución no se puede calcular; solo la intensidad', cantidadC: 'Pedir la cantidad (quantity) por línea en la exportación de pedidos',
    trMoneda: 'El Tracker de Excel no declara moneda ni fecha de corte', trMonedaA: 'Dinero atorado: se supone USD y no se sabe hasta cuándo está al día', trMonedaC: 'Agregar columnas de moneda y fecha de corte al Tracker',
    trSin: n => `${n} solicitudes del Tracker sin monto`, trSinA: 'Dinero atorado en dólares', trSinC: 'Completar el monto en el Tracker',
    vincular: p => `${p} de los tickets sin vincular a un cliente`, vincularA: 'Contacto repetido (es un piso)', vincularC: 'Cerrar las asociaciones ticket–contacto en HubSpot',
    hilos: (a, b) => `${a} de ${b} hilos de HubSpot sin mensaje del cliente`, hilosA: 'Respuestas de más de 24 h: esos hilos no se pueden medir', hilosC: 'Cargar los mensajes de esos hilos',
    canal: (a, b) => `Solo ${a} de ${b} conversaciones traen canal`, canalA: 'Respuestas >24 h y carga por canal: hoy solo hay el total', canalC: 'Marcar el canal en las conversaciones',
    zendesk: 'Zendesk no se usa mientras su configuración esté en transición', zendeskA: 'Todo SLA o primera respuesta: la fuente es HubSpot', zendeskC: 'Terminar la migración de configuración de Zendesk',
    sinCargar: l => `${l} sin cargar`, sinCargarA: 'Todo lo que dependa de esa fuente', sinCargarC: 'Conectar la fuente o importar un archivo',
    atraso: (n, f) => `${n} lleva más de ${f} veces su cadencia sin actualizarse`, atrasoA: 'Las cifras que salen de esa fuente', atrasoC: 'Revisar la sincronización o volver a conectar la cuenta'},
  en: {nivel: {alerta: 'Alert', atrasada: 'Late', ok: 'Up to date', manual: 'Manual upload', pausa: 'Paused', sin_datos: 'No data'}, nunca: 'never', fresca: {ready: 'Up to date', partial: 'Partial', skipped: 'Skipped', failed: 'Failed'},
    reembolsos: 'Refunds', pedidos: 'Orders', observado: 'Observed', notaFija: 'Fixed calculation note', y: ' and ',
    sinMonto: n => `${n} ledger refunds have no amount`, sinMontoA: 'Money refunded: this is a floor, not the total', sinMontoC: 'Have the channel export the refund amount',
    otras: (l, n) => `${l} are not added to USD, ${n} refunds`, otrasA: 'Total money refunded across currencies', otrasC: 'Approve an exchange rate',
    ventanas: 'Export windows are partial', ventanasA: 'Period covered by channel and any comparison across channels', ventanasC: 'Request the complete export of each channel',
    cantidad: 'The ledger has no quantity per line', cantidadA: 'The real return rate cannot be calculated, only the intensity', cantidadC: 'Request the quantity per line in the order export',
    trMoneda: 'The Excel Tracker declares neither currency nor cutoff date', trMonedaA: 'Stuck money: USD is assumed and it is unknown how current it is', trMonedaC: 'Add currency and cutoff date columns to the Tracker',
    trSin: n => `${n} Tracker requests without an amount`, trSinA: 'Stuck money in dollars', trSinC: 'Fill in the amount in the Tracker',
    vincular: p => `${p} of tickets not linked to a customer`, vincularA: 'Repeat contact, which is a floor', vincularC: 'Close the ticket to contact associations in HubSpot',
    hilos: (a, b) => `${a} of ${b} HubSpot threads without a customer message`, hilosA: 'Replies over 24 h: those threads cannot be measured', hilosC: 'Load the messages of those threads',
    canal: (a, b) => `Only ${a} of ${b} conversations carry a channel`, canalA: 'Replies over 24 h and workload by channel: only the total exists today', canalC: 'Mark the channel on conversations',
    zendesk: 'Zendesk is not used while its configuration is in transition', zendeskA: 'Every SLA or first response: the source is HubSpot', zendeskC: 'Finish the Zendesk configuration migration',
    sinCargar: l => `${l} not loaded`, sinCargarA: 'Everything that depends on that source', sinCargarC: 'Connect the source or import a file',
    atraso: (n, f) => `${n} has gone over ${f} times its cadence without updating`, atrasoA: 'The figures that come from that source', atrasoC: 'Review the sync or reconnect the account'},
};
const T = idioma => TXT[idioma === 'en' ? 'en' : 'es'];
export const NIVEL_TXT = Object.freeze(TXT.es.nivel);

/** Bloque 1. @returns {disponible, filas:[{clave,nombre,metodo,nivel,estado,exito,siguiente,nuevos,hasta,error}]} */
export function bloqueFuentes(f, ahora = Date.now(), idioma) {
  const x = T(idioma);
  if (!disponible(f)) return {disponible: false, filas: []};
  return {disponible: true, filas: f.sources.map(s => { const nivel = nivelFuente(s, ahora);
    return {clave: s.key, nombre: FUENTES[s.key] ?? s.key, metodo: METODOS[s.method] ?? s.method, nivel, estado: x.nivel[nivel],
      exito: s.lastSuccessAt ? haceDeIso(s.lastSuccessAt, ahora) : x.nunca, siguiente: nivel === 'pausa' || s.method === 'manual_upload' ? null : dentroDe(s.nextRunAt, ahora),
      nuevos: s.lastNewRecords, hasta: diaTxt(s.dataWatermark), error: textoError(s.errorCode)}; })};
}
/** Bloque 2: un renglón por cálculo precalculado (cifra), con su corte y su estado. */
export function bloqueFrescura(f, ahora = Date.now(), idioma) {
  const x = T(idioma);
  if (!disponible(f)) return {disponible: false, filas: []};
  const filas = f.insights.map(i => { const nivel = i.status === 'failed' ? 'alerta' : i.status === 'partial' || i.status === 'skipped' ? 'atrasada' : 'ok';
    return {clave: i.insight, nombre: nombreCalculo(i.insight), nivel, estado: i.status === 'ready' ? x.fresca.ready : i.status === 'partial' ? x.fresca.partial : i.status === 'skipped' ? x.fresca.skipped : x.fresca.failed,
      actualizado: i.refreshedAt ? haceDeIso(i.refreshedAt, ahora) : x.nunca, corte: diaTxt(i.sourceWatermark), filas: i.rows, pendientes: i.pending}; });
  const alertas = filas.filter(x => x.nivel === 'alerta').length + f.sources.filter(s => nivelFuente(s, ahora) === 'alerta').length;
  return {disponible: true, filas, alertas};
}
/** Bloque 3: ventanas de exportación por canal (de Fuga) en una línea y en filas. */
export function bloqueVentanas(fuga, idioma) {
  const x = T(idioma);
  const v = fuga?.ventanas;
  if (!Array.isArray(v)) return {disponible: false, linea: '', filas: []};
  return {disponible: true, linea: lineaVentanas(fuga, idioma), filas: v.map(w => ({canal: NOMBRE[w.canal] ?? w.canal, tipo: w.tipo === 'refund' ? x.reembolsos : x.pedidos, completa: w.completa, desde: diaTxt(w.inicio), hasta: diaTxt(w.fin), corte: diaTxt(w.corte), inicioIso: w.inicio ?? null, finIso: w.fin ?? null, corteIso: w.corte ?? null}))};
}

/** Bloque 4: «qué no sabemos» como lista de tareas. Cada fila sale de un dato real (conteo o estado); las limitaciones fijas citan la nota del código que las documenta. */
export function queNoSabemos({fuga = null, carga = null, cobertura = null, frescura = null, ahora = Date.now(), idioma} = {}) {
  const x = T(idioma), t = [], OBS = x.observado, FIJA = x.notaFija;
  const add = (clave, titulo, afecta, cierra, base) => t.push({clave, titulo, afecta, cierra, base});
  if (fuga) {
    const ti = fuga.titular;
    if (ok(ti) && ti.sinMonto > 0) add('sin-monto', x.sinMonto(num(ti.sinMonto, idioma)), x.sinMontoA, x.sinMontoC, OBS);
    if (ok(ti) && ti.otrasMonedas?.length) add('otras-monedas', x.otras(ti.otrasMonedas.map(o => o.currency).join(x.y), num(ti.otrasMonedas.reduce((a, o) => a + o.n, 0), idioma)), x.otrasA, x.otrasC, OBS);
    if (fuga.todasParciales || (fuga.ventanas ?? []).some(w => !w.completa)) add('ventanas', x.ventanas, x.ventanasA, x.ventanasC, OBS);
    if (fuga.intensidad?.status === 'ok') add('cantidad', x.cantidad, x.cantidadA, x.cantidadC, FIJA);
    if (ok(fuga.tracker)) add('tracker-moneda', x.trMoneda, x.trMonedaA, x.trMonedaC, FIJA);
    if (ok(fuga.tracker) && fuga.tracker.filasReembolsos > fuga.tracker.conMonto) add('tracker-sin-monto', x.trSin(num(fuga.tracker.filasReembolsos - fuga.tracker.conMonto, idioma)), x.trSinA, x.trSinC, OBS);
    const r = fuga.contactoRepetido;
    if (ok(r) && r.pctSinVincular != null && r.pctSinVincular > 0) add('sin-vincular', x.vincular(pct(r.pctSinVincular, idioma)), x.vincularA, x.vincularC, OBS);
  }
  if (carga) {
    const s = carga.sla;
    if (ok(s) && s.hilos > s.medibles) add('hilos-sin-mensaje', x.hilos(num(s.hilos - s.medibles, idioma), num(s.hilos, idioma)), x.hilosA, x.hilosC, OBS);
    if (carga.canal?.status === 'ok' && !carga.canal.derivable) add('canal', x.canal(num(carga.canal.conCanal, idioma), num(carga.canal.total, idioma)), x.canalA, x.canalC, OBS);
    add('zendesk', x.zendesk, x.zendeskA, x.zendeskC, FIJA);
  }
  for (const s of cobertura?.sources ?? []) if (s.loaded === false && s.status !== 'timeout') add('sin-cargar-' + s.key, x.sinCargar(s.label), x.sinCargarA, x.sinCargarC, OBS);
  for (const s of frescura?.sources ?? []) if (nivelFuente(s, ahora) === 'alerta') add('alerta-' + s.key, x.atraso(FUENTES[s.key] ?? s.key, FACTOR_ALERTA), x.atrasoA, x.atrasoC, OBS);
  return t;
}
