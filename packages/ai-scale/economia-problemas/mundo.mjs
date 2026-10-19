// Mundo SINTÉTICO para las pruebas: conversaciones -> extracción -> problemas (con el flujo REAL de persistir.mjs + agrupar.mjs) y libro económico
// (con las funciones REALES de emit-sql.mjs / economic_batch_import). Ningún dato es de clientes: todo identificador empieza por SYN o es un uuid de prueba.
import {spawnSync} from 'node:child_process';
import {sha256} from '../../intelligence/index.mjs';
import {prepareConversation} from '../preprocess.mjs';
import {buildPersistence, persistenceSql} from '../persistir.mjs';
import {configHash, taskKeyFor, DEFAULT_MODEL} from '../cohorte.mjs';
import {SEED_SQL} from '../test-pg.mjs';
import * as N from '../problemas/nucleo.mjs';
import {planSql, cerrar} from '../problemas/agrupar.mjs';
import {sourcesSql, batchSql} from '../../economics/emit-sql.mjs';
import {entityId, sourceIdFor} from '../../economics/marketplace-map.mjs';
import {BASIS_ORDER_MP, BASIS_REFUND_MP, BASIS_SHOPIFY} from './reglas.mjs';

export const TENANT_A = N.TENANT, TENANT_B = 'bbbbbbbb-0000-4000-8000-000000000001';
export const U = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export const OWNER = {A: U(9001), B: U(9002)}, ANALYST_A = U(9003), SECOND_OWNER_A = U(9004);
const TAX = ['Envío: No recibido', 'Pago: Cobro duplicado', 'Garantía: Batería'];
const MODEL = DEFAULT_MODEL, PROVIDER = 'azure';
const VERSION = N.defaultVersion('mensaje');

function prng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function gauss(r) { return Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r()); }
const center = k => { const r = prng(1000 + k), v = new Float32Array(N.EMBED_DIM); let n = 0; for (let i = 0; i < v.length; i++) { v[i] = gauss(r); n += v[i] * v[i]; } n = Math.sqrt(n); for (let i = 0; i < v.length; i++) v[i] /= n; return v; };
const near = (k, seed, noise = 0.0025) => { const c = center(k), r = prng(seed), v = new Float32Array(c.length); for (let i = 0; i < v.length; i++) v[i] = c[i] + noise * gauss(r); return v; };

/** Una conversación sintética persistible: {tenant, n, cat, ticket, text, cluster}. external_id de la conversación = `hubspot:<ticket>` o `gorgias:<id>`. */
export function conversacion({tenant, n, cat, text, ext, cluster, sev = 'high'}) {
  const conv = {conversation_id: U(1000000 + n), messages: [
    {id: U(2000000 + 2 * n), revision_id: U(3000000 + 2 * n), role: 'customer', text, at: '1'},
    {id: U(2000001 + 2 * n), revision_id: U(3000001 + 2 * n), role: 'agent', text: 'Lo reviso hoy mismo.', at: '2'}]};
  const prep = prepareConversation(conv, {boilerplate: null});
  const first = prep.revisions[0], quote = Array.from(first.text).slice(0, 12).join('');
  const rec = {task_key: taskKeyFor(configHash({model: MODEL, provider: PROVIDER, taxonomy: TAX}), conv.conversation_id, prep.input_hash), conversation_id: conv.conversation_id, status: 'ok', model: MODEL, provider: PROVIDER,
    usage: {prompt: 10, completion: 5}, sentiment: 'negative', intent: 'complaint', urgency: 'normal',
    issues: [{category: cat, severity: sev, evidence: [{message_id: first.message_id, start: 0, end: 12, quote_hash: sha256(quote), role: 'customer'}]}], entities: []};
  const p = buildPersistence({conv, rec, taxonomy: TAX, boilerplate: null, tenant});
  return {conv, rec, p, n, tenant, ext, cluster};
}

const psqlFile = (sock, sql) => spawnSync('psql', ['-h', sock, '-U', 'postgres', '-d', 't', '-q', '-1', '-v', 'ON_ERROR_STOP=1', '-f', '-'], {input: sql + '\n', encoding: 'utf8'});

export function sembrarConversaciones(h, convs) {
  const {psql, sock} = h;
  const done = new Set();
  for (const c of convs) {
    const o = {tenant: c.tenant, conn: U(500000 + c.n), conv: c.conv.conversation_id, csrev: U(600000 + c.n), msgs: c.conv.messages.map((m, i) => ({id: m.id, rev: m.revision_id, srev: U(700000 + c.n * 2 + i), role: m.role}))};
    let sql = SEED_SQL(o); if (done.has(c.tenant)) sql = sql.replace(/^\s*insert into public\.organizations[^\n]*\n/m, ''); done.add(c.tenant);
    sql = sql.replace("values('" + o.conn + "','" + o.tenant + "','csv','acc')", "values('" + o.conn + "','" + o.tenant + "','csv','acc" + c.n + "')");
    sql = sql.replaceAll("'c1'", lit(c.ext));
    for (const s of sql.split(/;\n/).filter(x => x.trim())) { const r = psql(s); if (!r.ok) throw Error(s.slice(0, 80) + ' -> ' + r.err); }
  }
  const r = psql(`update public.source_revisions s set snapshot=jsonb_build_array(jsonb_build_object('table','messages','row',jsonb_build_object('id',m.id,'role',m.role,'conversation_id',m.conversation_id))) from public.messages m where s.entity_type='message' and s.canonical_id=m.id and s.tenant_id=m.tenant_id`);
  if (!r.ok) throw Error(r.err);
}
const lit = v => "'" + String(v).replace(/'/g, "''") + "'";

export function sembrarMiembros(h, convs, tenant, {threshold = 0.2} = {}) {
  const items = convs.filter(c => c.tenant === tenant);
  const vecOf = c => near(c.cluster, 5000 + c.n);
  const {rows} = N.construirFilas(items.map(i => i.p), {mode: 'mensaje', tenant, version: VERSION});
  const byPrep = new Map(items.flatMap(i => i.p.revs.map(r => [i.p.taskKey + '|' + r.message_id, vecOf(i)])));
  for (const r of rows) r.vec = byPrep.get(r.taskKey + '|' + r.prepId);
  const plan = planSql(rows, {threshold, tenant, version: VERSION, batchSize: 4, vectorType: 'text'});
  for (const s of [...plan.lotes, ...plan.versiones]) { const r = psqlFile(h.sock, cerrar(s, true).join('\n')); if (r.status !== 0) throw Error('miembros: ' + r.stderr.slice(0, 300)); }
  return plan;
}

export function sembrarUsuarios(h) {
  const {psql} = h;
  psql(`alter table auth.users add column if not exists deleted_at timestamptz`);
  for (const [t, who] of [[TENANT_A, [[OWNER.A, 'owner'], [ANALYST_A, 'analyst'], [SECOND_OWNER_A, 'viewer']]], [TENANT_B, [[OWNER.B, 'owner']]]])
    for (const [u, role] of who) {
      let r = psql(`insert into auth.users(id) values('${u}') on conflict do nothing`); if (!r.ok) throw Error(r.err);
      r = psql(`insert into public.memberships(tenant_id,user_id,role,status,permissions_version) values('${t}','${u}','${role}','active',1)`); if (!r.ok) throw Error(r.err);
    }
}

// ----------------------------------------------------------------------------------------------- libro económico
const REP = 'SYN libro: registro sintético de prueba con procedencia documentada, sin datos de clientes.';
const entry = (e) => ({expectedRevision: 0, orderId: null, reversalOf: null, details: {}, report: REP, attested: true, exponent: 2, currency: 'USD', status: 'recorded', ...e});

export function fuentes({complete = false} = {}) {
  const mk = (key, type, label) => ({sourceId: sourceIdFor(key), name: label, evidenceType: type, active: true, complete, windowStart: '2025-10-01T00:00:00.000Z', windowEnd: '2026-10-06T00:00:00.000Z', watermark: '2026-10-06T00:00:00.000Z', report: REP + ' Fuente ' + key});
  return {amazonP: mk('amazon-pedidos', 'order_export', 'SYN Amazon pedidos'), walmartD: mk('walmart-devoluciones', 'payment_ledger', 'SYN Walmart devoluciones'), shopifyP: mk('shopify-pedidos', 'order_export', 'SYN Shopify pedidos'), shopifyR: mk('shopify-reembolsos', 'payment_ledger', 'SYN Shopify reembolsos')};
}

/** Entradas sintéticas (14 claves) con identidades como las reales: mk|order|sku (pedidos) y mk|return|line|sku (devoluciones). */
export function libroSintetico(tenant = TENANT_A, {complete = false} = {}) {
  const f = fuentes({complete});
  const eid = (src, kind, ext) => entityId(tenant, src.sourceId, kind, ext);
  const ped = (ext, sku, cents, extra = {}) => ({ext, entry: entry({externalId: ext, kind: 'order', effectiveAt: '2026-03-10T12:00:00.000Z', basis: BASIS_ORDER_MP, amountMinor: String(cents), ...extra}), sku});
  const O = {
    O1: ped('amazon|SYN-111-0000001|SKU-A', 'SKU-A', 10000), O2: ped('amazon|SYN-111-0000002|SKU-B', 'SKU-B', 25000),
    O3a: ped('amazon|SYN-111-0000003|SKU-C1', 'SKU-C1', 5000), O3b: ped('amazon|SYN-111-0000003|SKU-C2', 'SKU-C2', 7000),
    O4: ped('amazon|SYN-111-0000004|SKU-D', 'SKU-D', 9999, {status: 'cancelled'}),
  };
  const refundExt = 'walmart|SYN-RET-1|SYN-L1|SKU-W';
  const R1 = entry({externalId: refundExt, kind: 'refund', effectiveAt: '2026-04-02T12:00:00.000Z', basis: BASIS_REFUND_MP, amountMinor: '3000', status: 'settled',
    report: 'Marketplace Walmart; devolución SYN-RET-1; pedido SYN-W-1; línea SYN-L1; sku SKU-W. Procedencia: archivo sintético. Importe de devolución declarado.'});
  // Devolución de Amazon: el export real no trae estado de reembolso => unknown (así están las 3,272 de Amazon en el libro real)
  const R2 = entry({externalId: 'amazon|SYN-RET-A|SYN-LA|SKU-Z', kind: 'refund', effectiveAt: '2026-04-03T12:00:00.000Z', basis: BASIS_REFUND_MP, amountMinor: '1000', status: 'unknown',
    report: 'Marketplace Amazon; devolución SYN-RET-A; pedido SYN-111-0000001; línea SYN-LA; sku SKU-Z. Procedencia: archivo sintético. Importe de devolución declarado.'});
  const gid = 'gid://shopify/Order/9001';
  const S1 = entry({externalId: gid, kind: 'order', effectiveAt: '2026-09-10T12:00:00.000Z', basis: BASIS_SHOPIFY, amountMinor: '40000'});
  const S1id = eid(f.shopifyP, 'order', gid);
  const S1R = entry({externalId: 'gid://shopify/OrderTransaction/77', kind: 'refund', effectiveAt: '2026-09-12T12:00:00.000Z', basis: BASIS_SHOPIFY, amountMinor: '5000', status: 'settled', orderId: S1id});
  return {
    fuentes: f,
    lotes: [
      {src: f.amazonP, entries: Object.values(O).map(o => o.entry)},
      {src: f.walmartD, entries: [R1, R2]},
      {src: f.shopifyP, entries: [S1]},
      {src: f.shopifyR, entries: [S1R]},
    ],
    ids: {O1: eid(f.amazonP, 'order', O.O1.ext), O2: eid(f.amazonP, 'order', O.O2.ext), O3a: eid(f.amazonP, 'order', O.O3a.ext), O3b: eid(f.amazonP, 'order', O.O3b.ext), O4: eid(f.amazonP, 'order', O.O4.ext), R1: eid(f.walmartD, 'refund', refundExt), R2: eid(f.walmartD, 'refund', 'amazon|SYN-RET-A|SYN-LA|SKU-Z'), S1: S1id, S1R: eid(f.shopifyR, 'refund', 'gid://shopify/OrderTransaction/77')},
    items: [...Object.values(O).map(o => ({sourceId: f.amazonP.sourceId, entry: o.entry})), {sourceId: f.walmartD.sourceId, entry: R1}, {sourceId: f.walmartD.sourceId, entry: R2}],
    shopify: {normalized: {orders: [{id: gid, name: '#19001', lineItems: {nodes: [{sku: 'SKU-S'}]}}]}, packageEntries: [{externalId: gid, kind: 'order', status: 'recorded', basis: BASIS_SHOPIFY, amountMinor: '40000', sourceId: f.shopifyP.sourceId}]},
  };
}

export function cargarLibro(h, libro, tenant = TENANT_A, actor = OWNER.A) {
  const {sock} = h;
  const f = Object.values(libro.fuentes);
  let r = psqlFile(sock, sourcesSql(tenant, f, actor)); if (r.status !== 0) throw Error('fuentes: ' + r.stderr.slice(0, 300));
  let i = 0;
  for (const l of libro.lotes) { r = psqlFile(sock, batchSql(tenant, {sourceId: l.src.sourceId, entries: l.entries, label: 'syn' + (++i)}, actor)); if (r.status !== 0) throw Error('lote: ' + r.stderr.slice(0, 400)); }
}

/** Filas del puente (economia-tickets.csv sintético). */
export const puenteSintetico = () => {
  const row = (o) => ({hubspot_ticket_id: '', gorgias_id: '', marketplace: '', retailer: '', order_id: '', sku: '', merged_ticket_ids: '', ...o});
  return [
    row({hubspot_ticket_id: '5000000001', marketplace: 'amazon', order_id: 'SYN-111-0000001', sku: 'SKU-A'}),       // T1 -> O1 (A)
    row({hubspot_ticket_id: '5000000002', marketplace: 'amazon', order_id: 'SYN-111-0000001', sku: ''}),            // T2 -> O1 (B)
    row({hubspot_ticket_id: '5000000003', marketplace: 'amazon', order_id: 'SYN-111-0000002', sku: 'Pending'}),     // T3 -> O2 (B)
    row({hubspot_ticket_id: '5000000004', marketplace: 'amazon', order_id: 'SYN-111-0000003', sku: 'SKU-C1'}),      // T4 -> O3a (A)
    row({hubspot_ticket_id: '5000000005', marketplace: 'amazon', order_id: 'SYN-111-0000003', sku: 'Pending'}),     // T5 multilínea sin SKU: NO se liga
    row({hubspot_ticket_id: '5000000006', marketplace: 'walmart', order_id: 'SYN-W-1', sku: 'SKU-W'}),              // T6 -> devolución R1 (A)
    row({hubspot_ticket_id: '5000000007', gorgias_id: 'G7', marketplace: 'amazon', order_id: 'SYN-111-0000002', sku: 'SKU-B'}), // T7 (conversación gorgias:G7) -> O2 (A)
    row({hubspot_ticket_id: '5000000009', marketplace: 'amazon', order_id: 'SYN-999-NOEXISTE', sku: 'SKU-A'}),     // T9 pedido fuera del libro
    row({hubspot_ticket_id: '5000000010', marketplace: '', retailer: 'Clientextools.com :: Shopify', order_id: '19001', sku: 'SKU-S'}), // T10 -> S1 (A) por retailer
    row({hubspot_ticket_id: '5000000011', marketplace: 'amazon', order_id: 'SYN-111-0000004', sku: 'SKU-D'}),       // T11 pedido cancelado: no elegible
    row({hubspot_ticket_id: '5000000012', marketplace: 'amazon', order_id: 'SYN-111-0000001', sku: 'SKU-OTRO'}),    // T12 SKU distinto en línea única: no se liga (clase C opcional)
  ];
};

/** Conversaciones del mundo A (+ una de B con el MISMO ticket que A para probar aislamiento). */
export function conversacionesSinteticas() {
  const mk = (n, cat, text, ext, cluster, tenant = TENANT_A) => conversacion({tenant, n, cat, text, ext, cluster});
  return [
    mk(1, 'Envío: No recibido', 'Mi pedido no ha llegado todavía y ya pasaron doce días desde la compra.', 'hubspot:5000000001', 0),
    mk(2, 'Envío: No recibido', 'Hace dos semanas pedí un taladro y nunca lo recibí en mi casa.', 'hubspot:5000000002', 0),
    mk(3, 'Envío: No recibido', 'La paquetería dice entregado pero mi paquete nunca llegó a la puerta.', 'hubspot:5000000003', 0),
    mk(4, 'Pago: Cobro duplicado', 'Me cobraron dos veces el mismo pedido en la tarjeta de crédito.', 'hubspot:5000000004', 1),
    mk(5, 'Pago: Cobro duplicado', 'Veo dos cargos idénticos de mi compra del lunes en el estado de cuenta.', 'hubspot:5000000005', 1),
    mk(6, 'Garantía: Batería', 'Mi batería de cuatro amperios ya no carga y solo parpadea en rojo.', 'hubspot:5000000006', 2),
    mk(7, 'Envío: No recibido', 'Mi compra no llega, ya van tres semanas de espera sin noticias.', 'gorgias:G7', 0),
    mk(8, 'Envío: No recibido', 'El pedido de la tienda en línea nunca llegó y nadie responde mis correos.', 'hubspot:5000000010', 0),
    mk(11, 'Envío: No recibido', 'El pedido de mi tienda no ha llegado, llevamos una semana esperando.', 'hubspot:5000000001', 0, TENANT_B),
  ];
}

export function montarMundo(h, {complete = false} = {}) {
  const convs = conversacionesSinteticas();
  sembrarConversaciones(h, convs);
  sembrarUsuarios(h);
  for (const t of [TENANT_A, TENANT_B]) { const r = psqlFile(h.sock, persistenceSql(convs.filter(c => c.tenant === t).map(i => i.p), {tenant: t, commit: true})); if (r.status !== 0) throw Error('persistir: ' + r.stderr.slice(0, 300)); }
  sembrarMiembros(h, convs, TENANT_A); sembrarMiembros(h, convs, TENANT_B);
  const libro = libroSintetico(TENANT_A, {complete});
  cargarLibro(h, libro);
  return {convs, libro};
}
export {psqlFile, TAX, VERSION};
