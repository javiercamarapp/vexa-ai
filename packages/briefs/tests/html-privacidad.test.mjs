// El HTML del brief oculta patrones de nombres/direcciones en las citas y avisa con honestidad (R2-2-004). El documento JSON verificado no cambia.
//   node --test packages/briefs/tests/html-privacidad.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {briefHtml} from '../build.mjs';
const ev = quote => ({quote, runId: 'run-1', messageRevisionId: 'rev-1', role: 'customer'});
const prob = quote => ({id: 'p1', title: 'Order: Spare Parts', version: 1, metrics: [], evidence: [ev(quote)]});
test('briefHtml: citas con saludo, cierre y dirección salen enmascaradas y con aviso; el original queda intacto', () => {
  const original = 'Hi Andrew,\nship to 55 Elm Rd, Lakewood, NJ 08701\nThanks, Eli Brook';
  const brief = {id: 'b1', version: 1, contentHash: 'h', document: {snapshotId: 's', scopeHash: 'x', scope: {date_start: 'a', date_end: 'b', currency: 'USD', basis: 'net', timezone: 'UTC', sku: [], source: []}, asOf: 't', watermark: 'w',
    metrics: [], top3: [prob(original)], critical: [], actions: [], comparison: {status: 'ok', reasons: [], metrics: []}, limits: [], forecast: {reason: 'sin pronóstico'}, coverage: {}}};
  let html;
  try { html = briefHtml(brief); } catch (e) { assert.fail('el documento mínimo no alcanza para renderizar: ' + e.message); }
  assert.ok(!/Andrew|Elm Rd|Eli Brook/.test(html));
  assert.match(html, /\[nombre\]/); assert.match(html, /\[dirección\]/);
  assert.match(html, /Se ocultan patrones frecuentes de nombres y direcciones, pero el texto puede seguir conteniendo datos de terceros/);
  assert.equal(brief.document.top3[0].evidence[0].quote, original, 'el documento verificado no se modifica');
});

test('briefHtml en inglés rotula el exporte en inglés (lang="en", sin rótulos fijos en español) y en español sigue igual', async () => {
  const {briefHtml} = await import('../build.mjs');
  const brief = {id: 'b1', version: 1, contentHash: 'h', document: {snapshotId: 's', scopeHash: 'sc', scope: {date_start: '2026-09-01', date_end: '2026-10-01', currency: 'USD', basis: 'net', timezone: 'UTC', sku: [], source: []}, asOf: '2026-10-01', watermark: 'w', metrics: [{label: 'Revenue', amount_minor: '12345', currency: 'USD', exponent: 2, known_subtotal: null, coverage: {known_n: 5, eligible_n: 6}}], top3: [], critical: [], actions: [], comparison: {status: 'not_requested', reasons: [], metrics: []}, limits: [], forecast: {reason: 'x'}}};
  const en = briefHtml(brief, 'en'), es = briefHtml(brief);
  assert.match(en, /<html lang="en">/); assert.match(en, /Observed figures/); assert.match(en, /coverage 5\/6/); assert.match(en, /Not sent by email/); assert.match(en, /All/);
  for (const t of ['Cifras observadas', 'cobertura', 'Todos', 'Generado con plantilla', 'Límites', 'Acciones capturadas']) assert.ok(!en.includes(t), t);
  assert.match(es, /<html lang="es">/); assert.match(es, /Cifras observadas/); assert.match(es, /cobertura 5\/6/);
});
