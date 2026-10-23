// Motor de insights precalculados (migración 20261104000000, PROPUESTA): refresco incremental/idempotente/reanudable, aislamiento por tenant, permisos y exactitud
// contra una verdad calculada en JS (generador determinista). Postgres local desechable con las migraciones reales; datos 100 % sintéticos (SYN).
//   node --test packages/workspace-service/tests/insights-motor.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {withPg, pgAvailable} from '../../metrics/tests/pg-harness.mjs';
import {sembrarBase, FUENTES} from '../../metrics/tests/ledger-sintetico.mjs';
import {TENANT_A, TENANT_B, OWNER, SECOND_OWNER_A, psqlFile} from '../../ai-scale/economia-problemas/mundo.mjs';
import {HERE} from '../../metrics/tests/world.mjs';

const SKIP = !pgAvailable() && 'sin postgres local';
const MIG = path.join(HERE, '../../../supabase/migrations/20261104000000_insights_engine.sql');
const DOWN = path.join(HERE, '../../workspace-service/tests/20261104000000_insights_engine.down.sql');
const CONN = 'cccccccc-0000-4000-8000-0000000000a1';
const hex = s => createHash('sha256').update(String(s)).digest('hex');
const uuid = (p, i) => `${p}-0000-4000-8000-${String(i).padStart(12, '0')}`.replace(/^(.{8})-(.*)$/, (_, a, b) => a.padEnd(8, '0').slice(0, 8) + '-' + b);
const SKUS = ['SKUP-L1', 'SKUP-L1-WM12', 'STX2-M1-NEW', 'GTX6-M-001A-001'], BASE = s => s.replace(/(-WM[0-9]+|-[0-9]{3}A-[0-9]{3}|-NEW)$/, '');

/** Reembolsos deterministas: [{i, entity, ext, ch, sku, month, cur, amt|null, status}] */
function refunds(n = 300) {
  const out = [];
  for (let i = 1; i <= n; i++) {
    const k = i % 3, ch = k === 0 ? 'amazon' : 'walmart', sku = SKUS[i % 4], month = ['2026-07', '2026-08', '2026-09'][i % 3 === 0 ? i % 2 : (i + 1) % 3];
    const cad = i % 50 === 0;
    out.push({i, ch, sku, month, cur: cad ? 'CAD' : 'USD', amt: ch === 'amazon' && i % 5 === 0 ? null : 1000 + i, status: ch === 'walmart' ? (i % 10 === 0 ? 'cancelled' : 'settled') : 'unknown',
      ext: ch === 'amazon' ? `amazon|k${i}||${sku}` : `walmart|${100000000000000000n + BigInt(i)}|1|${sku}`});
  }
  return out;
}
function insertRefunds(h, rows, {revision = 1, tag = 'r'} = {}) {
  const f = c => (c === 'amazon' ? FUENTES['amazon-devoluciones'] : FUENTES['walmart-devoluciones']).sourceId;
  const values = rows.map(r => `('${TENANT_A}',md5('${tag}${r.i}')::uuid,'${f(r.ch)}',1,${revision},'${OWNER.A}',timestamptz '2026-10-0${revision}'+interval '${r.i} minutes','${r.ext}','refund',timestamptz '${r.month}-15 12:00:00+00','${r.cur}',2,'marketplace_refund_amount',${r.amt ?? 'null'},'${r.status}','{}'::jsonb,'SYN libro: registro sintético de prueba con procedencia documentada, sin datos de clientes.','${hex('a')}',true)`).join(',\n');
  const res = psqlFile(h.sock, `set session_replication_role=replica;alter table public.economic_ledger_entries disable trigger user;
   insert into public.economic_ledger_entries(tenant_id,entity_id,source_id,source_version,revision,actor_id,recorded_at,external_id,kind,effective_at,currency,exponent,basis,amount_minor,status,details,report,report_hash,attested) values ${values};
   alter table public.economic_ledger_entries enable trigger user;`);
  if (res.status !== 0) throw Error('refunds: ' + String(res.stderr).slice(0, 500));
}
const q = (h, sql) => { const r = h.psql(sql); assert.ok(r.ok, r.err + ' :: ' + sql.slice(0, 200)); return r.out; };
const asBackend = (h, user, tenant, action, sql) => h.psql(`set role vexa_backend; select set_config('request.jwt.claim.sub','${user}',true),set_config('vexa.tenant_id','${tenant}',true),set_config('vexa.action','${action}',true); ${sql}`);

function sembrarOtros(h) {
  // Conversaciones: 20 con started_at (jul), 10 sin started_at pero con mensajes (ago), 5 sin ninguna fecha, 3 borradas; B: 4.
  const r = psqlFile(h.sock, `set session_replication_role=replica;
   insert into public.connections(id,tenant_id,source,account_id) values('${CONN}','${TENANT_A}','hubspot','syn-portal');
   insert into public.conversations(id,tenant_id,source,external_id,connection_id,started_at,deleted_at)
    select md5('cv'||i)::uuid,'${TENANT_A}','csv','h'||i,'${CONN}',case when i<=20 then timestamptz '2026-07-06 10:00:00+00'+(i%4)*interval '7 days' end,case when i>35 then now() end from generate_series(1,38) i;
   insert into public.messages(id,tenant_id,external_id,role,conversation_id,connection_id,occurred_at)
    select md5('m'||i)::uuid,'${TENANT_A}','m'||i,'customer',md5('cv'||i)::uuid,'${CONN}',timestamptz '2026-08-12 09:00:00+00'+(i%2)*interval '14 days' from generate_series(21,30) i;
   insert into public.conversations(id,tenant_id,source,external_id,connection_id,started_at) select md5('cvb'||i)::uuid,'${TENANT_B}','csv','h'||i,'${CONN}',timestamptz '2026-09-10 00:00:00+00' from generate_series(1,4) i;`);
  if (r.status !== 0) throw Error('conv: ' + String(r.stderr).slice(0, 400));
  // HubSpot: 6 hilos (jul: 4, ago: 2). t1 cierra en 2 h, t2 en 48 h, t3 en 10 días, t4 abierto; t5 cerrado en 30 min y REABIERTO; t6 (ago) cerrado en 5 h. Cada hilo con dos versiones (la última manda).
  const th = (id, c, cl, st, v) => `('${uuid('aaaaaaaa', 100 + Number(id.slice(1)) * 10 + v)}','${TENANT_A}','${uuid('bbbbbbbb', 1)}','${CONN}','${uuid('dddddddd', 1)}','th-${id}-${v}','${hex('b' + id + v)}',
    '{"payload":{"id":"${id}","status":"${st}","createdAt":"${c}","closedAt":${cl ? `"${cl}"` : 'null'}}}'::jsonb,'{}'::jsonb,'{}'::jsonb)`;
  const ev = (n, tid, t, ns) => `('${uuid('aaaaaaaa', 900 + n)}','${TENANT_A}','${uuid('bbbbbbbb', 1)}','${CONN}','${uuid('dddddddd', 1)}','ev-${n}','${hex('c' + n)}',
    '{"payload":{"id":"e${n}","type":"THREAD_STATUS_CHANGE","createdAt":"${t}","newStatus":"${ns}","conversationsThreadId":"${tid}"}}'::jsonb,'{}'::jsonb,'{}'::jsonb)`;
  const rows = [th('t1', '2026-07-01T00:00:00Z', null, 'OPEN', 1), th('t1', '2026-07-01T00:00:00Z', '2026-07-01T02:00:00Z', 'CLOSED', 2), th('t2', '2026-07-02T00:00:00Z', '2026-07-04T00:00:00Z', 'CLOSED', 1),
    th('t3', '2026-07-03T00:00:00Z', '2026-07-13T00:00:00Z', 'CLOSED', 1), th('t4', '2026-07-04T00:00:00Z', null, 'OPEN', 1), th('t5', '2026-07-05T00:00:00Z', '2026-07-05T00:30:00Z', 'CLOSED', 1),
    th('t6', '2026-08-01T00:00:00Z', '2026-08-01T05:00:00Z', 'CLOSED', 1),
    ev(1, 't5', '2026-07-05T00:00:00Z', 'OPEN'), ev(2, 't5', '2026-07-05T00:30:00Z', 'CLOSED'), ev(3, 't5', '2026-07-06T00:00:00Z', 'OPEN'), ev(4, 't1', '2026-07-01T00:00:00Z', 'OPEN'), ev(5, 't1', '2026-07-01T02:00:00Z', 'CLOSED')];
  const r2 = psqlFile(h.sock, `set session_replication_role=replica;
   insert into public.sync_raw_objects(id,tenant_id,sync_id,connection_id,import_id,row_ref,raw_hash,original,normalized,result,created_at) select id::uuid,tenant_id::uuid,sync_id::uuid,connection_id::uuid,import_id::uuid,row_ref,raw_hash,original,normalized,result,
    timestamptz '2026-10-01 00:00:00+00'+(right(row_ref,1)::int)*interval '1 minute' from (values ${rows.join(',')}) v(id,tenant_id,sync_id,connection_id,import_id,row_ref,raw_hash,original,normalized,result);`);
  if (r2.status !== 0) throw Error('hubspot: ' + String(r2.stderr).slice(0, 600));
}
function sembrarTracker(h) {
  // Cabecera + 6 filas de Refunds: 3 reembolsado (2 con monto), 1 vencido, 1 con texto libre en Status (=> otro), 1 vacía (descartada). Dos versiones de la fila 2 (manda la última).
  const hdr = ['Status', 'Contact_reason', 'Retailer', 'Amount'].map((v, col) => `{"col":${col},"v":"${v}"}`).join(',');
  const row = (st, rs, rt, amt) => `[{"col":0,"v":"${st}"},{"col":1,"v":"${rs}"},{"col":2,"v":"${rt}"},{"col":3,"v":"${amt}"}]`;
  const rows = [[1, 'header', `[${hdr}]`, 0], [2, 'linked', row('Pending', 'Defective', 'Amazon :: fulfilled by CLIENTEX', ''), 1], [2, 'linked', row('Refunded', 'Defective', 'Amazon :: fulfilled by CLIENTEX', '$100.50'), 2],
    [3, 'linked', row('Refunded', 'Warranty', 'Walmart :: fulfilled by CLIENTEX', '40'), 3], [4, 'linked', row('Refunded', 'Warranty', 'Walmart :: fulfilled by CLIENTEX', ''), 4], [5, 'linked', row('Older than 180 days', 'Return', 'Lowes', '10'), 5],
    [6, 'linked', row('Allen se lo paso a logistica', 'Algo libre raro', 'Quien sabe', '5'), 6], [7, 'no_ticket', row('', '', '', ''), 7]];
  const vals = rows.map(([n, st, cells, k]) => `(md5('tr${n}-${k}')::uuid,'${TENANT_A}',timestamptz '2026-10-02 00:00:00+00'+${k}*interval '1 minute','${CONN}','Refunds',${n},'${hex('e' + n + k)}','${cells}'::jsonb,'${st}',md5('ver')::uuid)`).join(',');
  const r = psqlFile(h.sock, `set session_replication_role=replica;insert into public.tracker_row_revisions(id,tenant_id,created_at,connection_id,sheet_name,row_number,row_hash,cells,ticket_state,first_version_id) values ${vals};`);
  if (r.status !== 0) throw Error('tracker: ' + String(r.stderr).slice(0, 500));
}

test('motor de insights: exactitud, incremental, idempotencia, reanudación, aislamiento y permisos', {skip: SKIP, timeout: 600000}, async t => {
  await withPg(async h => {
    sembrarBase(h); sembrarOtros(h); sembrarTracker(h);
    const rows = refunds(); insertRefunds(h, rows);
    const a1 = h.file(MIG); assert.equal(a1.status, 0, String(a1.stderr));
    const a2 = h.file(MIG); assert.equal(a2.status, 0, 'idempotente: ' + String(a2.stderr));
    const refresh = (src = 'all', since = 'null', budget = 8000) => JSON.parse(q(h, `select public.refresh_insights('${TENANT_A}','${src}',${since},${budget})`));
    const byInsight = res => Object.fromEntries(res.results.map(r => [r.insight, r]));

    await t.test('permisos: la app no escribe tablas ni llama sin ser worker del tenant; otro tenant/viewer denegado', () => {
      for (const sql of [`insert into public.insight_state(tenant_id,insight,status,refreshed_at) values('${TENANT_A}','conversation_volume','ready',now())`, `delete from public.insight_refund_by_sku_month`, `update public.source_sync_state set status='ok'`]) {
        const r = asBackend(h, OWNER.A, TENANT_A, 'import', sql); assert.equal(r.ok, false, sql); assert.match(r.err, /permission denied/i, sql);
      }
      let r = h.psql(`set role vexa_backend; select public.refresh_insights('${TENANT_A}','all')`); assert.equal(r.ok, false); assert.match(r.err, /denied/);
      r = asBackend(h, OWNER.A, TENANT_A, 'read', `select public.refresh_insights('${TENANT_A}','ledger')`); assert.equal(r.ok, false, 'acción read no basta'); assert.match(r.err, /denied/);
      r = asBackend(h, OWNER.A, TENANT_A, 'import', `select public.refresh_insights('${TENANT_B}','ledger')`); assert.equal(r.ok, false, 'otro tenant'); assert.match(r.err, /denied/);
      r = asBackend(h, SECOND_OWNER_A, TENANT_A, 'import', `select public.refresh_insights('${TENANT_A}','ledger')`); assert.equal(r.ok, false, 'viewer'); assert.match(r.err, /denied/);
      r = h.psql(`select public.refresh_insights('${TENANT_A}','nope')`); assert.equal(r.ok, false); assert.match(r.err, /INSIGHT_INPUT_INVALID/);
      r = h.psql(`select public.refresh_insights('${TENANT_A}','all',null,5)`); assert.equal(r.ok, false); assert.match(r.err, /INSIGHT_INPUT_INVALID/);
      r = h.psql(`select public.refresh_insights(null,'all')`); assert.equal(r.ok, false);
    });

    let first;
    await t.test('primer refresco (como worker del tenant): todos listos; contacto repetido omitido sin la función de FUGA', () => {
      const r = asBackend(h, OWNER.A, TENANT_A, 'import', `select public.refresh_insights('${TENANT_A}','all')`); assert.ok(r.ok, r.err);
      first = JSON.parse(r.out.split('\n').pop());
      const m = byInsight(first);
      assert.equal(first.status, 'done'); for (const k of ['refund_by_sku_month', 'conversation_volume', 'thread_resolution', 'tracker_refund_status']) assert.equal(m[k].status, 'ready', k);
      assert.equal(m.repeat_contact.status, 'skipped');
    });

    await t.test('reembolsos por SKU×canal×mes: coinciden con la verdad (JS), sin sumar monedas, SKU normalizado, cancelados aparte', () => {
      const exp = new Map();
      for (const r of rows) {
        const k = [r.month + '-01', r.ch, BASE(r.sku), r.cur].join('|'), e = exp.get(k) ?? {n: 0, known: 0, canc: 0, amt: 0, act: 0};
        e.n++; if (r.amt !== null) { e.known++; e.amt += r.amt; if (r.status !== 'cancelled') e.act += r.amt; } if (r.status === 'cancelled') e.canc++; exp.set(k, e);
      }
      const got = q(h, `select month,channel,sku_base,currency,n,n_known,n_cancelled,amount_minor,amount_active_minor from public.insight_refund_by_sku_month where tenant_id='${TENANT_A}'`).split('\n').map(l => l.split('|'));
      assert.equal(got.length, exp.size);
      for (const [month, ch, sku, cur, n, known, canc, amt, act] of got) {
        const e = exp.get([month, ch, sku, cur].join('|')); assert.ok(e, [month, ch, sku, cur].join('|'));
        assert.deepEqual([Number(n), Number(known), Number(canc), Number(amt), Number(act)], [e.n, e.known, e.canc, e.amt, e.act], [month, ch, sku, cur].join('|'));
      }
      assert.equal(q(h, `select count(*) from public.insight_refund_by_sku_month where sku_base ~ '(-WM[0-9]+|-NEW|-001A-001)$'`), '0');
      assert.ok(Number(q(h, `select count(distinct currency) from public.insight_refund_by_sku_month`)) >= 2, 'USD y CAD separados');
      const tot = rows.filter(r => r.cur === 'USD').reduce((a, r) => a + (r.amt ?? 0), 0);
      assert.equal(Number(q(h, `select sum(amount_minor) from public.insight_refund_by_sku_month where currency='USD'`)), tot);
    });

    await t.test('conversaciones por mes y semana: 20 jul (4 semanas), 10 ago (2 semanas), sin fecha/borradas fuera', () => {
      assert.equal(q(h, `select string_agg(period||':'||n,',' order by period) from public.insight_conversation_volume where tenant_id='${TENANT_A}' and grain='month'`), '2026-07-01:20,2026-08-01:10');
      assert.equal(q(h, `select sum(n) from public.insight_conversation_volume where tenant_id='${TENANT_A}' and grain='week'`), '30');
      assert.equal(q(h, `select string_agg(period::text,',' order by period) from public.insight_conversation_volume where tenant_id='${TENANT_A}' and grain='week' and period<'2026-08-01'`), '2026-07-06,2026-07-13,2026-07-20,2026-07-27');
      assert.deepEqual(JSON.parse(q(h, `select detail from public.insight_state where tenant_id='${TENANT_A}' and insight='conversation_volume'`)), {undated: 5, total: 35});
      assert.equal(q(h, `select count(*) from public.insight_conversation_volume where tenant_id='${TENANT_B}'`), '0', 'B no se calcula si no se pide');
    });

    await t.test('cierre y reapertura HubSpot: 6 hilos, 5 cerrados, 1 reabierto, medianas', () => {
      const all = q(h, `select threads,closed,reopened_threads,close_p50_hours,close_p90_hours,closed_lt_1h,closed_gt_7d,status_events from public.insight_thread_resolution where tenant_id='${TENANT_A}' and grain='all'`).split('|');
      // cierres en horas: t1 2, t2 48, t3 240, t5 0.5, t6 5 => orden .5,2,5,48,240 => p50 5, p90 = 48+0.6*(240-48)=163.2
      assert.deepEqual(all.slice(0, 3), ['6', '5', '1']); assert.equal(Number(all[3]), 5); assert.equal(Number(all[4]), 163.2); assert.equal(all[5], '1'); assert.equal(all[6], '1'); assert.equal(all[7], '5');
      assert.equal(q(h, `select string_agg(period||':'||threads||'/'||closed,',' order by period) from public.insight_thread_resolution where tenant_id='${TENANT_A}' and grain='month'`), '2026-07-01:5/4,2026-08-01:1/1');
    });

    await t.test('Tracker: última revisión por fila, categorías cerradas, fila vacía descartada, monto sin moneda', () => {
      const rowsT = q(h, `select status_class,reason_class,retailer_class,n,n_amount,amount_minor from public.insight_tracker_refund_status where tenant_id='${TENANT_A}' order by 1,2,3`);
      assert.equal(rowsT, ['otro|otro|otro|1|1|500', 'reembolsado|defective|amazon|1|1|10050', 'reembolsado|warranty|walmart|2|1|4000', 'vencido|return|lowes|1|1|1000'].join('\n'));
    });

    await t.test('idempotente y barato: la segunda llamada es noop en todo; con since forzado da lo mismo', () => {
      const before = q(h, `select md5(string_agg(x::text,'|' order by x::text)) from (select month,channel,sku_base,currency,n,amount_minor,amount_active_minor from public.insight_refund_by_sku_month) x`);
      const m = byInsight(refresh('all'));
      for (const k of ['refund_by_sku_month', 'conversation_volume', 'thread_resolution', 'tracker_refund_status']) assert.equal(m[k].status, 'noop', k);
      const forced = refresh('ledger', `'2020-01-01'`); assert.equal(byInsight(forced).refund_by_sku_month.status, 'ready');
      assert.equal(q(h, `select md5(string_agg(x::text,'|' order by x::text)) from (select month,channel,sku_base,currency,n,amount_minor,amount_active_minor from public.insight_refund_by_sku_month) x`), before);
    });

    await t.test('incremental: una revisión nueva que MUEVE un reembolso de mes y uno nuevo solo recalculan los meses afectados', () => {
      const stamp = month => q(h, `select max(refreshed_at)::text from public.insight_refund_by_sku_month where month='${month}-01'`);
      const s = {jul: stamp('2026-07'), ago: stamp('2026-08'), sep: stamp('2026-09')};
      const moved = rows.find(r => r.month === '2026-07' && r.amt !== null && r.cur === 'USD');
      const changed = {...moved, month: '2026-09', amt: 7777};
      insertRefunds(h, [changed], {revision: 2});
      const extra = {i: 9001, ch: 'walmart', sku: 'NUEVO-1-WM3', month: '2026-09', cur: 'USD', amt: 500, status: 'settled', ext: 'walmart|100000000000009001|1|NUEVO-1-WM3'};
      insertRefunds(h, [extra], {revision: 1, tag: 'x'});
      const res = byInsight(refresh('ledger')).refund_by_sku_month; assert.equal(res.status, 'ready'); assert.equal(res.months, 2, 'jul (origen) y sep (destino); ago intacto');
      assert.equal(stamp('2026-08'), s.ago, 'agosto no se tocó'); assert.notEqual(stamp('2026-07'), s.jul); assert.notEqual(stamp('2026-09'), s.sep);
      const exp = rows.map(r => (r === moved ? changed : r)).concat([extra]).filter(r => r.cur === 'USD').reduce((a, r) => a + (r.amt ?? 0), 0);
      assert.equal(Number(q(h, `select sum(amount_minor) from public.insight_refund_by_sku_month where currency='USD'`)), exp);
      assert.equal(q(h, `select amount_minor from public.insight_refund_by_sku_month where sku_base='NUEVO-1' and month='2026-09-01'`), '500');
    });

    await t.test('reanudable: con el plazo vencido deja meses en el cursor (partial) y la siguiente llamada los completa', () => {
      h.psql(`delete from public.insight_refund_by_sku_month where tenant_id='${TENANT_A}'; delete from public.insight_state where tenant_id='${TENANT_A}' and insight='refund_by_sku_month'`);
      const part = JSON.parse(q(h, `select public.insights_refresh_refund_sku('${TENANT_A}',null,now()-interval '1 second')`));
      assert.equal(part.status, 'partial'); assert.equal(part.pending, 3);
      assert.equal(q(h, `select count(*) from public.insight_refund_by_sku_month`), '0');
      assert.equal(JSON.parse(q(h, `select cursor from public.insight_state where insight='refund_by_sku_month'`)).months.length, 3);
      const fin = byInsight(refresh('ledger')).refund_by_sku_month; assert.equal(fin.status, 'ready'); assert.equal(fin.months, 3);
      assert.equal(q(h, `select status||':'||cursor::text from public.insight_state where insight='refund_by_sku_month'`), 'ready:{}');
      assert.ok(Number(q(h, `select count(*) from public.insight_refund_by_sku_month`)) > 10);
    });

    await t.test('aislamiento de fallos: si una fuente falla, las demás siguen y la fallida queda marcada', () => {
      h.psql(`alter table public.tracker_row_revisions rename to tracker_row_revisions_x`);
      try {
        const m = byInsight(refresh('all', `'2020-01-01'`));
        assert.equal(m.tracker_refund_status.status, 'failed'); assert.equal(m.conversation_volume.status, 'ready');
        assert.equal(q(h, `select status||':'||error_code from public.insight_state where insight='tracker_refund_status'`), 'failed:42P01');
      } finally { h.psql(`alter table public.tracker_row_revisions_x rename to tracker_row_revisions`); }
      assert.equal(byInsight(refresh('tracker')).tracker_refund_status.status, 'ready');
    });

    await t.test('contacto repetido: delega en refresh_contact_repeat cuando existe (stub) y registra su frescura', () => {
      h.psql(`create function public.refresh_contact_repeat(p uuid) returns jsonb language sql as $$ select jsonb_build_object('linked_tickets',7,'contacts',3,'contacts_ge2_90',2,'contacts_ge3_90',1) $$`);
      const r = byInsight(refresh('contacts')).repeat_contact; assert.equal(r.status, 'ready');
      assert.equal(q(h, `select detail->>'contacts_ge2_90' from public.insight_state where insight='repeat_contact'`), '2');
      assert.equal(byInsight(refresh('contacts')).repeat_contact.status, 'noop');
    });

    await t.test('RLS: B no ve nada de A; A lee sus insights; record_source_sync conserva el último éxito', () => {
      assert.equal(asBackend(h, OWNER.B, TENANT_B, 'read', `select count(*) from public.insight_refund_by_sku_month`).out.split('\n').pop(), '0');
      assert.ok(Number(asBackend(h, OWNER.A, TENANT_A, 'read', `select count(*) from public.insight_refund_by_sku_month`).out.split('\n').pop()) > 10);
      let r = asBackend(h, OWNER.A, TENANT_A, 'import', `select public.record_source_sync('${TENANT_A}','hubspot','api_poll',true,12,null,340,now()+interval '5 minutes',300,now())`); assert.ok(r.ok, r.err);
      r = asBackend(h, OWNER.A, TENANT_A, 'import', `select public.record_source_sync('${TENANT_A}','hubspot','api_poll',false,null,'rate limited!',900,now()+interval '10 minutes',300,null)`); assert.ok(r.ok, r.err);
      assert.equal(q(h, `select status||'|'||last_error_code||'|'||(last_success_at is not null)||'|'||last_new_records||'|'||(data_watermark is not null) from public.source_sync_state where source_key='hubspot'`), 'error|RATE_LIMITED_|true|12|true');
      r = asBackend(h, OWNER.A, TENANT_A, 'import', `select public.record_source_sync('${TENANT_B}','x','api_poll',true)`); assert.equal(r.ok, false);
      r = asBackend(h, OWNER.A, TENANT_A, 'import', `select public.record_source_sync('${TENANT_A}','Bad Key','api_poll',true)`); assert.equal(r.ok, false); assert.match(r.err, /SYNC_STATE_INPUT_INVALID/);
    });

    await t.test('reversa: la migración se deshace limpia', () => {
      const d = h.file(DOWN); assert.equal(d.status, 0, String(d.stderr));
      assert.equal(q(h, `select count(*) from pg_proc where proname like 'insights_%' or proname in('refresh_insights','record_source_sync')`), '0');
      assert.equal(q(h, `select count(*) from pg_class where relname like 'insight_%' or relname='source_sync_state'`), '0');
      assert.equal(h.file(MIG).status, 0, 're-aplicable tras la reversa');
    });
  });
});
