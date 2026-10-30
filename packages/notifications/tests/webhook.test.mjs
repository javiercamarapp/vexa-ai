import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {handleEmailWebhook} from '../receipts.mjs';

// Webhook de Resend (firma Svix) con el SDK oficial real y un repositorio simulado. Todo sintetico: sin red, sin base, sin correo.
const SECRET = 'whsec_' + Buffer.from('f6-secreto-sintetico-de-prueba-0123456789').toString('base64');
const KEY = Buffer.from(SECRET.slice(6), 'base64');
const sign = (id, ts, body, key = KEY) => 'v1,' + crypto.createHmac('sha256', key).update(`${id}.${ts}.${body}`).digest('base64');
const nowTs = () => String(Math.floor(Date.now() / 1000));
const evento = (type, extra = {}) => ({type, created_at: new Date().toISOString(), data: {email_id: 'em_0123456789abcdef', ...extra}});

function peticion(body, {id = 'msg_1', ts = nowTs(), sig, contentType = 'application/json', headers = {}} = {}) {
  const raw = typeof body === 'string' ? body : JSON.stringify(body);
  return new Request('https://app.example.test/api/webhooks/email', {
    method: 'POST', body: raw,
    headers: {'content-type': contentType, 'svix-id': id, 'svix-timestamp': ts, 'svix-signature': sig ?? sign(id, ts, raw), ...headers},
  });
}
const repo = (impl) => {
  const llamadas = [];
  return {llamadas, record: async (x) => { llamadas.push(x); return impl ? impl(x) : {replay: false}; }};
};
const codigo = async (res) => (await res.json()).code;

test('firma valida: registra el evento con hash del cuerpo, sin tenant ni destinatarios del payload', async () => {
  const r = repo();
  const cuerpo = evento('email.delivered', {to: ['alguien@example.test'], tenant_id: 'ajeno'});
  const res = await handleEmailWebhook(peticion(cuerpo), {webhookSecret: SECRET, repository: r});
  assert.equal(res.status, 200);
  assert.equal(await codigo(res), 'email_webhook_recorded');
  assert.equal(r.llamadas.length, 1);
  const c = r.llamadas[0];
  assert.deepEqual(Object.keys(c).sort(), ['bounceKind', 'eventId', 'occurredAt', 'payloadHash', 'providerId', 'type']);
  assert.equal(c.eventId, 'msg_1');
  assert.equal(c.providerId, 'em_0123456789abcdef');
  assert.equal(c.type, 'email.delivered');
  assert.equal(c.bounceKind, null);
  assert.equal(c.payloadHash, crypto.createHash('sha256').update(JSON.stringify(cuerpo)).digest('hex'));
  assert.doesNotMatch(JSON.stringify(c), /alguien@example|ajeno/);
  assert.equal(res.headers.get('cache-control'), 'no-store');
});

test('los seis tipos de entrega configurados en Resend se registran (mas sent)', async () => {
  for (const type of ['email.sent', 'email.delivered', 'email.delivery_delayed', 'email.bounced', 'email.complained', 'email.suppressed', 'email.failed']) {
    const r = repo();
    const res = await handleEmailWebhook(peticion(evento(type)), {webhookSecret: SECRET, repository: r});
    assert.equal(res.status, 200, type);
    assert.equal(r.llamadas[0]?.type, type);
  }
});

test('rebote: el tipo del rebote viaja; un tipo desconocido se rechaza', async () => {
  const r = repo();
  for (const tipo of ['Permanent', 'Transient', 'Undetermined']) {
    const res = await handleEmailWebhook(peticion(evento('email.bounced', {bounce: {type: tipo}})), {webhookSecret: SECRET, repository: r});
    assert.equal(res.status, 200);
  }
  assert.deepEqual(r.llamadas.map(x => x.bounceKind), ['Permanent', 'Transient', 'Undetermined']);
  const mal = await handleEmailWebhook(peticion(evento('email.bounced', {bounce: {type: 'Otro'}})), {webhookSecret: SECRET, repository: r});
  assert.equal(mal.status, 400);
  assert.equal(r.llamadas.length, 3);
});

test('tipo firmado que no registramos (opened, clicked, received...) responde 200 ignorado y no escribe', async () => {
  for (const type of ['email.opened', 'email.clicked', 'email.received', 'email.scheduled', 'contact.created', 'domain.updated']) {
    const r = repo();
    const res = await handleEmailWebhook(peticion(evento(type)), {webhookSecret: SECRET, repository: r});
    assert.equal(res.status, 200, type);
    assert.equal(await codigo(res), 'email_webhook_ignored', type);
    assert.equal(r.llamadas.length, 0, type);
  }
});

test('un tipo no registrado SIN firma valida sigue siendo 400 (no se confirma nada a un desconocido)', async () => {
  const r = repo();
  const res = await handleEmailWebhook(peticion(evento('email.opened'), {sig: 'v1,AAAA'}), {webhookSecret: SECRET, repository: r});
  assert.equal(res.status, 400);
  assert.equal(await codigo(res), 'email_webhook_invalid');
  assert.equal(r.llamadas.length, 0);
});

test('firma incorrecta, secreto equivocado, cuerpo alterado o cabeceras ausentes: 400 y sin escritura', async () => {
  const r = repo();
  const raw = JSON.stringify(evento('email.delivered'));
  const casos = {
    'firma basura': peticion(raw, {sig: 'v1,' + Buffer.from('x').toString('base64')}),
    'otro secreto': peticion(raw, {sig: sign('msg_1', nowTs(), raw, Buffer.from('otro-secreto'))}),
    'cuerpo alterado': (() => { const ts = nowTs(); return peticion(raw.replace('delivered', 'bounced'), {ts, sig: sign('msg_1', ts, raw)}); })(),
    'sin svix-id': new Request('https://app.example.test/api/webhooks/email', {method: 'POST', body: raw, headers: {'content-type': 'application/json', 'svix-timestamp': nowTs(), 'svix-signature': 'v1,AAAA'}}),
    'id con caracteres raros': peticion(raw, {id: 'msg 1;DROP'}),
  };
  for (const [nombre, req] of Object.entries(casos)) {
    const res = await handleEmailWebhook(req, {webhookSecret: SECRET, repository: r});
    assert.equal(res.status, 400, nombre);
  }
  assert.equal(r.llamadas.length, 0);
});

test('antiguedad: mas de 300 s hacia atras o adelante se rechaza aunque la firma sea valida', async () => {
  const r = repo();
  const raw = JSON.stringify(evento('email.delivered'));
  for (const delta of [-301, 301, -86400]) {
    const ts = String(Math.floor(Date.now() / 1000) + delta);
    const res = await handleEmailWebhook(peticion(raw, {ts}), {webhookSecret: SECRET, repository: r});
    assert.equal(res.status, 400, String(delta));
  }
  assert.equal(r.llamadas.length, 0);
});

test('created_at en el futuro lejano o ID de correo invalido: 400', async () => {
  const r = repo();
  const futuro = {...evento('email.delivered'), created_at: new Date(Date.now() + 3600e3).toISOString()};
  assert.equal((await handleEmailWebhook(peticion(futuro), {webhookSecret: SECRET, repository: r})).status, 400);
  const sinId = {type: 'email.delivered', created_at: new Date().toISOString(), data: {email_id: 'a b'}};
  assert.equal((await handleEmailWebhook(peticion(sinId), {webhookSecret: SECRET, repository: r})).status, 400);
  assert.equal(r.llamadas.length, 0);
});

test('tipo de contenido distinto de JSON: 415; cuerpo mayor a 64 KiB: 413; UTF-8 invalido: 400', async () => {
  const r = repo();
  assert.equal((await handleEmailWebhook(peticion(evento('email.delivered'), {contentType: 'text/plain'}), {webhookSecret: SECRET, repository: r})).status, 415);
  const grande = JSON.stringify({...evento('email.delivered'), relleno: 'x'.repeat(70000)});
  assert.equal((await handleEmailWebhook(peticion(grande), {webhookSecret: SECRET, repository: r})).status, 413);
  const req = new Request('https://app.example.test/api/webhooks/email', {method: 'POST', body: new Uint8Array([0xff, 0xfe, 0xfd]), headers: {'content-type': 'application/json', 'svix-id': 'm', 'svix-timestamp': nowTs(), 'svix-signature': 'v1,AAAA'}});
  assert.equal((await handleEmailWebhook(req, {webhookSecret: SECRET, repository: r})).status, 400);
  assert.equal(r.llamadas.length, 0);
});

test('sin secreto o sin repositorio: 503 sin tocar nada; readTimeoutMs fuera de rango: 503', async () => {
  const r = repo();
  assert.equal((await handleEmailWebhook(peticion(evento('email.delivered')), {repository: r})).status, 503);
  assert.equal((await handleEmailWebhook(peticion(evento('email.delivered')), {webhookSecret: SECRET})).status, 503);
  assert.equal((await handleEmailWebhook(peticion(evento('email.delivered')), {webhookSecret: SECRET, repository: r, readTimeoutMs: 9000})).status, 503);
  assert.equal(r.llamadas.length, 0);
});

test('reintento del mismo evento: la base lo marca replay y se responde 200 distinguible', async () => {
  const r = repo(() => ({replay: true}));
  const res = await handleEmailWebhook(peticion(evento('email.delivered')), {webhookSecret: SECRET, repository: r});
  assert.equal(res.status, 200);
  assert.equal(await codigo(res), 'email_webhook_replay');
});

test('fallo de almacenamiento: 503 para que Resend reintente, sin filtrar el motivo', async () => {
  const r = repo(() => { throw new Error('password authentication failed for user "secreto"'); });
  const res = await handleEmailWebhook(peticion(evento('email.delivered')), {webhookSecret: SECRET, repository: r});
  assert.equal(res.status, 503);
  const texto = await res.text();
  assert.equal(JSON.parse(texto).code, 'email_webhook_unavailable');
  assert.doesNotMatch(texto, /password|secreto/);
});

test('firma invalida avisa al registro de seguridad sin incluir el cuerpo ni la firma', async () => {
  const eventos = [];
  globalThis.__vexaSecuritySink = e => eventos.push(e);
  try {
    await handleEmailWebhook(peticion(evento('email.delivered'), {sig: 'v1,AAAA', headers: {'x-forwarded-for': '203.0.113.9', 'user-agent': 'prueba'}}), {webhookSecret: SECRET, repository: repo()});
  } finally { delete globalThis.__vexaSecuritySink; }
  assert.equal(eventos.length, 1);
  assert.equal(eventos[0].kind, 'webhook_signature_invalid');
  assert.equal(eventos[0].route, '/api/webhooks/email');
  assert.doesNotMatch(JSON.stringify(eventos[0]), /AAAA|em_0123/);
});
