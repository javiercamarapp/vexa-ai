// Resúmenes precomputados (migración 20261022000000) a escala real: 85,361 asientos, 117,719 hechos / 72,720 vínculos, conversaciones y mensajes.
// Postgres local desechable con las migraciones REALES, rol vexa_backend y RLS real; datos 100 % sintéticos (SYN). La migración de asociaciones 20261021000000 NO se aplica:
// el conteo exacto de asociaciones debe salir de los conteos mantenidos.
//   node --test packages/workspace-service/tests/agregados.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {createRequire} from 'node:module';
import {withPg, pgAvailable} from '../../metrics/tests/pg-harness.mjs';
import {sembrarBase, cargarAsientos} from '../../metrics/tests/ledger-sintetico.mjs';
import {crearBaseDatos} from '../../ai-scale/economia-problemas/snapshot.mjs';
import {TENANT_A, TENANT_B, OWNER, psqlFile} from '../../ai-scale/economia-problemas/mundo.mjs';
import {HERE} from '../../metrics/tests/world.mjs';
import {createProvenanceRepository} from '../provenance.mjs';
import {createTrendsRepository, monthWindow} from '../trends.mjs';
import {createCfoRepository, LEDGER_MONTHLY_SQL} from '../../cfo-copilot/src/cfo-repository.mjs';
import {readLedgerMonthly} from '../summaries.mjs';

const pg = createRequire(import.meta.url)('pg');
const SKIP = !pgAvailable() && 'sin postgres local';
const MIG = path.join(HERE, '../../../supabase/migrations/20261022000000_precomputed_summaries.sql');
const DOWN = path.join(HERE, '../../workspace-service/tests/20261022000000_precomputed_summaries.down.sql');
const FACTS = 117719, LINKS = 72720, LEDGER = 85361, CONVS = 12000;
const C = 'cccccccc-0000-4000-8000-0000000000a1', CB = 'cccccccc-0000-4000-8000-0000000000b1';
const NOW = new Date('2026-10-19T12:00:00Z');

function sembrarAsociaciones(h) {
  const r = psqlFile(h.sock, `set session_replication_role=replica;set statement_timeout=0;
 insert into public.connections(id,tenant_id,source,account_id) values('${C}','${TENANT_A}','hubspot','syn-portal'),('${CB}','${TENANT_B}','hubspot','syn-portal-b');
 alter table public.native_customer_associations disable trigger user;alter table public.conversation_customer_association_bindings disable trigger user;
 insert into public.native_customer_associations(id,tenant_id,source_connection_id,provider,portal_id,ticket_id,contact_id,first_evidence_hash,immutable_evidence,first_import_row_id,source_version_hash,resolution_state,reason)
  select md5('f'||i)::uuid,'${TENANT_A}','${C}','hubspot','p1','t'||i,'c'||i,repeat('a',64),'{}'::jsonb,md5('r'||i)::uuid,repeat('b',64),
   case when i<=${LINKS} then 'resolved' when i<=${LINKS + 25000} then 'pending' when i<=${LINKS + 40000} then 'blocked' else 'retained' end,'syn' from generate_series(1,${FACTS}) i;
 insert into public.native_customer_associations(id,tenant_id,source_connection_id,provider,portal_id,ticket_id,contact_id,first_evidence_hash,immutable_evidence,first_import_row_id,source_version_hash,resolution_state,reason)
  select md5('fb'||i)::uuid,'${TENANT_B}','${CB}','hubspot','p1','t'||i,'c'||i,repeat('a',64),'{}'::jsonb,md5('rb'||i)::uuid,repeat('b',64),'resolved','syn' from generate_series(1,50) i;
 insert into public.conversation_customer_association_bindings(tenant_id,fact_id,conversation_id,customer_id,conversation_connection_id,customer_connection_id,conversation_revision_id,customer_revision_id,conversation_head_version,customer_head_version,fact_version,evidence_hash,method,decision_id,actor_id,active,provenance)
  select '${TENANT_A}',md5('f'||i)::uuid,md5('cv'||i)::uuid,md5('cu'||i)::uuid,'${C}','${C}',gen_random_uuid(),gen_random_uuid(),1,1,1,repeat('a',64),'unique_explicit_bridge',gen_random_uuid(),'${OWNER.A}',true,'{}'::jsonb from generate_series(1,${LINKS}) i;
 insert into public.conversation_customer_association_bindings(tenant_id,fact_id,conversation_id,customer_id,conversation_connection_id,customer_connection_id,conversation_revision_id,customer_revision_id,conversation_head_version,customer_head_version,fact_version,evidence_hash,method,decision_id,actor_id,active,provenance,deactivated_at)
  select '${TENANT_A}',md5('f'||i)::uuid,md5('cvx'||i)::uuid,md5('cux'||i)::uuid,'${C}','${C}',gen_random_uuid(),gen_random_uuid(),1,1,1,repeat('a',64),'owner_decision',gen_random_uuid(),'${OWNER.A}',false,'{}'::jsonb,now() from generate_series(1,1000) i;
 alter table public.native_customer_associations enable trigger user;alter table public.conversation_customer_association_bindings enable trigger user;
 analyze public.native_customer_associations;analyze public.conversation_customer_association_bindings;`);
  if (r.status !== 0) throw Error('asociaciones: ' + String(r.stderr).slice(0, 500));
}

// CONVS conversaciones de A: 98 % sin started_at (fechadas por su primer mensaje, 2 meses antes de la ventana a 14 meses), 2 % con started_at, 300 sin ninguna fecha, 200 borradas; B: 40.
function sembrarConversaciones(h) {
  const r = psqlFile(h.sock, `set session_replication_role=replica;set statement_timeout=0;
 insert into public.conversations(id,tenant_id,source,external_id,connection_id,started_at,deleted_at)
  select md5('cv'||i)::uuid,'${TENANT_A}','csv','h'||i,'${C}',case when i%50=0 then timestamptz '2026-10-15 00:00:00+00'-(i%400)*interval '1 day' end,case when i>${CONVS - 200} then now() end from generate_series(1,${CONVS}) i
  on conflict do nothing;
 insert into public.conversations(id,tenant_id,source,external_id,connection_id) select md5('cvb'||i)::uuid,'${TENANT_B}','csv','h'||i,'${CB}' from generate_series(1,40) i;
 insert into public.messages(id,tenant_id,external_id,role,conversation_id,connection_id,occurred_at)
  select md5('m'||c.i||'-'||k)::uuid,'${TENANT_A}','m'||c.i||'-'||k,'customer',md5('cv'||c.i)::uuid,'${C}',timestamptz '2026-10-15 00:00:00+00'-((c.i*7)%430)*interval '1 day'+k*interval '1 hour'
  from generate_series(1,${CONVS - 300}) c(i) cross join generate_series(1,3) k;
 insert into public.messages(id,tenant_id,external_id,role,conversation_id,connection_id,occurred_at)
  select md5('mb'||i)::uuid,'${TENANT_B}','mb'||i,'customer',md5('cvb'||i)::uuid,'${CB}',timestamptz '2026-09-10 00:00:00+00' from generate_series(1,40) i;
 analyze public.conversations;analyze public.messages;`);
  if (r.status !== 0) throw Error('conversaciones: ' + String(r.stderr).slice(0, 500));
}

test('resúmenes precomputados: paridad exacta, RLS, idempotencia, obsolescencia, latencia', {skip: SKIP, timeout: 1500000}, async t => {
  await withPg(async h => {
    sembrarBase(h); cargarAsientos(h, {total: LEDGER}); sembrarAsociaciones(h); sembrarConversaciones(h);
    const pool = new pg.Pool({host: h.sock, user: 'postgres', database: 't', max: 4}); t.after(() => pool.end());
    const db = (tenant, user, ms = 10000) => crearBaseDatos({pool, tenantId: tenant, userId: user, statementTimeoutMs: ms});
    const win = monthWindow(NOW, 12);
    const months = win.list.map(m => m + '-01'); // los 12 meses de la ventana
    const time = async f => { const t0 = process.hrtime.bigint(); const v = await f(); return {v, ms: Number(process.hrtime.bigint() - t0) / 1e6}; };

    // ---- 0. Estado previo: sin la migración todo cae al camino anterior (nada se inventa) ----
    await t.test('sin migración: cfo/tendencias/cobertura usan el camino anterior y rotulan', async () => {
      const cfo = await createCfoRepository({database: db(TENANT_A, OWNER.A), now: () => NOW, timeoutMs: 60000}).ledgerMonthly();
      assert.equal(cfo.summary.source, 'direct'); assert.equal(cfo.summary.freshness, 'unavailable'); assert.equal(cfo.status, 'ok');
      const cov = await createProvenanceRepository({database: db(TENANT_A, OWNER.A)}).coverage();
      assert.ok(['observed', 'estimated'].includes(cov.sources.find(s => s.key === 'associations').class));
    });

    // ---- 1. Aplicar (dos veces) ----
    const a1 = h.file(MIG); assert.equal(a1.status, 0, String(a1.stderr));
    const a2 = h.file(MIG); assert.equal(a2.status, 0, 'idempotente: ' + String(a2.stderr));
    await t.test('sin refrescar: tablas vacías => ausente, camino anterior, nunca ceros', async () => {
      const cfo = await createCfoRepository({database: db(TENANT_A, OWNER.A), now: () => NOW, timeoutMs: 60000}).ledgerMonthly();
      assert.equal(cfo.summary.source, 'direct'); assert.equal(cfo.summary.freshness, 'absent'); assert.ok(cfo.rows.length > 50);
    });
    await t.test('permisos: la app (vexa_backend) no escribe ni refresca; solo lee', () => {
      for (const sql of [`set role vexa_backend; select public.refresh_economic_ledger_counts('${TENANT_A}')`, `set role vexa_backend; insert into public.economic_ledger_monthly(tenant_id,month,source_id,kind,status,currency,exponent,basis,n,known,amount_minor,refreshed_at) values('${TENANT_A}','2026-01-01',gen_random_uuid(),'order','recorded','USD',2,'x',1,1,1,now())`,
        `set role vexa_backend; delete from public.association_counts`, `set role authenticated; select * from public.conversation_monthly`]) {
        const r = h.psql(sql); assert.equal(r.ok, false, sql); assert.match(r.err, /permission denied/i, sql);
      }
    });
    await t.test('refresh_*: entradas inválidas rechazadas', () => {
      for (const sql of ["select public.refresh_economic_ledger_monthly(null,'2026-10-01')", `select public.refresh_economic_ledger_monthly('${TENANT_A}',null)`, `select public.refresh_economic_ledger_monthly('${TENANT_A}','1999-01-01')`, "select public.refresh_conversation_monthly('99999999-9999-4999-8999-999999999999')"]) {
        const r = h.psql(sql); assert.equal(r.ok, false, sql); assert.match(r.err, /SUMMARY_/, sql);
      }
    });

    // ---- 2. Refresco por ventanas (un mes por llamada) ----
    const refreshTimes = [];
    for (const m of months) { const t0 = Date.now(); const r = h.psql(`select public.refresh_economic_ledger_monthly('${TENANT_A}','${m}')`); assert.ok(r.ok, r.err); refreshTimes.push(Date.now() - t0); }
    const tc = Date.now(); assert.ok(h.psql(`select public.refresh_economic_ledger_counts('${TENANT_A}')`).ok); const msCounts = Date.now() - tc;
    const tv = Date.now(); assert.ok(h.psql(`select public.refresh_conversation_monthly('${TENANT_A}')`).ok); const msConv = Date.now() - tv;
    const ta = Date.now(); assert.ok(h.psql(`select public.refresh_association_counts('${TENANT_A}')`).ok); const msAssoc = Date.now() - ta;
    console.log(`# refresco local (85k asientos): por mes máx ${Math.max(...refreshTimes)} ms (${refreshTimes.join('/')}); conteos ${msCounts} ms; conversaciones ${msConv} ms; asociaciones ${msAssoc} ms`);

    await t.test('paridad EXACTA mes a mes: resumen == cálculo directo (LEDGER_MONTHLY_SQL), en ambos sentidos', () => {
      const direct = `with latest as (select distinct on (entity_id) entity_id,source_id,kind,status,effective_at,currency,exponent,basis,amount_minor from public.economic_ledger_entries where tenant_id='${TENANT_A}' and kind in ('order','refund') order by entity_id,revision desc)
        select to_char(effective_at at time zone 'UTC','YYYY-MM-01')::date as month,source_id,kind,status,currency,exponent::smallint,basis,count(*) n,count(amount_minor) known,coalesce(sum(amount_minor),0) amount_minor from latest
        where effective_at>=timestamptz '${win.start.toISOString()}' and effective_at<timestamptz '${win.end.toISOString()}' group by 1,2,3,4,5,6,7`;
      const summ = `select month,source_id,kind,status,currency,exponent,basis,n,known,amount_minor from public.economic_ledger_monthly where tenant_id='${TENANT_A}'`;
      const d1 = h.psql(`select count(*) from ((${direct}) except (${summ})) x`), d2 = h.psql(`select count(*) from ((${summ}) except (${direct})) x`);
      assert.equal(d1.out, '0', d1.err); assert.equal(d2.out, '0', d2.err);
      const n = Number(h.psql(`select count(*) from public.economic_ledger_monthly where tenant_id='${TENANT_A}'`).out); assert.ok(n > 50, 'filas ' + n);
      const tot = h.psql(`select sum(n) from public.economic_ledger_monthly where tenant_id='${TENANT_A}'`).out; assert.ok(Number(tot) > 60000, 'entidades resumidas ' + tot);
    });
    await t.test('paridad de conteos del libro y de conversaciones/asociaciones contra el cálculo directo', () => {
      const e = h.psql(`select count(*) from ((select source_id,currency,kind,count(distinct entity_id) a,count(*) b from public.economic_ledger_entries where tenant_id='${TENANT_A}' group by 1,2,3) except (select source_id,currency,kind,entities,revisions from public.economic_ledger_counts where tenant_id='${TENANT_A}')) x`);
      assert.equal(e.out, '0', e.err);
      const c = h.psql(`select count(*) from ((select (date_trunc('month',d at time zone 'UTC'))::date m,count(*) from (select coalesce(c.started_at,(select min(m.occurred_at) from public.messages m where m.tenant_id=c.tenant_id and m.conversation_id=c.id and m.deleted_at is null)) d from public.conversations c where c.tenant_id='${TENANT_A}' and c.deleted_at is null) z where d is not null group by 1) except (select month,n from public.conversation_monthly where tenant_id='${TENANT_A}')) x`);
      assert.equal(c.out, '0', c.err);
      assert.equal(h.psql(`select (detail->>'total')::int from public.summary_refresh_state where summary='conversation_monthly'`).out, String(CONVS - 200));
      assert.equal(h.psql(`select n from public.association_counts where metric='fact_resolved' and tenant_id='${TENANT_A}'`).out, String(LINKS));
      assert.equal(h.psql(`select sum(n) from public.association_counts where metric like 'fact_%' and tenant_id='${TENANT_A}'`).out, String(FACTS));
      assert.equal(h.psql(`select n from public.association_counts where metric='binding_active' and tenant_id='${TENANT_A}'`).out, String(LINKS));
    });

    // ---- 3. Lecturas de la app bajo RLS ----
    const cfoRepo = (tenant = TENANT_A, user = OWNER.A) => createCfoRepository({database: db(tenant, user), now: () => NOW});
    await t.test('CFO: lee el resumen (<200 ms), fresco, mismas filas que la consulta directa', async () => {
      await cfoRepo().ledgerMonthly(); // caliente
      const {v, ms} = await time(() => cfoRepo().ledgerMonthly());
      assert.equal(v.summary.source, 'summary'); assert.equal(v.summary.freshness, 'fresh'); assert.match(v.summary.label, /^Observado · resumen al \d{4}-\d\d-\d\d/);
      assert.ok(ms < 200, 'CFO ' + ms + ' ms');
      const direct = await db(TENANT_A, OWNER.A).transaction('read', async s => (await s.query(LEDGER_MONTHLY_SQL, [s.tenantId, win.start.toISOString(), win.end.toISOString()])).rows);
      const key = r => [r.month, r.source_id ?? r.sourceId, r.kind, r.status, r.currency, r.exponent, r.basis].join('|');
      assert.equal(v.rows.reduce((a, r) => a + r.n, 0), direct.reduce((a, r) => a + Number(r.n), 0));
      const mapD = new Map(direct.map(r => [[r.month, r.kind, r.status, r.currency, r.basis, r.source_id].join('|'), r.amount + ':' + r.n + ':' + r.known]));
      assert.equal(v.rows.length, direct.length);
      const total = v.rows.reduce((a, r) => a + BigInt(r.amountMinor), 0n), totalD = direct.reduce((a, r) => a + BigInt(r.amount), 0n); assert.equal(total, totalD);
      assert.ok(mapD.size === direct.length && key);
    });
    await t.test('tendencias: conversaciones y libro desde resúmenes (<200 ms), Observado, cifras = cálculo directo', async () => {
      const trends = () => createTrendsRepository({database: db(TENANT_A, OWNER.A), now: () => NOW});
      await trends().monthly();
      const {v, ms} = await time(() => trends().monthly());
      assert.ok(ms < 200, 'tendencias ' + ms + ' ms');
      assert.equal(v.conversations.class, 'observed'); assert.equal(v.conversations.sampled, false); assert.equal(v.conversations.summary.freshness, 'fresh'); assert.equal(v.conversations.total, CONVS - 200);
      const direct = h.psql(`select to_char(m,'YYYY-MM')||':'||n from (select (date_trunc('month',d at time zone 'UTC'))::date m,count(*) n from (select coalesce(c.started_at,(select min(m.occurred_at) from public.messages m where m.tenant_id=c.tenant_id and m.conversation_id=c.id and m.deleted_at is null)) d from public.conversations c where c.tenant_id='${TENANT_A}' and c.deleted_at is null) z where d>=timestamptz '${win.start.toISOString()}' and d<timestamptz '${win.end.toISOString()}' group by 1 order by 1) q`).out.split('\n');
      const got = v.conversations.series.filter(p => p.count > 0).map(p => p.month + ':' + p.count); assert.deepEqual(got, direct);
      assert.equal(v.conversations.undated, Number(h.psql(`select count(*) from public.conversations c where c.tenant_id='${TENANT_A}' and c.deleted_at is null and c.started_at is null and not exists(select 1 from public.messages m where m.conversation_id=c.id and m.deleted_at is null)`).out));
      assert.equal(v.ledger.class, 'observed'); assert.equal(v.ledger.summary.freshness, 'fresh');
      const dl = h.psql(`with latest as (select distinct on (entity_id) * from public.economic_ledger_entries where tenant_id='${TENANT_A}' and kind in('order','refund') order by entity_id,revision desc) select m||':'||n||':'||a from (select to_char(effective_at at time zone 'UTC','YYYY-MM') m,count(*) n,coalesce(sum(amount_minor),0) a from latest where kind='order' and status='recorded' and currency='${v.ledger.currency}' and effective_at>=timestamptz '${win.start.toISOString()}' and effective_at<timestamptz '${win.end.toISOString()}' group by 1 order by 1) q`).out.split('\n');
      const lg = v.ledger.series.filter(p => p.orders.count > 0).map(p => p.month + ':' + p.orders.count + ':' + p.orders.amountMinor); assert.deepEqual(lg, dl);
    });
    await t.test('cobertura: asociaciones EXACTAS (117,719 / 72,720) SIN la migración de políticas, libro exacto, <500 ms', async () => {
      const cov = () => createProvenanceRepository({database: db(TENANT_A, OWNER.A)}).coverage();
      await cov();
      const {v, ms} = await time(cov); const S = Object.fromEntries(v.sources.map(s => [s.key, s]));
      assert.equal(S.associations.class, 'observed'); assert.equal(S.associations.total, FACTS); assert.match(S.associations.detail[0], /117[.,]719 hechos \(resueltos 72[.,]720/); assert.match(S.associations.detail[1], /72[.,]720 vínculos activos/);
      assert.ok(S.associations.detail.includes('Conteo exacto.')); assert.equal(S.associations.summary.freshness, 'fresh');
      const exact = Number(h.psql(`select count(distinct entity_id) from public.economic_ledger_entries where tenant_id='${TENANT_A}'`).out);
      assert.equal(S.ledger.class, 'observed'); assert.equal(S.ledger.total, exact); assert.ok(S.ledger.detail.some(l => /Conteo exacto del libro: .* en 85[.,]361 revisiones/.test(l)), S.ledger.detail.join('|'));
      assert.ok(ms < 500, 'cobertura ' + ms + ' ms');
    });
    await t.test('aislamiento: otra organización ve solo lo suyo; un miembro no puede leer ni pedir otro tenant', async () => {
      const own = await db(TENANT_B, OWNER.B).transaction('read', async s => ({
        mine: Number((await s.query('select count(*) n from public.economic_ledger_monthly')).rows[0].n),
        other: Number((await s.query('select count(*) n from public.economic_ledger_monthly where tenant_id=$1', [TENANT_A])).rows[0].n),
        convA: Number((await s.query('select count(*) n from public.conversation_monthly where tenant_id=$1', [TENANT_A])).rows[0].n),
        assocA: Number((await s.query('select count(*) n from public.association_counts where tenant_id=$1', [TENANT_A])).rows[0].n),
        stateA: Number((await s.query('select count(*) n from public.summary_refresh_state where tenant_id=$1', [TENANT_A])).rows[0].n)}));
      assert.deepEqual(own, {mine: 0, other: 0, convA: 0, assocA: 0, stateA: 0});
      await assert.rejects(() => cfoRepo(TENANT_B, OWNER.A).ledgerMonthly(), /organization_not_authorized/);
      // B refrescado: sus filas son suyas y no mezclan datos de A
      assert.ok(h.psql(`select public.refresh_association_counts('${TENANT_B}')`).ok); assert.ok(h.psql(`select public.refresh_conversation_monthly('${TENANT_B}')`).ok);
      const b = await createProvenanceRepository({database: db(TENANT_B, OWNER.B)}).coverage(); assert.equal(b.sources.find(s => s.key === 'associations').total, 50);
      const bt = await createTrendsRepository({database: db(TENANT_B, OWNER.B), now: () => NOW}).monthly(); assert.equal(bt.conversations.total, 40);
    });

    // ---- 4. Idempotencia ----
    await t.test('idempotencia: repetir el refresco no cambia ni una cifra (ni duplica filas)', () => {
      const snap = () => h.psql(`select md5(string_agg(x::text,'|' order by x::text)) from (select month,source_id,kind,status,currency,exponent,basis,n,known,amount_minor from public.economic_ledger_monthly where tenant_id='${TENANT_A}') x`).out
        + h.psql(`select md5(string_agg(x::text,'|' order by x::text)) from (select month,n from public.conversation_monthly where tenant_id='${TENANT_A}') x`).out
        + h.psql(`select md5(string_agg(x::text,'|' order by x::text)) from (select metric,n from public.association_counts where tenant_id='${TENANT_A}') x`).out
        + h.psql(`select md5(string_agg(x::text,'|' order by x::text)) from (select source_id,currency,kind,entities,revisions from public.economic_ledger_counts where tenant_id='${TENANT_A}') x`).out;
      const before = snap(), rows = h.psql(`select count(*) from public.economic_ledger_monthly`).out;
      for (const m of months) assert.ok(h.psql(`select public.refresh_economic_ledger_monthly('${TENANT_A}','${m}')`).ok);
      assert.ok(h.psql(`select public.refresh_economic_ledger_counts('${TENANT_A}')`).ok); assert.ok(h.psql(`select public.refresh_conversation_monthly('${TENANT_A}')`).ok); assert.ok(h.psql(`select public.refresh_association_counts('${TENANT_A}')`).ok);
      assert.equal(snap(), before); assert.equal(h.psql(`select count(*) from public.economic_ledger_monthly`).out, rows);
      assert.equal(h.psql(`select count(*) from public.summary_refresh_state where tenant_id='${TENANT_A}'`).out, String(months.length + 3));
    });

    // ---- 5. Obsolescencia ----
    await t.test('obsolescencia: una revisión nueva del libro => «Resumen al <fecha>» y nunca Observado; al refrescar vuelve a fresco con la cifra nueva', async () => {
      // revisión 4 (importe cambiado) de una entidad existente de octubre 2026, y una entidad que se MUDA de mes
      const ins = (rev, eff, amount, ent) => `insert into public.economic_ledger_entries(tenant_id,entity_id,source_id,source_version,revision,actor_id,recorded_at,external_id,kind,effective_at,currency,exponent,basis,amount_minor,status,details,report,report_hash,attested)
        select tenant_id,entity_id,source_id,source_version,${rev},actor_id,clock_timestamp(),external_id,kind,${eff},currency,exponent,basis,${amount},status,'{}'::jsonb,report,report_hash,true from public.economic_ledger_entries where entity_id=${ent} and revision=${rev}-1`;
      const pick = h.psql(`select entity_id||'|'||max_rev||'|'||to_char(eff,'YYYY-MM') from (select entity_id,max(revision) max_rev,(array_agg(effective_at order by revision desc))[1] eff from public.economic_ledger_entries where tenant_id='${TENANT_A}' and kind='order' and status='recorded' and amount_minor is not null and effective_at>=timestamptz '2026-08-01' and effective_at<timestamptz '2026-09-01' group by 1 order by 1 limit 1) q`).out.split('|');
      const [ent, rev, oldMonth] = pick;
      const before = await cfoRepo().ledgerMonthly(); assert.equal(before.summary.freshness, 'fresh');
      const sql = `set session_replication_role=replica;alter table public.economic_ledger_entries disable trigger user;${ins(Number(rev) + 1, "timestamptz '2026-10-03 10:00:00+00'", 123456789, `'${ent}'`)};alter table public.economic_ledger_entries enable trigger user;`;
      assert.equal(psqlFile(h.sock, sql).status, 0);
      const stale = await cfoRepo().ledgerMonthly();
      assert.equal(stale.summary.freshness, 'stale'); assert.match(stale.summary.label, /^Resumen al \d{4}-\d\d-\d\d: el origen tiene registros posteriores/); assert.doesNotMatch(stale.summary.label, /Observado/);
      const tr = await createTrendsRepository({database: db(TENANT_A, OWNER.A), now: () => NOW}).monthly(); assert.equal(tr.ledger.class, 'estimated'); assert.equal(tr.ledger.summary.freshness, 'stale');
      const cov = await createProvenanceRepository({database: db(TENANT_A, OWNER.A)}).coverage(); const lg = cov.sources.find(s => s.key === 'ledger'); assert.equal(lg.class, 'estimated'); assert.match(lg.detail.join('|'), /Resumen al/);
      for (const m of months) assert.ok(h.psql(`select public.refresh_economic_ledger_monthly('${TENANT_A}','${m}')`).ok);
      assert.ok(h.psql(`select public.refresh_economic_ledger_counts('${TENANT_A}')`).ok);
      const fresh = await cfoRepo().ledgerMonthly(); assert.equal(fresh.summary.freshness, 'fresh');
      // el mes viejo ya no cuenta esa entidad; paridad otra vez en ambos sentidos
      const d = h.psql(`select count(*) from ((with latest as (select distinct on (entity_id) * from public.economic_ledger_entries where tenant_id='${TENANT_A}' and kind in('order','refund') order by entity_id,revision desc) select to_char(effective_at at time zone 'UTC','YYYY-MM-01')::date,source_id,kind,status,currency,exponent::smallint,basis,count(*),count(amount_minor),coalesce(sum(amount_minor),0) from latest where effective_at>=timestamptz '${win.start.toISOString()}' and effective_at<timestamptz '${win.end.toISOString()}' group by 1,2,3,4,5,6,7) except (select month,source_id,kind,status,currency,exponent,basis,n,known,amount_minor from public.economic_ledger_monthly where tenant_id='${TENANT_A}')) x`);
      assert.equal(d.out, '0'); assert.ok(oldMonth);
    });
    await t.test('obsolescencia de conversaciones y asociaciones', async () => {
      const prov = () => createProvenanceRepository({database: db(TENANT_A, OWNER.A)}).coverage();
      psqlFile(h.sock, `set session_replication_role=replica;insert into public.conversations(id,tenant_id,source,external_id,connection_id) values(gen_random_uuid(),'${TENANT_A}','csv','nueva','${C}');`);
      const tr = await createTrendsRepository({database: db(TENANT_A, OWNER.A), now: () => NOW}).monthly(); assert.equal(tr.conversations.summary.freshness, 'stale'); assert.equal(tr.conversations.class, 'estimated');
      psqlFile(h.sock, `set session_replication_role=replica;update public.native_customer_associations set updated_at=clock_timestamp() where id=md5('f5')::uuid;`);
      const cv = await prov(); const as = cv.sources.find(s => s.key === 'associations');
      // sin la migración de políticas el directo exacto no cabe: se queda el resumen, rotulado, nunca «Observado»
      assert.ok(as.class === 'estimated' || as.total === FACTS); if (as.class === 'estimated') assert.match(as.detail.join('|'), /Resumen al|muestra/);
    });

    // ---- 6. Ventana parcial ----
    await t.test('faltan meses refrescados: no se mezclan con ceros; camino anterior y se informa', async () => {
      h.psql(`delete from public.summary_refresh_state where summary='ledger_monthly' and scope_month='${months[3]}'`);
      const s = await db(TENANT_A, OWNER.A).transaction('read', s => readLedgerMonthly(s, win)); assert.equal(s.availability, 'partial'); assert.deepEqual(s.missingMonths, [months[3].slice(0, 7)]); assert.equal(s.rows.length, 0);
      const cfo = await createCfoRepository({database: db(TENANT_A, OWNER.A), now: () => NOW, timeoutMs: 60000}).ledgerMonthly();
      assert.equal(cfo.summary.source, 'direct'); assert.equal(cfo.summary.freshness, 'partial'); assert.deepEqual(cfo.summary.missingMonths ?? [months[3].slice(0, 7)], [months[3].slice(0, 7)]); assert.ok(cfo.rows.length > 50);
      assert.ok(h.psql(`select public.refresh_economic_ledger_monthly('${TENANT_A}','${months[3]}')`).ok);
    });

    // ---- 7. Reversa ----
    await t.test('reversa: la migración se revierte y las lecturas vuelven al camino anterior; se reaplica sin error', async () => {
      const d = h.file(DOWN); assert.equal(d.status, 0, String(d.stderr));
      assert.equal(h.psql("select to_regclass('public.economic_ledger_monthly') is null").out, 't');
      const cfo = await createCfoRepository({database: db(TENANT_A, OWNER.A), now: () => NOW, timeoutMs: 60000}).ledgerMonthly(); assert.equal(cfo.summary.source, 'direct'); assert.equal(cfo.status, 'ok');
      assert.equal(h.file(MIG).status, 0);
    });
  }, {name: 'agr', shared: '256MB'});
});
