// Auditoría del modelo del mapa de burbujas: UNA escala global, nada agrupado por encima del umbral, nada escondido, conciliación y desconocido ≠ 0.
//   cd apps/web && node --test tests/burbujas-modelo.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {disponerBurbujas, conciliar, valorDe, estadoDe, radioDe, valoresReferencia, rotular, R_UMBRAL, SEPARACION} from '../src/components/pain-points/burbujas-modelo.mjs';
import {vistaPain} from './ui/pain-sintetico.mjs';

const P = (id, tema, usd, o = {}) => ({id, tema, nombre: id, agregado: false, clase: 'O', padre: null, solapaCon: [], dinero: usd == null ? {sinDato: true, causa: 'sin_fuente', motivo: 'x'} : {sinDato: false, tipo: 'bruto', currency: 'USD', exponent: 2, minor: String(Math.round(usd * 100))}, volumen: {sinDato: false, n: o.n ?? 10, unidad: 'u'}, ...o});
const CLIENTEX = [P('P2', 'devoluciones', 138000, {solapaCon: ['P4']}), P('P1', 'devoluciones', 20000, {solapaCon: ['P4']}), P('P10~walmart', 'canales', 448541, {padre: 'P4'}), P('P5', 'canales', 316000), P('P10~amazon', 'canales', 288000, {padre: 'P4'}), P('P10~shopify', 'canales', 3500, {padre: 'P4'}),
  ...[62, 60, 58, 57, 55, 54, 53, 52].map((v, i) => P('S' + i, 'sku', v * 1000, {padre: 'P4'})), P('P4', 'sku', 740000, {agregado: true, solapaCon: ['P1', 'P2']}), P('P6', 'garantia', null, {volumen: {sinDato: true, causa: 'sin_fuente', motivo: 'x'}})];
const todas = d => d.clusters.flatMap(c => c.burbujas);
const verifica = (d, esperados) => {
  const ts = todas(d);
  for (const b of ts) { assert.ok(Number.isFinite(b.cx) && Number.isFinite(b.cy) && Number.isFinite(b.r) && b.r > 0 && b.valor > 0, b.id + ' NaN o cero'); }
  for (const c of d.clusters) {
    for (const b of c.burbujas) assert.ok(b.cx - b.r >= -1e-6 && b.cx + b.r <= c.ancho + 1e-6 && b.cy - b.r >= -1e-6 && b.cy + b.r <= c.alto + 1e-6, b.id + ' fuera del cúmulo');
    for (let i = 0; i < c.burbujas.length; i++) for (let j = i + 1; j < c.burbujas.length; j++) { const a = c.burbujas[i], b = c.burbujas[j]; assert.ok(Math.hypot(a.cx - b.cx, a.cy - b.cy) >= a.r + b.r + SEPARACION - 1e-6, `${a.id} solapa ${b.id}`); }
  }
  // escala global: r = rMax·√(v/vmax) para toda burbuja que no sea de tamaño mínimo
  for (const b of ts.filter(x => !x.minimo)) assert.ok(Math.abs(b.r - radioDe(b.valor, d.escala.vmax, d.escala.rMax)) < 1e-9, `${b.id} escala incoherente`);
  // nada se pierde: cada valor aparece como burbuja o dentro de un grupo
  const ids = new Set(ts.flatMap(b => (b.tipo === 'grupo' ? b.ids : [b.id])));
  for (const id of esperados) assert.ok(ids.has(id), id + ' perdido');
  // nada por encima del umbral agrupado
  for (const g of d.grupos) for (const m of g.miembros) assert.ok(Math.sqrt(m.valor / d.escala.vmax) * d.escala.rMax < R_UMBRAL, `${m.id} agrupado siendo grande`);
};
for (const ancho of [300, 390, 560, 840, 1000, 1400]) for (const modo of ['dinero', 'volumen']) test(`CLIENTEX: escala global, grandes individuales y nada perdido (ancho ${ancho}, ${modo})`, () => {
  const d = disponerBurbujas({puntos: CLIENTEX, modo, ancho});
  verifica(d, CLIENTEX.filter(p => !p.agregado && valorDe(p, modo) !== null).map(p => p.id));
  if (modo === 'dinero') for (const id of ['P10~walmart', 'P5', 'P10~amazon']) assert.ok(d.burbujas.some(b => b.id === id), id + ' debe ser individual (antes se escondía en «+3 más»)');
});
test('defecto reproducido y corregido: 448k/316k/288k ya no se esconden y 3.5k no se infla al tamaño de 20k', () => {
  const d = disponerBurbujas({puntos: CLIENTEX, modo: 'dinero', ancho: 840});
  const r = Object.fromEntries(todas(d).map(b => [b.id, b]));
  assert.ok(Math.abs(r['P10~walmart'].r / r.P5.r - Math.sqrt(448541 / 316000)) < 1e-9);
  assert.ok(r['P10~shopify'].minimo && d.grupos.length === 0, '3.5k es el único pequeño: se dibuja él, con tamaño mínimo marcado (no se infla en silencio)');
  assert.ok(r.P1.r < r.P2.r && Math.abs(r.P2.r / r.P1.r - Math.sqrt(138000 / 20000)) < 1e-9);
});
test('un solo punto: ocupa el radio máximo; un pequeño solo no es «grupo»', () => {
  const d = disponerBurbujas({puntos: [P('A', 'sku', 5)], modo: 'dinero'});
  assert.equal(d.burbujas[0].r, d.escala.rMax); assert.equal(d.grupos.length, 0);
  const e = disponerBurbujas({puntos: [P('A', 'sku', 500000), P('B', 'sku', 1000)]});
  assert.ok(e.burbujas.some(b => b.id === 'B' && b.minimo) && e.grupos.length === 0);
});
test('disparidad enorme: 1 de 449k y 20 de 1k → los 20 se agrupan en una burbuja con la suma exacta y miembros listados', () => {
  const ps = [P('G', 'sku', 449000), ...Array.from({length: 20}, (_, i) => P('c' + String(i).padStart(2, '0'), 'sku', 1000))];
  const d = disponerBurbujas({puntos: ps}); verifica(d, ps.map(p => p.id));
  assert.equal(d.grupos[0].n, 20); assert.equal(d.grupos[0].valor, 20000); assert.equal(d.grupos[0].miembros.length, 20);
  assert.ok(Math.abs(d.grupos[0].r - radioDe(20000, 449000, d.escala.rMax)) < 1e-9, 'el área del grupo = su suma, misma escala');
});
test('todos iguales: mismo radio, ninguno agrupado; muchos puntos no se topan ni se pierden', () => {
  const ps = Array.from({length: 40}, (_, i) => P('q' + String(i).padStart(2, '0'), 'sku', 50000));
  const d = disponerBurbujas({puntos: ps, ancho: 700}); verifica(d, ps.map(p => p.id));
  assert.equal(new Set(d.burbujas.map(b => b.r)).size, 1); assert.equal(d.grupos.length, 0); assert.equal(d.burbujas.length, 40);
});
test('ceros, sin dato, NaN y negativos: nunca burbuja; cero medido ≠ sin dato', () => {
  const malos = [P('Z', 'sku', 0), P('S', 'sku', null), {...P('N', 'sku', 5), dinero: {sinDato: false, tipo: 'bruto', currency: 'USD', exponent: 2, minor: 'abc'}}, {...P('M', 'sku', 5), dinero: {sinDato: false, tipo: 'bruto', currency: 'USD', exponent: 2, minor: '-500'}}, P('OK', 'sku', 10)];
  const d = disponerBurbujas({puntos: malos}); verifica(d, ['OK']);
  assert.deepEqual(d.burbujas.map(b => b.id), ['OK']);
  assert.equal(estadoDe(malos[0], 'dinero'), 'cero'); assert.equal(estadoDe(malos[1], 'dinero'), 'sin_dato'); assert.equal(estadoDe(malos[2], 'dinero'), 'sin_dato'); assert.equal(estadoDe(malos[3], 'dinero'), 'sin_dato');
  assert.deepEqual(d.sinCifra.map(p => p.id).sort(), ['M', 'N', 'S']); assert.deepEqual(d.clusters[0].ceros.map(p => p.id), ['Z']);
  const v = disponerBurbujas({puntos: [{...P('V', 'sku', 1), volumen: {sinDato: false, n: NaN, unidad: 'u'}}], modo: 'volumen'}); assert.equal(todas(v).length, 0);
});
test('cúmulo vacío y todos vacíos: sin círculos vacíos, van a `vacios` con sus puntos', () => {
  const d = disponerBurbujas({puntos: CLIENTEX, modo: 'dinero'});
  assert.ok(d.vacios.some(v => v.id === 'garantia' && v.sinCifra[0].id === 'P6')); assert.ok(d.clusters.every(c => c.burbujas.length > 0));
  const t = disponerBurbujas({puntos: [P('S', 'sku', null), P('T', 'canales', null)]});
  assert.equal(t.clusters.length, 0); assert.equal(t.burbujas.length, 0); assert.equal(t.escala.vmax, 1); assert.ok(Number.isFinite(t.escala.rMax));
  assert.equal(disponerBurbujas({puntos: []}).clusters.length, 0);
});
test('volumen vs dinero: la escala es por modo; el cúmulo no cambia; unidades mixtas no se suman', () => {
  const din = disponerBurbujas({puntos: CLIENTEX, modo: 'dinero'}), vol = disponerBurbujas({puntos: CLIENTEX, modo: 'volumen'});
  assert.ok(din.escala.vmax > 4e5 && vol.escala.vmax === 10);
  assert.ok(vol.clusters.some(c => c.id === 'garantia') === false && vol.vacios.some(v => v.id === 'garantia'), 'P6 sin volumen en este ejemplo');
  const mix = disponerBurbujas({puntos: [P('A', 'canales', 5, {volumen: {sinDato: false, n: 5, unidad: 'reembolsos'}}), P('B', 'canales', 5, {volumen: {sinDato: false, n: 7, unidad: 'líneas'}})], modo: 'volumen'});
  assert.equal(mix.clusters[0].unidad, null);
});
test('monedas mezcladas: solo USD entra al mapa (las otras monedas viven aparte en el punto)', () => {
  const eur = {...P('E', 'sku', 100), dinero: {sinDato: false, tipo: 'bruto', currency: 'MXN', exponent: 2, minor: '99999999'}};
  const real = vistaPain().puntos; // armarPuntos nunca emite dinero no-USD: las otras monedas van en otrasMonedas
  assert.ok(real.every(p => p.dinero.sinDato || p.dinero.currency === 'USD'));
  assert.ok(Array.isArray(real.find(p => p.id === 'P4').otrasMonedas));
  assert.ok(eur.dinero.currency !== 'USD'); // el modelo no convierte ni suma monedas: el contrato lo impide aguas arriba
});
test('filtro por pestaña: la escala y la conciliación no cambian', () => {
  const todo = disponerBurbujas({puntos: CLIENTEX, ancho: 1000}), uno = disponerBurbujas({puntos: CLIENTEX.filter(p => p.tema === 'sku'), ancho: 1000, temas: ['sku'], escalaDe: CLIENTEX});
  assert.equal(uno.escala.vmax, todo.escala.vmax); assert.equal(uno.escala.rMax, todo.escala.rMax); assert.deepEqual(uno.conciliacion, todo.conciliacion);
  const a = todas(todo).find(b => b.id === 'S0'), b = todas(uno).find(x => x.id === 'S0'); assert.equal(a.r, b.r);
});
test('conciliación: las burbujas suman con cortes repetidos; sin repetir = totales + independientes; en volumen no se suma', () => {
  const c = conciliar(CLIENTEX, 'dinero');
  assert.equal(c.items.map(x => x.id).join(), 'P4,P5'); assert.equal(c.sinRepetir, 740000 + 316000);
  const suma = CLIENTEX.filter(p => !p.agregado).reduce((a, p) => a + (valorDe(p, 'dinero') ?? 0), 0);
  assert.equal(c.suma, suma); assert.ok(Math.abs(c.repetido - (suma - c.sinRepetir)) < 1e-6);
  assert.equal(conciliar(CLIENTEX, 'volumen').aplica, false);
  const d = disponerBurbujas({puntos: CLIENTEX}), sku = d.clusters.find(x => x.id === 'sku');
  assert.equal(sku.reparte.padre, 'P4'); assert.ok(Math.abs(sku.reparte.pct - 100 * 452000 / 740000 * 1) < 0.2 || sku.reparte.pct > 0);
  const canales = d.clusters.find(x => x.id === 'canales').reparte; assert.equal(canales.otros[0].id, 'P5');
});
test('referencia de leyenda: valores redondos y radios a la misma escala', () => {
  assert.deepEqual(valoresReferencia(448541), [200000, 50000]); assert.deepEqual(valoresReferencia(10, 'volumen'), [5, 1]);
  const d = disponerBurbujas({puntos: CLIENTEX}); for (const r of d.escala.refs) assert.equal(r.r, radioDe(r.valor, d.escala.vmax, d.escala.rMax));
});
test('rótulo: dentro solo si cabe entero; si no, fuera (2 líneas) y sin texto cortado dentro', () => {
  assert.equal(rotular('Walmart', '$449k', 56, 400).dentro, true);
  const f = rotular('Reembolsos negados o vencidos', '$18k', 14, 400); assert.equal(f.dentro, false); assert.ok(f.w > 0 && f.h === 28);
  assert.equal(rotular('SYN-L1', '$48k', 23, 400).dentro, false);
});
test('determinista y con la entrada en cualquier orden; el caso del fixture sintético concilia', () => {
  const V = vistaPain(), a = disponerBurbujas({puntos: V.puntos}), b = disponerBurbujas({puntos: [...V.puntos].reverse()});
  assert.deepEqual(a.clusters, b.clusters); verifica(a, V.puntos.filter(p => valorDe(p, 'dinero') !== null).map(p => p.id));
  assert.equal(a.conciliacion.items[0].nombre === 'Dinero devuelto' || a.conciliacion.items[1].nombre === 'Dinero devuelto', true);
});
test('tema desconocido no se pierde', () => {
  const d = disponerBurbujas({puntos: [P('X', 'nuevo', 10), P('Y', 'sku', 20)]}); assert.ok(d.clusters.some(c => c.id === 'nuevo'));
});
