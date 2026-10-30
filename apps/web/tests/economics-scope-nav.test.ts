// QA2-004/005: /economics hereda el alcance del espacio (query) y es vista de operador (fuera del menú de cliente).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {economicInitialScope} from '../src/lib/economic-scope';
import {MENU, menuVisible} from '../src/lib/workspace/menu.mjs';

test('sin query: ventana de 12 meses y base de marketplace, nunca el mes fijo sep-2026', () => {
  const s = economicInitialScope(new URLSearchParams(''), new Date('2026-10-22T12:00:00Z'));
  assert.equal(s.start, '2025-11-01'); assert.equal(s.end, '2026-11-01');
  assert.equal(s.basis, 'marketplace_line_price'); assert.equal(s.currency, 'USD'); assert.equal(s.exponent, 2); assert.equal(s.fromSpace, false);
});
test('con el alcance del espacio (1-ago a 21-sep, base y moneda) lo hereda tal cual', () => {
  const s = economicInitialScope(new URLSearchParams('date_start=2026-08-01&date_end=2026-09-21&currency=MXN&basis=marketplace_line_price&exponent=2'), new Date('2026-10-22T12:00:00Z'));
  assert.deepEqual([s.start, s.end, s.currency, s.basis, s.exponent, s.fromSpace], ['2026-08-01', '2026-09-21', 'MXN', 'marketplace_line_price', 2, true]);
});
test('fechas o moneda inválidas en la query no se heredan', () => {
  const s = economicInitialScope(new URLSearchParams('date_start=ayer&date_end=2026-09-21&currency=pesos&exponent=22'), new Date('2026-10-22T12:00:00Z'));
  assert.equal(s.start, '2025-11-01'); assert.equal(s.currency, 'USD'); assert.equal(s.exponent, 2);
});
test('/economics es vista de operador: «Datos y confianza > Preparar», solo para owner/analyst (el menú no protege la ruta; el servidor sí: ver tests/economia-por-rol.test.ts, R2-03)', () => {
  const dinero = MENU.find((e) => e.tipo === 'grupo' && e.clave === 'datos');
  assert.ok(dinero && dinero.tipo === 'grupo' && dinero.items.some((i) => i.href === '/economics'));
  const ve = (role?: string) => menuVisible({ role }).flatMap((e) => (e.tipo === 'grupo' ? e.items : [e]).map((i) => i.href));
  for (const r of ['owner', 'analyst']) assert.ok(ve(r).includes('/economics'));
  for (const r of ['operator', 'viewer', undefined]) assert.ok(!ve(r).includes('/economics'));
  assert.ok(ve('viewer').includes('/problems'));
});
