// Idioma del texto que generan las reglas del paquete (recomendaciones, notas, fuentes). Núcleo puro, sin imports: los paquetes no pueden importar apps/web.
// 'es' es el idioma por omisión y su salida debe quedar byte a byte igual a la que fijan las pruebas existentes; 'en' es inglés natural de producto B2B.
// Solo se traduce texto de reglas: los datos del cliente (SKU, títulos de problemas, nombres) y el texto de IA no pasan por aquí.
export const esIngles = idioma => idioma === 'en';
/** Elige la variante del idioma: elegir(idioma, 'texto es', 'texto en'). Cualquier valor distinto de 'en' es español. */
export const elegir = (idioma, es, en) => (idioma === 'en' ? en : es);
/** Entero con separador de miles del idioma (es-MX / en-US comparten coma de miles y punto decimal). */
export const fNumI = (n, idioma) => new Intl.NumberFormat(idioma === 'en' ? 'en-US' : 'es-MX').format(n);
/** Prefijo de porcentaje del idioma: español «26.2 %», inglés «26.2%». */
export const pctI = (n, idioma) => (idioma === 'en' ? `${n}%` : `${n} %`);
