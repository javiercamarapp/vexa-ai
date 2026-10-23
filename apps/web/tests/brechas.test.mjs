// «Brechas de ingreso»: reglas puras (meses completos, cruce, familias, recomendaciones), contrato con el flujo de recomendaciones y archivos locales. Datos sintéticos (marcas inventadas).
//   cd apps/web && node --require ./tests/server-only-stub.cjs --import tsx --test tests/brechas.test.mjs
import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../../../packages/workspace-service/brechas.mjs';
import {vistaSintetica, entradasSinteticas} from './ui/brechas-sintetico.mjs';
import * as A from '../src/components/gaps/gaps-archivos.mjs';
import * as M from '../src/components/gaps/gaps-modelo.mjs';
import {menuVisible} from '../src/lib/workspace/menu.mjs';

const fila = (o) => ({currency: 'USD', exponent: 2, nCancelled: 0, nReview: 0, cancelledMinor: '0', reviewMinor: '0', ...o});
const mes = (channel, month, n, {sku = 'AAAA-1', precio = 100, first, last, canc = 0} = {}) => fila({channel, month, sku, n, nCancelled: canc, amountMinor: String(n * precio * 100), cancelledMinor: String(canc * precio * 100), firstDay: first ?? month + '-01', lastDay: last ?? month + '-28'});

test('familia de un SKU: prefijo de 2 a 6 letras; una letra o sin separador no se mapea', () => {
  assert.equal(G.familiaDeSku('SKUP-L1'), 'cod:SKUP'); assert.equal(G.familiaDeSku('stx3000'), 'cod:STX'); assert.equal(G.familiaDeSku('GTX6-M'), 'cod:GTX');
  for (const s of ['M14', 'S1234', 'PENDING', '', null, '12345']) assert.equal(G.familiaDeSku(s), null, String(s));
  assert.equal(G.etiquetaFamilia('cod:SKUP'), 'Línea SKUP'); assert.equal(G.etiquetaFamilia('cat:bateria'), 'Categoría: Batería');
});

test('calidad de meses: parcial al inicio y al final, hueco bajo la mitad del mes previo, y el par comparable son los dos últimos completos', () => {
  const rows = [mes('walmart', '2026-04', 100, {first: '2026-04-06'}), mes('walmart', '2026-05', 200), mes('walmart', '2026-06', 210), mes('walmart', '2026-07', 220), mes('walmart', '2026-08', 90), mes('walmart', '2026-09', 80, {last: '2026-09-12'})];
  const q = G.calidadMeses(rows), c = m => q.get('walmart|' + m).calidad;
  assert.deepEqual(['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'].map(c), ['parcial', 'completo', 'completo', 'completo', 'posible_hueco', 'parcial']);
  assert.deepEqual(G.parDeMesesCompletos(q, 'walmart'), {previo: '2026-06', mes: '2026-07'});
  assert.equal(G.parDeMesesCompletos(G.calidadMeses([mes('x', '2026-01', 10, {first: '2026-01-09'})]), 'x'), null);
});

test('ingresos: activo = bruto - cancelados, monedas separadas, canales sin SKU cuentan en el total pero no en el ranking, % acumulado sobre el total', () => {
  const rows = [mes('amazon', '2026-01', 10, {sku: 'AAAA-1', precio: 100, canc: 1}), mes('amazon', '2026-01', 5, {sku: 'BBBB-2', precio: 200}), mes('shopify', '2026-01', 4, {sku: null, precio: 50}), fila({channel: 'amazon', month: '2026-01', sku: 'AAAA-1', currency: 'CAD', n: 3, amountMinor: '90000', firstDay: '2026-01-01', lastDay: '2026-01-28'})];
  const I = G.armarIngresos(rows);
  assert.equal(I.activo, 90000n + 100000n + 20000n); assert.equal(I.cancelado, 10000n); assert.equal(I.otras[0].currency, 'CAD'); assert.equal(I.sinSkuActivo, 20000n);
  const r = G.rankingIngresos(I);
  assert.deepEqual(r.map(x => [x.sku, x.activoMinor]), [['BBBB-2', '100000'], ['AAAA-1', '90000']]); assert.equal(r[1].acumPct, 90.4); // (100000+90000)/210000 = 90.47, truncado como en Fuga de reembolsos
});

test('cruce: intensidad = reembolsos sin cancelados / ingreso del mismo sku-canal-mes; meses parciales y previos al libro de reembolsos no cuentan; cobertura honesta', () => {
  const meses = ['2026-05', '2026-06', '2026-07'];
  const ordenes = meses.map(m => mes('walmart', m, 100, {sku: 'AAAA-1', precio: 100}));
  ordenes.push(mes('walmart', '2026-08', 100, {sku: 'AAAA-1', precio: 100, last: '2026-08-10'})); // último mes parcial
  const I = G.armarIngresos(ordenes);
  const R = G.armarReembolsos([{month: '2026-06', channel: 'walmart', sku: 'AAAA-1', currency: 'USD', exponent: 2, n: 10, nKnown: 10, nCancelled: 2, amountMinor: '100000', activeMinor: '80000'},
    {month: '2026-07', channel: 'walmart', sku: 'AAAA-1', currency: 'USD', exponent: 2, n: 5, nKnown: 5, nCancelled: 0, amountMinor: '50000', activeMinor: '50000'},
    {month: '2026-08', channel: 'walmart', sku: 'AAAA-1', currency: 'USD', exponent: 2, n: 99, nKnown: 99, nCancelled: 0, amountMinor: '990000', activeMinor: '990000'}]);
  const c = G.cruzar(I, R), f = c.filas[0];
  assert.equal(f.meses.join(','), '2026-06,2026-07'); // mayo: antes del libro de reembolsos; agosto: parcial
  assert.equal(f.ingresoMinor, 2000000n); assert.equal(f.reembolsoMinor, 130000n); assert.equal(f.intensidadPct, 6.5); assert.equal(f.reembolsos, 15);
  assert.equal(c.cobertura.reembolsosCruzados, 15); assert.equal(c.cobertura.reembolsosTotales, 114); assert.equal(c.cobertura.pct, 11.6); // 130000 / 1120000
});

test('vista sintética: totales coherentes, cifras en cadena (sin BigInt), concentración y top 10 estables', () => {
  const v = vistaSintetica();
  JSON.stringify(v);
  assert.equal(v.ingresos.status, 'ok');
  const suma = v.ingresos.canales.reduce((a, c) => a + BigInt(c.activoMinor), 0n); assert.equal(String(suma), v.ingresos.activoMinor);
  assert.equal(v.ingresos.meses.reduce((a, m) => a + BigInt(m.totalMinor), 0n).toString(), v.ingresos.activoMinor);
  const r = v.ranking.items; for (let i = 1; i < r.length; i++) assert.ok(BigInt(r[i - 1].activoMinor) >= BigInt(r[i].activoMinor));
  assert.equal(r.at(-1).acumPct <= 100, true); assert.equal(v.ranking.top10Pct, r[9].acumPct);
  assert.equal(v.perdidas.reembolsos.top10.length, 10);
  assert.ok(BigInt(v.perdidas.reembolsos.activoMinor) <= BigInt(v.perdidas.reembolsos.brutoMinor));
  assert.ok(v.intensidad.cobertura.pct > 0 && v.intensidad.cobertura.pct <= 100);
});

test('crecimiento mes contra mes: solo entre meses completos consecutivos de ese canal (nunca contra el hueco ni el mes parcial)', () => {
  const v = vistaSintetica();
  const par = v.ingresos.pares.amazon; assert.deepEqual(par, {previo: '2026-08', mes: '2026-09'}); // feb (hueco) y oct (parcial) quedan fuera
  assert.deepEqual(v.ingresos.pares.walmart, {previo: '2026-07', mes: '2026-08'}); // sep es hueco
  for (const x of v.ranking.items) if (x.crecimiento) assert.deepEqual([x.crecimiento.previo, x.crecimiento.mes], [v.ingresos.pares[x.crecimiento.canal].previo, v.ingresos.pares[x.crecimiento.canal].mes]);
  assert.ok(M.mesesExcluidos(v).some(t => /Amazon feb 2026 \(posible hueco/.test(t))); assert.ok(M.mesesExcluidos(v).some(t => /Amazon oct 2026 \(mes parcial\)/.test(t)));
});

test('recomendaciones: cada una con acción, porqué, evidencia, cobertura e impacto observado; reglas disparan solo con base suficiente; nunca margen ni utilidad', () => {
  const v = vistaSintetica(), tipos = new Set(v.recomendaciones.items.map(r => r.tipo));
  for (const t of ['revisar_proveedor', 'empujar', 'revisar_canal', 'cross_sell']) assert.ok(tipos.has(t), t);
  for (const r of v.recomendaciones.items) {
    assert.ok(r.accion && r.porque && r.evidencia.length >= 2 && r.cobertura && r.impacto.texto, r.id);
    assert.equal(r.impacto.clase, 'observed'); assert.doesNotMatch(JSON.stringify(r), /utilidad|ganancia|rentabilidad/i); assert.doesNotMatch(JSON.stringify(r), /margen/i);
  }
  const rev = v.recomendaciones.items.find(r => r.id === 'revisar:MILO-3:walmart'); assert.match(rev.porque, /26\.2 %/); assert.match(rev.porque, /5\.5 %/);
  // sin análisis avanzado no hay venta cruzada
  const p = vistaSintetica({variante: 'pendiente'}); assert.ok(!p.recomendaciones.items.some(r => r.tipo === 'cross_sell'));
  // un SKU con poco ingreso no dispara «revisar» aunque su intensidad sea altísima
  const e = entradasSinteticas({}); e.ordenes.rows.push(mes('walmart', '2026-07', 40, {sku: 'ZZZZ-1', precio: 20}), mes('walmart', '2026-08', 40, {sku: 'ZZZZ-1', precio: 20}));
  e.reembolsos.rows.push({month: '2026-08', channel: 'walmart', sku: 'ZZZZ-1', currency: 'USD', exponent: 2, n: 30, nKnown: 30, nCancelled: 0, amountMinor: '60000', activeMinor: '60000'});
  assert.ok(!G.armarVista({...e}).recomendaciones.items.some(r => r.sku === 'ZZZZ-1'));
});

test('contrato recomendacionDeBrecha: puro, borrador en estado proposed, supuestos tecleados al final, rechaza entradas inválidas', () => {
  const rec = vistaSintetica().recomendaciones.items[0];
  const b = G.recomendacionDeBrecha(rec, {generadoEn: '2026-10-23T20:00:00Z', supuestos: ['30 % atribuible']});
  assert.deepEqual(Object.keys(b).sort(), ['clave', 'cobertura', 'cuerpo', 'estadoSugerido', 'etiquetas', 'evidencia', 'impacto', 'origen', 'resumen', 'supuestos', 'tipoBrecha', 'titulo']);
  assert.equal(b.origen, 'brechas-de-ingreso'); assert.equal(b.estadoSugerido, 'proposed'); assert.equal(b.clave, rec.id);
  assert.match(b.cuerpo, /Qué hacer:/); assert.match(b.cuerpo, /Supuestos tecleados/); assert.match(b.cuerpo, /ingreso bruto observado; no hay costo ni margen/); assert.match(b.cuerpo, /2026-10-23/);
  assert.deepEqual(G.recomendacionDeBrecha(rec), G.recomendacionDeBrecha(rec)); // determinista
  assert.ok(!G.recomendacionDeBrecha(rec).cuerpo.includes('Supuestos tecleados'));
  assert.throws(() => G.recomendacionDeBrecha({}), /brecha_invalida/); assert.throws(() => G.recomendacionDeBrecha(null));
});

test('familias: pendiente sin análisis (con avance leído), nunca mezcla familias sin mapa, tasa por 100 líneas con su cobertura', () => {
  const p = vistaSintetica({variante: 'pendiente'});
  assert.equal(p.familias.status, 'pendiente'); assert.equal(p.familias.progreso.v2, 0); assert.equal(p.familias.progreso.avancePct, 0); assert.deepEqual(p.familias.filas, []);
  assert.equal(M.textoAvance(p.familias), '0 de 94,025 conversaciones del histórico analizadas (0 %).');
  const f = vistaSintetica().familias;
  assert.equal(f.status, 'parcial'); assert.ok(f.filas.every(x => x.familia.startsWith('cod:')) && f.categorias.every(x => x.familia.startsWith('cat:')));
  const milo = f.filas.find(x => x.familia === 'cod:MILO'); assert.equal(milo.por100, Math.round((milo.conversaciones * 1000) / milo.lineas) / 10);
  assert.equal(f.filas[0].posIngreso, 1); assert.ok(f.cobertura.conFamiliaPct > 0);
  // una familia con conversaciones pero sin SKUs con ese prefijo NO se cruza: queda en sinMapa
  const e = entradasSinteticas({}); e.quejas.rows.push({month: '2026-05', family: 'cod:QQQQ', n: 50});
  const v2 = G.armarVista(e); assert.ok(!v2.familias.filas.some(x => x.familia === 'cod:QQQQ')); assert.ok(v2.familias.sinMapa.some(x => x.familia === 'cod:QQQQ'));
  assert.equal(G.armarVista({...e, quejas: {availability: 'unavailable'}}).familias.status, 'unavailable');
});

test('degradados: cada parte que falla dice «No disponible», jamás 0; el resto sigue', () => {
  const s = vistaSintetica({variante: 'sinordenes'}); assert.equal(s.ingresos.status, 'unavailable'); assert.equal(s.ranking.status, 'unavailable'); assert.equal(s.intensidad.status, 'unavailable'); assert.equal(s.perdidas.reembolsos.status, 'ok');
  assert.equal(s.recomendaciones.status, 'unavailable');
  const t = vistaSintetica({variante: 'sintracker'}); assert.equal(t.perdidas.tracker.status, 'unavailable'); assert.equal(t.ingresos.status, 'ok');
  const v = vistaSintetica({variante: 'vacio'}); assert.equal(v.ingresos.status, 'empty'); assert.equal(v.ranking.items.length, 0); assert.equal(v.recomendaciones.items.length, 0);
  const todo = G.armarVista({ordenes: {availability: 'timeout'}, reembolsos: {availability: 'unavailable'}, tracker: null, quejas: null, pares: null, progreso: null}); JSON.stringify(todo);
  assert.equal(todo.ingresos.status, 'unavailable'); assert.equal(todo.perdidas.reembolsos.status, 'unavailable'); assert.equal(todo.familias.status, 'unavailable');
});

test('Tracker: negados = más de 180 días + no reembolsables + rechazados; motivos de catálogo cerrado', () => {
  const t = G.armarTracker({total: 20, rows: [{status: 'vencido', reason: 'defective', retailer: 'walmart', n: 5, nAmount: 5, amountMinor: '50000'}, {status: 'rechazado', reason: 'otro', retailer: 'amazon', n: 2, nAmount: 1, amountMinor: '7000'},
    {status: 'reembolsado', reason: 'defective', retailer: 'amazon', n: 13, nAmount: 13, amountMinor: '90000'}]});
  assert.equal(t.negados, 7); assert.equal(t.negadosMinor, '57000'); assert.equal(t.negadosConMonto, 6);
  assert.equal(t.motivos[0].etiqueta, 'Defectuoso'); assert.equal(t.motivos[0].negados, 5);
});

test('archivos locales: CSV a prueba de fórmulas, HTML escapado, sin PII ni margen; el resumen trae titular y fuentes', () => {
  const v = vistaSintetica(), a = A.csvIngresos(v);
  assert.match(a.nombre, /^ingreso-por-sku-2026-10-23\.csv$/); assert.equal(a.total, v.ranking.items.length); assert.ok(a.contenido.startsWith('﻿posicion,sku,familia'));
  const mal = structuredClone(v); mal.ranking.items[0].sku = '=HYPERLINK("x")'; assert.match(A.csvIngresos(mal).contenido, /"'=HYPERLINK/);
  const i = A.csvIntensidad(v); assert.match(i.contenido, /mediana_canal_pct/); assert.match(i.contenido, /no es tasa por cohorte|Intensidad, no tasa por cohorte/);
  const h = A.resumenHtml(v).contenido; assert.match(h, /<h1>Brechas de ingreso<\/h1>/); assert.match(h, /INGRESO BRUTO/); assert.doesNotMatch(h, /@[a-z0-9-]+\.[a-z]{2,}/i);
  const xss = structuredClone(v); xss.recomendaciones.items[0].titulo = '<script>alert(1)</script>'; assert.doesNotMatch(A.resumenHtml(xss).contenido, /<script>alert/);
  for (const t of [a.contenido, i.contenido, h, A.csvRecomendaciones(v).contenido]) assert.doesNotMatch(t, /utilidad|ganancia|rentabilidad/i);
});

test('textos: concentración, cobertura y periodo por plantilla; variación con signo', () => {
  const v = vistaSintetica();
  assert.match(M.fraseConcentracionIngreso(v), /^10 SKUs concentran el \d+(\.\d)? % del ingreso bruto\./);
  assert.match(M.fraseConcentracionReembolsos(v), /^10 SKUs concentran el \d+(\.\d)? % del dinero devuelto/);
  assert.match(M.lineaCobertura(v), /líneas de pedido en USD/); assert.match(M.lineaCobertura(v), /CAD no se suman/);
  assert.match(M.periodoIngresos(v).linea, /Ventanas de exportación parciales/);
  assert.equal(M.variacion(13.4), '+13.4 %'); assert.equal(M.variacion(-7.2), '−7.2 %'); assert.equal(M.variacion(null), '—');
});

test('menú: «Brechas de ingreso» vive en Dinero (propietario y analista) junto a la fuga de reembolsos, que sigue ahí', () => {
  const d = menuVisible({role: 'analyst'}).find(g => g.clave === 'dinero').items.map(i => i.href);
  assert.ok(d.includes('/gaps') && d.includes('/refunds'));
  assert.ok(!menuVisible({role: 'viewer'}).some(g => g.clave === 'dinero'));
});
