// Pruebas de la matemática pura de nube.js (T5): remapeo del héroe, tiempo por punto del morfo, línea de tiempo de la condensación, trayectorias,
// niveles de calidad, regulador por mediana de cuadros, resorte del puntero y semillas. Las partes de WebGL se verifican con el arnés de Chrome (fuera del repo).
// Se corre con: node --test apps/web/tests/sitio/nube-matematica.test.mjs
import {test, describe} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {remapeo, tiempoPunto, lineaDeTiempo, trayectoria, retardoDe, elegirNivel, Regulador, pasoResorte, semillas, NIVELES, crearNube} from '../../src/sitio-js/nube.js';

const FUENTE = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '../../src/sitio-js/nube.js'), 'utf8');

describe('remapeo del progreso del héroe', () => {
  test('f(0)=0, f(1)=1 y f(0.5)=0.5', () => { assert.equal(remapeo(0), 0); assert.equal(remapeo(1), 1); assert.ok(Math.abs(remapeo(0.5) - 0.5) < 1e-12); });
  test('es monótona y se queda en 0..1 (también con entradas fuera de rango)', () => {
    let prev = -1; for (let i = 0; i <= 1000; i++) { const v = remapeo(i / 1000); assert.ok(v >= prev - 1e-12 && v >= 0 && v <= 1); prev = v; }
    assert.equal(remapeo(-3), 0); assert.equal(remapeo(7), 1);
  });
  test('la cámara se detiene a la mitad: pendiente menor que 1 en el centro y mayor en los extremos', () => {
    const d = (x) => (remapeo(x + 1e-4) - remapeo(x - 1e-4)) / 2e-4; assert.ok(d(0.5) < 0.7); assert.ok(d(0.02) > 0.6);
  });
});

describe('tiempo por punto del morfo', () => {
  test('mezcla 0 devuelve el origen y mezcla 1 el destino, para cualquier retardo', () => { for (const r of [0, 0.3, 0.77, 1]) { assert.equal(tiempoPunto(0, r), 0); assert.ok(Math.abs(tiempoPunto(1, r) - 1) < 1e-12); } });
  test('es monótono en la mezcla y acotado; un retardo mayor nunca llega antes', () => {
    for (const r of [0, 0.4, 1]) { let prev = -1; for (let i = 0; i <= 200; i++) { const v = tiempoPunto(i / 200, r); assert.ok(v >= prev - 1e-12 && v >= 0 && v <= 1 && Number.isFinite(v)); prev = v; } }
    for (let i = 0; i <= 100; i++) assert.ok(tiempoPunto(i / 100, 0) >= tiempoPunto(i / 100, 1) - 1e-12);
  });
  test('todos los puntos han llegado antes de mezcla 1 (la forma termina antes que la transición)', () => { assert.ok(Math.abs(tiempoPunto(0.82, 1) - 1) < 1e-9); });
  test('el retardo por punto está acotado a 0..1 y favorece la parte alta', () => { for (const a of [0, 0.5, 1]) for (const y of [-1, 0, 1]) { const r = retardoDe(a, y); assert.ok(r >= 0 && r <= 1); } assert.ok(retardoDe(0.5, 1) < retardoDe(0.5, -1)); });
});

describe('línea de tiempo de la condensación', () => {
  test('en reposo (t=0 y t=1) todo es sólido y sin nube sobrante', () => { const a = lineaDeTiempo(0), b = lineaDeTiempo(1); assert.equal(a.solido, 1); assert.equal(b.solido, 1); assert.equal(b.fade, 0); });
  test('el sólido saliente se disuelve en el 14 % inicial y no hay sólido entre 14 % y 70 %', () => {
    assert.equal(lineaDeTiempo(0.14).solido, 0); for (let t = 0.14; t <= 0.7; t += 0.02) assert.equal(lineaDeTiempo(t).solido, 0);
    let prev = 2; for (let t = 0; t <= 0.14; t += 0.01) { const s = lineaDeTiempo(t).solido; assert.ok(s <= prev + 1e-12); prev = s; }
  });
  test('el sólido entrante crece de 70 % a 98 % y la nube se desvanece de 85 % a 100 %', () => {
    let prev = -1; for (let t = 0.7; t <= 1; t += 0.01) { const s = lineaDeTiempo(t).solido; assert.ok(s >= prev - 1e-12); prev = s; }
    assert.equal(lineaDeTiempo(0.98).solido, 1); assert.equal(lineaDeTiempo(0.8).fade, 1); assert.ok(lineaDeTiempo(0.92).fade < 1 && lineaDeTiempo(0.92).fade > 0);
  });
});

describe('trayectoria', () => {
  const a = [-0.5, 0.2, 0.9], b = [0.7, -0.4, -0.3], dir = [0.3, -0.8, 0.5];
  test('empieza en el origen y termina en el destino', () => {
    const p0 = trayectoria(a, b, dir, 0.5, 0), p1 = trayectoria(a, b, dir, 0.5, 1); for (let k = 0; k < 3; k++) { assert.ok(Math.abs(p0[k] - a[k]) < 1e-9); assert.ok(Math.abs(p1[k] - b[k]) < 1e-9); }
  });
  test('sin NaN y continua: pasos pequeños de la mezcla dan saltos pequeños', () => {
    let prev = trayectoria(a, b, dir, 0.3, 0); for (let i = 1; i <= 500; i++) { const p = trayectoria(a, b, dir, 0.3, i / 500); assert.ok(p.every(Number.isFinite)); assert.ok(Math.hypot(p[0] - prev[0], p[1] - prev[1], p[2] - prev[2]) < 0.06); prev = p; }
  });
  test('a mitad de vuelo se abre hacia su dirección (más lejos del segmento recto)', () => {
    const m = trayectoria(a, b, dir, 0.5, 0.45, 0.2), n = trayectoria(a, b, dir, 0.5, 0.45, 0); assert.ok(Math.hypot(m[0] - n[0], m[1] - n[1], m[2] - n[2]) > 0.01);
  });
});

describe('niveles de calidad', () => {
  test('puntos por nivel: 12 000, 7 000 y 4 500', () => assert.deepEqual(NIVELES, {alto: 12000, medio: 7000, bajo: 4500}));
  test('escritorio con GPU y memoria: alto; tableta: medio; móvil: bajo', () => {
    assert.equal(elegirNivel({ancho: 1440, memoria: 8, tipoRed: '4g'}), 'alto'); assert.equal(elegirNivel({ancho: 900, memoria: 8}), 'medio'); assert.equal(elegirNivel({ancho: 390, memoria: 8}), 'bajo');
    assert.equal(elegirNivel({ancho: 1440, memoria: 4}), 'medio'); assert.equal(elegirNivel({ancho: 1440, memoria: 8, tipoRed: '3g'}), 'medio');
  });
  test('ahorro de datos, red 2g o memoria de 2 o menos: sin nube (respaldo)', () => {
    assert.equal(elegirNivel({ahorro: true}), null); assert.equal(elegirNivel({tipoRed: 'slow-2g'}), null); assert.equal(elegirNivel({tipoRed: '2g'}), null); assert.equal(elegirNivel({memoria: 2}), null);
  });
});

describe('regulador por mediana de cuadros', () => {
  test('30 cuadros de 16 ms no bajan el nivel', () => { const r = new Regulador(); for (let i = 0; i < 29; i++) assert.equal(r.muestra(16.6), false); assert.equal(r.muestra(16.6), false); });
  test('mediana de 30 cuadros mayor de 20 ms baja el nivel (a la muestra 30)', () => { const r = new Regulador(); for (let i = 0; i < 29; i++) assert.equal(r.muestra(24), false); assert.equal(r.muestra(24), true); });
  test('un pico aislado no basta: la mediana manda', () => { const r = new Regulador(); for (let i = 0; i < 29; i++) r.muestra(i % 10 === 0 ? 90 : 15); assert.equal(r.muestra(15), false); });
  test('las muestras no válidas o de pestaña dormida (más de 250 ms) se ignoran', () => { const r = new Regulador(); for (let i = 0; i < 60; i++) assert.equal(r.muestra(i % 2 ? 900 : NaN), false); for (let i = 0; i < 29; i++) r.muestra(17); assert.equal(r.muestra(17), false); });
  test('tras decidir, la ventana empieza de cero', () => { const r = new Regulador(); for (let i = 0; i < 30; i++) r.muestra(30); for (let i = 0; i < 29; i++) assert.equal(r.muestra(16), false); });
});

describe('resorte del puntero (k 120, c 22)', () => {
  test('converge al objetivo sin oscilar de forma apreciable (amortiguamiento crítico)', () => {
    let e = {x: 0, v: 0}, max = 0; for (let i = 0; i < 120; i++) { e = pasoResorte(e, 0.05, 1 / 60); max = Math.max(max, e.x); } assert.ok(Math.abs(e.x - 0.05) < 1e-4); assert.ok(max < 0.0501);
  });
  test('asienta en unos 0.8 s y es estable con pasos grandes', () => {
    let e = {x: 0, v: 0}; for (let i = 0; i < 48; i++) e = pasoResorte(e, 1, 1 / 60); assert.ok(Math.abs(e.x - 1) < 0.1);
    let g = {x: 0, v: 0}; for (let i = 0; i < 200; i++) { g = pasoResorte(g, 1, 0.05); assert.ok(Number.isFinite(g.x)); } assert.ok(Math.abs(g.x - 1) < 1e-3);
  });
});

describe('semillas', () => {
  test('deterministas y de la longitud pedida', () => { const a = semillas(1000), b = semillas(1000); assert.equal(a.length, 4000); assert.deepEqual([...a], [...b]); });
  test('el prefijo no depende del total (el nivel bajo ve las mismas semillas)', () => { assert.deepEqual([...semillas(100)], [...semillas(1000).subarray(0, 400)]); });
  test('el retardo está repartido en todo el rango', () => { const s = semillas(2000); let mn = 255, mx = 0; for (let i = 0; i < 2000; i++) { mn = Math.min(mn, s[i * 4 + 3]); mx = Math.max(mx, s[i * 4 + 3]); } assert.ok(mn < 20 && mx > 235); });
});

describe('contrato del módulo', () => {
  test('sin DOM, crearNube cae a respaldo sin lanzar y deja una API completa', () => {
    const dataset = {}, canvas = {dataset, hasAttribute: () => true, getContext: () => null, addEventListener() {}};
    globalThis.innerWidth = 1440; globalThis.matchMedia = () => ({matches: false, addEventListener() {}});
    const n = crearNube(canvas, {});
    for (const k of ['cargar', 'mostrar', 'mezcla', 'progreso', 'tema', 'pausar', 'reanudar', 'destruir']) assert.equal(typeof n[k], 'function', k);
    assert.equal(dataset.estado, 'respaldo'); assert.equal(n.estado, 'respaldo');
  });
  test('con movimiento reducido no pide WebGL: respaldo directo', () => {
    let pidio = false; const canvas = {dataset: {}, hasAttribute: () => true, getContext: () => { pidio = true; return null; }, addEventListener() {}};
    globalThis.matchMedia = (q) => ({matches: /reduce/.test(q), addEventListener() {}}); crearNube(canvas, {}); assert.equal(pidio, false); assert.equal(canvas.dataset.estado, 'respaldo');
  });
  test('sin eval, new Function, wasm, importaciones externas, estilos en línea ni colores fijos de CSS en el módulo', () => {
    assert.ok(!/\beval\s*\(/.test(FUENTE)); assert.ok(!/new Function/.test(FUENTE)); assert.ok(!/WebAssembly|\.wasm/.test(FUENTE)); assert.ok(!/^\s*import\s/m.test(FUENTE));
    assert.ok(!/\.style\b|setAttribute\(\s*['"]style|cssText/.test(FUENTE)); assert.ok(!/https?:\/\//.test(FUENTE));
    for (const v of ['--s-tinta', '--s-acento', '--s-fondo']) assert.ok(FUENTE.includes(v));
  });
  test('expone los atributos de estado del contrato (data-estado, data-cuadros, data-nivel)', () => { assert.ok(/dataset\.estado/.test(FUENTE) && /dataset\.cuadros/.test(FUENTE) && /dataset\.nivel/.test(FUENTE)); });
});
