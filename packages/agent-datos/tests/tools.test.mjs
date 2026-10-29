import test from 'node:test';
import assert from 'node:assert/strict';
import { executeTool, TOOLS, SYNTHETIC_TENANTS, CLASSES } from '../index.mjs';
import { ctxFor, portFor, store } from './helpers.mjs';

const run = (name, args = {}, role = 'owner', tenant = SYNTHETIC_TENANTS.A, portOpts) => executeTool({ name, args, port: portFor(tenant, portOpts), ctx: ctxFor(role, tenant) });

test('cada herramienta devuelve cifras con clase y cobertura, fuente y método', async () => {
  const calls = { cobertura_datos: {}, estado_tracker: {}, estado_asociaciones: {}, tendencia_conversaciones: {}, problemas_top: {}, exposicion_por_problema: {}, categorias_por_mes: {}, ledger_por_fuente: { kind: 'refund' }, ledger_por_mes: { kind: 'order' }, comparar_meses: { a: '2026-07', b: '2026-09' }, evidencias_de_problema: { problema: 'producto dañado' }, clientes_por_problema: { problema: 'cobro duplicado' }, rendimiento_sku: {}, candidatos_sin_venta: {}, eficiencia_bodegas: {}, casos_por_estado: {}, casos_por_subcanal: {} };
  // envio_propio_vs_amazon (pregunta F) responde siempre no_data: se prueba en cco-tools.test.mjs.
  assert.deepEqual([...Object.keys(calls), 'envio_propio_vs_amazon'].sort(), TOOLS.map((t) => t.name).sort());
  for (const [name, args] of Object.entries(calls)) {
    const r = await run(name, args);
    assert.equal(r.status, 'ok', name); assert.ok(r.figures.length > 0, name); assert.ok(r.sources.length === 1 && r.method && r.reads.length, name);
    for (const f of r.figures) { assert.ok(CLASSES.includes(f.class), `${name} clase`); assert.ok(Number.isInteger(f.coverage.known_n) && (f.coverage.eligible_n === null || f.coverage.eligible_n >= f.coverage.known_n), `${name} cobertura`); assert.match(f.id, new RegExp('^' + name + '\\.\\d+$')); }
    for (const b of r.blocks) { assert.ok(CLASSES.includes(b.class) || b.class === 'mixed', `${name} bloque`); assert.ok(b.coverage, `${name} cobertura de bloque`); }
  }
});
test('reembolsos por marketplace: la suma de USD coincide con la serie mensual del libro y las monedas no se mezclan', async () => {
  const bySource = await run('ledger_por_fuente', { kind: 'refund' });
  const monthly = await run('ledger_por_mes', { kind: 'refund' });
  const rows = bySource.blocks[0].rows;
  assert.deepEqual([...new Set(rows.map((r) => r.moneda))].sort(), ['MXN', 'USD']);
  const usd = rows.filter((r) => r.moneda === 'USD');
  const parse = (s) => BigInt(s.replace(/[^\d]/g, ''));
  const total = usd.reduce((a, r) => a + parse(r.importe), 0n);
  assert.equal(String(total), String(parse(monthly.figures[0].display)), 'USD por fuente = USD mensual');
  assert.match(bySource.blocks[0].note, /no se suman/);
  assert.ok(!bySource.figures.some((f) => f.currency === undefined));
});
test('problemas_top: ordena por incidencias y respeta el límite; el mes por defecto es el mes en curso', async () => {
  const r = await run('problemas_top', { limit: 5 });
  const inc = r.blocks[0].rows.map((x) => x.incidencias);
  assert.equal(inc.length, 5); assert.deepEqual(inc, [...inc].sort((a, b) => b - a));
  assert.match(r.blocks[0].title, /octubre de 2026/);
  assert.ok(r.figures.every((f) => f.class === 'inferred'));
  const old = await run('problemas_top', { month: '2026-07', limit: 2 }); assert.match(old.blocks[0].title, /julio de 2026/);
});
test('exposición: un importe incompleto nunca se muestra como total ni como cero', async () => {
  const r = await run('exposicion_por_problema');
  const partial = r.blocks[0].rows.filter((x) => /Parcial|No disponible/.test(x.expuesto));
  assert.ok(partial.length >= 3);
  assert.ok(partial.every((x) => !/^0(\.00)? USD/.test(x.expuesto)));
  assert.match(r.blocks[0].note, /No equivale a pérdida/);
});
test('lo que no está cargado responde «no tengo ese dato» y dice qué falta', async () => {
  const z = await run('ledger_por_fuente', { kind: 'refund', fuente: 'zendesk' });
  assert.equal(z.status, 'no_data'); assert.match(z.summary, /Zendesk no está cargado/); assert.ok(z.missing.some((m) => /Zendesk/.test(m))); assert.equal(z.figures.length, 0);
  const m = await run('comparar_meses', { a: '2024-01', b: '2024-02' }); assert.equal(m.status, 'no_data');
  const e = await run('problemas_top', { month: '2024-03' }); assert.equal(e.status, 'no_data');
});
test('comparar_meses: los cambios son diferencias exactas de lo que muestran las series', async () => {
  const r = await run('comparar_meses', { a: '2026-07', b: '2026-09' });
  const conv = r.blocks[0].rows[0]; assert.equal(conv.medida, 'Conversaciones (todas las fuentes, con fecha)'); assert.equal(conv['2026-07'], '7,210'); assert.equal(conv['2026-09'], '7,480'); assert.match(conv.cambio, /^\+270 \(\+3\.7 %\)$/);
  assert.equal(r.blocks[0].class, 'mixed'); assert.equal(conv.clase, 'Estimado');
  assert.ok(r.blocks[1].rows[0].cambio.startsWith('+')); assert.equal(r.blocks[1].class, 'inferred');
});
test('evidencias: devuelve citas ancladas a una revisión y la vista del modelo no las contiene', async () => {
  const r = await run('evidencias_de_problema', { problema: 'producto dañado en tránsito' });
  assert.equal(r.citations.length, 3); assert.ok(r.citations.every((c) => /^[0-9a-f-]{36}$/.test(c.messageRevisionId)));
  const { modelViewOf } = await import('../index.mjs'); const mv = JSON.stringify(modelViewOf(r));
  for (const c of r.citations) assert.ok(!mv.includes(c.quote.slice(0, 20)), 'la vista del modelo filtra una cita');
});
test('problema ambiguo -> clarify; sin coincidencia -> no_data', async () => {
  const a = await run('evidencias_de_problema', { problema: 'producto' });
  assert.equal(a.status, 'clarify'); assert.ok(a.options.length >= 2);
  const n = await run('evidencias_de_problema', { problema: 'zapatos voladores' }); assert.equal(n.status, 'no_data');
});
test('rol: viewer/operator reciben forbidden en herramientas con citas o clientes', async () => {
  for (const role of ['viewer', 'operator']) for (const name of ['evidencias_de_problema', 'clientes_por_problema']) { const r = await run(name, { problema: 'cobro duplicado' }, role); assert.equal(r.status, 'forbidden'); assert.equal(r.citations.length, 0); }
  assert.equal((await run('cobertura_datos', {}, 'viewer')).status, 'ok');
  assert.equal((await run('cobertura_datos', {}, 'intruso')).status, 'forbidden');
});
test('herramientas fuera de catálogo o con argumentos extra se rechazan sin ejecutar nada', async () => {
  assert.equal((await run('DROP_TABLE')).status, 'invalid_input');
  assert.equal((await run('constructor')).status, 'invalid_input');
  assert.equal((await run('problemas_top', { tenant_id: SYNTHETIC_TENANTS.B })).status, 'invalid_input');
  assert.equal((await run('cobertura_datos', { sql: 'select 1' })).status, 'invalid_input');
});
test('timeouts y errores del puerto -> unavailable, nunca una cifra inventada', async () => {
  const slow = await executeTool({ name: 'cobertura_datos', args: {}, port: portFor(SYNTHETIC_TENANTS.A, { delayMs: 200 }), ctx: ctxFor(), timeoutMs: 20 });
  assert.equal(slow.status, 'unavailable'); assert.equal(slow.error, 'timeout'); assert.equal(slow.figures.length, 0);
  const boom = await run('tendencia_conversaciones', {}, 'owner', SYNTHETIC_TENANTS.A, { failOn: ['trends'] });
  assert.equal(boom.status, 'unavailable'); assert.equal(boom.figures.length, 0);
});
test('la tendencia de conversaciones se rotula Estimado cuando viene de muestra y lleva su nota', async () => {
  const r = await run('tendencia_conversaciones', { months: 6 });
  assert.ok(r.figures.every((f) => f.class === 'estimated')); assert.match(r.blocks[0].note, /muestra del 10 %/); assert.equal(r.blocks[0].rows.length, 6);
});
test('un tenant sin datos recibe no_data (no ceros)', async () => {
  const r = await executeTool({ name: 'problemas_top', args: {}, port: portFor('00000000-0000-4000-8000-0000000000ff'), ctx: ctxFor('owner', '00000000-0000-4000-8000-0000000000ff') });
  assert.equal(r.status, 'no_data');
});
test('los datos sintéticos son coherentes entre sí', () => {
  const A = store.get(SYNTHETIC_TENANTS.A);
  const cat = {}; for (const p of A.problems) cat[p.category] = (cat[p.category] ?? 0) + p.series[11];
  assert.equal(cat.calidad, A.problems[0].series[11] + A.problems[5].series[11]);
  for (const c of A.classified) assert.ok(c.classified <= c.eligible);
});
test('QA2-001: el valor de las gráficas de importes sale de unidades menores / 10^exponente (no un 100 fijo) en ledger_por_mes y ledger_por_fuente', async () => {
  const base = portFor(SYNTHETIC_TENANTS.A);
  const mk = (exponent, amountMinor) => ({ ...base, trends: async () => ({ ...(await base.trends()), ledger: { status: 'ok', class: 'observed', currency: 'JPY', exponent, otherCurrencies: [], series: [{ month: '2026-08', orders: { count: 2, unknownAmounts: 0, amountMinor }, refunds: { count: 0, unknownAmounts: 0, amountMinor: '0' } }, { month: '2026-09', orders: { count: 4, unknownAmounts: 0, amountMinor: String(BigInt(amountMinor) * 2n) }, refunds: { count: 0, unknownAmounts: 0, amountMinor: '0' } }] } }) });
  const chartOf = async (exponent, amountMinor) => (await executeTool({ name: 'ledger_por_mes', args: { kind: 'order' }, port: mk(exponent, amountMinor), ctx: ctxFor('owner', SYNTHETIC_TENANTS.A) })).blocks[0].chart.series;
  assert.deepEqual((await chartOf(0, '5000')).map((s) => s.value), [5000, 10000]);
  assert.deepEqual((await chartOf(2, '80398216')).map((s) => s.value), [803982.16, 1607964.32]);
  assert.deepEqual((await chartOf(3, '1500')).map((s) => s.value), [1.5, 3]);
});
