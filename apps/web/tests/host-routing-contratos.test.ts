// Contratos de plataforma del sitio: K2 (registro de páginas) y K3 (activos con manifest). Esqueletos de T1; T2, T5 y T13 los llenan sin cambiar estas formas.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {IDIOMAS, PAGINAS, RUTAS, porId, rutaDe, idDeRuta} from '../src/content/sitio/registro.mjs';
import {readFileSync, existsSync} from 'node:fs';
import {landingUrl, PREFIJOS_PRIVADOS, RUTAS_PUBLICAS} from '../src/lib/site.mjs';
import {crearActivos, leerManifest, partirClave} from '../src/lib/sitio/activos';

test('K2: 34 páginas con id único y rutas únicas por idioma (español sin prefijo, inglés bajo /en), 68 rutas en total', () => {
  assert.deepEqual([...IDIOMAS], ['es', 'en']);
  assert.equal(PAGINAS.length, 34); assert.equal(RUTAS.length, 68);
  assert.equal(new Set(PAGINAS.map((p) => p.id)).size, 34);
  assert.equal(new Set(RUTAS).size, 68);
  for (const p of PAGINAS) {
    assert.match(p.es.ruta, /^\/(?:[a-z0-9-]+(?:\/[a-z0-9-]+)*)?$/, p.id); assert.ok(!p.es.ruta.startsWith('/en/') && p.es.ruta !== '/en', p.id);
    assert.match(p.en.ruta, /^\/en(?:\/[a-z0-9-]+)*$/, p.id);
    assert.ok(p.es.ruta === '/' || !p.es.ruta.endsWith('/'), p.id);
  }
});
test('K2: porId, rutaDe e idDeRuta son coherentes', () => {
  assert.equal(porId('inicio')?.es.ruta, '/'); assert.equal(rutaDe('inicio', 'en'), '/en');
  assert.equal(rutaDe('hoy', 'es'), '/producto/hoy'); assert.equal(rutaDe('hoy', 'en'), '/en/product/today');
  assert.equal(rutaDe('no-existe', 'es'), null); assert.equal(porId('no-existe'), undefined);
  for (const p of PAGINAS) for (const lang of IDIOMAS) assert.deepEqual(idDeRuta(rutaDe(p.id, lang)!), {id: p.id, lang}, p.id + lang);
  assert.equal(idDeRuta('/no-existe'), null); assert.equal(idDeRuta('/producto/'), null);
});
test('K2: el registro incluye las páginas principales y las 8 entradas de blog', () => {
  for (const id of ['inicio', 'producto', 'casos-de-uso', 'seguridad-y-privacidad', 'integraciones', 'hoja-de-ruta', 'acerca', 'solicitar-acceso', 'blog']) assert.ok(porId(id), id);
  assert.equal(PAGINAS.filter((p) => p.tipo === 'articulo').length, 8);
});

const MANIFEST = {
  version: 1,
  js: {'nube.js': {url: '/s/nube.ab12cd34.js', bytes: 6800, sha256: 'a'.repeat(64)}},
  pts: {nucleo: {url: '/s/pts/nucleo.0123abcd.pts', bytes: 220036}},
  img: {'objeto-1': {url: '/s/img/objeto-1.11112222.webp', ancho: 1280, alto: 960, variantes: [{url: '/s/img/objeto-1-960.33334444.webp', ancho: 960, alto: 720}]}},
  fuentes: {display: {url: '/s/fuentes/display.55556666.woff2'}},
  md: {'es/producto': {url: '/s/md/es/producto.77778888.md'}},
};
test('K3: url(clave) resuelve js, pts, img, fuentes y md; una clave sin sección es un script propio', () => {
  const a = crearActivos(MANIFEST);
  assert.equal(a.url('nube.js'), '/s/nube.ab12cd34.js'); assert.equal(a.url('js/nube.js'), '/s/nube.ab12cd34.js');
  assert.equal(a.url('pts/nucleo'), '/s/pts/nucleo.0123abcd.pts');
  assert.equal(a.url('img/objeto-1'), '/s/img/objeto-1.11112222.webp'); assert.equal(a.url('img/objeto-1', {ancho: 960}), '/s/img/objeto-1-960.33334444.webp');
  assert.equal(a.url('fuentes/display'), '/s/fuentes/display.55556666.woff2'); assert.equal(a.url('md/es/producto'), '/s/md/es/producto.77778888.md');
  assert.deepEqual(a.medidas('img/objeto-1'), {ancho: 1280, alto: 960});
  assert.equal(a.existe('pts/nucleo'), true); assert.equal(a.existe('pts/otro'), false);
});
test('K3: una clave que no está en el manifest, una variante inexistente o una sección desconocida rompen en lugar de inventar una ruta', () => {
  const a = crearActivos(MANIFEST);
  assert.throws(() => a.url('pts/otro'), /ACTIVO_NO_EN_MANIFEST/);
  assert.throws(() => a.url('img/objeto-1', {ancho: 111}), /ACTIVO_VARIANTE_NO_EXISTE/);
  assert.throws(() => a.url('video/x'), /ACTIVO_SECCION_DESCONOCIDA/);
  assert.throws(() => a.url('pts/../x'), /ACTIVO_CLAVE_INVALIDA/);
  assert.throws(() => a.medidas('pts/nucleo'), /ACTIVO_SIN_MEDIDAS/);
  assert.deepEqual(partirClave('fuentes/display'), {seccion: 'fuentes', nombre: 'display'});
});
test('K3: leerManifest tolera que public/s/manifest.json todavía no exista y lee el archivo cuando está', () => {
  const vacio = mkdtempSync(join(tmpdir(), 'activos-'));
  assert.deepEqual(leerManifest(vacio), {version: 1});
  mkdirSync(join(vacio, 'public', 's'), {recursive: true});
  writeFileSync(join(vacio, 'public', 's', 'manifest.json'), JSON.stringify(MANIFEST));
  assert.equal(crearActivos(leerManifest(vacio)).url('nube.js'), '/s/nube.ab12cd34.js');
});

const leer = (rel: string) => readFileSync(join(import.meta.dirname, '..', rel), 'utf8');
test('el origen del sitio es rovaq.ai por omisión y solo se sobreescribe con https; /landing no es un prefijo privado', () => {
  assert.equal(landingUrl(undefined), 'https://rovaq.ai'); assert.equal(landingUrl('http://evil.example'), 'https://rovaq.ai'); assert.equal(landingUrl('https://staging.rovaq.ai/x'), 'https://staging.rovaq.ai');
  assert.ok(!PREFIJOS_PRIVADOS.includes('/landing')); assert.ok(!PREFIJOS_PRIVADOS.includes('/sitio')); assert.deepEqual([...RUTAS_PUBLICAS], ['/login']);
});
test('robots y sitemap siguen decidiendo por host y el layout de la app conserva el arranque limpio sin pantalla de carga en rutas públicas', () => {
  assert.match(leer('src/app/robots.ts'), /robotsParaHost\(.*host/s); assert.match(leer('src/app/sitemap.ts'), /ES_HOST_LANDING/);
  assert.match(leer('src/app/(app)/layout.tsx'), /\^\\\\\/\(platform\|landing\)/);
});
test('dos raíces: no hay app/layout.tsx; la app lee la cookie de idioma y el sitio fija lang por la ruta, ambos sin cabecera x-rovaq-lang', () => {
  assert.ok(!existsSync(join(import.meta.dirname, '../src/app/layout.tsx')));
  const app = leer('src/app/(app)/layout.tsx'); const sitio = leer('src/app/(sitio)/sitio/[lang]/layout.tsx');
  assert.match(app, /await idiomaActual\(\)/); assert.doesNotMatch(app, /x-rovaq-lang|headers\(/);
  assert.match(sitio, /<html lang=\{lang\}>/); assert.doesNotMatch(sitio, /cookies\(|headers\(|idiomaActual/);
  assert.match(sitio, /dynamic = 'force-static'/); assert.match(sitio, /dynamicParams = false/); assert.match(sitio, /generateStaticParams/);
  assert.doesNotMatch(leer('src/middleware.ts'), /x-rovaq-lang/);
});
