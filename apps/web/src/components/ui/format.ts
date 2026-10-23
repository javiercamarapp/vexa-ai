import {entero,porcentaje,proporcion} from '../../lib/formato/es-mx.mjs';
// Formato es-MX compartido por TODAS las pantallas: la definición vive en lib/formato/es-mx.mjs (una sola, con prueba de coherencia).
export const nf=new Intl.NumberFormat('es-MX');
export const nfCompact=new Intl.NumberFormat('es-MX',{notation:'compact',maximumFractionDigits:1});
/** Percent with one decimal from two integers, null when the whole is zero. */
export const pct=(part:number,whole:number)=>proporcion(part,whole);
export const fmtPct=(p:number|null)=>porcentaje(p);
export const fmtEntero=entero;
export const cx=(...parts:(string|false|null|undefined)[])=>parts.filter(Boolean).join(' ');
