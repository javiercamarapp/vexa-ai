// Archivos de «un clic» de Fuga de reembolsos. Se generan EN EL NAVEGADOR a partir de lo que la pantalla ya tiene; no se envía nada a ningún lado.
// Sin PII por construcción: solo salen SKU, canal, mes, conteos, montos agregados y estados del Tracker de un catálogo cerrado (nunca nombres, correos, pedidos ni texto libre).
import {rovaqLogoSvg} from '../../../../../packages/workspace-service/marca.mjs';
import {NOMBRE, ESTADO_TXT, HOJA_TXT, usd as usdBase, num as numBase, pct as pctBase, mesLargo as mesLargoBase, dia} from './fuga-modelo.mjs';

/** Una celda de CSV: comillas dobles escapadas y, si empieza con = + - @ (fórmula en una hoja de cálculo), se antepone una comilla simple. Los números pasan tal cual. */
export function celda(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '';
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? '"' + s.replaceAll('"', '""') + '"' : s;
}
export const csv = (filas, encabezado) => '﻿' + [encabezado, ...filas].map(f => f.map(celda).join(',')).join('\r\n') + '\r\n';
export const esc = s => String(s ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const cents = m => (m === null || m === undefined ? '' : (Number(BigInt(String(m).split('.')[0])) / 100).toFixed(2));
const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'sku';
const hoy = v => (v?.generatedAt ?? new Date().toISOString()).slice(0, 10);

/** Fuentes y cobertura que acompañan a cada archivo. */
/** Líneas «de dónde sale cada cifra». Sin idioma: español (los documentos y CSV conservan su texto); la pantalla pasa el idioma activo. */
export function proveniencia(v, idioma = 'es') {
  const en = idioma === 'en';
  return [
    en ? 'Source of refunds and orders: economic ledger loaded into Rovaq (Amazon and Walmart; effective date in UTC). USD only; other currencies are not added.'
      : 'Fuente de reembolsos y pedidos: libro económico cargado en Rovaq (Amazon y Walmart; fecha efectiva en UTC). Solo USD; otras monedas no se suman.',
    en ? 'Source of reason and status: the customer’s Excel Tracker (Refunds, Tool warranty, Parts warranty and Labels sheets; latest revision of each row; the WTR/WPR mirrors are not added). Tracker amount: no currency declared, USD is assumed.'
      : 'Fuente del motivo y estado: Tracker de Excel del cliente (hojas Reembolsos, Garantía de herramientas, Garantía de partes y Etiquetas; última revisión de cada fila; los espejos WTR/WPR no se suman). Monto del Tracker: moneda no declarada, se supone USD.',
    en ? `Export windows: ${v.todasParciales ? 'none is marked as complete' : 'some windows are partial'}. Lines sold cover only each channel’s order window; there is no quantity per line.`
      : `Ventanas de exportación: ${v.todasParciales ? 'ninguna está marcada como completa' : 'hay ventanas parciales'}. Las líneas vendidas cubren solo la ventana de pedidos de cada canal; no hay cantidad por línea.`,
    en ? `Generated ${dia(v.generatedAt, idioma)} from Rovaq. Observed = recorded in the source; it proves neither cause nor responsibility.`
      : `Generado ${dia(v.generatedAt)} desde Rovaq. Observado = registrado en la fuente; no prueba causa ni responsabilidad.`,
  ];
}
/** Selector de variante por idioma: «es» es el texto histórico, byte a byte; cualquier otro valor distinto de «en» cae a «es». */
const par = idioma => (es, en) => (idioma === 'en' ? en : es);
const ESTADO_EN = Object.freeze({reembolsado: 'Refunded', vencido: 'Over 180 days', no_reembolsable: 'Not refundable', rechazado: 'Rejected', enviado: 'Submitted', otro: 'Other status', sin_estado: 'No status'});
const HOJA_EN = Object.freeze({reembolsos: 'Refunds', garantiaHerramientas: 'Tool warranty', garantiaPartes: 'Parts warranty', etiquetas: 'Return labels'});
const NOMBRE_EN = Object.freeze({...NOMBRE, tienda: 'Own store', otro: 'Other'});
const nombreDe = idioma => (idioma === 'en' ? NOMBRE_EN : NOMBRE);
const estadoDe = idioma => (idioma === 'en' ? ESTADO_EN : ESTADO_TXT);
const hojaDe = idioma => (idioma === 'en' ? HOJA_EN : HOJA_TXT);
export const NO_SE_SABE = ['La cantidad de unidades (el libro trae una fila por línea de pedido).', 'La causa del reembolso: el libro no trae motivo y la causa no está registrada.', 'Los tickets sin SKU: solo una pequeña parte tiene SKU, por el Tracker.', 'El vínculo reembolso-pedido de Walmart (los identificadores no coinciden).', 'Una tasa de reembolso del SKU: las ventanas no son iguales ni hay cantidad.'];
/** Mismas cinco frases en inglés (una prueba las compara con tr.fuga.nss0..4 del diccionario). */
export const NO_SE_SABE_EN = ['The number of units. The ledger has one row per order line.', 'The cause of the refund: the ledger carries no reason and the cause is not recorded.', 'Tickets without a SKU: only a small share has a SKU, through the Tracker.', 'The refund-to-order link for Walmart. The identifiers do not match.', 'A refund rate for the SKU: the windows are not equal and there is no quantity.'];
export const noSeSabe = idioma => (idioma === 'en' ? NO_SE_SABE_EN : NO_SE_SABE);

/** Datos del SKU para el paquete: todo sale de la vista ya cargada. */
export function datosSku(v, sku) {
  const fila = v.skus?.top?.find(r => r.sku === sku) ?? null;
  const meses = (v.skus?.detalleMensual ?? []).filter(m => m.sku === sku);
  const tr = v.tracker?.bySku?.[sku] ?? null;
  return {fila, meses, tr};
}

const ESTILO_PAQUETE = 'body{font:14px/1.55 system-ui,sans-serif;color:#0E0E10;max-width:860px;margin:32px auto;padding:0 20px}h1{font-size:22px;margin:0 0 4px}h2{font-size:15px;margin:28px 0 8px}p{margin:6px 0}.m{color:#5a5a61;font-size:12.5px}table{border-collapse:collapse;width:100%;margin:6px 0;font-size:13px}th,td{border-bottom:1px solid #dcdde2;padding:6px 8px;text-align:left}th{font-size:12px;color:#5a5a61}td.n{font-variant-numeric:tabular-nums}.k{display:inline-block;border:1px solid #0E0E10;color:#0E0E10;background:#f1f1f2;border-radius:999px;padding:1px 9px;font-size:11.5px}ul{padding-left:20px}@media print{body{margin:12px}}';
/**
 * [HTML, CSV] del «Paquete de evidencia para proveedor» de un SKU. Documento PARA UN TERCERO: `idioma` ('es' | 'en', por omisión 'es' = texto histórico byte a byte) lo elige quien lo genera.
 * `rotulos` ({motivo, submotivo}: funciones rótulo -> rótulo) traduce los motivos del Tracker, que son datos agrupados en español; sin ellas salen como vienen.
 */
export function paqueteEvidencia(v, sku, idioma = 'es', rotulos = {}) {
  const {fila, meses, tr} = datosSku(v, sku);
  if (!fila) return null;
  const L = par(idioma), NOMBRE = nombreDe(idioma), ESTADO_TXT = estadoDe(idioma), HOJA_TXT = hojaDe(idioma), noSabe = noSeSabe(idioma), prov = proveniencia(v, idioma);
  const mot = r => rotulos.motivo?.(r) ?? r, sub = r => rotulos.submotivo?.(r) ?? r;
  const usd = (m, o = {}) => usdBase(m, {...o, idioma}), num = n => numBase(n, idioma), pct = p => pctBase(p, idioma), mesLargo = m => mesLargoBase(m, idioma);
  const nd = L('n/d', 'n/a');
  const t1 = (cab, filas) => `<table><thead><tr>${cab.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${filas.map(f => `<tr>${f.map((c, i) => `<td${i ? ' class="n"' : ''}>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const canales = fila.canales.map(c => [NOMBRE[c.canal] ?? c.canal, num(c.n), usd(c.usdBrutoMinor, {decimals: true}), usd(c.usdNetoMinor, {decimals: true}), c.lineas === null ? nd : num(c.lineas)]);
  const porMes = meses.map(m => [mesLargo(m.mes), NOMBRE[m.canal] ?? m.canal, num(m.n), usd(m.usdBrutoMinor, {decimals: true})]);
  const hojas = tr ? Object.entries(tr.hojas).map(([h, n]) => [HOJA_TXT[h] ?? h, num(n)]) : [];
  const motivos = tr ? Object.entries(tr.motivos).sort((a, b) => b[1] - a[1]).map(([k, n]) => [mot(k), num(n)]) : [];
  const subm = tr ? Object.entries(tr.submotivos).sort((a, b) => b[1] - a[1]).map(([k, n]) => [sub(k), num(n)]) : [];
  const est = tr ? Object.entries(tr.estados).map(([k, n]) => [ESTADO_TXT[k] ?? k, num(n)]) : [];
  const html = `<!doctype html><html lang="${L('es', 'en')}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${L('Paquete de evidencia', 'Evidence package')} · ${esc(sku)}</title>
<style>${ESTILO_PAQUETE}</style></head><body>
<header style="padding:14px 0 14px">${rovaqLogoSvg({ancho: 120})}</header>
<h1>${L('Paquete de evidencia · SKU', 'Evidence package · SKU')} ${esc(sku)}</h1><p class="m"><span class="k">${L('Observado', 'Observed')}</span> ${esc(prov[3])}</p>
<h2>${L('Resumen', 'Summary')}</h2><p>${L(`${num(fila.n)} reembolsos por ${esc(usd(fila.usdBrutoMinor, {decimals: true}))} brutos (${esc(usd(fila.usdNetoMinor, {decimals: true}))} sin reembolsos cancelados). Posición ${fila.pos} entre los SKU del libro; ${pct(fila.acumPct)} acumulado del dinero devuelto hasta este SKU.`, `${num(fila.n)} refunds for ${esc(usd(fila.usdBrutoMinor, {decimals: true}))} gross (${esc(usd(fila.usdNetoMinor, {decimals: true}))} excluding canceled refunds). Rank ${fila.pos} among the SKUs in the ledger; ${pct(fila.acumPct)} cumulative of the money refunded up to this SKU.`)}</p>
<h2>${L('Por canal', 'By channel')}</h2>${t1([L('Canal', 'Channel'), L('Reembolsos', 'Refunds'), L('USD bruto', 'USD gross'), L('USD sin cancelados', 'USD excluding canceled'), L('Líneas vendidas en la ventana', 'Lines sold in the window')], canales)}
<h2>${L('Reembolsos por mes y canal', 'Refunds by month and channel')}</h2>${porMes.length ? t1([L('Mes', 'Month'), L('Canal', 'Channel'), L('Reembolsos', 'Refunds'), L('USD bruto', 'USD gross')], porMes) : `<p class="m">${L('Sin detalle mensual para este SKU.', 'No monthly detail for this SKU.')}</p>`}
<h2>${L('Tracker de Excel', 'Excel Tracker')}</h2>${tr ? t1([L('Hoja', 'Sheet'), L('Filas', 'Rows')], hojas) + (motivos.length ? `<h2>${L('Motivo de contacto', 'Contact reason')}</h2>` + t1([L('Motivo', 'Reason'), L('Filas', 'Rows')], motivos) : '') + (subm.length ? `<h2>${L('Subrazón', 'Sub-reason')}</h2>` + t1([L('Subrazón', 'Sub-reason'), L('Filas', 'Rows')], subm) : '') + (est.length ? `<h2>${L('Estado de los reembolsos solicitados', 'Status of the requested refunds')}</h2>` + t1([L('Estado', 'Status'), L('Filas', 'Rows')], est) : '') : `<p class="m">${L('Este SKU no aparece en el Tracker: solo hay reembolsos del libro y no hay motivo registrado.', 'This SKU does not appear in the Tracker: there are only ledger refunds and no recorded reason.')}</p>`}
<h2>${L('Lo que este paquete no prueba', 'What this package does not prove')}</h2><ul>${noSabe.map(x => `<li>${esc(x)}</li>`).join('')}</ul><p class="m">${L('No prueba causa de defecto ni responsabilidad del proveedor: ordena la evidencia para negociar.', 'It proves neither the cause of a defect nor the supplier’s responsibility: it organizes the evidence to negotiate.')}</p>
<h2>${L('De dónde sale cada cifra', 'Where each figure comes from')}</h2><ul>${prov.map(x => `<li>${esc(x)}</li>`).join('')}</ul></body></html>`;
  const filas = [
    [L('resumen', 'summary'), 'sku', sku, ''], [L('resumen', 'summary'), L('reembolsos', 'refunds'), fila.n, L('libro', 'ledger')], [L('resumen', 'summary'), L('usd_bruto', 'usd_gross'), cents(fila.usdBrutoMinor), L('libro; todos los estados', 'ledger; all statuses')], [L('resumen', 'summary'), L('usd_sin_cancelados', 'usd_excluding_canceled'), cents(fila.usdNetoMinor), L('libro', 'ledger')],
    ...fila.canales.map(c => [L('canal', 'channel'), c.canal, c.n, `${L('usd_bruto', 'usd_gross')}=${cents(c.usdBrutoMinor)}; ${L('lineas_ventana', 'window_lines')}=${c.lineas ?? nd}`]),
    ...meses.map(m => [L('mes_canal', 'month_channel'), `${m.mes} ${m.canal}`, m.n, `${L('usd_bruto', 'usd_gross')}=${cents(m.usdBrutoMinor)}`]),
    ...(tr ? [...Object.entries(tr.hojas).map(([h, n]) => [L('tracker_hoja', 'tracker_sheet'), HOJA_TXT[h] ?? h, n, '']), ...Object.entries(tr.motivos).map(([k, n]) => [L('tracker_motivo', 'tracker_reason'), mot(k), n, '']), ...Object.entries(tr.submotivos).map(([k, n]) => [L('tracker_subrazon', 'tracker_subreason'), sub(k), n, '']), ...Object.entries(tr.estados).map(([k, n]) => [L('tracker_estado', 'tracker_status'), ESTADO_TXT[k] ?? k, n, ''])] : [['tracker', L('sin_filas', 'no_rows'), 0, L('el SKU no aparece en el Tracker', 'the SKU does not appear in the Tracker')]]),
    ...noSabe.map(x => [L('no_se_sabe', 'not_known'), x, '', '']), ...prov.map(x => [L('fuente', 'source'), x, '', '']),
  ];
  const nom = L(`evidencia-${slug(sku)}-${hoy(v)}`, `evidence-${slug(sku)}-${hoy(v)}`);
  return {html: {nombre: `${nom}.html`, mime: 'text/html;charset=utf-8', contenido: html}, csv: {nombre: `${nom}.csv`, mime: 'text/csv;charset=utf-8', contenido: csv(filas, [L('seccion', 'section'), L('clave', 'key'), L('valor', 'value'), L('detalle', 'detail')])}};
}

/** CSV «Lista de SKUs a revisar con Walmart»: ordenada por USD reembolsado, con líneas de la ventana y la advertencia de intensidad. `idioma` ('es' por omisión = texto histórico) lo elige quien lo genera. */
export function listaWalmart(v, idioma = 'es') {
  const L = par(idioma), lista = v.skus?.walmart ?? [], prov = proveniencia(v, idioma);
  const filas = lista.map((w, i) => [i + 1, w.sku, w.n, cents(w.usdBrutoMinor), cents(w.usdNetoMinor), w.lineas === null ? '' : w.lineas, w.lineas && w.n > w.lineas ? L('mas reembolsos que lineas en la ventana: revisar ventanas', 'more refunds than lines in the window: check the windows') : '', v.tracker?.bySku?.[w.sku] ? Object.values(v.tracker.bySku[w.sku].hojas).reduce((a, n) => a + n, 0) : 0]);
  const cabecera = L(['posicion', 'sku', 'reembolsos_walmart', 'usd_bruto', 'usd_sin_cancelados', 'lineas_vendidas_ventana', 'senal', 'filas_tracker'], ['rank', 'sku', 'walmart_refunds', 'usd_gross', 'usd_excluding_canceled', 'lines_sold_in_window', 'signal', 'tracker_rows']);
  const nota = L(`"Nota","Señal para investigar, no una tasa: las ventanas de Walmart (pedidos y reembolsos) no coinciden y el libro no trae cantidad. ${prov[3]}"`, `"Note","A signal to investigate, not a rate: Walmart’s windows (orders and refunds) do not match and the ledger has no quantity. ${prov[3]}"`);
  return {nombre: L(`skus-a-revisar-walmart-${hoy(v)}.csv`, `skus-to-review-walmart-${hoy(v)}.csv`), mime: 'text/csv;charset=utf-8', contenido: csv(filas, cabecera) + '\r\n' + [nota].join('\r\n') + '\r\n', total: lista.length};
}

/** CSV «Cola de reembolsos vencidos o negados» recalculada de las filas del Tracker. `rotulos` ({motivo, submotivo}) traduce los motivos del Tracker; sin ellas salen como vienen. */
export function colaVencidos(v, idioma = 'es', rotulos = {}) {
  const L = par(idioma), NOMBRE = nombreDe(idioma), ESTADO_TXT = estadoDe(idioma), cola = v.tracker?.cola ?? [];
  const mot = r => (r ? rotulos.motivo?.(r) ?? r : r), sub = r => (r ? rotulos.submotivo?.(r) ?? r : r);
  const filas = cola.map(c => [c.fila, ESTADO_TXT[c.estado] ?? c.estado, c.sku ?? '', mot(c.motivo) ?? '', sub(c.submotivo) ?? '', c.retailer ? NOMBRE[c.retailer] ?? c.retailer : '', c.montoMinor === null ? '' : (c.montoMinor / 100).toFixed(2), c.fecha ?? '']);
  const cabecera = L(['fila_tracker', 'estado', 'sku', 'motivo', 'subrazon', 'canal', 'monto_supuesto_usd', 'fecha_solicitud'], ['tracker_row', 'status', 'sku', 'reason', 'sub_reason', 'channel', 'assumed_amount_usd', 'request_date']);
  return {nombre: L(`cola-reembolsos-negados-${hoy(v)}.csv`, `queue-denied-refunds-${hoy(v)}.csv`), mime: 'text/csv;charset=utf-8', contenido: csv(filas, cabecera), total: cola.length};
}


/**
 * Borrador del mensaje para el proveedor/retailer: solo cifras observadas del libro y del Tracker, sin PII y sin atribuir causa. Un humano lo revisa y lo envía.
 * Es un documento PARA UN TERCERO: `idioma` ('es' por omisión) lo elige quien lo genera, no el de la interfaz.
 */
export function mensajeReclamo(v, sku, idioma = 'es') {
  const {fila, tr} = datosSku(v, sku);
  if (!fila) return null;
  const L = par(idioma), NOMBRE = nombreDe(idioma), lg = idioma === 'en' ? 'en' : undefined;
  const usd = m => usdBase(m, {decimals: true, idioma: lg}), num = n => numBase(n, lg);
  const canales = fila.canales.map(c => `${NOMBRE[c.canal] ?? c.canal}: ${L(`${num(c.n)} reembolsos por ${usd(c.usdBrutoMinor)}`, `${num(c.n)} refunds for ${usd(c.usdBrutoMinor)}`)}`);
  const asunto = L(`Revisión de reembolsos del SKU ${sku}`, `Review of refunds for SKU ${sku}`);
  const cuerpo = [
    L('Hola,', 'Hello,'), '',
    L(`Estamos revisando los reembolsos del SKU ${sku}. En el libro registramos ${num(fila.n)} reembolsos por ${usd(fila.usdBrutoMinor)} brutos (${usd(fila.usdNetoMinor)} sin los cancelados), posición ${fila.pos} entre nuestros SKU.`, `We are reviewing the refunds for SKU ${sku}. The ledger records ${num(fila.n)} refunds for ${usd(fila.usdBrutoMinor)} gross (${usd(fila.usdNetoMinor)} excluding canceled ones), rank ${fila.pos} among our SKUs.`),
    ...(canales.length ? ['', L('Por canal:', 'By channel:'), ...canales.map(c => `• ${c}`)] : []),
    ...(tr ? ['', L(`En nuestro seguimiento de solicitudes (Tracker) hay ${num(Object.values(tr.hojas).reduce((a, n) => a + n, 0))} filas relacionadas con este SKU.`, `Our request tracking (Tracker) has ${num(Object.values(tr.hojas).reduce((a, n) => a + n, 0))} rows related to this SKU.`)] : []),
    '', L('Adjuntamos el paquete de evidencia (resumen, detalle por canal y mes, y de dónde sale cada cifra). Te pedimos revisar estos casos y confirmarnos qué corresponde acreditar o corregir.', 'We attach the evidence package (summary, detail by channel and month, and where each figure comes from). Please review these cases and confirm what should be credited or corrected.'),
    '', L('Este paquete ordena la evidencia para conversar; no establece por sí mismo la causa del defecto ni la responsabilidad de ninguna de las partes.', 'This package organizes the evidence for discussion; by itself it does not establish the cause of the defect or the responsibility of either party.'),
    '', L('Gracias,', 'Thank you,'),
  ].join('\n');
  return {asunto, cuerpo};
}
