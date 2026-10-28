import {LOCALE_INTL, type Idioma} from './idioma';
// Formato por idioma con Intl (es-MX / en-US). Solo cambia la presentación: los valores no se alteran. Fechas siempre en UTC, como el resto de la app.
export const numero = (idioma: Idioma, n: number, opciones?: Intl.NumberFormatOptions) => new Intl.NumberFormat(LOCALE_INTL[idioma], opciones).format(n);
export const moneda = (idioma: Idioma, n: number, codigo: string, opciones?: Intl.NumberFormatOptions) => new Intl.NumberFormat(LOCALE_INTL[idioma], {style: 'currency', currency: codigo, ...opciones}).format(n);
export const fecha = (idioma: Idioma, valor: Date | string | number, opciones: Intl.DateTimeFormatOptions = {day: 'numeric', month: 'short', year: 'numeric'}) => new Intl.DateTimeFormat(LOCALE_INTL[idioma], {timeZone: 'UTC', ...opciones}).format(new Date(valor));
