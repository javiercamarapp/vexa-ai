import {test} from 'node:test';
import assert from 'node:assert/strict';
import {consultaAlcance, periodoLegible, alcanceDeConsulta, consultaConPeriodo, periodosRapidos, periodoAplica, hrefConAlcance} from '../src/lib/workspace/alcance.mjs';

test('el menú conserva solo el alcance: periodo, moneda, base, corte y filtros compartidos; no los filtros de cada pantalla', () => {
  const q = consultaAlcance('date_start=2026-08-01&date_end=2026-09-21&currency=USD&basis=marketplace_line_price&snapshot_id=s1&scope_hash=h1&q=hola&cursor=zz&status=open&source=hubspot&source=csv');
  const p = new URLSearchParams(q);
  assert.deepEqual([p.get('date_start'), p.get('date_end'), p.get('currency'), p.get('basis'), p.get('snapshot_id'), p.get('scope_hash')], ['2026-08-01', '2026-09-21', 'USD', 'marketplace_line_price', 's1', 'h1']);
  assert.deepEqual(p.getAll('source'), ['hubspot', 'csv']);
  for (const k of ['q', 'cursor', 'status']) assert.equal(p.has(k), false);
  assert.equal(consultaAlcance(''), ''); assert.equal(consultaAlcance('snapshot_id=&q=x'), '');
});
test('periodo legible: fin exclusivo, mismo año, años distintos, un día; inválido = null', () => {
  assert.equal(periodoLegible('2026-10-01', '2026-11-01'), '1 oct – 31 oct 2026');
  assert.equal(periodoLegible('2026-08-01T00:00:00.000Z', '2026-09-21'), '1 ago – 20 sep 2026');
  assert.equal(periodoLegible('2025-11-01', '2026-11-01'), '1 nov 2025 – 31 oct 2026');
  assert.equal(periodoLegible('2026-10-05', '2026-10-06'), '5 oct 2026');
  for (const [a, b] of [[null, '2026-10-01'], ['ayer', 'hoy'], ['2026-10-02', '2026-10-01'], ['2026-13-01', '2026-12-01'], ['2026-02-31', '2026-03-05']]) assert.equal(periodoLegible(a, b), null);
});
test('alcance de la URL: reconoce periodos rápidos, personalizado y ausencia (sin inventar uno)', () => {
  const ahora = new Date('2026-10-22T12:00:00Z'), r = periodosRapidos(ahora);
  assert.deepEqual(r.month, ['2026-10-01', '2026-11-01']);
  assert.equal(alcanceDeConsulta(`date_start=${r['90d'][0]}&date_end=${r['90d'][1]}&currency=MXN`, ahora).clave, '90d');
  const c = alcanceDeConsulta('date_start=2026-08-01&date_end=2026-09-21&currency=USD&basis=marketplace_line_price', ahora);
  assert.deepEqual([c.clave, c.periodo, c.moneda, c.base, c.hayAlcance], ['custom', '1 ago – 20 sep 2026', 'USD', 'marketplace_line_price', true]);
  const vacio = alcanceDeConsulta('', ahora);
  assert.deepEqual([vacio.periodo, vacio.moneda, vacio.base, vacio.clave, vacio.hayAlcance], [null, null, null, null, false]);
  assert.equal(alcanceDeConsulta('currency=pesos', ahora).moneda, null);
});
test('cambiar el periodo suelta la publicación fijada pero conserva moneda y base', () => {
  const q = consultaConPeriodo('date_start=2026-08-01&date_end=2026-09-21&currency=USD&basis=net&snapshot_id=s1&scope_hash=h1&cursor=9', '2026-10-01', '2026-11-01');
  assert.equal(q.get('date_start'), '2026-10-01'); assert.equal(q.get('currency'), 'USD'); assert.equal(q.get('basis'), 'net');
  for (const k of ['snapshot_id', 'scope_hash', 'cursor']) assert.equal(q.has(k), false);
});
test('el selector de periodo solo aplica donde el periodo cambia la vista', () => {
  for (const p of ['/overview', '/problems/manage', '/problems/abc', '/cfo', '/refunds', '/economics', '/briefs/1']) assert.equal(periodoAplica(p), true, p);
  for (const p of ['/imports', '/jobs/9', '/settings/team', '/notifications', '/connections', '/history']) assert.equal(periodoAplica(p), false, p);
});

test('los enlaces dentro de una pantalla conservan el alcance (periodo, corte) y no se quedan sin publicación', () => {
  const q = 'date_start=2026-08-01&date_end=2026-09-21&currency=USD&snapshot_id=s1&scope_hash=h1&q=hola';
  for (const ruta of ['/history', '/imports', '/economics', '/explorer', '/connections', '/sources']) {
    const h = hrefConAlcance(ruta, q), u = new URL(h, 'https://x.test');
    assert.equal(u.pathname, ruta);
    assert.equal(u.searchParams.get('snapshot_id'), 's1', ruta);
    assert.equal(u.searchParams.get('q'), null, 'los filtros propios no viajan');
  }
  assert.equal(hrefConAlcance('/economics#fuentes', q).endsWith('#fuentes'), true);
  // Lo que ya trae query, las pantallas internas, externos y anclas quedan igual.
  for (const h of ['/history?cursor=2', '/settings/team', '/jobs/setup', '/jobs/9', '/notifications', '/api/jobs/1/errors', 'https://otro.test/x', '#atencion', 'mailto:a@b.c']) assert.equal(hrefConAlcance(h, q), h, h);
  // Sin alcance en la URL actual no se inventa nada.
  assert.equal(hrefConAlcance('/history', 'q=hola'), '/history');
});
