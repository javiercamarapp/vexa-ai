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
const vista = (idioma: 'es' | 'en', data: any) => renderToStaticMarkup(<IdiomaProvider idioma={idioma}><PedidosVista r={{data, busy: false, error: null, reload: () => {}}}/></IdiomaProvider>);

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
    assert.doesNotMatch((es as any)[k], /1191|1291/, k); assert.doesNotMatch((en as any)[k], /1191|1291/, k);
  }
  assert.doesNotMatch(es['tr.datos.pedHSinId'], /válido/i); assert.doesNotMatch(en['tr.datos.pedHSinId'], /valid/i);
});
test('todo leído y vacío: estado vacío y sin tablas', () => {
  const h = vista('es', {enlaces: [], devoluciones: [], periodoEnvios: []});
  assert.ok(h.includes(es['tr.datos.pedVacio'])); assert.ok(!h.includes('<table'));
});
