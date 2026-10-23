// Pruebas LOCALES del importador de vínculos (sin red, sin producción, datos 100 % sintéticos):
//   node --test scripts/vinculos/test-importar-vinculos.mjs
// Las de Postgres usan initdb desechable (harness de packages/ai-scale/economia-problemas) con las migraciones REALES 0001..0054 y se destruyen al terminar.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {withPg, pgAvailable} from '../../packages/ai-scale/economia-problemas/harness.mjs';
import {montarMundo, TENANT_A, OWNER, ANALYST_A, U} from '../../packages/ai-scale/economia-problemas/mundo.mjs';
import {validarCsv, parseCsv, muestra, soloPermitidas, loteSql, planSql, dentroDeTope, sha256, TENANT, PROJECT_REF, MARCA} from './importar-vinculos.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(HERE, 'importar-vinculos.mjs');
const H = n => String(n).padStart(64, 'a');
const ATEST = 'SYN prueba: el owner de prueba atesta haber revisado el método y una muestra sintética; asociación de apoyo, no causalidad.';
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'vinc-'));
const cli = (args, env = {}) => spawnSync('node', [SCRIPT, ...args], {encoding: 'utf8', env: {...process.env, ...env}, maxBuffer: 64 * 1024 * 1024});

test('el tenant pinneado del importador es el del producto', () => { assert.equal(TENANT, TENANT_A); assert.equal(PROJECT_REF, 'proyecto-ejemplo'); });

// ============================================================================================ puras
test('CSV: forma válida, duplicados, método no permitido, hash/uuid inválidos, columnas desconocidas', () => {
  const p1 = U(1), r1 = U(2), r2 = U(3);
  const csv = ['problem_id,ledger_row_id,metodo,ticket_ref_hash',
    `${p1},${r1},order_id__c_hubspot,${H(1)}`,
    `${p1},${r1},order_id__c_hubspot,${H(1)}`,        // duplicado exacto
    `${p1},${r1},order_id__c_hubspot,${H(2)}`,        // mismo par, otro ticket
    `${p1},${r2},otro_metodo,${H(1)}`,                // método fuera de lista
    `${p1},${r2},order_id__c_hubspot,xyz`,            // hash inválido
    `no-uuid,${r2},order_id__c_hubspot,${H(1)}`,
    `${p1},${r2},order_id__c_hubspot,${H(3)}`].join('\n');
  const v = validarCsv(csv);
  assert.equal(v.pares.length, 2);
  assert.deepEqual(v.rechazados.map(r => r.motivo), ['duplicado_exacto_en_csv', 'duplicado_con_metodo_o_ticket_distinto', 'metodo_no_permitido', 'ticket_ref_hash_invalido', 'problem_id_invalido']);
  assert.throws(() => validarCsv('problem_id,ledger_row_id,metodo,ticket_ref_hash,email\n'), /COLUMNAS_DESCONOCIDAS/);
  assert.throws(() => validarCsv('problem_id,metodo\n'), /CSV_CABECERA/);
  assert.throws(() => validarCsv(''), /CSV_VACIO/);
  assert.deepEqual(parseCsv('a,"b,""c""",d\n1,2,3\r\n'), [['a', 'b,"c"', 'd'], ['1', '2', '3']]);
  // entity_id y ledger_row_id a la vez, o ninguno, se rechaza
  const both = validarCsv(`problem_id,ledger_row_id,entity_id,metodo,ticket_ref_hash\n${p1},${r1},${r2},order_id__c_hubspot,${H(1)}\n${p1},,,order_id__c_hubspot,${H(1)}\n`);
  assert.equal(both.pares.length, 0); assert.equal(both.rechazados.length, 2);
});
test('muestra: reproducible con la misma semilla, distinta con otra, sin duplicados y sin columnas fuera de ids/hashes', () => {
  const pares = Array.from({length: 500}, (_, i) => ({problemId: U(10 + (i % 7)), refKind: 'entity', refId: U(1000 + i), metodo: 'order_id__c_hubspot', ref: H(i)}));
  const a = muestra(pares, {n: 50, semilla: 'S1'}), b = muestra([...pares].reverse(), {n: 50, semilla: 'S1'}), c = muestra(pares, {n: 50, semilla: 'S2'});
  assert.deepEqual(a, b); assert.notDeepEqual(a.map(x => x.ref_id), c.map(x => x.ref_id)); assert.equal(new Set(a.map(x => x.ref_id)).size, 50);
  assert.deepEqual(Object.keys(a[0]), ['n', 'problem_id', 'ref_kind', 'ref_id', 'metodo', 'ticket_ref_hash']);
  assert.throws(() => muestra(pares, {n: 5}), /semilla/);
});
test('SQL generado: lista cerrada (un solo INSERT en economic_problem_links), rechaza «$» en el reporte y no contiene delete/update', () => {
  const it = {problemId: U(1), entityId: U(2), rowId: U(3), expected: 0, report: 'SYN texto de atestación suficientemente largo ' + MARCA + ' lote=x]'};
  const sql = loteSql({owner: OWNER.A, items: [it], activo: true, etiqueta: 'importar-0001'});
  assert.ok(soloPermitidas(sql)); assert.match(sql, /set local role vexa_backend/); assert.match(sql, /statement_timeout='60000ms'/);
  assert.equal(soloPermitidas(sql + '\ndelete from public.economic_problem_links;\n'), false);
  assert.equal(soloPermitidas(sql.replace('begin;', 'begin;\nupdate public.memberships set role=\'owner\';')), false);
  assert.throws(() => loteSql({owner: OWNER.A, items: [{...it, report: 'SYN texto con $lote$ para romper el cuerpo'}], activo: true, etiqueta: 'x'}), /REPORT_CARACTER/);
  assert.throws(() => loteSql({owner: OWNER.A, items: [{...it, report: 'corto'}], activo: true, etiqueta: 'x'}), /REPORT_FUERA/);
  assert.throws(() => loteSql({owner: 'no-uuid', items: [it], activo: true, etiqueta: 'x'}), /OWNER_INVALIDO/);
  assert.throws(() => planSql([{problemId: U(1), refKind: 'row', refId: U(2)}], {tenant: U(9)}), /TENANT_NO_AUTORIZADO/);
  assert.ok(!/delete|update|truncate/i.test(planSql([{problemId: U(1), refKind: 'row', refId: U(2)}])));
});
test('tope de tiempo total: dentro mientras no se supere, fuera al pasarse', () => { assert.ok(dentroDeTope(1000, 600, 1000 + 599000)); assert.ok(!dentroDeTope(1000, 600, 1000 + 601000)); });
test('CLI sin transporte: solo valida la forma, lo dice, y --execute sin transporte se niega sin tocar nada', () => {
  const d = tmp(); const csv = path.join(d, 'p.csv');
  fs.writeFileSync(csv, `problem_id,ledger_row_id,metodo,ticket_ref_hash\n${U(1)},${U(2)},order_id__c_hubspot,${H(1)}\n`);
  let c = cli(['--csv', csv, '--recibos', d]); assert.equal(c.status, 0, c.stderr); assert.match(c.stdout, /SOLO FORMA DEL CSV/);
  c = cli(['--csv', csv, '--recibos', d, '--execute']); assert.notEqual(c.status, 0); assert.match(c.stderr, /confirmar-proyecto/);
  c = cli(['--csv', csv, '--recibos', d, '--tenant', U(5)]); assert.notEqual(c.status, 0); assert.match(c.stderr, /TENANT_NO_AUTORIZADO/);
});

// ============================================================================================ Postgres local con migraciones reales
test('PG: dry-run no escribe; rechazos (atestación, hash, proyecto, dry-run previo, validos); idempotencia; problema no vigente; lectura del producto; reversa', { skip: !pgAvailable() && 'sin postgres local', timeout: 900000 }, async t => {
  const d = tmp();
  try {
    await withPg(async h => {
      const {psql, sock} = h;
      const w = montarMundo(h); const ids = w.libro.ids;
      const cnt = () => +psql(`select count(*) from public.economic_problem_links`).out;
      const digest = () => psql(`select coalesce(md5(string_agg(id::text||version||active||report,'|' order by id)),'') from public.economic_problem_links`).out;
      const prob = ti => psql(`select id from public.problems where tenant_id='${TENANT_A}' and title='${ti}'`).out;
      const envio = prob('Envío: No recibido'), pago = prob('Pago: Cobro duplicado'), garantia = prob('Garantía: Batería');
      const rowOf = ent => psql(`select id from public.economic_ledger_entries where entity_id='${ent}' order by revision desc limit 1`).out;
      assert.ok(envio && pago && garantia);

      // CSV sintético: pares válidos (por fila y por entidad), uno para un problema inexistente, una fila inexistente, un refund (tipo no permitido por defecto)
      const csvPath = path.join(d, 'pares.csv');
      const filas = [
        [envio, rowOf(ids.O1), '', 1], [envio, '', ids.O2, 2], [pago, '', ids.O3a, 3], [pago, rowOf(ids.O3b), '', 4], [envio, '', ids.O4, 5],  // O4 es cancelada: vigente en el libro, se importa
        [U(777), rowOf(ids.O1), '', 6],           // problema inexistente
        [envio, U(888), '', 7],                   // fila inexistente
        [garantia, rowOf(ids.R1), '', 8],         // refund: tipo no permitido (solo order)
      ];
      fs.writeFileSync(csvPath, 'problem_id,ledger_row_id,entity_id,metodo,ticket_ref_hash\n' + filas.map(([p, r, e, n]) => `${p},${r},${e},order_id__c_hubspot,${H(n)}`).join('\n') + '\n');
      const recibos = path.join(d, 'recibos');
      const base = ['--csv', csvPath, '--recibos', recibos, '--pg-socket', sock];
      const validosOk = path.join(d, 'validos.json'); fs.writeFileSync(validosOk, JSON.stringify({validos: [envio, pago, garantia]}));
      const atestFile = path.join(d, 'atest.txt'); fs.writeFileSync(atestFile, ATEST);
      const exe = ['--execute', '--confirmar-proyecto', PROJECT_REF, '--owner', OWNER.A, '--atestacion-archivo', atestFile, '--atestacion-sha256', sha256(fs.readFileSync(atestFile, 'utf8')), '--validos', validosOk];
      const csvSha = sha256(fs.readFileSync(csvPath, 'utf8')), rdir = path.join(recibos, csvSha.slice(0, 12));
      const before = digest();

      await t.test('execute sin dry-run previo de ese csv se niega (y no escribe)', () => {
        const c = cli([...base, ...exe]); assert.notEqual(c.status, 0); assert.match(c.stderr, /dry-run previo/); assert.equal(cnt(), 0);
      });
      await t.test('dry-run (por defecto): clasifica contra la base y NO escribe nada', () => {
        const c = cli([...base, '--validos', validosOk]); assert.equal(c.status, 0, c.stderr + c.stdout);
        assert.match(c.stdout, /DRY-RUN\. Nada se escribió/);
        const r = JSON.parse(fs.readFileSync(path.join(rdir, 'dry-run-importar.json'), 'utf8'));
        assert.deepEqual(r.plan, {nuevo: 5, problema_inexistente: 1, fila_inexistente: 1, tipo_no_permitido: 1});
        assert.equal(r.accionables, 5); assert.equal(cnt(), 0); assert.equal(digest(), before);
        assert.equal(fs.statSync(path.join(rdir, 'plan-importar.json')).mode & 0o777, 0o600);
        assert.ok(!/@|email|phone/i.test(fs.readFileSync(path.join(rdir, 'plan-importar.json'), 'utf8')));
      });
      await t.test('rechazo si falta atestación / sha distinto / proyecto mal / sin validos / owner no owner / texto «SIN ATESTAR»', () => {
        const sin = exe.filter((x, i) => !(x === '--atestacion-archivo' || exe[i - 1] === '--atestacion-archivo'));
        let c = cli([...base, ...sin]); assert.notEqual(c.status, 0); assert.match(c.stderr, /atestacion-archivo/);
        c = cli([...base, ...exe.map((x, i) => exe[i - 1] === '--atestacion-sha256' ? H(9) : x)]); assert.notEqual(c.status, 0); assert.match(c.stderr, /atestacion-sha256 no coincide/);
        c = cli([...base, ...exe.map((x, i) => exe[i - 1] === '--confirmar-proyecto' ? 'otro' : x)]); assert.notEqual(c.status, 0); assert.match(c.stderr, /confirmar-proyecto/);
        const sinVal = exe.filter((x, i) => !(x === '--validos' || exe[i - 1] === '--validos'));
        c = cli([...base, ...sinVal]); assert.notEqual(c.status, 0); assert.match(c.stderr, /validos/);
        c = cli([...base, ...exe.map((x, i) => exe[i - 1] === '--owner' ? ANALYST_A : x)]); assert.notEqual(c.status, 0); assert.match(c.stderr, /OWNER_NO_ACTIVO/);
        const corto = path.join(d, 'corto.txt'); fs.writeFileSync(corto, 'firmado');
        c = cli([...base, ...exe.map((x, i) => exe[i - 1] === '--atestacion-archivo' ? corto : exe[i - 1] === '--atestacion-sha256' ? sha256('firmado') : x)]); assert.notEqual(c.status, 0); assert.match(c.stderr, /entre 20 y 3500/);
        const sinAt = path.join(d, 'sinat.txt'); const tx = 'SIN ATESTAR (dry-run): este texto no se ejecuta, relleno largo.'; fs.writeFileSync(sinAt, tx);
        c = cli([...base, ...exe.map((x, i) => exe[i - 1] === '--atestacion-archivo' ? sinAt : exe[i - 1] === '--atestacion-sha256' ? sha256(tx) : x)]); assert.notEqual(c.status, 0); assert.match(c.stderr, /SIN ATESTAR/);
        assert.equal(cnt(), 0); assert.equal(digest(), before);
      });
      await t.test('canario --max 2 escribe exactamente 2 vínculos atestados (version 1, active, actor owner, report con atestación y método)', () => {
        // el canario es otro subconjunto del csv: necesita su propio dry-run (el recibo es por csv+acción; mismo csv => ya existe)
        const c = cli([...base, ...exe, '--max', '2']); assert.equal(c.status, 0, c.stderr + c.stdout);
        assert.equal(cnt(), 2);
        assert.equal(psql(`select count(*) from public.economic_problem_links where version=1 and active and attested and actor_id='${OWNER.A}' and report like '%${ATEST.slice(0, 30)}%' and report like '%${MARCA}%' and report like '%metodo=order_id__c_hubspot%' and report like '%ticket_ref=${H(1)}]%'`).out, '1');
        assert.equal(psql(`select count(*) from public.economic_problem_links where version=1 and active and attested and actor_id='${OWNER.A}' and length(report) between 20 and 4000`).out, '2');
        assert.equal((fs.statSync(path.join(rdir, fs.readdirSync(rdir).find(f => f.startsWith('lote-')))).mode & 0o777), 0o600);
      });
      await t.test('idempotencia: reejecutar completa los 3 restantes; otra vez no cambia nada (ya_vigente) y las filas anteriores quedan intactas', () => {
        const first = psql(`select md5(string_agg(id::text||report,'|' order by id)) from public.economic_problem_links`).out;
        let c = cli([...base, '--validos', validosOk]); assert.equal(c.status, 0, c.stderr);                       // dry-run vuelve a planear
        assert.deepEqual(JSON.parse(fs.readFileSync(path.join(rdir, 'dry-run-importar.json'), 'utf8')).plan, {ya_vigente: 2, nuevo: 3, problema_inexistente: 1, fila_inexistente: 1, tipo_no_permitido: 1});
        c = cli([...base, ...exe]); assert.equal(c.status, 0, c.stderr + c.stdout); assert.equal(cnt(), 5);
        const mid = digest();
        c = cli([...base, '--validos', validosOk]); assert.equal(c.status, 0);
        c = cli([...base, ...exe]); assert.equal(c.status, 0, c.stderr + c.stdout);
        assert.equal(cnt(), 5); assert.equal(digest(), mid);
        const fin = JSON.parse(fs.readFileSync(path.join(rdir, 'recibo-importar-final.json'), 'utf8')); assert.equal(fin.escritos, 0); assert.equal(fin.accionables, 0);
        assert.equal(psql(`select count(*) from public.economic_problem_links where id in (select id from public.economic_problem_links) and version=1`).out, '5');
        assert.ok(first);
      });
      await t.test('el producto lee los vínculos como válidos (readExposure real) y no los marca como evidencia no disponible', async () => {
        const pg = (await import('pg')).default;
        const {crearBaseDatos, medirExposicion, alcance} = await import('../../packages/ai-scale/economia-problemas/snapshot.mjs');
        const pool = new pg.Pool({host: sock, user: 'postgres', database: 't', max: 2});
        try {
          const db = crearBaseDatos({pool, tenantId: TENANT_A, userId: OWNER.A, statementTimeoutMs: 60000});
          const m = await medirExposicion(db, alcance('marketplaces-usd'));
          assert.equal(m.vinculos_vigentes_validos, 5); assert.equal(m.vinculos_invalidos, 0);
          assert.equal(m.no_aditivo, true);
        } finally { await pool.end(); }
      });
      await t.test('problema no vigente (extracción fallida): se rechaza en el plan y NO recibe vínculo; con el filtro validos tampoco', () => {
        assert.ok(psql(`update public.extraction_runs set status='failed' where tenant_id='${TENANT_A}' and conversation_id='${w.convs[5].conv.conversation_id}'`).ok);
        const csv2 = path.join(d, 'nv.csv'); fs.writeFileSync(csv2, `problem_id,ledger_row_id,metodo,ticket_ref_hash\n${garantia},${rowOf(ids.O1)},order_id__c_hubspot,${H(20)}\n${pago},${rowOf(ids.O2)},order_id__c_hubspot,${H(21)}\n`);
        const b2 = ['--csv', csv2, '--recibos', recibos, '--pg-socket', sock];
        let c = cli([...b2, '--validos', validosOk]); assert.equal(c.status, 0, c.stderr);
        const dr = JSON.parse(fs.readFileSync(path.join(recibos, sha256(fs.readFileSync(csv2, 'utf8')).slice(0, 12), 'dry-run-importar.json'), 'utf8'));
        assert.deepEqual(dr.plan, {problema_no_vigente: 1, nuevo: 1});
        const antes = cnt();
        c = cli([...b2, ...exe]); assert.equal(c.status, 0, c.stderr + c.stdout); assert.equal(cnt(), antes + 1);   // solo el del problema vigente
        assert.equal(psql(`select count(*) from public.economic_problem_links where problem_id='${garantia}'`).out, '0');
        // fuera del archivo de validos aunque la base lo considere vigente: tampoco
        fs.writeFileSync(validosOk + '.2', JSON.stringify({validos: [envio]}));
        const csv3 = path.join(d, 'fv.csv'); fs.writeFileSync(csv3, `problem_id,ledger_row_id,metodo,ticket_ref_hash\n${pago},${rowOf(ids.O1)},order_id__c_hubspot,${H(30)}\n`);
        c = cli(['--csv', csv3, '--recibos', recibos, '--pg-socket', sock, '--validos', validosOk + '.2']); assert.equal(c.status, 0);
        assert.deepEqual(JSON.parse(fs.readFileSync(path.join(recibos, sha256(fs.readFileSync(csv3, 'utf8')).slice(0, 12), 'dry-run-importar.json'), 'utf8')).plan, {problema_fuera_de_validos: 1});
        assert.ok(psql(`update public.extraction_runs set status='succeeded' where tenant_id='${TENANT_A}' and conversation_id='${w.convs[5].conv.conversation_id}'`).ok);
      });
      await t.test('conflicto de versión: si otro proceso escribió entre el plan y el lote, el lote se ABORTA completo (sin parciales)', () => {
        const rep = ATEST + ' ' + MARCA + ' lote=zz metodo=m ticket_ref=' + H(1) + ']';
        const items = [{problemId: pago, entityId: ids.O4, rowId: rowOf(ids.O4), expected: 0, report: rep},          // válido y nuevo
                       {problemId: envio, entityId: ids.O1, rowId: rowOf(ids.O1), expected: 0, report: rep}];        // ya existe en v1 => expected 0 es obsoleto
        const antes = cnt(), out = path.join(d, 'lote.sql'); fs.writeFileSync(out, loteSql({owner: OWNER.A, items, activo: true, etiqueta: 'importar-9999'}));
        const r = spawnSync('psql', ['-h', sock, '-U', 'postgres', '-d', 't', '-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-f', out], {encoding: 'utf8'});
        assert.notEqual(r.status, 0); assert.match(r.stderr, /VINCULOS_LOTE_ABORTADO/); assert.equal(cnt(), antes);
        assert.equal(psql(`select count(*) from public.economic_problem_links where problem_id='${pago}' and entity_id='${ids.O4}'`).out, '0'); // el válido tampoco entró
      });
      await t.test('reversa: desactiva (versión+1, active=false) solo lo creado por el importador; no borra; idempotente; no toca un vínculo manual', async () => {
        // vínculo "manual" (sin la marca del importador) hecho con el producto
        const {createExposureRepository} = await import('../../packages/metrics/exposure.mjs');
        const pg = (await import('pg')).default; const {crearBaseDatos} = await import('../../packages/ai-scale/economia-problemas/snapshot.mjs');
        const pool = new pg.Pool({host: sock, user: 'postgres', database: 't', max: 2});
        let manualRow;
        try {
          const db = crearBaseDatos({pool, tenantId: TENANT_A, userId: OWNER.A, statementTimeoutMs: 60000});
          manualRow = rowOf(ids.O1);
          await createExposureRepository({database: db}).record({problemId: pago, ledgerRowId: manualRow, expectedVersion: 0, active: true, report: 'SYN vínculo manual hecho con el producto, sin la marca del importador.', attested: true});
        } finally { await pool.end(); }
        const total = cnt(), activos = +psql(`select count(*) from (select distinct on(problem_id,entity_id) active from public.economic_problem_links order by problem_id,entity_id,version desc) x where active`).out;
        // csv de reversa: los 5 originales + el manual + uno que nunca existió
        const csvR = path.join(d, 'rev.csv');
        const lin = filas.slice(0, 5).map(([p, r, e, n]) => `${p},${r},${e},order_id__c_hubspot,${H(n)}`);
        fs.writeFileSync(csvR, 'problem_id,ledger_row_id,entity_id,metodo,ticket_ref_hash\n' + [...lin, `${pago},${manualRow},,order_id__c_hubspot,${H(40)}`, `${garantia},,${ids.O1},order_id__c_hubspot,${H(41)}`].join('\n') + '\n');
        const bR = ['--csv', csvR, '--recibos', recibos, '--pg-socket', sock, '--accion', 'revertir'];
        let c = cli(bR); assert.equal(c.status, 0, c.stderr);
        const dr = JSON.parse(fs.readFileSync(path.join(recibos, sha256(fs.readFileSync(csvR, 'utf8')).slice(0, 12), 'dry-run-revertir.json'), 'utf8'));
        assert.deepEqual(dr.plan, {revertir: 5, no_creado_por_importador: 1, sin_vinculo: 1}); assert.equal(cnt(), total);
        c = cli([...bR, ...exe]); assert.equal(c.status, 0, c.stderr + c.stdout);
        assert.equal(cnt(), total + 5);                                                                                  // nada se borra: 5 versiones nuevas
        assert.equal(psql(`select count(*) from public.economic_problem_links where version=2 and not active`).out, '5');
        const nuevoActivos = +psql(`select count(*) from (select distinct on(problem_id,entity_id) active from public.economic_problem_links order by problem_id,entity_id,version desc) x where active`).out;
        assert.equal(nuevoActivos, activos - 5);                                                                          // el manual sigue activo
        assert.equal(psql(`select active from public.economic_problem_links where problem_id='${pago}' and entity_id='${ids.O1}' order by version desc limit 1`).out, 't');
        const d2 = digest(); c = cli(bR); c = cli([...bR, ...exe]); assert.equal(c.status, 0); assert.equal(digest(), d2);   // reversa idempotente (ya_inactivo)
        // se puede volver a importar tras revertir (reactivar: versión 3)
        c = cli([...base, '--validos', validosOk]); assert.equal(c.status, 0);
        assert.equal(JSON.parse(fs.readFileSync(path.join(rdir, 'dry-run-importar.json'), 'utf8')).plan.reactivar, 5);
        c = cli([...base, ...exe]); assert.equal(c.status, 0, c.stderr + c.stdout);
        assert.equal(psql(`select count(*) from public.economic_problem_links where version=3 and active`).out, '5');
      });
      await t.test('--sin-set-role: mismo resultado sin cambiar de rol (los triggers siguen exigiendo owner)', () => {
        const csvS = path.join(d, 'sr.csv'); fs.writeFileSync(csvS, `problem_id,ledger_row_id,metodo,ticket_ref_hash\n${garantia},${rowOf(ids.O2)},order_id__c_hubspot,${H(60)}\n`);
        const bS = ['--csv', csvS, '--recibos', recibos, '--pg-socket', sock, '--validos', validosOk]; const antes = cnt();
        let c = cli(bS); assert.equal(c.status, 0, c.stderr);
        c = cli([...bS, ...exe, '--sin-set-role']); assert.equal(c.status, 0, c.stderr + c.stdout); assert.equal(cnt(), antes + 1);
        assert.ok(!/set local role/.test(fs.readFileSync(path.join(recibos, sha256(fs.readFileSync(csvS, 'utf8')).slice(0, 12), 'lote-importar-0001.sql'), 'utf8')));
        // un analista (no owner) no puede escribir ni sin cambio de rol: lo frena el contexto/trigger
        const csvA = path.join(d, 'an.csv'); fs.writeFileSync(csvA, `problem_id,ledger_row_id,metodo,ticket_ref_hash\n${garantia},${rowOf(ids.O3a)},order_id__c_hubspot,${H(61)}\n`);
        const bA = ['--csv', csvA, '--recibos', recibos, '--pg-socket', sock, '--validos', validosOk]; cli(bA);
        c = cli([...bA, ...exe.map((x, i) => exe[i - 1] === '--owner' ? ANALYST_A : x), '--sin-set-role']); assert.notEqual(c.status, 0); assert.equal(cnt(), antes + 1);
      });
      await t.test('--tope-total-s se valida como entero positivo', () => {
        const csvT = path.join(d, 'tope.csv'); fs.writeFileSync(csvT, `problem_id,ledger_row_id,metodo,ticket_ref_hash\n${pago},${rowOf(ids.O2)},order_id__c_hubspot,${H(50)}\n`);
        const c = cli(['--csv', csvT, '--recibos', recibos, '--pg-socket', sock, '--tope-total-s', '0']); assert.notEqual(c.status, 0); assert.match(c.stderr, /entero positivo/);
      });
    });
  } finally { fs.rmSync(d, {recursive: true, force: true}); }
});
