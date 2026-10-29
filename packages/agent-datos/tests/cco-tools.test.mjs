// Las seis herramientas del CCO: catálogo cerrado, argumentos enumerados, solo analista y propietario, cifras con clase y cobertura, F siempre no_data, sin SQL ni texto libre.
import test from 'node:test';
import assert from 'node:assert/strict';
import { TOOLS, TOOL_INDEX, executeTool, catalogForModel, toolsForRole, validateArgs, toJsonSchema, contractViolations, planByRules, SYNTHETIC_TENANTS, assertPort, PORT_METHODS, buildSuggestions, DEMO_QUESTIONS } from '../index.mjs';
import { faltanTexto, FALTAN } from '../../workspace-service/cco.mjs';
import { ctxFor, portFor, ask, ALL_TEXT } from './helpers.mjs';

const CCO = ['rendimiento_sku', 'candidatos_sin_venta', 'eficiencia_bodegas', 'casos_por_estado', 'casos_por_subcanal', 'envio_propio_vs_amazon'];
const run = (name, args = {}, role = 'owner', tenant = SYNTHETIC_TENANTS.A) => executeTool({ name, args, port: portFor(tenant), ctx: ctxFor(role, tenant) });

test('seis herramientas nuevas, solo analista y propietario, y el puerto declara sus cinco métodos', () => {
  assert.deepEqual(TOOLS.filter((t) => CCO.includes(t.name)).map((t) => t.name), CCO);
  for (const r of ['viewer', 'operator']) assert.ok(!catalogForModel(r).some((t) => CCO.includes(t.name)), r);
  for (const r of ['analyst', 'owner']) assert.ok(CCO.every((n) => toolsForRole(r).some((t) => t.name === n)), r);
  for (const m of ['ccoSku', 'ccoSinVenta', 'ccoBodegas', 'ccoEstados', 'ccoSubcanal']) assert.ok(PORT_METHODS.includes(m), m);
  assertPort(portFor());
});
test('ningún argumento es texto libre: todo texto es enumerado y todo número está acotado; ninguno acepta tenant, rol ni SQL', () => {
  for (const name of CCO) {
    const t = TOOL_INDEX[name], js = toJsonSchema(t.parameters);
    assert.equal(js.additionalProperties, false);
    for (const [k, p] of Object.entries(js.properties)) {
      if (p.type === 'string') assert.ok(Array.isArray(p.enum) && p.enum.length > 0, `${name}.${k} debe ser enumerado`);
      if (p.type === 'integer') assert.ok(Number.isInteger(p.minimum) && Number.isInteger(p.maximum), `${name}.${k} debe estar acotado`);
    }
    for (const bad of ['tenant', 'tenantId', 'tenant_id', 'rol', 'role', 'sql', 'query', 'texto', 'filtro', 'where']) assert.ok(!(bad in js.properties), `${name} acepta ${bad}`);
  }
  assert.equal(validateArgs(TOOL_INDEX.rendimiento_sku.parameters, { canal: "amazon'; drop table x;--" }).ok, false);
  assert.equal(validateArgs(TOOL_INDEX.rendimiento_sku.parameters, { sql: 'select 1' }).ok, false);
  assert.equal(validateArgs(TOOL_INDEX.candidatos_sin_venta.parameters, { meses_sin_venta: '5' }).ok, false);
  assert.equal(validateArgs(TOOL_INDEX.eficiencia_bodegas.parameters, { bodega: 'Bodega inventada' }).ok, false);
  assert.equal(validateArgs(TOOL_INDEX.casos_por_estado.parameters, { pais: 'CA' }).ok, false);
  assert.equal(validateArgs(TOOL_INDEX.rendimiento_sku.parameters, { top: 11 }).ok, false);
});
test('un viewer o un operador no pueden ejecutarlas (forbidden), ni inventando el nombre', async () => {
  for (const role of ['viewer', 'operator']) for (const n of CCO) assert.equal((await run(n, {}, role)).status, 'forbidden', `${role} ${n}`);
  assert.equal((await run('rendimiento_sku; drop table x')).status, 'invalid_input');
});
test('A: rendimiento por SKU con clase observada, cobertura, ventana común y sin inventar unidades ni reseñas', async () => {
  const r = await run('rendimiento_sku', { canal: 'amazon', orden: 'reembolso', top: 2 });
  assert.equal(r.status, 'ok'); assert.ok(r.figures.every((f) => f.class === 'observed' && f.coverage.known_n >= 0));
  assert.equal(r.blocks[0].rows.length, 2); assert.match(r.blocks[0].note, /Ventana común/); assert.match(r.blocks[0].note, /no se suman/); assert.match(r.summary, /No hay unidades vendidas ni reseñas/);
  assert.ok(r.missing.some((m) => /Unidades/.test(m)) && r.missing.some((m) => /Reseñas/.test(m)));
  assert.ok(r.blocks[0].rows.some((x) => x.reembolsado === 'Sin importe'), 'devolución sin importe: se dice, no se pone 0');
  const bb = await run('rendimiento_sku', { canal: 'bestbuy' }); assert.equal(bb.status, 'no_data', 'Best Buy no tiene SKU: sin datos, no ceros');
  const sh = await run('rendimiento_sku', { canal: 'shopify' }); assert.equal(sh.status, 'no_data'); assert.ok(sh.missing.length > 0);
});
test('A: Walmart usa su propia ventana común y no mezcla canales', async () => {
  const r = await run('rendimiento_sku', { canal: 'walmart' }); assert.equal(r.status, 'ok');
  assert.match(r.blocks[0].note, /agosto de 2026 a septiembre de 2026, 2 meses/); assert.match(r.notes.join(' '), /ventana/);
});
test('B: SKU sin venta es siempre Inferido y dice que no hay inventario', async () => {
  const r = await run('candidatos_sin_venta', { meses_sin_venta: '3', top: 10 });
  assert.equal(r.status, 'ok'); assert.ok(r.figures.every((f) => f.class === 'inferred')); assert.equal(r.blocks[0].class, 'inferred'); assert.match(r.summary, /señal inferida/); assert.match(r.blocks[0].note, /No es una lista de descontinuados confirmados/);
  assert.ok(r.missing.some((m) => /Existencias/.test(m)) && r.missing.some((m) => /Pedir a Responsable A/.test(m)));
  const nueve = await run('candidatos_sin_venta', { meses_sin_venta: '9' }); assert.equal(nueve.status, 'ok'); assert.match(nueve.summary, /0 de/);
});
test('C: bodegas muestra latencia de despacho, oculta celdas pequeñas y no inventa transportista ni tasas', async () => {
  const r = await run('eficiencia_bodegas'); assert.equal(r.status, 'ok'); assert.match(r.blocks[0].note, /no tiempo de entrega/); assert.match(r.summary, /no puedo decir qué transportista/);
  assert.ok(r.missing.some((m) => /Transportista/.test(m)));
  const una = await run('eficiencia_bodegas', { bodega: 'Bodegac', dimension: 'motivo' }); assert.equal(una.blocks?.[0]?.rows.length ?? 0, una.status === 'ok' ? 1 : 0);
  const ninguna = await run('eficiencia_bodegas', { bodega: 'Bodegae Canada' }); assert.equal(ninguna.status, 'no_data');
});
test('D: casos por estado con cobertura de direcciones, mínimo de 5 y sin volumen por destino', async () => {
  const r = await run('casos_por_estado', { pais: 'US' }); assert.equal(r.status, 'ok'); assert.match(r.summary, /no hay volumen ni venta por estado/);
  assert.ok(r.blocks[0].rows.every((x) => x.casos >= 5)); assert.equal(r.figures[0].coverage.eligible_n, 2017);
  const mx = await run('casos_por_estado', { pais: 'MX' }); assert.equal(mx.status, 'no_data');
  const g = await run('casos_por_estado', { tipo_caso: 'garantia' }); assert.equal(g.blocks[0].rows[0].estado, 'Texas'); assert.equal(g.blocks[0].rows[0].casos, 150);
});
test('E: casos por subcanal con aviso de sesgo; no decide qué vender', async () => {
  const r = await run('casos_por_subcanal', { retailer: 'amazon' }); assert.equal(r.status, 'ok');
  assert.ok(r.blocks[0].rows.every((x) => /Amazon/.test(x.subcanal))); assert.match(r.blocks[0].note, /Sesgo/); assert.match(r.summary, /no puedo decir qué SKU conviene vender/);
  assert.ok(r.missing.some((m) => /Retailer/.test(m)) && r.missing.some((m) => /Pedir a Responsable A/.test(m)));
});
test('F: siempre no_data, con la lista exacta de lo que falta y a quién pedirlo; jamás una cifra', async () => {
  for (const args of [{}, undefined]) {
    const r = await run('envio_propio_vs_amazon', args);
    assert.equal(r.status, 'no_data'); assert.equal(r.figures.length, 0); assert.equal(r.blocks.length, 0); assert.deepEqual(r.missing, faltanTexto('F'));
  }
  assert.ok(FALTAN.F.every((x) => ['responsable_a', 'responsable_b'].includes(x.quien)));
  const a = await ask('¿Qué SKU conviene enviar desde medios propios y cuáles con el cumplimiento de Amazon?'); assert.equal(a.status, 'no_data'); assert.match(a.text, /^No tengo ese dato/); assert.ok(a.missing.length >= 4);
  assert.deepEqual(contractViolations(a), []);
});
test('aislamiento: la organización B no ve el SKU de A y A no ve el de B', async () => {
  const a = JSON.stringify([await run('rendimiento_sku'), await run('candidatos_sin_venta'), await run('casos_por_subcanal')]);
  const b = JSON.stringify([await run('rendimiento_sku', {}, 'owner', SYNTHETIC_TENANTS.B), await run('candidatos_sin_venta', {}, 'owner', SYNTHETIC_TENANTS.B)]);
  assert.ok(!a.includes('ZZ-OTRA-ORG') && !a.includes('ZZ-VIEJO')); assert.ok(b.includes('ZZ-OTRA-ORG') && !b.includes('SYN-AX1') && !b.includes('SYN-OLD1'));
});
test('el planificador por reglas (sin modelo) enruta las seis preguntas del CCO', async () => {
  const ctx = { month: '2026-10', role: 'owner' };
  const tool = (q) => planByRules({ question: q, ctx, vocabulary: { problems: [] } }).calls?.[0]?.tool;
  assert.equal(tool('¿Cómo rinde cada SKU según venta, devoluciones, defectos y reseñas positivas?'), 'rendimiento_sku');
  assert.equal(tool('¿Qué productos descontinuados necesitan inventario adicional?'), 'candidatos_sin_venta');
  assert.equal(tool('¿Cuáles bodegas y transportistas son más eficientes?'), 'eficiencia_bodegas');
  assert.equal(tool('¿En qué estados conviene tener bodegas grandes o pequeñas?'), 'casos_por_estado');
  assert.equal(tool('¿Qué SKU vender como vendedor de Amazon y cuáles directo?'), 'casos_por_subcanal');
  assert.equal(tool('¿Qué SKU enviar desde medios propios con FedEx o UPS y cuáles con Amazon fulfillment?'), 'envio_propio_vs_amazon');
  assert.equal(tool('¿Cuánto dinero en reembolsos tuvimos por marketplace?'), 'ledger_por_fuente', 'las preguntas de libro no se roban');
});
test('de punta a punta con reglas: cumple el contrato, no usa modelo y no filtra datos de otra organización', async () => {
  for (const q of ['¿Cómo rinde cada SKU en Amazon según venta, devoluciones y defectos?', '¿Qué SKU parecen descontinuados porque llevan 3 meses sin venta?', '¿Qué bodega tarda más en despachar?', '¿En qué estados se concentran los casos?', '¿Qué SKU conviene vender como vendedor de Amazon?']) {
    const a = await ask(q); assert.equal(a.status, 'ok', q); assert.deepEqual(contractViolations(a), [], q); assert.equal(a.usage.mode, 'deterministic'); assert.equal(a.usage.costMinor, '0');
    assert.ok(a.figures.every((f) => ['observed', 'inferred', 'estimated'].includes(f.class) && f.coverage), q); assert.ok(!ALL_TEXT(a).includes('ZZ-OTRA-ORG'));
  }
  const v = await ask('¿Qué SKU parecen descontinuados porque llevan 3 meses sin venta?', { role: 'viewer' }); assert.notEqual(v.status, 'ok');
});
test('las sugerencias del CCO solo se ofrecen a analista y propietario y respetan lo cargado', () => {
  const cov = { sources: [{ key: 'ledger', loaded: true }, { key: 'excel', loaded: true }] };
  const own = buildSuggestions(cov, 'owner'), view = buildSuggestions(cov, 'viewer');
  assert.ok(own.categorias.some((c) => c.titulo === 'CCO')); assert.ok(!view.categorias.some((c) => c.titulo === 'CCO'));
  assert.ok(DEMO_QUESTIONS.filter((d) => CCO.includes(d.tool)).length === 6);
  assert.equal(buildSuggestions({ sources: [{ key: 'ledger', loaded: false }, { key: 'excel', loaded: false }] }, 'owner').categorias.some((c) => c.titulo === 'CCO'), false);
});
