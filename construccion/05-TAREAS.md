# Índice de las 55 fichas de construcción

Generado desde scripts/construction_catalog.py y el grafo vigente. No es una lista de trabajo ya ejecutado.

| ID | Modalidad | Encargo |
|---|---|---|
| [E00](tareas/E00.md) | worker | Verificar kernel financiero existente contra contrato externo, corregir sólo fallos reproducibles. |
| [F00-01](tareas/F00-01.md) | interactive | Validar los 6 hashes/duraciones/transcripciones y marcar incertidumbres ASR. |
| [F00-02](tareas/F00-02.md) | interactive | Registrar responsables/pendientes de piloto sin inventar nombres; autorizar únicamente preparación con datos sintéticos. |
| [F00-03](tareas/F00-03.md) | interactive | Definir inventario dev local sintético y preview/prod sin provisionar; permisos cloud separados. |
| [F00-04](tareas/F00-04.md) | interactive | Crear fixtures dos tenants, clientes repetidos, orders/refunds/reversals, dos monedas, nulos, mensajes con instrucciones maliciosas. |
| [F00-05](tareas/F00-05.md) | control | Congelar el gate del siguiente incremento y registrar todos los pendientes; repetir control-plane antes de cada worker, sin PASS por documentación. |
| [F01-01](tareas/F01-01.md) | interactive | Resolver versiones actuales desde documentación instalada/catálogos y fijar lockfile; no copiar latest de memoria. |
| [F01-02](tareas/F01-02.md) | worker | Implementar login/logout, membership en DB y selector de organización sin confiar tenant_id del body. |
| [F01-03](tareas/F01-03.md) | worker | SQL migrations con claves tenant-aware y RLS default deny; Storage privado. |
| [F01-04](tareas/F01-04.md) | worker | Diseño base accesible, sidebar, navegación y estados vacío/error/stale/loading. |
| [F01-05](tareas/F01-05.md) | control | CI lint/typecheck/unit/SQL integration/build; secretos de preview mínimos, ninguna clave servicio al browser. |
| [F02-01](tareas/F02-01.md) | worker | Definir límites de archivo/filas/tamaño descomprimido; impedir zip bombs y formularios ejecutables. |
| [F02-02](tareas/F02-02.md) | worker | Carga directa Storage autorizada; registrar import+outbox atómicamente. |
| [F02-03](tareas/F02-03.md) | worker | Preview de columnas, timezone/moneda explícita, row errors descargables sin CSV injection. |
| [F02-04](tareas/F02-04.md) | worker | Canonicalizar fuente/IDs/revisiones, dedup único DB, cuarentena de ambiguos. |
| [F02-05](tareas/F02-05.md) | worker | Worker por chunks con deadline, lease/fencing, checkpoint, backoff/429/cancelación y dead-letter. |
| [F02-06](tareas/F02-06.md) | worker | Probar consumidor real y alarma de cola estancada; 202 no significa análisis completado. |
| [F03-01](tareas/F03-01.md) | worker | S01 confirma versión de rutas/scopes HubSpot; recuperar mensajes reales no sólo propiedades de ticket. |
| [F03-02](tareas/F03-02.md) | worker | S02 confirma subdominio, cursor y comments Zendesk, actualizado/borrado. |
| [F03-03](tareas/F03-03.md) | worker | Guardar cursor sólo tras commit de página; manejar ventana de actualización y backfill con sobreposición deduplicada. |
| [F03-04](tareas/F03-04.md) | worker | Preparar mapa aliases HubSpot→Zendesk con procedencia y ambigüedad, sin fusionar sólo por email/texto. |
| [F03-05](tareas/F03-05.md) | worker | UI health: última sincronización, filas/cobertura, permisos revocados y plan de reconexión. |
| [F03-06](tareas/F03-06.md) | worker | Comparar dataset antes/después con mismos filtros y pipeline versionado; visibilizar cambio de cobertura de canales. |
| [F04-01](tareas/F04-01.md) | worker | Gateway valida modelos/rutas desde catálogo y política de retención/residencia antes de red. |
| [F04-02](tareas/F04-02.md) | worker | Reserva atómica por tenant/job; errores con gasto incierto conservan reserva hasta conciliación. |
| [F04-03](tareas/F04-03.md) | worker | Redactar PII, tratar tickets como datos sin autoridad, extraer issue/sentiment/intent/urgency/entities + spans y abstención. |
| [F04-04](tareas/F04-04.md) | worker | Validar cada cita contra message_revision autorizada, enum y límites del schema. |
| [F04-05](tareas/F04-05.md) | worker | Embeddings model/dim versionados, recuperación tenant-filtered, clustering incremental estable, outliers y split/merge revisables. |
| [F04-06](tareas/F04-06.md) | worker | Separar síntoma, causa probable y confirmación operacional; no inventar batch/carrier/SKU. |
| [F04-07](tareas/F04-07.md) | interactive | Medir gold temporal humano: clasificación, calidad clusters, abstención, evidencia, costo y latencia; holdout no tuneable. |
| [F05-01](tareas/F05-01.md) | worker | Leer contrato completo calidad/01 y kernel existente, no reescribir reglas por gusto. |
| [F05-02](tareas/F05-02.md) | worker | Separar revenue exposure, refunds netos, replacement cost, costo modelado soporte y escenarios de future loss. |
| [F05-03](tareas/F05-03.md) | worker | Unión global de órdenes/clientes/eventos entre problemas; filas no aditivas señaladas. |
| [F05-04](tareas/F05-04.md) | worker | Minor units/Decimal, moneda/exponente/horizonte/FX versionados; unknown!=zero y coverage. |
| [F05-05](tareas/F05-05.md) | worker | Publish snapshot atómico con scope_hash, versiones y watermark; export/UI mismo bundle. |
| [F05-06](tareas/F05-06.md) | worker | Prioridad con carril crítico aparte, fórmula versionada y razones; normalización no oculta urgencias al cambiar set. |
| [F06-01](tareas/F06-01.md) | worker | Implementar filtros compartidos tenant+snapshot+scope sin joins que dupliquen dinero. |
| [F06-02](tareas/F06-02.md) | worker | Detail navega cifra→componente→evento→evidencia, con estados de causa probable y cobertura. |
| [F06-03](tareas/F06-03.md) | worker | Recomendación específica y condicionada, owner/estado/dismiss con razón e historial. |
| [F06-04](tareas/F06-04.md) | worker | Explorer usa herramientas read-only allowlisted sobre vistas SQL seguras; pregunta ambigua pide alcance. |
| [F06-05](tareas/F06-05.md) | worker | Intervención guarda baseline/hipótesis/owner/fechas y plan de medición antes de cambio. |
| [F06-06](tareas/F06-06.md) | worker | Brief versionado basado en snapshots; envío email no implícito; vistas y export primero. |
| [F06-07](tareas/F06-07.md) | interactive | Revisión visual móvil/desktop, teclado, contraste y reducción movimiento; no copiar marcas. |
| [F07-01](tareas/F07-01.md) | interactive | Revisar amenazas RLS/storage/vectores/exports/jobs e intentar cruce tenant con IDs conocidos. |
| [F07-02](tareas/F07-02.md) | interactive | Metamórficas: reordenar, duplicar, partir lotes, migrar identidad; mutación sobre dinero y autorización. |
| [F07-03](tareas/F07-03.md) | interactive | Caos: worker caído, lease vencido, quota LLM, DB caída, token revocado, dead-letter y replay. |
| [F07-04](tareas/F07-04.md) | interactive | Carga 10K/50K/150K fixtures; registrar hardware, versiones, concurrencia, p95 y costo, sin extrapolar linealmente sin medir. |
| [F07-05](tareas/F07-05.md) | external | Evaluación humano gold y sponsor de acción; ningún benchmark sustituye datos reales. |
| [F07-06](tareas/F07-06.md) | interactive | Runbooks cancelación, rollback, restore, datos borrados y eliminación de embeddings/backups conforme política. |
| [F08-01](tareas/F08-01.md) | external | Preparar manifiesto release con SHA, migrations, config hashes, URLs y propietarios sin secretos. |
| [F08-02](tareas/F08-02.md) | external | Ejecutar smoke remoto del flujo completo, dos tenants, job durable y export. |
| [F08-03](tareas/F08-03.md) | interactive | Ensayar pitch de 5 minutos, demo grabada de respaldo y fixture claramente rotulado si feed falla. |
| [F08-04](tareas/F08-04.md) | external | Validar permiso de logo/datos/caso, rango financiero y supuestos antes de diapositivas. |
| [F08-05](tareas/F08-05.md) | interactive | Entregar guía usuario/operación/desarrollador, accesos revocables, backlog y fechas de próximos controles. |
| [F08-06](tareas/F08-06.md) | external | Congelar resultados y próximos experimentos: éxito del pitch no equivale a validación PMF. |
