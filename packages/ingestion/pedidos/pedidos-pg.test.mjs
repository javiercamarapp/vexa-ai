// Migración 20261210000000_order_links contra un Postgres LOCAL desechable con las migraciones reales y datos SINTÉTICOS (SYN).
//   node --test packages/ingestion/pedidos/pedidos-pg.test.mjs
// Verifica: paridad SQL-JS del normalizador, cobertura SQL = oráculo JS, aislamiento entre tenants y negativas (sin acción import, no miembro, roles sin acceso).
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {withPg, pgAvailable} from '../../metrics/tests/pg-harness.mjs';
import {TENANT_A, TENANT_B, OWNER, sembrarUsuarios, libroSintetico, cargarLibro} from '../../ai-scale/economia-problemas/mundo.mjs';
import {normalizeOrderId, normalizeRetailer, linkCoverage} from './index.mjs';

const SKIP = !pgAvailable() && 'sin postgres local';
const MIGF = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../../supabase/migrations/20261210000000_order_links.sql');
const H64 = c => c.repeat(64);

function asBackend(h, user, tenant, sql, action = 'import') {
  const input = `set role vexa_backend;\nselect set_config('request.jwt.claim.sub','${user}',false) \\gset\nselect set_config('vexa.tenant_id','${tenant}',false) \\gset\nselect set_config('vexa.action','${action}',false) \\gset\n${sql}`;
  const r = spawnSync('psql', ['-h', h.sock, '-U', 'postgres', '-d', 't', '-At', '-q', '-v', 'ON_ERROR_STOP=1', '-f', '-'], {input, encoding: 'utf8'});
  return {ok: r.status === 0, out: r.stdout.trim(), err: r.stderr.trim()};
}
const ship = (o) => ({carrier: 'ups', tracking: 'X', ship_date: '2026-01-05', created_date: null, reason: 'Defective', sku: 'SKU-A', order_key: null, order_format: null, order_source: null, retailer: 'unknown', retailer_basis: 'unknown', row_hash: H64('a'), ...o});
const tick = (o) => ({ticket_external_id: 't', order_key: null, retailer: 'unknown', purchase_date: null, sku: null, tool_family: null, country: null, contact_reason: null, row_hash: H64('b'), ...o});
const json = o => `'${JSON.stringify(o).replace(/'/g, "''")}'::jsonb`;

test('order_links: paridad, cobertura, aislamiento y negativas', {skip: SKIP, timeout: 600000}, async (t) => {
  await withPg(async (h) => {
    h.psql(`insert into public.organizations(id,name) values('${TENANT_A}','SYN'),('${TENANT_B}','SYNB')`);
    sembrarUsuarios(h);
    cargarLibro(h, libroSintetico(TENANT_A), TENANT_A, OWNER.A); cargarLibro(h, libroSintetico(TENANT_B), TENANT_B, OWNER.B);
    const m = h.file(MIGF); assert.equal(m.status, 0, String(m.stderr).slice(0, 800));
    assert.equal(h.file(MIGF).status, 0, 'idempotente');

    await t.test('paridad SQL-JS del normalizador', () => {
      const vectores = ['113-5268979-5206610', ' 113–5268979–5206610 ', 'Reference 2 - 113-5268979-5206610', '1135268979 5206610', '261962365-a', 'Reference 2 - wn56823848', 'WH28882973', '109012345678901.0', '1.09012345678901E+14', 'Order ID: #abc-1234', 'N/A', 'none', '0000', '-', 'ab', 'A B!C', '--ABC--123--', '', '  '];
      for (const v of vectores) {
        const r = h.psql(`select coalesce(public.order_id_normalize($q$${v}$q$),'<null>')`); assert.ok(r.ok, r.err);
        assert.equal(r.out, normalizeOrderId(v) ?? '<null>', JSON.stringify(v));
      }
      for (const v of ['Amazon.com', 'Best Buy', 'WALMART', 'Home Depot', "Lowe's", 'Tienda Rara', '  ']) {
        const r = h.psql(`select coalesce(public.order_retailer_normalize($q$${v}$q$),'<null>')`); assert.ok(r.ok, r.err);
        assert.equal(r.out, normalizeRetailer(v) ?? '<null>', JSON.stringify(v));
      }
    });

    // Datos del tenant A. Pedidos del libro: amazon SYN-111-0000001..4 (O3a y O3b son el mismo pedido) y un gid de Shopify (sin ID).
    const SH = [ship({tracking: 'T1', order_key: 'SYN-111-0000001', retailer: 'amazon', retailer_basis: 'format'}), ship({tracking: 'T2', order_key: 'SYN-111-0000001', retailer: 'amazon', retailer_basis: 'format', row_hash: H64('c')}),
      ship({tracking: 'T3', order_key: 'WN56823848'}), ship({tracking: 'T4', order_key: 'SYN-111-0000002'}), ship({tracking: 'T5'}), ship({tracking: 'T6', order_key: 'SYN-111-9999999', retailer: 'amazon', retailer_basis: 'format'})];
    const TK = [tick({ticket_external_id: '1', order_key: 'SYN-111-0000001', retailer: 'amazon'}), tick({ticket_external_id: '2', order_key: 'SYN-111-0000001', retailer: 'walmart'}), tick({ticket_external_id: '3'}), tick({ticket_external_id: '4', order_key: 'SYN-111-0000003', retailer: 'amazon'})];
    await t.test('ingesta idempotente por lote', () => {
      let r = asBackend(h, OWNER.A, TENANT_A, `select public.order_shipments_ingest(${json(SH)});`); assert.ok(r.ok, r.err); assert.deepEqual(JSON.parse(r.out), {inserted: 6, updated: 0, unchanged: 0});
      r = asBackend(h, OWNER.A, TENANT_A, `select public.order_shipments_ingest(${json(SH)});`); assert.deepEqual(JSON.parse(r.out), {inserted: 0, updated: 0, unchanged: 6});
      r = asBackend(h, OWNER.A, TENANT_A, `select public.ticket_order_refs_ingest(${json(TK)});`); assert.ok(r.ok, r.err); assert.deepEqual(JSON.parse(r.out), {inserted: 4, updated: 0, unchanged: 0});
      r = asBackend(h, OWNER.A, TENANT_A, `select public.order_shipments_ingest(${json([SH[0], SH[0]])});`); assert.equal(r.ok, false); assert.match(r.err, /DUPLICATE_IN_BATCH/);
      r = asBackend(h, OWNER.A, TENANT_A, `select public.order_shipments_ingest(${json([ship({tracking: 'Z', order_key: 'a b'})])});`); assert.equal(r.ok, false, 'order_key no normalizado se rechaza');
      r = asBackend(h, OWNER.A, TENANT_A, 'select count(*) from public.order_shipments;'); assert.equal(r.out, '6', 'el lote rechazado no deja filas');
    });
    await t.test('cobertura SQL = oráculo JS (unknown != zero, retailer es parte de la llave)', () => {
      const r = asBackend(h, OWNER.A, TENANT_A, `select coalesce(json_agg(c),'[]') from (select retailer,entidad,total,ligados,sin_id,sin_ligar,coalesce(candidatos,-1) candidatos from public.order_link_coverage order by 1,2) c;`); assert.ok(r.ok, r.err);
      const sql = JSON.parse(r.out);
      const orders = ['SYN-111-0000001', 'SYN-111-0000002', 'SYN-111-0000003', 'SYN-111-0000003', 'SYN-111-0000004'].map((k, i) => ({entityId: 'o' + i, retailer: 'amazon', orderKey: k})).concat([{entityId: 'sh', retailer: 'unknown', orderKey: null}]);
      const js = linkCoverage({orders, tickets: TK.map(x => ({ticketId: x.ticket_external_id, retailer: x.retailer, orderKey: x.order_key})), shipments: SH.map(x => ({id: x.tracking, retailer: x.retailer, orderKey: x.order_key}))})
        .filter(x => x.total > 0).map(x => ({retailer: x.retailer, entidad: x.entidad, total: x.total, ligados: x.ligados, sin_id: x.sin_id, sin_ligar: x.sin_ligar, candidatos: x.candidatos ?? -1})).sort((a, b) => a.retailer.localeCompare(b.retailer) || a.entidad.localeCompare(b.entidad));
      const norm = rows => rows.map(x => ({...x, total: Number(x.total), ligados: Number(x.ligados), sin_id: Number(x.sin_id), sin_ligar: Number(x.sin_ligar), candidatos: Number(x.candidatos)}));
      assert.deepEqual(norm(sql), js);
      const am = sql.find(x => x.retailer === 'amazon' && x.entidad === 'pedidos'); assert.equal(Number(am.total), 4); assert.equal(Number(am.ligados), 2);
    });
    await t.test('aislamiento: B no ve ni cuenta lo de A, y A no escribe en B', () => {
      let r = asBackend(h, OWNER.B, TENANT_B, 'select count(*) from public.order_shipments;'); assert.equal(r.out, '0');
      r = asBackend(h, OWNER.B, TENANT_B, 'select count(*) from public.ticket_order_refs;'); assert.equal(r.out, '0');
      r = asBackend(h, OWNER.B, TENANT_B, "select sum(ligados) from public.order_link_coverage where entidad<>'pedidos';"); assert.ok(r.out === '' || r.out === '0', 'B sin ligas: ' + r.out);
      r = asBackend(h, OWNER.B, TENANT_B, `select public.ticket_order_refs_ingest(${json([tick({ticket_external_id: '1', order_key: 'SYN-111-0000001', retailer: 'amazon'})])});`); assert.ok(r.ok, r.err);
      r = asBackend(h, OWNER.A, TENANT_A, 'select count(*) from public.ticket_order_refs;'); assert.equal(r.out, '4', 'el ticket «1» de B no pisa el de A');
      r = asBackend(h, OWNER.A, TENANT_A, `insert into public.order_shipments(tenant_id,carrier,tracking,row_hash) values('${TENANT_B}','ups','ZB','${H64('d')}');`); assert.equal(r.ok, false); assert.match(r.err, /row-level security/);
      r = asBackend(h, OWNER.A, TENANT_B, 'select count(*) from public.order_shipments;'); assert.equal(r.out, '0', 'dueño de A con tenant B en sesión: no es miembro');
    });
    await t.test('negativas: sin acción import, sin tenant, y roles sin acceso', () => {
      let r = asBackend(h, OWNER.A, TENANT_A, `select public.order_shipments_ingest(${json([ship({tracking: 'N1'})])});`, 'read'); assert.equal(r.ok, false);
      r = asBackend(h, OWNER.A, '', `select public.order_shipments_ingest(${json([ship({tracking: 'N2'})])});`); assert.equal(r.ok, false);
      r = asBackend(h, OWNER.A, TENANT_A, 'delete from public.order_shipments;'); assert.equal(r.ok, false, 'vexa_backend no borra');
      for (const role of ['anon', 'authenticated', 'service_role'])
        for (const tab of ['order_shipments', 'ticket_order_refs', 'order_link_coverage', 'order_ledger_keys']) assert.equal(h.psql(`set role ${role}; select * from public.${tab};`).ok, false, role + ' ' + tab);
      assert.equal(h.psql(`set role anon; select public.order_shipments_ingest('[]'::jsonb);`).ok, false);
      assert.equal(h.psql(`select count(*) from information_schema.columns where table_name in ('order_shipments','ticket_order_refs') and (column_name ~ 'name|address|zip|email|phone')`).out, '0', 'sin columnas de datos personales');
    });
  }, {name: 'pedidos', upto: 55});
});
