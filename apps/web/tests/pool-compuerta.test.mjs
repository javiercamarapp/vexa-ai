// Pool simulado: una pantalla pide ~12 lecturas a la vez y algunas duran mucho. La compuerta limita las conexiones en uso al máximo del pool
// y hace ESPERAR su turno (en vez de fallar a los 5 s como el Pool de pg con connectionTimeoutMillis).
import test from 'node:test';
import assert from 'node:assert/strict';
import {crearCompuerta,CompuertaAgotada} from '../src/lib/db-resiliencia.mjs';

const dormir = ms => new Promise(r => setTimeout(r, ms));
async function lectura(compuerta, ms, traza) {
  const liberar = await compuerta.adquirir();
  traza.enUso++; traza.pico = Math.max(traza.pico, traza.enUso);
  try { await dormir(ms); } finally { traza.enUso--; liberar(); }
}
test('12 lecturas simultáneas con 5 conexiones: pico 5, todas terminan, ninguna falla', async () => {
  const c = crearCompuerta({max: 5, esperaMs: 2000}), traza = {enUso: 0, pico: 0};
  await Promise.all(Array.from({length: 12}, (_, i) => lectura(c, i < 2 ? 120 : 20, traza)));
  assert.equal(traza.pico, 5); assert.deepEqual(c.estado(), {activas: 0, enEspera: 0, max: 5});
});
test('una lectura lenta no deja sin turno a las ligeras: las ligeras esperan solo hasta que algún hueco se libera', async () => {
  const c = crearCompuerta({max: 2, esperaMs: 1000}), traza = {enUso: 0, pico: 0};
  const t0 = Date.now(), lentas = [lectura(c, 150, traza), lectura(c, 150, traza)], ligeras = Array.from({length: 6}, () => lectura(c, 5, traza));
  await Promise.all([...lentas, ...ligeras]);
  assert.ok(Date.now() - t0 >= 140 && traza.pico === 2);
});
test('FIFO: se atiende en orden de llegada', async () => {
  const c = crearCompuerta({max: 1, esperaMs: 1000}), orden = [];
  await Promise.all([1, 2, 3, 4].map(async n => { const liberar = await c.adquirir(); orden.push(n); await dormir(5); liberar(); }));
  assert.deepEqual(orden, [1, 2, 3, 4]);
});
test('si la espera pasa de esperaMs falla con POOL_WAIT y no deja un hueco colgado', async () => {
  const c = crearCompuerta({max: 1, esperaMs: 30}), liberar = await c.adquirir();
  await assert.rejects(c.adquirir(), e => e instanceof CompuertaAgotada && e.code === 'POOL_WAIT' && e.message === 'pool_wait_timeout');
  assert.deepEqual(c.estado(), {activas: 1, enEspera: 0, max: 1});
  liberar(); liberar(); // idempotente
  assert.deepEqual(c.estado(), {activas: 0, enEspera: 0, max: 1});
  const otra = await c.adquirir(); otra();
});
