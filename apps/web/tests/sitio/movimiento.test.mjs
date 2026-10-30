// Movimiento (T10): sitio.js, inicio.js, genera-hilo.mjs, movimiento.css y la emisión del script en el layout.
// Sin Chrome: pruebas de fuente, geometría y presupuestos. Con ROVAQ_CDP_VIVO=1 y ROVAQ_URL (un `next start` con Host rovaq.ai
// ya en marcha) corre además las pruebas de comportamiento en Chrome real por el arnés de tools/sitio/cdp.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {brotliCompressSync, constants as zc} from 'node:zlib';

const AQUI = dirname(fileURLToPath(import.meta.url));
const WEB = join(AQUI, '..', '..');
const RAIZ = join(WEB, '..', '..');
const leer = (r) => readFileSync(join(WEB, r), 'utf8');
const SITIO = leer('src/sitio-js/sitio.js');
const INICIO = leer('src/sitio-js/inicio.js');
const CSS = leer('src/styles/sitio/movimiento.css');
const LAYOUT = leer('src/app/(sitio)/sitio/[lang]/layout.tsx');
const manifest = JSON.parse(leer('public/s/manifest.json'));
globalThis.document ??= {}; // inicio.js toca document solo dentro de funciones
const I = await import(pathToFileURL(join(WEB, 'src/sitio-js/inicio.js')).href);
const brotli = (s) => brotliCompressSync(Buffer.from(s), {params: {[zc.BROTLI_PARAM_QUALITY]: 11}}).length;

test('fuente: sin eval, new Function, innerHTML, document.write ni style por atributo', () => {
  for (const [n, s] of [['sitio', SITIO], ['inicio', INICIO]]) {
    for (const re of [/\beval\s*\(/, /new\s+Function\s*\(/, /\.innerHTML\b/, /outerHTML/, /document\.write/, /setAttribute\(\s*['"]style['"]/, /insertAdjacentHTML/, /gsap|ScrollTrigger/i])
      assert.ok(!re.test(s), `${n}.js contiene ${re}`);
  }
});

test('fuente: nada de inert ni hidden fuera de los puestos; el hilo no bloquea la página', () => {
  assert.ok(!/inert/.test(SITIO + INICIO + CSS));
  assert.ok(!/main\.inert|\.inert\s*=/.test(SITIO + INICIO));
  assert.equal((SITIO.match(/\.hidden\s*=/g) || []).length, 1, 'solo el panel de puestos usa hidden');
  assert.ok(!/preventDefault\(\)[^}]*wheel/.test(SITIO), 'no se intercepta la rueda');
});

test('presupuestos: brotli por archivo bajo el tope (sitio 8 KB, inicio 9 KB)', () => {
  const sitio = manifest.js['sitio.js'], inicio = manifest.js['inicio.js'];
  assert.ok(sitio && inicio, 'sitio.js e inicio.js deben estar en el manifest (node tools/sitio/construir-js.mjs)');
  assert.ok(sitio.brotli + inicio.brotli <= 11.6 * 1024, `JS propio ${sitio.brotli + inicio.brotli} B: objetivo 11.6 KB (techo 14)`);
  assert.ok(sitio.brotli <= 8 * 1024, `sitio.js ${sitio.brotli} B`);
  assert.ok(inicio.brotli <= 9 * 1024, `inicio.js ${inicio.brotli} B`);
  for (const k of ['sitio.js', 'inicio.js']) {
    const f = join(WEB, 'public', manifest.js[k].url);
    assert.ok(existsSync(f), k);
    assert.equal(brotli(readFileSync(f)), manifest.js[k].brotli, k + ' no coincide con el manifest: reconstruir');
  }
});

test('sin cargador bloqueante ni Lenis: scroll nativo y héroe legible desde el primer pintado', () => {
  assert.ok(!/cargador|rovaq-intro|data-intro|s-cargando/.test(SITIO + INICIO), 'ni cargador ni estados de intro en el JS');
  assert.ok(!/cargador|s-cargando/.test(CSS), 'ni cargador en movimiento.css');
  assert.ok(!/Lenis|lenis|urls\.nube/.test(SITIO + INICIO + LAYOUT), 'sin Lenis ni nube: scroll nativo');
  assert.ok(!manifest.js['nube.js'] && !manifest.js['lenis.js'] && !manifest.pts, 'el manifest ya no lista nube, Lenis ni pts');
});

test('escena de tema global: un atributo en html, histéresis 42 por ciento al bajar y 58 al subir, transición solo tras el primer cuadro', () => {
  assert.match(SITIO, /innerHeight \* \(bajando \? 0\.42 : 0\.58\)/);
  assert.match(SITIO, /H\.setAttribute\('data-ambiente', t\)/);
  assert.match(SITIO, /data-ambiente-anim/);
  assert.match(SITIO, /addEventListener\('scroll', pedir, \{passive: true\}\)/);
});

test('movimiento reducido: sin conteo y sin barrido; los pasos de la escena fija solo se marcan con movimiento permitido', () => {
  assert.match(SITIO, /function conteo\(\) \{\n  if \(RM\) return;/);
  assert.match(SITIO, /if \(NAT \|\| RM \|\| !origen\) return/);
  assert.match(INICIO, /const escenaActiva = \(\) => !RM && ancho\(\) > 1100/);
});

test('layout: un solo script de módulo con defer implícito, URL del manifest y sin script en línea', () => {
  assert.match(LAYOUT, /<script type="module" src=\{sitio\}/);
  assert.equal((LAYOUT.match(/<script/g) || []).length, 1);
  assert.ok(!/dangerouslySetInnerHTML/.test(LAYOUT));
  assert.match(LAYOUT, /preloadModule\(sitio/);
  assert.match(LAYOUT, /movimiento\.css/);
});

test('CSS propio: solo tokens, prefijo s-, sin hex ni rgba, estados ocultos solo con movimiento permitido', () => {
  assert.ok(!/#[0-9a-f]{3,8}\b/i.test(CSS) && !/rgba?\(/.test(CSS));
  for (const m of CSS.matchAll(/^\.([a-z][\w-]*)/gm)) assert.ok(m[1].startsWith('s-'), m[1]);
  const fuera = CSS.split('@media (prefers-reduced-motion: no-preference) and (scripting: enabled)')[0];
  assert.ok(!/opacity:\s*0/.test(fuera), 'opacity 0 fuera de no-preference');
});

test('hilo: acciones puras de inicio.js (pasoDe con histéresis)', () => {
  assert.equal(I.pasoDe(0.5, 0), 0);
  assert.equal(I.pasoDe(1.03, 0), 0);
  assert.equal(I.pasoDe(1.05, 0), 1);
  assert.equal(I.pasoDe(0.97, 1), 1);
  assert.equal(I.pasoDe(0.95, 1), 0);
  assert.equal(I.pasoDe(3.9, 0), 3);
});

test('hilo serpenteante: núcleo de 3.5 px a 1440 y 2.5 a 390, recorrido calculado con las medidas reales, cruces por huecos libres, pulso de capas con glow, nodos, notas y cabeza', () => {
  const css = leer('src/styles/sitio/inicio.css');
  assert.match(css, /--s-hilo-w: 3\.5px/);
  assert.match(css, /@media \(max-width: 768px\) \{\n  \.s-hilo-zona \{ --s-hilo-w: 2\.5px; \}/);
  assert.match(css, /html:not\(\[data-js\]\) \.s-hilo-zona::before/, 'pista estática solo sin JavaScript');
  assert.match(css, /\.s-hilo__brillo \{ filter: blur\(5px\); \}/);
  assert.match(INICIO, /function huecos\(/, 'los huecos libres salen de las cajas de maquetación reales (offsetTop, sin transformaciones de revelado)');
  assert.match(INICIO, /new ResizeObserver\(medir\)/);
  assert.match(INICIO, /const AIRE = 20/, 'margen mínimo de 16 px más medio núcleo y holgura');
  assert.match(INICIO, /const PULSO = \[\[230, 0\.1\], \[150, 0\.22\], \[90, 0\.45\], \[40, 0\.9\]\]/);
  assert.match(INICIO, /pts\.push\(\[pts\[pts\.length - 1\]\[0\], y0\]\)/, 'el cruce arranca desde el carril actual y termina en el otro');
  assert.match(INICIO, /C\$\{x0\.toFixed\(1\)\} \$\{\(y0 \+ m\)\.toFixed\(1\)\} \$\{x1\.toFixed\(1\)\} \$\{\(y1 - m\)\.toFixed\(1\)\}/, 'curvas en S de tangentes verticales: monótonas en Y');
  assert.match(INICIO, /if \(RM \|\| !vivo \|\| !H\) return/, 'con movimiento reducido el hilo queda dibujado y sin pulso');
  assert.match(INICIO, /s-hilo__nota/);
  assert.ok(!/gsap|ScrollTrigger|lenis/i.test(INICIO));
});

// ---------------- Chrome real (ROVAQ_CDP_VIVO=1 y ROVAQ_URL) ----------------
const URL_VIVA = process.env.ROVAQ_URL;
const vivo = process.env.ROVAQ_CDP_VIVO === '1' && !!URL_VIVA;
const motivo = 'PENDIENTE: corrida real de Chrome; ROVAQ_CDP_VIVO=1 ROVAQ_URL=http://127.0.0.1:PUERTO/';
const sesion = async (opc, fn) => {
  const {conSesion} = await import(pathToFileURL(join(RAIZ, 'tools/sitio/cdp/navegador.mjs')).href);
  return conSesion({sinCandado: false, ...opc}, fn);
};
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const rutas = (s) => s.registro.peticiones.map((u) => new URL(u).pathname);

test('Chrome: la portada no pide nube, pts ni Lenis, no hay canvas y el CSP no registra violaciones', {skip: vivo ? false : motivo}, async () => {
  await sesion({vp: 1440, etiqueta: 'mov-sin-nube'}, async (s) => {
    await s.page.goto(URL_VIVA, {waitUntil: 'load'});
    await dormir(3000);
    const r = rutas(s);
    assert.ok(!r.some((p) => /nube\.|\.pts$|lenis/.test(p)), r.filter((p) => /nube\.|\.pts$|lenis/.test(p)).join(','));
    assert.equal(await s.page.locator('canvas').count(), 0, 'sin canvas en el DOM');
    assert.deepEqual(await s.page.evaluate(() => window.__rovaq.csp), []);
  });
});

test('Chrome: movimiento reducido: ninguna animación ni transición de más de 150 ms y estado final del héroe', {skip: vivo ? false : motivo}, async () => {
  await sesion({vp: 1440, movimiento: 'reduce', etiqueta: 'mov-reducido'}, async (s) => {
    await s.page.goto(URL_VIVA, {waitUntil: 'load'});
    await dormir(5000);
    const largas = await s.page.evaluate(() => document.getAnimations().filter((a) => a.effect?.getTiming().duration > 150).length);
    assert.equal(largas, 0, 'sin animaciones largas');
    assert.equal(await s.page.evaluate(() => document.querySelector('[data-cuenta]').textContent), '36,000');
  });
});

test('Chrome: el trazo serpenteante cruza de lado a lado y no toca texto, imágenes, botones ni tarjetas (barrido a 1440 y 390, margen mínimo de 16 px)', {skip: vivo ? false : motivo}, async () => {
  const {execFileSync} = await import('node:child_process');
  const salida = execFileSync(process.execPath, [join(RAIZ, 'tools/sitio/cdp/hilo-carril.mjs'), '--url', URL_VIVA, '--vp', '1440,390', '--margen', '16'], {encoding: 'utf8', timeout: 300000});
  assert.match(salida, /OK +vp 1440: grosor 3\.5 px, ([2-9]|\d\d+) cruces/);
  assert.match(salida, /OK +vp 390/);
});
