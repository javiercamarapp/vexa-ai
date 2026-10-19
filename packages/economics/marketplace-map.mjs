// Mapeo PURO (sin E/S) de los 8 CSV de marketplaces al contrato de entrada de public.economic_batch_import (0051).
// Reglas de negocio de Javier (19-oct) aplicadas aquí:
//  (a) Filas idénticas: con identificador de línea y repetido -> se carga UNA y las demás se RECHAZAN con DUPLICADO_EXACTO
//      (hash de la fila; la fuente no se toca). Sin identificador de línea (los CSV de pedidos no traen ninguno) -> la primera
//      copia entra normal y las copias excedentes se cargan SEPARADAS, marcadas «a revisar» (sufijo en `basis`) y por tanto
//      FUERA de los totales (el adaptador filtra por `basis`).
//  (b) Identidades con más de una moneda (en los datos: moneda conocida + moneda vacía): NO se suman ni convierten; cada
//      línea va en su moneda (vacía -> XXX, importe null) y todas llevan «|multimoneda» en `basis`.
//  (c) No se altera ni fabrica nada: importes desconocidos son null (nunca 0), moneda desconocida es XXX (ISO 4217 «sin moneda»)
//      y estados no mapeados explícitamente quedan `unknown`.
import {createHash} from 'node:crypto';
import {parseCsv} from './csv.mjs';

export const MAX_BATCH = 250;
export const BASIS_ORDER = 'marketplace_line_price';
export const BASIS_REFUND = 'marketplace_refund_amount';
export const SUFFIX = Object.freeze({
  multi: '|multimoneda',
  dup: '|a_revisar:duplicado_exacto_sin_id_linea',
  noReturnId: '|a_revisar:sin_return_id',
  refundedInSource: '|a_revisar:reembolso_en_origen',
});
export const UNKNOWN_CURRENCY = 'XXX';
const EXPONENT = Object.freeze({USD: 2, CAD: 2, MXN: 2});

// SHA-256 y filas verificados por el perfil del 13-oct (identity-currency-profile.json) y por BATCH-IMPORT.
export const MARKETPLACE_FILES = Object.freeze([
  {key: 'amazon-pedidos', rel: 'pedidos/pedidos-amazon.csv', sha256: '3e9d570e3722f28d5132f1b15cb73b1d90df42a819dc0dfdb30acecb89fdc6ba', rows: 60086, kind: 'order', marketplace: 'amazon', label: 'Amazon'},
  {key: 'mirakl-ca-pedidos', rel: 'pedidos/pedidos-mirakl-ca.csv', sha256: '2fe5244a5c10b1136b925ffb96fe83f756ff7870a6a6c4959214fc8b19b41f03', rows: 1684, kind: 'order', marketplace: 'mirakl_bestbuy_ca', label: 'Best Buy CA (Mirakl)'},
  {key: 'mirakl-us-pedidos', rel: 'pedidos/pedidos-mirakl-us.csv', sha256: 'f71ce62026bd6d233a3ed2194a8e2bcb376928c2d4f930620db48b32af3d562f', rows: 2384, kind: 'order', marketplace: 'mirakl_bestbuy_us', label: 'Best Buy US (Mirakl)'},
  {key: 'walmart-pedidos', rel: 'pedidos/pedidos-walmart.csv', sha256: 'de4d46dfe04c0c795139596ebbfd0b2008d53e3494ba107132fe0de9e363d0a1', rows: 17737, kind: 'order', marketplace: 'walmart', label: 'Walmart'},
  {key: 'amazon-devoluciones', rel: 'devoluciones/devoluciones-amazon.csv', sha256: '7923cab4d8fb261e081edde6fb19c6ec79e536e888891813febcc5531c469b46', rows: 3557, kind: 'refund', marketplace: 'amazon', label: 'Amazon'},
  {key: 'mirakl-ca-devoluciones', rel: 'devoluciones/devoluciones-mirakl-ca.csv', sha256: '1b5ea52d4ceea5e2fbf811e422a0e15ecf85ffc3ec4b4ead7118ddf35448b8ac', rows: 0, kind: 'refund', marketplace: 'mirakl_bestbuy_ca', label: 'Best Buy CA (Mirakl)'},
  {key: 'mirakl-us-devoluciones', rel: 'devoluciones/devoluciones-mirakl-us.csv', sha256: '419e58fef98404bb88960e2ac9e1468bba48897f6e6f3b59511e7f22a00ae877', rows: 111, kind: 'refund', marketplace: 'mirakl_bestbuy_us', label: 'Best Buy US (Mirakl)'},
  {key: 'walmart-devoluciones', rel: 'devoluciones/devoluciones-walmart.csv', sha256: 'e21919bb76db2baff9b84837a190791ed47984bfeecd077a49d88209d7f9ed74', rows: 3107, kind: 'refund', marketplace: 'walmart', label: 'Walmart'},
]);

const ORDER_COLUMNS = ['marketplace', 'order_id', 'order_date', 'order_status', 'line_status', 'sku', 'quantity', 'unit_price', 'line_price', 'item_tax', 'shipping_price', 'discount', 'commission', 'currency', 'refund_amount', 'refund_state', 'refund_date', 'refund_reason_code'];
const RETURN_COLUMNS = ['marketplace', 'return_id', 'order_id', 'order_line_id', 'return_date', 'last_modified', 'return_status', 'refund_status', 'delivery_status', 'return_reason_code', 'return_reason_text', 'return_method', 'resolution', 'sku', 'quantity', 'refunded_quantity', 'unit_price', 'line_total', 'total_refund_amount', 'refunded_amount', 'currency', 'refund_covered_by', 'fast_replacement', 'keep_it', 'a_to_z_claim'];

// Mapas de estado EXPLÍCITOS. Todo lo no listado queda `unknown`.
const ORDER_CANCELLED = new Set(['cancelled', 'canceled', 'refused']);
const ORDER_PENDING = new Set(['pending', 'waiting_acceptance']);
const ORDER_RECORDED = new Set(['shipped', 'unshipped', 'delivered', 'acknowledged', 'received', 'shipping', 'closed', 'refunded', 'incident_open']);
const REFUND_STATUS = Object.freeze({REFUND_COMPLETED: 'settled', REFUND_INITIATED: 'pending', CANCELLED: 'cancelled'}); // NOT_REFUNDED / RECHARGE_INITIATED / vacío -> unknown

// ---------- utilidades ----------
const canonical = x => Array.isArray(x) ? '[' + x.map(canonical).join(',') + ']' : x && typeof x === 'object' ? '{' + Object.keys(x).sort().map(k => JSON.stringify(k) + ':' + canonical(x[k])).join(',') + '}' : JSON.stringify(x);
export const sha256hex = s => createHash('sha256').update(s).digest('hex');
export const uuidFromHash = h => h.slice(0, 8) + '-' + h.slice(8, 12) + '-5' + h.slice(13, 16) + '-a' + h.slice(17, 20) + '-' + h.slice(20, 32);
// Igual que stable([...]) de packages/metrics/repository.mjs y economic_batch_entity_id (0051).
export const stable = x => uuidFromHash(sha256hex(canonical(x)));
export const entityId = (tenantId, sourceId, kind, externalId) => stable([tenantId, sourceId, kind, externalId]);
export const sourceIdFor = key => stable(['vexa-economics-source-v1', key]);
export const rowHash = (header, row) => sha256hex(JSON.stringify(header.map(h => [h, row[h]])));

const trim = v => (v ?? '').trim();
const clip = (v, n = 60) => { const s = trim(v); return s.length > n ? s.slice(0, n) + '…' : s; };

// Decimal «12.34» -> minor units string. Devuelve {minor, flag}. Vacío/no canónico/negativo/sub-centavo -> minor null con flag explícito.
export function toMinor(raw, exponent) {
  const v = trim(raw);
  if (v === '') return {minor: null, flag: 'vacio'};
  if (!/^\d+(\.\d+)?$/.test(v)) return {minor: null, flag: /^-/.test(v) ? 'negativo' : 'no_canonico'};
  const [int, frac = ''] = v.split('.');
  const extra = frac.slice(exponent);
  if (/[^0]/.test(extra)) return {minor: null, flag: 'sub_unidad_menor'};
  const minor = (BigInt(int) * 10n ** BigInt(exponent) + BigInt((frac.slice(0, exponent)).padEnd(exponent, '0') || '0')).toString();
  return {minor, flag: null};
}

// Instante UTC estricto. Acepta fecha sola (medianoche UTC), Z, ±hh:mm y milisegundos. null si es imposible.
export function toInstant(raw) {
  const v = trim(raw);
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2})?)?$/.exec(v);
  if (!m) return null;
  const [y, mo, d, h = '0', mi = '0', s = '0', ms = '0', z = 'Z'] = m.slice(1);
  const parts = [+y, +mo, +d, +h, +mi, +s];
  const t = Date.UTC(parts[0], parts[1] - 1, parts[2], parts[3], parts[4], parts[5], +ms.padEnd(3, '0'));
  const check = new Date(t);
  if (check.getUTCFullYear() !== parts[0] || check.getUTCMonth() !== parts[1] - 1 || check.getUTCDate() !== parts[2] || check.getUTCHours() !== parts[3] || check.getUTCMinutes() !== parts[4] || check.getUTCSeconds() !== parts[5]) return null;
  let off = 0;
  if (z !== 'Z') { const sign = z[0] === '-' ? -1 : 1; const [oh, om] = z.slice(1).split(':').map(Number); if (oh > 23 || om > 59) return null; off = sign * (oh * 60 + om) * 60000; }
  const out = new Date(t - off);
  return Number.isFinite(out.getTime()) ? out.toISOString() : null;
}

function orderStatus(row) {
  const parts = [trim(row.order_status).toLowerCase(), trim(row.line_status).toLowerCase()].filter(Boolean);
  if (!parts.length) return 'unknown';
  if (parts.some(p => ORDER_CANCELLED.has(p))) return 'cancelled';
  if (parts.some(p => ORDER_PENDING.has(p))) return 'pending';
  return parts.every(p => ORDER_RECORDED.has(p)) ? 'recorded' : 'unknown';
}
const refundStatus = row => REFUND_STATUS[trim(row.refund_status)] ?? 'unknown';

/** Fuentes (economic_source_versions) que el cargador debe crear. Ventana = días UTC cubiertos por los datos. */
export function sourceDefinition(spec, window) {
  const evidenceType = spec.kind === 'order' ? 'order_export' : 'payment_ledger';
  const name = `Marketplace ${spec.label} · ${spec.kind === 'order' ? 'Pedidos' : 'Devoluciones'} (export recibido 2026-10-05)`;
  return {
    key: spec.key, sourceId: sourceIdFor(spec.key), name, evidenceType, active: true, complete: false,
    windowStart: window.start, windowEnd: window.end, watermark: '2026-10-05T00:00:00.000Z',
    report: `Export CSV de ${spec.label} (${spec.rel}, SHA-256 ${spec.sha256}, ${spec.rows} filas) recibido el 2026-10-05. Una entrada por fila; identidad = marketplace|id|sku (hash de fila si la clave se repite). Importes tal como vienen en el export; monedas y estados no declarados quedan desconocidos. Fuente incompleta: no certifica conciliación bancaria ni cobertura total de ventas.`,
  };
}

const dayFloor = iso => iso.slice(0, 10) + 'T00:00:00.000Z';
const dayAfter = iso => new Date(Date.parse(dayFloor(iso)) + 86400000).toISOString();

/**
 * Mapea UN archivo. `orderIndex` (solo devoluciones): Map «marketplace|order_id|sku» -> {entityId,currency,exponent,basis}|'AMBIGUO'.
 * Devuelve {source, items:[{entry, meta}], rejected:[...], stats, orderIndexOut}.
 */
export function mapMarketplaceFile({spec, text, tenantId, now = new Date(), unknownCurrency = 'rechazar', orderIndex = null}) {
  if (spec.rows === 0 && !text.trim()) return {source: null, items: [], rejected: [], stats: emptyStats(spec), orderIndexOut: new Map()};
  const {header, rows} = parseCsv(text);
  const expectedCols = spec.kind === 'order' ? ORDER_COLUMNS : RETURN_COLUMNS;
  if (header.join('|') !== expectedCols.join('|')) throw new Error('ENCABEZADO_INESPERADO ' + spec.key);
  if (rows.length !== spec.rows) throw new Error(`FILAS_INESPERADAS ${spec.key}: ${rows.length} != ${spec.rows}`);
  const isOrder = spec.kind === 'order';
  const dateCol = isOrder ? 'order_date' : 'return_date';
  const stats = emptyStats(spec);
  const rejected = [], tmp = [];

  // 1) hash y duplicados exactos (misma fila completa)
  const withHash = rows.map((row, i) => ({row, n: i + 2, hash: rowHash(header, row)}));
  const byHash = new Map();
  for (const r of withHash) { const g = byHash.get(r.hash); if (g) g.push(r); else byHash.set(r.hash, [r]); }
  // 2) clave de identidad y repeticiones
  const keyOf = isOrder
    ? r => `${trim(r.row.marketplace)}|${trim(r.row.order_id)}|${trim(r.row.sku)}`
    : r => trim(r.row.return_id) ? `${trim(r.row.marketplace)}|${trim(r.row.return_id)}|${trim(r.row.order_line_id)}|${trim(r.row.sku)}` : `${trim(r.row.marketplace)}|SIN_RETURN_ID|${trim(r.row.order_id)}|${trim(r.row.sku)}`;
  const keyCount = new Map();
  for (const r of withHash) { r.key = keyOf(r); keyCount.set(r.key, (keyCount.get(r.key) ?? 0) + 1); }
  // 3) grupos de moneda por identidad de pedido/devolución
  const curSets = new Map();
  const groupOf = isOrder ? r => `${trim(r.row.marketplace)}|${trim(r.row.order_id)}` : r => `${trim(r.row.marketplace)}|${trim(r.row.return_id) || 'SIN_RETURN_ID:' + r.n}`;
  for (const r of withHash) { const g = groupOf(r); const s = curSets.get(g) ?? new Set(); s.add(trim(r.row.currency)); curSets.set(g, s); }

  const occurrence = new Map();
  const windowDates = [];
  const orderIndexOut = new Map();
  for (const r of withHash) {
    const {row, n, hash} = r;
    const reject = (motivo, extra = {}) => { rejected.push({file: spec.key, row: n, motivo, rowSha256: hash, ...extra}); stats.rejected[motivo] = (stats.rejected[motivo] ?? 0) + 1; };
    const flags = [];
    const idEmpty = isOrder ? !trim(row.order_id) || !trim(row.sku) : false;
    if (idEmpty) { reject('IDENTIDAD_VACIA'); continue; }
    if (!isOrder && !trim(row.order_id) && !trim(row.return_id)) { reject('IDENTIDAD_VACIA'); continue; }
    const instant = toInstant(row[dateCol]);
    if (!instant) { reject('FECHA_INVALIDA'); continue; }
    if (Date.parse(instant) > now.getTime()) { reject('FECHA_FUTURA'); continue; }

    // (a) duplicados exactos
    const group = byHash.get(hash);
    const occ = (occurrence.get(hash) ?? 0) + 1; occurrence.set(hash, occ);
    const lineId = isOrder ? '' : trim(row.order_line_id);
    let dupExtra = false;
    if (group.length > 1 && occ > 1) {
      if (lineId) { reject('DUPLICADO_EXACTO', {firstRow: group[0].n}); continue; }
      dupExtra = true; flags.push('duplicado_exacto_sin_id_linea');
    }
    if (group.length > 1) stats.exactDuplicateGroupRows++;
    // (b) moneda
    const cur = trim(row.currency);
    const curSet = curSets.get(groupOf(r));
    const multi = curSet.size > 1;
    if (multi) flags.push('multimoneda');
    let currency, exponent, minorInfo;
    const rawAmount = isOrder ? row.line_price : (trim(row.refunded_amount) ? row.refunded_amount : row.total_refund_amount);
    if (!cur) {
      if (unknownCurrency === 'rechazar') { reject('MONEDA_DESCONOCIDA'); continue; }
      currency = unknownCurrency; exponent = 0; minorInfo = {minor: null, flag: trim(rawAmount) ? 'moneda_desconocida' : 'vacio'}; flags.push('moneda_desconocida');
    } else if (EXPONENT[cur] === undefined) { reject('MONEDA_NO_SOPORTADA', {currency: cur}); continue; }
    else { currency = cur; exponent = EXPONENT[cur]; minorInfo = toMinor(rawAmount, exponent); }
    if (minorInfo.flag && minorInfo.flag !== 'vacio' && minorInfo.flag !== 'moneda_desconocida') flags.push('importe_' + minorInfo.flag);
    if (minorInfo.minor === null) flags.push('importe_desconocido');

    // identidad
    let key = r.key;
    if (keyCount.get(key) > 1) key += '#' + hash.slice(0, 12);
    if (dupExtra) key += '~dup' + occ;
    let basisSuffix = '';
    if (dupExtra) basisSuffix += SUFFIX.dup;
    if (!isOrder && !trim(row.return_id)) { basisSuffix += SUFFIX.noReturnId; flags.push('sin_return_id'); }
    if (multi) basisSuffix += SUFFIX.multi;
    // Pedido Mirakl con línea REFUNDED o reembolso incrustado: el esquema no tiene un estado «reembolsado» para pedidos; no se deja como recorded engañoso.
    const refundedInSource = isOrder && (/^refunded$/i.test(trim(row.line_status)) || /^refunded$/i.test(trim(row.refund_state)) || trim(row.refund_amount) !== '');
    if (refundedInSource) { basisSuffix += SUFFIX.refundedInSource; flags.push('reembolso_incrustado_en_origen'); }
    const basis = (isOrder ? BASIS_ORDER : BASIS_REFUND) + basisSuffix;
    if (key.length > 200) { reject('IDENTIDAD_DEMASIADO_LARGA'); continue; }
    let status = isOrder ? orderStatus(row) : refundStatus(row);
    if (refundedInSource && status === 'recorded') status = 'unknown';
    if (status === 'unknown') flags.push('estado_desconocido');

    // consistencia declarada de campos de importe (solo se avisa; no se corrige nada)
    let consistency = '';
    if (isOrder) {
      const lp = toMinor(row.line_price, 2), up = toMinor(row.unit_price, 2), q = trim(row.quantity);
      if (lp.minor !== null && up.minor !== null && /^\d+$/.test(q) && BigInt(lp.minor) !== BigInt(up.minor) * BigInt(q)) { flags.push('line_price_distinto_de_unit_x_qty'); consistency = ' line_price != unit_price x quantity.'; }
    } else {
      const lt = toMinor(row.line_total, 2), up = toMinor(row.unit_price, 2), q = trim(row.quantity);
      if (lt.minor !== null && up.minor !== null && /^\d+$/.test(q) && BigInt(lt.minor) !== BigInt(up.minor) * BigInt(q)) { flags.push('line_total_distinto_de_unit_x_qty'); consistency = ' line_total != unit_price x quantity.'; }
    }

    // vínculo devolución -> pedido (solo si la clave (pedido, sku) es única y la unidad monetaria coincide)
    // El vínculo NO se escribe (orderId=null): las bases de pedido y devolución difieren y exposure.mjs lo rechazaría. El externalId permite reconstruirlo después.
    const orderId = null; let linkable = null;
    if (!isOrder && orderIndex) {
      const hit = orderIndex.get(`${trim(row.marketplace)}|${trim(row.order_id)}|${trim(row.sku)}`);
      if (hit && hit !== 'AMBIGUO' && hit.currency === currency && hit.exponent === exponent) { linkable = hit.entityId; flags.push('vinculo_diferido'); stats.linked++; }
      else flags.push(hit === 'AMBIGUO' ? 'pedido_ambiguo' : hit ? 'pedido_otra_moneda' : 'pedido_no_encontrado');
    }

    const raw = isOrder
      ? `cantidad ${clip(row.quantity)}; unit_price ${clip(row.unit_price)}; line_price ${clip(row.line_price)}; item_tax ${clip(row.item_tax, 80)}; shipping_price ${clip(row.shipping_price)}; discount ${clip(row.discount, 80)}; commission ${clip(row.commission)}; moneda ${cur || '(vacía)'}; order_status ${clip(row.order_status)}; line_status ${clip(row.line_status)}; refund_state ${clip(row.refund_state)} refund_amount ${clip(row.refund_amount)} refund_date ${clip(row.refund_date)}`
      : `cantidad ${clip(row.quantity)}; refunded_quantity ${clip(row.refunded_quantity)}; unit_price ${clip(row.unit_price)}; line_total ${clip(row.line_total)}; total_refund_amount ${clip(row.total_refund_amount)}; refunded_amount ${clip(row.refunded_amount)}; moneda ${cur || '(vacía)'}; return_status ${clip(row.return_status)}; refund_status ${clip(row.refund_status)}; resolution ${clip(row.resolution)}`;
    const idText = isOrder ? `pedido ${clip(row.order_id, 80)}; sku ${clip(row.sku, 80)}` : `devolución ${clip(row.return_id, 80) || '(sin return_id)'}; pedido ${clip(row.order_id, 80)}; línea ${clip(row.order_line_id, 80) || '(sin id)'}; sku ${clip(row.sku, 80)}`;
    const report = `Marketplace ${spec.label}; ${idText}. Procedencia: archivo ${spec.rel} (SHA-256 ${spec.sha256}), fila CSV ${n}, SHA-256 de la fila ${hash}. ${raw}.${consistency} Marcas: ${flags.length ? flags.join(', ') : 'ninguna'}. Importe ${isOrder ? 'bruto de línea (line_price)' : 'de devolución declarado'} sin supuestos de impuestos, envío ni descuentos; no es margen, pérdida ni cobro conciliado.`;
    if (report.length > 8000) { reject('REPORTE_DEMASIADO_LARGO'); continue; }

    const sourceId = sourceIdFor(spec.key);
    const entry = {expectedRevision: 0, externalId: key, kind: isOrder ? 'order' : 'refund', effectiveAt: instant, currency, exponent, basis,
      amountMinor: minorInfo.minor, status, orderId, reversalOf: null, details: {}, report, attested: true};
    const meta = {refundedInSource, linkable, file: spec.key, row: n, rowSha256: hash, flags, dupExtra, inDupGroup: group.length > 1, group: groupOf(r), multi, noReturnId: !isOrder && !trim(row.return_id), unknownCurrency: currency === unknownCurrency || !cur};
    tmp.push({sourceId, entry, meta});
    windowDates.push(instant);
    if (isOrder) {
      const idxKey = `${trim(row.marketplace)}|${trim(row.order_id)}|${trim(row.sku)}`;
      if (!orderIndexOut.has(idxKey) && keyCount.get(r.key) === 1) orderIndexOut.set(idxKey, {entityId: entityId(tenantId, sourceId, 'order', key), currency, exponent, basis});
      else orderIndexOut.set(idxKey, 'AMBIGUO');
    }
  }
  windowDates.sort();
  const window = windowDates.length ? {start: dayFloor(windowDates[0]), end: dayAfter(windowDates[windowDates.length - 1])} : null;
  stats.loaded = tmp.length; stats.rejectedTotal = rejected.length;
  return {source: window ? sourceDefinition(spec, window) : null, items: tmp, rejected, stats, orderIndexOut};
}

function emptyStats(spec) { return {file: spec.key, kind: spec.kind, rejected: {}, rejectedTotal: 0, loaded: 0, linked: 0, exactDuplicateGroupRows: 0}; }

/** Une los índices de pedidos de varios archivos (clave incluye marketplace; no hay colisión entre archivos). */
export function mergeOrderIndexes(indexes) { const m = new Map(); for (const ix of indexes) for (const [k, v] of ix) m.set(k, v); return m; }

/** Agrupa en tandas ≤ `size` entradas y ≤ `maxBytes` de JSON de entradas (el SQL añade ~1.5 KB), una fuente por tanda, conservando el orden del archivo. */
export const MAX_BATCH_BYTES = 200_000;
export function packBatches(items, size = MAX_BATCH, maxBytes = MAX_BATCH_BYTES) {
  if (!Number.isInteger(size) || size < 1 || size > MAX_BATCH) throw new Error('TAMANO_DE_TANDA_INVALIDO');
  const out = [];
  let cur = null;
  for (const it of items) {
    const b = Buffer.byteLength(JSON.stringify(it.entry), 'utf8') + 1;
    if (!cur || cur.sourceId !== it.sourceId || cur.items.length >= size || (cur.items.length > 0 && cur.bytes + b > maxBytes)) { cur = {sourceId: it.sourceId, items: [], bytes: 0}; out.push(cur); }
    cur.items.push(it); cur.bytes += b;
  }
  return out;
}

/** Resumen de conteos y totales por moneda, con y sin las filas dudosas (solo agregados, sin identificadores). */
export function summarize(allItems) {
  const view = {
    todo: () => true,
    sin_duplicados_excedentes: m => !m.dupExtra,
    sin_multimoneda: m => !m.multi,
    sin_dudosas: m => !m.dupExtra && !m.multi && !m.noReturnId && !m.refundedInSource,
    sin_grupos_identicos_completos: m => !m.inDupGroup && !m.multi && !m.noReturnId && !m.refundedInSource,
  };
  const out = {};
  for (const [name, f] of Object.entries(view)) {
    const agg = {};
    for (const {entry, meta} of allItems) {
      if (!f(meta)) continue;
      const k = `${entry.kind}|${entry.currency}|${entry.status}`;
      const a = agg[k] ?? (agg[k] = {filas: 0, importe_conocido_minor: 0n, filas_importe_desconocido: 0});
      a.filas++;
      if (entry.amountMinor === null) a.filas_importe_desconocido++; else a.importe_conocido_minor += BigInt(entry.amountMinor);
    }
    out[name] = Object.fromEntries(Object.entries(agg).sort().map(([k, a]) => [k, {...a, importe_conocido_minor: a.importe_conocido_minor.toString()}]));
  }
  return out;
}
