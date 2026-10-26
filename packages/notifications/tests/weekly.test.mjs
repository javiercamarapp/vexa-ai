// Disparador interno /api/internal/weekly y entrega semanal: secreto, métodos, cuerpo, ciclo único, flag apagado. Todo simulado.
//   node --test packages/notifications/tests/weekly.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {createWeeklyHostedHandler} from '../weekly-hosted.mjs';
import {crearEntregaSemanal, entregaDesdeEntorno} from '../weekly-send.mjs';

const SECRET = 'w'.repeat(40), auth = {authorization: 'Bearer ' + SECRET};
const req = (o = {}) => new Request('https://app.rovaq.ai/api/internal/weekly' + (o.qs ?? ''), {method: o.method ?? 'POST', headers: o.headers ?? auth, body: o.body});

test('autenticación: sin secreto configurado 503; sin bearer o con uno incorrecto 401; nunca ejecuta', async () => {
  let n = 0; const ejecutar = async () => { n++; return {}; };
  assert.equal((await createWeeklyHostedHandler({secret: undefined, ejecutar})(req())).status, 503);
  assert.equal((await createWeeklyHostedHandler({secret: 'corto', ejecutar})(req())).status, 503);
  const h = createWeeklyHostedHandler({secret: SECRET, ejecutar});
  assert.equal((await h(req({headers: {}}))).status, 401);
  assert.equal((await h(req({headers: {authorization: 'Bearer ' + 'x'.repeat(40)}}))).status, 401);
  assert.equal((await h(req({headers: {authorization: SECRET}}))).status, 401);
  assert.equal(n, 0);
  assert.match((await h(req({headers: {}}))).headers.get('cache-control'), /no-store/);
});
test('forma de la petición: solo GET/POST, sin query, sin origin y sin cuerpo', async () => {
  const h = createWeeklyHostedHandler({secret: SECRET, ejecutar: async () => ({ok: 1})});
  assert.equal((await h(req({method: 'PUT'}))).status, 405);
  assert.equal((await h(req({qs: '?tenant=x'}))).status, 400);
  assert.equal((await h(req({headers: {...auth, origin: 'https://evil.example'}}))).status, 400);
  assert.equal((await h(req({body: '{"tenant":"x"}', headers: {...auth, 'content-type': 'application/json'}}))).status, 400);
  assert.equal((await h(req({method: 'GET'}))).status, 200);
});
test('ejecuta, devuelve solo conteos, un ciclo a la vez y falla cerrado ante configuración o errores', async () => {
  let suelta; const espera = new Promise(r => { suelta = r; });
  const h = createWeeklyHostedHandler({secret: SECRET, ejecutar: async () => { await espera; return [{semana: '2026-10-26', registrados: 2}]; }});
  const a = h(req()); await new Promise(r => setTimeout(r, 5));
  assert.equal((await h(req())).status, 409);
  suelta(); const r = await a; assert.equal(r.status, 200); assert.deepEqual(await r.json(), {code: 'WEEKLY_COMPLETED', resultado: [{semana: '2026-10-26', registrados: 2}]});
  const cfg = createWeeklyHostedHandler({secret: SECRET, ejecutar: async () => { throw Error('WEEKLY_CONFIGURATION_REQUIRED'); }});
  const c = await cfg(req()); assert.equal(c.status, 503); assert.equal((await c.json()).code, 'WEEKLY_CONFIGURATION_REQUIRED');
  const rota = createWeeklyHostedHandler({secret: SECRET, ejecutar: async () => { throw Error('detalle interno con maria@x.com'); }});
  const e = await rota(req()); assert.equal(e.status, 503); const t = await e.text(); assert.equal(JSON.parse(t).code, 'WEEKLY_UNAVAILABLE'); assert.doesNotMatch(t, /maria|detalle/);
  assert.equal((await rota(req())).status, 503, 'tras un fallo el candado se libera');
  const lento = createWeeklyHostedHandler({secret: SECRET, timeoutMs: 1000, ejecutar: () => new Promise(() => {})});
  assert.equal((await lento(req())).status, 503);
});

test('entrega semanal: apagada por defecto y transporte preparado obligatorio', async () => {
  for (const env of [{}, {VEXA_WEEKLY_SEND: 'true'}, {VEXA_WEEKLY_SEND: 'disabled', RESEND_API_KEY: 're_x'}, {VEXA_WEEKLY_SEND: 'enabled', VEXA_EMAIL_MODE: 'mailpit'}]) assert.equal(await entregaDesdeEntorno(env), null);
  const recipient = {tenantId: 't', userId: 'u', channel: 'email', email: 'a@b.com', emailVerified: true};
  const sent = [], msg = {tenantId: 't', userId: 'u', headers: {}, idempotencyKey: 'a'.repeat(64)};
  const email = {configured: () => true, resolveRecipient: async () => recipient, sendWeekly: async input => { sent.push(input); return {kind: 'accepted', providerId: 'em_1'}; }};
  assert.deepEqual(await crearEntregaSemanal({email})(msg), {ok: true, providerId: 'em_1'});
  assert.deepEqual(sent[0], {recipient, headers: {}, idempotencyKey: msg.idempotencyKey, signal: undefined});
  for (const [override, motivo] of [[{configured: () => false}, 'no_configurado'], [{resolveRecipient: async () => null}, 'sin_destinatario'], [{resolveRecipient: async () => ({...recipient, emailVerified: false})}, 'sin_destinatario'], [{sendWeekly: undefined}, 'no_configurado']]) {
    assert.equal((await crearEntregaSemanal({email: {...email, ...override}})(msg)).motivo, motivo);
  }
  assert.equal(sent.length, 1);
  let closed = 0;
  await crearEntregaSemanal({email: {...email, close: async () => { closed++; }}}).close();
  assert.equal(closed, 1);
});
