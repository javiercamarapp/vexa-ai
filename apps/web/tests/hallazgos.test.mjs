import {test} from 'node:test';
import assert from 'node:assert/strict';
import {coberturaAnalisisIA as coberturaAnalisis} from '../../../packages/workspace-service/cifras-cobertura.mjs';
import {resumenEvidencia, tonoSeveridad} from '../src/lib/legibilidad/hallazgos.mjs';

test('el hallazgo principal es el de mayor severidad y se cuentan todas las citas', () => {
  const r = resumenEvidencia({issues: [{category: 'Shipping: Arrived Late', severity: 'medium', evidence: [{}, {}]}, {category: 'Shipping: Damaged in Transit', severity: 'high', evidence: [{}]}]});
  assert.equal(r.severidad, 'high'); assert.equal(r.citas, 3); assert.equal(r.otros, 1); assert.ok(r.titulo && !/Shipping/.test(r.titulo));
});
test('sin hallazgos es «sin conclusión», no una severidad baja', () => {
  const r = resumenEvidencia({issues: [], abstention: true});
  assert.equal(r.severidad, null); assert.equal(r.sinConclusion, true); assert.equal(resumenEvidencia(null), null);
});
test('cobertura (definición única): con total estimado dice N de ≈M; sin total no inventa', () => {
  assert.equal(coberturaAnalisis({analizadas: 6, base: 41200, estimado: true}).texto, `6 de ≈${(41200).toLocaleString('es-MX')} conversaciones (0.0 %)`);
  const s = coberturaAnalisis({analizadas: 6, base: null});
  assert.equal(s.pct, null); assert.match(s.nota, /no está disponible/);
});
test('tono de severidad', () => { assert.equal(tonoSeveridad('critical'), 'bad'); assert.equal(tonoSeveridad('low'), 'ok'); assert.equal(tonoSeveridad(null), 'neutral'); });
