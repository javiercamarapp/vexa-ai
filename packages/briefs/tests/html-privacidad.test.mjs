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
    metrics: [], top3: [prob(original)], critical: [], actions: [], comparison: {status: 'ok', reasons: [], metrics: []}, limits: [], coverage: {}}};
  let html;
  try { html = briefHtml(brief); } catch (e) { assert.fail('el documento mínimo no alcanza para renderizar: ' + e.message); }
  assert.ok(!/Andrew|Elm Rd|Eli Brook/.test(html));
  assert.match(html, /\[nombre\]/); assert.match(html, /\[dirección\]/);
  assert.match(html, /Se ocultan patrones frecuentes de nombres y direcciones, pero el texto puede seguir conteniendo datos de terceros/);
  assert.equal(brief.document.top3[0].evidence[0].quote, original, 'el documento verificado no se modifica');
});
