// Flujo de aprobación contra Postgres local desechable con las migraciones reales + las propuestas (no aplicadas en producción) y 20261111000000. Datos sintéticos.
//   node --test packages/recommendations/tests/flow-db.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import pg from 'pg';
import {withPg, pgAvailable} from '../../metrics/tests/pg-harness.mjs';
import {montarMundo, TENANT_A, OWNER, ANALYST_A, SECOND_OWNER_A, psqlFile} from '../../ai-scale/economia-problemas/mundo.mjs';
import {crearBaseDatos, alcance} from '../../ai-scale/economia-problemas/snapshot.mjs';
import {createSnapshotRepository} from '../../metrics/snapshots.mjs';
import {createWorkspaceService} from '../../workspace-service/index.mjs';
import {createRecommendationRepository} from '../index.mjs';
import {createFlowRepository} from '../flow.mjs';
import {createInterventionRepository} from '../../interventions/index.mjs';

const read = f => fs.readFileSync(new URL(f, import.meta.url), 'utf8');
const BASE = ['20261028000000_brief_catalog_cut', '20261030000000_brief_guard_uuid_ids', '20261029000000_recommendation_catalog_cut', '20261101000000_recommendation_generator_v2'].map(n => read('../../../supabase/migrations/' + n + '.sql'));
const FLOW = read('../../../supabase/migrations/20261111000000_recommendation_flow.sql');
const FLOW_DOWN = read('../../workspace-service/tests/20261111000000_recommendation_flow.down.sql');
const SKIP = !pgAvailable() && 'sin postgres local';
const q = (a, extra = {}) => new URLSearchParams({date_start: a.start.slice(0, 10), date_end: a.end.slice(0, 10), currency: a.currency, basis: a.basis, exponent: String(a.exponent), ...extra});
const manana = () => new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);

test('Flujo de aprobación: Proceder crea la intervención y registra la aprobación; lo aprobado es inmutable; roles; reversa', {skip: SKIP, timeout: 900000}, async t => {
  await withPg(async h => {
    montarMundo(h);
    for (const sql of BASE) { const r = psqlFile(h.sock, sql); assert.equal(r.status, 0, String(r.stderr).slice(0, 400)); }
    const pool = new pg.Pool({host: h.sock, user: 'postgres', database: 't', max: 4});
    try {
      const as = userId => crearBaseDatos({pool, tenantId: TENANT_A, userId, statementTimeoutMs: 60000});
      const repos = userId => { const database = as(userId), recommendations = createRecommendationRepository({database}); return {recommendations, flow: createFlowRepository({database, recommendations, interventions: createInterventionRepository({database})})}; };
      const A1 = alcance('marketplaces-usd');
      let snap = await createSnapshotRepository({database: as(OWNER.A)}).stage({scope: A1});
      snap = await createSnapshotRepository({database: as(OWNER.A)}).publish({snapshotId: snap.id, expectedContentHash: snap.contentHash});
      const ws = createWorkspaceService({database: as(OWNER.A)});
      const scopeHash = (await ws.query(q(A1, {resource: 'problems', snapshot_id: snap.id}))).meta.scope_hash;
      const sp = q(A1, {snapshot_id: snap.id, scope_hash: scopeHash});
      const catalog = (await ws.query(new URLSearchParams([...sp, ['resource', 'problems']]), {all: true, signals: false})).items;
      const owner = repos(OWNER.A);
      const recA = await owner.recommendations.generate({query: sp.toString(), problemId: catalog[0].id, requestKey: 'flow-rec-0001'});
      const recB = await owner.recommendations.generate({query: sp.toString(), problemId: catalog[1].id, requestKey: 'flow-rec-0002'});

      await t.test('sin la migración: la lectura funciona (available=false) y las operaciones dicen configuration_required, sin simular nada', async () => {
        const l = await owner.flow.list({query: sp});
        assert.equal(l.flowAvailable, false); assert.equal(l.items.find(i => i.id === recA.id).flow.etapa, 'propuesta');
        await assert.rejects(owner.flow.approve({id: recA.id, expectedVersion: recA.version, ownerId: OWNER.A, dueDate: manana(), requestKey: 'k-sin-migracion'}), e => e.status === 503 && /configuration_required/.test(e.code ?? e.message));
      });

      const aplicada = psqlFile(h.sock, FLOW); assert.equal(aplicada.status, 0, String(aplicada.stderr).slice(0, 500));

      await t.test('viewer no puede aprobar, ajustar, iniciar ni resolver (403) aunque conozca los ids', async () => {
        const v = repos(SECOND_OWNER_A);
        const e403 = e => e.status === 403;
        await assert.rejects(v.flow.approve({id: recA.id, expectedVersion: recA.version, ownerId: OWNER.A, dueDate: manana(), requestKey: 'k-viewer-1'}), e403);
        await assert.rejects(v.flow.start({id: recA.id, expectedVersion: recA.version, requestKey: 'k-viewer-2'}), e403);
        await assert.rejects(v.flow.resolve({id: recA.id, expectedVersion: recA.version, outcome: 'yes', note: 'Intento de un viewer para resolver.', requestKey: 'k-viewer-3'}), e403);
        assert.equal((await v.flow.get({id: recA.id})).flow.role, 'viewer');
      });

      await t.test('validaciones: fecha pasada, sin responsable, ajuste sin comentario', async () => {
        await assert.rejects(owner.flow.approve({id: recA.id, expectedVersion: recA.version, ownerId: OWNER.A, dueDate: '2020-01-01', requestKey: 'k-fecha'}), e => e.status === 400);
        await assert.rejects(owner.flow.approve({id: recA.id, expectedVersion: recA.version, ownerId: 'no', dueDate: manana(), requestKey: 'k-owner'}), e => e.status === 400);
        await assert.rejects(owner.flow.adjust({id: recA.id, expectedVersion: recA.version, action: recA.action, rationale: recA.rationale, preconditions: recA.preconditions, ownerId: null, priority: 'normal', comment: '', requestKey: 'k-adj-0'}), e => e.status === 400);
      });

      await t.test('Ajustar: versión nueva con historial, comentario y prioridad; aún no aprobada', async () => {
        const r = await owner.flow.adjust({id: recB.id, expectedVersion: recB.version, action: recB.action + ' Se acota al lote de octubre.', rationale: recB.rationale, preconditions: recB.preconditions, ownerId: ANALYST_A, priority: 'critical', comment: 'Se acota al lote de octubre y sube a urgente.', requestKey: 'k-adj-1'});
        assert.equal(r.version, recB.version + 1); assert.equal(r.priority, 'critical'); assert.equal(r.flow.etapa, 'ajustada');
        assert.equal(r.history.length, 2); assert.match(r.history[1].reason, /lote de octubre/);
        const again = await owner.flow.adjust({id: recB.id, expectedVersion: recB.version, action: recB.action + ' Se acota al lote de octubre.', rationale: recB.rationale, preconditions: recB.preconditions, ownerId: ANALYST_A, priority: 'critical', comment: 'Se acota al lote de octubre y sube a urgente.', requestKey: 'k-adj-1'});
        assert.equal(again.version, r.version, 'reintento idempotente');
      });

      let aprobada;
      await t.test('Proceder: asigna responsable, crea la intervención borrador y registra la aprobación (idempotente)', async () => {
        aprobada = await owner.flow.approve({id: recA.id, expectedVersion: recA.version, ownerId: ANALYST_A, dueDate: manana(), comment: 'Aprobado para pedir revisión de lote al proveedor.', requestKey: 'k-aprobar-1'});
        assert.equal(aprobada.flow.etapa, 'aprobada'); assert.equal(aprobada.ownerId, ANALYST_A);
        const ev = aprobada.flow.events.find(e => e.kind === 'approved');
        assert.equal(ev.ownerId, ANALYST_A); assert.equal(ev.dueDate, manana()); assert.equal(aprobada.drafts.length, 1); assert.equal(aprobada.drafts[0].id, ev.interventionId);
        assert.equal(aprobada.drafts[0].status, 'draft'); assert.equal(aprobada.drafts[0].executionEnabled, false);
        assert.match(aprobada.history.at(-1).reason, /^Responsable asignado al aprobar/);
        const replay = await owner.flow.approve({id: recA.id, expectedVersion: recA.version, ownerId: ANALYST_A, dueDate: manana(), comment: 'Aprobado para pedir revisión de lote al proveedor.', requestKey: 'k-aprobar-1'});
        assert.equal(replay.flow.events.filter(e => e.kind === 'approved').length, 1);
        await assert.rejects(owner.flow.approve({id: recA.id, expectedVersion: aprobada.version, ownerId: ANALYST_A, dueDate: manana(), requestKey: 'k-aprobar-2'}), e => e.status === 409);
      });

      await t.test('lo aprobado es inmutable: ni ajustar, ni revisar, ni descartar (SQL lo impide)', async () => {
        await assert.rejects(owner.flow.adjust({id: recA.id, expectedVersion: aprobada.version, action: recA.action + ' otra', rationale: recA.rationale, preconditions: recA.preconditions, ownerId: ANALYST_A, priority: 'normal', comment: 'Intento de cambiar algo ya aprobado.', requestKey: 'k-adj-2'}), e => e.status === 409);
        await assert.rejects(owner.recommendations.revise({id: recA.id, expectedVersion: aprobada.version, action: recA.action + ' directa', preconditions: recA.preconditions, rationale: recA.rationale, ownerId: ANALYST_A, reason: 'Intento directo sin pasar por el flujo.'}), e => e.status === 409 || e.code === '42501');
        await assert.rejects(owner.recommendations.setState({id: recA.id, expectedVersion: aprobada.version, status: 'dismissed', reason: 'Intento de descartar lo ya aprobado en curso.'}), e => e.status === 409 || e.code === '42501');
        assert.equal((await owner.flow.get({id: recA.id})).version, aprobada.version);
      });

      await t.test('En curso y Resultado: orden obligatorio; sin medición no hay comparación antes/después', async () => {
        await assert.rejects(owner.flow.resolve({id: recB.id, expectedVersion: recB.version + 1, outcome: 'yes', note: 'Sin aprobar no se puede dar resultado.', requestKey: 'k-res-0'}), e => e.status === 409);
        const s = await owner.flow.start({id: recA.id, expectedVersion: aprobada.version, requestKey: 'k-start-1'});
        assert.equal(s.flow.etapa, 'en_curso');
        await assert.rejects(owner.flow.start({id: recA.id, expectedVersion: aprobada.version, requestKey: 'k-start-2'}), e => e.status === 409);
        const r = await owner.flow.resolve({id: recA.id, expectedVersion: aprobada.version, outcome: 'partial', note: 'El proveedor corrigió un lote; falta el segundo, se verá en noviembre.', requestKey: 'k-res-1'});
        assert.equal(r.flow.etapa, 'resultado'); const ev = r.flow.events.find(e => e.kind === 'resolved');
        assert.equal(ev.outcome, 'partial'); assert.equal(ev.comparison, null, 'no hay medición: no se inventa antes/después');
        await assert.rejects(owner.flow.resolve({id: recA.id, expectedVersion: aprobada.version, outcome: 'yes', note: 'Segundo resultado no permitido por orden.', requestKey: 'k-res-2'}), e => e.status === 409);
      });

      await t.test('la tabla de eventos es solo-inserción (UPDATE y DELETE rechazados)', async () => {
        const u = h.psql(`update public.recommendation_flow_events set note='x' where true`);
        assert.equal(u.ok, false); const d = h.psql(`delete from public.recommendation_flow_events`); assert.equal(d.ok, false);
      });

      await t.test('reversa: la .down.sql deja la base sin el flujo y la lectura vuelve a available=false', async () => {
        const r = psqlFile(h.sock, FLOW_DOWN); assert.equal(r.status, 0, String(r.stderr).slice(0, 400));
        assert.equal((await owner.flow.list({query: sp})).flowAvailable, false);
        assert.equal(h.psql("select to_regclass('public.recommendation_flow_events') is null").out, 't');
      });
    } finally { await pool.end(); }
  }, {name: 'recflow', upto: 55});
});
