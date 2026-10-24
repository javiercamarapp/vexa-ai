/** Segundos que faltan hasta `iso` (nunca negativo). Pura: se prueba sin reloj ni DOM. */
export const secondsLeft = (iso: string, now = Date.now()) => Math.max(0, Math.ceil((Date.parse(iso) - now) / 1000));
export const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
