// T48: el reporte semanal sale en el idioma PREFERIDO de cada destinatario (user_preferences). Sin fila o sin la tabla: español (respaldo documentado: un worker no tiene Accept-Language).
//   node --test packages/workspace-service/tests/pain-points-semanal-idioma.test.mjs
// Base y transporte SIMULADOS: no se envía ni se programa ningún correo.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createWeeklyService} from '../pain-points-semanal.mjs';
import {vistaSimulada} from './ia-ayudas.mjs';

const SECRET = 's'.repeat(40), TENANT = '11111111-1111-4111-8111-111111111111', ORIGIN = 'https://app.rovaq.ai';
const U1 = 'aaaaaaaa-0000-4000-8000-000000000001', U2 = 'aaaaaaaa-0000-4000-8000-000000000002', U3 = 'aaaaaaaa-0000-4000-8000-000000000003';
const HOY = new Date('2026-10-26T14:00:00Z');
const ESPANOL = /[áéíóúñÁÉÍÓÚÑ¿¡]|Reporte semanal|Dejar de recibir/;

function base({destinatarios, preferencias = [], tablaAusente = false}) {
  const filas = new Map(), consultasDeIdioma = [];
  const database = {async transaction(accion, cb) {
    return cb({tenantId: TENANT, async query(sql, args = []) {
      if (/FROM public\.user_preferences/.test(sql)) { consultasDeIdioma.push({accion, ids: args[0]}); if (tablaAusente) throw Error('relation "public.user_preferences" does not exist'); return {rows: preferencias.filter(p => args[0].includes(p.user_id))}; }
      if (/FROM public\.weekly_report_outbox WHERE tenant_id=\$1 AND week_start</.test(sql)) return {rows: []};
      const fnm = /public\.(\w+)\(/.exec(sql)?.[1];
      if (fnm === 'weekly_recipients') return {rows: [{r: destinatarios}]};
      if (fnm === 'weekly_report_record') { const p = JSON.parse(args[1]); filas.set(p.userId, p); return {rows: [{r: {inserted: true, id: 'id-' + p.userId}}]}; }
      throw Error('SQL inesperado: ' + sql);
    }});
  }};
  return {database, filas, consultasDeIdioma};
}
const idiomasPedidos = [];
const servicio = (sim, o = {}) => createWeeklyService({database: sim.database, tenantId: TENANT, vista: async lang => { idiomasPedidos.push(lang); return vistaSimulada(lang); }, store: {buscarRun: async () => null, ultimoRun: async () => null}, secret: SECRET, appOrigin: ORIGIN, now: () => HOY, ...o});

test('cada destinatario recibe el reporte en SU idioma preferido; el enlace de baja lleva ese idioma; sin fila, español', async () => {
  const sim = base({destinatarios: [{userId: U1, role: 'owner'}, {userId: U2, role: 'analyst'}, {userId: U3, role: 'analyst'}], preferencias: [{user_id: U1, idioma: 'en'}, {user_id: U2, idioma: 'es'}]});
  const r = await servicio(sim).ejecutar();
  assert.equal(r.registrados, 3);
  const en = sim.filas.get(U1), es = sim.filas.get(U2), sinFila = sim.filas.get(U3);
  assert.match(en.subject, /^Weekly report/); assert.doesNotMatch(en.subject + en.html + en.text, ESPANOL); assert.match(en.html, /<html lang="en-US"/);
  assert.doesNotMatch(en.html + en.text, /reembolsos|Reembolsos|pendientes/, 'los nombres de los puntos de dolor también salen en inglés');
  assert.ok(idiomasPedidos.includes('en') && idiomasPedidos.includes('es'), 'la vista se pide en el idioma de cada destinatario: ' + idiomasPedidos);
  assert.match(es.subject, /^Reporte semanal/); assert.match(es.html, /<html lang="es-MX"/);
  assert.match(sinFila.subject, /^Reporte semanal/);
  assert.match(en.html, /\/api\/baja\?t=v1\.[\w.-]+&amp;lang=en/); assert.match(es.html, /\/api\/baja\?t=v1\.[\w.-]+&amp;lang=es/); assert.match(sinFila.html, /\/api\/baja\?t=v1\.[\w.-]+&amp;lang=es/);
  assert.match(en.text, /WEEKLY REPORT/i); assert.doesNotMatch(en.text, ESPANOL);
  assert.equal(sim.consultasDeIdioma.length, 1, 'una sola lectura de idiomas por organización'); assert.equal(sim.consultasDeIdioma[0].accion, 'read');
  assert.deepEqual(sim.consultasDeIdioma[0].ids, [U1, U2, U3]);
});

test('sin la tabla (migración sin aplicar) el ciclo completo sigue y todo sale en español', async () => {
  const sim = base({destinatarios: [{userId: U1, role: 'owner'}, {userId: U2, role: 'analyst'}], tablaAusente: true});
  const r = await servicio(sim).ejecutar();
  assert.equal(r.registrados, 2); assert.equal(sim.consultasDeIdioma.length, 1);
  for (const f of sim.filas.values()) { assert.match(f.subject, /^Reporte semanal/); assert.match(f.html, /<html lang="es-MX"/); }
});

test('un idioma que trae el destinatario manda sobre la preferencia; el idioma del servicio es el respaldo cuando no hay fila', async () => {
  const sim = base({destinatarios: [{userId: U1, role: 'owner', idioma: 'es'}, {userId: U2, role: 'analyst'}], preferencias: [{user_id: U1, idioma: 'en'}]});
  await servicio(sim, {idioma: 'en'}).ejecutar();
  assert.match(sim.filas.get(U1).subject, /^Reporte semanal/, 'd.idioma del destinatario manda');
  assert.match(sim.filas.get(U2).subject, /^Weekly report/, 'sin fila: idioma del servicio');
});

test('el nombre de espacio por omisión no deja español en un reporte en inglés', async () => {
  const sim = base({destinatarios: [{userId: U1, role: 'owner'}], preferencias: [{user_id: U1, idioma: 'en'}]});
  await servicio(sim, {nombreEspacio: 'tu espacio'}).ejecutar();
  const f = sim.filas.get(U1);
  assert.doesNotMatch(f.html + f.text, /tu espacio/); assert.match(f.html + f.text, /your workspace/i);
});

test('el servidor del reporte no fija el idioma: usa la preferencia (y «es» como respaldo documentado)', async () => {
  const fs = await import('node:fs');
  const srv = fs.readFileSync(new URL('../../../apps/web/src/lib/weekly/server.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(srv, /idioma\s*:\s*'(es|en)'/);
  const svc = fs.readFileSync(new URL('../pain-points-semanal.mjs', import.meta.url), 'utf8');
  assert.match(svc, /idiomasDePersonas\(database, destinatarios\.map/);
  assert.match(svc, /d\.idioma \?\? preferencias\.get\(/);
});
