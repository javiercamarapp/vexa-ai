# R2-15: CSP con nonces, evaluación (29-oct-2026)

Decisión: NO se implementa en esta entrega. Se deja el plan y la razón.

## Estado actual
- `apps/web/next.config.ts`: la política completa va en `Content-Security-Policy-Report-Only` con `script-src 'self' 'unsafe-inline'`; la cabecera que sí se aplica es mínima (`base-uri`, `object-src`, `frame-ancestors`). El informe llega a `/api/csp-informe`.
- El sitio público (rovaq.ai, www) lleva su propia política por host (`reglasPorHost`), más estricta, y no pasa por el middleware.

## Por qué no cabe sin riesgo ahora
1. Con nonces cada página que los use tiene que renderizarse por petición. En el build de `release-29oct` hay 78 rutas prerrenderizadas, 70 de ellas `/sitio/*` (la landing estática). Esas NO pueden llevar un nonce por petición: forzarlas a dinámicas rompe el sitio estático (caché de CDN, costo de funciones y tiempo de carga). Por eso la política con nonces solo podría aplicarse al host de la aplicación (`app.rovaq.ai`), nunca al sitio.
2. Las páginas de la aplicación ya son dinámicas (sesión), así que ahí sí es técnicamente posible. Pero quitar `'unsafe-inline'` de `script-src` en modo enforce, sin haber visto la consola en Report-Only, deja la aplicación en blanco si un script en línea de Next o de un tercero queda sin nonce. Hace falta `next build` y una pasada en navegador de todas las pantallas; el equipo no tiene aún datos de `/api/csp-informe` sobre qué se bloquearía.
3. `style-src 'unsafe-inline'` se queda (Next y los gráficos inyectan estilos); el valor de seguridad está en `script-src`.

## Plan cuando se quiera hacer (un solo push)
1. Vigilar `/api/csp-informe` 1 a 2 semanas en Report-Only con la política candidata (nonce + `'strict-dynamic'`, sin `'unsafe-inline'`) solo para `app.rovaq.ai`.
2. En `middleware.ts`: generar `nonce` por petición para el host de la aplicación, ponerlo en la cabecera de petición `x-nonce` y en `Content-Security-Policy-Report-Only` (Next lo aplica solo a sus scripts); no tocar rovaq.ai ni www.
3. Probar con `next build` + `next start` y recorrer las pantallas (Hoy, Problemas, CFO, CCO, Pregúntale, plataforma, seguridad, login y flujos de correo).
4. Cuando el informe quede limpio, renombrar la cabecera a `Content-Security-Policy` en el host de la aplicación.
Costo estimado: 1 build para el cambio y 0 de infraestructura nueva.
