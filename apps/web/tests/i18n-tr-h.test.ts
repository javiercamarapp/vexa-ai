// Traducción grupo H: paridad es/en de d-tr-h, reglas del inglés y funciones puras en inglés.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {trHEs, trHEn} from '../src/lib/i18n/d-tr-h';
import {en} from '../src/lib/i18n/en';
import {traductor} from '../src/lib/i18n';
import {etiquetaCategoria} from '../src/lib/legibilidad/categorias.mjs';
import {sello} from '../src/lib/confianza/sello.mjs';
import {hace} from '../src/lib/legibilidad/sincronizacion.mjs';
import {sourceRefLabel} from '../src/lib/source-ref.mjs';
import {kindInfo} from '../src/lib/epistemic.mjs';

const ES = trHEs as Record<string, string>, EN = trHEn as Record<string, string>;
const variables = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
const t = traductor('en') as any;

test('d-tr-h: claves idénticas, sin vacíos, mismas variables, incorporadas en en.ts', () => {
  assert.deepEqual(Object.keys(ES).sort(), Object.keys(EN).sort());
  for (const k of Object.keys(ES)) {
    assert.ok(ES[k].trim() && EN[k].trim(), k);
    assert.equal(variables(EN[k]), variables(ES[k]), k);
    assert.equal((en as Record<string, string>)[k], EN[k]);
  }
});
test('d-tr-h: el inglés no lleva acentos, paréntesis, emojis ni cifras escritas a mano', () => {
  for (const [k, v] of Object.entries(EN)) {
    assert.doesNotMatch(v, /[áéíóúñüÁÉÍÓÚÑÜ¿¡]/, k);
    assert.doesNotMatch(v, /[()]/, k);
    assert.doesNotMatch(v, /\p{Extended_Pictographic}/u, k);
    assert.doesNotMatch(v.replace(/\{\w+\}/g, ''), /(^|[^\w.-])\d{2,}/, k);
  }
});
test('funciones puras en inglés', () => {
  assert.equal(etiquetaCategoria('Shipping: Damaged in Transit', t), 'Shipping: Damaged in Transit');
  assert.equal(etiquetaCategoria('Envío: Dañado en tránsito', t), 'Shipping: Damaged in Transit');
  assert.equal(etiquetaCategoria('Shipping: Damaged in Transit'), 'Envío: Dañado en tránsito');
  assert.equal(hace(300, t), '5 min ago');
  assert.equal(hace(86400 * 9, t), '9 days ago');
  assert.equal(sourceRefLabel('snapshot:exposure.global', t), 'Exposure · cut total');
  assert.equal(kindInfo('observed', t).label, 'Observed');
  const s = sello({fuente: 'HubSpot API', hasta: '2026-10-23T00:00:00Z', actualizado: '2026-10-17T00:00:00Z', ahora: Date.parse('2026-10-23T00:00:00Z'), t});
  assert.equal(s.texto, 'Observed · HubSpot API · through Oct 23, 2026 · updated 6 days ago');
  assert.equal(sello({fuente: 'x', t}).hasta, 'no cutoff date');
});
