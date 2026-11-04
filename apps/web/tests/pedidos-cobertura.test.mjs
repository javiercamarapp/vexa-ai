import {test} from 'node:test';
import assert from 'node:assert/strict';
import {modeloPedidos, textoCobertura, textoPeriodo, grupoRetailer} from '../src/lib/legibilidad/pedidos.mjs';
// Datos sintéticos: ningún ID, SKU ni cliente real.
const env = (retailer, total, ligados, sinId, tipo = 'garantia') => ({retailer, entidad: 'envios', tipo, total, ligados, sinId, sinLigar: total - sinId - ligados, denominador: total - sinId, cobertura: null});
const dev = (retailer, mes, devoluciones, sinId, conPedido, conEnvio) => ({retailer, mes, devoluciones, sinId, denominador: devoluciones - sinId, conPedido, conEnvio, coberturaPedido: null, coberturaEnvio: null});

test('textoCobertura: sin denominador es «n/d», nunca 0 %; un 0 real sí es 0 %', () => {
  assert.equal(textoCobertura(null), 'n/d');
  assert.equal(textoCobertura(undefined), 'n/d');
  assert.equal(textoCobertura(Number.NaN), 'n/d');
  assert.equal(textoCobertura(null, 'en'), 'n/a');
  assert.notEqual(textoCobertura(null), textoCobertura(0));
  assert.match(textoCobertura(0), /^0\.0/);
  assert.match(textoCobertura(0.375), /^37\.5/);
});
test('denominador 0 (todo sin ID) => cobertura null aunque haya filas', () => {
  const m = modeloPedidos({enlaces: [env('amazon', 5, 0, 5)], devoluciones: [dev('amazon', '2026-01-01', 3, 3, 0, 0)], periodoEnvios: []});
  assert.equal(m.grupos[0].envios.cobertura, null);
  assert.equal(m.grupos[0].devoluciones.coberturaPedido, null);
  assert.equal(m.grupos[0].devoluciones.coberturaEnvio, null);
  assert.equal(m.grupos[0].envios.total, 5, 'el total sigue visible');
});
test('retailer desconocido: cobertura n/d aunque el denominador sea positivo y las uniones sean 0', () => {
  const m = modeloPedidos({enlaces: [env('unknown', 10, 0, 2)], devoluciones: [dev('unknown', '2026-02-01', 4, 1, 0, 0)]});
  const g = m.grupos[0];
  assert.equal(g.clave, 'unknown');
  assert.equal(g.envios.cobertura, null);
  assert.equal(g.devoluciones.coberturaPedido, null);
  assert.equal(g.devoluciones.coberturaEnvio, null);
});
test('orden fijo Amazon, Walmart, otros, desconocido; los retailers menores se suman en «otros»', () => {
  const m = modeloPedidos({enlaces: [env('unknown', 1, 0, 1), env('bestbuy', 4, 2, 0), env('walmart', 3, 1, 0), env('lowes', 6, 3, 0), env('amazon', 8, 4, 0)]});
  assert.deepEqual(m.grupos.map((g) => g.clave), ['amazon', 'walmart', 'otros', 'unknown']);
  const otros = m.grupos[2].envios;
  assert.equal(otros.total, 10); assert.equal(otros.ligados, 5); assert.equal(otros.cobertura, 0.5);
  assert.equal(grupoRetailer('homedepot'), 'otros');
});
test('la cobertura se recalcula con sumas, no se promedian porcentajes (meses de distinto tamaño)', () => {
  const m = modeloPedidos({devoluciones: [dev('amazon', '2026-01-01', 100, 0, 90, 10), dev('amazon', '2026-02-01', 10, 0, 0, 0)]});
  const d = m.grupos[0].devoluciones;
  assert.equal(d.total, 110); assert.equal(d.conPedido, 90);
  assert.ok(Math.abs(d.coberturaPedido - 90 / 110) < 1e-9);
});
test('periodo: del primer al último mes de devoluciones y de las fechas de envío', () => {
  const m = modeloPedidos({enlaces: [env('walmart', 2, 1, 0)], devoluciones: [dev('walmart', '2026-03-01', 2, 0, 1, 1), dev('walmart', '2025-12-01', 2, 0, 1, 1)],
    periodoEnvios: [{retailer: 'walmart', desde: '2026-01-05', hasta: '2026-02-20'}]});
  assert.deepEqual(m.grupos[0].devoluciones.periodo, {desde: '2025-12-01', hasta: '2026-03-01'});
  assert.deepEqual(m.grupos[0].envios.periodo, {desde: '2026-01-05', hasta: '2026-02-20'});
  assert.equal(textoPeriodo('2025-12-01', '2026-03-01', 'es'), 'dic 2025 – mar 2026');
  assert.equal(textoPeriodo('2026-02-03', '2026-02-27', 'es'), 'feb 2026');
  assert.equal(textoPeriodo(null, null), null);
  assert.equal(modeloPedidos({enlaces: [env('amazon', 1, 1, 0)], periodoEnvios: []}).grupos[0].envios.periodo, null);
});
test('estados: sin filas es «vacio»; sin lectura (null) es «no_disponible», no «vacio»', () => {
  assert.equal(modeloPedidos({enlaces: [], devoluciones: [], periodoEnvios: []}).estado, 'vacio');
  assert.equal(modeloPedidos({enlaces: null, devoluciones: null, periodoEnvios: null}).estado, 'no_disponible');
  assert.equal(modeloPedidos(null).estado, 'no_disponible');
  const parcial = modeloPedidos({enlaces: [env('amazon', 2, 1, 0)], devoluciones: null});
  assert.equal(parcial.estado, 'ok'); assert.equal(parcial.grupos[0].devoluciones, null, 'devoluciones sin leer no se muestran como 0');
});
test('una cifra no leída (null) no se suma como cero: el total queda null', () => {
  const m = modeloPedidos({enlaces: [env('amazon', 2, 1, 0), {...env('amazon', 3, 1, 0), total: null}]});
  assert.equal(m.grupos[0].envios.total, null);
});
test('la fila de pedidos del libro lleva solo su conteo: nunca una cobertura de ventas', () => {
  const m = modeloPedidos({enlaces: [{retailer: 'amazon', entidad: 'pedidos', tipo: 'venta', total: 50, ligados: 10, sinId: 0, sinLigar: 40, denominador: 50, cobertura: null}]});
  assert.equal(m.grupos[0].pedidos, 50);
  assert.equal(m.grupos[0].envios, null);
  assert.ok(!('cobertura' in m.grupos[0]));
});

import {createOrderCoverageRepository, ENLACES_SQL, DEVOLUCIONES_SQL, PERIODO_ENVIOS_SQL} from '../../../packages/workspace-service/pedidos-cobertura.mjs';
const sesion = (respuestas) => { const llamadas = [];
  const s = {tenantId: 'tenant-sintetico', async query(sql, args) { llamadas.push({sql, args});
    if (/SAVEPOINT|set_config/i.test(sql)) return {rows: []};
    const r = respuestas.find(([f]) => sql.includes(f)); if (r && r[1] === 'timeout') { const e = new Error('t'); e.code = '57014'; throw e; }
    return {rows: r ? r[1] : []}; }};
  return {llamadas, database: {transaction: (_m, fn) => fn(s)}}; };
test('repositorio: cada lectura va acotada al tenant de la sesión, convierte numeric a número y nunca pide datos personales', async () => {
  const {database, llamadas} = sesion([['order_link_coverage', [{retailer: 'amazon', entidad: 'envios', tipo: 'garantia', total: '4', ligados: '2', sin_id: '1', sin_ligar: '1', denominador: '3', cobertura: '0.6667'}]],
    ['order_returns_coverage', [{retailer: 'walmart', mes: '2026-01-01', devoluciones: '5', sin_id: '0', denominador: '5', con_pedido: '2', con_envio: '1', cobertura_pedido: '0.4', cobertura_envio: '0.2'}]],
    ['order_shipments', [{retailer: 'amazon', desde: '2026-01-02', hasta: '2026-02-03'}]]]);
  const d = await createOrderCoverageRepository({database}).coverage();
  assert.equal(d.enlaces[0].cobertura, 0.6667); assert.equal(d.enlaces[0].total, 4);
  assert.equal(d.devoluciones[0].mes, '2026-01-01'); assert.equal(d.periodoEnvios[0].hasta, '2026-02-03');
  const lecturas = llamadas.filter((c) => /FROM public\./.test(c.sql));
  assert.equal(lecturas.length, 3);
  for (const c of lecturas) { assert.deepEqual(c.args, ['tenant-sintetico']); assert.match(c.sql, /tenant_id=\$1/); }
  for (const sql of [ENLACES_SQL, DEVOLUCIONES_SQL]) assert.doesNotMatch(sql, /order_key|tracking|ticket_external_id|\*/i);
});
test('repositorio: una lectura que agota su tiempo queda null (no 0 ni vacío) y el modelo la marca no leída', async () => {
  const {database} = sesion([['order_link_coverage', 'timeout'], ['order_returns_coverage', []], ['order_shipments', []]]);
  const d = await createOrderCoverageRepository({database}).coverage();
  assert.equal(d.enlaces, null); assert.deepEqual(d.devoluciones, []);
  assert.equal(modeloPedidos(d).estado, 'no_disponible', 'una parte sin leer no se presenta como «no hay nada»');
  assert.equal(modeloPedidos({...d, devoluciones: null}).estado, 'no_disponible');
});

test('fechas: el texto de SQL pasa tal cual en cualquier zona; un Date no se acepta (correría el día)', async () => {
  const previa = process.env.TZ;
  try {
    for (const tz of ['Asia/Tokyo', 'America/Mexico_City', 'UTC']) {
      process.env.TZ = tz;
      const {database} = sesion([['order_returns_coverage', [{retailer: 'amazon', mes: '2026-03-01', devoluciones: 1}]], ['order_shipments', [{retailer: 'amazon', desde: '2026-01-01', hasta: '2026-01-31'}]]]);
      const d = await createOrderCoverageRepository({database}).coverage();
      assert.equal(d.devoluciones[0].mes, '2026-03-01', tz); assert.equal(d.periodoEnvios[0].desde, '2026-01-01', tz); assert.equal(d.periodoEnvios[0].hasta, '2026-01-31', tz);
    }
    const {database} = sesion([['order_returns_coverage', [{retailer: 'amazon', mes: new Date('2026-03-01T00:00:00Z'), devoluciones: 1}]]]);
    assert.equal((await createOrderCoverageRepository({database}).coverage()).devoluciones[0].mes, null);
  } finally { if (previa === undefined) delete process.env.TZ; else process.env.TZ = previa; }
});
test('SQL: las fechas salen como texto desde la base (to_char y ::text)', () => {
  assert.match(DEVOLUCIONES_SQL, /to_char\(mes,'YYYY-MM-DD'\)/); assert.match(PERIODO_ENVIOS_SQL, /min\(ship_date\)::text/); assert.match(PERIODO_ENVIOS_SQL, /max\(ship_date\)::text/);
});
test('valores no numéricos o vacíos no producen NaN: quedan null', async () => {
  const {database} = sesion([['order_link_coverage', [{retailer: 'amazon', entidad: 'envios', tipo: 'garantia', total: 'abc', ligados: '', sin_id: undefined, sin_ligar: 'NaN', denominador: 'Infinity', cobertura: 'x'}]]]);
  const f = (await createOrderCoverageRepository({database}).coverage()).enlaces[0];
  for (const k of ['total', 'ligados', 'sinId', 'sinLigar', 'denominador', 'cobertura']) assert.equal(f[k], null, k);
});
test('envíos de un tipo distinto de garantía no se mezclan con los de garantía', () => {
  const m = modeloPedidos({enlaces: [env('amazon', 4, 2, 0), env('amazon', 100, 100, 0, 'venta')]});
  assert.equal(m.grupos[0].envios.total, 4); assert.equal(m.grupos[0].envios.cobertura, 0.5);
  assert.equal(modeloPedidos({enlaces: [env('amazon', 100, 100, 0, 'venta')], devoluciones: []}).estado, 'vacio', 'solo otro tipo: no hay fila de garantía');
});
test('filas de tickets se ignoran: no crean grupo ni suman a envíos o pedidos', () => {
  const tk = {retailer: 'amazon', entidad: 'tickets', tipo: 'ticket', total: 9, ligados: 9, sinId: 0, sinLigar: 0, denominador: 9, cobertura: 1};
  assert.equal(modeloPedidos({enlaces: [tk], devoluciones: []}).estado, 'vacio');
  const m = modeloPedidos({enlaces: [tk, env('amazon', 2, 1, 0)]});
  assert.equal(m.grupos[0].envios.total, 2); assert.equal(m.grupos[0].pedidos, null);
});
