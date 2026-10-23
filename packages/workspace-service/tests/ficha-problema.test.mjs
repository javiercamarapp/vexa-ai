// Ficha de un problema (23-oct): conversaciones, citas, críticos, adjuntos y recomendación con topes por parte; desconocido es null, nunca 0.
//   node --test packages/workspace-service/tests/ficha-problema.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {createProblemFactsRepository, posicionGrupo, resumirAdjuntos} from '../problem-facts.mjs';

const P1 = '00000000-0000-4000-8000-000000000001', P2 = '00000000-0000-4000-8000-000000000002', P3 = '00000000-0000-4000-8000-000000000003';
const CONV = ['00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-0000000000c2'];
// Transacción falsa: responde por patrón; `fail` lista patrones cuya consulta vence (57014).
const fake = ({fail = [], extra = {}} = {}) => {
  const log = [];
  const s = {tenantId: 't1', query: async (text) => {
    const sql = String(text?.text ?? text); log.push(sql);
    for (const f of fail) if (f.test(sql)) { const e = new Error('canceling statement due to statement timeout'); e.code = '57014'; throw e; }
    if (/DISTINCT ON \(problem_id\) problem_id AS id/.test(sql)) return {rows: [
      {id: P1, label: 'Warranty: Battery Replacement', state: 'active', n: 336}, {id: P2, label: 'Warranty: Battery Replacement', state: 'active', n: 40},
      {id: P3, label: 'Warranty: Battery Replacement', state: 'retired', n: 900}]};
    if (/AS eids/.test(sql)) return {rows: [{eids: ['e1', 'e2'], cids: CONV}]};
    if (/FROM unnest\(\$2::uuid\[\]\) w\(eid\)/.test(sql)) return {rows: [
      {category: 'Warranty: Battery Replacement', severity: 'high', spans: 60}, {category: 'Warranty: Battery Replacement', severity: 'low', spans: 300},
      {category: 'Warranty: Charger Replacement', severity: 'medium', spans: 124}]};
    if (/FROM public\.problems/.test(sql)) return {rows: [{severity: 'medium'}]};
    if (/FROM public\.recommendations/.test(sql)) return {rows: [{id: 'r1', title: 'Warranty: Battery Replacement', status: 'proposed', version: 1, action: 'x', intervention: null}]};
    if (/GROUPING SETS/.test(sql)) return {rows: [{kind: 'image', n: 5, convs: 3, is_total: 0}, {kind: 'video', n: 1, convs: 1, is_total: 0}, {kind: null, n: 6, convs: 3, is_total: 1}]};
    if (/source_family='conversation'/.test(sql)) return {rows: [{linked: 783, total: 8188}]};
    if (/current_setting\('statement_timeout'\)/.test(sql)) return {rows: [{v: '10000'}]};
    return {rows: []};
  }};
  return {s, log, db: {transaction: async (_a, fn) => fn(s)}};
};

test('la ficha reúne conversaciones, citas registradas, críticos, temas, adjuntos y recomendación del grupo', async () => {
  const {db} = fake();
  const f = await createProblemFactsRepository({database: db, now: () => new Date('2026-10-23T00:00:00Z')}).get({problemId: P1});
  assert.equal(f.conversations, 336);
  assert.deepEqual(f.grupo, {n: 1, de: 2}, 'el grupo retirado no cuenta y la posición es por conversaciones');
  assert.equal(f.citations, 484);
  assert.deepEqual(f.critical, {critical: true, signals: 60, reason: 'severity'});
  assert.equal(f.severity, 'medium');
  assert.deepEqual(f.themes.map(t => t.category), ['Warranty: Battery Replacement', 'Warranty: Charger Replacement']);
  assert.equal(f.themes[0].count, 360);
  assert.equal(f.recommendations.items[0].id, 'r1');
  assert.deepEqual(f.attachments, {state: 'ok', total: 6, conversaciones: 3, porClase: {imagen: 5, video: 1, audio: 0, documento: 0, otro: 0}, cobertura: {enlazados: 783, total: 8188}});
});

test('una parte que vence queda en null/unavailable, nunca 0, y las demás siguen', async () => {
  const {db, log} = fake({fail: [/FROM unnest\(\$2::uuid\[\]\) w\(eid\)/, /attachment_links/]});
  const f = await createProblemFactsRepository({database: db}).get({problemId: P1});
  assert.equal(f.citations, null); assert.equal(f.critical, null); assert.equal(f.themes, null); assert.equal(f.severityMix, null);
  assert.deepEqual(f.attachments, {state: 'unavailable'});
  assert.equal(f.conversations, 336, 'las conversaciones salen del catálogo, que sí respondió');
  assert.equal(f.parts.signals, 'unavailable');
  assert.ok(log.some(x => /ROLLBACK TO SAVEPOINT facts_signals/.test(x)));
});

test('un problema inexistente o retirado responde 404 y un id inválido 400', async () => {
  const {db} = fake();
  const repo = createProblemFactsRepository({database: db});
  await assert.rejects(() => repo.get({problemId: P3}), e => e.status === 404);
  await assert.rejects(() => repo.get({problemId: 'no-es-uuid'}), e => e.status === 400);
});

test('la ficha no pide texto de conversaciones ni importes (privacidad y honestidad)', async () => {
  const {db, log} = fake();
  await createProblemFactsRepository({database: db}).get({problemId: P1});
  assert.ok(!log.some(x => /redacted_text|message_revisions|economic_ledger/.test(x)));
});

test('posicionGrupo y resumirAdjuntos son puros', () => {
  assert.deepEqual(posicionGrupo([{id: 'b', label: 'A: x', n: 5}, {id: 'a', label: 'a: X', n: 5}, {id: 'c', label: 'Otra', n: 9}], 'b'), {n: 2, de: 2});
  assert.equal(posicionGrupo([], 'z'), null);
  assert.equal(resumirAdjuntos([], null).total, 0);
  assert.equal(resumirAdjuntos([{kind: 'application', n: 2, convs: 1, is_total: 0}, {kind: null, n: 2, convs: 1, is_total: 1}], null).porClase.documento, 2);
});

import {createIncidencesRepository} from '../incidences.mjs';
test('la serie mensual del grupo trae conversaciones distintas y rotula el mes parcial por el último dato fechado', async () => {
  const s = {tenantId: 't1', query: async (text) => {
    const sql = String(text);
    if (/WITH scoped AS/.test(sql)) return {rows: [
      {month: '2026-08', n: '182', convs: '150', last_at: '2026-08-31T10:00:00Z', undated: null, linked_runs: '4'},
      {month: '2026-09', n: '160', convs: '120', last_at: '2026-09-21T10:00:00Z', undated: null, linked_runs: '4'}]};
    return {rows: []};
  }};
  const repo = createIncidencesRepository({database: {transaction: async (_a, fn) => fn(s)}, now: () => new Date('2026-10-23T00:00:00Z')});
  const v = await repo.monthly({problemId: P1});
  assert.equal(v.series.find(p => p.month === '2026-08').conversations, 150);
  assert.equal(v.series.find(p => p.month === '2026-07').conversations, 0, 'mes sin filas = cero conversaciones detectadas (conteo), no desconocido');
  assert.deepEqual(v.completeness.partialMonths, ['2026-09'], 'septiembre llega al día 21: parcial');
  assert.equal(v.completeness.basis, 'data');
});

test('parts=["themes"]: solo conversaciones y temas; no consulta catálogo, recomendaciones ni adjuntos', async () => {
  const {db, log} = fake();
  const f = await createProblemFactsRepository({database: db}).get({problemId: P1, parts: ['themes']});
  assert.equal(f.conversations, CONV.length);
  assert.deepEqual(f.themes.map(t => t.category), ['Warranty: Battery Replacement', 'Warranty: Charger Replacement']);
  assert.ok(!log.some(x => /recommendations|attachment_links|DISTINCT ON \(problem_id\) problem_id AS id|FROM public\.problems/.test(x)));
  await assert.rejects(() => createProblemFactsRepository({database: db}).get({problemId: P1, parts: ['otra']}), e => e.status === 400);
});
