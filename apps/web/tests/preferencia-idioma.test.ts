// T48: guardado del idioma por persona. Mejor esfuerzo: sin la tabla (migración sin aplicar), sin sesión o con la base caída NO lanza y el selector sigue con la cookie.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {guardarIdiomaDePersona, faltaLaTabla, type ClientePreferencias} from '../src/lib/i18n/preferencia-idioma';
import {persistirIdioma, RUTA_PREFERENCIA_IDIOMA} from '../src/lib/i18n/persistir-idioma';

const leer = (rel: string) => fs.readFileSync(new URL('../' + rel, import.meta.url), 'utf8');
const U = '11111111-1111-4111-8111-111111111111';
function cliente(respuesta: () => {error: {code?: string; message?: string} | null} | Promise<never>) {
  const llamadas: {tabla: string; fila: Record<string, unknown>; opciones: {onConflict: string}}[] = [];
  const c: ClientePreferencias = {from: tabla => ({upsert: (fila, opciones) => { llamadas.push({tabla, fila, opciones}); return Promise.resolve().then(respuesta); }})};
  return {c, llamadas};
}

test('guarda es|en en la fila de la persona con upsert por user_id', async () => {
  for (const idioma of ['es', 'en']) {
    const {c, llamadas} = cliente(() => ({error: null}));
    assert.deepEqual(await guardarIdiomaDePersona(c, U, idioma), {guardado: true});
    assert.deepEqual(llamadas, [{tabla: 'user_preferences', fila: {user_id: U, idioma}, opciones: {onConflict: 'user_id'}}]);
  }
});

test('idioma inválido o sin sesión: no llama a la base', async () => {
  for (const malo of ['fr', 'EN', '', null, undefined, 3, {}, '<script>']) {
    const {c, llamadas} = cliente(() => ({error: null}));
    assert.deepEqual(await guardarIdiomaDePersona(c, U, malo), {guardado: false, motivo: 'idioma_invalido'});
    assert.equal(llamadas.length, 0);
  }
  const {c, llamadas} = cliente(() => ({error: null}));
  assert.deepEqual(await guardarIdiomaDePersona(c, null, 'es'), {guardado: false, motivo: 'sin_sesion'});
  assert.deepEqual(await guardarIdiomaDePersona(c, '', 'es'), {guardado: false, motivo: 'sin_sesion'});
  assert.equal(llamadas.length, 0);
});

test('sin la tabla (migración sin aplicar) el guardado degrada en silencio: no lanza y dice por qué', async () => {
  for (const error of [{code: '42P01', message: 'relation "public.user_preferences" does not exist'}, {code: 'PGRST205', message: "Could not find the table 'public.user_preferences' in the schema cache"}, {message: 'relation "user_preferences" does not exist'}]) {
    const {c} = cliente(() => ({error}));
    assert.deepEqual(await guardarIdiomaDePersona(c, U, 'en'), {guardado: false, motivo: 'sin_tabla'}, JSON.stringify(error));
  }
  assert.equal(faltaLaTabla({code: '23514', message: 'check constraint'}), false);
  assert.equal(faltaLaTabla(null), false);
});

test('otro error de la base o una excepción tampoco lanzan', async () => {
  const {c} = cliente(() => ({error: {code: '42501', message: 'permission denied for table user_preferences'}}));
  assert.deepEqual(await guardarIdiomaDePersona(c, U, 'es'), {guardado: false, motivo: 'error'});
  const roto = cliente(() => Promise.reject(new Error('red caída')));
  assert.deepEqual(await guardarIdiomaDePersona(roto.c, U, 'es'), {guardado: false, motivo: 'error'});
  const sinFrom = {from: () => { throw new Error('x'); }} as unknown as ClientePreferencias;
  assert.deepEqual(await guardarIdiomaDePersona(sinFrom, U, 'es'), {guardado: false, motivo: 'error'});
});

test('cliente: persistirIdioma envía el idioma a la ruta y se traga cualquier fallo (red, 401, 500)', async () => {
  const visto: {url: string; init: RequestInit}[] = [];
  const ok = (async (url: string, init: RequestInit) => { visto.push({url, init}); return new Response('{"guardado":true}', {status: 200}); }) as unknown as typeof fetch;
  assert.equal(await persistirIdioma('en', ok), true);
  assert.equal(visto[0].url, RUTA_PREFERENCIA_IDIOMA);
  assert.equal(visto[0].init.method, 'POST');
  assert.deepEqual(JSON.parse(String(visto[0].init.body)), {idioma: 'en'});
  assert.equal(await persistirIdioma('es', (async () => new Response('{}', {status: 500})) as unknown as typeof fetch), false);
  assert.equal(await persistirIdioma('es', (async () => { throw new TypeError('Failed to fetch'); }) as unknown as typeof fetch), false);
});

test('el selector fija la cookie ANTES de guardar y no espera ni depende del guardado', () => {
  const src = leer('src/components/i18n/selector-idioma.tsx');
  const a = src.indexOf('guardarIdiomaEnNavegador(idioma)'), b = src.indexOf('void persistirIdioma(idioma)'), c = src.indexOf('router.refresh()');
  assert.ok(a > 0 && b > a && c > b, 'orden: cookie, guardado en segundo plano, refresco');
  assert.doesNotMatch(src, /await persistirIdioma/, 'el selector nunca espera el guardado');
  assert.match(src, /void persistirIdioma/);
});

test('la ruta valida origen, cuerpo y sesión, y responde 200 sin sesión o sin tabla', () => {
  const r = leer('src/app/api/preferencias/idioma/route.ts');
  assert.match(r, /assertOrigin\(request\.headers\.get\('origin'\)/);
  assert.match(r, /readRequestBytes\(request, 256\)/);
  assert.match(r, /identity\(client\)\.getUser\(\)/);
  assert.match(r, /guardarIdiomaDePersona\(client as unknown as ClientePreferencias, usuario\.id, idioma\)/, 'el usuario sale de la sesión, nunca del cuerpo');
  assert.doesNotMatch(r, /user_id\s*[:=]\s*entrada/, 'el user_id no se lee del cuerpo');
});
