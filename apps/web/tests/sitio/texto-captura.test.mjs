// T49: el texto dentro de las capturas de producto (tarjetas de cifras y pasos 1 a 4) mide 11 px efectivos o más a 390 px, sin cifras cortadas en el borde.
// texto-minimo.test.mjs no puede verlo: mide texto del DOM y esto es texto de imagen. Se calcula con el ancho con que se pinta la imagen y el tamaño del texto en la
// pantalla original (ver tools/sitio/cdp/texto-captura.mjs). Sin Chrome: se resuelve el CSS de pulido.css a 360, 390 y 428 px y se exige el mínimo en cada uno.
// Con ROVAQ_CDP_VIVO=1 y ROVAQ_URL: lo mide en Chrome real.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {CAPTURAS, PX_POR_UNIDAD, efectivo} from '../../../../tools/sitio/cdp/texto-captura.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));
const WEB = join(AQUI, '..', '..');
const RAIZ = join(WEB, '..', '..');
const PULIDO = readFileSync(join(WEB, 'src/styles/sitio/pulido.css'), 'utf8');
const RECORTES = readFileSync(join(RAIZ, 'tools/sitio/recortes-pasos.mjs'), 'utf8');
const movil = PULIDO.slice(PULIDO.indexOf('/* ---------- S5 Pasos en móvil'), PULIDO.indexOf('/* ---------- Móvil: ritmo vertical compacto'));

test('las unidades de CAPTURAS son las de los recortes (recortes-pasos.mjs)', () => {
  for (const [k, c] of Object.entries(CAPTURAS)) {
    const w = Number(new RegExp(`${k}: \\{origen: '[^']+', x: \\d+, y: \\d+, w: (\\d+)`).exec(RECORTES)?.[1]);
    assert.equal(c.unidades, w, `${k}: ${c.unidades} unidades contra ${w} del recorte`);
  }
  assert.equal(PX_POR_UNIDAD, 1440 / 2000);
});

// Ancho de la ventana de producto a cada ancho de pantalla: la pantalla menos 58 px de relleno y borde (332 a 390 px)
const ventana = (vw) => vw - 58;
const tarjeta = (vw) => Math.min(360, Math.max(280, ventana(vw) - 12));

test('CSS: la tarjeta mide el ancho de la ventana menos 12 px, entre 280 y 360 px, y los 12 px que asoman de la siguiente son solo su relleno', () => {
  assert.match(movil, /\.s-ventana--producto \.s-ventana__cuerpo \{ --s-tarjeta: clamp\(280px, calc\(100cqw - 12px\), 360px\); \}/);
  // El relleno izquierdo de una tarjeta de cifras en el original son 16 px (el texto empieza ahí): lo que asoma debe ser menor
  assert.ok(12 < 16 * 0.9);
  assert.match(movil, /\.s-valor__ventana \.s-ventana__cuerpo picture \{[^}]*width: calc\(4 \* var\(--s-tarjeta\)\);[^}]*scroll-snap-align: start/);
  assert.match(movil, /\.s-pv\[data-n="3"\] \.s-pv__lienzo \{ width: calc\(3 \* var\(--s-tarjeta\)\);/);
  assert.match(movil, /\.s-pv\[data-n="2"\] \.s-pv__lienzo \{ width: (\d+)px;/);
  assert.match(movil, /\.s-pv\[data-n="1"\] \.s-pv__lienzo \{ width: (\d+)px; min-width: 100%;/);
  assert.match(movil, /\.s-pv\[data-n="4"\] \.s-pv__lienzo \{ width: (\d+)px; min-width: 100%;/);
  assert.match(movil, /\.s-valor__ventana \.s-ventana__cuerpo \{[^}]*scroll-snap-type: x mandatory/);
  for (const i of [1, 2, 3]) assert.match(movil, new RegExp(`\\.s-snap\\[data-i="${i}"\\] \\{ left: ${i === 1 ? 'var\\(--s-tarjeta\\)' : `calc\\(${i} \\* var\\(--s-tarjeta\\)\\)`}; \\}`));
  assert.match(movil, /\.s-pv\[data-n="3"\] \.s-pv__lienzo \{[^}]*overflow: clip/, 'clip: las marcas de parada cuentan para .s-pv y no para el lienzo');
});

test('CSS: texto efectivo de 11 px o más en valor y pasos 1 a 4 a 320, 360, 390, 428 y 700 px de pantalla', () => {
  const ancho2 = Number(/\.s-pv\[data-n="2"\] \.s-pv__lienzo \{ width: (\d+)px;/.exec(movil)[1]);
  const ancho1 = Number(/\.s-pv\[data-n="1"\] \.s-pv__lienzo \{ width: (\d+)px;/.exec(movil)[1]);
  const ancho4 = Number(/\.s-pv\[data-n="4"\] \.s-pv__lienzo \{ width: (\d+)px;/.exec(movil)[1]);
  for (const vw of [320, 360, 390, 428, 700]) {
    const t = tarjeta(vw);
    const pintado = {valor: 4 * t, paso1: Math.max(ancho1, ventana(vw)), paso2: ancho2, paso3: 3 * t, paso4: Math.max(ancho4, ventana(vw))};
    for (const [k, c] of Object.entries(CAPTURAS)) {
      const e = efectivo(c.unidades, pintado[k], c.texto);
      assert.ok(e >= 11, `${k} a ${vw} px: ${e.toFixed(2)} px efectivos (${Math.round(pintado[k])} px pintados)`);
    }
  }
});

test('el marcado: la tira de valor y el paso 3 llevan sus marcas de parada vacías y el desplazamiento tiene nombre y foco', () => {
  const marcado = readFileSync(join(WEB, 'src/components/sitio/secciones/problema-valor.tsx'), 'utf8');
  assert.match(marcado, /\[1, 2, 3\]\.map\(\(i\) => <span className="s-snap" data-i=\{i\}[^>]*aria-hidden="true"/);
  assert.match(marcado, /'data-desplaza': '', tabIndex: 0, role: 'group', 'aria-label'/, 'foco desde el servidor: axe (scrollable-region-focusable) exige el foco mientras desborda y no debe depender de que llegue el JavaScript');
  const inicio = readFileSync(join(WEB, 'src/sitio-js/inicio.js'), 'utf8');
  assert.match(inicio, /\$\$\('\[data-desplaza\]'\)\.forEach[\s\S]*?scrollWidth > e\.clientWidth \+ 1 \? e\.setAttribute\('tabindex', '0'\) : e\.removeAttribute\('tabindex'\)/);
  const paso = readFileSync(join(WEB, 'src/components/sitio/secciones/ventana-paso.tsx'), 'utf8');
  assert.match(paso, /n === 3 \? \[1, 2\]\.map\(\(i\) => <span className="s-snap"/);
});

const vivo = process.env.ROVAQ_CDP_VIVO === '1' && process.env.ROVAQ_URL;
test('Chrome: texto efectivo de 11 px o más a 390 y 360 px', {skip: vivo ? false : 'PENDIENTE: corrida real de Chrome; ROVAQ_CDP_VIVO=1 y ROVAQ_URL'}, () => {
  let s = '';
  try { s = execFileSync(process.execPath, [join(RAIZ, 'tools/sitio/cdp/texto-captura.mjs'), '--url', process.env.ROVAQ_URL, '--vp', '390,360'], {encoding: 'utf8', timeout: 600000}); } catch (e) { assert.fail(e.stdout || e.message); }
  assert.equal((s.match(/^OK /gm) || []).length, 10, s);
});
