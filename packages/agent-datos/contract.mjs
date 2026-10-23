// Contrato del agente «Pregúntale a tus datos». Todo lo que cruza una frontera (modelo -> herramienta, herramienta -> UI) se valida aquí.
// Reglas de producto que este módulo hace cumplir por código, no por prompt:
//  1. toda cifra lleva clase (observado | estimado | inferido) y cobertura;
//  2. el modelo nunca elige tenant, rol, sucursal ni SQL: solo nombra una herramienta del catálogo cerrado con argumentos tipados;
//  3. ningún texto crudo de clientes llega al modelo (las citas viajan por un canal solo-UI);
//  4. un número en la respuesta que no salga de los resultados de las herramientas invalida el texto del modelo.

/** Versión del contrato de la respuesta. 2: `chart.kind` ∈ bar|line|donut, `trace` (pasos reales del turno) y `contractVersion`. */
export const CONTRACT_VERSION = 2;
export const CHART_KINDS = Object.freeze(['bar', 'line', 'donut']);
export const STATUSES = Object.freeze(['ok', 'no_data', 'clarify', 'out_of_catalog', 'rate_limited', 'budget_exceeded', 'unavailable', 'invalid_input', 'forbidden']);
export const CLASSES = Object.freeze(['observed', 'estimated', 'inferred']);
export const CLASS_LABELS = Object.freeze({ observed: 'Observado', estimated: 'Estimado', inferred: 'Inferido' });
/** viewer/operator: solo agregados. analyst/owner: además citas y clientes (afirmaciones sobre clientes llevan evidencia). */
export const ROLES = Object.freeze(['viewer', 'operator', 'analyst', 'owner']);
export const LIMITS = Object.freeze({
  maxQuestionChars: 600, maxHistory: 4, maxHistoryTextChars: 400, maxToolCallsPerTurn: 3, maxModelCallsPerTurn: 2,
  toolTimeoutMs: 8000, turnTimeoutMs: 45000, maxRowsPerBlock: 50, maxTurnsPerConversation: 30, maxCitations: 5,
});
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
export const isMonth = (v) => typeof v === 'string' && MONTH.test(v);
export const isUuid = (v) => typeof v === 'string' && UUID.test(v);

export class AgentError extends Error {
  constructor(code, message = code) { super(message); this.name = 'AgentError'; this.code = code; }
}

/** Mini-esquema (el mismo se valida en el servidor y se exporta como JSON Schema para el modelo). */
export function validateArgs(schema, args) {
  const fail = (m) => ({ ok: false, error: m });
  if (args === undefined || args === null) args = {};
  if (typeof args !== 'object' || Array.isArray(args) || Object.getPrototypeOf(args) !== Object.prototype) return fail('los argumentos deben ser un objeto simple');
  const props = schema?.properties ?? {};
  for (const key of Object.keys(args)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') return fail('argumento no permitido');
    if (!Object.hasOwn(props, key)) return fail(`argumento desconocido: ${key}`);
  }
  const out = {};
  for (const [key, spec] of Object.entries(props)) {
    let v = args[key];
    if (v === undefined || v === null) {
      if (spec.default !== undefined) v = spec.default;
      else if ((schema.required ?? []).includes(key)) return fail(`falta ${key}`);
      else continue;
    }
    if (spec.type === 'string') {
      if (typeof v !== 'string') return fail(`${key} debe ser texto`);
      v = v.normalize('NFC').trim();
      if (/[\u0000-\u001f\u007f]/.test(v)) return fail(`${key} contiene caracteres de control`);
      if (spec.minLength !== undefined && v.length < spec.minLength) return fail(`${key} es demasiado corto`);
      if (v.length > (spec.maxLength ?? 120)) return fail(`${key} es demasiado largo`);
      if (spec.enum && !spec.enum.includes(v)) return fail(`${key} fuera del catálogo`);
      if (spec.format === 'month' && !isMonth(v)) return fail(`${key} debe ser AAAA-MM`);
      if (spec.format === 'uuid' && !isUuid(v)) return fail(`${key} debe ser un identificador`);
    } else if (spec.type === 'integer') {
      if (!Number.isInteger(v)) return fail(`${key} debe ser entero`);
      if (v < (spec.minimum ?? -Infinity) || v > (spec.maximum ?? Infinity)) return fail(`${key} fuera de rango`);
    } else return fail(`tipo no soportado: ${spec.type}`);
    out[key] = v;
  }
  return { ok: true, args: out };
}

export function toJsonSchema(schema) {
  const properties = {};
  for (const [k, s] of Object.entries(schema?.properties ?? {})) {
    const p = { type: s.type };
    for (const f of ['enum', 'minimum', 'maximum', 'minLength', 'maxLength', 'default']) if (s[f] !== undefined) p[f] = s[f];
    if (s.format === 'month') p.pattern = '^\\d{4}-(0[1-9]|1[0-2])$';
    if (s.description) p.description = s.description;
    properties[k] = p;
  }
  return { type: 'object', additionalProperties: false, properties, required: schema?.required ?? [] };
}

export const coverageOf = (known_n, eligible_n, note) => ({ known_n, eligible_n, ...(note ? { note } : {}) });
const validCoverage = (c) => c && typeof c === 'object' && Number.isInteger(c.known_n) && c.known_n >= 0 && (c.eligible_n === null || (Number.isInteger(c.eligible_n) && c.eligible_n >= c.known_n)) && (c.eligible_n !== null || (typeof c.note === 'string' && c.note.length > 0));

/** Todas las cifras visibles: pasan por aquí o la respuesta no sale. Devuelve la lista de violaciones (vacía = cumple). */
export function contractViolations(answer) {
  const v = [];
  if (!STATUSES.includes(answer?.status)) v.push('status inválido');
  if (typeof answer?.text !== 'string' || !answer.text.trim()) v.push('texto vacío');
  const needsLabels = answer?.status === 'ok';
  for (const f of answer?.figures ?? []) {
    if (!CLASSES.includes(f.class)) v.push(`cifra sin clase: ${f.id}`);
    if (!validCoverage(f.coverage)) v.push(`cifra sin cobertura: ${f.id}`);
  }
  for (const b of answer?.blocks ?? []) {
    if (!CLASSES.includes(b.class) && !(b.class === 'mixed' && b.columns?.some((c) => c.key === 'clase'))) v.push(`bloque sin clase: ${b.title}`);
    if (!validCoverage(b.coverage)) v.push(`bloque sin cobertura: ${b.title}`);
    if ((b.rows?.length ?? 0) > LIMITS.maxRowsPerBlock) v.push(`bloque demasiado largo: ${b.title}`);
    if (b.chart) v.push(...chartViolations(b));
  }
  if (needsLabels && !(answer.figures?.length || answer.blocks?.length || answer.citations?.length)) v.push('respuesta ok sin cifras ni bloques');
  for (const c of answer?.citations ?? []) if (!isUuid(c.messageRevisionId) || typeof c.quote !== 'string') v.push('cita sin origen verificable');
  if (needsLabels && !(answer.sources?.length)) v.push('respuesta ok sin fuentes');
  if (needsLabels && !(answer.calc?.length)) v.push('respuesta ok sin «cómo lo calculé»');
  return v;
}

/** Una gráfica solo puede dibujar lo que la tabla del mismo bloque ya dice: serie finita, sin ceros inventados y donas solo de partes aditivas. */
export function chartViolations(b) {
  const c = b.chart; const out = []; const t = `gráfica de «${b.title}»`;
  if (!CHART_KINDS.includes(c.kind)) return [`${t}: tipo no soportado`];
  if (!Array.isArray(c.series) || c.series.length < (c.kind === 'line' ? 3 : 1)) return [`${t}: serie insuficiente`];
  if (c.series.length > LIMITS.maxRowsPerBlock) out.push(`${t}: demasiados puntos`);
  for (const s of c.series) {
    if (typeof s.label !== 'string' || typeof s.display !== 'string') out.push(`${t}: punto sin etiqueta`);
    if (s.value !== null && !(Number.isFinite(s.value) && s.value >= 0)) out.push(`${t}: valor no válido`);
    if (s.value === null && s.display !== 'No disponible') out.push(`${t}: un desconocido debe decir «No disponible», no 0`);
  }
  if (c.kind === 'donut') {
    if (c.additive !== true) out.push(`${t}: la dona exige partes aditivas del mismo todo`);
    if (c.series.some((s) => s.value === null)) out.push(`${t}: la dona no admite desconocidos`);
    if (!(c.series.reduce((a, s) => a + (s.value ?? 0), 0) > 0)) out.push(`${t}: dona sin total`);
  }
  return out;
}

const NUM = /\d[\d.,   ]*\d|\d/g;
const digits = (s) => s.replace(/\D/g, '');
/** Números presentes en un valor arbitrario (texto, objeto, arreglo), normalizados a dígitos. */
export function numbersIn(value, into = new Set(), depth = 0) {
  if (depth > 8 || value === null || value === undefined) return into;
  if (typeof value === 'number' && Number.isFinite(value)) { into.add(digits(String(Math.abs(value)))); return into; }
  if (typeof value === 'string') { for (const m of value.matchAll(NUM)) { into.add(digits(m[0])); for (const part of m[0].split(/[.,   ]+/)) if (part) into.add(digits(part)); } return into; }
  if (Array.isArray(value)) { for (const x of value) numbersIn(x, into, depth + 1); return into; }
  if (typeof value === 'object') for (const x of Object.values(value)) numbersIn(x, into, depth + 1);
  return into;
}
/** Verdadero si cada número del texto del modelo existe en lo que devolvieron las herramientas (o en la pregunta). */
export function numbersGrounded(text, allowed) {
  for (const m of String(text).matchAll(NUM)) {
    const whole = digits(m[0]);
    if (allowed.has(whole)) continue;
    const parts = m[0].split(/[.,   ]+/).filter(Boolean).map(digits);
    if (!parts.every((p) => allowed.has(p))) return false;
  }
  return true;
}
