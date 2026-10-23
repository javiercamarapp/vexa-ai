import test from 'node:test';
import assert from 'node:assert/strict';
import {CFO_TOOLS, CopilotError, buildCfoReport, createBudget, createCopilot, createSimulatedModel, exposureFixture, FIXTURE_WATERMARK, ledgerMonthlyFixture} from '../../../packages/cfo-copilot/src/index.mjs';
import {contractViolations} from '../../../packages/agent-datos/index.mjs';
import {adaptarRespuestaCfo, cuerpoConsultaCfo, esFueraDeCfo, esPreguntaDeCfo} from '../src/components/copiloto/adaptador-cfo.mjs';

const report = buildCfoReport(ledgerMonthlyFixture(), {watermark: FIXTURE_WATERMARK, now: new Date('2026-10-20T14:00:00Z'), exposure: exposureFixture({})});
const TENANT = '00000000-0000-4000-8000-000000000001';
const principal = role => ({kind: 'tenant_member', verified: true, userId: 'u1', tenantId: TENANT, role});
const ctx = () => ({data: {report: async () => ({status: 'ok', report})}});
const nuevo = (audit = {record: async () => {}}) => createCopilot({scope: 'tenant', tools: CFO_TOOLS, model: createSimulatedModel({scope: 'tenant'}), audit, budget: createBudget({monthlyCapMicro: 25_000_000n})});

test('consulta directa: el adaptador devuelve una respuesta del agente con cifras, tabla por herramienta, fuentes y desglose', async () => {
  const reply = await nuevo().ask({principal: principal('owner'), tool: 'resumen_mes', args: {}, ctx: ctx()});
  const a = adaptarRespuestaCfo(reply);
  assert.equal(a.status, 'ok'); assert.ok(a.text.includes('Resumen de')); assert.ok(a.figures.length > 3);
  assert.ok(a.figures.every(f => ['observed', 'estimated', 'inferred', 'unclassified'].includes(f.class) && typeof f.display === 'string'));
  assert.equal(a.blocks.length, 1); assert.equal(a.blocks[0].tool, 'resumen_mes'); assert.deepEqual(a.blocks[0].columns.map(c => c.label), ['Cifra', 'Valor', 'Alcance', 'Clase']);
  assert.ok(a.sources.length > 0 && a.sources.every(s => s.href.startsWith('/')));
  assert.equal(a.calc[0].tool, 'resumen_mes'); assert.equal(a.trace[0].estado, 'ok'); assert.equal(a.usage.mode, 'deterministic'); assert.equal(a.usage.modelCalls, 0);
  assert.deepEqual(contractViolations(a).filter(v => /status|blocks|figures|trace|calc/i.test(v)), [], 'la forma cumple el contrato del agente');
});
test('Observado/Estimado/Inferido se conservan por cifra y la clase del bloque es «mixed» si mezcla', async () => {
  const p = await nuevo().ask({principal: principal('owner'), tool: 'proyeccion', args: {metric: 'ingresos'}, ctx: ctx()});
  const a = adaptarRespuestaCfo(p);
  assert.ok(a.figures.every(f => f.class === 'estimated')); assert.equal(a.blocks[0].class, 'estimated');
  const m = adaptarRespuestaCfo({...p, figures: [...p.figures, {id: 'x', label: 'x', display: '1', kind: 'observed', coverage: null, scope: null, tool: 'proyeccion'}]});
  assert.equal(m.blocks[0].class, 'mixed');
});
test('sin dato no es cero: no_data conserva el texto y no inventa cifras ni tablas', async () => {
  const vacio = createCopilot({scope: 'tenant', tools: CFO_TOOLS, model: createSimulatedModel({scope: 'tenant'}), audit: {record: async () => {}}});
  const reply = await vacio.ask({principal: principal('analyst'), tool: 'resumen_mes', args: {}, ctx: {data: {report: async () => ({status: 'empty'})}}});
  const a = adaptarRespuestaCfo(reply);
  assert.equal(a.status, 'no_data'); assert.match(a.text, /No tengo el dato/); assert.deepEqual(a.figures, []); assert.deepEqual(a.blocks, []);
});
test('delegación: las preguntas de dinero van al motor de CFO y las de otro tema, al agente general', () => {
  for (const q of ['¿Hay alertas activas?', '¿Cómo cerró el último mes por moneda?', '¿Por qué cayó septiembre?', '¿Qué canal sin importes pesa más?', '¿Cuánto cuesta la mala calidad de datos?', 'y en CAD?', '¿Cuánto dinero perdimos por reembolsos de clientes?']) assert.equal(esPreguntaDeCfo(q), true, q);
  for (const q of ['¿Cuáles son los 5 problemas con más incidencias este mes?', '¿Qué dicen los clientes de la entrega?', '¿Qué cubre y qué falta de mi información?', 'hola']) assert.equal(esPreguntaDeCfo(q), false, q);
});
test('un plan vacío del motor también se detecta para delegar; una respuesta normal no', async () => {
  const cfo = await nuevo().ask({principal: principal('owner'), question: '¿Hay alertas activas?', ctx: ctx()});
  assert.equal(esFueraDeCfo(cfo), false);
  const vacia = {mode: 'ia', answer: 'No tengo el dato para responder eso con las herramientas disponibles.', steps: [], citations: [], figures: []};
  assert.equal(esFueraDeCfo(vacia), true);
  const a = adaptarRespuestaCfo(vacia, {sugerencias: ['¿Hay alertas activas?']});
  assert.equal(a.status, 'out_of_catalog'); assert.deepEqual(a.suggestions, ['¿Hay alertas activas?']);
});
test('rechazos, presupuesto agotado y respuestas sin forma se adaptan sin romper', () => {
  assert.equal(adaptarRespuestaCfo({mode: 'rechazada', answer: 'No puedo.', steps: [], citations: [], figures: []}).status, 'out_of_catalog');
  assert.equal(adaptarRespuestaCfo({mode: 'sin_ia', answer: 'Se agotó.', steps: [], citations: [], figures: []}).status, 'budget_exceeded');
  assert.equal(adaptarRespuestaCfo(null).status, 'unavailable');
  const roto = adaptarRespuestaCfo({mode: 'directa', answer: 'x', steps: [{tool: 'alertas', label: 'Alertas', status: 'denied', error: 'audit_unavailable'}], citations: [], figures: []});
  assert.equal(roto.status, 'forbidden'); assert.equal(roto.trace[0].estado, 'forbidden');
  const guard = adaptarRespuestaCfo({mode: 'ia', answer: 'x', steps: [{tool: 'alertas', label: 'A', status: 'ok'}], citations: [], figures: [{id: 'a', label: 'A', display: '1', kind: 'observed', coverage: 'c', scope: null, tool: 'alertas'}], guard: {ok: false, violations: ['1']}});
  assert.equal(guard.usage.guardRejected, true); assert.equal(guard.notes.length, 1);
});
test('el cuerpo hacia el motor nunca lleva organización ni rol y respeta los topes', () => {
  assert.deepEqual(cuerpoConsultaCfo({directa: {tool: 'alertas', args: {severity: 'alta'}}, question: 'x'}), {tool: 'alertas', args: {severity: 'alta'}});
  const b = cuerpoConsultaCfo({question: 'a'.repeat(900), history: Array.from({length: 10}, (_, i) => ({role: i % 2 ? 'assistant' : 'user', text: 't'.repeat(2000)}))});
  assert.equal(b.question.length, 600); assert.equal(b.history.length, 6); assert.ok(b.history.every(h => h.content.length <= 1000));
  assert.deepEqual(Object.keys(b).sort(), ['history', 'question']);
});
test('roles y bitácora: viewer/operator reciben 403; sin bitácora no se lee (fail-closed); la bitácora se escribe ANTES de leer', async () => {
  for (const role of ['viewer', 'operator']) await assert.rejects(nuevo().ask({principal: principal(role), tool: 'resumen_mes', ctx: ctx()}), e => e instanceof CopilotError && e.status === 403);
  await assert.rejects(nuevo().ask({principal: {...principal('owner'), verified: false}, tool: 'resumen_mes', ctx: ctx()}), e => e.status === 401);
  let leyo = false;
  const caido = nuevo({record: async () => { throw new Error('db caída'); }});
  const r = await caido.ask({principal: principal('owner'), tool: 'resumen_mes', ctx: {data: {report: async () => { leyo = true; return {status: 'ok', report}; }}}});
  assert.equal(leyo, false); assert.equal(adaptarRespuestaCfo(r).status, 'forbidden');
  const orden = [];
  await nuevo({record: async () => { orden.push('bitacora'); }}).ask({principal: principal('owner'), tool: 'alertas', ctx: {data: {report: async () => { orden.push('lectura'); return {status: 'ok', report}; }}}});
  assert.deepEqual(orden, ['bitacora', 'lectura']);
});
test('sin PII: ninguna respuesta adaptada contiene correos ni teléfonos', async () => {
  const c = nuevo(); const todas = [];
  for (const tool of ['resumen_mes', 'comparativa_mes', 'mezcla_canal', 'calidad_datos', 'exposicion_problemas', 'proyeccion', 'alertas']) todas.push(adaptarRespuestaCfo(await c.ask({principal: principal('owner'), tool, args: {}, ctx: ctx()})));
  const json = JSON.stringify(todas);
  assert.doesNotMatch(json, /[\w.+-]+@[\w-]+\.[\w.]+/); assert.doesNotMatch(json, /\b\d{3}[ -]\d{3}[ -]\d{4}\b/);
});
