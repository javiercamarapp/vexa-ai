// Las seis herramientas del CCO: catálogo cerrado, argumentos enumerados, solo analista y propietario, cifras con clase y cobertura, E y F por modalidad sin recomendar jamás, sin SQL ni texto libre.
import test from 'node:test';
import assert from 'node:assert/strict';
import { TOOLS, TOOL_INDEX, executeTool, catalogForModel, toolsForRole, validateArgs, toJsonSchema, contractViolations, planByRules, SYNTHETIC_TENANTS, assertPort, PORT_METHODS, buildSuggestions, DEMO_QUESTIONS } from '../index.mjs';
import { faltanTexto, FALTAN, tarjetaE, tarjetaF } from '../../workspace-service/cco.mjs';
import { CCO_EJEMPLOS } from '../index.mjs';
import { ctxFor, portFor, ask, ALL_TEXT } from './helpers.mjs';

const CCO = ['rendimiento_sku', 'candidatos_sin_venta', 'eficiencia_bodegas', 'casos_por_estado', 'casos_por_subcanal', 'envio_propio_vs_amazon'];
const run = (name, args = {}, role = 'owner', tenant = SYNTHETIC_TENANTS.A) => executeTool({ name, args, port: portFor(tenant), ctx: ctxFor(role, tenant) });

test('seis herramientas nuevas, solo analista y propietario, y el puerto declara sus seis métodos', () => {
  assert.deepEqual(TOOLS.filter((t) => CCO.includes(t.name)).map((t) => t.name), CCO);
  for (const r of ['viewer', 'operator']) assert.ok(!catalogForModel(r).some((t) => CCO.includes(t.name)), r);
  for (const r of ['analyst', 'owner']) assert.ok(CCO.every((n) => toolsForRole(r).some((t) => t.name === n)), r);
  for (const m of ['ccoSku', 'ccoSinVenta', 'ccoBodegas', 'ccoEstados', 'ccoSubcanal', 'ccoEnvio']) assert.ok(PORT_METHODS.includes(m), m);
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
test('E: modalidad de venta (quién vende) con aviso de sesgo; no decide qué vender', async () => {
  const r = await run('casos_por_subcanal', { retailer: 'amazon' }); assert.equal(r.status, 'ok');
  assert.ok(r.blocks[0].rows.every((x) => /Amazon/.test(x.subcanal))); assert.match(r.blocks[0].note, /Sesgo/); assert.match(r.summary, /no puedo decir qué SKU conviene vender/);
  assert.ok(r.missing.some((m) => /Retailer/.test(m)) && r.missing.some((m) => /Pedir a Responsable A/.test(m)));
  assert.deepEqual(r.blocks[0].columns.map((c) => c.key), ['subcanal', 'quien', 'marketplace', 'casos', 'reembolsos', 'garantias', 'defectos', 'despacho3']);
  const piloto = r.blocks[0].rows.find((x) => /cliente piloto/.test(x.subcanal)); assert.equal(piloto.quien, 'La empresa'); assert.equal(piloto.marketplace, 'Amazon'); assert.equal(piloto.casos, 485);
  const com = r.blocks[0].rows.find((x) => x.subcanal === 'Amazon.com'); assert.equal(com.quien, 'El marketplace');
  assert.ok(r.figures.every((f) => f.class === 'observed' && f.coverage.known_n >= 0)); assert.ok(r.figures.some((f) => f.label === 'Vende la empresa') && r.figures.some((f) => f.label === 'Vende el marketplace'));
  assert.match(r.summary, /faltan la venta por SKU y por modalidad, el costo de cumplimiento, las tarifas del marketplace y el margen/);
  assert.ok(r.notes.some((n) => /Sin dato; no se asigna/.test(n)) && r.notes.some((n) => /no el tiempo de resolución/.test(n)));
});
test('E por SKU: columnas por quién vende, celdas ocultas como «Menos de 5» y nunca una recomendación', async () => {
  const r = await run('casos_por_subcanal', { vista: 'sku', top: 3 }); assert.equal(r.status, 'ok');
  assert.deepEqual(r.blocks[0].columns.map((c) => c.key), ['sku', 'g_empresa', 'g_marketplace']); assert.equal(r.blocks[0].rows[0].sku, 'SYN-AX1');
  assert.match(r.blocks[0].rows[0].g_empresa, /^98 \(reembolsos 25, defectos 20\)$/); assert.match(r.blocks[0].rows[0].g_marketplace, /^30 \(reembolsos 9, defectos Menos de 5\)$/);
  assert.match(r.blocks[0].note, /mínimo/); assert.doesNotMatch(ALL_TEXT(r), /\bconviene (vender|enviar) [A-Z]|te recomiendo|la mejor (opción|modalidad)/i);
});
test('F: modalidad de envío (de qué bodega sale) con la misma evidencia; ya no es no_data pero tampoco recomienda', async () => {
  for (const args of [{}, undefined]) {
    const r = await run('envio_propio_vs_amazon', args);
    assert.equal(r.status, 'ok'); assert.ok(r.figures.length >= 3 && r.figures.every((f) => f.class === 'observed')); assert.equal(r.blocks.length, 1); assert.deepEqual(r.missing, faltanTexto('F'));
    assert.match(r.summary, /no puedo decir desde dónde conviene enviar cada SKU/); assert.match(r.summary, /el costo de envío propio, el costo de cumplimiento del marketplace y el margen/);
    assert.ok(r.blocks[0].columns.some((c) => c.label === 'Bodega de origen')); assert.ok(r.blocks[0].rows.some((x) => x.quien === 'La empresa') && r.blocks[0].rows.some((x) => x.quien === 'El marketplace'));
    assert.ok(r.notes.some((n) => /Walmart no compra producto/.test(n))); assert.doesNotMatch(ALL_TEXT(r), /te recomiendo|la mejor (opción|modalidad)/i);
  }
  const sku = await run('envio_propio_vs_amazon', { vista: 'sku' }); assert.deepEqual(sku.blocks[0].columns.map((c) => c.key), ['sku', 'g_empresa', 'g_marketplace']); assert.match(sku.blocks[0].columns[1].label, /bodega de la empresa/);
  assert.ok(FALTAN.F.every((x) => ['responsable_a', 'responsable_b'].includes(x.quien)));
  const a = await ask('¿Qué SKU conviene enviar desde medios propios y cuáles con el cumplimiento de Amazon?'); assert.equal(a.status, 'ok'); assert.match(a.text, /no puedo decir desde dónde conviene enviar/); assert.ok(a.missing.length >= 4);
  assert.deepEqual(contractViolations(a), []); assert.equal(a.usage.mode, 'deterministic'); assert.equal(a.usage.costMinor, '0');
});
test('un subcanal de Amazon que la tabla no conoce se muestra como «Sin dato» y no se asigna a ninguna modalidad; sin celdas visibles, no_data', async () => {
  const ok = (rows) => ({ rows }), cell = (d1, n, es_otros = false) => ({ d1, d2: null, n, es_otros });
  const raw = { subcanal: ok([cell('amazon_cumplido_por_piloto', 30), cell('amazon_subcanal_nuevo', 12), cell(null, 6, true)]), cob: ok([{ cutoff: '2026-10-05T00:00:00Z' }]), modalidad: ok([]) };
  const portE = { ...portFor(), ccoSubcanal: async () => ({ status: 'ok', card: tarjetaE(raw) }), ccoEnvio: async () => ({ status: 'ok', card: tarjetaF(raw) }) };
  for (const name of ['casos_por_subcanal', 'envio_propio_vs_amazon']) {
    const r = await executeTool({ name, args: {}, port: portE, ctx: ctxFor('owner') }); assert.equal(r.status, 'ok', name);
    const fila = r.blocks[0].rows.find((x) => x.subcanal === 'amazon subcanal nuevo'); assert.equal(fila.quien, 'Sin dato'); assert.equal(fila.marketplace, 'Sin dato'); assert.equal(fila.reembolsos, 'Menos de 5', 'detalle vacío visible: oculto, no cero');
    assert.deepEqual(contractViolations({ status: 'ok', text: r.summary, figures: r.figures, blocks: r.blocks, citations: [], sources: [1], calc: [1] }), [], name);
  }
  const solo = { subcanal: ok([cell('lowes', 40)]), cob: ok([]), modalidad: ok([]) };
  const portF = { ...portFor(), ccoSubcanal: async () => ({ status: 'ok', card: tarjetaE(solo) }), ccoEnvio: async () => ({ status: 'ok', card: tarjetaF(solo) }) };
  for (const name of ['casos_por_subcanal', 'envio_propio_vs_amazon']) { const r = await executeTool({ name, args: {}, port: portF, ctx: ctxFor('owner') }); assert.equal(r.status, 'no_data', name); assert.equal(r.figures.length, 0); assert.ok(r.missing.length >= 4); }
  const caido = { ...portFor(), ccoEnvio: async () => ({ status: 'ok', card: tarjetaF({ subcanal: { error: 'not_installed' } }) }) };
  const r = await executeTool({ name: 'envio_propio_vs_amazon', args: {}, port: caido, ctx: ctxFor('owner') }); assert.equal(r.status, 'unavailable'); assert.match(r.summary, /no significa cero/);
  const sinDetalle = { ...portFor(), ccoSubcanal: async () => ({ status: 'ok', card: tarjetaE({ ...raw, modalidad: { error: 'not_installed' } }) }) };
  const d = await executeTool({ name: 'casos_por_subcanal', args: {}, port: sinDetalle, ctx: ctxFor('owner') }); assert.equal(d.status, 'ok'); assert.ok(d.blocks[0].rows.every((x) => x.reembolsos === 'Sin dato' && x.defectos === 'Sin dato'));
  assert.ok(d.notes.some((n) => /todavía no está instalado/.test(n)));
  assert.equal((await executeTool({ name: 'casos_por_subcanal', args: { vista: 'sku' }, port: sinDetalle, ctx: ctxFor('owner') })).status, 'no_data');
});
test('aislamiento: la organización B no ve el SKU de A y A no ve el de B', async () => {
  const a = JSON.stringify([await run('rendimiento_sku'), await run('candidatos_sin_venta'), await run('casos_por_subcanal'), await run('casos_por_subcanal', { vista: 'sku' }), await run('envio_propio_vs_amazon', { vista: 'sku' })]);
  const b = JSON.stringify([await run('rendimiento_sku', {}, 'owner', SYNTHETIC_TENANTS.B), await run('candidatos_sin_venta', {}, 'owner', SYNTHETIC_TENANTS.B), await run('casos_por_subcanal', { vista: 'sku' }, 'owner', SYNTHETIC_TENANTS.B), await run('envio_propio_vs_amazon', { vista: 'sku' }, 'owner', SYNTHETIC_TENANTS.B)]);
  assert.ok(!a.includes('ZZ-OTRA-ORG') && !a.includes('ZZ-VIEJO')); assert.ok(b.includes('ZZ-OTRA-ORG') && b.includes('ZZ-OTRA-2') && !b.includes('SYN-AX2') && !b.includes('SYN-AX1') && !b.includes('SYN-OLD1'));
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

test('las frases de ejemplo en español e inglés llevan a la herramienta correcta, sin modelo ni costo, y cumplen el contrato', async () => {
  const ctx = { month: '2026-10', role: 'owner' };
  assert.deepEqual(Object.keys(CCO_EJEMPLOS).sort(), [...CCO].sort());
  for (const [tool, { es, en }] of Object.entries(CCO_EJEMPLOS)) {
    assert.ok(es.length >= 2 && en.length >= 2, tool);
    for (const q of [...es, ...en]) {
      assert.equal(planByRules({ question: q, ctx, vocabulary: { problems: [] } }).calls?.[0]?.tool, tool, q);
      const a = await ask(q); assert.deepEqual(contractViolations(a), [], q); assert.equal(a.usage.mode, 'deterministic'); assert.equal(a.usage.costMinor, '0'); assert.ok(!ALL_TEXT(a).includes('ZZ-OTRA-ORG'), q);
      assert.ok(a.status === 'ok' || a.status === 'no_data', q + ' ' + a.status);
      const v = await ask(q, { role: 'viewer' }); assert.notEqual(v.status, 'ok', 'un viewer no recibe datos del CCO: ' + q);
      assert.notEqual((await ask(q, { role: 'operator' })).status, 'ok', 'un operador tampoco: ' + q);
    }
  }
  // no se roban preguntas de otras herramientas
  assert.equal(planByRules({ question: 'How many refunds per marketplace?', ctx, vocabulary: { problems: [] } }).calls?.[0]?.tool === 'casos_por_subcanal', false);
  assert.equal(planByRules({ question: '¿Cuánto dinero en reembolsos tuvimos por marketplace?', ctx, vocabulary: { problems: [] } }).calls?.[0]?.tool, 'ledger_por_fuente');
  assert.equal(planByRules({ question: '¿Cuáles son los 5 problemas con más incidencias este mes?', ctx, vocabulary: { problems: [] } }).calls?.[0]?.tool, 'problemas_top');
});
test('sin PII: ninguna respuesta de E o F trae correos, teléfonos, direcciones ni identificadores de pedido', async () => {
  for (const q of CCO_EJEMPLOS.casos_por_subcanal.es.concat(CCO_EJEMPLOS.envio_propio_vs_amazon.es, CCO_EJEMPLOS.envio_propio_vs_amazon.en)) {
    const t = ALL_TEXT(await ask(q)); assert.doesNotMatch(t, /@|\b\d{3}-\d{7}-\d{7}\b|\b\d{3}[-. ]\d{3}[-. ]\d{4}\b|Main St|calle \d/i, q);
  }
});
