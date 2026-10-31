// Modalidad de venta y de envío (preguntas E y F): mapeo del campo Retailer, valores desconocidos, anulación por configuración externa y honestidad de las tarjetas.
//   node --test packages/workspace-service/tests/cco-modalidad.test.mjs
// Datos 100 % sintéticos con un prefijo inventado; ningún valor real de cliente.
import test from 'node:test';
import assert from 'node:assert/strict';
import {SIN_DATO, SUBCANALES, MODALIDADES_BASE, VALORES_EJE, FALTAN, FALTAN_ES, modalidadDe, modalidadDeSubcanal, tablaModalidades, tarjetaE, tarjetaF, armarCco} from '../cco.mjs';

const P = 'marca-x';
const m = (raw, prefijo = P) => modalidadDe(raw, prefijo, tablaModalidades({}));

test('mapeo del Retailer: los tres ejes por valor, incluyendo que Walmart nunca compra producto de la empresa', () => {
  const caso = (raw, vende, bodega, marketplace) => assert.deepEqual(m(raw), {vende, bodega, marketplace, conocida: true}, raw);
  caso('Amazon :: fulfilled by Marca-X', 'empresa', 'empresa', 'amazon');
  caso('Amazon :: fulfilled by Amazon', 'empresa', 'marketplace', 'amazon');
  caso('Amazon :: Amazon.com', 'marketplace', 'marketplace', 'amazon');
  caso('Walmart :: fulfilled by Marca-X', 'empresa', 'empresa', 'walmart');
  caso('Walmart :: fulfilled by Walmart', 'empresa', 'marketplace', 'walmart');
  // Amazon sin subcanal: no se sabe quién vende ni de dónde sale. Walmart sin subcanal: se sabe que vende la empresa, no la bodega.
  caso('Amazon', SIN_DATO, SIN_DATO, 'amazon');
  caso('Walmart', 'empresa', SIN_DATO, 'walmart');
  for (const w of ['Walmart', 'Walmart :: fulfilled by Walmart', 'Walmart :: fulfilled by Marca-X']) assert.equal(m(w).vende, 'empresa', 'Walmart: vende la empresa a través de Walmart');
});
test('valores que la tabla no conoce quedan en «Sin dato» en los tres ejes: nunca se asignan en silencio', () => {
  for (const raw of ['', null, undefined, 'Lowes', 'Home Depot', 'Best Buy :: USA', 'Pending', 'Otro marketplace nuevo', 'Marca-X.com :: Shopify', 'AMAZON-RARO', '   ']) {
    const r = m(raw);
    if (['AMAZON-RARO'].includes(raw)) { assert.equal(r.vende, SIN_DATO, String(raw)); continue; } // empieza por «amazon» pero sin subcanal: su vendedor no se sabe
    assert.deepEqual(r, {vende: SIN_DATO, bodega: SIN_DATO, marketplace: SIN_DATO, conocida: false}, String(raw));
  }
  for (const sub of ['constructor', '__proto__', 'toString', 'hasOwnProperty', 'subcanal_inventado', 'lowes', null, undefined, 42]) {
    assert.deepEqual(modalidadDeSubcanal(sub), {vende: SIN_DATO, bodega: SIN_DATO, marketplace: SIN_DATO, conocida: false}, String(sub));
  }
});
test('sin el prefijo de la marca (configuración externa vacía) nada se asigna a la empresa', () => {
  assert.equal(m('Amazon :: fulfilled by Marca-X', '').vende, SIN_DATO);
  assert.equal(m('Amazon :: fulfilled by Marca-X', '').bodega, SIN_DATO);
  assert.equal(m('Walmart :: fulfilled by Marca-X', '').bodega, SIN_DATO);
  assert.equal(m('Amazon :: Amazon.com', '').vende, 'marketplace', 'lo que no depende de la marca sigue clasificándose');
});
test('la tabla base cubre exactamente los subcanales de Amazon y Walmart del catálogo, con valores solo de su eje', () => {
  const esperados = SUBCANALES.filter((c) => /^(amazon|walmart)/.test(c)).sort();
  assert.deepEqual(Object.keys(MODALIDADES_BASE).sort(), esperados);
  for (const [sub, f] of Object.entries(MODALIDADES_BASE)) for (const eje of Object.keys(VALORES_EJE)) assert.ok(f[eje] === null || VALORES_EJE[eje].includes(f[eje]), `${sub}.${eje}`);
  for (const sub of Object.keys(MODALIDADES_BASE)) assert.equal(MODALIDADES_BASE[sub].marketplace === null, false, `${sub} siempre sabe su marketplace`);
});
test('configuración externa VEXA_CCO_MODALIDADES: reemplaza una entrada válida; ignora JSON roto, subcanales ajenos y valores fuera de su eje', () => {
  const t = (obj) => tablaModalidades({VEXA_CCO_MODALIDADES: typeof obj === 'string' ? obj : JSON.stringify(obj)});
  const base = tablaModalidades({});
  assert.deepEqual(t({amazon_com: {vende: 'empresa', bodega: 'marketplace', marketplace: 'amazon'}}).amazon_com, {vende: 'empresa', bodega: 'marketplace', marketplace: 'amazon'});
  assert.deepEqual(t({amazon_sin_subcanal: {marketplace: 'amazon'}}).amazon_sin_subcanal, {vende: null, bodega: null, marketplace: 'amazon'}, 'un eje ausente es sin dato, no un valor inventado');
  assert.deepEqual(t('{no es json'), base); assert.deepEqual(t('[1,2]'), base); assert.deepEqual(t('null'), base); assert.deepEqual(tablaModalidades({}), base);
  assert.deepEqual(t({amazon_com: {vende: 'vendedor-raro', bodega: 'marketplace', marketplace: 'amazon'}}).amazon_com, base.amazon_com, 'valor fuera de su eje: la entrada se descarta entera');
  assert.deepEqual(t({amazon_com: {vende: 'marketplace', bodega: 'walmart', marketplace: 'amazon'}}).amazon_com, base.amazon_com, 'walmart no es una bodega válida');
  assert.equal(t({subcanal_inventado: {vende: 'empresa'}}).subcanal_inventado, undefined, 'un subcanal fuera del catálogo no entra a la tabla');
  assert.equal(t({lowes: {vende: 'empresa', bodega: 'empresa', marketplace: 'amazon'}}).lowes, undefined);
  assert.deepEqual(t({amazon_com: 'texto'}).amazon_com, base.amazon_com);
  // la base no se muta
  assert.equal(MODALIDADES_BASE.amazon_com.vende, 'marketplace');
  const nueva = t({amazon_com: {vende: 'empresa', bodega: 'empresa', marketplace: 'amazon'}});
  assert.equal(modalidadDeSubcanal('amazon_com', nueva).vende, 'empresa');
  assert.equal(modalidadDeSubcanal('amazon_com').vende, 'marketplace');
});

// ---- tarjetas E y F ----
const ok = (rows) => ({rows});
const cel = (d1, d2, n, es_otros = false) => ({d1, d2, n, es_otros});
const dm = (dim, d1, d2, n, es_otros = false) => ({dim, d1, d2, n, es_otros});
const raw = (extra = {}) => ({
  subcanal: ok([cel('amazon_cumplido_por_piloto', null, 40), cel('amazon_cumplido_por_amazon', null, 12), cel('amazon_com', null, 20), cel('walmart_cumplido_por_walmart', null, 9), cel('walmart_cumplido_por_piloto', null, 30), cel('walmart_sin_subcanal', null, 6),
    cel('lowes', null, 25), cel('amazon_nuevo_futuro', null, 7), cel(null, null, 8, true)]),
  cob: ok([{rows_total: 200, with_retailer: 190, cutoff: '2026-10-05T00:00:00Z'}]),
  modalidad: ok([
    dm('subcanal_tipo', 'amazon_cumplido_por_piloto', 'reembolso', 14), dm('subcanal_tipo', 'amazon_cumplido_por_piloto', 'garantia', 22), dm('subcanal_tipo', 'amazon_com', 'reembolso', 6), dm('subcanal_tipo', 'walmart_cumplido_por_piloto', 'garantia', 18),
    dm('subcanal_defecto', 'amazon_cumplido_por_piloto', 'defectuoso', 9), dm('subcanal_defecto', 'amazon_cumplido_por_piloto', 'danado', 5),
    dm('subcanal_despacho', 'amazon_cumplido_por_piloto', '2_dias', 8), dm('subcanal_despacho', 'amazon_cumplido_por_piloto', '3_o_mas_dias', 6), dm('subcanal_despacho', 'amazon_cumplido_por_piloto', 'sin_dato', 5),
    dm('subcanal_bodega', 'amazon_cumplido_por_piloto', 'BODEGAB-USTX', 12), dm('subcanal_bodega', 'amazon_cumplido_por_piloto', 'BODEGAA USA Inc', 7),
    dm('sku_subcanal', 'SYN-1', 'amazon_cumplido_por_piloto', 18), dm('sku_subcanal', 'SYN-1', 'amazon_com', 8), dm('sku_subcanal', 'SYN-1', 'amazon_cumplido_por_amazon', 5), dm('sku_subcanal', 'SYN-2', 'walmart_cumplido_por_piloto', 12), dm('sku_subcanal', 'SYN-3', 'amazon_nuevo_futuro', 6),
    dm('sku_subcanal_tipo', 'SYN-1', 'amazon_cumplido_por_piloto|reembolso', 7), dm('sku_subcanal_tipo', 'SYN-1', 'amazon_com|reembolso', 5),
    dm('sku_subcanal_defecto', 'SYN-1', 'amazon_cumplido_por_piloto|defectuoso', 6)]),
  ...extra,
});

test('E: quién vende. Con casos reales queda «Con salvedad»; solo cuenta Amazon y Walmart; lo ajeno y lo desconocido no se mezcla', () => {
  const c = tarjetaE(raw());
  assert.equal(c.id, 'E'); assert.equal(c.estado, 'salvedad'); assert.equal(c.eje, 'vende'); assert.equal(c.puedeRecomendar, false); assert.equal(c.clase, 'observed'); assert.equal(c.fuente, 'tracker');
  assert.deepEqual(c.subcanales.map((x) => x.subcanal), ['amazon_cumplido_por_piloto', 'walmart_cumplido_por_piloto', 'amazon_com', 'amazon_cumplido_por_amazon', 'walmart_cumplido_por_walmart', 'amazon_nuevo_futuro', 'walmart_sin_subcanal'], 'sin Lowes; el subcanal de Amazon que la tabla no conoce sí se muestra, como Sin dato');
  const ap = c.subcanales[0];
  assert.deepEqual([ap.vende, ap.bodega, ap.marketplace, ap.casos, ap.reembolsos, ap.garantias, ap.defectos], ['empresa', 'empresa', 'amazon', 40, 14, 22, 14]);
  assert.deepEqual(ap.despacho, {legibles: 14, tresODias: 6}, 'sin_dato no cuenta como tiempo legible');
  assert.deepEqual(ap.bodegas, [{bodega: 'BODEGAB-USTX', n: 12}, {bodega: 'BODEGAA USA Inc', n: 7}]);
  const wp = c.subcanales.find((x) => x.subcanal === 'walmart_cumplido_por_piloto'); assert.equal(wp.reembolsos, null, 'sin celda visible: null («Menos de 5»), jamás 0'); assert.equal(wp.defectos, null); assert.equal(wp.despacho.legibles, null);
  assert.deepEqual(c.ejes, [{valor: 'empresa', casos: 40 + 12 + 9 + 30 + 6}, {valor: 'marketplace', casos: 20}, {valor: SIN_DATO, casos: 7}]);
  assert.equal(c.subcanales.find((x) => x.subcanal === 'amazon_nuevo_futuro').conocida, false);
  assert.equal(c.ocultos, 8); assert.equal(c.totalCasos, 124);
});
test('E por SKU: cada celda cae en el grupo que dice su modalidad; el subcanal desconocido va a «Sin dato»; los desconocidos no son cero', () => {
  const c = tarjetaE(raw()), s1 = c.skus.find((x) => x.sku === 'SYN-1'), s3 = c.skus.find((x) => x.sku === 'SYN-3');
  assert.deepEqual(s1.grupos.empresa, {casos: 23, reembolsos: 7, defectos: 6}); assert.deepEqual(s1.grupos.marketplace, {casos: 8, reembolsos: 5, defectos: null}); assert.equal(s1.grupos[SIN_DATO], null);
  assert.deepEqual(s3.grupos[SIN_DATO], {casos: 6, reembolsos: null, defectos: null}, 'un subcanal fuera de la tabla no se asigna a ninguna modalidad'); assert.equal(s3.grupos.empresa, null);
  assert.deepEqual(c.skus.map((x) => x.sku), ['SYN-1', 'SYN-2', 'SYN-3'], 'orden por casos visibles');
});
test('F: de qué bodega sale. Misma evidencia, eje distinto; Amazon cumplido por Amazon y Walmart cumplido por Walmart caen en el marketplace', () => {
  const c = tarjetaF(raw());
  assert.equal(c.id, 'F'); assert.equal(c.estado, 'salvedad'); assert.equal(c.eje, 'bodega'); assert.equal(c.puedeRecomendar, false);
  assert.deepEqual(c.ejes, [{valor: 'empresa', casos: 40 + 30}, {valor: 'marketplace', casos: 12 + 20 + 9}, {valor: SIN_DATO, casos: 6 + 7}]);
  const s1 = c.skus.find((x) => x.sku === 'SYN-1'); assert.equal(s1.grupos.empresa.casos, 18); assert.equal(s1.grupos.marketplace.casos, 13, 'Amazon.com y cumplido por Amazon: bodega del marketplace');
  const wal = tarjetaF(raw()).subcanales.find((x) => x.subcanal === 'walmart_sin_subcanal'); assert.equal(wal.bodega, SIN_DATO); assert.equal(wal.vende, 'empresa');
});
test('honestidad: nunca hay recomendación; E y F dicen qué falta para decidir y a quién pedirlo; las salvedades de sesgo y de no-venta siempre van', () => {
  for (const c of [tarjetaE(raw()), tarjetaF(raw())]) {
    assert.equal(c.puedeRecomendar, false);
    for (const s of ['sesgoCasos', 'sinDenominadorVentas', 'sinRecomendacion', 'sinTiempoResolucion', 'modalidadSinDato', 'celdasMinimo', 'sumaMinimo']) assert.ok(c.salvedades.includes(s), `${c.id} ${s}`);
    for (const k of ['ventaPorModalidad', 'costoCumplimiento', 'cumplimientoPedido', 'tiempoResolucion', 'propiedadRetailer']) assert.ok(c.faltan.some((x) => x.clave === k), `${c.id} falta ${k}`);
    assert.ok(c.faltan.every((x) => ['responsable_a', 'responsable_b'].includes(x.quien)));
    assert.deepEqual(c.faltanTextos.length, c.faltan.length); assert.ok(c.faltanTextos.every((x) => /Pedir a (Responsable A|Responsable B)\.$/.test(x)));
    assert.doesNotMatch(JSON.stringify(c), /conviene|recomend[oa]r?:|mejor modalidad/i, 'la tarjeta no trae ninguna recomendación en datos');
  }
  assert.ok(tarjetaE(raw()).faltan.some((x) => x.clave === 'costoSku' && x.quien === 'responsable_a') && tarjetaE(raw()).faltan.some((x) => x.clave === 'proveedorDirecto'));
  assert.ok(tarjetaF(raw()).faltan.some((x) => x.clave === 'facturasTransportista') && tarjetaF(raw()).salvedades.includes('walmartSoloBodega'));
  for (const id of ['E', 'F']) for (const x of FALTAN[id]) assert.ok(FALTAN_ES[x.clave], x.clave);
});
test('degradación honesta: sin la función de detalle los conteos por subcanal siguen y el detalle es «sin dato», no cero; sin celdas visibles o sin lectura: «Falta dato»', () => {
  const sinDetalle = tarjetaE({...raw(), modalidad: {error: 'not_installed'}});
  assert.equal(sinDetalle.estado, 'salvedad'); assert.equal(sinDetalle.detalleIndisponible, true); assert.equal(sinDetalle.skus.length, 0);
  assert.ok(sinDetalle.subcanales.every((x) => x.reembolsos === null && x.defectos === null && x.despacho === null && x.bodegas === null), 'ningún detalle inventado');
  assert.equal(tarjetaE({subcanal: ok([cel('amazon_com', null, 50)])}).detalleIndisponible, true, 'raw viejo sin la lectura de modalidad');
  const sinCeldas = tarjetaF({...raw(), subcanal: ok([cel('lowes', null, 30), cel(null, null, 12, true)])});
  assert.equal(sinCeldas.estado, 'falta'); assert.deepEqual(sinCeldas.subcanales, []); assert.equal(sinCeldas.ocultos, 12);
  for (const e of ['unavailable', 'not_installed']) { const c = tarjetaE({subcanal: {error: e}}); assert.equal(c.estado, 'falta'); assert.equal(c.indisponible, e); assert.deepEqual(c.subcanales, []); }
  assert.equal(tarjetaE({}).estado, 'falta');
});
test('la tabla externa cambia la tarjeta sin tocar el código: una anulación válida mueve los casos de eje', () => {
  const tabla = tablaModalidades({VEXA_CCO_MODALIDADES: JSON.stringify({amazon_com: {vende: 'empresa', bodega: 'marketplace', marketplace: 'amazon'}})});
  const c = tarjetaE(raw(), {tabla});
  assert.equal(c.subcanales.find((x) => x.subcanal === 'amazon_com').vende, 'empresa'); assert.equal(c.ejes.find((x) => x.valor === 'marketplace').casos, 0);
});
test('armarCco: E y F ya no son «Falta dato» cuando hay casos reales, y el resumen cuadra', () => {
  const vacio = {rows: []};
  const v = armarCco({ventanas: vacio, skuCanal: vacio, sinVenta: vacio, defecto: vacio, hoja: vacio, bodLat: vacio, bodMot: vacio, cob: raw().cob, subcanal: raw().subcanal, modalidad: raw().modalidad}, null, {now: new Date('2026-10-31T00:00:00Z')});
  assert.equal(v.cards.E.estado, 'salvedad'); assert.equal(v.cards.F.estado, 'salvedad');
  assert.equal(v.resumen.listo + v.resumen.salvedad + v.resumen.falta, 6);
});
