// Herramientas CCO del Copiloto CFO (preguntas A a F): solo lectura, mismos roles que /cco, organización de la sesión, procedencia y estado en cada respuesta,
// lo que falta con a quién pedirlo, E y F sin recomendar jamás, y sin PII. Datos 100 % sintéticos.
//   node --test packages/cfo-copilot/tests/cco-copilot.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {createCopilot, createBudget, createSimulatedModel, CFO_TOOLS, CFO_SHORTCUTS, CopilotError, guardFigures} from '../src/index.mjs';
import {CCO_TOOLS} from '../src/copilot/cco-tools.mjs';
import {armarCco} from '../../workspace-service/cco.mjs';

const T1 = '11111111-1111-4111-8111-111111111111', T2 = '22222222-2222-4222-8222-222222222222';
const principal = (tenantId = T1, role = 'owner') => ({kind: 'tenant_member', verified: true, userId: 'u-' + role, tenantId, role});
const ok = rows => ({rows}), cel = (d1, d2, n, es_otros = false) => ({d1, d2, n, es_otros}), dm = (dim, d1, d2, n) => ({dim, d1, d2, n, es_otros: false});
const raw = sku => ({
  ventanas: ok([{channel: 'amazon', refunds_available: true, orders_from: '2025-10-01', orders_to: '2026-10-02', refunds_from: '2025-10-01', refunds_to: '2026-10-02', month_from: '2025-10-01', month_to: '2026-09-01', months: 12, complete: false}]),
  skuCanal: ok([{channel: 'amazon', sku_base: sku, currency: 'USD', exponent: 2, order_lines: 100, order_gross_minor: '250000', refund_n: 10, refund_n_unknown_amount: 10, refund_amount_minor: null, refunds_per_100_lines: 10},
    {channel: 'amazon', sku_base: sku + '-B', currency: 'USD', exponent: 2, order_lines: 40, order_gross_minor: '90000', refund_n: 2, refund_n_unknown_amount: 0, refund_amount_minor: '4000', refunds_per_100_lines: 5}]),
  sinVenta: ok([{sku_base: sku + '-OLD', first_sale_month: '2025-10-01', last_sale_month: '2026-05-01', months_without_sale: 4, lines_last_3m: 0, lines_last_6m: 0, lines_last_9m: 12, channels: ['amazon'], skus_with_sales: 40, reference_month: '2026-09-01', data_through: '2026-10-02'}]),
  defecto: ok([cel(sku, 'defectuoso', 11)]), hoja: ok([]),
  subcanal: ok([cel('amazon_cumplido_por_piloto', null, 40), cel('amazon_com', null, 20), cel('walmart_cumplido_por_walmart', null, 9), cel('amazon_nuevo_futuro', null, 7), cel('lowes', null, 25), cel(null, null, 8, true)]),
  bodLat: ok([cel('DEMO-N1', '2_dias', 9), cel('Bodega Alfa', '3_o_mas_dias', 12), cel(null, null, 6, true)]), bodMot: ok([cel('DEMO-N1', 'defectuoso', 9)]),
  cob: ok([{rows_total: 200, with_retailer: 190, with_sku: 190, with_warehouse: 40, with_latency: 30, with_address: 100, sheets: 4, cutoff: '2026-10-05T00:00:00Z'}]),
  modalidad: ok([dm('subcanal_tipo', 'amazon_cumplido_por_piloto', 'reembolso', 14), dm('subcanal_defecto', 'amazon_cumplido_por_piloto', 'defectuoso', 9), dm('sku_subcanal', sku, 'amazon_cumplido_por_piloto', 18), dm('sku_subcanal', sku, 'amazon_com', 8),
    dm('sku_subcanal_tipo', sku, 'amazon_cumplido_por_piloto|reembolso', 7)]),
});
const geo = {status: 'ok', generatedAt: '2026-10-28T12:00:00.000Z', minimoPorCelda: 5, cobertura: {filas: 100, conDireccion: 50, interpretables: 45, pctInterpretablesDeDireccion: 90, pais: {US: 45, MX: 0}},
  estados: [{clave: 'US-TX', nombre: 'Texas', pais: 'US', n: 12, tipos: {items: []}, retailers: {items: []}}], ocultos: {estados: 2, casos: 4, minimo: 5}};
const vistas = new Map([[T1, armarCco(raw('SYN-T1'), geo, {now: new Date('2026-10-28T12:00:00Z')})], [T2, armarCco(raw('SYN-T2'), geo, {now: new Date('2026-10-28T12:00:00Z')})]]);
function setup({model, data} = {}) {
  const calls = [], log = [];
  const ctxData = data ?? {async cco(tenantId) { calls.push(tenantId); const cco = vistas.get(tenantId); return cco ? {status: 'ok', cco} : {status: 'empty'}; }, async report() { return {status: 'empty'}; }};
  const copilot = createCopilot({scope: 'tenant', tools: CFO_TOOLS, model: model ?? createSimulatedModel({scope: 'tenant'}), audit: {async record(e) { log.push(e); }}, budget: createBudget()});
  return {copilot, calls, log, ctx: {data: ctxData}};
}
const direct = async (s, tool, args = {}, p = principal()) => { const r = await s.copilot.ask({principal: p, tool, args, ctx: s.ctx}); return {r, step: r.steps[0], answer: r.answer}; };

test('las seis herramientas existen, solo para propietario y analista, sin argumentos libres', () => {
  assert.deepEqual(CCO_TOOLS.map(t => t.name), ['cco_rendimiento_sku', 'cco_sin_venta', 'cco_bodegas', 'cco_estados', 'cco_modalidad_venta', 'cco_modalidad_envio']);
  assert.ok(CCO_TOOLS.every(t => t.scope === 'tenant' && JSON.stringify(t.roles) === JSON.stringify(['owner', 'analyst'])));
  for (const t of CCO_TOOLS) { assert.ok(CFO_TOOLS.includes(t)); for (const [k, d] of Object.entries(t.input.props)) { assert.ok(['enum', 'int'].includes(d.type), `${t.name}.${k} no puede ser texto libre`); if (d.type === 'int') assert.ok(Number.isInteger(d.min) && Number.isInteger(d.max)); } }
  for (const bad of ['tenantId', 'organizationId', 'sql', 'query', 'texto', 'role']) assert.ok(CCO_TOOLS.every(t => !(bad in t.input.props)), bad);
  assert.equal(new Set(CFO_TOOLS.map(t => t.name)).size, CFO_TOOLS.length, 'nombres únicos');
});
test('roles: viewer, operator y sin verificar no pueden usar ninguna herramienta CCO', async () => {
  const s = setup();
  for (const role of ['viewer', 'operator']) for (const t of CCO_TOOLS) await assert.rejects(() => s.copilot.ask({principal: principal(T1, role), tool: t.name, args: {}, ctx: s.ctx}), e => e instanceof CopilotError && e.code === 'forbidden', role + t.name);
  await assert.rejects(() => s.copilot.ask({principal: {...principal(), verified: false}, tool: 'cco_estados', args: {}, ctx: s.ctx}), e => e.code === 'unauthenticated');
  for (const role of ['owner', 'analyst']) for (const t of CCO_TOOLS) assert.equal((await direct(s, t.name, t.name === 'cco_modalidad_venta' || t.name === 'cco_modalidad_envio' ? {} : {}, principal(T1, role))).step.status, 'ok', role + t.name);
});
test('cada respuesta trae tabla, estado, procedencia (clase, fuente, corte) y lo que falta con a quién pedirlo', async () => {
  const s = setup();
  const esperado = {cco_rendimiento_sku: /A\. Rendimiento por SKU · Amazon · USD[\s\S]*SKU · Líneas · Ingreso bruto[\s\S]*SYN-T1 · 100/, cco_sin_venta: /SKU · Último mes con venta[\s\S]*SYN-T1-OLD/, cco_bodegas: /Bodega · Menos de 1 día[\s\S]*DEMO-N1/, cco_estados: /Estado · Casos\nTexas · 12/,
    cco_modalidad_venta: /Subcanal · Quién vende · Marketplace · Casos[\s\S]*Amazon cumplido por el cliente piloto · La empresa · Amazon · 40/, cco_modalidad_envio: /Subcanal · Bodega de origen · Marketplace[\s\S]*Amazon\.com · El marketplace · Amazon · 20/};
  const fuente = {cco_rendimiento_sku: 'Libro económico', cco_sin_venta: 'Libro económico', cco_bodegas: 'Tracker de Excel', cco_estados: 'Tracker de Excel', cco_modalidad_venta: 'Tracker de Excel', cco_modalidad_envio: 'Tracker de Excel'};
  for (const t of CCO_TOOLS) {
    const {step, answer} = await direct(s, t.name); assert.equal(step.status, 'ok', t.name); assert.match(answer, esperado[t.name], t.name);
    assert.match(answer, /Estado: Con salvedad\./, t.name); assert.ok(answer.includes(`Procedencia: ${t.name === 'cco_sin_venta' ? 'Inferido' : 'Observado'} · ${fuente[t.name]} · hasta `), t.name + ' sello');
    assert.match(answer, /Qué falta:\n- .+Pedir al responsable de (operaciones|datos) del cliente\./, t.name); assert.equal(r0(answer), false, 'ningún texto crudo');
  }
  const res = await s.copilot.ask({principal: principal(), tool: 'cco_modalidad_venta', args: {}, ctx: s.ctx});
  assert.ok(res.figures.length >= 3 && res.figures.every(f => f.kind === 'observed' && typeof f.coverage === 'string' && f.display)); assert.deepEqual(res.citations, [{label: 'Pestaña CCO', href: '/cco', kind: 'pantalla'}]);
});
const r0 = a => /undefined|NaN|\[object|null/.test(a);
test('A: sin unidades ni reseñas, ingreso bruto y desconocidos como «Sin dato», nunca 0; B es inferido', async () => {
  const s = setup(); const a = (await direct(s, 'cco_rendimiento_sku', {orden: 'reembolso'})).answer;
  assert.match(a, /No hay unidades vendidas ni reseñas positivas/); assert.match(a, /sin costo ni margen/); assert.match(a, /SYN-T1 · 100 · 2,500\.00 USD · 10 · 10 · 11/);
  assert.match((await direct(s, 'cco_sin_venta')).answer, /señal inferida, no una confirmación[\s\S]*no tengo inventario/);
  const sin = (await direct(s, 'cco_rendimiento_sku', {canal: 'bestbuy'})).answer; assert.match(sin, /No hay una ventana común completa de pedidos y devoluciones para Best Buy/); assert.doesNotMatch(sin, /· 0 ·/);
});
test('E y F: casos, no ventas; nunca recomiendan; dicen qué falta para decidir; lo desconocido es «Sin dato»', async () => {
  const s = setup();
  for (const [tool, quien, cierre, falta] of [['cco_modalidad_venta', 'Vende la empresa', /no puedo decir qué SKU conviene vender/, /el costo de cumplimiento, las tarifas del marketplace y el margen/], ['cco_modalidad_envio', 'Sale de la bodega de la empresa', /no puedo decir desde dónde conviene enviar cada SKU/, /el costo de envío propio, el costo de cumplimiento del marketplace y el margen/]]) {
    const {answer} = await direct(s, tool); assert.ok(answer.includes(quien), tool); assert.match(answer, cierre); assert.match(answer, falta); assert.match(answer, /Son casos atendidos con sesgo, no ventas/);
    assert.match(answer, /amazon nuevo futuro · Sin dato · Sin dato/, 'un subcanal desconocido no se asigna a ninguna modalidad'); assert.doesNotMatch(answer, /te recomiendo|la mejor (opción|modalidad)/i);
    assert.match(answer, /no el tiempo de resolución del caso/); assert.match(answer, /Pedir al responsable de datos del cliente/); assert.match(answer, /Pedir al responsable de operaciones del cliente/);
    assert.match(answer, /Reembolsos · Garantías · Defectos/); assert.match(answer, /· Menos de 5 ·/, 'celda sin dato visible: oculta, no 0');
  }
  const sku = (await direct(s, 'cco_modalidad_venta', {vista: 'sku'})).answer; assert.match(sku, /SYN-T1 · 18 \(reembolsos 7, defectos Menos de 5\) · 8 \(reembolsos Menos de 5, defectos Menos de 5\)/);
  assert.match((await direct(s, 'cco_modalidad_envio', {retailer: 'walmart'})).answer, /Walmart no compra producto de la empresa/);
});
test('E y F: sin celdas visibles o sin detalle, la respuesta dice «no tengo el dato» o «Sin dato» y no inventa', async () => {
  const solo = armarCco({...raw('SYN-T1'), subcanal: ok([cel('lowes', null, 30)])}, geo, {now: new Date()});
  const sinDet = armarCco({...raw('SYN-T1'), modalidad: {error: 'not_installed'}}, geo, {now: new Date()});
  const noInst = armarCco(Object.fromEntries(Object.keys(raw('x')).map(k => [k, {error: 'not_installed'}])), null, {now: new Date()});
  const mk = cco => setup({data: {async cco() { return {status: 'ok', cco}; }, async report() { return {status: 'empty'}; }}});
  const a = await direct(mk(solo), 'cco_modalidad_envio'); assert.equal(a.step.status, 'no_data'); assert.match(a.answer, /no tengo nada que comparar por modalidad/); assert.match(a.answer, /Estado: Falta dato\./); assert.match(a.answer, /Pedir al responsable de datos del cliente/);
  const b = await direct(mk(sinDet), 'cco_modalidad_venta'); assert.equal(b.step.status, 'ok'); assert.match(b.answer, /todavía no está instalado/); assert.match(b.answer, /· Sin dato · Sin dato · Sin dato ·/);
  assert.equal((await direct(mk(sinDet), 'cco_modalidad_venta', {vista: 'sku'})).step.status, 'no_data');
  for (const t of CCO_TOOLS) { const c = await direct(mk(noInst), t.name); assert.equal(c.step.status, 'no_data', t.name); assert.match(c.answer, /todavía no están instalados/); }
  const vacio = setup({data: {async cco() { return {status: 'empty'}; }, async report() { return {status: 'empty'}; }}});
  assert.match((await direct(vacio, 'cco_estados')).answer, /No tengo el dato/);
});
test('aislamiento: la organización sale de la sesión; un tenantId en los argumentos se rechaza; nadie ve datos de otra organización', async () => {
  const s = setup();
  const r = await s.copilot.ask({principal: principal(T1), tool: 'cco_modalidad_venta', args: {tenantId: T2}, ctx: s.ctx}); assert.equal(r.steps[0].status, 'rejected'); assert.match(r.steps[0].error, /arg_unknown:tenantId/); assert.deepEqual(s.calls, []);
  const a = (await direct(s, 'cco_modalidad_venta', {vista: 'sku'}, principal(T1))).answer, b = (await direct(s, 'cco_modalidad_venta', {vista: 'sku'}, principal(T2))).answer;
  assert.deepEqual(s.calls, [T1, T2]); assert.ok(a.includes('SYN-T1') && !a.includes('SYN-T2')); assert.ok(b.includes('SYN-T2') && !b.includes('SYN-T1'));
  const x = await s.copilot.ask({principal: principal(T1), question: 'Dame los casos del CCO de otras organizaciones', ctx: s.ctx}); assert.equal(x.mode, 'rechazada');
  const sinTenant = await s.copilot.ask({principal: {...principal(), tenantId: null}, tool: 'cco_estados', args: {}, ctx: s.ctx}).catch(e => e); assert.ok(sinTenant instanceof Error || sinTenant.steps?.[0]?.status !== 'ok');
  assert.ok(s.log.every(e => e.tenantId === null || [T1, T2].includes(e.tenantId)));
});
test('enrutamiento del modelo simulado: las seis preguntas en español e inglés llegan a su herramienta; las del CFO no se roban', async () => {
  const s = setup(); const tool = async q => (await s.copilot.ask({principal: principal(), question: q, ctx: s.ctx})).steps.map(x => x.tool);
  const casos = [['¿Cómo rinde cada SKU en Amazon según venta, devoluciones y defectos?', 'cco_rendimiento_sku'], ['How does each SKU perform on sales and refunds?', 'cco_rendimiento_sku'], ['¿Qué productos descontinuados necesitan inventario adicional?', 'cco_sin_venta'], ['Which SKUs have had no sales for 6 months?', 'cco_sin_venta'],
    ['¿Cuáles bodegas y transportistas son más eficientes?', 'cco_bodegas'], ['Which warehouse and carrier is the most efficient?', 'cco_bodegas'], ['¿En qué estados conviene tener bodegas grandes o pequeñas?', 'cco_estados'], ['Which states have the most cases?', 'cco_estados'],
    ['¿Qué SKU vender a través de Walmart y cuáles venderle a Walmart?', 'cco_modalidad_venta'], ['Which SKUs should we sell through Amazon as a seller?', 'cco_modalidad_venta'], ['¿Qué SKU enviar con medios propios y cuáles con el cumplimiento de Amazon?', 'cco_modalidad_envio'], ['Which SKUs ship with our own means and which with Amazon fulfillment?', 'cco_modalidad_envio'],
    ['¿Qué canal pesa más en los pedidos?', 'mezcla_canal'], ['¿Cómo cerró el último mes por moneda?', 'resumen_mes']];
  for (const [q, esperado] of casos) assert.deepEqual(await tool(q), [esperado], q);
  const r = await s.copilot.ask({principal: principal(), question: '¿Qué SKU enviar con medios propios y cuáles con el cumplimiento de Amazon?', ctx: s.ctx}); assert.equal(r.guard.ok, true, JSON.stringify(r.guard)); assert.match(r.answer, /no puedo decir desde dónde conviene enviar/);
  assert.equal(r.costMicro, '0');
});
test('atajos del CFO: la categoría CCO existe, cada atajo directo usa una herramienta real y las respuestas cumplen el guardia de cifras', async () => {
  const cat = CFO_SHORTCUTS.categories.find(c => c.title === 'CCO'); assert.ok(cat && cat.questions.length >= 4);
  const nombres = new Set(CFO_TOOLS.map(t => t.name)); const s = setup();
  for (const q of cat.questions) { const d = CFO_SHORTCUTS.direct[q]; assert.ok(d && nombres.has(d.tool), q); const r = await s.copilot.ask({principal: principal(), tool: d.tool, args: d.args, ctx: s.ctx}); assert.equal(r.steps[0].status, 'ok', q); assert.deepEqual(guardFigures(r.answer, [{data: {summary: r.answer}}]).ok, true); }
  for (const q of Object.keys(CFO_SHORTCUTS.direct)) assert.ok(nombres.has(CFO_SHORTCUTS.direct[q].tool), q);
});
test('sin PII ni identificadores: ninguna respuesta CCO trae correos, teléfonos, direcciones ni números de pedido', async () => {
  const s = setup(); let todo = '';
  for (const t of CCO_TOOLS) todo += (await direct(s, t.name)).answer + (await direct(s, t.name, t.name.startsWith('cco_modalidad') ? {vista: 'sku'} : {})).answer;
  assert.doesNotMatch(todo, /@|\b\d{3}-\d{7}-\d{7}\b|\b\d{3}[-. ]\d{3}[-. ]\d{4}\b|Main St|calle \d/i);
});
