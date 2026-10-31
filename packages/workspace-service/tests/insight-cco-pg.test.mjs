// Agregados insight_cco_* contra un Postgres LOCAL desechable con las migraciones reales y datos SINTÉTICOS (SYN, sin clientes).
//   node --test packages/workspace-service/tests/insight-cco-pg.test.mjs
// Verifica: aislamiento entre organizaciones, mínimo de 5 casos por celda (y pliegue), lo desconocido como NULL (nunca 0), sumas que cuadran contra la verdad en JS,
// ventana común por canal con meses completos, hoja espejo excluida, última versión del Tracker y paridad SQL-JS de los catálogos cerrados.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {withPg, pgAvailable} from '../../metrics/tests/pg-harness.mjs';
import {TENANT_A, TENANT_B, OWNER, ANALYST_A, U, psqlFile, sembrarUsuarios} from '../../ai-scale/economia-problemas/mundo.mjs';
import {sourcesSql} from '../../economics/emit-sql.mjs';
import {HERE} from '../../metrics/tests/world.mjs';
import {subcanalDe, bodegaDe, latenciaDe, defectoDe, skuBaseDe, hojaDeTracker} from '../cco.mjs';
import {retailerDe} from '../fuga-reembolsos.mjs';
import {baseDeSubcanal, armarCco, createCcoRepository, modalidadDeSubcanal} from '../cco.mjs';
import {crearBaseDatos} from '../../ai-scale/economia-problemas/snapshot.mjs';
import {createRequire} from 'node:module';
import {usarCatalogoSintetico} from './cco-catalogo-sintetico.mjs';
import {catalogoBodegasJson} from '../cco.mjs';

// Prefijo SINTÉTICO del retailer propio: en producción sale de VEXA_TIENDA_PROPIA_PREFIJO (fuera del repo). El JS lo lee del entorno y el SQL de la sesión.
let UC_PARIDAD = null; // organización del ensayo de paridad (la usa la prueba de prefijo vacío)
const PREFIJO = 'tienda-piloto';
process.env.VEXA_TIENDA_PROPIA_PREFIJO = PREFIJO;
// Catálogo SINTÉTICO de bodegas: en producción sale de VEXA_CCO_CATALOGO (fuera del repo). El JS lo lee del entorno y el SQL de la sesión (vexa.cco_catalogo_bodegas).
usarCatalogoSintetico();

const SKIP = !pgAvailable() && 'sin postgres local';
const MIG = (f) => path.join(HERE, '../../../supabase/migrations', f);
const REP = 'SYN libro: registro sintético de prueba con procedencia documentada, sin datos de clientes.';
const CONN_A = 'cccccccc-0000-4000-8000-0000000000a1', CONN_B = 'cccccccc-0000-4000-8000-0000000000b1';
const hex = (s) => spawnSync('sha256sum', {input: String(s), encoding: 'utf8'}).stdout.slice(0, 64);

// ---- fuentes con ventanas DISTINTAS por canal, todas incompletas (como el libro real) ----
const src = (n, name, type, ws, we) => ({sourceId: U(n), name, evidenceType: type, active: true, complete: false, windowStart: ws + 'T00:00:00.000Z', windowEnd: we + 'T00:00:00.000Z', watermark: we + 'T00:00:00.000Z', report: REP + ' ' + name});
const FUENTES_A = {
  amP: src(7001, 'SYN Amazon pedidos', 'order_export', '2025-10-01', '2026-10-02'), amR: src(7002, 'SYN Amazon devoluciones', 'payment_ledger', '2025-10-01', '2026-10-02'),
  waP: src(7003, 'SYN Walmart pedidos', 'order_export', '2026-04-05', '2026-10-02'), waR: src(7004, 'SYN Walmart devoluciones', 'payment_ledger', '2026-07-04', '2026-10-02'),
  bbP: src(7005, 'SYN Mirakl Best Buy pedidos', 'order_export', '2026-02-14', '2026-10-02'),
  shP: src(7006, 'SYN Shopify pedidos', 'order_export', '2026-08-01', '2026-10-06'), shR: src(7007, 'SYN Shopify reembolsos', 'payment_ledger', '2026-08-01', '2026-10-06'),
};
const FUENTE_B = {amP: src(7101, 'SYN Amazon pedidos', 'order_export', '2025-10-01', '2026-10-02'), amR: src(7102, 'SYN Amazon devoluciones', 'payment_ledger', '2025-10-01', '2026-10-02')};

// ---- libro sintético: [fuente, canal, tipo, SKU, mes, cantidad, importe|null, moneda, estado, día] ----
const LIBRO_A = [
  ['amP', 'amazon', 'order', 'S1', '2026-07', 4, 1000, 'USD', 'recorded', 15], ['amP', 'amazon', 'order', 'S1-WM12', '2026-08', 4, 1000, 'USD', 'recorded', 15], ['amP', 'amazon', 'order', 'S1', '2026-10', 3, 1000, 'USD', 'recorded', 2],
  ['amP', 'amazon', 'order', 'S1', '2026-08', 1, 1300, 'CAD', 'recorded', 16],
  ['amP', 'amazon', 'order', 'S2', '2026-08', 1, 500, 'USD', 'recorded', 15], ['amP', 'amazon', 'order', 'S2', '2026-08', 1, 500, 'USD', 'cancelled', 17], ['amP', 'amazon', 'order', 'S2', '2025-12', 6, 200, 'USD', 'recorded', 15],
  ['amP', 'amazon', 'order', 'PS-1', '2026-03', 5, 300, 'USD', 'recorded', 15], ['amP', 'amazon', 'order', 'S5', '2026-08', 2, 400, 'USD', 'recorded', 15],
  ['waP', 'walmart', 'order', 'S1', '2026-06', 3, 900, 'USD', 'recorded', 15], ['waP', 'walmart', 'order', 'S1', '2026-07', 2, 900, 'USD', 'recorded', 15], ['waP', 'walmart', 'order', 'S1', '2026-08', 5, 900, 'USD', 'recorded', 15],
  ['waP', 'walmart', 'order', 'S1', '2026-09', 5, 900, 'USD', 'recorded', 15], ['waP', 'walmart', 'order', 'S4', '2026-06', 2, 700, 'USD', 'recorded', 15],
  ['bbP', 'bestbuy', 'order', '', '2026-08', 3, 700, 'USD', 'recorded', 15], ['shP', 'shopify', 'order', '', '2026-08', 2, 5000, 'USD', 'recorded', 15],
  ['amR', 'amazon', 'refund', 'S1', '2026-07', 1, 1000, 'USD', 'unknown', 15], ['amR', 'amazon', 'refund', 'S1', '2026-07', 1, null, 'USD', 'unknown', 16], ['amR', 'amazon', 'refund', 'S1', '2026-08', 1, 1000, 'USD', 'unknown', 15],
  ['amR', 'amazon', 'refund', 'S5', '2026-08', 2, null, 'USD', 'unknown', 15], ['amR', 'amazon', 'refund', 'S2', '2026-08', 1, 500, 'USD', 'cancelled', 15],
  ['waR', 'walmart', 'refund', 'S1', '2026-07', 4, 900, 'USD', 'settled', 15], ['waR', 'walmart', 'refund', 'S1', '2026-08', 2, 900, 'USD', 'settled', 15], ['waR', 'walmart', 'refund', 'S1', '2026-09', 1, 900, 'USD', 'settled', 15],
  ['shR', 'shopify', 'refund', '', '2026-08', 1, 5000, 'USD', 'settled', 15],
];
const LIBRO_B = [['amP', 'amazon', 'order', 'ZZ-B', '2026-08', 7, 1111, 'USD', 'recorded', 15], ['amR', 'amazon', 'refund', 'ZZ-B', '2026-08', 3, 1111, 'USD', 'unknown', 15]];

function extId(ch, kind, sku, i) {
  if (ch === 'amazon') return kind === 'order' ? `amazon|ORD${i}|${sku}` : `amazon|k${i}||${sku}`;
  if (ch === 'walmart') return kind === 'order' ? `walmart|${100000 + i}|${sku}` : `walmart|${100000 + i}|1|${sku}`;
  if (ch === 'bestbuy') return `mirakl_bestbuy_us|ORD${i}|1`;
  return kind === 'order' ? `gid://shopify/Order/${i}` : `gid://shopify/Refund/${i}`;
}
function sembrarLibro(h, tenant, actor, libro, fuentes, tag) {
  let i = 0; const vals = [];
  for (const [f, ch, kind, sku, mes, n, amt, cur, st, dd] of libro) for (let k = 0; k < n; k++) {
    i++; const day = String(dd).padStart(2, '0');
    vals.push(`('${tenant}',md5('${tag}e${i}')::uuid,'${fuentes[f].sourceId}',1,1,'${actor}',timestamptz '2026-10-03'+interval '${i} minutes','${extId(ch, kind, sku, i)}','${kind}',timestamptz '${mes}-${day} 12:00:00+00','${cur}',2,'${kind === 'order' ? 'marketplace_line_price' : 'marketplace_refund_amount'}',${amt ?? 'null'},'${st}','{}'::jsonb,'${REP}','${hex(tag + i)}',true)`);
  }
  const r = psqlFile(h.sock, `set session_replication_role=replica;alter table public.economic_ledger_entries disable trigger user;
   insert into public.economic_ledger_entries(tenant_id,entity_id,source_id,source_version,revision,actor_id,recorded_at,external_id,kind,effective_at,currency,exponent,basis,amount_minor,status,details,report,report_hash,attested) values ${vals.join(',')};
   alter table public.economic_ledger_entries enable trigger user;`);
  if (r.status !== 0) throw Error('libro: ' + String(r.stderr).slice(0, 500));
}

// ---- Tracker sintético ----
const R = (n, v) => Array.from({length: n}, () => ({...v}));
const HOJAS_A = {
  'Warranty Parts': {cols: ['Retailer', 'Part SKU', 'Contact_reason', 'Subreason', 'WH', 'SLA Status', 'Customer_address'], filas: [
    ...R(6, {Retailer: 'Amazon :: fulfilled by Tienda-Piloto', 'Part SKU': 'ps-1-WM2', Contact_reason: 'Defective', WH: 'DEMO-N1', 'SLA Status': 'tracking enviado después de 2 días', Customer_address: 'x'}),
    ...R(3, {Retailer: 'Walmart :: fulfilled by Walmart', 'Part SKU': 'PS-2', Contact_reason: 'Defective', WH: 'Betta', 'SLA Status': ''}),
    ...R(2, {Retailer: 'Amazon :: Amazon.com', 'Part SKU': 'PS-3', Contact_reason: 'Warranty', Subreason: 'Damaged', WH: 'DEMO-N1', 'SLA Status': '5 hours'}),
    {Retailer: 'Pending', 'Part SKU': 'PENDING', Contact_reason: 'Warranty', WH: 'Delta Canada', 'SLA Status': 'tracking enviado después de 1 día'}]},
  'Warranty Tools': {cols: ['Retailer', 'Tool SKU', 'Contact_reason', 'WH', 'SLA Status'], filas: [
    ...R(4, {Retailer: 'Amazon :: fulfilled by Tienda-Piloto', 'Tool SKU': 'PS-3', Contact_reason: 'Defective', WH: 'DEMO-N2', 'SLA Status': '3 days'}),
    {Retailer: 'Lowes', 'Tool SKU': 'PS-3', Contact_reason: 'Defective', WH: 'Beta Sur'}]},
  WPR: {cols: ['Retailer', 'Part SKU', 'Contact_reason', 'WH', 'SLA Status'], filas: R(20, {Retailer: 'Amazon :: fulfilled by Tienda-Piloto', 'Part SKU': 'ps-1', Contact_reason: 'Defective', WH: 'DEMO-N1', 'SLA Status': '2 days'})},
  'Return Labels': {cols: ['Retailer', 'Part SKU', 'Customer_address'], filas: [
    ...R(7, {Retailer: 'Walmart :: fulfilled by Tienda-Piloto', 'Part SKU': 'PS-4', Customer_address: '1 Main St, Austin, TX 78701'}),
    ...R(2, {Retailer: 'Walmart :: fulfilled by Tienda-Piloto', 'Part SKU': 'PS-4', Customer_address: 'Calle 5, Guadalajara, Jalisco, México'}), {Retailer: 'Walmart :: fulfilled by Tienda-Piloto', 'Part SKU': 'PS-4', Customer_address: 'dirección ilegible'}]},
  Refunds: {cols: ['Retailer', 'SKU', 'Contact_reason', 'Amount'], filas: [
    {Retailer: 'Amazon :: fulfilled by Tienda-Piloto', SKU: 'PS-1', Contact_reason: 'Defective', Amount: '10'}, ...R(4, {Retailer: 'Amazon :: fulfilled by Tienda-Piloto', SKU: 'PS-1', Contact_reason: 'Defective', Amount: '10'})]},
};
// La fila 1 de Refunds en la VERSIÓN 1 decía otro SKU; la versión 2 (mayor rango) manda.
const REFUND_V1 = {Retailer: 'Amazon :: fulfilled by Tienda-Piloto', SKU: 'OLD-1', Contact_reason: 'Defective', Amount: '10'};
const HOJAS_B = {Refunds: {cols: ['Retailer', 'SKU', 'Contact_reason', 'Amount'], filas: R(10, {Retailer: 'Amazon :: fulfilled by Tienda-Piloto', SKU: 'PS-1', Contact_reason: 'Defective', Amount: '5'})}};

function sembrarTracker(h, tenant, conn, hojas, {v1Override = null, tag}) {
  const ver = (id, rank) => `(md5('${tag}ver${id}')::uuid,'${tenant}','${conn}','${hex(tag + 'sha' + id)}','v${id}',${rank},timestamptz '2026-10-05 00:00:00+00')`;
  const revs = [], obs = []; let k = 0;
  for (const [sheet, def] of Object.entries(hojas)) {
    const hdr = JSON.stringify(def.cols.map((v, col) => ({col, v})));
    const cells = (o) => JSON.stringify(def.cols.map((c, col) => ({col, v: o[c] ?? ''})));
    const push = (rn, state, c, ver) => { k++; revs.push(`(md5('${tag}rv${k}')::uuid,'${tenant}',timestamptz '2026-10-02 00:00:00+00'+${k}*interval '1 second','${conn}','${sheet}',${rn},'${hex(tag + 'h' + k)}','${c.replace(/'/g, "''")}'::jsonb,'${state}',md5('${tag}ver1')::uuid)`); for (const v of ver) obs.push(`('${tenant}',md5('${tag}ver${v}')::uuid,'${sheet}',${rn},md5('${tag}rv${k}')::uuid)`); };
    push(1, 'header', hdr, [1, 2]);
    def.filas.forEach((o, i) => {
      if (sheet === 'Refunds' && i === 0 && v1Override) { push(i + 2, 'linked', cells(v1Override), [1]); push(i + 2, 'linked', cells(o), [2]); } else push(i + 2, 'linked', cells(o), [1, 2]);
    });
  }
  const r = psqlFile(h.sock, `set session_replication_role=replica;
   insert into public.connections(id,tenant_id,source,account_id) values('${conn}','${tenant}','excel','syn-${tag}') on conflict do nothing;
   insert into public.tracker_versions(id,tenant_id,connection_id,file_sha256,label,rank,received_at) values ${ver(1, 1)},${ver(2, 2)};
   insert into public.tracker_row_revisions(id,tenant_id,created_at,connection_id,sheet_name,row_number,row_hash,cells,ticket_state,first_version_id) values ${revs.join(',')};
   insert into public.tracker_row_observations(tenant_id,version_id,sheet_name,row_number,revision_id) values ${obs.join(',')};`);
  if (r.status !== 0) throw Error('tracker: ' + String(r.stderr).slice(0, 600));
}

// ---- cliente SQL bajo el rol y la sesión reales de la aplicación ----
function asBackend(h, user, tenant, sql, action = 'read', prefijo = PREFIJO, catalogo = catalogoBodegasJson()) {
  const input = `set role vexa_backend;\nselect set_config('vexa.tienda_propia_prefijo','${prefijo}',false) \\gset\nselect set_config('vexa.cco_catalogo_bodegas','${catalogo.replace(/'/g, "''")}',false) \\gset\nselect set_config('request.jwt.claim.sub','${user}',false) \\gset\nselect set_config('vexa.tenant_id','${tenant}',false) \\gset\nselect set_config('vexa.action','${action}',false) \\gset\n${sql}`;
  const r = spawnSync('psql', ['-h', h.sock, '-U', 'postgres', '-d', 't', '-At', '-q', '-v', 'ON_ERROR_STOP=1', '-f', '-'], {input, encoding: 'utf8'});
  return {ok: r.status === 0, out: r.stdout.trim(), err: r.stderr.trim()};
}
const rows = (h, user, tenant, fn) => { const r = asBackend(h, user, tenant, `select coalesce(json_agg(t),'[]'::json) from (select * from ${fn}) t;`); assert.ok(r.ok, r.err + ' :: ' + fn); return JSON.parse(r.out); };

// ---- verdad en JS, independiente del SQL ----
const VENT = {amazon: ['2025-10', '2026-09', true], walmart: ['2026-08', '2026-09', true], bestbuy: ['2026-03', '2026-09', false], shopify: ['2026-08', '2026-09', true]};
const enVentana = (ch, mes) => mes >= VENT[ch][0] && mes <= VENT[ch][1];
function verdadSkuCanal() {
  const out = new Map();
  const base = (s) => (s === '' ? '' : s.replace(/(-WM[0-9]+|-[0-9]{3}A-[0-9]{3}|-NEW)$/, '').toUpperCase());
  for (const [, ch, kind, sku, mes, n, amt, cur, st] of LIBRO_A) {
    if (!enVentana(ch, mes)) continue;
    const key = [ch, base(sku), cur].join('|'); const o = out.get(key) ?? {lines: 0, gross: 0, rn: 0, runk: 0, rknown: 0, ramt: 0};
    if (kind === 'order') { if (amt !== null && st !== 'cancelled') { o.lines += n; o.gross += n * amt; } } else { if (st !== 'cancelled') o.rn += n; if (amt === null) o.runk += n; else { o.rknown += n; if (st !== 'cancelled') o.ramt += n * amt; } }
    out.set(key, o);
  }
  return out;
}

test('insight_cco_*: aislamiento, k>=5, NULL no cero, sumas y ventana común', {skip: SKIP, timeout: 600000}, async (t) => {
  await withPg(async (h) => {
    h.psql(`insert into public.organizations(id,name) values('${TENANT_A}','SYN'),('${TENANT_B}','SYNB')`);
    sembrarUsuarios(h);
    for (const [tn, f, actor] of [[TENANT_A, FUENTES_A, OWNER.A], [TENANT_B, FUENTE_B, OWNER.B]]) { const r = psqlFile(h.sock, sourcesSql(tn, Object.values(f), actor)); assert.equal(r.status, 0, String(r.stderr).slice(0, 400)); }
    for (const f of ['20261104000000_insights_engine.sql', '20261110000000_insight_gaps.sql']) { const r = h.file(MIG(f)); assert.equal(r.status, 0, f + ' ' + String(r.stderr).slice(0, 400)); }
    sembrarLibro(h, TENANT_A, OWNER.A, LIBRO_A, FUENTES_A, 'a'); sembrarLibro(h, TENANT_B, OWNER.B, LIBRO_B, FUENTE_B, 'b');
    sembrarTracker(h, TENANT_A, CONN_A, HOJAS_A, {v1Override: REFUND_V1, tag: 'A'}); sembrarTracker(h, TENANT_B, CONN_B, HOJAS_B, {tag: 'B'});
    for (const tn of [TENANT_A, TENANT_B]) for (const sql of [`select public.refresh_insights('${tn}','ledger',null,60000)`, `select public.refresh_gap_insights('${tn}',60000)`]) assert.ok(h.psql(sql).ok, sql);

    await t.test('sin la migración: la función no existe (la pantalla dice «no instalado», nunca ceros)', () => {
      const r = asBackend(h, OWNER.A, TENANT_A, 'select * from public.insight_cco_ventanas();');
      assert.equal(r.ok, false); assert.match(r.err, /insight_cco_ventanas/);
    });
    const m = h.file(MIG('20261201000000_insight_cco.sql')); assert.equal(m.status, 0, String(m.stderr).slice(0, 600));
    assert.equal(h.file(MIG('20261201000000_insight_cco.sql')).status, 0, 'idempotente: aplicar dos veces no falla');
    await t.test('sin la migración de modalidad: la función no existe (E y F degradan a casos por subcanal, nunca ceros)', () => {
      const r = asBackend(h, OWNER.A, TENANT_A, 'select * from public.insight_cco_modalidad_casos(5);');
      assert.equal(r.ok, false); assert.match(r.err, /insight_cco_modalidad_casos/);
    });
    const mm = h.file(MIG('20261207000000_insight_cco_modalidad.sql')); assert.equal(mm.status, 0, String(mm.stderr).slice(0, 600));
    const mc = h.file(MIG('20261208000000_insight_cco_catalogo_bodegas.sql')); assert.equal(mc.status, 0, String(mc.stderr).slice(0, 600));
    assert.equal(h.file(MIG('20261208000000_insight_cco_catalogo_bodegas.sql')).status, 0, 'catálogo de bodegas: idempotente');
    assert.equal(h.file(MIG('20261207000000_insight_cco_modalidad.sql')).status, 0, 'modalidad: idempotente');

    await t.test('ventana común: meses completos dentro de las ventanas declaradas; Best Buy sin devoluciones', () => {
      const v = Object.fromEntries(rows(h, OWNER.A, TENANT_A, 'public.insight_cco_ventanas()').map((x) => [x.channel, x]));
      for (const [ch, [d, a, ref]] of Object.entries(VENT)) {
        assert.equal(v[ch].month_from.slice(0, 7), d, ch); assert.equal(v[ch].month_to.slice(0, 7), a, ch); assert.equal(v[ch].refunds_available, ref, ch); assert.equal(v[ch].complete, false, 'fuentes marcadas incompletas: ' + ch);
      }
      assert.equal(v.amazon.months, 12); assert.equal(v.walmart.months, 2); assert.equal(v.walmart.refunds_from, '2026-07-04');
    });

    await t.test('rendimiento por SKU: coincide con la verdad en JS, solo dentro de la ventana común, y monedas separadas', () => {
      const got = rows(h, OWNER.A, TENANT_A, 'public.insight_cco_sku_canal(NULL)'); const exp = verdadSkuCanal();
      assert.equal(got.length, exp.size, 'mismo número de filas');
      for (const g of got) {
        const e = exp.get([g.channel, g.sku_base, g.currency].join('|')); assert.ok(e, 'fila inesperada ' + g.channel + g.sku_base);
        assert.equal(Number(g.order_lines), e.lines, g.channel + g.sku_base); assert.equal(Number(g.order_gross_minor), e.gross);
        if (g.refunds_available) { assert.equal(Number(g.refund_n), e.rn); assert.equal(Number(g.refund_n_unknown_amount), e.runk); assert.equal(g.refund_amount_minor === null ? null : Number(g.refund_amount_minor), e.rknown === 0 ? null : e.ramt); }
      }
      const f = (ch, sku, cur = 'USD') => got.find((x) => x.channel === ch && x.sku_base === sku && x.currency === cur);
      assert.equal(f('amazon', 'S1').order_lines, 8, 'octubre 2026 (mes parcial) queda fuera'); assert.equal(Number(f('amazon', 'S1').refunds_per_100_lines), 37.5);
      assert.equal(f('walmart', 'S1').order_lines, 10, 'julio (inicio de devoluciones a mitad de mes) queda fuera'); assert.equal(Number(f('walmart', 'S1').refund_n), 3);
      assert.ok(f('amazon', 'S1', 'CAD') && f('amazon', 'S1', 'CAD').order_lines === 1, 'CAD aparte, jamás sumado a USD'); assert.equal(Number(f('amazon', 'S1', 'CAD').order_gross_minor), 1300);
      assert.equal(f('amazon', 'S2').order_lines, 7, 'una recorded + seis de dic-2025 (dentro de la ventana); la cancelada no cuenta'); assert.equal(Number(f('amazon', 'S2').refund_n), 0, 'devolución cancelada no cuenta');
    });

    await t.test('lo desconocido sale NULL, nunca 0', () => {
      const got = rows(h, OWNER.A, TENANT_A, 'public.insight_cco_sku_canal(NULL)');
      const s5 = got.find((x) => x.channel === 'amazon' && x.sku_base === 'S5'); assert.equal(s5.refund_amount_minor, null, 'todas las devoluciones sin importe => importe NULL'); assert.equal(Number(s5.refund_n_unknown_amount), 2);
      const bb = got.find((x) => x.channel === 'bestbuy'); assert.equal(bb.refunds_available, false); assert.equal(bb.refund_n, null); assert.equal(bb.refund_amount_minor, null); assert.equal(bb.refunds_per_100_lines, null); assert.equal(bb.sku_base, '');
      const s1 = got.find((x) => x.channel === 'amazon' && x.sku_base === 'S1' && x.currency === 'USD'); assert.equal(Number(s1.refund_amount_minor), 2000, 'suma solo los importes conocidos (la devolución sin importe no aporta ni se cuenta como 0)'); assert.equal(Number(s1.refund_n_unknown_amount), 1);
      const cal = rows(h, OWNER.A, TENANT_A, 'public.insight_cco_ventanas()');
      assert.ok(cal.every((x) => x.months >= 0));
    });

    await t.test('SKU sin venta: referencia = último mes completo; solo Amazon y Walmart; inferido', () => {
      const g = Object.fromEntries(rows(h, OWNER.A, TENANT_A, 'public.insight_cco_sin_venta()').map((x) => [x.sku_base, x]));
      assert.deepEqual(Object.keys(g).sort(), ['PS-1', 'S1', 'S2', 'S4', 'S5']); assert.equal(g.S1.reference_month, '2026-09-01'); assert.equal(g.S1.data_through, '2026-10-02'); assert.equal(Number(g.S1.skus_with_sales), 5);
      assert.equal(g.S1.months_without_sale, 0, 'vendió después de la referencia: 0 meses, no negativo'); assert.equal(g['PS-1'].months_without_sale, 6); assert.equal(g.S4.months_without_sale, 3); assert.equal(g.S2.months_without_sale, 1);
      assert.equal(Number(g.S4.lines_last_3m), 0); assert.equal(Number(g.S4.lines_last_9m), 2); assert.equal(Number(g['PS-1'].lines_last_6m), 0); assert.equal(Number(g['PS-1'].lines_last_9m), 5);
      assert.deepEqual(g.S1.channels, ['amazon', 'walmart']);
    });

    // ---- Tracker: la verdad en JS usa los clasificadores JS (paridad SQL-JS) sobre la última versión ----
    const filas = [];
    for (const [sheet, def] of Object.entries(HOJAS_A)) if (!['WTR', 'WPR'].includes(sheet)) def.filas.forEach((o) => filas.push({sheet, o}));
    const sku = (o) => skuBaseDe(o['Part SKU'] ?? o['Tool SKU'] ?? o.SKU);
    const plegar = (exp, k = 5) => { // misma regla que insight_cco_k: oculta <k y pliega el resto (si queda entre 1 y k-1, se le une la celda visible más pequeña)
      let vis = Object.entries(exp).filter(([, n]) => n >= k).sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0])); let s = Object.entries(exp).filter(([, n]) => n < k).reduce((a, [, n]) => a + n, 0);
      if (s > 0 && s < k && vis.length) { s += vis[0][1]; vis = vis.slice(1); } return {vis: Object.fromEntries(vis), otros: s >= k ? s : null}; };
    const cuenta = (xs, f) => { const m = {}; for (const x of xs) { const k = f(x); if (k) m[k] = (m[k] ?? 0) + 1; } return m; };

    await t.test('Tracker: SKU × defecto con k>=5 (la hoja espejo no cuenta; la versión de mayor rango manda); lo pequeño se pliega en «otros»', () => {
      const got = rows(h, OWNER.A, TENANT_A, "public.insight_cco_tracker_casos('sku_defecto',1)");
      const exp = cuenta(filas, (x) => (sku(x.o) && defectoDe(x.o.Contact_reason, x.o.Subreason) ? sku(x.o) + '|' + defectoDe(x.o.Contact_reason, x.o.Subreason) : null));
      const vis = Object.entries(exp).filter(([, n]) => n >= 5), oculto = Object.entries(exp).filter(([, n]) => n < 5).reduce((a, [, n]) => a + n, 0);
      assert.deepEqual(Object.fromEntries(got.filter((x) => !x.es_otros).map((x) => [x.d1 + '|' + x.d2, Number(x.n)])), Object.fromEntries(vis), 'celdas visibles (p_min=1 NO baja el piso de 5)');
      assert.ok(!exp['OLD-1|defectuoso'] && !got.some((x) => x.d1 === 'OLD-1'), 'la versión 1 de la fila ya no cuenta');
      assert.ok(got.every((x) => Number(x.n) >= 5), 'ninguna celda con menos de 5 casos');
      assert.equal(Number(got.find((x) => x.es_otros).n), oculto, 'lo oculto suma exactamente a «otros»'); assert.equal(exp['PS-1|defectuoso'], 11);
    });
    await t.test('k-anonimato: pliegue cuando el resto queda entre 1 y 4, y piso de 5 aunque se pida 1', () => {
      const k = (cells, min = 5) => { const r = asBackend(h, OWNER.A, TENANT_A, `select coalesce(json_agg(t),'[]'::json) from (select * from public.insight_cco_k('${JSON.stringify(cells)}'::jsonb,${min})) t;`); assert.ok(r.ok, r.err); return JSON.parse(r.out); };
      const c = (d1, n) => ({d1, d2: 'x', n});
      const pliegue = k([c('a', 9), c('b', 6), c('c', 2), c('d', 1)]);
      assert.deepEqual(pliegue.map((x) => [x.d1, Number(x.n), x.es_otros]), [['a', 9, false], [null, 9, true]], 'resto=3 (<5) se une a la celda visible más pequeña (6): 9');
      const sinResto = k([c('a', 9), c('b', 6)]); assert.deepEqual(sinResto.map((x) => x.es_otros), [false, false]);
      assert.deepEqual(k([c('a', 3), c('b', 1)]), [], 'todo pequeño y suma <5: no sale nada');
      assert.deepEqual(k([c('a', 3), c('b', 3)]).map((x) => [Number(x.n), x.es_otros]), [[6, true]], 'todo pequeño pero el conjunto suma >=5: una sola fila de otros');
      assert.deepEqual(k([c('a', 4)], 1), [], 'p_min=1 se eleva a 5');
      assert.deepEqual(k(null), []); assert.deepEqual(k([]), []);
    });
    await t.test('Tracker: subcanal y SKU × hoja coinciden con la verdad', () => {
      const sub = rows(h, OWNER.A, TENANT_A, "public.insight_cco_tracker_casos('subcanal',5)").filter((x) => !x.es_otros);
      const exp = cuenta(filas, (x) => subcanalDe(x.o.Retailer));
      assert.deepEqual(Object.fromEntries(sub.map((x) => [x.d1, Number(x.n)])), plegar(exp).vis);
      assert.equal(exp.amazon_cumplido_por_piloto, 15); assert.equal(exp.walmart_cumplido_por_piloto, 10);
      const hoja = rows(h, OWNER.A, TENANT_A, "public.insight_cco_tracker_casos('sku_hoja',5)").filter((x) => !x.es_otros);
      const eh = cuenta(filas, (x) => (sku(x.o) ? sku(x.o) + '|' + hojaDeTracker(x.sheet) : null));
      assert.deepEqual(Object.fromEntries(hoja.map((x) => [x.d1 + '|' + x.d2, Number(x.n)])), plegar(eh).vis, 'con pliegue: el resto oculto suma 3 (<5), así que la celda visible más pequeña también se oculta');
    });
    await t.test('modalidad: los siete cruces coinciden con la verdad en JS, con k>=5 y pliegue; lo desconocido queda fuera, no en cero', () => {
      const got = rows(h, OWNER.A, TENANT_A, 'public.insight_cco_modalidad_casos(5)');
      const mkt = filas.filter((x) => /^(amazon|walmart)/.test(subcanalDe(x.o.Retailer)));
      const sub = (x) => subcanalDe(x.o.Retailer), bod = (x) => bodegaDe(x.o.WH);
      const visibles = (dim) => Object.fromEntries(got.filter((x) => x.dim === dim && !x.es_otros).map((x) => [x.d1 + '|' + x.d2, Number(x.n)]));
      const verdad = (f) => plegar(cuenta(mkt, f));
      const casos = {
        subcanal_tipo: (x) => sub(x) + '|' + hojaDeTracker(x.sheet),
        subcanal_defecto: (x) => (defectoDe(x.o.Contact_reason, x.o.Subreason) ? sub(x) + '|' + defectoDe(x.o.Contact_reason, x.o.Subreason) : null),
        subcanal_despacho: (x) => (bod(x) ? sub(x) + '|' + latenciaDe(x.o['SLA Status'], bod(x)) : null),
        subcanal_bodega: (x) => (bod(x) ? sub(x) + '|' + bod(x) : null),
        sku_subcanal: (x) => (sku(x.o) ? sku(x.o) + '|' + sub(x) : null),
        sku_subcanal_tipo: (x) => (sku(x.o) ? sku(x.o) + '|' + sub(x) + '|' + hojaDeTracker(x.sheet) : null),
        sku_subcanal_defecto: (x) => (sku(x.o) && defectoDe(x.o.Contact_reason, x.o.Subreason) ? sku(x.o) + '|' + sub(x) + '|' + defectoDe(x.o.Contact_reason, x.o.Subreason) : null),
      };
      for (const [dim, f] of Object.entries(casos)) {
        const v = verdad(f);
        // d1|d2 en SQL: para los cruces con SKU, d2 = «subcanal|tipo»; la clave concatenada coincide con la de la verdad.
        assert.deepEqual(visibles(dim), v.vis, dim);
        assert.equal(got.find((x) => x.dim === dim && x.es_otros) ? Number(got.find((x) => x.dim === dim && x.es_otros).n) : null, v.otros, dim + ': lo oculto suma a «otros»');
      }
      for (const d of Object.keys(casos)) assert.ok(Object.keys(visibles(d)).length >= 1, d + ': la comparación no es vacía');
      assert.ok(got.every((x) => Number(x.n) >= 5), 'ninguna celda con menos de 5 casos');
      assert.ok(!got.some((x) => !String(x.d1 ?? '').length && !x.es_otros), 'ningún d1 vacío salvo «otros»');
      assert.ok(!got.some((x) => x.dim.startsWith('subcanal') && x.d1 && !/^(amazon|walmart)/.test(x.d1)), 'solo Amazon y Walmart; Lowes y Pending no entran');
      assert.ok(!got.some((x) => /PENDING/i.test(String(x.d1))), 'un SKU PENDING no es SKU');
      // la tabla de modalidad cubre todo subcanal que el SQL puede devolver para Amazon y Walmart
      for (const x of got.filter((y) => y.dim === 'subcanal_tipo' && !y.es_otros)) assert.equal(modalidadDeSubcanal(x.d1).conocida, true, x.d1);
    });
    await t.test('modalidad: aislamiento; el usuario de otra organización no ve nada y la otra organización no ve a A', () => {
      assert.deepEqual(rows(h, OWNER.B, TENANT_A, 'public.insight_cco_modalidad_casos(5)'), []);
      const b = rows(h, OWNER.B, TENANT_B, 'public.insight_cco_modalidad_casos(5)').filter((x) => !x.es_otros);
      assert.ok(b.every((x) => x.d1 !== 'PS-3' && Number(x.n) >= 5));
      assert.equal(asBackend(h, OWNER.A, TENANT_A, "select * from public.insight_cco_modalidad_casos(5,'otro-tenant');").ok, false, 'no hay argumento de tenant');
      assert.deepEqual(rows(h, OWNER.A, TENANT_A, 'public.insight_cco_modalidad_casos(1)').filter((x) => !x.es_otros && Number(x.n) < 5), [], 'p_min=1 no baja el piso de 5');
      for (const role of ['anon', 'authenticated', 'service_role']) assert.equal(h.psql(`set role ${role}; select * from public.insight_cco_modalidad_casos(5);`).ok, false, role);
    });
    await t.test('bodegas: latencia de despacho y motivo; bodega mal escrita se normaliza; sin SLA es sin_dato (no cero)', () => {
      const lat = rows(h, OWNER.A, TENANT_A, "public.insight_cco_bodega('latencia',5)"); const conB = filas.filter((x) => bodegaDe(x.o.WH));
      const exp = cuenta(conB, (x) => bodegaDe(x.o.WH) + '|' + latenciaDe(x.o['SLA Status'], bodegaDe(x.o.WH)));
      assert.deepEqual(Object.fromEntries(lat.filter((x) => !x.es_otros).map((x) => [x.d1 + '|' + x.d2, Number(x.n)])), plegar(exp).vis);
      assert.equal(exp['DEMO-N1|2_dias'], 6); assert.equal(exp['Bodega Beta|sin_dato'], 4); assert.ok(!Object.keys(exp).some((k) => /Betta/.test(k)));
      assert.equal(Number(lat.find((x) => x.es_otros).n), plegar(exp).otros);
      const mot = rows(h, OWNER.A, TENANT_A, "public.insight_cco_bodega('motivo',5)"); assert.ok(mot.every((x) => Number(x.n) >= 5));
    });
    await t.test('cobertura de columnas', () => {
      const [c] = rows(h, OWNER.A, TENANT_A, 'public.insight_cco_cobertura()');
      assert.equal(Number(c.rows_total), filas.length); assert.equal(Number(c.with_warehouse), filas.filter((x) => bodegaDe(x.o.WH)).length); assert.equal(Number(c.with_address), 6 + 10, 'filas con alguna dirección (solo se cuenta, nunca se lee)');
      assert.equal(Number(c.with_sku), filas.filter((x) => sku(x.o)).length, 'PENDING no cuenta como SKU'); assert.equal(Number(c.sheets), 4, 'cuatro hojas con contenido; la espejo WPR no cuenta');
    });
    await t.test('paridad SQL-JS de los catálogos cerrados (retailer, bodega, latencia, defecto, SKU)', () => {
      const entradas = [['Amazon :: fulfilled by Tienda-Piloto', 'Part SKU', 'Defective', '', 'demo-n1', '1 hour'], ['Amazon :: Amazon.com'], ['Amazon :: Amazon'], ['Amazon'], ['Walmart :: fulfilled by Walmart'], ['Walmart'], ['Best Buy :: USA'], ['Tienda-Piloto.example :: Shopify'], ['Shopify'], ['Lowes'], ['Pending'], ['Home Depot'], ['Menards'], ['']];
      for (const [rt] of entradas) assert.equal(baseDeSubcanal(subcanalDe(rt)), rt === '' ? null : retailerDe(rt), `la base de «${rt}» coincide con el clasificador anterior`);
      const hdr = ['Retailer', 'Part SKU', 'Contact_reason', 'Subreason', 'WH', 'SLA Status'];
      const casos = [['Amazon :: fulfilled by Tienda-Piloto', 'ab-1-NEW', 'Defective', '', 'alfa usa inc', 'tracking enviado después de 1 día'], ['Amazon :: fulfilled by Amazon', 'x-9', 'Warranty', 'Damaged', 'Demo-USNJ2', '30 horas'], ['Walmart :: fulfilled by Tienda-Piloto', 'q', 'Missing Parts', '', 'gamma', 'same day'],
        ['Amazon :: Amazon.com', 'z-001A-001', 'Order', 'Wrong Item Received', 'Almacén raro', '4 days'], ['Menards', '', 'Return', '', 'beta', 'sin numero'], ['Pending', 'PENDING', '', '', 'delta canada', '2 hrs']];
      // Cinco copias de cada caso para superar el mínimo y poder compararlos por SQL, en una organización aparte.
      const fil = casos.flatMap((c) => R(5, Object.fromEntries(hdr.map((k, i) => [k, c[i]]))));
      const TC = 'cccccccc-0000-4000-8000-000000000003', UC = U(9100); UC_PARIDAD = {u: UC, t: TC};
      h.psql(`insert into public.organizations(id,name) values('${TC}','SYNC')`); h.psql(`insert into auth.users(id) values('${UC}')`);
      h.psql(`insert into public.memberships(tenant_id,user_id,role,status,permissions_version) values('${TC}','${UC}','owner','active',1)`);
      sembrarTracker(h, TC, 'cccccccc-0000-4000-8000-0000000000c1', {'Warranty Parts': {cols: hdr, filas: fil}}, {tag: 'P'});
      const get = (fn, dim) => rows(h, UC, TC, `public.${fn}('${dim}',5)`).filter((x) => !x.es_otros).map((x) => x.d1 + '|' + (x.d2 ?? '')).sort();
      assert.deepEqual(get('insight_cco_tracker_casos', 'subcanal'), [...new Set(casos.map((c) => subcanalDe(c[0]) + '|'))].sort(), 'retailer y subcanal');
      assert.deepEqual(get('insight_cco_bodega', 'latencia'), [...new Set(casos.map((c) => bodegaDe(c[4]) + '|' + latenciaDe(c[5], bodegaDe(c[4]))))].sort(), 'bodega y latencia');
      assert.deepEqual(get('insight_cco_tracker_casos', 'sku_defecto'), [...new Set(casos.filter((c) => skuBaseDe(c[1]) && defectoDe(c[2], c[3])).map((c) => skuBaseDe(c[1]) + '|' + defectoDe(c[2], c[3])))].sort(), 'SKU base y defecto');
    });

    await t.test('sin prefijo configurado (valor por defecto vacío) nada se clasifica como propio, en SQL y en JS', () => {
      const sql = "select coalesce(json_agg(t),'[]'::json) from (select * from public.insight_cco_tracker_casos('subcanal',5)) t;";
      const sinCfg = asBackend(h, UC_PARIDAD.u, UC_PARIDAD.t, sql, 'read', '');
      assert.ok(sinCfg.ok, sinCfg.err); const claves = JSON.parse(sinCfg.out).filter((x) => !x.es_otros).map((x) => x.d1);
      assert.ok(!claves.some((c) => c.endsWith('_piloto') || c === 'tienda'), 'ninguna clase propia sin configuración: ' + claves);
      assert.equal(subcanalDe('Amazon :: fulfilled by Tienda-Piloto', ''), 'amazon_sin_subcanal'); assert.equal(subcanalDe('Tienda-Piloto.example :: Shopify', ''), 'otro');
      assert.equal(subcanalDe('Amazon :: fulfilled by Tienda-Piloto', 'tienda-piloto'), 'amazon_cumplido_por_piloto');
    });

    await t.test('sin catálogo de bodegas configurado (valor por defecto vacío) toda bodega con valor sale «otra», en SQL y en JS; con catálogo, SQL y JS coinciden', () => {
      const sql = "select coalesce(json_agg(t),'[]'::json) from (select * from public.insight_cco_bodega('latencia',5)) t;";
      const vacio = asBackend(h, UC_PARIDAD.u, UC_PARIDAD.t, sql, 'read', PREFIJO, '[]');
      assert.ok(vacio.ok, vacio.err); const filasV = JSON.parse(vacio.out).filter((x) => !x.es_otros);
      assert.ok(filasV.length > 0 && filasV.every((x) => x.d1 === 'otra'), 'sin catálogo: solo «otra»: ' + JSON.stringify(filasV.map((x) => x.d1)));
      assert.equal(bodegaDe('alfa usa inc', []), 'otra'); assert.equal(bodegaDe('', []), null); assert.equal(bodegaDe('  ', []), null);
      const conCat = asBackend(h, UC_PARIDAD.u, UC_PARIDAD.t, sql);
      assert.ok(conCat.ok, conCat.err); assert.ok(JSON.parse(conCat.out).some((x) => x.d1 === 'Bodega Alfa'), 'con catálogo sale la etiqueta');
    });

    await t.test('repositorio CCO de punta a punta (sesión y RLS reales): seis tarjetas con insignia, cobertura y lo que falta', async () => {
      const pg = createRequire(import.meta.url)('pg'); const pool = new pg.Pool({host: h.sock, user: 'postgres', database: 't', max: 3}); t.after(() => pool.end());
      const v = await createCcoRepository({database: crearBaseDatos({pool, tenantId: TENANT_A, userId: OWNER.A, statementTimeoutMs: 20000}), now: () => new Date('2026-10-28T12:00:00Z')}).get();
      assert.equal(v.status, 'ok'); assert.deepEqual(Object.keys(v.cards), ['A', 'B', 'C', 'D', 'E', 'F']);
      assert.deepEqual(Object.fromEntries(Object.values(v.cards).map((c) => [c.id, c.estado])), {A: 'salvedad', B: 'salvedad', C: 'salvedad', D: 'salvedad', E: 'salvedad', F: 'salvedad'});
      const a = v.cards.A, am = a.canales.find((c) => c.canal === 'amazon'), wa = a.canales.find((c) => c.canal === 'walmart'), bb = a.canales.find((c) => c.canal === 'bestbuy');
      assert.equal(am.ventana.meses, 12); assert.equal(wa.ventana.meses, 2); assert.equal(am.ventana.completa, false); assert.equal(a.ventanasDistintas, true);
      assert.equal(am.monedas.find((m) => m.moneda === 'USD').top[0].sku, 'S1', 'ordenado por ingreso bruto'); assert.equal(bb.devoluciones, null, 'Best Buy: devoluciones desconocidas, no cero'); assert.equal(bb.devolucionesDisponibles, false);
      assert.ok(a.cobertura.find((c) => c.clave === 'lineasConSku').pct < 100); const s1 = am.monedas.find((m) => m.moneda === 'USD').top.find((x) => x.sku === 'S1'); assert.equal(s1.defectos, null, 'S1 no tiene celda visible en el Tracker: sin dato, no 0'); const ps1 = am.monedas.find((m) => m.moneda === 'USD').top.find((x) => x.sku === 'PS-1'); assert.equal(ps1.defectos, 11); assert.equal(ps1.defectosClase.defectuoso, 11);
      assert.equal(v.cards.B.umbrales.map((u) => u.skus).join(), '2,1,0'); assert.equal(v.cards.B.total, 5); assert.equal(v.cards.B.clase, 'inferred');
      assert.ok(v.cards.C.bodegas.length >= 1 && v.cards.C.cobertura[0].elegible > 0);
      const d = v.cards.D; assert.equal(d.estados.length, 1); assert.equal(d.estados[0].clave, 'US-TX'); assert.equal(d.estados[0].n, 7); assert.equal(d.ocultos.estados, 1); assert.equal(d.minimo, 5);
      const e15 = v.cards.E.subcanales.find((x) => x.subcanal === 'amazon_cumplido_por_piloto'); assert.equal(e15.casos, 15); assert.equal(e15.vende, 'empresa'); assert.equal(e15.bodega, 'empresa'); assert.equal(e15.marketplace, 'amazon');
      assert.equal(e15.reembolsos, 5, 'cinco filas de la hoja Refunds de ese subcanal'); assert.ok(v.cards.E.faltan.length >= 4); assert.equal(v.cards.E.puedeRecomendar, false); assert.equal(v.cards.E.detalleIndisponible, false);
      assert.equal(v.cards.F.eje, 'bodega'); assert.equal(v.cards.F.puedeRecomendar, false); assert.ok(v.cards.F.faltan.every((x) => ['operaciones', 'datos'].includes(x.quien)));
      assert.doesNotMatch(JSON.stringify(v), /Main St|Calle 5|Guadalajara|Austin|dirección ilegible/, 'ninguna dirección sale del proceso');
      const b = await createCcoRepository({database: crearBaseDatos({pool, tenantId: TENANT_B, userId: OWNER.B, statementTimeoutMs: 20000})}).get();
      assert.ok(!JSON.stringify(b).includes('"S1"') && !JSON.stringify(b).includes('PS-3'), 'la otra organización no ve datos de A');
    });
    await t.test('aislamiento entre organizaciones: cada una ve solo lo suyo; un usuario ajeno no ve nada; las funciones no aceptan tenant', () => {
      const a = rows(h, OWNER.A, TENANT_A, 'public.insight_cco_sku_canal(NULL)'), b = rows(h, OWNER.B, TENANT_B, 'public.insight_cco_sku_canal(NULL)');
      assert.ok(a.every((x) => x.sku_base !== 'ZZ-B')); assert.deepEqual(b.map((x) => [x.sku_base, Number(x.order_lines), Number(x.refund_n)]), [['ZZ-B', 7, 3]]);
      assert.deepEqual(rows(h, OWNER.B, TENANT_A, 'public.insight_cco_sku_canal(NULL)'), [], 'usuario de B con la sesión de A: la RLS no deja pasar nada');
      assert.deepEqual(rows(h, OWNER.A, TENANT_B, 'public.insight_cco_sku_canal(NULL)'), []);
      assert.deepEqual(rows(h, OWNER.B, TENANT_A, 'public.insight_cco_ventanas()'), []); assert.deepEqual(rows(h, OWNER.B, TENANT_A, 'public.insight_cco_sin_venta()'), []);
      for (const [fn, d] of [['insight_cco_tracker_casos', 'subcanal'], ['insight_cco_bodega', 'latencia']]) assert.deepEqual(rows(h, OWNER.B, TENANT_A, `public.${fn}('${d}',5)`), []);
      const bt = rows(h, OWNER.B, TENANT_B, "public.insight_cco_tracker_casos('sku_defecto',5)").filter((x) => !x.es_otros); assert.ok(bt.every((x) => x.d1 !== 'PS-1' || Number(x.n) < 11), 'B no ve los 11 de A');
      assert.equal(asBackend(h, OWNER.A, TENANT_A, "select * from public.insight_cco_tracker_casos('sku_defecto',5,'otro-tenant');").ok, false, 'no hay argumento de tenant');
      assert.equal(asBackend(h, OWNER.A, TENANT_A, "select * from public.insight_cco_tracker_casos('; drop table x',5);").ok, false, 'dim es un enumerado, no texto libre');
      assert.equal(asBackend(h, OWNER.A, TENANT_A, "select * from public.insight_cco_bodega('otra',5);").ok, false);
    });
    await t.test('permisos: ni anon ni authenticated ni service_role ejecutan las funciones; el analista de la organización sí', () => {
      for (const role of ['anon', 'authenticated', 'service_role']) { const r = h.psql(`set role ${role}; select * from public.insight_cco_ventanas();`); assert.equal(r.ok, false, role); }
      assert.ok(asBackend(h, ANALYST_A, TENANT_A, 'select count(*) from public.insight_cco_sku_canal(NULL);').ok);
      const w = asBackend(h, OWNER.A, TENANT_A, "insert into public.insight_order_revenue_month select * from public.insight_order_revenue_month limit 1;"); assert.equal(w.ok, false, 'solo lectura desde la sesión');
    });
  }, {name: 'cco'});
});
