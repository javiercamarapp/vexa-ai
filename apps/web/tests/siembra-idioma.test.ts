// Orden de decisión del idioma con la preferencia guardada: ?lang= > cookie válida > preferencia > Accept-Language > en.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolverIdioma, debeSembrarIdioma} from '../src/lib/i18n/idioma';
import {leerIdiomaDePersona, type ClienteLecturaPreferencias} from '../src/lib/i18n/preferencia-idioma';

test('resolverIdioma: ?lang= > cookie > preferencia > Accept-Language > en', () => {
  assert.equal(resolverIdioma({parametro: 'en', cookie: 'es', preferencia: 'es', acceptLanguage: 'es-MX'}), 'en');
  assert.equal(resolverIdioma({cookie: 'en', preferencia: 'es', acceptLanguage: 'es-MX'}), 'en');
  assert.equal(resolverIdioma({preferencia: 'es', acceptLanguage: 'en-US'}), 'es');
  assert.equal(resolverIdioma({acceptLanguage: 'es-MX'}), 'es');
  assert.equal(resolverIdioma({}), 'en');
  assert.equal(resolverIdioma({cookie: 'fr', preferencia: 'xx', acceptLanguage: 'es'}), 'es', 'cookie y preferencia inválidas cuentan como ausentes');
});

test('debeSembrarIdioma: solo sin ?lang=, sin cookie válida y sin la marca de «no hay preferencia»', () => {
  assert.equal(debeSembrarIdioma({}), true);
  assert.equal(debeSembrarIdioma({cookie: 'fr'}), true);
  assert.equal(debeSembrarIdioma({cookie: 'es'}), false);
  assert.equal(debeSembrarIdioma({parametro: 'en'}), false);
  assert.equal(debeSembrarIdioma({marca: '1'}), false);
});

const cliente = (resultado: () => unknown): ClienteLecturaPreferencias =>
  ({from: () => ({select: () => ({eq: () => ({maybeSingle: async () => resultado() as never})})})});

test('leerIdiomaDePersona: devuelve el idioma válido y null en cualquier otro caso, sin lanzar', async () => {
  assert.equal(await leerIdiomaDePersona(cliente(() => ({data: {idioma: 'es'}, error: null})), 'u'), 'es');
  assert.equal(await leerIdiomaDePersona(cliente(() => ({data: {idioma: 'fr'}, error: null})), 'u'), null);
  assert.equal(await leerIdiomaDePersona(cliente(() => ({data: null, error: null})), 'u'), null);
  assert.equal(await leerIdiomaDePersona(cliente(() => ({data: null, error: {code: 'PGRST205'}})), 'u'), null);
  assert.equal(await leerIdiomaDePersona(cliente(() => { throw new Error('caída'); }), 'u'), null);
  assert.equal(await leerIdiomaDePersona(cliente(() => ({data: {idioma: 'es'}, error: null})), null), null);
});
