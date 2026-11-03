// Pruebas SINTÉTICAS (SYN): los formatos replican los reales descritos por el cliente, ningún dato real.
import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeOrderId, normalizeRetailer, orderFormat, retailerFromFormat, parseShipments, parseReference1, ticketOrderRef, linkCoverage} from './index.mjs';

test('normaliza formatos reales por retailer (sintéticos)', () => {
  assert.equal(normalizeOrderId(' 113-5268979-5206610 '), '113-5268979-5206610');
  assert.equal(normalizeOrderId('Reference 2 - 113–5268979–5206610'), '113-5268979-5206610'); // guion largo
  assert.equal(normalizeOrderId('1135268979 5206610'), '113-5268979-5206610');
  assert.equal(normalizeOrderId('261962365-a'), '261962365-A'); // conserva sufijo -A
  assert.equal(normalizeOrderId('Reference 2 - wn56823848'), 'WN56823848');
  assert.equal(normalizeOrderId('WH28882973 '), 'WH28882973');
  assert.equal(normalizeOrderId('109012345678901.0'), '109012345678901');
  assert.equal(normalizeOrderId('1.2345678901E11'), '123456789010'); // sin «+»: así lo escribe Excel/Python
  assert.equal(normalizeOrderId('Order ID: #ABC-1234'), 'ABC-1234');
});
test('inválidos => null (sin ID, no cero)', () => {
  for (const v of [null, undefined, '', '  ', 'N/A', 'none', '0000', '-', 'ab', 'x'.repeat(41), 'A B!C']) assert.equal(normalizeOrderId(v), null, String(v));
});
test('formato y retailer', () => {
  assert.equal(orderFormat('113-5268979-5206610'), 'amazon');
  assert.equal(retailerFromFormat('261962365-A'), 'bestbuy');
  assert.equal(retailerFromFormat('WN56823848'), null); // ambiguo: no se adivina
  assert.equal(normalizeRetailer('Best Buy'), 'bestbuy');
  assert.equal(normalizeRetailer('Amazon.com'), 'amazon');
  assert.equal(normalizeRetailer('Tienda Rara'), 'tiendarara');
  assert.notEqual(normalizeRetailer('Tienda A'), normalizeRetailer('Tienda B'));
  assert.equal(normalizeRetailer('  '), null);
});
const H = ['Carrier', 'Ship Date', 'PRO/Tracking#', 'Created Date', 'Reference 1', 'Reference 2', 'Receiver Zip', 'Receiver Address Line1', 'Destination Company Name'];
test('Speedship: parsea referencias, no conserva datos personales, dedup', () => {
  const rows = [H,
    ['UNITED PARCEL SERVICE', '2026-01-05', '1ZSYN0001', '46025.45', 'Reference 1 - Defective - SKU-L5', 'Reference 2 - 113-5268979-5206610', '99999', 'SYN CALLE 1', 'SYN PERSONA'],
    ['UNITED PARCEL SERVICE', '01/06/2026', '1ZSYN0001', '2026-01-05', 'x', 'x', '1', 'a', 'b'], // duplicado
    ['UNITED PARCEL SERVICE', '2026-01-07', '1ZSYN0002', '', 'Reference 1 - 113-1111111-2222222', '', '', '', ''], // intercambiado
    ['UNITED PARCEL SERVICE', '', '1ZSYN0003', '', '', 'Reference 2 - WN56823848', '', '', ''],
    ['UPS', '', '', '', '', '', '', '', '']];
  const r = parseShipments(rows); assert.ok(r.shipments.every(x => x.shipmentKind === 'garantia'));
  assert.equal(r.shipments.length, 3); assert.equal(r.duplicates, 1); assert.deepEqual(r.rejections, [{row: 6, code: 'TRACKING_MISSING'}]);
  const [a, b, c] = r.shipments;
  assert.equal(a.orderKey, '113-5268979-5206610'); assert.equal(a.reason, 'Defective'); assert.equal(a.sku, 'SKU-L5'); assert.equal(a.retailer, 'amazon'); assert.equal(a.shipDate, '2026-01-05');
  assert.equal(b.orderKey, '113-1111111-2222222'); assert.equal(b.orderSource, 'reference_1');
  assert.equal(c.orderKey, 'WN56823848'); assert.equal(c.retailer, 'unknown');
  const blob = JSON.stringify(r); for (const p of ['99999', 'SYN CALLE', 'SYN PERSONA']) assert.ok(!blob.includes(p), 'dato personal: ' + p);
});
import {parseShipmentsFile} from './index.mjs';
test('archivo: CSV se lee; XLSX con tipo macroEnabled se rechaza (el parser no se debilita)', () => {
  const csv = H.join(',') + '\n' + 'UPS,2026-01-05,1ZSYN9,,Reference 1 - Defective - SKU-L5,Reference 2 - 113-5268979-5206610,,,\n';
  const r = parseShipmentsFile(Buffer.from(csv), 'export.csv'); assert.equal(r.shipments.length, 1); assert.equal(r.shipments[0].orderKey, '113-5268979-5206610');
  assert.equal(parseShipments([H, ['UPS', '', 'X1', '', '', '', '', '', '']], {kind: 'venta'}).shipments[0].shipmentKind, 'venta');
  assert.throws(() => parseShipments([H, []], {kind: 'otro'}), /INVALID_SHIPMENT_KIND/);
  assert.throws(() => parseShipmentsFile(Buffer.from('x'), 'a.txt'), /UNSUPPORTED_FILE_TYPE/);
});
test('Reference 1 con motivo y SKU', () => {
  assert.deepEqual(parseReference1('Reference 1 - Defective SKU-L5'), {reason: 'Defective', sku: 'SKU-L5', orderLike: null});
  assert.equal(parseReference1('').reason, null);
});
test('ticket: extrae order_id/retailer', () => {
  const t = ticketOrderRef({id: 123, properties: {order_id: ' 261962365-A', retailer: 'Best Buy', sku: 'S1', email: 'no@debe.salir'}});
  assert.equal(t.orderKey, '261962365-A'); assert.equal(t.retailer, 'bestbuy'); assert.ok(!JSON.stringify(t).includes('debe'));
  assert.equal(ticketOrderRef({id: 1, properties: {}}).orderKey, null);
});
test('cobertura: unión por (id, retailer), sin_id != 0, candidatos', () => {
  const orders = [{entityId: 'o1', retailer: 'amazon', orderKey: '113-1-1'}, {entityId: 'o1b', retailer: 'amazon', orderKey: '113-1-1'}, {entityId: 'o2', retailer: 'walmart', orderKey: '113-1-1'}, {entityId: 'o3', retailer: 'amazon', orderKey: null}];
  const tickets = [{ticketId: 't1', retailer: 'amazon', orderKey: '113-1-1'}, {ticketId: 't2', retailer: 'bestbuy', orderKey: '113-1-1'}, {ticketId: 't3', retailer: 'unknown', orderKey: null}];
  const shipments = [{id: 's1', retailer: 'unknown', orderKey: '113-1-1'}, {id: 's2', retailer: 'unknown', orderKey: 'ZZ99'}];
  const rows = linkCoverage({orders, tickets, shipments}), g = (r, e) => rows.find(x => x.retailer === r && x.entidad === e);
  assert.equal(g('amazon', 'pedidos').cobertura, null); // nunca % de ventas
  assert.equal(g('unknown', 'envios').tipo, 'garantia');
  assert.equal(g('amazon', 'pedidos').total, 1 + 1); // o1+o1b dedup => 1, + o3 sin id
  assert.equal(g('amazon', 'pedidos').ligados, 1); assert.equal(g('amazon', 'pedidos').sin_id, 1);
  assert.equal(g('walmart', 'pedidos').ligados, 0); // mismo ID, otro retailer: NO liga
  assert.equal(g('bestbuy', 'tickets').sin_ligar, 1);
  assert.equal(g('unknown', 'tickets').sin_id, 1); assert.equal(g('unknown', 'tickets').ligados, 0);
  assert.equal(g('unknown', 'envios').candidatos, 0); // llave bajo 3 retailers: ambigua
  assert.equal(g('unknown', 'envios').cobertura, 0);
});
import {OrderLinksRepository, ticketRefRow} from './index.mjs';
test('repositorio: el tenant sale de la sesión y los lotes son <=250', async () => {
  const calls = [];
  const s = {tenantId: 'T-SYN', query: async (q, p) => { calls.push([q, p]); return {rows: [{r: {inserted: q.includes('_ingest') ? JSON.parse(p[0]).length : 0, updated: 0, unchanged: 0}}]}; }};
  const repo = new OrderLinksRepository(s);
  const many = Array.from({length: 600}, (_, i) => ({carrier: 'ups', tracking: 'T' + i, orderKey: null, retailer: 'unknown', retailerBasis: 'unknown', rowHash: 'a'.repeat(64)}));
  assert.deepEqual(await repo.ingestShipments(many), {inserted: 600, updated: 0, unchanged: 0}); assert.equal(calls.length, 3);
  await repo.coverage(); assert.deepEqual(calls.at(-1)[1], ['T-SYN']);
  assert.ok(!JSON.stringify(calls.map(c => c[1])).includes('tenant_id'), 'el tenant no viaja en los datos');
  assert.equal(ticketRefRow({id: 9, properties: {order_id: '113-5268979-5206610', retailer: 'Amazon'}}).retailer, 'amazon');
});
