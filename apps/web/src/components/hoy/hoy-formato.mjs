// Formato de «Hoy»: reutiliza el de Fuga de reembolsos (misma moneda, mismos nombres de canal) para que la misma cifra se vea igual en todas las pantallas.
export {NOMBRE, usd, num, pct, dia} from '../refunds/fuga-modelo.mjs';
/** 14 -> «14:00–15:00». */
export const horaTxtSeguro = h => `${String(h).padStart(2, '0')}:00–${String((Number(h) + 1) % 24).padStart(2, '0')}:00`;
