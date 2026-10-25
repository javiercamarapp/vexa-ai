// Proveedor REAL de la lectura de IA (L4): APAGADO por defecto. Solo existe si VEXA_PAIN_AI==='enabled' Y hay llave. Ninguna prueba lo llama (se prueban con un proveedor simulado o un fetch inyectado).
// Costo REAL = tokens facturados × tarifa (micro-USD por token = USD por millón de tokens). Tarifas y modelo salen del entorno; si falta alguna tarifa se usa una conservadora ALTA (nunca subestimar).
// Se guarda solo el costo y los conteos: jamás el cuerpo de la respuesta de la API en logs.
export const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

export function iaHabilitada(env = process.env) { return env.VEXA_PAIN_AI === 'enabled' && /^sk-ant-[A-Za-z0-9_-]{20,}$/.test(env.VEXA_PAIN_AI_API_KEY ?? ''); }

/** @returns {{completar: Function}|null} null si está apagado: la UI deshabilita «Analizar» y la API responde ia_apagada. */
export function crearProveedorReal(env = process.env, {fetchImpl = globalThis.fetch, timeoutMs = 18000} = {}) {
  if (!iaHabilitada(env)) return null;
  const modelo = env.VEXA_PAIN_AI_MODEL || 'claude-sonnet-5-5';
  const tarifaIn = Number(env.VEXA_PAIN_AI_USD_PER_MTOK_IN || 5), tarifaOut = Number(env.VEXA_PAIN_AI_USD_PER_MTOK_OUT || 25);
  if (!(tarifaIn > 0) || !(tarifaOut > 0)) return null;
  return Object.freeze({
    async completar({sistema, usuario, maxTokens = 700}) {
      const r = await fetchImpl(ANTHROPIC_URL, {method: 'POST', redirect: 'error', signal: AbortSignal.timeout(timeoutMs),
        headers: {'content-type': 'application/json', 'x-api-key': env.VEXA_PAIN_AI_API_KEY, 'anthropic-version': '2023-06-01'},
        body: JSON.stringify({model: modelo, max_tokens: maxTokens, temperature: 0, system: sistema, messages: [{role: 'user', content: usuario}]})});
      if (!r.ok) throw Object.assign(Error('PROVEEDOR_RECHAZO'), {status: r.status});
      const j = await r.json();
      const texto = (j.content ?? []).filter(c => c.type === 'text').map(c => c.text).join('');
      const tokensIn = Number(j.usage?.input_tokens), tokensOut = Number(j.usage?.output_tokens);
      if (!Number.isFinite(tokensIn) || !Number.isFinite(tokensOut)) throw Error('PROVEEDOR_SIN_USO');
      return {texto, tokensIn, tokensOut, costoMicro: Math.ceil(tokensIn * tarifaIn + tokensOut * tarifaOut), modelo, proveedor: 'anthropic'};
    },
  });
}
