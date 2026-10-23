import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAgent } from '../index.mjs';
import { ctxFor, portFor, ALL_TEXT } from './helpers.mjs';
import { mesPorDefecto } from '../meses.mjs';

const AHORA = new Date('2026-10-23T12:00:00.000Z');
const COMPLETENESS = { dataThrough: '2026-09-18' };

test('mesPorDefecto: octubre sin datos y septiembre parcial -> agosto, y lo explica', () => {
  const r = mesPorDefecto(COMPLETENESS, AHORA);
  assert.equal(r.month, '2026-08');
  assert.match(r.nota, /Octubre de 2026 aún no tiene datos/);
  assert.match(r.nota, /septiembre de 2026 está parcial/);
  assert.match(r.nota, /uso agosto de 2026/);
});
test('mesPorDefecto: si el ultimo mes con datos esta completo se usa ese', () => {
  const r = mesPorDefecto({ dataThrough: '2026-09-30' }, AHORA);
  assert.equal(r.month, '2026-09'); assert.match(r.nota, /uso septiembre de 2026/);
});
test('mesPorDefecto: sin fecha de corte no inventa: conserva el mes en curso', () => {
  const r = mesPorDefecto(null, AHORA);
  assert.equal(r.month, '2026-10'); assert.equal(r.nota, null);
});
test('el chip «este mes» responde con el ultimo mes completo con datos, no «No tengo ese dato»', async () => {
  const base = portFor();
  const consultados = [];
  const port = { ...base, trends: async () => ({ conversations: { status: 'ok', series: [], completeness: COMPLETENESS } }),
    problemIncidents: async ({ month }) => { consultados.push(month); return month === '2026-08' ? (await base.problemIncidents({ month: '2026-07' })) : { status: 'empty', month, rows: [] }; } };
  const a = await createAgent().answer({ ctx: { ...ctxFor('owner'), now: AHORA }, port, question: '¿Cuáles son los 5 problemas con más incidencias este mes?', directa: { tool: 'problemas_top', args: { limit: 5 } } });
  assert.equal(a.status, 'ok', a.text);
  assert.ok(consultados.includes('2026-08'));
  assert.match(ALL_TEXT(a), /septiembre de 2026 está parcial; uso agosto de 2026/);
  assert.doesNotMatch(a.text, /No tengo ese dato/);
});
test('un mes pedido explicitamente no se reemplaza', async () => {
  const base = portFor();
  const port = { ...base, trends: async () => ({ conversations: { status: 'ok', series: [], completeness: COMPLETENESS } }), problemIncidents: async ({ month }) => ({ status: 'empty', month, rows: [] }) };
  const a = await createAgent().answer({ ctx: { ...ctxFor('owner'), now: AHORA }, port, question: 'problemas con más incidencias', directa: { tool: 'problemas_top', args: { limit: 5, month: '2026-06' } } });
  assert.match(ALL_TEXT(a), /junio de 2026/);
});
