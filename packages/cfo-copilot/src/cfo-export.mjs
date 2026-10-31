// Exportes CSV y PDF del mismo conjunto de filas que la pantalla (reportRows): una sola fuente de cifras.
import {reportRows} from './cfo-model.mjs';
const par = idioma => (es, en) => (idioma === 'en' ? en : es);
import {monthLabel} from './format.mjs';

const KIND = {observed: 'Observado', estimated: 'Estimado', inferred: 'Inferido'};
const KIND_EN = {observed: 'Observed', estimated: 'Estimated', inferred: 'Inferred'};
const kindsOf = report => (report.idioma === 'en' ? KIND_EN : KIND);
const SAFE_NUMERIC = /^[+\-−]?[\d.,]+( %| pp| [A-Z]{3})?$/;
/** Neutraliza fórmulas de hoja de cálculo (OWASP) sin alterar cifras puramente numéricas. */
export function csvCell(value) {
  let s = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(s) && !SAFE_NUMERIC.test(s)) s = "'" + s;
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
export const CSV_HEADER = ['Sección', 'Cifra', 'Alcance', 'Valor', 'Clase', 'Cobertura', 'Cómo se calculó'];
export const CSV_HEADER_EN = ['Section', 'Figure', 'Scope', 'Value', 'Class', 'Coverage', 'How it was calculated'];
export function csvRows(report) { const K = kindsOf(report); return reportRows(report).map(r => [r.section, r.label, r.scope, r.value, K[r.kind] ?? r.kind, r.coverage, r.how]); }
export function toCsv(report, meta = {}) {
  const L = par(report.idioma);
  const head = [[L('Informe CFO · Rovaq AI', 'CFO report · Rovaq AI')], [L('Generado', 'Generated'), report.generatedAt], [L('Corte de datos', 'Data cutoff'), report.watermark ?? L('no informado', 'not reported')], [L('Regla', 'Rule'), report.rule], [L('Fuente', 'Source'), meta.synthetic ? L('DATOS SINTÉTICOS DE DEMOSTRACIÓN', 'SYNTHETIC DEMONSTRATION DATA') : L('Ledger económico de la organización', 'Economic ledger of the organization')], []];
  const lines = [...head, report.idioma === 'en' ? CSV_HEADER_EN : CSV_HEADER, ...csvRows(report)].map(r => r.map(csvCell).join(','));
  return '﻿' + lines.join('\r\n') + '\r\n';
}

// ---- PDF mínimo (texto, Helvetica, WinAnsi). Sin dependencias. ----
const WINANSI = {'−': '-', '≈': '~', '→': '->', '’': "'", '“': '"', '”': '"', '≥': '>=', '≤': '<=', 'Δ': 'Dif.'};
const toLatin1 = s => String(s).replace(/[−≈→’“”≥≤Δ]/g, c => WINANSI[c]).replace(/[^\x20-\x7E -ÿ]/g, '?');
const esc = s => toLatin1(s).replace(/[\\()]/g, m => '\\' + m);
export function wrap(text, width) {
  const out = []; let line = '';
  for (const word of toLatin1(text).split(/\s+/)) {
    if (!word) continue;
    if ((line + ' ' + word).trim().length > width) { if (line) out.push(line); line = word.length > width ? (out.push(...word.match(new RegExp('.{1,' + width + '}', 'g')).slice(0, -1)), word.slice(-(word.length % width || width))) : word; } else line = (line + ' ' + word).trim();
  }
  if (line) out.push(line);
  return out.length ? out : [''];
}
export function pdfLinesOf(report, meta = {}) {
  const L = par(report.idioma), K = kindsOf(report);
  const lines = [{t: L('Informe CFO · Rovaq AI', 'CFO report · Rovaq AI'), size: 16, bold: true}, {t: (meta.org ? meta.org + ' · ' : '') + L('Generado ', 'Generated ') + report.generatedAt.replace('T', ' ').slice(0, 16) + L(' UTC · corte ', ' UTC · cutoff ') + (report.watermark ? report.watermark.slice(0, 10) : L('no informado', 'not reported')), size: 9}];
  if (meta.synthetic) lines.push({t: L('DATOS SINTÉTICOS DE DEMOSTRACIÓN. No son datos de ningún cliente.', 'SYNTHETIC DEMONSTRATION DATA. They are not any client\'s data.'), size: 10, bold: true});
  lines.push({t: report.rule, size: 9}, {t: '', size: 9});
  let section = null;
  for (const r of reportRows(report)) {
    if (r.section !== section) { section = r.section; lines.push({t: '', size: 6}, {t: r.section, size: 11, bold: true}); }
    wrap(`${r.label}${r.scope ? ' (' + r.scope + ')' : ''}: ${r.value}  [${K[r.kind] ?? r.kind}${r.coverage ? ' · ' + r.coverage : ''}]`, 100).forEach(t => lines.push({t, size: 9}));
    wrap(L('Cómo se calculó: ', 'How it was calculated: ') + r.how, 108).forEach(t => lines.push({t: '   ' + t, size: 7.5, gray: true}));
  }
  return lines;
}
export function buildPdf(lines, {title = 'Informe CFO', idioma = 'es'} = {}) {
  const pageH = 842, top = 800, bottom = 50, pages = [[]];
  let y = top;
  for (const l of lines) {
    const lead = l.size * 1.35;
    if (y - lead < bottom) { pages.push([]); y = top; }
    y -= lead; pages.at(-1).push({...l, y});
  }
  const objs = []; // 1 catalog, 2 pages, 3 font, 4 bold, then pairs (page, content)
  const add = body => (objs.push(body), objs.length);
  add('<< /Type /Catalog /Pages 2 0 R >>'); add(''); add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'); add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  const kids = [];
  pages.forEach((pg, pi) => {
    const content = pg.map(l => `BT /${l.bold ? 'F2' : 'F1'} ${l.size} Tf ${l.gray ? '0.35 g' : '0 g'} 40 ${l.y.toFixed(1)} Td (${esc(l.t)}) Tj ET`).join('\n') + `\nBT /F1 7 Tf 0.4 g 40 28 Td (${esc(title)} - ${idioma === 'en' ? 'page' : 'pagina'} ${pi + 1} ${idioma === 'en' ? 'of' : 'de'} ${pages.length}) Tj ET`;
    const contentId = objs.length + 2, pageId = objs.length + 1;
    add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 ${pageH}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`);
    add(`<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`);
    kids.push(pageId + ' 0 R');
  });
  objs[1] = `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${pages.length} >>`;
  let out = '%PDF-1.4\n'; const offsets = [];
  objs.forEach((body, i) => { offsets.push(Buffer.byteLength(out, 'latin1')); out += `${i + 1} 0 obj\n${body}\nendobj\n`; });
  const xref = Buffer.byteLength(out, 'latin1');
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offsets.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('') + `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}
export const toPdf = (report, meta = {}) => buildPdf(pdfLinesOf(report, meta), {idioma: report.idioma, title: (report.idioma === 'en' ? 'CFO report ' : 'Informe CFO ') + (report.lastComplete ? monthLabel(report.lastComplete, report.idioma) : '')});
/** Texto plano que un lector de PDF extraería (para comparar cifras en las pruebas). */
export const pdfText = buf => [...buf.toString('latin1').matchAll(/\((.*?)\) Tj/g)].map(m => m[1].replace(/\\([\\()])/g, '$1')).join('\n');
export const forPdf = s => toLatin1(s);
