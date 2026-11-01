// T48: idioma por omisión = idioma del navegador (Accept-Language) cuando NO hay cookie; la cookie rovaq_lang, cuando existe, manda.
// Cubre las cuatro entradas del servidor (página, ruta de API, middleware/errores de acceso, ruta 404) con peticiones simuladas.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {idiomaDeFuentes} from '../src/lib/i18n/servidor';
import {idiomaDeSolicitud} from '../src/lib/i18n/idioma';
import {idiomaDePeticion, mensajesDe} from '../src/lib/i18n/errores-api';
import {failure, idiomaDelMiddleware} from '../src/lib/auth-http';
import {AccessError} from '../src/lib/auth';

const leer = (rel: string) => fs.readFileSync(new URL('../' + rel, import.meta.url), 'utf8');
const cab = (v?: string) => ({get: (n: string) => (n.toLowerCase() === 'accept-language' && v !== undefined ? v : null)});
const jar = (c?: string) => ({get: (n: string) => (n === 'rovaq_lang' && c !== undefined ? {value: c} : undefined)});
const pet = (c?: string, accept?: string) => ({cookies: jar(c), headers: cab(accept)}) as never;

const CASOS: [string, string | undefined, string | undefined, 'es' | 'en'][] = [
  ['sin cookie, navegador es-MX', undefined, 'es-MX,es;q=0.9', 'es'],
  ['sin cookie, navegador en-US', undefined, 'en-US', 'en'],
  ['sin cookie, navegador fr', undefined, 'fr', 'en'],
  ['cookie en, navegador es', 'en', 'es-MX,es;q=0.9', 'en'],
  ['cookie es, navegador en', 'es', 'en-US', 'es'],
  ['sin cookie ni cabecera', undefined, undefined, 'en'],
  ['cookie basura, navegador es', 'xx', 'es', 'es'],
];

test('idiomaDeFuentes (página del servidor): navegador sin cookie, cookie manda', () => {
  for (const [nombre, c, a, esperado] of CASOS) assert.equal(idiomaDeFuentes(jar(c), cab(a)), esperado, nombre);
  assert.equal(idiomaDeFuentes(jar('en'), cab('es'), 'es'), 'es', '?lang= manda sobre la cookie');
});

test('rutas de API (idiomaDePeticion / mensajesDe) siguen la misma regla', () => {
  for (const [nombre, c, a, esperado] of CASOS) assert.equal(idiomaDePeticion(pet(c, a)), esperado, nombre);
  assert.equal(mensajesDe(pet(undefined, 'es-MX,es;q=0.9'))('tr.err.opFallo'), 'No se pudo completar la operación autorizada.');
  assert.equal(mensajesDe(pet('en', 'es-MX'))('tr.err.opFallo'), 'The authorized operation could not be completed.');
  assert.equal(mensajesDe({cookies: jar()})('tr.err.opFallo'), 'The authorized operation could not be completed.', 'petición sin cabeceras: inglés');
});

test('middleware y errores de acceso: idiomaDelMiddleware y failure() leen cookie y Accept-Language', async () => {
  for (const [nombre, c, a, esperado] of CASOS) assert.equal(idiomaDelMiddleware(pet(c, a)), esperado, nombre);
  const cuerpo = async (r: Response) => (await r.json() as {error: {code: string; message: string}}).error;
  const e403 = new AccessError(403, 'forbidden');
  assert.equal((await cuerpo(failure(e403, pet(undefined, 'es-MX,es;q=0.9')))).message, 'Acceso denegado.');
  assert.equal((await cuerpo(failure(e403, pet(undefined, 'en-US')))).message, 'Access denied.');
  assert.equal((await cuerpo(failure(e403, pet('en', 'es')))).message, 'Access denied.', 'cookie en manda sobre navegador es');
  assert.equal((await cuerpo(failure(e403, pet('es', 'en')))).message, 'Acceso denegado.');
  assert.equal((await cuerpo(failure(e403, pet(undefined, 'fr')))).message, 'Access denied.');
  assert.equal((await cuerpo(failure(e403, pet(undefined, 'es')))).code, 'forbidden', 'el code no cambia');
  assert.equal(failure(e403, pet(undefined, 'es')).status, 403);
  assert.equal(idiomaDeSolicitud({cookies: jar()}), 'en');
});

test('el middleware pasa la petición completa (con cabeceras) a los mensajes de límite y soporte', () => {
  const mw = leer('src/proxy.ts');
  assert.match(mw, /MENSAJES_ACCESO\[idiomaDelMiddleware\(request\)\]\.limite/);
  assert.match(mw, /MENSAJES_ACCESO\[idiomaDelMiddleware\(request\)\]\.soporte/);
});

test('la ruta 404 desconocida y la de baja también consideran el navegador', () => {
  assert.match(leer('src/app/(app)/[...rest]/route.ts'), /idiomaDeSolicitud\(request\)/);
  const baja = leer('src/app/api/baja/route.ts');
  assert.match(baja, /acceptLanguage=request\.headers\.get\('accept-language'\)/);
  assert.match(baja, /resolverIdioma\(\{parametro,cookie,acceptLanguage\}\)/);
  assert.match(baja, /!acceptLanguage\?'es'/, 'sin ?lang=, cookie ni cabecera: español (POST de List-Unsubscribe)');
});

test('no se vuelve dinámico lo estático: el sitio público no lee cookies ni cabeceras de idioma', () => {
  const archivos: string[] = [];
  const recorre = (d: string) => { for (const e of fs.readdirSync(d, {withFileTypes: true})) { const p = d + '/' + e.name; if (e.isDirectory()) recorre(p); else if (/\.(tsx?|mjs)$/.test(e.name)) archivos.push(p); } };
  const raiz = new URL('../src/', import.meta.url).pathname;
  for (const d of ['app/(sitio)', 'components/sitio']) recorre(raiz + d);
  assert.ok(archivos.length > 5);
  for (const f of archivos) assert.doesNotMatch(fs.readFileSync(f, 'utf8'), /i18n\/servidor|idiomaActual\(\)\s*[;)]\s*$|next\/headers/m, f);
});
