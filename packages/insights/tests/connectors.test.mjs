// Conectores en código (sin credenciales, sin red): contratos y mapeo a libro sobre fixtures SINTÉTICOS; carpeta compartida; fuentes del Tracker.
//   node --test packages/insights/tests/connectors.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {toMinor, validateCandidate, defineConnector, runConnector, createSecretResolver, assertSecretRef, transportApagado, PROVIDERS,
  createAmazonSpApiConnector, createWalmartConnector, createMiraklConnector, createShopifyConnector, createZendeskConnector,
  classify, scanFolder, runFolderImport, memoryReceipts, fileReceipts, folderTrackerSource, googleSheetsTrackerSource, oneDriveTrackerSource, syncTracker} from '../connectors/index.mjs';
import {normalizarSku} from '../sku.mjs';

const REF = 'secret://syn-conector';
const secrets = {get: async n => (n === 'syn-conector' ? 'TOKEN-SINTETICO-NO-REAL' : undefined)};

test('toMinor: decimales exactos como texto; inválidos => null (nunca 0)', () => {
  assert.equal(toMinor('12.34'), '1234'); assert.equal(toMinor('12'), '1200'); assert.equal(toMinor('0.005'), '1'); assert.equal(toMinor('-3.10'), '-310'); assert.equal(toMinor('9007199254740993.99'), '900719925474099399');
  for (const x of ['', null, 'abc', '1,000.00', '$5']) assert.equal(toMinor(x), null);
});
test('secretos: solo referencias válidas; el valor no aparece en errores; transporte apagado por defecto', async () => {
  assert.throws(() => assertSecretRef('TOKEN-REAL-123'), /SECRET_REF_INVALID/); assert.throws(() => assertSecretRef('secret://Mayus'), /SECRET_REF_INVALID/);
  assert.equal(await createSecretResolver(secrets).resolve(REF), 'TOKEN-SINTETICO-NO-REAL');
  await assert.rejects(createSecretResolver(secrets).resolve('secret://no-existe'), e => e.code === 'SECRET_UNAVAILABLE' && !String(e.message).includes('TOKEN'));
  await assert.rejects(transportApagado.request({}), /EXTERNAL_CALLS_DISABLED/);
  for (const make of Object.values(PROVIDERS)) assert.throws(() => make({secretRef: 'sk_live_abc'}), /SECRET_REF_INVALID/);
});
test('validateCandidate rechaza lo mal formado', () => {
  const ok = {externalId: 'amazon|1|X', kind: 'order', sku: 'X', quantity: 1, currency: 'USD', amountMinor: '100', effectiveAt: '2026-10-01T00:00:00Z', status: 'recorded'};
  assert.equal(validateCandidate(ok).effectiveAt, '2026-10-01T00:00:00.000Z');
  for (const [k, v] of [['kind', 'x'], ['sku', ''], ['quantity', 0], ['currency', 'usd'], ['amountMinor', '1.5'], ['effectiveAt', 'ayer'], ['status', 'raro']]) assert.throws(() => validateCandidate({...ok, [k]: v}), new RegExp('LEDGER_CANDIDATE_INVALID:' + k));
  assert.equal(validateCandidate({...ok, amountMinor: null}).amountMinor, null);
});

const amazonPage = {payload: {Orders: [{AmazonOrderId: '111-0000001-0000001', PurchaseDate: '2026-10-01T10:00:00Z', OrderStatus: 'Shipped', OrderItems: [{SellerSKU: 'SKUP-L1', QuantityOrdered: 2, ItemPrice: {CurrencyCode: 'USD', Amount: '199.98'}}, {SellerSKU: 'STX2-M1-NEW', QuantityOrdered: 1}]},
  {AmazonOrderId: '111-0000002-0000002', PurchaseDate: '2026-10-02T10:00:00Z', OrderStatus: 'Canceled', OrderItems: [{SellerSKU: 'GTX6-M', QuantityOrdered: 1, ItemPrice: {CurrencyCode: 'USD', Amount: '50'}}]}],
  FinancialEvents: {RefundEventList: [{AmazonOrderId: '111-0000001-0000001', PostedDate: '2026-10-05T00:00:00Z', ShipmentItemAdjustmentList: [{SellerSKU: 'SKUP-L1', QuantityShipped: -1, OrderAdjustmentItemId: 'ADJ1', ItemChargeAdjustmentList: [{ChargeType: 'Principal', ChargeAmount: {CurrencyCode: 'USD', CurrencyAmount: -99.99}}]}]}]}, NextToken: 'tok2'}};
async function runWith(connector, pages, opts = {}) {
  const calls = [], transport = {request: async r => { calls.push(r); return pages[Math.min(calls.length - 1, pages.length - 1)]; }}, records = [];
  const c = PROVIDERS[connector.p]({secretRef: REF, secrets, transport, ...connector.o});
  const out = await runConnector(c, {ctx: {}, record: async r => records.push(r), window: {from: '2026-10-01', to: '2026-11-01'}, ...opts});
  return {out, calls, records, c};
}
test('Amazon: backfill mapea pedidos/reembolsos; cancelado; sin importe => null; token en transporte, no en la salida', async () => {
  const {out, calls, records} = await runWith({p: 'amazon'}, [amazonPage, {payload: {}}]);
  assert.equal(out.ok, true); assert.equal(out.done, true); assert.equal(out.pages, 2);
  const by = Object.fromEntries(out.candidates.map(x => [x.externalId, x]));
  assert.deepEqual([by['amazon|111-0000001-0000001|SKUP-L1'].quantity, by['amazon|111-0000001-0000001|SKUP-L1'].amountMinor, by['amazon|111-0000001-0000001|SKUP-L1'].currency], [2, '19998', 'USD']);
  assert.equal(by['amazon|111-0000001-0000001|STX2-M1-NEW'].amountMinor, null, 'sin importe: null, no 0'); assert.equal(by['amazon|111-0000002-0000002|GTX6-M'].status, 'cancelled');
  const rf = out.candidates.find(x => x.kind === 'refund'); assert.deepEqual([rf.externalId, rf.sku, rf.amountMinor, rf.quantity], ['amazon|111-0000001-0000001-ADJ1||SKUP-L1', 'SKUP-L1', '9999', 1]);
  assert.equal(normalizarSku(rf.sku), 'SKUP-L1'); assert.equal(normalizarSku(by['amazon|111-0000001-0000001|STX2-M1-NEW'].sku), 'STX2-M1');
  assert.equal(calls[0].credential, 'TOKEN-SINTETICO-NO-REAL'); assert.equal(calls[0].operation, 'backfill'); assert.equal(calls[1].params.cursor, 'tok2');
  assert.equal(JSON.stringify(out).includes('TOKEN'), false); assert.deepEqual(records.map(r => [r.source, r.method, r.ok]), [['amazon', 'api_poll', true]]);
});
const walmartPage = {list: {meta: {nextCursor: null}, elements: {order: [{purchaseOrderId: '200000000000001', orderDate: 1790000000000, orderLines: {orderLine: [
  {lineNumber: '1', item: {sku: 'SKUS-M10-WM12'}, orderLineQuantity: {amount: '1'}, charges: {charge: [{chargeType: 'PRODUCT', chargeAmount: {currency: 'USD', amount: 299.5}}]}, orderLineStatuses: {orderLineStatus: [{status: 'Delivered'}]},
   refund: {refundCharges: {refundCharge: [{refundId: '300000000000000001', refundDate: 1790500000000, charge: {chargeAmount: {currency: 'USD', amount: -299.5}}}]}}},
  {lineNumber: '2', item: {sku: 'SKUP-L4'}, orderLineQuantity: {amount: '3'}, charges: {charge: [{chargeType: 'PRODUCT', chargeAmount: {currency: 'USD', amount: 10}}]}, orderLineStatuses: {orderLineStatus: [{status: 'Cancelled'}]}}]}}]}}};
test('Walmart: pedido por purchaseOrderId, reembolso con su id largo y línea; cancelado; fechas en ms', async () => {
  const {out} = await runWith({p: 'walmart'}, [walmartPage]); const ids = out.candidates.map(c => c.externalId);
  assert.deepEqual(ids, ['walmart|200000000000001|SKUS-M10-WM12', 'walmart|300000000000000001|1|SKUS-M10-WM12', 'walmart|200000000000001|SKUP-L4']);
  assert.equal(out.candidates[1].amountMinor, '29950'); assert.equal(out.candidates[1].kind, 'refund'); assert.equal(out.candidates[2].status, 'cancelled'); assert.equal(out.candidates[2].quantity, 3);
  assert.equal(out.candidates[0].effectiveAt, new Date(1790000000000).toISOString());
});
test('Mirakl (Best Buy): SKU numérico se conserva, reembolso por id, cancelado y paginación por token', async () => {
  const p1 = {orders: [{order_id: 'BBY01-000000000001-A', currency_iso_code: 'USD', created_date: '2026-10-01T00:00:00Z', order_lines: [{offer_sku: 'S78560', quantity: 1, total_price: 119, order_line_state: 'SHIPPED', refunds: [{id: 'R1', amount: 119, state: 'REFUNDED', created_date: '2026-10-03T00:00:00Z'}]}, {offer_sku: 'S11111', quantity: 2, total_price: 20, order_line_state: 'CANCELED'}]}], next_page_token: 'p2'};
  const {out, calls} = await runWith({p: 'mirakl', o: {marketplace: 'mirakl_bestbuy_us'}}, [p1, {orders: []}]);
  assert.deepEqual(out.candidates.map(c => [c.externalId, c.kind, c.status, c.amountMinor]), [['mirakl_bestbuy_us|BBY01-000000000001-A|S78560', 'order', 'recorded', '11900'], ['mirakl_bestbuy_us|BBY01-000000000001-A-R1|S78560', 'refund', 'settled', '11900'], ['mirakl_bestbuy_us|BBY01-000000000001-A|S11111', 'order', 'cancelled', '2000']]);
  assert.equal(calls.length, 2); assert.equal(normalizarSku('S78560'), 'S78560');
});
test('Shopify: SKU del lineItem, cantidad × precio unitario, reembolsos por línea, pedido cancelado, cursor de conexión', async () => {
  const money = (amount, currencyCode = 'USD') => ({shopMoney: {amount, currencyCode}});
  const page = {data: {orders: {pageInfo: {hasNextPage: true, endCursor: 'c1'}, edges: [{cursor: 'c1', node: {id: 'gid://shopify/Order/1', createdAt: '2026-10-01T00:00:00Z', currencyCode: 'USD', cancelledAt: null,
    lineItems: {edges: [{node: {sku: 'STE14-M', quantity: 2, originalUnitPriceSet: money('149.99')}}, {node: {sku: null, quantity: 1, originalUnitPriceSet: money('10.00')}}]},
    refunds: [{id: 'gid://shopify/Refund/9', createdAt: '2026-10-04T00:00:00Z', refundLineItems: {edges: [{node: {quantity: 1, subtotalSet: money('149.99'), lineItem: {sku: 'STE14-M'}}}]}}]}}]}}};
  const {out} = await runWith({p: 'shopify'}, [page, {data: {orders: {pageInfo: {hasNextPage: false}, edges: []}}}]);
  assert.deepEqual(out.candidates.map(c => [c.externalId, c.sku, c.quantity, c.amountMinor]), [['gid://shopify/Order/1|STE14-M', 'STE14-M', 2, '29998'], ['gid://shopify/Order/1|SIN-SKU', 'SIN-SKU', 1, '1000'], ['gid://shopify/Refund/9|STE14-M', 'STE14-M', 1, '14999']]);
});
test('Zendesk: sin libro económico; solo declara la fuente y pagina por after_cursor', async () => {
  const {out, records} = await runWith({p: 'zendesk'}, [{tickets: [{id: 1}], after_cursor: 'a1', end_of_stream: false}, {tickets: [], after_cursor: 'a1', end_of_stream: true}]);
  assert.equal(out.candidates.length, 0); assert.equal(out.done, true); assert.equal(records[0].source, 'zendesk');
});
test('corrida: transporte apagado => ok:false EXTERNAL_CALLS_DISABLED y se registra el error; incremental usa cursor; sin ventana ni cursor se rechaza; candidatos inválidos se cuentan', async () => {
  const rec = [], c = createAmazonSpApiConnector({secretRef: REF, secrets});
  const off = await runConnector(c, {ctx: {}, window: {from: 'a', to: 'b'}, record: async r => rec.push(r)}); assert.equal(off.ok, false); assert.equal(off.code, 'EXTERNAL_CALLS_DISABLED'); assert.deepEqual([rec[0].ok, rec[0].error], [false, 'EXTERNAL_CALLS_DISABLED']);
  const noWin = await runConnector(createWalmartConnector({secretRef: REF, secrets, transport: {request: async () => walmartPage}}), {ctx: {}}); assert.equal(noWin.code, 'RUN_WINDOW_REQUIRED');
  const calls = []; const inc = await runConnector(createMiraklConnector({secretRef: REF, secrets, transport: {request: async r => { calls.push(r.operation); return {orders: [{order_id: 'X1', currency_iso_code: 'usd', created_date: '2026-10-01T00:00:00Z', order_lines: [{offer_sku: 'S1', quantity: 1, total_price: 1}]}], next_page_token: null}; }}}), {ctx: {}, cursor: 'c0'});
  assert.deepEqual(calls, ['incremental']); assert.equal(inc.candidates.length, 0); assert.equal(inc.rejected, 1, 'moneda en minúsculas => rechazado, no detiene');
  assert.throws(() => defineConnector({key: 'x', channel: 'x', method: 'raro', init() {}, backfill() {}, incremental() {}, toLedger() {}}), /CONNECTOR_INVALID/);
});

async function tmp() { return fs.mkdtemp(path.join(os.tmpdir(), 'vivos-drop-')); }
test('carpeta compartida: clasifica por nombre, espera a que el archivo se asiente, deduplica por contenido y no sale de la carpeta', async () => {
  assert.deepEqual(classify('pedidos-walmart-2026-10.csv'), {source: 'walmart-pedidos', kind: 'order'}); assert.equal(classify('notas.csv'), null);
  const dir = await tmp(), outside = await tmp(); await fs.writeFile(path.join(outside, 'pedidos-amazon-secreto.csv'), 'x');
  await fs.writeFile(path.join(dir, 'pedidos-amazon-1.csv'), 'a,b\n1,2\n'); await fs.writeFile(path.join(dir, 'devoluciones-walmart.csv'), 'c\n'); await fs.writeFile(path.join(dir, 'pedidos-amazon-copia.csv'), 'a,b\n1,2\n');
  await fs.writeFile(path.join(dir, 'raro.csv'), 'z'); await fs.writeFile(path.join(dir, '~$tracker.xlsx'), 'lock'); await fs.symlink(path.join(outside, 'pedidos-amazon-secreto.csv'), path.join(dir, 'pedidos-amazon-enlace.csv'));
  const receipts = memoryReceipts(), seen = [], rec = [];
  const recent = await scanFolder({dir, receipts, settleMs: 60000}); assert.equal(recent.found.length, 0); assert.equal(recent.unsettled.length, 3);
  const old = new Date(Date.now() - 3600_000); for (const f of await fs.readdir(dir)) await fs.utimes(path.join(dir, f), old, old).catch(() => {});
  const r1 = await runFolderImport({dir, receipts, importer: async f => { seen.push(f.name); return {summary: {rows: 1}}; }, record: async r => rec.push(r), settleMs: 1000});
  assert.equal(r1.imported.length, 2, 'la copia idéntica (mismo SHA) no se importa dos veces'); assert.ok(!seen.includes('pedidos-amazon-enlace.csv')); assert.deepEqual(r1.unmatched, ['raro.csv']);
  assert.deepEqual([rec[0].method, rec[0].ok, rec[0].newRecords], ['file_drop', true, 2]);
  const r2 = await runFolderImport({dir, receipts, importer: async () => { throw Error('no debe llamarse'); }, record: async r => rec.push(r), settleMs: 1000}); assert.equal(r2.imported.length, 0);
  assert.equal(rec[1].newRecords, 0);
});
test('carpeta: un fallo de importación detiene la pasada, no deja recibo y se reintenta; recibos en archivo sobreviven', async () => {
  const dir = await tmp(), state = path.join(await tmp(), 's', 'r.json'); const old = new Date(Date.now() - 3600_000);
  for (const [n, c] of [['pedidos-amazon-a.csv', '1'], ['pedidos-amazon-b.csv', '2']]) { await fs.writeFile(path.join(dir, n), c); await fs.utimes(path.join(dir, n), old, new Date(old.getTime() + (n.endsWith('a.csv') ? 0 : 1000))); }
  const receipts = fileReceipts(state), rec = []; let boom = true;
  const imp = async f => { if (boom && f.name.endsWith('a.csv')) throw Object.assign(Error('x'), {code: 'sql fallo!'}); };
  const r1 = await runFolderImport({dir, receipts, importer: imp, record: async r => rec.push(r), settleMs: 1}); assert.equal(r1.imported.length, 0); assert.equal(r1.failed.code, 'SQL_FALLO_'); assert.equal(rec[0].ok, false);
  boom = false; const r2 = await runFolderImport({dir, receipts: fileReceipts(state), importer: imp, record: async () => {}, settleMs: 1}); assert.equal(r2.imported.length, 2);
  assert.equal((await runFolderImport({dir, receipts: fileReceipts(state), importer: imp, settleMs: 1})).imported.length, 0);
});
test('TrackerSource carpeta: versiones por orden de recepción, duplicados por contenido fuera, y syncTracker importa solo lo nuevo', async () => {
  const dir = await tmp(); const t = i => new Date(Date.now() - (10 - i) * 3600_000);
  for (const [n, c, i] of [['CLIENTEX Tracker V2.xlsx', 'v1', 1], ['CLIENTEX Tracker V2 - copia.xlsx', 'v1', 2], ['CLIENTEX Tracker V2 - 20261008.xlsx', 'v2', 3], ['otro.xlsx', 'zz', 4]]) { await fs.writeFile(path.join(dir, n), c); await fs.utimes(path.join(dir, n), t(i), t(i)); }
  const src = folderTrackerSource({dir}), vs = await src.listVersions();
  assert.deepEqual(vs.map(v => v.label), ['CLIENTEX Tracker V2.xlsx', 'CLIENTEX Tracker V2 - 20261008.xlsx']); assert.deepEqual(src.describe(), {kind: 'folder', method: 'file_drop', location: path.basename(dir)});
  const receipts = memoryReceipts(), got = [], rec = [];
  const r = await syncTracker({source: src, receipts, importer: async v => got.push([v.label, v.bytes.length]), record: async x => rec.push(x)}); assert.equal(r.imported.length, 2); assert.deepEqual(got, [['CLIENTEX Tracker V2.xlsx', 2], ['CLIENTEX Tracker V2 - 20261008.xlsx', 2]]);
  assert.equal((await syncTracker({source: src, receipts, importer: async () => { throw Error('no'); }})).imported.length, 0); assert.deepEqual([rec[0].source, rec[0].method, rec[0].ok], ['tracker', 'file_drop', true]);
});
test('TrackerSource Google Sheets / OneDrive: contrato con transporte inyectable; apagado por defecto; secreto solo por referencia', async () => {
  const calls = [], transport = {request: async r => { calls.push([r.service, r.operation, r.credential]); return r.operation.includes('list') || r.operation.endsWith('versions') ? {items: [{id: 'r2', modifiedTime: '2026-10-02T00:00:00Z'}, {id: 'r1', modifiedTime: '2026-10-01T00:00:00Z'}]} : new Uint8Array([1, 2, 3]); }};
  for (const make of [googleSheetsTrackerSource, oneDriveTrackerSource]) {
    const s = make({fileId: 'abcdef123456', secretRef: REF, secrets, transport}), vs = await s.listVersions();
    assert.deepEqual(vs.map(v => v.label), ['r1', 'r2']); assert.deepEqual([...await vs[0].read()], [1, 2, 3]); assert.ok(!JSON.stringify(s.describe()).includes('TOKEN')); assert.equal(s.describe().method, 'sheet_sync');
    await assert.rejects(make({fileId: 'x', secretRef: REF, secrets}).listVersions(), /EXTERNAL_CALLS_DISABLED/);
    assert.throws(() => make({fileId: 'x', secretRef: 'plain-token'}), /SECRET_REF_INVALID/);
    const failing = await syncTracker({source: make({fileId: 'x', secretRef: REF, secrets}), receipts: memoryReceipts(), importer: async () => {}}); assert.equal(failing.failed.code, 'EXTERNAL_CALLS_DISABLED');
  }
  assert.ok(calls.every(c => c[2] === 'TOKEN-SINTETICO-NO-REAL'));
});
