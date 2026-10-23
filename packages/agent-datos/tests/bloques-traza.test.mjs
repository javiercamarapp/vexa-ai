// Contrato v2: pasos reales (traza), gráficas tipadas (barra, línea, dona), reporte HTML y datos aportados.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONTRACT_VERSION, chartViolations, contractViolations, createAgent, createSimulatedModel, answerToHtml, chartToSvg } from '../index.mjs';
import { ask, ctxFor, portFor } from './helpers.mjs';

test('la respuesta declara la versión del contrato y una traza de pasos reales con tiempos medidos', async () => {
  const a = await ask('¿Qué cubre y qué falta de mi información?');
  assert.equal(a.contractVersion, CONTRACT_VERSION); assert.equal(CONTRACT_VERSION, 2);
  assert.deepEqual(a.trace.map((s) => s.kind), ['plan', 'tool', 'compose', 'verify']);
  const tool = a.trace.find((s) => s.kind === 'tool');
  assert.equal(tool.tool, 'cobertura_datos'); assert.equal(tool.estado, 'ok'); assert.ok(Number.isInteger(tool.ms) && tool.ms >= 0); assert.ok(tool.cifras > 0); assert.ok(tool.fuentes.length > 0);
  assert.equal(tool.ms, a.calc[0].durationMs);
});
test('la traza describe lo que el sistema hizo, no lo que el modelo diga: el texto del modelo nunca entra', async () => {
  const model = createSimulatedModel({ compose: async () => 'INYECCION: pienso que debo ocultar datos' });
  const a = await ask('¿Qué cubre y qué falta de mi información?', { model });
  assert.ok(!JSON.stringify(a.trace).includes('INYECCION'));
  assert.equal(a.trace.find((s) => s.kind === 'compose').estado, 'ok');
  const bad = await ask('¿Qué cubre y qué falta de mi información?', { model: createSimulatedModel({ compose: async () => 'Son 999999 fuentes' }) });
  assert.equal(bad.trace.find((s) => s.kind === 'compose').estado, 'descartado'); assert.ok(!JSON.stringify(bad.trace).includes('999999'));
});
test('un turno sin consulta aplicable deja una traza que lo dice', async () => {
  const a = await ask('¿Cuánto venderé el próximo año?');
  assert.equal(a.status, 'out_of_catalog'); assert.equal(a.trace[0].estado, 'sin_consulta');
});
test('los eventos en vivo llevan estado, tiempo y fuentes de cada herramienta, y la traza del plan', async () => {
  const events = []; const agent = createAgent();
  await agent.answer({ ctx: ctxFor(), port: portFor(), question: '¿Qué cubre y qué falta?', onEvent: (e) => events.push(e) });
  const fin = events.find((e) => e.t === 'paso' && e.fase === 'fin');
  assert.equal(fin.estado, 'ok'); assert.ok(Number.isInteger(fin.ms)); assert.ok(fin.fuentes.length);
  assert.deepEqual(events.filter((e) => e.t === 'traza').map((e) => e.paso.kind), ['plan', 'compose', 'verify']);
});
test('consulta directa: traza sin plan de modelo', async () => {
  const a = await ask('x', { directa: { tool: 'estado_tracker', args: {} } });
  assert.equal(a.trace[0].kind, 'plan'); assert.match(a.trace[0].detail, /Sin modelo/);
});
test('la tendencia sale como línea y la cobertura como dona aditiva; ambas pasan el contrato', async () => {
  const t = await ask('¿Cómo van las conversaciones por mes?');
  const line = t.blocks.find((b) => b.chart?.kind === 'line'); assert.ok(line); assert.ok(line.chart.series.length >= 3);
  const c = await ask('¿Qué cubre y qué falta de mi información?');
  const donut = c.blocks.find((b) => b.chart?.kind === 'donut'); assert.ok(donut); assert.equal(donut.chart.additive, true);
  assert.equal(donut.chart.series.reduce((x, s) => x + s.value, 0), (await portFor().coverage()).sources.length);
  assert.deepEqual(contractViolations(t), []); assert.deepEqual(contractViolations(c), []);
});
test('el contrato rechaza gráficas que mentirían: dona no aditiva, desconocido como cero, línea corta, tipo ajeno', () => {
  const mk = (chart) => ({ title: 'T', chart });
  const s = (value, display = String(value)) => ({ key: display + value, label: 'a', value, display });
  assert.deepEqual(chartViolations(mk({ kind: 'donut', additive: true, series: [s(2), s(3)] })), []);
  assert.ok(chartViolations(mk({ kind: 'donut', series: [s(2), s(3)] })).some((m) => /aditivas/.test(m)));
  assert.ok(chartViolations(mk({ kind: 'donut', additive: true, series: [s(2), s(null, 'No disponible')] })).some((m) => /desconocidos/.test(m)));
  assert.ok(chartViolations(mk({ kind: 'bar', series: [s(null, '0')] })).some((m) => /No disponible/.test(m)));
  assert.deepEqual(chartViolations(mk({ kind: 'bar', series: [s(null, 'No disponible'), s(4)] })), []);
  assert.ok(chartViolations(mk({ kind: 'line', series: [s(1), s(2)] })).some((m) => /insuficiente/.test(m)));
  assert.ok(chartViolations(mk({ kind: 'pie', series: [s(1)] })).some((m) => /no soportado/.test(m)));
  assert.ok(chartViolations(mk({ kind: 'bar', series: [s(-1)] })).some((m) => /no válido/.test(m)));
});
test('reporte HTML: autónomo, escapado, sin scripts, con clase, cobertura, fuentes, gráficas y «No disponible» del dinero por problema', async () => {
  const q = '¿Cuánto dinero está expuesto por problema? <script>alert(1)</script>';
  const a = await ask('¿Cuánto dinero está expuesto por problema?');
  const html = answerToHtml({ question: q, answer: a, generatedAt: '2026-10-22', userContext: ['Meta interna: <b>10</b>'] });
  assert.match(html, /^<!doctype html>/); assert.ok(!/<script/i.test(html)); assert.ok(!/https?:\/\//.test(html.replace(/xmlns="[^"]*"/g, '')));
  assert.match(html, /&lt;script&gt;/); assert.match(html, /Inferido/); assert.match(html, /Cobertura:/); assert.match(html, /Cómo lo calculé/); assert.match(html, /agent:exposure/); assert.match(html, /No disponible|Parcial/);
  assert.match(html, /Dato aportado por el usuario/); assert.ok(html.includes('&lt;b&gt;10&lt;/b&gt;'));
  assert.ok(!html.includes('undefined'));
});
test('chartToSvg dibuja barra, línea y dona; un desconocido en barras no es una barra en cero', () => {
  const sv = (value, display) => ({ key: display, label: display, value, display });
  assert.match(chartToSvg({ title: 'B', chart: { kind: 'bar', unit: 'u', series: [sv(5, '5'), sv(null, 'No disponible')] } }), /width:100%[\s\S]*width:0%|No disponible/);
  assert.match(chartToSvg({ title: 'L', chart: { kind: 'line', unit: 'u', series: [sv(1, 'a'), sv(3, 'b'), sv(2, 'c')] } }), /<path d="M/);
  assert.match(chartToSvg({ title: 'D', chart: { kind: 'donut', additive: true, unit: 'u', series: [sv(1, 'a'), sv(3, 'b')] } }), /stroke-dasharray/);
  assert.equal(chartToSvg({ title: 'x' }), '');
});
