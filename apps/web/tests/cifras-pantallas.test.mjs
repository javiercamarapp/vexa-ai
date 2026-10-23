// A6: las pantallas que muestran la MISMA cifra la sacan de la misma definición. Recorre los fixtures de cobertura y compara
// Resumen (estadoFuentes), Fuentes (tarjetasFuentes), Importaciones (agregadoImportaciones) y la cobertura de análisis.
//   cd apps/web && node --require ./tests/server-only-stub.cjs --import tsx --test tests/cifras-pantallas.test.mjs
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {coverage, trends} from './ui/fixtures.mjs';
import {estadoFuentes, coberturaDeTendencias} from '../src/lib/legibilidad/resumen-ejecutivo.mjs';
import {tarjetasFuentes} from '../src/lib/legibilidad/fuentes.mjs';
import {agregadoImportaciones, desgloseImportaciones} from '../src/lib/connections/estado.mjs';
import {coberturaIncorporacion} from '../../../packages/workspace-service/cifras-cobertura.mjs';

const cov = coverage(), tr = trends();

test('Importaciones = suma de las tarjetas por fuente de Fuentes (CSV + HubSpot + Zendesk), con el desglose escrito', () => {
  const ag = agregadoImportaciones(cov.sources), tarjetas = tarjetasFuentes(cov, tr);
  const suma = tarjetas.filter(t => ['csv', 'hubspot', 'zendesk'].includes(t.clave) && t.estado === 'cargada').reduce((n, t) => n + t.incorporadas, 0);
  assert.equal(ag.incorporadas, suma);
  assert.equal(ag.porFuente.reduce((n, f) => n + f.incorporadas, 0), suma);
  assert.ok(desgloseImportaciones(ag.porFuente).includes('Archivos CSV'));
});
test('la incorporación de HubSpot es la misma en Resumen y en la fuente (una definición)', () => {
  const hub = cov.sources.find(s => s.key === 'hubspot'), e = estadoFuentes(cov, {});
  assert.deepEqual(e.incorporacion, coberturaIncorporacion(hub));
});
test('cobertura de análisis: estable entre lecturas con los mismos datos y siempre «N de M» con base', () => {
  const conv = {...tr.conversations, status: 'ok', analysis: {status: 'ok', analyzed: 120}};
  const a = coberturaDeTendencias(conv), b = coberturaDeTendencias(JSON.parse(JSON.stringify(conv)));
  assert.deepEqual(a, b); assert.match(a.texto, /^120 de /); assert.match(a.base, /conversaciones cargadas/);
});
