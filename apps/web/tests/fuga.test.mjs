// «Fuga de reembolsos»: textos por plantilla, estimador con candado y archivos de un clic (sin PII, sin inyección en CSV/HTML). Vista sintética (SKU DEMO-*).
//   cd apps/web && node --require ./tests/server-only-stub.cjs --import tsx --test tests/fuga.test.mjs
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {vistaSintetica} from './ui/fuga-sintetico.mjs';
import * as M from '../src/components/refunds/fuga-modelo.mjs';
import * as A from '../src/components/refunds/fuga-archivos.mjs';

const v = await vistaSintetica();

test('formato de dinero y textos: bruto y sin cancelados, concentración, cobertura y ventanas en una línea', () => {
  assert.equal(M.usd('85472800'), '[omitido: dato de cliente]'); assert.equal(M.usd('50', {decimals: true}), '$0.50'); assert.equal(M.usd(null), '—');
  assert.match(M.fraseConcentracion(v), /^10 SKUs concentran el \d+(\.\d)? % del dinero devuelto\./);
  assert.match(M.lineaCobertura(v), /Amazon .* · Walmart .* · Shopify 13 reembolsos\. \d+ % de los de Amazon sin monto\. CAD no se suman \(4 reembolsos\)\./);
  const ven = M.lineaVentanas(v);
  assert.match(ven, /Ninguna ventana de exportación está marcada como completa/); assert.match(ven, /Walmart desde 4 jul 2026/); assert.match(ven, /Datos hasta el 5 oct 2026\./);
  assert.equal(M.fraseConcentracion({titular: {status: 'unavailable'}}), null);
});
test('qué cambió: solo meses completos; septiembre y huecos no son señal', () => {
  const f = M.frasesCambios(v).map(x => x.texto).join('\n');
  assert.match(f, /ago 2026: 2,576 conversaciones cargadas, frente a 4,183 en ago 2025 \(-38 %\)/);
  assert.doesNotMatch(f, /sep 2026: 1,318/);
  const ex = M.excluidosTexto(v).join(' | ');
  assert.match(ex, /Conversaciones sep 2026 \(mes parcial\)/); assert.match(ex, /Amazon feb 2026 \(posible hueco de exportación\)/); assert.match(ex, /Walmart sep 2026 \(posible hueco de exportación\)/);
});
test('estimador con candado: sin supuestos no hay número; con ellos, la cuenta a la vista; entradas inválidas no producen número', () => {
  const vacio = {vacio: true}, base = '10000000';
  assert.deepEqual(M.estimar({baseUsdMinor: base, ticketsRepiten: 1000, pctProveedor: vacio, pctRecuperable: vacio, costoContacto: vacio, pctEvitable: vacio}), {A: null, B: null});
  const a = M.estimar({baseUsdMinor: base, ticketsRepiten: 1000, pctProveedor: M.porcentaje('30 %'), pctRecuperable: M.porcentaje('50'), costoContacto: vacio, pctEvitable: vacio});
  assert.equal(a.A.valorUsd, 15000); assert.equal(a.B, null); assert.equal(M.formulaA(a.A), '$100,000 × 30 % × 50 %');
  const mitad = M.estimar({baseUsdMinor: base, ticketsRepiten: 1000, pctProveedor: M.porcentaje('30'), pctRecuperable: vacio, costoContacto: vacio, pctEvitable: vacio});
  assert.equal(mitad.A, null, 'con un solo supuesto de dos no se muestra número');
  const b = M.estimar({baseUsdMinor: null, ticketsRepiten: 200, pctProveedor: vacio, pctRecuperable: vacio, costoContacto: M.dinero('$6.50'), pctEvitable: M.porcentaje('25')});
  assert.equal(b.B.valorUsd, 325); assert.equal(M.formulaB(b.B), '200 tickets × $6.50 × 25 %');
  assert.ok(M.porcentaje('120').error && M.porcentaje('abc').error && M.porcentaje('-5').error && M.dinero('1e3').error && M.porcentaje('0.3').ok, '0.3 es 0.3 %, no 30 %');
  assert.equal(M.estimar({baseUsdMinor: base, ticketsRepiten: null, pctProveedor: M.porcentaje('x'), pctRecuperable: M.porcentaje('50'), costoContacto: vacio, pctEvitable: vacio}).A, null);
});
test('paquete de evidencia: HTML + CSV con proveniencia, sin PII, escapados', () => {
  const sku = v.skus.top[0].sku, p = A.paqueteEvidencia(v, sku);
  assert.match(p.html.nombre, /^evidencia-demo-lsa-1-2026-10-23\.html$/); assert.match(p.csv.nombre, /\.csv$/);
  assert.match(p.html.contenido, /Lo que este paquete no prueba/); assert.match(p.html.contenido, /Observado/); assert.match(p.html.contenido, /De dónde sale cada cifra/);
  for (const texto of [p.html.contenido, p.csv.contenido]) { assert.ok(!/@|datos personales/.test(texto.replace(/<style>[\s\S]*?<\/style>/, ''))); }
  assert.match(p.csv.contenido, /seccion,clave,valor,detalle/); assert.match(p.csv.contenido, /no_se_sabe/);
  assert.equal(A.paqueteEvidencia(v, 'NO-EXISTE'), null);
  const raro = structuredClone(v); raro.skus.top[0].sku = '<script>alert(1)</script>'; raro.skus.detalleMensual = [];
  const q = A.paqueteEvidencia(raro, '<script>alert(1)</script>');
  assert.ok(!q.html.contenido.includes('<script>alert') && q.html.contenido.includes('&lt;script&gt;'));
  assert.equal(A.celda('=HYPERLINK("x")'), '"\'=HYPERLINK(""x"")"'); assert.equal(A.celda('+1'), "'+1"); assert.equal(A.celda(12.5), '12.5'); assert.equal(A.celda('a,b'), '"a,b"');
});
test('lista de Walmart y cola de negados: conteos recalculados de los datos', () => {
  const l = A.listaWalmart(v), c = A.colaVencidos(v), e = v.tracker.estados;
  assert.equal(l.total, v.skus.walmart.length); assert.ok(l.contenido.split('\r\n').length > l.total);
  assert.equal(c.total, e.vencido + e.no_reembolsable + e.rechazado, 'la cola = vencidas + no reembolsables + rechazadas');
  const filas = c.contenido.split('\r\n').filter(Boolean).slice(1);
  assert.equal(filas.length, c.total);
  assert.ok(filas.every(f => /Más de 180 días|No reembolsable|Rechazado/.test(f)));
  assert.ok(!/datos personales|@/.test(c.contenido));
  assert.match(c.contenido, /monto_supuesto_usd/);
});
test('degradados: sin Tracker y sin resumen de contacto no inventan cifras', async () => {
  const sinT = await vistaSintetica({sinTracker: true, sinRepetido: true});
  assert.equal(sinT.tracker.status, 'empty'); assert.equal(sinT.contactoRepetido.status, 'not_computed');
  assert.equal(A.colaVencidos(sinT).total, 0);
  const vacio = await vistaSintetica({vacio: true});
  assert.equal(vacio.titular.status, 'empty'); assert.equal(M.fraseConcentracion(vacio), null);
});
