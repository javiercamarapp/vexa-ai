// Exportar una respuesta: Markdown (con clase, cobertura, fuentes y «cómo lo calculé») y CSV por bloque. Puro, sin red.
import { CLASS_LABELS, classLabels } from './contract.mjs';
import { idiomaDe } from './idioma.mjs';
import { rovaqLogoSvg } from '../workspace-service/marca.mjs';
import { compactEs, niceScale, esConteoPequeno } from '../../apps/web/src/lib/charts/escala.mjs'; // misma escala «agradable» y formato compacto que la app
import { csvCell } from '../cfo-copilot/src/cfo-export.mjs'; // misma neutralización de fórmulas (= + - @ tab CR) que los demás exportadores
import { enmascararTerceros } from '../workspace-service/enmascarar-terceros.mjs'; // privacidad: el texto de las citas exportadas lleva los mismos patrones ocultos que la pantalla
const esc = (v) => String(v ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
const covText = (c, idioma = 'es') => (c.eligible_n === null ? c.note : idioma === 'en' ? `${c.known_n.toLocaleString('en-US')} of ${c.eligible_n.toLocaleString('en-US')}` : `${c.known_n.toLocaleString('es-MX')} de ${c.eligible_n.toLocaleString('es-MX')}`);
/** `idioma` ('es' por omisión | 'en'): idioma de los rótulos fijos del exporte; el contenido de la respuesta ya viene en el idioma del turno. */
export function answerToMarkdown({ question, answer, generatedAt, idioma: idi }) {
  const idioma = idiomaDe(idi), en = idioma === 'en', L = (es, enText) => (en ? enText : es), CL = classLabels(idioma);
  const out = [`# ${question}`, '', L(`_Generado ${generatedAt ?? new Date().toISOString().slice(0, 10)} · Rovaq AI_`, `_Generated ${generatedAt ?? new Date().toISOString().slice(0, 10)} · Rovaq AI_`), '', answer.text, ''];
  for (const b of answer.blocks ?? []) {
    out.push(`## ${b.title}`, L(`Clase: ${b.class === 'mixed' ? 'según la columna «Clase»' : CL[b.class]} · Cobertura: ${covText(b.coverage)}`, `Class: ${b.class === 'mixed' ? 'by the “Class” column' : CL[b.class]} · Coverage: ${covText(b.coverage, idioma)}`), '');
    out.push('| ' + b.columns.map((c) => esc(c.label)).join(' | ') + ' |', '|' + b.columns.map(() => '---').join('|') + '|');
    for (const r of b.rows) out.push('| ' + b.columns.map((c) => esc(r[c.key])).join(' | ') + ' |');
    if (b.note) out.push('', `_${b.note}_`);
    out.push('');
  }
  if (answer.citations?.length) { out.push(L('## Citas', '## Quotes'), ''); for (const c of answer.citations) out.push(`> ${esc(enmascararTerceros(c.quote))}  \n> — ${c.role}, ${c.source ?? L('fuente', 'source')} · ${L('revisión', 'revision')} ${c.messageRevisionId}`, ''); }
  if (answer.missing?.length) out.push(L('## Falta cargar', '## Still to load'), '', ...answer.missing.map((m) => `- ${m}`), '');
  out.push(L('## Cómo lo calculé', '## How I calculated it'), '');
  for (const c of answer.calc ?? []) out.push(`- **${c.label}** (\`${c.tool}\`): ${c.method} ${L('Parámetros', 'Parameters')}: \`${JSON.stringify(c.args)}\`. ${L('Lee', 'Reads')}: ${(c.reads ?? []).join(', ')}.`);
  out.push('', L('## Fuentes', '## Sources'), '', ...(answer.sources ?? []).map((s) => `- ${s.label} (${s.ref})`));
  return out.join('\n');
}
export function blockToCsv(block) {
  const cell = csvCell;
  return '﻿' + [block.columns.map((c) => cell(c.label)).join(','), ...block.rows.map((r) => block.columns.map((c) => cell(r[c.key])).join(','))].join('\n');
}

// ---- Reporte HTML autónomo (se abre en el navegador y se guarda como PDF con «Imprimir»). Sin scripts, sin recursos externos, todo escapado. ----
const h = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
// Paleta de marca: serie principal en negro, comparativas en grises; el rojo señal se reserva para resaltar. Los segmentos se distinguen además por etiqueta directa en la leyenda.
const TONES = ['#0E0E10', '#5a5a61', '#8a8a90', '#3a3a40', '#a3a3ab', '#E8241C'];
const num = (n, idioma = 'es') => Number(n).toLocaleString(idioma === 'en' ? 'en-US' : 'es-MX');
const kindOf = (b, idioma = 'es') => (b.class === 'mixed' ? (idioma === 'en' ? 'Class per row' : 'Clase por fila') : classLabels(idioma)[b.class]);
/** SVG de la gráfica de un bloque. Mismos datos que su tabla; null en la serie = «No disponible», nunca una barra en cero. */
export function chartToSvg(block, idi) {
  const idioma = idiomaDe(idi);
  const c = block.chart; if (!c?.series?.length) return '';
  const S = c.series; const max = Math.max(0, ...S.map((x) => x.value ?? 0));
  const label = h(`${block.title} (${c.unit})`);
  if (c.kind === 'donut' && S.length <= 5) {
    const total = S.reduce((a, x) => a + (x.value ?? 0), 0); let acc = 0;
    const segs = S.map((x, i) => { const len = (x.value / total) * 100; const el = `<circle cx="60" cy="60" r="46" fill="none" stroke="${TONES[i % TONES.length]}" stroke-width="11" pathLength="100" stroke-dasharray="${Math.max(0, len - 0.8)} ${100 - Math.max(0, len - 0.8)}" stroke-dashoffset="${-acc}" transform="rotate(-90 60 60)"/>`; acc += len; return el; }).join('');
    const legend = S.map((x, i) => `<li><i style="background:${TONES[i % TONES.length]}"></i>${h(x.label)} <b>${h(x.display)}</b> <small>${(Math.round((x.value / total) * 1000) / 10).toLocaleString(idioma === 'en' ? 'en-US' : 'es-MX')}${idioma === 'en' ? '%' : ' %'}</small></li>`).join('');
    return `<figure class="chart donut"><svg viewBox="0 0 120 120" width="150" height="150" role="img" aria-label="${label}">${segs}</svg><ul>${legend}</ul></figure>`;
  }
  if (c.kind === 'line') {
    // Sistema v2: 3 marcas en el eje Y (11 px, gris tenue), cuadrícula de 1 px casi invisible, línea de 1.75 px con área muy tenue, punto solo en el último valor (rojo de marca) y etiqueta directa del máximo y del último.
    const sc = niceScale(max, { integer: esConteoPequeno(S.map((p) => p.value)) }); const tk = sc.ticks.map((t) => (t === 0 ? '0' : compactEs(t, idioma)));
    const W = 560, H = 168, L = Math.max(30, Math.max(...tk.map((t) => t.length)) * 6.4 + 12), R = 16, T = 20, B = 24; const n = S.length; const x = (i) => L + (i * (W - L - R)) / Math.max(1, n - 1); const y = (v) => T + (H - T - B) * (1 - v / sc.max);
    const pts = S.map((p, i) => (p.value === null ? null : [x(i), y(p.value)]));
    let d = ''; let pen = false; for (const q of pts) { if (!q) { pen = false; continue; } d += `${pen ? 'L' : 'M'}${q[0].toFixed(1)},${q[1].toFixed(1)}`; pen = true; }
    const known = pts.map((q, i) => (q ? i : -1)).filter((i) => i >= 0); const first = known[0]; const last = known[known.length - 1];
    const area = known.length > 1 ? `<path d="M${x(first).toFixed(1)},${y(0).toFixed(1)}${known.map((i) => `L${x(i).toFixed(1)},${y(S[i].value).toFixed(1)}`).join('')}L${x(last).toFixed(1)},${y(0).toFixed(1)}Z" fill="#0E0E10" fill-opacity=".06"/>` : '';
    const grid = sc.ticks.map((t, i) => `<line x1="${L}" x2="${W - R}" y1="${y(t).toFixed(1)}" y2="${y(t).toFixed(1)}" stroke="#0E0E10" stroke-opacity="${t === 0 ? '.2' : '.08'}"/><text x="${L - 8}" y="${(y(t) + 4).toFixed(1)}" text-anchor="end" font-size="11" fill="#5a5a61">${h(tk[i])}</text>`).join('');
    let mx = known[0]; for (const i of known) if (S[i].value > S[mx].value) mx = i;
    const labelIdx = known.length ? [...new Set([mx, last])] : [];
    const labels = labelIdx.map((i) => `<text x="${x(i).toFixed(1)}" y="${(y(S[i].value) - 9).toFixed(1)}" text-anchor="${i === last ? 'end' : 'middle'}" font-size="11" font-weight="600" fill="#0E0E10">${h(compactEs(S[i].value, idioma))}</text>`).join('');
    const dot = known.length ? `<circle cx="${x(last).toFixed(1)}" cy="${y(S[last].value).toFixed(1)}" r="3.25" fill="#E8241C" stroke="#fff" stroke-width="2"><title>${h(S[last].label)}: ${h(S[last].display)}</title></circle>` : '';
    const nd = pts.map((q, i) => (q ? '' : `<text x="${x(i).toFixed(1)}" y="${H - B - 6}" text-anchor="middle" font-size="10" fill="#5a5a61">${idioma === 'en' ? 'n/a' : 's/d'}</text>`)).join('');
    const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor((W - L - R) / 44)))); const ticks = S.map((p, i) => (i % every === 0 ? `<text x="${x(i).toFixed(1)}" y="${H - 7}" text-anchor="middle" font-size="11" fill="#5a5a61">${h(p.label)}</text>` : '')).join('');
    return `<figure class="chart"><svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${W}px;height:auto" role="img" aria-label="${label}">${grid}${area}<path d="${d}" fill="none" stroke="#0E0E10" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>${labels}${dot}${nd}${ticks}</svg></figure>`;
  }
  const rows = S.map((p) => `<tr><th scope="row">${h(p.label)}</th><td class="bar"><span style="width:${p.value === null || max <= 0 ? 0 : Math.max(0.8, (p.value * 100) / max)}%"></span></td><td class="v">${h(p.display)}</td></tr>`).join('');
  return `<figure class="chart"><table role="img" aria-label="${label}"><tbody>${rows}</tbody></table></figure>`;
}
const REPORT_CSS = `:root{color-scheme:light}body{font:14px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Inter,sans-serif;color:#0E0E10;background:#fff;margin:0}main{max-width:820px;margin:0 auto;padding:32px 24px 56px}h1{font-size:24px;line-height:1.25;margin:0 0 4px}h2{font-size:17px;margin:28px 0 8px}h3{font-size:15px;margin:0}.marca{margin:0 0 20px;padding:14px 0 0}.marca svg{display:block}.meta{color:#5a5a61;font-size:12px;margin:0 0 20px}.lead{font-size:15px;white-space:pre-wrap}.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px;list-style:none;padding:0;margin:16px 0}.kpis li{border:1px solid #d8dbe2;border-radius:10px;padding:10px 12px}.kpis b{display:block;font-size:20px}.kpis span{font-size:12px;color:#5a5a61}.tag{display:inline-block;font:600 11px ui-monospace,monospace;border:1px solid #b9bfcc;border-radius:999px;padding:1px 8px;margin-right:6px}.blk{border:1px solid #d8dbe2;border-radius:12px;padding:14px 16px;margin:14px 0;break-inside:avoid}table{border-collapse:collapse;width:100%;font-size:13px}th,td{text-align:left;padding:5px 8px;border-bottom:1px solid #e6e8ee}td.n{text-align:right;font-variant-numeric:tabular-nums}.chart{margin:10px 0}.chart td.bar{width:55%}.chart td.bar span{display:block;height:5px;border-radius:3px;background:#2f2f33}.chart td.bar{background:linear-gradient(#0E0E1010,#0E0E1010) center/100% 5px no-repeat}.chart td.v{white-space:nowrap;text-align:right}.donut{display:flex;gap:18px;align-items:center;flex-wrap:wrap}.donut ul{list-style:none;padding:0;margin:0}.donut i{display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:6px}blockquote{margin:8px 0;padding:6px 12px;border-left:3px solid #0E0E10;color:#2b2e36}.note{color:#5a5a61;font-size:12px}footer{margin-top:32px;color:#5a5a61;font-size:12px}@media print{main{padding:0}.blk{border-color:#bbb}}`;
export function answerToHtml({ question, answer, generatedAt, userContext = [], idioma: idi }) {
  const idioma = idiomaDe(idi), en = idioma === 'en', L = (es, enText) => (en ? enText : es), CL = classLabels(idioma);
  const date = generatedAt ?? new Date().toISOString().slice(0, 10);
  const out = [`<!doctype html><html lang="${idioma}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${h(question).slice(0, 120)} · Rovaq AI</title><style>${REPORT_CSS}</style></head><body><main>`, `<header class="marca">${rovaqLogoSvg({ancho: 120})}</header><p class="meta">Rovaq AI · ${L('Reporte generado el', 'Report generated on')} ${h(date)}</p>`, `<h1>${h(question)}</h1>`, `<p class="lead">${h(answer.text)}</p>`];
  const figs = (answer.figures ?? []).filter((f) => f.rank === undefined).slice(0, 6);
  if (figs.length) out.push('<ul class="kpis">' + figs.map((f) => `<li><span>${h(f.label)}</span><b>${h(f.display)}</b><span class="tag">${h(CL[f.class])}</span><span>${h(covText(f.coverage, idioma))}</span></li>`).join('') + '</ul>');
  for (const b of answer.blocks ?? []) {
    if (!b.rows?.length) continue;
    out.push(`<section class="blk"><h3>${h(b.title)}</h3><p class="note"><span class="tag">${h(kindOf(b, idioma))}</span>${L('Cobertura', 'Coverage')}: ${h(covText(b.coverage, idioma))}</p>${chartToSvg(b, idioma)}`);
    out.push('<table><thead><tr>' + b.columns.map((c) => `<th scope="col">${h(c.label)}</th>`).join('') + '</tr></thead><tbody>' + b.rows.map((r) => '<tr>' + b.columns.map((c, j) => (j === 0 ? `<th scope="row">${h(r[c.key])}</th>` : `<td${c.kind === 'integer' ? ' class="n"' : ''}>${h(r[c.key] === null || r[c.key] === undefined ? '—' : typeof r[c.key] === 'number' ? num(r[c.key], idioma) : r[c.key])}</td>`)).join('') + '</tr>').join('') + '</tbody></table>');
    if (b.note) out.push(`<p class="note">${h(b.note)}</p>`);
    out.push('</section>');
  }
  if (answer.citations?.length) out.push(`<h2>${L('Citas verificables', 'Verifiable quotes')}</h2>` + answer.citations.map((c) => `<blockquote>${h(enmascararTerceros(c.quote))}<br><span class="note">${h(c.role)}${c.source ? ' · ' + h(c.source) : ''} · ${L('revisión', 'revision')} ${h(c.messageRevisionId)}</span></blockquote>`).join(''));
  if (userContext.length) out.push(`<h2>${L('Datos aportados por el usuario', 'Data provided by the user')}</h2><p class="note">${L('No verificados ni parte del corte publicado.', 'Not verified and not part of the published snapshot.')}</p>` + userContext.map((u) => `<p><span class="tag">${L('Dato aportado por el usuario', 'Data provided by the user')}</span>${h(u)}</p>`).join(''));
  if (answer.missing?.length) out.push(`<h2>${L('Falta cargar', 'Still to load')}</h2><ul>` + answer.missing.map((m) => `<li>${h(m)}</li>`).join('') + '</ul>');
  out.push(`<h2>${L('Cómo lo calculé', 'How I calculated it')}</h2><ol>` + (answer.calc ?? []).map((c) => `<li><b>${h(c.label)}</b> (<code>${h(c.tool)}</code>): ${h(c.method)} ${L('Parámetros', 'Parameters')}: <code>${h(JSON.stringify(c.args))}</code>. ${L('Lee', 'Reads')}: ${h((c.reads ?? []).join(', '))}.</li>`).join('') + '</ol>');
  out.push(`<h2>${L('Fuentes', 'Sources')}</h2><ul>` + (answer.sources ?? []).map((x) => `<li>${h(x.label)} <span class="note">(${h(x.ref)})</span></li>`).join('') + '</ul>');
  out.push(`<footer>${L('Cada cifra lleva su clase (Observado, Estimado o Inferido) y su cobertura. Lo desconocido se muestra como «No disponible», nunca como cero, y las monedas no se suman. Para guardar como PDF usa Imprimir.', 'Every figure carries its class (Observed, Estimated or Inferred) and its coverage. Unknown values are shown as “Not available”, never as zero, and currencies are not added. To save as a PDF use Print.')}</footer></main></body></html>`);
  return out.join('\n');
}
