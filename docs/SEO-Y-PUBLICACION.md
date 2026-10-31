# SEO y publicación (Rovaq AI)

Estado de la rama `produccion-listo-24oct`. Dominio canónico: **https://rovaq-ai.vercel.app** (el anterior, `vexa-ai.vercel.app`, sigue vivo en transición y apunta su canonical al nuevo; no redirige para no romper sesiones). Identidad pública en un solo archivo: `apps/web/src/lib/site.mjs`.

## Hallazgo importante

La app es privada. `/` no es una página de aterrizaje: sin sesión redirige a `/login` y con sesión a `/overview`. Por eso la única URL pública indexable es **`/login`** (en el sitemap, con canonical, Open Graph y JSON-LD). `/` no se lista en el sitemap porque redirige. Una landing real (texto, secciones, prueba social) sería una decisión de producto aparte.

## Qué hay

| Tema | Dónde | Detalle |
|---|---|---|
| Metadatos globales | `apps/web/src/app/(app)/layout.tsx` | `metadataBase` (NEXT_PUBLIC_SITE_URL, respaldo al dominio nuevo), plantilla de título `%s · Rovaq AI`, description de 153 caracteres, applicationName, keywords, authors/creator/publisher, category, canonical, Open Graph (es_MX, 1200×630 con alt), Twitter `summary_large_image`, robots, formatDetection, manifest, íconos, appleWebApp, themeColor claro/oscuro, `color-scheme` |
| Página pública | `apps/web/src/app/(app)/login/layout.tsx` | canonical `/login`, OG/Twitter completos y JSON-LD (Organization + SoftwareApplication, sin ratings ni precios) |
| Imagen social | `apps/web/src/app/opengraph-image.tsx`, `twitter-image.tsx` | PNG 1200×630 con los trazos reales del logo (`marca.mjs`), generado en el build |
| Privadas | `ROBOTS_PRIVADO` en el layout del espacio de trabajo, `/platform`, `/seguridad`, `/sin-acceso`, invitaciones, confirmación de correo y 404 | metadata `noindex, nofollow`; además cabecera `X-Robots-Tag` en `next.config.ts` para todo prefijo de `PREFIJOS_PRIVADOS` (incluye `/api` y `/auth`) |
| robots / sitemap | `apps/web/src/app/robots.ts`, `sitemap.ts` | permite `/` y `/login`, cierra el resto, sitemap absoluto |
| security.txt / humans | `apps/web/public/.well-known/security.txt`, `public/humans.txt` | contacto, idiomas es/en. **Expira el 2027-10-25: renovar `Expires`** (una prueba falla si vence) |
| Manifest | `public/site.webmanifest`, `push-manifest.webmanifest` | name «Rovaq AI», short_name «Rovaq», lang es-MX, id, scope, standalone, íconos 192/512/maskable, atajos (Hoy, Pregúntale, Acciones). El de avisos conserva su `start_url` propio (`/notifications`) |
| Cabeceras | `apps/web/next.config.ts` | HSTS `max-age=31536000; includeSubDomains` (sin `preload`), nosniff, `X-Frame-Options: DENY`, Referrer-Policy estricta, Permissions-Policy (cámara, micrófono, geolocalización, pagos, USB off), COOP `same-origin`, CSP vigente intacta + `Content-Security-Policy-Report-Only` |
| Caché | `next.config.ts` | `/fonts` y `/brand`: 1 año inmutable; manifest/robots/sitemap/security.txt: `s-maxage=3600` + stale-while-revalidate |
| Errores | `not-found.tsx`, `error.tsx`, `global-error.tsx` | texto en español, salida a «Hoy», noindex; `global-error` lleva el logo como imagen estática (no hay layout ni CSS) |
| Títulos de pestaña | `metadata.title` por página | cada pantalla del MENU tiene título único que empieza con el nombre del menú (lo valida la prueba) |

Regla del caché inmutable: **si cambia un archivo de `public/fonts` o `public/brand`, se publica con otro nombre** (p. ej. `-v2`), o los navegadores seguirán con el anterior hasta un año.

## Plan para pasar la CSP a enforce

1. Hoy la política estricta está en `Content-Security-Policy-Report-Only` (no bloquea). Sin endpoint de reportes, se ve solo en la consola del navegador.
2. Navegar el espacio de trabajo real 1-2 semanas con la consola abierta y anotar violaciones (Supabase, Google, push, fuentes).
3. Sustituir `'unsafe-inline'` de `script-src` por nonces (Next los admite desde el middleware) y revisar `style-src`.
4. Con 0 violaciones reales, renombrar la cabecera a `Content-Security-Policy` fusionándola con la actual. Rollback: volver a Report-Only.

## Cómo verificarlo

```sh
B=https://rovaq-ai.vercel.app     # o http://localhost:3380 con `next dev --webpack -p 3380`
for u in /robots.txt /sitemap.xml /site.webmanifest /opengraph-image /twitter-image /.well-known/security.txt /favicon.ico /icon-512.png; do
  curl -s -o /dev/null -w "$u %{http_code} %{content_type}\n" "$B$u"; done   # todos 200, sin redirigir a /login
curl -sI $B/login | grep -iE 'strict-transport|permissions-policy|cross-origin-opener|content-security'
curl -sI $B/overview | grep -i x-robots-tag                                  # noindex, nofollow, noarchive
curl -s $B/login | grep -oE '<(title|link rel="canonical"|meta (name="description"|property="og:[a-z:]+"|name="twitter:[a-z:]+"))[^>]*>' 
```

Pruebas: `node --test tests/seo-produccion.test.mjs` (código) y `node tests/ui/seo.mjs http://localhost:3380` (navegador, con fixtures; ver el encabezado del archivo).

## Tareas del dueño (fuera del repo)

1. **Vercel:** poner `NEXT_PUBLIC_SITE_URL=https://rovaq-ai.vercel.app` solo cuando el redirect de Supabase Auth (`Site URL` y redirect URLs) ya incluya el dominio nuevo: esa variable también construye los enlaces de acceso. Sin ella se usa el respaldo para SEO, pero el login seguiría con el origen configurado.
2. **Google Search Console:** crear la propiedad del dominio nuevo, verificar la propiedad (meta o DNS), enviar `https://rovaq-ai.vercel.app/sitemap.xml` y pedir indexar `/login`.
3. **Dominio propio `rovaq.ai`** cuando el responsable del cliente lo libere: agregarlo en Vercel como dominio principal, redirigir 308 el resto a él, cambiar `SITE_URL_RESPALDO` y `NEXT_PUBLIC_SITE_URL`, actualizar `Canonical` de `security.txt` y repetir Search Console.
4. **Open Graph:** pegar la URL en el depurador de Facebook/LinkedIn y en el validador de X para refrescar la vista previa.
5. **Correo de seguridad:** hoy `security.txt` apunta al correo personal de Javier; si se crea `seguridad@` en el dominio propio, cambiarlo.
6. **Retiro del dominio viejo:** cuando termine la transición, redirigir `vexa-ai.vercel.app` al nuevo (301) en Vercel.
