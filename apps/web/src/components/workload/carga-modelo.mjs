// Presentación de «Carga y SLA»: formatos y rampa de 5 pasos. Puro y probado.
export const DIAS_CORTO = Object.freeze(['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']);
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const num = n => (n == null ? '—' : Number(n).toLocaleString('en-US'));
export const pct = p => (p == null ? '—' : `${String(p)} %`);
export const mesTxt = m => { const [y, mo] = String(m).split('-'); return `${MESES[Number(mo) - 1] ?? mo} ${y}`; };
export const fechaCorta = iso => { if (!iso) return '—'; const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number); return `${d} ${MESES[m - 1]} ${y}`; };
export const horaTxt = h => `${String(h).padStart(2, '0')}:00–${String((h + 1) % 24).padStart(2, '0')}:00`;
/** Horas -> texto legible: segundos si < 0.1 h, minutos si < 1 h, horas hasta 48, luego días. */
export function horas(h) {
  if (h == null) return '—';
  const x = Number(h);
  if (x < 0.1) return `${Math.max(1, Math.round(x * 3600))} s`;
  if (x < 1) return `${Math.round(x * 60)} min`;
  if (x <= 48) return `${Math.round(x * 10) / 10} h`;
  return `${Math.round((x / 24) * 10) / 10} días`;
}
/** Paso 0..5 de la rampa por fracción del máximo; 0 solo si no hay conversaciones. */
export function pasoCarga(v, max) {
  if (!v || v <= 0 || !max) return 0;
  return Math.min(5, Math.max(1, Math.ceil((v / max) * 5)));
}
