// «Mapa de problemas»: extractor de estado, k-anonimato, cobertura, privacidad y cálculo de quejas por 100 pedidos. Datos 100 % sintéticos (DEMO-*).
//   node --test packages/workspace-service/tests/mapa-problemas.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../geo-estado.mjs';
import * as M from '../mapa-problemas.mjs';

test('extractor: abreviatura con ZIP, nombre completo, ZIP suelto, México por nombre y por CP con marca', () => {
  const e = t => { const r = G.estadoDeDireccion(t); return r && `${r.pais}-${r.codigo}`; };
  assert.equal(e('DEMO 1 Calle Falsa, Ciudad, TX 78701'), 'US-TX');
  assert.equal(e('DEMO 2 Main Street, Springfield, Illinois'), 'US-IL');
  assert.equal(e('DEMO 3 Santa Fe, New Mexico 87501'), 'US-NM', 'New Mexico es de EE. UU., no «México»');
  assert.equal(e('DEMO 4, Calle X 33101'), 'US-FL', 'ZIP suelto: se lee como ZIP de EE. UU.');
  assert.equal(e('DEMO 5 Col. Centro, 64000 Monterrey, Nuevo León, México'), 'MX-NLE');
  assert.equal(e('DEMO 6 Col. Roma C.P. 44100 Mexico'), 'MX-JAL', 'CP con marca de México -> tabla de CP de México');
  assert.equal(e('DEMO 7 Estado de México, 52000'), 'MX-MEX');
  assert.equal(e('DEMO 8 Av. CDMX'), 'MX-CMX');
});
test('extractor: no confunde calles ni palabras con estados', () => {
  const e = t => G.estadoDeDireccion(t);
  assert.equal(e('DEMO 9 Florida Ave, Nowhere'), null, '«Florida Ave» es una calle');
  assert.equal(e('DEMO 10 Indiana Street'), null);
  assert.equal(e('Meet me in the bar, OR maybe not'), null, '«OR» suelto no es Oregón');
  assert.equal(e('DEMO 11 Oak Rd, Portland, OR 97201').codigo, 'OR');
  assert.equal(e(''), null); assert.equal(e(null), null); assert.equal(e('x'.repeat(500) + ' TX 78701'), null);
});
test('tablas CP: ZIP3 y CP de México', () => {
  assert.equal(G.estadoDeZip('90210'), 'CA'); assert.equal(G.estadoDeZip('10001'), 'NY'); assert.equal(G.estadoDeZip('00501'), 'NY'); assert.equal(G.estadoDeZip('1234'), null);
  assert.equal(G.estadoDeCpMx('06700'), 'CMX'); assert.equal(G.estadoDeCpMx('97000'), 'YUC'); assert.equal(G.estadoDeCpMx('abc'), null);
  assert.equal(G.nombreEstado('MX-NLE'), 'Nuevo León'); assert.equal(G.nombreEstado('US-TX'), 'Texas');
});
test('la dirección más confiable manda: corregida > envío > original; el texto no sale de filaGeo', () => {
  const o = {'Customer address': 'DEMO Calle, Austin, TX 78701', 'Corrected Address (confirmed by customer)': 'DEMO Street, Denver, CO 80202', Contact_reason: 'Defective', Retailer: 'Walmart :: x'};
  assert.equal(M.direccionDeFila(o), 'DEMO Street, Denver, CO 80202');
  const f = M.filaGeo('Warranty Tools', o);
  assert.deepEqual(f, {hoja: 'Warranty Tools', tipo: 'Garantía de herramientas', tieneDireccion: true, estado: 'US-CO', motivo: 'Defectuoso', retailer: 'walmart'});
  assert.ok(!JSON.stringify(f).includes('DEMO') && !JSON.stringify(f).includes('Denver'));
  assert.equal(M.filaGeo('Refunds', {Retailer: 'Amazon'}).tieneDireccion, false);
  assert.equal(M.filaGeo('Refunds', {'Customer_address': 'DEMO sin estado'}).estado, null);
});
test('k-anonimato: celdas < 5 se agrupan; un solo «Otros» pequeño se funde con la celda menor visible; nada bajo 5 sale', () => {
  const r = M.suprimirCeldas({A: 10, B: 6, C: 2, D: 1});
  assert.deepEqual(r, {items: [{etiqueta: 'A', n: 10}], otros: 9, ocultoTodo: false}, 'C+D=3 <5: se funde con B (6) para que no se pueda restar');
  assert.deepEqual(M.suprimirCeldas({A: 3, B: 1}), {items: [], otros: 0, ocultoTodo: true});
  assert.deepEqual(M.suprimirCeldas({A: 8, B: 5}), {items: [{etiqueta: 'A', n: 8}, {etiqueta: 'B', n: 5}], otros: 0, ocultoTodo: false});
});
function filas() {
  const out = [];
  const add = (n, estado, o = {}) => { for (let i = 0; i < n; i++) out.push({hoja: 'Refunds', tipo: 'Reembolsos', tieneDireccion: true, estado, motivo: 'Defectuoso', retailer: 'walmart', ...o}); };
  add(12, 'US-TX'); add(7, 'US-TX', {motivo: 'Garantía', retailer: 'amazon'}); add(6, 'US-CA'); add(3, 'US-OH'); add(2, 'US-NY'); add(5, 'MX-JAL');
  for (let i = 0; i < 4; i++) out.push({hoja: 'Refunds', tipo: 'Reembolsos', tieneDireccion: true, estado: null, motivo: null, retailer: null});
  for (let i = 0; i < 10; i++) out.push({hoja: 'Refunds', tipo: 'Reembolsos', tieneDireccion: false, estado: null, motivo: null, retailer: null});
  return out;
}
test('agregarGeo: cobertura exacta, estados con n>=5 y ocultos contados', () => {
  const a = M.agregarGeo(filas());
  assert.deepEqual(a.cobertura, {filas: 49, conDireccion: 39, interpretables: 35, pctInterpretablesDeDireccion: 89.7, pctInterpretablesDeFilas: 71.4, pais: {US: 30, MX: 5}});
  assert.deepEqual(a.estados.map(e => [e.clave, e.n]), [['US-TX', 19], ['US-CA', 6], ['MX-JAL', 5]]);
  assert.deepEqual(a.ocultos, {estados: 2, casos: 5, minimo: 5});
  const tx = a.estados[0];
  assert.deepEqual(tx.motivos.items, [{etiqueta: 'Defectuoso', n: 12}, {etiqueta: 'Garantía', n: 7}]);
  for (const e of a.estados) for (const g of [e.tipos, e.motivos, e.retailers]) { for (const i of g.items) assert.ok(i.n >= 5); assert.ok(g.otros === 0 || g.otros >= 5); }
});
test('quejas por cada 100 pedidos: pedido contado una vez, estados con pocos pedidos = «No disponible»', () => {
  const ped = []; for (let i = 0; i < 40; i++) ped.push({orderId: 'DEMO-A' + i, canal: 'amazon', estado: 'US-TX', mes: '2026-09'});
  for (let i = 0; i < 10; i++) ped.push({orderId: 'DEMO-B' + i, canal: 'walmart', estado: 'US-OH', mes: '2026-09'});
  ped.push({orderId: 'DEMO-A0', canal: 'amazon', estado: 'US-TX', mes: '2026-09'}, {orderId: 'DEMO-N', canal: 'amazon', estado: null, mes: '2026-09'});
  const conv = [{orderId: 'DEMO-A0'}, {orderId: 'DEMO-A0'}, {orderId: 'DEMO-A1'}, {orderId: 'DEMO-B1'}, {orderId: null}];
  const r = M.quejasPor100Pedidos(ped, conv);
  assert.deepEqual(r.find(x => x.clave === 'US-TX'), {clave: 'US-TX', nombre: 'Texas', pedidos: 40, quejas: 2, por100: 5, nota: null});
  assert.equal(r.find(x => x.clave === 'US-OH').por100, null); assert.match(r.find(x => x.clave === 'US-OH').nota, /^No disponible/);
  assert.deepEqual(M.quejasPor100Pedidos([], []), []);
});
// ------------------------------------------------------------------------------------------------ servicio con base simulada
const dbCon = rows => ({async transaction(_m, work) {
  const query = async t => {
    t = String(t);
    if (/current_setting\('statement_timeout'\)/.test(t)) return {rows: [{v: '0'}]};
    if (/^(SAVEPOINT|RELEASE|ROLLBACK)/.test(t) || /set_config/.test(t)) return {rows: []};
    if (/tracker_row_revisions/.test(t)) { if (rows === 'falla') throw new Error('57014'); return {rows}; }
    return {rows: []};
  };
  return work({tenantId: 'syn', query});
}});
test('servicio: lee direcciones en memoria y devuelve solo agregados; sin PII en la salida; fallo = unavailable (no 0)', async () => {
  const crudas = [];
  for (let i = 0; i < 8; i++) crudas.push({sheet: 'Warranty Tools', tiene: true, o: {'Customer Address': `DEMO-NOMBRE-${i} Calle ${i}, Austin, TX 78701`, Retailer: 'Walmart', Contact_reason: 'Defective'}});
  for (let i = 0; i < 6; i++) crudas.push({sheet: 'Refunds', tiene: true, o: {Customer_address: `DEMO-NOMBRE Calle, Miami, FL 33101`, Retailer: 'Amazon'}});
  crudas.push({sheet: 'Refunds', tiene: true, o: {Retailer: 'Amazon'}}, {sheet: 'Refunds', tiene: false, o: null});
  const v = await M.createGeoMapRepository({database: dbCon(crudas), now: () => new Date('2026-10-23T12:00:00Z')}).get();
  assert.equal(v.status, 'ok'); assert.equal(v.provisional, true); assert.deepEqual(v.cobertura, {filas: 15, conDireccion: 14, interpretables: 14, pctInterpretablesDeDireccion: 100, pctInterpretablesDeFilas: 93.3, pais: {US: 14, MX: 0}});
  const txt = JSON.stringify(v);
  for (const prohibido of ['DEMO-NOMBRE', 'Calle', 'Austin', 'Miami', '78701', '33101']) assert.ok(!txt.includes(prohibido), prohibido);
  assert.deepEqual(v.estados.map(e => [e.clave, e.n]), [['US-TX', 8], ['US-FL', 6]]);
  const falla = await M.createGeoMapRepository({database: dbCon('falla')}).get();
  assert.equal(falla.status, 'unavailable'); assert.equal(falla.estados, undefined);
  assert.equal((await M.createGeoMapRepository({database: dbCon([])}).get()).status, 'empty');
});
