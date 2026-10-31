// Catálogo de bodegas por configuración externa (VEXA_CCO_CATALOGO): validación, valores desconocidos y JSON de sesión. Todo SINTÉTICO.
//   node --test packages/workspace-service/tests/cco-catalogo.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {catalogoBodegas, catalogoBodegasJson, bodegasConocidas, bodegaDe, BODEGA_OTRA} from '../cco.mjs';
import {CATALOGO_SINTETICO, CATALOGO_SINTETICO_JSON} from './cco-catalogo-sintetico.mjs';

const env = (v) => ({VEXA_CCO_CATALOGO: typeof v === 'string' ? v : JSON.stringify(v)});

test('sin la variable el catálogo es vacío: todo valor con contenido sale «otra», lo vacío sale null, nunca se asigna en silencio', () => {
  for (const e of [{}, {VEXA_CCO_CATALOGO: ''}, {VEXA_CCO_CATALOGO: '   '}, undefined]) {
    assert.deepEqual([...catalogoBodegas(e)], []);
    assert.equal(catalogoBodegasJson(e), '[]');
    assert.deepEqual(bodegasConocidas(e), [BODEGA_OTRA]);
  }
  assert.equal(bodegaDe('ALFA Norte', catalogoBodegas({})), 'otra');
  assert.equal(bodegaDe('', catalogoBodegas({})), null); assert.equal(bodegaDe(null, catalogoBodegas({})), null); assert.equal(bodegaDe(undefined), null);
});

test('catálogo válido: prefijo sin distinguir mayúsculas, etiqueta fija, familia de sufijo libre sin espacios, desconocido = otra', () => {
  const c = catalogoBodegas(env(CATALOGO_SINTETICO));
  assert.equal(c.length, 5);
  assert.equal(bodegaDe('alfa usa inc', c), 'Bodega Alfa'); assert.equal(bodegaDe('  ALFA Norte ', c), 'Bodega Alfa');
  assert.equal(bodegaDe('Beta', c), 'Bodega Beta'); assert.equal(bodegaDe('Betta', c), 'Bodega Beta');
  assert.equal(bodegaDe('demo-n1', c), 'DEMO-N1'); assert.equal(bodegaDe('Demo-US N2', c), 'DEMO-USN2');
  assert.equal(bodegaDe('Almacén raro', c), 'otra'); assert.equal(bodegaDe('DEMO', c), 'otra', 'el prefijo exige el guion de la familia');
  assert.deepEqual(bodegasConocidas(env(CATALOGO_SINTETICO)), ['Bodega Alfa', 'Bodega Beta', 'Bodega Gamma', 'Bodega Delta', 'otra']);
});

test('el JSON de sesión es compacto, normalizado y estable (lo que lee la función SQL)', () => {
  assert.deepEqual(JSON.parse(catalogoBodegasJson(env(CATALOGO_SINTETICO))), [
    {p: 'DEMO-', e: null, l: true}, {p: 'ALFA', e: 'Bodega Alfa', l: false}, {p: 'BET', e: 'Bodega Beta', l: false}, {p: 'GAMMA', e: 'Bodega Gamma', l: false}, {p: 'DELTA', e: 'Bodega Delta', l: false}]);
  assert.equal(catalogoBodegasJson({VEXA_CCO_CATALOGO: CATALOGO_SINTETICO_JSON}), catalogoBodegasJson(env(CATALOGO_SINTETICO)));
});

test('entradas inválidas se ignoran enteras; JSON roto o de forma ajena = catálogo vacío; gana la primera coincidencia y el primer prefijo repetido', () => {
  assert.deepEqual([...catalogoBodegas(env('{no es json'))], []);
  assert.deepEqual([...catalogoBodegas(env([]))], []); assert.deepEqual([...catalogoBodegas(env({bodegas: 'x'}))], []); assert.deepEqual([...catalogoBodegas(env('null'))], []);
  const malas = [{etiqueta: 'Sin prefijo'}, {prefijo: 'X', etiqueta: 'Prefijo corto'}, {prefijo: 'AB%', etiqueta: 'Comodín'}, {prefijo: 'ÑU', etiqueta: 'No ASCII'}, {prefijo: 'SINETIQ'},
    {prefijo: 'OTRA1', etiqueta: 'otra'}, {prefijo: 'LIBRE1', sufijoLibre: 'si'}, {prefijo: 'CTRL1', etiqueta: 'a\u0007b'}, {prefijo: 'LARGA1', etiqueta: 'x'.repeat(61)}, null, 5, 'texto'];
  assert.deepEqual([...catalogoBodegas(env({bodegas: malas}))], []);
  const mezcla = catalogoBodegas(env({bodegas: [{prefijo: 'uno', etiqueta: 'Bodega Uno'}, {prefijo: 'UNO', etiqueta: 'Repetida'}, {prefijo: 'UNO-X', etiqueta: 'Bodega UnoX'}, {prefijo: 'dos', etiqueta: ' Bodega Dos '}]}));
  assert.deepEqual(mezcla.map((b) => [b.prefijo, b.etiqueta]), [['UNO', 'Bodega Uno'], ['UNO-X', 'Bodega UnoX'], ['DOS', 'Bodega Dos']]);
  assert.equal(bodegaDe('uno-x 1', mezcla), 'Bodega Uno', 'gana la primera coincidencia por orden');
});

test('tope de entradas y catálogo inmutable', () => {
  const muchas = Array.from({length: 80}, (_, i) => ({prefijo: 'P' + String(i).padStart(3, '0'), etiqueta: 'Bodega ' + i}));
  assert.equal(catalogoBodegas(env({bodegas: muchas})).length, 50);
  const c = catalogoBodegas(env(CATALOGO_SINTETICO));
  assert.ok(Object.isFrozen(c) && Object.isFrozen(c[0]));
});

test('el catálogo se relee del entorno en cada llamada', () => {
  const antes = process.env.VEXA_CCO_CATALOGO;
  try {
    delete process.env.VEXA_CCO_CATALOGO; assert.equal(bodegaDe('alfa'), 'otra');
    process.env.VEXA_CCO_CATALOGO = CATALOGO_SINTETICO_JSON; assert.equal(bodegaDe('alfa'), 'Bodega Alfa');
    delete process.env.VEXA_CCO_CATALOGO; assert.equal(bodegaDe('alfa'), 'otra');
  } finally { if (antes === undefined) delete process.env.VEXA_CCO_CATALOGO; else process.env.VEXA_CCO_CATALOGO = antes; }
});
