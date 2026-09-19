# 01 · HubSpot, Zendesk y continuidad durante la migración

## Decisión y alcance

MVP de 30 días: CSV, HubSpot y Zendesk alimentan una misma representación de conversaciones. Los adaptadores externos son de lectura. VEXA no migra el CRM, responde tickets ni modifica contactos: conserva continuidad analítica durante una migración ejecutada por el cliente. Los agentes de desarrollo construyen código; el producto propone recomendaciones para intervención humana. Requisito: [contexto canónico](../../CONTEXTO-CANONICO.md), apartados «Fuente audio» y «Alcance».

CSV permite avanzar sin credenciales, pero no demuestra que los conectores funcionen. El corte temporal de migración, los permisos sobre datos y el acceso a ambas cuentas siguen pendientes. No presentar la existencia de las APIs como integración operativa.

## Evidencia y contratos externos respaldados

Los documentos son extractos recuperados, algunos truncados, no especificaciones completas ni respuestas de una cuenta VEXA. Los `.json` conservan consulta, fecha, URL y pasajes; no son fixtures de las APIs. Recuperación 2026-09-19 UTC, equivalente a la tarde/noche del 18 en Mérida.

| Fuente | Contrato visible | Límite de la evidencia |
|---|---|---|
| H1: [Custom Channels](https://developers.hubspot.com/custom-channels-api), [hubspot.md](../fuentes/hubspot.md), [JSON](../fuentes/hubspot.json) | `conversations.read`; ejemplo `/conversations/v3/conversations/threads`; `after` y `paging.next.after`; filtro `association=TICKET` | No prueba scopes efectivos, acceso a Help Desk ni cuerpos completos de mensajes. El ejemplo describe ticket 12345 pero usa 53701: defecto documental, no dato a copiar. |
| H2: [Conversations guide](https://developers.hubspot.com/docs/api-reference/latest/conversations/conversations/guide), mismos archivos | `/conversations/2026-09/conversations/threads`; filtros por inbox, contacto, ticket y archivados; máximo descrito 500; orden ascendente por `id` o `latestMessageTimestamp` | Para ese orden temporal exige `latestMessageTimestampAfter`; no demuestra que capture cualquier edición de un ticket o mensaje antiguo. |
| H3: [spec 2026-09](https://api.hubspot.com/public/api/spec/v2/specs/release/75320/version/2026-09.json), mismos archivos | `/conversations/conversations/2026-09/threads`; `associatedTicketId` integer y `association` array | Difiere de H1/H2 en ruta y tipos. No elegir ruta definitiva por apariencia de autoridad. |
| Z1: [Incremental Exports](https://developer.zendesk.com/api-reference/ticketing/ticket-management/incremental_exports/), [zendesk.md](../fuentes/zendesk.md), [JSON](../fuentes/zendesk.json) | `GET /api/v2/incremental/tickets/cursor`; tickets cambiados desde inicio; cursor; `exclude_deleted=true` excluye eliminados | El extracto no proporciona contrato completo de inicio, respuesta, fin de paginación o comentarios. Mantener eliminaciones para reconciliar. |
| Z2: [Airbyte Zendesk](https://github.com/airbytehq/airbyte/blob/6b952b3172970315a0f8ca552171ae137c7550d5/docs/integrations/sources/zendesk-support.md), mismos archivos | Documenta streams separados de tickets/comentarios y manejo de 429/504 | 10 solicitudes/minuto y tamaños 100/1000 son evidencia del conector, no configuración validada de la cuenta ni límite universal que debamos codificar. |

**Spike S01 obligatorio:** resolver las tres familias de rutas HubSpot, versión admitida, serialización de asociaciones y scopes de lectura con documentación completa y una cuenta autorizada. Registrar método, ruta, versión, status, encabezados pertinentes y respuesta sanitizada. No implementar descubrimiento por tanteo en cada sincronización ni fallback silencioso entre versiones.

**Spike S02 obligatorio:** comprobar cómo obtener comentarios/cuerpos completos en Zendesk, notas internas, páginas de comentarios, inicio y final del incremental, eliminaciones y restricciones del rol. No inferir conversaciones completas de una lista de tickets ni inventar endpoints ausentes de Z1.

## Diseño interno propuesto, no contrato del proveedor

La representación se sustenta en conversaciones, identidad nullable y trazabilidad exigidas por el contexto. Los nombres siguientes son decisiones VEXA a implementar y revisar con fixtures; no nombres de campos remotos.

| Concepto | Invariante |
|---|---|
| Identidad externa | `(tenant_id, connection_id, object_type, source_id)`; IDs opacos como texto, sin conversión numérica ni colisión entre CRMs/cuentas. |
| Conversación y mensaje | Entidades distintas; mensaje referencia conversación dentro del mismo tenant. Ticket e hilo no se asumen 1:1. Guardar asociaciones explícitas y cardinalidad observada. |
| Procedencia | Fuente, cuenta, objeto, fecha original si existe, fecha de ingestión, revisión/hash del contenido y versión del adaptador. No sustituir una fecha original ausente por «ahora». |
| Contenido | Texto normalizado más referencia restringida al original. Visibilidad pública/interna/desconocida y rol del autor desconocido cuando falten datos. |
| Identidad de negocio | `customer_id`, SKU y pedido nullable; ausencia bloquea métricas que necesitan esa unión. Un email compartido no demuestra identidad. |
| Cobertura | Intervalo solicitado, intervalo observado, objetos leídos, cuerpos faltantes, rechazados y eliminados. Sin cuerpo: metadata útil para cobertura, no evidencia semántica. |
| Página de ingesta | Resultado interno con registros, cursor opaco, estado de continuación y errores; el mapeo desde cada API se cierra en S01/S02. No asumir nombres de respuesta no recuperados. |

Persistir página y siguiente checkpoint en una transacción después de validar; si una fila se rechaza, conservar motivo y referencia en cuarentena antes de avanzar. Cuando el original viva en Storage, cargarlo primero con referencia verificable y tolerar objetos huérfanos mediante limpieza; no fingir transacción común Storage/Postgres. Un checkpoint significa datos durables, no análisis completado.

CSV: acordar una plantilla versionada con texto, referencia de conversación/mensaje y fecha con zona cuando exista. Para archivos sin IDs, usar identidad estable de importación y fila; no prometer deduplicación entre exports reordenados. Reimportar el mismo archivo y mapeo debe ser idempotente. Marcar duplicados entre archivos como candidatos hasta disponer de claves. Validar encoding, separador, comillas, saltos de línea, fechas ambiguas y archivos vacíos; filas inválidas se cuentan, no desaparecen. La neutralización de fórmulas corresponde también a futuras exportaciones CSV.

## Sincronización y reconciliación de migración

1. Obtener ventana de historia y fecha de corte confirmadas por el cliente. Guardar estado independiente por cuenta, recurso e inbox cuando aplique. Backfill y novedades no comparten un cursor mutable.
2. HubSpot: iterar inboxes autorizados y archivados según cobertura pactada; paginar con cursor opaco. El filtro temporal de H2 requiere comprobar ediciones tardías. Planificar reconciliación periódica de una ventana configurable, sin prometer captura exhaustiva hasta S01.
3. Zendesk: export incremental de tickets más recuperación demostrada de comentarios. No activar `exclude_deleted=true` por defecto. Solo declarar conversación completa cuando se hayan agotado sus páginas accesibles.
4. Limitar concurrencia por cuenta/proveedor; honrar `Retry-After` si llega, backoff acotado con jitter para fallos recuperables. 401/403 pausa la conexión y exige corregir acceso; 404 no equivale automáticamente a borrado. Evitar reintentos infinitos.
5. Durante solapamiento, conservar ambas procedencias. Crear un mapa HubSpot↔Zendesk únicamente con export de migración o revisión humana. Hash de texto/fecha sirve para proponer duplicados, no para fusionar automáticamente.
6. Reportar totales por origen, vinculados con certeza y candidatos sin resolver. Para el agregado unido, publicar criterio y cobertura; no sumar dos copias del mismo problema ni atribuir una caída de volumen a mejora del negocio cuando coincide con el cambio de CRM.
7. Tras corte, comprobar novedades tardías/reaperturas en origen y destino; conservar trazabilidad histórica. Borrados o redacciones invalidan evidencias y derivados según política de conservación acordada.

## Incertidumbres y casos límite

No se conocen plan, región, scopes OAuth completos, paginación de mensajes, expiración de cursores, SLA, volumen ni permisos sobre notas privadas/adjuntos. Adjuntos quedan como metadata en MVP; extracción binaria requiere alcance y autorización propios. No descargar URLs arbitrarias recibidas en mensajes. Sanitizar HTML antes de presentación.

Casos que cambian el resultado: mensaje editado sin actividad reciente; dos hilos para un ticket; ticket sin hilo; cliente eliminado; inbox inaccesible; cambio de zona horaria; mismo ID en dos cuentas; reinicio entre página y checkpoint; ticket migrado con nuevo autor/fecha; CRM accesible pero sin cuerpo. Cada uno requiere cobertura explícita, no relleno sintético.

## Prueba de aceptación y pasos para otro agente

**No ejecutada en este dossier.** Preparar fixtures sanitizados de dos cuentas con IDs coincidentes, dos páginas, una edición tardía, notas internas, un borrado y una pareja migrada. Criterios: repetir import y reiniciar tras cualquier página no duplica identidades; ningún checkpoint supera registros persistidos/cuarentenados; mensajes preservan orden y fuente; lo inaccesible se distingue de vacío; la pareja confirmada cuenta una vez y la dudosa se muestra separada; ninguna petición modifica CRM.

Orden: (1) acordar CSV y cobertura; (2) construir fixtures y normalizador común; (3) cerrar S01/S02 en entorno autorizado; (4) implementar adaptadores con rutas fijadas por evidencia; (5) ejecutar recuperación y reconciliación; (6) comparar una muestra con export del cliente, incluyendo cuerpos y permisos. Entregar informe de diferencias, fixtures sanitizados y matriz de acceso. Si falta acceso, etiquetar «CSV validado; conector pendiente», manteniendo ambos conectores como entregables pendientes del MVP.
