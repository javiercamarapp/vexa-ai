# Carga reproducible de ingesta

Adaptación del generador308 y mediciones329 al código publicado. Los resultados históricos no certifican esta composición.

Ejecutar desde una copia local estable con Node22 o26, Docker e imágenes locales existentes. El manifiesto dependencies.json identifica exactamente las fuentes; cualquier cambio, archivo añadido o symlink detiene la corrida. El inventario incluye todas las entradas del build y soporte, y permite sólo los nueve archivos propios del benchmark. No descarga imágenes, no usa proveedores ni datos reales. VEXA_LOAD_BASE_PORT (por defecto62820) reserva seis puertos consecutivos propios. No ejecutar dos pruebas con los mismos puertos.

```sh
VEXA_CANDIDATE="$PWD" node packages/jobs/load/run.mjs --preflight
VEXA_CANDIDATE="$PWD" VEXA_LOAD_SCALES=10000 node packages/jobs/load/run.mjs
VEXA_CANDIDATE="$PWD" VEXA_LOAD_SCALES=50000 VEXA_LOAD_PREVIOUS_REPORT=/ruta/10K/report.json node packages/jobs/load/run.mjs
VEXA_CANDIDATE="$PWD" VEXA_LOAD_SCALES=150000 VEXA_LOAD_PREVIOUS_REPORT=/ruta/50K/report.json node packages/jobs/load/run.mjs
```

`--preflight` verifica el mismo inventario, hashes y evidencia previa que una corrida, y termina antes de crear infraestructura. No mide capacidad ni habilita por sí solo una escala superior. Los argumentos desconocidos se rechazan.

No avanzar de escala ante un fallo. Se exige informe previo medido, contabilidad terminal, misma ruta y hashes de fuentes/benchmark. Conservar el informe rojo y diagnosticar antes de volver a ejecutar. El generador separa archivos de máximo50000filas, SHA256 y mezcla determinista98%válidas,1%rechazadas,1%duplicadas. Auth, PostgreSQL, Storage, Next y worker son reales locales; un tenant, una conexión, un consumidor, chunks100. No mide inferencia, extracción, embeddings ni costo monetario; unknown continúa null.

Cada corrida conserva comandos, contadores SQL/API, hashes, EXPLAIN ANALYZE, tiempos, RSS, recursos Docker, errores y limpieza. El host es compartido; no acredita capacidadcloud, SLO comercial ni producción. Sólo integra soporte publicado, sin propuestas privadas de notificaciones. El adaptador copia el harness aceptado aTMP, valida sus puntos de transformación y exige exit0 sin señal/error en compilación; los originales permanecen intactos.


## Observaciones por intento de bloque

El worker registra `startedAt`/`finishedAt` en UTC, inicio/fin monotónicos y su diferencia `commitMs`, CPU del proceso en microsegundos y `committed`. Este último sólo es verdadero cuando `repository.commitChunk` resuelve; una excepción conserva una observación con `committed=false` y se propaga al consumidor. Los offsets notificados no sustituyen la verificación del checkpoint en SQL.

Los relojes monotónicos sólo se comparan dentro del mismo proceso. Los timestamps UTC permiten contrastar muestras del host, con su resolución y posibles ajustes del reloj. CPU del worker no representa CPU de PostgreSQL, del túnel ni de la máquina virtual. Una muestra del host debe registrar su propio inicio y fin de recolección; no inventar timestamps de informes antiguos sumando duraciones.

Las pruebas del observador usan un runtime sintético limitado a comprobar IPC, retorno, error y limpieza; no miden persistencia ni capacidad. Se ejecutan con:

```sh
VEXA_OBSERVER_WORKER="$PWD/packages/jobs/load/worker.mjs" node --test support/F07-load/worker-observation.test.mjs
```

Cambiar el worker cambia su hash de benchmark. Un informe anterior sigue ligado a su implementación original y no habilita escalamiento con el worker nuevo. La instrumentación no amplía plazos ni convierte una carga fallida en aprobada.
