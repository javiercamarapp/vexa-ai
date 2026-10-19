// Escala de las vistas económicas — seguridad, fail-closed y equivalencia de cifras. Postgres local con las migraciones REALES 0001..0055; datos sintéticos.
//   node --test packages/metrics/tests/escala-seguridad.test.mjs
// Cubre: aislamiento de tenant, contribuyente inactivo (en UNA fila cualquiera del alcance), fuente retirada, fila retirada, manifiesto alterado, tampering del resumen,
// misma cifra en tarjeta/lista/detalle, libro lean == libro completo, y que el número de sentencias NO crece con el tamaño del libro.
import test from 'node:test';
import assert from 'node:assert/strict';
import {withPg, pgAvailable} from './pg-harness.mjs';
import {construirMundo, llenarLibro, medida, pedidoDeOtroOwner, comoUsuario, TENANT_A, TENANT_B, OWNER, ANALYST_A, OWNER2, OWNER3, OUTSIDER, psqlFile} from './world.mjs';
import {createSnapshotRepository} from '../snapshots.mjs';
import {createEconomicRepository} from '../repository.mjs';
import {readExposure} from '../exposure.mjs';
import {createWorkspaceService} from '../../workspace-service/index.mjs';
import {createDetailService} from '../../workspace-service/detail.mjs';

const fail = (code, status) => e => e.code === code && e.status === status;
const cm = (snap, key) => snap.components.find(c => c.metric === key && c.currency === 'USD' && !c.conversion);

async function mundoCompleto(t, complete) {
  await withPg(async h => {
    const ctx = await construirMundo(h, {complete});
    const {A1, A2, A3, ids, pool} = ctx;
    // toda mutación de preparación debe tener éxito (si no, la prueba afirmaría sobre un estado que no existe)
    const psql = sql => { const r = ctx.psql(sql); if (!r.ok) throw new Error('SQL falló: ' + r.err.slice(0, 300) + ' :: ' + sql.slice(0, 100)); return r; };
    const owner = () => createSnapshotRepository({database: ctx.db(OWNER.A, TENANT_A, 10000)});

    await t.test('flujo: preparar y publicar con el límite real de 10 s; las cifras salen del libro (alcance de pedidos, Shopify, devoluciones)', async () => {
      h.mp = await owner().stage({scope: A1}); h.sh = await owner().stage({scope: A2});
      assert.equal(h.mp.status, 'draft');
      assert.equal(cm(h.mp, 'exposure.global').knownSubtotalMinor, '40000'); assert.equal(cm(h.mp, 'allOrders').knownSubtotalMinor, '47000');
      assert.equal(cm(h.sh, 'refunds').knownSubtotalMinor, '5000');
      if (complete) assert.equal(cm(h.mp, 'exposure.global').amountMinor, '40000'); else assert.equal(cm(h.mp, 'exposure.global').amountMinor, null);
      assert.equal((await owner().stage({scope: A1})).id, h.mp.id, 'misma entrada => mismo snapshot (idempotente)');
      h.mp = await owner().publish({snapshotId: h.mp.id, expectedContentHash: h.mp.contentHash}); h.sh = await owner().publish({snapshotId: h.sh.id, expectedContentHash: h.sh.contentHash});
      assert.equal(h.mp.status, 'published');
    });

    await t.test('la identidad del snapshot no depende de la zona horaria de la conexión (rowHash determinista)', async () => {
      const m = medida(ctx.db(OWNER.A, TENANT_A, 10000), {tz: 'America/Mexico_City'});
      const again = await createSnapshotRepository({database: m.db}).stage({scope: A1});
      assert.equal(again.id, h.mp.id); assert.equal(again.contentHash, h.mp.contentHash); assert.equal(again.inputHash, h.mp.inputHash);
    });

    await t.test('el manifiesto almacenado se puede reverificar: una referencia por versión vigente de cada tabla de insumos, todas del tenant y existentes', () => {
      const expected = psql(`select (select count(distinct entity_id) from public.economic_ledger_entries)+(select count(distinct source_id) from public.economic_source_versions)+(select count(distinct (problem_id,entity_id)) from public.economic_problem_links)+(select count(distinct alias_entity_id) from public.economic_order_aliases)+(select count(distinct entity_id) from public.economic_order_customers)+(select count(distinct scope_key) from public.economic_relation_coverage)+(select count(distinct currency) from public.economic_currency_versions)+(select count(distinct rate_id) from public.economic_fx_versions)`).out;
      assert.equal(psql(`select count(*) from public.metric_snapshots m, jsonb_array_elements(m.input_manifest->'refs') r where m.id='${h.mp.id}'`).out, expected);
      assert.equal(psql(`select cardinality(refs_ledger_ids)=(select count(distinct entity_id) from public.economic_ledger_entries) from public.metric_snapshots where id='${h.mp.id}'`).out, 't');
      assert.equal(psql(`select count(*) from public.metric_snapshots m, jsonb_array_elements(m.input_manifest->'refs') r where m.id='${h.mp.id}' and r->>'table'='economic_ledger_entries' and not exists(select 1 from public.economic_ledger_entries l where l.id=(r->>'id')::uuid and l.tenant_id=m.tenant_id)`).out, '0');
    });

    await t.test('la MISMA cifra en tarjeta (Resumen), lista (Explorador) y detalle; sin y con snapshot fijado; con filtro de SKU', async () => {
      const ws = createWorkspaceService({database: ctx.db(OWNER.A, TENANT_A, 10000)}), detail = createDetailService({database: ctx.db(OWNER.A, TENANT_A, 10000)});
      const bare = await ws.query(new URLSearchParams({resource: 'metrics'}));       // Resumen «desnudo»: adopta la última publicación
      assert.equal(bare.meta.snapshot_id !== null, true);
      const card = await ws.query(ctx.query(A1, {resource: 'metrics', snapshot_id: h.mp.id}));
      const mt = Object.fromEntries(card.items[0].metrics.map(x => [x.kind, x]));
      assert.equal(mt.exposure.known_subtotal, cm(h.mp, 'exposure.global').knownSubtotalMinor); assert.equal(mt.allOrders.known_subtotal, '47000');
      const list = await ws.query(ctx.query(A1, {resource: 'problems', snapshot_id: h.mp.id}), {all: true});
      const envio = list.items.find(i => i.title === 'Envío: No recibido'), pago = list.items.find(i => i.title === 'Pago: Cobro duplicado');
      assert.equal(envio.metrics[0].known_subtotal, '35000'); assert.equal(pago.metrics[0].known_subtotal, '5000');
      const d = await detail.get({kind: 'problem', id: envio.id, query: ctx.query(A1, {snapshot_id: h.mp.id, scope_hash: card.meta.scope_hash})});
      assert.equal(d.components.find(c => c.metric === 'exposure').money.known_subtotal, envio.metrics[0].known_subtotal);
      // con filtro (camino con proyección completa): O1 es el único pedido con SKU-A sin declaraciones => pertenencia desconocida, subtotal confirmado = 0
      const filtered = await ws.query(ctx.query(A1, {resource: 'metrics', snapshot_id: h.mp.id, sku: 'SKU-A'}));
      assert.equal(filtered.meta.state, 'partial');
      assert.match(filtered.meta.coverage, /pertenencia al filtro desconocida/);
    });

    await t.test('aislamiento: otro tenant, un usuario sin membresía y un analista (que solo lee) no obtienen ni preparan nada ajeno', async () => {
      const wsB = createWorkspaceService({database: ctx.db(OWNER.B, TENANT_B, 10000)});
      const vacio = await wsB.query(ctx.query(A1, {resource: 'metrics'}));
      assert.equal(vacio.meta.snapshot_id, null); assert.equal(vacio.items.length, 0);
      await assert.rejects(createSnapshotRepository({database: ctx.db(OWNER.B, TENANT_B)}).get({snapshotId: h.mp.id}), fail('snapshot_not_found', 404));
      await assert.rejects(createSnapshotRepository({database: ctx.db(OUTSIDER, TENANT_A)}).get({snapshotId: h.mp.id}), /organization_not_authorized/);
      const an = createSnapshotRepository({database: ctx.db(ANALYST_A, TENANT_A)});
      assert.equal((await an.get({snapshotId: h.mp.id})).id, h.mp.id);
      await assert.rejects(an.stage({scope: A1}), /role_insufficient|snapshot_owner_required/);
      await assert.rejects(an.publish({snapshotId: h.mp.id, expectedContentHash: h.mp.contentHash}), /role_insufficient|snapshot_owner_required/);
    });

    await t.test('lean == completo: el libro «lean» del snapshot calcula EXACTAMENTE las mismas cifras monetarias y de exposición', async () => {
      const asOf = new Date().toISOString();
      for (const a of [A1, A2, A3]) {
        const run = lean => ctx.db(OWNER.A, TENANT_A, 20000).transaction('read', s => createEconomicRepository({database: {transaction: async (_x, fn) => fn(s)}, snapshotAsOf: asOf, lean}).list({scope: a}));
        const full = await run(false), lean = await run(true);
        assert.deepEqual(lean.monetary, full.monetary); assert.deepEqual(lean.exposure, full.exposure); assert.deepEqual(lean.bundle, full.bundle);
        assert.deepEqual(lean.entries.map(e => [e.id, e.revision, e.amountMinor]), full.entries.map(e => [e.id, e.revision, e.amountMinor])); assert.equal(lean.state, full.state);
        assert.ok(full.history.length >= full.entries.length); assert.equal(lean.history.length, 0);
      }
    });

    await t.test('el alcance NO acota qué filas importan: un contribuyente revocado en una fila FUERA del alcance (otra moneda y base) bloquea igual la cifra del alcance — por eso el manifiesto conserva todos los asientos', async () => {
      const liveBefore = await ctx.db(OWNER.A, TENANT_A, 20000).transaction('read', s => readExposure(s, {scope: A1}));
      pedidoDeOtroOwner(ctx, {externalId: 'amazon|SYN-EUR-0000001|SKU-X', amount: '777', actor: OWNER3, currency: 'EUR', basis: 'otra_base_fuera_del_alcance'});
      const withEur = await ctx.db(OWNER.A, TENANT_A, 20000).transaction('read', s => readExposure(s, {scope: A1}));
      assert.equal(withEur.canonicalAllOrders.knownSubtotalMinor, liveBefore.canonicalAllOrders.knownSubtotalMinor, 'la fila ajena al alcance no entra en la cifra');
      assert.ok(!withEur.canonicalAllOrders.missingReasons.includes('order_evidence_unavailable'));
      const snap = await owner().stage({scope: A1});
      assert.equal(psql(`select count(*) from public.metric_snapshots m, jsonb_array_elements(m.input_manifest->'refs') r where m.id='${snap.id}' and r->>'actorId'='${OWNER3}' and r->>'authorized'='true'`).out, '1', 'el manifiesto referencia la fila fuera del alcance');
      psql(`update public.memberships set status='revoked' where tenant_id='${TENANT_A}' and user_id='${OWNER3}'`);
      const gated = await ctx.db(OWNER.A, TENANT_A, 20000).transaction('read', s => readExposure(s, {scope: A1}));
      assert.ok(gated.canonicalAllOrders.missingReasons.includes('order_evidence_unavailable'), 'una fila no utilizable fuera del alcance bloquea el importe exacto del alcance');
      assert.equal(gated.canonicalAllOrders.amountMinor, null);
      await assert.rejects(owner().get({snapshotId: snap.id}), fail('snapshot_not_found', 404));
    });

    await t.test('contribuyente inactivo en UNA fila cualquiera: la lectura viva lo excluye y marca la evidencia; el snapshot que lo capturó como autorizado deja de leerse (fail-closed) en todas las vistas', async () => {
      const e5 = pedidoDeOtroOwner(ctx);
      const live = await ctx.db(OWNER.A, TENANT_A, 20000).transaction('read', s => readExposure(s, {scope: A1}));
      assert.equal(live.canonicalAllOrders.knownSubtotalMinor, '50333');                         // 47000 + 3333, contribuyente activo
      h.withO5 = await owner().stage({scope: A1}); h.withO5 = await owner().publish({snapshotId: h.withO5.id, expectedContentHash: h.withO5.contentHash});
      assert.equal(cm(h.withO5, 'allOrders').knownSubtotalMinor, '50333');
      assert.equal(psql(`select count(*) from public.metric_snapshots m, jsonb_array_elements(m.input_manifest->'refs') r where m.id='${h.withO5.id}' and r->>'actorId'='${OWNER2}' and r->>'authorized'='true'`).out, '1');
      psql(`update public.memberships set status='revoked' where tenant_id='${TENANT_A}' and user_id='${OWNER2}'`);
      // vivo: su fila deja de contar y la tarjeta global advierte evidencia no disponible
      const after = await ctx.db(OWNER.A, TENANT_A, 20000).transaction('read', s => readExposure(s, {scope: A1}));
      assert.equal(after.canonicalAllOrders.knownSubtotalMinor, '47000'); assert.ok(after.canonicalAllOrders.missingReasons.includes('order_evidence_unavailable')); assert.equal(after.canonicalAllOrders.amountMinor, null);
      // el snapshot que capturó esa fila como autorizada deja de ser VISIBLE para la aplicación (la política de la base lo oculta: 404 como antes), en get, Resumen, Explorador y la cabeza del alcance
      await assert.rejects(owner().get({snapshotId: h.withO5.id}), fail('snapshot_not_found', 404));
      const ws = createWorkspaceService({database: ctx.db(OWNER.A, TENANT_A, 10000)});
      await assert.rejects(ws.query(ctx.query(A1, {resource: 'metrics', snapshot_id: h.withO5.id})), fail('snapshot_not_found', 404));
      await assert.rejects(ws.query(ctx.query(A1, {resource: 'problems', snapshot_id: h.withO5.id}), {all: true}), fail('snapshot_not_found', 404));
      await assert.rejects(owner().latest({scope: A1}), fail('snapshot_not_found', 404));
      // el snapshot anterior, que no incluía esa fila, sigue legible: la revocación no apaga lo que no la usó
      assert.equal((await owner().get({snapshotId: h.mp.id})).id, h.mp.id);
      // las instantáneas nuevas ya excluyen su fila (autorizada=false) y vuelven a poder leerse
      const clean = await owner().stage({scope: A1});
      assert.equal(cm(clean, 'allOrders').knownSubtotalMinor, '47000');
      assert.equal(psql(`select count(*) from public.metric_snapshots m, jsonb_array_elements(m.input_manifest->'refs') r where m.id='${clean.id}' and r->>'actorId'='${OWNER2}' and r->>'authorized'='true'`).out, '0');
      assert.equal((await owner().get({snapshotId: clean.id})).id, clean.id);
    });

    await t.test('visibilidad en base: con el contribuyente revocado la política oculta esa snapshot al lector (y a la aplicación), no así a las que no lo usaron', () => {
      const count = id => comoUsuario(ctx, {user: OWNER.A, tenant: TENANT_A, sql: `select count(*) from public.metric_snapshots where id='${id}'`});
      assert.equal(count(h.withO5.id), '0'); assert.equal(count(h.mp.id), '1');
      assert.equal(comoUsuario(ctx, {user: OWNER.A, tenant: TENANT_A, sql: `select count(*) from public.components where snapshot_id='${h.withO5.id}'`}), '0');
      assert.notEqual(comoUsuario(ctx, {user: OWNER.A, tenant: TENANT_A, sql: `select count(*) from public.components where snapshot_id='${h.mp.id}'`}), '0');
    });

    await t.test('manifiesto alterado por un superusuario (disparadores deshabilitados): el CHECK del resumen rechaza alterar lo que el resumen cubre; lo demás lo detecta el digest (409); sin resumen (snapshots previos a 0055) la verificación por manifiesto detecta la tabla inventada (manifest_invalid, 409)', async () => {
      const mut = (sql) => { psql('alter table public.metric_snapshots disable trigger user'); try { return psql(sql); } finally { ctx.psql('alter table public.metric_snapshots enable trigger user'); } };
      const a = await owner().stage({scope: A3});
      assert.throws(() => mut(`update public.metric_snapshots set input_manifest=jsonb_set(input_manifest,'{refs,0,table}','"tabla_inventada"') where id='${a.id}'`), /economic_snapshot_summary_matches/);
      assert.equal((await owner().get({snapshotId: a.id})).id, a.id, 'el rechazo no dejó el snapshot a medias');
      // rowHash de una referencia del libro: no está en el resumen (solo los ids) => el CHECK lo permite y el digest lo detecta
      mut(`update public.metric_snapshots set input_manifest=jsonb_set(input_manifest,array['refs',(select (ord-1)::text from public.metric_snapshots m,jsonb_array_elements(m.input_manifest->'refs') with ordinality e(r,ord) where m.id='${a.id}' and r->>'table'='economic_ledger_entries' limit 1),'rowHash'],'"x"') where id='${a.id}'`);
      await assert.rejects(owner().get({snapshotId: a.id}), fail('snapshot_integrity_failed', 409));
      const b = await owner().stage({scope: {...A3, end: '2026-10-03T00:00:00.000Z'}});
      mut(`update public.metric_snapshots set refs_actor_ids=null,refs_source_ids=null,refs_currency_ids=null,refs_fx_ids=null,refs_ledger_ids=null,refs_ledger_live_ids=null,refs_small=null,input_manifest=jsonb_set(input_manifest,'{refs,0,table}','"tabla_inventada"') where id='${b.id}'`);
      await assert.rejects(owner().get({snapshotId: b.id}), fail('snapshot_manifest_invalid', 409));
      const c = await owner().stage({scope: {...A3, end: '2026-10-04T00:00:00.000Z'}});
      mut(`update public.metric_snapshots set input_manifest=jsonb_set(input_manifest,'{watermarks}','[]') where id='${c.id}'`);
      await assert.rejects(owner().get({snapshotId: c.id}), fail('snapshot_integrity_failed', 409));
    });

    await t.test('fila del libro referenciada que desaparece (solo con disparadores deshabilitados por un superusuario) => evidence_unavailable', async () => {
      const snap = await owner().stage({scope: {...A1, end: '2026-10-05T00:00:00.000Z'}});
      const victim = psql(`select id from public.economic_ledger_entries where entity_id='${ids.O4}' limit 1`).out;   // O4: sin vínculos (una FK de los vínculos impediría borrar O1/O2/O3a/S1)
      psql('alter table public.economic_ledger_entries disable trigger economic_entry_immutable'); psql(`delete from public.economic_ledger_entries where id='${victim}'`); psql('alter table public.economic_ledger_entries enable trigger economic_entry_immutable');
      await assert.rejects(owner().get({snapshotId: snap.id}), fail('snapshot_evidence_unavailable', 403));
    });
    await t.test('fuente retirada (última versión inactiva): los snapshots que la usaban dejan de leerse (404, ocultos por la política de la base) y no se puede preparar uno nuevo mientras exista un asiento de esa fuente (comportamiento previo)', async () => {
      const snap = await owner().stage({scope: A2}); await owner().publish({snapshotId: snap.id, expectedContentHash: snap.contentHash});
      assert.ok((await owner().get({snapshotId: snap.id})).id);
      const sid = ctx.f.shopifyP.sourceId;
      const r = psqlFile(ctx.sock, `select set_config('vexa.tenant_id','${TENANT_A}',false),set_config('vexa.action','configure',false),set_config('request.jwt.claim.sub','${OWNER.A}',false);
        insert into public.economic_source_versions(tenant_id,source_id,version,actor_id,name,evidence_type,active,complete,window_start,window_end,watermark,report,report_hash,attested) select tenant_id,source_id,version+1,'${OWNER.A}',name,evidence_type,false,complete,window_start,window_end,watermark,report,report_hash,true from public.economic_source_versions where tenant_id='${TENANT_A}' and source_id='${sid}' order by version desc limit 1;`);
      assert.equal(r.status, 0, r.stderr);
      await assert.rejects(owner().get({snapshotId: snap.id}), fail('snapshot_not_found', 404));
      const ws = createWorkspaceService({database: ctx.db(OWNER.A, TENANT_A, 10000)});
      await assert.rejects(ws.query(ctx.query(A2, {resource: 'metrics', snapshot_id: snap.id})), fail('snapshot_not_found', 404));
      await assert.rejects(owner().stage({scope: A3}), e => e.code === '23503', 'preparar con una fuente retirada falla cerrado en la base (snapshot unavailable), igual que antes');
    });

    await pool.end();
  }, {name: 'seg' + (complete ? 'c' : 'i'), upto: 55});
}
test('seguridad y equivalencia (fuentes INCOMPLETAS, como en producción)', { skip: !pgAvailable() && 'sin postgres local', timeout: 900000 }, async t => mundoCompleto(t, false));
test('seguridad y equivalencia (fuentes COMPLETAS y cobertura atestada: importe exacto)', { skip: !pgAvailable() && 'sin postgres local', timeout: 900000 }, async t => mundoCompleto(t, true));

test('el número de sentencias de get/stage/Resumen NO crece con el tamaño del libro (sin trabajo por fila en la aplicación)', { skip: !pgAvailable() && 'sin postgres local', timeout: 900000 }, async t => {
  await withPg(async h => {
    const ctx = await construirMundo(h, {complete: false});
    const stats = async () => {
      const m = medida(ctx.db(OWNER.A, TENANT_A, 10000)), repo = createSnapshotRepository({database: m.db});
      const t0 = performance.now(); const snap = await repo.stage({scope: ctx.A1}); const stageMs = performance.now() - t0, stageN = m.count(); m.reset();
      await repo.publish({snapshotId: snap.id, expectedContentHash: snap.contentHash}); const publishN = m.count(); m.reset();
      const t1 = performance.now(); await repo.get({snapshotId: snap.id}); const getMs = performance.now() - t1, getN = m.count(); m.reset();
      const ws = createWorkspaceService({database: m.db}); await ws.query(ctx.query(ctx.A1, {resource: 'metrics', snapshot_id: snap.id})); const resumenN = m.count(), maxMs = m.max();
      return {stageN, publishN, getN, resumenN, stageMs, getMs, maxMs, rows: +ctx.psql('select count(*) from public.economic_ledger_entries').out};
    };
    const small = await stats();
    llenarLibro(ctx, 3000);
    const big = await stats();
    t.diagnostic(JSON.stringify({small, big}));
    assert.ok(big.rows > small.rows + 2900);
    assert.ok(Math.abs(big.getN - small.getN) <= 2, `get: ${small.getN} -> ${big.getN} sentencias`);
    assert.ok(Math.abs(big.resumenN - small.resumenN) <= 4, `Resumen: ${small.resumenN} -> ${big.resumenN} sentencias`);
    assert.ok(Math.abs(big.stageN - small.stageN) <= 4, `stage: ${small.stageN} -> ${big.stageN} sentencias`);
    assert.ok(Math.abs(big.publishN - small.publishN) <= 2, `publish: ${small.publishN} -> ${big.publishN} sentencias`);
    assert.ok(big.maxMs < 8000, 'ninguna consulta de la app supera 8 s');
    await ctx.pool.end();
  }, {name: 'cnt', upto: 55});
});
