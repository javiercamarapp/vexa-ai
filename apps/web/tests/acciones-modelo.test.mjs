// Modelo puro de Acciones (Por decidir | En curso | Resultados): etapas reales, conteos, filtros y comparación sin inventar.
import test from 'node:test';
import assert from 'node:assert/strict';
import {agrupar, filtrar, resumir, actividadReciente, evidenciaPorAccion, comparaciones, grupoDe, GRUPO_DE_VISTA} from '../src/components/acciones/acciones-modelo.mjs';

const ev = (id, kind, o = {}) => ({id, kind, createdAt: '2026-10-1' + id + 'T10:00:00.000Z', ownerId: null, dueDate: null, outcome: null, comparison: null, ...o});
const rec = (id, o = {}, eventos = []) => ({id, title: 'Order: ' + id, priority: 'normal', status: 'proposed', ownerId: null, evidenceCount: 2, history: [{version: 1, status: 'proposed', createdAt: '2026-10-01T00:00:00Z'}], flow: {events: eventos}, ...o});
const HOY = new Date('2026-10-23T12:00:00Z');
const items = [
  rec('a', {priority: 'critical'}),
  rec('b', {priority: 'high'}, [ev(1, 'adjusted', {priority: 'high'})]),
  rec('c', {ownerId: 'u1'}, [ev(2, 'approved', {ownerId: 'u1', dueDate: '2026-10-25'})]),
  rec('d', {}, [ev(3, 'approved', {ownerId: 'u2', dueDate: '2026-10-20'}), ev(4, 'started')]),
  rec('e', {}, [ev(5, 'approved', {ownerId: 'u2', dueDate: '2026-12-01'}), ev(6, 'resolved', {outcome: 'partial', comparison: {antesMinor: '125000', despuesMinor: '83000', exponente: 2, moneda: 'USD', completa: true}})]),
  rec('f', {status: 'dismissed', history: [{version: 1, status: 'proposed', createdAt: '2026-10-01T00:00:00Z'}, {version: 2, status: 'dismissed', createdAt: '2026-10-14T00:00:00Z'}]}),
  rec('g', {}, [ev(7, 'approved', {ownerId: 'u3'}), ev(8, 'resolved', {outcome: 'no'})]),
];
test('cada acción cae en la etapa que dicen sus eventos y nunca en otra', () => {
  const g = agrupar(items);
  assert.deepEqual(g.decidir.map(i => i.id), ['a', 'b']);
  assert.deepEqual(g.curso.map(i => i.id), ['c', 'd']);
  assert.deepEqual(g.resultado.map(i => i.id), ['e', 'g']);
  assert.deepEqual(g.descartada.map(i => i.id), ['f']);
  assert.equal(GRUPO_DE_VISTA['por-decidir'], 'decidir'); assert.equal(grupoDe(items[3]), 'curso');
});
test('resumen: urgentes, vencidas, próximas, sin fecha y resultados; lo desconocido no se cuenta como cero', () => {
  const r = resumir(items, HOY);
  assert.deepEqual([r.decidir.n, r.decidir.urgentes, r.decidir.altas, r.decidir.sinResponsable], [2, 1, 1, 2]);
  assert.deepEqual([r.curso.n, r.curso.aprobadas, r.curso.enCurso, r.curso.vencidas, r.curso.proximas, r.curso.sinFecha], [2, 1, 1, 1, 1, 0]);
  assert.deepEqual([r.resultado.n, r.resultado.parcial, r.resultado.no, r.resultado.conComparacion], [2, 1, 1, 1]);
  assert.equal(r.descartadas, 1);
  assert.equal(r.decidir.citas, 4);
  const sinFecha = resumir([rec('x', {}, [ev(1, 'approved', {ownerId: 'u1'})])], HOY);
  assert.equal(sinFecha.curso.sinFecha, 1); assert.equal(sinFecha.curso.proximas + sinFecha.curso.vencidas, 0);
});
test('filtros por responsable (de la aprobación o de la recomendación), sin responsable y prioridad', () => {
  assert.deepEqual(filtrar(items, {responsable: 'u2'}).map(i => i.id), ['d', 'e']);
  assert.deepEqual(filtrar(items, {responsable: 'sin'}).map(i => i.id), ['a', 'b', 'f']);
  assert.deepEqual(filtrar(items, {prioridad: 'critical'}).map(i => i.id), ['a']);
  assert.equal(filtrar(items).length, items.length);
});
test('actividad reciente: más nueva primero, incluye descartes y no inventa eventos', () => {
  const a = actividadReciente(items, 20);
  assert.ok(a.every((x, i) => i === 0 || a[i - 1].cuando >= x.cuando));
  assert.ok(a.some(x => x.tipo === 'dismissed' && x.accionId === 'f'));
  assert.equal(a.filter(x => x.tipo === 'approved').length, 4);
  assert.deepEqual(actividadReciente([], 5), []);
});
test('evidencia por acción ordena por citas; comparación solo con dato observado en dos periodos', () => {
  assert.deepEqual(evidenciaPorAccion([rec('p', {evidenceCount: 1}), rec('q', {evidenceCount: 5})]).map(x => x.id), ['q', 'p']);
  const c = comparaciones(items);
  assert.deepEqual(c.map(x => x.id), ['e', 'g']);
  assert.deepEqual([c[0].antes, c[0].despues, c[0].moneda, c[0].completa], [1250, 830, 'USD', true]);
  assert.deepEqual([c[1].antes, c[1].despues, c[1].moneda], [null, null, null]);
});
