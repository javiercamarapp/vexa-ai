import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {GEO_US} from '../src/components/map/geo/geo-us.mjs';
import {GEO_MX} from '../src/components/map/geo/geo-mx.mjs';
import {ESTADOS_US, ESTADOS_MX} from '../../../packages/workspace-service/geo-estado.mjs';
import {camaraParaRegion, cabeEtiqueta, estadoRegion, limitarCamara, limitesRampa, pasoDeRampa, regionesPintadas, textoRegion, zoomEnPunto, ZOOM_MAX} from '../src/components/map/mapa-modelo.mjs';

test('geometrías: 50 estados + DC y 32 estados de México, con las mismas claves que los datos', () => {
  const us = GEO_US.regiones.map(r => r.codigo).sort(), mx = GEO_MX.regiones.map(r => r.codigo).sort();
  assert.deepEqual(us, Object.keys(ESTADOS_US).sort());
  assert.deepEqual(mx, Object.keys(ESTADOS_MX).sort());
  for (const g of [GEO_US, GEO_MX]) for (const r of g.regiones) {
    assert.match(r.clave, /^(US|MX)-[A-Z]{2,3}$/); assert.ok(r.path.startsWith('M') && r.path.length > 40, r.clave);
    assert.ok(r.cx >= 0 && r.cx <= g.viewBox.w && r.cy >= 0 && r.cy <= g.viewBox.h, r.clave);
  }
});
test('bins: 0 casos es «sin dato», nunca paso 1; 5 pasos y límites sin huecos', () => {
  assert.equal(pasoDeRampa(0, 100), 0); assert.equal(pasoDeRampa(1, 100), 1); assert.equal(pasoDeRampa(100, 100), 5);
  assert.deepEqual(estadoRegion(null, 10), {tipo: 'sin-dato', paso: 0}); assert.deepEqual(estadoRegion({n: 0}, 10), {tipo: 'sin-dato', paso: 0});
  const l = limitesRampa(220); assert.equal(l.length, 5); for (let i = 1; i < l.length; i++) assert.equal(l[i].desde, l[i - 1].hasta + 1);
});
test('coloreado: región sin dato del servicio queda punteada y la leída lleva su paso', () => {
  const p = regionesPintadas(GEO_US, new Map([['US-TX', {n: 220}], ['US-VT', {n: 5}]]), 220);
  assert.equal(p.find(x => x.r.codigo === 'TX').paso, 5); assert.equal(p.find(x => x.r.codigo === 'VT').paso, 1);
  assert.equal(p.filter(x => x.tipo === 'sin-dato').length, 49);
});
test('k-anonimato en pantalla: el texto de una región sin dato no muestra cifra', () => {
  const t = textoRegion('Vermont', null, 900); assert.doesNotMatch(t, /\b0\b/); assert.match(t, /sin dato/); assert.doesNotMatch(t.replace('menos de 5 casos', ''), /\d/);
  assert.match(textoRegion('Texas', {n: 220}, 990), /220 casos · 22\.2 %/); assert.match(textoRegion('Ohio', {n: 1}, 10), /1 caso ·/);
});
test('cámara: vuelo encuadra el estado, zoom ancla el cursor y el mapa nunca deja márgenes vacíos', () => {
  const vb = GEO_US.viewBox, tx = GEO_US.regiones.find(r => r.codigo === 'TX'), ri = GEO_US.regiones.find(r => r.codigo === 'RI');
  const c = camaraParaRegion(tx, vb); assert.ok(c.k > 1.5 && c.k <= 8);
  assert.ok(Math.abs(c.x + c.k * tx.cx - vb.w / 2) < 1 || c.x === 0 || c.x === vb.w - c.k * vb.w);
  assert.equal(camaraParaRegion(ri, vb).k, 8); assert.deepEqual(camaraParaRegion(null, vb), {x: 0, y: 0, k: 1});
  const z = zoomEnPunto({x: 0, y: 0, k: 1}, 500, 300, 2, vb); assert.equal(z.k, 2); assert.ok(Math.abs(z.x - (500 - 1000)) < 1e-9 || z.x >= vb.w - 2 * vb.w);
  assert.equal(zoomEnPunto(z, 0, 0, 0.1, vb).k, 1); assert.equal(zoomEnPunto(z, 0, 0, 1e6, vb).k, ZOOM_MAX);
  const l = limitarCamara({x: 500, y: -9999, k: 3}, vb); assert.equal(l.x, 0); assert.equal(l.y, vb.h - 3 * vb.h);
});
test('accesibilidad: la etiqueta solo se pinta si cabe', () => {
  assert.equal(cabeEtiqueta({bw: 10, bh: 10}, 1), false); assert.equal(cabeEtiqueta({bw: 100, bh: 60}, 1), true);
});
test('sin cifras personales: ni la geometría ni el mapa tocan direcciones, nombres, correos o teléfonos', () => {
  const dir = new URL('../src/components/map/', import.meta.url);
  for (const f of ['mapa-geo.tsx', 'mapa-modelo.mjs']) {
    const t = fs.readFileSync(new URL(f, dir), 'utf8');
    assert.doesNotMatch(t, /\b(address|direccion|dirección|calle|street|email|correo|phone|tel[eé]fono|ciudad|city)\b\s*[:=]/i, f);
  }
  const geo = ['geo/geo-us.mjs', 'geo/geo-mx.mjs'].map(f => fs.readFileSync(new URL(f, dir), 'utf8').split('\n').slice(1).join('\n')).join('');
  assert.ok(geo.length > 1e5); assert.doesNotMatch(geo, /@|https?:|[a-df-zA-DF-Z]{4,}\d/);
  // El componente solo recibe {clave, nombre, n}: una celda extra no llega a pintarse.
  const p = regionesPintadas(GEO_US, new Map([['US-TX', {n: 7, clave: 'US-TX', nombre: 'Texas'}]]), 7).find(x => x.r.codigo === 'TX');
  assert.deepEqual(Object.keys(p.d).sort(), ['clave', 'n', 'nombre']);
});
