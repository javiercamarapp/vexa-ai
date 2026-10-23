import test from 'node:test';
import assert from 'node:assert/strict';
import { executeTool, SYNTHETIC_TENANTS } from '../index.mjs';
import { ctxFor, portFor } from './helpers.mjs';

// QA2-002: un mes incompleto (corte de datos a mitad de mes) jamás produce una variación %, ni un «0» presentado como dato.
const A = SYNTHETIC_TENANTS.A;
const withCut = (through, { ledgerThrough = through, zeroAfter = true } = {}) => {
  const base = portFor(A);
  return {
    ...base,
    trends: async () => {
      const t = structuredClone(await base.trends());
      t.conversations.completeness = { basis: 'data', dataThrough: through, partialMonth: through.slice(0, 7), partialMonths: [through.slice(0, 7)] };
      t.ledger.completeness = { basis: 'data', dataThrough: ledgerThrough, partialMonth: ledgerThrough.slice(0, 7), partialMonths: [ledgerThrough.slice(0, 7)] };
      if (zeroAfter) for (const p of t.conversations.series) if (p.month > through.slice(0, 7)) p.count = 0;
      return t;
    },
  };
};
const run = (name, args, port) => executeTool({ name, args, port, ctx: ctxFor('owner', A) });
const UMBRAL = /mes incompleto: no comparable/;

test('comparar_meses jul-sep con septiembre cortado el 21: ninguna medida lleva variación porcentual y se avisa', async () => {
  const r = await run('comparar_meses', { a: '2026-07', b: '2026-09' }, withCut('2026-09-21'));
  assert.equal(r.status, 'ok');
  const medidas = r.blocks[0].rows;
  assert.ok(medidas.length >= 2);
  for (const row of medidas) { assert.match(row.cambio, UMBRAL, row.medida); assert.ok(!/%/.test(row.cambio), row.medida); }
  for (const f of r.figures.slice(0, medidas.length)) assert.ok(!/%/.test(f.display) && f.value === null, f.label);
  assert.match(r.summary, UMBRAL); assert.ok(!/−?\d+[.,]\d %/.test(r.summary), r.summary);
  assert.ok(r.notes.some((n) => /21 de septiembre|21 sept|21 sep/.test(n) && /70 %|%/.test(n)), JSON.stringify(r.notes));
});

test('comparar_meses entre dos meses completos sí calcula el porcentaje', async () => {
  const r = await run('comparar_meses', { a: '2026-07', b: '2026-08' }, withCut('2026-09-21'));
  for (const row of r.blocks[0].rows) assert.match(row.cambio, /%/, row.medida);
  assert.ok(!UMBRAL.test(r.summary));
});

test('tendencia_conversaciones: el mes sin datos es «No disponible» (no 0), el parcial va marcado y el resumen no afirma «0 en octubre»', async () => {
  const r = await run('tendencia_conversaciones', { months: 12 }, withCut('2026-09-21'));
  const s = r.blocks[0].chart.series;
  const oct = s.find((x) => x.key === '2026-10'), sep = s.find((x) => x.key === '2026-09');
  assert.equal(oct.value, null); assert.equal(oct.display, 'No disponible');
  assert.equal(sep.partial, true); assert.ok(sep.label.endsWith('*'));
  assert.equal(r.blocks[0].rows.find((x) => x.mes.startsWith('octubre')).conversaciones, 'No disponible');
  assert.ok(!/octubre de 2026 hubo 0|\b0 conversaciones/.test(r.summary), r.summary);
  assert.match(r.summary, /incompleto/);
  assert.match(r.blocks[0].note, /incompleto/);
});

test('categorias_por_mes: el cambio se calcula entre el primero y el último mes COMPLETOS; el parcial y el vacío no entran', async () => {
  const base = withCut('2026-09-21');
  const r = await run('categorias_por_mes', { months: 6 }, base);
  assert.equal(r.status, 'ok');
  const b = r.blocks[0];
  assert.match(b.note, UMBRAL);
  assert.ok(b.columns.some((c) => /sep.*parcial|sep\*/.test(c.label)), JSON.stringify(b.columns.map((c) => c.label)));
  assert.ok(b.rows.every((row) => row['2026-10'] === 'No disponible'));
  assert.ok(!/octubre/.test(r.summary.split('Entre')[1]?.split('y')[1]?.slice(0, 20) ?? ''), r.summary);
  assert.match(r.summary, /agosto/);
});

test('sin marca de corte (base calendario) el mes en curso se trata como incompleto y no se compara', async () => {
  const r = await run('comparar_meses', { a: '2026-09', b: '2026-10' }, portFor(A));
  for (const row of r.blocks[0].rows) assert.match(row.cambio, UMBRAL, row.medida);
});
