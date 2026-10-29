// Semillas sintéticas compartidas por las pruebas del motor de insights y de su lectura (SYN, sin PII).
import {createHash} from 'node:crypto';
import {FUENTES} from '../../metrics/tests/ledger-sintetico.mjs';
import {TENANT_A, TENANT_B, OWNER, psqlFile} from '../../ai-scale/economia-problemas/mundo.mjs';
import assert from 'node:assert/strict';
export const CONN = 'cccccccc-0000-4000-8000-0000000000a1';
export const hex = s => createHash('sha256').update(String(s)).digest('hex');
const uuid = (p, i) => `${p}-0000-4000-8000-${String(i).padStart(12, '0')}`.replace(/^(.{8})-(.*)$/, (_, a, b) => a.padEnd(8, '0').slice(0, 8) + '-' + b);
export const SKUS = ['SKUP-L1', 'SKUP-L1-WM12', 'STX2-M1-NEW', 'GTX6-M-001A-001'];
export const BASE = s => s.replace(/(-WM[0-9]+|-[0-9]{3}A-[0-9]{3}|-NEW)$/, '');

/** Reembolsos deterministas: [{i, entity, ext, ch, sku, month, cur, amt|null, status}] */
export function refunds(n = 300) {
  const out = [];
  for (let i = 1; i <= n; i++) {
    const k = i % 3, ch = k === 0 ? 'amazon' : 'walmart', sku = SKUS[i % 4], month = ['2026-07', '2026-08', '2026-09'][i % 3 === 0 ? i % 2 : (i + 1) % 3];
    const cad = i % 50 === 0;
    out.push({i, ch, sku, month, cur: cad ? 'CAD' : 'USD', amt: ch === 'amazon' && i % 5 === 0 ? null : 1000 + i, status: ch === 'walmart' ? (i % 10 === 0 ? 'cancelled' : 'settled') : 'unknown',
      ext: ch === 'amazon' ? `amazon|k${i}||${sku}` : `walmart|${100000000000000000n + BigInt(i)}|1|${sku}`});
  }
  return out;
}
export function insertRefunds(h, rows, {revision = 1, tag = 'r'} = {}) {
  const f = c => (c === 'amazon' ? FUENTES['amazon-devoluciones'] : FUENTES['walmart-devoluciones']).sourceId;
  const values = rows.map(r => `('${TENANT_A}',md5('${tag}${r.i}')::uuid,'${f(r.ch)}',1,${revision},'${OWNER.A}',timestamptz '2026-10-0${revision}'+interval '${r.i} minutes','${r.ext}','refund',timestamptz '${r.month}-15 12:00:00+00','${r.cur}',2,'marketplace_refund_amount',${r.amt ?? 'null'},'${r.status}','{}'::jsonb,'SYN libro: registro sintético de prueba con procedencia documentada, sin datos de clientes.','${hex('a')}',true)`).join(',\n');
  const res = psqlFile(h.sock, `set session_replication_role=replica;alter table public.economic_ledger_entries disable trigger user;
   insert into public.economic_ledger_entries(tenant_id,entity_id,source_id,source_version,revision,actor_id,recorded_at,external_id,kind,effective_at,currency,exponent,basis,amount_minor,status,details,report,report_hash,attested) values ${values};
   alter table public.economic_ledger_entries enable trigger user;`);
  if (res.status !== 0) throw Error('refunds: ' + String(res.stderr).slice(0, 500));
}
export const q = (h, sql) => { const r = h.psql(sql); assert.ok(r.ok, r.err + ' :: ' + sql.slice(0, 200)); return r.out; };
export const asBackend = (h, user, tenant, action, sql) => h.psql(`set role vexa_backend; select set_config('request.jwt.claim.sub','${user}',true),set_config('vexa.tenant_id','${tenant}',true),set_config('vexa.action','${action}',true); ${sql}`);

export function sembrarOtros(h) {
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
export function sembrarTracker(h) {
  // Cabecera + 6 filas de Refunds: 3 reembolsado (2 con monto), 1 vencido, 1 con texto libre en Status (=> otro), 1 vacía (descartada). Dos versiones de la fila 2 (manda la última).
  const hdr = ['Status', 'Contact_reason', 'Retailer', 'Amount'].map((v, col) => `{"col":${col},"v":"${v}"}`).join(',');
  const row = (st, rs, rt, amt) => `[{"col":0,"v":"${st}"},{"col":1,"v":"${rs}"},{"col":2,"v":"${rt}"},{"col":3,"v":"${amt}"}]`;
  const rows = [[1, 'header', `[${hdr}]`, 0], [2, 'linked', row('Pending', 'Defective', 'Amazon :: fulfilled by PILOTO', ''), 1], [2, 'linked', row('Refunded', 'Defective', 'Amazon :: fulfilled by PILOTO', '$100.50'), 2],
    [3, 'linked', row('Refunded', 'Warranty', 'Walmart :: fulfilled by PILOTO', '40'), 3], [4, 'linked', row('Refunded', 'Warranty', 'Walmart :: fulfilled by PILOTO', ''), 4], [5, 'linked', row('Older than 180 days', 'Return', 'Lowes', '10'), 5],
    [6, 'linked', row('Allen se lo paso a logistica', 'Algo libre raro', 'Quien sabe', '5'), 6], [7, 'no_ticket', row('', '', '', ''), 7]];
  const vals = rows.map(([n, st, cells, k]) => `(md5('tr${n}-${k}')::uuid,'${TENANT_A}',timestamptz '2026-10-02 00:00:00+00'+${k}*interval '1 minute','${CONN}','Refunds',${n},'${hex('e' + n + k)}','${cells}'::jsonb,'${st}',md5('ver')::uuid)`).join(',');
  const r = psqlFile(h.sock, `set session_replication_role=replica;insert into public.tracker_row_revisions(id,tenant_id,created_at,connection_id,sheet_name,row_number,row_hash,cells,ticket_state,first_version_id) values ${vals};`);
  if (r.status !== 0) throw Error('tracker: ' + String(r.stderr).slice(0, 500));
}

