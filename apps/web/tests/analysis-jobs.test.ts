// QA2-018: trabajos de la misma conversación agrupados y aviso de configuración con salida clara.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {groupJobs, submitBlock} from '../src/lib/analysis-jobs';

const j = (id: string, conversationId: string, state = 'succeeded', runId: string | null = 'r' + id) => ({id, runId, conversationId, state, runStatus: state === 'succeeded' ? 'succeeded' : null, reason: null});

test('seis trabajos de la misma conversación son un solo grupo y conservan todas las evidencias', () => {
  const g = groupJobs([1, 2, 3, 4, 5, 6].map(n => j(String(n), 'conv-A')).concat([j('7', 'conv-B', 'running', null)]));
  assert.equal(g.length, 2);
  assert.equal(g[0].conversationId, 'conv-A'); assert.equal(g[0].jobs.length, 6); assert.deepEqual(g[0].runIds, ['r1', 'r2', 'r3', 'r4', 'r5', 'r6']);
  assert.equal(g[0].state, 'succeeded'); assert.equal(g[1].state, 'running');
});
test('el estado del grupo prioriza lo que requiere acción: en curso o con falla antes que terminado', () => {
  assert.equal(groupJobs([j('1', 'A'), j('2', 'A', 'failed', null)])[0].state, 'failed');
  assert.equal(groupJobs([j('1', 'A'), j('2', 'A', 'running', null)])[0].state, 'running');
  assert.equal(groupJobs([j('1', 'A', 'cancelled', null)])[0].state, 'cancelled');
});
test('sin trabajos no hay grupos', () => assert.deepEqual(groupJobs([]), []));

test('aviso de IA: dice el motivo, quién puede actuar y qué hacer', () => {
  const owner = submitBlock({ready: false, enabled: false}, true, false), viewer = submitBlock({ready: false, enabled: false}, false, false);
  assert.match(owner!, /Límites y conciliación/);
  assert.match(viewer!, /administrador/i); assert.match(viewer!, /siguen disponibles|ya terminados/);
  assert.match(submitBlock({ready: true, enabled: false}, true, false)!, /desactivado/);
  assert.match(submitBlock({ready: true, enabled: true}, true, false)!, /conversación/i);
  assert.equal(submitBlock({ready: true, enabled: true}, true, true), null);
});
