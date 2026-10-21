// Defensas del copiloto: entrada no confiable, datos no confiables y cifras que el modelo no puede inventar.

/** Texto no confiable (nombres de organizaciones, títulos de problemas): sin control, sin ceros de ancho, una línea, acotado. */
export function sanitizeText(value, max = 120, {multiline = false} = {}) {
  const text = String(value ?? '').normalize('NFKC').replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff]/g, ' ').replace(/[`<>{}\[\]|\\]/g, ' ');
  if (!multiline) return text.replace(/\s+/g, ' ').trim().slice(0, max);
  return text.split('\n').map(l => l.replace(/[ \t\r]+/g, ' ').trim()).join('\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, max);
}
const INJECTION = [
  /ignora\w*\s+(todas?\s+)?(las\s+)?(instrucciones|reglas|indicaciones)/i, /olvida\w*\s+(todo|tus\s+(instrucciones|reglas))/i, /(muestra|revela|imprime|dime)\w*\s+(tu|el)\s+(prompt|mensaje\s+del?\s+sistema|system)/i,
  /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions|rules)/i, /(reveal|show|print)\s+(your\s+)?(system\s+)?prompt/i, /\bact(úa|ua)\s+como\b/i, /\bmodo\s+(desarrollador|dios|sin\s+restricciones)\b/i, /\bjailbreak\b/i,
  /<\s*\/?\s*(system|assistant|tool)\s*>/i, /\[\s*(system|inst)\s*\]/i,
];
const RAW_TEXT_REQUEST = [/(correo|email|tel[eé]fono|direcci[oó]n)s?\s+de\s+(los\s+)?(clientes|usuarios|compradores)/i, /(mensajes?|conversaciones?|textos?)\s+(literal(es)?|crud[oa]s?|original(es)?)\s+de\s+(los\s+)?(clientes|compradores)/i, /(copia|pega|transcribe)\w*\s+(el\s+)?(mensaje|ticket|conversaci[oó]n)/i, /(contenido|cuerpo)\s+de\s+(los\s+)?(mensajes|tickets)/i, /\b(pii|datos\s+personales)\b/i];
const CROSS_TENANT = [/(de|en)\s+(todas?\s+)?(las\s+)?otras?\s+(organizaciones|empresas|cuentas)/i, /otro\s+(tenant|cliente|inquilino)/i, /\btenant[_\s-]?id\b/i];
/** Clasifica una pregunta SIN bloquear por palabras sueltas: solo lo que pide romper reglas. */
export function classifyQuestion(text, {scope}) {
  const q = String(text ?? '');
  if (INJECTION.some(r => r.test(q))) return {risk: 'injection', reply: 'No puedo cambiar mis reglas ni mostrar mis instrucciones. Puedo responder con las cifras ya calculadas: dime qué quieres revisar.'};
  if (RAW_TEXT_REQUEST.some(r => r.test(q))) return {risk: 'raw_text', reply: 'No tengo acceso a mensajes, correos ni datos personales de clientes, y no los muestro. Solo trabajo con cifras agregadas y su procedencia.'};
  if (scope === 'tenant' && CROSS_TENANT.some(r => r.test(q))) return {risk: 'cross_tenant', reply: 'Solo veo los datos de tu organización. No puedo consultar otras.'};
  return {risk: 'ok'};
}

// Números que el modelo puede citar = los que aparecen en lo que devolvieron las herramientas.
const NUM = /\d[\d.,  ]*\d|\d/g;
const norm = t => t.replace(/[  ]/g, '').replace(/,/g, '').replace(/\.0+$/, '');
export function numbersIn(text) { const out = new Set(); for (const m of String(text).matchAll(NUM)) { const n = norm(m[0]); if (n) out.add(n); } return out; }
export function allowedNumbers(results) {
  const set = new Set();
  const walk = v => { if (v === null || v === undefined) return; if (typeof v === 'number') { set.add(norm(String(v))); set.add(norm(String(Math.round(v)))); } else if (typeof v === 'string') numbersIn(v).forEach(n => set.add(n)); else if (Array.isArray(v)) v.forEach(walk); else if (typeof v === 'object') Object.values(v).forEach(walk); };
  walk(results);
  return set;
}
/** Verifica que TODA cifra del texto proviene de los resultados de herramientas. Los números de un dígito se toleran. */
export function guardFigures(answer, results) {
  const allowed = allowedNumbers(results), bad = [];
  for (const n of numbersIn(answer)) { if (n.length <= 1 || allowed.has(n)) continue; bad.push(n); }
  return {ok: bad.length === 0, violations: bad};
}

/** Validador estricto de argumentos (JSON-schema mínimo). Propiedades desconocidas = rechazo (así ningún `tenantId` se cuela). */
export function validateArgs(schema = {}, args = {}) {
  if (args === null || typeof args !== 'object' || Array.isArray(args)) return {ok: false, error: 'args_invalid'};
  const props = schema.props ?? {}, out = {};
  for (const k of Object.keys(args)) if (!(k in props)) return {ok: false, error: 'arg_unknown:' + k};
  for (const [k, def] of Object.entries(props)) {
    const v = args[k];
    if (v === undefined || v === null || v === '') { if (def.required) return {ok: false, error: 'arg_required:' + k}; continue; }
    switch (def.type) {
      case 'enum': if (!def.values.includes(v)) return {ok: false, error: 'arg_invalid:' + k}; break;
      case 'month': if (typeof v !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(v)) return {ok: false, error: 'arg_invalid:' + k}; break;
      case 'uuid': if (typeof v !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)) return {ok: false, error: 'arg_invalid:' + k}; break;
      case 'int': if (!Number.isInteger(v) || v < (def.min ?? -Infinity) || v > (def.max ?? Infinity)) return {ok: false, error: 'arg_invalid:' + k}; break;
      case 'string': if (typeof v !== 'string' || v.length > (def.max ?? 80) || (def.pattern && !def.pattern.test(v))) return {ok: false, error: 'arg_invalid:' + k}; break;
      default: return {ok: false, error: 'schema_invalid'};
    }
    out[k] = v;
  }
  return {ok: true, args: out};
}
