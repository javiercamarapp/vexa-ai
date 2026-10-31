// T49: héroe en móvil. (1) La captura de Fuga que se oculta a 700 px de ventana o menos ya no se descarga: la primera fuente del <picture> es un píxel vacío en línea
// para anchos de pantalla menores (antes display: none no evitaba los 27.6 KB). (2) El héroe móvil tiene composición propia: la cifra y el ranking de los cuatro SKU
// mayores, con los mismos números que la captura de escritorio.
// Con ROVAQ_CDP_VIVO=1 y ROVAQ_URL: imagenes-ocultas.mjs en Chrome real (ninguna imagen pedida sin caja a la vista a 1440, 768 y 390).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {sinCaja} from '../../../../tools/sitio/cdp/imagenes-ocultas.mjs';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.join(aqui, '..', '..');
const RAIZ = path.join(WEB, '..', '..');
const CSS = fs.readFileSync(path.join(WEB, 'src/styles/sitio/inicio.css'), 'utf8');
const salida = JSON.parse(
  execFileSync(process.execPath, ['--import', 'tsx', '--import', path.join(aqui, '_css-nulo.mjs'), path.join(aqui, '_render-secciones.tsx')], {cwd: WEB, maxBuffer: 64 * 1024 * 1024, env: {...process.env, NODE_NO_WARNINGS: '1'}}).toString(),
);
const heroe = (lang) => { const h = salida[lang].portada; const i = h.indexOf('data-ventana="fuga"'); return h.slice(i, h.indexOf('</figure>', i)); };
const attr = (tag, n) => new RegExp(`\\b${n}="([^"]*)"`, 'i').exec(tag)?.[1];

for (const lang of ['es', 'en']) {
  test(`${lang}: el <picture> del héroe empieza con un píxel vacío para anchos menores que el de la captura, y las fuentes AVIF y WebP siguen después`, () => {
    const h = heroe(lang);
    const pic = h.slice(h.indexOf('<picture>'), h.indexOf('</picture>'));
    const fuentes = [...pic.matchAll(/<source\b[^>]*>/g)].map((m) => m[0]);
    assert.ok(fuentes.length >= 3, 'píxel vacío, AVIF y WebP');
    const primera = fuentes[0];
    const m = /^\(max-width: (\d+)px\)$/.exec(attr(primera, 'media') ?? '');
    assert.ok(m, 'la primera fuente lleva media max-width');
    assert.match(attr(primera, 'srcSet') ?? attr(primera, 'srcset'), /^data:image\/gif;base64,[A-Za-z0-9+/=]+$/, 'sin petición de red');
    assert.equal(attr(primera, 'type'), undefined);
    assert.deepEqual(fuentes.slice(1).map((t) => attr(t, 'type')), ['image/avif', 'image/webp']);
    assert.equal(attr(fuentes[1], 'media'), undefined, 'las fuentes reales no llevan media: valen para todo lo que la primera no cubre');
    // La captura se oculta con @container (max-width: 700px) sobre una ventana de ancho de pantalla menos 64 px de relleno: la media cubre hasta 700 + 64
    assert.equal(Number(m[1]), 700 + 64, 'la media debe cubrir exactamente los anchos en que el cuerpo está oculto');
    assert.match(CSS, /@container \(max-width: 700px\)[\s\S]*?\[data-ventana="fuga"\] \.s-ventana__cuerpo \{\s*display: none;/);
  });

  test(`${lang}: la composición móvil (.s-ov-top) lista los cuatro SKU mayores con los mismos importes que las filas de la captura`, () => {
    const h = heroe(lang);
    const ol = h.slice(h.indexOf('<ol class="s-ov-top"'), h.indexOf('</ol>'));
    const filas = [...ol.matchAll(/<li>(.*?)<\/li>/g)].map((m) => m[1]);
    assert.equal(filas.length, 4);
    const del = (f) => ({sku: /s-ov-top__sku">([^<]+)</.exec(f)[1], v: /s-ov-top__v">([^<]+)</.exec(f)[1]});
    for (const f of filas) {
      const {sku, v} = del(f);
      assert.match(h, new RegExp(`aria-label="${sku}, ${v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}, `), `${sku} ${v} coincide con la fila de la captura`);
      assert.doesNotMatch(f, /style=/, 'sin style en línea');
    }
    assert.deepEqual(filas.map((f) => del(f).sku), ['HM-210', 'HM-160', 'HM-130', 'HM-190']);
    assert.match(ol, /aria-label="[^"]+"/, 'la lista tiene nombre');
  });
}

test('CSS: .s-ov-top no existe en escritorio y solo se muestra con la captura oculta', () => {
  assert.match(CSS, /\n\.s-ov-top \{\s*display: none;/);
  assert.match(CSS, /@container \(max-width: 700px\)[\s\S]*?\.s-ventana--producto \.s-ov-top \{ display: grid; \}/);
});

test('sinCaja: una imagen pedida sin caja a la vista es una descarga desperdiciada; las que se vieron alguna vez no', () => {
  const pedidas = [{src: 'a.avif', bytes: 10}, {src: 'b.avif', bytes: 20}];
  assert.deepEqual(sinCaja(pedidas, ['a.avif']), [{src: 'b.avif', bytes: 20}]);
  assert.deepEqual(sinCaja(pedidas, ['a.avif', 'b.avif']), []);
});

const vivo = process.env.ROVAQ_CDP_VIVO === '1' && process.env.ROVAQ_URL;
test('Chrome: ninguna imagen se pide sin caja a la vista a 1440, 768 y 390 (la captura del héroe no se descarga en móvil)', {skip: vivo ? false : 'PENDIENTE: corrida real de Chrome; ROVAQ_CDP_VIVO=1 y ROVAQ_URL'}, () => {
  let s = '';
  try { s = execFileSync(process.execPath, [path.join(RAIZ, 'tools/sitio/cdp/imagenes-ocultas.mjs'), '--url', process.env.ROVAQ_URL, '--vp', '1440,768,390'], {encoding: 'utf8', timeout: 600000}); } catch (e) { assert.fail(e.stdout || e.message); }
  assert.equal((s.match(/^OK /gm) || []).length, 3, s);
});
