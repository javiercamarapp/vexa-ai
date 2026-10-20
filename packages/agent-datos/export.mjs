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
