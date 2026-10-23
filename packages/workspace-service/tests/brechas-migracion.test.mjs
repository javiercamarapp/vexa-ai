// Agregados de «Brechas de ingreso» (migración PROPUESTA 20261110000000_insight_gaps): exactitud contra una verdad en JS, última revisión por entidad, monedas aparte, idempotencia,
// permisos, aislamiento por tenant, reversa y lectura de punta a punta (lectores + repositorio). Postgres local desechable con las migraciones reales; datos 100 % sintéticos.
//   node --test packages/workspace-service/tests/brechas-migracion.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {createRequire} from 'node:module';
import {withPg, pgAvailable} from '../../metrics/tests/pg-harness.mjs';
import {sembrarBase, FUENTES, BASIS_ORDER} from '../../metrics/tests/ledger-sintetico.mjs';
import {crearBaseDatos} from '../../ai-scale/economia-problemas/snapshot.mjs';
import {TENANT_A, TENANT_B, OWNER, SECOND_OWNER_A, psqlFile} from '../../ai-scale/economia-problemas/mundo.mjs';
import {HERE} from '../../metrics/tests/world.mjs';
import {CONN, hex, q, asBackend, sembrarOtros, refunds, insertRefunds, BASE} from '../../insights/tests/seed.mjs';
import {readOrderRevenueMonth, readComplaintFamilyMonth, readFamilyPairs, readAnalysisProgress} from '../../insights/reader-brechas.mjs';
import {createRevenueGapsRepository} from '../brechas.mjs';

const pg = createRequire(import.meta.url)('pg');
const SKIP = !pgAvailable() && 'sin postgres local';
const MIG0 = path.join(HERE, '../../../supabase/migrations/20261104000000_insights_engine.sql');
const UP = path.join(HERE, '../../../supabase/propuestas/20261110000000_insight_gaps.sql');
const DOWN = path.join(HERE, '../../workspace-service/tests/20261110000000_insight_gaps.down.sql');

/** Pedidos deterministas: [{i, ext, ch, sku, month, cur, amt, status, rev}] */
function pedidos() {
  const out = [], SK = ['SKUP-L1', 'SKUP-L1-WM12', 'STX2-M1-NEW', 'GTX6-M-001A-001'];
  for (let i = 1; i <= 120; i++) {
    const k = i % 4, ch = k === 0 ? 'amazon' : k === 1 ? 'walmart' : k === 2 ? 'shopify' : 'bestbuy', sku = SK[i % 4], month = ['2026-07', '2026-08', '2026-09'][i % 3];
    const ext = ch === 'amazon' ? `amazon|111-${String(i).padStart(7, '0')}-0000001|${sku}` : ch === 'walmart' ? `walmart|${100000000000000n + BigInt(i)}|${sku}` : ch === 'shopify' ? `gid://shopify/Order/${i}` : `mirakl_bestbuy_us|BBY01-${i}-A|S${1000 + i}`;
    out.push({i, ext, ch, sku, month, cur: i % 40 === 0 ? 'CAD' : 'USD', amt: 10000 + i * 7, status: i % 10 === 0 ? 'cancelled' : i % 17 === 0 ? 'unknown' : 'recorded', rev: 1});
  }
  return out;
}
function insertOrders(h, rows, {revision = 1, tag = 'o'} = {}) {
  const f = ch => (ch === 'amazon' ? FUENTES['amazon-pedidos'] : ch === 'walmart' ? FUENTES['otros-pedidos'] : ch === 'shopify' ? FUENTES['shopify-pedidos'] : FUENTES['mirakl-pedidos']).sourceId;
  const values = rows.map(r => `('${TENANT_A}',md5('${tag}${r.i}')::uuid,'${f(r.ch)}',1,${revision},'${OWNER.A}',timestamptz '2026-10-0${revision}'+interval '${r.i} minutes','${r.ext}','order',timestamptz '${r.month}-${r.i % 2 ? '03' : '25'} 12:00:00+00','${r.cur}',2,'${BASIS_ORDER}',${r.amt},'${r.status}','{}'::jsonb,'SYN libro: registro sintético de prueba con procedencia documentada, sin datos de clientes.','${hex('a')}',true)`).join(',\n');
  const res = psqlFile(h.sock, `set session_replication_role=replica;alter table public.economic_ledger_entries disable trigger user;
   insert into public.economic_ledger_entries(tenant_id,entity_id,source_id,source_version,revision,actor_id,recorded_at,external_id,kind,effective_at,currency,exponent,basis,amount_minor,status,details,report,report_hash,attested) values ${values};
   alter table public.economic_ledger_entries enable trigger user;`);
  if (res.status !== 0) throw Error('pedidos: ' + String(res.stderr).slice(0, 500));
}
/** Corridas de IA: cv1..cv20 son de julio (con started_at). v2 con familias, v2 sin familias, abstenida, v1 (sin taxonomy_version), conversación sin fecha, borrada y de otro tenant. */
function insertRuns(h) {
  const run = (cv, tenant, status, prov) => `(md5('run${cv}${tenant}')::uuid,'${tenant}','SYN','h','s','i','${status}',md5('${cv}${tenant === TENANT_A ? '' : 'b'}')::uuid,'${prov}'::jsonb)`;
  const v2 = fams => JSON.stringify({taxonomy_version: 'v2-2026-10-23', product_families: fams});
  const vals = [];
  for (let i = 1; i <= 10; i++) vals.push(run('cv' + i, TENANT_A, 'succeeded', v2(['cod:SKUP', 'cat:bateria'])));
  for (let i = 11; i <= 14; i++) vals.push(run('cv' + i, TENANT_A, 'succeeded', v2(['cod:SKUP'])));
  for (let i = 15; i <= 16; i++) vals.push(run('cv' + i, TENANT_A, 'succeeded', v2([])));
  vals.push(run('cv17', TENANT_A, 'abstained', JSON.stringify({taxonomy_version: 'v2-2026-10-23'})));
  vals.push(run('cv18', TENANT_A, 'succeeded', JSON.stringify({source: 'ia-escala-cohorte-v1', product_families: ['cod:ZZZZ']}))); // v1: no cuenta
  vals.push(run('cv25', TENANT_A, 'succeeded', v2(['cod:STX']))); // sin started_at: fuera
  vals.push(run('cv36', TENANT_A, 'succeeded', v2(['cod:STX']))); // borrada: fuera
  vals.push(`(md5('runcv5dup')::uuid,'${TENANT_A}','SYN','h','s','i','succeeded',md5('cv5')::uuid,'${v2(['cod:SKUP'])}'::jsonb)`); // segunda corrida (otras familias) de la misma conversación: cuenta una vez por familia
  const r = psqlFile(h.sock, `set session_replication_role=replica;insert into public.extraction_runs(id,tenant_id,model_id,prompt_hash,schema_hash,input_hash,status,conversation_id,provenance) values ${vals.join(',')};`);
  if (r.status !== 0) throw Error('runs: ' + String(r.stderr).slice(0, 500));
}

test('agregados de brechas: exactitud, última revisión, idempotencia, permisos, aislamiento, reversa y lectura de punta a punta', {skip: SKIP, timeout: 600000}, async t => {
  await withPg(async h => {
    sembrarBase(h); sembrarOtros(h);
    // una conversación borrada en A (cv36 ya tiene deleted_at en la semilla: i>35)
    const ped = pedidos(); insertOrders(h, ped);
    // revisión 2: la entidad 7 pasa a cancelada y de monto distinto; la última manda
    const r7 = {...ped.find(r => r.i === 7), status: 'cancelled', amt: 99999}; insertOrders(h, [r7], {revision: 2});
    const verdad = ped.map(r => (r.i === 7 ? r7 : r));
    insertRuns(h);
    const rowsRef = refunds(); insertRefunds(h, rowsRef);
    const pool = new pg.Pool({host: h.sock, user: 'postgres', database: 't', max: 4}); t.after(() => pool.end());
    const db = (tenant, user) => crearBaseDatos({pool, tenantId: tenant, userId: user, statementTimeoutMs: 10000});

    await t.test('sin migración: los lectores dicen unavailable y la vista degrada (nunca ceros)', async () => {
      const d = db(TENANT_A, OWNER.A);
      assert.equal((await d.transaction('read', s => readOrderRevenueMonth(s))).availability, 'unavailable');
      assert.equal((await d.transaction('read', s => readComplaintFamilyMonth(s))).availability, 'unavailable');
      const v = await createRevenueGapsRepository({database: d}).get();
      assert.equal(v.ingresos.status, 'unavailable'); assert.equal(v.familias.status, 'unavailable'); assert.equal(v.recomendaciones.status, 'unavailable');
      assert.equal(h.file(MIG0).status, 0);
    });

    const a1 = h.file(UP); assert.equal(a1.status, 0, String(a1.stderr)); const a2 = h.file(UP); assert.equal(a2.status, 0, 'idempotente: ' + String(a2.stderr));
    const refresh = () => JSON.parse(asBackend(h, OWNER.A, TENANT_A, 'import', `select public.refresh_gap_insights('${TENANT_A}')`).out.split('\n').pop());

    await t.test('permisos: la app no escribe tablas; solo el worker del tenant con acción import refresca; viewer, otro tenant y entradas inválidas denegados', () => {
      for (const sql of [`insert into public.insight_order_revenue_month(tenant_id,month,channel,sku_base,currency,exponent,n,n_cancelled,n_review,amount_minor,amount_cancelled_minor,amount_review_minor,first_day,last_day,refreshed_at) values('${TENANT_A}','2026-07-01','amazon','',  'USD',2,1,0,0,1,0,0,now(),now(),now())`,
        `delete from public.insight_complaint_family_month`, `update public.insight_family_pair set conversations=9`]) {
        const r = asBackend(h, OWNER.A, TENANT_A, 'import', sql); assert.equal(r.ok, false, sql); assert.match(r.err, /permission denied/i, sql);
      }
      let r = h.psql(`set role vexa_backend; select public.refresh_gap_insights('${TENANT_A}')`); assert.equal(r.ok, false); assert.match(r.err, /denied/);
      r = asBackend(h, OWNER.A, TENANT_A, 'read', `select public.refresh_gap_insights('${TENANT_A}')`); assert.equal(r.ok, false); assert.match(r.err, /denied/);
      r = asBackend(h, OWNER.A, TENANT_A, 'import', `select public.refresh_gap_insights('${TENANT_B}')`); assert.equal(r.ok, false); assert.match(r.err, /denied/);
      r = asBackend(h, SECOND_OWNER_A, TENANT_A, 'import', `select public.refresh_gap_insights('${TENANT_A}')`); assert.equal(r.ok, false); assert.match(r.err, /denied/);
      r = h.psql(`select public.refresh_gap_insights('${TENANT_A}',5)`); assert.equal(r.ok, false); assert.match(r.err, /INSIGHT_INPUT_INVALID/);
      r = h.psql(`select public.refresh_gap_insights(null)`); assert.equal(r.ok, false);
    });

    let primero;
    await t.test('antes de refrescar: absent; primer refresco: ambos listos', async () => {
      const d = db(TENANT_A, OWNER.A);
      assert.equal((await d.transaction('read', s => readOrderRevenueMonth(s))).availability, 'absent');
      primero = refresh(); assert.equal(primero.status, 'done');
      assert.deepEqual(primero.results.map(r => r.status), ['ready', 'ready']);
    });

    await t.test('ingreso por mes × canal × SKU: coincide con la verdad (última revisión), sin sumar monedas, SKU normalizado, cancelados aparte, Best Buy/Shopify sin SKU', () => {
      const exp = new Map();
      for (const r of verdad) {
        const sku = r.ch === 'amazon' || r.ch === 'walmart' ? BASE(r.sku) : '', k = [r.month + '-01', r.ch, sku, r.cur].join('|');
        const e = exp.get(k) ?? {n: 0, canc: 0, rev: 0, amt: 0, ac: 0, ar: 0}; e.n++; e.amt += r.amt; if (r.status === 'cancelled') { e.canc++; e.ac += r.amt; } if (r.status === 'unknown') { e.rev++; e.ar += r.amt; } exp.set(k, e);
      }
      const got = q(h, `select month,channel,sku_base,currency,n,n_cancelled,n_review,amount_minor,amount_cancelled_minor,amount_review_minor from public.insight_order_revenue_month where tenant_id='${TENANT_A}'`).split('\n').map(l => l.split('|'));
      assert.equal(got.length, exp.size);
      for (const [month, ch, sku, cur, n, canc, rev, amt, ac, ar] of got) {
        const e = exp.get([month, ch, sku, cur].join('|')); assert.ok(e, [month, ch, sku, cur].join('|'));
        assert.deepEqual([Number(n), Number(canc), Number(rev), Number(amt), Number(ac), Number(ar)], [e.n, e.canc, e.rev, e.amt, e.ac, e.ar], [month, ch, sku, cur].join('|'));
      }
      assert.equal(q(h, `select count(*) from public.insight_order_revenue_month where sku_base ~ '(-WM[0-9]+|-NEW|-001A-001)$'`), '0');
      assert.equal(q(h, `select count(*) from public.insight_order_revenue_month where channel in('shopify','bestbuy') and sku_base<>''`), '0');
      assert.ok(Number(q(h, `select count(*) from public.insight_order_revenue_month where currency='CAD'`)) > 0, 'CAD aparte');
      assert.equal(q(h, `select min(first_day)::text||' '||max(last_day)::text from public.insight_order_revenue_month where month='2026-07-01'`).split(' ')[0] >= '2026-07-01', true);
    });

    await t.test('familias: una conversación cuenta una vez, solo taxonomía v2, sin fecha/borradas/otro tenant fuera; * = analizadas, + = con familia; pares >= 5', () => {
      const rows = q(h, `select month,family,conversations from public.insight_complaint_family_month where tenant_id='${TENANT_A}' order by family`).split('\n');
      assert.deepEqual(rows, ['2026-07-01|*|17', '2026-07-01|+|14', '2026-07-01|cat:bateria|10', '2026-07-01|cod:SKUP|14']); // 10+4+2+1 analizadas; 14 con familias; la corrida duplicada de cv5 no suma
      assert.equal(q(h, `select family_a||'+'||family_b||'='||conversations from public.insight_family_pair where tenant_id='${TENANT_A}'`), 'cat:bateria+cod:SKUP=10');
      assert.equal(q(h, `select count(*) from public.insight_complaint_family_month where family in ('cod:ZZZZ','cod:STX')`), '0');
    });

    await t.test('idempotente y barato: la segunda llamada es noop; una revisión nueva recalcula y cambia solo lo afectado', () => {
      const antes = q(h, `select md5(string_agg(x::text,'|' order by x::text)) from (select month,channel,sku_base,currency,n,amount_minor from public.insight_order_revenue_month) x`);
      assert.deepEqual(refresh().results.map(r => r.status), ['noop', 'noop']);
      insertOrders(h, [{...ped.find(r => r.i === 8), amt: 55555}], {revision: 2});
      const r = refresh(); assert.equal(r.results[0].status, 'ready'); assert.equal(r.results[1].status, 'noop');
      assert.notEqual(q(h, `select md5(string_agg(x::text,'|' order by x::text)) from (select month,channel,sku_base,currency,n,amount_minor from public.insight_order_revenue_month) x`), antes);
      const esperado = verdad.map(x => (x.i === 8 ? {...x, amt: 55555} : x)).filter(x => x.cur === 'USD').reduce((a, x) => a + x.amt, 0);
      assert.equal(Number(q(h, `select sum(amount_minor) from public.insight_order_revenue_month where currency='USD'`)), esperado);
    });

    await t.test('RLS: B no ve nada de A; A lee sus agregados', () => {
      for (const tb of ['insight_order_revenue_month', 'insight_complaint_family_month', 'insight_family_pair']) {
        assert.equal(asBackend(h, OWNER.B, TENANT_B, 'read', `select count(*) from public.${tb}`).out.split('\n').pop(), '0', tb);
        assert.ok(Number(asBackend(h, OWNER.A, TENANT_A, 'read', `select count(*) from public.${tb}`).out.split('\n').pop()) > 0, tb);
      }
    });

    await t.test('lectores y repositorio de punta a punta: vista coherente con las tablas, avance del análisis leído de la base', async () => {
      assert.equal(asBackend(h, OWNER.A, TENANT_A, 'import', `select public.refresh_insights('${TENANT_A}','all')`).ok, true);
      const d = db(TENANT_A, OWNER.A);
      const ord = await d.transaction('read', s => readOrderRevenueMonth(s)); assert.equal(ord.availability, 'ready'); assert.ok(ord.meta.refreshedAt);
      const fam = await d.transaction('read', s => readComplaintFamilyMonth(s)); assert.equal(fam.availability, 'ready'); assert.equal(fam.rows.find(r => r.family === '*').n, 17);
      assert.equal((await d.transaction('read', s => readFamilyPairs(s))).pairs[0].n, 10);
      const pr = await d.transaction('read', s => readAnalysisProgress(s));
      assert.equal(pr.availability, 'ready'); assert.equal(pr.v2, 20); assert.equal(pr.corridasTotales, 21); // v2: 10+4+2+1(abst)+cv25+cv36+dup; más 1 de la taxonomía anterior
      const v = await createRevenueGapsRepository({database: d, now: () => new Date('2026-10-23T20:00:00Z')}).get();
      JSON.stringify(v);
      assert.equal(v.ingresos.status, 'ok'); assert.equal(v.partes.ordenes, 'ready');
      const suma = verdad.filter(r => r.cur === 'USD').map(r => (r.i === 8 ? {...r, amt: 55555} : r)).filter(r => r.status !== 'cancelled').reduce((a, r) => a + r.amt, 0);
      assert.equal(Number(v.ingresos.activoMinor), suma);
      assert.equal(v.familias.status, 'parcial'); assert.equal(v.familias.cobertura.analizadas, 17); assert.ok(v.familias.progreso.avancePct >= 0);
      // otro tenant: no ve nada
      const vb = await createRevenueGapsRepository({database: db(TENANT_B, OWNER.B)}).get(); assert.ok(['empty', 'unavailable'].includes(vb.ingresos.status));
    });

    await t.test('reversa: quita lo añadido, restaura la restricción de insight_state y conserva el motor; reaplicar funciona', () => {
      const d = h.file(DOWN); assert.equal(d.status, 0, String(d.stderr));
      for (const tb of ['insight_order_revenue_month', 'insight_complaint_family_month', 'insight_family_pair']) assert.equal(q(h, `select to_regclass('public.${tb}') is null`), 't', tb);
      assert.equal(q(h, `select count(*) from pg_proc where proname='refresh_gap_insights'`), '0');
      assert.ok(Number(q(h, `select count(*) from public.insight_refund_by_sku_month`)) > 0, 'el motor sigue');
      assert.equal(h.psql(`insert into public.insight_state(tenant_id,insight,status,refreshed_at) values('${TENANT_A}','order_revenue_month','ready',now())`).ok, false);
      assert.equal(h.file(UP).status, 0);
    });
  }, {upto: 55});
});
