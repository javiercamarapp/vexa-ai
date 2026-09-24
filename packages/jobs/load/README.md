# Carga reproducible de ingesta

Adaptación del generador308 y mediciones329 al código publicado. Los resultados históricos no certifican esta composición.

Ejecutar desde una copia local estable con Node22 o26, Docker e imágenes locales existentes. El manifiesto dependencies.json identifica exactamente las fuentes; cualquier cambio, archivo añadido o symlink detiene la corrida. El inventario incluye todas las entradas del build y soporte, y permite sólo los nueve archivos propios del benchmark. No descarga imágenes, no usa proveedores ni datos reales. VEXA_LOAD_BASE_PORT (por defecto62820) reserva seis puertos consecutivos propios. No ejecutar dos pruebas con los mismos puertos.

```sh
VEXA_CANDIDATE="$PWD" VEXA_LOAD_SCALES=10000 node packages/jobs/load/run.mjs
VEXA_CANDIDATE="$PWD" VEXA_LOAD_SCALES=50000 VEXA_LOAD_PREVIOUS_REPORT=/ruta/10K/report.json node packages/jobs/load/run.mjs
VEXA_CANDIDATE="$PWD" VEXA_LOAD_SCALES=150000 VEXA_LOAD_PREVIOUS_REPORT=/ruta/50K/report.json node packages/jobs/load/run.mjs
```

No avanzar de escala ante un fallo. Se exige informe previo medido, contabilidad terminal, misma ruta y hashes de fuentes/benchmark. Conservar el informe rojo y diagnosticar antes de volver a ejecutar. El generador separa archivos de máximo50000filas, SHA256 y mezcla determinista98%válidas,1%rechazadas,1%duplicadas. Auth, PostgreSQL, Storage, Next y worker son reales locales; un tenant, una conexión, un consumidor, chunks100. No mide inferencia, extracción, embeddings ni costo monetario; unknown continúa null.

Cada corrida conserva comandos, contadores SQL/API, hashes, EXPLAIN ANALYZE, tiempos, RSS, recursos Docker, errores y limpieza. El host es compartido; no acredita capacidadcloud, SLO comercial ni producción. Sólo integra soporte publicado, sin propuestas privadas de notificaciones. El adaptador copia el harness aceptado aTMP, valida sus puntos de transformación y exige exit0 sin señal/error en compilación; los originales permanecen intactos.
