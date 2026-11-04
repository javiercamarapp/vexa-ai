// Importador de DEVOLUCIONES de marketplace (Amazon, Walmart) a public.order_returns (migración 20261211000000).
// Privacidad mínima: solo se conserva retailer, llave de la devolución (id/RMA + línea), pedido normalizado, motivo y estado categóricos, fechas,
// id de artículo del marketplace, cantidad, si hubo tracking de retorno (booleano: el número NUNCA sale del parser) y canal categórico.
// Se IGNORAN por nombre de columna: nombre, correo, dirección, comentarios libres, nombre del producto, SKU, importes. El esquema se detecta por NOMBRE de columna
// (los archivos reales traen entre 23 y 36 columnas en versiones distintas), nunca por posición, por carpeta ni por nombre de archivo.
// Los límites y juegos de caracteres son los mismos CHECK de la tabla: lo que no cabe en un campo obligatorio se rechaza por fila con código;
// lo que no cabe en uno opcional se descarta (null) y se cuenta en `warnings`, nunca se trunca texto libre.
import {createHash} from 'node:crypto';
import {normalizeOrderId} from './order-id.mjs';
import {stripControls} from './speedship.mjs';
import {parseCSV} from '../csv.mjs';
import {parseXLSX} from '../xlsx.mjs';

export const RETURN_LIMITS = Object.freeze({returnKey: 80, reason: 80, status: 40, itemRef: 40, channel: 40, qtyMax: 100000, batch: 250});
// = CHECK de order_returns (paridad SQL-JS)
export const RETURN_KEY_RE = /^[A-Za-z0-9._|-]+$/, ITEM_REF_RE = /^[A-Za-z0-9._-]+$/, REASON_RE = /^[A-Za-z0-9 _:./()',&+-]+$/, STATUS_RE = /^[A-Za-z0-9 _:./()-]+$/, CHANNEL_RE = STATUS_RE;
export const RETURN_RETAILERS = Object.freeze(['amazon', 'walmart']);

const SCHEMAS = {
  amazon: {order: ['order id'], requested: ['return request date'], rma: ['amazon rma id'], line: ['order item id'], status: ['return request status'], reason: ['return reason'], item: ['asin'], qty: ['return quantity'], tracking: ['tracking id'], channel: ['return type']},
  walmart: {order: ['customer_order_no'], requested: ['request_date'], rma: ['rma_no'], line: ['return_order_line_no'], status: ['current_status'], statusAt: ['current_status_time'], reason: ['return_reason'], item: ['item_id'], qty: ['quantity'], tracking: ['tracking_number'], channel: ['channel']},
};
const REQUIRED = ['order', 'requested', 'rma'];
const norm = h => String(h ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
const NO_TRACKING = new Set(['', 'NA', 'N/A', 'NONE', 'NULL', '-', '0', 'NAN']);
const MONTHS = {jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12};

const txt = v => stripControls(v).normalize('NFKC').replace(/\s+/g, ' ').trim();
/** Identificador numérico/alfanumérico: «1.0» -> «1»; notación científica solo si el resultado es entero seguro (si no, queda con «+» y falla el juego de caracteres). */
export function cleanId(v) {
  let s = txt(v);
  if (/^\d(?:\.\d{1,15})?E\+?\d{1,3}$/i.test(s)) { const n = Number(s); if (Number.isSafeInteger(n)) s = String(n); }
  return s.replace(/^(\d+)\.0+$/, '$1');
}
function ymd(y, m, d) { const t = new Date(Date.UTC(y, m - 1, d)); return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d ? t.toISOString().slice(0, 10) : null; }
/** Fecha UTC válida (YYYY-MM-DD) en 2000..2100, o null. Acepta serie Excel, ISO (con hora), dd-Mon-aaaa y m/d/aaaa. */
export function parseReturnDate(raw) {
  if (raw === null || raw === undefined) return null;
  const s = txt(raw); if (!s) return null;
  let out = null, m;
  if ((m = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(s))) { const mo = MONTHS[m[2].toLowerCase()]; out = mo ? ymd(+m[3], mo, +m[1]) : null; }
  else if (/^\d{5}(?:\.\d+)?$/.test(s)) { const n = Number(s); out = n > 36526 && n < 80000 ? new Date(Date.UTC(1899, 11, 30) + Math.floor(n) * 864e5).toISOString().slice(0, 10) : null; }
  else if ((m = /^(\d{4})-(\d{2})-(\d{2})(?:$|[T ])/.exec(s))) out = ymd(+m[1], +m[2], +m[3]);
  else if ((m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s))) out = ymd(+m[3], +m[1], +m[2]);
  return out && +out.slice(0, 4) >= 2000 && +out.slice(0, 4) <= 2100 ? out : null;
}
const hasTracking = v => !NO_TRACKING.has(txt(v).toUpperCase());

/** Decodifica bytes de texto: UTF-8 estricto; si no es válido, Windows-1252 (los .tsv de Amazon vienen así). */
export function decodeText(bytes) {
  try { return {text: new TextDecoder('utf-8', {fatal: true}).decode(bytes), encoding: 'utf-8'}; }
  catch { return {text: new TextDecoder('windows-1252').decode(bytes), encoding: 'windows-1252'}; }
}
/** TSV simple: una fila por línea, celdas separadas por tab; las comillas son literales (los .tsv de Amazon no las usan). */
export function parseTSV(text) {
  const t = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n'), lines = t.split('\n');
  while (lines.length && lines.at(-1) === '') lines.pop();
  return lines.map(l => l.split('\t'));
}

/** Lee un archivo de devoluciones: .xlsx (parser endurecido, no se debilita), .csv (UTF-8 o cp1252) o .tsv (cp1252 detectado). Devuelve filas (arreglos). */
export function readReturnRows(bytes, name = '') {
  if (/\.xlsx$/i.test(name)) {
    const sheet = parseXLSX(bytes).sheets[0];
    return sheet.rows.map(r => { const a = []; const n = Math.max(0, ...Object.keys(r.values).map(Number)) + 1; for (let i = 0; i < n; i++) a.push(r.values[i] ?? null); return a; });
  }
  if (/\.tsv$/i.test(name)) return parseTSV(decodeText(bytes).text);
  if (/\.csv$/i.test(name)) return parseCSV(decodeText(bytes).text).rows.map(r => r.values);
  throw new Error('UNSUPPORTED_FILE_TYPE');
}
export const parseReturnsFile = (bytes, name = '') => parseReturns(readReturnRows(bytes, name));

/** Detecta el esquema por nombre de columna. {retailer, idx} o {error, column?}. */
export function detectSchema(headerRow) {
  const header = (headerRow ?? []).map(norm), has = n => header.includes(n);
  const w = has('customer_order_no') && has('rma_no'), a = has('order id') && has('amazon rma id');
  if (w && a) return {error: 'SCHEMA_AMBIGUOUS'};
  const retailer = w ? 'walmart' : a ? 'amazon' : null;
  if (!retailer) return {error: 'SCHEMA_UNRECOGNIZED'};
  const idx = {};
  for (const [k, names] of Object.entries(SCHEMAS[retailer])) idx[k] = header.findIndex(h => names.includes(h));
  for (const k of REQUIRED) if (idx[k] < 0) return {error: 'SCHEMA_COLUMN_MISSING', column: SCHEMAS[retailer][k][0]};
  return {retailer, idx};
}

const cat = (v, re, max) => { const s = txt(v); return s && s.length <= max && re.test(s) ? s : null; };
const DB_KEYS = ['retailer', 'return_key', 'order_key', 'reason', 'status', 'requested_at', 'status_at', 'item_ref', 'qty', 'has_return_tracking', 'channel'];
export const returnRowHash = row => createHash('sha256').update(JSON.stringify(DB_KEYS.map(k => row[k] ?? null))).digest('hex');
/** Fila camelCase -> columnas de la tabla (lo que recibe order_returns_ingest). */
export const returnToSql = x => ({retailer: x.retailer, return_key: x.returnKey, order_key: x.orderKey, reason: x.reason, status: x.status, requested_at: x.requestedAt, status_at: x.statusAt, item_ref: x.itemRef, qty: x.qty, has_return_tracking: x.hasReturnTracking, channel: x.channel, row_hash: x.rowHash});

/**
 * rows: filas ya leídas (la primera es el encabezado). Devuelve {retailer, returns, rejections, duplicates, blank, warnings, schemaError}.
 * Rechazos por fila: RETURN_KEY_MISSING, RETURN_KEY_INVALID, RETURN_KEY_TOO_LONG, DATE_INVALID. Del archivo: EMPTY_FILE, SCHEMA_UNRECOGNIZED, SCHEMA_AMBIGUOUS, SCHEMA_COLUMN_MISSING.
 * Un pedido ausente o no normalizable NO rechaza la devolución: queda con order_key null («sin ID», se cuenta aparte; unknown != zero).
 * `duplicates` cuenta repeticiones dentro del mismo archivo (retailer + llave); el cruce entre archivos lo resuelve dedupeReturns.
 */
export function parseReturns(rows) {
  const out = {retailer: null, returns: [], rejections: [], duplicates: 0, blank: 0, warnings: {}, schemaError: null};
  const warn = k => { out.warnings[k] = (out.warnings[k] ?? 0) + 1; };
  if (!Array.isArray(rows) || rows.length < 2) return {...out, rejections: [{row: 0, code: 'EMPTY_FILE'}], schemaError: 'EMPTY_FILE'};
  const sch = detectSchema(rows[0]);
  if (sch.error) return {...out, rejections: [{row: 1, code: sch.error, ...(sch.column ? {column: sch.column} : {})}], schemaError: sch.error};
  const {retailer, idx} = sch; out.retailer = retailer;
  const L = RETURN_LIMITS, seen = new Map();
  rows.slice(1).forEach((r, i) => {
    const get = k => (idx[k] >= 0 ? r[idx[k]] : null), line = i + 2;
    if (['order', 'rma', 'requested'].every(k => txt(get(k)) === '')) { out.blank++; return; }
    // Llave = RMA|línea. Sin RMA pero con línea (devoluciones de atención al cliente sin RMA): NORMA|línea. Sin ninguna de las dos no hay llave estable: se rechaza.
    const rma = cleanId(get('rma')), ln = cleanId(get('line'));
    if (!rma && !ln) { out.rejections.push({row: line, code: 'RETURN_KEY_MISSING'}); return; }
    const returnKey = `${rma || 'NORMA'}${ln ? `|${ln}` : ''}`;
    if (returnKey.length > L.returnKey) { out.rejections.push({row: line, code: 'RETURN_KEY_TOO_LONG'}); return; }
    if (!RETURN_KEY_RE.test(returnKey)) { out.rejections.push({row: line, code: 'RETURN_KEY_INVALID'}); return; }
    const requestedAt = parseReturnDate(get('requested'));
    if (!requestedAt) { out.rejections.push({row: line, code: 'DATE_INVALID'}); return; }
    const rawOrder = txt(get('order')), orderKey = rawOrder ? normalizeOrderId(rawOrder) : null;
    if (!rawOrder) warn('ORDER_ID_MISSING'); else if (!orderKey) warn('ORDER_ID_INVALID');
    const rawStatusAt = txt(get('statusAt')), statusAt = rawStatusAt ? parseReturnDate(rawStatusAt) : null;
    if (rawStatusAt && !statusAt && !/^(?:NA|N\/A|NONE|NULL|-)$/i.test(rawStatusAt)) warn('STATUS_DATE_INVALID');
    const take = (k, re, max, w) => { const v = txt(get(k)); if (!v) return null; const c = cat(v, re, max); if (!c) warn(w); return c; };
    const status = (() => { const v = txt(get('status')).replace(/\s*:\s*\d+.*$/, ''); if (!v) return null; const c = cat(v, STATUS_RE, L.status); if (!c) warn('STATUS_DROPPED'); return c; })();
    const itemRaw = cleanId(get('item')), itemRef = itemRaw ? (itemRaw.length <= L.itemRef && ITEM_REF_RE.test(itemRaw) ? itemRaw : (warn('ITEM_REF_DROPPED'), null)) : null;
    const q = txt(get('qty')), qn = q ? Number(q) : NaN, qty = Number.isInteger(qn) && qn >= 1 && qn <= L.qtyMax ? qn : null;
    if (q && qty === null) warn('QTY_DROPPED');
    const x = {retailer, returnKey, orderKey, reason: take('reason', REASON_RE, L.reason, 'REASON_DROPPED'), status, requestedAt, statusAt, itemRef, qty,
      hasReturnTracking: hasTracking(get('tracking')), channel: take('channel', CHANNEL_RE, L.channel, 'CHANNEL_DROPPED')};
    x.rowHash = returnRowHash(returnToSql(x));
    if (seen.has(returnKey)) { out.duplicates++; const j = seen.get(returnKey); if (better(x, out.returns[j])) out.returns[j] = x; return; }
    seen.set(returnKey, out.returns.length); out.returns.push(x);
  });
  return out;
}
// Cuál instantánea de la misma devolución se conserva: la de estado más reciente (status_at); a igualdad, la de row_hash mayor (determinista).
const better = (a, b) => (a.statusAt ?? '') > (b.statusAt ?? '') || ((a.statusAt ?? '') === (b.statusAt ?? '') && a.rowHash > b.rowHash);

/** Une los resultados de varios archivos: dedup por retailer + llave de devolución (los archivos se solapan: p. ej. un acumulado ene-may). */
export function dedupeReturns(list) {
  const m = new Map(); let duplicates = 0;
  for (const x of list) { const k = `${x.retailer}\u0000${x.returnKey}`, p = m.get(k); if (!p) m.set(k, x); else { duplicates++; if (better(x, p)) m.set(k, x); } }
  return {returns: [...m.values()], duplicates};
}
export function returnBatches(returns, size = RETURN_LIMITS.batch) {
  if (!Number.isSafeInteger(size) || size < 1 || size > RETURN_LIMITS.batch) throw new Error('INVALID_BATCH_SIZE');
  const b = []; for (let i = 0; i < returns.length; i += size) b.push(returns.slice(i, i + size)); return b;
}
