// F1-citas (29-oct): la ficha informa los vinculos problema-conversacion REGISTRADOS sin fabricarlos: 0 filas = «none» (la interfaz dice «sin vinculos todavia»), nunca un conteo inventado.
//   node --test packages/workspace-service/tests/ficha-vinculos.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {createProblemFactsRepository, resumirVinculos} from '../problem-facts.mjs';

const P1 = '00000000-0000-4000-8000-000000000001';
const CONV = ['00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-0000000000c2', '00000000-0000-4000-8000-0000000000c3'];
const base = (sql, vinc) => {
  if (/DISTINCT ON \(problem_id\) problem_id AS id/.test(sql)) return {rows: [{id: P1, label: 'SYN: Envio', state: 'active', n: 3}]};
  if (/AS eids/.test(sql)) return {rows: [{eids: ['e1'], cids: CONV}]};
  if (/FROM public\.problem_conversations/.test(sql)) return vinc(sql);
  if (/current_setting\('statement_timeout'\)/.test(sql)) return {rows: [{v: '10000'}]};
  return {rows: []};
};
const repo = vinc => {
  const log = [];
  const s = {tenantId: 't1', query: async text => { const sql = String(text?.text ?? text); log.push(sql); return base(sql, vinc); }};
  return {log, r: createProblemFactsRepository({database: {transaction: async (_a, fn) => fn(s)}})};
};

test('resumirVinculos: none / partial / complete y null cuando no se pudo leer', () => {
  assert.equal(resumirVinculos(null, 3), null, 'no se pudo leer = null, no 0');
  assert.deepEqual(resumirVinculos({linked: 0, with_issue: 0}, 3), {state: 'none', linked: 0, withIssue: 0, members: 3});
  assert.deepEqual(resumirVinculos({linked: 2, with_issue: 1}, 3), {state: 'partial', linked: 2, withIssue: 1, members: 3});
  assert.deepEqual(resumirVinculos({linked: 3, with_issue: 3}, 3), {state: 'complete', linked: 3, withIssue: 3, members: 3});
  assert.equal(resumirVinculos({linked: 2, with_issue: 0}, null).state, 'complete', 'sin total conocido no se afirma «parcial»');
  assert.deepEqual(resumirVinculos({linked: '4', with_issue: '1'}, 4), {state: 'complete', linked: 4, withIssue: 1, members: 4}, 'bigint/texto del controlador');
});

test('la ficha: 0 filas en problem_conversations = none (hoy en produccion), y la consulta es del tenant, del problema y solo vigentes', async () => {
  const {r, log} = repo(() => ({rows: [{linked: 0, with_issue: 0}]}));
  const f = await r.get({problemId: P1});
  assert.deepEqual(f.links, {state: 'none', linked: 0, withIssue: 0, members: 3});
  const q = log.find(x => /FROM public\.problem_conversations/.test(x));
  assert.match(q, /tenant_id=\$1 AND problem_id=\$2 AND valid_until IS NULL/);
});

test('la ficha: con vinculos parciales o completos los informa tal cual', async () => {
  assert.deepEqual((await repo(() => ({rows: [{linked: 2, with_issue: 1}]})).r.get({problemId: P1})).links, {state: 'partial', linked: 2, withIssue: 1, members: 3});
  assert.deepEqual((await repo(() => ({rows: [{linked: 3, with_issue: 3}]})).r.get({problemId: P1})).links, {state: 'complete', linked: 3, withIssue: 3, members: 3});
});

test('la ficha: si la lectura vence o falla, links es null (no disponible ahora), nunca «none»', async () => {
  const {r} = repo(() => { const e = new Error('canceling statement due to statement timeout'); e.code = '57014'; throw e; });
  const f = await r.get({problemId: P1});
  assert.equal(f.links, null);
  assert.equal(f.conversations, 3, 'el resto de la ficha sigue');
});

test('la vista de solo temas (titulo automatico) no lee vinculos', async () => {
  const {r, log} = repo(() => ({rows: [{linked: 9, with_issue: 9}]}));
  const f = await r.get({problemId: P1, parts: ['themes']});
  assert.equal(f.links, null); assert.equal(log.some(x => /problem_conversations/.test(x)), false);
});
