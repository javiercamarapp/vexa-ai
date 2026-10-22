// /api/workspace?resource=metrics (Resumen) con el libro a escala real (85 mil asientos): sin publicación responde «sin publicación» al instante; con publicación lee solo el snapshot vigente
// y las «señales críticas» (que recorren todos los problemas con consultas secuenciales) tienen presupuesto de tiempo: si no alcanzan, la vista responde igual y lo dice.
//   node --test packages/workspace-service/tests/resumen-sin-bloqueo.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {withPg, pgAvailable} from '../../metrics/tests/pg-harness.mjs';
import {construirMundo, medida, TENANT_A, OWNER, psqlFile} from '../../metrics/tests/world.mjs';
import {createSnapshotRepository} from '../../metrics/snapshots.mjs';
import {createWorkspaceService, criticalSignals} from '../index.mjs';

const SKIP = !pgAvailable() && 'sin postgres local';
const BULK = 85000;

test('Resumen: sin publicación <2 s con 85k asientos; con publicación no recorre el libro; señales críticas con presupuesto', {skip: SKIP, timeout: 1500000}, async t => {
  await withPg(async h => {
    const ctx = await construirMundo(h, {complete: false});
    const bulk = psqlFile(ctx.sock, `set session_replication_role=replica;set statement_timeout=0;alter table public.economic_ledger_entries disable trigger user;
      insert into public.economic_ledger_entries(tenant_id,entity_id,source_id,source_version,revision,actor_id,recorded_at,external_id,kind,effective_at,currency,exponent,basis,amount_minor,status,details,report,report_hash,attested)
      select t.tenant_id,md5('BULK'||i)::uuid,t.source_id,t.source_version,1,t.actor_id,t.recorded_at,'SYN-BULK-'||i,'order',timestamptz '2026-03-12 12:00:00+00','USD',2,'marketplace_line_price',100+(i%900),'recorded','{}'::jsonb,t.report,t.report_hash,true
      from (select * from public.economic_ledger_entries where kind='order' and currency='USD' and basis='marketplace_line_price' order by recorded_at limit 1) t, generate_series(1,${BULK}) i;
      alter table public.economic_ledger_entries enable trigger user;analyze public.economic_ledger_entries;`);
    assert.equal(bulk.status, 0, String(bulk.stderr).slice(0, 300));
    const rows = Number(ctx.psql('select count(*) from public.economic_ledger_entries').out); assert.ok(rows > BULK, 'filas ' + rows);
    const time = async f => { const t0 = performance.now(); const v = await f(); return {v, ms: performance.now() - t0}; };

    await t.test('SIN publicación: «Sin snapshot publicado», estado empty, <2 s, ninguna lectura del libro', async () => {
      const m = medida(ctx.db(OWNER.A, TENANT_A, 10000)), ws = createWorkspaceService({database: m.db});
      for (const q of [new URLSearchParams({resource: 'metrics'}), ctx.query(ctx.A1, {resource: 'metrics'})]) {
        m.reset(); const {v, ms} = await time(() => ws.query(q));
        assert.equal(v.meta.state, 'empty'); assert.equal(v.meta.snapshot_id, null); assert.match(v.meta.coverage, /Sin snapshot publicado/); assert.deepEqual(v.items, []);
        assert.ok(ms < 2000, 'sin publicación ' + ms + ' ms');
        assert.ok(!m.log.some(x => /economic_ledger_entries/.test(x.text ?? x.sql ?? x.q ?? '')), 'no debe tocar el libro');
      }
    });

    let snap;
    await t.test('preparar y publicar con el libro completo', async () => {
      const owner = () => createSnapshotRepository({database: ctx.db(OWNER.A, TENANT_A, 20000)});
      snap = await owner().stage({scope: ctx.A1}); snap = await owner().publish({snapshotId: snap.id, expectedContentHash: snap.contentHash});
      assert.equal(snap.status, 'published');
    });

    await t.test('CON publicación: Resumen <2 s, mismo corte, ninguna sentencia recorre el libro vivo (solo ids del snapshot)', async () => {
      const m = medida(ctx.db(OWNER.A, TENANT_A, 10000)), ws = createWorkspaceService({database: m.db});
      await ws.query(new URLSearchParams({resource: 'metrics'})); m.reset();
      const {v, ms} = await time(() => ws.query(new URLSearchParams({resource: 'metrics'})));
      assert.equal(v.meta.snapshot_id, snap.id); assert.ok(v.items.length === 1); assert.equal(v.meta.critical_notice_state, 'ok');
      const texts = m.log.map(x => x.text ?? x.sql ?? x.q ?? JSON.stringify(x));
      const wide = texts.filter(q => /FROM public\.economic_ledger_entries/i.test(q) && !/id\s*=\s*ANY|e\.id|unnest\(m\.refs_ledger/i.test(q));
      console.log(`# Resumen con publicación: ${ms.toFixed(0)} ms, ${m.count()} sentencias, máx ${m.max().toFixed(0)} ms; lecturas amplias del libro: ${wide.length}`);
      for (const q of wide) console.log('#   amplia: ' + q.replace(/\s+/g, ' ').slice(0, 200));
      assert.ok(ms < 2000, 'con publicación ' + ms + ' ms');
    });

    await t.test('presupuesto de «señales críticas»: si no alcanzan, responde sin ellas y lo dice; con presupuesto suficiente, igual que antes', async () => {
      const slowDb = (delay) => { const base = ctx.db(OWNER.A, TENANT_A, 10000); return {transaction: (a, w) => base.transaction(a, s => w(Object.freeze({...s, query: async (q, v) => { if (/priority_|problem_embedding_members m JOIN|SELECT DISTINCT i\.id/.test(q)) await new Promise(r => setTimeout(r, delay)); return s.query(q, v); }})))}; };
      // 1) presupuesto 0: nunca lanza, devuelve «unavailable» y NO cero señales
      const r0 = await slowDb(0).transaction('read', s => criticalSignals(s, snap.id, -1)); assert.deepEqual(r0, {status: 'unavailable', count: null});
      // 2) la vista completa con consultas lentas (como ~400 problemas con latencia de red): vuelve en ~presupuesto y las cifras del snapshot salen intactas
      const wsSlow = createWorkspaceService({database: slowDb(300)});
      const {v, ms} = await time(() => wsSlow.query(new URLSearchParams({resource: 'metrics'})));
      console.log(`# Resumen con consultas de problemas a 300 ms cada una: ${ms.toFixed(0)} ms, critical_notice_state=${v.meta.critical_notice_state}`);
      assert.equal(v.meta.critical_notice_state, 'unavailable'); assert.equal(v.meta.critical_notice, null); assert.equal(v.items[0].metrics.length, 3); assert.ok(ms < 5000, 'acotado por el presupuesto: ' + ms + ' ms');
      // 3) sin lentitud: ok
      const rOk = await slowDb(0).transaction('read', s => criticalSignals(s, snap.id)); assert.equal(rOk.status, 'ok'); assert.equal(typeof rOk.count, 'number');
    });
    await t.test('una SOLA sentencia lenta no rompe la vista: statement_timeout acotado por el presupuesto, «unavailable», la transacción sigue utilizable (22-oct: 503 en /problems)', async () => {
      // La verificación de evidencia de todos los problemas es UNA consulta por lotes (≈13 s en producción): el chequeo entre consultas no la acota.
      const sleepDb = (secs) => { const base = ctx.db(OWNER.A, TENANT_A, 20000); return {transaction: (a, w) => base.transaction(a, s => w(Object.freeze({...s, query: async (q, v) => { if (/SELECT DISTINCT ON\(problem_id\) \* FROM public\.problem_versions/.test(q)) await s.query('SELECT pg_sleep($1)', [secs]); return s.query(q, v); }})))}; };
      const t0 = performance.now();
      const r = await sleepDb(6).transaction('read', async s => { const out = await criticalSignals(s, snap.id, 400); const after = await s.query('SELECT current_setting($1) AS v', ['statement_timeout']); return {out, after: after.rows[0].v}; });
      const ms = performance.now() - t0;
      assert.deepEqual(r.out, {status: 'unavailable', count: null}); assert.ok(ms < 4000, 'acotado: ' + ms + ' ms'); assert.equal(r.after, '20s', 'el statement_timeout original se restablece');
      // y la vista de problemas completa responde (no 503) con las cifras del catálogo intactas
      const ws = createWorkspaceService({database: sleepDb(6)});
      const {v} = await time(() => ws.query(new URLSearchParams({resource: 'metrics'})));
      assert.equal(v.items.length, 1); assert.equal(v.meta.critical_notice_state, 'unavailable'); assert.equal(v.meta.critical_notice, null);
    });
    await ctx.pool.end();
  }, {name: 'resu', upto: 55, shared: '256MB'});
});
