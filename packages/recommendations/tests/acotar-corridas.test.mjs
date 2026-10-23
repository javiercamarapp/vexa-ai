// La verificación completa de evidencia (con texto) de un problema se acota a un lote de corridas (QA-2, 23-oct: 2,338 corridas ≈ 30 s con la conexión retenida).
import test from 'node:test';
import assert from 'node:assert/strict';
import {acotarCorridas, EVIDENCE_MAX_RUNS} from '../explorer.mjs';

const ids = n => Array.from({length: n}, (_, i) => '00000000-0000-4000-8000-' + String(i).padStart(12, '0'));
test('sin límites devuelve las corridas distintas ordenadas y el total', () => {
  const r = acotarCorridas([...ids(5), ...ids(3)].reverse());
  assert.deepEqual(r.runs, ids(5)); assert.equal(r.total, 5);
});
test('maxRuns: toma un conjunto estable y reporta el total real (2,338 -> 100)', () => {
  const todas = ids(2338), a = acotarCorridas(todas, {maxRuns: EVIDENCE_MAX_RUNS}), b = acotarCorridas([...todas].reverse(), {maxRuns: EVIDENCE_MAX_RUNS});
  assert.equal(a.runs.length, 100); assert.equal(a.total, 2338); assert.deepEqual(a.runs, b.runs);
});
test('onlyRuns: solo las corridas pedidas (las de las citas guardadas) y sin tocar el total', () => {
  const r = acotarCorridas(ids(2338), {maxRuns: 100, onlyRuns: new Set([ids(2338)[2000], ids(2338)[7], 'ajena'])});
  assert.deepEqual(r.runs, [ids(2338)[7], ids(2338)[2000]]); assert.equal(r.total, 2338);
});
test('el tope por defecto cabe en un lote de evaluación (100)', () => assert.equal(EVIDENCE_MAX_RUNS, 100));
