// Cargador de archivos de miembros (F4, 29-oct): valida CSV/XLSX de ventas por SKU, resenas, Speedship y marketplaces SIN escribir en ninguna tabla de datos.
// Reutiliza los parsers acotados (inspectImport/parseCSV/parseXLSX), la fecha con zona (normalizeDate) y el dinero entero (parseMoney) de packages/ingestion.
// Salida = solo conteos, motivos con linea/campo/codigo y agregados; nunca devuelve valores de celda (sin PII en la respuesta ni en los logs).
import {createHash} from 'node:crypto';
import {IngestionError, parseMoney} from './index.mjs';
import {inspectImport, normalizeDate} from './mapping.mjs';

export const MEMBER_FILE_PARSER = 'member-file-v1';
export const MEMBER_FILE_KINDS = Object.freeze(['sales_by_sku', 'marketplace_orders', 'marketplace_returns', 'reviews', 'speedship_shipments']);
export const MAX_REPORTED_ERRORS = 100;
const CSV = 'text/csv';
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const MIN_YEAR = 2000;
const MAX_TEXT = 2000;
const MAX_CELL_KEY = 200;

const fail = (code, field = null) => { throw new IngestionError(code, field); };

/** Normaliza un encabezado: sin acentos, minusculas, solo letras y digitos separados por un espacio. */
export const normalizeHeader = h => String(h ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// Definicion de columnas por tipo. `aliases` ya van en forma normalizada de lectura humana (se normalizan al cargar). ES e EN.
// type: key (texto corto de identidad), text (libre, no se devuelve), date, int, money, rating, currency, label (texto corto no identificador).
const C = (key, type, aliases, extra = {}) => ({key, type, aliases, ...extra});
const KINDS = {
  sales_by_sku: {
    label: 'sales_by_sku',
    columns: [
      C('sku', 'key', ['sku', 'merchant sku', 'seller sku', 'lineitem sku', 'item sku', 'product sku', 'sku del producto', 'codigo']),
      C('date', 'date', ['date', 'fecha', 'order date', 'sale date', 'fecha de venta', 'period', 'periodo', 'month', 'mes']),
      C('quantity', 'int', ['quantity', 'qty', 'units', 'units sold', 'unidades', 'unidades vendidas', 'cantidad']),
      C('amount', 'money', ['gross sales', 'gross revenue', 'ventas brutas', 'ingreso bruto', 'amount', 'importe', 'revenue', 'total sales', 'ventas']),
      C('currency', 'currency', ['currency', 'moneda'], {optional: true}),
      C('channel', 'label', ['channel', 'canal', 'marketplace', 'sales channel'], {optional: true}),
    ],
    required: ['sku', 'date', 'quantity', 'amount'],
    amountKind: 'gross_sales',
    skuKey: 'sku',
  },
  marketplace_orders: {
    label: 'marketplace_orders',
    columns: [
      C('order_id', 'key', ['order id', 'order number', 'order', 'pedido', 'numero de pedido', 'name', 'amazon order id']),
      C('date', 'date', ['order date', 'purchase date', 'created at', 'fecha del pedido', 'fecha de compra', 'fecha', 'date']),
      C('sku', 'key', ['sku', 'merchant sku', 'seller sku', 'lineitem sku', 'item sku']),
      C('quantity', 'int', ['quantity', 'lineitem quantity', 'qty', 'cantidad', 'unidades']),
      C('line_price', 'money', ['line price', 'item price', 'line total', 'importe de linea', 'precio de linea', 'total line price'], {group: 'amount'}),
      C('unit_price', 'money', ['unit price', 'lineitem price', 'precio unitario'], {group: 'amount'}),
      C('currency', 'currency', ['currency', 'moneda'], {optional: true}),
      C('marketplace', 'label', ['marketplace', 'channel', 'canal', 'sales channel'], {optional: true}),
      C('status', 'label', ['order status', 'status', 'estado', 'financial status'], {optional: true}),
    ],
    required: ['order_id', 'date', 'sku', 'quantity'],
    amountGroup: 'amount',
    amountKind: 'gross_order_line',
    skuKey: 'sku',
    orderKey: 'order_id',
  },
  marketplace_returns: {
    label: 'marketplace_returns',
    columns: [
      C('order_id', 'key', ['order id', 'order number', 'order', 'pedido', 'numero de pedido', 'name', 'amazon order id']),
      C('date', 'date', ['return request date', 'return date', 'fecha de devolucion', 'fecha de solicitud', 'refund date', 'date', 'fecha']),
      C('sku', 'key', ['merchant sku', 'sku', 'seller sku', 'lineitem sku']),
      C('quantity', 'int', ['return quantity', 'refunded quantity', 'quantity', 'cantidad devuelta', 'cantidad'], {optional: true}),
      C('reason', 'label', ['return reason', 'return reason code', 'reason', 'motivo', 'motivo de devolucion'], {optional: true}),
      C('refund_amount', 'money', ['refunded amount', 'refund amount', 'importe reembolsado', 'monto reembolsado'], {optional: true}),
      C('currency', 'currency', ['currency', 'moneda'], {optional: true}),
      C('return_id', 'key', ['amazon rma id', 'return id', 'rma id', 'id de devolucion'], {optional: true}),
      C('status', 'label', ['return request status', 'return status', 'status', 'estado'], {optional: true}),
    ],
    required: ['order_id', 'date', 'sku'],
    amountField: 'refund_amount',
    amountKind: 'refund_amount',
    skuKey: 'sku',
    orderKey: 'order_id',
  },
  reviews: {
    label: 'reviews',
    columns: [
      C('date', 'date', ['review date', 'reviewed at', 'date', 'fecha', 'fecha de la resena', 'created at']),
      C('rating', 'rating', ['rating', 'star rating', 'stars', 'estrellas', 'calificacion', 'puntuacion']),
      C('sku', 'key', ['sku', 'asin', 'product id', 'producto', 'merchant sku']),
      C('text', 'text', ['review', 'review text', 'review body', 'text', 'texto', 'comentario', 'body', 'content', 'resena'], {optional: true}),
      C('review_id', 'key', ['review id', 'id de resena', 'id'], {optional: true}),
      C('channel', 'label', ['channel', 'canal', 'marketplace'], {optional: true}),
    ],
    required: ['date', 'rating', 'sku'],
    skuKey: 'sku',
  },
  speedship_shipments: {
    label: 'speedship_shipments',
    columns: [
      C('tracking', 'key', ['pro tracking', 'tracking', 'tracking number', 'tracking id', 'numero de seguimiento', 'pro']),
      C('created', 'date', ['created date', 'fecha de creacion', 'label date', 'created at']),
      C('carrier', 'label', ['carrier', 'transportista']),
      C('ship_date', 'date', ['ship date', 'fecha de envio'], {optional: true}),
      C('quoted_amount', 'money', ['quoted amount', 'costo cotizado', 'monto cotizado'], {optional: true}),
      C('service_level', 'label', ['service level', 'nivel de servicio'], {optional: true}),
      C('reference_1', 'key', ['reference 1', 'reference1', 'referencia 1'], {optional: true}),
      C('reference_2', 'key', ['reference 2', 'reference2', 'referencia 2'], {optional: true}),
      C('receiver_zip', 'label', ['receiver zip', 'codigo postal destino', 'destination zip'], {optional: true}),
    ],
    required: ['tracking', 'created', 'carrier'],
    amountField: 'quoted_amount',
    amountKind: 'quoted_shipping_cost',
    dateField: 'created',
  },
};
for (const k of Object.values(KINDS)) for (const c of k.columns) c.aliases = c.aliases.map(normalizeHeader);

export const memberFileKindInfo = kind => {
  const spec = KINDS[kind];
  if (!spec) return null;
  return {kind, required: [...spec.required], optional: spec.columns.filter(c => !spec.required.includes(c.key) && c.group === undefined).map(c => c.key), amount_group: spec.amountGroup ?? null, columns: spec.columns.map(c => ({key: c.key, type: c.type, aliases: [...c.aliases], required: spec.required.includes(c.key)}))};
};

/** Numero de serie de Excel (sistema 1900, con el error del 29-feb-1900) a ISO UTC; null si no es un serial razonable. */
export function excelSerialToIso(value) {
  if (!/^\d{1,6}(?:\.\d+)?$/.test(value)) return null;
  const serial = Number(value);
  if (!(serial >= 1 && serial < 80000)) return null;
  const ms = Math.round((serial - 25569) * 86400000);
  const date = new Date(ms);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function resolveHeaders(spec, headers) {
  const normalized = headers.map(normalizeHeader);
  const map = {}, ambiguous = [], used = new Set();
  for (const col of spec.columns) {
    // coincidencia por orden de prioridad del alias; dos encabezados distintos del archivo para el mismo campo = ambiguo
    const hits = new Set();
    for (const alias of col.aliases) normalized.forEach((n, i) => { if (n === alias) hits.add(i); });
    if (hits.size > 1) ambiguous.push(col.key);
    if (hits.size >= 1) { const index = Math.min(...hits); map[col.key] = index; used.add(index); }
  }
  const missing = spec.required.filter(k => map[k] === undefined);
  if (spec.amountGroup) {
    const group = spec.columns.filter(c => c.group === spec.amountGroup).map(c => c.key);
    if (!group.some(k => map[k] !== undefined)) missing.push(group.join('|'));
  }
  const recognized = Object.fromEntries(Object.entries(map).map(([k, i]) => [k, headers[i]]));
  const ignored = headers.filter((_, i) => !used.has(i));
  return {map, missing, ambiguous, recognized, ignored};
}

const trim = v => (v ?? '').trim();
const clean = v => { const s = trim(v); return /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(s) ? fail('INVALID_CHARACTERS') : s; };

function dateOf(raw, field, ctx) {
  const v = trim(raw);
  if (!v) fail('MISSING_VALUE', field);
  let iso = null;
  if (ctx.contentType === XLSX) iso = excelSerialToIso(v);
  const candidate = iso ?? (/^\d{4}-\d{2}$/.test(v) ? `${v}-01` : v);
  const out = iso ?? (() => { try { return normalizeDate(candidate, ctx.timezone, ctx.dateFormat); } catch (e) { if (e instanceof IngestionError) fail(e.code === 'UNSUPPORTED_EXCEL_DATE' ? 'UNSUPPORTED_EXCEL_DATE' : e.code === 'INVALID_CALENDAR' ? 'INVALID_DATE' : e.code, field); throw e; } })();
  if (!out) fail('INVALID_DATE', field);
  if (new Date(out).getUTCFullYear() < MIN_YEAR) fail('DATE_OUT_OF_RANGE', field);
  if (Date.parse(out) > ctx.now + 86400000) fail('FUTURE_DATE', field);
  return out;
}

function intOf(raw, field, {min = 0, max = 1_000_000, optional = false} = {}) {
  const v = trim(raw);
  if (!v) { if (optional) return null; fail('MISSING_VALUE', field); }
  const plain = /^\d+(?:\.0+)?$/.test(v) ? v.replace(/\.0+$/, '') : null; // XLSX entrega 3 o 3.0 como lexema
  if (plain === null) fail('INVALID_NUMBER', field);
  const n = Number(plain);
  if (!Number.isSafeInteger(n) || n < min || n > max) fail('NUMBER_OUT_OF_RANGE', field);
  return n;
}

function moneyOf(raw, field, currency, {optional = false} = {}) {
  const v = trim(raw);
  if (!v) { if (optional) return null; fail('MISSING_VALUE', field); }
  if (!currency) fail('CURRENCY_REQUIRED', 'currency');
  if (/^-/.test(v)) fail('NEGATIVE_AMOUNT', field);
  let money;
  try { money = parseMoney(v, currency); } catch (e) { if (e instanceof IngestionError) fail(e.code === 'INVALID_CURRENCY' ? 'INVALID_CURRENCY' : 'INVALID_MONEY', e.code === 'INVALID_CURRENCY' ? 'currency' : field); throw e; }
  return money;
}

const keyOf = (raw, field, optional = false) => {
  const v = clean(raw);
  if (!v) { if (optional) return null; fail('MISSING_VALUE', field); }
  if ([...v].length > MAX_CELL_KEY) fail('VALUE_TOO_LONG', field);
  return v;
};

function evaluateRow(spec, kindId, values, map, ctx) {
  const cell = key => (map[key] === undefined ? '' : values[map[key]] ?? '');
  const column = key => spec.columns.find(c => c.key === key);
  const optionalKey = key => column(key)?.optional === true;
  const out = {};
  let currency = ctx.currency;
  if (map.currency !== undefined) {
    const c = trim(cell('currency')).toUpperCase();
    if (c) { try { parseMoney('0', c); } catch (e) { if (e instanceof IngestionError) fail('INVALID_CURRENCY', 'currency'); throw e; } currency = c; }
    else if (!currency) fail('CURRENCY_REQUIRED', 'currency');
  }
  for (const col of spec.columns) {
    if (map[col.key] === undefined) continue;
    const raw = cell(col.key), optional = optionalKey(col.key) || col.group !== undefined;
    switch (col.type) {
      case 'key': out[col.key] = keyOf(raw, col.key, optional); break;
      case 'label': { const v = clean(raw); if (!v && !optional) fail('MISSING_VALUE', col.key); out[col.key] = [...v].length > MAX_CELL_KEY ? fail('VALUE_TOO_LONG', col.key) : v || null; break; }
      case 'text': { const v = trim(raw); if ([...v].length > MAX_TEXT) fail('TEXT_TOO_LONG', col.key); if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v)) fail('INVALID_CHARACTERS', col.key); out[col.key] = v; break; }
      case 'date': out[col.key] = trim(raw) ? dateOf(raw, col.key, ctx) : optional ? null : fail('MISSING_VALUE', col.key); break;
      case 'int': out[col.key] = intOf(raw, col.key, {optional}); break;
      case 'rating': out[col.key] = intOf(raw, col.key, {min: 1, max: 5}); break;
      case 'money': out[col.key] = moneyOf(raw, col.key, currency, {optional: true}); break;
      case 'currency': break;
      default: fail('INTERNAL_KIND');
    }
  }
  // columnas requeridas ausentes de la fila (celda vacia) ya fallaron arriba; el grupo de importe se resuelve aqui
  let amount = null;
  if (spec.amountGroup) {
    const line = out.line_price, unit = out.unit_price;
    if (line) amount = line;
    else if (unit) {
      const qty = BigInt(out.quantity);
      amount = {amount_minor: (BigInt(unit.amount_minor) * qty).toString(), currency: unit.currency, exponent: unit.exponent};
    } else fail('MISSING_VALUE', 'line_price');
  } else if (spec.amountField) amount = out[spec.amountField] ?? null;
  else if (out.amount) amount = out.amount;
  if (kindId === 'sales_by_sku' && !out.amount) fail('MISSING_VALUE', 'amount');
  return {fields: out, amount, currency};
}

const rowHash = (headers, values) => createHash('sha256').update(JSON.stringify(headers.map((_, i) => values[i] ?? ''))).digest('hex');

/**
 * Valida un archivo de miembro contra un tipo declarado. No escribe ni devuelve valores de celdas.
 * options: {kind, contentType, sheet?, timezone='UTC', dateFormat='iso', currency?, observedAt?}
 * Errores fatales (archivo ilegible, tipo desconocido, demasiadas filas) se lanzan como IngestionError.
 */
export function previewMemberFile(bytes, options = {}) {
  const {kind, contentType, sheet = null, timezone = 'UTC', dateFormat = 'iso', currency = null, observedAt = new Date().toISOString()} = options;
  const spec = Object.hasOwn(KINDS, kind) ? KINDS[kind] : fail('UNKNOWN_KIND');
  if (![CSV, XLSX].includes(contentType)) fail('UNSUPPORTED_CONTENT_TYPE');
  if (!['iso', 'ymd', 'dmy', 'mdy'].includes(dateFormat)) fail('DATE_FORMAT_REQUIRED', 'date');
  if (currency !== null) { try { parseMoney('0', currency); } catch (e) { if (e instanceof IngestionError) fail('INVALID_CURRENCY', 'currency'); throw e; } }
  const now = Date.parse(observedAt);
  if (!Number.isFinite(now)) fail('INVALID_TIMESTAMP', 'observedAt');
  const parsed = inspectImport(bytes, {contentType, sheet, discover: true});
  const optionsOut = {timezone, date_format: dateFormat, currency};
  if (!parsed.headers.length && parsed.sheets.length > 1) {
    // varias hojas y ninguna elegida: se devuelven los nombres de hoja para que el miembro elija; no se evalua nada
    return {parser: MEMBER_FILE_PARSER, kind, content_type: contentType, sheet: null, sheets: parsed.sheets, options: optionsOut,
      headers: {total: 0, recognized: {}, ignored: [], ignored_count: 0, missing_required: [], ambiguous: []}, headers_ok: false,
      rows: {read: 0, accepted: 0, rejected: 0, duplicates: 0}, reasons: [], errors: [], errors_truncated: false, aggregates: null, can_register: false, blocker: 'sheet_required'};
  }
  const headerInfo = resolveHeaders(spec, parsed.headers);
  const errors = [], reasons = {};
  const addReason = (code, field, line) => {
    const key = `${code}:${field ?? ''}`;
    reasons[key] ??= {code, field, count: 0, first_line: line};
    reasons[key].count++;
  };
  const report = (line, field, code) => { addReason(code, field, line); if (errors.length < MAX_REPORTED_ERRORS) errors.push({line, field, code}); };
  const base = {
    parser: MEMBER_FILE_PARSER, kind, content_type: contentType, sheet: parsed.sheets.length ? (sheet ?? parsed.sheets[0]) : null, sheets: parsed.sheets,
    options: optionsOut,
    headers: {total: parsed.headers.length, recognized: headerInfo.recognized, ignored: headerInfo.ignored.slice(0, 100), ignored_count: headerInfo.ignored.length, missing_required: headerInfo.missing, ambiguous: headerInfo.ambiguous},
    headers_ok: headerInfo.missing.length === 0 && headerInfo.ambiguous.length === 0,
  };
  const total = parsed.rows.length + parsed.errors.length;
  if (!base.headers_ok) {
    return {...base, rows: {read: total, accepted: 0, rejected: 0, duplicates: 0}, reasons: [], errors: [], errors_truncated: false, aggregates: null, can_register: false, blocker: 'headers'};
  }
  const needsCurrency = spec.columns.some(c => c.type === 'money' && headerInfo.map[c.key] !== undefined) && headerInfo.map.currency === undefined && !currency;
  if (needsCurrency) {
    return {...base, rows: {read: total, accepted: 0, rejected: 0, duplicates: 0}, reasons: [], errors: [], errors_truncated: false, aggregates: null, can_register: false, blocker: 'currency_required'};
  }
  const parseErrors = new Map(parsed.errors.map(e => [e.line, e]));
  const ctx = {contentType, timezone, dateFormat, currency, now};
  const seen = new Set(), skus = new Set(), orders = new Set();
  const sums = new Map(), ratings = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0};
  const dateField = spec.dateField ?? 'date';
  let accepted = 0, duplicates = 0, minDate = null, maxDate = null, quantity = 0, amountRows = 0, amountMissing = 0;
  const rejectedLines = new Set();
  // las filas con error de sintaxis del parser vienen aparte; se cuentan como rechazadas con su codigo
  for (const e of parsed.errors) { rejectedLines.add(e.line); report(e.line, e.field ?? null, e.code); }
  for (const row of parsed.rows) {
    if (parseErrors.has(row.line)) continue;
    let values = row.values;
    try {
      if (values.length !== parsed.headers.length) {
        if (contentType === XLSX && values.length < parsed.headers.length) values = [...values, ...Array(parsed.headers.length - values.length).fill(null)];
        else fail('COLUMN_COUNT');
      }
      const result = evaluateRow(spec, kind, values, headerInfo.map, ctx);
      const hash = rowHash(parsed.headers, values);
      if (seen.has(hash)) { duplicates++; report(row.line, null, 'DUPLICATE_ROW'); continue; }
      seen.add(hash);
      accepted++;
      const f = result.fields;
      const at = f[dateField] ?? null;
      if (at) { if (!minDate || at < minDate) minDate = at; if (!maxDate || at > maxDate) maxDate = at; }
      if (spec.skuKey && f[spec.skuKey]) skus.add(f[spec.skuKey]);
      if (spec.orderKey && f[spec.orderKey]) orders.add(f[spec.orderKey]);
      if (typeof f.quantity === 'number') quantity += f.quantity;
      if (kind === 'reviews') ratings[f.rating]++;
      if (result.amount) {
        amountRows++;
        const cur = result.amount.currency, acc = sums.get(cur) ?? {currency: cur, exponent: result.amount.exponent, amount_minor: 0n, rows: 0};
        acc.amount_minor += BigInt(result.amount.amount_minor); acc.rows++; sums.set(cur, acc);
      } else if (spec.amountField || spec.amountGroup || kind === 'sales_by_sku') amountMissing++;
    } catch (e) {
      if (!(e instanceof IngestionError)) throw e;
      rejectedLines.add(row.line); report(row.line, e.field, e.code);
    }
  }
  const rejected = rejectedLines.size;
  const aggregates = {
    date_field: dateField, date_min: minDate, date_max: maxDate,
    distinct_skus: spec.skuKey ? skus.size : null, distinct_orders: spec.orderKey ? orders.size : null,
    quantity_total: ['sales_by_sku', 'marketplace_orders', 'marketplace_returns'].includes(kind) ? quantity : null,
    amount_kind: spec.amountKind ?? null, amount_label: spec.amountKind ? 'Observada' : null,
    amount_rows: amountRows, amount_missing: amountMissing,
    amounts: [...sums.values()].map(s => ({currency: s.currency, exponent: s.exponent, amount_minor: s.amount_minor.toString(), rows: s.rows})),
    rating_histogram: kind === 'reviews' ? ratings : null,
  };
  return {
    ...base, rows: {read: accepted + rejected + duplicates, accepted, rejected, duplicates}, reasons: Object.values(reasons).sort((a, b) => b.count - a.count),
    errors, errors_truncated: rejected + duplicates > errors.length, aggregates, can_register: accepted > 0, blocker: accepted > 0 ? null : 'no_valid_rows',
  };
}

/** Registro de procedencia y corte que se guarda en imports.provenance.member_file. El corte es el dato mas reciente observado en el archivo. */
export function memberFileProvenance(preview, {fileSha256, size, registeredBy, registeredAt = new Date().toISOString()}) {
  if (!preview?.can_register) fail('NOT_REGISTERABLE');
  if (!/^[0-9a-f]{64}$/.test(fileSha256 ?? '')) fail('INVALID_HASH');
  return {
    parser: preview.parser, kind: preview.kind, content_type: preview.content_type, sheet: preview.sheet, file_sha256: fileSha256, size,
    options: preview.options, header_map: preview.headers.recognized, rows: preview.rows, reasons: preview.reasons.slice(0, 20).map(({code, field, count}) => ({code, field, count})),
    date_min: preview.aggregates.date_min, cut: preview.aggregates.date_max, aggregates: preview.aggregates,
    registered_by: registeredBy, registered_at: registeredAt, applied: false,
  };
}
