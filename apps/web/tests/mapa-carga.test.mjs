// Modelos de presentación de «Mapa de problemas» y «Carga y SLA»: rampa, leyenda, textos y formatos. Sin PII.
//   cd apps/web && node --test tests/mapa-carga.test.mjs
import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../src/components/map/mapa-modelo.mjs';
import * as C from '../src/components/workload/carga-modelo.mjs';
import {ESTADOS_US, ESTADOS_MX} from '../../../packages/workspace-service/geo-estado.mjs';

test('cartogramas: un mosaico por estado, sin repetidos ni choques de celda', () => {
  for (const [pais, mos, nombres] of [['US', M.MOSAICOS_US, ESTADOS_US], ['MX', M.MOSAICOS_MX, ESTADOS_MX]]) {
    assert.deepEqual(mos.map(m => m[0]).sort(), Object.keys(nombres).sort(), pais);
    assert.equal(new Set(mos.map(m => m[1] + ',' + m[2])).size, mos.length, pais + ' sin celdas repetidas');
    assert.ok(mos.every(([, c, f]) => c < M.PAISES[pais].columnas && f < M.PAISES[pais].filas));
  }
});
test('rampa de 5 pasos y leyenda consistentes: cada valor cae en el rango de su paso', () => {
  assert.equal(M.pasoDeRampa(0, 100), 0); assert.equal(M.pasoDeRampa(1, 100), 1); assert.equal(M.pasoDeRampa(100, 100), 5); assert.equal(M.pasoDeRampa(40, 100), 2); assert.equal(M.pasoDeRampa(41, 100), 3);
  for (const max of [3, 7, 220]) { const lim = M.limitesRampa(max); for (let n = 1; n <= max; n++) { const p = M.pasoDeRampa(n, max), l = lim.find(x => x.paso === p); assert.ok(l && n >= l.desde && n <= l.hasta, `${n}/${max}`); } }
  assert.deepEqual(M.limitesRampa(0), []);
});
test('textos de cobertura y ocultos; tabla equivalente', () => {
  assert.match(M.textoCobertura({filas: 4870, conDireccion: 2018, interpretables: 1700, pctInterpretablesDeDireccion: 84.2}), /^1,700 de 4,870 filas del Tracker traen dirección interpretable \(2,018 traen alguna dirección; 84\.2 % de ellas se pudo leer\)\.$/);
  assert.match(M.textoOcultos({estados: 3, casos: 8, minimo: 5}), /^3 estados con menos de 5 casos no se muestran por separado \(8 casos\)/); assert.equal(M.textoOcultos({estados: 0, casos: 0, minimo: 5}), null);
  assert.deepEqual(M.filasTabla([{clave: 'US-TX', nombre: 'Texas', pais: 'US', n: 30}, {clave: 'US-CA', nombre: 'California', pais: 'US', n: 10}], 40).map(r => [r.estado, r.pct]), [['Texas', 75], ['California', 25]]);
  assert.match(M.MENSAJE_COMPLETO, /Amazon, Walmart y Shopify \(ver guía de accesos\)/);
});
test('carga: formatos de horas, meses y rampa', () => {
  assert.equal(C.horas(0.0063), '23 s'); assert.equal(C.horas(0.5), '30 min'); assert.equal(C.horas(44.2), '44.2 h'); assert.equal(C.horas(384), '16 días'); assert.equal(C.horas(null), '—');
  assert.equal(C.horaTxt(23), '23:00–00:00'); assert.equal(C.mesTxt('2026-07'), 'jul 2026'); assert.equal(C.fechaCorta('2026-07-10'), '10 jul 2026');
  assert.equal(C.pasoCarga(0, 3), 0); assert.equal(C.pasoCarga(0.1, 3), 1); assert.equal(C.pasoCarga(3, 3), 5); assert.equal(C.pct(null), '—');
});
