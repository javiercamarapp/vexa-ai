# Descubrimiento paginado de históricos — reparación322

GET `/api/extraction` conserva jobs/conversations como arrays. Admite `conversation_cursor`, `job_cursor` y `limit` (entero1..100, default100); rechaza claves desconocidas, duplicados y cursores inválidos. Añade `pagination.jobs` y `pagination.conversations`, cada uno `{next_cursor,hasMore}`. Sin siguiente página, next_cursor es null. No devuelve textos, nombres ni claves externas en el cursor.

El cursor es el UUID canónico de la última fila. No es un token de autorización ni una firma: el servidor resuelve la fila de anclaje dentro del tenant y, para trabajos, del actor actual (owner ve los trabajos autorizados de la organización). Cada consulta vuelve a pasar por la transacción canónica y RLS. Un ID no visible, de otro tipo/tenant/actor, o retirado provoca400 genérico. La UI ofrece volver al principio. Las conversaciones autorizadas de la organización son compartidas según el contrato previo.

Orden estable: created_at DESC, id ASC; comparación keyset hecha íntegramente en PostgreSQL, sin truncar microsegundos en JavaScript. Es una vista viva, no una captura congelada entre páginas: nuevas filas recientes se descubren al volver a la primera página. No se prometen totales atómicos mientras cambia el origen.

Queue `list()`/`conversations()` conservan arrays de hasta100. Nuevos `listPage({cursor,limit})` y `conversationsPage` devuelven `{items,next_cursor,hasMore}`. Todos los valores van parametrizados en SQL.

La UI conserva sólo una página de cada lista y el historial de anclas para Anterior. Navegar borra selección, requestKey y campos de conciliación; polling conserva la página. Fallos de lectura/403 borran el snapshot y datos seleccionados. Cancelación mantiene la página. No añade ejecución automática, procesamiento masivo, inferencia ni gasto.

Validación: fixture sintética de102tickets mediante sync.commitPage y102 queue.submit, PostgreSQL/Auth reales del harness F04 reutilizado, contratos Node22/26 y Playwright móvil. Se preservan dos fallos del control autor: spawnSync bloqueaba el túnel SQL y selector alert ambiguo con el anunciador Next; no se cuentan como defectos ni prueba de producto. Baseline histórico CRM102/api100/ui100 es evidencia independiente321. No sustituye evaluación de precisión ni revisión global de permisos.
