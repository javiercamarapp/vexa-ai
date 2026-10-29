// Coherencia del fixture de la landing: las cifras salen de una sola fuente y coinciden con mocks/datos.ts y entre pantallas.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {respond, matrizReembolsos, PARETO, REEMBOLSOS, INGRESO_BRUTO, DINERO_ATORADO, HILOS_MAS_24H, informeCfo} from './fixture-landing.mjs';

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
  PARETO.forEach(([, v], i) => assert.equal(M[i].reduce((a, b) => a + b, 0), v));
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
