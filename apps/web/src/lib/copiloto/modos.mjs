// Registro de MODOS del «Copiloto de negocio»: una pantalla de área (CFO, Fuga de reembolsos, Brechas, Mapa, Carga y SLA…) se enchufa aquí
// y hereda el shell de «Pregúntale a tus datos» (mismo menú lateral, sin encabezado de página, compositor, historial, traza y respuestas).
// Contrato completo: docs/COPILOTO-NEGOCIO.md. Este módulo es PURO (sin node:, sin pg): lo importan el cliente, el shell y las pruebas.
import {CFO_SHORTCUTS} from '../../../../../packages/cfo-copilot/src/client.mjs';

const DINERO = Object.freeze(['owner', 'analyst']);

/**
 * Forma de un modo:
 *  clave           identificador estable (historial local, bitácora, pruebas).
 *  ruta            ruta del menú que abre el modo (también la del ítem activo).
 *  titulo/subtitulo  texto del titular de la portada cuando el briefing aún no llega y para el estado sin acceso.
 *  rolesPermitidos roles que ven el modo; cualquier otro recibe «Esta área es solo para …» (el servidor sigue siendo la autoridad: 403).
 *  briefing        clave del componente que pinta el briefing de la portada (la resuelve copiloto-negocio.tsx).
 *  chipsPorTema    [{titulo, preguntas[]}] mostradas bajo el briefing; cada pregunta puede tener consulta directa en `directas`.
 *  directas        {pregunta: {tool, args}} → se ejecutan sin modelo ni costo.
 *  consulta        'cfo' (motor propio en endpointDeConsulta) | 'agente' (agente general, /api/agent/turn).
 *  endpointDeConsulta / endpointInforme  rutas de datos del modo.
 *  presupuesto     {mostrar, topeUsd}: indicador discreto «Uso del mes» (solo si el motor lo expone).
 *  informeCompleto ruta del informe clásico (o null).
 */
export const MODOS = Object.freeze({
  general: Object.freeze({
    clave: 'general', ruta: '/preguntale', titulo: 'Pregúntale a tus datos', subtitulo: 'Tu información cargada, con la cifra que ya calculó el sistema, su clase y su cobertura.',
    rolesPermitidos: Object.freeze(['owner', 'analyst', 'operator', 'viewer']), briefing: null, chipsPorTema: Object.freeze([]), directas: Object.freeze({}),
    consulta: 'agente', endpointDeConsulta: '/api/agent/turn', endpointInforme: null, presupuesto: Object.freeze({mostrar: false, topeUsd: 0}), informeCompleto: null,
  }),
  cfo: Object.freeze({
    clave: 'cfo', ruta: '/cfo', titulo: 'CFO', subtitulo: 'Tu copiloto de dinero: ingresos, reembolsos, canales y calidad de datos, con la cifra que ya calculó el panel.',
    rolesPermitidos: DINERO, briefing: 'cfo', chipsPorTema: Object.freeze(CFO_SHORTCUTS.categories.map(c => Object.freeze({titulo: c.title, preguntas: Object.freeze([...c.questions])}))),
    directas: Object.freeze({...CFO_SHORTCUTS.direct}), consulta: 'cfo', endpointDeConsulta: '/cfo/data/copilot', endpointInforme: '/cfo/data/report',
    presupuesto: Object.freeze({mostrar: true, topeUsd: 25}), informeCompleto: '/cfo?vista=informe',
  }),
  refunds: Object.freeze({
    clave: 'refunds', ruta: '/refunds', titulo: 'Fuga de reembolsos', subtitulo: 'Dónde se concentra el dinero devuelto, cuánto está negado o atorado y qué llevarte a la reunión con el proveedor.',
    rolesPermitidos: DINERO, briefing: 'refunds', chipsPorTema: Object.freeze([
      Object.freeze({titulo: 'Reembolsos', preguntas: Object.freeze(['¿Cuánto dinero en reembolsos tuvimos por marketplace?', '¿Cómo evolucionaron los reembolsos mes a mes?'])}),
    ]), directas: Object.freeze({'¿Cuánto dinero en reembolsos tuvimos por marketplace?': {tool: 'ledger_por_fuente', args: {kind: 'refund'}}, '¿Cómo evolucionaron los reembolsos mes a mes?': {tool: 'ledger_por_mes', args: {kind: 'refund'}}}), consulta: 'agente', endpointDeConsulta: '/api/agent/turn', endpointInforme: '/api/refunds',
    presupuesto: Object.freeze({mostrar: false, topeUsd: 0}), informeCompleto: null,
  }),
});

// Inglés de los temas y preguntas de los chips (el español es el identificador interno que usan `directas` y el historial).
const TEMA_EN = Object.freeze({Resultados: 'Results', 'Canales y calidad': 'Channels and quality', Riesgos: 'Risks', CCO: 'CCO', Reembolsos: 'Refunds'});
const PREGUNTA_EN = Object.freeze({
  '¿Cómo cerró el último mes por moneda?': 'How did the last month close by currency?', '¿Cómo vamos contra el mes anterior?': 'How are we doing against the previous month?', '¿Cuál es la proyección de ingresos?': 'What is the revenue projection?',
  '¿Qué canal pesa más en los pedidos?': 'Which channel weighs the most in orders?', '¿Cuántos reembolsos no traen importe?': 'How many refunds have no amount?', '¿Cuánto cuesta la mala calidad de datos?': 'How much does poor data quality cost?',
  '¿Hay alertas activas?': 'Are there active alerts?', '¿Qué problemas exponen más ingresos?': 'Which problems expose the most revenue?', '¿Cómo rinde cada SKU en Amazon?': 'How does each SKU perform on Amazon?',
  '¿Qué SKU llevan 3 meses sin venta?': 'Which SKUs have had no sales for 3 months?', '¿Cómo se comparan las modalidades de venta de Amazon y Walmart?': 'How do the Amazon and Walmart selling models compare?', '¿Desde qué bodega sale cada SKU en Amazon y Walmart?': 'Which warehouse does each SKU ship from on Amazon and Walmart?',
  '¿Cuánto dinero en reembolsos tuvimos por marketplace?': 'How much money did we have in refunds by marketplace?', '¿Cómo evolucionaron los reembolsos mes a mes?': 'How did refunds evolve month by month?',
});
/** Pregunta de un chip en el idioma pedido. */
export const preguntaDe = (q, idioma) => (idioma === 'en' ? PREGUNTA_EN[q] ?? q : q);
/** Temas con sus preguntas en el idioma pedido ([{titulo, preguntas[]}]). */
export const chipsDe = (modo, idioma) => modo.chipsPorTema.map(t => ({titulo: idioma === 'en' ? TEMA_EN[t.titulo] ?? t.titulo : t.titulo, preguntas: t.preguntas.map(q => preguntaDe(q, idioma))}));
/** Consultas directas de los chips, con la pregunta en el idioma pedido como clave. */
export const directasDe = (modo, idioma) => Object.fromEntries(Object.entries(modo.directas).map(([q, d]) => [preguntaDe(q, idioma), d]));

/** Rutas que se pintan con el shell del copiloto (sin encabezado de página). Las demás áreas se añaden registrando su modo. */
/** Rutas donde la pantalla ES el chat (sin encabezado del espacio): /refunds es una pantalla normal aunque tenga un modo registrado. */
export const RUTAS_COPILOTO = Object.freeze([...new Set(Object.values(MODOS).filter(m => m.briefing !== 'refunds').map(m => m.ruta))]);
export const esRutaCopiloto = pathname => RUTAS_COPILOTO.includes(pathname);
export const modoPorClave = clave => MODOS[clave] ?? null;
export const modoPorRuta = pathname => Object.values(MODOS).find(m => m.ruta === pathname) ?? null;
export const puedeUsarModo = (modo, role) => !!modo && Array.isArray(modo.rolesPermitidos) && modo.rolesPermitidos.includes(role);
/** «Esta área es solo para propietarios y analistas» (o la lista que corresponda al modo). */
export function textoSoloPara(modo) {
  const N = {owner: 'administradores del espacio', analyst: 'analistas', operator: 'operadores', viewer: 'personas con rol de Lectura'};
  const lista = modo.rolesPermitidos.map(r => N[r] ?? r);
  return 'Esta área es solo para ' + (lista.length > 1 ? lista.slice(0, -1).join(', ') + ' y ' + lista.at(-1) : lista[0]);
}
/** Valida la forma de un modo (la usa la prueba del registro y la integración de /gaps, /map y /workload). */
export function problemasDeModo(m) {
  const p = [];
  for (const k of ['clave', 'ruta', 'titulo', 'subtitulo']) if (typeof m?.[k] !== 'string' || !m[k]) p.push('falta ' + k);
  if (typeof m?.ruta === 'string' && !m.ruta.startsWith('/')) p.push('ruta no interna');
  if (!Array.isArray(m?.rolesPermitidos) || !m.rolesPermitidos.length) p.push('rolesPermitidos vacío');
  if (!['cfo', 'agente'].includes(m?.consulta)) p.push('consulta desconocida');
  if (typeof m?.endpointDeConsulta !== 'string' || !m.endpointDeConsulta.startsWith('/')) p.push('endpointDeConsulta no interno');
  if (!Array.isArray(m?.chipsPorTema)) p.push('chipsPorTema no es lista');
  for (const t of m?.chipsPorTema ?? []) if (!t.titulo || !Array.isArray(t.preguntas) || !t.preguntas.length) p.push('tema vacío: ' + t.titulo);
  for (const q of Object.keys(m?.directas ?? {})) if (!(m.chipsPorTema ?? []).some(t => t.preguntas.includes(q)) && m.clave !== 'general') p.push('directa sin chip: ' + q);
  return p;
}
