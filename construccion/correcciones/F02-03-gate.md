# F02-03 — examen y producto revisados, pendientes de aceptación oficial

## Revisión final del 20-sep

Revisión independiente `f02-closing-reviews-1789928750854153000-review03`: aprobada sin hallazgos. Control y producto preservados por hashes/modos (1741/1768 archivos). Reejecución independiente Node26: 31/31 casos internos, cero skips, Next/Auth/SQL/Storage/Chromium reales y limpieza verificada. Reutiliza la revisión anterior para código inalterado: 96 regresiones de producto, F02-02 real y tres ciclos de mutación 0→aserción→0.

Al congelar este examen, el estado formal sigue **13/60**. Autoría o revisión aprobada no equivalen a aceptación. Faltan prepare, adopción exacta, verify, regresiones anteriores y accept desde materialización limpia.

## Defectos del examen corregidos, historia preservada

- NODE_TEST_CONTEXT heredado podía hacer que el hijo omitiera todos los tests y saliera0. Se elimina esa variable en el lanzamiento aislado; se exige marcador de terminación y salida TAP sin skips. El falso verde original no cuenta como aprobación.
- Node26 usaba reporter spec: el hijo ahora solicita TAP explícitamente.
- Cleanup confiaba en rutas indicadas por un manifiesto hijo. Ahora el padre asigna los directorios, registra ruta/dispositivo/inodo y rechaza reemplazos o symlinks. Tres métodos verifican preservación de señuelos incluso con salida1. Nunca borrar por prefijo ni usar journals históricos como autoridad activa.
- La prueba de paginación observaba la respuesta HTTP antes del render de React. Esperar un valor ya seleccionado tampoco servía: otro revisor demostró falso verde con JSON demorado500ms y un producto mutado que perdía la selección. La corrección espera primero el cambio observable de reservas de más de50 a50 y luego exige `PAGINATION_RETAINS_SELECTED_CONNECTION_AFTER_RELOAD`.
- `retention-mutation.py` reproduce con copias TMP, transporte real y demora JSON: original0, mutante1 por la aserción objetivo, restaurado0; 31 casos por ejecución y cleanup verificado. No se sobrescribe evidencia anterior.

## Alcance comprobado y límites

Preview/mapeo de columnas, selección XLSX, fechas/timezone/moneda explícitas, Money exacto, errores CSV seguros, paginación, caducidad, concurrencia CAS, recuperación503, roles/Origin/aislamiento y validación completa de10K filas, no sólo la muestra. M10 revisa bundles y respuestas.

El CORS faltante y el límite Storage de1MiB fueron defectos del harness, reproducidos y corregidos allí sin desactivar seguridad del navegador ni falsear operaciones de negocio. Fixtures sintéticos; no datos de cliente.

Esto no acredita consumidores05/06, selección canónica04, cloud, Actions, conexiones de proveedores reales ni certificación enterprise. F02 completa requiere sus seis aceptaciones, no este único examen.
