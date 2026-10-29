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
  assert.match(SITIO, /H\.setAttribute\('data-escena', t\)/);
  assert.match(SITIO, /data-escena-anim/);
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
