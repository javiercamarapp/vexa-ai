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
const G = await import(pathToFileURL(join(RAIZ, 'tools/sitio/genera-hilo.mjs')).href);
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
  assert.ok(sitio.brotli <= 8 * 1024, `sitio.js ${sitio.brotli} B`);
  assert.ok(inicio.brotli <= 9 * 1024, `inicio.js ${inicio.brotli} B`);
  for (const k of ['sitio.js', 'inicio.js']) {
    const f = join(WEB, 'public', manifest.js[k].url);
    assert.ok(existsSync(f), k);
    assert.equal(brotli(readFileSync(f)), manifest.js[k].brotli, k + ' no coincide con el manifest: reconstruir');
  }
});

test('cargador: una vez por sesión con sessionStorage en try, salida de seguridad a 3.5 s y salto desde t igual a 0', () => {
  assert.match(SITIO, /try \{ visto = sessionStorage\.getItem\('rovaq-intro'\)/);
  assert.match(SITIO, /setTimeout\(terminar, 3500\)/);
  assert.match(SITIO, /setTimeout\(terminar, 1900\)/);
  for (const e of ['pointerdown', 'keydown', 'wheel', 'touchstart']) assert.ok(SITIO.includes(`'${e}'`));
  assert.match(SITIO, /data-intro-saltado/);
  assert.match(CSS, /s-cargador\[data-fase="salida"\][\s\S]*300ms/);
});

test('movimiento reducido: nube y Lenis no se piden', () => {
  assert.match(INICIO, /const sinNube = RM \|\| ahorro\(\)/);
  assert.match(INICIO, /if \(!RM && fino && !ahorro\(\) && urls\.lenis\)/);
  assert.match(INICIO, /if \(!canvas \|\| sinNube/);
  assert.match(SITIO, /if \(NAT \|\| RM \|\| !origen\) return/);
});

test('Lenis: parámetros de la spec', () => {
  assert.match(INICIO, /duration: 1\.2/);
  assert.match(INICIO, /wheelMultiplier: 0\.9/);
  assert.match(INICIO, /pointer: fine/);
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

test('hilo: acciones puras de inicio.js (pasoDe con histéresis, ahorro)', () => {
  assert.equal(I.pasoDe(0.5, 0), 0);
  assert.equal(I.pasoDe(1.03, 0), 0);
  assert.equal(I.pasoDe(1.05, 0), 1);
  assert.equal(I.pasoDe(0.97, 1), 1);
  assert.equal(I.pasoDe(0.95, 1), 0);
  assert.equal(I.pasoDe(3.9, 0), 3);
  assert.equal(I.ahorro({connection: {saveData: true}}), true);
  assert.equal(I.ahorro({connection: {effectiveType: '3g'}}), true);
  assert.equal(I.ahorro({connection: {effectiveType: '4g'}, deviceMemory: 8}), false);
  assert.equal(I.ahorro({deviceMemory: 2}), true);
});

test('hilo: genera-hilo.mjs y la copia de inicio.js dan el mismo d y la misma tabla', () => {
  for (const m of [G.MEDIDAS_SPEC, G.leerMedidas(), {...G.leerMedidas(), ancho: 1920}]) {
    assert.equal(I.trazar(m), G.trazar(m));
    assert.deepEqual(I.tabla(m), G.tabla(m));
  }
});

test('hilo: 33 fotogramas, monótono, s de 0 a 1, un solo path con siete anclas y salida determinista', () => {
  const m = G.leerMedidas(), t = G.tabla(m);
  assert.equal(t.length, 33);
  assert.equal(t[0].s, 0);
  assert.equal(t[32].s, 1);
  for (let i = 1; i < t.length; i++) { assert.ok(t[i].s >= t[i - 1].s); assert.ok(t[i].y > t[i - 1].y); }
  const g = G.generar(m);
  assert.equal(g.anclas.length, 7);
  assert.equal((g.d.match(/M/g) || []).length, 1);
  assert.equal(JSON.stringify(G.generar(m)), JSON.stringify(g));
  assert.equal(readFileSync(join(RAIZ, 'tools/sitio/hilo-referencia.json'), 'utf8'), JSON.stringify(g, null, 1) + '\n', 'regenerar con node tools/sitio/genera-hilo.mjs');
});

test('hilo: la tabla no es lineal en Y (los giros alargan el arco) y el path es monótono en Y', () => {
  const {pts} = G.polilinea(G.leerMedidas());
  for (let i = 1; i < pts.length; i++) assert.ok(pts[i][1] >= pts[i - 1][1] - 1e-9);
  const t = G.tabla(G.leerMedidas());
  const lineal = t.every((r) => Math.abs(r.s - r.p) < 0.002);
  assert.ok(!lineal);
  assert.match(G.keyframesCss(t), /@keyframes s-hilo-trazo/);
});

test('hilo: carriles a 1440 en 92 y 1348; recto a 20 px bajo 1100', () => {
  const c = G.carriles(1440);
  assert.equal(c.izq, 92);
  assert.equal(c.der, 1348);
  assert.equal(G.carriles(1000).izq, 20);
});

test('íconos del hilo de inicio.js coinciden con components/sitio/iconos', () => {
  const src = leer('src/components/sitio/iconos/iconos.tsx');
  const orden = ['fuentes', 'sello', 'flujo', 'conversacion', 'candado', 'evidencia', 'acceso'];
  const bloque = INICIO.split('// BLOQUE-ICONOS-INICIO')[1].split('// BLOQUE-ICONOS-FIN')[0];
  orden.forEach((n, i) => {
    const cuerpo = src.split(`  ${n}: (`)[1].split('\n  ),')[0];
    const ds = [...cuerpo.matchAll(/d="([^"]+)"/g)].map((x) => x[1]);
    for (const d of ds) assert.ok(bloque.includes(d), `${n}: falta ${d}`);
    assert.equal((cuerpo.match(/<(path|circle|rect)/g) || []).length, (() => {
      const fila = bloque.split('\n').filter((l) => l.startsWith('  [['))[i];
      return (fila.match(/\['(path|circle|rect)'/g) || []).length;
    })(), n);
  });
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

test('Chrome: el cargador se salta al primer evento y no reaparece en la misma sesión; CSP sin violaciones', {skip: vivo ? false : motivo}, async () => {
  await sesion({vp: 1440, etiqueta: 'mov-cargador'}, async (s) => {
    await s.page.goto(URL_VIVA, {waitUntil: 'commit'});
    await s.page.waitForSelector('[data-cargador]', {timeout: 5000});
    await s.page.keyboard.press('Shift');
    await dormir(700);
    assert.equal(await s.page.locator('[data-cargador]').count(), 0, 'el cargador debe retirarse tras el salto');
    await s.page.reload({waitUntil: 'load'});
    await dormir(400);
    assert.equal(await s.page.locator('[data-cargador]').count(), 0, 'no reaparece');
    assert.equal(await s.page.evaluate(() => document.documentElement.hasAttribute('data-intro-visto')), true);
    assert.deepEqual(await s.page.evaluate(() => window.__rovaq.csp), []);
  });
});

test('Chrome: si el módulo falla el overlay libera a los 3.5 s y la página sigue utilizable', {skip: vivo ? false : motivo}, async () => {
  await sesion({vp: 1440, etiqueta: 'mov-falla'}, async (s) => {
    await s.page.route(/\/s\/sitio\.[0-9a-f]+\.js/, (r) => r.abort());
    await s.page.goto(URL_VIVA, {waitUntil: 'load'});
    await dormir(3600);
    const v = await s.page.evaluate(() => {
      const c = document.querySelector('[data-cargador]');
      return {oculto: !c || getComputedStyle(c).visibility === 'hidden', cargando: document.documentElement.classList.contains('cargando'), inert: !!document.querySelector('[inert]'), scroll: getComputedStyle(document.documentElement).overflow};
    });
    assert.equal(v.oculto, true);
    assert.equal(v.cargando, false);
    assert.equal(v.inert, false);
  });
});

test('Chrome: movimiento reducido no pide nube.js, pts ni Lenis', {skip: vivo ? false : motivo}, async () => {
  await sesion({vp: 1440, movimiento: 'reduce', etiqueta: 'mov-reducido'}, async (s) => {
    await s.page.goto(URL_VIVA, {waitUntil: 'load'});
    await dormir(5000);
    const r = rutas(s);
    assert.ok(!r.some((p) => /nube\.|\.pts$|lenis/.test(p)), r.filter((p) => /nube\.|\.pts$|lenis/.test(p)).join(','));
    assert.equal(await s.page.evaluate(() => document.querySelector('[data-cargador]') === null), true);
  });
});

test('Chrome: data-cuadros se detiene fuera de vista y se registran fps', {skip: vivo ? false : motivo}, async () => {
  await sesion({vp: 1440, etiqueta: 'mov-cuadros'}, async (s) => {
    await s.page.goto(URL_VIVA, {waitUntil: 'load'});
    await dormir(4500);
    const n1 = await s.page.evaluate(() => +(document.querySelector('canvas[data-nube="hero"]')?.dataset.cuadros || 0));
    assert.ok(n1 > 0, 'el héroe debe dibujar cuadros');
    await s.page.evaluate(() => scrollTo({top: 9000, behavior: 'instant'}));
    await dormir(1500);
    const a = await s.page.evaluate(() => +(document.querySelector('canvas[data-nube="hero"]')?.dataset.cuadros || 0));
    await dormir(1200);
    const b = await s.page.evaluate(() => +(document.querySelector('canvas[data-nube="hero"]')?.dataset.cuadros || 0));
    assert.equal(a, b, 'sin cuadros nuevos fuera de vista');
    const fps = await s.page.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n++; performance.now() - t0 < 2000 ? requestAnimationFrame(f) : res(n / 2); }; requestAnimationFrame(f); }));
    console.log('fps medidos (rAF, headless):', fps);
  });
});
