// N7 (QA-2): /api/problems/{id} entregaba ids de embeddings, modelo y procedencia completa (32 KB) al navegador.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {proyectarProblema, proyectarHistoria} from '../../src/lib/problems/proyeccion.mjs';

const ids = n => Array.from({length: n}, (_, i) => '00000000-0000-4000-8000-' + String(i).padStart(12, '0'));
const problema = {id: ids(1)[0], label: 'Envío: No recibido', version: 3, state: 'active', outlier: false, modelId: 'openai/text-embedding-3-small', dimensions: 1536, embeddingVersion: 'ia-escala-msg-v1', embeddingIds: ids(467), conversationIds: ids(300), orderIds: ids(12), hashSecreto: 'x',
  history: [{id: ids(2)[1], version: 3, provenance: {kind: 'vector-problem-v1', operation: 'split', reason: 'Dos causas distintas', actorId: 'u', snapshot: {embeddingIds: ids(467), configHash: 'h'.repeat(64)}}}, {id: ids(3)[2], version: 2, provenance: {jobId: ids(4)[3], snapshot: {embeddingIds: ids(467)}, inputHash: 'h'.repeat(64)}}]};
test('sin permiso de reestructurar: solo conteos; ningún id de miembro, modelo ni hash', () => {
  const p = proyectarProblema(problema, {auditoria: false}), json = JSON.stringify(p);
  assert.equal(p.embeddingCount, 467); assert.equal(p.conversationCount, 300); assert.equal(p.orderCount, 12);
  assert.deepEqual([p.embeddingIds, p.conversationIds, p.orderIds], [[], [], []]);
  for (const prohibido of ['text-embedding', 'ia-escala', 'hashSecreto', 'configHash', 'inputHash', 'actorId', '00000000-0000-4000-8000-0000000000']) assert.ok(!json.includes(prohibido) || prohibido.startsWith('0000') && json.includes(problema.id), 'no debe contener ' + prohibido);
  assert.ok(json.length < 2500, 'respuesta mínima: ' + json.length + ' bytes');
});
test('propietario: conserva los ids y el modelo (los necesita para dividir o unir) pero la historia pierde la copia de miembros y los hashes', () => {
  const p = proyectarProblema(problema, {auditoria: true}), json = JSON.stringify(p);
  assert.equal(p.embeddingIds.length, 467); assert.equal(p.modelId, 'openai/text-embedding-3-small');
  assert.ok(!json.includes('configHash') && !json.includes('inputHash') && !json.includes('hashSecreto'));
  assert.deepEqual(p.history.map(h => h.provenance), [{operation: 'split', reason: 'Dos causas distintas'}, {jobId: ids(4)[3]}]);
});
test('historia: solo operación, motivo, trabajo y grupos resultantes', () => assert.deepEqual(proyectarHistoria([{id: 'a', version: 1, provenance: {operation: 'merge', reason: 'x', children: ['c'], snapshot: {a: 1}, actorId: 'u'}}]), [{id: 'a', version: 1, provenance: {operation: 'merge', reason: 'x', children: ['c']}}]));
