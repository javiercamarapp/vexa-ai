# Operación de problemas y embeddings (F04-05)

Este módulo usa extracciones persistidas y redactadas. No configura cuentas externas ni autoriza inferencia por sí mismo. La aceptación técnica y las cuentas reales son verificaciones distintas. Los valores de modelos, dimensiones, proveedores, precios, privacidad y cuotas deben provenir de evidencia aprobada; este documento no proporciona valores ficticios de producción.

## Configuración exclusiva del servidor

- `VEXA_PROBLEMS_CONFIG_JSON`: array de configuraciones por `tenantId`; no se recibe del navegador ni se devuelve por API.
- Cada configuración contiene `modelId`, `dimensions` (1–4096), `version` no vacía, `threshold` de distancia coseno entre 0 inclusive y 1 exclusivo, y `gateway`. La versión debe identificar una metodología de embeddings estable. El resolver calcula un hash de la configuración completa y lo fija en cada job; cambios posteriores rechazan el job con `configuration_changed`.
- `gateway.policy`: autorización explícita, modelos y proveedores permitidos, versión, `dataCollection: deny`, requisito ZDR, residencia aprobada, límites de entrada/respuesta, timeout máximo de 15000 ms, ventana presupuestaria, límites por llamada/tarea/tenant, moneda USD y exponente 6. No se realiza fallback a otros proveedores.
- `gateway.candidate`: modelo/proveedor coherentes con la política, contexto admitido, privacidad y residencia, atestación con versión y vencimiento; precios de entrada en micro-USD por token, overhead conservador, versión de precios, vencimiento y confirmación de todos los cargos incluidos.
- `gateway.catalog`: versión y fechas de obtención/vencimiento; `models` con `id`, `dimensions` y `contextTokens`. Debe ser un catálogo vigente verificado para el modelo elegido, no una lista generada para eludir controles.
- `VEXA_PROBLEMS_RUNTIME=enabled` habilita la ejecución. `VEXA_OPENROUTER_API_KEY` y `VEXA_WORKER_TRIGGER_SECRET` son secretos del servidor. No usar variables `NEXT_PUBLIC_*`, logs, capturas ni archivos versionados para claves.
- El consumidor también requiere la configuración de base de datos, Supabase y credenciales del worker del runtime durable existente. En dispatcher, `VEXA_WORKER_DISPATCHER=enabled`; su consumidor es `problems`, con marca de rotación independiente de imports/CRM/extraction.

Antes de habilitar, aplicar migraciones hasta 0016, provisionar el usuario worker analyst con membership activa y delegación habilitada, y configurar cuotas durables tanto `all` como `embedding` para la misma ventana. Una reserva inexistente o cuota insuficiente bloquea la llamada. No usar un rol PostgreSQL propietario, superusuario o con BYPASSRLS.

## Enviar y consumir

La UI `/problems` obtiene fuentes actuales del servidor. Owner o analyst envía `POST /api/problems` con `operation: submit`, `extractionRunId` y UUID `requestKey`; tenant, actor y hash de configuración se derivan de la sesión y configuración del servidor. El navegador no aporta vectores, precios, tenant ni claves. Un replay con la misma clave sólo devuelve el job original; una clave reutilizada con distinto contenido se rechaza.

La ejecución necesita un scheduler externo que invoque `POST /api/internal/problems`, sin query, con cuerpo vacío o `{}` y `Authorization: Bearer <secreto del servidor>`. Este paquete no instala ni activa cron automáticamente. Cada invocación ejecuta como máximo un job del tenant despachado; endpoint y scheduler son partes separadas. El límite alojado es 40 segundos y el lease de trabajo 45 segundos. Programar llamadas futuras mientras existan jobs; no interpretar `idle` como una inferencia ejecutada.

GET `/api/problems` y GET `/api/problems/:id` muestran problemas e historial autorizado. `operation: retrieve` acepta sólo un embedding persistido autorizado y límite; los candidatos se filtran por tenant, evidencia actual y el mismo modelo/dimensiones/versión antes de top-K. Owner puede `split` o `merge` con IDs/versiones de padres, partición exacta de embeddings, razón y `approved: true`; la comprobación CAS rechaza versiones obsoletas. Los snapshots anteriores no se reescriben. Los IDs de órdenes se deduplican; no se calcula ahorro ni causalidad.

## Estados y recuperación

Jobs pasan de `queued` a `running` y después `succeeded` o `failed`. La lease, fencing token, propietario actual, membresía original y delegación se vuelven a validar en las transacciones del worker. Evidencia revocada, borrada o ya no actual no debe reaparecer como fuente disponible. Una severidad desconocida sin nivel explícito utilizable se rechaza como `insufficient_evidence` antes de reservar presupuesto o enviar datos.

La marca durable `network_started` impide reenvíos automáticos después de una pérdida de proceso que pudo haber cruzado la frontera de red. Un job expirado con esa marca se cierra como `failed / reconciliation_required`, sin nueva inferencia. Embeddings, asignaciones, snapshots y éxito se confirman en una sola transacción; un crash previo al commit no publica resultados parciales. Jobs fallidos no se reencolan automáticamente.

`reconciliation_required` y reservas `uncertain` requieren investigación de evidencia del proveedor y reconciliación owner mediante el repositorio durable de presupuesto existente. Un coste ausente no significa cero y mantiene importe retenido. No liberar por timeout, borrar reservas, reiniciar `network_started` ni enviar una nueva request para sortear una retención. Confirmar el coste final del proveedor antes de autorizar otro trabajo. Si una respuesta inválida tiene coste conocido, ese coste sí queda contabilizado aunque el job falle. Si el worker pierde autorización, el fence debe impedir que publique resultados.

Para un fallo comprobado anterior al envío, reparar configuración/fuente/permisos y enviar una nueva request explícita tras revisar el estado del job y la reserva. No hay endpoint de reintento, cancelación ni reconciliación implementado por este módulo; no presentar estas operaciones como botones disponibles.

## Nueva versión y retorno a una configuración conocida

No reutilizar una versión para otro modelo dimensional o metodología. Para reembedding, registrar una nueva `version`, conservar el modelo y dimensión correctos en catálogo/configuración y enviar nuevas requests autorizadas. Las búsquedas y agrupaciones no mezclan espacios. Los IDs persistidos anteriores y los snapshots se conservan; los nuevos embeddings no reemplazan el historial.

Para detener ejecución, primero pausar el scheduler y después deshabilitar el runtime. Revisar cualquier job en vuelo y presupuesto pendiente antes de cambiar configuración. Restaurar la última configuración aprobada permite nuevas solicitudes en su espacio anterior, pero no revierte automáticamente una reestructuración ni borra snapshots. Los hashes de jobs ya enviados permanecen fijos; no editarlos. El historial permite inspeccionar la última versión conocida, no existe una API de rollback arbitrario. Una corrección estructural posterior debe usar una nueva operación owner con CAS y razón, preservando el historial.

## Límites de esta versión

Una extracción aporta como máximo 32 revisiones citadas por job; las cotizaciones redactadas son el contenido enviado al proveedor. La agrupación incremental usa distancia coseno y umbral configurado; un singleton queda señalado como outlier para revisión, no es una conclusión causal. Las consultas actuales validan evidencia y pueden ser costosas en tenants grandes; no hay indexación ANN ni promesa de escala validada. No hay reconciliación automática de proveedor, cron instalado ni activación cloud. La verificación local usa proveedor sintético; una cuenta real exige su propio registro de catálogo, privacidad, precios y presupuesto antes de autorizar gasto.

Documentación del proveedor consultada: https://openrouter.ai/docs/api/api-reference/embeddings/submit-an-embedding-request y https://openrouter.ai/docs/api/api-reference/embeddings/list-embeddings-models.
