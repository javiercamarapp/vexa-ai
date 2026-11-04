// Bloque «Pedidos, envíos y devoluciones»: resultados parciales, sin datos propios de un tenant y periodo no leído. Datos sintéticos.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import {IdiomaProvider} from '../src/components/i18n/proveedor';
import {PedidosVista} from '../src/components/datos/pedidos-cobertura';
import {es} from '../src/lib/i18n/es';
import {en} from '../src/lib/i18n/en';

const env = (retailer: string, total: number, ligados: number, sinId: number, tipo = 'garantia') => ({retailer, entidad: 'envios', tipo, total, ligados, sinId, sinLigar: total - sinId - ligados, denominador: total - sinId, cobertura: null});
const dev = (retailer: string, devoluciones: number) => ({retailer, mes: '2026-01-01', devoluciones, sinId: 0, denominador: devoluciones, conPedido: 1, conEnvio: 1, coberturaPedido: null, coberturaEnvio: null});
type Datos = {enlaces: unknown; devoluciones: unknown; periodoEnvios: unknown; refreshedAt?: unknown; lectura?: unknown};
const FECHA = {enlaces: '2026-11-04T18:00:00.000Z', devoluciones: '2026-11-03T09:00:00.000Z'};
const d = (x: Datos) => ({refreshedAt: FECHA, lectura: {enlaces: x.enlaces === null ? 'tiempo' : 'ok', devoluciones: x.devoluciones === null ? 'tiempo' : 'ok'}, ...x});
const vista = (idioma: 'es' | 'en', data: unknown) => renderToStaticMarkup(<IdiomaProvider idioma={idioma}><PedidosVista r={{data: ((data as Datos).lectura ? data : d(data as Datos)) as never, busy: false, error: null, reload: () => {}}}/></IdiomaProvider>);

test('envíos sin leer (null) con devoluciones leídas: avisa pedParcialEnv y no inventa filas de envíos', () => {
  const h = vista('es', {enlaces: null, devoluciones: [dev('amazon', 4)], periodoEnvios: null});
  assert.ok(h.includes(es['tr.datos.pedParcialEnv']));
  assert.ok(!h.includes(es['tr.datos.pedParcialDev']));
  assert.ok(!h.includes(es['tr.datos.pedHUnion']), 'no hay tabla de envíos');
});
test('devoluciones sin leer con envíos leídos: avisa pedParcialDev, también en inglés', () => {
  const datos = {enlaces: [env('walmart', 3, 1, 0)], devoluciones: null, periodoEnvios: []};
  assert.ok(vista('es', datos).includes(es['tr.datos.pedParcialDev']));
  assert.ok(vista('en', datos).includes(en['tr.datos.pedParcialDev']));
});
test('periodo de envíos no leído no dice «Sin periodo»; leído y sin fechas sí', () => {
  const sinLeer = vista('es', {enlaces: [env('amazon', 2, 1, 0)], devoluciones: [dev('amazon', 1)], periodoEnvios: null});
  const envios = sinLeer.split('</table>')[0];
  assert.ok(!envios.includes(es['tr.datos.pedSinPeriodo']), 'la tabla de envíos no dice «Sin periodo»');
  assert.ok(vista('es', {enlaces: [env('amazon', 2, 1, 0)], devoluciones: null, periodoEnvios: []}).includes(es['tr.datos.pedSinPeriodo']));
});
test('ningún texto fija datos de un solo tenant y el rótulo de sin ID no afirma que no haya ID válido', () => {
  for (const k of Object.keys(es).filter((x) => x.startsWith('tr.datos.ped'))) {
    assert.doesNotMatch((es as Record<string, string>)[k], /1191|1291/, k); assert.doesNotMatch((en as Record<string, string>)[k], /1191|1291/, k);
  }
  assert.doesNotMatch(es['tr.datos.pedHSinId'], /válido/i); assert.doesNotMatch(en['tr.datos.pedHSinId'], /valid/i);
});
test('todo leído y vacío: estado vacío y sin tablas', () => {
  const h = vista('es', {enlaces: [], devoluciones: [], periodoEnvios: []});
  assert.ok(h.includes(es['tr.datos.pedVacio'])); assert.ok(!h.includes('<table'));
});

test('resumen presente: muestra «Resumen al <fecha>» por parte, en español y en inglés', () => {
  const datos = {enlaces: [env('amazon', 2, 1, 0)], devoluciones: [dev('amazon', 3)], periodoEnvios: []};
  const e = vista('es', datos), n = vista('en', datos);
  assert.match(e, /Resumen al 4 nov 2026/); assert.match(e, /Resumen al 3 nov 2026/);
  assert.match(n, /Summary as of Nov 4, 2026/); assert.match(n, /Summary as of Nov 3, 2026/);
});
test('resumen ausente en ambas partes: «aún no se ha calculado», no «sin pedidos» ni estado vacío ni error', () => {
  const datos = {enlaces: null, devoluciones: null, periodoEnvios: [], refreshedAt: {enlaces: null, devoluciones: null}, lectura: {enlaces: 'sin_resumen', devoluciones: 'sin_resumen'}};
  const h = vista('es', datos);
  assert.ok(h.includes(es['tr.datos.pedSinResumen'])); assert.match(h, /aún no se ha calculado/);
  assert.ok(!h.includes(es['tr.datos.pedVacio'])); assert.ok(!h.includes(es['tr.datos.pedNoDisp'])); assert.ok(!h.includes('<table')); assert.ok(!h.includes('Resumen al'));
  assert.ok(vista('en', datos).includes(en['tr.datos.pedSinResumen']));
});
test('una parte sin resumen y la otra con resumen: aviso específico, sin «Resumen al» de la parte ausente', () => {
  const datos = {enlaces: [env('amazon', 2, 1, 0)], devoluciones: null, periodoEnvios: [], refreshedAt: {enlaces: FECHA.enlaces, devoluciones: null}, lectura: {enlaces: 'ok', devoluciones: 'sin_resumen'}};
  const h = vista('es', datos);
  assert.ok(h.includes(es['tr.datos.pedSinResumenDev'])); assert.ok(!h.includes(es['tr.datos.pedParcialDev'])); assert.equal((h.match(/Resumen al /g) ?? []).length, 1);
});
test('los textos nuevos no llevan paréntesis', () => {
  for (const k of ['pedResumenAl', 'pedSinResumen', 'pedSinResumenEnv', 'pedSinResumenDev']) for (const dic of [es, en]) assert.doesNotMatch((dic as Record<string, string>)['tr.datos.' + k], /[()]/, k);
});
