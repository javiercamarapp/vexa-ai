// El error raíz usa un diccionario mínimo propio para no cargar el completo en cada página (incluido el sitio público).
// Esta prueba impide que se desincronice del diccionario real y que global-error vuelva a importar el índice de i18n.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {es} from '../src/lib/i18n/es';
import {en} from '../src/lib/i18n/en';
import {TEXTOS_ERROR_RAIZ} from '../src/lib/i18n/error-raiz';

test('cada texto del error raíz coincide con el del diccionario ES y EN', () => {
  for (const [clave, texto] of Object.entries(TEXTOS_ERROR_RAIZ.es)) assert.equal((es as Record<string, string>)[clave], texto, 'es ' + clave);
  for (const [clave, texto] of Object.entries(TEXTOS_ERROR_RAIZ.en)) assert.equal((en as Record<string, string>)[clave], texto, 'en ' + clave);
  assert.deepEqual(Object.keys(TEXTOS_ERROR_RAIZ.es).sort(), Object.keys(TEXTOS_ERROR_RAIZ.en).sort());
});

test('global-error no importa el índice de i18n (arrastraría el diccionario completo al sitio público)', () => {
  const src = fs.readFileSync(new URL('../src/app/global-error.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /from '\.\.\/lib\/i18n'/);
  assert.match(src, /lib\/i18n\/error-raiz/);
  for (const [, clave] of src.matchAll(/\bt\('([^']+)'\)/g)) assert.ok(clave in TEXTOS_ERROR_RAIZ.es, 'clave sin texto de respaldo: ' + clave);
});
