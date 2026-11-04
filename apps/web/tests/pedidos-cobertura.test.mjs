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

import {createOrderCoverageRepository, RESUMEN_SQL, PERIODO_ENVIOS_SQL} from '../../../packages/workspace-service/pedidos-cobertura.mjs';
// Sesión falsa: `resumen` simula la tabla (con filas de varios tenants y el WHERE tenant_id=$1 aplicado), `periodo` las fechas de envíos.
// Un valor 'timeout' o 'norelacion' lanza el error de Postgres correspondiente (57014 / 42P01) y deja la transacción abortada hasta ROLLBACK TO SAVEPOINT.
const sesion = ({resumen = [], periodo = [], tenant = 'tenant-sintetico'} = {}) => { const llamadas = []; let abortada = false;
  const s = {tenantId: tenant, async query(sql, args) { llamadas.push({sql, args});
    if (/^ROLLBACK TO SAVEPOINT/.test(sql)) { abortada = false; return {rows: []}; }
    if (/SAVEPOINT|set_config/i.test(sql)) return {rows: []};
    if (abortada) { const e = new Error('current transaction is aborted'); e.code = '25P02'; throw e; }
    const fuente = /order_coverage_summary/.test(sql) ? resumen : periodo;
    if (fuente === 'timeout' || fuente === 'norelacion') { abortada = true; const e = new Error('x'); e.code = fuente === 'timeout' ? '57014' : '42P01'; throw e; }
    return {rows: /order_coverage_summary/.test(sql) ? fuente.filter((r) => r.tenant_id === args[0]) : fuente}; }};
  return {llamadas, database: {transaction: (_m, fn) => fn(s)}}; };
const fila = (tenant, kind, rows, refreshed = '2026-11-04T18:00:00.000Z') => ({tenant_id: tenant, kind, rows, refreshed_at: refreshed});
const enl = (retailer, extra = {}) => ({retailer, entidad: 'envios', tipo: 'garantia', total: 4, ligados: 2, sin_id: 1, sin_ligar: 1, denominador: 3, cobertura: 0.6667, ...extra});
const devo = (retailer, mes = '2026-01-01') => ({retailer, mes, devoluciones: 5, sin_id: 0, denominador: 5, con_pedido: 2, con_envio: 1, cobertura_pedido: 0.4, cobertura_envio: 0.2});

test('resumen presente: lee una sola fila por parte, convierte numéricos y devuelve refreshedAt por parte', async () => {
  const {database, llamadas} = sesion({resumen: [fila('tenant-sintetico', 'enlaces', [enl('amazon', {total: '4', cobertura: '0.6667'})], '2026-11-04T18:00:00.000Z'), fila('tenant-sintetico', 'devoluciones', [devo('walmart')], '2026-11-03T09:00:00.000Z')],
    periodo: [{retailer: 'amazon', desde: '2026-01-02', hasta: '2026-02-03'}]});
  const d = await createOrderCoverageRepository({database}).coverage();
  assert.equal(d.enlaces[0].total, 4); assert.equal(d.enlaces[0].cobertura, 0.6667); assert.equal(d.enlaces[0].sinId, 1);
  assert.equal(d.devoluciones[0].mes, '2026-01-01'); assert.equal(d.devoluciones[0].coberturaPedido, 0.4);
  assert.equal(d.periodoEnvios[0].hasta, '2026-02-03');
  assert.deepEqual(d.refreshedAt, {enlaces: '2026-11-04T18:00:00.000Z', devoluciones: '2026-11-03T09:00:00.000Z'});
  assert.deepEqual(d.lectura, {enlaces: 'ok', devoluciones: 'ok'});
  const lecturas = llamadas.filter((c) => /FROM public\./.test(c.sql)); assert.equal(lecturas.length, 2, 'un SELECT del resumen y uno del periodo');
  for (const c of lecturas) assert.deepEqual(c.args, ['tenant-sintetico']);
  assert.ok(llamadas.some((c) => /statement_timeout/.test(c.sql) && c.args[0] === '4000'), 'conserva el tope de 4 s');
});
test('resumen ausente (nunca refrescado): partes null y estado sin_resumen, nunca arreglos vacíos que parezcan «cero»', async () => {
  const d = await createOrderCoverageRepository({database: sesion({resumen: []}).database}).coverage();
  assert.equal(d.enlaces, null); assert.equal(d.devoluciones, null);
  assert.deepEqual(d.lectura, {enlaces: 'sin_resumen', devoluciones: 'sin_resumen'}); assert.deepEqual(d.refreshedAt, {enlaces: null, devoluciones: null});
});
test('resumen presente pero vacío es distinto de ausente: [] con su fecha', async () => {
  const d = await createOrderCoverageRepository({database: sesion({resumen: [fila('tenant-sintetico', 'enlaces', []), fila('tenant-sintetico', 'devoluciones', [])]}).database}).coverage();
  assert.deepEqual(d.enlaces, []); assert.equal(d.lectura.enlaces, 'ok'); assert.ok(d.refreshedAt.enlaces);
});
test('solo una parte con resumen: la otra queda null y sin_resumen', async () => {
  const d = await createOrderCoverageRepository({database: sesion({resumen: [fila('tenant-sintetico', 'enlaces', [enl('amazon')])]}).database}).coverage();
  assert.equal(d.enlaces.length, 1); assert.equal(d.devoluciones, null); assert.deepEqual(d.lectura, {enlaces: 'ok', devoluciones: 'sin_resumen'});
});
test('tabla inexistente (migración sin aplicar, 42P01): no rompe, partes null «sin_resumen», y el periodo se sigue leyendo', async () => {
  const {database, llamadas} = sesion({resumen: 'norelacion', periodo: [{retailer: 'amazon', desde: '2026-01-02', hasta: '2026-02-03'}]});
  const d = await createOrderCoverageRepository({database}).coverage();
  assert.equal(d.enlaces, null); assert.equal(d.devoluciones, null); assert.deepEqual(d.lectura, {enlaces: 'sin_resumen', devoluciones: 'sin_resumen'});
  assert.equal(d.periodoEnvios.length, 1, 'la transacción no quedó abortada');
  assert.ok(llamadas.some((c) => /^ROLLBACK TO SAVEPOINT/.test(c.sql)));
});
test('tiempo agotado (57014) en el resumen: null con estado «tiempo», distinto de sin_resumen; en el periodo: periodoEnvios null', async () => {
  let d = await createOrderCoverageRepository({database: sesion({resumen: 'timeout'}).database}).coverage();
  assert.equal(d.enlaces, null); assert.deepEqual(d.lectura, {enlaces: 'tiempo', devoluciones: 'tiempo'});
  d = await createOrderCoverageRepository({database: sesion({resumen: [fila('tenant-sintetico', 'enlaces', [enl('amazon')])], periodo: 'timeout'}).database}).coverage();
  assert.equal(d.periodoEnvios, null); assert.equal(d.enlaces.length, 1);
});
test('tenant ajeno: filas de otro tenant nunca se mezclan, ni por el WHERE ni por la defensa del repositorio', async () => {
  const resumen = [fila('tenant-ajeno', 'enlaces', [enl('amazon', {total: 999})]), fila('tenant-ajeno', 'devoluciones', [devo('amazon')]), fila('tenant-sintetico', 'enlaces', [enl('walmart', {total: 3})])];
  const d = await createOrderCoverageRepository({database: sesion({resumen}).database}).coverage();
  assert.equal(d.enlaces.length, 1); assert.equal(d.enlaces[0].retailer, 'walmart'); assert.equal(d.enlaces[0].total, 3);
  assert.equal(d.devoluciones, null, 'el resumen de devoluciones del otro tenant no cuenta como propio');
  // Aunque la capa de abajo devolviera filas ajenas sin filtrar, el repositorio las descarta.
  const s = {tenantId: 'tenant-sintetico', async query(sql) { return /order_coverage_summary/.test(sql) ? {rows: resumen} : {rows: []}; }};
  const d2 = await createOrderCoverageRepository({database: {transaction: (_m, fn) => fn(s)}}).coverage();
  assert.equal(d2.enlaces.length, 1); assert.equal(d2.enlaces[0].total, 3); assert.equal(d2.devoluciones, null);
});

test('fechas: el texto de SQL pasa tal cual en cualquier zona; un Date no se acepta (correría el día)', async () => {
  const previa = process.env.TZ;
  try {
    for (const tz of ['Asia/Tokyo', 'America/Mexico_City', 'UTC']) {
      process.env.TZ = tz;
      const {database} = sesion({resumen: [fila('tenant-sintetico', 'devoluciones', [devo('amazon', '2026-03-01')])], periodo: [{retailer: 'amazon', desde: '2026-01-01', hasta: '2026-01-31'}]});
      const d = await createOrderCoverageRepository({database}).coverage();
      assert.equal(d.devoluciones[0].mes, '2026-03-01', tz); assert.equal(d.periodoEnvios[0].desde, '2026-01-01', tz); assert.equal(d.periodoEnvios[0].hasta, '2026-01-31', tz);
    }
    const {database} = sesion({resumen: [fila('tenant-sintetico', 'devoluciones', [devo('amazon', new Date('2026-03-01T00:00:00Z'))])]});
    assert.equal((await createOrderCoverageRepository({database}).coverage()).devoluciones[0].mes, null);
  } finally { if (previa === undefined) delete process.env.TZ; else process.env.TZ = previa; }
});
test('SQL: las fechas de envíos salen como texto desde la base y el resumen se lee por tenant sin pedir datos personales', () => {
  assert.match(PERIODO_ENVIOS_SQL, /min\(ship_date\)::text/); assert.match(PERIODO_ENVIOS_SQL, /max\(ship_date\)::text/);
  for (const sql of [RESUMEN_SQL, PERIODO_ENVIOS_SQL]) assert.match(sql, /tenant_id=\$1/);
  assert.doesNotMatch(RESUMEN_SQL + PERIODO_ENVIOS_SQL, /order_link_coverage|order_returns_coverage|order_key|tracking|ticket_external_id|\*/i, 'ya no lee las vistas lentas');
});
test('valores no numéricos o vacíos no producen NaN: quedan null', async () => {
  const {database} = sesion({resumen: [fila('tenant-sintetico', 'enlaces', [{retailer: 'amazon', entidad: 'envios', tipo: 'garantia', total: 'abc', ligados: '', sin_id: undefined, sin_ligar: 'NaN', denominador: 'Infinity', cobertura: 'x'}])]});
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
