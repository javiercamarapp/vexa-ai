// Idioma de correos, push y página de baja: cada plantilla existe en ES y EN, con la misma estructura.
//   node --test packages/notifications/tests/idioma.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {renderEmail, catalogFor, definition} from '../email-template.mjs';
import {renderWeeklyReport} from '../email-weekly.mjs';
import {fmtMonto, fmtPct, fmtDelta, fmtFechaHora} from '../email-system.mjs';
import {createBajaHandler, firmarBaja, paginaBaja, TEXTOS_BAJA, urlBaja} from '../baja-semanal.mjs';
import {createWebPushSender} from '../push.mjs';
import {catalogFor as catalogoUI, channelsFor} from '../catalog.mjs';
import {idiomaDe, textoPush} from '../idioma.mjs';
import {APP_SAMPLE, WEEKLY_SAMPLE, ORIGIN} from '../../../scripts/correos/muestras.mjs';

// Caracteres propios del español que no deben aparecer en ningún texto en inglés.
const ESPANOL = /[áéíóúñÁÉÍÓÚÑ¿¡]/;
const hrefs = html => [...html.matchAll(/href="([^"]+)"/g)].map(m => m[1]).sort();
const urlsTexto = text => [...text.matchAll(/https?:\/\/[^\s>)]+/g)].map(m => m[0]).sort();
const cuenta = (html, clase) => html.split(clase).length - 1;

const TIPOS = ['digest.available', 'membership.welcome', 'membership.invited', 'brief.available', 'intervention.assigned', 'connection.attention', 'processing.failed'];
const base = tipo => ({type: tipo, appOrigin: ORIGIN, ctaUrl: ORIGIN + '/overview', unsubscribeUrl: ORIGIN + '/api/notifications/unsubscribe',
  ...(tipo === 'membership.welcome' || tipo === 'membership.invited' ? {espacio: 'Casa Aldama', rol: 'Analista'} : {}),
  ...(tipo === 'membership.invited' ? {invita: 'Ana Torres', vence: '2026-11-01T05:59:00Z'} : {}),
  ...(tipo === 'connection.attention' || tipo === 'processing.failed' ? {resourceLabel: 'Walmart'} : {})});

const WEEKLY_EN = {...WEEKLY_SAMPLE, idioma: 'en', rango: 'October 14 to 20, 2026', rangoCorto: 'Oct 14–20', corte: 'Oct 20',
  fraseClave: 'The refund leak grew 11% and is concentrated in a few products.',
  dolores: [{label: 'Item arrived damaged', monto: 241_000}, {label: 'Wrong size or fit', monto: 173_000}, {label: 'Late delivery', monto: 128_000}],
  accion: {titulo: 'Review the packaging of the 3 SKUs with the most damage returns', impacto: 'Up to $96k a month could be recovered. Estimated from 8 weeks of history.'},
  fuentes: ['order ledger', 'HubSpot'],
  puntosNuevos: [{label: 'Late delivery', valor: 'New · $4.6k'}]};
const WEEKLY_ES = {...WEEKLY_SAMPLE, puntosNuevos: [{label: 'Entrega fuera de fecha', valor: 'Nuevo · $4.6k'}]};

test('idioma: solo «en» exacto activa el inglés; todo lo demás es español', () => {
  assert.equal(idiomaDe('en'), 'en');
  for (const v of [undefined, null, 'es', 'EN', 'fr', 5]) assert.equal(idiomaDe(v), 'es');
});

test('(1) cada notificación en EN: asunto, preheader, html y texto sin español y con lang en-US', () => {
  for (const tipo of TIPOS) {
    const m = renderEmail({...base(tipo), idioma: 'en'});
    for (const [campo, valor] of [['subject', m.subject], ['preheader', m.preheader], ['html', m.html], ['text', m.text]]) {
      assert.doesNotMatch(valor, ESPANOL, `${tipo}.${campo} tiene acentos o signos del español`);
    }
    assert.match(m.html, /<html lang="en-US"/);
    assert.match(m.html, /role="article" aria-roledescription="email" lang="en-US"/);
    assert.doesNotMatch(m.html, /es-MX/);
    assert.equal(m.headers['Content-Language'], 'en-US');
    assert.doesNotMatch(m.text, /\(/, `${tipo}: el texto en inglés no lleva paréntesis`);
    assert.match(m.text, /Rovaq will never ask for your password by email\./);
    assert.match(m.text, /Mexico City, Mexico/);
  }
});

test('(1) reporte semanal en EN: asunto, preheader, html y texto sin español, sin es-MX', () => {
  const m = renderWeeklyReport(WEEKLY_EN);
  for (const v of [m.subject, m.preheader, m.html, m.text]) assert.doesNotMatch(v, ESPANOL);
  assert.doesNotMatch(m.html, /es-MX/);
  assert.match(m.html, /<html lang="en-US"/);
  assert.equal(m.headers['Content-Language'], 'en-US');
  assert.match(m.subject, /^Weekly report · Oct 14–20: refunds \$854\.7k$/);
  assert.match(m.text, /THIS WEEK'S FIGURES/);
  assert.match(m.text, /\$3\.84M/);
  assert.doesNotMatch(m.text, /\(/);
  assert.ok(m.subject.length <= 55);
  // Sin datos y sin cambios también salen en inglés.
  const vacio = renderWeeklyReport({...WEEKLY_EN, ingreso: {valor: null, delta: null, fuente: 'revenue'}, reembolsos: {valor: null, delta: null}, hallazgo: undefined, accion: undefined, dolores: undefined, puntosNuevos: undefined, sinCambios: true});
  for (const v of [vacio.subject, vacio.preheader, vacio.html, vacio.text]) assert.doesNotMatch(v, ESPANOL);
  assert.match(vacio.html, /no data from revenue/);
});

test('(2) paridad: mismos enlaces, botones, bloques y variables en ES y EN', () => {
  for (const tipo of TIPOS) {
    const es = renderEmail({...base(tipo), idioma: 'es'}), en = renderEmail({...base(tipo), idioma: 'en'});
    assert.deepEqual(hrefs(en.html), hrefs(es.html), `${tipo}: enlaces`);
    assert.deepEqual(urlsTexto(en.text), urlsTexto(es.text), `${tipo}: URLs en texto`);
    for (const clase of ['class="btn-a"', '<h1 ', '<table', 'class="chip-', 'bd t-muted']) assert.equal(cuenta(en.html, clase), cuenta(es.html, clase), `${tipo}: ${clase}`);
    assert.deepEqual(Object.keys(en.headers).sort(), Object.keys(es.headers).sort(), `${tipo}: cabeceras`);
    assert.equal(en.headers['List-Unsubscribe'], es.headers['List-Unsubscribe']);
    // Los datos libres (espacio, quien invita, etiqueta) llegan intactos en ambos idiomas.
    for (const dato of ['Casa Aldama', 'Ana Torres', 'Walmart']) assert.equal(en.html.includes(dato), es.html.includes(dato), `${tipo}: ${dato}`);
  }
  const es = renderWeeklyReport(WEEKLY_ES), en = renderWeeklyReport(WEEKLY_EN);
  assert.deepEqual(hrefs(en.html), hrefs(es.html));
  assert.deepEqual(urlsTexto(en.text), urlsTexto(es.text));
  for (const clase of ['class="btn-a"', 'class="kpi-c', 'class="chip-', 'class="trk"', 'class="callout']) assert.equal(cuenta(en.html, clase), cuenta(es.html, clase), clase);
  assert.deepEqual(Object.keys(en.headers).sort(), Object.keys(es.headers).sort());
  // Las cuatro cifras de monto son las mismas; solo cambia el formato de la unidad.
  assert.ok(en.html.includes('$854.7k') && es.html.includes('$854.7k'));
  assert.ok(en.html.includes('$3.84M') && es.html.includes('$3.84 M'));
});

test('(2) el rol acepta el nombre canónico en español o el nombre en inglés', () => {
  const a = renderEmail({...base('membership.invited'), idioma: 'en', rol: 'Analista'});
  const b = renderEmail({...base('membership.invited'), idioma: 'en', rol: 'Analyst'});
  assert.equal(a.html, b.html);
  assert.match(a.text, /Role: +Analyst · explores and analyzes data/);
  assert.throws(() => renderEmail({...base('membership.invited'), rol: 'Jefe'}), /invalid_role/);
  assert.match(renderEmail({...base('membership.invited'), idioma: 'es', rol: 'Analyst'}).text, /Rol: +Analista/);
});

test('(3) el español por omisión no cambia: sin idioma = idioma «es», sin rastro de inglés', () => {
  for (const tipo of TIPOS) {
    const sin = renderEmail(base(tipo)), es = renderEmail({...base(tipo), idioma: 'es'});
    assert.deepEqual(sin, es);
    assert.match(sin.html, /<html lang="es-MX"/);
    assert.equal(sin.headers['Content-Language'], 'es-MX');
    assert.match(sin.text, /Rovaq nunca te pedirá tu contraseña por correo\./);
  }
  assert.deepEqual(renderWeeklyReport(WEEKLY_SAMPLE), renderWeeklyReport({...WEEKLY_SAMPLE, idioma: 'es'}));
  assert.deepEqual(renderWeeklyReport(WEEKLY_SAMPLE), renderWeeklyReport({...WEEKLY_SAMPLE, idioma: 'zz'}));
  assert.equal(paginaBaja({titulo: 'T', texto: 'X'}), paginaBaja({titulo: 'T', texto: 'X', idioma: 'es'}));
  assert.deepEqual(definition('digest.available'), definition('digest.available', 'es'));
  assert.equal(catalogFor(undefined)[0].subject, 'Tienes avisos nuevos en Rovaq');
  assert.equal(urlBaja(ORIGIN, 'v1.x.y'), ORIGIN + '/api/baja?t=v1.x.y');
  assert.equal(urlBaja(ORIGIN, 'v1.x.y', 'en'), ORIGIN + '/api/baja?t=v1.x.y&lang=en');
});

test('el catálogo en EN tiene los mismos tipos, orden y banderas que el de ES', () => {
  const es = catalogFor('es'), en = catalogFor('en');
  assert.deepEqual(en.map(e => e.type), es.map(e => e.type));
  for (let i = 0; i < es.length; i++) for (const k of ['alert', 'route', 'kind', 'labelAllowed', 'connected']) assert.equal(en[i][k], es[i][k], `${es[i].type}.${k}`);
  for (const e of en) for (const k of ['subject', 'preheader', 'eyebrow', 'heading', 'body', 'cta', 'reason']) assert.doesNotMatch(e[k], ESPANOL, `${e.type}.${k}`);
  // Catálogo y canales de la pantalla de preferencias.
  assert.deepEqual(catalogoUI('en').map(e => e.type), catalogoUI('es').map(e => e.type));
  for (const e of catalogoUI('en')) assert.doesNotMatch(e.label + e.description, ESPANOL);
  assert.deepEqual(channelsFor('en').map(c => c.id), channelsFor('es').map(c => c.id));
  for (const c of channelsFor('en')) assert.doesNotMatch(c.label + c.reason, ESPANOL);
});

test('cifras y fechas con Intl según idioma', () => {
  assert.equal(fmtMonto(3_840_000), '$3.84 M');
  assert.equal(fmtMonto(3_840_000, 'en'), '$3.84M');
  assert.equal(fmtMonto(212_000, 'en'), '$212k');
  assert.equal(fmtMonto(-950, 'en'), '-$950');
  assert.equal(fmtPct(4.2), '4.2 %');
  assert.equal(fmtPct(4.2, 1, 'en'), '4.2%');
  assert.equal(fmtDelta(-11, 'en'), '−11%');
  assert.equal(fmtFechaHora('2026-11-01T05:59:00Z'), '31 de octubre de 2026, 11:59 p. m. (hora CDMX)');
  assert.equal(fmtFechaHora('2026-11-01T05:59:00Z', 'en'), 'October 31, 2026, 11:59 PM Mexico City time');
});

test('invitación en EN: fecha, rol y asunto en inglés', () => {
  const m = renderEmail({...base('membership.invited'), idioma: 'en'});
  assert.equal(m.subject, 'You have been invited to Casa Aldama on Rovaq');
  assert.match(m.text, /Expires: +October 31, 2026, 11:59 PM Mexico City time/);
  assert.match(m.text, /Invited by: +Ana Torres/);
  assert.match(m.html, /Ana Torres invited you to Casa Aldama/);
});

test('página de baja: cada mensaje existe en ES y EN y el EN no trae español', async () => {
  assert.deepEqual(Object.keys(TEXTOS_BAJA.en).sort(), Object.keys(TEXTOS_BAJA.es).sort());
  for (const [clave, v] of Object.entries(TEXTOS_BAJA.en)) assert.doesNotMatch(JSON.stringify(v), ESPANOL, clave);
  const secret = 'b'.repeat(40), ids = {tenantId: '11111111-1111-4111-8111-111111111111', userId: '22222222-2222-4222-8222-222222222222'};
  const token = firmarBaja({secret, ...ids});
  const pedir = async (idioma, qs = '', cfg = {}) => {
    const h = createBajaHandler({secret, aplicar: async () => ({ok: true}), idioma, ...cfg});
    return h(new Request(`${ORIGIN}/api/baja?t=${token}${qs}`));
  };
  const es = await (await pedir(undefined)).text(), en = await (await pedir('en')).text();
  assert.match(es, /<html lang="es-MX">/); assert.match(es, /Volver a suscribirme/);
  assert.match(en, /<html lang="en-US">/); assert.match(en, /Resubscribe/); assert.match(en, /Rovaq will never ask for your password by email\./);
  assert.doesNotMatch(en, ESPANOL); assert.doesNotMatch(en, /es-MX/);
  assert.equal([...es.matchAll(/<a /g)].length, [...en.matchAll(/<a /g)].length);
  assert.match(await (await pedir('en', '&r=1')).text(), /You will receive the report again/);
  // Idioma por solicitud: una función recibe el Request.
  const porSolicitud = await pedir(r => (new URL(r.url).searchParams.get('lang') === 'en' ? 'en' : 'es'), '&lang=en');
  assert.match(await porSolicitud.text(), /Done, you will no longer receive the weekly report/);
  // Errores en EN: enlace inválido, vencido, destinatario desconocido y fallo de base.
  const mala = await createBajaHandler({secret, aplicar: async () => ({ok: true}), idioma: 'en'})(new Request(`${ORIGIN}/api/baja?t=v1.x.${'a'.repeat(43)}`));
  assert.equal(mala.status, 400); assert.match(await mala.text(), /Invalid link/);
  const vencido = await createBajaHandler({secret, aplicar: async () => ({ok: true}), idioma: 'en', now: () => new Date(Date.now() + 500 * 86400000)})(new Request(`${ORIGIN}/api/baja?t=${token}`));
  assert.equal(vencido.status, 410); assert.match(await vencido.text(), /This link has expired/);
  const desconocido = await createBajaHandler({secret, aplicar: async () => ({ok: false}), idioma: 'en'})(new Request(`${ORIGIN}/api/baja?t=${token}`));
  assert.equal(desconocido.status, 404); assert.match(await desconocido.text(), /could not find your subscription/);
  const fallo = await createBajaHandler({secret, aplicar: async () => { throw Error('x'); }, idioma: 'en'})(new Request(`${ORIGIN}/api/baja?t=${token}`));
  assert.equal(fallo.status, 503); assert.doesNotMatch(await fallo.text(), ESPANOL);
  const sinSecreto = await createBajaHandler({secret: undefined, aplicar: async () => ({ok: true}), idioma: 'en'})(new Request(`${ORIGIN}/api/baja?t=${token}`));
  assert.equal(sinSecreto.status, 503); assert.doesNotMatch(await sinSecreto.text(), ESPANOL);
  // Parámetro lang permitido; otro parámetro sigue siendo inválido.
  assert.equal((await pedir('en', '&lang=en')).status, 200);
  assert.equal((await pedir('en', '&otro=1')).status, 400);
});

test('push: título y cuerpo en ES (texto histórico) y EN', async () => {
  assert.deepEqual(textoPush(undefined), {title: 'Rovaq AI', body: 'Tienes avisos disponibles en Rovaq AI.'});
  assert.doesNotMatch(textoPush('en').body, ESPANOL);
  const b64 = n => Buffer.alloc(n, 7).toString('base64url');
  const pub = Buffer.concat([Buffer.from([4]), Buffer.alloc(64, 7)]).toString('base64url');
  const vapid = {subject: 'mailto:soporte@rovaq.ai', publicKey: pub, privateKey: b64(32)};
  const subscription = {endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: {p256dh: pub, auth: b64(16)}};
  const cargas = [];
  const sdk = {generateRequestDetails: (sub, payload) => { cargas.push(JSON.parse(payload)); return {endpoint: sub.endpoint, method: 'POST', body: Buffer.from('x'), headers: {}}; }};
  const request = (_url, _opts, cb) => ({once() {}, destroy() {}, end() { cb({statusCode: 201, headers: {}, destroy() {}}); }});
  const sender = createWebPushSender({sdk, vapid, request});
  const alcance = {subscriptionId: '33333333-3333-4333-8333-333333333333', version: 1};
  for (const idioma of [undefined, 'es', 'en']) assert.equal((await sender.send({subscription, idempotencyKey: 'k', deliveryScope: alcance, idioma})).kind, 'accepted');
  assert.deepEqual(cargas[0], {title: 'Rovaq AI', body: 'Tienes avisos disponibles en Rovaq AI.', href: '/notifications', ...alcance});
  assert.deepEqual(Object.keys(cargas[0]), ['title', 'body', 'href', 'subscriptionId', 'version']);
  assert.deepEqual(cargas[1], cargas[0]);
  assert.deepEqual(cargas[2], {title: 'Rovaq AI', body: 'You have notifications waiting in Rovaq AI.', href: '/notifications', ...alcance});
});
