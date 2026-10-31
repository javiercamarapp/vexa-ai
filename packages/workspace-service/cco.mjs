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
// ---- catálogo de bodegas: configuración externa (nunca en el repo) ----
// Los nombres reales de las bodegas del cliente NO viven aquí. Se cargan de VEXA_CCO_CATALOGO, un JSON {"bodegas": [{"prefijo", "etiqueta", "sufijoLibre"}]}:
//   prefijo      texto con el que empieza el valor de la columna de bodega (se compara en mayúsculas, sin distinguir mayúsculas de minúsculas); ASCII A-Z 0-9 espacio _ . -, de 2 a 40 caracteres.
//   etiqueta     nombre con el que se muestra la bodega (hasta 60 caracteres). Obligatoria salvo con sufijoLibre.
//   sufijoLibre  true = la bodega conserva el valor completo del Tracker sin espacios (p. ej. una familia de bodegas «PREFIJO-XXXX» donde cada sufijo es una bodega distinta); no lleva etiqueta.
// Gana la primera entrada que coincide. Una entrada inválida se ignora entera; JSON roto o sin la variable = catálogo vacío. Con catálogo vacío todo valor distinto de vacío sale «otra»: jamás se asigna en silencio.
export const BODEGA_OTRA = 'otra';
const MAX_BODEGAS = 50;
const PREFIJO_OK = /^[A-Z0-9 _.\-]{2,40}$/;
const ETIQUETA_OK = /^[^\u0000-\u001f\u007f]{1,60}$/u;
let cacheCatalogo = {crudo: undefined, valor: Object.freeze([])};
/** Catálogo vigente (lista inmutable de {prefijo, etiqueta, sufijoLibre}). Se relee de VEXA_CCO_CATALOGO en cada llamada (las pruebas lo fijan antes de usarlo); el análisis se reutiliza mientras el texto no cambie. */
export function catalogoBodegas(env = globalThis.process?.env) {
  const crudo = env?.VEXA_CCO_CATALOGO;
  if (crudo === cacheCatalogo.crudo) return cacheCatalogo.valor;
  const lista = [];
  let j = null;
  if (typeof crudo === 'string' && crudo.trim()) { try { j = JSON.parse(crudo); } catch { j = null; } }
  const entradas = j && typeof j === 'object' && !Array.isArray(j) && Array.isArray(j.bodegas) ? j.bodegas.slice(0, MAX_BODEGAS * 2) : [];
  for (const e of entradas) {
    if (lista.length >= MAX_BODEGAS) break;
    if (!e || typeof e !== 'object' || Array.isArray(e) || typeof e.prefijo !== 'string') continue;
    const prefijo = e.prefijo.trim().toUpperCase();
    if (!PREFIJO_OK.test(prefijo) || lista.some((x) => x.prefijo === prefijo)) continue;
    const sufijoLibre = e.sufijoLibre === true;
    if (e.sufijoLibre !== undefined && typeof e.sufijoLibre !== 'boolean') continue;
    let etiqueta = null;
    if (!sufijoLibre) { if (typeof e.etiqueta !== 'string' || !ETIQUETA_OK.test(e.etiqueta.trim()) || !e.etiqueta.trim() || e.etiqueta.trim().toLowerCase() === BODEGA_OTRA) continue; etiqueta = e.etiqueta.trim(); }
    lista.push(Object.freeze({prefijo, etiqueta, sufijoLibre}));
  }
  cacheCatalogo = {crudo, valor: Object.freeze(lista)};
  return cacheCatalogo.valor;
}
/** Catálogo ya validado, en la forma compacta que leen las funciones SQL por sesión (vexa.cco_catalogo_bodegas): [{"p": prefijo, "e": etiqueta|null, "l": sufijoLibre}]. «[]» si está vacío. */
export const catalogoBodegasJson = (env = globalThis.process?.env) => JSON.stringify(catalogoBodegas(env).map((b) => ({p: b.prefijo, e: b.etiqueta, l: b.sufijoLibre})));
/** Etiquetas cerradas que puede devolver bodegaDe con el catálogo vigente (más «otra»). Las entradas de sufijo libre no se enumeran: su valor sale del Tracker. */
export const bodegasConocidas = (env = globalThis.process?.env) => [...catalogoBodegas(env).filter((b) => !b.sufijoLibre).map((b) => b.etiqueta), BODEGA_OTRA];
/** Bodega de la columna WH/Warehouse del Tracker: null si está vacía, la etiqueta del catálogo si coincide, «otra» si no (sin catálogo, siempre «otra»). */
export function bodegaDe(raw, catalogo = catalogoBodegas()) {
  const w = String(raw ?? '').trim().toUpperCase();
  if (!w) return null;
  for (const b of catalogo) if (w.startsWith(b.prefijo)) return b.sufijoLibre ? w.replace(/\s+/g, '') : b.etiqueta;
  return BODEGA_OTRA;
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

// ---- modalidad (preguntas E y F): quién vende, de qué bodega sale y qué marketplace, derivada del campo Retailer ----
// Tres ejes. «vende»: la empresa (vende a través del marketplace) o el marketplace (compra a la empresa y vende como vendedor). «bodega»: de dónde sale la mercancía, empresa o marketplace.
// «marketplace»: Amazon o Walmart. Walmart no compra producto de la empresa: solo se vende a través de Walmart, así que su eje «vende» siempre es la empresa y solo varía la bodega.
// La tabla de equivalencias es genérica (sin marcas): el subcanal «cumplido por piloto» ya sale de la configuración externa del prefijo de la marca (VEXA_TIENDA_PROPIA_PREFIJO).
// Se puede reemplazar sin tocar el repo con VEXA_CCO_MODALIDADES, un JSON {subcanal: {vende, bodega, marketplace}}; una entrada inválida se ignora entera.
// Un valor que la tabla no conoce NUNCA se asigna en silencio: sale «sin_dato» en los tres ejes.
export const SIN_DATO = 'sin_dato';
export const EJES_MODALIDAD = Object.freeze(['vende', 'bodega', 'marketplace']);
export const VALORES_EJE = Object.freeze({vende: ['empresa', 'marketplace'], bodega: ['empresa', 'marketplace'], marketplace: ['amazon', 'walmart']});
export const MODALIDADES_BASE = Object.freeze({
  amazon_cumplido_por_piloto: Object.freeze({vende: 'empresa', bodega: 'empresa', marketplace: 'amazon'}),
  amazon_cumplido_por_amazon: Object.freeze({vende: 'empresa', bodega: 'marketplace', marketplace: 'amazon'}),
  amazon_com: Object.freeze({vende: 'marketplace', bodega: 'marketplace', marketplace: 'amazon'}),
  amazon_sin_subcanal: Object.freeze({vende: null, bodega: null, marketplace: 'amazon'}),
  walmart_cumplido_por_piloto: Object.freeze({vende: 'empresa', bodega: 'empresa', marketplace: 'walmart'}),
  walmart_cumplido_por_walmart: Object.freeze({vende: 'empresa', bodega: 'marketplace', marketplace: 'walmart'}),
  walmart_sin_subcanal: Object.freeze({vende: 'empresa', bodega: null, marketplace: 'walmart'}),
});
const tiene = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
/** Tabla vigente: la base más la anulación externa válida. Una entrada con un subcanal ajeno al catálogo, o con un valor fuera de su eje, se descarta completa. */
export function tablaModalidades(env = globalThis.process?.env) {
  const tabla = {...MODALIDADES_BASE}, crudo = env?.VEXA_CCO_MODALIDADES;
  if (!crudo) return tabla;
  let j;
  try { j = JSON.parse(crudo); } catch { return tabla; }
  if (!j || typeof j !== 'object' || Array.isArray(j)) return tabla;
  for (const [sub, m] of Object.entries(j)) {
    if (!tiene(MODALIDADES_BASE, sub) || !SUBCANALES.includes(sub) || !m || typeof m !== 'object' || Array.isArray(m)) continue;
    const fila = {};
    let valida = true;
    for (const eje of EJES_MODALIDAD) { const v = m[eje]; if (v === undefined || v === null || v === SIN_DATO) fila[eje] = null; else if (VALORES_EJE[eje].includes(v)) fila[eje] = v; else valida = false; }
    if (valida) tabla[sub] = Object.freeze(fila);
  }
  return tabla;
}
/** Modalidad de un subcanal. Subcanal fuera de la tabla -> sin_dato en los tres ejes y `conocida:false`. */
export function modalidadDeSubcanal(sub, tabla = tablaModalidades()) {
  const f = typeof sub === 'string' && tiene(tabla, sub) ? tabla[sub] : null;
  if (!f) return {vende: SIN_DATO, bodega: SIN_DATO, marketplace: SIN_DATO, conocida: false};
  return {vende: f.vende ?? SIN_DATO, bodega: f.bodega ?? SIN_DATO, marketplace: f.marketplace ?? SIN_DATO, conocida: true};
}
/** Modalidad directa desde el texto del campo Retailer (tracker o propiedad de ticket). */
export const modalidadDe = (raw, prefijo = prefijoPropio(), tabla = tablaModalidades()) => modalidadDeSubcanal(subcanalDe(raw, prefijo), tabla);
const esMarketplaceSub = (c) => typeof c === 'string' && (c.startsWith('amazon') || c.startsWith('walmart'));

// ---- lo que falta, con a quién pedirlo (operaciones = responsable de operaciones del cliente; datos = responsable de datos del cliente: reportes y exportaciones). Roles, nunca nombres de personas. ----
export const FALTAN = Object.freeze({
  A: [{clave: 'unidades', quien: 'datos'}, {clave: 'resenas', quien: 'datos'}, {clave: 'skuBestBuyShopify', quien: 'datos'}],
  B: [{clave: 'inventario', quien: 'operaciones'}, {clave: 'estadoProducto', quien: 'operaciones'}, {clave: 'recurrencia', quien: 'operaciones'}],
  C: [{clave: 'transportista', quien: 'datos'}, {clave: 'entregaFecha', quien: 'datos'}, {clave: 'denominadorEnvios', quien: 'datos'}, {clave: 'vinculoQuejaEnvio', quien: 'operaciones'}],
  D: [{clave: 'destinoPedido', quien: 'datos'}, {clave: 'bodegaEstado', quien: 'operaciones'}],
  E: [{clave: 'propiedadRetailer', quien: 'operaciones'}, {clave: 'ventaPorModalidad', quien: 'datos'}, {clave: 'cumplimientoPedido', quien: 'datos'}, {clave: 'proveedorDirecto', quien: 'operaciones'}, {clave: 'tarifasAmazon', quien: 'operaciones'}, {clave: 'costoCumplimiento', quien: 'operaciones'}, {clave: 'costoSku', quien: 'operaciones'}, {clave: 'tiempoResolucion', quien: 'datos'}],
  F: [{clave: 'propiedadRetailer', quien: 'operaciones'}, {clave: 'ventaPorModalidad', quien: 'datos'}, {clave: 'cumplimientoPedido', quien: 'datos'}, {clave: 'facturasTransportista', quien: 'operaciones'}, {clave: 'costoCumplimiento', quien: 'operaciones'}, {clave: 'tarifasAmazon', quien: 'operaciones'}, {clave: 'bodegaOrigen', quien: 'datos'}, {clave: 'tiempoResolucion', quien: 'datos'}],
});
/** Mismos textos que `cco.falta.*` en español de la interfaz (una prueba verifica que no se desalinean). El agente responde en español. */
export const FALTAN_ES = Object.freeze({
  unidades: 'Cantidad vendida por línea en los reportes de pedidos de cada marketplace.', resenas: 'Exportación de reseñas de producto por marketplace.', skuBestBuyShopify: 'SKU en los pedidos de Best Buy y de Shopify.',
  inventario: 'Existencias por SKU y bodega, desde NetSuite o las bodegas.', estadoProducto: 'Catálogo de productos con estado, activo o descontinuado.', recurrencia: 'Identidad estable del comprador en los pedidos, si el marketplace la entrega.',
  transportista: 'Transportista de cada envío, por ejemplo desde los envíos de Speedship.', entregaFecha: 'Fecha de entrega y eventos de entrega por envío.', denominadorEnvios: 'Total de envíos por bodega para poder calcular tasas.',
  vinculoQuejaEnvio: 'Vínculo entre cada queja y el envío al que pertenece.', destinoPedido: 'Estado y código postal de destino de cada pedido de Amazon, Walmart, Best Buy y Shopify.', bodegaEstado: 'Tabla de bodega a estado, confirmada por el cliente.',
  propiedadRetailer: 'Propiedad Retailer de los tickets de HubSpot, con permiso de lectura de tickets.', cumplimientoPedido: 'Tipo de cumplimiento de cada pedido, propio o de Amazon.', proveedorDirecto: 'Ventas de Amazon como proveedor directo, desde el portal de proveedor.',
  tarifasAmazon: 'Reporte de tarifas, comisiones y cumplimiento de Amazon.', facturasTransportista: 'Facturas o tarifas de FedEx y UPS.', bodegaOrigen: 'Bodega de origen de cada pedido de venta.',
  ventaPorModalidad: 'Venta por SKU y por modalidad: pedidos de Amazon y Walmart con quién vende y de qué bodega sale.', costoCumplimiento: 'Costo de cumplimiento por unidad: tarifas del marketplace y costo de operar la bodega propia.',
  costoSku: 'Costo por SKU, para poder calcular el margen de cada modalidad.', tiempoResolucion: 'Fechas de creación y de cierre de cada ticket, para medir el tiempo de resolución por modalidad.',
});
export const QUIEN_ES = Object.freeze({operaciones: 'al responsable de operaciones del cliente', datos: 'al responsable de datos del cliente'});
/** English of FALTAN_ES (same keys; mirrors `cco.falta.*` in the interface dictionary). */
export const FALTAN_EN = Object.freeze({
  unidades: 'Quantity sold per line in each marketplace order report.',
  resenas: 'Product review export per marketplace.',
  skuBestBuyShopify: 'SKU in the Best Buy and Shopify orders.',
  inventario: 'Stock per SKU and warehouse, from NetSuite or the warehouses.',
  estadoProducto: 'Product catalog with status, active or discontinued.',
  recurrencia: 'A stable buyer identity in orders, if the marketplace provides it.',
  transportista: 'Carrier of each shipment, for example from the Speedship shipments.',
  entregaFecha: 'Delivery date and delivery events per shipment.',
  denominadorEnvios: 'Total shipments per warehouse so that rates can be calculated.',
  vinculoQuejaEnvio: 'A link between each complaint and the shipment it belongs to.',
  destinoPedido: 'Destination state and postal code of each Amazon, Walmart, Best Buy and Shopify order.',
  bodegaEstado: 'A warehouse to state table, confirmed by the client.',
  propiedadRetailer: 'The Retailer property of HubSpot tickets, with ticket read permission.',
  cumplimientoPedido: 'Fulfillment type of each order, own or Amazon.',
  proveedorDirecto: 'Amazon sales as a direct supplier, from the vendor portal.',
  tarifasAmazon: 'Amazon fees, commissions and fulfillment report.',
  facturasTransportista: 'FedEx and UPS invoices or rate cards.',
  bodegaOrigen: 'Origin warehouse of each sales order.',
  ventaPorModalidad: 'Sales by SKU and by model: Amazon and Walmart orders showing who sells and which warehouse ships them.',
  costoCumplimiento: 'Fulfillment cost per unit: marketplace fees and the cost of running the own warehouse.',
  costoSku: 'Cost per SKU, so that the margin of each model can be calculated.',
  tiempoResolucion: 'Creation and close dates of each ticket, to measure resolution time by model.',
});
export const QUIEN_EN = Object.freeze({operaciones: "the client's operations lead", datos: "the client's data lead"});
/** «Texto. Pedir al responsable de operaciones del cliente.» para cada dato que falta de una pregunta (idioma 'es' por omisión; 'en' para la vista en inglés). */
export const faltanTexto = (id, idioma = 'es') => FALTAN[id].map((x) => (idioma === 'en' ? `${FALTAN_EN[x.clave]} Ask ${QUIEN_EN[x.quien]}.` : `${FALTAN_ES[x.clave]} Pedir ${QUIEN_ES[x.quien]}.`));
export const faltanDe = (id) => FALTAN[id].map((x) => ({...x}));
/** Lo que falta de una pregunta, en datos (claves y a quién) y en texto español listo para el agente; mismo contenido, una sola fuente. */
const faltanBase = (id) => ({faltan: faltanDe(id), faltanTextos: faltanTexto(id)});

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
  // Ídem el catálogo de bodegas (VEXA_CCO_CATALOGO, ya validado): sin él, toda bodega con valor sale «otra».
  await s.query("SELECT set_config('vexa.cco_catalogo_bodegas',$1,true)", [catalogoBodegasJson()]);
  const q = (name, sql, params) => leer(s, deadline, name, sql, params);
  const [ventanas, skuCanal, sinVenta, defecto, hoja, subcanal, bodLat, bodMot, cob, modalidad] = [
    await q('cco_v', 'SELECT * FROM public.insight_cco_ventanas()'),
    await q('cco_s', 'SELECT * FROM public.insight_cco_sku_canal(NULL)'),
    await q('cco_n', 'SELECT * FROM public.insight_cco_sin_venta()'),
    await q('cco_t1', "SELECT * FROM public.insight_cco_tracker_casos('sku_defecto',5)"),
    await q('cco_t2', "SELECT * FROM public.insight_cco_tracker_casos('sku_hoja',5)"),
    await q('cco_t3', "SELECT * FROM public.insight_cco_tracker_casos('subcanal',5)"),
    await q('cco_b1', "SELECT * FROM public.insight_cco_bodega('latencia',5)"),
    await q('cco_b2', "SELECT * FROM public.insight_cco_bodega('motivo',5)"),
    await q('cco_c', 'SELECT * FROM public.insight_cco_cobertura()'),
    await q('cco_m', 'SELECT * FROM public.insight_cco_modalidad_casos(5)'),
  ];
  return {ventanas, skuCanal, sinVenta, defecto, hoja, subcanal, bodLat, bodMot, cob, modalidad};
}

const estadoDe = (ok, sal) => (!ok ? 'falta' : sal ? 'salvedad' : 'listo');
const pct = (a, b) => (b > 0 ? Math.round((a * 1000) / b) / 10 : null);
const mesesDe = (v) => ({desde: dia(v.month_from ?? v.desde), hasta: v.hasta ?? dia(v.month_to), meses: Number(v.months ?? v.meses)});

/** Tarjeta A: rendimiento por SKU y canal dentro de la ventana común. */
export function tarjetaA(raw) {
  const base = {id: 'A', clase: 'observed', fuente: 'libro', ...faltanBase('A'), salvedades: ['sinUnidades', 'sinResenas', 'defectosMuestra']};
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
  const base = {id: 'B', clase: 'inferred', fuente: 'libro', ...faltanBase('B'), salvedades: ['soloAmazonWalmart', 'otroCanalPuedeVender', 'sinInventario']};
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
  const base = {id: 'C', clase: 'observed', fuente: 'tracker', ...faltanBase('C'), salvedades: ['soloDespacho', 'sinTransportista', 'sinDenominador', 'celdasMinimo']};
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
  const base = {id: 'D', clase: 'observed', fuente: 'tracker', ...faltanBase('D'), salvedades: ['sinVolumenDestino', 'sesgoCasos', 'celdasMinimo', 'sinDireccionTexto']};
  if (!geo || geo.status === 'unavailable') return {...base, estado: 'falta', indisponible: 'unavailable', estados: []};
  if (geo.status === 'empty' || !geo.cobertura) return {...base, estado: 'falta', estados: [], vacio: true};
  const c = geo.cobertura;
  return {...base, estado: 'salvedad', minimo: geo.minimoPorCelda ?? K_MIN, corte: dia(geo.generatedAt),
    cobertura: [{clave: 'direccionesLegibles', conocido: c.interpretables, elegible: c.conDireccion, pct: c.pctInterpretablesDeDireccion}],
    estados: (geo.estados ?? []).slice(0, 12).map((e) => ({clave: e.clave, nombre: e.nombre, pais: e.pais, n: e.n, tipos: e.tipos?.items?.slice(0, 3) ?? [], retailers: e.retailers?.items?.slice(0, 3) ?? []})), ocultos: geo.ocultos ?? null,
    pais: c.pais};
}

const celdaM = (r) => ({dim: r.dim, d1: r.d1, d2: r.d2, n: Number(r.n), otros: Boolean(r.es_otros)});
const suma = (xs) => (xs.length ? xs.reduce((a, x) => a + x, 0) : null);
const TOP_SKU = 15;
/**
 * Tarjetas E y F: la modalidad de venta (E, eje «vende») y la de envío (F, eje «bodega») sobre los mismos datos.
 * Lo que SÍ se mide son CASOS del Tracker (reembolsos, garantías, defectos y tiempo de despacho) por subcanal y por SKU: no son ventas, así que nunca hay un «conviene X».
 * Un conteo que no sale (celda con menos de 5 casos, o detalle no instalado) es null: «Menos de 5» o «Sin dato», jamás 0. Las sumas por SKU cuentan solo celdas visibles: son un mínimo.
 */
export function tarjetaModalidad(raw, id, {tabla = tablaModalidades()} = {}) {
  const eje = id === 'E' ? 'vende' : 'bodega';
  const base = {id, clase: 'observed', fuente: 'tracker', ...faltanBase(id), eje, puedeRecomendar: false, subcanales: [], ejes: [], skus: [],
    salvedades: id === 'E' ? ['sesgoCasos', 'sinDenominadorVentas', 'sinRecomendacion', 'sinTiempoResolucion', 'modalidadSinDato', 'celdasMinimo', 'sumaMinimo']
      : ['sesgoCasos', 'sinDenominadorVentas', 'sinRecomendacion', 'sinTiempoResolucion', 'walmartSoloBodega', 'modalidadSinDato', 'celdasMinimo', 'sumaMinimo']};
  if (!raw.subcanal || raw.subcanal.error) return {...base, estado: 'falta', indisponible: raw.subcanal?.error ?? 'unavailable'};
  const corte = raw.cob && !raw.cob.error && raw.cob.rows?.[0]?.cutoff ? dia(raw.cob.rows[0].cutoff) : null;
  const totales = raw.subcanal.rows.map(celda);
  const visibles = totales.filter((x) => !x.otros && esMarketplaceSub(x.d1)).sort((a, b) => b.n - a.n || a.d1.localeCompare(b.d1));
  if (!visibles.length) return {...base, estado: 'falta', corte, ocultos: totales.filter((x) => x.otros).reduce((a, x) => a + x.n, 0)};
  const det = raw.modalidad && !raw.modalidad.error ? raw.modalidad.rows.map(celdaM).filter((c) => !c.otros) : null;
  const dim = (d) => (det ? det.filter((c) => c.dim === d) : null);
  const tipo = dim('subcanal_tipo'), defecto = dim('subcanal_defecto'), despacho = dim('subcanal_despacho'), bodega = dim('subcanal_bodega');
  const subcanales = visibles.map((x) => {
    const m = modalidadDeSubcanal(x.d1, tabla), de = (celdas) => (celdas ? celdas.filter((c) => c.d1 === x.d1) : null);
    const t = de(tipo), df = de(defecto), ds = de(despacho), bd = de(bodega);
    const del = (hoja) => (t ? (t.find((c) => c.d2 === hoja)?.n ?? null) : null);
    const legibles = ds ? suma(ds.filter((c) => c.d2 !== 'sin_dato').map((c) => c.n)) : null;
    return {subcanal: x.d1, vende: m.vende, bodega: m.bodega, marketplace: m.marketplace, conocida: m.conocida, casos: x.n,
      reembolsos: del('reembolso'), garantias: del('garantia'), etiquetas: del('etiqueta_devolucion'), defectos: df ? suma(df.map((c) => c.n)) : null,
      despacho: ds ? {legibles, tresODias: ds.find((c) => c.d2 === '3_o_mas_dias')?.n ?? null} : null,
      bodegas: bd ? bd.map((c) => ({bodega: c.d2, n: c.n})).sort((a, b) => b.n - a.n || a.bodega.localeCompare(b.bodega)) : null};
  });
  const valores = [...VALORES_EJE[eje], SIN_DATO];
  const ejes = valores.map((v) => ({valor: v, casos: subcanales.filter((x) => x[eje] === v).reduce((a, x) => a + x.casos, 0)}));
  // Por SKU: cada celda (SKU, subcanal) cae en el grupo que dice su modalidad en este eje; lo desconocido va a sin_dato.
  const porSku = new Map();
  const grupo = (sku, v) => { const m = porSku.get(sku) ?? new Map(); porSku.set(sku, m); const g = m.get(v) ?? {casos: 0, reembolsos: null, defectos: null}; m.set(v, g); return g; };
  const skuSub = dim('sku_subcanal');
  if (skuSub) {
    for (const c of skuSub) if (esMarketplaceSub(c.d2)) grupo(c.d1, modalidadDeSubcanal(c.d2, tabla)[eje]).casos += c.n;
    for (const c of dim('sku_subcanal_tipo') ?? []) { const [sub, hoja] = String(c.d2).split('|'); if (hoja === 'reembolso' && esMarketplaceSub(sub)) { const g = grupo(c.d1, modalidadDeSubcanal(sub, tabla)[eje]); g.reembolsos = (g.reembolsos ?? 0) + c.n; } }
    for (const c of dim('sku_subcanal_defecto') ?? []) { const [sub] = String(c.d2).split('|'); if (esMarketplaceSub(sub)) { const g = grupo(c.d1, modalidadDeSubcanal(sub, tabla)[eje]); g.defectos = (g.defectos ?? 0) + c.n; } }
  }
  const skus = [...porSku.entries()].map(([sku, m]) => ({sku, grupos: Object.fromEntries(valores.map((v) => [v, m.get(v) ?? null])), casos: [...m.values()].reduce((a, g) => a + g.casos, 0)}))
    .sort((a, b) => b.casos - a.casos || a.sku.localeCompare(b.sku)).slice(0, TOP_SKU).map(({casos, ...r}) => r);
  const total = subcanales.reduce((a, x) => a + x.casos, 0), conocido = subcanales.filter((x) => x[eje] !== SIN_DATO).reduce((a, x) => a + x.casos, 0);
  const cobertura = [id === 'E' ? {clave: 'ejeVende', conocido, elegible: total, pct: pct(conocido, total)} : {clave: 'ejeBodega', conocido, elegible: total, pct: pct(conocido, total)}];
  return {...base, estado: 'salvedad', subcanales, ejes, skus, corte, cobertura, detalleIndisponible: det === null, ocultos: totales.filter((x) => x.otros).reduce((a, x) => a + x.n, 0), totalCasos: total};
}
/** Tarjeta E: vender a través del marketplace o venderle al marketplace (quién vende). Con casos reales «Con salvedad»; sin celdas visibles «Falta dato». */
export const tarjetaE = (raw, opciones) => tarjetaModalidad(raw, 'E', opciones);
/** Tarjeta F: enviar con medios propios o con el cumplimiento del marketplace (de qué bodega sale). */
export const tarjetaF = (raw, opciones) => tarjetaModalidad(raw, 'F', opciones);

export function armarCco(raw, geo, {now = new Date()} = {}) {
  const todoCaido = [raw.ventanas, raw.skuCanal, raw.sinVenta, raw.bodLat, raw.cob].every((p) => p.error === 'not_installed');
  const cards = {A: tarjetaA(raw), B: tarjetaB(raw), C: tarjetaC(raw), D: tarjetaD(geo), E: tarjetaE(raw), F: tarjetaF(raw)};
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
