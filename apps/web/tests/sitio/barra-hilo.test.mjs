// T49: el hilo serpenteante no pasa por debajo de la barra de navegación ni la roza.
// En T23 el juez midió a scroll 4800 px un trazo entrando por detrás del cristal de la barra y saliendo tangente a su borde inferior (18 px de superposición);
// hilo-carril.mjs lo dejaba pasar porque ignora .s-cabecera. Ahora la capa del hilo lleva una máscara que inicio.js mueve con el scroll (--s-corte).
// Sin Chrome: el contrato del CSS y del JS y las funciones puras de tools/sitio/cdp/barra-hilo.mjs.
// Con ROVAQ_CDP_VIVO=1 y ROVAQ_URL: píxeles reales (el hilo visible contra el hilo oculto en la franja de la barra) a 1440, 768 y 390.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {pixelesDistintos, repartir, AIRE_MIN, UMBRAL_CANAL} from '../../../../tools/sitio/cdp/barra-hilo.mjs';
import {codificarPng} from '../../../../tools/sitio/cdp/png.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));
const WEB = join(AQUI, '..', '..');
const RAIZ = join(WEB, '..', '..');
const CSS = readFileSync(join(WEB, 'src/styles/sitio/inicio.css'), 'utf8');
const JS = readFileSync(join(WEB, 'src/sitio-js/inicio.js'), 'utf8');

const png = (ancho, alto, relleno, cambios = []) => {
  const datos = Buffer.alloc(ancho * alto * 3, relleno);
  for (const [x, y, v] of cambios) for (let c = 0; c < 3; c++) datos[(y * ancho + x) * 3 + c] = v;
  return codificarPng({ancho, alto, canales: 3, datos});
};

test('pixelesDistintos: iguales dan 0, uno distinto da 1 y bajo el umbral no cuenta', () => {
  assert.equal(pixelesDistintos(png(8, 8, 40), png(8, 8, 40)), 0);
  assert.equal(pixelesDistintos(png(8, 8, 40), png(8, 8, 40, [[3, 3, 200]])), 1);
  assert.equal(pixelesDistintos(png(8, 8, 40), png(8, 8, 40, [[3, 3, 40 + UMBRAL_CANAL]])), 0);
  assert.throws(() => pixelesDistintos(png(8, 8, 40), png(9, 8, 40)), /distinto tamaño/);
});

test('repartir: conserva primera y última y respeta el máximo', () => {
  const r = repartir(Array.from({length: 100}, (_, i) => i * 60), 10);
  assert.equal(r.length, 10);
  assert.equal(r[0], 0);
  assert.equal(r.at(-1), 99 * 60);
  assert.deepEqual(repartir([1, 2, 3], 10), [1, 2, 3]);
});

test('CSS: la capa del hilo lleva máscara con --s-corte, opaca desde su origen sin JavaScript y con 28 px de desvanecido', () => {
  const m = CSS.match(/html\[data-js\] \.s-hilo-zona > \[data-hilo\] \{([^}]*)\}/);
  assert.ok(m, 'regla de la capa con máscara');
  const r = m[1];
  assert.match(r, /--s-corte:\s*-\d+px/, 'sin recorte activo el gradiente ya es opaco desde el borde superior');
  assert.match(r, /position:\s*absolute/);
  assert.match(r, /inset:\s*0/);
  assert.match(r, /z-index:\s*var\(--s-z-hilo\)/, 'misma altura de apilado que tenían el trazo, los nodos y las notas');
  assert.match(r, /mask-image:\s*linear-gradient\(to bottom, transparent var\(--s-corte\), #000 calc\(var\(--s-corte\) \+ 28px\)\)/);
  assert.match(r, /-webkit-mask-image:/);
});

test('JS: el corte sigue el borde inferior de la barra con el aire mínimo, se actualiza en cada cuadro y también con movimiento reducido', () => {
  const aire = Number(/const CORTE_AIRE = (\d+);/.exec(JS)?.[1]);
  assert.ok(aire >= AIRE_MIN, `CORTE_AIRE ${aire} px debe ser al menos ${AIRE_MIN}`);
  assert.match(JS, /\$\('\.s-cabecera__barra'\)/);
  assert.match(JS, /getBoundingClientRect\(\)\.bottom : 0\) \+ CORTE_AIRE - zona\.getBoundingClientRect\(\)\.top/);
  assert.match(JS, /cont\.style\.setProperty\('--s-corte'/);
  const cuadro = JS.slice(JS.indexOf('cuadro(y, vh) {'));
  const iCortar = cuadro.indexOf('cortar();');
  const iSalida = cuadro.indexOf('if (RM || !vivo || !H) return;');
  assert.ok(iCortar > 0 && iSalida > iCortar, 'cortar() va antes de la salida por movimiento reducido: con RM el trazo está dibujado entero y también pasaría bajo la barra');
});

const vivo = process.env.ROVAQ_CDP_VIVO === '1' && process.env.ROVAQ_URL;
test('Chrome: ningún píxel del hilo en la franja de la barra (más 10 px) a 1440, 768 y 390, en oscuro y en claro', {skip: vivo ? false : 'PENDIENTE: corrida real de Chrome; ROVAQ_CDP_VIVO=1 y ROVAQ_URL'}, () => {
  for (const esquema of ['dark', 'light']) {
    let salida = '';
    try {
      salida = execFileSync(process.execPath, [join(RAIZ, 'tools/sitio/cdp/barra-hilo.mjs'), '--url', process.env.ROVAQ_URL, '--vp', '1440,768,390', '--max', '12', '--esquema', esquema], {encoding: 'utf8', timeout: 900000});
    } catch (e) {
      assert.fail(`${esquema}: ${e.stdout || e.message}`);
    }
    assert.equal((salida.match(/^OK /gm) || []).length, 3, `${esquema}: ${salida}`);
  }
});
