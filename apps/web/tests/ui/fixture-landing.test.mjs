// Coherencia del fixture de la landing: las cifras salen de una sola fuente y coinciden con mocks/datos.ts y entre pantallas.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {respond, matrizReembolsos, PARETO, SKUS, SKU_TOTAL, REEMBOLSOS, INGRESO_BRUTO, DINERO_ATORADO, HILOS_MAS_24H, informeCfo} from './fixture-landing.mjs';

const datos = readFileSync(new URL('../../src/components/sitio/mocks/datos.ts', import.meta.url), 'utf8');
const num = n => Number(String(n).replace(/_/g, ''));
test('las cifras del fixture son las de mocks/datos.ts (INGRESO_BRUTO, REEMBOLSOS, DINERO_ATORADO, HILOS_MAS_24H y los 10 SKU)', () => {
  for (const [k, v] of [['INGRESO_BRUTO', INGRESO_BRUTO], ['REEMBOLSOS', REEMBOLSOS], ['DINERO_ATORADO', DINERO_ATORADO], ['HILOS_MAS_24H', HILOS_MAS_24H]]) assert.equal(num(datos.match(new RegExp(`export const ${k} = ([\\d_]+)`))[1]), v, k);
  const sku = [...datos.matchAll(/\{sku: '(HM-\d+)', v: ([\d_]+)\}/g)].map(m => [m[1], num(m[2])]);
  assert.deepEqual(sku, PARETO);
});
test('la matriz SKU x canal x mes suma exactamente los márgenes', () => {
  const {M} = matrizReembolsos();
  assert.equal(M.flat().reduce((a, b) => a + b, 0), REEMBOLSOS);
  SKUS.forEach(([, v], i) => assert.equal(M[i].reduce((a, b) => a + b, 0), v));
  assert.equal(SKUS.length, SKU_TOTAL);
  assert.ok(SKUS.slice(10).every(([, v]) => v <= PARETO[9][1]), 'ningún SKU de la cola supera al décimo');
});
test('Fuga, Hoy, CCO y el agente cuentan lo mismo', async () => {
  const fuga = (await respond('/api/refunds', 'GET')) [1].data;
  assert.equal(Number(fuga.titular.usdBrutoMinor), REEMBOLSOS * 100);
  assert.equal(fuga.skus.top.length, 10);
  assert.deepEqual(fuga.skus.top.map(r => r.sku), PARETO.map(([k]) => k));
  assert.equal(fuga.tracker.montoPorEstado.vencido + fuga.tracker.montoPorEstado.no_reembolsable + fuga.tracker.montoPorEstado.rechazado, DINERO_ATORADO * 100);
  const carga = (await respond('/api/workload', 'GET'))[1].data;
  assert.equal(carga.sla.abiertosSinRespuesta24h, HILOS_MAS_24H);
  const cfo = informeCfo().data.report;
  assert.ok(JSON.stringify(cfo).includes(String(INGRESO_BRUTO * 100)));
  const turno = (await respond('/api/agent/turn', 'POST', JSON.stringify({question: '¿Qué marketplace concentra más reembolsos?'})))[1].respuesta;
  assert.match(turno.text, /18,500\.00 USD.*11,200\.00 USD.*6,300\.00 USD/);
});
test('ninguna respuesta del fixture nombra al cliente piloto ni a marcas de marketplace en los rótulos propios', async () => {
  for (const u of ['/api/connections', '/api/coverage', '/api/problems']) assert.doesNotMatch(JSON.stringify((await respond(u, 'GET'))[1]), /zendesk|piloto|vexa|shopify/i, u);
});

test('una sola cifra por concepto: reembolsos de Fuga = registros del agente; ninguna cobertura cierra en 100 %; mismo periodo de 90 días', async () => {
  const fuga = (await respond('/api/refunds', 'GET'))[1].data;
  const turno = (await respond('/api/agent/turn', 'POST', JSON.stringify({question: '¿Qué marketplace concentra más reembolsos?'})))[1].respuesta;
  const bloque = turno.blocks[0];
  assert.equal(bloque.rows.reduce((a, r) => a + r.registros, 0), fuga.titular.n);
  assert.ok(bloque.coverage.known_n < bloque.coverage.eligible_n && turno.figures.every(f => f.coverage.known_n < f.coverage.eligible_n), 'cobertura parcial en el total y en cada canal');
  assert.doesNotMatch(JSON.stringify(turno), /los últimos 12 meses|\(100 %\)|100\.0/);
  assert.match(turno.text, /últimos 90 días/);
  const top = fuga.skus.top.reduce((a, r) => a + Number(r.amountMinor ?? r.usdBrutoMinor ?? 0), 0);
  if (top) assert.ok(top < REEMBOLSOS * 100, 'los 10 SKU no suman el 100 %');
});
test('variante en inglés: pregunta, respuesta y sugerencias sin español', async () => {
  const {fijarIdioma} = await import('./fixture-landing.mjs');
  fijarIdioma('en');
  try {
    const turno = (await respond('/api/agent/turn', 'POST', JSON.stringify({question: 'Which marketplace concentrates the most refunds?'})))[1].respuesta;
    const estado = (await respond('/api/agent/state', 'GET'))[1].data;
    assert.doesNotMatch(JSON.stringify([turno.text, turno.blocks[0].title, turno.blocks[0].columns, turno.missing, turno.trace.map(t => t.label + (t.detail ?? '')), estado.suggestions.sugerencias, estado.note]), /[áéíóúñ¿]|últimos|reembols|cobertura/i);
    assert.match(turno.text, /last 90 days/);
  } finally { fijarIdioma('es'); }
});
