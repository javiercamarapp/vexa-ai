// Migración 0055 (escala de las vistas económicas): equivalencia exacta de políticas RLS y de economic_snapshot_visible respecto a 0021/0018/0019/0023,
// resumen inmutable del manifiesto (no falsificable por la app), ida y vuelta (down) y compatibilidad sin la migración.
// Postgres local desechable en /private/tmp/claude-501 con las migraciones REALES; datos 100 % sintéticos.
//   node --test packages/metrics/tests/escala-migracion.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {withPg, pgAvailable} from './pg-harness.mjs';
import {construirMundo, TENANT_A, TENANT_B, OWNER, ANALYST_A, SECOND_OWNER_A, OWNER2, OUTSIDER, HERE} from './world.mjs';
import {createSnapshotRepository} from '../snapshots.mjs';

const MIG = path.join(HERE, '../../../supabase/migrations/0055_economic_scale.sql');
const DOWN = path.join(HERE, '0055_economic_scale.down.sql');
const downPath = () => fs.existsSync(DOWN) ? DOWN : null;
const sq = (v) => "'" + String(v).replace(/'/g, "''") + "'";

test('0055: políticas de lectura, economic_snapshot_visible y resumen inmutable == comportamiento previo; down restaura exactamente', { skip: !pgAvailable() && 'sin postgres local', timeout: 600000 }, async t => {
  await withPg(async h => {
    const {sock} = h;
    const ctx = await construirMundo(h, {complete: false});
    // toda sentencia de preparación debe tener éxito (si no, la prueba compararía filas inexistentes)
    const psql = sql => { const r = h.psql(sql); if (!r.ok) throw new Error('SQL de preparación falló: ' + r.err.slice(0, 300) + ' :: ' + sql.slice(0, 120)); return r; };
    const psqlFile = (file) => spawnSync('psql', ['-h', sock, '-U', 'postgres', '-d', 't', '-q', '-v', 'ON_ERROR_STOP=1', '-f', file], {encoding: 'utf8'});
    const asUser = (user, tenant, sql, action = 'read') => {
      const script = `begin read only; set local role vexa_backend; select set_config('request.jwt.claim.sub',${sq(user)},true),set_config('vexa.tenant_id',${tenant ? sq(tenant) : "''"},true),set_config('vexa.action',${sq(action)},true) \\gset\n${sql};\nrollback;`;
      const r = spawnSync('psql', ['-h', sock, '-U', 'postgres', '-d', 't', '-X', '-At', '-v', 'ON_ERROR_STOP=1'], {input: script, encoding: 'utf8'});
      if (r.status !== 0) throw new Error(r.stderr.slice(0, 300));
      return r.stdout.split('\n').filter(l => l && !/^(SET|BEGIN|ROLLBACK)$/.test(l)).pop();
    };
    const users = [[OWNER.A, TENANT_A], [ANALYST_A, TENANT_A], [SECOND_OWNER_A, TENANT_A], [OWNER2, TENANT_A], [OUTSIDER, TENANT_A], [OWNER.B, TENANT_A], [OWNER.B, TENANT_B], [OWNER.A, TENANT_B], [OWNER.A, null]];
    const POLICY_TABLES = ['economic_ledger_entries', 'economic_problem_links', 'economic_order_aliases', 'economic_order_customers', 'workspace_order_dimension_versions'];

    // filas extra en las tablas que el mundo no llena (superusuario, sin disparadores: solo para probar la política de lectura)
    const ledgerRow = e => psql(`select id from public.economic_ledger_entries where entity_id='${e}' limit 1`).out;
    psql('alter table public.economic_order_aliases disable trigger user');
    psql(`insert into public.economic_order_aliases(tenant_id,alias_entity_id,canonical_entity_id,alias_row_id,canonical_row_id,version,active,actor_id,report,attested) values('${TENANT_A}','${ctx.ids.O3b}','${ctx.ids.O3a}','${ledgerRow(ctx.ids.O3b)}','${ledgerRow(ctx.ids.O3a)}',1,false,'${OWNER.A}','${'x'.repeat(30)}',true)`);
    psql('alter table public.economic_order_aliases enable trigger user');
    psql('alter table public.economic_order_customers disable trigger user');
    psql(`insert into public.economic_order_customers(tenant_id,entity_id,order_row_id,customer_key,version,actor_id,report,attested) values('${TENANT_A}','${ctx.ids.O1}','${ledgerRow(ctx.ids.O1)}','SYN-cliente-1',1,'${OWNER.A}','${'x'.repeat(30)}',true)`);
    psql('alter table public.economic_order_customers enable trigger user');
    psql('alter table public.workspace_order_dimension_versions disable trigger user');
    psql(`insert into public.workspace_order_dimension_versions(tenant_id,ledger_row_id,version,actor_id,skus,source,active,report,attested) values('${TENANT_A}','${ledgerRow(ctx.ids.O1)}',1,'${OWNER.A}','{SKU-A}','csv',true,'${'x'.repeat(30)}',true)`);
    psql('alter table public.workspace_order_dimension_versions enable trigger user');

    const matrixPolicies = () => Object.fromEntries(users.flatMap(([u, tn]) => POLICY_TABLES.map(tab => [`${tab}|${u}|${tn}`, asUser(u, tn, `select count(*) from public.${tab}`)])));
    const policyText = () => psql(`select string_agg(tablename||'.'||policyname||' '||coalesce(qual,''),E'\\n' order by tablename,policyname) from pg_policies where tablename in (${POLICY_TABLES.map(sq).join(',')}) and cmd='SELECT'`).out;
    const functionDef = () => psql(`select prosrc from pg_proc where proname='economic_snapshot_visible'`).out;

    await t.test('línea base (antes de 0055): matriz de visibilidad de las 5 tablas y texto de políticas/función', () => {
      h.before = {matrix: matrixPolicies(), text: policyText(), fn: functionDef(), cols: psql(`select string_agg(column_name,',' order by ordinal_position) from information_schema.columns where table_name='metric_snapshots'`).out};
      assert.equal(h.before.matrix[`economic_ledger_entries|${OWNER.A}|${TENANT_A}`], '9');    // asientos del mundo sintético: 5 pedidos + 2 devoluciones + 1 pedido y 1 reembolso Shopify
      assert.equal(h.before.matrix[`economic_ledger_entries|${OUTSIDER}|${TENANT_A}`], '0');
      assert.equal(h.before.matrix[`economic_ledger_entries|${OWNER.B}|${TENANT_A}`], '0');
      assert.equal(h.before.matrix[`economic_order_aliases|${OWNER.A}|${TENANT_A}`], '1');
    });

    // snapshots reales ANTES de la migración (sin resumen): sirven para probar el camino de compatibilidad
    let pre;
    await t.test('snapshot creado con el código nuevo SIN la migración funciona (camino de compatibilidad) y queda sin resumen', async () => {
      const repo = createSnapshotRepository({database: ctx.db(OWNER.A, TENANT_A, 120000)});
      pre = await repo.stage({scope: ctx.A1});
      assert.equal(pre.components.find(c => c.metric === 'exposure.global' && c.currency === 'USD' && !c.conversion).knownSubtotalMinor, '40000');
      const again = await repo.get({snapshotId: pre.id});
      assert.equal(again.contentHash, pre.contentHash);
    });

    const legacyDef = psql(`select pg_get_functiondef('public.economic_snapshot_visible(uuid,uuid)'::regprocedure)`).out;
    await t.test('aplica 0055', () => {
      const r = psqlFile(MIG); assert.equal(r.status, 0, r.stderr);
      // oráculo: la función ANTERIOR, con otro nombre
      const legacy = legacyDef.replace('public.economic_snapshot_visible', 'public.legacy_snapshot_visible');
      psql(legacy.replace(/\$function\$/g, '$legacy$')); psql('grant execute on function public.legacy_snapshot_visible(uuid,uuid) to vexa_backend,authenticated');
      assert.equal(psql(`select count(*) from pg_proc where proname='legacy_snapshot_visible'`).out, '1');
    });

    await t.test('lecturas del libro y relaciones: MISMA matriz de filas visibles por usuario y tenant que con la política por fila', () => {
      assert.deepEqual(matrixPolicies(), h.before.matrix);
      // la comprobación de membresía sigue exigida: un miembro revocado no ve nada
      psql(`update public.memberships set status='revoked' where tenant_id='${TENANT_A}' and user_id='${OWNER2}'`);
      assert.equal(asUser(OWNER2, TENANT_A, 'select count(*) from public.economic_ledger_entries'), '0');
      psql(`update public.memberships set status='active' where tenant_id='${TENANT_A}' and user_id='${OWNER2}'`);
      assert.equal(asUser(OWNER2, TENANT_A, 'select count(*) from public.economic_ledger_entries'), '9');
      // y un GUC de otro tenant no abre filas ajenas aunque el usuario sea miembro de ambos
      psql(`insert into public.memberships(tenant_id,user_id,role,status,permissions_version) values('${TENANT_B}','${OWNER.A}','owner','active',1)`);
      assert.equal(asUser(OWNER.A, TENANT_B, 'select count(*) from public.economic_ledger_entries'), '0');
      psql(`delete from public.memberships where tenant_id='${TENANT_B}' and user_id='${OWNER.A}'`);
    });

    // ----- matriz de snapshots adversariales: la función nueva == la anterior en TODAS las combinaciones
    const SID = n => `99999999-0000-4000-8000-${String(n).padStart(12, '0')}`;
    const clone = (n, {manifest, status, createdBy, publishedBy, schema = 'economic-snapshot-v1', nullSummary = false}) => {
      psql('alter table public.metric_snapshots disable trigger economic_snapshot_guard');
      psql(`insert into public.metric_snapshots(id,tenant_id,scope_hash,input_hash,policy_version,watermark,status,date_start,date_end,timezone,currency,date_basis,economic_schema_version,as_of,content_hash,input_manifest,component_count,created_by,published_by,published_at,bundle_ref,provenance)
        select '${SID(n)}',tenant_id,scope_hash,encode(sha256(convert_to('${SID(n)}','UTF8')),'hex'),policy_version,watermark,${sq(status ?? 'published')},date_start,date_end,timezone,currency,date_basis,${schema === null ? 'null' : sq(schema)},as_of,content_hash,${manifest ? `(${manifest})` : 'input_manifest'},component_count,${sq(createdBy ?? OWNER.A)},${(publishedBy ?? OWNER.A) === 'null' ? 'null' : sq(publishedBy ?? OWNER.A)},now(),${(status ?? 'published') === 'published' ? "'canonical:'||content_hash" : 'null'},provenance from public.metric_snapshots where id='${pre.id}'`);
      if (nullSummary) { psql('alter table public.metric_snapshots disable trigger user'); psql(`update public.metric_snapshots set refs_actor_ids=null,refs_source_ids=null,refs_currency_ids=null,refs_fx_ids=null,refs_ledger_ids=null,refs_ledger_live_ids=null,refs_small=null where id='${SID(n)}'`); psql('alter table public.metric_snapshots enable trigger user'); }
      psql('alter table public.metric_snapshots enable trigger economic_snapshot_guard');
    };
    const baseRefs = `input_manifest->'refs'`;
    const withRefs = (expr) => `select jsonb_set(input_manifest,'{refs}',${expr}) from public.metric_snapshots where id='${pre.id}'`;
    const sourceOf = () => psql(`select source_id from public.economic_source_versions where tenant_id='${TENANT_A}' order by source_id limit 1`).out;
    const ghost = '12121212-1212-4121-8121-121212121212';
    const scenarios = [
      ['base publicado', {}],
      ['base borrador', {status: 'draft'}],
      ['legado sin esquema económico', {schema: null}],
      ['creador revocado', {createdBy: OWNER2, after: `update public.memberships set status='revoked' where user_id='${OWNER2}'`, undo: `update public.memberships set status='active' where user_id='${OWNER2}'`}],
      ['publicado por un viewer (no owner)', {publishedBy: SECOND_OWNER_A}],
      ['sin publicador (borrador)', {status: 'draft', publishedBy: 'null'}],
      ['actor autorizado revocado entre las referencias', {manifest: withRefs(`(${baseRefs}) || jsonb_build_array(jsonb_build_object('table','economic_ledger_entries','id','${ghost}','actorId','${OWNER2}','authorized',true,'active',true,'sourceId',null,'version',1,'rowHash','x'))`), after: `update public.memberships set status='revoked' where user_id='${OWNER2}'`, undo: `update public.memberships set status='active' where user_id='${OWNER2}'`}],
      ['actor revocado pero la referencia NO estaba autorizada (se ignora)', {manifest: withRefs(`(${baseRefs}) || jsonb_build_array(jsonb_build_object('table','economic_ledger_entries','id','${ghost}','actorId','${OWNER2}','authorized',false,'active',true,'sourceId','${sourceOf()}','version',1,'rowHash','x'))`), after: `update public.memberships set status='revoked' where user_id='${OWNER2}'`, undo: `update public.memberships set status='active' where user_id='${OWNER2}'`}],
      ['actor autorizado SIN actorId (null)', {manifest: withRefs(`(${baseRefs}) || jsonb_build_array(jsonb_build_object('table','economic_ledger_entries','id','${ghost}','actorId',null,'authorized',true,'active',true,'sourceId',null,'version',1,'rowHash','x'))`)}],
      ['actor autorizado pero analista (no owner)', {manifest: withRefs(`(${baseRefs}) || jsonb_build_array(jsonb_build_object('table','economic_ledger_entries','id','${ghost}','actorId','${ANALYST_A}','authorized',true,'active',true,'sourceId',null,'version',1,'rowHash','x'))`)}],
      ['fuente de una referencia inexistente', {manifest: withRefs(`(${baseRefs}) || jsonb_build_array(jsonb_build_object('table','economic_ledger_entries','id','${ghost}','actorId','${OWNER.A}','authorized',true,'active',true,'sourceId','${ghost}','version',1,'rowHash','x'))`)}],
      ['fuente inexistente pero referencia inactiva (se ignora)', {manifest: withRefs(`(${baseRefs}) || jsonb_build_array(jsonb_build_object('table','economic_ledger_entries','id','${ghost}','actorId','${OWNER.A}','authorized',true,'active',false,'sourceId','${ghost}','version',1,'rowHash','x'))`)}],
      ['fuente retirada (última versión inactiva)', {after: `select set_config('vexa.tenant_id','${TENANT_A}',false),set_config('vexa.action','configure',false),set_config('request.jwt.claim.sub','${OWNER.A}',false);insert into public.economic_source_versions(tenant_id,source_id,version,actor_id,name,evidence_type,active,complete,window_start,window_end,watermark,report,report_hash,attested) select tenant_id,source_id,version+1,actor_id,name,evidence_type,false,complete,window_start,window_end,watermark,report,report_hash,true from public.economic_source_versions where source_id='${sourceOf()}' order by version desc limit 1`, noUndo: true}],
    ];
    await t.test('economic_snapshot_visible nueva == anterior en la matriz de escenarios x usuarios x tenants, con y sin resumen', async () => {
      const readers = [[OWNER.A, TENANT_A], [ANALYST_A, TENANT_A], [SECOND_OWNER_A, TENANT_A], [OWNER2, TENANT_A], [OUTSIDER, TENANT_A], [OWNER.B, TENANT_B], [OWNER.A, TENANT_B]];
      let compared = 0, trues = 0, falses = 0, n = 100;
      const check = (label, id) => { for (const [u, tn] of readers) { const a = asUser(u, tn, `select public.economic_snapshot_visible(${sq(TENANT_A)},${sq(id)})`), b = asUser(u, tn, `select public.legacy_snapshot_visible(${sq(TENANT_A)},${sq(id)})`); assert.equal(a, b, `${label} lector=${u} tenant=${tn}`); compared++; if (a === 't') trues++; else falses++; } };
      // el snapshot real creado antes de la migración (resumen NULL => la función calcula desde el manifiesto)
      assert.equal(psql(`select refs_actor_ids is null from public.metric_snapshots where id='${pre.id}'`).out, 't');
      check('real sin resumen', pre.id);
      for (const [label, sc] of scenarios) {
        for (const nullSummary of [false, true]) {
          const id = SID(++n);
          if (sc.after && nullSummary === false) psql(sc.after);
          clone(n, {...sc, nullSummary});
          check(label + (nullSummary ? ' [sin resumen]' : ' [con resumen]'), SID(n));
          if (sc.undo) psql(sc.undo);
        }
        if (sc.after && !sc.noUndo) { /* mutación ya revertida por undo */ }
      }
      assert.ok(compared > 150 && trues > 20 && falses > 40, `cobertura de la matriz: ${compared} comparaciones, ${trues} visibles, ${falses} ocultas`);
    });

    await t.test('el resumen del manifiesto lo fija la base, no la aplicación: un INSERT con resumen falsificado se recalcula y un UPDATE no lo cambia', () => {
      const id = SID(900);
      psql('alter table public.metric_snapshots disable trigger economic_snapshot_guard');
      psql(`insert into public.metric_snapshots(id,tenant_id,scope_hash,input_hash,policy_version,watermark,status,date_start,date_end,timezone,currency,date_basis,economic_schema_version,as_of,content_hash,input_manifest,component_count,created_by,provenance,refs_actor_ids,refs_source_ids,refs_ledger_ids,refs_ledger_live_ids,refs_small)
        select '${id}',tenant_id,scope_hash,encode(sha256(convert_to('${id}','UTF8')),'hex'),policy_version,watermark,'draft',date_start,date_end,timezone,currency,date_basis,economic_schema_version,as_of,content_hash,input_manifest,component_count,created_by,provenance,'{}','{}','{}','{}','[]'::jsonb from public.metric_snapshots where id='${pre.id}'`);
      psql('alter table public.metric_snapshots enable trigger economic_snapshot_guard');
      const real = psql(`select cardinality(refs_actor_ids)||'/'||cardinality(refs_ledger_ids)||'/'||jsonb_array_length(refs_small) from public.metric_snapshots where id='${id}'`).out;
      assert.notEqual(real, '0/0/0'); assert.match(real, /^[1-9]\d*\/[1-9]\d*\/[1-9]\d*$/);
      assert.equal(psql(`select refs_ledger_ids is not distinct from (select array_agg((r->>'id')::uuid) from public.metric_snapshots m,jsonb_array_elements(m.input_manifest->'refs') r where m.id='${id}' and r->>'table'='economic_ledger_entries') from public.metric_snapshots where id='${id}'`).out, 't');
      psql('alter table public.metric_snapshots disable trigger economic_snapshot_guard');
      psql(`update public.metric_snapshots set refs_actor_ids='{}',refs_ledger_ids='{}',refs_small='[]' where id='${id}'`);
      psql('alter table public.metric_snapshots enable trigger economic_snapshot_guard');
      assert.equal(psql(`select cardinality(refs_actor_ids)||'/'||cardinality(refs_ledger_ids)||'/'||jsonb_array_length(refs_small) from public.metric_snapshots where id='${id}'`).out, real, 'UPDATE no puede alterar el resumen');
    });

    await t.test('CHECK del resumen: con TODOS los disparadores deshabilitados un resumen alterado (o un manifiesto cambiado bajo el resumen) se rechaza; filas sin resumen no se ven afectadas', () => {
      const id = SID(900), old = SID(105);
      psql('alter table public.metric_snapshots disable trigger user');
      try {
        for (const set of ["refs_actor_ids='{}'", "refs_ledger_ids='{}'", "refs_ledger_live_ids='{}'", "refs_small='[]'", "refs_source_ids='{}'", "refs_currency_ids=array['12121212-1212-4121-8121-121212121212']::uuid[]", "input_manifest=jsonb_set(input_manifest,'{refs,0,id}','\"12121212-1212-4121-8121-121212121212\"')"]) {
          const r = h.psql(`update public.metric_snapshots set ${set} where id='${id}'`); assert.equal(r.ok, false, set); assert.match(r.err, /economic_snapshot_summary_matches/, set);
        }
        for (const set of ["refs_actor_ids='{}',refs_small=NULL", "refs_small=NULL", "refs_source_ids='{}',refs_small=NULL,refs_actor_ids=NULL,refs_currency_ids=NULL,refs_fx_ids=NULL,refs_ledger_ids=NULL"]) {
          const r = h.psql(`update public.metric_snapshots set ${set} where id='${id}'`); assert.equal(r.ok, false, 'evasión: ' + set); assert.match(r.err, /economic_snapshot_summary_matches/, set);
        }
        assert.equal(h.psql(`update public.metric_snapshots set component_count=component_count where id='${id}'`).ok, true, 'sin cambios en el resumen: permitido');
        const nullRow = psql(`select id from public.metric_snapshots where refs_small is null and economic_schema_version is not null limit 1`).out;
        assert.ok(nullRow, 'hay filas económicas sin resumen (previas a 0055 / simuladas)');
        assert.equal(h.psql(`update public.metric_snapshots set component_count=component_count where id='${nullRow}'`).ok, true, 'filas sin resumen: el CHECK no las toca');
      } finally { h.psql('alter table public.metric_snapshots enable trigger user'); }
      void old;
    });

    await t.test('0055 es repetible solo una vez; down restaura EXACTAMENTE políticas, función y columnas; up de nuevo funciona', () => {
      let r = psqlFile(MIG); assert.notEqual(r.status, 0, 'segunda aplicación debe fallar (no es idempotente por diseño)');
      const down = downPath(); assert.ok(down, '0055 down no encontrado');
      psql('alter table public.metric_snapshots disable trigger user'); psql(`delete from public.metric_snapshots where id::text like '99999999-0000-4000-8000-%'`); psql('alter table public.metric_snapshots enable trigger user');
      psql('drop function public.legacy_snapshot_visible(uuid,uuid)');
      r = psqlFile(down); assert.equal(r.status, 0, r.stderr);
      assert.equal(policyText(), h.before.text, 'políticas idénticas a las originales');
      assert.equal(functionDef(), h.before.fn, 'economic_snapshot_visible idéntica a la de 0021');
      assert.equal(psql(`select string_agg(column_name,',' order by ordinal_position) from information_schema.columns where table_name='metric_snapshots'`).out, h.before.cols);
      assert.equal(psql(`select count(*) from pg_trigger where tgname='economic_snapshot_summary'`).out, '0');
      assert.deepEqual(matrixPolicies(), h.before.matrix);
      r = psqlFile(MIG); assert.equal(r.status, 0, r.stderr);
      assert.deepEqual(matrixPolicies(), h.before.matrix);
    });
    await ctx.pool.end();
  }, {name: 'mig55', upto: 54});
});
