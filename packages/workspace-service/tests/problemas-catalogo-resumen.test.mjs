// Resumen del catálogo para «Problemas» sin vínculos problema–pedido (23-oct): TODOS los problemas vigentes con conversaciones, severidad, aviso crítico, citas registradas,
// recomendaciones (sin extractos de conversación: privacidad), con topes por parte y «no disponible ahora» (null, nunca 0) cuando una parte no alcanza.
//   node --test packages/workspace-service/tests/problemas-catalogo-resumen.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {withPg, pgAvailable} from '../../metrics/tests/pg-harness.mjs';
import {montarMundo, TENANT_A, OWNER} from '../../ai-scale/economia-problemas/mundo.mjs';
import {crearBaseDatos, alcance} from '../../ai-scale/economia-problemas/snapshot.mjs';
import {createSnapshotRepository} from '../../metrics/snapshots.mjs';
import {createWorkspaceService, isCriticalIssue} from '../index.mjs';
import {catalogOverview} from '../catalog-overview.mjs';

const SKIP = !pgAvailable() && 'sin postgres local';
const q = (a, extra = {}) => new URLSearchParams({date_start: a.start.slice(0, 10), date_end: a.end.slice(0, 10), currency: a.currency, basis: a.basis, exponent: String(a.exponent), ...extra});

// Transacción falsa: responde por patrón y registra las sentencias. `fail` lista patrones cuya consulta vence (57014).
const fake = ({meta = [], quotes = [], fail = []} = {}) => {
  const log = [];
  const s = {tenantId: 't1', query: async (text, values) => {
    const sql = String(text?.text ?? text); log.push(sql);
    for (const f of fail) if (f.test(sql)) { const e = new Error('canceling statement due to statement timeout'); e.code = '57014'; throw e; }
    if (/FROM public\.problems p/.test(sql)) return {rows: meta};
    if (/redacted_text/.test(sql)) return {rows: quotes};
    if (/current_setting\('statement_timeout'\)/.test(sql)) return {rows: [{v: '10000'}]};
    return {rows: []};
  }};
  return {s, log};
};
const catalog = [{id: 'p1', label: 'Order: Spare Parts', incidences: 7, embeddingIds: ['e1', 'e2']}, {id: 'p2', label: 'Order: Spare Parts', incidences: 3, embeddingIds: ['e3']}];

test('el resumen une catálogo, señales ya leídas, severidad y recomendaciones, por problema, SIN texto de conversación', async () => {
  const {s, log} = fake({meta: [{id: 'p1', severity: 'high', recs: 2}, {id: 'p2', severity: 'low', recs: 0}], quotes: [{pid: 'p1', quote: 'Hello Frank, necesito la pieza'}]});
  const signalRows = [{pid: 'p1', category: 'Order: Spare Parts', severity: 'high', spans: 5}, {pid: 'p1', category: 'Order: Spare Parts', severity: 'low', spans: 2}, {pid: 'p2', category: 'Order: Spare Parts', severity: 'low', spans: 4}];
  const o = await catalogOverview(s, catalog, {signalRows, isCritical: isCriticalIssue});
  assert.deepEqual(o.parts, {signals: 'ok', severity: 'ok'});
  assert.ok(!log.some(x => /redacted_text|message_revisions/.test(x)), 'privacidad: la lista ya no selecciona texto de conversación en SQL');
  assert.ok(o.rows.every(r => !('quote' in r)), 'las filas no llevan extracto');
  assert.deepEqual(o.critical, {groups: 1, signals: 5}, 'grupos con revisión crítica y señales críticas (evidencias), cada uno con su unidad');
  assert.deepEqual(o.rows.find(r => r.id === 'p1'), {id: 'p1', label: 'Order: Spare Parts', conversations: 7, severity: 'high', critical: true, critical_signals: 5, critical_reason: 'severity', citations: 7, recommendations: 2, themes: [{category: 'Order: Spare Parts', count: 7}]});
  assert.deepEqual(o.rows.find(r => r.id === 'p2'), {id: 'p2', label: 'Order: Spare Parts', conversations: 3, severity: 'low', critical: false, critical_signals: 0, critical_reason: null, citations: 4, recommendations: 0, themes: [{category: 'Order: Spare Parts', count: 4}]});
  assert.equal(o.total, 2);
});

test('una parte que vence su tope queda en null y «unavailable»; nunca 0, y las demás partes siguen', async () => {
  const {s, log} = fake({meta: [{id: 'p1', severity: 'high', recs: 1}], fail: [/FROM public\.problems p/]});
  const o = await catalogOverview(s, catalog, {signalRows: null, isCritical: isCriticalIssue});
  assert.deepEqual(o.parts, {signals: 'unavailable', severity: 'unavailable'});
  for (const r of o.rows) { assert.equal(r.critical, null); assert.equal(r.citations, null); assert.equal(r.severity, null); assert.equal(r.recommendations, null); }
  assert.ok(log.some(x => /ROLLBACK TO SAVEPOINT catalog_meta/.test(x)), 'revierte el savepoint de la parte que venció');
  assert.ok(o.rows.every(r => r.conversations > 0), 'las conversaciones salen del catálogo y siempre están');
});

test('sin presupuesto restante no se lanza ninguna consulta opcional', async () => {
  const {s, log} = fake({meta: [{id: 'p1', severity: 'high', recs: 1}]});
  const o = await catalogOverview(s, catalog, {signalRows: [], isCritical: isCriticalIssue, budgetMs: 0});
  assert.deepEqual(o.parts, {signals: 'ok', severity: 'unavailable'});
  assert.deepEqual(log, []);
  assert.deepEqual(o.rows.map(r => r.critical), [false, false], 'señales leídas sin filas: no crítico, no desconocido');
});

test('de punta a punta con Postgres: catálogo completo aunque la página sea corta, solo en vista interactiva y sin cursor', {skip: SKIP, timeout: 600000}, async () => {
  await withPg(async h => {
    montarMundo(h); // 3 problemas: Envío x5 conv, Pago x2, Garantía x1; sin vínculos problema–pedido
    const pool = new pg.Pool({host: h.sock, user: 'postgres', database: 't', max: 4});
    try {
      const db = () => crearBaseDatos({pool, tenantId: TENANT_A, userId: OWNER.A, statementTimeoutMs: 60000});
      const A1 = alcance('marketplaces-usd');
      const repo = createSnapshotRepository({database: db()});
      let snap = await repo.stage({scope: A1}); snap = await repo.publish({snapshotId: snap.id, expectedContentHash: snap.contentHash});
      const ws = createWorkspaceService({database: db()});
      const page = await ws.query(q(A1, {resource: 'problems', snapshot_id: snap.id, limit: '2'}), {catalog: true});
      assert.equal(page.items.length, 2, 'la página sigue paginada');
      const c = page.meta.catalog;
      assert.equal(c.status, 'ok'); assert.equal(c.total, 3); assert.equal(c.rows.length, 3, 'el catálogo trae todos los problemas, no solo la página');
      assert.deepEqual(c.rows.map(r => [r.label, r.conversations]), [['Envío: No recibido', 5], ['Pago: Cobro duplicado', 2], ['Garantía: Batería', 1]], 'orden por conversaciones');
      assert.deepEqual(c.parts.signals, 'ok'); assert.deepEqual(c.parts.severity, 'ok');
      for (const r of c.rows) {
        assert.equal(typeof r.severity, 'string'); assert.equal(typeof r.critical, 'boolean');
        assert.ok(r.citations >= 1, 'citas registradas por la agregación de evidencia'); assert.equal(r.recommendations, 0, 'sin recomendaciones guardadas: 0 observado');
      }
      assert.equal(Number(page.meta.critical_notice?.match(/^(\d+)/)?.[1] ?? 0), c.rows.filter(r => r.critical).length, 'mismo conteo que el aviso de señales críticas');
      const sin = await ws.query(q(A1, {resource: 'problems', snapshot_id: snap.id, limit: '2'}));
      assert.equal(sin.meta.catalog, undefined, 'sin la bandera no hay resumen (exportaciones, detalle)');
      const p2 = await ws.query(q(A1, {resource: 'problems', snapshot_id: snap.id, limit: '2', cursor: page.meta.next_cursor}), {catalog: true});
      assert.equal(p2.meta.catalog, undefined, 'las páginas siguientes no repiten el resumen');
      const res = await ws.query(q(A1, {resource: 'metrics', snapshot_id: snap.id}), {catalog: true});
      assert.equal(res.meta.catalog, undefined, 'el Resumen ejecutivo no cambia');
    } finally { await pool.end(); }
  });
});

test('un grupo de severidad registrada Baja puede tener señales críticas: la fila trae el motivo y cuántas (QA1-009)', async () => {
  const {s} = fake({meta: [{id: 'p1', severity: 'low', recs: 0}, {id: 'p2', severity: 'low', recs: 0}], quotes: []});
  const signalRows = [{pid: 'p1', category: 'Order: Spare Parts', severity: 'low', spans: 336}, {pid: 'p1', category: 'Order: Spare Parts', severity: 'high', spans: 1}, {pid: 'p2', category: 'Order: Spare Parts', severity: 'low', spans: 3}];
  const o = await catalogOverview(s, catalog, {signalRows, isCritical: isCriticalIssue});
  const p1 = o.rows.find(r => r.id === 'p1');
  assert.equal(p1.severity, 'low'); assert.equal(p1.critical, true); assert.equal(p1.critical_signals, 1); assert.equal(p1.critical_reason, 'severity'); assert.equal(p1.citations, 337);
  assert.deepEqual(o.critical, {groups: 1, signals: 1});
});
