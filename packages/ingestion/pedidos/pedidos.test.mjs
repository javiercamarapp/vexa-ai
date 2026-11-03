// Pruebas SINTÉTICAS (SYN): los formatos replican los reales descritos por el cliente, ningún dato real.
import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeOrderId, normalizeRetailer, orderFormat, retailerFromFormat, parseShipments, parseReference1, ticketOrderRef, linkCoverage} from './index.mjs';

test('normaliza formatos reales por retailer (sintéticos)', () => {
  assert.equal(normalizeOrderId(' 111-2222222-3333333 '), '111-2222222-3333333');
  assert.equal(normalizeOrderId('Reference 2 - 111–2222222–3333333'), '111-2222222-3333333'); // guion largo
  assert.equal(normalizeOrderId('1112222222 3333333'), '111-2222222-3333333');
  assert.equal(normalizeOrderId('987654321-a'), '987654321-A'); // conserva sufijo -A
  assert.equal(normalizeOrderId('Reference 2 - wn11112222'), 'WN11112222');
  assert.equal(normalizeOrderId('WH33334444 '), 'WH33334444');
  assert.equal(normalizeOrderId('109012345678901.0'), '109012345678901');
  assert.equal(normalizeOrderId('1.2345678901E11'), '123456789010'); // sin «+»: así lo escribe Excel/Python
  assert.equal(normalizeOrderId('Order ID: #ABC-1234'), 'ABC-1234');
  // Notación científica acotada (sin overflow del cast en SQL) y paridad solo-ASCII.
  assert.equal(normalizeOrderId('8.99E15'), '8990000000000000');
  assert.equal(normalizeOrderId('9.99E15'), null); // sobre 2^53: texto con «.», inválido
  assert.equal(normalizeOrderId('1.5E+3'), '1500');
  assert.equal(normalizeOrderId('1E999999'), '1E999999'); // exponente > 3 dígitos: no se convierte
  assert.equal(normalizeOrderId('1E+20'), null); // sobre 2^53: queda como texto con «+», inválido
  assert.equal(normalizeOrderId('1E999'), '1E999');
  assert.equal(normalizeOrderId('1.00000000000000001E0'), null); // más de 15 decimales: no se convierte y el punto lo invalida
  assert.equal(normalizeOrderId('Stra\u00dfe-1234'), null); // «ß» (upper difiere entre JS y Postgres)
  assert.equal(normalizeOrderId('\u1680ABC-1234'), null);
  assert.equal(normalizeOrderId('\uff21\uff22\uff23-1234'), 'ABC-1234'); // NFKC lleva fullwidth a ASCII
});
test('inválidos => null (sin ID, no cero)', () => {
  for (const v of [null, undefined, '', '  ', 'N/A', 'none', '0000', '-', 'ab', 'x'.repeat(41), 'A B!C']) assert.equal(normalizeOrderId(v), null, String(v));
});
test('formato y retailer', () => {
  assert.equal(orderFormat('111-2222222-3333333'), 'amazon');
  assert.equal(retailerFromFormat('987654321-A'), 'bestbuy');
  assert.equal(retailerFromFormat('WN11112222'), null); // ambiguo: no se adivina
  assert.equal(normalizeRetailer('Best Buy'), 'bestbuy');
  assert.equal(normalizeRetailer('Amazon.com'), 'amazon');
  assert.equal(normalizeRetailer('Tienda Rara'), 'tiendarara');
  assert.notEqual(normalizeRetailer('Tienda A'), normalizeRetailer('Tienda B'));
  assert.equal(normalizeRetailer('  '), null);
});
const H = ['Carrier', 'Ship Date', 'PRO/Tracking#', 'Created Date', 'Reference 1', 'Reference 2', 'Receiver Zip', 'Receiver Address Line1', 'Destination Company Name'];
test('Speedship: parsea referencias, no conserva datos personales, dedup', () => {
  const rows = [H,
    ['UNITED PARCEL SERVICE', '2026-01-05', '1ZSYN0001', '46025.45', 'Reference 1 - Defective - SKU-L5', 'Reference 2 - 111-2222222-3333333', '99999', 'SYN CALLE 1', 'SYN PERSONA'],
    ['UNITED PARCEL SERVICE', '01/06/2026', '1ZSYN0001', '2026-01-05', 'x', 'x', '1', 'a', 'b'], // duplicado
    ['UNITED PARCEL SERVICE', '2026-01-07', '1ZSYN0002', '', 'Reference 1 - 113-1111111-2222222', '', '', '', ''], // intercambiado
    ['UNITED PARCEL SERVICE', '', '1ZSYN0003', '', '', 'Reference 2 - WN11112222', '', '', ''],
    ['UPS', '', '', '', '', '', '', '', '']];
  const r = parseShipments(rows); assert.ok(r.shipments.every(x => x.shipmentKind === 'garantia'));
  assert.equal(r.shipments.length, 3); assert.equal(r.duplicates, 1); assert.deepEqual(r.rejections, [{row: 6, code: 'TRACKING_MISSING'}]);
  const [a, b, c] = r.shipments;
  assert.equal(a.orderKey, '111-2222222-3333333'); assert.equal(a.reason, 'Defective'); assert.equal(a.sku, 'SKU-L5'); assert.equal(a.retailer, 'amazon'); assert.equal(a.shipDate, '2026-01-05');
  assert.equal(b.orderKey, '113-1111111-2222222'); assert.equal(b.orderSource, 'reference_1');
  assert.equal(c.orderKey, 'WN11112222'); assert.equal(c.retailer, 'unknown');
  const blob = JSON.stringify(r); for (const p of ['99999', 'SYN CALLE', 'SYN PERSONA']) assert.ok(!blob.includes(p), 'dato personal: ' + p);
});
import {parseShipmentsFile} from './index.mjs';
test('archivo: CSV se lee; XLSX con tipo macroEnabled se rechaza (el parser no se debilita)', () => {
  const csv = H.join(',') + '\n' + 'UPS,2026-01-05,1ZSYN9,,Reference 1 - Defective - SKU-L5,Reference 2 - 111-2222222-3333333,,,\n';
  const r = parseShipmentsFile(Buffer.from(csv), 'export.csv'); assert.equal(r.shipments.length, 1); assert.equal(r.shipments[0].orderKey, '111-2222222-3333333');
  assert.equal(parseShipments([H, ['UPS', '', 'X1', '', '', '', '', '', '']], {kind: 'venta'}).shipments[0].shipmentKind, 'venta');
  assert.throws(() => parseShipments([H, []], {kind: 'otro'}), /INVALID_SHIPMENT_KIND/);
  assert.throws(() => parseShipmentsFile(Buffer.from('x'), 'a.txt'), /UNSUPPORTED_FILE_TYPE/);
});
test('Speedship: tracking o SKU que no cabe en el CHECK se rechaza por fila sin abortar el resto', () => {
  const largo = '1Z' + 'A'.repeat(79), ok = '1Z' + 'B'.repeat(78), skuLargo = 'AB1-' + 'X'.repeat(60);
  const r = parseShipments([H, ['UPS', '', largo, '', '', '', '', '', ''], ['UPS', '', ok, '', '', '', '', '', ''], ['UPS', '', 'T9', '', 'Reference 1 - Defective - ' + skuLargo, '', '', '', '']]);
  assert.deepEqual(r.rejections, [{row: 2, code: 'TRACKING_TOO_LONG'}, {row: 4, code: 'SKU_TOO_LONG'}]);
  assert.equal(r.shipments.length, 1); assert.equal(r.shipments[0].tracking.length, 80);
});
test('Reference 1 con motivo y SKU', () => {
  assert.deepEqual(parseReference1('Reference 1 - Defective SKU-L5'), {reason: 'Defective', sku: 'SKU-L5', orderLike: null});
  assert.equal(parseReference1('').reason, null);
});
test('ticket: extrae order_id/retailer', () => {
  const t = ticketOrderRef({id: 123, properties: {order_id: ' 987654321-A', retailer: 'Best Buy', sku: 'S1', email: 'no@debe.salir'}});
  assert.equal(t.orderKey, '987654321-A'); assert.equal(t.retailer, 'bestbuy'); assert.ok(!JSON.stringify(t).includes('debe'));
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
  assert.equal(g('unknown', 'envios').cobertura, null); // retailer unknown: nunca 0 %
  assert.equal(g('unknown', 'tickets').cobertura, null);
  assert.equal(g('unknown', 'tickets').denominador, 0);
  // denominador = total - sin_id: amazon tickets = t1 ligado (t3 sin id es unknown); bestbuy t2 con id sin par => 0/1
  assert.equal(g('amazon', 'tickets').denominador, 1); assert.equal(g('amazon', 'tickets').cobertura, 1);
  assert.equal(g('bestbuy', 'tickets').denominador, 1); assert.equal(g('bestbuy', 'tickets').cobertura, 0);
  // sin_id no entra al denominador: 1 ligado + 1 sin id => 100 % de lo ligable, no 50 %
  const m = linkCoverage({orders: [{entityId: 'a', retailer: 'amazon', orderKey: '111-1-1'}], tickets: [{ticketId: 't1', retailer: 'amazon', orderKey: '111-1-1'}, {ticketId: 't2', retailer: 'amazon', orderKey: null}], shipments: []});
  const mt = m.find(x => x.retailer === 'amazon' && x.entidad === 'tickets'); assert.deepEqual([mt.total, mt.sin_id, mt.denominador, mt.cobertura], [2, 1, 1, 1]);
  const sinDen = linkCoverage({tickets: [{ticketId: 't1', retailer: 'amazon', orderKey: null}]}).find(x => x.entidad === 'tickets'); assert.equal(sinDen.cobertura, null);
});
import {OrderLinksRepository, ticketRefRow} from './index.mjs';
test('ticket: fechas válidas, epoch en ms a fecha UTC y fechas imposibles a null (no abortan el lote SQL)', () => {
  const f = v => ticketRefRow({id: 5, properties: {order_id: '111-2222222-3333333', retailer: 'Amazon', date_of_purchase: v}}).purchase_date;
  assert.equal(f('2025-03-09'), '2025-03-09');
  assert.equal(f('2025-13-45'), null); assert.equal(f('2025-02-30'), null); assert.equal(f('13/45/2025'), null);
  assert.equal(f('1700000000000'), '2023-11-14'); // epoch ms (HubSpot datetime)
  assert.equal(f(1700000000000), '2023-11-14');
  assert.equal(f('2023-11-14T22:13:20.000Z'), '2023-11-14');
  assert.equal(f('99999999999999'), null); assert.equal(f(''), null); assert.equal(f(undefined), null);
});

test('repositorio: el tenant sale de la sesión y los lotes son <=250', async () => {
  const calls = [];
  const s = {tenantId: 'T-SYN', query: async (q, p) => { calls.push([q, p]); return {rows: [{r: {inserted: q.includes('_ingest') ? JSON.parse(p[0]).length : 0, updated: 0, unchanged: 0}}]}; }};
  const repo = new OrderLinksRepository(s);
  const many = Array.from({length: 600}, (_, i) => ({carrier: 'ups', tracking: 'T' + i, orderKey: null, retailer: 'unknown', retailerBasis: 'unknown', rowHash: 'a'.repeat(64)}));
  assert.deepEqual(await repo.ingestShipments(many), {inserted: 600, updated: 0, unchanged: 0}); assert.equal(calls.length, 3);
  await repo.coverage(); assert.deepEqual(calls.at(-1)[1], ['T-SYN']);
  assert.ok(!JSON.stringify(calls.map(c => c[1])).includes('tenant_id'), 'el tenant no viaja en los datos');
  assert.equal(ticketRefRow({id: 9, properties: {order_id: '111-2222222-3333333', retailer: 'Amazon'}}).retailer, 'amazon');
});
test('NUL y controles C0 se eliminan (tracking, SKU, campos de ticket); tab y espacio se conservan colapsados', () => {
  const NUL = String.fromCharCode(0), BEL = String.fromCharCode(7);
  const hdr = ['Carrier', 'PRO/Tracking#', 'Reference 1', 'Reference 2'];
  const out = parseShipments([hdr, ['UPS', `1Z${NUL}99${BEL}AA`, `Reference 1 - Defec${NUL}tive - SKU${NUL}-L5`, '113-1234567-1234567']]);
  assert.equal(out.shipments[0].tracking, '1Z99AA');
  assert.ok(!JSON.stringify(out.shipments).includes('\\u0000') && !JSON.stringify(out.shipments).includes('\\u0007'));
  const t = ticketOrderRef({id: `9${NUL}1`, properties: {sku: `S${NUL}1\tX`, country: `M${BEL}X`, contact_reason: `a${NUL}b`}});
  assert.equal(t.ticketId, '9 1'); // el NUL pasa a separador
  assert.equal(t.sku, 'S 1 X'); assert.equal(t.country, 'M X'); assert.equal(t.contactReason, 'a b');
  assert.ok(!JSON.stringify(t).includes('\\u0000'));
});
test('ticketOrderRef: ticket_external_id vacío o > 1024 se rechaza por fila', () => {
  assert.equal(ticketOrderRef({id: 5, properties: {}}).rejection, null);
  assert.equal(ticketOrderRef({id: '1'.repeat(1024), properties: {}}).rejection, null);
  assert.equal(ticketOrderRef({id: '1'.repeat(1025), properties: {}}).rejection, 'TICKET_ID_TOO_LONG');
  for (const id of [undefined, null, '', '   ', String.fromCharCode(0)]) assert.equal(ticketOrderRef({id, properties: {}}).rejection, 'TICKET_ID_MISSING');
});
test('ingestTicketRefs reporta rejections por fila y no envía las rechazadas', async () => {
  const {OrderLinksRepository} = await import('./repository.mjs');
  const sent = [];
  const repo = new OrderLinksRepository({query: async (_q, [j]) => { const rows = JSON.parse(j); sent.push(...rows); return {rows: [{r: {inserted: rows.length, updated: 0, unchanged: 0}}]}; }});
  const r = await repo.ingestTicketRefs([{id: 1, properties: {}}, {id: '', properties: {}}, {id: 'x'.repeat(1025), properties: {}}, {id: 2, properties: {}}]);
  assert.equal(r.inserted, 2); assert.deepEqual(r.rejections, [{row: 2, code: 'TICKET_ID_MISSING'}, {row: 3, code: 'TICKET_ID_TOO_LONG'}]);
  assert.deepEqual(sent.map(x => x.ticket_external_id), ['1', '2']);
});
