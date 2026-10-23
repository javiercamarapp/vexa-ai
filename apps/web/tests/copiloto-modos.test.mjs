import test from 'node:test';
import assert from 'node:assert/strict';
import {MODOS, RUTAS_COPILOTO, esRutaCopiloto, modoPorClave, modoPorRuta, puedeUsarModo, textoSoloPara, problemasDeModo} from '../src/lib/copiloto/modos.mjs';
import {CFO_TOOLS} from '../../../packages/cfo-copilot/src/index.mjs';
import {MENU} from '../src/lib/workspace/menu.mjs';
import {TOOLS} from '../../../packages/agent-datos/index.mjs';

test('registro: cada modo cumple el contrato documentado', () => {
  for (const m of Object.values(MODOS)) assert.deepEqual(problemasDeModo(m), [], m.clave);
  assert.deepEqual(Object.keys(MODOS).sort(), ['cfo', 'general', 'refunds']);
});
test('rutas copiloto: /preguntale, /cfo y /refunds quitan el encabezado; el resto no', () => {
  assert.deepEqual([...RUTAS_COPILOTO].sort(), ['/cfo', '/preguntale', '/refunds']);
  for (const r of ['/preguntale', '/cfo', '/refunds']) assert.equal(esRutaCopiloto(r), true, r);
  for (const r of ['/overview', '/economics', '/cfo/data/report', '/refunds/x', '']) assert.equal(esRutaCopiloto(r), false, r);
  assert.equal(modoPorRuta('/cfo').clave, 'cfo'); assert.equal(modoPorClave('refunds').ruta, '/refunds'); assert.equal(modoPorClave('nada'), null);
});
test('roles: CFO y reembolsos solo para propietario y analista; el general para todos', () => {
  for (const clave of ['cfo', 'refunds']) { assert.equal(puedeUsarModo(MODOS[clave], 'owner'), true); assert.equal(puedeUsarModo(MODOS[clave], 'analyst'), true); for (const r of ['operator', 'viewer', '', undefined]) assert.equal(puedeUsarModo(MODOS[clave], r), false, clave + r); }
  for (const r of ['owner', 'analyst', 'operator', 'viewer']) assert.equal(puedeUsarModo(MODOS.general, r), true);
  assert.equal(puedeUsarModo(null, 'owner'), false);
  assert.equal(textoSoloPara(MODOS.cfo), 'Esta área es solo para propietarios y analistas');
});
test('cada ruta de un modo con menú existe en el menú y el ítem de CFO se llama «CFO»', () => {
  const items = MENU.flatMap(e => e.tipo === 'grupo' ? e.items : [e]);
  for (const m of Object.values(MODOS)) assert.ok(items.some(i => i.href === m.ruta), m.ruta);
  assert.equal(items.find(i => i.href === '/cfo').etiqueta, 'CFO');
});
test('las consultas directas de CFO usan herramientas reales del motor y las de reembolsos, del agente general', () => {
  const cfo = new Set(CFO_TOOLS.map(t => t.name)), agente = new Set(TOOLS.map(t => t.name));
  for (const d of Object.values(MODOS.cfo.directas)) assert.ok(cfo.has(d.tool), d.tool);
  for (const d of Object.values(MODOS.refunds.directas)) assert.ok(agente.has(d.tool), d.tool);
  assert.equal(MODOS.cfo.consulta, 'cfo'); assert.equal(MODOS.cfo.endpointDeConsulta, '/cfo/data/copilot'); assert.equal(MODOS.cfo.presupuesto.topeUsd, 25);
});
test('problemasDeModo rechaza modos mal formados (contrato para /gaps, /map y /workload)', () => {
  assert.ok(problemasDeModo({}).length > 3);
  assert.ok(problemasDeModo({...MODOS.cfo, ruta: 'cfo'}).includes('ruta no interna'));
  assert.ok(problemasDeModo({...MODOS.cfo, rolesPermitidos: []}).includes('rolesPermitidos vacío'));
  assert.ok(problemasDeModo({...MODOS.cfo, endpointDeConsulta: 'https://x.test'}).includes('endpointDeConsulta no interno'));
  assert.ok(problemasDeModo({...MODOS.cfo, directas: {'¿otra?': {tool: 'alertas', args: {}}}}).some(p => p.startsWith('directa sin chip')));
});
