// Integración con Postgres LOCAL desechable (migraciones REALES 0001..0055, RLS FORCE como rol vexa_backend) y 85,361 asientos SINTÉTICOS.
// Valida: (1) la consulta acotada del repositorio devuelve EXACTAMENTE las filas del fixture; (2) tiempo bajo statement_timeout con RLS por fila;
// (3) aislamiento entre organizaciones; (4) rama «timeout» sin 503; (5) exposición solo con vínculos atestados.
//   nice node --test packages/cfo-copilot/tests/pg-integration.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {withPg, pgAvailable} from '../../metrics/tests/pg-harness.mjs';
import {TENANT_A, TENANT_B, OWNER, ANALYST_A, SECOND_OWNER_A, sembrarUsuarios} from '../../ai-scale/economia-problemas/mundo.mjs';
import {crearBaseDatos} from '../../ai-scale/economia-problemas/snapshot.mjs';
import {createCfoRepository} from '../src/cfo-repository.mjs';
import {buildCfoReport} from '../src/cfo-model.mjs';
import {ledgerMonthlyFixture, FIXTURE_WATERMARK} from '../src/fixtures.mjs';

const SOURCES = { // clave de fixture -> nombre de la fuente (como en marketplace-map / shopify-map)
  'amazon|order': 'Marketplace Amazon · Pedidos (export recibido 2026-10-05)', 'amazon|refund': 'Marketplace Amazon · Devoluciones (export recibido 2026-10-05)',
  'walmart|order': 'Marketplace Walmart · Pedidos (export recibido 2026-10-05)', 'walmart|refund': 'Marketplace Walmart · Devoluciones (export recibido 2026-10-05)',
  'mirakl_bestbuy_us|order': 'Marketplace Best Buy US (Mirakl) · Pedidos (export recibido 2026-10-05)', 'mirakl_bestbuy_us|refund': 'Marketplace Best Buy US (Mirakl) · Devoluciones (export recibido 2026-10-05)',
  'mirakl_bestbuy_ca|order': 'Marketplace Best Buy CA (Mirakl) · Pedidos (export recibido 2026-10-05)', 'shopify|order': 'Shopify · Pedidos',
};
const uuidOf = i => `5e000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
const key = r => [r.month, r.channel, r.kind, r.status, r.currency, r.basis].join('|');

test('CFO sobre Postgres real: filas exactas, tiempo con RLS, aislamiento, timeout y exposición', {skip: !pgAvailable() && 'sin postgres local', timeout: 900000}, async () => {
  await withPg(async h => {
    const {psql, sock} = h;
    const must = sql => { const r = psql(sql); if (!r.ok) throw new Error(r.err.slice(0, 400) + ' :: ' + sql.slice(0, 100)); return r; };
    must(`insert into public.organizations(id,name) values('${TENANT_A}','SYN A'),('${TENANT_B}','SYN B') on conflict do nothing`);
    sembrarUsuarios(h);
    // fuentes (una por clave) -- sin disparadores: es siembra de prueba como superusuario
    must('alter table public.economic_source_versions disable trigger user');
    must('alter table public.economic_ledger_entries disable trigger user');
    const keys = Object.keys(SOURCES), report = 'SYN fuente: registro sintético de prueba sin datos de clientes.', hash = 'a'.repeat(64);
    keys.forEach((k, i) => must(`insert into public.economic_source_versions(tenant_id,source_id,version,actor_id,name,evidence_type,active,complete,window_start,window_end,watermark,report,report_hash,attested)
      values('${TENANT_A}','${uuidOf(i + 1)}',1,'${OWNER.A}','${SOURCES[k].replace(/'/g, "''")}','${k.endsWith('refund') ? 'payment_ledger' : 'order_export'}',true,false,'2025-11-01','2026-10-06','2026-10-05T00:00:00Z','${report}','${hash}',true)`));
    const fixture = ledgerMonthlyFixture();
    const values = fixture.map((r, i) => `('${r.month}-01'::timestamptz,'${uuidOf(keys.indexOf(r.channel + '|' + r.kind) + 1)}','${r.kind}','${r.status}','${r.currency}',${r.exponent},'${r.basis}',${r.n},${r.known},${r.amountMinor},${i})`).join(',');
    const t0 = Date.now();
    must(`with agg(m,src,kind,status,cur,exp,basis,n,known,amt,idx) as (values ${values})
      insert into public.economic_ledger_entries(tenant_id,entity_id,source_id,source_version,revision,actor_id,external_id,kind,effective_at,currency,exponent,basis,amount_minor,status,report,report_hash,attested,details)
      select '${TENANT_A}',gen_random_uuid(),src::uuid,1,1,'${OWNER.A}','ext-'||idx||'-'||g,kind,
        m + ((g % (case when to_char(m,'YYYY-MM')='2026-10' then 5 else 27 end)) * interval '1 day') + interval '3 hours',cur,exp::smallint,basis,
        case when g<=known then (case when g=known then amt-(known-1)*(amt/known) else amt/known end) end,status,'${report}','${hash}',true,'{}'::jsonb
      from agg, generate_series(1,n) g`);
    const rowsInserted = Number(must(`select count(*) from public.economic_ledger_entries where tenant_id='${TENANT_A}'`).out);
    assert.equal(rowsInserted, 85361);
    console.log(`  siembra de 85,361 asientos: ${Date.now() - t0} ms`);
    must('analyze public.economic_ledger_entries');

    const pool = new pg.Pool({host: sock, user: 'postgres', database: 't', max: 4});
    try {
      const db = (user, tenant, ms = 10000) => crearBaseDatos({pool, tenantId: tenant, userId: user, statementTimeoutMs: ms});
      const now = () => new Date('2026-10-20T14:00:00Z');
      // 1) filas exactas, medido con RLS por fila y statement_timeout de 10 s
      const repo = createCfoRepository({database: db(OWNER.A, TENANT_A), now});
      const started = Date.now();
      const out = await repo.ledgerMonthly();
      const elapsed = Date.now() - started;
      console.log(`  ledgerMonthly (RLS, 85,361 asientos): ${elapsed} ms, ${out.rows.length} filas agregadas, estado ${out.status}`);
      assert.equal(out.status, 'ok'); assert.equal(out.complete, true);
      assert.equal(out.watermark, FIXTURE_WATERMARK);
      assert.deepEqual(out.rows.map(r => ({...r})).sort((a, b) => key(a).localeCompare(key(b))), fixture.map(r => ({...r})).sort((a, b) => key(a).localeCompare(key(b))));
      assert.ok(elapsed < 9000, 'debe caber con holgura en el statement_timeout de 10 s: ' + elapsed);
      // el informe calculado desde la base real == el calculado desde el fixture
      const fromDb = buildCfoReport(out.rows, {watermark: out.watermark, now: now()}), fromFx = buildCfoReport(fixture, {watermark: FIXTURE_WATERMARK, now: now()});
      assert.equal(JSON.stringify(fromDb, (k, v) => typeof v === 'bigint' ? v.toString() : v), JSON.stringify(fromFx, (k, v) => typeof v === 'bigint' ? v.toString() : v));
      // el analista también lee; el plan no depende del rol
      assert.equal((await createCfoRepository({database: db(ANALYST_A, TENANT_A), now}).ledgerMonthly()).status, 'ok');
      // 3) aislamiento: el owner de la otra organización no ve nada de A, y no puede abrir A
      assert.equal((await createCfoRepository({database: db(OWNER.B, TENANT_B), now}).ledgerMonthly()).status, 'empty');
      await assert.rejects(() => createCfoRepository({database: db(OWNER.B, TENANT_A), now}).ledgerMonthly(), /organization_not_authorized/);
      // 4) timeout: se informa «timeout», no se lanza ni se devuelve 0
      const slow = await createCfoRepository({database: db(OWNER.A, TENANT_A, 10000), now, timeoutMs: 1}).ledgerMonthly();
      assert.equal(slow.status, 'timeout'); assert.deepEqual(slow.rows, []);
      // 5) exposición: sin vínculos -> vacío; con vínculos atestados activos -> importes por problema
      assert.equal((await createCfoRepository({database: db(OWNER.A, TENANT_A), now}).exposure()).status, 'empty');
      must(`insert into public.problems(tenant_id,severity,cause_status,title) values('${TENANT_A}','high','unknown','SYN Problema uno'),('${TENANT_A}','low','unknown','SYN Problema dos')`);
      must('alter table public.economic_problem_links disable trigger user');
      must(`insert into public.economic_problem_links(tenant_id,version,actor_id,report,attested,problem_id,entity_id,ledger_row_id,active)
        select '${TENANT_A}',1,'${OWNER.A}','${report}',true,p.id,l.entity_id,l.id,true
        from (select id,row_number() over (order by title) rn from public.problems where tenant_id='${TENANT_A}') p
        join (select id,entity_id,row_number() over (order by external_id) rn from public.economic_ledger_entries where tenant_id='${TENANT_A}' and kind='order' and currency='USD' and amount_minor is not null limit 40) l on (l.rn % 2)+1=p.rn`);
      const exp = await createCfoRepository({database: db(OWNER.A, TENANT_A), now}).exposure();
      assert.equal(exp.status, 'ok'); assert.equal(exp.attestedLinks, 40);
      assert.deepEqual(exp.rows.map(r => r.title).sort(), ['SYN Problema dos', 'SYN Problema uno']);
      const manual = BigInt(must(`select sum(l.amount_minor) from public.economic_problem_links k join public.economic_ledger_entries l on l.entity_id=k.entity_id where k.tenant_id='${TENANT_A}'`).out);
      assert.equal(exp.rows.reduce((a, r) => a + BigInt(r.exposedMinor), 0n), manual);
      const model = buildCfoReport(out.rows, {watermark: out.watermark, exposure: exp, now: now()});
      assert.equal(model.exposure.state, 'ok'); assert.equal(model.exposure.additive, false);
      // plan de ejecución (para NOTAS): una sola pasada con índice (tenant_id, entity_id, revision)
      const plan = must(`explain (analyze, costs off, timing off, summary on) select count(*) from (select distinct on (entity_id) entity_id from public.economic_ledger_entries where tenant_id='${TENANT_A}' and kind in ('order','refund') order by entity_id, revision desc) x`).out;
      console.log('  plan (superusuario, sin RLS):\n    ' + plan.split('\n').slice(0, 8).join('\n    '));
    } finally { await pool.end(); }
  }, {name: 'cfo', shared: '256MB'});
});

test('bitácora cfo_access_log (propuesta): insert-only, por organización, owner/analyst', {skip: !pgAvailable() && 'sin postgres local', timeout: 600000}, async () => {
  const fs = await import('node:fs'), path = await import('node:path'), {fileURLToPath} = await import('node:url'), {spawnSync} = await import('node:child_process');
  const sql = path.join(path.dirname(fileURLToPath(import.meta.url)), '../sql/cfo_access_log.proposal.sql');
  assert.ok(fs.existsSync(sql));
  await withPg(async h => {
    const {psql, sock} = h;
    const must = q => { const r = psql(q); if (!r.ok) throw new Error(r.err.slice(0, 400) + ' :: ' + q.slice(0, 100)); return r; };
    must(`insert into public.organizations(id,name) values('${TENANT_A}','SYN A'),('${TENANT_B}','SYN B') on conflict do nothing`);
    sembrarUsuarios(h);
    assert.equal(spawnSync('psql', ['-h', sock, '-U', 'postgres', '-d', 't', '-q', '-v', 'ON_ERROR_STOP=1', '-f', sql], {encoding: 'utf8'}).status, 0);
    const pool = new pg.Pool({host: sock, user: 'postgres', database: 't', max: 4});
    try {
      const db = (user, tenant, action) => crearBaseDatos({pool, tenantId: tenant, userId: user, statementTimeoutMs: 5000}).transaction(action, async s => ({s}));
      const insert = (user, tenant, action = 'propose', actor = user, tenantRow = tenant) => crearBaseDatos({pool, tenantId: tenant, userId: user, statementTimeoutMs: 5000}).transaction(action, s => s.query("INSERT INTO public.cfo_access_log(tenant_id,actor_id,tool,args_hash,outcome) VALUES($1,$2,'resumen_mes',$3,'allowed')", [tenantRow, actor, 'b'.repeat(64)]));
      await insert(OWNER.A, TENANT_A); await insert(ANALYST_A, TENANT_A);
      await assert.rejects(() => insert(SECOND_OWNER_A, TENANT_A), /role_insufficient|database_permission_denied|permission|row-level/i, 'un lector (viewer) no registra');
      must(`insert into auth.users(id) values('00000000-0000-4000-8000-000000009200') on conflict do nothing`);
      must(`insert into public.memberships(tenant_id,user_id,role,status,permissions_version) values('${TENANT_A}','00000000-0000-4000-8000-000000009200','operator','active',1)`);
      await assert.rejects(() => insert('00000000-0000-4000-8000-000000009200', TENANT_A), /row-level|permission|database_/i, 'un operador puede «proponer» pero la política exige owner o analyst');
      await assert.rejects(() => insert(OWNER.A, TENANT_A, 'propose', ANALYST_A), /row-level|permission|database_/i, 'no se registra a nombre de otro');
      await assert.rejects(() => insert(OWNER.A, TENANT_A, 'propose', OWNER.A, TENANT_B), /row-level|permission|database_/i, 'no se registra en otra organización');
      const owner = await crearBaseDatos({pool, tenantId: TENANT_A, userId: OWNER.A, statementTimeoutMs: 5000}).transaction('read', s => s.query('SELECT count(*)::int n FROM public.cfo_access_log'));
      assert.equal(owner.rows[0].n, 2);
      const analyst = await crearBaseDatos({pool, tenantId: TENANT_A, userId: ANALYST_A, statementTimeoutMs: 5000}).transaction('read', s => s.query('SELECT count(*)::int n FROM public.cfo_access_log'));
      assert.equal(analyst.rows[0].n, 0, 'solo el owner lee la bitácora');
      const other = await crearBaseDatos({pool, tenantId: TENANT_B, userId: OWNER.B, statementTimeoutMs: 5000}).transaction('read', s => s.query('SELECT count(*)::int n FROM public.cfo_access_log'));
      assert.equal(other.rows[0].n, 0);
      assert.equal(psql('delete from public.cfo_access_log').ok, false, 'append-only incluso para superusuario');
      assert.ok(db);
    } finally { await pool.end(); }
  }, {name: 'cfoaudit', shared: '64MB'});
});
