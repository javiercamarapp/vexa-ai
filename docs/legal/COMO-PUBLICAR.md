# Cómo publicar el Aviso de privacidad y los Términos

Reemplaza la guía del 31-oct. No ejecutar hasta tener el visto bueno del abogado y del cliente piloto y los tres datos. Este repositorio no hace push ni despliegue por su cuenta.

1. En Vercel, proyecto del sitio, definir `VEXA_LEGAL_ENTIDAD`, `VEXA_LEGAL_DOMICILIO` y `VEXA_LEGAL_CORREO` para producción. No son secretos. Se leen al construir; solo toman efecto con un build.
2. Con las mismas tres variables en el entorno local, desde la raíz: `node tools/sitio/generar-md.mjs --fechas`, luego `node tools/sitio/generar-md.mjs` y `node tools/sitio/generar-md.mjs --verificar`. Esto crea los espejos Markdown, `llms.txt`, el sitemap y el manifiesto con las dos páginas. Commit de esos archivos generados, sin las variables.
3. `cd apps/web && node --test "tests/sitio/*.test.*"` y `npm run lint` y `npm run typecheck`.
4. Un solo despliegue de producción: es un build. Agruparlo con cualquier otro cambio pendiente del sitio. Lo corre Javier con el script existente.
5. Verificar: `/aviso-de-privacidad`, `/terminos`, `/en/privacy-notice` y `/en/terms` devuelven 200, el pie de página los enlaza y el texto muestra la razón social, el domicilio y el correo sin corchetes. Sin las variables devuelven 404 propio del sitio.
6. Reversa: quitar una de las tres variables y volver a construir: las páginas dejan de servirse y de enlazarse. Otro build.

Si se cambia una cifra de plazo: editar `apps/web/src/content/sitio/paginas/legal.ts` en español e inglés, correr `node tools/sitio/exportar-legal.mjs` y repetir las pruebas.
