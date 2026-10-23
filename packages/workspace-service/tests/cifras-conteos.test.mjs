// A6: una cifra por concepto. El libro por fuente no puede decir «Walmart 0 reembolsos» cuando el canal tiene 3,107 en su fuente de devoluciones.
//   node --test packages/workspace-service/tests/cifras-conteos.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {lineasLibroPorFuente} from '../provenance.mjs';

test('la fuente de pedidos de Walmart con 0 reembolsos remite al canal (3,107 como en Fuga)', () => {
  const g = new Map([['Marketplace Walmart · Pedidos (export) · USD', {orders: 30000, refunds: 0, other: 0}], ['Marketplace Walmart · Devoluciones (ledger) · USD', {orders: 0, refunds: 3107, other: 0}], ['Shopify · USD', {orders: 900, refunds: 26, other: 0}]]);
  const l = lineasLibroPorFuente(g);
  assert.match(l[0], /^Marketplace Walmart · Pedidos \(export\) · USD: 30,000 pedidos · 0 reembolsos \(los reembolsos de Walmart están en su fuente de devoluciones: 3,107 en el canal\)/);
  assert.equal(l[1], 'Marketplace Walmart · Devoluciones (ledger) · USD: 0 pedidos · 3,107 reembolsos');
  assert.equal(l[2], 'Shopify · USD: 900 pedidos · 26 reembolsos');
});
test('sin reembolsos en todo el canal no se inventa nota; fuentes de otro canal no se mezclan', () => {
  const g = new Map([['Amazon (CSV) · USD', {orders: 3, refunds: 0, other: 0}], ['Marketplace Walmart · Devoluciones · USD', {orders: 0, refunds: 5, other: 0}]]);
  assert.equal(lineasLibroPorFuente(g)[0], 'Amazon (CSV) · USD: 3 pedidos · 0 reembolsos');
});
