import test from 'node:test';
import assert from 'node:assert/strict';
import { executeTool, SYNTHETIC_TENANTS } from '../index.mjs';
import { answerToMarkdown, answerToHtml, blockToCsv } from '../export.mjs';
import { ctxFor, portFor } from './helpers.mjs';

// R2-2-002 / QA2-002: corte el 22 de octubre; septiembre llega "completo" por fecha pero con 15 % del volumen de julio (cobertura baja)
// y octubre trae 0. En TODA salida (cifra, gráfica, tabla, resumen, notas, Markdown/CSV/HTML) ni un 0 ni un porcentaje de variación.
const A = SYNTHETIC_TENANTS.A;
const port = () => {
  const base = portFor(A);
  return { ...base, trends: async () => {
    const t = structuredClone(await base.trends());
    const meses = { '2026-05': 8200, '2026-06': 8600, '2026-07': 8810, '2026-08': 8400, '2026-09': 1318, '2026-10': 0 };
    t.conversations.series = Object.entries(meses).map(([month, count]) => ({ month, count }));
    t.conversations.completeness = { basis: 'data', dataThrough: '2026-10-22', partialMonth: '2026-10', partialMonths: ['2026-10'] };
    t.ledger.completeness = { basis: 'data', dataThrough: '2026-10-05', partialMonth: '2026-10', partialMonths: ['2026-10'] };
    return t;
  } };
};
const run = (name, args) => executeTool({ name, args, port: port(), ctx: ctxFor('owner', A) });
const todo = (r) => {
  const answer = { text: r.summary, blocks: r.blocks, figures: r.figures, calc: [], sources: [], missing: [] };
  return [r.summary, ...r.notes ?? [], JSON.stringify(r.figures), JSON.stringify(r.blocks), answerToMarkdown({ question: 'q', answer }), answerToHtml({ question: 'q', answer }), ...r.blocks.map(blockToCsv)].join('\n');
};

test('comparar_meses jul→sep con septiembre de cobertura baja: sin −85 % en ninguna salida y con rótulo', async () => {
  const r = await run('comparar_meses', { a: '2026-07', b: '2026-09' });
  const s = todo(r);
  assert.ok(!/[−-]\s?8\d[.,]\d\s?%/.test(s), 'sin el -85 %');
  assert.ok(!/\(\s*[+−-]?\d+[.,]\d\s?%\)/.test(JSON.stringify(r.blocks[0].rows[0])), 'sin % de variación en conversaciones');
  assert.match(s, /mes incompleto|cobertura baja/i);
});

test('tendencia_conversaciones: octubre incompleto nunca sale como 0 (cifra, tabla, gráfica, resumen, reporte)', async () => {
  const r = await run('tendencia_conversaciones', { months: 6 });
  const s = todo(r);
  assert.ok(!/octubre de 2026 hubo 0|En octubre hubo 0|\b0 conversaciones/.test(s), r.summary);
  const f = r.figures[0];
  assert.notEqual(f.display, '0'); assert.ok(f.value === null || f.value > 0);
  assert.match(r.summary, /mes incompleto|sin datos/i);
  const oct = r.blocks[0].chart.series.find((x) => x.key === '2026-10');
  assert.equal(oct.value, null);
  const sep = r.blocks[0].chart.series.find((x) => x.key === '2026-09');
  assert.ok(sep.partial === true || sep.value === null, 'septiembre de cobertura baja va marcado');
});
