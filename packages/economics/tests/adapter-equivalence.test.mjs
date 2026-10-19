// 0055 (escala): adaptLedger se optimizó (serialización canónica memoizada por llamada, ordenamiento por la cadena ya calculada). Esta prueba exige
// que el resultado sea IDÉNTICO, bit a bit (cifras, razones, issues, scopeHash, inputHash), al algoritmo original congelado en tests/fixtures,
// sobre miles de entradas aleatorias con duplicados, conflictos de identidad, monedas/bases mezcladas, estados desconocidos y filas inválidas
// (en ese caso ambos deben fallar con el mismo código). Sin base de datos, sin red.   node --test packages/economics/tests/adapter-equivalence.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {adaptLedger} from '../adapter.mjs';
import {adaptLedger as reference} from './fixtures/adapter-reference.mjs';

const prng = seed => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
const pick = (r, xs) => xs[Math.floor(r() * xs.length)];
const T = 'SYN-A';
const day = n => new Date(Date.UTC(2026, 0, 1) + n * 86400000).toISOString();

function row(r, i, type, {bad = false} = {}) {
  const occurred = Math.floor(r() * 300), kind = type === 'event' ? pick(r, ['refund', 'refund', 'reversal']) : undefined;
  const reversal = kind === 'reversal';
  const amount = r() < 0.08 ? null : reversal ? (r() < 0.2 ? '0' : '-' + (1 + Math.floor(r() * 5000))) : String(Math.floor(r() * 90000));
  const x = {id: (type === 'event' ? 'E' : 'O') + i, tenantId: T, sourceAccount: pick(r, ['S1', 'S1', 'S2']), externalId: 'X' + i, sourceRevision: String(1 + Math.floor(r() * 3)), evidenceRef: 'ref-' + type + i,
    basis: pick(r, ['b1', 'b1', 'b1', 'b2']), provenance: 'approved_manual', occurredAt: day(occurred), recordedAt: day(occurred + Math.floor(r() * 5)), currency: pick(r, ['USD', 'USD', 'USD', 'MXN']), exponent: 2,
    status: type === 'order' ? pick(r, ['recorded', 'recorded', 'recorded', 'pending', 'cancelled', 'unknown']) : pick(r, ['settled', 'settled', 'pending', 'cancelled', 'unknown']), amountMinor: amount};
  if (type === 'event') { x.kind = kind; x.reversalOf = reversal ? 'E' + Math.max(0, i - 1 - Math.floor(r() * 3)) : null; }
  if (bad) { const k = pick(r, ['tenant', 'currency', 'date', 'prov', 'status', 'amount']); if (k === 'tenant') x.tenantId = 'SYN-B'; if (k === 'currency') x.currency = 'usd'; if (k === 'date') x.recordedAt = day(occurred - 3); if (k === 'prov') x.provenance = 'llm'; if (k === 'status') x.status = 'nope'; if (k === 'amount') x.amountMinor = '01'; }
  return x;
}

function build(seed, {n, dup = 0, conflict = 0, bad = 0, linksN = 0}) {
  const r = prng(seed), orders = Array.from({length: n}, (_, i) => row(r, i, 'order')), events = Array.from({length: Math.floor(n / 4)}, (_, i) => row(r, i, 'event'));
  for (let k = 0; k < dup; k++) orders.push({...orders[Math.floor(r() * orders.length)]});                                     // duplicado exacto: se colapsa
  for (let k = 0; k < conflict; k++) { const o = orders[Math.floor(r() * orders.length)]; orders.push({...o, amountMinor: String(1 + Math.floor(r() * 99)), evidenceRef: o.evidenceRef + 'c'}); } // mismo id, otro contenido: IDENTITY_CONFLICT
  for (let k = 0; k < bad; k++) orders[Math.floor(r() * orders.length)] = row(r, 9000 + k, 'order', {bad: true});
  const links = Array.from({length: linksN}, (_, i) => ({tenantId: T, problemId: 'P' + (i % 5), orderId: i % 7 === 0 ? 'NOPE' + i : 'O' + Math.floor(r() * n), evidenceRef: 'L' + i, relationVersion: '1'}));
  return {authorization: {tenantId: T, permissionsVersion: '1'}, snapshot: {tenantId: T, id: 'snap-' + seed, asOf: day(330), sources: [{sourceAccount: 'S1', watermark: day(320), complete: r() < 0.5}, {sourceAccount: 'S2', watermark: day(320), complete: true}]},
    scope: {start: day(30), end: day(280), timezone: 'UTC', dateBasis: 'occurred_at', currency: 'USD', exponent: 2, basis: 'b1'}, orders, events, links};
}
const run = (fn, input) => { try { return {ok: fn(structuredClone(input))}; } catch (e) { return {error: e.code ?? e.message}; } };

test('adaptLedger optimizado == algoritmo original en 400 entradas aleatorias (cifras, hashes, issues y errores idénticos)', () => {
  let errors = 0, conflicts = 0, withLinks = 0;
  for (let seed = 1; seed <= 400; seed++) {
    const input = build(seed, {n: 5 + (seed % 40), dup: seed % 4, conflict: seed % 11 === 0 ? 1 : 0, bad: seed % 13 === 0 ? 1 : 0, linksN: seed % 3 === 0 ? 12 : 0});
    const a = run(adaptLedger, input), b = run(reference, input);
    assert.deepEqual(a, b, 'seed ' + seed);
    if (a.error) errors++; else { if (a.ok.issues.some(x => x.code === 'IDENTITY_CONFLICT')) conflicts++; if (a.ok.metrics.exposure.global.totalCount > 0) withLinks++; }
  }
  assert.ok(errors > 10 && conflicts > 5 && withLinks > 20, `cobertura de la prueba: errores=${errors} conflictos=${conflicts} con exposición=${withLinks}`);
});

test('adaptLedger optimizado == original con 3,000 pedidos y 750 eventos (volumen medio) y es determinista', () => {
  const input = build(77, {n: 3000, dup: 40, conflict: 0, bad: 0, linksN: 400});
  const a = adaptLedger(structuredClone(input)), b = reference(structuredClone(input));
  assert.deepEqual(a, b);
  assert.equal(adaptLedger(structuredClone(input)).inputHash, a.inputHash);
  const shuffled = {...input, orders: [...input.orders].reverse(), events: [...input.events].reverse(), links: [...input.links].reverse()};
  assert.equal(adaptLedger(shuffled).inputHash, a.inputHash, 'el orden de entrada no cambia la identidad');
});

test('el memo de serialización no cruza llamadas: mutar la entrada entre llamadas cambia el hash como antes', () => {
  const input = build(5, {n: 20});
  const first = adaptLedger(input).inputHash;
  input.orders[0].amountMinor = '123456';
  assert.notEqual(adaptLedger(input).inputHash, first);
  assert.equal(adaptLedger(input).inputHash, reference(structuredClone(input)).inputHash);
});
