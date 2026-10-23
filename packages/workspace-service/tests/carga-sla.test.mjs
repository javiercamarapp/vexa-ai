// «Carga y SLA»: agregadores puros + servicio contra Postgres local desechable con las migraciones reales, la propuesta 20261104 (insights) y la 20261112 (carga entrante).
// Datos 100 % sintéticos (SYN). Zona horaria America/Mexico_City (UTC-6 todo el año desde 2022).
//   node --test packages/workspace-service/tests/carga-sla.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {createRequire} from 'node:module';
import {withPg, pgAvailable} from '../../metrics/tests/pg-harness.mjs';
import {sembrarBase} from '../../metrics/tests/ledger-sintetico.mjs';
import {TENANT_A, OWNER} from '../../ai-scale/economia-problemas/mundo.mjs';
import {HERE} from '../../metrics/tests/world.mjs';
import {CONN, q, asBackend, sembrarOtros} from '../../insights/tests/seed.mjs';
import * as C from '../carga-sla.mjs';

const pg = createRequire(import.meta.url)('pg');
const SKIP = !pgAvailable() && 'sin postgres local';
const MIGS = ['20261104000000_insights_engine.sql', '20261112000000_insight_inbound_load.sql'].map(f => path.join(HERE, '../../../supabase/migrations', f));
const DOWN = path.join(HERE, '../../workspace-service/tests/20261112000000_insight_inbound_load.down.sql');

test('meses completos: se descarta el último, los huecos (< mitad del mes previo) y los de muy pocos datos', () => {
  const m = [['2026-01', 5000], ['2026-02', 1800], ['2026-03', 2800], ['2026-04', 3900], ['2026-05', 5100], ['2026-06', 5700], ['2026-07', 8700], ['2026-08', 2000], ['2026-09', 1000]].map(([mes, n]) => ({mes, n}));
  const todos = C.mesesParaCarga(m, 10);
  assert.deepEqual(todos.usados, ['2026-01', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07'], 'feb (1800 < 2500) y ago (2000 < 4350) son huecos; sep es parcial');
  assert.ok(todos.excluidos.some(e => e.mes === '2026-09' && e.motivo === 'mes_parcial') && todos.excluidos.some(e => e.mes === '2026-08' && e.motivo === 'posible_hueco'));
  assert.deepEqual(C.mesesParaCarga([{mes: '2026-01', n: 10}]).usados, []);
});
test('días por semana: se promedia por la cantidad real de cada día en los meses', () => {
  // 2026-09: 30 días, empieza martes -> lunes 4, martes 5, miércoles 5, jueves 4, viernes 4, sábado 4, domingo 4
  assert.deepEqual(C.diasPorSemana(['2026-09']), [4, 5, 5, 4, 4, 4, 4]);
});
test('carga: promedio por día y hora, hora pico, horas valle y días de menor carga', () => {
  const rows = [{dow: 1, hour: 10, n: 40}, {dow: 1, hour: 11, n: 20}, {dow: 2, hour: 10, n: 50}, {dow: 7, hour: 3, n: 4}, {dow: 6, hour: 3, n: 8}];
  const c = C.armarCarga(rows, ['2026-09']);
  assert.equal(c.total, 122); assert.equal(c.matriz[0][10], 10); assert.equal(c.matriz[1][10], 10); assert.equal(c.matriz[6][3], 1);
  assert.deepEqual(c.horasPico.map(h => h.hora), [10, 11, 3]); assert.equal(c.horasPico[0].pct, 73.8);
  assert.deepEqual(c.diasMenorCarga.map(d => d.dia), ['Jueves', 'Miércoles'], 'días sin conversaciones: los de menor carga (empate -> alfabético)');
  assert.equal(c.celdaPico.hora, 10);
  assert.deepEqual(C.armarCarga([], ['2026-09']).horasPico.map(h => h.total), [0, 0, 0]);
});
test('SLA: base, porcentajes con su denominador y valores nulos sin inventar', () => {
  const s = C.armarSla({hilos: 100, medibles: 90, con_resp: 20, dentro: 15, p50_h: '0.0063', p90_h: '384.03', abiertos_sin_resp_24: 30, abiertos_1_7: 0, abiertos_7_30: 0, abiertos_30: 30, cerrados_sin_resp: 40, min_creado: '2026-07-10', max_creado: '2026-07-20', corte: '2026-10-23T19:20:37Z'});
  assert.equal(s.pctDentroDeConRespuesta, 75); assert.equal(s.pctDentroDeMedibles, 16.7); assert.equal(s.pctConRespuesta, 22.2); assert.equal(s.fuera, 5); assert.equal(s.sinRespuestaRegistrada, 70);
  assert.equal(s.primeraRespuestaP90h, 384); assert.deepEqual(s.rango, {desde: '2026-07-10', hasta: '2026-07-20'});
  const v = C.armarSla({hilos: 0, medibles: 0, con_resp: 0, dentro: 0});
  assert.equal(v.pctDentroDeConRespuesta, null); assert.equal(v.primeraRespuestaP50h, null); assert.equal(v.rango, null);
});

const dbPg = (client, tenant) => ({async transaction(_m, work) {
  await client.query('BEGIN');
  try { return await work({tenantId: tenant, query: (t, p) => client.query(t, p)}); } finally { await client.query('ROLLBACK'); }
}});
test('servicio contra Postgres real: carga (precalculada y en vivo), canal, SLA de 24 h y cierre', {skip: SKIP, timeout: 600000}, async t => {
  await withPg(async h => {
    sembrarBase(h); sembrarOtros(h);
    for (const m of MIGS) { const r = h.file(m); assert.equal(r.status, 0, String(r.stderr)); }
    assert.equal(h.file(MIGS[1]).status, 0, 'idempotente');
    // Hilos de HubSpot t1..t6 ya existen en sync_raw_objects (sembrarOtros). Conversaciones y mensajes propios.
    const ids = {t1: 1, t2: 2, t3: 3, t4: 4, t5: 5, t6: 6};
    const cvs = Object.entries(ids).map(([k, i]) => `(md5('hs${i}')::uuid,'${TENANT_A}','hubspot','${k}','${CONN}')`).join(',');
    const ms = [['t1', 'customer', '2026-07-06 16:00:00+00'], ['t1', 'agent', '2026-07-06 16:30:00+00'], ['t2', 'customer', '2026-07-07 16:00:00+00'], ['t2', 'agent', '2026-07-09 17:00:00+00'],
      ['t3', 'customer', '2026-07-08 04:00:00+00'], ['t4', 'customer', '2026-07-04 12:00:00+00'], ['t5', 'customer', '2026-07-05 05:00:00+00'], ['t5', 'agent', '2026-07-05 06:00:00+00'], ['t5', 'agent', '2026-07-05 04:00:00+00']]
      .map(([k, role, at], j) => `(md5('hm${j}')::uuid,'${TENANT_A}','hm${j}','${role}',md5('hs${ids[k]}')::uuid,'${CONN}',timestamptz '${at}')`).join(',');
    const r0 = h.psql(`set session_replication_role=replica; insert into public.conversations(id,tenant_id,source,external_id,connection_id) values ${cvs};
      insert into public.messages(id,tenant_id,external_id,role,conversation_id,connection_id,occurred_at) values ${ms};`);
    assert.ok(r0.ok, r0.err);
    // Volumen de conversaciones por mes (meses completos: jul, ago, sep; el último, sep, es parcial)
    const ins = (mes, n) => `insert into public.insight_conversation_volume(tenant_id,grain,period,n,refreshed_at) values('${TENANT_A}','month','${mes}',${n},now())`;
    for (const sql of [ins('2026-06-01', 100), ins('2026-07-01', 120), ins('2026-08-01', 110), ins('2026-09-01', 30)]) q(h, sql);
    q(h, `insert into public.insight_state(tenant_id,insight,status,refreshed_at,source_rows,duration_ms,cursor,computed_from,detail) values('${TENANT_A}','conversation_volume','ready',now(),1,1,'{}','{}','{"undated":0,"total":360}')`);
    const cliente = new pg.Client({host: h.sock, user: 'postgres', database: 't'}); await cliente.connect();
    try {
      const repo = () => C.createWorkloadRepository({database: dbPg(cliente, TENANT_A), now: () => new Date('2026-10-23T12:00:00Z')});
      let v = await repo().get();
      assert.equal(v.carga.status, 'ok'); assert.equal(v.carga.origen, 'en_vivo', 'sin la tabla precalculada llena, se calcula en vivo'); assert.deepEqual(v.carga.meses, ['2026-06', '2026-07', '2026-08']);
      // mensajes de cliente en jul: t1 lun 6-jul 10:00 MX (1), t2 mar 7-jul 10:00 MX, t3 8-jul 04:00 UTC = mar 7-jul 22:00 MX, t4 4-jul 06:00 MX (sáb), t5 5-jul 05:00 UTC = sáb 4-jul 23:00 MX
      const cel = (d, hr) => Math.round(v.carga.matriz[d][hr] * v.carga.porDia[d].dias);
      assert.equal(cel(0, 10), 1); assert.equal(cel(1, 10), 1); assert.equal(cel(1, 22), 1); assert.equal(cel(5, 6), 1); assert.equal(cel(5, 23), 1); assert.equal(v.carga.total, 15, '5 de jul + 10 de ago que siembra sembrarOtros (mié 03:00 México)');
      assert.equal(v.canal.status, 'ok'); assert.equal(v.canal.conCanal, 0); assert.equal(v.canal.derivable, false);
      // SLA: 6 hilos; medibles = 5 (t6 sin mensajes); t1 responde a los 30 min, t2 a las 49 h, t5 (la respuesta de 04:00 es ANTERIOR al cliente 05:00 y no cuenta; la de 06:00 sí: 1 h)
      const s = v.sla; assert.equal(s.status, 'ok');
      assert.deepEqual([s.hilos, s.medibles, s.conRespuestaRegistrada, s.dentro, s.fuera, s.sinRespuestaRegistrada], [6, 5, 3, 2, 1, 2]);
      assert.equal(s.pctDentroDeConRespuesta, 66.7); assert.equal(s.primeraRespuestaP50h, 1);
      assert.equal(s.abiertosSinRespuesta24h, 1, 't4 está OPEN y sin respuesta desde hace más de 24 h'); assert.equal(s.edadAbiertos.d30, 1); assert.equal(s.cerradosSinRespuestaRegistrada, 1, 't3 cerrado sin respuesta registrada');
      assert.deepEqual(s.rango, {desde: '2026-06-30', hasta: '2026-07-31'}, 'rango en hora de México (createdAt UTC 00:00 cae el día anterior)');
      assert.ok(!JSON.stringify(v).match(/hm\d|hs\d/), 'sin identificadores de mensajes ni conversaciones');
      // cierre (insight_thread_resolution): aún no calculado -> «not_computed»; tras refrescar, ok
      assert.equal(v.cierre.status, 'not_computed');
      let r = asBackend(h, OWNER.A, TENANT_A, 'import', `select public.refresh_insights('${TENANT_A}','hubspot')`); assert.ok(r.ok, r.err);
      v = await repo().get(); assert.equal(v.cierre.status, 'ok'); assert.equal(v.cierre.threads, 6);
      // carga precalculada: permisos y exactitud
      const den = h.psql(`set role vexa_backend; select public.refresh_inbound_load('${TENANT_A}')`); assert.equal(den.ok, false); assert.match(den.err, /denied/);
      r = asBackend(h, OWNER.A, TENANT_A, 'read', `select public.refresh_inbound_load('${TENANT_A}')`); assert.equal(r.ok, false, 'acción read no basta');
      r = asBackend(h, OWNER.A, TENANT_A, 'import', `insert into public.insight_inbound_load(tenant_id,month,dow,hour,n,refreshed_at) values('${TENANT_A}','2026-07-01',1,1,1,now())`); assert.equal(r.ok, false, 'la app no escribe la tabla');
      r = asBackend(h, OWNER.A, TENANT_A, 'import', `select public.refresh_inbound_load('${TENANT_A}')`); assert.ok(r.ok, r.err);
      assert.equal(q(h, `select string_agg(month||'/'||dow||'/'||hour||'='||n,',' order by month,dow,hour) from public.insight_inbound_load where tenant_id='${TENANT_A}'`), '2026-07-01/1/10=1,2026-07-01/2/10=1,2026-07-01/2/22=1,2026-07-01/6/6=1,2026-07-01/6/23=1,2026-08-01/3/3=10');
      v = await repo().get();
      assert.equal(v.carga.origen, 'en_vivo', 'el mes de jun no está en la tabla precalculada: no se mezcla, se calcula en vivo (exacto)');
      q(h, `insert into public.insight_inbound_load(tenant_id,month,dow,hour,n,refreshed_at) values('${TENANT_A}','2026-06-01',3,9,2,now())`);
      v = await repo().get(); assert.equal(v.carga.origen, 'precalculado'); assert.equal(v.carga.total, 17);
    } finally { await cliente.end(); }
    const down = h.file(DOWN); assert.equal(down.status, 0, String(down.stderr));
    assert.equal(q(h, `select to_regclass('public.insight_inbound_load') is null`), 't');
  });
});
test('servicio: sin tablas ni datos responde «no disponible» por parte, nunca ceros', async () => {
  const db = {async transaction(_m, work) { return work({tenantId: 'syn', query: async t => { t = String(t); if (/current_setting\('statement_timeout'\)/.test(t)) return {rows: [{v: '0'}]}; if (/^(SAVEPOINT|RELEASE|ROLLBACK)/.test(t) || /set_config/.test(t)) return {rows: []}; throw new Error('57014'); }}); }};
  const v = await C.createWorkloadRepository({database: db}).get();
  assert.deepEqual(v.parts, {carga: 'unavailable', canal: 'unavailable', sla: 'unavailable', cierre: 'unavailable'});
});
