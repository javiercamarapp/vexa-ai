// T49: teclado, sin JavaScript y tableta. Sin Chrome: el contrato del CSS y la lógica pura de tools/sitio/cdp/teclado.mjs.
// Con ROVAQ_CDP_VIVO=1 y ROVAQ_URL: Tab completo (foco visible, orden, sin trampa, menú con Enter y Esc), sitio sin JavaScript y texto mínimo a 768 px en Chrome real.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {evaluarParadas} from '../../../../tools/sitio/cdp/teclado.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));
const WEB = join(AQUI, '..', '..');
const RAIZ = join(WEB, '..', '..');
const BASE = readFileSync(join(WEB, 'src/styles/sitio/base.css'), 'utf8');
const INICIO = readFileSync(join(WEB, 'src/styles/sitio/inicio.css'), 'utf8');

test('CSS: el menú desplegable solo se abre por :focus-within sin JavaScript (con JavaScript Esc debe poder cerrarlo)', () => {
  assert.match(BASE, /html:not\(\[data-js\]\) \.s-cabecera__item:focus-within > \.s-menu,\s*\.s-cabecera__item\[data-abierto\] > \.s-menu \{/);
  assert.doesNotMatch(BASE, /\n\.s-cabecera__item:focus-within > \.s-menu/);
});

test('CSS: el rótulo «80 %» de la captura del héroe mide 11 px o más en tableta (32 unidades a 704 px de ventana)', () => {
  assert.match(INICIO, /@container \(max-width: 879px\) \{\s*\.s-ov__eje \{ font-size: 32px; \}/);
  assert.ok((32 * 704) / 2000 >= 11);
});

test('evaluarParadas: oculta, sin anillo, fuera de ventana, desorden y trampa fallan; la cabecera fija no cuenta en el orden', () => {
  const ok = {desc: 'a', texto: 'x', y: 100, enVentana: true, oculto: false, anillo: true, foco: true, fijo: false};
  assert.deepEqual(evaluarParadas([ok, {...ok, y: 300}]), []);
  assert.equal(evaluarParadas([{...ok, anillo: false}]).length, 1);
  assert.equal(evaluarParadas([{...ok, oculto: true}]).length, 1);
  assert.equal(evaluarParadas([{...ok, enVentana: false}]).length, 1);
  assert.equal(evaluarParadas([ok, {...ok, y: 900}, {...ok, y: 100}]).length, 1);
  assert.deepEqual(evaluarParadas([ok, {...ok, y: 900}, {...ok, y: 11, fijo: true}]), []);
  assert.equal(evaluarParadas(Array(160).fill(ok), {max: 160}).length, 1);
});

const vivo = process.env.ROVAQ_CDP_VIVO === '1' && process.env.ROVAQ_URL;
const correr = (herramienta, args) => { try { return execFileSync(process.execPath, [join(RAIZ, 'tools/sitio/cdp', herramienta), '--url', process.env.ROVAQ_URL, ...args], {encoding: 'utf8', timeout: 900000}); } catch (e) { return assert.fail(e.stdout || e.message); } };
const skip = vivo ? false : 'PENDIENTE: corrida real de Chrome; ROVAQ_CDP_VIVO=1 y ROVAQ_URL';
test('Chrome: Tab recorre la portada en orden con foco visible y sin trampa, y el menú cierra con Esc', {skip}, () => {
  const s = correr('teclado.mjs', ['--vp', '1440,390', '--esquema', 'dark,light']);
  assert.equal((s.match(/^OK /gm) || []).length, 6, s);
});
test('Chrome: sin JavaScript todo el texto se ve, las imágenes cargan y los enlaces responden', {skip}, () => {
  const s = correr('sin-js.mjs', ['--vp', '1440,390']);
  assert.equal((s.match(/^OK /gm) || []).length, 2, s);
});
test('Chrome: a 768 px ningún texto baja de 11 px', {skip}, () => {
  const s = correr('texto-minimo.mjs', ['--vp', '768']);
  assert.match(s, /^OK /m, s);
});
