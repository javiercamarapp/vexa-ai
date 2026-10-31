// Archivos locales de «Brechas de ingreso» (HTML/CSV). Se generan EN EL NAVEGADOR con lo que la pantalla ya tiene; no se envía nada. Sin PII por construcción: solo SKU, canal, mes, familias, conteos y montos agregados.
import {rovaqLogoSvg} from '../../../../../packages/workspace-service/marca.mjs';
import {csv, esc} from '../refunds/fuga-archivos.mjs';
import {NOMBRE, usd, num, pct, dia, variacion, TIPO_REC} from './gaps-modelo.mjs';

const cents = m => (m === null || m === undefined ? '' : (Number(BigInt(String(m).split('.')[0])) / 100).toFixed(2));
const hoy = v => (v?.generatedAt ?? new Date().toISOString()).slice(0, 10);
/** Fuentes y cobertura que acompañan a cada archivo. */
/** Líneas «de dónde sale cada cifra». Sin idioma: español (los documentos y CSV conservan su texto); la pantalla pasa el idioma activo. */
export function proveniencia(v, idioma = 'es') {
  const i = v.ingresos?.status === 'ok' ? v.ingresos : null, en = idioma === 'en';
  return [
    en ? 'Revenue: Rovaq order ledger (Amazon, Walmart, Best Buy and Shopify), latest revision of each line, in USD, excluding canceled. It is GROSS REVENUE: there is no cost or margin per product.'
      : 'Ingreso: libro de pedidos de Rovaq (Amazon, Walmart, Best Buy y Shopify), última revisión de cada línea, en USD, sin cancelados. Es INGRESO BRUTO: no hay costo ni margen por producto.',
    en ? 'Refunds: refund ledger (latest revision). “Excluding canceled” removes canceled ones. CAD and MXN are never added.'
      : 'Reembolsos: libro de reembolsos (última revisión). «Sin cancelados» quita los cancelados. CAD y MXN nunca se suman.',
    en ? `Partial export windows${i ? ` (${i.canales.map(c => `${NOMBRE[c.canal] ?? c.canal} since ${dia(c.desde, idioma)}`).join(', ')})` : ''}. Intensity = refunds of the month divided by revenue of the same month, same SKU and channel; it is not a cohort rate.`
      : `Ventanas de exportación parciales${i ? ` (${i.canales.map(c => `${NOMBRE[c.canal] ?? c.canal} desde ${dia(c.desde)}`).join(', ')})` : ''}. Intensidad = reembolsos del mes entre ingreso del mismo mes, mismo SKU y canal; no es tasa por cohorte.`,
    en ? `Generated ${dia(v.generatedAt, idioma)} from Rovaq. Observed = recorded in the source. Recommendations are rules over observed data, not proof of cause.`
      : `Generado ${dia(v.generatedAt)} desde Rovaq. Observado = registrado en la fuente. Las recomendaciones son reglas sobre datos observados, no pruebas de causa.`,
  ];
}
/** CSV del ranking de ingreso por SKU. */
export function csvIngresos(v) {
  const it = v.ranking?.items ?? [];
  const filas = it.map(r => [r.pos, r.sku, r.familia ?? '', cents(r.activoMinor), r.participacionPct ?? '', r.acumPct ?? '', r.lineas, r.canales.map(c => `${c.canal}=${cents(c.activoMinor)}`).join('; '), r.crecimiento ? `${r.crecimiento.canal} ${r.crecimiento.previo}->${r.crecimiento.mes} ${r.crecimiento.pct}` : '']);
  return {nombre: `ingreso-por-sku-${hoy(v)}.csv`, mime: 'text/csv;charset=utf-8', total: it.length,
    contenido: csv(filas, ['posicion', 'sku', 'familia', 'ingreso_bruto_usd_sin_cancelados', 'participacion_pct', 'acumulado_pct', 'lineas', 'por_canal_usd', 'mes_contra_mes_pct']) + '\r\n' + proveniencia(v).map(x => `"${x.replaceAll('"', '""')}"`).join('\r\n') + '\r\n'};
}
/** CSV de intensidad de reembolso por SKU y canal. */
export function csvIntensidad(v) {
  const it = v.intensidad?.filas ?? [], med = v.intensidad?.medianaCanal ?? {};
  const filas = it.map(f => [f.sku, f.canal, f.meses, cents(f.ingresoMinor), f.lineas, f.reembolsos, cents(f.reembolsoMinor), f.intensidadPct ?? '', med[f.canal] ?? '', f.significativa ? 'si' : 'no']);
  return {nombre: `intensidad-reembolso-${hoy(v)}.csv`, mime: 'text/csv;charset=utf-8', total: it.length,
    contenido: csv(filas, ['sku', 'canal', 'meses_con_cruce', 'ingreso_bruto_usd', 'lineas', 'reembolsos', 'reembolsos_usd_sin_cancelados', 'intensidad_pct', 'mediana_canal_pct', 'senal_suficiente']) + '\r\n' + [`"Nota","${(v.intensidad?.nota ?? '').replaceAll('"', '""')}"`, ...proveniencia(v).map(x => `"${x.replaceAll('"', '""')}"`)].join('\r\n') + '\r\n'};
}
/** CSV de recomendaciones con su evidencia. */
export function csvRecomendaciones(v) {
  const it = v.recomendaciones?.items ?? [];
  const filas = it.map(r => [r.id, TIPO_REC[r.tipo] ?? r.tipo, r.titulo, r.accion, r.porque, r.evidencia.join(' | '), r.cobertura, r.impacto.clase === 'observed' ? 'Observado' : 'Estimado', cents(r.impacto.usdMinor)]);
  return {nombre: `recomendaciones-con-evidencia-${hoy(v)}.csv`, mime: 'text/csv;charset=utf-8', total: it.length, contenido: csv(filas, ['id', 'tipo', 'titulo', 'accion', 'por_que', 'evidencia', 'cobertura', 'clase_del_impacto', 'impacto_ingreso_bruto_usd'])};
}
/** HTML resumen para llevar a una reunión (sin PII). */
export function resumenHtml(v) {
  const i = v.ingresos?.status === 'ok' ? v.ingresos : null, r = v.perdidas?.reembolsos?.status === 'ok' ? v.perdidas.reembolsos : null;
  const t = (cab, filas) => `<table><thead><tr>${cab.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${filas.map(f => `<tr>${f.map((c, k) => `<td${k ? ' class="n"' : ''}>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const top = (v.ranking?.items ?? []).slice(0, 10).map(x => [x.pos, x.sku, usd(x.activoMinor), pct(x.participacionPct), pct(x.acumPct), x.crecimiento ? variacion(x.crecimiento.pct) : '—']);
  const recs = (v.recomendaciones?.items ?? []).slice(0, 8);
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Brechas de ingreso · ${esc(hoy(v))}</title>
<style>body{font:14px/1.55 system-ui,sans-serif;color:#0E0E10;max-width:860px;margin:32px auto;padding:0 20px}h1{font-size:22px;margin:0 0 4px}h2{font-size:15px;margin:28px 0 8px}p{margin:6px 0}.m{color:#5a5a61;font-size:12.5px}table{border-collapse:collapse;width:100%;margin:6px 0;font-size:13px}th,td{border-bottom:1px solid #dcdde2;padding:6px 8px;text-align:left}th{font-size:12px;color:#5a5a61}td.n{font-variant-numeric:tabular-nums}.k{display:inline-block;border:1px solid #0E0E10;background:#f1f1f2;border-radius:999px;padding:1px 9px;font-size:11.5px}.big{font-size:40px;font-weight:700;letter-spacing:-.03em}ul{padding-left:20px}@media print{body{margin:12px}}</style></head><body>
<header style="padding:14px 0">${rovaqLogoSvg({ancho: 120})}</header>
<h1>Brechas de ingreso</h1><p class="m"><span class="k">Observado</span> ${esc(proveniencia(v)[3])}</p>
${i ? `<p class="big">${esc(usd(i.activoMinor))}</p><p class="m">ingreso bruto observado en USD, sin cancelados. ${esc(proveniencia(v)[2])}</p>` : '<p class="m">El ingreso no está disponible ahora.</p>'}
${r ? `<h2>Dónde pierdo</h2><p>Dinero devuelto: ${esc(usd(r.brutoMinor))} bruto y ${esc(usd(r.activoMinor))} sin cancelados (${esc(num(r.n))} reembolsos). Cancelaciones: ${esc(num(i?.canceladas ?? 0))} líneas (${esc(pct(i?.canceladasPct))}), ${esc(usd(i?.canceladoMinor))}.</p>` : ''}
<h2>Dónde gano: los 10 SKUs</h2>${top.length ? t(['#', 'SKU', 'Ingreso bruto', 'Participación', 'Acumulado', 'Mes contra mes'], top) : '<p class="m">Sin ranking disponible.</p>'}
<h2>Recomendaciones con evidencia</h2>${recs.length ? `<ul>${recs.map(x => `<li><b>${esc(x.titulo)}</b>. ${esc(x.porque)} <span class="m">${esc(x.impacto.texto)}</span></li>`).join('')}</ul>` : '<p class="m">Ninguna regla se cumple con los datos de hoy.</p>'}
<h2>De dónde sale cada cifra</h2><ul>${proveniencia(v).map(x => `<li>${esc(x)}</li>`).join('')}</ul></body></html>`;
  return {nombre: `brechas-de-ingreso-${hoy(v)}.html`, mime: 'text/html;charset=utf-8', contenido: html, total: 1};
}
