import test from 'node:test';
import assert from 'node:assert/strict';
import {createEmailTransport} from '../email.mjs';
import {crearEntregaSemanal} from '../weekly-send.mjs';
// Synthetic ports, real transport. SQL authorization is covered by the isolated database suite.
const recipient = {tenantId: '11111111-1111-1111-1111-111111111111', userId: '22222222-2222-2222-2222-222222222222', channel: 'email', email: 'synthetic@example.test', emailVerified: true};
const stored = {subject: 'Reporte persistido', html: '<p>Persistido</p>', text: 'Persistido'};
const message = {...recipient, subject: 'No usar', html: '<p>No usar</p>', text: 'No usar', idempotencyKey: 'a'.repeat(64), headers: {'List-Unsubscribe': '<https://example.test/unsubscribe>', 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'}};
function setup({prepareWeekly = async () => ({...recipient, ...stored}), send = async () => ({data: {id: 'provider_1'}}), accepted = async () => {}} = {}) {
  const calls = {sends: [], receipts: [], prepares: []};
  const repository = {resolveRecipient: async () => recipient, prepare: async () => null,
    prepareWeekly: async x => { calls.prepares.push(x); return prepareWeekly(x); },
    accepted: async x => { calls.receipts.push(x); return accepted(x); }};
  const email = createEmailTransport({mode: 'resend', apiKey: 're_synthetic', from: 'synthetic@example.test', appOrigin: 'https://example.test', repository, resend: {emails: {send: async (body, opts) => { calls.sends.push({body, opts}); return send(body, opts); }}}});
  return {email, deliver: crearEntregaSemanal({email}), calls};
}
for (const reason of ['complaint', 'permanent_bounce', 'provider_suppressed']) test(`weekly blocks ${reason} without provider effect`, async () => {
  const {email, deliver, calls} = setup({prepareWeekly: async () => null});
  assert.equal((await email.send({recipient, idempotencyKey: message.idempotencyKey})).kind, 'blocked');
  assert.deepEqual(await deliver(message), {ok: false, motivo: 'blocked'});
  assert.equal(calls.prepares.length, 1); assert.equal(calls.sends.length, 0); assert.equal(calls.receipts.length, 0);
});
test('weekly uses persisted body and records acceptance with idempotency and unsubscribe headers', async () => {
  const {deliver, calls} = setup();
  assert.deepEqual(await deliver(message), {ok: true, providerId: 'provider_1'});
  assert.deepEqual(calls.sends[0].body, {from: 'synthetic@example.test', to: [recipient.email], ...stored, headers: message.headers});
  assert.equal(calls.sends[0].opts.idempotencyKey, message.idempotencyKey); assert.equal(calls.sends[0].opts.redirect, 'error');
  assert.deepEqual(calls.receipts, [{idempotencyKey: message.idempotencyKey, provider: 'resend', providerId: 'provider_1'}]);
});
test('replayed accepted report does not send twice', async () => {
  const {deliver, calls} = setup({prepareWeekly: async () => ({...recipient, ...stored, providerId: 'existing_1'})});
  assert.deepEqual(await deliver(message), {ok: true, providerId: 'existing_1'}); assert.equal(calls.sends.length, 0);
});
test('changed mailbox, invalid stored content and unsafe headers fail closed', async () => {
  for (const current of [{...recipient, ...stored, email: 'different@example.test'}, {...recipient, ...stored, subject: 'header\r\ninjection'}, {...recipient, ...stored, html: null}]) {
    const {deliver, calls} = setup({prepareWeekly: async () => current});
    assert.equal((await deliver(message)).ok, false); assert.equal(calls.sends.length, 0);
  }
  for (const headers of [{Bcc: 'other@example.test'}, {'List-Unsubscribe': 'x\r\ny'}]) {
    const {deliver, calls} = setup(); assert.equal((await deliver({...message, headers})).ok, false); assert.equal(calls.sends.length, 0);
  }
});
test('provider rejection, missing ID and receipt persistence failure never report success', async () => {
  for (const options of [{send: async () => ({error: {statusCode: 429}})}, {send: async () => ({data: {}})}, {accepted: async () => { throw Error('storage'); }}, {prepareWeekly: async () => { throw Error('storage'); }}]) {
    const {deliver} = setup(options); assert.equal((await deliver(message)).ok, false);
  }
});
test('abort before or during preparation prevents provider effect', async () => {
  for (const during of [false, true]) {
    const controller = new AbortController();
    if (!during) controller.abort();
    const {deliver, calls} = setup({prepareWeekly: async () => { controller.abort(); return {...recipient, ...stored}; }});
    assert.equal((await deliver({...message, signal: controller.signal})).ok, false); assert.equal(calls.sends.length, 0);
  }
});
