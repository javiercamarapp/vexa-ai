// A6: el Brief rotula su cifra de críticos «al guardarse» (la de su momento) y no la presenta como conteo en vivo.
import test from 'node:test';
import assert from 'node:assert/strict';
import {fraseVigilar,resumenVigilar} from '../src/lib/legibilidad/brief.mjs';
const f = n => `${n} grupos con revisión crítica`;
test('con selección guardada: «al guardarse el brief, fecha» + remisión a Problemas', () => {
  const t = fraseVigilar(resumenVigilar({critical: new Array(5).fill({}), selection: {criticalCandidates: 62}}), '18 sep 2026', f);
  assert.match(t, /^Al guardarse este brief \(18 sep 2026\) había 62 grupos con revisión crítica/); assert.match(t, /detalla los 5 con más citas/); assert.match(t, /Problemas recalcula con los datos de hoy/);
});
test('brief antiguo sin selección: solo los listados, sin inventar un total', () => {
  const t = fraseVigilar(resumenVigilar({critical: [{}, {}]}), null, f);
  assert.equal(t, 'Al guardarse este brief se listan 2 grupos con revisión crítica.');
});
