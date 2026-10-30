// F4: cargador de archivos de miembros. Utilidades puras, cobertura de textos es/en y marcado inicial (sin DOM: renderToStaticMarkup).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import {MemberFileLoader} from '../src/components/member-file-loader';
import {IdiomaLocal} from '../src/components/i18n/proveedor';
import {checkFile,formatMinor,reasonKey,errorKey,fieldKey,dayOf,previewBody,KIND_ORDER,MEMBER_FILE_MAX_BYTES} from '../src/lib/imports/member-file-client';
import {es} from '../src/lib/i18n/es';
import {en} from '../src/lib/i18n/en';
import {memberFileKindInfo,previewMemberFile,MEMBER_FILE_KINDS} from '../../../packages/ingestion/member-files.mjs';
import {salesCsv,ordersCsv,returnsCsv,reviewsCsv,speedshipCsv} from '../../../packages/ingestion/member-files.fixtures.mjs';

test('checkFile: CSV y XLSX hasta 20 MiB; TSV, XLS, vacio y grande se rechazan con motivo propio', () => {
  assert.deepEqual(checkFile('ventas.CSV', 10), {ok: true, type: 'text/csv'});
  assert.deepEqual(checkFile('a.xlsx', MEMBER_FILE_MAX_BYTES), {ok: true, type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  assert.deepEqual(checkFile('a.xlsx', MEMBER_FILE_MAX_BYTES + 1), {ok: false, reason: 'too_large'});
  assert.deepEqual(checkFile('a.csv', 0), {ok: false, reason: 'empty'});
  assert.deepEqual(checkFile('amazon returns.tsv', 5), {ok: false, reason: 'tsv'});
  assert.deepEqual(checkFile('a.xls', 5), {ok: false, reason: 'legacy_xls'});
  assert.deepEqual(checkFile('a.pdf', 5), {ok: false, reason: 'unsupported'});
  assert.equal(MEMBER_FILE_MAX_BYTES, 20971520, 'el mismo tope que la politica de Storage 20261205000300 y la reserva');
});

test('formatMinor: enteros sin flotantes, signo y separador por idioma', () => {
  assert.equal(formatMinor('8575', 2, 'USD', 'en'), '85.75 USD');
  assert.equal(formatMinor('8575', 2, 'MXN', 'es-MX'), '85.75 MXN');
  assert.equal(formatMinor('5', 2, 'USD', 'en'), '0.05 USD');
  assert.equal(formatMinor('0', 0, 'JPY', 'en'), '0 JPY');
  assert.equal(formatMinor('123456789012345678901234567890', 2, 'USD', 'en'), '1,234,567,890,123,456,789,012,345,678.90 USD');
  assert.equal(formatMinor('abc', 2, 'USD', 'en'), '—');
  assert.equal(dayOf('2026-10-05T00:00:00.000Z'), '2026-10-05'); assert.equal(dayOf(null), '—');
});

test('todos los textos cargador.* existen en es y en con las mismas variables, y cubren cada tipo, campo y motivo', () => {
  const claves = Object.keys(es).filter(k => k.startsWith('cargador.'));
  assert.ok(claves.length > 100);
  const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(',');
  for (const k of claves) { assert.ok((en as Record<string, string>)[k], 'falta en en: ' + k); assert.equal(vars((en as Record<string, string>)[k]), vars((es as Record<string, string>)[k]), k); }
  assert.deepEqual([...KIND_ORDER].sort(), [...MEMBER_FILE_KINDS].sort());
  for (const kind of MEMBER_FILE_KINDS) {
    assert.ok(`cargador.tipo.${kind}` in es && `cargador.req.${kind}` in es, kind);
    for (const c of memberFileKindInfo(kind)!.columns) assert.ok(fieldKey(c.key) && fieldKey(c.key)! in es, 'campo sin texto: ' + c.key);
  }
  for (const kind of ['gross_sales', 'gross_order_line', 'refund_amount', 'quoted_shipping_cost']) assert.ok(`cargador.res.importeNota.${kind}` in es, kind);
  assert.equal(fieldKey('no_existe'), null); assert.equal(fieldKey(null), null);
});

test('cada motivo de rechazo que el validador puede emitir tiene texto propio; los fatales tambien', () => {
  const emitted = new Set<string>();
  const run = (bytes: Uint8Array, kind: string, extra = {}) => previewMemberFile(bytes, {kind, contentType: 'text/csv', observedAt: '2026-10-29T12:00:00.000Z', currency: 'USD', ...extra}).reasons.forEach((r: {code: string}) => emitted.add(r.code));
  run(salesCsv([['', '2026-13-45', 'x', '-1'], ['S', '2027-12-31', '1.5', '1.005'], ['S', '1999-01-01', '1', '1'], ['S', '46025', '1', '1'], ['S', '2026-01-01', '1'], ['S', '2026-01-01', '1', '1'], ['S', '2026-01-01', '1', '1']]), 'sales_by_sku');
  run(reviewsCsv([['a', '2026-01-01', '9', 'S', 'x'.repeat(2001)], ['b', '2026-01-01', '1', 'S', 'a\u0001b']]), 'reviews');
  run(salesCsv([['S', '2026-01-01', '1', '1.00']], ['SKU', 'Date', 'Units Sold', 'Gross Sales']), 'sales_by_sku', {currency: 'USD'});
  run(ordersCsv([['O', '2026-01-01', 'S', '1', '1.00', 'XYZ', '']]), 'marketplace_orders', {currency: null});
  run(salesCsv([['S'.repeat(300), '2026-01-01', '1', '1.00']]), 'sales_by_sku');
  run(new TextEncoder().encode('SKU,Date,Units Sold,Gross Sales\n"abc,2026-01-01,1,1.00\n'), 'sales_by_sku');
  assert.ok(emitted.size >= 8, [...emitted].join());
  for (const code of emitted) assert.ok(reasonKey(code), 'motivo sin texto: ' + code);
  assert.equal(reasonKey('CODIGO_INVENTADO'), null);
  assert.equal(reasonKey('__proto__'), null);
  for (const code of ['CSV_ENCODING', 'CSV_LIMIT_ROWS', 'XLSX_LIMIT_ROWS', 'INVALID_HEADER', 'DUPLICATE_OR_EMPTY_HEADER', 'SHEET_NOT_FOUND', 'currency_required', 'member_file_headers_invalid', 'member_file_no_valid_rows', 'member_file_immutable', 'reservation_expired', 'confirmation_conflict', 'object_too_large', 'upload_failed', 'XLSX_MACROS', 'XLSX_TRUNCATED']) {
    const k = errorKey(code); assert.ok(k && k in es && k in en, 'error sin texto: ' + code);
  }
  assert.equal(errorKey('x', 403), 'cargador.err.forbidden'); assert.equal(errorKey('x', 500), null);
});

test('previewBody: solo claves del contrato del servidor, sin hoja ni moneda vacias', () => {
  assert.deepEqual(previewBody({kind: 'reviews', date_format: 'iso'}), {kind: 'reviews', date_format: 'iso', timezone: 'UTC'});
  assert.deepEqual(previewBody({kind: 'sales_by_sku', sheet: 'Ventas', date_format: 'dmy', currency: 'MXN'}), {kind: 'sales_by_sku', sheet: 'Ventas', date_format: 'dmy', timezone: 'UTC', currency: 'MXN'});
});

test('el servidor responde sin un solo valor de celda para los cinco tipos (la UI solo pinta conteos y agregados)', () => {
  const casos: [string, Uint8Array][] = [['sales_by_sku', salesCsv()], ['marketplace_orders', ordersCsv()], ['marketplace_returns', returnsCsv()], ['reviews', reviewsCsv()], ['speedship_shipments', speedshipCsv()]];
  for (const [kind, bytes] of casos) {
    const p = previewMemberFile(bytes, {kind, contentType: 'text/csv', observedAt: '2026-10-29T12:00:00.000Z', currency: 'USD'});
    const text = JSON.stringify(p);
    assert.ok(p.rows.accepted > 0, kind);
    assert.ok(!/SYN-[A-Z0-9]/.test(text.replace(/"(recognized|ignored)":[^}]*\}/g, '')), 'valor de celda en la respuesta: ' + kind);
    assert.ok(!text.includes('CALLE'), kind);
  }
});

const render = (idioma: 'es' | 'en') => renderToStaticMarkup(<IdiomaLocal idioma={idioma}><MemberFileLoader/></IdiomaLocal>);
test('marcado inicial: titulo, aviso de que registrar no aplica, y estado de carga del historial, en es y en en', () => {
  const html = render('es');
  assert.match(html, /Archivos de datos/); assert.match(html, /Registrar no lo aplica todavía/); assert.match(html, /Leyendo los archivos registrados/);
  assert.match(html, /aria-labelledby="member-files-heading"/);
  const english = render('en');
  assert.match(english, /Data files/); assert.match(english, /Recording does not yet apply it/);
  assert.ok(!/<[^>]+ style=/.test(html), 'sin estilos en linea');
});
