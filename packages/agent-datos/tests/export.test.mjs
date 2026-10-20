import test from 'node:test';
import assert from 'node:assert/strict';
import { answerToMarkdown, blockToCsv, parseAssociations, parseTracker, createWorkspacePort, assertPort, PORT_METHODS, createGatewayModel, AgentError } from '../index.mjs';
import { ask, portFor } from './helpers.mjs';

test('exportar a Markdown conserva clase, cobertura, fuentes y «cómo lo calculé»', async () => {
  const q = '¿Cuánto dinero en reembolsos tuvimos por marketplace?'; const a = await ask(q);
  const md = answerToMarkdown({ question: q, answer: a, generatedAt: '2026-10-19' });
  assert.match(md, /^# ¿Cuánto dinero/); assert.match(md, /Clase: Observado · Cobertura: 1,617 de 1,620/); assert.match(md, /## Cómo lo calculé/); assert.match(md, /ledger_por_fuente/); assert.match(md, /## Fuentes/); assert.match(md, /agent:ledger/);
  assert.ok(!md.includes('undefined'));
});
test('CSV con BOM, comillas escapadas y una fila por registro', () => {
  const csv = blockToCsv({ columns: [{ key: 'a', label: 'Fuente' }, { key: 'b', label: 'Nota, larga' }], rows: [{ a: 'Amazon', b: 'dice "hola"' }, { a: 'X', b: null }] });
  assert.equal(csv, '﻿Fuente,"Nota, larga"\nAmazon,"dice ""hola"""\nX,');
});
test('el adaptador real cumple el puerto y declara «no conectado» lo que falta, sin inventar', async () => {
  const cov = await portFor().coverage();
  const fake = { async transaction() { throw new Error('no db in unit tests'); } };
  const port = assertPort(createWorkspacePort({ database: fake, tenantId: 'x' }));
  for (const m of PORT_METHODS) assert.equal(typeof port[m], 'function');
  assert.deepEqual(await port.problems(), { status: 'empty', reason: 'not_connected', method: 'problems' });
  const a = parseAssociations(cov.sources.find((s) => s.key === 'associations')); assert.deepEqual([a.total, a.resolved, a.pending, a.activeLinks, a.sampled], [117720, 15190, 102530, 72720, true]);
  const t = parseTracker(cov.sources.find((s) => s.key === 'excel')); assert.deepEqual([t.version, t.versions, t.rows, t.sheetsClosed, t.sheetsTotal], ['v07b', 4, 13228, 64, 64]);
  assert.equal(parseTracker({ loaded: false }).status, 'empty'); assert.equal(parseAssociations({ loaded: true, detail: ['otra cosa'] }).status, 'empty');
  assert.throws(() => assertPort({ coverage() {} }), /port_incomplete/);
});
test('con el puerto real a medias (sin consultas de problemas) el agente dice «no tengo ese dato»', async () => {
  const { createAgent } = await import('../index.mjs'); const { ctxFor } = await import('./helpers.mjs');
  const real = portFor(); const stub = { ...real, problemIncidents: async () => ({ status: 'empty', reason: 'not_connected' }), problems: async () => ({ status: 'empty', reason: 'not_connected' }) };
  const a = await createAgent().answer({ ctx: ctxFor(), port: stub, question: '¿Cuáles son los 5 problemas con más incidencias este mes?' });
  assert.equal(a.status, 'no_data'); assert.match(a.text, /^No tengo ese dato/); assert.ok(a.missing.length);
});
test('el adaptador de modelo del gateway falla de forma explícita mientras no exista el rol data_agent', async () => {
  const m = createGatewayModel({ gateway: { extract() {} }, tenantId: 'x' });
  await assert.rejects(() => m.plan({ question: 'x', history: [], tools: [], vocabulary: {} }), (e) => e instanceof AgentError && e.code === 'model_not_configured');
});
