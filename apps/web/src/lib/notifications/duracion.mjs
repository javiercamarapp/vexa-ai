// Duración legible en español a partir de milisegundos (política de envío: «86400 s» -> «1 día»). Puro.
export function duracionLegible(ms, t) {
  if (!Number.isFinite(ms) || ms < 0) return '';
  const s = Math.round(ms / 1000);
  if (s === 0) return '0 s';
  const u = t
    ? [[86400, t('conx.d.dia'), t('conx.d.dias')], [3600, t('conx.d.hora'), t('conx.d.horas')], [60, 'min', 'min'], [1, 's', 's']]
    : [[86400, 'día', 'días'], [3600, 'hora', 'horas'], [60, 'min', 'min'], [1, 's', 's']];
  for (const [seg, uno, varios] of u) if (s >= seg) { const n = s / seg; const r = Math.round(n * 10) / 10; return `${String(r).replace(/\.0$/, '')} ${r === 1 ? uno : varios}`; }
  return '';
}
