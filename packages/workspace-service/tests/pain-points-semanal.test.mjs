// Reporte semanal (L5): comparación nuevos/crecientes, armado del correo sin IA nueva, vista previa por defecto, envío apagado, baja respetada. Base y envío SIMULADOS.
//   node --test packages/workspace-service/tests/pain-points-semanal.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {comparar, foto, construirInformeSemanal, createWeeklyService, semanaCubierta, lunesDe, montoCorto, limpiarTexto} from '../pain-points-semanal.mjs';
import {PROMPT_VERSION} from '../pain-points-ia.mjs';
import {renderWeeklyReport} from '../../notifications/email-weekly.mjs';
import {verificarBaja} from '../../notifications/baja-semanal.mjs';
import {vistaSimulada} from './ia-ayudas.mjs';

const SECRET = 's'.repeat(40), TENANT = '11111111-1111-1111-1111-111111111111', ORIGIN = 'https://app.rovaq.ai';
const U1 = 'aaaaaaaa-0000-0000-0000-000000000001', U2 = 'aaaaaaaa-0000-0000-0000-000000000002';
const HOY = new Date('2026-10-26T14:00:00Z'); // lunes
const urls = {informe: ORIGIN + '/pain-points', metodo: ORIGIN + '/confianza', preferencias: ORIGIN + '/settings/notifications', baja: ORIGIN + '/api/baja?t=v1.x.y'};

test('semana: el lunes cubre la semana anterior completa; la clave de idempotencia es el lunes UTC', () => {
  assert.equal(lunesDe(new Date('2026-10-28T10:00:00Z')).toISOString().slice(0, 10), '2026-10-26');
  assert.equal(lunesDe(new Date('2026-11-01T23:59:00Z')).toISOString().slice(0, 10), '2026-10-26');
  const s = semanaCubierta(HOY); assert.deepEqual([s.desde, s.hasta, s.rango, s.rangoCorto], ['2026-10-19', '2026-10-25', '19 al 25 de octubre de 2026', '19–25 oct']);
  assert.equal(semanaCubierta(new Date('2026-11-02T10:00:00Z')).rangoCorto, '26 oct–1 nov');
  assert.equal(montoCorto(4567), '$4.6k'); assert.equal(montoCorto(1_234_000), '$1.23 M'); assert.equal(montoCorto(812), '$812');
});

test('comparar: nuevo, creciente (≥10 %), sin cambio, «no disponible» de antes NO es nuevo y el primer reporte no declara nada', () => {
  const v = vistaSimulada(); // P1 = 1500.00, P2 = 4567.00
  assert.deepEqual(comparar(v, null), {primera: true, items: []});
  const f = foto(v);
  assert.deepEqual(comparar(v, f).items, [], 'misma foto: sin novedades');
  const sinP1 = f.filter(x => x.id !== 'P1'); const c1 = comparar(v, sinP1).items;
  assert.deepEqual(c1.map(i => [i.id, i.estado]), [['P1', 'nuevo']]);
  const noDisp = f.map(x => x.id === 'P1' ? {...x, minor: null, causa: 'no_disponible'} : x); assert.deepEqual(comparar(v, noDisp).items, [], 'antes desconocido por falla: no se llama nuevo');
  const sinFuente = f.map(x => x.id === 'P1' ? {...x, minor: null, causa: 'sin_fuente'} : x); assert.equal(comparar(v, sinFuente).items[0].estado, 'nuevo');
  const crece = f.map(x => x.id === 'P2' ? {...x, minor: '300000'} : x); const cc = comparar(v, crece).items; assert.equal(cc[0].estado, 'crece'); assert.equal(cc[0].deltaPct, 52.2);
  const casi = f.map(x => x.id === 'P2' ? {...x, minor: '420000'} : x); assert.deepEqual(comparar(v, casi).items, [], '8.7 %: no llega al umbral');
  const cero = f.map(x => x.id === 'P2' ? {...x, minor: '0'} : x); assert.deepEqual(comparar(v, cero).items, [], 'base 0: no se divide');
});

const corrida = (id, extra = {}) => ({id: 'r', puntoId: id, estado: 'completo', consenso: {estado: 'acuerdo'}, lecturas: [
  {rol: 'causa_raiz', estado: 'ok', contenido: {lectura: 'El cierre manual es lento. Además hay rezago.', severidad: 'alta', confianza: 0.7}},
  {rol: 'accion', estado: 'ok', contenido: {propuesta: {titulo: 'Asignar un responsable para cerrar pendientes', pasos: ['Revisar'], evidencia: 'Filas', ejecucion: 'ninguna_hasta_orden'}}}], ...extra});

test('informe: ingreso y «sin respuesta» salen «—» (unknown ≠ 0); reembolsos solo con anterior; la IA entra solo si ya hay lectura guardada', () => {
  const v = vistaSimulada();
  const base = {vista: v, espacio: 'Clientex', rol: 'Propietario', hoy: HOY, appOrigin: ORIGIN, urls};
  const a = construirInformeSemanal({...base, anterior: null});
  assert.equal(a.input.ingreso.valor, null); assert.equal(a.input.vencidas.valor, null); assert.equal(a.input.reembolsos.valor, null);
  assert.match(a.input.fraseClave, /Primer reporte/); assert.equal(a.input.accion, undefined); assert.equal(a.input.lecturaIA, undefined); assert.equal(a.resumen.primera, true);
  const m = renderWeeklyReport(a.input);
  assert.match(m.text, /Ingreso bruto\s+—/); assert.match(m.text, /sin dato de ingresos/); assert.doesNotMatch(m.html + m.text, /Lectura de IA/, 'sin lectura guardada no hay sección de IA');
  assert.match(m.text, /Todas las cifras son ingreso bruto, no margen/);
  const sin = construirInformeSemanal({...base, anterior: foto(v).filter(x => x.id !== 'P1')});
  assert.deepEqual(sin.input.puntosNuevos, [{label: 'Reembolsos negados o vencidos (Tracker)', valor: 'Nuevo · $1.5k'}]);
  const conIA = construirInformeSemanal({...base, anterior: foto(v), corridas: new Map([['P2', corrida('P2')]])});
  assert.equal(conIA.input.accionClase, 'inferido'); assert.equal(conIA.input.accion.titulo, 'Asignar un responsable para cerrar pendientes');
  assert.match(conIA.input.lecturaIA.titulo, /las tres lecturas coinciden/); assert.equal(conIA.input.lecturaIA.resumen, 'El cierre manual es lento.');
  const mail = renderWeeklyReport(conIA.input);
  assert.match(mail.text, /Lectura de IA/i); assert.match(mail.text, /Inferido por IA/); assert.match(mail.html, /inferidas/); assert.match(mail.text, /Acción recomendada/i);
  assert.match(mail.headers['List-Unsubscribe'], /api\/baja/); assert.equal(mail.headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
  assert.equal(conIA.input.sinCambios, true); assert.match(mail.subject, /^Reporte semanal · 19–25 oct/);
  // chip de «atorado» frente a la semana anterior
  const crece = construirInformeSemanal({...base, anterior: foto(v).map(x => x.id === 'P2' ? {...x, minor: '300000'} : x)}); assert.equal(crece.input.atorado.delta, 52.23); assert.equal(crece.input.atorado.valor, 4567);
});
test('un texto de IA con PII, marcado o direcciones no entra al correo', () => {
  assert.equal(limpiarTexto('Escribe a ana@x.com', 100), null); assert.equal(limpiarTexto('Llamar 55 1234 5678', 100), null); assert.equal(limpiarTexto('Ver https://x.com/a', 100), null);
  assert.equal(limpiarTexto('**negrita** [x] {y}', 100), 'negrita x y'); assert.equal(limpiarTexto('a'.repeat(200), 50).length, 50);
  const v = vistaSimulada(); const mala = corrida('P2'); mala.lecturas[1].contenido.propuesta.titulo = 'Contactar a maria@correo.com';
  const r = construirInformeSemanal({vista: v, anterior: foto(v), corridas: new Map([['P2', mala]]), espacio: 'Clientex', rol: 'Analista', hoy: HOY, appOrigin: ORIGIN, urls});
  assert.equal(r.input.accion, undefined, 'sin acción antes que una con PII');
});

/** Base simulada con la misma semántica que las funciones SQL del reporte (idempotencia, baja, estados). */
function baseSim({destinatarios = [{userId: U1, role: 'owner'}, {userId: U2, role: 'analyst'}], bajas = new Set(), previa = null, bajaTrasRegistrar = new Set()} = {}) {
  const filas = new Map(), llamadas = [];
  const database = {async transaction(accion, cb) {
    llamadas.push(accion);
    return cb({tenantId: TENANT, async query(sql, args = []) {
      if (/FROM public\.weekly_report_outbox WHERE tenant_id=\$1 AND week_start</.test(sql)) return {rows: previa ? [{snapshot: previa}] : []};
      if (/SELECT subject,html,body_text/.test(sql)) { const f = [...filas.values()].find(x => x.id === args[1]); return {rows: [{subject: f.subject, html: f.html, body_text: f.text}]}; }
      const fnm = /public\.(\w+)\(/.exec(sql)?.[1];
      if (fnm === 'weekly_recipients') return {rows: [{r: destinatarios.filter(d => !bajas.has(d.userId))}]};
      if (fnm === 'weekly_report_record') { const p = JSON.parse(args[1]); if (bajas.has(p.userId)) return {rows: [{r: {inserted: false, reason: 'baja'}}]}; const k = p.weekStart + '|' + p.userId; if (filas.has(k)) return {rows: [{r: {inserted: false, reason: 'ya_existe', id: filas.get(k).id}}]}; const f = {id: 'id-' + (filas.size + 1), state: 'preview', ...p}; filas.set(k, f); if (bajaTrasRegistrar.has(p.userId)) bajas.add(p.userId); return {rows: [{r: {inserted: true, id: f.id}}]}; }
      if (fnm === 'weekly_report_claim') { const f = [...filas.values()].find(x => x.id === args[1]); if (f.state !== 'preview') return {rows: [{r: {send: false, reason: f.state}}]}; if (bajas.has(f.userId)) { f.state = 'suppressed'; return {rows: [{r: {send: false, reason: 'baja'}}]}; } f.state = 'sending'; return {rows: [{r: {send: true}}]}; }
      if (fnm === 'weekly_report_mark') { const f = [...filas.values()].find(x => x.id === args[1]); if (f.state === 'sending') f.state = args[2]; return {rows: [{r: null}]}; }
      throw Error('SQL inesperado: ' + sql);
    }});
  }};
  return {database, filas, llamadas, bajas};
}
const mkSvc = (o = {}) => {
  const sim = o.sim ?? baseSim(), spy = {buscar: 0, ultimo: 0, otros: []};
  const store = new Proxy({async buscarRun() { spy.buscar++; return null; }, async ultimoRun() { spy.ultimo++; return null; }}, {get(t, k) { if (k in t) return t[k]; spy.otros.push(String(k)); return () => { throw Error('el reporte no debe usar ' + String(k)); }; }});
  const enviados = [];
  const entregar = 'entregar' in o ? o.entregar : async m => { enviados.push(m); return {ok: true, providerId: 'p'}; };
  const svc = createWeeklyService({database: sim.database, tenantId: TENANT, vista: async () => vistaSimulada(), store, entregar, enviarActivo: o.enviarActivo ?? false, secret: 'secret' in o ? o.secret : SECRET, appOrigin: ORIGIN, nombreEspacio: 'Clientex', now: () => HOY});
  return {svc, sim, spy, enviados};
};

test('por defecto: vista previa registrada en el outbox SIN enviar (aunque exista un transporte); idempotente por semana y destinatario', async () => {
  const {svc, sim, enviados, spy} = mkSvc({enviarActivo: false});
  const r = await svc.ejecutar();
  assert.equal(r.enviarActivo, false); assert.equal(r.destinatarios, 2); assert.equal(r.registrados, 2); assert.equal(r.enviados, 0); assert.equal(enviados.length, 0);
  assert.ok([...sim.filas.values()].every(f => f.state === 'preview' && f.weekStart === '2026-10-26'));
  assert.deepEqual(spy.otros, [], 'no usa nada de IA salvo leer lo ya guardado'); assert.ok(spy.buscar > 0);
  const r2 = await svc.ejecutar(); assert.equal(r2.registrados, 0); assert.equal(r2.yaExistian, 2); assert.equal(sim.filas.size, 2);
  const [a] = [...sim.filas.values()];
  assert.match(a.subject, /^Reporte semanal/); assert.match(a.html, /\/api\/baja\?t=v1\./); assert.doesNotMatch((a.html + a.text).replaceAll('soporte@rovaq.ai', ''), /[\w.]+@[\w.]+\.\w{2,}/, 'sin correos de personas en la vista previa (solo el buzón de soporte de la plantilla)');
});
test('cada correo trae SU enlace de baja de un clic, verificable y de vigencia larga', async () => {
  const {svc, sim} = mkSvc(); await svc.ejecutar();
  for (const f of sim.filas.values()) {
    const token = /api\/baja\?t=(v1\.[A-Za-z0-9_.-]+)/.exec(f.html)[1];
    const v = verificarBaja({secret: SECRET, token, now: new Date(HOY.getTime() + 300 * 86400000)});
    assert.deepEqual([v.ok, v.tenantId, v.userId], [true, TENANT, f.userId]);
  }
});
test('con el flag encendido envía una vez por destinatario y no reenvía en la misma semana; el HTML enviado es el guardado', async () => {
  const {svc, sim, enviados} = mkSvc({enviarActivo: true});
  const r = await svc.ejecutar(); assert.equal(r.enviados, 2); assert.equal(enviados.length, 2);
  assert.ok([...sim.filas.values()].every(f => f.state === 'sent'));
  assert.equal(enviados[0].html, [...sim.filas.values()][0].html); assert.equal(enviados[0].headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click'); assert.match(enviados[0].idempotencyKey, /^[0-9a-f]{64}$/);
  assert.notEqual(enviados[0].idempotencyKey, enviados[1].idempotencyKey);
  const r2 = await svc.ejecutar(); assert.equal(r2.enviados, 0); assert.equal(enviados.length, 2);
});
test('la baja se respeta al registrar y al enviar; un fallo del transporte queda «failed» sin romper el ciclo', async () => {
  const sim = baseSim({bajas: new Set([U2])}); const m = mkSvc({sim, enviarActivo: true});
  const r = await m.svc.ejecutar(); assert.equal(r.destinatarios, 1); assert.equal(r.enviados, 1); assert.deepEqual(m.enviados.map(e => e.userId), [U1]);
  // baja ENTRE la vista previa y el envío
  const s2 = baseSim({bajaTrasRegistrar: new Set([U1])}); const race = mkSvc({sim: s2, enviarActivo: true});
  const r2 = await race.svc.ejecutar(); assert.equal(r2.suprimidos, 1); assert.deepEqual(race.enviados.map(e => e.userId), [U2]); assert.equal([...s2.filas.values()].find(f => f.userId === U1).state, 'suppressed');
  const f = mkSvc({enviarActivo: true, entregar: async () => { throw Error('red'); }}); const r3 = await f.svc.ejecutar(); assert.equal(r3.fallidos, 2); assert.ok([...f.sim.filas.values()].every(x => x.state === 'failed'));
  const g = mkSvc({enviarActivo: true, entregar: async () => ({ok: false, motivo: 'rechazado'})}); assert.equal((await g.svc.ejecutar()).fallidos, 2);
});
test('sin secreto de baja no se genera nada (todo correo exige su enlace) y sin transporte el flag no envía', async () => {
  const sinSecreto = mkSvc({secret: undefined}); await assert.rejects(() => sinSecreto.svc.ejecutar(), e => e.code === 'weekly_unsubscribe_unconfigured' && e.status === 503); assert.equal(sinSecreto.sim.filas.size, 0);
  const sinTransporte = mkSvc({enviarActivo: true, entregar: null}); const r = await sinTransporte.svc.ejecutar(); assert.equal(r.enviarActivo, false); assert.equal(r.enviados, 0); assert.equal(r.registrados, 2);
  const comparado = mkSvc({sim: baseSim({previa: foto(vistaSimulada()).filter(x => x.id !== 'P1')})}); const rc = await comparado.svc.ejecutar(); assert.equal(rc.nuevos, 1); assert.equal(rc.primera, false);
});
