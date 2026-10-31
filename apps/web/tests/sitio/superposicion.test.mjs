// Superposición (T18b): ningún bloque visible del contenido (línea de texto, dibujo SVG, imagen, canvas, video) se intersecta con otro a 1440 ni a 390.
// Sin Chrome: la lógica de intersección con rectángulos sintéticos y la lista blanca (cada entrada documentada y con su clase en el código del sitio).
// Con ROVAQ_CDP_VIVO=1 y ROVAQ_URL: barrido de scroll real en Chrome (tools/sitio/cdp/superposicion.mjs); falla con la portada de ac429e47, donde los cuatro
// diagramas de «El problema» se montaban sobre titulares y párrafos a 390.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';

const AQUI = dirname(fileURLToPath(import.meta.url));
const WEB = join(AQUI, '..', '..');
const RAIZ = join(WEB, '..', '..');
const {LISTA_BLANCA, PARES_PERMITIDOS, TOLERANCIA, choques} = await import(pathToFileURL(join(RAIZ, 'tools/sitio/cdp/superposicion.mjs')).href);

const recorrer = (d) => readdirSync(d, {withFileTypes: true}).flatMap((e) => (e.isDirectory() ? recorrer(join(d, e.name)) : [join(d, e.name)]));
const FUENTE = [...recorrer(join(WEB, 'src', 'components', 'sitio')), ...recorrer(join(WEB, 'src', 'styles', 'sitio')), ...recorrer(join(WEB, 'src', 'sitio-js'))]
  .map((f) => readFileSync(f, 'utf8')).join('\n');

const it = (desc, raiz, x0, y0, x1, y1, extra = {}) => ({tipo: 'texto', desc, raiz, ma: [], mb: [], seccion: 's', x0, y0, x1, y1, ...extra});

test('choques: dos bloques de distinta raíz que se intersectan son un choque; vecinos, tolerancia y misma raíz no', () => {
  assert.equal(choques([it('a', 1, 0, 0, 100, 20), it('b', 2, 50, 10, 150, 30)]).length, 1);
  assert.equal(choques([it('a', 1, 0, 0, 100, 20), it('b', 2, 0, 20, 100, 40)]).length, 0, 'se tocan por el borde: no es choque');
  assert.equal(choques([it('a', 1, 0, 0, 100, 20), it('b', 2, 98, 0, 200, 20)]).length, 0, 'menos de la tolerancia en x');
  assert.equal(choques([it('a', 1, 0, 0, 100, 20), it('b', 1, 10, 5, 90, 15)]).length, 0, 'misma raíz (mismo nodo o mismo dibujo)');
  assert.equal(choques([it('a', 1, 0, 0, 100, 20), it('b', 2, 100 - TOLERANCIA.ancho + 0.5, 0, 200, 20)]).length, 0);
  const g = choques([it('dibujo', 1, 0, 0, 200, 200, {tipo: 'dibujo'}), it('titular', 2, 20, 150, 180, 170)]);
  assert.equal(g.length, 1, 'el caso real: un dibujo sobre un titular');
  assert.equal(g[0].a, 'dibujo');
});

test('choques: los pares permitidos solo valen entre sus dos lados', () => {
  const base = [it('img', 1, 0, 0, 200, 200, {ma: [1], mb: [0]}), it('capa', 2, 10, 10, 190, 190, {ma: [0], mb: [1]})];
  assert.equal(choques(base).length, 0);
  const otro = [it('img', 1, 0, 0, 200, 200, {ma: [1], mb: [0]}), it('texto cualquiera', 2, 10, 10, 190, 190, {ma: [0], mb: [0]})];
  assert.equal(choques(otro).length, 1);
});

test('lista blanca: estricta, documentada y cada entrada existe en el código del sitio', () => {
  assert.ok(LISTA_BLANCA.length > 0 && LISTA_BLANCA.length <= 6, 'la lista blanca es corta');
  for (const e of [...LISTA_BLANCA, ...PARES_PERMITIDOS]) {
    assert.ok(e.porque && e.porque.length > 30, `sin justificación: ${e.sel || e.a}`);
    for (const sel of [e.sel, e.a, e.b].filter(Boolean).flatMap((s) => s.split(','))) {
      const clase = sel.trim().match(/\.([a-z0-9_-]+)/i)?.[1];
      assert.ok(clase && FUENTE.includes(clase), `el selector «${sel.trim()}» no existe en el código del sitio`);
    }
  }
  // El aria-hidden es la condición de la lista blanca: los selectores del hilo, del pie y de las anotaciones llevan aria-hidden en su origen.
  for (const clase of ['s-hilo', 's-pie__marca', 's-pv__svg', 's-ov__tip']) assert.match(FUENTE, new RegExp(`${clase}[^]{0,400}aria-hidden`), `${clase} debe ser aria-hidden en su origen`);
  const s = readFileSync(join(RAIZ, 'tools/sitio/cdp/superposicion.mjs'), 'utf8');
  assert.match(s, /getAttribute\('aria-hidden'\) === 'true'/, 'la lista blanca exige aria-hidden="true"');
});

const vivo = process.env.ROVAQ_CDP_VIVO === '1' && process.env.ROVAQ_URL;
for (const ruta of ['/', '/en']) {
  test(`Chrome: sin superposición entre texto, diagramas e imágenes a 1440 y a 390 (${ruta})`, {skip: vivo ? false : 'PENDIENTE: corrida real de Chrome; ROVAQ_CDP_VIVO=1 y ROVAQ_URL'}, () => {
    let salida = '';
    try {
      salida = execFileSync(process.execPath, [join(RAIZ, 'tools/sitio/cdp/superposicion.mjs'), '--url', process.env.ROVAQ_URL, '--vp', '1440,390', '--ruta', ruta], {encoding: 'utf8', timeout: 400000});
    } catch (e) {
      assert.fail(String(e.stdout || e.message).slice(0, 3000));
    }
    assert.match(salida, /OK +vp 1440: 0 superposiciones/);
    assert.match(salida, /OK +vp 390: 0 superposiciones/);
  });
}
