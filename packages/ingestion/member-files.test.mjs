import test from 'node:test';
import assert from 'node:assert/strict';
import {previewMemberFile, memberFileProvenance, memberFileKindInfo, excelSerialToIso, normalizeHeader, MEMBER_FILE_KINDS, MAX_REPORTED_ERRORS} from './member-files.mjs';
import {NOW, toBytes, salesCsv, salesCsvEs, ordersCsv, returnsCsv, reviewsCsv, speedshipCsv, xlsx} from './member-files.fixtures.mjs';
const CSV = 'text/csv', XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const run = (bytes, kind, extra = {}) => previewMemberFile(bytes, {kind, contentType: CSV, observedAt: NOW, ...extra});
const codes = p => Object.fromEntries(p.reasons.map(r => [`${r.code}:${r.field ?? ''}`, r.count]));

test('catalogo: cinco tipos, todos con campos requeridos y alias bilingues', () => {
  assert.deepEqual([...MEMBER_FILE_KINDS].sort(), ['marketplace_orders', 'marketplace_returns', 'reviews', 'sales_by_sku', 'speedship_shipments']);
  for (const k of MEMBER_FILE_KINDS) { const i = memberFileKindInfo(k); assert.ok(i.required.length >= 3, k); assert.ok(i.columns.every(c => c.aliases.length >= 1)); }
  assert.equal(memberFileKindInfo('otro'), null);
  assert.equal(normalizeHeader('  PRO/Tracking# '), 'pro tracking');
  assert.equal(normalizeHeader('Fecha de resena'), 'fecha de resena');
  assert.equal(normalizeHeader('Calificación'), 'calificacion');
});

test('ventas por SKU: archivo valido con moneda declarada, importes enteros y corte = fecha mas reciente', () => {
  const p = run(salesCsv(), 'sales_by_sku', {currency: 'USD'});
  assert.equal(p.headers_ok, true); assert.deepEqual(p.rows, {read: 3, accepted: 3, rejected: 0, duplicates: 0});
  assert.equal(p.aggregates.amounts.length, 1); assert.deepEqual(p.aggregates.amounts[0], {currency: 'USD', exponent: 2, amount_minor: '8575', rows: 3});
  assert.equal(p.aggregates.quantity_total, 6); assert.equal(p.aggregates.distinct_skus, 2);
  assert.equal(p.aggregates.date_min, '2026-09-01T00:00:00.000Z'); assert.equal(p.aggregates.date_max, '2026-10-05T00:00:00.000Z');
  assert.equal(p.aggregates.amount_label, 'Observada'); assert.equal(p.aggregates.amount_kind, 'gross_sales');
  assert.equal(p.can_register, true);
});

test('ventas por SKU: encabezados en español y moneda por columna', () => {
  const p = run(salesCsvEs(), 'sales_by_sku');
  assert.equal(p.headers_ok, true); assert.equal(p.rows.accepted, 2);
  assert.equal(p.headers.recognized.sku, 'SKU del producto'); assert.equal(p.headers.recognized.channel, 'Canal');
  assert.equal(p.aggregates.amounts[0].amount_minor, '14549');
});

test('sin moneda en el archivo ni declarada: bloquea con currency_required y no evalua filas', () => {
  const p = run(salesCsv(), 'sales_by_sku');
  assert.equal(p.blocker, 'currency_required'); assert.equal(p.can_register, false); assert.equal(p.rows.accepted, 0);
  assert.throws(() => run(salesCsv(), 'sales_by_sku', {currency: 'XYZ'}), {code: 'INVALID_CURRENCY'});
});

test('faltan encabezados requeridos: bloquea con los campos faltantes, sin leer filas', () => {
  const p = run(salesCsv([['SYN-A', '2026-09-01', '3', '45.50']], ['SKU', 'Date', 'Units Sold', 'Notas']), 'sales_by_sku', {currency: 'USD'});
  assert.equal(p.headers_ok, false); assert.deepEqual(p.headers.missing_required, ['amount']); assert.equal(p.blocker, 'headers'); assert.equal(p.can_register, false);
  assert.deepEqual(p.headers.ignored, ['Notas']);
});

test('encabezados ambiguos (dos columnas para el mismo campo) se rechazan', () => {
  const p = run(toBytes('SKU,Merchant SKU,Date,Units Sold,Gross Sales\nSYN-A,SYN-A,2026-09-01,1,1.00\n'), 'sales_by_sku', {currency: 'USD'});
  assert.equal(p.headers_ok, false); assert.deepEqual(p.headers.ambiguous, ['sku']);
});

test('filas rechazadas: motivos agregados con linea y campo, sin valores de celda', () => {
  const secret = 'SYN-SECRETO-NO-DEBE-SALIR';
  const bytes = salesCsv([
    ['SYN-A', '2026-09-01', '3', '45.50'], ['', '2026-09-02', '1', '10.00'], ['SYN-B', '2026-13-45', '1', '10.00'], ['SYN-B', '2027-12-01', '1', '10.00'],
    ['SYN-B', '2026-09-02', 'x', '10.00'], ['SYN-B', '2026-09-02', '1', '-5.00'], ['SYN-B', '2026-09-02', '1', '10.005'], [secret, '2026-09-02', '1', 'abc'], ['SYN-A', '2026-09-01', '3', '45.50'], ['SYN-D', '2026-09-02', '1'],
  ]);
  const p = run(bytes, 'sales_by_sku', {currency: 'USD'});
  assert.deepEqual(p.rows, {read: 10, accepted: 1, rejected: 8, duplicates: 1});
  const c = codes(p);
  assert.equal(c['MISSING_VALUE:sku'], 1); assert.equal(c['INVALID_DATE:date'], 1); assert.equal(c['FUTURE_DATE:date'], 1); assert.equal(c['INVALID_NUMBER:quantity'], 1);
  assert.equal(c['NEGATIVE_AMOUNT:amount'], 1); assert.equal(c['INVALID_MONEY:amount'], 2); assert.equal(c['COLUMN_COUNT:'], 1); assert.equal(c['DUPLICATE_ROW:'], 1);
  assert.equal(p.errors.find(e => e.code === 'FUTURE_DATE').line, 5);
  assert.ok(!JSON.stringify(p).includes(secret), 'ningun valor de celda aparece en la respuesta');
  assert.ok(!JSON.stringify(p).includes('SYN-A'), 'tampoco los SKU');
});

test('el reporte de errores se acota y marca truncado', () => {
  const rows = Array.from({length: MAX_REPORTED_ERRORS + 25}, (_, i) => [`SYN-${i}`, 'no-fecha', '1', '1.00']);
  const p = run(salesCsv(rows), 'sales_by_sku', {currency: 'USD'});
  assert.equal(p.errors.length, MAX_REPORTED_ERRORS); assert.equal(p.errors_truncated, true); assert.equal(p.rows.rejected, MAX_REPORTED_ERRORS + 25); assert.equal(p.can_register, false); assert.equal(p.blocker, 'no_valid_rows');
});

test('pedidos de marketplace: importe de linea = precio unitario × cantidad en enteros', () => {
  const p = run(ordersCsv(), 'marketplace_orders');
  assert.equal(p.rows.accepted, 2); assert.equal(p.aggregates.amounts[0].amount_minor, '4450'); assert.equal(p.aggregates.distinct_orders, 2);
  assert.equal(p.aggregates.amount_kind, 'gross_order_line');
  const big = run(ordersCsv([['SYN-O-9', '2026-09-10', 'SYN-A', '999999', '9999999999999.99', 'USD', 'amazon']]), 'marketplace_orders');
  assert.equal(big.aggregates.amounts[0].amount_minor, (999999n * 999999999999999n).toString());
  assert.equal(run(ordersCsv([['SYN-O-1', '2026-09-10', 'SYN-A', '', '1.00', 'USD', '']]), 'marketplace_orders').rows.rejected, 1);
});

test('devoluciones: reembolso opcional, estado pendiente sin importe no se inventa en cero', () => {
  const p = run(returnsCsv(), 'marketplace_returns', {currency: 'USD'});
  assert.equal(p.rows.accepted, 2); assert.equal(p.aggregates.amounts[0].amount_minor, '1250'); assert.equal(p.aggregates.amounts[0].rows, 1);
  assert.equal(p.aggregates.amount_missing, 1); assert.equal(p.aggregates.amount_kind, 'refund_amount');
});

test('resenas: calificacion 1 a 5, histograma y texto largo rechazado', () => {
  const p = run(reviewsCsv(), 'reviews');
  assert.equal(p.rows.accepted, 3); assert.deepEqual(p.aggregates.rating_histogram, {1: 0, 2: 1, 3: 0, 4: 1, 5: 1}); assert.equal(p.aggregates.amounts.length, 0); assert.equal(p.aggregates.amount_kind, null);
  const bad = run(reviewsCsv([['SYN-V1', '2026-09-15', '6', 'SYN-A', 'x'], ['SYN-V2', '2026-09-15', '0', 'SYN-A', 'x'], ['SYN-V3', '2026-09-15', '3.5', 'SYN-A', 'x'], ['SYN-V4', '2026-09-15', '3', 'SYN-A', 'y'.repeat(2001)]]), 'reviews');
  assert.equal(bad.rows.rejected, 4); assert.deepEqual(Object.keys(codes(bad)).sort(), ['NUMBER_OUT_OF_RANGE:rating', 'INVALID_NUMBER:rating', 'TEXT_TOO_LONG:text'].sort());
});

test('Speedship: seguimiento repetido con otras referencias es valido (multibulto); fila identica es duplicado; direccion nunca sale', () => {
  const p = run(speedshipCsv(), 'speedship_shipments', {currency: 'USD'});
  assert.deepEqual(p.rows, {read: 3, accepted: 3, rejected: 0, duplicates: 0}); assert.equal(p.aggregates.amounts[0].amount_minor, '2300'); assert.equal(p.aggregates.amount_kind, 'quoted_shipping_cost');
  assert.equal(p.aggregates.date_field, 'created'); assert.ok(p.headers.ignored.includes('Receiver Address Line1')); assert.ok(p.headers.ignored.includes('Destination Company Name'));
  const rows = [['D', 'UPS', '2026-09-01', 'SYN-T', 'Ground', '1.00', '2026-09-01', 'R1', 'R2', '1', 'a'], ['D', 'UPS', '2026-09-01', 'SYN-T', 'Ground', '1.00', '2026-09-01', 'R1', 'R2', '1', 'a']];
  assert.deepEqual(run(speedshipCsv(rows), 'speedship_shipments', {currency: 'USD'}).rows, {read: 2, accepted: 1, rejected: 0, duplicates: 1});
  assert.equal(run(speedshipCsv(), 'speedship_shipments').blocker, 'currency_required');
});

test('formatos de fecha: slash exige formato declarado; dmy y mdy distinguen; serial solo en XLSX', () => {
  const us = salesCsv([['SYN-A', '03/04/2026', '1', '1.00']]);
  assert.equal(run(us, 'sales_by_sku', {currency: 'USD'}).rows.rejected, 1);
  assert.equal(run(us, 'sales_by_sku', {currency: 'USD', dateFormat: 'mdy'}).aggregates.date_max, '2026-03-04T00:00:00.000Z');
  assert.equal(run(us, 'sales_by_sku', {currency: 'USD', dateFormat: 'dmy'}).aggregates.date_max, '2026-04-03T00:00:00.000Z');
  assert.equal(run(salesCsv([['SYN-A', '2026-09', '1', '1.00']]), 'sales_by_sku', {currency: 'USD'}).aggregates.date_max, '2026-09-01T00:00:00.000Z');
  assert.equal(codes(run(salesCsv([['SYN-A', '46025.45', '1', '1.00']]), 'sales_by_sku', {currency: 'USD'}))['UNSUPPORTED_EXCEL_DATE:date'], 1);
  assert.equal(excelSerialToIso('46025.45'), '2026-01-03T10:48:00.000Z'); assert.equal(excelSerialToIso('2026-01-03'), null); assert.equal(excelSerialToIso('99999999'), null);
  assert.equal(run(salesCsv([['SYN-A', '1999-12-31', '1', '1.00']]), 'sales_by_sku', {currency: 'USD'}).rows.rejected, 1);
  assert.throws(() => run(us, 'sales_by_sku', {currency: 'USD', dateFormat: 'xx'}), {code: 'DATE_FORMAT_REQUIRED'});
});

test('XLSX: serial de fecha, hoja unica, celdas dispersas, y varias hojas exigen elegir', () => {
  const rows = [['SKU', 'Date', 'Units Sold', 'Gross Sales', 'Currency'], ['SYN-A', 46025.45, 3, '45.50', 'USD'], ['SYN-B', 46026, 1, 10, null]];
  const p = previewMemberFile(xlsx(rows), {kind: 'sales_by_sku', contentType: XLSX, observedAt: NOW, currency: 'USD'});
  assert.deepEqual(p.rows, {read: 2, accepted: 2, rejected: 0, duplicates: 0}); assert.equal(p.sheet, 'Hoja1'); assert.equal(p.aggregates.amounts[0].amount_minor, '5550'); assert.equal(p.aggregates.date_max, '2026-01-04T00:00:00.000Z');
  const sparse = previewMemberFile(xlsx([['SKU', 'Date', 'Units Sold', 'Gross Sales'], ['SYN-A', 46025, 3]]), {kind: 'sales_by_sku', contentType: XLSX, observedAt: NOW, currency: 'USD'});
  assert.equal(codes(sparse)['MISSING_VALUE:amount'], 1);
  assert.throws(() => previewMemberFile(xlsx(rows), {kind: 'sales_by_sku', contentType: XLSX, observedAt: NOW, sheet: 'NoExiste'}), {code: 'SHEET_NOT_FOUND'});
});

test('errores fatales: tipo desconocido, contenido no soportado, bytes no UTF-8, exceso de filas', () => {
  assert.throws(() => run(salesCsv(), 'otro'), {code: 'UNKNOWN_KIND'});
  assert.throws(() => run(salesCsv(), '__proto__'), {code: 'UNKNOWN_KIND'});
  assert.throws(() => previewMemberFile(salesCsv(), {kind: 'sales_by_sku', contentType: 'text/tab-separated-values', observedAt: NOW}), {code: 'UNSUPPORTED_CONTENT_TYPE'});
  assert.throws(() => run(Uint8Array.from([0x53, 0x4b, 0x55, 0x0a, 0xe9, 0x0a]), 'sales_by_sku', {currency: 'USD'}));
  const many = salesCsv(Array.from({length: 50001}, (_, i) => [`S${i}`, '2026-09-01', '1', '1.00']));
  assert.throws(() => run(many, 'sales_by_sku', {currency: 'USD'}));
});

test('procedencia: solo si hay filas validas; guarda hash, corte, mapa de encabezados y no valores', () => {
  const p = run(salesCsv(), 'sales_by_sku', {currency: 'USD'});
  const sha = 'a'.repeat(64);
  const prov = memberFileProvenance(p, {fileSha256: sha, size: 123, registeredBy: '22222222-2222-4222-8222-222222222222', registeredAt: NOW});
  assert.equal(prov.cut, '2026-10-05T00:00:00.000Z'); assert.equal(prov.file_sha256, sha); assert.equal(prov.applied, false); assert.equal(prov.header_map.sku, 'SKU'); assert.equal(prov.kind, 'sales_by_sku');
  assert.ok(!JSON.stringify(prov).includes('SYN-A'));
  assert.throws(() => memberFileProvenance(p, {fileSha256: 'zz', size: 1, registeredBy: 'x'}), {code: 'INVALID_HASH'});
  const none = run(salesCsv([['', '', '', '']]), 'sales_by_sku', {currency: 'USD'});
  assert.throws(() => memberFileProvenance(none, {fileSha256: sha, size: 1, registeredBy: 'x'}), {code: 'NOT_REGISTERABLE'});
});
