// Migración 20261211000000_order_returns contra un Postgres LOCAL desechable con las migraciones reales y datos SINTÉTICOS (SYN).
//   node --test packages/ingestion/pedidos/devoluciones-pg.test.mjs
// Verifica: aditiva e idempotente, rollback, ingesta idempotente por lote, paridad SQL-JS de CHECK y de cobertura, aislamiento entre tenants,
// negativas (acción, tenant, roles, columnas inmutables), retención con 'retain', sin columnas de datos personales y volumen (~20,000 filas).
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {withPg, pgAvailable} from '../../metrics/tests/pg-harness.mjs';
import {TENANT_A, TENANT_B, OWNER, sembrarUsuarios, libroSintetico, cargarLibro} from '../../ai-scale/economia-problemas/mundo.mjs';
import {parseReturns, returnToSql, RETURN_LIMITS} from './index.mjs';
import {RETURN_KEY_RE, ITEM_REF_RE, REASON_OK, STATUS_OK, CHANNEL_OK} from './devoluciones.mjs';

const SKIP = !pgAvailable() && 'sin postgres local';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const MIG1 = path.join(HERE, '../../../supabase/migrations/20261210000000_order_links.sql');
const MIG2 = path.join(HERE, '../../../supabase/migrations/20261211000000_order_returns.sql');
const ROLLBACK2 = path.join(HERE, '../../../supabase/operations/20261211000000_order_returns.rollback.sql');
const H64 = c => c.repeat(64);

function asBackend(h, user, tenant, sql, action = 'import') {
  const input = `set role vexa_backend;\nselect set_config('request.jwt.claim.sub','${user}',false) \\gset\nselect set_config('vexa.tenant_id','${tenant}',false) \\gset\nselect set_config('vexa.action','${action}',false) \\gset\n${sql}`;
  const r = spawnSync('psql', ['-h', h.sock, '-U', 'postgres', '-d', 't', '-At', '-q', '-v', 'ON_ERROR_STOP=1', '-f', '-'], {input, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024});
  return {ok: r.status === 0, out: r.stdout.trim(), err: r.stderr.trim()};
}
const ret = (o) => ({retailer: 'amazon', return_key: 'R', order_key: null, reason: 'CR-DEFECTIVE', status: 'Approved', requested_at: '2026-01-10', status_at: null, item_ref: 'B0SYN00001', qty: 1, has_return_tracking: false, channel: null, row_hash: H64('a'), ...o});
const ship = (o) => ({shipment_kind: 'garantia', carrier: 'ups', tracking: 'X', ship_date: '2026-01-05', created_date: null, reason: null, sku: null, order_key: null, order_format: null, order_source: null, retailer: 'unknown', retailer_basis: 'unknown', row_hash: H64('c'), ...o});
const json = o => `'${JSON.stringify(o).replace(/'/g, "''")}'::jsonb`;
const mes = d => d.slice(0, 7) + '-01';

// Oráculo JS de order_returns_coverage: por (retailer, mes) con las mismas filas que ve la base.
function oracle(returns, ledgerKeys, shipKeys) {
  const L = new Set(ledgerKeys.map(k => k.join('\u0000'))), S = new Set(shipKeys.map(k => k.join('\u0000'))), m = new Map();
  for (const r of returns) {
    const k = `${r.retailer}|${mes(r.requested_at)}`, a = m.get(k) ?? {retailer: r.retailer, mes: mes(r.requested_at), devoluciones: 0, sin_id: 0, con_pedido: 0, con_envio: 0};
    a.devoluciones++; if (!r.order_key) a.sin_id++; else { const key = `${r.retailer}\u0000${r.order_key}`; if (L.has(key)) a.con_pedido++; if (S.has(key)) a.con_envio++; }
    m.set(k, a);
  }
  return [...m.values()].map(a => { const den = a.devoluciones - a.sin_id; return {...a, denominador: den, cobertura_pedido: den === 0 ? null : a.con_pedido / den, cobertura_envio: den === 0 ? null : a.con_envio / den}; }).sort((a, b) => a.retailer.localeCompare(b.retailer) || a.mes.localeCompare(b.mes));
}
const normCov = rows => rows.map(x => ({retailer: x.retailer, mes: x.mes, devoluciones: Number(x.devoluciones), sin_id: Number(x.sin_id), denominador: Number(x.denominador), con_pedido: Number(x.con_pedido), con_envio: Number(x.con_envio),
  cobertura_pedido: x.cobertura_pedido === null ? null : Math.round(Number(x.cobertura_pedido) * 1e9) / 1e9, cobertura_envio: x.cobertura_envio === null ? null : Math.round(Number(x.cobertura_envio) * 1e9) / 1e9}));
const COVSQL = `select coalesce(json_agg(c),'[]') from (select retailer,mes::text mes,devoluciones,sin_id,denominador,con_pedido,con_envio,cobertura_pedido,cobertura_envio from public.order_returns_coverage order by 1,2) c;`;

test('order_returns: aditiva, ingesta, cobertura, aislamiento, negativas, retención y volumen', {skip: SKIP, timeout: 900000}, async (t) => {
  await withPg(async (h) => {
    h.psql(`insert into public.organizations(id,name) values('${TENANT_A}','SYN'),('${TENANT_B}','SYNB')`);
    sembrarUsuarios(h);
    cargarLibro(h, libroSintetico(TENANT_A), TENANT_A, OWNER.A); cargarLibro(h, libroSintetico(TENANT_B), TENANT_B, OWNER.B);
    const sinBase = h.file(MIG2); assert.notEqual(sinBase.status, 0, 'sin order_links la migración falla'); assert.match(String(sinBase.stderr), /DEPENDENCIA_FALTANTE/);
    assert.equal(h.psql(`select to_regclass('public.order_returns') is null`).out, 't', 'la guarda no deja nada a medias');
    assert.equal(h.file(MIG1).status, 0, 'order_links (base de esta)');
    const m = h.file(MIG2); assert.equal(m.status, 0, String(m.stderr).slice(0, 800));
    assert.equal(h.file(MIG2).status, 0, 'idempotente');

    await t.test('rollback: quita solo lo suyo y se puede volver a aplicar', () => {
      const r = h.file(ROLLBACK2); assert.equal(r.status, 0, String(r.stderr).slice(0, 600));
      assert.equal(h.psql(`select to_regclass('public.order_returns') is null and to_regclass('public.order_returns_coverage') is null and not exists(select 1 from pg_proc where proname='order_returns_ingest')`).out, 't');
      assert.equal(h.psql(`select to_regclass('public.order_shipments') is not null and to_regclass('public.order_link_coverage') is not null and exists(select 1 from pg_proc where proname='order_id_normalize')`).out, 't', 'order_links intacta');
      assert.equal(h.file(ROLLBACK2).status, 0, 'rollback idempotente'); assert.equal(h.file(MIG2).status, 0, 'reaplicar');
    });

    // Devoluciones sintéticas pasadas por el parser real (CSV Amazon y Walmart).
    const A = ['Order ID', 'Return request date', 'Return request status', 'Amazon RMA ID', 'Order Item ID', 'ASIN', 'Return quantity', 'Return Reason', 'Return type', 'Tracking ID'];
    const W = ['CUSTOMER_ORDER_NO', 'REQUEST_DATE', 'RMA_NO', 'RETURN_ORDER_LINE_NO', 'QUANTITY', 'RETURN_REASON', 'ITEM_ID', 'CURRENT_STATUS', 'CURRENT_STATUS_TIME', 'CHANNEL', 'TRACKING_NUMBER'];
    const pa = parseReturns([A, ['SYN-111-0000001', '10-Jan-2026', 'Approved', 'RMA1', '101', 'B0SYN00001', '1', 'CR-DEFECTIVE', 'C-Returns', 'PRESENT'], ['SYN-111-0000001', '11-Jan-2026', 'Approved', 'RMA2', '102', 'B0SYN00002', '1', 'CR-UNWANTED_ITEM', 'C-Returns', ''], ['SYN-111-0000002', '02-Feb-2026', 'Closed', 'RMA3', '103', 'B0SYN00001', '2', 'CR-DEFECTIVE', 'Amazon CS', ''],
      ['SYN-111-9999999', '03-Feb-2026', 'Approved', 'RMA4', '104', 'B0SYN00001', '1', 'CR-DEFECTIVE', '', ''], ['', '04-Mar-2026', 'Approved', 'RMA5', '105', '', '1', '', '', '']]);
    const pw = parseReturns([W, ['200000000000001', '2026-01-10T10:00:00Z', 'W1', '1', '1', 'Defective', '111', 'Refunded:1', '2026-01-12T00:00:00Z', 'My Account', 'NA'], ['SYN-111-0000001', '2026-01-11T10:00:00Z', 'W2', '1', '1', 'No Longer Wanted', '112', 'Initiated', 'NA', 'In Store', 'PRESENT'], ['2000000000001', '2026-02-11T10:00:00Z', 'W3', '1', '1', 'Damaged', '111', 'Cancelled', '2026-02-12T00:00:00Z', 'Customer Care', 'NA']]);
    assert.equal(pa.returns.length, 5); assert.equal(pw.returns.length, 3);
    const RA = pa.returns.map(returnToSql), RW = pw.returns.map(returnToSql), ALL = [...RA, ...RW];

    await t.test('ingesta idempotente por lote; lo que el parser produce cumple los CHECK', () => {
      let r = asBackend(h, OWNER.A, TENANT_A, `select public.order_returns_ingest(${json(ALL)});`); assert.ok(r.ok, r.err); assert.deepEqual(JSON.parse(r.out), {inserted: 8, updated: 0, unchanged: 0});
      r = asBackend(h, OWNER.A, TENANT_A, `select public.order_returns_ingest(${json(ALL)});`); assert.deepEqual(JSON.parse(r.out), {inserted: 0, updated: 0, unchanged: 8});
      const changed = {...ALL[0], status: 'Closed'}; changed.row_hash = H64('9');
      r = asBackend(h, OWNER.A, TENANT_A, `select public.order_returns_ingest(${json([changed])});`); assert.deepEqual(JSON.parse(r.out), {inserted: 0, updated: 1, unchanged: 0});
      r = asBackend(h, OWNER.A, TENANT_A, `select status from public.order_returns where retailer='amazon' and return_key='${ALL[0].return_key}';`); assert.equal(r.out, 'Closed');
      r = asBackend(h, OWNER.A, TENANT_A, `select public.order_returns_ingest(${json([ALL[0]])});`); assert.deepEqual(JSON.parse(r.out), {inserted: 0, updated: 1, unchanged: 0}, 'volver al contenido original actualiza una vez');
      r = asBackend(h, OWNER.A, TENANT_A, `select public.order_returns_ingest(${json([ALL[0], ALL[0]])});`); assert.equal(r.ok, false); assert.match(r.err, /DUPLICATE_IN_BATCH/);
      r = asBackend(h, OWNER.A, TENANT_A, `select public.order_returns_ingest('[]'::jsonb);`); assert.match(r.err, /BATCH_SIZE_INVALID/);
      r = asBackend(h, OWNER.A, TENANT_A, `select public.order_returns_ingest(${json(Array.from({length: 251}, (_, i) => ret({return_key: 'B' + i})))});`); assert.match(r.err, /BATCH_SIZE_INVALID/);
      r = asBackend(h, OWNER.A, TENANT_A, `select public.order_returns_ingest('{}'::jsonb);`); assert.match(r.err, /INVALID_BATCH/);
      r = asBackend(h, OWNER.A, TENANT_A, `select public.order_returns_ingest(${json([ret({return_key: 'OK1'}), ret({return_key: 'bad key'})])});`); assert.equal(r.ok, false);
      r = asBackend(h, OWNER.A, TENANT_A, 'select count(*) from public.order_returns;'); assert.equal(r.out, '8', 'el lote rechazado no deja filas');
      // Misma llave en otro retailer = otra devolución.
      r = asBackend(h, OWNER.A, TENANT_A, `select public.order_returns_ingest(${json([ret({retailer: 'walmart', return_key: ALL[0].return_key, row_hash: H64('7')})])});`); assert.deepEqual(JSON.parse(r.out), {inserted: 1, updated: 0, unchanged: 0});
      assert.equal(asBackend(h, OWNER.A, TENANT_A, `delete from public.order_returns where false;`, 'retain').ok, true);
      assert.equal(asBackend(h, OWNER.A, TENANT_A, `with d as (delete from public.order_returns where retailer='walmart' and return_key='${ALL[0].return_key}' returning 1) select count(*) from d;`, 'retain').out, '1');
    });

    await t.test('CHECK de la tabla = expresiones regulares del parser (paridad SQL-JS)', () => {
      const casos = {
        return_key: [['A-1|2', true], ['RMA.1_x', true], ['a b', false], ['a|b|c', true], ['ñ1', false], ['x'.repeat(80), true], ['x'.repeat(81), false], ['', false], ['a+b', false]],
        item_ref: [['B0SYN00001', true], ['a b', false], ['x'.repeat(40), true], ['x'.repeat(41), false], ['1.2E+3', false], ['ñ', false]],
        reason: [['CR-DEFECTIVE', true], ['Not As Described/Pictured', true], ["Doesn't fit, wrong size", true], ['a@b', false], ['Razón', false], ['x'.repeat(80), true], ['x'.repeat(81), false], ['a\tb', false], ['a;b', false],
          ['5512345678', false], ['Llamar 5512345678', false], ['ref 123456', false], ['ref 12345', true], ['uno dos tres cuatro cinco seis', true], ['uno dos tres cuatro cinco seis siete', false], ['Calle 5 No 12', true], ['Maria Lopez', true], [' x', false], ['a  b', false], ['x ', false]],
        status: [['Refund Now', true], ['PENDING_RETURN_POST_INVOICE', true], ['Refunded:1', false], ['Refunded1', false], ['a,b', false], ['x'.repeat(40), true], ['x'.repeat(41), false], ['uno dos tres cuatro', true], ['uno dos tres cuatro cinco', false], ['a  b', false], [' x', false]],
        channel: [['My Account', true], ['Chatbot_Returns', true], ['Channel 2', false], ['5512345678', false], ['uno dos tres cuatro cinco', false], ['In Store', true], ['x'.repeat(41), false]],
      };
      const lenOk = (re, max) => v => v.length >= 1 && v.length <= max && re.test(v);
      const RE = {return_key: lenOk(RETURN_KEY_RE, 80), item_ref: lenOk(ITEM_REF_RE, 40), reason: REASON_OK, status: STATUS_OK, channel: CHANNEL_OK};
      let n = 0;
      for (const [col, list] of Object.entries(casos)) for (const [v, esperado] of list) {
        const js = RE[col](v); assert.equal(js, esperado, `JS ${col} ${JSON.stringify(v)}`);
        const r = asBackend(h, OWNER.A, TENANT_A, `select public.order_returns_ingest(${json([ret({return_key: col === 'return_key' ? v : 'P' + n, [col]: v, row_hash: H64('b')})])});`);
        assert.equal(r.ok, esperado, `SQL ${col} ${JSON.stringify(v)} ${r.err.slice(0, 120)}`); n++;
        if (r.ok) asBackend(h, OWNER.A, TENANT_A, `delete from public.order_returns where return_key=${col === 'return_key' ? `$q$${v}$q$` : `'P${n - 1}'`};`, 'retain');
      }
      assert.equal(asBackend(h, OWNER.A, TENANT_A, `select public.order_returns_ingest(${json([ret({return_key: 'Q1', qty: 0})])});`).ok, false); assert.equal(asBackend(h, OWNER.A, TENANT_A, `select public.order_returns_ingest(${json([ret({return_key: 'Q2', qty: 100001})])});`).ok, false);
      assert.equal(asBackend(h, OWNER.A, TENANT_A, `select public.order_returns_ingest(${json([ret({return_key: 'Q3', order_key: 'a b'})])});`).ok, false, 'order_key no normalizado se rechaza');
      assert.equal(asBackend(h, OWNER.A, TENANT_A, `select public.order_returns_ingest(${json([ret({return_key: 'Q4', retailer: 'unknown'})])});`).ok, false, 'retailer unknown no se acepta');
      assert.equal(asBackend(h, OWNER.A, TENANT_A, `select public.order_returns_ingest(${json([ret({return_key: 'Q5', retailer: 'Amazon.com'})])});`).ok, false, 'retailer no canónico');
      assert.equal(asBackend(h, OWNER.A, TENANT_A, `select public.order_returns_ingest(${json([ret({return_key: 'Q6', requested_at: null})])});`).ok, false, 'fecha de solicitud obligatoria');
      assert.equal(asBackend(h, OWNER.A, TENANT_A, `select public.order_returns_ingest(${json([ret({return_key: 'Q7', requested_at: '2026-02-30'})])});`).ok, false, 'fecha imposible');
      assert.equal(asBackend(h, OWNER.A, TENANT_A, 'select count(*) from public.order_returns;').out, '8');
    });

    await t.test('cobertura SQL = oráculo JS; unknown != zero; retailer es parte de la llave; la llave de 15 dígitos Walmart une con el envío', () => {
      const sh = [ship({tracking: 'T1', order_key: 'SYN-111-0000001', retailer: 'amazon', retailer_basis: 'format'}), ship({tracking: 'T2', order_key: '200000000000001', retailer: 'walmart', retailer_basis: 'format'}), ship({tracking: 'T3', order_key: 'SYN-111-0000002'})];
      let r = asBackend(h, OWNER.A, TENANT_A, `select public.order_shipments_ingest(${json(sh)});`); assert.ok(r.ok, r.err);
      r = asBackend(h, OWNER.A, TENANT_A, COVSQL); assert.ok(r.ok, r.err);
      const sql = JSON.parse(r.out);
      const rows = q => asBackend(h, OWNER.A, TENANT_A, q).out.split('\n').filter(Boolean).map(l => l.split('|'));
      const ledger = rows(`select retailer,order_key from public.order_ledger_keys where order_key is not null and retailer<>'unknown';`), ships = rows(`select retailer,order_key from public.order_shipments where order_key is not null and retailer<>'unknown';`);
      const filas = rows(`select retailer,coalesce(order_key,''),requested_at from public.order_returns;`).map(([retailer, k, d]) => ({retailer, order_key: k || null, requested_at: d}));
      assert.equal(filas.length, 8);
      assert.deepEqual(normCov(sql), normCov(oracle(filas, ledger, ships)));
      // valores concretos (el libro sintético trae amazon SYN-111-0000001..4)
      const g = (ret, m) => sql.find(x => x.retailer === ret && x.mes === m);
      assert.deepEqual([g('amazon', '2026-01-01').devoluciones, g('amazon', '2026-01-01').con_pedido, g('amazon', '2026-01-01').con_envio, Number(g('amazon', '2026-01-01').cobertura_pedido)], [2, 2, 2, 1]);
      assert.deepEqual([g('amazon', '2026-02-01').devoluciones, g('amazon', '2026-02-01').sin_id, g('amazon', '2026-02-01').denominador, g('amazon', '2026-02-01').con_pedido, g('amazon', '2026-02-01').con_envio], [2, 0, 2, 1, 0]);
      assert.equal(Number(g('amazon', '2026-02-01').cobertura_pedido), 0.5);
      assert.deepEqual([g('amazon', '2026-03-01').devoluciones, g('amazon', '2026-03-01').sin_id, g('amazon', '2026-03-01').denominador, g('amazon', '2026-03-01').cobertura_pedido, g('amazon', '2026-03-01').cobertura_envio], [1, 1, 0, null, null], 'solo «sin ID»: cobertura NULL, nunca 0 %');
      assert.deepEqual([g('walmart', '2026-01-01').devoluciones, g('walmart', '2026-01-01').con_envio, g('walmart', '2026-01-01').con_pedido], [2, 1, 0], 'W1 liga con el envío walmart; W2 trae un pedido de formato Amazon bajo walmart: otro retailer NO liga');
      assert.equal(g('walmart', '2026-02-01').con_envio, 0);
      assert.ok(!('ventas' in sql[0]) && !Object.keys(sql[0]).some(k => /venta|sales/i.test(k)), 'nunca un % de ventas');
    });

    await t.test('aislamiento: B no ve lo de A, el mismo RMA de B no pisa el de A, y A no escribe en B', () => {
      let r = asBackend(h, OWNER.B, TENANT_B, 'select count(*) from public.order_returns;'); assert.equal(r.out, '0');
      r = asBackend(h, OWNER.B, TENANT_B, COVSQL); assert.equal(r.out, '[]');
      r = asBackend(h, OWNER.B, TENANT_B, `select public.order_returns_ingest(${json([{...ALL[0]}])});`); assert.ok(r.ok, r.err);
      r = asBackend(h, OWNER.A, TENANT_A, `select count(*) from public.order_returns where return_key='${ALL[0].return_key}' and retailer='amazon';`); assert.equal(r.out, '1');
      assert.equal(asBackend(h, OWNER.A, TENANT_A, `select status from public.order_returns where return_key='${ALL[0].return_key}' and retailer='amazon';`).out, 'Approved', 'el de A conserva su estado (B no lo pisa)');
      r = asBackend(h, OWNER.A, TENANT_A, `insert into public.order_returns(tenant_id,retailer,return_key,requested_at,row_hash) values('${TENANT_B}','amazon','ZB','2026-01-01','${H64('d')}');`); assert.equal(r.ok, false); assert.match(r.err, /row-level security/);
      r = asBackend(h, OWNER.A, TENANT_B, 'select count(*) from public.order_returns;'); assert.equal(r.out, '0', 'dueño de A con tenant B en sesión: no es miembro');
    });

    await t.test('negativas: sin acción import, sin tenant, roles sin acceso, columnas inmutables y sin datos personales', () => {
      let r = asBackend(h, OWNER.A, TENANT_A, `select public.order_returns_ingest(${json([ret({return_key: 'N1'})])});`, 'read'); assert.equal(r.ok, false);
      r = asBackend(h, OWNER.A, '', `select public.order_returns_ingest(${json([ret({return_key: 'N2'})])});`); assert.equal(r.ok, false);
      r = asBackend(h, OWNER.A, TENANT_A, 'with d as (delete from public.order_returns returning 1) select count(*) from d;'); assert.equal(r.out, '0', 'con acción import no se borra nada (RLS exige retain)');
      for (const role of ['anon', 'authenticated', 'service_role']) for (const obj of ['order_returns', 'order_returns_coverage']) assert.equal(h.psql(`set role ${role}; select * from public.${obj};`).ok, false, role + ' ' + obj);
      assert.equal(h.psql(`set role anon; select public.order_returns_ingest('[]'::jsonb);`).ok, false); assert.equal(h.psql(`set role authenticated; select public.order_returns_ingest('[]'::jsonb);`).ok, false);
      for (const col of ['tenant_id', 'retailer', 'return_key', 'id', 'created_at'])
        assert.equal(asBackend(h, OWNER.A, TENANT_A, `update public.order_returns set ${col}=${col};`).ok, false, 'columna inmutable ' + col);
      assert.equal(h.psql(`select count(*) from information_schema.columns where table_schema='public' and table_name='order_returns' and column_name <> 'has_return_tracking' and column_name ~* 'name|nombre|address|domicilio|zip|email|correo|phone|tel|comment|coment|track|seguim|sku|product|titulo|title|item_name'`).out, '0', 'sin columnas de datos personales ni de producto');
      assert.equal(h.psql(`select data_type from information_schema.columns where table_schema='public' and table_name='order_returns' and column_name='has_return_tracking'`).out, 'boolean', 'el tracking es solo un booleano');
      assert.equal(h.psql(`select relrowsecurity and relforcerowsecurity from pg_class where oid='public.order_returns'::regclass`).out, 't', 'RLS forzada');
      assert.equal(h.psql(`select count(*) from pg_proc p where p.proname='order_returns_ingest' and (p.prosecdef or p.proconfig is null or not p.proconfig::text like '%search_path%')`).out, '0', 'invoker con search_path vacío');
      assert.equal(h.psql(`select count(*) from pg_class where oid='public.order_returns_coverage'::regclass and reloptions::text like '%security_invoker=true%'`).out, '1');
    });

    await t.test('retención: el borrado exige la acción retain y no cruza tenants', () => {
      const del = (user, tenant, action, where = 'true') => asBackend(h, user, tenant, `with d as (delete from public.order_returns where ${where} returning 1) select count(*) from d;`, action);
      assert.equal(del(OWNER.A, TENANT_A, 'import').out, '0'); assert.equal(del(OWNER.A, TENANT_A, 'read').out, '0');
      assert.equal(del(OWNER.A, TENANT_B, 'retain').out, '0', 'dueño de A con tenant B en sesión no es miembro');
      assert.equal(asBackend(h, OWNER.A, TENANT_A, 'select count(*) from public.order_returns;').out, '8', 'lo de A sigue intacto');
      assert.equal(del(OWNER.B, TENANT_B, 'retain').out, '1', 'B solo borra lo suyo');
      assert.equal(del(OWNER.A, TENANT_A, 'retain', `retailer='walmart' and return_key like 'W3%'`).out, '1');
      assert.equal(asBackend(h, OWNER.A, TENANT_A, 'select count(*) from public.order_returns;').out, '7');
      for (const role of ['anon', 'authenticated', 'service_role']) assert.equal(h.psql(`set role ${role}; delete from public.order_returns;`).ok, false, role + ' no borra');
    });

    await t.test('volumen: ~20,000 devoluciones con pedidos y envíos corren en segundos y dan lo mismo que el oráculo', () => {
      const N = 20000, B = TENANT_B;
      let r = h.psql(`set session_replication_role=replica; insert into public.economic_ledger_entries select (jsonb_populate_record(null::public.economic_ledger_entries, to_jsonb(e) || jsonb_build_object('id',gen_random_uuid(),'entity_id',gen_random_uuid(),'external_id','walmart|2000'||lpad(g::text,11,'0')||'|SKU-V'))).* from (select * from public.economic_ledger_entries where tenant_id='${B}' and kind='order' and external_id like 'amazon|%' limit 1) e, generate_series(1,${N}) g;`);
      assert.ok(r.ok, r.err);
      r = h.psql(`insert into public.order_shipments(tenant_id,carrier,tracking,order_key,retailer,retailer_basis,row_hash) select '${B}','ups','V'||g,'2000'||lpad(g::text,11,'0'),'walmart','format','${H64('e')}' from generate_series(1,${N}) g where g%3=0;`); assert.ok(r.ok, r.err);
      // 1/4 sin ID; 1/2 con pedido real del libro; resto a un ID inexistente; 24 meses; dos retailers
      r = h.psql(`insert into public.order_returns(tenant_id,retailer,return_key,order_key,requested_at,row_hash) select '${B}',case when g%5=0 then 'amazon' else 'walmart' end,'VR'||g,
        case when g%4=0 then null when g%2=0 then '2000'||lpad(g::text,11,'0') else '3000'||lpad(g::text,11,'0') end, date '2025-01-15'+(g%700), '${H64('f')}' from generate_series(1,${N}) g;`); assert.ok(r.ok, r.err);
      const t0 = Date.now(); r = asBackend(h, OWNER.B, B, COVSQL); const ms = Date.now() - t0; assert.ok(r.ok, r.err);
      assert.ok(ms < 5000, `order_returns_coverage con ${N} devoluciones tardó ${ms} ms`);
      const rows = q => asBackend(h, OWNER.B, B, q).out.split('\n').filter(Boolean).map(l => l.split('|'));
      const ledger = rows(`select retailer,order_key from public.order_ledger_keys where order_key is not null and retailer<>'unknown';`), ships = rows(`select retailer,order_key from public.order_shipments where order_key is not null and retailer<>'unknown';`);
      const filas = rows(`select retailer,coalesce(order_key,''),requested_at from public.order_returns;`).map(([retailer, k, d]) => ({retailer, order_key: k || null, requested_at: d}));
      assert.ok(ledger.length >= N && filas.length === N && ships.length >= N / 3 - 1, `filas leídas: ${ledger.length}/${filas.length}/${ships.length}`);
      assert.deepEqual(normCov(JSON.parse(r.out)), normCov(oracle(filas, ledger, ships)));
      console.log(`# volumen: ${N} devoluciones, order_returns_coverage en ${ms} ms`);
    });
  }, {name: 'devoluciones', upto: 55});
});
