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
const TEMAS_EN = Object.freeze({devoluciones: 'Returns and chargebacks', garantia: 'Warranty', logistica: 'Logistics and service', canales: 'Channels', ubicaciones: 'Locations', sku: 'SKU'});
/** Temas con el nombre en el idioma pedido ('es' por omisión). */
export const temasDe = idioma => (idioma === 'en' ? TEMAS.map(t => ({...t, nombre: TEMAS_EN[t.id]})) : TEMAS);
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
const numI = idioma => { const f = new Intl.NumberFormat(idioma === 'en' ? 'en-US' : 'es-MX'); return n => f.format(n); };

/**
 * Arma los puntos de dolor. Cada parte puede venir `null` (no se pudo leer: «no disponible ahora», nunca cero) o `{vacia:true}` (no calculada).
 * f = {tracker, walmart, reembolsos, ordenes, hilos, repetido, garantia}; ver pain-points.mjs para la forma de cada una.
 */
export function armarPuntos(f, idioma = 'es') {
  const puntos = [], en = idioma === 'en', L = (es, enText) => (en ? enText : es), num = numI(idioma), pctSp = en ? '%' : ' %';
  const off = (_parte, texto) => sinDato('no_disponible', L('No disponible ahora (' + texto + '). No significa que no haya datos: reintenta en un momento.', 'Not available right now (' + texto + '). It does not mean there is no data: try again in a moment.'));
  const T = f.tracker ? agregarTracker(f.tracker.data) : null;
  const W = f.walmart, R = f.reembolsos ? agregarReembolsos(f.reembolsos.rows) : null, O = f.ordenes ? agregarOrdenes(f.ordenes.rows) : null;

  // ---------------- Devoluciones y chargebacks ----------------
  puntos.push({
    id: 'P1', tema: 'devoluciones', nombre: L('Reembolsos negados o vencidos (Tracker)', `Denied or expired refunds (Tracker)`), descripcion: L('Solicitudes de reembolso que el canal rechazó, venció (más de 180 días) o declaró no reembolsables.', `Refund requests that the channel rejected, let expire (more than 180 days) or declared non-refundable.`),
    padre: null, agregado: false,
    dinero: T ? (T.nAmount > 0 ? dineroUsd(T.minor, {supuesta: true}) : sinDato('sin_fuente', L('Ninguna solicitud negada trae monto.', `No denied request carries an amount.`))) : off('tracker', 'Tracker'),
    volumen: T ? vol(T.n, L('solicitudes', `requests`)) : sinDato('no_disponible', L('No disponible ahora', `Not available right now`)),
    clase: 'O',
    cobertura: T ? {texto: L(`${num(T.n)} solicitudes negadas o vencidas de ${num(T.total)} del Tracker; ${num(T.nAmount)} con monto. Es una muestra del flujo caro, no el total de reembolsos.`, `${num(T.n)} denied or expired requests out of ${num(T.total)} in the Tracker; ${num(T.nAmount)} with an amount. It is a sample of the expensive flow, not the total of refunds.`), conMonto: T.nAmount, total: T.n} : null,
    fuente: {etiqueta: L('Tracker de Excel · hoja Refunds (última revisión por fila)', `Excel Tracker · Refunds sheet (latest revision per row)`), tabla: 'insight_tracker_refund_status'},
    periodo: null, corte: f.tracker?.meta?.sourceWatermark ?? null, actualizado: f.tracker?.meta?.refreshedAt ?? null,
    otrasMonedas: [], proxy: {de: 'P3', rotulo: L('Proxy observado: NO es un chargeback. Es lo que el Tracker registra como negado o vencido.', `Observed proxy: it is NOT a chargeback. It is what the Tracker records as denied or expired.`)}, solapaCon: ['P4'],
    evidencia: {disponible: true, tipo: 'tracker'},
    calculo: [L('Suma del monto de las solicitudes con estado vencido, no reembolsable o rechazado (hoja Refunds, última revisión de cada fila).', `Sum of the amount of requests with expired, non-refundable or rejected status (Refunds sheet, latest revision of each row).`), L('La moneda no viene en el Tracker: se supone USD y así se rotula.', `The currency is not in the Tracker: USD is assumed and labeled as such.`)],
    noSabemos: [L('El Tracker no es el total de reembolsos: es una muestra.', `The Tracker is not the total of refunds: it is a sample.`), L(`${num((T?.n ?? 0) - (T?.nAmount ?? 0))} solicitudes negadas no traen monto (cuentan, no suman).`, `${num((T?.n ?? 0) - (T?.nAmount ?? 0))} denied requests carry no amount (they count, they do not add).`)],
    detalle: T ? {estados: T.estados} : null,
  });
  const wmOk = W && W.n > 0;
  puntos.push({
    id: 'P2', tema: 'devoluciones', nombre: L('Walmart: reembolsos pendientes de cerrar', `Walmart: refunds pending to close`), descripcion: L('Reembolsos de Walmart en estado «pendiente»: dinero atorado por devoluciones que no se cierran a tiempo.', `Walmart refunds in "pending" status: money stuck because returns are not closed on time.`),
    padre: null, agregado: false,
    dinero: W === null ? off('libro', L('libro de reembolsos', 'refunds ledger')) : wmOk ? dineroUsd(W.minor) : sinDato('sin_fuente', L('El libro no tiene reembolsos pendientes de Walmart.', `The ledger has no pending Walmart refunds.`)),
    volumen: W === null ? sinDato('no_disponible', L('No disponible ahora', `Not available right now`)) : vol(W?.n ?? 0, L('reembolsos', `refunds`)),
    clase: 'O',
    cobertura: wmOk ? {texto: L(`${num(W.n)} reembolsos pendientes, ${num(W.known)} con monto. La ventana de reembolsos de Walmart empieza en ${W.desde} y no está completa.`, `${num(W.n)} pending refunds, ${num(W.known)} with an amount. The Walmart refunds window starts on ${W.desde} and is not complete.`), conMonto: W.known, total: W.n} : null,
    fuente: {etiqueta: L('Libro económico · reembolsos de Walmart en estado pending', `Economic ledger · Walmart refunds in pending status`), tabla: 'economic_ledger_monthly'},
    periodo: wmOk ? rango(W.desde, W.hasta) : null, corte: W?.watermark ?? null, actualizado: W?.refreshedAt ?? null,
    otrasMonedas: [], proxy: {de: 'P3', rotulo: L('Proxy observado: NO es un chargeback. Es dinero pendiente de cerrar, no una penalización.', `Observed proxy: it is NOT a chargeback. It is money pending to close, not a penalty.`)}, solapaCon: ['P4'],
    evidencia: {disponible: true, tipo: 'libro'},
    calculo: [L('Suma de los reembolsos del libro con canal Walmart y estado pendiente (USD, última revisión de cada asiento).', `Sum of the ledger refunds with channel Walmart and pending status (USD, latest revision of each entry).`), L('Los cancelados se muestran aparte en Fuga de reembolsos: no son pérdida.', `Canceled ones are shown separately in Refund leakage: they are not loss.`)],
    noSabemos: [L('No hay fecha límite de devolución por orden: no se puede decir cuánto se vence.', `There is no return deadline per order: it is not possible to say how much is expiring.`), L('El libro no distingue un pendiente normal de uno que acabará en penalización.', `The ledger does not distinguish a normal pending item from one that will end up as a penalty.`)],
    detalle: null,
  });
  puntos.push({
    id: 'P3', tema: 'devoluciones', nombre: L('Chargebacks y reclamos A-to-z', `Chargebacks and A-to-z claims`), descripcion: L('Penalizaciones que cargan Amazon o Walmart cuando una devolución no se atiende a tiempo.', `Penalties that Amazon or Walmart charge when a return is not handled on time.`),
    padre: null, agregado: false,
    dinero: sinDato('sin_fuente', L('No hay ninguna fuente de chargebacks cargada. Requiere los exportes de Amazon (A-to-z) y Walmart (Seller Center).', `No chargeback source is loaded. It requires the Amazon (A-to-z) and Walmart (Seller Center) exports.`)),
    volumen: sinDato('sin_fuente', L('Sin dato', `No data`)),
    clase: 'O', cobertura: {texto: L('Cobertura 0 %: ni el Tracker ni el libro distinguen un chargeback de un reembolso.', `Coverage 0%: neither the Tracker nor the ledger distinguishes a chargeback from a refund.`), conMonto: 0, total: 0},
    fuente: {etiqueta: L('Sin fuente (pendiente de exportes de Amazon y Walmart)', `No source (pending Amazon and Walmart exports)`), tabla: null},
    periodo: null, corte: null, actualizado: null, otrasMonedas: [], proxy: null, proxies: ['P1', 'P2'], solapaCon: [],
    evidencia: {disponible: false, motivo: L('Sin dato: no hay filas de chargebacks. Los puntos P1 y P2 son proxies observados, no chargebacks.', `No data: there are no chargeback rows. Points P1 and P2 are observed proxies, not chargebacks.`)},
    calculo: [L('No se calcula: no existe la fuente.', `Not calculated: the source does not exist.`)],
    noSabemos: [L('El monto de los chargebacks.', `The amount of the chargebacks.`), L('Cuántas devoluciones tardías terminan en chargeback.', `How many late returns end up as a chargeback.`)],
    detalle: null,
  });

  // ---------------- Garantía ----------------
  const G = f.garantia;
  puntos.push({
    id: 'P6', tema: 'garantia', nombre: L('Solicitudes de garantía (herramientas y piezas)', `Warranty requests (tools and parts)`), descripcion: L('Filas registradas en las hojas Warranty Tools y Warranty Parts del Tracker.', `Rows recorded in the Warranty Tools and Warranty Parts sheets of the Tracker.`),
    padre: null, agregado: false,
    dinero: sinDato('sin_fuente', L('Las hojas de garantía del Tracker no traen monto.', `The warranty sheets of the Tracker carry no amount.`)),
    volumen: G ? vol(G.total, L('solicitudes', `requests`)) : sinDato('no_disponible', L('No disponible ahora', `Not available right now`)),
    clase: 'O', cobertura: G ? {texto: L(`${num(G.total)} filas (${Object.entries(G.hojas).map(([h, n]) => `${h}: ${num(n)}`).join(' · ')}). No se suman los espejos WTR y WPR.`, `${num(G.total)} rows (${Object.entries(G.hojas).map(([h, n]) => `${h}: ${num(n)}`).join(' · ')}). The WTR and WPR mirrors are not added.`), conMonto: 0, total: G.total} : null,
    fuente: {etiqueta: L('Tracker de Excel · Warranty Tools y Warranty Parts', `Excel Tracker · Warranty Tools and Warranty Parts`), tabla: 'tracker_row_revisions'},
    periodo: null, corte: null, actualizado: null, otrasMonedas: [], proxy: null, solapaCon: [],
    evidencia: {disponible: false, motivo: L('El detalle por fila de garantías aún no está disponible; solo el conteo.', `The row-level warranty detail is not available yet; only the count.`)},
    calculo: [L('Conteo de filas distintas (no vacías) de las dos hojas de garantía.', `Count of distinct (non-empty) rows of the two warranty sheets.`)],
    noSabemos: [L('El costo de las garantías: el Tracker no trae monto.', `The cost of warranties: the Tracker carries no amount.`), L('Solo ≈1 % de los tickets vinculados llega a una garantía con SKU.', `Only ≈1% of linked tickets reach a warranty with a SKU.`)],
    detalle: null,
  });

  // ---------------- Logística y servicio ----------------
  const H = f.hilos;
  puntos.push({
    id: 'P7', tema: 'logistica', nombre: L('Hilos que tardan en cerrarse (más de 7 días)', `Threads that take long to close (more than 7 days)`), descripcion: L('Conversaciones de HubSpot cerradas después de más de 7 días. Sin tracking de transportista no se mide pérdida logística.', `HubSpot conversations closed after more than 7 days. Without carrier tracking, logistics loss is not measured.`),
    padre: null, agregado: false,
    dinero: sinDato('no_aplica', L('Sin costo por incidente tecleado no hay dinero. Se muestra la tasa observada, nunca una probabilidad de perder dinero.', `Without a typed cost per incident there is no money. The observed rate is shown, never a probability of losing money.`)),
    volumen: H ? vol(H.closedOver7d, L('hilos', `threads`)) : sinDato('no_disponible', L('No disponible ahora', `Not available right now`)),
    clase: 'O', cobertura: H ? {texto: L(`${num(H.closedOver7d)} de ${num(H.closed)} hilos cerrados (${num(H.threads)} hilos HubSpot). Mediana ${H.closeP50Hours ?? '—'} h · p90 ${H.closeP90Hours ?? '—'} h · reabiertos ${H.reopenedPercent ?? '—'} %.`, `${num(H.closedOver7d)} of ${num(H.closed)} closed threads (${num(H.threads)} HubSpot threads). Median ${H.closeP50Hours ?? '—'} h · p90 ${H.closeP90Hours ?? '—'} h · reopened ${H.reopenedPercent ?? '—'}%.`), conMonto: 0, total: H.closed} : null,
    fuente: {etiqueta: L('HubSpot API · cierre y reapertura de hilos', `HubSpot API · thread closing and reopening`), tabla: 'insight_thread_resolution'},
    periodo: H?.periodo ?? null, corte: f.hilosMeta?.sourceWatermark ?? null, actualizado: f.hilosMeta?.refreshedAt ?? null,
    otrasMonedas: [], proxy: null, solapaCon: [],
    evidencia: {disponible: false, motivo: L('Es un agregado de hilos internos de HubSpot; no hay filas de orden que mostrar.', `It is an aggregate of internal HubSpot threads; there are no order rows to show.`)},
    calculo: [L('Hilos de HubSpot cuyo cierre ocurrió tras más de 7 días (insight_thread_resolution, todo el periodo).', `HubSpot threads closed after more than 7 days (insight_thread_resolution, whole period).`)],
    noSabemos: [L('Pérdida de dinero por logística: no hay costo de envío ni tracking de paquetería.', `Money lost to logistics: there is no shipping cost or parcel tracking.`), L('La primera respuesta del CSV no es confiable; solo HubSpot.', `The first response in the CSV is not reliable; HubSpot only.`)],
    detalle: H ? {threads: H.threads, closed: H.closed, closeP50Hours: H.closeP50Hours, closeP90Hours: H.closeP90Hours, reopenedPercent: H.reopenedPercent} : null,
  });
  const P = f.repetido;
  puntos.push({
    id: 'P8', tema: 'logistica', nombre: L('Contacto repetido (mala experiencia)', `Repeat contact (poor experience)`), descripcion: L('Clientes que escriben dos o más veces en 90 días por el mismo tipo de problema.', `Customers who write two or more times in 90 days about the same type of problem.`),
    padre: null, agregado: false,
    dinero: sinDato('no_aplica', L('Falta el costo por contacto: sin ese supuesto tecleado no hay dinero.', `The cost per contact is missing: without that typed assumption there is no money.`)),
    volumen: P ? vol(P.contactosDosOMas, L('contactos', `contacts`)) : P === false ? sinDato('sin_fuente', L('El resumen todavía no se calculó', `The summary has not been calculated yet`)) : sinDato('no_disponible', L('No disponible ahora', `Not available right now`)),
    clase: 'O', cobertura: P ? {texto: L(`${num(P.contactosDosOMas)} de ${num(P.contactos)} contactos (${P.pct ?? '—'} %). ${P.pctSinVincular ?? '—'} % de los tickets sin vincular a un contacto.`, `${num(P.contactosDosOMas)} of ${num(P.contactos)} contacts (${P.pct ?? '—'}%). ${P.pctSinVincular ?? '—'}% of tickets not linked to a contact.`), conMonto: 0, total: P.contactos} : null,
    fuente: {etiqueta: L('Conversaciones y asociaciones de HubSpot · contacto repetido a 90 días', `HubSpot conversations and associations · repeat contact at 90 days`), tabla: 'contact_repeat_summary'},
    periodo: null, corte: P?.corte ?? null, actualizado: P?.refreshedAt ?? null, otrasMonedas: [], proxy: null, solapaCon: [],
    evidencia: {disponible: false, motivo: L('Son conteos de contactos; no se muestran filas para no exponer identidades.', `These are contact counts; no rows are shown so as not to expose identities.`)},
    calculo: [L('Contactos con 2 o más tickets en 90 días (contact_repeat_summary).', `Contacts with 2 or more tickets in 90 days (contact_repeat_summary).`)],
    noSabemos: [L('El costo de atender un contacto repetido.', `The cost of handling a repeat contact.`), L('Solo ≈72 % de los tickets queda vinculado a una conversación.', `Only ≈72% of tickets end up linked to a conversation.`)],
    detalle: null,
  });

  // ---------------- Canales ----------------
  const cancelUsd = O ? O.monedas.find(m => m.currency === 'USD' && m.exponent === 2) : null;
  puntos.push({
    id: 'P5', tema: 'canales', nombre: L('Pedidos cancelados', `Canceled orders`), descripcion: L('Importe de líneas de pedido canceladas en todos los canales (USD). CAD y MXN se muestran aparte.', `Amount of canceled order lines across all channels (USD). CAD and MXN are shown separately.`),
    padre: null, agregado: false,
    dinero: O ? (cancelUsd && cancelUsd.cancelled > 0 ? dineroUsd(cancelUsd.cancelledMinor) : sinDato('sin_fuente', L('Ninguna línea cancelada en USD.', `No canceled line in USD.`))) : off('ordenes', L('ingreso mensual', 'monthly revenue')),
    volumen: O ? vol(cancelUsd?.cancelled ?? 0, L('líneas', `lines`)) : sinDato('no_disponible', L('No disponible ahora', `Not available right now`)),
    clase: 'O', cobertura: O ? {texto: L(`${num(cancelUsd?.cancelled ?? 0)} de ${num(cancelUsd?.n ?? 0)} líneas de pedido (${O.tot.n ? Math.round(cancelUsd.cancelled * 1000 / cancelUsd.n) / 10 : 0} %).`, `${num(cancelUsd?.cancelled ?? 0)} of ${num(cancelUsd?.n ?? 0)} order lines (${O.tot.n ? Math.round(cancelUsd.cancelled * 1000 / cancelUsd.n) / 10 : 0}%).`), conMonto: cancelUsd?.cancelled ?? 0, total: cancelUsd?.n ?? 0} : null,
    fuente: {etiqueta: L('Libro económico · pedidos cancelados por canal y mes', `Economic ledger · canceled orders by channel and month`), tabla: 'insight_order_revenue_month'},
    periodo: O ? rango(O.desde, O.hasta) : null, corte: f.ordenes?.meta?.sourceWatermark ?? null, actualizado: f.ordenes?.meta?.refreshedAt ?? null,
    otrasMonedas: O ? O.monedas.filter(m => !(m.currency === 'USD' && m.exponent === 2) && m.cancelled > 0).map(m => ({currency: m.currency, exponent: m.exponent, minor: String(m.cancelledMinor), n: m.cancelled})) : [],
    proxy: null, solapaCon: [],
    evidencia: {disponible: true, tipo: 'libro'},
    calculo: [L('Suma del importe de las líneas de pedido con estado cancelado, en USD. Las demás monedas no se suman.', `Sum of the amount of order lines with canceled status, in USD. Other currencies are not added.`)],
    noSabemos: [L('Cancelado no siempre es pérdida: depende de si se reembolsó, se repuso o nunca se cobró.', `Canceled is not always a loss: it depends on whether it was refunded, replaced or never charged.`)],
    detalle: null,
  });
  for (const canal of CANALES_PP) {
    const c = R?.canales.get(canal), ing = O?.canales.get(canal);
    const hay = c && c.active > 0n;
    puntos.push({
      id: 'P10~' + canal, tema: 'canales', nombre: L('Dinero devuelto · ', `Money returned · `) + NOMBRE_CANAL_PP[canal], descripcion: L(`Reembolsos de ${NOMBRE_CANAL_PP[canal]} sin cancelados (USD). Es otro corte del dinero devuelto de P4.`, `${NOMBRE_CANAL_PP[canal]} refunds without canceled ones (USD). It is another cut of the money returned in P4.`),
      padre: 'P4', agregado: false,
      dinero: R ? (hay ? dineroUsd(c.active) : sinDato('sin_fuente', canal === 'bestbuy' ? L('Best Buy no tiene reembolsos cargados en el libro: no es cero.', `Best Buy has no refunds loaded in the ledger: it is not zero.`) : L('Sin reembolsos de este canal en el libro.', `No refunds from this channel in the ledger.`))) : off('reembolsos', L('reembolsos del libro', 'ledger refunds')),
      volumen: R ? (c ? vol(c.n - c.cancelled, L('reembolsos', `refunds`), {sinMonto: c.n - c.known}) : sinDato('sin_fuente', L('Sin dato', `No data`))) : sinDato('no_disponible', L('No disponible ahora', `Not available right now`)),
      clase: 'O', cobertura: c ? {texto: L(`${num(c.n - c.cancelled)} reembolsos sin cancelados, ${num(Math.max(0, c.n - c.known))} sin monto (cuentan, no suman).`, `${num(c.n - c.cancelled)} refunds without canceled ones, ${num(Math.max(0, c.n - c.known))} without an amount (they count, they do not add).`), conMonto: c.known, total: c.n} : null,
      fuente: {etiqueta: L('Libro económico · reembolsos por canal y SKU', `Economic ledger · refunds by channel and SKU`), tabla: 'insight_refund_by_sku_month'},
      periodo: c ? rango(c.desde, c.hasta) : null, corte: f.reembolsos?.meta?.sourceWatermark ?? null, actualizado: f.reembolsos?.meta?.refreshedAt ?? null,
      otrasMonedas: [], proxy: null, solapaCon: ['P4'],
      evidencia: hay ? {disponible: true, tipo: 'libro'} : {disponible: false, motivo: L('No hay reembolsos de este canal en el libro.', `There are no refunds from this channel in the ledger.`)},
      calculo: [L('Suma de los reembolsos USD del canal, descontando los cancelados.', `Sum of the USD refunds of the channel, discounting the canceled ones.`)],
      noSabemos: [L('Las ventanas de exportación de cada canal son distintas: no se compara con el ingreso como si fuera una tasa.', `The export windows of each channel are different: it is not compared with revenue as if it were a rate.`)],
      detalle: ing ? {ingresoMinor: String(ing.ingreso), ingresoPeriodo: rango(ing.desde, ing.hasta)} : null,
    });
  }

  // ---------------- Ubicaciones ----------------
  puntos.push({
    id: 'P9', tema: 'ubicaciones', nombre: L('Casos por estado', `Cases by state`), descripcion: L('Dónde se concentran los casos. No hay ventas por estado: el libro no trae el destino del envío.', `Where cases concentrate. There are no sales by state: the ledger does not carry the shipping destination.`),
    padre: null, agregado: false,
    dinero: sinDato('sin_fuente', L('El libro no trae ship-to: no se puede decir cuánto se pierde por estado.', `The ledger carries no ship-to: it is not possible to say how much is lost per state.`)),
    volumen: sinDato('sin_fuente', L('Los casos por estado viven en Mapa de problemas (provisional).', `Cases by state live in the Problem map (provisional).`)),
    clase: 'I', cobertura: {texto: L('Cobertura de ventas por estado: 0 %. Los casos del Tracker por estado son provisionales.', `Sales coverage by state: 0%. Tracker cases by state are provisional.`), conMonto: 0, total: 0},
    fuente: {etiqueta: L('Sin fuente de ship-to (depende de las APIs de Amazon y Walmart)', `No ship-to source (depends on the Amazon and Walmart APIs)`), tabla: null},
    periodo: null, corte: null, actualizado: null, otrasMonedas: [], proxy: null, solapaCon: [],
    evidencia: {disponible: false, motivo: L('Sin dato de destino de envío.', `No shipping destination data.`)},
    calculo: [L('No se calcula: falta el destino de los pedidos.', `Not calculated: the destination of orders is missing.`)], noSabemos: [L('Ventas y pérdidas por estado.', `Sales and losses by state.`)], detalle: null,
  });

  // ---------------- SKU ----------------
  const topSku = R ? [...R.skus.values()].sort((a, b) => (b.active > a.active ? 1 : b.active < a.active ? -1 : a.sku.localeCompare(b.sku))).slice(0, TOP_SKU) : [];
  const t = R?.tot;
  puntos.push({
    id: 'P4', tema: 'sku', nombre: L('Dinero devuelto por SKU', `Money returned by SKU`), descripcion: L('Total de reembolsos USD sin cancelados, que se reparte en los SKU de abajo. Es el total; no se dibuja como burbuja.', `Total USD refunds without canceled ones, split across the SKUs below. It is the total; it is not drawn as a bubble.`),
    padre: null, agregado: true,
    dinero: R ? (t.active > 0n ? dineroUsd(t.active, {conCancelados: String(t.gross)}) : sinDato('sin_fuente', L('Sin reembolsos USD en el libro.', `No USD refunds in the ledger.`))) : off('reembolsos', L('reembolsos del libro', 'ledger refunds')),
    volumen: R ? vol(t.n - t.cancelled, L('reembolsos', `refunds`), {sinMonto: t.n - t.known}) : sinDato('no_disponible', L('No disponible ahora', `Not available right now`)),
    clase: 'O', cobertura: R ? {texto: L(`${num(t.n - t.cancelled)} reembolsos sin cancelados; ${num(Math.max(0, t.n - t.known))} sin monto (Amazon: cuentan, no suman).`, `${num(t.n - t.cancelled)} refunds without canceled ones; ${num(Math.max(0, t.n - t.known))} without an amount (Amazon: they count, they do not add).`), conMonto: t.known, total: t.n} : null,
    fuente: {etiqueta: L('Libro económico · reembolsos por mes, canal y SKU base', `Economic ledger · refunds by month, channel and base SKU`), tabla: 'insight_refund_by_sku_month'},
    periodo: R ? rango(R.desde, R.hasta) : null, corte: f.reembolsos?.meta?.sourceWatermark ?? null, actualizado: f.reembolsos?.meta?.refreshedAt ?? null,
    otrasMonedas: R ? R.otras.map(o => ({currency: o.currency, exponent: o.exponent, minor: String(o.minor), n: o.n})) : [], proxy: null, solapaCon: ['P1', 'P2'],
    evidencia: {disponible: true, tipo: 'libro'},
    calculo: [L('Suma de los reembolsos USD (último estado de cada asiento) descontando los cancelados.', `Sum of the USD refunds (latest status of each entry) discounting the canceled ones.`), L('Las demás monedas se listan aparte; nunca se suman.', `Other currencies are listed separately; they are never added.`)],
    noSabemos: [L('Un reembolso no es una pérdida confirmada: puede haberse recuperado con el proveedor o el canal.', `A refund is not a confirmed loss: it may have been recovered from the supplier or the channel.`)],
    detalle: R && t.active > 0n ? {topPct: Number(topSku.reduce((a, s) => a + s.active, 0n) * 1000n / t.active) / 10, topSku: topSku.length} : null,
  });
  for (const s of topSku) {
    const ing = O?.skus.get(s.sku);
    puntos.push({
      id: 'P4~' + s.sku, tema: 'sku', nombre: s.sku, descripcion: L(`Dinero devuelto del SKU ${s.sku} sin cancelados (USD), todos los canales.`, `Money returned for SKU ${s.sku} without canceled ones (USD), all channels.`),
      padre: 'P4', agregado: false,
      dinero: dineroUsd(s.active, {conCancelados: String(s.gross)}), volumen: vol(s.n - s.cancelled, L('reembolsos', `refunds`), {sinMonto: s.n - s.known}),
      clase: 'O', cobertura: {texto: L(`${num(s.n - s.cancelled)} reembolsos sin cancelados${s.n - s.known > 0 ? `; ${num(s.n - s.known)} sin monto (cuentan, no suman)` : ''}.`, `${num(s.n - s.cancelled)} refunds without canceled ones${s.n - s.known > 0 ? `; ${num(s.n - s.known)} without an amount (they count, they do not add)` : ''}.`), conMonto: s.known, total: s.n},
      fuente: {etiqueta: L('Libro económico · reembolsos por SKU base', `Economic ledger · refunds by base SKU`), tabla: 'insight_refund_by_sku_month'},
      periodo: rango(R.desde, R.hasta), corte: f.reembolsos?.meta?.sourceWatermark ?? null, actualizado: f.reembolsos?.meta?.refreshedAt ?? null,
      otrasMonedas: [], proxy: null, solapaCon: ['P4'],
      evidencia: {disponible: true, tipo: 'libro'},
      calculo: [L('Suma de los reembolsos USD del SKU base (sin sufijos -WMxx, FBA ni -NEW), sin cancelados.', `Sum of the USD refunds of the base SKU (without -WMxx, FBA or -NEW suffixes), without canceled ones.`), L('Ingreso retenido = ingreso bruto del SKU menos cancelaciones menos reembolsos activos (nunca margen).', `Retained revenue = gross revenue of the SKU minus cancellations minus active refunds (never margin).`)],
      noSabemos: [L('El ingreso y los reembolsos tienen ventanas distintas por canal: el retenido es orientativo.', `Revenue and refunds have different windows per channel: the retained figure is indicative.`)],
      detalle: ing ? {ingresoMinor: String(ing.ingreso), reembolsoMinor: String(s.active), retenidoMinor: String(ing.ingreso - s.active), canales: s.canales} : {canales: s.canales},
    });
  }
  puntos.push({
    id: 'P12', tema: 'sku', nombre: L('Quejas frente a ventas por familia', `Complaints versus sales by family`), descripcion: L('Ranking de familias de producto con más quejas que ventas.', `Ranking of product families with more complaints than sales.`),
    padre: null, agregado: false,
    dinero: sinDato('sin_fuente', L('Solo ≈1 % de las quejas trae SKU: la cifra sería engañosa.', `Only ≈1% of complaints carry a SKU: the figure would be misleading.`)),
    volumen: sinDato('sin_fuente', L('Cobertura insuficiente', `Insufficient coverage`)),
    clase: 'I', cobertura: {texto: L('Cobertura ≈1 % de las quejas con SKU (≈64 % con el análisis ampliado por IA, aún no corrido).', `Coverage ≈1% of complaints with SKU (≈64% with the extended AI analysis, not run yet).`), conMonto: 0, total: 0},
    fuente: {etiqueta: L('Análisis de conversaciones por familia (taxonomía v2)', `Conversation analysis by family (taxonomy v2)`), tabla: 'insight_complaint_family_month'},
    periodo: null, corte: null, actualizado: null, otrasMonedas: [], proxy: null, solapaCon: [],
    evidencia: {disponible: false, motivo: L('Cobertura insuficiente.', `Insufficient coverage.`)},
    calculo: [L('No se calcula todavía.', `Not calculated yet.`)], noSabemos: [L('Qué familia genera más quejas por venta.', `Which family generates the most complaints per sale.`)], detalle: null,
  });
  return puntos;
}

/** Tema de cada punto -> orden estable para tablas y mapa. */
export const ordenPuntos = (a, b) => {
  const x = a.dinero.sinDato ? -1n : big(a.dinero.minor), y = b.dinero.sinDato ? -1n : big(b.dinero.minor);
  return x === y ? a.id.localeCompare(b.id) : y > x ? 1 : -1;
};
