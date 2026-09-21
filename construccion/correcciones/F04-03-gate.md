# F04-03 — control revisado para cierre oficial

21-sep-2026. Propuesta integrada 60/60; revisión independiente223 y correcciones aprobadas de revocación UI. Consumidor, API, SQL, Storage y navegador reales locales; transporte IA sintético rotulado. Matriz239 heredada por hashes y regresión de importaciones27grupos; sin inferencia pagada ni producción remota. La aceptación oficial y publicación requieren runner y publisher, todavía pendientes en esta congelación.

## Historial conservado

# F04-03 — ampliación local, revisión independiente pendiente

20-sep,21:35Mérida.27/27 Node22 y26: redacción, SQL/gateway, Storage CSV/Excel y vínculo de reservas de extracción. El gateway usa transporte sintético rotulado; Auth, PostgreSQL y Storage son reales locales. No inferencia pagada, no publicación ni incremento de17/60.

El lector reconstruye cada fila del archivo original, comprueba tamaño/hash y rol antes de redactar. Dos formatos, acceso extranjero denegado y preservación exacta del objeto Storage. Hash incorrecto no crea otra extracción ni mapa.

Se reprodujeron seis INSERT incorrectos bajo vexa_backend: actor ajeno, job distinto, cancelado, terminado, tipo incorrecto y run terminal. Política0012 corregida con actor actual y relación tenant/run/job activa. Ocho controles SQL específicos y suite completa27/27. Un primer intento del examen falló también en el positivo por omitir GRANT a su tabla temporal: no cuenta como defecto de producto; se preserva separado del rojo real.

La matriz global0012 se amplía sobre controles0011 existentes. Primer intento rechazado por preparación de fixtures: se añadían revisiones/jobs/runs antes de los conteos exactos anteriores y se reutilizaba la clave de deduplicación de un job del presupuesto. Se movió la preparación nueva después de los oráculos anteriores y se dio a su job un input_hash distinto. No se debilitaron conteos, RLS ni constraints. Reejecución232/232 verde, Auth/Storage reales locales y5recursos propios ausentes porID; resultado en private/f0403-extraction-matrix-current.json.

Pendientes: revisión independiente de producto/control, mutantes específicos de redacción, integración del consumidor y rutas de extracción. Una librería verde no es funcionalidad completa de punta a punta. No congelar ni aceptar mientras falten.

## Historial del primer borrador

# F04-03 — examen local en autoría

PII antes del proveedor, mapa privado y offsets code points; política explícita y fallos cerrados. Reusar validador/schema del banco. Pendiente gate SQL de persistencia, gateway real con transporte sintético, mutantes y revisión independiente. No congelado, no aceptado.
