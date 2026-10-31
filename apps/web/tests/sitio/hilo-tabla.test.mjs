// T49: la tabla de arco a posición del hilo se calcula aplanando los tramos cúbicos, sin getPointAtLength.
// Antes eran ~4,000 llamadas a getPointAtLength al cargar (cada una vuelve a medir todo el trazo): Lighthouse medía inicio.js como una tarea larga de 1.7 s (móvil, 4x de CPU)
// y de 4.2 s (escritorio), el 98 % del trabajo del hilo principal. Con la tabla propia el mismo trabajo cuesta unas decenas de milisegundos.
// Sin Chrome: exactitud de la función pura y contrato del código. En Chrome (ROVAQ_CDP_VIVO=1 y ROVAQ_URL): la cabeza del hilo cae en el trazo real (<= 1 px) y medir() no se repite sin cambio de tamaño.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const WEB = join(AQUI, '..', '..');
const JS = readFileSync(join(WEB, 'src/sitio-js/inicio.js'), 'utf8');
globalThis.document ??= {};
const {tablaDeArco} = await import(pathToFileURL(join(WEB, 'src/sitio-js/inicio.js')).href);

test('tablaDeArco: una recta de 1000 px da puntos a la misma distancia y respeta el largo pedido', () => {
  const t = tablaDeArco([10, 0], [[10, 333, 10, 666, 10, 1000]], 1000, 201);
  assert.equal(t.s.length, 201);
  assert.ok(Math.abs(t.s[200] - 1000) < 1e-3);
  for (let i = 0; i < 201; i++) { assert.ok(Math.abs(t.x[i] - 10) < 1e-3); assert.ok(Math.abs(t.y[i] - (i * 1000) / 200) < 0.05, `y[${i}] = ${t.y[i]}`); }
});

test('tablaDeArco: el largo propio se reescala al del navegador (los desplazamientos de trazo coinciden con el dibujo)', () => {
  const t = tablaDeArco([0, 0], [[0, 100, 0, 200, 0, 300]], 330, 34); // el navegador dice 330 para una recta de 300: s va hasta 330 y la última posición es el extremo
  assert.ok(Math.abs(t.s[33] - 330) < 1e-3);
  assert.ok(Math.abs(t.y[33] - 300) < 0.05);
  assert.ok(Math.abs(t.y[17] - (17 * 300) / 33) < 0.1, 'las posiciones siguen el largo reescalado: s = 170 de 330 es 154.5 de 300 px');
});

test('tablaDeArco: un cuarto de círculo (cúbica de Bézier) queda a 1 px de la circunferencia y m es el máximo corrido de y', () => {
  const R = 500, k = 0.5522847498 * R;
  const t = tablaDeArco([R, 0], [[R, k, k, R, 0, R]], (Math.PI * R) / 2, 120);
  for (let i = 0; i < 120; i++) assert.ok(Math.abs(Math.hypot(t.x[i], t.y[i]) - R) < 1.2, `punto ${i}: radio ${Math.hypot(t.x[i], t.y[i])}`);
  // Un trazo que sube (rizo): y baja y m no
  const r = tablaDeArco([0, 0], [[0, 300, 0, 300, 0, 200], [0, 100, 0, 100, 0, 400]], 700, 71);
  for (let i = 1; i < 71; i++) assert.ok(r.m[i] >= r.m[i - 1], 'm no decrece');
  assert.ok(r.y.some((v, i) => i && v < r.y[i - 1]), 'la y del trazo sí baja en el rizo');
});

test('inicio.js: medir() no llama a getPointAtLength, registra cada tramo cúbico y no se repite sin cambio de tamaño', () => {
  const medir = JS.slice(JS.indexOf('function medir() {'), JS.indexOf('/** Posición del trazo al llegar')).replace(/\/\/.*$/gm, '');
  assert.ok(!/getPointAtLength/.test(medir), 'cero llamadas a getPointAtLength en medir()');
  assert.match(medir, /tabla = tablaDeArco\(inicio, segs, total, n\)/);
  assert.match(JS, /segs\.push\(\[\+f1\(a\), \+f1\(b\), \+f1\(c\), \+f1\(e\), \+f1\(x\), \+f1\(y\)\]\)/, 'mismas cifras redondeadas que van al atributo d');
  assert.match(JS, /new ResizeObserver\(\(\) => \{ if \(zona\.clientWidth !== medidoW \|\| zona\.clientHeight !== medidoH\) medir\(\); \}\)/);
});

const vivo = process.env.ROVAQ_CDP_VIVO === '1' && process.env.ROVAQ_URL;
test('Chrome: la cabeza del hilo cae a 1 px o menos del trazo real a 1440 y 390', {skip: vivo ? false : 'PENDIENTE: corrida real de Chrome; ROVAQ_CDP_VIVO=1 y ROVAQ_URL'}, async () => {
  const {execFileSync} = await import('node:child_process');
  let s = '';
  try { s = execFileSync(process.execPath, [join(WEB, '..', '..', 'tools/sitio/cdp/hilo-exactitud.mjs'), '--url', process.env.ROVAQ_URL, '--vp', '1440,390'], {encoding: 'utf8', timeout: 600000}); } catch (e) { assert.fail(e.stdout || e.message); }
  assert.equal((s.match(/^OK /gm) || []).length, 2, s);
});
