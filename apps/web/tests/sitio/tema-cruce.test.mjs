// Cruce del tema global (T16): el juez T15b midió 1.52:1 entre texto y fondo a mitad de cada volteo oscuro/claro. Ahora el fondo se desliza 700 ms y el
// texto salta por pasos cuando el fondo está en un gris medio; el contraste mínimo en todo el cruce es de 3:1. Sin Chrome: pruebas del evaluador, del
// CSS y de que la portada solo cambia de tema dos veces. Con ROVAQ_CDP_VIVO=1 y ROVAQ_URL: muestrea cada cuadro del cruce en Chrome real.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';

const AQUI = dirname(fileURLToPath(import.meta.url));
const WEB = join(AQUI, '..', '..');
const RAIZ = join(WEB, '..', '..');
const leer = (r) => readFileSync(join(WEB, r), 'utf8');
const T = await import(pathToFileURL(join(RAIZ, 'tools/sitio/cdp/tema-cruce.mjs')).href);

test('contraste WCAG: negro sobre blanco 21:1; gris medio sobre gris medio 1:1', () => {
  assert.ok(Math.abs(T.contraste([0, 0, 0], [255, 255, 255]) - 21) < 0.01);
  assert.equal(T.contraste([128, 128, 128], [128, 128, 128]), 1);
});

test('evaluar: la transición lineal de T15 (texto y fondo cruzándose) falla y los pasos de T16 pasan', () => {
  const lineal = Array.from({length: 43}, (_, i) => {
    const p = i / 42, fondo = 14 + 233 * p, texto = 247 - 233 * p; // fondo y texto a la vez, como en T15
    return {t: i * 16.7, sondas: {'texto / fondo': T.contraste([texto, texto, texto], [fondo, fondo, fondo])}};
  });
  const r = T.evaluar(lineal);
  assert.ok(r.fallas.length === 1 && r.peor['texto / fondo'].c < 1.1, JSON.stringify(r.peor));
  const pasos = Array.from({length: 43}, (_, i) => {
    const p = i / 42, fondo = 14 + 233 * p, texto = p < 0.47 ? 247 : 14; // el texto salta cuando el fondo está en gris medio
    return {t: i * 16.7, sondas: {'texto / fondo': T.contraste([texto, texto, texto], [fondo, fondo, fondo])}};
  });
  assert.deepEqual(T.evaluar(pasos).fallas, []);
});

test('CSS: texto, texto atenuado y botón cambian por keyframes (no por transición) y el fondo transiciona', () => {
  const css = leer('src/styles/sitio/tokens.css');
  const lista = css.match(/html\[data-ambiente-anim\] \{\s*transition:([\s\S]*?);\s*\}/)[1];
  for (const v of ['--s-tinta', '--s-apagado', '--s-boton-fondo', '--s-boton-texto']) assert.ok(!lista.includes(v + ' '), `${v} no debe transicionar con el fondo`);
  assert.ok(lista.includes('--s-fondo '), 'el fondo sí transiciona');
  for (const k of ['claro', 'oscuro']) for (const p of ['tinta', 'apagado', 'boton-fondo', 'boton-texto']) assert.match(css, new RegExp(`@keyframes s-a-${k}-${p}`));
  // el salto del texto ocurre con el fondo en gris medio: entre 25 y 35 por ciento de los 700 ms
  for (const m of css.matchAll(/@keyframes s-a-(?:claro|oscuro)-tinta \{\s*0%, ([\d.]+)%/g)) assert.ok(Number(m[1]) > 25 && Number(m[1]) < 35, m[0]);
});

test('JS: las animaciones del cruce no corren al cargar la página (solo en cambios reales de tema)', () => {
  const js = leer('src/sitio-js/sitio.js');
  assert.match(js, /const primera = escena === ''/);
  assert.match(js, /if \(!primera\) H\.setAttribute\('data-ambiente-anim', ''\)/);
});

test('portada: solo dos cambios de tema (oscuro hasta los pasos, claro de pantallas a integraciones, oscuro al cierre)', () => {
  const orden = ['inicio', 'problema', 'valor', 'modulos', 'pantallas', 'puestos', 'seguridad', 'integraciones', 'cierre'];
  const fuentes = ['hero', 'problema-valor', 'pasos-pantallas', 'puestos', 'seguridad-cierre'].map((f) => leer(`src/components/sitio/secciones/${f}.tsx`)).join('\n');
  const tema = (id) => fuentes.match(new RegExp(`id="${id}"[^>]*data-tema="(oscuro|claro)"`))?.[1];
  const temas = orden.map(tema);
  assert.ok(temas.every(Boolean), JSON.stringify(temas));
  const cambios = temas.filter((t, i) => i && t !== temas[i - 1]).length;
  assert.ok(cambios <= 2, `${cambios} cambios: ${temas.join(' ')}`);
});

const vivo = process.env.ROVAQ_CDP_VIVO === '1' && process.env.ROVAQ_URL;
test('Chrome: contraste mínimo de 3:1 en cada cuadro de cada cruce, hacia abajo y hacia arriba', {skip: vivo ? false : 'PENDIENTE: corrida real de Chrome; ROVAQ_CDP_VIVO=1 y ROVAQ_URL'}, () => {
  const salida = execFileSync(process.execPath, [join(RAIZ, 'tools/sitio/cdp/tema-cruce.mjs'), '--url', process.env.ROVAQ_URL, '--vp', '1440,390', '--minimo', '3'], {encoding: 'utf8', timeout: 400000});
  assert.doesNotMatch(salida, /FALLA/);
  assert.match(salida, /RESUMEN vp 1440/);
});
