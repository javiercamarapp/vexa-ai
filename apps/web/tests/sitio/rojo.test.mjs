// Prueba de rojo (SPEC 1.3 y 9.8) con capturas sintéticas de 1440x900.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { codificarPng, decodificarPng } from '../../../../tools/sitio/cdp/png.mjs';
import { analizarRojo, veredictoRojo } from '../../../../tools/sitio/cdp/rojo.mjs';

const W = 1440, H = 900;
function lienzo(fondo = [14, 14, 16]) {
  const datos = Buffer.alloc(W * H * 3);
  for (let i = 0; i < W * H; i++) { datos[i * 3] = fondo[0]; datos[i * 3 + 1] = fondo[1]; datos[i * 3 + 2] = fondo[2]; }
  return { ancho: W, alto: H, canales: 3, datos };
}
function circulo(img, cx, cy, r, rgb = [0xe8, 0x24, 0x1c]) {
  for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
    if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) { const i = (y * W + x) * 3; img.datos[i] = rgb[0]; img.datos[i + 1] = rgb[1]; img.datos[i + 2] = rgb[2]; }
  }
}
const pasa = (img) => analizarRojo(decodificarPng(codificarPng(img)));

test('PNG: codificar y decodificar es idéntico', () => {
  const img = lienzo(); circulo(img, 100, 100, 5);
  const d = decodificarPng(codificarPng(img));
  assert.equal(d.ancho, W); assert.equal(d.alto, H);
  assert.ok(d.datos.equals(img.datos));
});

test('sin rojo: cero elementos, cero área', () => {
  const a = pasa(lienzo());
  assert.equal(a.elementos, 0); assert.equal(a.areaPct, 0);
  assert.deepEqual(veredictoRojo(a), []);
});

test('tres puntos pequeños pasan', () => {
  const img = lienzo(); circulo(img, 200, 200, 6); circulo(img, 600, 400, 18); circulo(img, 1000, 700, 3);
  const a = pasa(img);
  assert.equal(a.elementos, 3);
  assert.deepEqual(veredictoRojo(a), []);
});

test('cuatro elementos fallan', () => {
  const img = lienzo(); for (const [x, y] of [[100, 100], [400, 100], [700, 100], [1000, 100]]) circulo(img, x, y, 6);
  const a = pasa(img);
  assert.equal(a.elementos, 4);
  assert.ok(veredictoRojo(a).some((f) => /elementos/.test(f)));
});

test('más de 0.3 por ciento del área falla aunque sea un solo elemento', () => {
  const img = lienzo(); circulo(img, 700, 450, 40); // ~5000 px, 0.39 %
  const a = pasa(img);
  assert.equal(a.elementos, 1);
  assert.ok(a.areaPct > 0.3);
  assert.ok(veredictoRojo(a).some((f) => /área/.test(f)));
});

test('un punto de 36 px (máximo permitido) pasa el área', () => {
  const img = lienzo(); circulo(img, 700, 450, 18);
  assert.deepEqual(veredictoRojo(pasa(img)), []);
});

test('el borde antialiased y el anillo de un punto cuentan como un solo elemento', () => {
  const img = lienzo(); circulo(img, 300, 300, 9, [0xd8, 0x30, 0x28]); circulo(img, 300, 300, 6);
  assert.equal(pasa(img).elementos, 1);
});

test('un rojo distinto (#C81B14 de texto o botón apagado) y un azul no cuentan', () => {
  const img = lienzo(); circulo(img, 300, 300, 20, [0x00, 0x66, 0xff]); circulo(img, 800, 300, 20, [0xff, 0xff, 0xff]);
  assert.equal(pasa(img).elementos, 0);
});
