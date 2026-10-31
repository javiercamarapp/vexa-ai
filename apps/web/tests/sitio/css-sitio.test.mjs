// CSS del sitio (SPEC 1, 2, 3.11 y 9.3): cero azules, un solo bloque de movimiento reducido,
// todas las clases con prefijo s-. Los escáneres se prueban con fixtures y luego con el CSS real.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { listarArchivos, coloresDeCss, esAzul, bloquesReducedMotion, clasesDeSelectores, leer, rel } from './_escaner.mjs';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIR = join(WEB, 'src', 'styles', 'sitio');
const hay = existsSync(DIR);
const archivos = hay ? listarArchivos(DIR, ['.css']) : [];

test('esAzul distingue azules de grises fríos y del rojo', () => {
  for (const c of ['#0066FF', 'rgb(30, 100, 220)', 'hsl(220, 80%, 50%)', 'blue', '#3B82F6']) assert.ok(esAzul(c), c);
  for (const c of ['#0E0E10', '#3A3C46', '#8F919C', '#E8241C', '#F7F7F8', 'rgb(120 120 128)', 'hsl(231, 8%, 50%)']) assert.ok(!esAzul(c), c);
});

test('bloquesReducedMotion cuenta solo los de reduce', () => {
  const css = '@media (prefers-reduced-motion: reduce) { .s-a{x:y} } @media (prefers-reduced-motion: no-preference) { .s-b{x:y} }';
  assert.equal(bloquesReducedMotion(css), 1);
  assert.equal(bloquesReducedMotion(css, 'no-preference'), 1);
});

test('clasesDeSelectores ignora declaraciones, comentarios, url y keyframes', () => {
  const css = '/* .fuera */ .s-a:hover, .s-b > .x { background: url(a.css); content: ".no"; } @media (min-width:1px){ .s-c{} } @keyframes k { 0%{opacity:0} }';
  assert.deepEqual(clasesDeSelectores(css), ['s-a', 's-b', 's-c', 'x']);
});

const motivo = hay ? false : 'PENDIENTE: src/styles/sitio aún no existe (lo crea T6)';

test('cero colores azules en el CSS del sitio', { skip: motivo }, () => {
  const azules = archivos.flatMap((f) => coloresDeCss(leer(f)).filter(esAzul).map((c) => `${rel(WEB, f)} ${c}`));
  assert.deepEqual(azules, []);
});

test('un solo bloque prefers-reduced-motion: reduce en todo el CSS del sitio', { skip: motivo }, () => {
  const por = Object.fromEntries(archivos.map((f) => [rel(WEB, f), bloquesReducedMotion(leer(f))]));
  const total = Object.values(por).reduce((a, b) => a + b, 0);
  assert.equal(total, 1, `se esperaba 1 bloque y hay ${total}: ${JSON.stringify(por)}`);
});

test('prefijo s- en todas las clases del CSS del sitio', { skip: motivo }, () => {
  const sin = archivos.flatMap((f) => clasesDeSelectores(leer(f)).filter((c) => !c.startsWith('s-')).map((c) => `${rel(WEB, f)} .${c}`));
  assert.deepEqual(sin, []);
});

// T22: correcciones de móvil del juez T21 (hero a 4-5 px, ítem 02 desalineado, pasos 2 y 4 con 70 px vacíos).
{
  const {readFileSync} = await import('node:fs');
  const {join, dirname} = await import('node:path');
  const {fileURLToPath} = await import('node:url');
  const {test} = await import('node:test');
  const assert = (await import('node:assert/strict')).default;
  const WEB22 = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
  const css22 = (f) => readFileSync(join(WEB22, 'src/styles/sitio', f), 'utf8');

  test('T22 móvil: el héroe a 390 conserva la tarjeta de la cifra y no muestra la captura de 4-5 px', () => {
    const c = css22('inicio.css');
    const bloque = c.match(/@container \(max-width: 700px\) \{[\s\S]*?\n\}\n/)[0];
    assert.match(bloque, /\[data-ventana="fuga"\] \.s-ventana__cuerpo \{\s*display: none;/);
  });

  test('T22 móvil: el título de cada regla ocupa el resto de la fila (el ítem 02 ya no salta bajo el número)', () => {
    const c = css22('inicio.css');
    assert.match(c, /@media \(max-width: 480px\) \{[\s\S]*?\.s-regla__titulo \{\s*flex: 1 1 0;\s*min-width: 0;/);
  });

  test('T22 móvil: los pasos 2 y 4 sueltan la proporción de escritorio del lienzo', () => {
    const p = css22('pulido.css');
    assert.match(p, /\.s-pv\[data-n\] \.s-pv__lienzo \{ aspect-ratio: auto; \}/);
  });

  test('T22 captura EN: el reemplazo de «tramo final» no deja doble punto', () => {
    const f = readFileSync(join(WEB22, '..', '..', 'tools/sitio/capturar-producto.mjs'), 'utf8');
    assert.ok(f.includes("[/Empaque insuficiente en el tramo final/g, 'Insufficient packaging on the final leg']"));
    const m = JSON.parse(readFileSync(join(WEB22, 'public/s/manifest.json'), 'utf8')).img;
    assert.ok(m['producto/en/caso'] && m['producto/en/caso-oscuro']);
  });
}
