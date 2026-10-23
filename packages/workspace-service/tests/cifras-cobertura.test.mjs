// Una definición de «cobertura»: «N de M» con su base, estable entre cargas (antes 48.3 % -> 97.9 % por cambiar de base).
//   node --test packages/workspace-service/tests/cifras-cobertura.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {coberturaAnalisisIA, coberturaIncorporacion, SQL_ANALIZADAS} from '../cifras-cobertura.mjs';
import {createTrendsRepository} from '../trends.mjs';

test('análisis de la IA: conversaciones distintas analizadas de las cargadas, con su base escrita (cifras reales vexa-ai 23-oct)', () => {
  const c = coberturaAnalisisIA({analizadas: 9994, base: 104018});
  assert.equal(c.texto, '9,994 de 104,018 conversaciones (9.6 %)'); assert.equal(c.pct, 9.6);
  assert.match(c.base, /conversaciones cargadas/); assert.match(c.nota, /distintas con un análisis de la IA terminado/);
  assert.match(coberturaAnalisisIA({analizadas: 9994, base: 104018, estimado: true}).texto, /de ≈104,018/);
});
test('sin base o sin numerador: No disponible, jamás 0 ni un porcentaje inventado', () => {
  assert.equal(coberturaAnalisisIA({analizadas: 6, base: null}).pct, null);
  assert.equal(coberturaAnalisisIA({analizadas: 6, base: 0}).pct, null);
  assert.equal(coberturaAnalisisIA({analizadas: null, base: 100}).texto, 'No disponible ahora');
  assert.equal(coberturaAnalisisIA({analizadas: 120, base: 100}).pct, 100, 'nunca más de 100 %');
});
test('incorporación de HubSpot: solo con desglose; sin él no hay porcentaje (no cae a filas leídas)', () => {
  const ok = {total: 17163, incorporated: 8287, rejectionBreakdown: {status: 'ok', conversationRows: 8470, conversationIncorporated: 8291}};
  const c = coberturaIncorporacion(ok);
  assert.equal(c.texto, '8,291 de 8,470 conversaciones de HubSpot (97.9 %)'); assert.match(c.base, /menos registros solo de metadatos/);
  assert.equal(coberturaIncorporacion({total: 17163, incorporated: 8287, rejectionBreakdown: {status: 'unavailable'}}), null, 'antes daba 48.3 % (8,287 de 17,163): otra base');
  assert.equal(coberturaIncorporacion(null), null);
});
test('trends: conversations.analysis lleva el conteo distinto de analizadas; sin permiso = unavailable', async () => {
  const mk = (analizadasRows, err) => ({async transaction(_a, work) {
    return work({tenantId: 't', async query(text) {
      if (/current_setting/.test(text)) return {rows: [{v: '0'}]};
      if (text === SQL_ANALIZADAS) { if (err) throw Object.assign(Error('x'), {code: err}); return {rows: analizadasRows}; }
      if (/FROM \(SELECT 1 FROM public\.conversations/.test(text)) return {rows: [{n: 10}]};
      return {rows: []};
    }});
  }});
  const NOW = new Date('2026-10-22T12:00:00Z');
  const v = await createTrendsRepository({database: mk([{n: '9994'}]), now: () => NOW}).monthly();
  assert.deepEqual(v.conversations.analysis, {status: 'ok', analyzed: 9994});
  const w = await createTrendsRepository({database: mk([], '42501'), now: () => NOW}).monthly();
  assert.deepEqual(w.conversations.analysis, {status: 'unavailable', analyzed: null});
});
