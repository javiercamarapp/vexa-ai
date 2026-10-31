// «Cómo se calculó», «Qué no sabemos», nombres, fuentes, coberturas y motivos de los puntos de dolor salen en el idioma pedido; las cifras no cambian.
import test from 'node:test';
import assert from 'node:assert/strict';
import {armarPuntos, temasDe, TEMAS} from '../pain-points-catalogo.mjs';

const ACENTOS = /[áéíóúñ¿¡«»]/i;
const PALABRAS = /\b(de|del|la|las|los|el|para|por|sin|con|una?|que|se|su|más|hay|datos|meses|mes|pedidos|reembolsos|ingresos|moneda|monedas|cifra|canal|canales|importe|registros|filas|fuente|ver|base|tasa|promedio|ninguno|solo|esta|este|cuántos|cuántas|falta)\b/gi;
const espanol = t => ACENTOS.test(t) || (t.match(PALABRAS) ?? []).length >= 2;
const f = {
  tracker: {data: {byStatus: {vencido: {n: 10, nAmount: 8, amountMinor: '120000'}, rechazado: {n: 5, nAmount: 5, amountMinor: '30000'}}, total: 300}, meta: {sourceWatermark: '2026-10-20T00:00:00.000Z', refreshedAt: '2026-10-21T00:00:00.000Z'}},
  walmart: {n: 12, known: 12, minor: '456700', desde: '2026-08', hasta: '2026-10', refreshedAt: '2026-10-21T00:00:00.000Z', watermark: '2026-10-20T00:00:00.000Z'},
  reembolsos: {rows: [
    {month: '2026-08', channel: 'walmart', sku: 'SKUS-M10', currency: 'USD', exponent: 2, n: 100, nKnown: 100, nCancelled: 20, amountMinor: '4000000', activeMinor: '3000000'},
    {month: '2026-09', channel: 'amazon', sku: 'SKUP-L1', currency: 'USD', exponent: 2, n: 80, nKnown: 60, nCancelled: 0, amountMinor: '2000000', activeMinor: '2000000'},
    {month: '2026-09', channel: 'amazon', sku: 'SKUP-L1', currency: 'CAD', exponent: 2, n: 3, nKnown: 3, nCancelled: 0, amountMinor: '90000', activeMinor: '90000'}], meta: {}},
  ordenes: {rows: [
    {month: '2026-09', channel: 'amazon', sku: 'SKUP-L1', currency: 'USD', exponent: 2, n: 500, nCancelled: 10, amountMinor: '50000000', cancelledMinor: '700000'},
    {month: '2026-09', channel: 'walmart', sku: 'SKUS-M10', currency: 'USD', exponent: 2, n: 300, nCancelled: 5, amountMinor: '30000000', cancelledMinor: '300000'},
    {month: '2026-05', channel: 'amazon', sku: 'SKUP-L1', currency: 'MXN', exponent: 2, n: 13, nCancelled: 13, amountMinor: '355237', cancelledMinor: '355237'}], meta: {}},
  hilos: {threads: 3000, closed: 2500, closeP50Hours: 44.8, closeP90Hours: 1001, reopenedPercent: 6, closedOver7d: 710, periodo: {desde: '2026-01', hasta: '2026-09'}}, hilosMeta: {},
  repetido: {contactos: 1000, contactosDosOMas: 120, pct: 12, pctSinVincular: 28, corte: '2026-10-20', refreshedAt: '2026-10-21'},
  garantia: {total: 900, hojas: {'Warranty Tools': 500, 'Warranty Parts': 400}},
};
/** Todo texto visible de un punto (nombre, descripción, fuente, cobertura, motivos, cómo se calculó, qué no sabemos, proxy). SKU y nombres de canal/hoja son datos. */
function textos(p) {
  const out = [p.nombre, p.descripcion, p.fuente?.etiqueta, p.cobertura?.texto, p.dinero?.motivo, p.volumen?.motivo, p.volumen?.unidad, p.proxy?.rotulo, p.evidencia?.motivo, ...p.calculo, ...p.noSabemos];
  return out.filter(x => typeof x === 'string' && x);
}
const limpiar = t => t.replace(/SKU[A-Z]?-[A-Z0-9]+|\bWTR\b|\bWPR\b/g, '');

test('en inglés ningún punto de dolor sale en español: nombre, fuente, cobertura, motivos, cómo se calculó y qué no sabemos', () => {
  const puntos = armarPuntos(f, 'en');
  assert.ok(puntos.length >= 14);
  for (const p of puntos) { const malos = textos(p).map(limpiar).filter(espanol); assert.deepEqual(malos, [], p.id); }
  const sinDatos = armarPuntos({tracker: null, walmart: null, reembolsos: null, ordenes: null, hilos: null, repetido: null, garantia: null}, 'en');
  for (const p of sinDatos) assert.deepEqual(textos(p).filter(espanol), [], 'sin datos ' + p.id);
  assert.deepEqual(temasDe('en').map(t => t.nombre), ['Returns and chargebacks', 'Warranty', 'Logistics and service', 'Channels', 'Locations', 'SKU']);
  assert.deepEqual(temasDe('es'), TEMAS);
});
test('el español por omisión no cambia y las cifras (dinero, volumen, clase, periodo, id) son idénticas en ambos idiomas', () => {
  const es = armarPuntos(f), en = armarPuntos(f, 'en');
  assert.deepEqual(armarPuntos(f, 'es'), es);
  const duro = p => ({id: p.id, tema: p.tema, clase: p.clase, padre: p.padre, dinero: p.dinero.sinDato ? p.dinero.causa : p.dinero.minor, volumen: p.volumen.sinDato ? p.volumen.causa : p.volumen.n, periodo: p.periodo, solapaCon: p.solapaCon});
  assert.deepEqual(en.map(duro), es.map(duro));
  assert.equal(es.find(p => p.id === 'P1').nombre, 'Reembolsos negados o vencidos (Tracker)');
  assert.equal(en.find(p => p.id === 'P1').nombre, 'Denied or expired refunds (Tracker)');
  assert.match(en.find(p => p.id === 'P1').cobertura.texto, /^15 denied or expired requests out of 300/); assert.match(es.find(p => p.id === 'P1').cobertura.texto, /^15 solicitudes negadas/);
  assert.match(en.find(p => p.id === 'P8').cobertura.texto, /\(12%\)/); assert.match(es.find(p => p.id === 'P8').cobertura.texto, /\(12 %\)/);
});
