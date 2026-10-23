import test from 'node:test';
import assert from 'node:assert/strict';
import {createCRMHostedHandler} from '../../connectors/hosted.mjs';
const SECRET = 's'.repeat(40);
const req = () => new Request('https://x.test/api/internal/crm', {method: 'GET', headers: {authorization: 'Bearer ' + SECRET}});
test('gancho afterWork del tick CRM: recibe la base y el resultado, y su fallo no rompe la respuesta', async () => {
  const seen = [], db = {id: 'db'};
  const mk = afterWork => createCRMHostedHandler({secret: SECRET, afterWork, runtime: async () => ({database: db, close: async () => {}, crm: {tick: async () => ({state: 'done', pages: 3})}})});
  let r = await mk(async (d, res, info) => { seen.push([d, res, typeof info.startedAt]); })(req());
  assert.equal(r.status, 200); assert.deepEqual(seen, [[db, {state: 'done', pages: 3}, 'number']]);
  r = await mk(async () => { throw Error('boom'); })(req()); assert.equal(r.status, 200); assert.deepEqual((await r.json()).data, {state: 'done', pages: 3});
  r = await createCRMHostedHandler({secret: SECRET, runtime: async () => ({database: db, close: async () => {}, crm: {tick: async () => ({state: 'done'})}})})(req()); assert.equal(r.status, 200, 'sin gancho, igual que antes');
});
