// Borradores de la acción que genera «Proceder». PURO: no envía nada, no llama a ningún servicio; el humano revisa, copia o descarga y lo envía por su cuenta.
// Sin PII por construcción: todo texto libre pasa por enmascararTerceros y solo salen SKU, canal, conteos, importes agregados y citas ya enmascaradas.
// Rovaq no maneja costos del cliente: el impacto se expresa solo en INGRESO y únicamente cuando existe un dato observado.
import {enmascararTerceros} from '../workspace-service/enmascarar-terceros.mjs';
import {rovaqLogoSvg} from '../workspace-service/marca.mjs';
import {csv, esc} from '../../apps/web/src/components/refunds/fuga-archivos.mjs';
import {etiquetaCategoria} from '../../apps/web/src/lib/legibilidad/categorias.mjs';

// Idioma del DOCUMENTO: lo elige quien lo genera (`i.idioma`, 'es' | 'en', por omisión 'es' = texto histórico byte a byte), no el de la interfaz: son documentos para un tercero.
// `i.t` (opcional) es el traductor del idioma elegido, solo para rotular categorías del catálogo; sin él, en inglés se usa el nombre original de la categoría.
const par = idioma => (es, en) => (idioma === 'en' ? en : es);
const idiomaDe = i => (i?.idioma === 'en' ? 'en' : 'es');
/** Traductor mínimo de inglés (solo lo que lee etiquetaCategoria: el idioma y el rótulo sin categoría) cuando el llamador no pasa `t`. */
const TRADUCTOR_EN = clave => (clave === 'tr.lg.idioma' ? 'en' : clave === 'tr.lg.sinCategoria' ? 'No category' : clave);
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, TEL = /(?<![\w.])\+?\d[\d\s().-]{8,}\d(?![\w.])/g;
const MARCAS_EN = [['[nombre]', '[name]'], ['[dirección]', '[address]'], ['[dato personal oculto]', '[personal data hidden]']];
/** Texto limpio de PII: enmascara terceros y borra cualquier correo o teléfono que haya sobrevivido. Con idioma 'en' las marcas salen en inglés. */
export const sinPII = (t, idioma = 'es') => {
  const limpio = enmascararTerceros(String(t ?? '')).replace(EMAIL, idioma === 'en' ? '[email omitted]' : '[correo omitido]').replace(TEL, idioma === 'en' ? '[phone omitted]' : '[teléfono omitido]');
  return idioma === 'en' ? MARCAS_EN.reduce((acc, [es, en]) => acc.replaceAll(es, en), limpio) : limpio;
};
const CANAL = {amazon: 'Amazon', walmart: 'Walmart'};
const usd = m => (m === null || m === undefined || !/^-?\d+$/.test(String(m)) ? null : (Number(BigInt(String(m))) / 100).toLocaleString('en-US', {style: 'currency', currency: 'USD'}));
const hoy = d => (d ?? new Date().toISOString()).slice(0, 10);
const slug = (s, vacio = 'recomendacion') => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || vacio;

/** Tipo de acción que sugiere la recomendación (heurística de etiqueta; el humano puede generar los demás borradores). */
export function tipoDeRecomendacion(item) {
  const t = `${item?.kind ?? ''} ${item?.title ?? ''}`.toLowerCase();
  if (item?.kind === 'cross_sell' || /cross.?sell|venta cruzada|accessor|accesorio|pre-sale: recommendation/.test(t)) return 'cross_sell';
  if (/supplier|proveedor|defect|warranty|garant|return|devoluci|refund|reembols|damage|dañ/.test(t)) return 'proveedor';
  return 'general';
}

const periodoTxt = (p, L) => (p?.inicio && p?.fin ? L(`${String(p.inicio).slice(0, 10)} a ${String(p.fin).slice(0, 10)}`, `the period ${String(p.inicio).slice(0, 10)} to ${String(p.fin).slice(0, 10)}`) : L('periodo del alcance seleccionado', 'the period of the selected scope'));
function ficha(i) {
  const idioma = idiomaDe(i), L = par(idioma), item = i.item, t = idioma === 'en' ? i.t ?? TRADUCTOR_EN : null, titulo = etiquetaCategoria(item.title, t);
  return {idioma, L, titulo, accion: sinPII(item.action, idioma), razon: sinPII(item.rationale, idioma), citas: (i.citas ?? []).slice(0, 5).map(c => ({rol: c.role, categoria: etiquetaCategoria(c.category, t), texto: sinPII(c.quote, idioma)})), periodo: periodoTxt(i.periodo, L), responsable: sinPII(i.responsableNombre || L('Responsable por confirmar', 'Owner to be confirmed'), idioma), fecha: i.fechaCompromiso ?? L('por definir', 'a date to be defined'), skus: (i.skus ?? []).filter(s => s?.sku).slice(0, 200)};
}
const ENCABEZADO = 'BORRADOR: no se ha enviado nada. Revísalo, ajústalo y envíalo desde tu propio correo.';
const ENCABEZADO_EN = 'DRAFT: nothing has been sent. Review it, adjust it and send it from your own email.';
const NO_PRUEBA = ['Este borrador ordena la evidencia observada; no demuestra la causa del problema ni la responsabilidad del proveedor.', 'Las cifras son observaciones del periodo indicado, no una estimación de ahorro.'];
const NO_PRUEBA_EN = ['This draft organizes the observed evidence; it does not prove the cause of the problem or the supplier’s responsibility.', 'The figures are observations for the period indicated, not a savings estimate.'];
const enc = L => L(ENCABEZADO, ENCABEZADO_EN), noPrueba = L => L(NO_PRUEBA, NO_PRUEBA_EN);
const estilo = 'body{font:14px/1.55 "Hanken Grotesk",system-ui,sans-serif;color:#0E0E10;max-width:820px;margin:32px auto;padding:0 20px}h1{font-size:22px;margin:0 0 4px}h2{font-size:15px;margin:24px 0 8px}.b{display:inline-block;background:#0E0E10;color:#fff;border-radius:6px;padding:2px 8px;font-size:12px}.m{color:#5a5a61;font-size:12.5px}table{border-collapse:collapse;width:100%;font-size:13px}th,td{border-bottom:1px solid #ddd;padding:6px 8px;text-align:left}blockquote{margin:6px 0;padding:6px 12px;border-left:3px solid #0E0E10;background:#f4f4f5}';
const pagina = (f, titulo, cuerpo) => `<!doctype html><html lang="${f.L('es', 'en')}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(titulo)}</title><style>${estilo}</style></head><body><header>${rovaqLogoSvg({ancho: 120})}</header><p><span class="b">${f.L('Borrador', 'Draft')}</span> <span class="m">${esc(enc(f.L))}</span></p>${cuerpo}</body></html>`;
const tablaSkus = (f, skus) => skus.length ? `<table><thead><tr><th>SKU</th><th>${f.L('Canal', 'Channel')}</th><th>${f.L('Reembolsos', 'Refunds')}</th><th>${f.L('Importe devuelto (USD)', 'Amount refunded (USD)')}</th></tr></thead><tbody>${skus.map(s => `<tr><td>${esc(s.sku)}</td><td>${esc(CANAL[s.canal] ?? s.canal ?? '')}</td><td>${esc(s.n ?? '')}</td><td>${esc(usd(s.usdBrutoMinor) ?? f.L('n/d', 'n/a'))}</td></tr>`).join('')}</tbody></table>` : `<p class="m">${f.L('Aún no hay SKUs identificados para este periodo; complétalos antes de enviar.', 'There are no SKUs identified for this period yet; complete them before sending.')}</p>`;
const citasHtml = (f, citas) => citas.length ? citas.map(c => `<blockquote>${esc(c.texto)}<br><span class="m">${esc(c.categoria)} · ${esc(c.rol)} ${f.L('(texto enmascarado)', '(masked text)')}</span></blockquote>`).join('') : `<p class="m">${f.L('Sin citas incluidas: agrega solo ejemplos ya enmascarados.', 'No quotes included: add only examples that are already masked.')}</p>`;

/** Correo al proveedor o marketplace con el paquete de evidencia (HTML y Markdown). `i.idioma` ('es' | 'en') es el del DOCUMENTO. */
export function correoProveedor(i) {
  const f = ficha(i), L = f.L, asunto = L(`Solicitud de revisión: ${f.titulo}`, `Review request: ${f.titulo}`), nd = L('n/d', 'n/a');
  const md = L(`# ${asunto}\n\n> ${ENCABEZADO}\n\nHola,\n\nEn el periodo ${f.periodo} observamos un patrón que queremos revisar contigo: **${f.titulo}**.\n\n**Qué proponemos:** ${f.accion}\n\n**Por qué:** ${f.razon}\n\n## SKUs implicados\n\n${f.skus.length ? '| SKU | Canal | Reembolsos | Importe devuelto (USD) |\n|---|---|---|---|\n' + f.skus.map(s => `| ${s.sku} | ${CANAL[s.canal] ?? s.canal ?? ''} | ${s.n ?? ''} | ${usd(s.usdBrutoMinor) ?? 'n/d'} |`).join('\n') : 'Por completar antes de enviar.'}\n\n## Ejemplos observados (enmascarados)\n\n${f.citas.length ? f.citas.map(c => `> ${c.texto}\n> (${c.categoria})`).join('\n\n') : 'Sin citas incluidas.'}\n\n## Lo que este paquete no prueba\n\n${NO_PRUEBA.map(x => '- ' + x).join('\n')}\n\nQuedamos atentos a tu respuesta antes del ${f.fecha}.\n\n${f.responsable}\n`,
    `# ${asunto}\n\n> ${ENCABEZADO_EN}\n\nHello,\n\nIn ${f.periodo} we observed a pattern that we would like to review with you: **${f.titulo}**.\n\n**What we propose:** ${f.accion}\n\n**Why:** ${f.razon}\n\n## SKUs involved\n\n${f.skus.length ? '| SKU | Channel | Refunds | Amount refunded (USD) |\n|---|---|---|---|\n' + f.skus.map(s => `| ${s.sku} | ${CANAL[s.canal] ?? s.canal ?? ''} | ${s.n ?? ''} | ${usd(s.usdBrutoMinor) ?? nd} |`).join('\n') : 'To be completed before sending.'}\n\n## Examples observed (masked)\n\n${f.citas.length ? f.citas.map(c => `> ${c.texto}\n> (${c.categoria})`).join('\n\n') : 'No quotes included.'}\n\n## What this package does not prove\n\n${NO_PRUEBA_EN.map(x => '- ' + x).join('\n')}\n\nWe look forward to your reply by ${f.fecha}.\n\n${f.responsable}\n`);
  const html = pagina(f, asunto, `<h1>${esc(asunto)}</h1><p class="m">${L('Para: proveedor o marketplace (agrega el destinatario al enviarlo). Responsable', 'To: supplier or marketplace (add the recipient when sending). Owner')}: ${esc(f.responsable)} · ${L('Respuesta esperada antes del', 'Reply expected by')} ${esc(f.fecha)}.</p><p>${L(`En el periodo ${esc(f.periodo)} observamos un patrón que queremos revisar contigo`, `In ${esc(f.periodo)} we observed a pattern that we would like to review with you`)}: <strong>${esc(f.titulo)}</strong>.</p><h2>${L('Qué proponemos', 'What we propose')}</h2><p>${esc(f.accion)}</p><h2>${L('Por qué', 'Why')}</h2><p>${esc(f.razon)}</p><h2>${L('SKUs implicados', 'SKUs involved')}</h2>${tablaSkus(f, f.skus)}<h2>${L('Ejemplos observados', 'Examples observed')}</h2>${citasHtml(f, f.citas)}<h2>${L('Lo que este paquete no prueba', 'What this package does not prove')}</h2><ul>${noPrueba(L).map(x => `<li>${esc(x)}</li>`).join('')}</ul>`);
  const tit = L('Correo al proveedor o marketplace', 'Email to the supplier or marketplace'), base = L('correo-proveedor', 'supplier-email'), vacio = L('recomendacion', 'recommendation');
  return [{id: 'correo-proveedor-html', titulo: tit, formato: 'HTML', nombre: `${base}-${slug(f.titulo, vacio)}-${hoy(i.generadoEn)}.html`, mime: 'text/html;charset=utf-8', contenido: html}, {id: 'correo-proveedor-md', titulo: tit, formato: 'Markdown', nombre: `${base}-${slug(f.titulo, vacio)}-${hoy(i.generadoEn)}.md`, mime: 'text/markdown;charset=utf-8', contenido: md}];
}

/** Respuesta tipo / FAQ para el equipo de atención. */
export function faqEquipo(i) {
  const f = ficha(i), L = f.L;
  const md = L(`# Respuesta tipo para el equipo: ${f.titulo}\n\n> ${ENCABEZADO}\n\n## Cuándo usarla\n\nCuando un cliente reporte lo que describe la recomendación (${f.periodo}).\n\n## Respuesta sugerida\n\nGracias por avisarnos. Ya estamos revisando este caso con el equipo. ${f.accion}\n\n## Para el agente (interno)\n\n- Motivo de la recomendación: ${f.razon}\n- Responsable: ${f.responsable}; fecha de revisión: ${f.fecha}.\n- No prometas reembolsos ni plazos que no estén confirmados; escala si el cliente reporta un riesgo de seguridad.\n- Nunca copies datos personales del cliente a esta respuesta.\n`,
    `# Template reply for the team: ${f.titulo}\n\n> ${ENCABEZADO_EN}\n\n## When to use it\n\nWhen a customer reports what the recommendation describes (${f.periodo}).\n\n## Suggested reply\n\nThank you for letting us know. We are already reviewing this case with the team. ${f.accion}\n\n## For the agent (internal)\n\n- Reason for the recommendation: ${f.razon}\n- Owner: ${f.responsable}; review date: ${f.fecha}.\n- Do not promise refunds or deadlines that are not confirmed; escalate if the customer reports a safety risk.\n- Never copy the customer’s personal data into this reply.\n`);
  const html = pagina(f, L('Respuesta tipo: ', 'Template reply: ') + f.titulo, L(`<h1>Respuesta tipo para el equipo</h1><p class="m">${esc(f.titulo)} · ${esc(f.periodo)}</p><h2>Respuesta sugerida</h2><p>Gracias por avisarnos. Ya estamos revisando este caso con el equipo. ${esc(f.accion)}</p><h2>Para el agente (interno)</h2><ul><li>Motivo: ${esc(f.razon)}</li><li>Responsable: ${esc(f.responsable)}; revisión: ${esc(f.fecha)}.</li><li>No prometas reembolsos ni plazos que no estén confirmados; escala si el cliente reporta un riesgo de seguridad.</li><li>Nunca copies datos personales del cliente a esta respuesta.</li></ul>`,
    `<h1>Template reply for the team</h1><p class="m">${esc(f.titulo)} · ${esc(f.periodo)}</p><h2>Suggested reply</h2><p>Thank you for letting us know. We are already reviewing this case with the team. ${esc(f.accion)}</p><h2>For the agent (internal)</h2><ul><li>Reason: ${esc(f.razon)}</li><li>Owner: ${esc(f.responsable)}; review: ${esc(f.fecha)}.</li><li>Do not promise refunds or deadlines that are not confirmed; escalate if the customer reports a safety risk.</li><li>Never copy the customer’s personal data into this reply.</li></ul>`));
  const tit = L('Respuesta tipo / FAQ para el equipo', 'Template reply / FAQ for the team'), base = L('faq-equipo', 'team-faq'), vacio = L('recomendacion', 'recommendation');
  return [{id: 'faq-equipo-md', titulo: tit, formato: 'Markdown', nombre: `${base}-${slug(f.titulo, vacio)}-${hoy(i.generadoEn)}.md`, mime: 'text/markdown;charset=utf-8', contenido: md}, {id: 'faq-equipo-html', titulo: tit, formato: 'HTML', nombre: `${base}-${slug(f.titulo, vacio)}-${hoy(i.generadoEn)}.html`, mime: 'text/html;charset=utf-8', contenido: html}];
}

/** CSV de SKUs a revisar con cada marketplace (uno por canal presente). Sin SKUs identificados NO se inventa nada: devuelve vacío. */
export function listasSkus(i) {
  const f = ficha(i), L = f.L, out = [];
  for (const canal of ['walmart', 'amazon']) {
    const filas = f.skus.filter(s => s.canal === canal).sort((a, b) => Number(BigInt(String(b.usdBrutoMinor ?? 0)) - BigInt(String(a.usdBrutoMinor ?? 0))));
    if (!filas.length) continue;
    const cuerpo = csv(filas.map((s, k) => [k + 1, s.sku, s.n ?? '', s.usdBrutoMinor === null || s.usdBrutoMinor === undefined ? '' : (Number(BigInt(String(s.usdBrutoMinor))) / 100).toFixed(2), L('Señal para investigar, no una tasa', 'A signal to investigate, not a rate')]), L(['posicion', 'sku', 'reembolsos', 'usd_devuelto', 'nota'], ['rank', 'sku', 'refunds', 'usd_refunded', 'note']));
    out.push({id: 'skus-' + canal, titulo: L(`SKUs a revisar con ${CANAL[canal]}`, `SKUs to review with ${CANAL[canal]}`), formato: 'CSV', nombre: `${L('skus-a-revisar', 'skus-to-review')}-${canal}-${hoy(i.generadoEn)}.csv`, mime: 'text/csv;charset=utf-8', contenido: cuerpo});
  }
  return out;
}

/** Texto de campaña de venta cruzada. Solo cuando la recomendación es de ese tipo; no promete resultados de ingreso. */
export function campanaCrossSelling(i) {
  const f = ficha(i), L = f.L;
  const md = L(`# Campaña de venta cruzada: ${f.titulo}\n\n> ${ENCABEZADO}\n\n## Idea\n\n${f.accion}\n\n## Texto base (correo o ficha de producto)\n\nSi compraste esta herramienta, estos accesorios compatibles te ayudan a sacarle más provecho. Revisa la compatibilidad de tu modelo antes de comprar.\n\n## Condiciones\n\n- Ofrecer solo accesorios con compatibilidad confirmada por el proveedor.\n- Responsable: ${f.responsable}; fecha de revisión: ${f.fecha}.\n- Medir con las ventas del periodo siguiente; el cambio observado es una asociación temporal, no una causa. No se estima ingreso adicional sin dato observado.\n`,
    `# Cross-selling campaign: ${f.titulo}\n\n> ${ENCABEZADO_EN}\n\n## Idea\n\n${f.accion}\n\n## Base text (email or product page)\n\nIf you bought this tool, these compatible accessories help you get more out of it. Check your model’s compatibility before buying.\n\n## Conditions\n\n- Offer only accessories whose compatibility is confirmed by the supplier.\n- Owner: ${f.responsable}; review date: ${f.fecha}.\n- Measure with the next period’s sales; the observed change is a temporal association, not a cause. No additional revenue is estimated without observed data.\n`);
  return [{id: 'campana-cross-md', titulo: L('Campaña de venta cruzada', 'Cross-selling campaign'), formato: 'Markdown', nombre: `${L('campana-cross-selling', 'cross-selling-campaign')}-${slug(f.titulo, L('recomendacion', 'recommendation'))}-${hoy(i.generadoEn)}.md`, mime: 'text/markdown;charset=utf-8', contenido: md}];
}

/** Paquete completo según el tipo. `avisos` explica lo que NO se pudo generar (p. ej. no hay SKUs), para no aparentar un archivo vacío. `i.idioma` ('es' | 'en') es el del documento. */
export function generarBorradores(i) {
  const tipo = tipoDeRecomendacion(i.item), avisos = [], L = par(idiomaDe(i));
  const archivos = [...correoProveedor(i), ...faqEquipo(i)];
  const listas = listasSkus(i);
  if (!listas.length) avisos.push(L('No hay SKUs identificados en este periodo: no se generó la lista para Walmart o Amazon.', 'There are no SKUs identified in this period: the list for Walmart or Amazon was not generated.'));
  archivos.push(...listas);
  if (tipo === 'cross_sell') archivos.push(...campanaCrossSelling(i));
  return {tipo, archivos, avisos, enviado: false};
}
