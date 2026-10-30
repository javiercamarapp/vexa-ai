// Pruebas LOCALES del vinculo pedido-cliente (sin red, sin produccion, datos 100 % sinteticos):
//   node --test scripts/vinculos/test-vincular-pedido-cliente.mjs
// Las de Postgres usan initdb desechable (harness de packages/ai-scale/economia-problemas) con las migraciones REALES 0001..0054 y se destruyen al terminar.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {withPg, pgAvailable} from '../../packages/ai-scale/economia-problemas/harness.mjs';
import {montarMundo, TENANT_A, TENANT_B, OWNER, ANALYST_A, U} from '../../packages/ai-scale/economia-problemas/mundo.mjs';
import {leerPares, planSql, medirSql, loteSql, soloPermitidas, consolidar, textoReporte, MARCA, KEY_PREFIX, ROTULO} from './vincular-pedido-cliente.mjs';
import {TENANT, PROJECT_REF, sha256} from './importar-vinculos.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(HERE, 'vincular-pedido-cliente.mjs');
const ATEST = 'SYN prueba: el owner de prueba atesta haber revisado la regla y una muestra sintetica; contacto del ticket, no comprador.';
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'vpc-'));
const cli = (args, env = {}) => spawnSync('node', [SCRIPT, ...args], {encoding: 'utf8', env: {...process.env, ...env}, maxBuffer: 64 * 1024 * 1024});

test('el tenant pinneado es el del producto y el rotulo de toda coincidencia por ticket es Inferido', () => {
  assert.equal(TENANT, TENANT_A); assert.equal(PROJECT_REF, 'proyecto-ejemplo'); assert.equal(ROTULO, 'Inferido');
});

// ============================================================================================ puras
test('leerPares: solo pedidos, ticket numerico exacto, uuid valido, sin repetidos; no acepta nada difuso', () => {
  const j = o => JSON.stringify(o);
  const t = [j({ticket: '5000000001', kind: 'order', entityId: U(1)}), j({ticket: '5000000001', kind: 'order', entityId: U(1)}), j({ticket: '5000000002', kind: 'refund', entityId: U(2)}),
    j({ticket: 'abc', kind: 'order', entityId: U(3)}), j({ticket: '5000000004', kind: 'order', entityId: 'no-uuid'}), '{roto', '', j({ticket: ' 5000000005 ', kind: 'order', entityId: U(5).toUpperCase()})].join('\n');
  const r = leerPares(t);
  assert.deepEqual(r.pares, [{ticket: '5000000001', entityId: U(1)}, {ticket: '5000000005', entityId: U(5)}]);
  assert.deepEqual(r.descartados, {no_pedido: 1, ticket_invalido: 1, entity_invalido: 1, repetido: 1, json_invalido: 1});
});

test('SQL: planSql y medirSql son solo lectura, atados al tenant, sin escrituras; loteSql pasa la lista cerrada y rechaza intrusos', () => {
  const pares = [{ticket: '5000000001', entityId: U(1)}];
  for (const s of [planSql(pares), planSql(pares, {accion: 'revertir'}), medirSql(pares)]) {
    assert.ok(/^begin read only;/.test(s) && /rollback;\s*$/.test(s)); assert.ok(!/\b(insert|update|delete|truncate|drop|alter|create)\b/i.test(s.replace(/'(?:[^']|'')*'/g, "''")));
    assert.ok(soloPermitidas(s));
  }
  assert.throws(() => planSql(pares, {tenant: U(9)}), /TENANT_NO_AUTORIZADO/);
  assert.throws(() => planSql([]), /SIN_PARES/);
  const report = textoReporte({atestacion: ATEST, parSha: 'a'.repeat(64)});
  const it = {entityId: U(1), rowId: U(2), customerKey: KEY_PREFIX + 'SYN1', customerId: U(3), revId: U(4), expected: 0, identNueva: true};
  const sql = loteSql({owner: OWNER.A, items: [it], activo: true, etiqueta: 'importar-0001', report});
  assert.ok(soloPermitidas(sql)); assert.match(sql, /set local role vexa_backend/); assert.match(sql, /statement_timeout='60000ms'/);
  assert.equal((sql.match(/insert\s+into\s+public\.\w+/gi) ?? []).length, 2);
  assert.equal(soloPermitidas(sql + '\ndelete from public.economic_order_customers;\n'), false);
  assert.equal(soloPermitidas(sql.replace('begin;', "begin;\nupdate public.memberships set role='owner';")), false);
  assert.equal(soloPermitidas(sql.replace('economic_order_customers(', 'memberships(')), false);
  assert.throws(() => loteSql({owner: OWNER.A, items: [{...it, customerKey: 'otra:SYN1'}], activo: true, etiqueta: 'x', report}), /ITEM_INVALIDO/);
  assert.throws(() => loteSql({owner: OWNER.A, items: [it], activo: true, etiqueta: 'x', report: 'corto'}), /REPORT_FUERA/);
  assert.throws(() => loteSql({owner: OWNER.A, items: [it], activo: true, etiqueta: 'x', report: report + ' $lote$ rompe'}), /REPORT_CARACTER/);
  assert.throws(() => loteSql({owner: 'no-uuid', items: [it], activo: true, etiqueta: 'x', report}), /OWNER_INVALIDO/);
  assert.throws(() => loteSql({owner: OWNER.A, items: [{...it}], activo: false, etiqueta: 'x', report}), /ITEM_INVALIDO/); // la reversa no lleva key
  assert.match(report, /Inferido/); assert.ok(report.includes(MARCA));
});

test('consolidar: un pedido con varios tickets solo se liga si todos coinciden; conflictos y previos nunca se pisan', () => {
  const P = (e, c, estado, extra = {}) => ({ticket: 't', entityId: e, rowId: 'r' + e, customerId: c, revId: 'v' + c, customerKey: c && KEY_PREFIX + c, llaves: ['K1'], prevVersion: null, identVersion: null, estado, ...extra});
  const plan = [P('o1', 'c1', 'nuevo'), P('o1', 'c1', 'nuevo'),                       // mismo cliente en dos tickets: se liga una vez
    P('o2', 'c2', 'nuevo'), P('o2', 'c3', 'nuevo'),                                   // dos clientes distintos: conflicto
    P('o3', 'c4', 'nuevo'), P('o3', null, 'cliente_ambiguo'),                         // un ticket ambiguo contamina el pedido
    P('o4', 'c5', 'ya_vigente'), P('o5', 'c6', 'conflicto_con_vinculo_previo'), P('o6', null, 'ticket_sin_cliente'),
    P('o7', 'c7', 'nuevo'), P('o8', 'c7', 'nuevo')];                                  // misma identidad nueva en dos pedidos: se crea una vez
  const r = consolidar(plan);
  assert.deepEqual(r.estados, {nuevo: 3, conflicto_entre_tickets: 1, cliente_ambiguo: 1, ya_vigente: 1, conflicto_con_vinculo_previo: 1, ticket_sin_cliente: 1});
  assert.deepEqual(r.accionables.map(x => x.entityId), ['o1', 'o7', 'o8']);
  assert.deepEqual(r.accionables.filter(x => x.customerKey === KEY_PREFIX + 'c7').map(x => x.identNueva), [true, false]);
});

test('CLI sin transporte: solo valida la forma, lo dice, y --execute sin transporte se niega sin tocar nada', () => {
  const d = tmp(), f = path.join(d, 'p.jsonl');
  fs.writeFileSync(f, JSON.stringify({ticket: '5000000001', kind: 'order', entityId: U(1)}) + '\n');
  let c = cli(['--pares', f, '--recibos', d]); assert.equal(c.status, 0, c.stderr); assert.match(c.stdout, /SOLO FORMA DEL ARCHIVO/);
  c = cli(['--pares', f, '--recibos', d, '--execute']); assert.notEqual(c.status, 0); assert.match(c.stderr, /transporte/);
  c = cli(['--pares', f, '--recibos', d, '--tenant', U(5)]); assert.notEqual(c.status, 0); assert.match(c.stderr, /TENANT_NO_AUTORIZADO/);
  fs.rmSync(d, {recursive: true, force: true});
});

// ============================================================================================ Postgres local con migraciones reales
const C = n => U(880000 + n), REV = n => U(890000 + n), FACT = n => U(870000 + n);
const CONN_A = U(500001), CONN_B = U(500011);
const HASH = 'a'.repeat(64);
function sembrarClientesYHechos(psql) {
  const cli = (t, conn, n, ext) => `insert into public.customers(id,tenant_id,external_id,display_name,connection_id) values('${C(n)}','${t}','${ext}','SYN cliente ${n}','${conn}');
insert into public.source_revisions(id,tenant_id,connection_id,entity_type,external_id,source_revision,content_hash,fingerprint,mapping_version,snapshot,customer_id,canonical_id,provenance) values('${REV(n)}','${t}','${conn}','customer','${ext}','1','${HASH}','${HASH}','legacy','[]'::jsonb,'${C(n)}','${C(n)}','{}'::jsonb);
insert into public.source_heads(id,tenant_id,connection_id,entity_type,external_id,version,state,selected_revision_id) values('${C(n)}','${t}','${conn}','customer','${ext}',1,'unique','${REV(n)}');`;
  const fact = (t, conn, n, ticket, contact, estado = 'resolved') => `insert into public.native_customer_associations(id,tenant_id,source_connection_id,provider,portal_id,ticket_id,contact_id,first_evidence_hash,immutable_evidence,first_import_row_id,source_version_hash,resolution_state,reason) values('${FACT(n)}','${t}','${conn}','hubspot','1','${ticket}','${contact}','${HASH}','{}'::jsonb,'${U(860000 + n)}','${HASH}','${estado}','SYN');`;
  const sql = `set session_replication_role=replica;
${[1, 2, 3, 4, 8, 9, 10].map(n => cli(TENANT_A, CONN_A, n, 'SYN-C' + n)).join('\n')}
${cli(TENANT_B, CONN_B, 20, 'SYN-C4')}
${fact(TENANT_A, CONN_A, 1, '5000000001', 'SYN-C1')}
${fact(TENANT_A, CONN_A, 2, '5000000003', 'SYN-C2')}
${fact(TENANT_A, CONN_A, 3, '5000000004', 'SYN-C4')}
${fact(TENANT_A, CONN_A, 4, '5000000020', 'SYN-C9')}
${fact(TENANT_A, CONN_A, 5, '5000000021', 'SYN-C10')}
${fact(TENANT_A, CONN_A, 6, '5000000010', 'SYN-NOCARGADO')}
${fact(TENANT_A, CONN_A, 7, '5000000040', 'SYN-C3', 'blocked')}
${fact(TENANT_B, CONN_B, 8, '5000000004', 'SYN-C4')}
update public.conversations set customer_id='${C(1)}' where tenant_id='${TENANT_A}' and external_id='hubspot:5000000002';
update public.conversations set customer_id='${C(8)}' where tenant_id='${TENANT_A}' and external_id='hubspot:5000000003';
insert into public.conversation_customer_association_bindings(tenant_id,fact_id,conversation_id,customer_id,conversation_connection_id,customer_connection_id,conversation_revision_id,customer_revision_id,conversation_head_version,customer_head_version,fact_version,evidence_hash,method,decision_id,actor_id,provenance)
 select '${TENANT_A}','${FACT(1)}',id,'${C(1)}','${CONN_A}','${CONN_A}','${U(840001)}','${REV(1)}',1,1,1,'${HASH}','owner_decision','${U(840002)}','${OWNER.A}','{}'::jsonb from public.conversations where tenant_id='${TENANT_A}' and external_id='hubspot:5000000001';`;
  const r = psql(sql); if (!r.ok) throw Error('fixture: ' + r.err);
}

test('PG: dry-run no escribe; ocho clases de resultado; execute atestado idempotente; aislamiento de tenant; reversa', {skip: !pgAvailable() && 'sin postgres local', timeout: 900000}, async t => {
  const d = tmp();
  try {
    await withPg(async h => {
      const {psql, sock} = h;
      const w = montarMundo(h), ids = w.libro.ids;
      sembrarClientesYHechos(psql);
      const par = (ticket, entityId) => JSON.stringify({ticket, fecha: null, gorgias: null, fusionados: [], mk: 'amazon', via: 'columna', kind: 'order', tier: 'A', entityId});
      const F = path.join(d, 'pares.jsonl');
      fs.writeFileSync(F, [par('5000000001', ids.O1), par('5000000002', ids.O1), par('5000000003', ids.O2), par('5000000004', ids.O3a), par('5000000020', ids.O3b), par('5000000021', ids.O3b),
        par('5000000011', ids.O4), par('5000000010', ids.S1), par('5000000030', ids.R1).replace('"order"', '"order"'), par('5000000031', U(888)), par('5000000040', ids.O4)].join('\n') + '\n');
      const cnt = tbl => +psql(`select count(*) from public.${tbl}`).out;
      const digest = () => psql(`select md5(coalesce((select string_agg(id::text||version||coalesce(customer_key,''),'|' order by id) from public.economic_order_customers),'') || coalesce((select string_agg(id::text||version,'|' order by id) from public.workspace_customer_identity_versions),''))`).out;
      const recibos = path.join(d, 'recibos'), base = ['--pares', F, '--recibos', recibos, '--pg-socket', sock];
      const rdir = path.join(recibos, sha256(fs.readFileSync(F, 'utf8')).slice(0, 12));
      const before = digest();
      const atestF = path.join(d, 'atest.txt'); fs.writeFileSync(atestF, ATEST);
      const exe = ['--execute', '--confirmar-proyecto', PROJECT_REF, '--owner', OWNER.A, '--atestacion-archivo', atestF, '--atestacion-sha256', sha256(fs.readFileSync(atestF, 'utf8'))];

      await t.test('medir: solo conteos, no escribe', () => {
        const c = cli(['medir', ...base]); assert.equal(c.status, 0, c.stderr + c.stdout);
        const m = JSON.parse(fs.readFileSync(path.join(rdir, 'medida.json'), 'utf8')).medida;
        assert.equal(m.pares, 11); assert.equal(m.pedido_inexistente, 1);
        assert.equal(m.k1_hecho_nativo_ticket_contacto, 6);  // 5000000001,03,04,20,21,10 (el hecho 'blocked' del 40 no cuenta)
        assert.equal(m.k1_con_cliente_vigente, 5);           // el contacto no cargado (5000000010) no
        assert.equal(m.k2_vinculo_conversacion, 1); assert.equal(m.k3_conversacion_customer_id, 2);
        assert.equal(m.pares_con_un_cliente + m.pares_ambiguos_varios_clientes, m.pares_con_algun_cliente);
        assert.equal(m.pares_ambiguos_varios_clientes, 1);   // 5000000003: K1 C2 contra K3 C8
        assert.equal(digest(), before);
        assert.ok(!/SYN-C|5000000/.test(JSON.stringify(m)));
      });
      await t.test('execute sin dry-run previo se niega (y no escribe)', () => {
        const c = cli([...base, ...exe]); assert.notEqual(c.status, 0); assert.match(c.stderr, /dry-run previo/); assert.equal(cnt('economic_order_customers'), 0);
      });
      await t.test('dry-run: clasifica contra la base y NO escribe', () => {
        const c = cli(base); assert.equal(c.status, 0, c.stderr + c.stdout); assert.match(c.stdout, /DRY-RUN\. Nada se escribio/);
        const r = JSON.parse(fs.readFileSync(path.join(rdir, 'dry-run-importar.json'), 'utf8'));
        assert.deepEqual(r.plan_por_pedido, {nuevo: 2, cliente_ambiguo: 1, conflicto_entre_tickets: 1, ticket_sin_cliente: 1, contacto_sin_cliente_vigente: 1, tipo_no_permitido: 1, pedido_inexistente: 1});
        assert.equal(r.accionables, 2); assert.equal(digest(), before); assert.equal(cnt('economic_order_customers'), 0);
        assert.ok(!/SYN-C|5000000|@/.test(JSON.stringify(r)));
      });
      await t.test('guardas: sin atestacion / sha distinto / proyecto mal / owner no owner / SIN ATESTAR', () => {
        const sin = exe.filter((x, i) => !(x === '--atestacion-archivo' || exe[i - 1] === '--atestacion-archivo'));
        let c = cli([...base, ...sin]); assert.notEqual(c.status, 0); assert.match(c.stderr, /atestacion-archivo/);
        c = cli([...base, ...exe.map((x, i) => exe[i - 1] === '--atestacion-sha256' ? HASH : x)]); assert.notEqual(c.status, 0); assert.match(c.stderr, /atestacion-sha256 no coincide/);
        c = cli([...base, ...exe.map((x, i) => exe[i - 1] === '--confirmar-proyecto' ? 'otro' : x)]); assert.notEqual(c.status, 0); assert.match(c.stderr, /confirmar-proyecto/);
        c = cli([...base, ...exe.map((x, i) => exe[i - 1] === '--owner' ? ANALYST_A : x)]); assert.notEqual(c.status, 0); assert.match(c.stderr, /OWNER_NO_ACTIVO/);
        const sinAt = path.join(d, 'sinat.txt'), tx = 'SIN ATESTAR (dry-run): este texto no se ejecuta, relleno largo.'; fs.writeFileSync(sinAt, tx);
        c = cli([...base, ...exe.map((x, i) => exe[i - 1] === '--atestacion-archivo' ? sinAt : exe[i - 1] === '--atestacion-sha256' ? sha256(tx) : x)]); assert.notEqual(c.status, 0); assert.match(c.stderr, /SIN ATESTAR/);
        assert.equal(digest(), before);
      });
      await t.test('execute escribe 2 vinculos atestados + 2 identidades, version 1, actor owner, rotulo Inferido; solo las llaves esperadas', () => {
        const c = cli([...base, ...exe]); assert.equal(c.status, 0, c.stderr + c.stdout);
        assert.equal(cnt('economic_order_customers'), 2); assert.equal(cnt('workspace_customer_identity_versions'), 2);
        assert.equal(psql(`select count(*) from public.economic_order_customers where version=1 and attested and actor_id='${OWNER.A}' and report like '%${ATEST.slice(0, 30)}%' and report like '%${MARCA}%' and report like '%rotulo=Inferido%' and customer_key like '${KEY_PREFIX}%'`).out, '2');
        const por = e => psql(`select customer_key from public.economic_order_customers where entity_id='${e}'`).out;
        assert.equal(por(ids.O1), KEY_PREFIX + 'SYN-C1'); assert.equal(por(ids.O3a), KEY_PREFIX + 'SYN-C4'); // O3a NO toma al cliente C4 del tenant B
        for (const e of [ids.O2, ids.O3b, ids.O4, ids.S1, ids.R1]) assert.equal(por(e), '');
        assert.equal(psql(`select count(*) from public.workspace_customer_identity_versions i where i.version=1 and i.active and i.customer_id=case i.customer_key when '${KEY_PREFIX}SYN-C1' then '${C(1)}'::uuid else '${C(4)}'::uuid end and i.customer_revision_id=case i.customer_key when '${KEY_PREFIX}SYN-C1' then '${REV(1)}'::uuid else '${REV(4)}'::uuid end`).out, '2');
        assert.equal(fs.statSync(path.join(rdir, 'recibo-importar-final.json')).mode & 0o777, 0o600);
      });
      await t.test('idempotente: repetir el execute no escribe nada y el plan los marca ya_vigente', () => {
        const antes = digest();
        let c = cli(base); assert.equal(c.status, 0, c.stderr);
        const r = JSON.parse(fs.readFileSync(path.join(rdir, 'dry-run-importar.json'), 'utf8'));
        assert.equal(r.plan_por_pedido.ya_vigente, 2); assert.equal(r.plan_por_pedido.nuevo, undefined); assert.equal(r.accionables, 0);
        c = cli([...base, ...exe]); assert.equal(c.status, 0, c.stderr); assert.equal(digest(), antes);
      });
      await t.test('no pisa: si el cliente cambia, el vinculo previo se conserva y se reporta conflicto', () => {
        psql(`set session_replication_role=replica; update public.native_customer_associations set contact_id='SYN-C3' where tenant_id='${TENANT_A}' and ticket_id='5000000004'`);
        const antes = digest();
        const c = cli(base); assert.equal(c.status, 0, c.stderr);
        const r = JSON.parse(fs.readFileSync(path.join(rdir, 'dry-run-importar.json'), 'utf8'));
        assert.equal(r.plan_por_pedido.conflicto_con_vinculo_previo, 1); assert.equal(r.accionables, 0);
        assert.equal(digest(), antes);
        psql(`set session_replication_role=replica; update public.native_customer_associations set contact_id='SYN-C4' where tenant_id='${TENANT_A}' and ticket_id='5000000004'`);
      });
      await t.test('reversa: desactiva (version 2, key null) solo lo creado por el programa y no toca otras filas', () => {
        // un vinculo manual previo en otra entidad no debe revertirse
        const rev = ['--accion', 'revertir'];
        let c = cli([...base, ...rev]); assert.equal(c.status, 0, c.stderr);
        const dr = JSON.parse(fs.readFileSync(path.join(rdir, 'dry-run-revertir.json'), 'utf8')); assert.equal(dr.accionables, 2);
        c = cli([...base, ...rev, ...exe]); assert.equal(c.status, 0, c.stderr + c.stdout);
        assert.equal(psql(`select count(*) from public.economic_order_customers where version=2 and customer_key is null`).out, '2');
        assert.equal(cnt('economic_order_customers'), 4);
        c = cli([...base, ...rev]); assert.equal(c.status, 0, c.stderr);
        assert.equal(JSON.parse(fs.readFileSync(path.join(rdir, 'dry-run-revertir.json'), 'utf8')).accionables, 0);
        // y tras revertir, importar de nuevo reactiva con version 3 sin duplicar identidades
        c = cli(base); assert.equal(c.status, 0, c.stderr);
        const r = JSON.parse(fs.readFileSync(path.join(rdir, 'dry-run-importar.json'), 'utf8')); assert.equal(r.accionables, 2);
        c = cli([...base, ...exe]); assert.equal(c.status, 0, c.stderr + c.stdout);
        assert.equal(psql(`select count(*) from public.economic_order_customers where version=3 and customer_key is not null`).out, '2');
        assert.equal(cnt('workspace_customer_identity_versions'), 2);
      });
    });
  } finally { fs.rmSync(d, {recursive: true, force: true}); }
});
