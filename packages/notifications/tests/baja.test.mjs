// Baja de un clic (L6): token firmado (firma, expiración, manipulación), manejador HTTP sin sesión y escritura en base con la acción dedicada.
//   node --test packages/notifications/tests/baja.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {firmarBaja, verificarBaja, urlBaja, createBajaHandler, paginaBaja, BAJA_VIGENCIA_DIAS} from '../baja-semanal.mjs';
import {crearAplicarBaja} from '../baja-db.mjs';

const SECRET = 'k'.repeat(40), T = '11111111-1111-1111-1111-111111111111', U = 'aaaaaaaa-0000-0000-0000-000000000001';
const AHORA = new Date('2026-10-26T12:00:00Z');

test('token: ida y vuelta, vigencia larga y sin correo dentro', () => {
  const t = firmarBaja({secret: SECRET, tenantId: T, userId: U, now: AHORA});
  assert.match(t, /^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/);
  assert.deepEqual(verificarBaja({secret: SECRET, token: t, now: AHORA}), {ok: true, tenantId: T, userId: U});
  assert.equal(verificarBaja({secret: SECRET, token: t, now: new Date(AHORA.getTime() + (BAJA_VIGENCIA_DIAS - 1) * 86400000)}).ok, true, 'sigue vigente casi 13 meses');
  assert.doesNotMatch(Buffer.from(t.split('.')[1], 'base64url').toString(), /@/);
  assert.equal(BAJA_VIGENCIA_DIAS >= 365, true);
});
test('token: expirado, manipulado, firmado con otro secreto, mal formado y alcance ajeno se rechazan', () => {
  const t = firmarBaja({secret: SECRET, tenantId: T, userId: U, now: AHORA});
  assert.equal(verificarBaja({secret: SECRET, token: t, now: new Date(AHORA.getTime() + (BAJA_VIGENCIA_DIAS + 1) * 86400000)}).motivo, 'expirado');
  const [v, cuerpo, sig] = t.split('.');
  const otro = Buffer.from(JSON.stringify({...JSON.parse(Buffer.from(cuerpo, 'base64url')), u: 'aaaaaaaa-0000-0000-0000-000000000002'})).toString('base64url');
  assert.equal(verificarBaja({secret: SECRET, token: `${v}.${otro}.${sig}`, now: AHORA}).motivo, 'firma', 'cambiar el usuario invalida la firma');
  const largo = Buffer.from(JSON.stringify({...JSON.parse(Buffer.from(cuerpo, 'base64url')), e: 4102444800})).toString('base64url');
  assert.equal(verificarBaja({secret: SECRET, token: `${v}.${largo}.${sig}`, now: AHORA}).motivo, 'firma', 'alargar la vigencia invalida la firma');
  assert.equal(verificarBaja({secret: 'z'.repeat(40), token: t, now: AHORA}).motivo, 'firma');
  for (const mal of ['', 'v1.x.y', 'v2.' + cuerpo + '.' + sig, t + 'A', t.slice(0, -1), 'x'.repeat(500), null, undefined, 42]) assert.equal(verificarBaja({secret: SECRET, token: mal, now: AHORA}).ok, false);
  assert.equal(verificarBaja({secret: 'corto', token: t, now: AHORA}).motivo, 'sin_secreto');
  assert.throws(() => firmarBaja({secret: 'corto', tenantId: T, userId: U}), /baja_secret_required/);
  assert.throws(() => firmarBaja({secret: SECRET, tenantId: 'no-uuid', userId: U}), /baja_ids_invalid/);
  assert.equal(urlBaja('https://app.rovaq.ai', t), 'https://app.rovaq.ai/api/baja?t=' + t);
  assert.throws(() => urlBaja('http://app.rovaq.ai', t), /invalid_origin/);
  assert.throws(() => urlBaja('https://app.rovaq.ai/x', t), /invalid_origin/);
});

const mk = (o = {}) => {
  const llamadas = [], logs = [];
  const h = createBajaHandler({secret: SECRET, aplicar: o.aplicar ?? (async a => { llamadas.push(a); return {ok: true, estado: a.resubscribe ? 'suscrito' : 'baja'}; }), appOrigin: 'https://app.rovaq.ai', now: () => AHORA, log: e => logs.push(e)});
  return {h, llamadas, logs, token: firmarBaja({secret: SECRET, tenantId: T, userId: U, now: AHORA})};
};
const get = (m, qs) => m.h(new Request('https://app.rovaq.ai/api/baja' + qs));

const post = (m, qs, body) => m.h(new Request('https://app.rovaq.ai/api/baja' + qs, {method: 'POST', body, headers: {'content-type': 'application/x-www-form-urlencoded'}}));
test('B-04: GET del enlace NO cambia estado (muestra confirmación); el POST del formulario aplica, es reversible y no deja PII en registros', async () => {
  const m = mk();
  const r = await get(m, '?t=' + m.token);
  assert.equal(r.status, 200); const html = await r.text();
  assert.deepEqual(m.llamadas, [], 'un GET (previsualizador de enlaces) no da de baja a nadie');
  assert.match(html, /<form method="post" action="\/api\/baja\?t=/); assert.match(html, /name="confirmar" value="1"/); assert.match(html, /Sí, dejar de recibirlo/);
  assert.match(html, /<html lang="es-MX"/); assert.match(r.headers.get('cache-control'), /no-store/); assert.equal(r.headers.get('referrer-policy'), 'no-referrer'); assert.match(r.headers.get('content-security-policy'), /default-src 'none'/); assert.match(r.headers.get('x-robots-tag'), /noindex/);
  assert.doesNotMatch(html, /<script|[\w.]+@[\w.]+\.\w+/); assert.doesNotMatch(html, new RegExp(U));
  const ok = await post(m, '?t=' + m.token, 'confirmar=1'); const html2 = await ok.text();
  assert.equal(ok.status, 200); assert.match(html2, /ya no recibirás el reporte semanal/i); assert.match(html2, /Volver a suscribirme/);
  assert.deepEqual(m.llamadas, [{tenantId: T, userId: U, resubscribe: false}]);
  assert.deepEqual(m.logs, ['baja_confirmacion', 'baja_registrada']); assert.ok(m.logs.every(l => /^[a-z_]+$/.test(l)), 'solo etiquetas fijas');
  const again = await get(m, '?t=' + m.token + '&r=1'); assert.match(await again.text(), /Confirma para volver a recibir/); assert.equal(m.llamadas.length, 1, 'ni siquiera volver a suscribirse cambia estado por GET');
  const alta = await post(m, '?t=' + m.token + '&r=1', 'confirmar=1'); assert.match(await alta.text(), /Volverás a recibir/); assert.equal(m.llamadas[1].resubscribe, true);
});
test('POST (List-Unsubscribe-Post): responde 200 simple y registra la baja', async () => {
  const m = mk();
  const r = await m.h(new Request('https://app.rovaq.ai/api/baja?t=' + m.token, {method: 'POST', body: 'List-Unsubscribe=One-Click', headers: {'content-type': 'application/x-www-form-urlencoded'}}));
  assert.equal(r.status, 200); assert.equal(await r.text(), 'ok'); assert.equal(m.llamadas.length, 1);
  assert.equal((await m.h(new Request('https://app.rovaq.ai/api/baja?t=' + m.token, {method: 'DELETE'}))).status, 405);
});
test('enlaces inválidos, manipulados o vencidos: mensaje claro y NUNCA tocan la base', async () => {
  const m = mk();
  const r1 = await get(m, '?t=' + m.token.slice(0, -2) + 'xx'); assert.equal(r1.status, 400); assert.match(await r1.text(), /no es válido/);
  const r2 = await get(m, ''); assert.equal(r2.status, 400);
  const r3 = await get(m, '?t=' + m.token + '&t=' + m.token); assert.equal(r3.status, 400);
  const r4 = await get(m, '?t=' + m.token + '&x=1'); assert.equal(r4.status, 400);
  const viejo = createBajaHandler({secret: SECRET, aplicar: async () => { throw Error('no debe llamarse'); }, now: () => new Date(AHORA.getTime() + 500 * 86400000)});
  const r5 = await viejo(new Request('https://app.rovaq.ai/api/baja?t=' + m.token)); assert.equal(r5.status, 410); assert.match(await r5.text(), /venció/);
  assert.equal(m.llamadas.length, 0); assert.deepEqual(m.logs.filter(l => l === 'baja_registrada'), []);
});
test('fallas de base y destinatario desconocido: aviso honesto, no se finge que quedó dado de baja', async () => {
  const caida = mk({aplicar: async () => { throw Error('db'); }});
  const r = await post(caida, '?t=' + caida.token, 'confirmar=1'); assert.equal(r.status, 503); assert.match(await r.text(), /No pudimos registrar tu baja/); assert.deepEqual(caida.logs, ['baja_fallo_base']);
  const des = mk({aplicar: async () => ({ok: false, reason: 'desconocido'})});
  assert.equal((await post(des, '?t=' + des.token, 'confirmar=1')).status, 404);
  const sin = createBajaHandler({secret: undefined, aplicar: async () => ({ok: true})});
  assert.equal((await sin(new Request('https://x/api/baja?t=a'))).status, 503);
});
test('la página escapa el texto y funciona en claro/oscuro sin recursos externos', () => {
  const h = paginaBaja({titulo: '<b>x</b>', texto: 'a & b'});
  assert.doesNotMatch(h, /<b>x/); assert.match(h, /prefers-color-scheme:dark/); assert.doesNotMatch(h, /https?:\/\/(?!app)/);
});
test('escritura en base: acción dedicada, rol de la app, transacción corta y ROLLBACK ante error', async () => {
  const q = []; let libera = 0;
  const pool = {async connect() { return {async query(t, v) { q.push([t, v]); if (/weekly_unsubscribe\(/.test(t) && globalThis.__fallar) throw Error('x'); return {rows: [{r: {ok: true, estado: 'baja'}}]}; }, release() { libera++; }}; }};
  const r = await crearAplicarBaja({pool})({tenantId: T, userId: U, resubscribe: false});
  assert.deepEqual(r, {ok: true, estado: 'baja'});
  assert.deepEqual(q.map(x => x[0].split(/[ (]/)[0] + ' ' + (x[0].split(' ')[1] ?? '')).slice(0, 2), ['BEGIN ', 'SET LOCAL']);
  assert.match(q[2][0], /weekly_unsubscribe'/); assert.match(q[3][0], /public\.weekly_unsubscribe\(\$1::uuid,\$2::uuid,\$3::boolean\)/); assert.deepEqual(q[3][1], [T, U, false]); assert.equal(q.at(-1)[0], 'COMMIT'); assert.equal(libera, 1);
  q.length = 0; globalThis.__fallar = true;
  await assert.rejects(() => crearAplicarBaja({pool})({tenantId: T, userId: U, resubscribe: true}), /x/); delete globalThis.__fallar;
  assert.equal(q.at(-1)[0], 'ROLLBACK'); assert.equal(libera, 2);
});
