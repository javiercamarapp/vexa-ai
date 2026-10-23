import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resumenEvidencia, coberturaAnalisis, tonoSeveridad} from '../src/lib/legibilidad/hallazgos.mjs';

test('el hallazgo principal es el de mayor severidad y se cuentan todas las citas', () => {
  const r = resumenEvidencia({issues: [{category: 'Shipping: Arrived Late', severity: 'medium', evidence: [{}, {}]}, {category: 'Shipping: Damaged in Transit', severity: 'high', evidence: [{}]}]});
  assert.equal(r.severidad, 'high'); assert.equal(r.citas, 3); assert.equal(r.otros, 1); assert.ok(r.titulo && !/Shipping/.test(r.titulo));
});
test('sin hallazgos es «sin conclusión», no una severidad baja', () => {
  const r = resumenEvidencia({issues: [], abstention: true});
  assert.equal(r.severidad, null); assert.equal(r.sinConclusion, true); assert.equal(resumenEvidencia(null), null);
});
test('cobertura: con total estimado dice 6 de ≈N; sin total no inventa', () => {
  assert.equal(coberturaAnalisis({analizadas: 6, total: 41200}).texto, '6 de ≈41,200 conversaciones cargadas'.replace(',', ',').replace('41,200', (41200).toLocaleString('es-MX')));
  const s = coberturaAnalisis({analizadas: 6, total: null});
  assert.equal(s.bps, null); assert.match(s.nota, /no está disponible/);
});
test('tono de severidad', () => { assert.equal(tonoSeveridad('critical'), 'bad'); assert.equal(tonoSeveridad('low'), 'ok'); assert.equal(tonoSeveridad(null), 'neutral'); });
