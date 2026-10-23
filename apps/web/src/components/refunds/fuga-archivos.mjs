// Archivos de «un clic» de Fuga de reembolsos. Se generan EN EL NAVEGADOR a partir de lo que la pantalla ya tiene; no se envía nada a ningún lado.
// Sin PII por construcción: solo salen SKU, canal, mes, conteos, montos agregados y estados del Tracker de un catálogo cerrado (nunca nombres, correos, pedidos ni texto libre).
import {NOMBRE, ESTADO_TXT, HOJA_TXT, usd, num, pct, mesLargo, dia} from './fuga-modelo.mjs';

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
export function proveniencia(v) {
  return [
    'Fuente de reembolsos y pedidos: libro económico cargado en Rovaq (Amazon y Walmart; fecha efectiva en UTC). Solo USD; otras monedas no se suman.',
    'Fuente del motivo y estado: Tracker de Excel del cliente (hojas Reembolsos, Garantía de herramientas, Garantía de partes y Etiquetas; última revisión de cada fila; los espejos WTR/WPR no se suman). Monto del Tracker: moneda no declarada, se supone USD.',
    `Ventanas de exportación: ${v.todasParciales ? 'ninguna está marcada como completa' : 'hay ventanas parciales'}. Las líneas vendidas cubren solo la ventana de pedidos de cada canal; no hay cantidad por línea.`,
    `Generado ${dia(v.generatedAt)} desde Rovaq. Observado = registrado en la fuente; no prueba causa ni responsabilidad.`,
  ];
}
export const NO_SE_SABE = ['La cantidad de unidades (el libro trae una fila por línea de pedido).', 'La causa del reembolso: el libro no trae motivo y la causa no está registrada.', 'Los tickets sin SKU: solo una pequeña parte tiene SKU, por el Tracker.', 'El vínculo reembolso-pedido de Walmart (los identificadores no coinciden).', 'Una tasa de reembolso del SKU: las ventanas no son iguales ni hay cantidad.'];

/** Datos del SKU para el paquete: todo sale de la vista ya cargada. */
export function datosSku(v, sku) {
  const fila = v.skus?.top?.find(r => r.sku === sku) ?? null;
  const meses = (v.skus?.detalleMensual ?? []).filter(m => m.sku === sku);
  const tr = v.tracker?.bySku?.[sku] ?? null;
  return {fila, meses, tr};
}

/** [HTML, CSV] del «Paquete de evidencia para proveedor» de un SKU. */
export function paqueteEvidencia(v, sku) {
  const {fila, meses, tr} = datosSku(v, sku);
  if (!fila) return null;
  const t1 = (cab, filas) => `<table><thead><tr>${cab.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${filas.map(f => `<tr>${f.map((c, i) => `<td${i ? ' class="n"' : ''}>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const canales = fila.canales.map(c => [NOMBRE[c.canal] ?? c.canal, num(c.n), usd(c.usdBrutoMinor, {decimals: true}), usd(c.usdNetoMinor, {decimals: true}), c.lineas === null ? 'n/d' : num(c.lineas)]);
  const porMes = meses.map(m => [mesLargo(m.mes), NOMBRE[m.canal] ?? m.canal, num(m.n), usd(m.usdBrutoMinor, {decimals: true})]);
  const hojas = tr ? Object.entries(tr.hojas).map(([h, n]) => [HOJA_TXT[h] ?? h, num(n)]) : [];
  const motivos = tr ? Object.entries(tr.motivos).sort((a, b) => b[1] - a[1]).map(([k, n]) => [k, num(n)]) : [];
  const subm = tr ? Object.entries(tr.submotivos).sort((a, b) => b[1] - a[1]).map(([k, n]) => [k, num(n)]) : [];
  const est = tr ? Object.entries(tr.estados).map(([k, n]) => [ESTADO_TXT[k] ?? k, num(n)]) : [];
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Paquete de evidencia · ${esc(sku)}</title>
<style>body{font:14px/1.55 system-ui,sans-serif;color:#17100d;max-width:860px;margin:32px auto;padding:0 20px}h1{font-size:22px;margin:0 0 4px}h2{font-size:15px;margin:28px 0 8px}p{margin:6px 0}.m{color:#616876;font-size:12.5px}table{border-collapse:collapse;width:100%;margin:6px 0;font-size:13px}th,td{border-bottom:1px solid #dcdde2;padding:6px 8px;text-align:left}th{font-size:12px;color:#616876}td.n{font-variant-numeric:tabular-nums}.k{display:inline-block;border:1px solid #2a78d6;color:#17100d;background:#e8f1fc;border-radius:999px;padding:1px 9px;font-size:11.5px}ul{padding-left:20px}@media print{body{margin:12px}}</style></head><body>
<h1>Paquete de evidencia · SKU ${esc(sku)}</h1><p class="m"><span class="k">Observado</span> ${esc(proveniencia(v)[3])}</p>
<h2>Resumen</h2><p>${num(fila.n)} reembolsos por ${esc(usd(fila.usdBrutoMinor, {decimals: true}))} brutos (${esc(usd(fila.usdNetoMinor, {decimals: true}))} sin reembolsos cancelados). Posición ${fila.pos} entre los SKU del libro; ${pct(fila.acumPct)} acumulado del dinero devuelto hasta este SKU.</p>
<h2>Por canal</h2>${t1(['Canal', 'Reembolsos', 'USD bruto', 'USD sin cancelados', 'Líneas vendidas en la ventana'], canales)}
<h2>Reembolsos por mes y canal</h2>${porMes.length ? t1(['Mes', 'Canal', 'Reembolsos', 'USD bruto'], porMes) : '<p class="m">Sin detalle mensual para este SKU.</p>'}
<h2>Tracker de Excel</h2>${tr ? t1(['Hoja', 'Filas'], hojas) + (motivos.length ? '<h2>Motivo de contacto</h2>' + t1(['Motivo', 'Filas'], motivos) : '') + (subm.length ? '<h2>Subrazón</h2>' + t1(['Subrazón', 'Filas'], subm) : '') + (est.length ? '<h2>Estado de los reembolsos solicitados</h2>' + t1(['Estado', 'Filas'], est) : '') : '<p class="m">Este SKU no aparece en el Tracker: solo hay reembolsos del libro y no hay motivo registrado.</p>'}
<h2>Lo que este paquete no prueba</h2><ul>${NO_SE_SABE.map(x => `<li>${esc(x)}</li>`).join('')}</ul><p class="m">No prueba causa de defecto ni responsabilidad del proveedor: ordena la evidencia para negociar.</p>
<h2>De dónde sale cada cifra</h2><ul>${proveniencia(v).map(x => `<li>${esc(x)}</li>`).join('')}</ul></body></html>`;
  const filas = [
    ['resumen', 'sku', sku, ''], ['resumen', 'reembolsos', fila.n, 'libro'], ['resumen', 'usd_bruto', cents(fila.usdBrutoMinor), 'libro; todos los estados'], ['resumen', 'usd_sin_cancelados', cents(fila.usdNetoMinor), 'libro'],
    ...fila.canales.map(c => ['canal', c.canal, c.n, `usd_bruto=${cents(c.usdBrutoMinor)}; lineas_ventana=${c.lineas ?? 'n/d'}`]),
    ...meses.map(m => ['mes_canal', `${m.mes} ${m.canal}`, m.n, `usd_bruto=${cents(m.usdBrutoMinor)}`]),
    ...(tr ? [...Object.entries(tr.hojas).map(([h, n]) => ['tracker_hoja', HOJA_TXT[h] ?? h, n, '']), ...Object.entries(tr.motivos).map(([k, n]) => ['tracker_motivo', k, n, '']), ...Object.entries(tr.submotivos).map(([k, n]) => ['tracker_subrazon', k, n, '']), ...Object.entries(tr.estados).map(([k, n]) => ['tracker_estado', ESTADO_TXT[k] ?? k, n, ''])] : [['tracker', 'sin_filas', 0, 'el SKU no aparece en el Tracker']]),
    ...NO_SE_SABE.map(x => ['no_se_sabe', x, '', '']), ...proveniencia(v).map(x => ['fuente', x, '', '']),
  ];
  return {html: {nombre: `evidencia-${slug(sku)}-${hoy(v)}.html`, mime: 'text/html;charset=utf-8', contenido: html}, csv: {nombre: `evidencia-${slug(sku)}-${hoy(v)}.csv`, mime: 'text/csv;charset=utf-8', contenido: csv(filas, ['seccion', 'clave', 'valor', 'detalle'])}};
}

/** CSV «Lista de SKUs a revisar con Walmart»: ordenada por USD reembolsado, con líneas de la ventana y la advertencia de intensidad. */
export function listaWalmart(v) {
  const lista = v.skus?.walmart ?? [];
  const filas = lista.map((w, i) => [i + 1, w.sku, w.n, cents(w.usdBrutoMinor), cents(w.usdNetoMinor), w.lineas === null ? '' : w.lineas, w.lineas && w.n > w.lineas ? 'mas reembolsos que lineas en la ventana: revisar ventanas' : '', v.tracker?.bySku?.[w.sku] ? Object.values(v.tracker.bySku[w.sku].hojas).reduce((a, n) => a + n, 0) : 0]);
  return {nombre: `skus-a-revisar-walmart-${hoy(v)}.csv`, mime: 'text/csv;charset=utf-8', contenido: csv(filas, ['posicion', 'sku', 'reembolsos_walmart', 'usd_bruto', 'usd_sin_cancelados', 'lineas_vendidas_ventana', 'senal', 'filas_tracker']) + '\r\n' + [`"Nota","Señal para investigar, no una tasa: las ventanas de Walmart (pedidos y reembolsos) no coinciden y el libro no trae cantidad. ${proveniencia(v)[3]}"`].join('\r\n') + '\r\n', total: lista.length};
}

/** CSV «Cola de reembolsos vencidos o negados» recalculada de las filas del Tracker. */
export function colaVencidos(v) {
  const cola = v.tracker?.cola ?? [];
  const filas = cola.map(c => [c.fila, ESTADO_TXT[c.estado] ?? c.estado, c.sku ?? '', c.motivo ?? '', c.submotivo ?? '', c.retailer ? NOMBRE[c.retailer] ?? c.retailer : '', c.montoMinor === null ? '' : (c.montoMinor / 100).toFixed(2), c.fecha ?? '']);
  return {nombre: `cola-reembolsos-negados-${hoy(v)}.csv`, mime: 'text/csv;charset=utf-8', contenido: csv(filas, ['fila_tracker', 'estado', 'sku', 'motivo', 'subrazon', 'canal', 'monto_supuesto_usd', 'fecha_solicitud']), total: cola.length};
}
