import {entero,porcentaje,proporcion} from '../../lib/formato/es-mx.mjs';
// Formato compartido por TODAS las pantallas: la definición vive en lib/formato/es-mx.mjs (una sola, con prueba de coherencia).
// Enteros y decimales son idénticos en es-MX y en-US, así que `nf` (del helper por idioma) sirve a los dos idiomas.
export {nf} from '../../lib/formato/idioma.mjs';
/** Percent with one decimal from two integers, null when the whole is zero. */
export const pct=(part:number,whole:number)=>proporcion(part,whole);
export const fmtPct=(p:number|null)=>porcentaje(p);
export const fmtEntero=entero;
export const cx=(...parts:(string|false|null|undefined)[])=>parts.filter(Boolean).join(' ');
