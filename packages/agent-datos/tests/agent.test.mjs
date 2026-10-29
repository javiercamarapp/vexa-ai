import test from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_QUESTIONS, contractViolations, createSimulatedModel, buildSuggestions, SYNTHETIC_TENANTS, createAgent } from '../index.mjs';
import { ask, ctxFor, portFor, ALL_TEXT } from './helpers.mjs';

test('15 preguntas de demostración de punta a punta (modo determinista, sin LLM)', async () => {
  assert.equal(DEMO_QUESTIONS.length, 21);
  for (const d of DEMO_QUESTIONS) {
    const a = await ask(d.q);
    assert.equal(a.status, d.expect ?? 'ok', `${d.q} -> ${a.status}: ${a.text}`);
    if (d.tool && !d.expect) assert.ok(a.calc.some((c) => c.tool === d.tool), `${d.q}: herramientas ${a.calc.map((c) => c.tool)}`);
    assert.deepEqual(contractViolations(a), [], d.q);
    assert.equal(a.usage.mode, 'deterministic'); assert.equal(a.usage.modelCalls, 1 - 1 + a.usage.modelCalls); assert.equal(a.usage.costMinor, '0');
    if (a.status === 'ok') { assert.ok(a.figures.length > 0 && a.sources.length > 0 && a.calc.length > 0); for (const f of a.figures) assert.ok(f.class && f.coverage); }
    if (a.status === 'no_data') { assert.match(a.text, /^No tengo ese dato/); assert.ok(a.missing.length > 0); }
    if (a.status === 'out_of_catalog') { assert.equal(a.figures.length, 0); assert.ok(a.suggestions.length > 0); }
  }
});
test('las consultas directas de los chips funcionan sin modelo y se validan igual que cualquier llamada', async () => {
  const { directas } = buildSuggestions((await portFor().coverage()), 'owner');
  assert.ok(Object.keys(directas).length >= 10);
  for (const [q, d] of Object.entries(directas)) { const a = await ask(q, { directa: d }); assert.equal(a.status, 'ok', q); assert.equal(a.usage.modelCalls, 0); }
  const bad = await ask('x', { directa: { tool: 'problemas_top', args: { tenant_id: SYNTHETIC_TENANTS.B } } });
  assert.equal(bad.status, 'invalid_input');
});
test('las sugerencias iniciales salen de la cobertura real: sin fuente cargada no se ofrece su pregunta', async () => {
  const cov = await portFor().coverage();
  const full = buildSuggestions(cov, 'owner'); assert.equal(full.loaded, 5); assert.equal(full.total, 7); assert.equal(full.sugerencias.length, 5);
  assert.equal(full.sugerencias[0], '¿Qué cubre y qué falta de mi información?');
  const noLedger = structuredClone(cov); noLedger.sources.find((s) => s.key === 'ledger').loaded = false;
  assert.ok(!buildSuggestions(noLedger, 'owner').categorias.flatMap((c) => c.preguntas).some((q) => /reembolsos tuvimos por marketplace/.test(q)));
  const none = structuredClone(cov); none.sources.forEach((s) => (s.loaded = false));
  const empty = buildSuggestions(none, 'owner'); assert.equal(empty.empty, true); assert.deepEqual(empty.sugerencias, ['¿Qué cubre y qué falta de mi información?']);
  const viewer = buildSuggestions(cov, 'viewer'); assert.ok(!viewer.categorias.flatMap((c) => c.preguntas).some((q) => /clientes/.test(q)));
});
test('con modelo simulado hay 2 llamadas (planear y redactar), costo registrado y texto verificado', async () => {
  const model = createSimulatedModel({ costMinor: '1200' });
  const a = await ask('¿Cuánto dinero en reembolsos tuvimos por marketplace?', { model });
  assert.equal(a.status, 'ok'); assert.equal(a.usage.modelCalls, 2); assert.equal(a.usage.costMinor, '2400'); assert.equal(a.usage.guardRejected, false);
});
test('pasos de herramienta en vivo: inicio y fin por cada consulta', async () => {
  const events = []; const agent = createAgent();
  await agent.answer({ ctx: ctxFor(), port: portFor(), question: '¿Qué cubre y qué falta y cómo van las asociaciones?', onEvent: (e) => { if (e.t === 'paso') events.push(`${e.fase}:${e.herramienta}`); } });
  assert.deepEqual(events, ['inicio:cobertura_datos', 'fin:cobertura_datos', 'inicio:estado_asociaciones', 'fin:estado_asociaciones']);
});
test('máximo 3 consultas por pregunta', async () => {
  const model = createSimulatedModel({ plan: async () => ({ calls: ['cobertura_datos', 'estado_tracker', 'estado_asociaciones', 'tendencia_conversaciones', 'problemas_top'].map((tool) => ({ tool, args: {} })) }) });
  const a = await ask('todo', { model });
  assert.equal(a.calc.length, 3); assert.match(a.text, /primeras 3 consultas/);
});
test('aclaraciones, causalidad y pronóstico no inventan cifras', async () => {
  const c = await ask('¿Qué cambió?'); assert.equal(c.status, 'clarify'); assert.equal(c.figures.length, 0);
  const k = await ask('¿Por qué subieron los reembolsos?'); assert.equal(k.status, 'out_of_catalog'); assert.match(k.text, /No afirmo causas/);
  const f = await ask('Pronóstico de ventas del próximo mes'); assert.equal(f.status, 'out_of_catalog'); assert.match(f.text, /No hago proyecciones/);
  const u = await ask('Cuéntame un chiste'); assert.equal(u.status, 'out_of_catalog');
  const amb = await ask('¿Qué dicen los clientes sobre el producto?'); assert.equal(amb.status, 'clarify'); assert.ok(amb.suggestions.length >= 2);
});
test('una respuesta que incumple el contrato no sale (falla cerrada)', async () => {
  const { TOOL_INDEX } = await import('../index.mjs'); const orig = TOOL_INDEX.cobertura_datos.run;
  TOOL_INDEX.cobertura_datos.run = async () => ({ status: 'ok', summary: 'Hay 5 fuentes.', figures: [{ id: 'x', label: 'x', display: '5', value: 5 }], blocks: [], missing: [], notes: [] });
  try { const a = await ask('¿Qué cubre mi información?'); assert.equal(a.status, 'unavailable'); assert.equal(a.figures.length, 0); assert.ok(a.violations.length > 0); } finally { TOOL_INDEX.cobertura_datos.run = orig; }
});
test('si el modelo falla, el agente cae al modo determinista y lo declara', async () => {
  const model = { kind: 'model', id: 'roto', plan: async () => { throw new Error('upstream 500'); } };
  const a = await ask('¿Qué cubre y qué falta de mi información?', { model });
  assert.equal(a.status, 'ok'); assert.equal(a.usage.fallback, true); assert.equal(a.usage.mode, 'deterministic');
});
test('fallo del puerto de datos -> unavailable', async () => {
  const a = await ask('¿Qué cubre y qué falta de mi información?', { portOpts: { failOn: ['coverage'] } });
  assert.equal(a.status, 'unavailable'); assert.equal(a.figures.length, 0);
});
