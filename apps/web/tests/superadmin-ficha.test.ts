import {test} from 'node:test';
import assert from 'node:assert/strict';
import {aiUsage, FIXTURE_DETAIL, freshness, overallLevel, relative, signals, sourceRows, type OrgDetail} from '../src/lib/platform/ficha-model';
const NOW = Date.UTC(2026, 9, 24, 12, 0, 0), ID = '02000000-0000-4000-8000-000000000002', H = 3600_000, D = 24 * H;
const detail = (over: Partial<OrgDetail> = {}): OrgDetail => ({...FIXTURE_DETAIL(ID, NOW), ...over});
test('frescura: al día < 2 d, envejeciendo < 7 d, atrasada después, sin dato = none (nunca «al día»)', () => {
  assert.equal(freshness(new Date(NOW - H).toISOString(), NOW), 'fresh'); assert.equal(freshness(new Date(NOW - 3 * D).toISOString(), NOW), 'aging');
  assert.equal(freshness(new Date(NOW - 9 * D).toISOString(), NOW), 'stale'); assert.equal(freshness(null, NOW), 'none'); assert.equal(freshness('basura', NOW), 'none');
});
test('relativo en español', () => {
  assert.equal(relative(new Date(NOW - 30_000).toISOString(), NOW), 'Hace un momento'); assert.equal(relative(new Date(NOW - 5 * 60000).toISOString(), NOW), 'Hace 5 min');
  assert.equal(relative(new Date(NOW - 3 * H).toISOString(), NOW), 'Hace 3 h'); assert.equal(relative(new Date(NOW - 5 * D).toISOString(), NOW), 'Hace 5 d'); assert.equal(relative(null, NOW), 'Sin registro');
});
test('señales: ordenadas por gravedad, con motivo; la ficha de ejemplo pide atención (Zendesk atrasada, fallos 30 d)', () => {
  const s = signals(detail(), NOW);
  assert.ok(s.length >= 2); assert.deepEqual(s.map(x => x.level), [...s.map(x => x.level)].sort((a, b) => ({bad: 0, warn: 1, info: 2} as Record<string, number>)[a] - ({bad: 0, warn: 1, info: 2} as Record<string, number>)[b]));
  assert.ok(s.some(x => /Zendesk no se está actualizando/.test(x.text))); assert.equal(overallLevel(s), 'warn');
});
test('señales críticas: sin dueño, atascados, reconexión y tope de IA superado', () => {
  const d = detail({members: {owner: 0, analyst: 1, operator: 0, viewer: 0, total: 1}, jobs: {...detail().jobs, stuck: 2}, ai: {window: '2026-10', spentMicro: '120000000', limitMicro: '100000000', uncertain: 1},
    connections: [{source: 'hubspot', status: 'reconnect_required', health: 'reconnect_required', lastSuccess: null, errorCode: 'RECONNECT_REQUIRED'}]});
  const t = signals(d, NOW).map(x => x.text).join(' | ');
  for (const re of [/ningún dueño/, /atascado/, /HubSpot necesita reconectarse/, /por encima del tope/, /incierto/]) assert.match(t, re);
  assert.equal(overallLevel(signals(d, NOW)), 'bad');
});
test('sin señales = ok; un corte publicado quita el aviso informativo', () => {
  const clean = detail({jobs: {...detail().jobs, failed30d: 0}, imports: {...detail().imports, failed30d: 0}, invitations: {pending: 0, expired: 0, deliveryProblems: 0}, connections: [{source: 'hubspot', status: 'active', health: 'healthy', lastSuccess: new Date(NOW - H).toISOString(), errorCode: null}]});
  assert.deepEqual(signals(clean, NOW), []); assert.equal(overallLevel([]), 'ok');
  assert.ok(signals({...clean, cuts: []}, NOW).some(x => x.level === 'info' && /Sin cortes publicados/.test(x.text)));
});
test('fuentes: une cargas y conexiones, % incorporado exacto y sin dividir entre cero', () => {
  const rows = sourceRows(detail({sources: [{source: 'csv', total: 0, incorporated: 0, rejected: 0, pending: 0, lastUpdate: null}], connections: []}), NOW);
  assert.equal(rows[0].incorporatedBps, null); assert.equal(rows[0].freshness, 'none');
  const full = sourceRows(detail(), NOW); assert.equal(full.find(r => r.source === 'hubspot')!.incorporatedBps, 9919); assert.equal(full.find(r => r.source === 'sin_conexion')!.label, 'Cargas manuales');
});
test('IA: porcentaje en bps con BigInt; sin tope = null (no 0)', () => {
  assert.equal(aiUsage(detail()).pctBps, 6184); assert.equal(aiUsage(detail({ai: {window: '', spentMicro: '5', limitMicro: '0', uncertain: 0}})).pctBps, null);
});
test('la ficha de ejemplo no contiene correos ni tokens (sin PII)', () => { assert.doesNotMatch(JSON.stringify(detail()), /@|token|password/i); });

