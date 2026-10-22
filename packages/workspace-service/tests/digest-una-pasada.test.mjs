// Migraciones propuestas 20261026 (políticas de issues/evidence_spans) y 20261027 (economic_snapshot_digest en una pasada), probadas en Postgres local con datos sintéticos:
// el digest nuevo da EXACTAMENTE el mismo hash que el original y que el almacenado, sigue detectando contenido alterado (snapshot_integrity_failed) y es reversible.
//   node --test packages/workspace-service/tests/digest-una-pasada.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {withPg, pgAvailable} from '../../metrics/tests/pg-harness.mjs';
import {construirMundo, TENANT_A, OWNER, psqlFile} from '../../metrics/tests/world.mjs';
import {createSnapshotRepository} from '../../metrics/snapshots.mjs';

const SKIP = !pgAvailable() && 'sin postgres local';
const read = f => fs.readFileSync(new URL(f, import.meta.url), 'utf8');
const UP_D = read('../../../supabase/migrations/20261027000000_snapshot_digest_single_pass.sql'), DOWN_D = read('./20261027000000_snapshot_digest_single_pass.down.sql');
const UP_P = read('../../../supabase/migrations/20261026000000_evidence_policies_initplan.sql'), DOWN_P = read('./20261026000000_evidence_policies_initplan.down.sql');

test('digest en una pasada: mismo hash, mismas garantías, reversible; políticas con membresía por sentencia', {skip: SKIP, timeout: 600000}, async t => {
  await withPg(async h => {
    const ctx = await construirMundo(h, {complete: false});
    const db = () => ctx.db(OWNER.A, TENANT_A, 60000);
    const digest = id => db().transaction('read', async s => (await s.query('SELECT public.economic_snapshot_digest($1,$2) AS h', [TENANT_A, id])).rows[0].h);
    const owner = () => createSnapshotRepository({database: ctx.db(OWNER.A, TENANT_A, 60000)});
    let snap = await owner().stage({scope: ctx.A1}); snap = await owner().publish({snapshotId: snap.id, expectedContentHash: snap.contentHash});
    const apply = sql => { const r = psqlFile(ctx.sock, sql); assert.equal(r.status, 0, String(r.stderr).slice(0, 400)); };
    const policy = tabla => ctx.psql(`select qual from pg_policies where tablename='${tabla}' and policyname='backend_scope'`).out;

    await t.test('el digest nuevo = el original = content_hash almacenado; la lectura del snapshot sigue verificando', async () => {
      const before = await digest(snap.id); assert.equal(before, snap.contentHash);
      apply(UP_D);
      assert.equal(await digest(snap.id), before, 'mismos bytes, mismo sha256');
      assert.equal((await owner().get({snapshotId: snap.id})).contentHash, snap.contentHash);
    });
    await t.test('contenido alterado (componente o manifiesto) sigue siendo snapshot_integrity_failed', async () => {
      for (const [sql, undo] of [[`update public.components set provenance=provenance||'{"x":1}' where snapshot_id='${snap.id}'`, `update public.components set provenance=provenance-'x' where snapshot_id='${snap.id}'`],
        [`update public.metric_snapshots set input_manifest=jsonb_set(input_manifest,'{policy}','"alterada"') where id='${snap.id}'`, `update public.metric_snapshots set input_manifest=jsonb_set(input_manifest,'{policy}',to_jsonb(policy_version)) where id='${snap.id}'`]]) {
        apply('set session_replication_role=replica;' + sql);
        assert.notEqual(await digest(snap.id), snap.contentHash);
        await assert.rejects(owner().get({snapshotId: snap.id}), e => e.message === 'snapshot_integrity_failed' || e.code === 'snapshot_integrity_failed');
        apply('set session_replication_role=replica;' + undo);
      }
      assert.equal(await digest(snap.id), snap.contentHash, 'restaurado');
    });
    await t.test('fail-closed: si el marcador aparece en los datos, el digest es NULL (nunca iguala a content_hash)', async () => {
      apply(`set session_replication_role=replica; update public.metric_snapshots set provenance=jsonb_set(provenance,'{scope,extra}','"@@vexa-digest-manifest-slot-4c1f9e27@@"') where id='${snap.id}'`);
      assert.equal(await digest(snap.id), null);
    });
    await t.test('reversa: la función original vuelve a dar el mismo hash que la nueva sobre el contenido íntegro', async () => {
      apply(`set session_replication_role=replica; update public.metric_snapshots set provenance=provenance #- '{scope,extra}' where id='${snap.id}'`);
      const nuevo = await digest(snap.id); apply(DOWN_D); assert.equal(await digest(snap.id), nuevo); assert.equal(nuevo, snap.contentHash);
    });
    await t.test('políticas issues/evidence_spans: mismo predicado con sub-select; la reversa restaura el original', async () => {
      const original = ['issues', 'evidence_spans'].map(policy);
      assert.ok(original.every(q => /vexa_member\(tenant_id\)/.test(q) && !/SELECT/i.test(q)));
      apply(UP_P);
      for (const tb of ['issues', 'evidence_spans']) assert.match(policy(tb), /SELECT vexa_member\(/i);
      // la lectura de evidencia sigue funcionando con el rol del backend y el tenant correcto, y NO cruza tenants
      const n = await ctx.db(OWNER.A, TENANT_A, 20000).transaction('read', async s => +(await s.query('SELECT count(*) AS n FROM public.issues WHERE tenant_id=$1', [TENANT_A])).rows[0].n);
      assert.ok(n > 0);
      const cross = await ctx.db(OWNER.A, TENANT_A, 20000).transaction('read', async s => +(await s.query('SELECT count(*) AS n FROM public.issues WHERE tenant_id<>$1', [TENANT_A])).rows[0].n);
      assert.equal(cross, 0);
      apply(DOWN_P); assert.deepEqual(['issues', 'evidence_spans'].map(policy), original);
    });
    await ctx.pool.end();
  }, {name: 'dig', upto: 55});
});
