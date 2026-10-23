import test from 'node:test';
import assert from 'node:assert/strict';
import {crearVigilante, INTERVALO_MS, MAX_RETROCESO_MS} from '../../src/lib/workspace/vivos.mjs';

// Reloj y temporizadores falsos: los pendientes se ejecutan a mano.
function mundo({respuestas, visible = true} = {}) {
  const w = {t: 0, timers: [], visible, llamadas: 0, eventos: [], estados: []};
  w.setT = (fn, ms) => { const x = {fn, at: w.t + ms, ms, vivo: true}; w.timers.push(x); return x; };
  w.clearT = x => { if (x) x.vivo = false; };
  w.fetchFn = async () => { const r = respuestas[Math.min(w.llamadas++, respuestas.length - 1)]; if (r instanceof Error) throw r; return {status: r.status ?? 200, ok: (r.status ?? 200) < 300, json: async () => r.body}; };
  w.avanzar = async ms => { w.t += ms; for (const x of w.timers.filter(x => x.vivo && x.at <= w.t)) { x.vivo = false; x.fn(); await new Promise(r => setImmediate(r)); } };
  w.pendientes = () => w.timers.filter(x => x.vivo);
  w.v = crearVigilante({fetchFn: w.fetchFn, visible: () => w.visible, onCambio: e => w.eventos.push(e), onEstado: e => w.estados.push(e), ahora: () => w.t, setT: w.setT, clearT: w.clearT});
  return w;
}
const ok = version => ({body: {data: {availability: 'ready', version, sources: [{key: 'hubspot'}], insights: []}}});
const flush = () => new Promise(r => setImmediate(r));

test('línea base sin aviso; cambia la versión => un solo aviso; reconocer rearma', async () => {
  const w = mundo({respuestas: [ok('a'.repeat(16)), ok('a'.repeat(16)), ok('b'.repeat(16)), ok('b'.repeat(16)), ok('c'.repeat(16))]});
  w.v.iniciar(); await flush(); assert.equal(w.eventos.length, 0);
  await w.avanzar(INTERVALO_MS); assert.equal(w.eventos.length, 0);
  await w.avanzar(INTERVALO_MS); assert.equal(w.eventos.length, 1); assert.equal(w.eventos[0].version, 'b'.repeat(16)); assert.equal(w.eventos[0].anterior, 'a'.repeat(16)); assert.deepEqual(w.eventos[0].fuentes, [{key: 'hubspot'}]);
  await w.avanzar(INTERVALO_MS); assert.equal(w.eventos.length, 1, 'no repite el aviso');
  w.v.reconocer(); await w.avanzar(INTERVALO_MS); assert.equal(w.eventos.length, 2, 'c es nueva respecto a b');
});
test('retroceso exponencial con tope y recuperación; los fallos nunca avisan', async () => {
  const w = mundo({respuestas: [ok('a'.repeat(16)), new Error('red'), new Error('red'), {status: 503}, new Error('x'), new Error('x'), new Error('x'), new Error('x'), new Error('x'), ok('a'.repeat(16))]});
  w.v.iniciar(); await flush();
  const esperas = [];
  for (let i = 0; i < 8; i++) { await w.avanzar(w.pendientes()[0].at - w.t); esperas.push(w.v.estado().espera); }
  assert.deepEqual(esperas.slice(0, 3), [INTERVALO_MS * 2, INTERVALO_MS * 4, INTERVALO_MS * 8]); assert.equal(Math.max(...esperas), MAX_RETROCESO_MS); assert.equal(w.eventos.length, 0);
  await w.avanzar(w.pendientes()[0].at - w.t); assert.equal(w.v.estado().espera, INTERVALO_MS, 'una lectura buena reinicia el ritmo'); assert.equal(w.v.estado().fallos, 0);
});
test('solo con la pestaña visible: oculta cancela el temporizador; al volver consulta si ya pasó el intervalo', async () => {
  const w = mundo({respuestas: [ok('a'.repeat(16)), ok('b'.repeat(16))]});
  w.v.iniciar(); await flush(); assert.equal(w.pendientes().length, 1);
  w.visible = false; w.v.visibilidad(); assert.equal(w.pendientes().length, 0); const n = w.llamadas;
  w.t += 10 * INTERVALO_MS; w.visible = true; w.v.visibilidad(); await flush(); assert.equal(w.llamadas, n + 1); assert.equal(w.eventos.length, 1);
});
test('401/403/404 detienen la vigilancia; respuesta sin datos o mal formada no avisa ni insiste en rápido', async () => {
  for (const status of [401, 403, 404]) { const w = mundo({respuestas: [{status}]}); w.v.iniciar(); await flush(); assert.equal(w.v.estado().parado, true); assert.equal(w.pendientes().length, 0); }
  const w = mundo({respuestas: [{body: {data: {availability: 'unavailable', version: null}}}, {body: {data: {availability: 'ready', version: 'ZZ'}}}, {body: null}]});
  w.v.iniciar(); await flush(); await w.avanzar(INTERVALO_MS); await w.avanzar(INTERVALO_MS); assert.equal(w.eventos.length, 0); assert.equal(w.v.estado().base, null);
});
test('detener cancela todo y no hay consultas simultáneas', async () => {
  const w = mundo({respuestas: [ok('a'.repeat(16))]}); w.v.iniciar(); w.v.iniciar(); await flush(); assert.equal(w.llamadas, 1);
  w.v.detener(); assert.equal(w.pendientes().length, 0);
});
