# Cambios

Formato libre, entradas más recientes arriba. El detalle por fase está en [docs/ESTADO-VIGENTE.md](docs/ESTADO-VIGENTE.md) y el histórico en [docs/HISTORIAL-ESTADO.md](docs/HISTORIAL-ESTADO.md).

## Sin publicar (rama `produccion-listo-24oct`, 24-oct-2026)

- **SEO y publicación (sin cambios de interfaz):** metadatos completos con dominio canónico `https://rovaq-ai.vercel.app`, Open Graph/Twitter con imagen 1200×630 del logo real, JSON-LD en `/login`, `robots.txt`, `sitemap.xml`, `security.txt`, manifest PWA unificado, noindex en todo lo privado (metadata + `X-Robots-Tag`), cabeceras de seguridad (HSTS, Permissions-Policy, COOP, CSP en Report-Only) y caché larga para `/fonts` y `/brand`. Páginas 404/error con salida a «Hoy». Títulos de pestaña únicos por pantalla. Detalle, verificación y tareas del dueño: [docs/SEO-Y-PUBLICACION.md](docs/SEO-Y-PUBLICACION.md).

## Sin publicar (rama `integracion-2-24oct`, 24-oct-2026)

En producción sigue el build 41 (`0de30edd`). Lo siguiente está en la rama, pendiente de despliegue.

- **Arranque limpio:** al cargar o recargar solo se ve el logo animado hasta que la pantalla está lista; «Hoy» no pinta bloques hasta tener todos los datos. Las cifras largas del celular se vuelven a medir al soltar el arranque (corrige un desborde a 375 px en `/explorer`).
- **Tooltips:** ancho por contenido, colocación acotada al viewport y popovers que se abren hacia arriba cuando no caben.
- **Rendimiento en frío:** precálculos de SLA y de libro de reembolsos/pedidos, calentados por el gancho de refresco existente. Migración `20261125000000` (los objetos ya existen en la base real).
- **Superadmin de plataforma:** selector de cliente, paleta ⌘K, «ver como» de solo lectura con motivo y duración, ficha 360 con solo agregados, MFA (TOTP) apagada por defecto, `/sin-acceso` con invitaciones. **Requiere aplicar tres migraciones que aún no están aplicadas** (`20261126000000`, `20261126000200` y, con inventario previo de políticas, `20261126000100`).
- **Pulido:** tablas y tarjetas de la consola sin texto pegado al borde y con tarjeta-fila ordenada en celular; H1 de 20 px en las pantallas de acceso.

## 2026-10-24 — Renombre a Rovaq AI

- El producto pasa a llamarse **Rovaq AI** (antes Vexa AI) en la interfaz, metadatos, correos y documentación viva.
- Descarga de respuestas del asistente: `rovaq-respuesta-<id>.md`.
- Nuevo README orientado a inversionistas; el estado anterior se conserva en `docs/HISTORIAL-ESTADO.md`.
- Se agregan `SECURITY.md`, `CONTRIBUTING.md` y este archivo.
- Sin cambios en identificadores técnicos (paquetes `@vexa/*`, esquema `vexa_platform`, variables `VEXA_*`, URLs de despliegue).
