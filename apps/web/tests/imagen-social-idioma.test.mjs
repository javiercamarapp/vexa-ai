import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {imagenSocial, siteDe} from '../src/lib/site.mjs';

test('la imagen social sigue al idioma y trae el alt de ese idioma', () => {
  const en = imagenSocial('en'), es = imagenSocial('es');
  assert.match(en.url, /en\.png$/);
  assert.match(es.url, /es\.png$/);
  assert.equal(en.alt, siteDe('en').og.alt);
  assert.equal(es.alt, siteDe('es').og.alt);
  assert.notEqual(en.alt, es.alt);
  assert.equal(imagenSocial().url, es.url);
});

test('el layout de la app usa la imagen del idioma para openGraph y twitter, no las estáticas', () => {
  const src = readFileSync(new URL('../src/app/(app)/layout.tsx', import.meta.url), 'utf8');
  assert.match(src, /imagenSocial\(idioma\)/);
  assert.doesNotMatch(src, /\/opengraph-image|\/twitter-image/);
  assert.equal((src.match(/imagenSocial\(idioma\)/g) ?? []).length, 2);
});
