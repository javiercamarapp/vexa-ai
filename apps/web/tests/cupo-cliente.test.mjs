// Concurrencia máxima del cliente: ~12 lecturas de una pantalla no llegan juntas al servidor (pool de 5 conexiones por instancia).
import test from 'node:test';
import assert from 'node:assert/strict';
import {crearLimitador, fetchCupo, esperaReintento, TOPE_LECTURAS} from '../src/lib/workspace/cupo.mjs';

const dormir = ms => new Promise(r => setTimeout(r, ms));
const respuesta = (status, retryAfter) => ({status, ok: status < 300, headers: {get: n => n.toLowerCase() === 'retry-after' ? retryAfter ?? null : null}});
function servidor(ms = 15, planes = new Map()) {
  const s = {enVuelo: 0, pico: 0, llamadas: [], fetchFn: async url => { s.llamadas.push(url); s.enVuelo++; s.pico = Math.max(s.pico, s.enVuelo); await dormir(ms); s.enVuelo--; const plan = planes.get(url); return respuesta(plan?.length ? plan.shift() : 200); }};
  return s;
}
test('12 lecturas de una pantalla: nunca más de TOPE_LECTURAS en vuelo y todas terminan', async () => {
  const srv = servidor(), lim = crearLimitador();
  const rs = await Promise.all(Array.from({length: 12}, (_, i) => fetchCupo('/api/' + i, {}, {fetchFn: srv.fetchFn, limitador: lim})));
  assert.equal(TOPE_LECTURAS, 4); assert.equal(srv.pico, 4); assert.equal(rs.filter(r => r.status === 200).length, 12); assert.equal(lim.estado().pico, 4);
});
test('el precalentamiento no compite con la persona: espera a que no haya lecturas suyas y respeta su tope de 2', async () => {
  const srv = servidor(20), lim = crearLimitador(), orden = [];
  const baja = n => fetchCupo('/api/baja' + n, {}, {fetchFn: async u => { orden.push(u); return srv.fetchFn(u); }, limitador: lim, baja: true});
  const alta = n => fetchCupo('/api/alta' + n, {}, {fetchFn: async u => { orden.push(u); return srv.fetchFn(u); }, limitador: lim});
  const bajas = [baja(1), baja(2), baja(3), baja(4)];
  await dormir(2);
  const altas = [alta(1), alta(2)];
  await Promise.all([...bajas, ...altas]);
  assert.ok(srv.pico <= 4); assert.deepEqual(orden.slice(0, 4).filter(u => u.includes('alta')).length, 2, 'las de la persona pasan antes que las bajas pendientes');
  // con la persona en vuelo no arranca ninguna baja nueva
  const lim2 = crearLimitador(), t = []; const f = async u => { t.push([u, lim2.estado().altas]); await dormir(15); return respuesta(200); };
  await Promise.all([fetchCupo('/a', {}, {fetchFn: f, limitador: lim2}), fetchCupo('/b1', {}, {fetchFn: f, limitador: lim2, baja: true}), fetchCupo('/b2', {}, {fetchFn: f, limitador: lim2, baja: true}), fetchCupo('/b3', {}, {fetchFn: f, limitador: lim2, baja: true})]);
  assert.ok(t.filter(([u]) => u.startsWith('/b')).every(([, altas]) => altas === 0), 'ninguna baja arrancó con una lectura de la persona en vuelo');
  assert.ok(lim2.estado().pico <= 2 + 1);
});
test('503 en un GET: se repite en silencio con retroceso y se entrega la respuesta buena', async () => {
  const srv = servidor(1, new Map([['/api/x', [503, 503]]])), esperas = [];
  const r = await fetchCupo('/api/x', {}, {fetchFn: srv.fetchFn, limitador: crearLimitador(), espera: n => { esperas.push(n); return 1; }});
  assert.equal(r.status, 200); assert.deepEqual(esperas, [1, 2]); assert.equal(srv.llamadas.length, 3);
});
test('503 persistente: tras los reintentos se devuelve el 503 (la pantalla lo rotula); POST y precalentamiento no se repiten', async () => {
  const srv = servidor(1, new Map([['/api/y', [503, 503, 503, 503]], ['/api/p', [503, 503]], ['/api/w', [503, 503]]]));
  const base = {fetchFn: srv.fetchFn, limitador: crearLimitador(), espera: () => 1};
  assert.equal((await fetchCupo('/api/y', {}, base)).status, 503); assert.equal(srv.llamadas.filter(u => u === '/api/y').length, 3);
  assert.equal((await fetchCupo('/api/p', {method: 'POST'}, base)).status, 503); assert.equal(srv.llamadas.filter(u => u === '/api/p').length, 1);
  assert.equal((await fetchCupo('/api/w', {}, {...base, baja: true})).status, 503); assert.equal(srv.llamadas.filter(u => u === '/api/w').length, 1);
});
test('retroceso: 1.2 s, 2.4 s con jitter ≤25 %, Retry-After manda, tope 8 s', () => {
  assert.equal(esperaReintento(1, null, () => 0), 1200); assert.equal(esperaReintento(2, null, () => 0), 2400); assert.equal(esperaReintento(1, null, () => 1), 1500);
  assert.equal(esperaReintento(1, '5', () => 0), 5000); assert.equal(esperaReintento(1, '60', () => 0), 8000);
});
test('abortar una lectura que espera en cola la saca de la cola sin llamar al servidor', async () => {
  const srv = servidor(30), lim = crearLimitador({tope: 1}), c = new AbortController();
  const primera = fetchCupo('/api/1', {}, {fetchFn: srv.fetchFn, limitador: lim}), segunda = fetchCupo('/api/2', {signal: c.signal}, {fetchFn: srv.fetchFn, limitador: lim});
  c.abort(); await assert.rejects(segunda, {name: 'AbortError'}); await primera; assert.deepEqual(srv.llamadas, ['/api/1']);
});
