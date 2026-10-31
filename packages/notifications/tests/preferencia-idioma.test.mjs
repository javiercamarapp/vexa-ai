// T48: el idioma PREFERIDO de la persona (user_preferences) decide lo que el sistema envía sin petición: aviso por correo y push. Sin fila, o sin la tabla, español.
//   node --test packages/notifications/tests/preferencia-idioma.test.mjs
// Todo con transportes y bases SIMULADOS: no se envía ni se programa ningún correo ni push real.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {idiomasDePersonas, idiomasConConsulta, idiomaDeLaPersona, IDIOMA_DE_RESPALDO, SQL_IDIOMAS} from '../preferencia-idioma.mjs';
import {createEmailTransport} from '../email.mjs';
import {createReceiptRepository} from '../receipts.mjs';
import {createPushTransport} from '../push.mjs';

const T = '11111111-1111-4111-8111-111111111111', U1 = 'aaaaaaaa-0000-4000-8000-000000000001', U2 = 'aaaaaaaa-0000-4000-8000-000000000002';
const ORIGIN = 'https://app.rovaq.ai';
const ESPANOL = /[áéíóúñÁÉÍÓÚÑ¿¡]/;

const dbConFilas = (filas, {falla = false} = {}) => { const vistos = []; return {vistos, async transaction(accion, cb) { vistos.push(accion); if (falla) throw Error('relation "public.user_preferences" does not exist'); return cb({query: async (sql, args) => { vistos.push([sql, args]); return {rows: filas}; }}); }}; };

test('idiomasDePersonas: lee solo es|en de user_preferences en su propia transacción de lectura', async () => {
  const db = dbConFilas([{user_id: U1, idioma: 'en'}, {user_id: U2, idioma: 'es'}, {user_id: 'x', idioma: 'fr'}, {user_id: U1.toUpperCase(), idioma: 'xx'}]);
  const m = await idiomasDePersonas(db, [U1, U2, U1, 'no-uuid', 5, null]);
  assert.deepEqual([...m], [[U1, 'en'], [U2, 'es']]);
  assert.equal(db.vistos[0], 'read');
  assert.equal(db.vistos[1][0], SQL_IDIOMAS);
  assert.match(SQL_IDIOMAS, /FROM public\.user_preferences/); assert.match(SQL_IDIOMAS, /ANY\(\$1::uuid\[\]\)/); assert.match(SQL_IDIOMAS, /idioma IN \('es','en'\)/);
  assert.deepEqual(db.vistos[1][1], [[U1, U2]], 'ids únicos y válidos, nada más viaja a la base');
});
test('idiomasDePersonas: sin ids no consulta; con la tabla ausente o la base caída devuelve un mapa vacío y no lanza', async () => {
  const db = dbConFilas([]);
  assert.equal((await idiomasDePersonas(db, [])).size, 0); assert.equal((await idiomasDePersonas(db, ['no-uuid'])).size, 0); assert.equal(db.vistos.length, 0);
  assert.equal((await idiomasDePersonas(dbConFilas([], {falla: true}), [U1])).size, 0);
  assert.equal((await idiomasDePersonas(null, [U1])).size, 0); assert.equal((await idiomasDePersonas({}, [U1])).size, 0);
  assert.equal((await idiomasConConsulta(async () => { throw Error('x'); }, [U1])).size, 0);
  assert.equal((await idiomasConConsulta(null, [U1])).size, 0);
});
test('respaldo documentado: sin fila, «es»', () => {
  assert.equal(IDIOMA_DE_RESPALDO, 'es');
  const m = new Map([[U1, 'en']]);
  assert.equal(idiomaDeLaPersona(m, U1), 'en'); assert.equal(idiomaDeLaPersona(m, U2), 'es'); assert.equal(idiomaDeLaPersona(null, U2), 'es'); assert.equal(idiomaDeLaPersona(m, U1.toUpperCase()), 'en');
});

// ------------------------------------------------------------------------------------------------ aviso por correo
function transporteCorreo({idiomaDe = async () => null, sinIdioma = false} = {}) {
  const enviados = [];
  const repository = {resolveRecipient: async identity => ({...identity, channel: 'email', email: 'persona@empresa-ejemplo.mx', emailVerified: true}),
    prepare: async () => ({email: 'persona@empresa-ejemplo.mx', emailVerified: true}), accepted: async () => {}, ...(sinIdioma ? {} : {idioma: idiomaDe})};
  const transport = createEmailTransport({mode: 'resend', apiKey: 're_test_key', from: 'avisos@rovaq.ai', appOrigin: ORIGIN, unsubscribeUrl: ORIGIN + '/api/notifications/unsubscribe', repository,
    resend: {emails: {send: async message => { enviados.push(message); return {data: {id: 'msg_' + enviados.length}, error: null}; }}}});
  return {transport, enviados};
}
const KEY = 'a'.repeat(64);
async function enviarAviso(opciones, identity = {tenantId: T, userId: U1, channel: 'email'}) {
  const {transport, enviados} = transporteCorreo(opciones);
  const rec = await transport.resolveRecipient(identity);
  assert.equal((await transport.send({recipient: rec, idempotencyKey: KEY})).kind, 'accepted');
  return {rec, mensaje: enviados[0]};
}

test('aviso por correo: con preferencia «en» sale en inglés; sin preferencia o con fallo, el español de siempre', async () => {
  const en = await enviarAviso({idiomaDe: async () => 'en'});
  assert.equal(en.rec.idioma, 'en');
  assert.equal(en.mensaje.headers['Content-Language'], 'en-US');
  assert.doesNotMatch(en.mensaje.subject + en.mensaje.html + en.mensaje.text, ESPANOL);
  assert.match(en.mensaje.subject, /notification/i);
  const es = await enviarAviso({idiomaDe: async () => null});
  assert.equal(es.rec.idioma, undefined);
  assert.equal(es.mensaje.subject, 'Tienes avisos nuevos en Rovaq'); assert.equal(es.mensaje.headers['Content-Language'], 'es-MX');
  const preferenciaEs = await enviarAviso({idiomaDe: async () => 'es'});
  assert.equal(preferenciaEs.mensaje.subject, 'Tienes avisos nuevos en Rovaq');
  assert.equal(preferenciaEs.mensaje.html, es.mensaje.html, 'preferencia «es» = sin preferencia, byte a byte');
  const roto = await enviarAviso({idiomaDe: async () => { throw Error('tabla ausente'); }});
  assert.equal(roto.mensaje.subject, 'Tienes avisos nuevos en Rovaq'); assert.equal(roto.rec.idioma, undefined);
  const basura = await enviarAviso({idiomaDe: async () => 'fr'});
  assert.equal(basura.mensaje.subject, 'Tienes avisos nuevos en Rovaq');
  const viejo = await enviarAviso({sinIdioma: true});
  assert.equal(viejo.mensaje.subject, 'Tienes avisos nuevos en Rovaq', 'un repositorio sin idioma() (versión anterior) sigue funcionando');
});
test('aviso por correo: la preferencia es de CADA persona', async () => {
  const idiomaDe = async ({userId}) => (userId === U1 ? 'en' : null);
  const a = await enviarAviso({idiomaDe}, {tenantId: T, userId: U1, channel: 'email'}), b = await enviarAviso({idiomaDe}, {tenantId: T, userId: U2, channel: 'email'});
  assert.notEqual(a.mensaje.subject, b.mensaje.subject); assert.equal(b.mensaje.subject, 'Tienes avisos nuevos en Rovaq');
});

test('repositorio de recibos: idioma() lee con el rol del servicio de correo en su propia transacción y degrada a null', async () => {
  const sentencias = [];
  const crea = ({fila = null, errorEnSelect = false} = {}) => ({connect: async () => ({release() {}, query: async ({text, values}) => {
    sentencias.push(text);
    if (/FROM public\.user_preferences/.test(text)) { if (errorEnSelect) throw Error('relation "public.user_preferences" does not exist'); return {rows: fila ? [{user_id: values[0][0], idioma: fila}] : []}; }
    return {rows: []};
  }})});
  assert.equal(await createReceiptRepository({pool: crea({fila: 'en'})}).idioma({userId: U1}), 'en');
  const orden = sentencias.map(s => s.split(' ').slice(0, 3).join(' '));
  assert.deepEqual(orden.slice(0, 3), ['BEGIN', 'SET LOCAL statement_timeout', 'SET LOCAL ROLE']);
  assert.ok(sentencias.includes('SET LOCAL ROLE vexa_email_service'));
  assert.equal(orden.at(-1), 'COMMIT');
  assert.equal(await createReceiptRepository({pool: crea({fila: null})}).idioma({userId: U1}), null);
  sentencias.length = 0;
  assert.equal(await createReceiptRepository({pool: crea({errorEnSelect: true})}).idioma({userId: U1}), null);
  assert.ok(sentencias.includes('ROLLBACK'), 'si falla la lectura se deshace la transacción');
  assert.equal(await createReceiptRepository({pool: {connect: async () => { throw Error('sin base'); }}}).idioma({userId: U1}), null);
});

// ------------------------------------------------------------------------------------------------ push
const b64 = n => Buffer.alloc(n, 7).toString('base64url'), pub = Buffer.concat([Buffer.from([4]), Buffer.alloc(64, 7)]).toString('base64url');
function transportePush({filas = [], tablaAusente = false} = {}) {
  const cargas = [];
  const subscription = {endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: {p256dh: pub, auth: b64(16)}};
  const SUB = '33333333-3333-4333-8333-333333333333';
  const database = {async transaction(accion, cb) {
    return cb({query: async (sql, args) => {
      if (/user_preferences/.test(sql)) { if (tablaAusente) throw Error('relation "public.user_preferences" does not exist'); return {rows: filas}; }
      const p = JSON.parse(args[0]);
      if (p.op === 'resolve') return {rows: [{result: [SUB]}]};
      if (p.op === 'begin') return {rows: [{result: {kind: 'ready', subscription, deliveryScope: {subscriptionId: SUB, version: 1}, attempt: 1}}]};
      return {rows: [{result: {ok: true}}]};
    }});
  }};
  const sdk = {generateRequestDetails: (sub, payload) => { cargas.push(JSON.parse(payload)); return {endpoint: sub.endpoint, method: 'POST', body: Buffer.from('x'), headers: {}}; }};
  const request = (_u, _o, cb) => ({once() {}, destroy() {}, end() { cb({statusCode: 201, headers: {}, destroy() {}}); }});
  const transport = createPushTransport({database, sdk, vapid: {subject: 'mailto:soporte@rovaq.ai', publicKey: pub, privateKey: b64(32)}, request});
  return {transport, cargas};
}
const idPush = userId => ({tenantId: T, userId, channel: 'push'});
async function enviarPush(opciones, userId = U1) {
  const {transport, cargas} = transportePush(opciones);
  const rec = await transport.resolveRecipient(idPush(userId));
  assert.equal((await transport.send({recipient: rec, idempotencyKey: KEY})).kind, 'accepted');
  return {rec, carga: cargas[0]};
}
test('push: el destinatario trae su idioma preferido y el aviso sale en ese idioma; sin fila o sin tabla, español', async () => {
  const en = await enviarPush({filas: [{user_id: U1, idioma: 'en'}]});
  assert.equal(en.rec.idioma, 'en'); assert.equal(en.rec.consent, true);
  assert.equal(en.carga.body, 'You have notifications waiting in Rovaq AI.');
  const es = await enviarPush({filas: []});
  assert.equal(es.rec.idioma, undefined); assert.equal(es.carga.body, 'Tienes avisos disponibles en Rovaq AI.');
  const sinTabla = await enviarPush({tablaAusente: true});
  assert.equal(sinTabla.rec.consent, true, 'sin la tabla el aviso se entrega igual');
  assert.equal(sinTabla.carga.body, 'Tienes avisos disponibles en Rovaq AI.');
  const otra = await enviarPush({filas: [{user_id: U1, idioma: 'en'}]}, U2);
  assert.equal(otra.carga.body, 'Tienes avisos disponibles en Rovaq AI.', 'la preferencia de U1 no se aplica a U2');
});

test('el worker pasa el idioma del destinatario al mensaje (título y cuerpo de textoPush)', () => {
  const w = fs.readFileSync(new URL('../worker.mjs', import.meta.url), 'utf8');
  assert.match(w, /textoPush\(recipient\?\.idioma\)/);
  assert.match(w, /idiomaDe\(recipient\?\.idioma\)==='en'\?\{idioma:'en'\}/);
});
