# Paginación del listado de hilos de HubSpot

El conector rechazaba un alias de ruta que el proveedor devuelve en la siguiente página del listado de hilos. Ahora admite exclusivamente ese alias en el origen esperado y sigue realizando las peticiones sobre la ruta original. Conserva los controles de origen, credenciales, fragmentos, parámetros duplicados y asociaciones.

El cursor observado contiene padding base64 codificado. Se normaliza únicamente una capa de ese padding al construir la petición del listado y al comparar ciclos. Los cursores opacos restantes, la versión, el alcance y la representación persistida del checkpoint se conservan. No se siguen enlaces arbitrarios del proveedor.

Candidato basado en `1f99b872e8a7db6195194c12734d07ff669a923d`, con revisión independiente aprobada. Patch SHA-256: `f3436857a462d53a523579d469701af94f0214b21af9c83a086acf566c019205`. Integración comprobada byte a byte contra las dos fuentes revisadas. Pasaron 74 pruebas en Node 22, incluidas 28 focales nuevas; syntax check y lint focal aprobados en el candidato. Comando de regresión: `node --test packages/connectors/hubspot*.test.mjs packages/connectors/sync.test.mjs packages/connectors/runtime.test.mjs packages/connectors/hosted.test.mjs`. Inventario de carga actualizado, sin heredar mediciones de capacidad.

Una lectura real acotada superó el rechazo del enlace, pero no completó una página: terminó con `PROVIDER_SCHEMA` después de 45 respuestas HTTP 200 en aproximadamente 15 segundos. La causa siguiente aún requiere diagnóstico. El ensayo sintético confirma además que una página de 100 hilos exige al menos 101 peticiones secuenciales antes del checkpoint; esta corrección no resuelve ese límite temporal.

No acredita sincronización continua, importación productiva mediante CRM, latencia real sostenible, recuperación de checkpoints en producción ni aceptación formal nueva. No cambia contratos de IA, permisos ni cálculos económicos. Permanecen 59/60 tareas técnicas y 28/60 aceptadas.
