// Exportar una respuesta: Markdown (con clase, cobertura, fuentes y «cómo lo calculé») y CSV por bloque. Puro, sin red.
import { CLASS_LABELS } from './contract.mjs';
const esc = (v) => String(v ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
const covText = (c) => (c.eligible_n === null ? c.note : `${c.known_n.toLocaleString('es-MX')} de ${c.eligible_n.toLocaleString('es-MX')}`);
export function answerToMarkdown({ question, answer, generatedAt }) {
  const out = [`# ${question}`, '', `_Generado ${generatedAt ?? new Date().toISOString().slice(0, 10)} · Rovaq AI_`, '', answer.text, ''];
  for (const b of answer.blocks ?? []) {
    out.push(`## ${b.title}`, `Clase: ${b.class === 'mixed' ? 'según la columna «Clase»' : CLASS_LABELS[b.class]} · Cobertura: ${covText(b.coverage)}`, '');
    out.push('| ' + b.columns.map((c) => esc(c.label)).join(' | ') + ' |', '|' + b.columns.map(() => '---').join('|') + '|');
    for (const r of b.rows) out.push('| ' + b.columns.map((c) => esc(r[c.key])).join(' | ') + ' |');
    if (b.note) out.push('', `_${b.note}_`);
    out.push('');
  }
  if (answer.citations?.length) { out.push('## Citas', ''); for (const c of answer.citations) out.push(`> ${esc(c.quote)}  \n> — ${c.role}, ${c.source ?? 'fuente'} · revisión ${c.messageRevisionId}`, ''); }
  if (answer.missing?.length) out.push('## Falta cargar', '', ...answer.missing.map((m) => `- ${m}`), '');
  out.push('## Cómo lo calculé', '');
  for (const c of answer.calc ?? []) out.push(`- **${c.label}** (\`${c.tool}\`): ${c.method} Parámetros: \`${JSON.stringify(c.args)}\`. Lee: ${(c.reads ?? []).join(', ')}.`);
  out.push('', '## Fuentes', '', ...(answer.sources ?? []).map((s) => `- ${s.label} (${s.ref})`));
  return out.join('\n');
}
export function blockToCsv(block) {
  const cell = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return '﻿' + [block.columns.map((c) => cell(c.label)).join(','), ...block.rows.map((r) => block.columns.map((c) => cell(r[c.key])).join(','))].join('\n');
}

// ---- Reporte HTML autónomo (se abre en el navegador y se guarda como PDF con «Imprimir»). Sin scripts, sin recursos externos, todo escapado. ----
const h = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const TONES = ['#254edb', '#0f7b6c', '#b4531a', '#7a3fb0', '#5b6475', '#a1274a'];
const num = (n) => Number(n).toLocaleString('es-MX');
const kindOf = (b) => (b.class === 'mixed' ? 'Clase por fila' : CLASS_LABELS[b.class]);
/** SVG de la gráfica de un bloque. Mismos datos que su tabla; null en la serie = «No disponible», nunca una barra en cero. */
export function chartToSvg(block) {
  const c = block.chart; if (!c?.series?.length) return '';
  const S = c.series; const max = Math.max(0, ...S.map((x) => x.value ?? 0));
  const label = h(`${block.title} (${c.unit})`);
  if (c.kind === 'donut') {
    const total = S.reduce((a, x) => a + (x.value ?? 0), 0); let acc = 0;
    const segs = S.map((x, i) => { const len = (x.value / total) * 100; const el = `<circle cx="60" cy="60" r="44" fill="none" stroke="${TONES[i % TONES.length]}" stroke-width="18" pathLength="100" stroke-dasharray="${Math.max(0, len - 0.8)} ${100 - Math.max(0, len - 0.8)}" stroke-dashoffset="${-acc}" transform="rotate(-90 60 60)"/>`; acc += len; return el; }).join('');
    const legend = S.map((x, i) => `<li><i style="background:${TONES[i % TONES.length]}"></i>${h(x.label)} <b>${h(x.display)}</b> <small>${(Math.round((x.value / total) * 1000) / 10).toLocaleString('es-MX')} %</small></li>`).join('');
    return `<figure class="chart donut"><svg viewBox="0 0 120 120" width="150" height="150" role="img" aria-label="${label}">${segs}</svg><ul>${legend}</ul></figure>`;
  }
  if (c.kind === 'line') {
    const W = 520, H = 160, L = 10, R = 10, T = 14, B = 26; const n = S.length; const x = (i) => L + (i * (W - L - R)) / Math.max(1, n - 1); const y = (v) => T + (H - T - B) * (1 - (max > 0 ? v / max : 0));
    const pts = S.map((p, i) => (p.value === null ? null : [x(i), y(p.value)]));
    let d = ''; let pen = false; for (const q of pts) { if (!q) { pen = false; continue; } d += `${pen ? 'L' : 'M'}${q[0].toFixed(1)},${q[1].toFixed(1)}`; pen = true; }
    const dots = pts.map((q, i) => (q ? `<circle cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="3.2" fill="#254edb"><title>${h(S[i].label)}: ${h(S[i].display)}</title></circle>` : `<text x="${x(i).toFixed(1)}" y="${H - B - 4}" text-anchor="middle" font-size="9" fill="#5b6475">N/D</text>`)).join('');
    const ticks = S.map((p, i) => `<text x="${x(i).toFixed(1)}" y="${H - 8}" text-anchor="middle" font-size="9" fill="#5b6475">${h(p.label)}</text>`).join('');
    return `<figure class="chart"><svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${label}"><line x1="${L}" x2="${W - R}" y1="${H - B}" y2="${H - B}" stroke="#c9ccd4"/><path d="${d}" fill="none" stroke="#254edb" stroke-width="2"/>${dots}${ticks}</svg></figure>`;
  }
  const rows = S.map((p) => `<tr><th scope="row">${h(p.label)}</th><td class="bar"><span style="width:${p.value === null || max <= 0 ? 0 : Math.max(0.8, (p.value * 100) / max)}%"></span></td><td class="v">${h(p.display)}</td></tr>`).join('');
  return `<figure class="chart"><table role="img" aria-label="${label}"><tbody>${rows}</tbody></table></figure>`;
}
const REPORT_CSS = `:root{color-scheme:light}body{font:14px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Inter,sans-serif;color:#17181c;background:#fff;margin:0}main{max-width:820px;margin:0 auto;padding:32px 24px 56px}h1{font-size:24px;line-height:1.25;margin:0 0 4px}h2{font-size:17px;margin:28px 0 8px}h3{font-size:15px;margin:0}.meta{color:#5b6475;font-size:12px;margin:0 0 20px}.lead{font-size:15px;white-space:pre-wrap}.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px;list-style:none;padding:0;margin:16px 0}.kpis li{border:1px solid #d8dbe2;border-radius:10px;padding:10px 12px}.kpis b{display:block;font-size:20px}.kpis span{font-size:12px;color:#5b6475}.tag{display:inline-block;font:600 11px ui-monospace,monospace;border:1px solid #b9bfcc;border-radius:999px;padding:1px 8px;margin-right:6px}.blk{border:1px solid #d8dbe2;border-radius:12px;padding:14px 16px;margin:14px 0;break-inside:avoid}table{border-collapse:collapse;width:100%;font-size:13px}th,td{text-align:left;padding:5px 8px;border-bottom:1px solid #e6e8ee}td.n{text-align:right;font-variant-numeric:tabular-nums}.chart{margin:10px 0}.chart td.bar{width:55%}.chart td.bar span{display:block;height:10px;border-radius:3px;background:#254edb}.chart td.v{white-space:nowrap;text-align:right}.donut{display:flex;gap:18px;align-items:center;flex-wrap:wrap}.donut ul{list-style:none;padding:0;margin:0}.donut i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:6px}blockquote{margin:8px 0;padding:6px 12px;border-left:3px solid #254edb;color:#2b2e36}.note{color:#5b6475;font-size:12px}footer{margin-top:32px;color:#5b6475;font-size:12px}@media print{main{padding:0}.blk{border-color:#bbb}}`;
export function answerToHtml({ question, answer, generatedAt, userContext = [] }) {
  const date = generatedAt ?? new Date().toISOString().slice(0, 10);
  const out = [`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${h(question).slice(0, 120)} · Rovaq AI</title><style>${REPORT_CSS}</style></head><body><main>`, `<p class="meta">Rovaq AI · Reporte generado el ${h(date)}</p>`, `<h1>${h(question)}</h1>`, `<p class="lead">${h(answer.text)}</p>`];
  const figs = (answer.figures ?? []).filter((f) => f.rank === undefined).slice(0, 6);
  if (figs.length) out.push('<ul class="kpis">' + figs.map((f) => `<li><span>${h(f.label)}</span><b>${h(f.display)}</b><span class="tag">${h(CLASS_LABELS[f.class])}</span><span>${h(covText(f.coverage))}</span></li>`).join('') + '</ul>');
  for (const b of answer.blocks ?? []) {
    if (!b.rows?.length) continue;
    out.push(`<section class="blk"><h3>${h(b.title)}</h3><p class="note"><span class="tag">${h(kindOf(b))}</span>Cobertura: ${h(covText(b.coverage))}</p>${chartToSvg(b)}`);
    out.push('<table><thead><tr>' + b.columns.map((c) => `<th scope="col">${h(c.label)}</th>`).join('') + '</tr></thead><tbody>' + b.rows.map((r) => '<tr>' + b.columns.map((c, j) => (j === 0 ? `<th scope="row">${h(r[c.key])}</th>` : `<td${c.kind === 'integer' ? ' class="n"' : ''}>${h(r[c.key] === null || r[c.key] === undefined ? '—' : typeof r[c.key] === 'number' ? num(r[c.key]) : r[c.key])}</td>`)).join('') + '</tr>').join('') + '</tbody></table>');
    if (b.note) out.push(`<p class="note">${h(b.note)}</p>`);
    out.push('</section>');
  }
  if (answer.citations?.length) out.push('<h2>Citas verificables</h2>' + answer.citations.map((c) => `<blockquote>${h(c.quote)}<br><span class="note">${h(c.role)}${c.source ? ' · ' + h(c.source) : ''} · revisión ${h(c.messageRevisionId)}</span></blockquote>`).join(''));
  if (userContext.length) out.push('<h2>Datos aportados por el usuario</h2><p class="note">No verificados ni parte del corte publicado.</p>' + userContext.map((u) => `<p><span class="tag">Dato aportado por el usuario</span>${h(u)}</p>`).join(''));
  if (answer.missing?.length) out.push('<h2>Falta cargar</h2><ul>' + answer.missing.map((m) => `<li>${h(m)}</li>`).join('') + '</ul>');
  out.push('<h2>Cómo lo calculé</h2><ol>' + (answer.calc ?? []).map((c) => `<li><b>${h(c.label)}</b> (<code>${h(c.tool)}</code>): ${h(c.method)} Parámetros: <code>${h(JSON.stringify(c.args))}</code>. Lee: ${h((c.reads ?? []).join(', '))}.</li>`).join('') + '</ol>');
  out.push('<h2>Fuentes</h2><ul>' + (answer.sources ?? []).map((x) => `<li>${h(x.label)} <span class="note">(${h(x.ref)})</span></li>`).join('') + '</ul>');
  out.push('<footer>Cada cifra lleva su clase (Observado, Estimado o Inferido) y su cobertura. Lo desconocido se muestra como «No disponible», nunca como cero, y las monedas no se suman. Para guardar como PDF usa Imprimir.</footer></main></body></html>');
  return out.join('\n');
}
