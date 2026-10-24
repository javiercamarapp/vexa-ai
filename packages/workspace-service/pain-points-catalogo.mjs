// «Puntos de dolor» (L1): taxonomía P1–P12 y armado PURO de los puntos a partir de lecturas ya hechas (sin base de datos: se prueba con datos simulados).
// Reglas fijas: ingreso BRUTO (nunca margen); monedas separadas (jamás se suman); dato desconocido ≠ 0 (`sinDato` explícito, con su causa); una cifra = fuente + periodo + clase
// (O = observado, E = estimado con supuesto tecleado, I = inferido); sin PII (solo agregados). Chargebacks: NO hay fuente; el Tracker y los reembolsos pendientes de Walmart
// se rotulan como PROXY y nunca se llaman «chargeback».
import {ESTADOS_NEGADOS} from './fuga-reembolsos.mjs';

/** Seis temas fijos (orden = rejilla 3×2 del mapa). `c` = matiz fijo de la paleta de datos (--chart-n). */
export const TEMAS = Object.freeze([
  {id: 'devoluciones', nombre: 'Devoluciones y chargebacks', c: 2},
  {id: 'garantia', nombre: 'Garantía', c: 8},
  {id: 'logistica', nombre: 'Logística y servicio', c: 6},
  {id: 'canales', nombre: 'Canales', c: 1},
  {id: 'ubicaciones', nombre: 'Ubicaciones', c: 3},
  {id: 'sku', nombre: 'SKU', c: 4},
]);
export const CLASES = Object.freeze({O: 'observed', E: 'estimated', I: 'inferred'});
export const TOP_SKU = 8;
export const NOMBRE_CANAL_PP = Object.freeze({amazon: 'Amazon', walmart: 'Walmart', shopify: 'Shopify', bestbuy: 'Best Buy'});
const CANALES_PP = Object.freeze(['amazon', 'walmart', 'shopify', 'bestbuy']);

const big = v => BigInt(String(v ?? '0').split('.')[0] || '0');
/** Dinero bruto en unidades menores (string). `supuesta` = moneda no declarada en la fuente (se supone USD). */
export const dineroUsd = (minor, extra = {}) => ({sinDato: false, tipo: 'bruto', currency: 'USD', exponent: 2, minor: String(minor), ...extra});
/** Sin dato explícito: `causa` = sin_fuente (no existe el dato) | no_disponible (falló o agotó el tiempo) | no_aplica (esta medida no se expresa en dinero). */
export const sinDato = (causa, motivo) => ({sinDato: true, causa, motivo});
const vol = (n, unidad, extra = {}) => ({sinDato: false, n: Number(n), unidad, ...extra});

// ---- agregadores puros ----
/** rows = filas de insight_refund_by_sku_month (readRefundBySkuMonth().rows). Nunca suma monedas: las no-USD se listan aparte. */
export function agregarReembolsos(rows) {
  const otras = new Map(), canales = new Map(), skus = new Map();
  const tot = {n: 0, known: 0, cancelled: 0, gross: 0n, active: 0n};
  let desde = null, hasta = null;
  for (const r of rows ?? []) {
    const n = Number(r.n), known = Number(r.nKnown), canc = Number(r.nCancelled), gross = big(r.amountMinor), active = big(r.activeMinor);
    if (r.currency !== 'USD' || Number(r.exponent) !== 2) {
      const k = r.currency + ':' + r.exponent, o = otras.get(k) ?? {currency: r.currency, exponent: Number(r.exponent), n: 0, minor: 0n};
      o.n += n - canc; o.minor += active; otras.set(k, o); continue;
    }
    tot.n += n; tot.known += known; tot.cancelled += canc; tot.gross += gross; tot.active += active;
    if (r.month && (!desde || r.month < desde)) desde = r.month;
    if (r.month && (!hasta || r.month > hasta)) hasta = r.month;
    const c = canales.get(r.channel) ?? {canal: r.channel, n: 0, known: 0, cancelled: 0, gross: 0n, active: 0n, desde: null, hasta: null};
    c.n += n; c.known += known; c.cancelled += canc; c.gross += gross; c.active += active;
    if (!c.desde || r.month < c.desde) c.desde = r.month;
    if (!c.hasta || r.month > c.hasta) c.hasta = r.month;
    canales.set(r.channel, c);
    if (r.sku) {
      const s = skus.get(r.sku) ?? {sku: r.sku, n: 0, known: 0, cancelled: 0, gross: 0n, active: 0n, canales: {}};
      s.n += n; s.known += known; s.cancelled += canc; s.gross += gross; s.active += active; s.canales[r.channel] = (s.canales[r.channel] ?? 0) + n - canc; skus.set(r.sku, s);
    }
  }
  return {tot, canales, skus, otras: [...otras.values()], desde, hasta};
}
/** rows = filas de insight_order_revenue_month. Ingreso BRUTO por canal y SKU (USD) y cancelaciones por moneda. */
export function agregarOrdenes(rows) {
  const monedas = new Map(), canales = new Map(), skus = new Map();
  let desde = null, hasta = null;
  const tot = {n: 0, cancelled: 0, amount: 0n, cancelledMinor: 0n};
  for (const r of rows ?? []) {
    const n = Number(r.n), nc = Number(r.nCancelled), amount = big(r.amountMinor), canc = big(r.cancelledMinor);
    const k = r.currency + ':' + r.exponent, o = monedas.get(k) ?? {currency: r.currency, exponent: Number(r.exponent), n: 0, cancelled: 0, cancelledMinor: 0n};
    o.n += n; o.cancelled += nc; o.cancelledMinor += canc; monedas.set(k, o);
    if (r.currency !== 'USD' || Number(r.exponent) !== 2) continue;
    tot.n += n; tot.cancelled += nc; tot.amount += amount; tot.cancelledMinor += canc;
    if (r.month && (!desde || r.month < desde)) desde = r.month;
    if (r.month && (!hasta || r.month > hasta)) hasta = r.month;
    const c = canales.get(r.channel) ?? {canal: r.channel, n: 0, ingreso: 0n, desde: null, hasta: null};
    c.n += n; c.ingreso += amount - canc;
    if (!c.desde || r.month < c.desde) c.desde = r.month;
    if (!c.hasta || r.month > c.hasta) c.hasta = r.month;
    canales.set(r.channel, c);
    if (r.sku) { const s = skus.get(r.sku) ?? {sku: r.sku, ingreso: 0n, cancelledMinor: 0n}; s.ingreso += amount - canc; s.cancelledMinor += canc; skus.set(r.sku, s); }
  }
  return {tot, monedas: [...monedas.values()], canales, skus, desde, hasta};
}
/** Reembolsos negados o vencidos del Tracker (suma de los tres estados). Moneda NO declarada: se supone USD. */
export function agregarTracker(t) {
  if (!t) return null;
  const por = t.byStatus ?? {};
  let n = 0, nAmount = 0, minor = 0n;
  for (const e of ESTADOS_NEGADOS) { const o = por[e]; if (!o) continue; n += o.n; nAmount += o.nAmount; minor += big(o.amountMinor); }
  const total = t.total ?? Object.values(por).reduce((a, o) => a + o.n, 0);
  return {n, nAmount, minor, total, estados: Object.fromEntries(ESTADOS_NEGADOS.map(e => [e, por[e]?.n ?? 0]))};
}

const rango = (desde, hasta) => (desde ? {desde, hasta: hasta ?? desde} : null);
const nota = (partes) => partes.filter(Boolean);
const num = n => new Intl.NumberFormat('es-MX').format(n);

/**
 * Arma los puntos de dolor. Cada parte puede venir `null` (no se pudo leer: «no disponible ahora», nunca cero) o `{vacia:true}` (no calculada).
 * f = {tracker, walmart, reembolsos, ordenes, hilos, repetido, garantia}; ver pain-points.mjs para la forma de cada una.
 */
export function armarPuntos(f) {
  const puntos = [];
  const off = (_parte, texto) => sinDato('no_disponible', 'No disponible ahora (' + texto + '). No significa que no haya datos: reintenta en un momento.');
  const T = f.tracker ? agregarTracker(f.tracker.data) : null;
  const W = f.walmart, R = f.reembolsos ? agregarReembolsos(f.reembolsos.rows) : null, O = f.ordenes ? agregarOrdenes(f.ordenes.rows) : null;

  // ---------------- Devoluciones y chargebacks ----------------
  puntos.push({
    id: 'P1', tema: 'devoluciones', nombre: 'Reembolsos negados o vencidos (Tracker)', descripcion: 'Solicitudes de reembolso que el canal rechazó, venció (más de 180 días) o declaró no reembolsables.',
    padre: null, agregado: false,
    dinero: T ? (T.nAmount > 0 ? dineroUsd(T.minor, {supuesta: true}) : sinDato('sin_fuente', 'Ninguna solicitud negada trae monto.')) : off('tracker', 'Tracker'),
    volumen: T ? vol(T.n, 'solicitudes') : sinDato('no_disponible', 'No disponible ahora'),
    clase: 'O',
    cobertura: T ? {texto: `${num(T.n)} solicitudes negadas o vencidas de ${num(T.total)} del Tracker; ${num(T.nAmount)} con monto. Es una muestra del flujo caro, no el total de reembolsos.`, conMonto: T.nAmount, total: T.n} : null,
    fuente: {etiqueta: 'Tracker de Excel · hoja Refunds (última revisión por fila)', tabla: 'insight_tracker_refund_status'},
    periodo: null, corte: f.tracker?.meta?.sourceWatermark ?? null, actualizado: f.tracker?.meta?.refreshedAt ?? null,
    otrasMonedas: [], proxy: {de: 'P3', rotulo: 'Proxy observado: NO es un chargeback. Es lo que el Tracker registra como negado o vencido.'}, solapaCon: ['P4'],
    evidencia: {disponible: true, tipo: 'tracker'},
    calculo: ['Suma del monto de las solicitudes con estado vencido, no reembolsable o rechazado (hoja Refunds, última revisión de cada fila).', 'La moneda no viene en el Tracker: se supone USD y así se rotula.'],
    noSabemos: ['El Tracker no es el total de reembolsos: es una muestra.', `${num((T?.n ?? 0) - (T?.nAmount ?? 0))} solicitudes negadas no traen monto (cuentan, no suman).`],
    detalle: T ? {estados: T.estados} : null,
  });
  const wmOk = W && W.n > 0;
  puntos.push({
    id: 'P2', tema: 'devoluciones', nombre: 'Walmart: reembolsos pendientes de cerrar', descripcion: 'Reembolsos de Walmart en estado «pendiente»: dinero atorado por devoluciones que no se cierran a tiempo.',
    padre: null, agregado: false,
    dinero: W === null ? off('libro', 'libro de reembolsos') : wmOk ? dineroUsd(W.minor) : sinDato('sin_fuente', 'El libro no tiene reembolsos pendientes de Walmart.'),
    volumen: W === null ? sinDato('no_disponible', 'No disponible ahora') : vol(W?.n ?? 0, 'reembolsos'),
    clase: 'O',
    cobertura: wmOk ? {texto: `${num(W.n)} reembolsos pendientes, ${num(W.known)} con monto. La ventana de reembolsos de Walmart empieza en ${W.desde} y no está completa.`, conMonto: W.known, total: W.n} : null,
    fuente: {etiqueta: 'Libro económico · reembolsos de Walmart en estado pending', tabla: 'economic_ledger_monthly'},
    periodo: wmOk ? rango(W.desde, W.hasta) : null, corte: W?.watermark ?? null, actualizado: W?.refreshedAt ?? null,
    otrasMonedas: [], proxy: {de: 'P3', rotulo: 'Proxy observado: NO es un chargeback. Es dinero pendiente de cerrar, no una penalización.'}, solapaCon: ['P4'],
    evidencia: {disponible: true, tipo: 'libro'},
    calculo: ['Suma de los reembolsos del libro con canal Walmart y estado pendiente (USD, última revisión de cada asiento).', 'Los cancelados se muestran aparte en Fuga de reembolsos: no son pérdida.'],
    noSabemos: ['No hay fecha límite de devolución por orden: no se puede decir cuánto se vence.', 'El libro no distingue un pendiente normal de uno que acabará en penalización.'],
    detalle: null,
  });
  puntos.push({
    id: 'P3', tema: 'devoluciones', nombre: 'Chargebacks y reclamos A-to-z', descripcion: 'Penalizaciones que cargan Amazon o Walmart cuando una devolución no se atiende a tiempo.',
    padre: null, agregado: false,
    dinero: sinDato('sin_fuente', 'No hay ninguna fuente de chargebacks cargada. Requiere los exportes de Amazon (A-to-z) y Walmart (Seller Center).'),
    volumen: sinDato('sin_fuente', 'Sin dato'),
    clase: 'O', cobertura: {texto: 'Cobertura 0 %: ni el Tracker ni el libro distinguen un chargeback de un reembolso.', conMonto: 0, total: 0},
    fuente: {etiqueta: 'Sin fuente (pendiente de exportes de Amazon y Walmart)', tabla: null},
    periodo: null, corte: null, actualizado: null, otrasMonedas: [], proxy: null, proxies: ['P1', 'P2'], solapaCon: [],
    evidencia: {disponible: false, motivo: 'Sin dato: no hay filas de chargebacks. Los puntos P1 y P2 son proxies observados, no chargebacks.'},
    calculo: ['No se calcula: no existe la fuente.'],
    noSabemos: ['El monto de los chargebacks.', 'Cuántas devoluciones tardías terminan en chargeback.'],
    detalle: null,
  });

  // ---------------- Garantía ----------------
  const G = f.garantia;
  puntos.push({
    id: 'P6', tema: 'garantia', nombre: 'Solicitudes de garantía (herramientas y piezas)', descripcion: 'Filas registradas en las hojas Warranty Tools y Warranty Parts del Tracker.',
    padre: null, agregado: false,
    dinero: sinDato('sin_fuente', 'Las hojas de garantía del Tracker no traen monto.'),
    volumen: G ? vol(G.total, 'solicitudes') : sinDato('no_disponible', 'No disponible ahora'),
    clase: 'O', cobertura: G ? {texto: `${num(G.total)} filas (${Object.entries(G.hojas).map(([h, n]) => `${h}: ${num(n)}`).join(' · ')}). No se suman los espejos WTR y WPR.`, conMonto: 0, total: G.total} : null,
    fuente: {etiqueta: 'Tracker de Excel · Warranty Tools y Warranty Parts', tabla: 'tracker_row_revisions'},
    periodo: null, corte: null, actualizado: null, otrasMonedas: [], proxy: null, solapaCon: [],
    evidencia: {disponible: false, motivo: 'El detalle por fila de garantías aún no está disponible; solo el conteo.'},
    calculo: ['Conteo de filas distintas (no vacías) de las dos hojas de garantía.'],
    noSabemos: ['El costo de las garantías: el Tracker no trae monto.', 'Solo ≈1 % de los tickets vinculados llega a una garantía con SKU.'],
    detalle: null,
  });

  // ---------------- Logística y servicio ----------------
  const H = f.hilos;
  puntos.push({
    id: 'P7', tema: 'logistica', nombre: 'Hilos que tardan en cerrarse (más de 7 días)', descripcion: 'Conversaciones de HubSpot cerradas después de más de 7 días. Sin tracking de transportista no se mide pérdida logística.',
    padre: null, agregado: false,
    dinero: sinDato('no_aplica', 'Sin costo por incidente tecleado no hay dinero. Se muestra la tasa observada, nunca una probabilidad de perder dinero.'),
    volumen: H ? vol(H.closedOver7d, 'hilos') : sinDato('no_disponible', 'No disponible ahora'),
    clase: 'O', cobertura: H ? {texto: `${num(H.closedOver7d)} de ${num(H.closed)} hilos cerrados (${num(H.threads)} hilos HubSpot). Mediana ${H.closeP50Hours ?? '—'} h · p90 ${H.closeP90Hours ?? '—'} h · reabiertos ${H.reopenedPercent ?? '—'} %.`, conMonto: 0, total: H.closed} : null,
    fuente: {etiqueta: 'HubSpot API · cierre y reapertura de hilos', tabla: 'insight_thread_resolution'},
    periodo: H?.periodo ?? null, corte: f.hilosMeta?.sourceWatermark ?? null, actualizado: f.hilosMeta?.refreshedAt ?? null,
    otrasMonedas: [], proxy: null, solapaCon: [],
    evidencia: {disponible: false, motivo: 'Es un agregado de hilos internos de HubSpot; no hay filas de orden que mostrar.'},
    calculo: ['Hilos de HubSpot cuyo cierre ocurrió tras más de 7 días (insight_thread_resolution, todo el periodo).'],
    noSabemos: ['Pérdida de dinero por logística: no hay costo de envío ni tracking de paquetería.', 'La primera respuesta del CSV no es confiable; solo HubSpot.'],
    detalle: H ? {threads: H.threads, closed: H.closed, closeP50Hours: H.closeP50Hours, closeP90Hours: H.closeP90Hours, reopenedPercent: H.reopenedPercent} : null,
  });
  const P = f.repetido;
  puntos.push({
    id: 'P8', tema: 'logistica', nombre: 'Contacto repetido (mala experiencia)', descripcion: 'Clientes que escriben dos o más veces en 90 días por el mismo tipo de problema.',
    padre: null, agregado: false,
    dinero: sinDato('no_aplica', 'Falta el costo por contacto: sin ese supuesto tecleado no hay dinero.'),
    volumen: P ? vol(P.contactosDosOMas, 'contactos') : P === false ? sinDato('sin_fuente', 'El resumen todavía no se calculó') : sinDato('no_disponible', 'No disponible ahora'),
    clase: 'O', cobertura: P ? {texto: `${num(P.contactosDosOMas)} de ${num(P.contactos)} contactos (${P.pct ?? '—'} %). ${P.pctSinVincular ?? '—'} % de los tickets sin vincular a un contacto.`, conMonto: 0, total: P.contactos} : null,
    fuente: {etiqueta: 'Conversaciones y asociaciones de HubSpot · contacto repetido a 90 días', tabla: 'contact_repeat_summary'},
    periodo: null, corte: P?.corte ?? null, actualizado: P?.refreshedAt ?? null, otrasMonedas: [], proxy: null, solapaCon: [],
    evidencia: {disponible: false, motivo: 'Son conteos de contactos; no se muestran filas para no exponer identidades.'},
    calculo: ['Contactos con 2 o más tickets en 90 días (contact_repeat_summary).'],
    noSabemos: ['El costo de atender un contacto repetido.', 'Solo ≈72 % de los tickets queda vinculado a una conversación.'],
    detalle: null,
  });

  // ---------------- Canales ----------------
  const cancelUsd = O ? O.monedas.find(m => m.currency === 'USD' && m.exponent === 2) : null;
  puntos.push({
    id: 'P5', tema: 'canales', nombre: 'Pedidos cancelados', descripcion: 'Importe de líneas de pedido canceladas en todos los canales (USD). CAD y MXN se muestran aparte.',
    padre: null, agregado: false,
    dinero: O ? (cancelUsd && cancelUsd.cancelled > 0 ? dineroUsd(cancelUsd.cancelledMinor) : sinDato('sin_fuente', 'Ninguna línea cancelada en USD.')) : off('ordenes', 'ingreso mensual'),
    volumen: O ? vol(cancelUsd?.cancelled ?? 0, 'líneas') : sinDato('no_disponible', 'No disponible ahora'),
    clase: 'O', cobertura: O ? {texto: `${num(cancelUsd?.cancelled ?? 0)} de ${num(cancelUsd?.n ?? 0)} líneas de pedido (${O.tot.n ? Math.round(cancelUsd.cancelled * 1000 / cancelUsd.n) / 10 : 0} %).`, conMonto: cancelUsd?.cancelled ?? 0, total: cancelUsd?.n ?? 0} : null,
    fuente: {etiqueta: 'Libro económico · pedidos cancelados por canal y mes', tabla: 'insight_order_revenue_month'},
    periodo: O ? rango(O.desde, O.hasta) : null, corte: f.ordenes?.meta?.sourceWatermark ?? null, actualizado: f.ordenes?.meta?.refreshedAt ?? null,
    otrasMonedas: O ? O.monedas.filter(m => !(m.currency === 'USD' && m.exponent === 2) && m.cancelled > 0).map(m => ({currency: m.currency, exponent: m.exponent, minor: String(m.cancelledMinor), n: m.cancelled})) : [],
    proxy: null, solapaCon: [],
    evidencia: {disponible: true, tipo: 'libro'},
    calculo: ['Suma del importe de las líneas de pedido con estado cancelado, en USD. Las demás monedas no se suman.'],
    noSabemos: ['Cancelado no siempre es pérdida: depende de si se reembolsó, se repuso o nunca se cobró.'],
    detalle: null,
  });
  for (const canal of CANALES_PP) {
    const c = R?.canales.get(canal), ing = O?.canales.get(canal);
    const hay = c && c.active > 0n;
    puntos.push({
      id: 'P10~' + canal, tema: 'canales', nombre: 'Dinero devuelto · ' + NOMBRE_CANAL_PP[canal], descripcion: `Reembolsos de ${NOMBRE_CANAL_PP[canal]} sin cancelados (USD). Es otro corte del dinero devuelto de P4.`,
      padre: 'P4', agregado: false,
      dinero: R ? (hay ? dineroUsd(c.active) : sinDato('sin_fuente', canal === 'bestbuy' ? 'Best Buy no tiene reembolsos cargados en el libro: no es cero.' : 'Sin reembolsos de este canal en el libro.')) : off('reembolsos', 'reembolsos del libro'),
      volumen: R ? (c ? vol(c.n - c.cancelled, 'reembolsos', {sinMonto: c.n - c.known}) : sinDato('sin_fuente', 'Sin dato')) : sinDato('no_disponible', 'No disponible ahora'),
      clase: 'O', cobertura: c ? {texto: `${num(c.n - c.cancelled)} reembolsos sin cancelados, ${num(Math.max(0, c.n - c.known))} sin monto (cuentan, no suman).`, conMonto: c.known, total: c.n} : null,
      fuente: {etiqueta: 'Libro económico · reembolsos por canal y SKU', tabla: 'insight_refund_by_sku_month'},
      periodo: c ? rango(c.desde, c.hasta) : null, corte: f.reembolsos?.meta?.sourceWatermark ?? null, actualizado: f.reembolsos?.meta?.refreshedAt ?? null,
      otrasMonedas: [], proxy: null, solapaCon: ['P4'],
      evidencia: hay ? {disponible: true, tipo: 'libro'} : {disponible: false, motivo: 'No hay reembolsos de este canal en el libro.'},
      calculo: ['Suma de los reembolsos USD del canal, descontando los cancelados.'],
      noSabemos: ['Las ventanas de exportación de cada canal son distintas: no se compara con el ingreso como si fuera una tasa.'],
      detalle: ing ? {ingresoMinor: String(ing.ingreso), ingresoPeriodo: rango(ing.desde, ing.hasta)} : null,
    });
  }

  // ---------------- Ubicaciones ----------------
  puntos.push({
    id: 'P9', tema: 'ubicaciones', nombre: 'Casos por estado', descripcion: 'Dónde se concentran los casos. No hay ventas por estado: el libro no trae el destino del envío.',
    padre: null, agregado: false,
    dinero: sinDato('sin_fuente', 'El libro no trae ship-to: no se puede decir cuánto se pierde por estado.'),
    volumen: sinDato('sin_fuente', 'Los casos por estado viven en Mapa de problemas (provisional).'),
    clase: 'I', cobertura: {texto: 'Cobertura de ventas por estado: 0 %. Los casos del Tracker por estado son provisionales.', conMonto: 0, total: 0},
    fuente: {etiqueta: 'Sin fuente de ship-to (depende de las APIs de Amazon y Walmart)', tabla: null},
    periodo: null, corte: null, actualizado: null, otrasMonedas: [], proxy: null, solapaCon: [],
    evidencia: {disponible: false, motivo: 'Sin dato de destino de envío.'},
    calculo: ['No se calcula: falta el destino de los pedidos.'], noSabemos: ['Ventas y pérdidas por estado.'], detalle: null,
  });

  // ---------------- SKU ----------------
  const topSku = R ? [...R.skus.values()].sort((a, b) => (b.active > a.active ? 1 : b.active < a.active ? -1 : a.sku.localeCompare(b.sku))).slice(0, TOP_SKU) : [];
  const t = R?.tot;
  puntos.push({
    id: 'P4', tema: 'sku', nombre: 'Dinero devuelto por SKU', descripcion: 'Total de reembolsos USD sin cancelados, que se reparte en los SKU de abajo. Es el total; no se dibuja como burbuja.',
    padre: null, agregado: true,
    dinero: R ? (t.active > 0n ? dineroUsd(t.active, {conCancelados: String(t.gross)}) : sinDato('sin_fuente', 'Sin reembolsos USD en el libro.')) : off('reembolsos', 'reembolsos del libro'),
    volumen: R ? vol(t.n - t.cancelled, 'reembolsos', {sinMonto: t.n - t.known}) : sinDato('no_disponible', 'No disponible ahora'),
    clase: 'O', cobertura: R ? {texto: `${num(t.n - t.cancelled)} reembolsos sin cancelados; ${num(Math.max(0, t.n - t.known))} sin monto (Amazon: cuentan, no suman).`, conMonto: t.known, total: t.n} : null,
    fuente: {etiqueta: 'Libro económico · reembolsos por mes, canal y SKU base', tabla: 'insight_refund_by_sku_month'},
    periodo: R ? rango(R.desde, R.hasta) : null, corte: f.reembolsos?.meta?.sourceWatermark ?? null, actualizado: f.reembolsos?.meta?.refreshedAt ?? null,
    otrasMonedas: R ? R.otras.map(o => ({currency: o.currency, exponent: o.exponent, minor: String(o.minor), n: o.n})) : [], proxy: null, solapaCon: ['P1', 'P2'],
    evidencia: {disponible: true, tipo: 'libro'},
    calculo: ['Suma de los reembolsos USD (último estado de cada asiento) descontando los cancelados.', 'Las demás monedas se listan aparte; nunca se suman.'],
    noSabemos: ['Un reembolso no es una pérdida confirmada: puede haberse recuperado con el proveedor o el canal.'],
    detalle: R && t.active > 0n ? {topPct: Number(topSku.reduce((a, s) => a + s.active, 0n) * 1000n / t.active) / 10, topSku: topSku.length} : null,
  });
  for (const s of topSku) {
    const ing = O?.skus.get(s.sku);
    puntos.push({
      id: 'P4~' + s.sku, tema: 'sku', nombre: s.sku, descripcion: `Dinero devuelto del SKU ${s.sku} sin cancelados (USD), todos los canales.`,
      padre: 'P4', agregado: false,
      dinero: dineroUsd(s.active, {conCancelados: String(s.gross)}), volumen: vol(s.n - s.cancelled, 'reembolsos', {sinMonto: s.n - s.known}),
      clase: 'O', cobertura: {texto: `${num(s.n - s.cancelled)} reembolsos sin cancelados${s.n - s.known > 0 ? `; ${num(s.n - s.known)} sin monto (cuentan, no suman)` : ''}.`, conMonto: s.known, total: s.n},
      fuente: {etiqueta: 'Libro económico · reembolsos por SKU base', tabla: 'insight_refund_by_sku_month'},
      periodo: rango(R.desde, R.hasta), corte: f.reembolsos?.meta?.sourceWatermark ?? null, actualizado: f.reembolsos?.meta?.refreshedAt ?? null,
      otrasMonedas: [], proxy: null, solapaCon: ['P4'],
      evidencia: {disponible: true, tipo: 'libro'},
      calculo: ['Suma de los reembolsos USD del SKU base (sin sufijos -WMxx, FBA ni -NEW), sin cancelados.', 'Ingreso retenido = ingreso bruto del SKU menos cancelaciones menos reembolsos activos (nunca margen).'],
      noSabemos: ['El ingreso y los reembolsos tienen ventanas distintas por canal: el retenido es orientativo.'],
      detalle: ing ? {ingresoMinor: String(ing.ingreso), reembolsoMinor: String(s.active), retenidoMinor: String(ing.ingreso - s.active), canales: s.canales} : {canales: s.canales},
    });
  }
  puntos.push({
    id: 'P12', tema: 'sku', nombre: 'Quejas frente a ventas por familia', descripcion: 'Ranking de familias de producto con más quejas que ventas.',
    padre: null, agregado: false,
    dinero: sinDato('sin_fuente', 'Solo ≈1 % de las quejas trae SKU: la cifra sería engañosa.'),
    volumen: sinDato('sin_fuente', 'Cobertura insuficiente'),
    clase: 'I', cobertura: {texto: 'Cobertura ≈1 % de las quejas con SKU (≈64 % con el análisis ampliado por IA, aún no corrido).', conMonto: 0, total: 0},
    fuente: {etiqueta: 'Análisis de conversaciones por familia (taxonomía v2)', tabla: 'insight_complaint_family_month'},
    periodo: null, corte: null, actualizado: null, otrasMonedas: [], proxy: null, solapaCon: [],
    evidencia: {disponible: false, motivo: 'Cobertura insuficiente.'},
    calculo: ['No se calcula todavía.'], noSabemos: ['Qué familia genera más quejas por venta.'], detalle: null,
  });
  return puntos;
}

/** Tema de cada punto -> orden estable para tablas y mapa. */
export const ordenPuntos = (a, b) => {
  const x = a.dinero.sinDato ? -1n : big(a.dinero.minor), y = b.dinero.sinDato ? -1n : big(b.dinero.minor);
  return x === y ? a.id.localeCompare(b.id) : y > x ? 1 : -1;
};
