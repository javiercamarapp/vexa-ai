import test from 'node:test';
import assert from 'node:assert/strict';
import {compactEs, niceScale, esConteoPequeno, mesAbrev, MESES, geometriaColumnas, cadaCuantas, variacionVsAnterior, indicesEtiquetados, posicionTooltip} from './escala.mjs';

test('compactEs: formato compacto es-MX y casos límite', () => {
  assert.equal(compactEs(2100000), '2.1 M');
  assert.equal(compactEs(337900), '337.9 k');
  assert.equal(compactEs(842), '842');
  assert.equal(compactEs(0), '0');
  assert.equal(compactEs(-1500), '-1.5 k');
  assert.equal(compactEs(NaN), '—');
  assert.equal(compactEs(Infinity), '—');
});

test('niceScale: tope redondo >= máximo, 3 marcas, mitad redonda', () => {
  for (const [max, top] of [[337900, 400000], [2.1e6, 3e6], [80398216, 1e8], [5, 5], [0.83, 1], [100, 100], [101, 120], [6316, 8000]]) {
    const s = niceScale(max);
    assert.equal(s.max, top, `max ${max}`);
    assert.equal(s.ticks.length, 3);
    assert.equal(s.ticks[0], 0);
    assert.equal(s.ticks[2], s.max);
    assert.equal(s.ticks[1], s.max / 2);
    assert.ok(s.max >= max && s.max <= max * 1.5 + 1e-9, `sobrante acotado para ${max}`);
  }
});

test('niceScale: conteos pequeños usan marcas enteras; vacío y no finitos no rompen', () => {
  for (const max of [1, 2, 3, 5, 7, 11]) { const s = niceScale(max, {integer: true}); assert.ok(s.ticks.every(Number.isInteger), `${max}: ${s.ticks}`); assert.ok(s.max >= max); }
  assert.deepEqual(niceScale(0, {integer: true}).ticks, [0, 1, 2]);
  assert.deepEqual(niceScale(0).ticks, [0, 0.5, 1]);
  assert.deepEqual(niceScale(NaN).ticks, [0, 0.5, 1]);
  assert.deepEqual(niceScale(-4).ticks, [0, 0.5, 1]);
  assert.ok(esConteoPequeno([1, 3, 0]) && !esConteoPequeno([1, 20]) && !esConteoPequeno([1.5]) && !esConteoPequeno([]) && esConteoPequeno([null, 2]));
});

test('mesAbrev: meses abreviados de 3 letras', () => {
  assert.equal(MESES.length, 12);
  assert.deepEqual(['2026-01', '2026-10', '2026-12'].map(mesAbrev), ['ene', 'oct', 'dic']);
  assert.equal(mesAbrev('2026-13'), '2026-13');
  assert.equal(mesAbrev('xx'), 'xx');
  assert.ok(MESES.every((m) => m.length === 3));
});

test('geometriaColumnas: barra delgada, relación ~0.6, acotada', () => {
  const g = geometriaColumnas(12, 720); // slot 60 -> 36 -> tope 22
  assert.equal(g.bw, 22); assert.equal(g.slot, 60); assert.equal(g.offset, 19);
  const h = geometriaColumnas(12, 240); // slot 20 -> 12
  assert.equal(h.bw, 12); assert.ok(Math.abs(h.bw / h.slot - 0.6) < 1e-9);
  assert.equal(geometriaColumnas(400, 300).bw, 3);
  assert.equal(geometriaColumnas(0, 300).slot, 300);
});

test('cadaCuantas: no pisa etiquetas', () => {
  assert.equal(cadaCuantas(12, 720), 1);
  assert.equal(cadaCuantas(12, 200), 2);
  assert.equal(cadaCuantas(1, 10), 1);
});

test('variacionVsAnterior: solo entre meses completos con dato', () => {
  const p = [{value: 100}, {value: 110}, {value: 99, partial: true}, {value: null}, {value: 50}, {value: 0}, {value: 20}];
  assert.deepEqual(variacionVsAnterior(p, 1), {dir: 'up', texto: '+10.0 %'});
  assert.equal(variacionVsAnterior(p, 2), null, 'parcial');
  assert.equal(variacionVsAnterior(p, 3), null, 'sin dato');
  assert.equal(variacionVsAnterior(p, 4), null, 'anterior sin dato');
  assert.deepEqual(variacionVsAnterior(p, 5), {dir: 'down', texto: '−100.0 %'});
  assert.equal(variacionVsAnterior(p, 6), null, 'base 0');
  assert.equal(variacionVsAnterior(p, 0), null);
  assert.equal(variacionVsAnterior([{value: 100}, {value: 100}], 1).dir, 'flat');
  assert.equal(variacionVsAnterior([{value: 100}, {value: 100}], 1).texto, '0.0 %');
});

test('variacionVsAnterior en tasas: puntos porcentuales desde bps', () => {
  assert.deepEqual(variacionVsAnterior([{value: 250}, {value: 310}], 1, 'pp'), {dir: 'up', texto: '+0.6 pp'});
  assert.equal(variacionVsAnterior([{value: 250}, {value: 310, partial: true}], 1, 'pp'), null);
  assert.equal(variacionVsAnterior([{value: 0}, {value: 100}], 1, 'pp').texto, '+1.0 pp');
});

test('indicesEtiquetados: máximo y último mes completo; el parcial nunca se etiqueta', () => {
  assert.deepEqual(indicesEtiquetados([{value: 5}, {value: 9}, {value: 4}, {value: 3}, {value: 6}, {value: 1, partial: true}]), [1, 4]);
  assert.deepEqual(indicesEtiquetados([{value: 5}, {value: 9}, {value: 8}]), [2], 'cercanos: solo el último');
  assert.deepEqual(indicesEtiquetados([{value: 9}, {value: 5}]), [1]);
  assert.deepEqual(indicesEtiquetados([{value: 3}]), [0]);
  assert.deepEqual(indicesEtiquetados([{value: null}, {value: 2, partial: true}]), []);
  assert.deepEqual(indicesEtiquetados([]), []);
});

test('posicionTooltip: no se sale por ningún borde', () => {
  assert.equal(posicionTooltip(5, 400), 94);
  assert.equal(posicionTooltip(398, 400), 306);
  assert.equal(posicionTooltip(200, 400), 200);
  assert.equal(posicionTooltip(10, 100), 94);
});
