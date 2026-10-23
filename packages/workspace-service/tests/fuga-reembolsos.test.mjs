// «Fuga de reembolsos»: agregadores puros + Postgres local desechable con las migraciones REALES (0001..55), la propuesta 20261102 (contacto repetido) y RLS real (rol vexa_backend).
// Datos 100 % sintéticos (SYN / SKU de ejemplo). Tenant B lleva el libro de prueba; el libro sintético estándar del tenant A debe quedar fuera (aislamiento).
//   node --test packages/workspace-service/tests/fuga-reembolsos.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {withPg, pgAvailable} from '../../metrics/tests/pg-harness.mjs';
import {montarMundo, TENANT_A, TENANT_B, OWNER, psqlFile} from '../../ai-scale/economia-problemas/mundo.mjs';
import {crearBaseDatos} from '../../ai-scale/economia-problemas/snapshot.mjs';
import {sourcesSql, batchSql} from '../../economics/emit-sql.mjs';
import {sourceIdFor} from '../../economics/marketplace-map.mjs';
import {BASIS_ORDER_MP, BASIS_REFUND_MP} from '../../ai-scale/economia-problemas/reglas.mjs';
import * as F from '../fuga-reembolsos.mjs';

const pg = createRequire(import.meta.url)('pg');
const SKIP = !pgAvailable() && 'sin postgres local';
const MIGRATION = fs.readFileSync(new URL('../../../supabase/migrations/20261102000000_contact_repeat_summary.sql', import.meta.url), 'utf8');

// ------------------------------------------------------------------------------------------------ puras
test('SKU: mayúsculas y sin sufijos -WMxx, -001A-001, -NEW; PENDING y vacío = sin SKU', () => {
  assert.equal(F.normalizarSku('skup-l1-wm01'), 'SKUP-L1');
  assert.equal(F.normalizarSku('STX2-M1-001A-001'), 'STX2-M1');
  assert.equal(F.normalizarSku('GTX6-M-NEW'), 'GTX6-M');
  assert.equal(F.normalizarSku('S78560'), 'S78560');
  assert.equal(F.normalizarSku('Pending'), null); assert.equal(F.normalizarSku(' '), null); assert.equal(F.normalizarSku(null), null);
});
test('Tracker sin PII: el texto libre no sale; solo catálogos cerrados', () => {
  assert.equal(F.estadoDeTracker('Older than 180 days'), 'vencido'); assert.equal(F.estadoDeTracker('Can Not Refund'), 'no_reembolsable');
  assert.equal(F.estadoDeTracker('Rejected'), 'rechazado'); assert.equal(F.estadoDeTracker('Refunded by Amazon'), 'reembolsado');
  assert.equal(F.estadoDeTracker('Allen passed it on to the logistics colleague'), 'otro'); assert.equal(F.estadoDeTracker(''), 'sin_estado');
  assert.equal(F.submotivoDe('Customer paid 138 and item is for 100 order 200014331476955'), 'Otro (texto libre omitido)');
  assert.equal(F.submotivoDe('Tool Replacement'), 'Reemplazo de herramienta'); assert.equal(F.motivoDe('Algo raro de Juan'), 'Otro'); assert.equal(F.motivoDe('Defective'), 'Defectuoso');
  const f = F.filaDeTracker('Refunds', 5, {SKU: 'aaa-1-new', Contact_reason: 'Defective', Subreason: 'Juan Pérez llamó', Retailer: 'Walmart :: fulfilled by CLIENTEX', Status: 'Rejected', Amount: '$1,234.50', Request_date: '46042.0', Customer_name: 'Juan'}, new Date('2026-10-23'));
  assert.deepEqual(f, {hoja: 'reembolsos', fila: 5, sku: 'AAA-1', motivo: 'Defectuoso', submotivo: 'Otro (texto libre omitido)', retailer: 'walmart', estado: 'rechazado', montoMinor: 123450, fecha: '2026-01-20'});
  assert.ok(!JSON.stringify(f).includes('Juan'));
  assert.equal(F.fechaExcel('46353.0', new Date('2026-10-23')), null, 'una fecha futura (2026-11) no se inventa ni se muestra');
  assert.equal(F.montoMinor(''), null); assert.equal(F.montoMinor('abc'), null);
});
test('intensidad: marca parcial (ventana y último mes) y posible hueco (líneas < la mitad del mes previo); jamás un cero antes de que empiece el libro de reembolsos', () => {
  const mk = (rows) => new Map(rows);
  const lineas = {porMes: mk([['amazon|2026-05', 100], ['amazon|2026-06', 100], ['amazon|2026-07', 30], ['amazon|2026-08', 100], ['amazon|2026-09', 100], ['walmart|2026-06', 50], ['walmart|2026-07', 100], ['walmart|2026-08', 100], ['walmart|2026-09', 100]]), porSku: new Map()};
  const mensual = [{canal: 'amazon', mes: '2026-06', n: 5, cancelados: 0}, {canal: 'amazon', mes: '2026-07', n: 3, cancelados: 0}, {canal: 'amazon', mes: '2026-08', n: 4, cancelados: 0}, {canal: 'amazon', mes: '2026-09', n: 6, cancelados: 0},
    {canal: 'walmart', mes: '2026-07', n: 20, cancelados: 0}, {canal: 'walmart', mes: '2026-08', n: 30, cancelados: 10}, {canal: 'walmart', mes: '2026-09', n: 10, cancelados: 0}];
  const ventanas = [{canal: 'amazon', tipo: 'refund', inicio: '2026-05-01T00:00:00.000Z', fin: '2026-10-02T00:00:00.000Z'}, {canal: 'amazon', tipo: 'order', inicio: '2026-05-01T00:00:00.000Z', fin: '2026-10-02T00:00:00.000Z'},
    {canal: 'walmart', tipo: 'refund', inicio: '2026-07-04T00:00:00.000Z', fin: '2026-10-02T00:00:00.000Z'}, {canal: 'walmart', tipo: 'order', inicio: '2026-04-05T00:00:00.000Z', fin: '2026-10-02T00:00:00.000Z'}];
  const r = F.armarIntensidad({mensual, lineas, ventanas});
  const cal = c => Object.fromEntries(r[c].meses.map(m => [m.mes, m.calidad]));
  assert.deepEqual(cal('amazon'), {'2026-05': 'completo', '2026-06': 'completo', '2026-07': 'posible_hueco', '2026-08': 'completo', '2026-09': 'parcial'});
  assert.deepEqual(cal('walmart'), {'2026-07': 'parcial', '2026-08': 'completo', '2026-09': 'parcial'}, 'junio no se muestra: el libro de reembolsos de Walmart empieza el 4 de julio');
  assert.equal(r.amazon.meses.find(m => m.mes === '2026-06').intensidadPct, 5);
  assert.deepEqual(F.sinCancelados(r.walmart.meses.filter(m => !m.ultimo)), {reembolsos: 50, cancelados: 10, lineas: 200, conPct: 25, sinPct: 20});
  const cam = F.armarCambios({intensidad: r, conversaciones: {refreshedAt: '2026-10-22T00:00:00Z', meses: [{mes: '2025-08', n: 400}, {mes: '2026-08', n: 250}, {mes: '2026-09', n: 130}]}});
  assert.deepEqual(cam.reembolsos.map(x => [x.canal, x.mes, x.previo]), [], 'Amazon: agosto y junio no son consecutivos (julio es hueco); Walmart: solo agosto es completo');
  assert.deepEqual(cam.conversaciones, {mes: '2026-08', n: 250, mesAnioPrevio: '2025-08', nAnioPrevio: 400, excluido: '2026-09'});
  assert.ok(cam.excluidos.some(x => x.canal === 'conversaciones' && x.mes === '2026-09') && cam.excluidos.some(x => x.canal === 'amazon' && x.mes === '2026-07' && x.motivo === 'posible_hueco'));
});

// ------------------------------------------------------------------------------------------------ con Postgres
const REP = 'SYN libro: registro sintético de prueba con procedencia documentada, sin datos de clientes.';
const src = (key, type, name, start) => ({sourceId: sourceIdFor('fuga-' + key), name, evidenceType: type, active: true, complete: false, windowStart: start, windowEnd: '2026-10-02T00:00:00.000Z', watermark: '2026-10-05T00:00:00.000Z', report: REP + ' ' + key});
const entry = e => ({expectedRevision: 0, orderId: null, reversalOf: null, details: {}, report: REP, attested: true, exponent: 2, currency: 'USD', status: 'recorded', ...e});
const ped = (ext, at, extra = {}) => entry({externalId: ext, kind: 'order', effectiveAt: at, basis: BASIS_ORDER_MP, amountMinor: '10000', ...extra});
const dev = (ext, at, cents, status = 'settled', extra = {}) => entry({externalId: ext, kind: 'refund', effectiveAt: at, basis: BASIS_REFUND_MP, amountMinor: cents, status, ...extra});
const cells = pairs => JSON.stringify(pairs.map(([col, v]) => ({col, v}))).replaceAll("'", "''");

test('servicio completo contra libro y Tracker sintéticos, con RLS real', {skip: SKIP, timeout: 600000}, async t => {
  await withPg(async h => {
    montarMundo(h); // tenant A: libro sintético estándar (no debe aparecer en B)
    const F0 = {amazonP: src('amazon-p', 'order_export', 'SYN Marketplace Amazon · Pedidos', '2026-05-01T00:00:00.000Z'), amazonD: src('amazon-d', 'payment_ledger', 'SYN Marketplace Amazon · Devoluciones', '2026-05-01T00:00:00.000Z'),
      walmartP: src('walmart-p', 'order_export', 'SYN Marketplace Walmart · Pedidos', '2026-04-05T00:00:00.000Z'), walmartD: src('walmart-d', 'payment_ledger', 'SYN Marketplace Walmart · Devoluciones', '2026-07-04T00:00:00.000Z'),
      shopifyD: src('shopify-d', 'payment_ledger', 'SYN Shopify · Reembolsos', '2026-08-01T00:00:00.000Z')};
    const aP = [], wP = [];
    // Amazon: 4 líneas en junio, julio (hueco: 1), agosto y septiembre; SKU AAA-1 con sufijo -NEW en algunas
    const lineasAmazon = {'2026-06': 4, '2026-07': 1, '2026-08': 4, '2026-09': 4};
    for (const [mes, n] of Object.entries(lineasAmazon)) for (let i = 0; i < n; i++) aP.push(ped(`amazon|SYN-1${mes.slice(5)}-${String(i).padStart(7, '0')}|${i % 2 ? 'AAA-1-NEW' : 'AAA-1'}`, `${mes}-10T12:00:00.000Z`));
    for (const [mes, n] of Object.entries({'2026-08': 6, '2026-09': 6})) for (let i = 0; i < n; i++) wP.push(ped(`walmart|${mes.slice(5)}${String(i).padStart(13, '0')}|${i < 4 ? 'BBB-2-WM01' : 'CCC-3'}`, `${mes}-12T12:00:00.000Z`));
    wP.push(ped('walmart|99999999999999|BBB-2', '2026-08-13T12:00:00.000Z', {currency: 'CAD'})); // otra moneda: no suma en USD
    const aD = [dev('amazon|RK1||AAA-1', '2026-08-20T12:00:00.000Z', '5000', 'unknown'), dev('amazon|RK2||AAA-1-NEW', '2026-08-21T12:00:00.000Z', null, 'unknown'), dev('amazon|RK3||AAA-1', '2026-09-02T12:00:00.000Z', '2500', 'unknown'),
      dev('amazon|RK4||AAA-1', '2026-08-22T12:00:00.000Z', '1000', 'unknown', {currency: 'CAD'})];
    const wD = [dev('walmart|900000000000000001|1|BBB-2-WM01', '2026-08-15T12:00:00.000Z', '20000'), dev('walmart|900000000000000002|1|BBB-2', '2026-08-16T12:00:00.000Z', '30000'),
      dev('walmart|900000000000000003|1|BBB-2', '2026-08-17T12:00:00.000Z', '15000', 'cancelled'), dev('walmart|900000000000000004|1|CCC-3', '2026-09-03T12:00:00.000Z', '4000', 'pending')];
    const sD = [dev('gid://shopify/OrderTransaction/1', '2026-09-05T12:00:00.000Z', '700')];
    let r = psqlFile(h.sock, sourcesSql(TENANT_B, Object.values(F0), OWNER.B)); assert.equal(r.status, 0, String(r.stderr).slice(0, 400));
    let i = 0;
    for (const [s, entries] of [[F0.amazonP, aP], [F0.amazonD, aD], [F0.walmartP, wP], [F0.walmartD, wD], [F0.shopifyD, sD]]) {
      r = psqlFile(h.sock, batchSql(TENANT_B, {sourceId: s.sourceId, entries, label: 'fuga' + (++i)}, OWNER.B)); assert.equal(r.status, 0, String(r.stderr).slice(0, 600));
    }
    // Tracker sintético (como postgres, sin FK: replica). Hoja «Refunds» con cabecera y 5 filas (una con dos revisiones: manda la última) + «Warranty Tools».
    const conn = '00000000-0000-4000-8000-0000000fa001', ver = '00000000-0000-4000-8000-0000000fa002';
    const hex = n => String(n).padStart(64, '0');
    const ins = (n, sheet, row, state, cs, at) => `insert into public.tracker_row_revisions(id,tenant_id,created_at,connection_id,sheet_name,row_number,row_hash,cells,ticket_state,first_version_id) values(gen_random_uuid(),'${TENANT_B}','${at}','${conn}','${sheet}',${row},'${hex(n)}','${cells(cs)}'::jsonb,'${state}','${ver}')`;
    const HDR = [[0, 'Owner'], [1, 'Owner'], [8, 'Order_ID'], [10, 'Contact_reason'], [11, 'Subreason'], [12, 'Retailer'], [13, 'SKU'], [15, 'Amount'], [21, 'Status'], [3, 'Request_date'], [4, 'Customer_name']];
    const row = (reason, sub, ret, sku, amount, status, date, name = 'Nombre Privado') => [[10, reason], [11, sub], [12, ret], [13, sku], [15, amount], [21, status], [3, date], [4, name], [8, '200014331476955']];
    const sql = ['set session_replication_role=replica',
      ins(1, 'Refunds', 1, 'header', HDR, '2026-10-01'),
      ins(2, 'Refunds', 2, 'no_ticket', row('Defective', 'Tool Replacement', 'Walmart :: fulfilled by CLIENTEX', 'BBB-2-WM01', '100.5', 'Refunded', '46042.0'), '2026-10-02'),
      ins(3, 'Refunds', 3, 'no_ticket', row('Defective', 'Customer Juan Pérez order 200014331476955 broke', 'Walmart', 'BBB-2', '50.0', 'Older than 180 days', '46000.0'), '2026-10-02'),
      ins(4, 'Refunds', 4, 'no_ticket', row('Warranty', 'Damaged', 'Amazon', 'AAA-1-NEW', '', 'Can Not Refund', '46010.0'), '2026-10-02'),
      ins(5, 'Refunds', 5, 'no_ticket', row('Order', 'Spare Parts', 'Amazon', 'AAA-1', '20.0', 'Allen passed it on to the logistics colleague', '46020.0'), '2026-10-02'),
      ins(6, 'Refunds', 6, 'no_ticket', row('Return', 'Damaged', 'Amazon', 'PENDING', '30.0', 'Submitted', '46030.0'), '2026-10-02'),
      ins(7, 'Refunds', 6, 'no_ticket', row('Return', 'Damaged', 'Amazon', 'PENDING', '30.0', 'Rejected', '46030.0'), '2026-10-03'),
      ins(8, 'Warranty Tools', 1, 'header', [[1, 'Hubspot ID'], [12, 'Contact Reason'], [14, 'Retailer'], [15, 'SKU']], '2026-10-01'),
      ins(9, 'Warranty Tools', 2, 'linked', [[1, '5000000001'], [12, 'Warranty'], [14, 'Walmart'], [15, 'BBB-2-WM01']], '2026-10-02'),
      ins(10, 'WTR', 1, 'header', [[15, 'SKU']], '2026-10-01'), ins(11, 'WTR', 2, 'linked', [[15, 'BBB-2']], '2026-10-02')].join(';\n');
    r = h.psql(sql); assert.ok(r.ok, r.err);
    const pool = new pg.Pool({host: h.sock, user: 'postgres', database: 't', max: 3});
    try {
      const base = (tenant = TENANT_B, user = OWNER.B) => crearBaseDatos({pool, tenantId: tenant, userId: user, statementTimeoutMs: 60000});
      const NOW = new Date('2026-10-23T12:00:00Z');
      const v = await F.createRefundLeakRepository({database: base(), now: () => NOW}).get();

      await t.test('titular: USD bruto y sin cancelados; otras monedas aparte; Shopify sin SKU; nada de Amazon sin monto sumado como 0', () => {
        // Amazon USD: 5000+2500+(null) ; Walmart: 20000+30000+15000(cancelado)+4000 ; Shopify 700 ; CAD aparte
        assert.equal(v.titular.status, 'ok');
        assert.equal(v.titular.usdBrutoMinor, String(5000 + 2500 + 20000 + 30000 + 15000 + 4000 + 700));
        assert.equal(v.titular.usdNetoMinor, String(5000 + 2500 + 20000 + 30000 + 4000 + 700));
        assert.equal(v.titular.canceladosUsdMinor, '15000');
        assert.equal(v.titular.sinMonto, 1);
        assert.equal(v.titular.n, 3 + 4 + 1, 'cuenta reembolsos USD (incluye el de monto desconocido)');
        assert.deepEqual(v.titular.otrasMonedas, [{currency: 'CAD', exponent: 2, n: 1, amountMinor: '1000'}]);
        assert.equal(v.titular.canales.amazon.n, 3); assert.equal(v.titular.canales.walmart.cancelados, 1); assert.equal(v.titular.canales.shopify.conSku, 0);
        assert.equal(v.skus.sinSku.n, 1);
      });
      await t.test('ranking por SKU base: sufijos unificados, USD, n, líneas vendidas y % acumulado', () => {
        const top = v.skus.top;
        assert.deepEqual(top.map(r => r.sku), ['BBB-2', 'AAA-1', 'CCC-3']);
        const b = top[0];
        assert.equal(b.usdBrutoMinor, '65000'); assert.equal(b.usdNetoMinor, '50000'); assert.equal(b.n, 3); assert.equal(b.lineas, 8, 'BBB-2: 4 líneas en agosto y 4 en septiembre (la CAD no cuenta)');
        assert.equal(top[1].canales[0].canal, 'amazon'); assert.equal(top[1].n, 3); assert.equal(top[1].usdBrutoMinor, '7500'); assert.equal(top[1].lineas, 13, 'AAA-1 y AAA-1-NEW suman 4+1+4+4 líneas de Amazon');
        assert.equal(top[0].acumPct, Math.floor((65000 / 77200) * 10000) / 100);
        assert.equal(top.at(-1).acumPct, Math.floor((76500 / 77200) * 10000) / 100, 'el % acumulado es sobre el total bruto, que incluye lo que no tiene SKU');
        assert.deepEqual(v.skus.walmart.map(w => [w.sku, w.n]), [['BBB-2', 3], ['CCC-3', 1]]);
        assert.ok(v.skus.detalleMensual.some(d => d.sku === 'BBB-2' && d.canal === 'walmart' && d.mes === '2026-08' && d.n === 3));
      });
      await t.test('intensidad mensual: sin cero antes del libro de reembolsos, hueco y parcial rotulados, Walmart sin cancelados', () => {
        const a = Object.fromEntries(v.intensidad.canales.amazon.meses.map(m => [m.mes, m]));
        assert.equal(a['2026-08'].lineas, 4); assert.equal(a['2026-08'].reembolsos, 2); assert.equal(a['2026-08'].intensidadPct, 50); assert.equal(a['2026-07'].calidad, 'posible_hueco'); assert.equal(a['2026-09'].calidad, 'parcial');
        assert.equal(a['2026-08'].calidad, 'completo');
        const w = Object.fromEntries(v.intensidad.canales.walmart.meses.map(m => [m.mes, m]));
        assert.deepEqual(Object.keys(w), ['2026-08', '2026-09'], 'las líneas empiezan en agosto y la ventana de reembolsos en julio: no hay mes con cero inventado');
        assert.equal(w['2026-08'].cancelados, 1);
        assert.equal(v.intensidad.walmartSinCancelados.cancelados, 1); assert.equal(v.intensidad.walmartSinCancelados.lineas, 6, 'sin el último mes (septiembre), que puede estar cortado'); assert.equal(v.intensidad.bestBuy.reembolsosEnElLibro, 0);
      });
      await t.test('ventanas: todas parciales (complete=false) y con su canal', () => {
        assert.equal(v.todasParciales, true);
        assert.deepEqual(v.ventanas.filter(x => x.tipo === 'refund').map(x => x.canal).sort(), ['amazon', 'shopify', 'walmart']);
        assert.equal(v.ventanas.find(x => x.canal === 'walmart' && x.tipo === 'refund').inicio, '2026-07-04T00:00:00.000Z');
      });
      await t.test('Tracker: última revisión por fila, estados normalizados, sin PII, espejos fuera, cola de negados', () => {
        const tr = v.tracker;
        assert.equal(tr.status, 'ok'); assert.equal(tr.filasReembolsos, 5);
        assert.deepEqual({...tr.estados}, {reembolsado: 1, vencido: 1, no_reembolsable: 1, rechazado: 1, enviado: 0, otro: 1, sin_estado: 0});
        assert.equal(tr.negados, 3); assert.deepEqual(tr.cola.map(c => c.estado).sort(), ['no_reembolsable', 'rechazado', 'vencido']);
        const def = tr.porMotivo.find(m => m.motivo === 'Defectuoso');
        assert.deepEqual([def.n, def.montoMinor, def.reembolsados, def.negados], [2, 15050, 1, 1]);
        assert.equal(tr.bySku['BBB-2'].hojas.reembolsos, 2); assert.equal(tr.bySku['BBB-2'].hojas.garantiaHerramientas, 1, 'WTR (espejo) no se suma');
        assert.equal(tr.bySku['AAA-1'].hojas.reembolsos, 2); assert.equal(tr.bySku['BBB-2'].vinculadas, 1, 'una fila de garantía con ticket vinculado');
        const text = JSON.stringify(v);
        for (const pii of ['Juan', 'Pérez', '200014331476955', 'Allen', 'Nombre Privado', 'logistics']) assert.ok(!text.includes(pii), 'PII en la respuesta: ' + pii);
      });
      await t.test('sin migración de contacto repetido: «not_computed» (no 0); con ella y sin refrescar, igual; tras el refresco, lee la fila', async () => {
        assert.equal(v.contactoRepetido.status, 'unavailable', 'sin la tabla la parte no está disponible (nunca 0)');
        r = psqlFile(h.sock, MIGRATION); assert.equal(r.status, 0, String(r.stderr).slice(0, 500));
        let v2 = await F.createRefundLeakRepository({database: base(), now: () => NOW}).get();
        assert.equal(v2.contactoRepetido.status, 'not_computed');
        r = h.psql(`select public.refresh_contact_repeat('${TENANT_B}')`); assert.ok(r.ok, r.err);
        v2 = await F.createRefundLeakRepository({database: base(), now: () => NOW}).get();
        assert.equal(v2.contactoRepetido.status, 'empty', 'sin vínculos de contacto: vacío, no un porcentaje inventado');
        h.psql(`update public.contact_repeat_summary set contacts=1000, contacts_ge2_90=173, contacts_ge3_90=69, linked_tickets=2000, repeat_tickets_90=700, total_tickets=2500, by_category='[{"category":"Order: Spare Parts","customers":400,"repeaters":80},{"category":"Other: Retailer notifications and system alerts","customers":500,"repeaters":90}]'::jsonb where tenant_id='${TENANT_B}'`);
        v2 = await F.createRefundLeakRepository({database: base(), now: () => NOW}).get();
        const c = v2.contactoRepetido;
        assert.deepEqual([c.status, c.pctDosOMas, c.pctTresOMas, c.pctSinVincular], ['ok', 17.3, 6.9, 20]);
        assert.deepEqual(c.porCategoria, [{categoria: 'Order: Spare Parts', clientes: 400, repiten: 80, pct: 20}], 'el ruido de notificaciones de marketplaces no entra al ranking');
        // El tenant A no ve la fila de B (RLS por tenant)
        const vA = await F.createRefundLeakRepository({database: base(TENANT_A, OWNER.A), now: () => NOW}).get();
        assert.notEqual(vA.contactoRepetido.status, 'ok');
      });
      await t.test('aislamiento: el tenant A solo ve su libro sintético y nada del Tracker de B', async () => {
        const vA = await F.createRefundLeakRepository({database: base(TENANT_A, OWNER.A), now: () => NOW}).get();
        assert.equal(vA.titular.usdBrutoMinor, String(3000 + 1000 + 5000), 'libro estándar de A: Walmart 3000 + Amazon 1000 + Shopify 5000');
        assert.equal(vA.tracker.status, 'empty');
        assert.ok(!JSON.stringify(vA).includes('BBB-2'));
      });
      await t.test('corte por fecha: [inicio, fin) sobre la fecha efectiva; entradas inválidas = 400', async () => {
        const corte = await F.createRefundLeakRepository({database: base(), now: () => NOW}).get({dateStart: '2026-09-01', dateEnd: '2026-10-01'});
        assert.equal(corte.titular.usdBrutoMinor, String(2500 + 4000 + 700));
        for (const bad of [{dateStart: 'ayer'}, {dateEnd: '2026-13-01'}, {dateStart: '2026-10-01', dateEnd: '2026-09-01'}]) await assert.rejects(F.createRefundLeakRepository({database: base(), now: () => NOW}).get(bad), e => e.status === 400);
      });
      await t.test('si una parte no cabe en su tope responde «unavailable», nunca 0, y las demás siguen', async () => {
        const lento = F.createRefundLeakRepository({database: base(), now: () => NOW, budgets: {...F.FUGA_BUDGETS_MS, tracker: 0, orders: 0}});
        const x = await lento.get();
        assert.equal(x.tracker.status, 'unavailable'); assert.equal(x.intensidad.status, 'unavailable'); assert.equal(x.titular.status, 'ok');
        assert.equal(x.skus.lineasStatus, 'unavailable'); assert.equal(x.skus.top[0].lineas, null);
        assert.equal(x.parts.tracker, 'unavailable'); assert.equal(x.parts.refunds, 'ok');
      });
    } finally { await pool.end(); }
  }, {name: 'fuga'});
});

// ------------------------------------------------------------------------------------------------ conversaciones por mes (hallazgo H2)
function sesionFalsa({insightState = null, insightRows = [], viejoState = null, viejoRows = [], insightError = null}) {
  const llamadas = [];
  return {tenantId: 't', llamadas, async query(sql) {
    llamadas.push(sql);
    if (/current_setting/.test(sql)) return {rows: [{v: '0'}]};
    if (/FROM public.insight_state/.test(sql)) { if (insightError) throw Object.assign(Error('x'), {code: insightError}); return {rows: insightState ? [insightState] : []}; }
    if (/FROM public.insight_conversation_volume/.test(sql)) return {rows: insightRows};
    if (/FROM public.summary_refresh_state/.test(sql)) return {rows: viejoState ? [viejoState] : []};
    if (/FROM public.conversation_monthly/.test(sql)) return {rows: viejoRows};
    return {rows: []};
  }};
}
test('conversaciones por mes: lee insight_conversation_volume (grain=month) y no toca conversation_monthly', async () => {
  const s = sesionFalsa({insightState: {status: 'ok', refreshed_at: '2026-10-23T10:00:00Z', detail: {}}, insightRows: [{period: '2026-07-01', n: '100'}, {period: '2026-08-01', n: '90'}], viejoRows: [{month: '2026-01', n: 1}]});
  const r = await F.conversacionesPorMes(s, Date.now() + 5000);
  assert.deepEqual(r.meses, [{mes: '2026-07', n: 100}, {mes: '2026-08', n: 90}]);
  assert.equal(r.fuente, 'insight_conversation_volume');
  assert.ok(!s.llamadas.some(q => /conversation_monthly/.test(q)));
});
test('conversaciones por mes: tabla insight vacía o sin permiso -> respaldo conversation_monthly', async () => {
  const viejo = {viejoState: {refreshed_at: '2026-10-01T00:00:00Z'}, viejoRows: [{month: '2026-07', n: 70}]};
  for (const caso of [{}, {insightState: {status: 'ok', refreshed_at: '2026-10-23T10:00:00Z'}, insightRows: []}, {insightError: '42P01'}]) {
    const r = await F.conversacionesPorMes(sesionFalsa({...caso, ...viejo}), Date.now() + 5000);
    assert.deepEqual(r.meses, [{mes: '2026-07', n: 70}]); assert.equal(r.fuente, 'conversation_monthly');
  }
  assert.equal(await F.conversacionesPorMes(sesionFalsa({}), Date.now() + 5000), false, 'sin ninguna fuente: no calculado, no 0');
});
