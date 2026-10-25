// Fixtures de «Puntos de dolor» (/pain-points): lista y evidencia sintéticas. PAIN_VARIANT = vacio | parcial | error. Solo auditoría visual.
import {vistaPain, evidenciaPain} from './pain-sintetico.mjs';
export async function respondExtra(url, method) {
  const u = new URL(url, 'http://x'), p = u.pathname;
  if (!p.startsWith('/api/pain-points')) return null;
  const v = process.env.PAIN_VARIANT ?? '';
  const ia = /^\/api\/pain-points\/([^/]+)\/ia$/.exec(p);
  if (ia) return respondIa(decodeURIComponent(ia[1]), method, process.env.PAIN_IA ?? '');
  if (method !== 'GET') return null;
  if (v === 'error') return [503, {error: {code: 'pain_points_unavailable'}}];
  if (p === '/api/pain-points') return [200, {data: vistaPain({vacio: v === 'vacio', parcial: v === 'parcial'})}];
  const m = /^\/api\/pain-points\/([^/]+)\/evidence$/.exec(p);
  if (m) { const e = evidenciaPain(decodeURIComponent(m[1]), u.searchParams.get('cursor')); return e ? [200, {data: e}] : [404, {error: {code: 'resource_not_found'}}]; }
  return null;
}

// «Lectura de IA» (L4). PAIN_IA = (vacío: sin lectura, habilitada) | completo | desacuerdo | parcial | tope | apagado | error
const lec = (rol, sev, conf, lectura, extra = {}) => ({rol, estado: 'ok', clase: 'inferred', intento: 1, motivoInvalido: null, proveedor: 'simulado', modelo: 'simulado-1', tokensIn: 900, tokensOut: 210, costoMicro: 110000, contenido: {severidad: sev, confianza: conf, lectura, puntos: ['La mayor parte viene de un solo canal', 'Una parte no trae monto y no se suma'], supuestos: ['La ventana del canal está completa'], clase: 'inferred', ...extra}});
function corrida(id, v, actual = true) {
  const sev = v === 'desacuerdo' ? ['alta', 'baja', 'media'] : ['alta', 'alta', v === 'completo' ? 'alta' : 'media'];
  const lecturas = [
    lec('causa_raiz', sev[0], 0.72, 'Lo más probable es que los reembolsos se queden pendientes por un cierre manual lento en el canal.', {categoria: 'proceso'}),
    lec('impacto', sev[1], 0.66, 'El monto bruto pendiente es relevante pero acotado a un solo canal; 12 reembolsos con monto conocido.'),
    lec('accion', sev[2], 0.6, 'Conviene decidir quién cierra los pendientes antiguos.', {propuesta: {titulo: 'Asignar un responsable para cerrar los reembolsos pendientes', pasos: ['Revisar los más antiguos', 'Confirmar el estado con el canal', 'Registrar la decisión'], evidencia: 'Filas pendientes del libro, sin datos personales', ejecucion: 'ninguna_hasta_orden'}}),
  ];
  const consenso = v === 'desacuerdo' ? {estado: 'desacuerdo', tono: 'bad', severidad: null, rango: ['baja', 'alta'], confianza: 0.33, completo: true, motivo: 'Las lecturas se contradicen: trátala como una hipótesis, no como una conclusión.', discrepancias: [{rol: 'causa_raiz', severidad: 'alta'}, {rol: 'impacto', severidad: 'baja'}, {rol: 'accion', severidad: 'media'}]}
    : v === 'completo' ? {estado: 'acuerdo', tono: 'ok', severidad: 'alta', rango: null, confianza: 0.66, completo: true, motivo: 'Las lecturas coinciden en la severidad.', discrepancias: []}
    : {estado: 'acuerdo_parcial', tono: 'warn', severidad: null, rango: ['media', 'alta'], confianza: 0.5, completo: true, motivo: 'Las lecturas difieren por un nivel de severidad.', discrepancias: [{rol: 'causa_raiz', severidad: 'alta'}, {rol: 'impacto', severidad: 'alta'}, {rol: 'accion', severidad: 'media'}]};
  return {id: 'r1', puntoId: id, corte: actual ? '2026-10-20T00:00:00.000Z' : '2026-10-13T00:00:00.000Z', version: 'pp-ia-v1', estado: v === 'parcial' && actual ? 'parcial' : 'completo', consenso, confianza: consenso.confianza, creadoEn: '2026-10-21T10:00:00.000Z', actualizadoEn: '2026-10-21T10:00:00.000Z', lecturas: v === 'parcial' && actual ? lecturas.slice(0, 2) : lecturas, esActual: actual};
}
function respondIa(id, method, v) {
  if (v === 'error') return [503, {error: {code: 'pain_points_ia_unavailable'}}];
  if (!/^P\d{1,2}(~[A-Za-z0-9._-]{1,60})?$/.test(id)) return [400, {error: {code: 'pain_point_invalid'}}];
  const tope = v === 'tope', usado = tope ? 5000000 : v === 'completo' || v === 'desacuerdo' || v === 'parcial' ? 1250000 : 330000;
  const base = {version: 'pp-ia-v1', puntoId: id, corte: '2026-10-20T00:00:00.000Z', habilitada: v !== 'apagado', topeAlcanzado: tope, clase: 'inferred', ingreso: 'bruto', puedeAnalizar: true,
    presupuesto: {weekStart: '2026-10-19', capMicro: 5000000, topeMicro: 5000000, usedMicro: usado, remainingMicro: 5000000 - usado, exhausted: tope},
    roles: [{id: 'causa_raiz', nombre: 'Causa raíz', pregunta: '¿Qué está causando este punto de dolor?'}, {id: 'impacto', nombre: 'Impacto económico', pregunta: '¿Cuánto pesa y qué tan seguro es?'}, {id: 'accion', nombre: 'Acción recomendada', pregunta: '¿Qué conviene decidir?'}]};
  const hay = ['completo', 'desacuerdo', 'parcial'].includes(v);
  if (method === 'POST') return v === 'apagado' ? [503, {error: {code: 'ia_apagada'}}] : [200, {data: {...base, topeAlcanzado: tope, actual: tope ? null : corrida(id, hay ? v : 'completo'), ultima: tope ? corrida(id, 'parcial', false) : null, resultado: {reutilizado: false, nuevas: 3, invalidas: 0, tope, motivoTope: tope ? 'tope' : null, costoMicro: 330000}}}];
  return [200, {data: {...base, actual: hay ? corrida(id, v) : null, ultima: tope ? corrida(id, 'parcial', false) : null}}];
}
