#!/usr/bin/env node
// BENCHMARK LOCAL (no es una prueba): ¿cuánto cuestan readExposure / snapshot / vistas del workspace cuando el libro tiene volumen real (88,666 filas sintéticas)
// y hay N conversaciones agrupadas en K problemas, de los cuales algunos llevan vínculos? Postgres desechable en /private/tmp/claude-501; todo sintético.
//   node bench-escala.mjs --convs 300 --clusters 30 --ledger full|small --linked 20
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import pg from 'pg';
import {withPg} from './harness.mjs';
import {conversacion, TENANT_A, U, OWNER, psqlFile, sembrarUsuarios, TAX, VERSION} from './mundo.mjs';
import {SEED_SQL} from '../test-pg.mjs';
import {persistenceSql} from '../persistir.mjs';
import * as N from '../problemas/nucleo.mjs';
import {planSql, cerrar} from '../problemas/agrupar.mjs';
import {prepareMarketplaces} from '../../../scripts/economics/preparar.mjs';
import {syntheticMarketplaceTexts} from '../../economics/synthetic.mjs';
import {indexarMarketplaces} from './puente.mjs';
import {construirPares} from './reglas.mjs';
import {insertarSql} from './sqlgen.mjs';
import {crearBaseDatos, problemasValidos, alcance, medirExposicion, prepararSnapshot, publicarSnapshot} from './snapshot.mjs';
import {createWorkspaceService} from '../../workspace-service/index.mjs';
import {createDetailService} from '../../workspace-service/detail.mjs';

const a = process.argv.slice(2), opt = (n, d) => { const i = a.indexOf('--' + n); return i >= 0 ? a[i + 1] : d; };
const PROPUESTA = a.includes('--propuesta-0055');
const CONVS = +opt('convs', 300), K = +opt('clusters', 30), LEDGER = opt('ledger', 'full'), LINKED = +opt('linked', 20);
const sha = s => createHash('sha256').update(s).digest('hex');
const ms = async (f) => { const t = Date.now(); const r = await f(); return [r, Math.round((Date.now() - t))]; };
const log = (...x) => console.log(...x);

await withPg(async h => {
  const {psql, sock} = h;
  if (PROPUESTA) { const f = new URL('./propuestas/0055_economic_snapshot_visible_rapida.sql', import.meta.url).pathname; for (const nombre of ['0055_economic_snapshot_visible_rapida.sql', '0055b_components_policy_una_vez.sql']) { const rr = h.file(new URL('./propuestas/' + nombre, import.meta.url).pathname); if (rr.status !== 0) throw Error('propuesta ' + nombre + ': ' + rr.stderr.slice(0, 200)); } console.log('propuestas 0055 + 0055b aplicadas (visibilidad rápida, política de components una vez)'); void f; }
  // ---- libro a escala
  const texts = syntheticMarketplaceTexts();
  const readSynthetic = (root, spec) => { const text = texts.get(spec.rel); return {text, sha: sha(text), bytes: Buffer.from(text)}; };
  psql(`insert into public.organizations(id,name) values('${TENANT_A}','SYN'),('bbbbbbbb-0000-4000-8000-000000000001','SYNB')`); sembrarUsuarios(h);
  const prep = prepareMarketplaces({tenantId: TENANT_A, actorId: OWNER.A, root: 'sintetico', readFile: readSynthetic, unknownCurrency: 'XXX'});
  const files = LEDGER === 'full' ? prep.files : prep.files.slice(0, 1 + 12);
  const pool = new pg.Pool({host: sock, user: 'postgres', database: 't', max: 4});
  let [, tLedger] = await ms(async () => { for (const f of files) { const c = await pool.connect(); try { await c.query(f.sql); } finally { c.release(); } } });
  log(`ledger: ${psql('select count(*) from public.economic_ledger_entries').out} filas cargadas en ${tLedger} ms`);
  // ---- conversaciones + problemas
  const convs = Array.from({length: CONVS}, (_, i) => conversacion({tenant: TENANT_A, n: i + 1, cat: TAX[i % K % TAX.length], ext: 'hubspot:' + (6000000000 + i + 1), cluster: i % K, text: `Texto sintético número ${i} del cliente ${i % K} sobre su pedido que no llega y el cobro repetido en su tarjeta.`}));
  let seed = '', first = true;
  for (const c of convs) { const o = {tenant: c.tenant, conn: U(500000 + c.n), conv: c.conv.conversation_id, csrev: U(600000 + c.n), msgs: c.conv.messages.map((m, i) => ({id: m.id, rev: m.revision_id, srev: U(700000 + c.n * 2 + i), role: m.role}))};
    let sql = SEED_SQL(o); if (!first) sql = sql.replace(/^\s*insert into public\.organizations[^\n]*\n/m, ''); else sql = sql.replace(/^\s*insert into public\.organizations[^\n]*\n/m, ''); first = false;
    sql = sql.replace("values('" + o.conn + "','" + o.tenant + "','csv','acc')", "values('" + o.conn + "','" + o.tenant + "','csv','acc" + c.n + "')").replaceAll("'c1'", "'" + c.ext + "'"); seed += sql + '\n'; }
  let r = psqlFile(sock, seed); if (r.status !== 0) throw Error(r.stderr.slice(0, 300));
  psql(`update public.source_revisions s set snapshot=jsonb_build_array(jsonb_build_object('table','messages','row',jsonb_build_object('id',m.id,'role',m.role,'conversation_id',m.conversation_id))) from public.messages m where s.entity_type='message' and s.canonical_id=m.id and s.tenant_id=m.tenant_id`);
  r = psqlFile(sock, persistenceSql(convs.map(c => c.p), {tenant: TENANT_A, commit: true})); if (r.status !== 0) throw Error(r.stderr.slice(0, 300));
  // vectores con ruido pequeño alrededor de K centros
  const prng = seed => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
  const center = k => { const rr = prng(1000 + k), v = new Float32Array(N.EMBED_DIM); let n = 0; for (let i = 0; i < v.length; i++) { v[i] = Math.sqrt(-2 * Math.log(rr() + 1e-12)) * Math.cos(2 * Math.PI * rr()); n += v[i] * v[i]; } n = Math.sqrt(n); for (let i = 0; i < v.length; i++) v[i] /= n; return v; };
  const centers = Array.from({length: K}, (_, k) => center(k));
  const vecOf = c => { const rr = prng(5000 + c.n), v = new Float32Array(centers[c.cluster]); for (let i = 0; i < v.length; i++) v[i] += 0.0025 * (rr() - 0.5); return v; };
  const {rows} = N.construirFilas(convs.map(i => i.p), {mode: 'mensaje', tenant: TENANT_A, version: VERSION});
  const byPrep = new Map(convs.flatMap(i => i.p.revs.map(rv => [i.p.taskKey + '|' + rv.message_id, vecOf(i)]))); for (const rw of rows) rw.vec = byPrep.get(rw.taskKey + '|' + rw.prepId);
  const plan = planSql(rows, {threshold: 0.2, tenant: TENANT_A, version: VERSION, batchSize: 25, vectorType: 'text'});
  for (const s of [...plan.lotes, ...plan.versiones]) { r = psqlFile(sock, cerrar(s, true).join('\n')); if (r.status !== 0) throw Error('miembros ' + r.stderr.slice(0, 200)); }
  log(`conversaciones=${CONVS} problemas=${psql('select count(*) from public.problems').out} miembros=${psql('select count(*) from public.problem_embedding_members').out}`);
  // ---- pares sobre pedidos amazon sintéticos
  const idx = indexarMarketplaces(prep.items.map(x => ({sourceId: x.sourceId, entry: x.entry})), TENANT_A);
  const amazon = [...idx.pedidos.entries()].filter(([k]) => k.startsWith('amazon|')).slice(0, CONVS);
  const rowsT = amazon.map(([k, lineas], i) => ({hubspot_ticket_id: String(6000000000 + i + 1), marketplace: 'amazon', order_id: k.split('|')[1], sku: lineas[0].sku}));
  const par = construirPares({ticketRows: rowsT, pedidos: idx.pedidos, reembolsos: new Map()}).pares;
  log(`pares=${par.length} (ledger elegible amazon: ${amazon.length} pedidos)`);
  const db = crearBaseDatos({pool, tenantId: TENANT_A, userId: OWNER.A, statementTimeoutMs: 3600000});
  const A1 = alcance('marketplaces-usd');
  let [v, t1] = await ms(() => problemasValidos(db, A1)); log(`problemasValidos (sin vínculos): ${v.validos.length}/${v.totalVectoriales} en ${t1} ms  (${(t1 / Math.max(1, +psql('select count(*) from public.problem_embedding_members').out)).toFixed(1)} ms por miembro)`);
  // vínculos solo a los primeros LINKED problemas
  const top = v.validos.slice(0, LINKED);
  const REP = 'SYN bench: atestación sintética de prueba de escala.';
  const reportes = {A: REP + ' A', B: REP + ' B', C: REP + ' C'};
  for (const lote of Array.from({length: Math.ceil(par.length / 1500)}, (_, i) => par.slice(i * 1500, (i + 1) * 1500))) {
    const sql = insertarSql({tenant: TENANT_A, owner: OWNER.A, kind: 'order', pares: lote, validos: top, reportes}); const f = '/private/tmp/claude-501/bench-ins.sql'; fs.writeFileSync(f, sql.join('\n'));
    const rr = (await import('node:child_process')).spawnSync('psql', ['-h', sock, '-U', 'postgres', '-d', 't', '-X', '-q', '-1', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-f', f], {encoding: 'utf8'}); if (rr.status !== 0) throw Error(rr.stderr.slice(0, 300)); log(rr.stdout.trim());
  }
  log(`vínculos: ${psql('select count(*) from public.economic_problem_links').out}, problemas con vínculo: ${psql('select count(distinct problem_id) from public.economic_problem_links').out}`);

  let [m, t2] = await ms(() => medirExposicion(db, A1)); log(`readExposure con ${LINKED} problemas vinculados: ${t2} ms; global subtotal=${m.global.subtotal}, problemas con exposición=${m.problemas_con_exposicion}`);
  let [s, t3] = await ms(() => prepararSnapshot(db, A1)); const mani = +psql(`select pg_column_size(input_manifest) from public.metric_snapshots where id='${s.id}'`).out; log(`stage (borrador): ${t3} ms; manifiesto ${(mani / 1048576).toFixed(1)} MiB; modelos(runs)=${s.versions.models.length}; componentes=${s.components.length}`);
  let [p, t4] = await ms(() => publicarSnapshot(db, {snapshotId: s.id, contentHash: s.contentHash})); log(`publish: ${t4} ms`);
  for (const lim of [10000, 60000]) {
    const dbR = crearBaseDatos({pool, tenantId: TENANT_A, userId: OWNER.A, statementTimeoutMs: lim});
    const ws = createWorkspaceService({database: dbR}), q = k => new URLSearchParams({date_start: '2025-10-01', date_end: '2026-10-02', currency: 'USD', basis: A1.basis, exponent: '2', resource: k, snapshot_id: s.id});
    try {
      let [c1, t5] = await ms(() => ws.query(q('metrics'))); log(`[statement_timeout ${lim / 1000}s] workspace metrics (Resumen): ${t5} ms ok`);
      let [c2, t6] = await ms(() => ws.query(q('problems'), {all: true})); log(`[statement_timeout ${lim / 1000}s] workspace problems (Explorador): ${t6} ms ok, ${c2.items.length} filas`);
      const det = createDetailService({database: dbR}); const pid = c2.items.find(i => i.metrics[0].known_subtotal && i.metrics[0].known_subtotal !== '0')?.id;
      if (pid) { const pinned = new URLSearchParams({date_start: '2025-10-01', date_end: '2026-10-02', currency: 'USD', basis: A1.basis, exponent: '2', snapshot_id: s.id, scope_hash: c1.meta.scope_hash}); let [d, t7] = await ms(() => det.get({kind: 'problem', id: pid, query: pinned})); log(`[statement_timeout ${lim / 1000}s] detalle de problema: ${t7} ms ok`); }
    } catch (e) { log(`[statement_timeout ${lim / 1000}s] FALLA: ${String(e.message).slice(0, 120)}`); }
  }
  await pool.end();
}, {name: 'econ-bench', shared: '256MB'});
