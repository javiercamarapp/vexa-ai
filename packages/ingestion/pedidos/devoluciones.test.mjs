// Parser de devoluciones (Amazon, Walmart) con datos SINTÉTICOS (SYN). Sin IDs, SKU ni personas reales.
import test from 'node:test';
import assert from 'node:assert/strict';
import {parseReturns, parseReturnsFile, readReturnRows, detectSchema, dedupeReturns, returnBatches, returnToSql, returnRowHash, parseReturnDate, cleanId, parseTSV, decodeText, normalizeOrderId, orderFormat, retailerFromFormat, RETURN_LIMITS} from './index.mjs';

const AMZ23 = ['Order ID', 'Order date', 'Return request date', 'Return request status', 'Amazon RMA ID', 'Label type', 'Label cost', 'Tracking ID', 'Label to be paid by', 'A-to-Z Claim', 'ASIN', 'Merchant SKU', 'Item Name', 'Return quantity', 'Return Reason', 'In policy', 'Return type', 'Resolution', 'Return delivery date', 'Order Amount', 'Order quantity', 'Refunded Amount', 'Order Item ID'];
const amz = (o = {}) => { const base = {'Order ID': '111-2222222-3333333', 'Order date': '45600', 'Return request date': '46000.5', 'Return request status': 'Approved', 'Amazon RMA ID': 'DJXYZ0000001', 'Label type': 'AmazonPrePaidLabel', 'Tracking ID': 'SYNTRACK0001', 'Merchant SKU': 'SYN-SKU-1', 'Item Name': 'Producto sintetico', ASIN: 'B0SYN00001', 'Return quantity': '1.0', 'Return Reason': 'CR-DEFECTIVE', 'Return type': 'C-Returns', 'Order Item ID': '1.00000000000001E+14', 'Order Amount': '99.9'}; return AMZ23.map(h => ({...base, ...o})[h] ?? null); };
const WMT = ['CUSTOMER_ORDER_NO', 'PO_NO', 'RMA_NO', 'RETURN_ORDER_LINE_NO', 'QUANTITY', 'REQUEST_DATE', 'RETURN_REASON', 'ITEM_ID', 'CURRENT_STATUS', 'CURRENT_STATUS_TIME', 'ITEM_NAME', 'TRACKING_NUMBER', 'CHANNEL', 'CUSTOMER_NAME', 'CUSTOMER_EMAIL', 'CUSTOMER_COMMENTS', 'SKU'];
const wmt = (o = {}) => { const base = {CUSTOMER_ORDER_NO: '200000000000001', RMA_NO: '900000000000000001', RETURN_ORDER_LINE_NO: '1', QUANTITY: '2', REQUEST_DATE: '2026-03-05T14:00:00Z', RETURN_REASON: 'Defective', ITEM_ID: '1234567890', CURRENT_STATUS: 'Refunded:1', CURRENT_STATUS_TIME: '2026-03-09T01:02:03Z', TRACKING_NUMBER: 'NA', CHANNEL: 'My Account', CUSTOMER_NAME: 'SYN Persona', CUSTOMER_EMAIL: 'syn@example.invalid', CUSTOMER_COMMENTS: 'comentario libre sintetico', ITEM_NAME: 'Herramienta sintetica', SKU: 'SYN-SKU-9'}; return WMT.map(h => ({...base, ...o})[h] ?? null); };

test('normalizador: Walmart 2000+11 (15 dígitos) se reconoce; otras longitudes no se adivinan', () => {
  for (const k of ['200000000000001', '200012345678901', '109012345678901', '129012345678901']) { assert.equal(orderFormat(k), 'walmart', k); assert.equal(retailerFromFormat(k), 'walmart', k); }
  for (const k of ['2000000000001' /*13*/, '20000000000001' /*14*/, '2000000000000001' /*16*/, '300000000000001' /*15 sin prefijo conocido*/, '100000000000001']) { assert.equal(orderFormat(k), 'otro', k); assert.equal(retailerFromFormat(k), null, k); }
  assert.equal(normalizeOrderId('200000000000001.0'), '200000000000001'); assert.equal(retailerFromFormat(normalizeOrderId(' 2000-0000-00000-01 ')), null, 'con guiones internos no es el formato');
  assert.equal(retailerFromFormat('111-2222222-3333333'), 'amazon'); assert.equal(retailerFromFormat('987654321-A'), 'bestbuy');
});

test('Amazon: esquema por nombre (23 columnas), sin datos personales ni tracking en la salida', () => {
  const r = parseReturns([AMZ23, amz()]);
  assert.equal(r.retailer, 'amazon'); assert.equal(r.returns.length, 1); assert.deepEqual(r.rejections, []);
  const x = r.returns[0];
  assert.deepEqual({...x, rowHash: undefined}, {retailer: 'amazon', returnKey: 'DJXYZ0000001|100000000000001', orderKey: '111-2222222-3333333', reason: 'CR-DEFECTIVE', status: 'Approved', requestedAt: '2025-12-09', statusAt: null, itemRef: 'B0SYN00001', qty: 1, hasReturnTracking: true, channel: 'C-Returns', rowHash: undefined});
  const dump = JSON.stringify(r); for (const s of ['SYNTRACK0001', 'SYN-SKU-1', 'Producto sintetico', '99.9', 'AmazonPrePaidLabel']) assert.ok(!dump.includes(s), 'no debe salir ' + s);
  assert.match(x.rowHash, /^[a-f0-9]{64}$/);
});

test('Amazon: versión de 36 columnas, columnas en otro orden y encabezados con espacios; sin tracking => false', () => {
  const H = ['Week ', 'Return Reason', 'Order Item ID', ' ', 'Amazon RMA ID', 'Return request date', 'Order ID', 'Tracking ID', ...Array.from({length: 26}, (_, i) => 'Extra ' + i)];
  const row = H.map(h => ({'Week ': '5', 'Return Reason': 'CR-MISSING_PARTS', 'Order Item ID': '123456789012345', 'Amazon RMA ID': 'DJXYZ0000002', 'Return request date': '07-Feb-2026', 'Order ID': '111-2222222-3333333', 'Tracking ID': ''})[h] ?? null);
  assert.equal(H.length, 34);
  const r = parseReturns([H, row]); assert.equal(r.returns.length, 1);
  assert.deepEqual([r.returns[0].requestedAt, r.returns[0].hasReturnTracking, r.returns[0].status, r.returns[0].itemRef, r.returns[0].qty, r.returns[0].returnKey], ['2026-02-07', false, null, null, null, 'DJXYZ0000002|123456789012345']);
});

test('Walmart: estado sin sufijo, NA en fecha de estado, canal y tracking booleano; nada personal sale', () => {
  const r = parseReturns([WMT, wmt(), wmt({RMA_NO: '900000000000000002', CURRENT_STATUS_TIME: 'NA', TRACKING_NUMBER: 'SYN123', CURRENT_STATUS: 'Initiated'})]);
  assert.equal(r.retailer, 'walmart'); assert.equal(r.returns.length, 2); assert.deepEqual(r.warnings, {});
  const [a, b] = r.returns;
  assert.deepEqual([a.returnKey, a.orderKey, a.status, a.statusAt, a.requestedAt, a.itemRef, a.qty, a.hasReturnTracking, a.channel, a.reason], ['900000000000000001|1', '200000000000001', 'Refunded', '2026-03-09', '2026-03-05', '1234567890', 2, false, 'My Account', 'Defective']);
  assert.deepEqual([b.statusAt, b.hasReturnTracking, b.status], [null, true, 'Initiated']);
  const dump = JSON.stringify(r); for (const s of ['SYN Persona', 'syn@example.invalid', 'comentario libre', 'Herramienta sintetica', 'SYN-SKU-9', 'SYN123']) assert.ok(!dump.includes(s), 'no debe salir ' + s);
  assert.equal(orderFormat(a.orderKey), 'walmart');
});

test('Walmart de 13 dígitos u otra longitud: se conserva el pedido normalizado pero sin formato inferido', () => {
  const r = parseReturns([WMT, wmt({CUSTOMER_ORDER_NO: '2000000000001'})]);
  assert.equal(r.returns[0].orderKey, '2000000000001'); assert.equal(orderFormat('2000000000001'), 'otro'); assert.equal(retailerFromFormat('2000000000001'), null); assert.equal(r.returns[0].retailer, 'walmart', 'el retailer sale del esquema del archivo, no del formato');
});

test('rechazos por fila con código; pedido ausente/ilegible no rechaza (sin ID)', () => {
  const rows = [WMT, wmt({RMA_NO: '', RETURN_ORDER_LINE_NO: ''}), wmt({RMA_NO: 'a b'}), wmt({RMA_NO: 'R'.repeat(80), RETURN_ORDER_LINE_NO: '1'}), wmt({RMA_NO: '9001', REQUEST_DATE: '2026-02-30T00:00:00Z'}), wmt({RMA_NO: '9002', REQUEST_DATE: '1999-05-05'}), wmt({RMA_NO: '9003', REQUEST_DATE: ''}),
    wmt({RMA_NO: '1.2345E+17'}), wmt({RMA_NO: '9004', CUSTOMER_ORDER_NO: ''}), wmt({RMA_NO: '9005', CUSTOMER_ORDER_NO: 'N/A'}), WMT.map(() => null)];
  const r = parseReturns(rows);
  assert.deepEqual(r.rejections.map(x => [x.row, x.code]), [[2, 'RETURN_KEY_MISSING'], [3, 'RETURN_KEY_INVALID'], [4, 'RETURN_KEY_TOO_LONG'], [5, 'DATE_INVALID'], [6, 'DATE_INVALID'], [7, 'DATE_INVALID'], [8, 'RETURN_KEY_INVALID']]);
  assert.equal(r.returns.length, 2); assert.deepEqual(r.returns.map(x => x.orderKey), [null, null]); assert.deepEqual(r.warnings, {ORDER_ID_MISSING: 1, ORDER_ID_INVALID: 1}); assert.equal(r.blank, 1);
});

test('Amazon sin RMA pero con línea: NORMA|línea; sin ninguna: rechazo', () => {
  const r = parseReturns([AMZ23, amz({'Amazon RMA ID': ''}), amz({'Amazon RMA ID': '', 'Order Item ID': ''})]);
  assert.equal(r.returns[0].returnKey, 'NORMA|100000000000001'); assert.deepEqual(r.rejections, [{row: 3, code: 'RETURN_KEY_MISSING'}]);
});

test('fechas: validación con Date.UTC (sin desbordes), serie Excel, ISO, dd-Mon-aaaa y rango', () => {
  const v = [['2026-02-28T23:59:59Z', '2026-02-28'], ['2026-02-29', null], ['31-Apr-2026', null], ['29-Feb-2028', '2028-02-29'], ['45000', '2023-03-15'], ['45000.99', '2023-03-15'], ['3/9/2026', '2026-03-09'], ['13/40/2026', null], ['2101-01-01', null], ['1999-12-31', null], ['', null], [null, null], ['mañana', null], ['12-Xyz-2026', null], ['99999', null]];
  for (const [i, o] of v) assert.equal(parseReturnDate(i), o, String(i));
});

test('control C0 y NUL se eliminan; texto fuera del juego de caracteres se descarta con advertencia, nunca se trunca', () => {
  const r = parseReturns([WMT, wmt({RETURN_REASON: 'Defec\u0000tive\u0007 item', CHANNEL: 'Cust\u0000omer Care', ITEM_ID: 'ABC DEF', QUANTITY: '0', CURRENT_STATUS: 'x'.repeat(41)}), wmt({RMA_NO: '9100', RETURN_REASON: 'Razón con acento', CUSTOMER_ORDER_NO: '2000000000000\u000001'}), wmt({RMA_NO: '9101', RETURN_REASON: 'a@b.invalid'}), wmt({RMA_NO: '9102', RETURN_REASON: 'y'.repeat(81)})]);
  const [a, b, c, d] = r.returns;
  assert.deepEqual([a.reason, a.channel, a.itemRef, a.qty, a.status], ['Defec tive item', 'Cust omer Care', null, null, null]);
  assert.deepEqual([b.reason, c.reason, d.reason], [null, null, null]);
  assert.deepEqual(r.warnings, {ITEM_REF_DROPPED: 1, QTY_DROPPED: 1, STATUS_DROPPED: 1, REASON_DROPPED: 3});
  for (const x of r.returns) assert.ok(!/[\u0000-\u001f]/.test(JSON.stringify(returnToSql(x)).replace(/\\u00[0-1][0-9a-f]/g, 'X')) );
});

test('detección de esquema por nombre de columna (no por carpeta ni nombre de archivo)', () => {
  assert.equal(detectSchema(WMT).retailer, 'walmart'); assert.equal(detectSchema(AMZ23).retailer, 'amazon');
  assert.equal(detectSchema(['a', 'b']).error, 'SCHEMA_UNRECOGNIZED');
  assert.equal(detectSchema([...AMZ23, ...WMT]).error, 'SCHEMA_AMBIGUOUS');
  assert.deepEqual(detectSchema(['Order ID', 'Amazon RMA ID', 'Order Item ID']), {error: 'SCHEMA_COLUMN_MISSING', column: 'return request date'});
  assert.deepEqual(parseReturns([['x'], []]).rejections, [{row: 1, code: 'SCHEMA_UNRECOGNIZED'}]); assert.equal(parseReturns([WMT]).schemaError, 'EMPTY_FILE');
  // un archivo con columnas de Walmart se trata como Walmart aunque el nombre/carpeta digan Amazon
  const csv = Buffer.from([WMT.join(','), wmt().map(v => v ?? '').join(',')].join('\n'));
  assert.equal(parseReturnsFile(csv, 'amazon/Return Orders April-May.csv').retailer, 'walmart');
});

test('dedup entre archivos: retailer + llave; gana el estado más reciente y el desempate no depende del orden', () => {
  const mk = (rma, st, status, line = '1') => parseReturns([WMT, wmt({RMA_NO: rma, RETURN_ORDER_LINE_NO: line, CURRENT_STATUS_TIME: st, CURRENT_STATUS: status})]).returns[0];
  const a = mk('9200', '2026-03-01T00:00:00Z', 'Initiated'), b = mk('9200', '2026-03-09T00:00:00Z', 'Refunded'), c = mk('9201', '2026-03-01T00:00:00Z', 'Initiated'), d = mk('9200', '2026-03-09T00:00:00Z', 'Cancelled'), e = mk('9200', '2026-03-05T00:00:00Z', 'x', '2');
  const r1 = dedupeReturns([a, b, c, d, e]), r2 = dedupeReturns([e, d, c, b, a]);
  assert.equal(r1.returns.length, 3); assert.equal(r1.duplicates, 2);
  const pick = r => r.returns.find(x => x.returnKey === '9200|1').status; assert.equal(pick(r1), pick(r2)); assert.ok(['Refunded', 'Cancelled'].includes(pick(r1)));
  assert.equal(pick(dedupeReturns([a, b])), 'Refunded');
  const amazonAndWalmartSameKey = dedupeReturns([{...a, retailer: 'amazon'}, a]); assert.equal(amazonAndWalmartSameKey.returns.length, 2, 'la llave incluye el retailer');
  // mismo contenido dos veces en un archivo
  const dup = parseReturns([WMT, wmt(), wmt()]); assert.equal(dup.returns.length, 1); assert.equal(dup.duplicates, 1);
});

test('row_hash determinista y sensible a cada campo; lotes <=250', () => {
  const x = parseReturns([WMT, wmt()]).returns[0], y = parseReturns([WMT, wmt({CURRENT_STATUS: 'Cancelled'})]).returns[0];
  assert.equal(x.rowHash, returnRowHash(returnToSql(x))); assert.notEqual(x.rowHash, y.rowHash);
  const many = Array.from({length: 501}, (_, i) => ({...x, returnKey: 'K' + i}));
  assert.deepEqual(returnBatches(many).map(b => b.length), [250, 250, 1]); assert.throws(() => returnBatches(many, 251), /INVALID_BATCH_SIZE/); assert.equal(RETURN_LIMITS.batch, 250);
});

test('lectores: tsv cp1252 detectado, csv utf-8 con BOM, ids en notación científica y tipos no soportados', () => {
  const tsv = [AMZ23.join('\t'), amz({'Item Name': 'Pieza café', 'Return Reason': 'CR-DEFECTIVE'}).map(v => v ?? '').join('\t')].join('\r\n');
  const bytes = Buffer.from(tsv, 'latin1'); assert.equal(decodeText(bytes).encoding, 'windows-1252');
  const r = parseReturnsFile(bytes, 'report-synthetic.tsv'); assert.equal(r.returns.length, 1); assert.ok(!JSON.stringify(r).includes('caf'));
  const csv = Buffer.concat([Buffer.from('﻿'), Buffer.from([WMT.join(','), wmt().map(v => `"${v ?? ''}"`).join(',')].join('\n'))]);
  assert.equal(parseReturnsFile(csv, 'x.csv').returns.length, 1);
  assert.throws(() => readReturnRows(Buffer.from('x'), 'x.pdf'), /UNSUPPORTED_FILE_TYPE/);
  assert.throws(() => readReturnRows(new Uint8Array([1, 2, 3, 4]), 'x.xlsx'), e => /XLSX_/.test(e.code ?? e.message), 'el lector xlsx endurecido no se debilita');
  assert.equal(cleanId('1.23456789012345E+14'), '123456789012345'); assert.equal(cleanId('1.2345E+17'), '1.2345E+17'); assert.equal(cleanId('7.0'), '7');
  assert.deepEqual(parseTSV('a\tb\r\nc\td\r\n\r\n'), [['a', 'b'], ['c', 'd']]);
});
