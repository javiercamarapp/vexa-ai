// Corte económico REAL a escala (85,361 asientos): `stage` por la ruta HTTP excede el límite de 10 s (JS ~8 s + SQL ~6 s); aquí se prueba la ruta acotada y
// fuera de banda (packages/ai-scale/economia-problemas/snapshot.mjs): preparar --rollback-test -> preparar --commit -> publicar, UNA moneda y UNA base por corte,
// con la lectura de 10 s (latest/get) verificada después. Postgres local desechable (/private/tmp/claude-501); datos 100 % sintéticos.
//   node --test packages/metrics/tests/stage-fuera-de-banda.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {withPg, pgAvailable} from './pg-harness.mjs';
import {sembrarBase, cargarAsientos} from './ledger-sintetico.mjs';
import {crearBaseDatos, ALCANCES, alcance} from '../../ai-scale/economia-problemas/snapshot.mjs';
import {TENANT_A, OWNER} from '../../ai-scale/economia-problemas/mundo.mjs';
import {createSnapshotRepository} from '../snapshots.mjs';

const pg = createRequire(import.meta.url)('pg');
const SKIP = !pgAvailable() && 'sin postgres local';
const CLI = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../ai-scale/economia-problemas/snapshot.mjs');
const run = (h, out, args) => {
  const t = Date.now();
  const r = spawnSync(process.execPath, [CLI, ...args, '--owner', OWNER.A, '--pg-socket', h.sock, '--pg-db', 't', '--pg-user', 'postgres', '--out', out, '--timeout-ms', '120000'], {encoding: 'utf8', maxBuffer: 64 * 1024 * 1024});
  return {status: r.status, ms: Date.now() - t, out: r.stdout.trim().split('\n').pop(), err: r.stderr.trim()};
};

test('corte real a 85,361 asientos: preparar (prueba deshecha) -> preparar -> publicar, fuera de banda y sin mezclar monedas ni bases', {skip: SKIP, timeout: 1200000}, async t => {
  await withPg(async h => {
    sembrarBase(h); cargarAsientos(h, {total: 85361});
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'vexa-stage-')); t.after(() => fs.rmSync(out, {recursive: true, force: true}));
    const pool = new pg.Pool({host: h.sock, user: 'postgres', database: 't', max: 4}); t.after(() => pool.end());
    const lectura = createSnapshotRepository({database: crearBaseDatos({pool, tenantId: TENANT_A, userId: OWNER.A, statementTimeoutMs: 10000})});
    const n = sql => h.psql(sql).out;
    const tiempos = {};

    await t.test('la prueba con reversa prepara y DESHACE: no deja ninguna fila', () => {
      const r = run(h, out, ['preparar', '--alcance', 'marketplaces-usd', '--rollback-test']);
      assert.equal(r.status, 0, r.err); tiempos['rollback-test marketplaces-usd'] = r.ms;
      const res = JSON.parse(r.out); assert.equal(res.modo, 'rollback-test'); assert.equal(res.status, 'draft'); assert.match(res.contentHash, /^[a-f0-9]{64}$/);
      assert.equal(n('select count(*) from public.metric_snapshots'), '0'); assert.equal(n('select count(*) from public.components'), '0');
    });

    const comprometidos = {};
    for (const nombre of Object.keys(ALCANCES)) await t.test(`preparar --commit ${nombre}: borrador íntegro, idempotente, una sola moneda y base`, () => {
      const a = run(h, out, ['preparar', '--alcance', nombre, '--commit']); assert.equal(a.status, 0, a.err); tiempos['commit ' + nombre] = a.ms;
      const res = JSON.parse(a.out); assert.equal(res.status, 'draft'); comprometidos[nombre] = res;
      const b = run(h, out, ['preparar', '--alcance', nombre, '--commit']); assert.equal(b.status, 0, b.err); tiempos['replay ' + nombre] = b.ms;
      assert.equal(JSON.parse(b.out).snapshotId, res.snapshotId, 'misma entrada => mismo snapshot (idempotente)'); assert.equal(JSON.parse(b.out).contentHash, res.contentHash);
      assert.equal(n(`select count(*) from public.metric_snapshots where id='${res.snapshotId}'`), '1');
      const sc = alcance(nombre);
      assert.equal(n(`select currency||'|'||(date_start at time zone 'UTC')::date||'|'||(date_end at time zone 'UTC')::date from public.metric_snapshots where id='${res.snapshotId}'`), `${sc.currency}|${sc.start.slice(0, 10)}|${sc.end.slice(0, 10)}`);
      // ningún componente "convertido" ni suma entre monedas: cada componente nativo conserva su moneda y no hay fx
      assert.equal(n(`select count(*) from public.components where snapshot_id='${res.snapshotId}' and provenance->'component'->>'conversion' is not null`), '0');
      assert.equal(n('select count(*) from public.economic_fx_versions'), '0');
    });

    await t.test('publicar cada corte (hash esperado) y leerlo por la ruta de 10 s en < 3 s', async () => {
      for (const [nombre, res] of Object.entries(comprometidos)) {
        const p = run(h, out, ['publicar', '--snapshot-id', res.snapshotId, '--content-hash', res.contentHash, '--publicar']); assert.equal(p.status, 0, p.err); tiempos['publish ' + nombre] = p.ms;
        assert.equal(JSON.parse(p.out).status, 'published');
        const t0 = Date.now(); const l = await lectura.latest({scope: alcance(nombre)}); const ms = Date.now() - t0; tiempos['latest ' + nombre] = ms;
        assert.equal(l.snapshot.id, res.snapshotId); assert.equal(l.snapshot.status, 'published'); assert.ok(ms < 3000, nombre + ' latest ' + ms + ' ms');
      }
      assert.equal(n("select count(*) from public.metric_snapshots where status='published'"), String(Object.keys(ALCANCES).length));
      assert.equal(n('select count(*) from public.economic_snapshot_heads'), String(Object.keys(ALCANCES).length));
    });

    await t.test('publicar con hash equivocado o sin --publicar no cambia nada', () => {
      const [res] = Object.values(comprometidos);
      const dry = run(h, out, ['publicar', '--snapshot-id', res.snapshotId, '--content-hash', res.contentHash]); assert.equal(dry.status, 0); assert.match(dry.out, /DRY-RUN/);
      const bad = run(h, out, ['publicar', '--snapshot-id', res.snapshotId, '--content-hash', 'f'.repeat(64), '--publicar']); assert.notEqual(bad.status, 0);
    });
    console.log('# tiempos (ms): ' + JSON.stringify(tiempos));
  }, {name: 'stage-oob', shared: '256MB'});
});
