// Borradores de la acción que genera «Proceder». PURO: no envía nada, no llama a ningún servicio; el humano revisa, copia o descarga y lo envía por su cuenta.
// Sin PII por construcción: todo texto libre pasa por enmascararTerceros y solo salen SKU, canal, conteos, importes agregados y citas ya enmascaradas.
// Rovaq no maneja costos del cliente: el impacto se expresa solo en INGRESO y únicamente cuando existe un dato observado.
import {enmascararTerceros} from '../workspace-service/enmascarar-terceros.mjs';
import {rovaqLogoSvg} from '../workspace-service/marca.mjs';
import {csv, esc} from '../../apps/web/src/components/refunds/fuga-archivos.mjs';
import {etiquetaCategoria} from '../../apps/web/src/lib/legibilidad/categorias.mjs';

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, TEL = /(?<![\w.])\+?\d[\d\s().-]{8,}\d(?![\w.])/g;
/** Texto limpio de PII: enmascara terceros y borra cualquier correo o teléfono que haya sobrevivido. */
export const sinPII = t => enmascararTerceros(String(t ?? '')).replace(EMAIL, '[correo omitido]').replace(TEL, '[teléfono omitido]');
const CANAL = {amazon: 'Amazon', walmart: 'Walmart'};
const usd = m => (m === null || m === undefined || !/^-?\d+$/.test(String(m)) ? null : (Number(BigInt(String(m))) / 100).toLocaleString('en-US', {style: 'currency', currency: 'USD'}));
const hoy = d => (d ?? new Date().toISOString()).slice(0, 10);
const slug = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'recomendacion';

/** Tipo de acción que sugiere la recomendación (heurística de etiqueta; el humano puede generar los demás borradores). */
export function tipoDeRecomendacion(item) {
  const t = `${item?.kind ?? ''} ${item?.title ?? ''}`.toLowerCase();
  if (item?.kind === 'cross_sell' || /cross.?sell|venta cruzada|accessor|accesorio|pre-sale: recommendation/.test(t)) return 'cross_sell';
  if (/supplier|proveedor|defect|warranty|garant|return|devoluci|refund|reembols|damage|dañ/.test(t)) return 'proveedor';
  return 'general';
}

const periodoTxt = p => (p?.inicio && p?.fin ? `${String(p.inicio).slice(0, 10)} a ${String(p.fin).slice(0, 10)}` : 'periodo del alcance seleccionado');
function ficha(i) {
  const item = i.item, titulo = etiquetaCategoria(item.title);
  return {titulo, accion: sinPII(item.action), razon: sinPII(item.rationale), citas: (i.citas ?? []).slice(0, 5).map(c => ({rol: c.role, categoria: etiquetaCategoria(c.category), texto: sinPII(c.quote)})), periodo: periodoTxt(i.periodo), responsable: sinPII(i.responsableNombre || 'Responsable por confirmar'), fecha: i.fechaCompromiso ?? 'por definir', skus: (i.skus ?? []).filter(s => s?.sku).slice(0, 200)};
}
const ENCABEZADO = 'BORRADOR: no se ha enviado nada. Revísalo, ajústalo y envíalo desde tu propio correo.';
const NO_PRUEBA = ['Este borrador ordena la evidencia observada; no demuestra la causa del problema ni la responsabilidad del proveedor.', 'Las cifras son observaciones del periodo indicado, no una estimación de ahorro.'];
const estilo = 'body{font:14px/1.55 "Hanken Grotesk",system-ui,sans-serif;color:#0E0E10;max-width:820px;margin:32px auto;padding:0 20px}h1{font-size:22px;margin:0 0 4px}h2{font-size:15px;margin:24px 0 8px}.b{display:inline-block;background:#0E0E10;color:#fff;border-radius:6px;padding:2px 8px;font-size:12px}.m{color:#5a5a61;font-size:12.5px}table{border-collapse:collapse;width:100%;font-size:13px}th,td{border-bottom:1px solid #ddd;padding:6px 8px;text-align:left}blockquote{margin:6px 0;padding:6px 12px;border-left:3px solid #0E0E10;background:#f4f4f5}';
const pagina = (titulo, cuerpo) => `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(titulo)}</title><style>${estilo}</style></head><body><header>${rovaqLogoSvg({ancho: 120})}</header><p><span class="b">Borrador</span> <span class="m">${esc(ENCABEZADO)}</span></p>${cuerpo}</body></html>`;
const tablaSkus = skus => skus.length ? `<table><thead><tr><th>SKU</th><th>Canal</th><th>Reembolsos</th><th>Importe devuelto (USD)</th></tr></thead><tbody>${skus.map(s => `<tr><td>${esc(s.sku)}</td><td>${esc(CANAL[s.canal] ?? s.canal ?? '')}</td><td>${esc(s.n ?? '')}</td><td>${esc(usd(s.usdBrutoMinor) ?? 'n/d')}</td></tr>`).join('')}</tbody></table>` : '<p class="m">Aún no hay SKUs identificados para este periodo; complétalos antes de enviar.</p>';
const citasHtml = citas => citas.length ? citas.map(c => `<blockquote>${esc(c.texto)}<br><span class="m">${esc(c.categoria)} · ${esc(c.rol)} (texto enmascarado)</span></blockquote>`).join('') : '<p class="m">Sin citas incluidas: agrega solo ejemplos ya enmascarados.</p>';

/** Correo al proveedor o marketplace con el paquete de evidencia (HTML y Markdown). */
export function correoProveedor(i) {
  const f = ficha(i), asunto = `Solicitud de revisión: ${f.titulo}`;
  const md = `# ${asunto}\n\n> ${ENCABEZADO}\n\nHola,\n\nEn el periodo ${f.periodo} observamos un patrón que queremos revisar contigo: **${f.titulo}**.\n\n**Qué proponemos:** ${f.accion}\n\n**Por qué:** ${f.razon}\n\n## SKUs implicados\n\n${f.skus.length ? '| SKU | Canal | Reembolsos | Importe devuelto (USD) |\n|---|---|---|---|\n' + f.skus.map(s => `| ${s.sku} | ${CANAL[s.canal] ?? s.canal ?? ''} | ${s.n ?? ''} | ${usd(s.usdBrutoMinor) ?? 'n/d'} |`).join('\n') : 'Por completar antes de enviar.'}\n\n## Ejemplos observados (enmascarados)\n\n${f.citas.length ? f.citas.map(c => `> ${c.texto}\n> (${c.categoria})`).join('\n\n') : 'Sin citas incluidas.'}\n\n## Lo que este paquete no prueba\n\n${NO_PRUEBA.map(x => '- ' + x).join('\n')}\n\nQuedamos atentos a tu respuesta antes del ${f.fecha}.\n\n${f.responsable}\n`;
  const html = pagina(asunto, `<h1>${esc(asunto)}</h1><p class="m">Para: proveedor o marketplace (agrega el destinatario al enviarlo). Responsable: ${esc(f.responsable)} · Respuesta esperada antes del ${esc(f.fecha)}.</p><p>En el periodo ${esc(f.periodo)} observamos un patrón que queremos revisar contigo: <strong>${esc(f.titulo)}</strong>.</p><h2>Qué proponemos</h2><p>${esc(f.accion)}</p><h2>Por qué</h2><p>${esc(f.razon)}</p><h2>SKUs implicados</h2>${tablaSkus(f.skus)}<h2>Ejemplos observados</h2>${citasHtml(f.citas)}<h2>Lo que este paquete no prueba</h2><ul>${NO_PRUEBA.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`);
  return [{id: 'correo-proveedor-html', titulo: 'Correo al proveedor o marketplace', formato: 'HTML', nombre: `correo-proveedor-${slug(f.titulo)}-${hoy(i.generadoEn)}.html`, mime: 'text/html;charset=utf-8', contenido: html}, {id: 'correo-proveedor-md', titulo: 'Correo al proveedor o marketplace', formato: 'Markdown', nombre: `correo-proveedor-${slug(f.titulo)}-${hoy(i.generadoEn)}.md`, mime: 'text/markdown;charset=utf-8', contenido: md}];
}

/** Respuesta tipo / FAQ para el equipo de atención. */
export function faqEquipo(i) {
  const f = ficha(i);
  const md = `# Respuesta tipo para el equipo: ${f.titulo}\n\n> ${ENCABEZADO}\n\n## Cuándo usarla\n\nCuando un cliente reporte lo que describe la recomendación (${f.periodo}).\n\n## Respuesta sugerida\n\nGracias por avisarnos. Ya estamos revisando este caso con el equipo. ${f.accion}\n\n## Para el agente (interno)\n\n- Motivo de la recomendación: ${f.razon}\n- Responsable: ${f.responsable}; fecha de revisión: ${f.fecha}.\n- No prometas reembolsos ni plazos que no estén confirmados; escala si el cliente reporta un riesgo de seguridad.\n- Nunca copies datos personales del cliente a esta respuesta.\n`;
  const html = pagina('Respuesta tipo: ' + f.titulo, `<h1>Respuesta tipo para el equipo</h1><p class="m">${esc(f.titulo)} · ${esc(f.periodo)}</p><h2>Respuesta sugerida</h2><p>Gracias por avisarnos. Ya estamos revisando este caso con el equipo. ${esc(f.accion)}</p><h2>Para el agente (interno)</h2><ul><li>Motivo: ${esc(f.razon)}</li><li>Responsable: ${esc(f.responsable)}; revisión: ${esc(f.fecha)}.</li><li>No prometas reembolsos ni plazos que no estén confirmados; escala si el cliente reporta un riesgo de seguridad.</li><li>Nunca copies datos personales del cliente a esta respuesta.</li></ul>`);
  return [{id: 'faq-equipo-md', titulo: 'Respuesta tipo / FAQ para el equipo', formato: 'Markdown', nombre: `faq-equipo-${slug(f.titulo)}-${hoy(i.generadoEn)}.md`, mime: 'text/markdown;charset=utf-8', contenido: md}, {id: 'faq-equipo-html', titulo: 'Respuesta tipo / FAQ para el equipo', formato: 'HTML', nombre: `faq-equipo-${slug(f.titulo)}-${hoy(i.generadoEn)}.html`, mime: 'text/html;charset=utf-8', contenido: html}];
}

/** CSV de SKUs a revisar con cada marketplace (uno por canal presente). Sin SKUs identificados NO se inventa nada: devuelve vacío. */
export function listasSkus(i) {
  const f = ficha(i), out = [];
  for (const canal of ['walmart', 'amazon']) {
    const filas = f.skus.filter(s => s.canal === canal).sort((a, b) => Number(BigInt(String(b.usdBrutoMinor ?? 0)) - BigInt(String(a.usdBrutoMinor ?? 0))));
    if (!filas.length) continue;
    const cuerpo = csv(filas.map((s, k) => [k + 1, s.sku, s.n ?? '', s.usdBrutoMinor === null || s.usdBrutoMinor === undefined ? '' : (Number(BigInt(String(s.usdBrutoMinor))) / 100).toFixed(2), 'Señal para investigar, no una tasa']), ['posicion', 'sku', 'reembolsos', 'usd_devuelto', 'nota']);
    out.push({id: 'skus-' + canal, titulo: `SKUs a revisar con ${CANAL[canal]}`, formato: 'CSV', nombre: `skus-a-revisar-${canal}-${hoy(i.generadoEn)}.csv`, mime: 'text/csv;charset=utf-8', contenido: cuerpo});
  }
  return out;
}

/** Texto de campaña de venta cruzada. Solo cuando la recomendación es de ese tipo; no promete resultados de ingreso. */
export function campanaCrossSelling(i) {
  const f = ficha(i);
  const md = `# Campaña de venta cruzada: ${f.titulo}\n\n> ${ENCABEZADO}\n\n## Idea\n\n${f.accion}\n\n## Texto base (correo o ficha de producto)\n\nSi compraste esta herramienta, estos accesorios compatibles te ayudan a sacarle más provecho. Revisa la compatibilidad de tu modelo antes de comprar.\n\n## Condiciones\n\n- Ofrecer solo accesorios con compatibilidad confirmada por el proveedor.\n- Responsable: ${f.responsable}; fecha de revisión: ${f.fecha}.\n- Medir con las ventas del periodo siguiente; el cambio observado es una asociación temporal, no una causa. No se estima ingreso adicional sin dato observado.\n`;
  return [{id: 'campana-cross-md', titulo: 'Campaña de venta cruzada', formato: 'Markdown', nombre: `campana-cross-selling-${slug(f.titulo)}-${hoy(i.generadoEn)}.md`, mime: 'text/markdown;charset=utf-8', contenido: md}];
}

/** Paquete completo según el tipo. `avisos` explica lo que NO se pudo generar (p. ej. no hay SKUs), para no aparentar un archivo vacío. */
export function generarBorradores(i) {
  const tipo = tipoDeRecomendacion(i.item), avisos = [];
  const archivos = [...correoProveedor(i), ...faqEquipo(i)];
  const listas = listasSkus(i);
  if (!listas.length) avisos.push('No hay SKUs identificados en este periodo: no se generó la lista para Walmart o Amazon.');
  archivos.push(...listas);
  if (tipo === 'cross_sell') archivos.push(...campanaCrossSelling(i));
  return {tipo, archivos, avisos, enviado: false};
}
