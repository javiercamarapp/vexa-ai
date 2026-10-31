// El idioma del turno llega hasta el agente, el planificador, las herramientas, la traza, las sugerencias y el prompt del modelo.
// En inglés no puede salir español en ningún texto del paquete que arma el agente (los datos del negocio, como títulos de problemas, no se traducen).
import '../../workspace-service/tests/cco-catalogo-env.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createAgent, createSimulatedModel, createGatewayModel, buildSuggestions, defaultSuggestions, DEMO_QUESTIONS, TOOLS, toolLabel, planByRules, COMPOSE_SYSTEM, COMPOSE_SYSTEM_EN, contractViolations, SYNTHETIC_NOW } from '../index.mjs';
import { ctxFor, portFor } from './helpers.mjs';
import { COMPOSE_SYSTEM_EN as EN2 } from '../model.mjs';

const ACENTOS = /[áéíóúñ¿¡«»]/i;
const PALABRAS = /\b(de|del|la|las|los|el|para|por|sin|con|una?|que|se|su|más|hay|datos|cargad[oa]s?|meses|mes|falta|cobertura|tengo|ventas|pedidos|reembolsos|fuente|fuentes|clientes|incidencias|problemas|estado|cambio|moneda)\b/i;
const espanol = (t) => ACENTOS.test(t) || (t.match(new RegExp(PALABRAS.source, 'gi')) ?? []).length >= 2;
/** Textos que arma el agente y ve la persona (se excluyen los datos del negocio: títulos de problemas, SKU y bodegas). */
function textosDe(a) {
  const out = [a.text, ...(a.missing ?? []), ...(a.notes ?? []), ...(a.suggestions ?? [])];
  for (const t of a.trace ?? []) out.push(t.label, t.detail);
  for (const b of a.blocks ?? []) { out.push(b.title, b.note); for (const c of b.columns ?? []) out.push(c.label); if (b.chart) out.push(b.chart.unit); }
  for (const c of a.calc ?? []) { out.push(c.label, c.method, ...(c.reads ?? [])); }
  for (const s of a.sources ?? []) out.push(s.label);
  return out.filter((x) => typeof x === 'string' && x);
}
const TITULOS = (await portFor().problems()).rows.map((p) => p.title); // datos del negocio: no se traducen
const sinDatos = (t) => TITULOS.reduce((x, tt) => x.split(tt).join(''), t);
const turno = (question, { idioma = 'en', role = 'owner', model, directa } = {}) => createAgent(model ? { model } : {}).answer({ ctx: ctxFor(role), port: portFor(), question, idioma, directa });

const PREGUNTAS_EN = [
  'What does my data cover and what is missing?', 'Which Tracker version leads and how many sheets are closed?', 'How are the ticket-contact associations going?', 'How are conversations going per month?',
  'How much money did we have in refunds by marketplace?', 'How did refunds evolve month by month?', 'How many orders did we have by marketplace in September?', 'What changed between July and September?',
  'How does each SKU perform on Amazon by sales, returns and defects?', 'Which SKUs look discontinued because they have had no sales for 3 months?', 'Which warehouse takes longest to dispatch warranty replacements?',
  'In which states are the cases concentrated?', 'Which SKUs are better sold as an Amazon seller and which direct?', 'Which SKUs should ship from own means and which with Amazon fulfillment?',
  'How much will I sell next quarter?', 'Why did refunds go up?', 'How many refunds did we have in Zendesk?',
];

test('en inglés, ninguna respuesta del agente (texto, bloques, traza, método, fuentes, sugerencias) sale en español', async () => {
  for (const q of PREGUNTAS_EN) {
    const a = await turno(q);
    assert.notEqual(a.status, 'invalid_input', q);
    assert.ok(a.status !== 'unavailable' || /try again/i.test(a.text), `${q} -> ${a.status}: ${a.text}`);
    const malos = textosDe(a).map(sinDatos).filter(espanol);
    assert.deepEqual(malos, [], `${q} -> ${a.status}`);
    assert.deepEqual(contractViolations(a), [], q);
  }
});
test('en inglés las preguntas se enrutan a la herramienta correcta (planificador bilingüe)', async () => {
  const esperado = {
    'What does my data cover and what is missing?': 'cobertura_datos', 'How are conversations going per month?': 'tendencia_conversaciones', 'How did refunds evolve month by month?': 'ledger_por_mes',
    'How much money did we have in refunds by marketplace?': 'ledger_por_fuente', 'What changed between July and September?': 'comparar_meses', 'Which categories grew in the last 6 months?': 'categorias_por_mes',
    'How much revenue is exposed per problem?': 'exposicion_por_problema',
  };
  for (const [q, tool] of Object.entries(esperado)) { const a = await turno(q); assert.ok(a.calc.some((c) => c.tool === tool), `${q}: ${a.calc.map((c) => c.tool)} ${a.status} ${a.text}`); }
});
test('el mismo turno en español sigue saliendo en español y el idioma por omisión del paquete es español', async () => {
  const es = await turno('¿Qué cubre y qué falta de mi información?', { idioma: 'es' });
  assert.match(es.text, /Hay datos de/); assert.match(es.trace[0].label, /Elegí/);
  const omit = await createAgent().answer({ ctx: ctxFor('owner'), port: portFor(), question: '¿Qué cubre y qué falta de mi información?' });
  assert.match(omit.text, /Hay datos de/);
  const en = await turno('What does my data cover and what is missing?');
  assert.match(en.text, /There is data from/); assert.match(en.trace[0].label, /I chose/);
  assert.notEqual(es.text, en.text);
});
test('el idioma también puede venir en ctx.idioma (sin argumento aparte) y los rechazos, aclaraciones y errores salen en ese idioma', async () => {
  const ag = createAgent();
  const via = await ag.answer({ ctx: { ...ctxFor('owner'), idioma: 'en' }, port: portFor(), question: 'How much will I sell next quarter?' });
  assert.equal(via.status, 'out_of_catalog'); assert.match(via.text, /projections or forecasts/); assert.ok(via.suggestions.every((s) => !espanol(s)));
  const causal = await turno('Why did refunds go up?'); assert.match(causal.text, /I don't state causes/);
  const clar = await turno('What changed?'); assert.equal(clar.status, 'clarify'); assert.match(clar.text, /Between which two months/);
  const sinRol = await ag.answer({ ctx: { ...ctxFor('owner'), role: 'intruso' }, port: portFor(), question: 'x', idioma: 'en' }); assert.equal(sinRol.status, 'forbidden'); assert.match(sinRol.text, /Your role/);
  const larga = await turno('x'.repeat(700)); assert.equal(larga.status, 'invalid_input'); assert.match(larga.text, /Write a question/);
  const fuera = await turno('What do customers say about the tool?', { role: 'viewer' }); assert.ok(!espanol(fuera.text), fuera.text);
});
test('la consulta directa de un chip en inglés se ejecuta igual y la traza está en inglés', async () => {
  const { directas, sugerencias, categorias } = buildSuggestions(await portFor().coverage(), 'owner', 'en');
  assert.ok(Object.keys(directas).length >= 10);
  for (const [q, d] of Object.entries(directas)) { assert.ok(!ACENTOS.test(q) || /producto|cobro/.test(q), q); const a = await turno(q, { directa: d }); assert.equal(a.status, 'ok', q); assert.equal(a.usage.modelCalls, 0); assert.deepEqual(textosDe(a).map(sinDatos).filter(espanol), [], q); }
  assert.equal(sugerencias[0], 'What does my data cover and what is missing?');
  assert.deepEqual(categorias.map((c) => c.titulo), ['Coverage', 'Money', 'CCO', 'Problems and customers']);
  assert.ok(defaultSuggestions('viewer', 'en').every((s) => !espanol(s)));
  const esq = buildSuggestions(await portFor().coverage(), 'owner'); assert.equal(esq.sugerencias[0], '¿Qué cubre y qué falta de mi información?');
});
test('las etiquetas de paso de cada herramienta existen en inglés y no repiten el español', () => {
  for (const t of TOOLS) { const en = toolLabel(t, 'en'); assert.ok(en && en !== t.label && !espanol(en), t.name + ': ' + en); assert.equal(toolLabel(t, 'es'), t.label); }
});
test('el modelo recibe el idioma: el planificador y la redacción reciben ctx.idioma y el prompt de redacción pide inglés', async () => {
  const seen = [];
  const model = createSimulatedModel({ seen });
  await turno('What does my data cover and what is missing?', { model });
  const plan = seen.find((s) => s.op === 'plan'), compose = seen.find((s) => s.op === 'compose');
  assert.equal(plan.input.ctx.idioma, 'en'); assert.equal(compose.input.ctx.idioma, 'en');
  const peticiones = [];
  const gw = createGatewayModel({ gateway: { complete: async (r) => { peticiones.push(r); return r.op === 'plan' ? { output: { calls: [{ tool: 'cobertura_datos', args: {} }] }, usage: { inputTokens: 1, outputTokens: 1, costMinor: '0' } } : { output: { text: 'ok' }, usage: { inputTokens: 1, outputTokens: 1, costMinor: '0' } }; } }, tenantId: 't' });
  await createAgent({ model: gw }).answer({ ctx: ctxFor('owner'), port: portFor(), question: 'What does my data cover?', idioma: 'en' });
  const comp = peticiones.find((p) => p.op === 'compose'); assert.equal(comp.system, COMPOSE_SYSTEM_EN); assert.match(comp.system, /American English/); assert.equal(comp.input.idioma, 'en');
  peticiones.length = 0;
  await createAgent({ model: gw }).answer({ ctx: ctxFor('owner'), port: portFor(), question: '¿Qué cubre mi información?', idioma: 'es' });
  assert.equal(peticiones.find((p) => p.op === 'compose').system, COMPOSE_SYSTEM); assert.equal(EN2, COMPOSE_SYSTEM_EN);
});
test('el planificador por reglas entiende meses y frases en inglés y no confunde el idioma de la interfaz con el de la pregunta', () => {
  const ctx = { month: '2026-10', idioma: 'es' };
  const p = planByRules({ question: 'What changed between July and September?', ctx, vocabulary: { problems: [] } });
  assert.deepEqual(p.calls[0].args, { a: '2026-07', b: '2026-09' });
  const sinMes = planByRules({ question: 'What changed?', ctx: { ...ctx, idioma: 'en' }, vocabulary: { problems: [] } }); assert.match(sinMes.clarify, /Between which two months/);
  const sinMesEs = planByRules({ question: '¿Qué cambió?', ctx, vocabulary: { problems: [] } }); assert.match(sinMesEs.clarify, /Entre qué dos meses/);
});
test('las 21 preguntas de demostración tienen texto en inglés (cada una distinta del español, salvo nombres)', () => {
  const en = buildSuggestions({ sources: DEMO_QUESTIONS.map((d) => d.need).filter(Boolean).map((k) => ({ key: k, loaded: true })) }, 'owner', 'en');
  assert.ok(en.sugerencias.every((q) => !/[¿]/.test(q)));
  assert.ok(SYNTHETIC_NOW);
});
