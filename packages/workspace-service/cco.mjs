// «CCO»: seis preguntas del director de cliente (A a F) contestadas SOLO con lo que existe hoy, y para lo que no existe, la lista exacta de qué dato pedir y a quién.
// Lectura: funciones insight_cco_* (migración 20261201000000, solo lectura, RLS del llamador) + el repositorio del mapa para estados. Sin escritura, sin texto libre, sin modelo de lenguaje.
// Reglas de verdad: ingreso BRUTO (sin costo ni margen); lo desconocido es null/«Sin dato», jamás 0; monedas nunca se suman; toda tasa dentro de la ventana común del canal;
// exposición inferida no es pérdida; sin tiempo real (corte visible); k-anonimato mínimo 5 por celda; los textos viven en i18n (aquí solo claves).
import {normalizarSku} from './fuga-reembolsos.mjs';
import {createGeoMapRepository, K_MIN} from './mapa-problemas.mjs';

export {K_MIN};
export const CCO_VERSION = 1;
export const CCO_BUDGET_MS = Object.freeze({total: 14000, geo: 12000});
export const CANALES = Object.freeze(['amazon', 'walmart', 'bestbuy', 'shopify']);
export const SUBCANALES = Object.freeze(['amazon_cumplido_por_piloto', 'amazon_cumplido_por_amazon', 'amazon_com', 'amazon_sin_subcanal', 'walmart_cumplido_por_piloto', 'walmart_cumplido_por_walmart', 'walmart_sin_subcanal',
  'bestbuy', 'tienda', 'lowes', 'homedepot', 'pendiente', 'otro', 'sin_retailer']);
export const BODEGAS = Object.freeze(['BODEGAA USA Inc', 'BODEGAB-USTX', 'BODEGAB-USGA', 'BODEGAB-USWC5', 'BODEGAB-USNJ2', 'Bodegac', 'Bodegad', 'Bodegae Canada', 'otra']);
export const LATENCIAS = Object.freeze(['menos_de_1_dia', '1_dia', '2_dias', '3_o_mas_dias', 'sin_dato']);
export const DEFECTOS = Object.freeze(['defectuoso', 'danado', 'faltan_piezas', 'articulo_equivocado']);
export const HOJAS = Object.freeze(['garantia', 'reembolso', 'etiqueta_devolucion', 'lista_espera', 'otro']);

// ---- espejo en JS de los catálogos cerrados de la migración (una prueba verifica que SQL y JS dan lo mismo) ----
const lim = (s) => String(s ?? '').normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();
/** Prefijo (minúsculas) del retailer propio del cliente piloto: se configura por entorno (VEXA_TIENDA_PROPIA_PREFIJO), nunca en el repo.
 *  Vacío por defecto: sin configuración nada se clasifica como propio. Se lee en cada llamada (las pruebas lo fijan antes de usarlo).
 *  `globalThis.process` evita romper en el navegador, donde no hay `process`. */
export const prefijoPropio = (env = globalThis.process?.env) => lim(env?.VEXA_TIENDA_PROPIA_PREFIJO);
/** Retailer del Tracker -> subcanal de cumplimiento. El clasificador viejo (retailerDe) colapsa Amazon y Walmart; este conserva el cumplimiento.
 *  `prefijo` identifica al cliente piloto («cumplido por <prefijo>» y retailer que empieza por <prefijo>); vacío = nada es propio. */
export function subcanalDe(raw, prefijo = prefijoPropio()) {
  const k = lim(raw), p = lim(prefijo), cumple = (x) => k.includes('fulfilled by ' + x);
  if (!k) return 'sin_retailer';
  if (k.startsWith('amazon')) return p && cumple(p) ? 'amazon_cumplido_por_piloto' : cumple('amazon') ? 'amazon_cumplido_por_amazon' : k.includes('amazon.com') ? 'amazon_com' : 'amazon_sin_subcanal';
  if (k.startsWith('walmart')) return p && cumple(p) ? 'walmart_cumplido_por_piloto' : cumple('walmart') ? 'walmart_cumplido_por_walmart' : 'walmart_sin_subcanal';
  if (k.startsWith('best buy')) return 'bestbuy';
  if (p && k.startsWith(p)) return 'tienda';
  if (k.startsWith('lowe')) return 'lowes';
  if (k.startsWith('home depot')) return 'homedepot';
  if (k === 'pending') return 'pendiente';
  return 'otro';
}
/** Retailer base de un subcanal (para comparar con retailerDe: «pendiente» equivale a «otro» ahí). */
export const baseDeSubcanal = (c) => (c.startsWith('amazon') ? 'amazon' : c.startsWith('walmart') ? 'walmart' : c === 'sin_retailer' ? null : c === 'pendiente' ? 'otro' : c);
export function bodegaDe(raw) {
  const w = String(raw ?? '').trim().toUpperCase();
  if (!w) return null;
  if (w.startsWith('BODEGAB-')) return w.replace(/\s+/g, '');
  if (w.startsWith('BODEGAA')) return 'BODEGAA USA Inc';
  if (w.startsWith('BODEGAC')) return 'Bodegac';
  if (w.startsWith('BODEGAD')) return 'Bodegad';
  if (w.startsWith('BODEGAE')) return 'Bodegae Canada';
  return 'otra';
}
/** Latencia de DESPACHO (cuánto tardó en salir el rastreo) desde el texto de «SLA Status». Sin número legible = sin_dato (nunca cero). */
export function latenciaDe(raw, bodega = 'x') {
  if (!bodega) return null;
  const s = lim(raw);
  let h = null;
  if (/(same day|mismo d[ií]a)/.test(s)) h = 0;
  else { const m = /([0-9]+)\s*(?:horas?|hours?|hrs?)(?![a-z])/.exec(s); const d = /([0-9]+)\s*(?:d[ií]as?|days?)/.exec(s); if (m) h = Number(m[1]); else if (d) h = Number(d[1]) * 24; }
  return h === null ? 'sin_dato' : h < 24 ? 'menos_de_1_dia' : h < 48 ? '1_dia' : h < 72 ? '2_dias' : '3_o_mas_dias';
}
export function defectoDe(reason, sub) {
  const rs = lim(reason), sb = lim(sub);
  if (rs === 'defective') return 'defectuoso';
  if (sb.startsWith('damaged')) return 'danado';
  if (rs === 'missing parts' || sb.startsWith('missing parts')) return 'faltan_piezas';
  if (sb === 'wrong item received' || rs === 'wrong item was sent') return 'articulo_equivocado';
  return null;
}
export const skuBaseDe = normalizarSku;
export const hojaDeTracker = (sheet) => (['Warranty Tools', 'Warranty Parts'].includes(sheet) ? 'garantia' : ['Refunds', 'Refunds Requests'].includes(sheet) ? 'reembolso' : sheet === 'Return Labels' ? 'etiqueta_devolucion' : sheet === 'Waitlist' ? 'lista_espera' : 'otro');

// ---- lo que falta, con a quién pedirlo (Responsable A = director de cliente; Responsable B = reportes y exportaciones) ----
export const FALTAN = Object.freeze({
  A: [{clave: 'unidades', quien: 'responsable_b'}, {clave: 'resenas', quien: 'responsable_b'}, {clave: 'skuBestBuyShopify', quien: 'responsable_b'}],
  B: [{clave: 'inventario', quien: 'responsable_a'}, {clave: 'estadoProducto', quien: 'responsable_a'}, {clave: 'recurrencia', quien: 'responsable_a'}],
  C: [{clave: 'transportista', quien: 'responsable_b'}, {clave: 'entregaFecha', quien: 'responsable_b'}, {clave: 'denominadorEnvios', quien: 'responsable_b'}, {clave: 'vinculoQuejaEnvio', quien: 'responsable_a'}],
  D: [{clave: 'destinoPedido', quien: 'responsable_b'}, {clave: 'bodegaEstado', quien: 'responsable_a'}],
  E: [{clave: 'propiedadRetailer', quien: 'responsable_a'}, {clave: 'cumplimientoPedido', quien: 'responsable_b'}, {clave: 'proveedorDirecto', quien: 'responsable_a'}, {clave: 'tarifasAmazon', quien: 'responsable_a'}],
  F: [{clave: 'propiedadRetailer', quien: 'responsable_a'}, {clave: 'cumplimientoPedido', quien: 'responsable_b'}, {clave: 'facturasTransportista', quien: 'responsable_a'}, {clave: 'tarifasAmazon', quien: 'responsable_a'}, {clave: 'bodegaOrigen', quien: 'responsable_b'}],
});
/** Mismos textos que `cco.falta.*` en español de la interfaz (una prueba verifica que no se desalinean). El agente responde en español. */
export const FALTAN_ES = Object.freeze({
  unidades: 'Cantidad vendida por línea en los reportes de pedidos de cada marketplace.', resenas: 'Exportación de reseñas de producto por marketplace.', skuBestBuyShopify: 'SKU en los pedidos de Best Buy y de Shopify.',
  inventario: 'Existencias por SKU y bodega, desde NetSuite o las bodegas.', estadoProducto: 'Catálogo de productos con estado, activo o descontinuado.', recurrencia: 'Identidad estable del comprador en los pedidos, si el marketplace la entrega.',
  transportista: 'Transportista de cada envío, por ejemplo desde los envíos de Speedship.', entregaFecha: 'Fecha de entrega y eventos de entrega por envío.', denominadorEnvios: 'Total de envíos por bodega para poder calcular tasas.',
  vinculoQuejaEnvio: 'Vínculo entre cada queja y el envío al que pertenece.', destinoPedido: 'Estado y código postal de destino de cada pedido de Amazon, Walmart, Best Buy y Shopify.', bodegaEstado: 'Tabla de bodega a estado, confirmada por el cliente.',
  propiedadRetailer: 'Propiedad Retailer de los tickets de HubSpot, con permiso de lectura de tickets.', cumplimientoPedido: 'Tipo de cumplimiento de cada pedido, propio o de Amazon.', proveedorDirecto: 'Ventas de Amazon como proveedor directo, desde el portal de proveedor.',
  tarifasAmazon: 'Reporte de tarifas, comisiones y cumplimiento de Amazon.', facturasTransportista: 'Facturas o tarifas de FedEx y UPS.', bodegaOrigen: 'Bodega de origen de cada pedido de venta.',
});
export const QUIEN_ES = Object.freeze({responsable_a: 'Responsable A', responsable_b: 'Responsable B'});
/** «Texto. Pedir a Responsable A.» para cada dato que falta de una pregunta. */
export const faltanTexto = (id) => FALTAN[id].map((x) => `${FALTAN_ES[x.clave]} Pedir a ${QUIEN_ES[x.quien]}.`);
export const faltanDe = (id) => FALTAN[id].map((x) => ({...x}));

// ---- lectura acotada ----
const num = (x) => (x === null || x === undefined ? null : Number(x));
const dia = (x) => (x === null || x === undefined ? null : x instanceof Date ? x.toISOString().slice(0, 10) : String(x).slice(0, 10));
/** Una consulta en SAVEPOINT con tope de tiempo. {rows} | {error:'not_installed'|'unavailable'}; jamás un cero por un fallo. */
async function leer(s, deadline, name, sql, params = []) {
  const left = deadline - Date.now();
  if (left < 50) return {error: 'unavailable'};
  const previous = (await s.query("SELECT current_setting('statement_timeout') AS v")).rows[0]?.v ?? '0';
  await s.query('SAVEPOINT ' + name);
  await s.query("SELECT set_config('statement_timeout',$1,true)", [Math.ceil(left) + 'ms']);
  try {
    const r = await s.query(sql, params);
    await s.query("SELECT set_config('statement_timeout',$1,true)", [previous]);
    await s.query('RELEASE SAVEPOINT ' + name);
    return {rows: r.rows};
  } catch (e) {
    await s.query('ROLLBACK TO SAVEPOINT ' + name);
    await s.query("SELECT set_config('statement_timeout',$1,true)", [previous]);
    await s.query('RELEASE SAVEPOINT ' + name);
    return {error: e?.code === '42883' ? 'not_installed' : 'unavailable'};
  }
}
const celda = (r) => ({d1: r.d1, d2: r.d2, n: Number(r.n), otros: Boolean(r.es_otros)});

/** Lectura cruda de los agregados. Cada parte es {rows}|{error}. */
export async function leerAgregadosCco(s, {deadline}) {
  // El prefijo del cliente piloto llega a las funciones SQL por la configuración de sesión (local a la transacción); vacío = nada es propio.
  await s.query("SELECT set_config('vexa.tienda_propia_prefijo',$1,true)", [prefijoPropio()]);
  const q = (name, sql, params) => leer(s, deadline, name, sql, params);
  const [ventanas, skuCanal, sinVenta, defecto, hoja, subcanal, bodLat, bodMot, cob] = [
    await q('cco_v', 'SELECT * FROM public.insight_cco_ventanas()'),
    await q('cco_s', 'SELECT * FROM public.insight_cco_sku_canal(NULL)'),
    await q('cco_n', 'SELECT * FROM public.insight_cco_sin_venta()'),
    await q('cco_t1', "SELECT * FROM public.insight_cco_tracker_casos('sku_defecto',5)"),
    await q('cco_t2', "SELECT * FROM public.insight_cco_tracker_casos('sku_hoja',5)"),
    await q('cco_t3', "SELECT * FROM public.insight_cco_tracker_casos('subcanal',5)"),
    await q('cco_b1', "SELECT * FROM public.insight_cco_bodega('latencia',5)"),
    await q('cco_b2', "SELECT * FROM public.insight_cco_bodega('motivo',5)"),
    await q('cco_c', 'SELECT * FROM public.insight_cco_cobertura()'),
  ];
  return {ventanas, skuCanal, sinVenta, defecto, hoja, subcanal, bodLat, bodMot, cob};
}

const estadoDe = (ok, sal) => (!ok ? 'falta' : sal ? 'salvedad' : 'listo');
const pct = (a, b) => (b > 0 ? Math.round((a * 1000) / b) / 10 : null);
const mesesDe = (v) => ({desde: dia(v.month_from ?? v.desde), hasta: v.hasta ?? dia(v.month_to), meses: Number(v.months ?? v.meses)});

/** Tarjeta A: rendimiento por SKU y canal dentro de la ventana común. */
export function tarjetaA(raw) {
  const base = {id: 'A', clase: 'observed', fuente: 'libro', faltan: faltanDe('A'), salvedades: ['sinUnidades', 'sinResenas', 'defectosMuestra']};
  if (raw.skuCanal.error || raw.ventanas.error) return {...base, estado: 'falta', indisponible: raw.skuCanal.error ?? raw.ventanas.error, canales: [], cobertura: []};
  const vent = raw.ventanas.rows, filas = raw.skuCanal.rows;
  const defectoPorSku = new Map(), hojaPorSku = new Map();
  if (!raw.defecto.error) for (const c of raw.defecto.rows.map(celda)) if (!c.otros) { const m = defectoPorSku.get(c.d1) ?? {total: 0, porClase: {}}; m.total += c.n; m.porClase[c.d2] = c.n; defectoPorSku.set(c.d1, m); }
  if (!raw.hoja.error) for (const c of raw.hoja.rows.map(celda)) if (!c.otros) { const m = hojaPorSku.get(c.d1) ?? {}; m[c.d2] = c.n; hojaPorSku.set(c.d1, m); }
  const trackerOk = !raw.defecto.error && !raw.hoja.error;
  const canales = [];
  for (const v of vent) {
    const w = {desde: dia(v.month_from), hasta: dia(v.month_to), meses: Number(v.months), completa: Boolean(v.complete), ordenesDesde: dia(v.orders_from), ordenesHasta: dia(v.orders_to), devolucionesDesde: dia(v.refunds_from), devolucionesHasta: dia(v.refunds_to)};
    const del = filas.filter((f) => f.channel === v.channel);
    const conSku = del.filter((f) => f.sku_base !== ''), sinSku = del.filter((f) => f.sku_base === '');
    const lineas = del.reduce((a, f) => a + Number(f.order_lines), 0), lineasSku = conSku.reduce((a, f) => a + Number(f.order_lines), 0);
    const refTot = v.refunds_available ? del.reduce((a, f) => a + Number(f.refund_n ?? 0), 0) : null, refSku = v.refunds_available ? conSku.reduce((a, f) => a + Number(f.refund_n ?? 0), 0) : null;
    const monedas = [...new Set(del.map((f) => f.currency))].sort();
    const porMoneda = monedas.map((cur) => {
      const f = conSku.filter((x) => x.currency === cur).map((x) => ({
        sku: x.sku_base, lineas: Number(x.order_lines), brutoMinor: String(x.order_gross_minor), exponente: Number(x.exponent), reembolsos: num(x.refund_n), reembolsosSinImporte: num(x.refund_n_unknown_amount),
        reembolsoMinor: x.refund_amount_minor === null ? null : String(x.refund_amount_minor), porCien: num(x.refunds_per_100_lines),
        defectos: trackerOk ? (defectoPorSku.get(x.sku_base)?.total ?? null) : null, defectosClase: defectoPorSku.get(x.sku_base)?.porClase ?? null, hojas: hojaPorSku.get(x.sku_base) ?? null,
      })).sort((a, b) => (BigInt(b.brutoMinor) > BigInt(a.brutoMinor) ? 1 : BigInt(b.brutoMinor) < BigInt(a.brutoMinor) ? -1 : a.sku.localeCompare(b.sku)));
      const totalBruto = f.reduce((a, x) => a + BigInt(x.brutoMinor), 0n);
      return {moneda: cur, exponente: f[0]?.exponente ?? 2, skus: f.length, totalBrutoMinor: String(totalBruto), top: f.slice(0, 15)};
    });
    canales.push({canal: v.channel, ventana: w, devolucionesDisponibles: Boolean(v.refunds_available), lineas, lineasConSku: lineasSku, devoluciones: refTot, devolucionesConSku: refSku,
      lineasSinSku: sinSku.reduce((a, f) => a + Number(f.order_lines), 0), monedas: porMoneda});
  }
  const conVentana = canales.filter((c) => c.ventana.meses > 0);
  const cobertura = [];
  const L = conVentana.reduce((a, c) => a + c.lineas, 0), LS = conVentana.reduce((a, c) => a + c.lineasConSku, 0);
  if (L > 0) cobertura.push({clave: 'lineasConSku', conocido: LS, elegible: L, pct: pct(LS, L)});
  const R = conVentana.filter((c) => c.devoluciones !== null).reduce((a, c) => a + c.devoluciones, 0), RS = conVentana.filter((c) => c.devolucionesConSku !== null).reduce((a, c) => a + c.devolucionesConSku, 0);
  if (R > 0) cobertura.push({clave: 'reembolsosConSku', conocido: RS, elegible: R, pct: pct(RS, R)});
  const ok = conVentana.some((c) => c.monedas.some((m) => m.skus > 0));
  return {...base, estado: estadoDe(ok, true), canales: conVentana, sinVentana: canales.filter((c) => c.ventana.meses === 0).map((c) => c.canal), cobertura, trackerDisponible: trackerOk,
    corte: conVentana.map((c) => c.ventana.ordenesHasta).filter(Boolean).sort().at(-1) ?? null, ventanasDistintas: new Set(conVentana.map((c) => `${c.ventana.desde}|${c.ventana.hasta}`)).size > 1};
}

/** Tarjeta B: señal inferida de SKU sin venta reciente (sin inventario, sin estado de descontinuado). */
export function tarjetaB(raw) {
  const base = {id: 'B', clase: 'inferred', fuente: 'libro', faltan: faltanDe('B'), salvedades: ['soloAmazonWalmart', 'otroCanalPuedeVender', 'sinInventario']};
  if (raw.sinVenta.error) return {...base, estado: 'falta', indisponible: raw.sinVenta.error, umbrales: [], top: []};
  const filas = raw.sinVenta.rows;
  if (!filas.length) return {...base, estado: 'falta', umbrales: [], top: [], total: 0};
  const total = Number(filas[0].skus_with_sales), ref = dia(filas[0].reference_month), hasta = dia(filas[0].data_through);
  const umbrales = [3, 6, 9].map((m) => ({meses: m, skus: filas.filter((f) => Number(f.months_without_sale) >= m).length}));
  const top = (m) => filas.filter((f) => Number(f.months_without_sale) >= m).map((f) => ({sku: f.sku_base, ultimoMes: dia(f.last_sale_month), mesesSinVenta: Number(f.months_without_sale), lineas9m: Number(f.lines_last_9m), canales: f.channels}))
    .sort((a, b) => b.lineas9m - a.lineas9m || a.mesesSinVenta - b.mesesSinVenta || a.sku.localeCompare(b.sku));
  return {...base, estado: 'salvedad', total, referencia: ref, corte: hasta, umbrales, top: {3: top(3).slice(0, 12), 6: top(6).slice(0, 12), 9: top(9).slice(0, 12)},
    cobertura: [{clave: 'skuConVenta', conocido: total, elegible: null}]};
}

/** Tarjeta C: bodegas. Solo latencia de despacho de reposiciones de garantía y etiquetas de devolución; sin transportista y sin denominador. */
export function tarjetaC(raw) {
  const base = {id: 'C', clase: 'observed', fuente: 'tracker', faltan: faltanDe('C'), salvedades: ['soloDespacho', 'sinTransportista', 'sinDenominador', 'celdasMinimo']};
  if (raw.bodLat.error || raw.cob.error) return {...base, estado: 'falta', indisponible: raw.bodLat.error ?? raw.cob.error, bodegas: []};
  const lat = raw.bodLat.rows.map(celda), mot = raw.bodMot.error ? [] : raw.bodMot.rows.map(celda);
  const c = raw.cob.rows[0];
  const conBodega = c ? Number(c.with_warehouse) : 0;
  if (!lat.length || conBodega === 0) return {...base, estado: 'falta', bodegas: [], cobertura: c ? [{clave: 'filasConBodega', conocido: conBodega, elegible: Number(c.rows_total)}] : []};
  const por = new Map();
  for (const x of lat) { if (x.otros) continue; const b = por.get(x.d1) ?? {bodega: x.d1, latencia: {}, motivos: {}, total: 0}; b.latencia[x.d2] = x.n; b.total += x.n; por.set(x.d1, b); }
  for (const x of mot) { if (x.otros) continue; const b = por.get(x.d1) ?? {bodega: x.d1, latencia: {}, motivos: {}, total: 0}; b.motivos[x.d2] = x.n; por.set(x.d1, b); }
  const bodegas = [...por.values()].sort((a, b) => b.total - a.total || a.bodega.localeCompare(b.bodega));
  const conLat = Number(c.with_latency);
  return {...base, estado: 'salvedad', bodegas, ocultos: lat.filter((x) => x.otros).reduce((a, x) => a + x.n, 0), corte: c.cutoff ? dia(c.cutoff) : null,
    cobertura: [{clave: 'latenciaConBodega', conocido: conLat, elegible: conBodega, pct: pct(conLat, conBodega)}]};
}

/** Tarjeta D: casos por estado desde las direcciones del Tracker (mapa). Sin volumen ni venta por destino. */
export function tarjetaD(geo) {
  const base = {id: 'D', clase: 'observed', fuente: 'tracker', faltan: faltanDe('D'), salvedades: ['sinVolumenDestino', 'sesgoCasos', 'celdasMinimo', 'sinDireccionTexto']};
  if (!geo || geo.status === 'unavailable') return {...base, estado: 'falta', indisponible: 'unavailable', estados: []};
  if (geo.status === 'empty' || !geo.cobertura) return {...base, estado: 'falta', estados: [], vacio: true};
  const c = geo.cobertura;
  return {...base, estado: 'salvedad', minimo: geo.minimoPorCelda ?? K_MIN, corte: dia(geo.generatedAt),
    cobertura: [{clave: 'direccionesLegibles', conocido: c.interpretables, elegible: c.conDireccion, pct: c.pctInterpretablesDeDireccion}],
    estados: (geo.estados ?? []).slice(0, 12).map((e) => ({clave: e.clave, nombre: e.nombre, pais: e.pais, n: e.n, tipos: e.tipos?.items?.slice(0, 3) ?? [], retailers: e.retailers?.items?.slice(0, 3) ?? []})), ocultos: geo.ocultos ?? null,
    pais: c.pais};
}

/** Tarjeta E: vender como vendedor de Amazon o directo. Falta dato; se muestra solo lo parcial (casos por subcanal) con el aviso de sesgo. */
export function tarjetaE(raw) {
  const base = {id: 'E', clase: 'observed', fuente: 'tracker', estado: 'falta', faltan: faltanDe('E'), salvedades: ['sesgoCasos', 'sinDenominadorVentas'], subcanales: []};
  if (raw.subcanal.error) return {...base, indisponible: raw.subcanal.error};
  const cs = raw.subcanal.rows.map(celda);
  return {...base, subcanales: cs.filter((x) => !x.otros && ['amazon_cumplido_por_piloto', 'amazon_cumplido_por_amazon', 'amazon_com', 'amazon_sin_subcanal', 'walmart_cumplido_por_piloto', 'walmart_cumplido_por_walmart', 'walmart_sin_subcanal'].includes(x.d1)).map((x) => ({subcanal: x.d1, n: x.n})).sort((a, b) => b.n - a.n),
    corte: raw.cob.error ? null : (raw.cob.rows[0]?.cutoff ? dia(raw.cob.rows[0].cutoff) : null)};
}
/** Tarjeta F: desde dónde enviar. Siempre falta dato; nada que sostenga una decisión. */
export const tarjetaF = () => ({id: 'F', estado: 'falta', clase: null, fuente: null, faltan: faltanDe('F'), salvedades: [], noData: true});

export function armarCco(raw, geo, {now = new Date()} = {}) {
  const todoCaido = [raw.ventanas, raw.skuCanal, raw.sinVenta, raw.bodLat, raw.cob].every((p) => p.error === 'not_installed');
  const cards = {A: tarjetaA(raw), B: tarjetaB(raw), C: tarjetaC(raw), D: tarjetaD(geo), E: tarjetaE(raw), F: tarjetaF()};
  return {version: CCO_VERSION, generatedAt: now.toISOString(), class: 'observed', status: todoCaido ? 'not_installed' : 'ok', cards, minimoPorCelda: K_MIN,
    resumen: {listo: Object.values(cards).filter((c) => c.estado === 'listo').length, salvedad: Object.values(cards).filter((c) => c.estado === 'salvedad').length, falta: Object.values(cards).filter((c) => c.estado === 'falta').length}};
}

export function createCcoRepository({database, now = () => new Date(), budgets = CCO_BUDGET_MS}) {
  const geoRepo = createGeoMapRepository({database, now, budgets: {tracker: budgets.geo}});
  return {
    async get() {
      const hoy = now();
      const raw = await database.transaction('read', (s) => leerAgregadosCco(s, {deadline: Date.now() + budgets.total}));
      const geo = await geoRepo.get().catch(() => null);
      return armarCco(raw, geo, {now: hoy});
    },
    async raw() { return database.transaction('read', (s) => leerAgregadosCco(s, {deadline: Date.now() + budgets.total})); },
    geo: () => geoRepo.get().catch(() => null),
  };
}
