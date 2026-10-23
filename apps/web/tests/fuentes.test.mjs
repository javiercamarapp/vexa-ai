import {test} from 'node:test';
import assert from 'node:assert/strict';
import {identidad, rangoDeSerie, tarjetasFuentes} from '../src/lib/legibilidad/fuentes.mjs';

test('identidad: 72,720 de 117,719 es 62 % y 44,999 quedan sin identificar', () => {
  const i = identidad({class: 'observed', counts: {facts: 117719, resolved: 72720, pending: 44999, blocked: 0, retained: 0, links: 72720}});
  assert.equal(i.vinculadas + i.sinIdentificar + i.porRevisar + i.retenidas, i.total);
  assert.equal(Math.round(i.bps / 100), 62);
  assert.equal(identidad({counts: {facts: 0}}), null); assert.equal(identidad({}), null); assert.equal(identidad(null), null);
});
test('rango de serie: primer y último mes con registros; sin registros no hay rango', () => {
  const s = [{month: '2025-11', count: 0}, {month: '2025-12', count: 4}, {month: '2026-03', count: 2}, {month: '2026-04', count: 0}];
  assert.equal(rangoDeSerie(s, (p) => p.count > 0), 'dic 2025 – mar 2026');
  assert.equal(rangoDeSerie([{month: '2026-01', count: 0}], (p) => p.count > 0), null);
  assert.equal(rangoDeSerie([{month: '2026-02', count: 1}], (p) => p.count > 0), 'feb 2026');
});
test('tarjetas: una fuente sin cargar es «sin_cargar» y no hereda fechas; el libro lleva su fecha de corte y rango', () => {
  const cob = {sources: [
    {key: 'ledger', label: 'x', loaded: true, status: 'ok', class: 'observed', imports: 0, openImports: 0, total: 85383, incorporated: 85383, rejected: 0, pending: 0, lastUpdate: null, detail: []},
    {key: 'zendesk', label: 'Zendesk', loaded: false, status: 'empty', class: 'observed', imports: 0, openImports: 0, total: 0, incorporated: 0, rejected: 0, pending: 0, lastUpdate: null, detail: []}]};
  const tr = {ledger: {status: 'ok', series: [{month: '2025-11', orders: {count: 5}, refunds: {count: 0}}, {month: '2026-10', orders: {count: 2}, refunds: {count: 0}}], completeness: {dataThrough: '2026-10-05'}}, conversations: {status: 'ok', series: [{month: '2026-01', count: 9}], completeness: {dataThrough: '2026-10-18'}}};
  const [l, z] = tarjetasFuentes(cob, tr);
  assert.equal(l.estado, 'cargada'); assert.equal(l.datosHasta, '5 oct 2026'); assert.equal(l.rango, 'nov 2025 – oct 2026'); assert.equal(l.nombre, 'Libro de pedidos y reembolsos');
  assert.equal(z.estado, 'sin_cargar'); assert.equal(z.rango, null); assert.equal(z.datosHasta, null); assert.equal(z.bps, null);
});
