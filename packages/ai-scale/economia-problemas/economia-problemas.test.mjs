// Pruebas locales (sin red, sin llaves, sin producción; datos 100 % sintéticos): node --test packages/ai-scale/economia-problemas/economia-problemas.test.mjs
// Las de Postgres usan initdb desechable en /private/tmp/claude-501 con las migraciones REALES 0001..0054 y se destruyen al terminar.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import pg from 'pg';
import {withPg, pgAvailable} from './harness.mjs';
import {montarMundo, puenteSintetico, TENANT_A, TENANT_B, OWNER, ANALYST_A, SECOND_OWNER_A, U, psqlFile} from './mundo.mjs';
import {marketplaceDe, pedidoClave, skuUtil, elegirLinea, construirPares, parseFusionados, textoReporte, CLASE} from './reglas.mjs';
import {indexarMarketplaces, indexarShopify, resumir} from './puente.mjs';
import {insertarSql, pruebaReversaSql, medirSql, soloPermitidas, verificacionSql, DIAG, cteNuevo} from './sqlgen.mjs';
import {crearBaseDatos, problemasValidos, alcance, medirExposicion, prepararSnapshot, publicarSnapshot, atestarCobertura, conReversa, conexion, scrub} from './snapshot.mjs';
import {seleccionar, trozos, parseTop} from './vinculos.mjs';
import {createWorkspaceService} from '../../workspace-service/index.mjs';
import {createDetailService} from '../../workspace-service/detail.mjs';
import {createSnapshotRepository} from '../../metrics/snapshots.mjs';
import {createExposureRepository, readExposure} from '../../metrics/exposure.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'econprob-'));
const ATESTACION = 'SYN prueba: el owner de prueba atesta haber revisado la regla determinista y una muestra sintética de pares.';

// ================================================================== puras: reglas
test('marketplace: solo texto explícito (columna o retailer); columnas contradictorias, Lowe\'s y vacío sin retailer NO se ligan', () => {
  assert.deepEqual(marketplaceDe({marketplace: 'amazon', retailer: ''}), {mk: 'amazon', via: 'columna'});
  assert.deepEqual(marketplaceDe({marketplace: '', retailer: 'Walmart :: fulfilled by CLIENTEX'}), {mk: 'walmart', via: 'retailer'});
  assert.deepEqual(marketplaceDe({marketplace: 'bestbuy', retailer: 'Best Buy :: CAN'}), {mk: 'mirakl_bestbuy_ca', via: 'retailer'});
  assert.equal(marketplaceDe({marketplace: 'bestbuy', retailer: 'Walmart :: x'}), null);       // Best Buy sin país explícito
  assert.equal(marketplaceDe({marketplace: 'amazon', retailer: 'Walmart :: fulfilled by CLIENTEX'}), null); // contradicción
  assert.equal(marketplaceDe({marketplace: 'lowes', retailer: 'Lowes'}), null);
  assert.equal(marketplaceDe({marketplace: '', retailer: 'Other'}), null);
  assert.deepEqual(marketplaceDe({marketplace: '', retailer: 'Clientextools.com :: Shopify'}), {mk: 'shopify', via: 'retailer'});
  assert.deepEqual(marketplaceDe({marketplace: '', retailer: 'Clientextools.com Shopify'}), {mk: 'shopify', via: 'retailer'});
  // la forma del order_id NUNCA decide el marketplace
  assert.equal(marketplaceDe({marketplace: '', retailer: '', order_id: '111-1234567-1234567'}), null);
});
test('SKU y pedido: «Pending»/NA/vacío no son SKU; Shopify quita «#»; fusionados solo dígitos', () => {
  for (const x of ['', ' ', 'Pending', 'pending', 'NA', 'N/A', 'Other', '-']) assert.equal(skuUtil(x), null, x);
  assert.equal(skuUtil(' SKU-1 '), 'SKU-1');
  assert.equal(pedidoClave('shopify', '#19001'), '19001'); assert.equal(pedidoClave('amazon', ' 111-1 '), '111-1'); assert.equal(pedidoClave('amazon', ''), null);
  assert.deepEqual(parseFusionados('123456; 7654321,abc 123456'), ['123456', '7654321']);
});
test('elegirLinea: A exacta, B línea única sin SKU utilizable, C solo con opción; multilínea sin coincidencia y SKU repetido NO ligan', () => {
  const L1 = [{sku: 'X', entityId: 'e1'}], L2 = [{sku: 'X', entityId: 'e1'}, {sku: 'Y', entityId: 'e2'}], Ld = [{sku: 'X', entityId: 'e1'}, {sku: 'X', entityId: 'e3'}];
  assert.equal(elegirLinea('X', L2).tier, 'A'); assert.equal(elegirLinea('X', L2).linea.entityId, 'e1');
  assert.equal(elegirLinea('Pending', L1).tier, 'B'); assert.equal(elegirLinea('', L1).tier, 'B');
  assert.equal(elegirLinea('Pending', L2).tier, null); assert.equal(elegirLinea('Pending', L2).motivo, 'sin_sku_multilinea');
  assert.equal(elegirLinea('Z', L1).tier, null); assert.equal(elegirLinea('Z', L1).motivo, 'sku_distinto_linea_unica');
  assert.equal(elegirLinea('Z', L1, {aceptarSkuDistinto: true}).tier, 'C');
  assert.equal(elegirLinea('Z', L2, {aceptarSkuDistinto: true}).tier, null);                  // C nunca en multilínea
  assert.equal(elegirLinea('X', Ld).motivo, 'sku_repetido_en_pedido');
  assert.equal(elegirLinea('X', []).motivo, 'sin_linea_elegible'); assert.equal(elegirLinea('X', undefined).tier, null);
  assert.equal(elegirLinea('S1', [{sku: null, skus: ['S1', 'S2'], entityId: 'sh'}]).tier, 'A'); // Shopify: SKUs del pedido
});
test('construirPares sobre el puente sintético: pares y motivos esperados, deduplicación y sin identificadores en el resumen', () => {
  // índice mínimo a mano
  const pedidos = new Map([['amazon|P1', [{sku: 'A', entityId: 'o1'}]], ['amazon|P2', [{sku: 'B', entityId: 'o2'}, {sku: 'C', entityId: 'o3'}]]]);
  const reembolsos = new Map([['walmart|W1', [{sku: 'W', entityId: 'r1'}]]]);
  const rows = [
    {hubspot_ticket_id: '1111111', marketplace: 'amazon', order_id: 'P1', sku: 'A'},
    {hubspot_ticket_id: '1111111', marketplace: 'amazon', order_id: 'P1', sku: 'A'},          // fila repetida: un solo par
    {hubspot_ticket_id: '2222222', marketplace: 'amazon', order_id: 'P2', sku: 'Pending'},     // multilínea sin SKU: no
    {hubspot_ticket_id: '3333333', marketplace: 'walmart', order_id: 'W1', sku: 'W'},
    {hubspot_ticket_id: 'xx', marketplace: 'amazon', order_id: 'P1', sku: 'A'},                // ticket inválido
    {hubspot_ticket_id: '4444444', marketplace: 'lowes', order_id: 'P1', sku: 'A'},            // sin marketplace del libro
    {hubspot_ticket_id: '5555555', marketplace: 'amazon', order_id: '', sku: 'A'},             // sin pedido
  ];
  const r = construirPares({ticketRows: rows, pedidos, reembolsos});
  assert.deepEqual(r.pares.map(p => [p.ticket, p.kind, p.tier, p.entityId]), [['1111111', 'order', 'A', 'o1'], ['3333333', 'refund', 'A', 'r1']]);
  assert.equal(r.pares[0].fecha, null);
  assert.equal(r.stats.sin_marketplace, 1); assert.equal(r.stats.sin_pedido_id, 1);
  assert.equal(r.stats.motivos['order:sin_sku_multilinea'], 1); assert.equal(r.stats.motivos['order:par_repetido'], 1);
  const res = resumir(r.pares); assert.doesNotMatch(JSON.stringify(res), /1111111|3333333|o1|r1/); assert.equal(res.pares, 2);
});
test('indexarMarketplaces/Shopify: solo líneas elegibles (recorded, base limpia, importe y moneda conocidos); el pedido de la devolución sale del report', async () => {
  const {libroSintetico} = await import('./mundo.mjs');
  const libro = libroSintetico();
  const mp = indexarMarketplaces(libro.items, TENANT_A);
  assert.equal(mp.stats.pedidos_elegibles, 4); assert.equal(mp.stats.pedidos_no_elegibles, 1);   // O4 cancelado
  assert.deepEqual(mp.pedidos.get('amazon|SYN-111-0000003').map(l => l.sku).sort(), ['SKU-C1', 'SKU-C2']);
  assert.equal(mp.reembolsos.get('walmart|SYN-W-1')[0].sku, 'SKU-W');
  assert.equal(mp.pedidos.get('amazon|SYN-111-0000001')[0].entityId, libro.ids.O1);
  assert.equal(mp.reembolsos.get('walmart|SYN-W-1')[0].entityId, libro.ids.R1);
  const sh = indexarShopify({...libro.shopify, tenantId: TENANT_A});
  assert.equal(sh.pedidos.get('shopify|19001')[0].entityId, libro.ids.S1); assert.deepEqual(sh.pedidos.get('shopify|19001')[0].skus, ['SKU-S']);
  // dato dañado: reembolso con texto inesperado => no elegible (nunca se adivina)
  const roto = structuredClone(libro.items.find(i => i.entry.kind === 'refund')); roto.entry.report = 'texto libre';
  assert.equal(indexarMarketplaces([roto], TENANT_A).stats.reembolsos_no_elegibles, 1);
});
test('texto del reporte: incluye la atestación del owner y la regla; fuera de 20..4000 caracteres falla', () => {
  const t = textoReporte({atestacion: ATESTACION, kind: 'order', tiers: ['A'], fuenteSha: 'a'.repeat(64)});
  assert.match(t, /SYN prueba/); assert.match(t, /econ-problemas-r1/); assert.ok(t.includes(CLASE.A)); assert.ok(t.length < 4000);
  assert.throws(() => textoReporte({atestacion: 'x'.repeat(4100), kind: 'order', tiers: ['A'], fuenteSha: 'a'.repeat(64)}), /REPORTE_FUERA_DE_RANGO/);
});

// ================================================================== puras: SQL
const par = (o = {}) => ({ticket: '5000000001', gorgias: null, fusionados: [], entityId: U(77), tier: 'A', ...o});
const REPS = {A: 'reporte A suficiente largo 1234567890', B: 'reporte B suficiente largo 1234567890', C: 'reporte C suficiente largo 1234567890'};
test('SQL: lista cerrada (solo INSERT en economic_problem_links), tenant/owner validados y SQL inyectado en valores queda como literal', () => {
  const sql = insertarSql({tenant: TENANT_A, owner: OWNER.A, kind: 'order', pares: [par(), par({ticket: "5'; drop table x;--", entityId: U(78)})], validos: [U(1)], reportes: REPS});
  assert.ok(soloPermitidas(sql)); assert.ok(soloPermitidas(pruebaReversaSql({tenant: TENANT_A, owner: OWNER.A, kind: 'order', pares: [par()], reportes: REPS})));
  assert.match(sql[2], /insert into public\.economic_problem_links/); assert.match(sql[2], /where not exists\(select 1 from public\.economic_problem_links/);
  assert.doesNotMatch(sql.join('\n').replace(/'(?:[^']|'')*'/g, "''"), /\b(update|delete|drop|alter|truncate)\b/i);
  assert.ok(sql.join('\n').includes("'5''; drop table x;--'"));
  for (const bad of ["update public.economic_problem_links set active=false;", 'delete from public.economic_problem_links;', "insert into public.problems(id) values(1);", 'drop table public.problems;', "with par(x) as (select 1) insert into public.problems(id) select 1;"])
    assert.ok(!soloPermitidas([bad]), bad);
  assert.throws(() => insertarSql({tenant: 'x', owner: OWNER.A, kind: 'order', pares: [par()], reportes: REPS}), /TENANT_INVALIDO/);
  assert.throws(() => insertarSql({tenant: TENANT_A, owner: 'x', kind: 'order', pares: [par()], reportes: REPS}), /OWNER_INVALIDO/);
  assert.throws(() => insertarSql({tenant: TENANT_A, owner: OWNER.A, kind: 'order', pares: [par()], reportes: {}}), /REPORTE_AUSENTE_A/);
  assert.throws(() => insertarSql({tenant: TENANT_A, owner: OWNER.A, kind: 'order', pares: [par({tier: 'C'})], reportes: {A: REPS.A}}), /REPORTE_AUSENTE_C/);
  assert.throws(() => cteNuevo({tenant: TENANT_A, kind: 'hack', pares: [par()]}), /KIND_INVALIDO/);
  assert.throws(() => cteNuevo({tenant: TENANT_A, kind: 'order', pares: []}), /SIN_PARES/);
});
test('SQL de medición y diagnóstico: solo lectura y sin columnas de contenido', () => {
  const q = medirSql({tenant: TENANT_A, kind: 'order', pares: [par()]});
  assert.doesNotMatch(q.replace(/--[^\n]*/g, ''), /\b(insert|update|delete|drop|alter|truncate|create|grant)\b/i);
  for (const [k, v] of Object.entries(DIAG)) { assert.doesNotMatch(v.replace(/--[^\n]*/g, ''), /\b(insert|update|delete|drop|alter|truncate|create|grant)\b/i, k); assert.doesNotMatch(v, /redacted_text|\bquote\b|\bcontent\b|display_name|email/i, k); }
  assert.doesNotMatch(verificacionSql().replace(/--[^\n]*/g, ''), /\b(insert|update|delete|drop|alter|truncate|create|grant)\b/i);
});
test('CLI utilidades: selección determinista, trozos, parseo de ECON_TOP y scrub de URLs/identificadores', () => {
  const ps = [par({ticket: '2'}), par({ticket: '1', kind: 'refund'}), par({ticket: '3'})].map((p, i) => ({...p, kind: p.kind ?? 'order', entityId: U(i + 1)}));
  assert.equal(seleccionar(ps, {kind: 'all', max: 2}).length, 2); assert.equal(seleccionar(ps, {kind: 'refund', max: 0}).length, 1);
  // más recientes primero y filtro --desde por fecha efectiva del ticket
  const fe = [{...ps[0], fecha: '2026-01-05'}, {...ps[1], fecha: '2026-09-01'}, {...ps[2], fecha: '2026-07-15'}];
  assert.deepEqual(seleccionar(fe, {kind: 'all', max: 0}).map(p => p.fecha), ['2026-09-01', '2026-07-15', '2026-01-05']);
  assert.deepEqual(seleccionar(fe, {kind: 'all', max: 0, desde: '2026-07-01'}).map(p => p.fecha), ['2026-09-01', '2026-07-15']);
  assert.equal(seleccionar([{...ps[0], fecha: null}], {kind: 'all', max: 0, desde: '2026-07-01'}).length, 0); // sin fecha no entra al filtrar
  assert.deepEqual(trozos([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.deepEqual(parseTop('xx ECON_TOP aaa,bbb yy'), ['aaa', 'bbb']); assert.equal(parseTop('nada'), null);
  assert.doesNotMatch(scrub('postgresql://postgres.proyecto-ejemplo:clave@host:5432/postgres 123456789012'), /clave|postgres\./);
  assert.throws(() => conexion({urlEnv: 'VEXA_NO_EXISTE_X'}), /Falta la variable/);
  process.env.VEXA_TEST_URL = 'postgresql://postgres.otroproyecto:x@aws-0-us-east-1.pooler.supabase.com:5432/postgres';
  assert.throws(() => conexion({urlEnv: 'VEXA_TEST_URL'}), /no pertenece al proyecto/); delete process.env.VEXA_TEST_URL;
  assert.throws(() => conexion({socket: '/var/run/otra'}), /SOCKET_LOCAL_FUERA_DE_TMP/);
});

// ================================================================== Postgres local con migraciones reales
const cli = (script, args, env = {}) => spawnSync('node', [path.join(HERE, script), ...args], {encoding: 'utf8', env: {...process.env, ...env}, maxBuffer: 64 * 1024 * 1024});
const WS_Q = (a, extra = {}) => new URLSearchParams({date_start: a.start.slice(0, 10), date_end: a.end.slice(0, 10), currency: a.currency, basis: a.basis, exponent: String(a.exponent), ...extra});

async function flujoCompleto(t, {complete}) {
  const out = tmp();
  try {
    await withPg(async h => {
      const {psql, sock} = h;
      const w = montarMundo(h, {complete});
      const cnt = (tab, where = '') => +psql(`select count(*) from public.${tab} ${where}`).out;
      const ids = w.libro.ids;
      // ---- puente -> pares
      const mp = indexarMarketplaces(w.libro.items, TENANT_A), sh = indexarShopify({...w.libro.shopify, tenantId: TENANT_A});
      const r = construirPares({ticketRows: puenteSintetico(), pedidos: new Map([...mp.pedidos, ...sh.pedidos]), reembolsos: mp.reembolsos});
      fs.writeFileSync(path.join(out, 'pares-economia.jsonl'), r.pares.map(p => JSON.stringify(p)).join('\n') + '\n');
      assert.equal(r.pares.length, 7);
      const pool = new pg.Pool({host: sock, user: 'postgres', database: 't', max: 3});
      const dbOwner = crearBaseDatos({pool, tenantId: TENANT_A, userId: OWNER.A, statementTimeoutMs: 120000});
      const A1 = alcance('marketplaces-usd'), A2 = alcance('shopify-usd'), A3 = alcance('devoluciones-usd');
      const v = await problemasValidos(dbOwner, A1);
      assert.equal(v.validos.length, 3); assert.equal(v.totalVectoriales, 3);
      fs.writeFileSync(path.join(out, 'problemas-validos.json'), JSON.stringify({validos: v.validos}));
      const atest = path.join(out, 'atestacion.txt'); fs.writeFileSync(atest, ATESTACION);
      const base = ['--out', out, '--pg-socket', sock, '--repo', path.join(HERE, '../../..')];
      const ro = () => cnt('economic_problem_links');

      await t.test('dry-run (default): escribe SQL y NO toca la base', () => {
        const c = cli('vinculos.mjs', base);
        assert.equal(c.status, 0, c.stderr); assert.match(c.stdout, /DRY-RUN\. Nada se ejecutó\./); assert.equal(ro(), 0);
        const files = fs.readdirSync(path.join(out, 'sql-vinculos')); assert.ok(files.length >= 2); assert.equal(fs.statSync(path.join(out, 'sql-vinculos', files[0])).mode & 0o777, 0o600);
      });
      await t.test('medición de solo lectura: conteos agregados exactos y sin escrituras', () => {
        const c = cli('vinculos.mjs', [...base, '--medir']);
        assert.equal(c.status, 0, c.stderr + c.stdout);
        assert.match(c.stdout, /medición order \(6 pares\)/); assert.match(c.stdout, /medición refund \(1 pares\)/);
        const l = c.stdout.split('\n').find(x => /medición order/.test(x)); const cols = l.split('|').map(s => s.trim());
        assert.ok(cols.length >= 10, l); assert.equal(ro(), 0);
        // pares=6, tickets=6, vínculos problema-entidad: envío{O1,O2,S1}, pago{O3a} = 4; entidades 4; problemas 2
        assert.match(l, /ECON_MEDICION\s*\|\s*6\s*\|\s*6\s*\|\s*6\s*\|\s*4\s*\|\s*2\s*\|\s*4\s*\|\s*4\s*\|\s*0/);
      });
      await t.test('guardas de escritura: sin owner / sin atestación / atestación corta / analista como owner / tenant ajeno / sin problemas-válidos', () => {
        const run = (extra) => cli('vinculos.mjs', [...base, '--run', '--rollback-test', ...extra]);
        let c = run([]); assert.notEqual(c.status, 0); assert.match(c.stderr, /Falta --owner/);
        c = run(['--owner', OWNER.A]); assert.notEqual(c.status, 0); assert.match(c.stderr, /Falta --atestacion-archivo/);
        const corta = path.join(out, 'corta.txt'); fs.writeFileSync(corta, 'muy corta');
        c = run(['--owner', OWNER.A, '--atestacion-archivo', corta]); assert.notEqual(c.status, 0); assert.match(c.stderr, /entre 20 y 2500/);
        c = run(['--owner', ANALYST_A, '--atestacion-archivo', atest]); assert.notEqual(c.status, 0); assert.match(c.stderr, /OWNER_NO_ACTIVO/);
        c = run(['--owner', SECOND_OWNER_A, '--atestacion-archivo', atest]); assert.notEqual(c.status, 0); assert.match(c.stderr, /OWNER_NO_ACTIVO/); // es viewer
        c = cli('vinculos.mjs', [...base, '--tenant', TENANT_B, '--run', '--rollback-test', '--owner', OWNER.B, '--atestacion-archivo', atest]); assert.notEqual(c.status, 0); assert.match(c.stderr, /TENANT_NO_AUTORIZADO/);
        c = cli('vinculos.mjs', [...base, '--run', '--commit', '--owner', OWNER.A, '--atestacion-archivo', atest, '--validos', path.join(out, 'no-existe.json')]); assert.notEqual(c.status, 0); assert.match(c.stderr, /problemas-validos/);
        c = cli('vinculos.mjs', [...base, '--run']); assert.notEqual(c.status, 0); assert.match(c.stderr, /exactamente uno/);
        assert.equal(ro(), 0);
      });
      await t.test('rollback-test: dispara triggers/guardas con INSERT real, cuenta y NO deja nada', () => {
        const c = cli('vinculos.mjs', [...base, '--run', '--rollback-test', '--owner', OWNER.A, '--atestacion-archivo', atest]);
        assert.equal(c.status, 0, c.stderr + c.stdout); assert.match(c.stdout, /rollback-test order-0001: 4 vínculos habrían entrado/); assert.match(c.stdout, /rollback-test refund-0001: 1 vínculos/);
        assert.equal(ro(), 0);
      });
      await t.test('canario --max 1 escribe solo 1 par; reanudar y repetir es idempotente', () => {
        let c = cli('vinculos.mjs', [...base, '--run', '--commit', '--max', '1', '--owner', OWNER.A, '--atestacion-archivo', atest]);
        assert.equal(c.status, 0, c.stderr + c.stdout); assert.equal(ro(), 1);
        c = cli('vinculos.mjs', [...base, '--run', '--commit', '--max', '1', '--owner', OWNER.A, '--atestacion-archivo', atest]);
        assert.equal(c.status, 0); assert.match(c.stdout, /insertados=0 ya_existian=1/); assert.equal(ro(), 1);
      });
      await t.test('commit completo: vínculos exactos {envío:{O1,O2,S1}, pago:{O3a}, garantía:{R1}}, idempotente, versión 1, actor owner y reporte atestado', () => {
        let c = cli('vinculos.mjs', [...base, '--run', '--commit', '--owner', OWNER.A, '--atestacion-archivo', atest]);
        assert.equal(c.status, 0, c.stderr + c.stdout);
        assert.equal(ro(), 5);
        const set = psql(`select p.title||'>'||l.entity_id from public.economic_problem_links l join public.problems p on p.tenant_id=l.tenant_id and p.id=l.problem_id where l.tenant_id='${TENANT_A}' order by 1`).out.split('\n');
        const E = (title, id) => title + '>' + id;
        assert.deepEqual(set, [E('Envío: No recibido', ids.O1), E('Envío: No recibido', ids.O2), E('Envío: No recibido', ids.S1), E('Garantía: Batería', ids.R1), E('Pago: Cobro duplicado', ids.O3a)].sort());
        assert.equal(psql(`select count(*) from public.economic_problem_links where version<>1 or not active or not attested or actor_id<>'${OWNER.A}' or report not like 'SYN prueba%' or tenant_id<>'${TENANT_A}'`).out, '0');
        assert.equal(psql(`select count(*) from public.economic_problem_links where tenant_id='${TENANT_B}'`).out, '0'); // el ticket repetido del tenant B NO recibió vínculo
        const before = psql(`select md5(string_agg(id::text||report,'|' order by id)) from public.economic_problem_links`).out;
        c = cli('vinculos.mjs', [...base, '--run', '--commit', '--owner', OWNER.A, '--atestacion-archivo', atest]);
        assert.equal(c.status, 0); assert.match(c.stdout, /insertados=0/); assert.equal(psql(`select md5(string_agg(id::text||report,'|' order by id)) from public.economic_problem_links`).out, before);
        // verificación (la que correrá Javier por MCP): incoherencias 0
        const vr = psql(verificacionSql({tenant: TENANT_A}).replace(/--[^\n]*\n/g, '').replace(/;\s*$/, '')).out.split('|');
        assert.deepEqual(vr.slice(0, 2).concat(vr.slice(2, 6)).map(Number), [5, 5, 0, 0, 0, 0]);
        for (const q of Object.values(DIAG)) assert.ok(psql(q.replace(/--[^\n]*\n/g, '').replace(/;\s*$/, '')).ok, q.slice(0, 60));
      });
      await t.test('problema sin evidencia vigente: queda fuera por problemas-validos y no contamina las cifras de los demás', async () => {
        const before = await medirExposicion(dbOwner, A1);
        assert.equal(before.vinculos_invalidos, 0);
      });

      // ---- exposición viva (readExposure real) y snapshot
      await t.test('exposición viva: global = unión (no suma), por problema coherente, cobertura NO atestada => importe exacto null y subtotal conocido', async () => {
        const m = await medirExposicion(dbOwner, A1);
        assert.equal(m.vinculos_vigentes_validos, 5); assert.equal(m.vinculos_invalidos, 0);
        assert.equal(m.global.subtotal, '40000'); assert.equal(m.global.total, 3);       // O1+O2+O3a, unión de órdenes
        assert.equal(m.global.amount, null); assert.ok(m.global.motivos.includes('relation_coverage_unconfirmed'));
        assert.equal(m.todos_los_pedidos.subtotal, '47000'); assert.equal(m.todos_los_pedidos.n, 4);
        assert.equal(m.no_aditivo, true);
      });
      await t.test('equivalencia con el importador del producto: un vínculo hecho con createExposureRepository.record() tiene la misma forma que los del SQL', async () => {
        const repo = createExposureRepository({database: dbOwner});
        const probs = psql(`select id from public.problems where tenant_id='${TENANT_A}' and title='Pago: Cobro duplicado'`).out;
        const rowO2 = psql(`select id from public.economic_ledger_entries where entity_id='${ids.O2}'`).out;
        const rec = await repo.record({problemId: probs, ledgerRowId: rowO2, expectedVersion: 0, active: true, report: ATESTACION, attested: true});
        assert.equal(rec.valid, true); assert.equal(rec.kind, 'order');
        const cols = (where) => psql(`select string_agg(distinct (version::text||active::text||attested::text||(actor_id='${OWNER.A}')::text), ',') from public.economic_problem_links where ${where}`).out;
        assert.equal(cols(`problem_id='${probs}' and entity_id='${ids.O2}'`), cols(`problem_id='${probs}' and entity_id='${ids.O3a}'`));
        // y el producto lo lee igual que los demás
        const m = await medirExposicion(dbOwner, A1); assert.equal(m.vinculos_vigentes_validos, 6); assert.equal(m.global.subtotal, '40000');
        // se deshace de forma legítima (versión 2 inactiva): la regla del producto para retirar un vínculo
        await repo.record({problemId: probs, ledgerRowId: rowO2, expectedVersion: 1, active: false, report: ATESTACION, attested: true});
        const m2 = await medirExposicion(dbOwner, A1); assert.equal(m2.vinculos, 6); assert.equal(m2.vinculos_vigentes_validos, 5); // 6 pares leídos; el retirado ya no cuenta
        assert.equal(m2.global.subtotal, '40000');
      });

      const reportCob = 'SYN: el owner de prueba declara la cobertura de relaciones del alcance revisada para la prueba.';
      await t.test('snapshot: rollback-test no deja nada; commit deja borrador; el hash de contenido es verificable', async () => {
        const c = conReversa(dbOwner); await prepararSnapshot(c.db, A1);
        assert.equal(cnt('metric_snapshots', "where economic_schema_version is not null"), 0); assert.ok(c.resultado().contentHash);
        const s = await prepararSnapshot(dbOwner, A1);
        assert.equal(s.status, 'draft'); assert.equal(cnt('metric_snapshots', "where economic_schema_version is not null"), 1);
        assert.equal(s.exposure.membership.length, 3); // membresía capturada: (envío,O1) (envío,O2) (pago,O3a)
        const s2 = await prepararSnapshot(dbOwner, A1); assert.equal(s2.id, s.id); // mismo insumo => mismo snapshot (idempotente)
      });
      await t.test('cobertura: la atestación es un paso EXPLÍCITO del owner y pone en juego la cifra exacta solo si las fuentes también son completas', async () => {
        const cov = await atestarCobertura(dbOwner, {scope: A1, complete: true, report: reportCob});
        assert.equal(cov.complete, true); assert.equal(cov.current, true);
        const m = await medirExposicion(dbOwner, A1);
        if (complete) { assert.equal(m.global.amount, '40000'); assert.equal(m.global.status, 'complete'); }
        else { assert.equal(m.global.amount, null); assert.ok(m.global.motivos.includes('SOURCE_INCOMPLETE')); assert.equal(m.global.subtotal, '40000'); }
      });
      await t.test('snapshots por alcance: marketplaces-usd (pedidos), shopify-usd (pedido+reembolso), devoluciones-usd (reembolso directo)', async () => {
        for (const a of [A1, A2, A3]) { try { await atestarCobertura(dbOwner, {scope: a, complete: true, report: reportCob}); } catch (e) { throw new Error('cobertura ' + a.basis + ': ' + e.message); } }
        const exp = {};
        for (const [name, a] of [['mp', A1], ['sh', A2], ['dev', A3]]) {
          const s = await prepararSnapshot(dbOwner, a);
          const pub = await publicarSnapshot(dbOwner, {snapshotId: s.id, contentHash: s.contentHash});
          assert.equal(pub.status, 'published'); exp[name] = pub;
        }
        const cm = (snap, key) => snap.components.find(c => c.metric === key && c.currency === 'USD');
        // Todas las cifras del snapshot salen del libro: marketplaces
        assert.equal(cm(exp.mp, 'exposure.global').knownSubtotalMinor, '40000'); assert.equal(cm(exp.mp, 'allOrders').knownSubtotalMinor, '47000');
        assert.equal(cm(exp.sh, 'exposure.global').knownSubtotalMinor, '40000'); assert.equal(cm(exp.sh, 'refunds').knownSubtotalMinor, '5000');
        // LIMITACIÓN DEL PRODUCTO (caracterización): un reembolso de marketplace tiene base distinta a la del pedido y no entra en el alcance de pedidos
        assert.equal(cm(exp.mp, 'refunds').knownSubtotalMinor, '0');
        // ... y en su propio alcance (base marketplace_refund_amount) la tarjeta GLOBAL «Reembolsos liquidados» queda NO DISPONIBLE porque el libro tiene devoluciones de
        // Amazon con estado unknown (3,272 en el libro real): el producto no suma estados desconocidos. El detalle del problema vinculado sí muestra su reembolso settled.
        assert.equal(cm(exp.dev, 'refunds').knownSubtotalMinor, null); assert.equal(cm(exp.dev, 'refunds').amountMinor, null);
        if (complete) { assert.equal(cm(exp.mp, 'exposure.global').amountMinor, '40000'); assert.equal(cm(exp.sh, 'refunds').amountMinor, '5000'); }
        else { assert.equal(cm(exp.mp, 'exposure.global').amountMinor, null); }

        // ---- la MISMA cifra en tarjeta (Resumen), lista (Explorador/Problemas) y detalle, con la API REAL de workspace-service
        const dbRead = crearBaseDatos({pool, tenantId: TENANT_A, userId: OWNER.A, statementTimeoutMs: 10000}); // el límite real de la app: 10 s
        const ws = createWorkspaceService({database: dbRead}), detail = createDetailService({database: dbRead});
        for (const [name, a, snap] of [['mp', A1, exp.mp], ['sh', A2, exp.sh]]) {
          const card = await ws.query(WS_Q(a, {resource: 'metrics', snapshot_id: snap.id}));
          assert.equal(card.meta.snapshot_id, snap.id);
          const mt = Object.fromEntries(card.items[0].metrics.map(x => [x.kind, x]));
          assert.equal(mt.exposure.known_subtotal, cm(snap, 'exposure.global').knownSubtotalMinor, name + ' tarjeta=snapshot');
          assert.equal(mt.exposure.amount_minor, cm(snap, 'exposure.global').amountMinor ?? null);
          assert.equal(mt.allOrders.known_subtotal, cm(snap, 'allOrders').knownSubtotalMinor); assert.equal(mt.refunds.known_subtotal, cm(snap, 'refunds').knownSubtotalMinor);
          const list = await ws.query(WS_Q(a, {resource: 'problems', snapshot_id: snap.id}), {all: true});
          const envio = list.items.find(i => i.title === 'Envío: No recibido');
          assert.ok(envio, 'el Explorador lista el problema vinculado');
          const expectedEnvio = name === 'mp' ? '35000' : '40000';
          assert.equal(envio.metrics[0].known_subtotal, expectedEnvio);
          // detalle del problema: misma cifra
          const pinned = WS_Q(a, {snapshot_id: snap.id, scope_hash: card.meta.scope_hash});
          const d = await detail.get({kind: 'problem', id: envio.id, query: pinned});
          const exposureCard = d.components.find(c => c.metric === 'exposure');
          assert.equal(exposureCard.money.known_subtotal, envio.metrics[0].known_subtotal, name + ' detalle=lista');
          assert.equal(exposureCard.money.amount_minor, envio.metrics[0].amount_minor);
          if (name === 'sh') { const refunds = d.components.find(c => c.metric === 'refunds'); assert.equal(refunds.money.known_subtotal, '5000'); assert.equal(refunds.money.known_subtotal, mt.refunds.known_subtotal); }
          // la tarjeta global NO es la suma de las filas por problema (no aditivo): hay otro problema con importe propio en mp
          if (name === 'mp') { const pago = list.items.find(i => i.title === 'Pago: Cobro duplicado'); assert.equal(pago.metrics[0].known_subtotal, '5000'); assert.equal(+envio.metrics[0].known_subtotal + +pago.metrics[0].known_subtotal, 40000); }
        }
        {
          const dbR = crearBaseDatos({pool, tenantId: TENANT_A, userId: OWNER.A, statementTimeoutMs: 10000});
          const ws = createWorkspaceService({database: dbR}), detail = createDetailService({database: dbR});
          const card = await ws.query(WS_Q(A3, {resource: 'metrics', snapshot_id: exp.dev.id}));
          assert.equal(card.items[0].metrics.find(x => x.kind === 'refunds').known_subtotal, null, 'tarjeta global bloqueada por estados desconocidos');
          assert.equal(card.items[0].metrics.find(x => x.kind === 'refunds').status, 'unavailable');
          const list = await ws.query(WS_Q(A3, {resource: 'problems', snapshot_id: exp.dev.id}), {all: true});
          // LIMITACIÓN DEL PRODUCTO (caracterización): el Explorador lista solo problemas con vínculos de PEDIDO dentro del alcance; un problema cuyo único vínculo es un
          // reembolso (Walmart) NO aparece ni se puede abrir en detalle (problem_not_found), aunque el reembolso esté ligado y publicado.
          assert.equal(list.items.find(i => i.title === 'Garantía: Batería'), undefined);
          await assert.rejects(detail.get({kind: 'problem', id: psql(`select id from public.problems where tenant_id='${TENANT_A}' and title='Garantía: Batería'`).out, query: WS_Q(A3, {snapshot_id: exp.dev.id, scope_hash: card.meta.scope_hash})}), /problem_not_found/);
        }
        // ---- aislamiento: el owner del tenant B no ve nada del A
        const dbB = crearBaseDatos({pool, tenantId: TENANT_B, userId: OWNER.B, statementTimeoutMs: 10000});
        const wsB = createWorkspaceService({database: dbB});
        const vacio = await wsB.query(WS_Q(A1, {resource: 'metrics'}));
        assert.equal(vacio.meta.snapshot_id, null); assert.equal(vacio.items.length, 0);
        // un analista del tenant A lee lo publicado pero no puede preparar ni publicar
        const dbAn = crearBaseDatos({pool, tenantId: TENANT_A, userId: ANALYST_A, statementTimeoutMs: 10000});
        const wsAn = createWorkspaceService({database: dbAn});
        const an = await wsAn.query(WS_Q(A1, {resource: 'metrics', snapshot_id: exp.mp.id})); assert.equal(an.items[0].metrics.find(x => x.kind === 'exposure').known_subtotal, '40000');
        await assert.rejects(prepararSnapshot(dbAn, A1)); await assert.rejects(publicarSnapshot(dbAn, {snapshotId: exp.mp.id, contentHash: exp.mp.contentHash}));
      });
      await pool.end();
    }, {name: complete ? 'econ-c' : 'econ-i'});
  } finally { fs.rmSync(out, {recursive: true, force: true}); }
}

test('PG: flujo completo con fuentes INCOMPLETAS (como en producción): vínculos -> exposición -> snapshot -> Resumen/Explorador/Detalle coherentes; importe exacto sigue null', { skip: !pgAvailable() && 'sin postgres local', timeout: 900000 }, async t => flujoCompleto(t, {complete: false}));
test('PG: mismo flujo con fuentes COMPLETAS y cobertura atestada: el importe exacto aparece y coincide en tarjeta, lista y detalle', { skip: !pgAvailable() && 'sin postgres local', timeout: 900000 }, async t => flujoCompleto(t, {complete: true}));

// ================================================================== casos de borde con Postgres local
test('PG: tickets fusionados, gorgias y aislamiento por tenant en el SQL de medición; sin duplicar (problema, entidad)', { skip: !pgAvailable() && 'sin postgres local', timeout: 600000 }, async () => {
  await withPg(async h => {
    const {psql} = h; const w = montarMundo(h); const ids = w.libro.ids;
    const med = (pares, kind = 'order') => psql(medirSql({tenant: TENANT_A, kind, pares}).replace(/--[^\n]*\n/g, '').replace(/;\s*$/, '')).out.split('|').map(x => x.trim());
    // el ticket 999 no existe como conversación, pero su fusionado 5000000003 sí (conversación de envío) y el gorgias G7 también
    const r = med([{ticket: '999', gorgias: 'G7', fusionados: ['5000000003'], entityId: ids.O3b, tier: 'B'}]);
    assert.deepEqual(r.slice(0, 8), ['ECON_MEDICION', '1', '1', '2', '1', '1', '1', '1']); // 2 conversaciones (g7 y fusionado) -> 1 entidad -> 1 problema (envío) -> 1 vínculo
    // el mismo ticket en el tenant B no genera nada en A: B tiene su propia conversación hubspot:5000000001
    const r2 = med([{ticket: '5000000001', gorgias: null, fusionados: [], entityId: ids.O1, tier: 'A'}]);
    assert.equal(+r2[3], 1, 'solo la conversación del tenant A'); assert.equal(+r2[4], 1);
    // una entidad que no existe en el libro vigente produce 0 candidatos (no se inventa nada)
    const r3 = med([{ticket: '5000000001', gorgias: null, fusionados: [], entityId: U(424242), tier: 'A'}]); assert.equal(+r3[6], 0);
    // pares repetidos en el mismo lote no duplican candidatos
    const r4 = med([par({ticket: '5000000001', entityId: ids.O1}), par({ticket: '5000000002', entityId: ids.O1})]); assert.equal(+r4[6], 1);
  });
});
test('PG: un problema sin evidencia vigente se excluye por problemas-validos; si recibiera vínculos, deja SIN cifras a todo el alcance (por eso el filtro es obligatorio)', { skip: !pgAvailable() && 'sin postgres local', timeout: 600000 }, async () => {
  await withPg(async h => {
    const {psql, sock} = h; const w = montarMundo(h); const ids = w.libro.ids;
    const pool = new pg.Pool({host: sock, user: 'postgres', database: 't', max: 2});
    try {
      const db = crearBaseDatos({pool, tenantId: TENANT_A, userId: OWNER.A, statementTimeoutMs: 60000});
      const A1 = alcance('marketplaces-usd');
      assert.equal((await problemasValidos(db, A1)).validos.length, 3);
      // la extracción de la conversación 6 (problema «Garantía») deja de estar vigente
      assert.ok(psql(`update public.extraction_runs set status='failed' where tenant_id='${TENANT_A}' and conversation_id='${w.convs[5].conv.conversation_id}'`).ok);
      const v = await problemasValidos(db, A1);
      assert.equal(v.validos.length, 2); assert.equal(v.totalVectoriales, 3);
      const garantia = psql(`select id from public.problems where tenant_id='${TENANT_A}' and title='Garantía: Batería'`).out;
      assert.ok(!v.validos.includes(garantia));
      // con el filtro: el par de la conversación 6 (devolución R1) no recibe vínculo
      const pares = [{ticket: '5000000006', gorgias: null, fusionados: [], entityId: ids.R1, tier: 'A'}];
      const sql = insertarSql({tenant: TENANT_A, owner: OWNER.A, kind: 'refund', pares, validos: v.validos, reportes: REPS});
      const f = path.join(os.tmpdir(), 'econprob-x.sql'); fs.writeFileSync(f, sql.join('\n'));
      let r = spawnSync('psql', ['-h', sock, '-U', 'postgres', '-d', 't', '-X', '-q', '-1', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-f', f], {encoding: 'utf8'});
      assert.equal(r.status, 0, r.stderr); assert.match(r.stdout, /candidatos=0 insertados=0/);
      // sin el filtro (peligroso): el vínculo entra y TODAS las métricas del alcance quedan sin cifra
      fs.writeFileSync(f, insertarSql({tenant: TENANT_A, owner: OWNER.A, kind: 'refund', pares, validos: null, reportes: REPS}).join('\n'));
      r = spawnSync('psql', ['-h', sock, '-U', 'postgres', '-d', 't', '-X', '-q', '-1', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-f', f], {encoding: 'utf8'}); fs.rmSync(f);
      assert.equal(r.status, 0, r.stderr); assert.match(r.stdout, /insertados=1/);
      const m = await medirExposicion(db, A1);
      assert.equal(m.vinculos_invalidos, 1); assert.equal(m.global.amount, null);
      assert.ok(m.global.motivos.includes('relation_evidence_unavailable'));
    } finally { await pool.end(); }
  });
});
test('PG: puente alterno por el Tracker (DIAG 4) mide en la base el alcance conversación->ticket->fila->pedido del libro, con encabezados distintos por hoja', { skip: !pgAvailable() && 'sin postgres local', timeout: 600000 }, async () => {
  await withPg(async h => {
    const {psql} = h; montarMundo(h);
    const conn = U(500000 + 1);                                      // conexión de la conversación 1 (existe)
    const mkCell = (col, v) => ({ref: 'X' + col, col, t: 's', v, f: null});
    const hash = n => String(n).padStart(64, 'a');
    const ver = U(8001);
    let r = psql(`insert into public.tracker_versions(id,tenant_id,connection_id,file_sha256,label,rank,received_at) values('${ver}','${TENANT_A}','${conn}','${'b'.repeat(64)}','SYN',1,now())`); assert.ok(r.ok, r.err);
    const filas = [
      ['Hoja1', 1, 'header', null, [mkCell(0, 'Requester'), mkCell(1, 'Hubspot ID'), mkCell(2, 'Order ID'), mkCell(3, 'Retailer')]],
      ['Hoja1', 2, 'candidate', '5000000001', [mkCell(0, 'x'), mkCell(1, '5000000001'), mkCell(2, 'SYN-111-0000001'), mkCell(3, 'Amazon :: Amazon')]],
      ['Hoja1', 3, 'candidate', '5000000003', [mkCell(0, 'x'), mkCell(1, '5000000003'), mkCell(2, 'SYN-111-0000002'), mkCell(3, 'Amazon :: fulfilled by CLIENTEX')]],
      ['Hoja2', 1, 'header', null, [mkCell(0, 'Owner'), mkCell(1, 'Retailer'), mkCell(2, 'Hubspot_ID'), mkCell(5, 'Order_ID')]],      // columnas en otro orden
      ['Hoja2', 2, 'candidate', '5000000004', [mkCell(0, 'y'), mkCell(1, 'Amazon :: Amazon'), mkCell(2, '5000000004'), mkCell(5, 'SYN-111-0000003')]],
      ['Hoja2', 3, 'candidate', '5000000099', [mkCell(1, 'Amazon :: Amazon'), mkCell(2, '5000000099'), mkCell(5, 'SYN-111-0000001')]],               // ticket sin conversación
    ];
    let k = 0;
    for (const [sheet, row, state, ticket, cells] of filas) {
      const rev = U(8100 + (++k));
      r = psql(`insert into public.tracker_row_revisions(id,tenant_id,connection_id,sheet_name,row_number,row_hash,cells,ticket_state,ticket_id,first_version_id) values('${rev}','${TENANT_A}','${conn}','${sheet}',${row},'${hash(k)}',$j$${JSON.stringify(cells)}$j$::jsonb,'${state}',${ticket ? `'${ticket}'` : 'null'},'${ver}')`); assert.ok(r.ok, r.err);
      r = psql(`insert into public.tracker_row_observations(tenant_id,version_id,sheet_name,row_number,revision_id) values('${TENANT_A}','${ver}','${sheet}',${row},'${rev}')`); assert.ok(r.ok, r.err);
    }
    const q = DIAG['4-tracker-puente'].replace(/--[^\n]*\n/g, '').replace(/;\s*$/, '');
    const out = psql(q).out.split('|').map(Number);
    // filas con ticket: 4 ; con pedido y marketplace: 4 ; pares ticket-línea en libro: 5 (T1->O1, T3->O2, T4->O3a y O3b por el pedido multilínea, T99->O1) ;
    // líneas recorded alcanzadas: O1,O2,O3a,O3b = 4 ; conversaciones alcanzadas: 3 (tickets 1,3,4; el 99 no tiene conversación)
    assert.deepEqual(out, [4, 4, 5, 4, 3]);
  });
});

// ================================================================== propuesta 0055 (visibilidad rápida): misma respuesta booleana que la función de 0021
test('PG: propuesta 0055 — economic_snapshot_visible rápida devuelve EXACTAMENTE lo mismo que la de 0021 en lectura de borrador/publicado, otro tenant, analista y revocaciones', { skip: !pgAvailable() && 'sin postgres local', timeout: 900000 }, async () => {
  await withPg(async h => {
    const {psql, sock} = h; const w = montarMundo(h, {complete: false});
    const pool = new pg.Pool({host: sock, user: 'postgres', database: 't', max: 3});
    try {
      const dbOwner = crearBaseDatos({pool, tenantId: TENANT_A, userId: OWNER.A, statementTimeoutMs: 120000}); const A1 = alcance('marketplaces-usd');
      const ids = w.libro.ids;
      const pares = [['5000000001', ids.O1], ['5000000003', ids.O2], ['5000000004', ids.O3a]].map(([t, e]) => ({ticket: t, gorgias: null, fusionados: [], entityId: e, tier: 'A'}));
      const sql = insertarSql({tenant: TENANT_A, owner: OWNER.A, kind: 'order', pares, reportes: REPS}); const f = path.join(os.tmpdir(), 'econprob-0055.sql'); fs.writeFileSync(f, sql.join('\n'));
      const r = spawnSync('psql', ['-h', sock, '-U', 'postgres', '-d', 't', '-X', '-q', '-1', '-v', 'ON_ERROR_STOP=1', '-f', f], {encoding: 'utf8'}); fs.rmSync(f); assert.equal(r.status, 0, r.stderr);
      const draft = await prepararSnapshot(dbOwner, A1);
      const published = await publicarSnapshot(dbOwner, {snapshotId: draft.id, contentHash: draft.contentHash});
      const draft2 = await prepararSnapshot(dbOwner, alcance('shopify-usd'));            // un segundo snapshot que queda en borrador
      const probe = who => {   // rol vexa_backend con el mismo contexto que la app
        const out = [];
        for (const [tenant, user] of who) {
          const s = `begin; set local role vexa_backend; select set_config('request.jwt.claim.sub','${user}',true),set_config('vexa.tenant_id','${tenant}',true),set_config('vexa.action','read',true); select s.id::text||'='||public.economic_snapshot_visible(s.tenant_id,s.id)::text from (select id,tenant_id from public.metric_snapshots) s order by 1; select 'componentes_visibles='||count(*) from public.components; rollback;`;
          const x = spawnSync('psql', ['-h', sock, '-U', 'postgres', '-d', 't', '-At', '-X', '-q', '-c', s], {encoding: 'utf8'}); assert.equal(x.status, 0, x.stderr); out.push(user + ':' + x.stdout.split('\n').filter(l => /=(true|false)$|^componentes_visibles=/.test(l)).join(','));
        }
        return out.join('|');
      };
      const who = [[TENANT_A, OWNER.A], [TENANT_A, ANALYST_A], [TENANT_B, OWNER.B]];
      const escenarios = [];
      const snap = () => probe(who);
      const t0 = Date.now(); escenarios.push(['inicial', snap()]); const tViejo = Date.now() - t0;
      // revocación: el owner que creó el snapshot deja de ser owner activo
      assert.ok(psql(`update public.memberships set status='revoked' where tenant_id='${TENANT_A}' and user_id='${SECOND_OWNER_A}'`).ok);
      escenarios.push(['viewer revocado', snap()]);
      const viejo = escenarios.map(e => e[1]);
      const propuesta = fs.readFileSync(path.join(HERE, 'propuestas/0055_economic_snapshot_visible_rapida.sql'), 'utf8');
      const propuestaB = fs.readFileSync(path.join(HERE, 'propuestas/0055b_components_policy_una_vez.sql'), 'utf8');
      const pf = path.join(os.tmpdir(), 'econprob-0055b.sql'); fs.writeFileSync(pf, propuesta + '\n' + propuestaB);
      assert.equal(spawnSync('psql', ['-h', sock, '-U', 'postgres', '-d', 't', '-q', '-v', 'ON_ERROR_STOP=1', '-f', pf], {encoding: 'utf8'}).status, 0); fs.rmSync(pf);
      const nuevo = [];
      assert.ok(psql(`update public.memberships set status='active' where tenant_id='${TENANT_A}' and user_id='${SECOND_OWNER_A}'`).ok);
      const t1 = Date.now(); nuevo.push(snap()); const tNuevo = Date.now() - t1; assert.ok(psql(`update public.memberships set status='revoked' where tenant_id='${TENANT_A}' and user_id='${SECOND_OWNER_A}'`).ok); nuevo.push(snap());
      assert.deepEqual(nuevo, viejo, 'la propuesta no cambia ninguna decisión de visibilidad');
      assert.match(viejo[0], new RegExp(OWNER.A + ':.*=true'));
      // el analista no ve el borrador y sí el publicado; el owner de B no ve nada de A
      const analista = viejo[0].split('|')[1]; assert.ok(analista.includes(published.id + '=true') && !analista.includes(draft2.id), 'el borrador ni siquiera se lista a un analista');
      assert.ok(!viejo[0].split('|')[2].includes('=true'), 'el owner de otro tenant no ve nada');
      // si el owner creador pierde la membresía, el snapshot deja de ser visible para todos
      assert.ok(psql(`update public.memberships set status='revoked' where tenant_id='${TENANT_A}' and user_id='${OWNER.A}'`).ok);
      const trasRevocar = snap(); assert.ok(!trasRevocar.split('|')[1].includes('=true'), 'sin owner contribuyente no hay lectura');
      console.log(`# visibilidad 0021 ${tViejo} ms vs propuesta 0055 ${tNuevo} ms (libro pequeño)`);
    } finally { await pool.end(); }
  });
});
