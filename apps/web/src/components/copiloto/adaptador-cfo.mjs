// Adaptador: respuesta del motor de CFO (/cfo/data/copilot, packages/cfo-copilot) -> `Answer` del agente de datos, para pintarla con los
// MISMOS componentes de respuesta (tarjetas de cifras, tablas, «Ver cómo lo calculé», insignias de clase). Puro: sin red ni DOM.
const ESTADO_PASO = {ok: 'ok', no_data: 'no_data', rejected: 'invalid_input', denied: 'forbidden', error: 'unavailable'};
const CLASE = {observed: 'observed', estimated: 'estimated', inferred: 'inferred', unclassified: 'unclassified'};
const MAX_FILAS = 40;
const KIND_TXT = {observed: 'Observado', estimated: 'Estimado', inferred: 'Inferido', unclassified: 'Sin clasificar'};
const sinCosto = '0';

const sinAcentos = t => String(t ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const DINERO = /(dinero|ingres|venta|factur|pedido|reembols|devoluci|importe|moneda|\busd\b|\bcad\b|\bmxn\b|peso|dolar|canal|mezcla|amazon|walmart|shopify|mirakl|best buy|marketplace|ticket promedio|tasa|proyec|pronostic|tendencia|alerta|anomal|calidad de datos|sin importe|sin moneda|duplicad|exposici|\bcfo\b|financ|margen|cifra|glosario|como se calcul|que significa|mes anterior|contra el mes|cerro|resumen del mes|base economica|cobertura de importe|cayo|caida)/;
const FUERTE = /(dinero|ingres|venta|factur|pedido|reembols|importe|moneda|\busd\b|\bcad\b|\bmxn\b|proyec|\bcfo\b|financ)/;
const AJENA = /(incidencia|conversaci|queja|reclamo|cliente|soporte|mensaje|correo|zendesk|intercom|sentimiento|csat|\bnps\b|problemas? (con|mas|principal)|los \d+ problemas)/;
/** ¿La pregunta libre es de CFO? Regla determinista (el planeador simulado SIEMPRE cae en «resumen del mes», así que no basta con mirar su plan).
 *  Una pregunta de conversaciones, clientes o incidencias se delega al agente general salvo que también hable de dinero. */
export function esPreguntaDeCfo(question) {
  const q = sinAcentos(question);
  if (!DINERO.test(q)) return false;
  return !AJENA.test(q) || FUERTE.test(q);
}
/** ¿La pregunta cayó fuera del catálogo de CFO? El motor no planeó ninguna herramienta (modo «ia» con 0 pasos): se delega al agente general. */
export const esFueraDeCfo = reply => !!reply && reply.mode === 'ia' && Array.isArray(reply.steps) && reply.steps.length === 0 && (!reply.figures || reply.figures.length === 0);

const cobertura = c => ({known_n: 0, eligible_n: null, note: c && String(c).trim() ? String(c) : 'sin total esperado'});
const idDe = (s, i) => `${s}:${i}`;

function figurasDe(reply) {
  return (reply.figures ?? []).map((f, i) => ({id: f.id ?? idDe('f', i), label: String(f.label ?? ''), display: String(f.display ?? ''), value: f.display ?? null, class: CLASE[f.kind] ?? 'unclassified', coverage: cobertura(f.coverage), ...(f.scope ? {scope: f.scope} : {}),
    // Un texto largo (p. ej. el detalle de una alerta) no es una cifra de tarjeta: `rank` la deja fuera de las tarjetas y solo va a la tabla.
    ...(String(f.display ?? '').length > 40 ? {rank: i + 1} : {})}));
}

/** Una tabla por herramienta (Cifra · Valor · Clase), con la misma clase de bloque que usa el agente. */
function bloquesDe(reply) {
  const porTool = new Map();
  for (const f of reply.figures ?? []) { const k = f.tool ?? 'cifras'; if (!porTool.has(k)) porTool.set(k, []); porTool.get(k).push(f); }
  const etiqueta = tool => (reply.steps ?? []).find(s => s.tool === tool)?.label ?? 'Cifras citadas';
  return [...porTool.entries()].map(([tool, figs]) => {
    const clases = new Set(figs.map(f => f.kind));
    return {tool, title: etiqueta(tool), columns: [{key: 'cifra', label: 'Cifra', kind: 'text'}, {key: 'valor', label: 'Valor', kind: 'text'}, {key: 'alcance', label: 'Alcance', kind: 'text'}, {key: 'clase', label: 'Clase', kind: 'text'}],
      rows: figs.slice(0, MAX_FILAS).map(f => ({cifra: f.label, valor: f.display, alcance: f.scope ?? null, clase: KIND_TXT[f.kind] ?? 'Sin clasificar'})),
      class: clases.size === 1 && ['observed', 'estimated', 'inferred'].includes([...clases][0]) ? [...clases][0] : 'mixed',
      coverage: {known_n: figs.length, eligible_n: null, note: 'cifras ya calculadas por el panel de CFO'}, truncated: figs.length > MAX_FILAS};
  });
}

/**
 * @param reply respuesta de POST /cfo/data/copilot
 * @param opts {sugerencias: string[] (preguntas que sí puede responder el modo), descripciones: {tool: método}}
 */
export function adaptarRespuestaCfo(reply, opts = {}) {
  const sugerencias = opts.sugerencias ?? [];
  const pasos = Array.isArray(reply?.steps) ? reply.steps : [];
  const base = {contractVersion: 1, figures: [], blocks: [], citations: [], sources: [], calc: [], missing: [], suggestions: [], notes: []};
  const uso = {modelCalls: reply?.mode === 'ia' ? 1 : 0, toolCalls: pasos.length, costMinor: String(reply?.costMicro ?? sinCosto), mode: reply?.mode === 'ia' ? 'model' : 'deterministic', fallback: reply?.guard ? !reply.guard.ok : false, guardRejected: reply?.guard ? !reply.guard.ok : false};
  const texto = String(reply?.answer ?? '');
  if (!reply || typeof reply !== 'object') return {...base, status: 'unavailable', text: '', usage: uso};
  if (reply.mode === 'rechazada') return {...base, status: 'out_of_catalog', text: texto, suggestions: sugerencias.slice(0, 3), usage: uso};
  if (reply.mode === 'sin_ia') return {...base, status: 'budget_exceeded', text: texto, suggestions: sugerencias.slice(0, 3), usage: uso};
  if (esFueraDeCfo(reply)) return {...base, status: 'out_of_catalog', text: texto, suggestions: sugerencias.slice(0, 3), usage: uso};
  const hayOk = pasos.some(s => s.status === 'ok'), hayNoData = pasos.some(s => s.status === 'no_data');
  const todoFalla = pasos.length > 0 && !hayOk && !hayNoData;
  const status = todoFalla ? (pasos.every(s => s.status === 'denied') ? 'forbidden' : 'unavailable') : hayOk ? 'ok' : 'no_data';
  const fuentes = new Map();
  for (const c of reply.citations ?? []) fuentes.set(c.href + '|' + c.label, {ref: c.href, label: c.label, href: c.href});
  const figs = figurasDe(reply);
  const trace = pasos.map((s, i) => ({id: `cfo:${i + 1}`, kind: 'tool', label: s.label ?? s.tool, estado: ESTADO_PASO[s.status] ?? s.status, ms: null, tool: s.tool, cifras: (reply.figures ?? []).filter(f => f.tool === s.tool).length, ...(fuentes.size ? {fuentes: [...fuentes.values()].map(f => f.label)} : {})}));
  const calc = pasos.map(s => ({tool: s.tool, label: s.label ?? s.tool, status: s.status === 'ok' ? 'ok' : s.status, args: {}, method: opts.descripciones?.[s.tool] ?? 'Lee el informe de CFO ya calculado de tu organización; no consulta otra fuente.', reads: ['Informe de CFO de tu organización (libro económico, última revisión de cada registro)'], sources: [...fuentes.values()], figures: (reply.figures ?? []).filter(f => f.tool === s.tool).length}));
  return {...base, status, text: texto, figures: figs, blocks: status === 'ok' ? bloquesDe(reply) : [], sources: [...fuentes.values()], calc, trace,
    notes: reply.guard && !reply.guard.ok ? ['Se descartó el texto redactado por el modelo porque incluía cifras que ninguna herramienta devolvió; esta respuesta usa solo lo calculado.'] : [],
    suggestions: status === 'ok' ? [] : sugerencias.slice(0, 3), usage: uso};
}

/** Cuerpo de la petición al motor de CFO: consulta directa (sin modelo ni costo) o pregunta con historial corto. Nunca lleva organización ni rol. */
export function cuerpoConsultaCfo({question, history = [], directa} = {}) {
  if (directa && typeof directa.tool === 'string') return {tool: directa.tool, args: directa.args ?? {}};
  const h = history.filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.text === 'string').slice(-6).map(m => ({role: m.role, content: m.text.slice(0, 1000)}));
  return {question: String(question ?? '').slice(0, 600), history: h};
}
