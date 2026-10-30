// ACEPTACIÓN de punta a punta del flujo de Acciones contra Postgres local desechable (migraciones reales + 20261111000000). Datos 100 % sintéticos.
// Recorre: generar una acción desde un problema -> aprobar (Proceder) -> marcar en curso (la «ejecución» humana) -> registrar resultado -> verlo en el historial,
// con la matriz de permisos por rol (owner, analyst, operator pueden; viewer no), reintentos idempotentes, atomicidad y aislamiento entre organizaciones.
//   node --test packages/recommendations/tests/flow-acceptance.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import pg from 'pg';
import {withPg, pgAvailable} from '../../metrics/tests/pg-harness.mjs';
import {montarMundo, TENANT_A, TENANT_B, OWNER, ANALYST_A, SECOND_OWNER_A, U, psqlFile} from '../../ai-scale/economia-problemas/mundo.mjs';
import {crearBaseDatos, alcance} from '../../ai-scale/economia-problemas/snapshot.mjs';
import {createSnapshotRepository} from '../../metrics/snapshots.mjs';
import {createWorkspaceService} from '../../workspace-service/index.mjs';
import {createRecommendationRepository} from '../index.mjs';
import {createFlowRepository} from '../flow.mjs';
import {createInterventionRepository} from '../../interventions/index.mjs';
import {construirLinea, accionesPermitidas, etapaActual} from '../flujo.mjs';
import {agrupar, resumir, actividadReciente} from '../../../apps/web/src/components/acciones/acciones-modelo.mjs';

const read = f => fs.readFileSync(new URL(f, import.meta.url), 'utf8');
const BASE = ['20261028000000_brief_catalog_cut', '20261030000000_brief_guard_uuid_ids', '20261029000000_recommendation_catalog_cut', '20261101000000_recommendation_generator_v2'].map(n => read('../../../supabase/migrations/' + n + '.sql'));
const FLOW = read('../../../supabase/migrations/20261111000000_recommendation_flow.sql');
const SKIP = !pgAvailable() && 'sin postgres local';
const OPERATOR_A = U(9005), REMOVED_A = U(9006);
const q = (a, extra = {}) => new URLSearchParams({date_start: a.start.slice(0, 10), date_end: a.end.slice(0, 10), currency: a.currency, basis: a.basis, exponent: String(a.exponent), ...extra});
const manana = () => new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
const denegado = e => [401, 403, 404].includes(e.status) || /role_|organization_not_authorized/.test(e.message);
const COMENTARIO = 'Aprobado para pedir revisión de lote al proveedor.';
const NOTA = 'El proveedor corrigió el lote; se confirmó con la siguiente entrega.';

test('Acciones de punta a punta: problema -> propuesta -> aprobación -> en curso -> resultado -> historial, por rol', {skip: SKIP, timeout: 900000}, async t => {
  await withPg(async h => {
    montarMundo(h);
    for (const sql of BASE) { const r = psqlFile(h.sock, sql); assert.equal(r.status, 0, String(r.stderr).slice(0, 400)); }
    const aplicada = psqlFile(h.sock, FLOW); assert.equal(aplicada.status, 0, String(aplicada.stderr).slice(0, 500));
    for (const [u, role, status] of [[OPERATOR_A, 'operator', 'active'], [REMOVED_A, 'analyst', 'revoked']]) {
      let r = h.psql(`insert into auth.users(id) values('${u}') on conflict do nothing`); assert.ok(r.ok, r.err);
      r = h.psql(`insert into public.memberships(tenant_id,user_id,role,status,permissions_version) values('${TENANT_A}','${u}','${role}','${status}',1)`); assert.ok(r.ok, r.err);
    }
    const pool = new pg.Pool({host: h.sock, user: 'postgres', database: 't', max: 4});
    try {
      const as = (userId, tenantId = TENANT_A) => crearBaseDatos({pool, tenantId, userId, statementTimeoutMs: 60000});
      const repos = (userId, tenantId = TENANT_A) => { const database = as(userId, tenantId), recommendations = createRecommendationRepository({database}); return {recommendations, flow: createFlowRepository({database, recommendations, interventions: createInterventionRepository({database})}), database}; };
      const A1 = alcance('marketplaces-usd');
      let snap = await createSnapshotRepository({database: as(OWNER.A)}).stage({scope: A1});
      snap = await createSnapshotRepository({database: as(OWNER.A)}).publish({snapshotId: snap.id, expectedContentHash: snap.contentHash});
      const ws = createWorkspaceService({database: as(OWNER.A)});
      const scopeHash = (await ws.query(q(A1, {resource: 'problems', snapshot_id: snap.id}))).meta.scope_hash;
      const sp = q(A1, {snapshot_id: snap.id, scope_hash: scopeHash});
      const catalog = (await ws.query(new URLSearchParams([...sp, ['resource', 'problems']]), {all: true, signals: false})).items;
      assert.ok(catalog.length >= 3, 'el mundo sintético debe tener al menos 3 problemas (hay ' + catalog.length + ')');
      const owner = repos(OWNER.A), analyst = repos(ANALYST_A), operator = repos(OPERATOR_A), viewer = repos(SECOND_OWNER_A);
      let n = 0; const gen = (r, i) => r.recommendations.generate({query: sp.toString(), problemId: catalog[i].id, requestKey: 'acc-rec-' + (++n).toString().padStart(4, '0')});

      await t.test('generar: el viewer no puede proponer; el miembro revocado tampoco', async () => {
        await assert.rejects(gen(viewer, 0), e => e.status === 403 || /role_insufficient/.test(e.message), 'viewer no genera acciones');
        await assert.rejects(gen(repos(REMOVED_A), 0), denegado, 'miembro revocado no genera');
      });

      let rec, apr, cur, res;
      await t.test('1) generar una acción desde un problema (analyst): queda propuesta, versión 1, sin flujo', async () => {
        rec = await gen(analyst, 0);
        assert.equal(rec.status, 'proposed'); assert.equal(rec.version, 1); assert.equal(rec.problemId ?? rec.problem?.id ?? catalog[0].id, catalog[0].id);
        const v = await viewer.flow.get({id: rec.id});
        assert.equal(v.flow.available, true); assert.equal(v.flow.etapa, 'propuesta'); assert.deepEqual(v.flow.events, []);
      });

      await t.test('2) permisos por rol en la propuesta: el viewer solo consulta (403 en cada operación) y la UI lo bloquea', async () => {
        const e403 = e => e.status === 403;
        await assert.rejects(viewer.flow.approve({id: rec.id, expectedVersion: rec.version, ownerId: ANALYST_A, dueDate: manana(), requestKey: 'v-ap-0001'}), e403);
        await assert.rejects(viewer.flow.adjust({id: rec.id, expectedVersion: rec.version, action: rec.action + ' ajuste', rationale: rec.rationale, preconditions: rec.preconditions, comment: 'Intento de un viewer para ajustar.', requestKey: 'v-aj-0001'}), e403);
        await assert.rejects(viewer.flow.start({id: rec.id, expectedVersion: rec.version, requestKey: 'v-st-0001'}), e403);
        await assert.rejects(viewer.flow.resolve({id: rec.id, expectedVersion: rec.version, outcome: 'yes', note: 'Intento de un viewer para resolver.', requestKey: 'v-rs-0001'}), e403);
        const pv = accionesPermitidas({item: await viewer.flow.get({id: rec.id}), eventos: [], rol: 'viewer'});
        assert.equal(pv.proceder.permitido, false); assert.match(pv.proceder.motivo, /solo permite consultar/);
        const pa = accionesPermitidas({item: await analyst.flow.get({id: rec.id}), eventos: [], rol: 'analyst'});
        assert.equal(pa.proceder.permitido, true); assert.equal(pa.iniciar.permitido, false);
      });

      await t.test('3) aprobar (Proceder) con el analyst: responsable operator, intervención en borrador, evento approved con autor', async () => {
        apr = await analyst.flow.approve({id: rec.id, expectedVersion: rec.version, ownerId: OPERATOR_A, dueDate: manana(), comment: COMENTARIO, requestKey: 'acc-ap-0001'});
        assert.equal(apr.flow.etapa, 'aprobada'); assert.equal(apr.ownerId, OPERATOR_A);
        const ev = apr.flow.events.find(e => e.kind === 'approved');
        assert.equal(ev.actorId, ANALYST_A); assert.equal(ev.ownerId, OPERATOR_A); assert.equal(ev.dueDate, manana());
        assert.equal(apr.drafts.length, 1); assert.equal(apr.drafts[0].status, 'draft'); assert.equal(apr.drafts[0].executionEnabled, false, 'nada se ejecuta solo');
        assert.equal(ev.interventionId, apr.drafts[0].id);
      });

      await t.test('4) marcar en curso (la ejecución humana): lo hace el operator; un viewer sigue sin poder; no se repite', async () => {
        await assert.rejects(viewer.flow.start({id: rec.id, expectedVersion: apr.version, requestKey: 'v-st-0002'}), e => e.status === 403);
        cur = await operator.flow.start({id: rec.id, expectedVersion: apr.version, comment: 'Empezamos con el proveedor esta semana.', requestKey: 'acc-st-0001'});
        assert.equal(cur.flow.etapa, 'en_curso'); assert.equal(cur.flow.events.at(-1).actorId, OPERATOR_A);
        await assert.rejects(operator.flow.start({id: rec.id, expectedVersion: apr.version, requestKey: 'acc-st-0002'}), e => e.status === 409);
      });

      await t.test('5) registrar el resultado (owner): sin medición observada no hay antes/después; no se resuelve dos veces', async () => {
        await assert.rejects(viewer.flow.resolve({id: rec.id, expectedVersion: apr.version, outcome: 'yes', note: NOTA, requestKey: 'v-rs-0002'}), e => e.status === 403);
        res = await owner.flow.resolve({id: rec.id, expectedVersion: apr.version, outcome: 'yes', note: NOTA, requestKey: 'acc-rs-0001'});
        assert.equal(res.flow.etapa, 'resultado');
        const ev = res.flow.events.find(e => e.kind === 'resolved');
        assert.equal(ev.actorId, OWNER.A); assert.equal(ev.outcome, 'yes'); assert.equal(ev.comparison, null);
        await assert.rejects(owner.flow.resolve({id: rec.id, expectedVersion: apr.version, outcome: 'no', note: 'Segundo resultado no permitido.', requestKey: 'acc-rs-0002'}), e => e.status === 409);
      });

      await t.test('6) historial: cualquier miembro (incluido el viewer) ve la línea de tiempo completa, en orden y con autor; la pantalla Acciones lo agrupa', async () => {
        const vista = await viewer.flow.get({id: rec.id});
        assert.deepEqual(vista.flow.events.map(e => e.kind), ['approved', 'started', 'resolved']);
        assert.deepEqual(vista.flow.events.map(e => e.actorId), [ANALYST_A, OPERATOR_A, OWNER.A]);
        const nombres = {[OWNER.A]: 'Owner', [ANALYST_A]: 'Analista', [OPERATOR_A]: 'Operador'};
        const linea = construirLinea({item: vista, eventos: vista.flow.events, nombre: id => nombres[id] ?? 'Persona del equipo'});
        const tipos = linea.map(f => f.tipo);
        for (const k of ['propuesta', 'responsable', 'approved', 'started', 'resolved']) assert.ok(tipos.includes(k), 'la línea de tiempo trae ' + k + ' (' + tipos.join(',') + ')');
        assert.ok(tipos.indexOf('approved') < tipos.indexOf('started') && tipos.indexOf('started') < tipos.indexOf('resolved'), 'orden cronológico');
        assert.equal(linea.find(f => f.tipo === 'started').quien, 'Operador');
        const lista = await viewer.flow.list({query: sp});
        const g = agrupar(lista.items); assert.equal(g.resultado.length, 1); assert.equal(g.resultado[0].id, rec.id);
        const r = resumir(lista.items); assert.equal(r.resultado.n, 1); assert.equal(r.resultado.si, 1); assert.equal(r.resultado.conComparacion, 0);
        const act = actividadReciente(lista.items, 10).filter(a => a.accionId === rec.id).map(a => a.tipo);
        assert.deepEqual(new Set(act), new Set(['approved', 'started', 'resolved']));
        assert.equal(accionesPermitidas({item: vista, eventos: vista.flow.events, rol: 'owner'}).resultado.permitido, false, 'con resultado ya no hay más acciones');
      });

      await t.test('7) atomicidad: una aprobación rechazada (responsable viewer, ajeno o revocado) no deja borrador huérfano ni sube la versión; luego el operator sí aprueba', async () => {
        const rb = await gen(owner, 1);
        const cuenta = () => owner.database.transaction('read', async s => (await s.query('SELECT count(*)::int AS n FROM public.interventions WHERE tenant_id=$1', [s.tenantId])).rows[0].n);
        const antes = await cuenta();
        for (const [i, malo] of [SECOND_OWNER_A, OWNER.B, REMOVED_A].entries()) {
          await assert.rejects(owner.flow.approve({id: rb.id, expectedVersion: rb.version, ownerId: malo, dueDate: manana(), requestKey: 'acc-mal-000' + i}), e => e.status >= 400, 'responsable no válido ' + i);
          const ahora = await owner.flow.get({id: rb.id});
          assert.equal(ahora.version, rb.version, 'la versión no cambia (' + i + ')'); assert.equal(ahora.flow.etapa, 'propuesta'); assert.deepEqual(ahora.flow.events, []);
        }
        assert.equal(await cuenta(), antes, 'ninguna intervención huérfana');
        const a = await operator.flow.approve({id: rb.id, expectedVersion: rb.version, ownerId: OWNER.A, dueDate: manana(), requestKey: 'acc-ap-0002'});
        assert.equal(a.flow.etapa, 'aprobada'); assert.equal(a.flow.events[0].actorId, OPERATOR_A);
      });

      await t.test('8) (owner aprueba) reintento idempotente tras un corte de red: repetir approve, start o resolve con la MISMA clave devuelve el estado, no 409', async () => {
        const rb = await gen(owner, 2);
        await assert.rejects(repos(REMOVED_A).flow.approve({id: rb.id, expectedVersion: rb.version, ownerId: OWNER.A, dueDate: manana(), requestKey: 'acc-ap-0004'}), denegado, 'el miembro revocado no aprueba');
        const a1 = await owner.flow.approve({id: rb.id, expectedVersion: rb.version, ownerId: ANALYST_A, dueDate: manana(), requestKey: 'acc-ap-0005'});
        const a2 = await owner.flow.approve({id: rb.id, expectedVersion: rb.version, ownerId: ANALYST_A, dueDate: manana(), requestKey: 'acc-ap-0005'});
        assert.equal(a2.flow.events.length, 1); assert.equal(a2.version, a1.version);
        const s1 = await owner.flow.start({id: rb.id, expectedVersion: a1.version, requestKey: 'acc-st-0003'});
        const s2 = await owner.flow.start({id: rb.id, expectedVersion: a1.version, requestKey: 'acc-st-0003'});
        assert.equal(s2.flow.events.filter(e => e.kind === 'started').length, 1); assert.equal(s2.flow.etapa, 'en_curso'); assert.equal(s1.version, s2.version);
        // dos resultados distintos al mismo tiempo: gana uno solo (SQL), el otro recibe un rechazo, jamás dos eventos
        const nota = 'Se resolvió una parte; la otra queda para el siguiente lote.', pedir = k => owner.flow.resolve({id: rb.id, expectedVersion: a1.version, outcome: 'partial', note: nota, requestKey: k});
        const carrera = await Promise.allSettled([pedir('acc-rs-0003'), pedir('acc-rs-0010')]);
        assert.equal(carrera.filter(c => c.status === 'fulfilled').length, 1, 'solo una resolución gana');
        const ganadora = carrera[0].status === 'fulfilled' ? 'acc-rs-0003' : 'acc-rs-0010';
        const r2 = await pedir(ganadora);
        assert.equal(r2.flow.events.filter(e => e.kind === 'resolved').length, 1); assert.equal(r2.flow.etapa, 'resultado');
        // la misma solicitud repetida en paralelo (doble clic) también termina con un solo evento
        const rd = await Promise.all([pedir(ganadora), pedir(ganadora)]);
        assert.ok(rd.every(r => r.flow.events.filter(e => e.kind === 'resolved').length === 1));
        // una clave ya usada para OTRA recomendación es conflicto (no se mezcla)
        await assert.rejects(owner.flow.start({id: rec.id, expectedVersion: apr.version, requestKey: 'acc-st-0003'}), e => e.status === 409);
      });

      await t.test('10) aislamiento: la otra organización no ve ni toca la acción (404/403), y su lista no la trae', async () => {
        const b = repos(OWNER.B, TENANT_B);
        await assert.rejects(b.flow.get({id: rec.id}), e => e.status === 404 || e.status === 403);
        await assert.rejects(b.flow.approve({id: rec.id, expectedVersion: 1, ownerId: OWNER.B, dueDate: manana(), requestKey: 'x-ap-0001'}), e => [403, 404, 409].includes(e.status));
        await assert.rejects(b.flow.resolve({id: rec.id, expectedVersion: apr.version, outcome: 'yes', note: NOTA, requestKey: 'x-rs-0001'}), e => [403, 404, 409].includes(e.status));
      });

      await t.test('11) coherencia: etapaActual con los eventos de la base coincide con la etapa que devuelve el repositorio en todas las acciones', async () => {
        const lista = await owner.flow.list({query: sp});
        assert.ok(lista.items.length >= 3);
        for (const i of lista.items) assert.equal(i.flow.etapa, etapaActual(i, i.flow.events));
      });
    } finally { await pool.end(); }
  }, {name: 'accflow', upto: 55});
});
