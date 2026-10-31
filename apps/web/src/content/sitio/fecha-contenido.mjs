// Fecha única del contenido publicado del blog (T28, fijada en T32-Y). Todos los artículos la usan como fecha de publicación y el índice del blog
// (HTML y espejo Markdown) lista solo artículos con fecha menor o igual a ella; la modificación del índice es la mayor fecha de publicación listada.
// El despliegue es el 2026-10-31. Cambiar el día de publicación es cambiar esta línea y regenerar con tools/sitio/generar-md.mjs.
export const FECHA_CONTENIDO = '2026-10-31';
