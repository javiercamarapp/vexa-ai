# Extracción durable — propuesta local pendiente de revisión

El recorrido de aplicación es `/analysis` → `/api/extraction` → jobs SQL → `/api/internal/extraction` → redacción privada → gateway y presupuesto SQL → resultado/quarantine y estado visible. El scheduler existente `packages/jobs/durable/scheduler.mjs --once` usa `VEXA_WORKER_ENDPOINT` apuntando al endpoint de extracción. No depende de un navegador abierto. Es un despliegue y una programación separados del importador y de CRM; no sustituir sus cron.

Las migraciones 0011, 0012 y 0014 son necesarias además de las migraciones ya aceptadas. 0013 está reservada al runtime CRM. Los originales CSV/XLSX siguen en Storage y CRM usa su payload canónico persistido. No se publica texto original al proveedor ni a la pantalla de estado. La taxonomía, los nombres y la política son configuración privada del servidor, nunca parámetros de solicitud del navegador.

## Configuración y habilitación

`VEXA_EXTRACTION_CONFIG_JSON` es un array de configuraciones `{tenantId,taxonomy,redactionPolicy,gateway:{policy,modelsByRole,catalog}}`. Cada tenant debe aparecer una sola vez. La redacción exige versión, emails/phones true y modo explícito `dictionary` con nombres o `suppress_all`. El modo dictionary cubre únicamente los nombres configurados, no promete reconocimiento universal. La política/catálogo/modelos son los contratos de `packages/gateway/CATALOG.md` y `DURABLE-BUDGET.md`, con catálogo y atestaciones vigentes. El tiempo total máximo de transportes configurados es 15 segundos. El servidor almacena sólo un hash del conjunto de configuración en cada solicitud; una actualización no cambia silenciosamente trabajos pendientes.

La inferencia permanece desactivada salvo `VEXA_AI_RUNTIME=enabled`; requiere `OPENROUTER_API_KEY`, configuración legítima del proveedor, privacidad y autorización de consumo. Ninguna prueba local autoriza esa activación. Configurar por separado en servidor los datos Auth/DB del worker y su delegación de analista vigente según F02. La identidad/tenant no proceden del cuerpo del trigger. `VEXA_WORKER_TRIGGER_SECRET` debe tener al menos32caracteres. Deadline DB40s, lease45s, límite de función60s y una extracción por tick.

El propietario configura en la pantalla los dos límites de la ventana: global y extracción. La ventana proviene de la política del servidor. Se usan micro-USD enteros; la UI acepta hasta seis decimales sin aritmética flotante contable. Cambios de límite exigen la versión leída (CAS). Configurar un límite no activa inferencia ni consume dinero.

`supabase/operations/extraction-cron.sql` prepara un cron de30segundos con pg_cron/pg_net y secreto en Vault. Es opt-in y requiere aprobación interactiva remota legítima, extensiones existentes y parámetros de sesión. Este archivo no se aplica automáticamente. Eliminar el cron requiere igualmente la aprobación indicada. No introducir secretos en el archivo.

## Recuperación y permisos

Una requestKey identifica una decisión de usuario por actor/tenant. Repetirla conserva el mismo trabajo; cambiar conversación o hash de configuración con la misma clave es conflicto. El worker exige delegación vigente y que el solicitante siga siendo owner/analyst. Tenant, usuario, lease y fence se revalidan por transacción; SQL impone las capacidades de los trabajos encolados antes de crear claims/runs y al escribir resultados o registros de gasto.

Una interrupción anterior a preparar la extracción puede recuperar el trabajo con un nuevo fence, hasta cuatro adquisiciones sin preparación. Una extracción ya preparada y sin resultado terminal pasa a `reconciliation_required`: nunca se reenvía inferencia por vencer un lease. Un resultado terminal persistido antes de perder el proceso permite recuperar el estado del job sin repetir la llamada. Cancelar impide nuevas publicaciones; no puede retirar una petición que ya llegó al proveedor ni convierte gasto incierto en cero.

El propietario concilia una reserva con costo confirmado, hash SHA-256 de evidencia del proveedor y confirmación explícita. La API deriva el job de la reserva bajo el tenant autorizado, no desde datos del cliente. Conciliar gasto no inventa un resultado perdido ni vuelve a ejecutar extracción. Una nueva solicitud puede generar otro costo y necesita una decisión explícita. La evidencia humana declarada se registra; un hash no verifica por sí solo una factura externa.

La pantalla lista las100solicitudes más recientes y las100conversaciones canónicas más recientes; la API acepta cualquier conversación accesible del tenant, sujeta a redacción y límites. No hay reenvíos automáticos desde la pantalla. Un error no se muestra como ausencia de datos.

## Alcance de la evidencia

Pruebas locales con Auth, PostgreSQL, Storage, Next y Chromium reales. El proveedor de inferencia es HTTP sintético rotulado y no usa dinero; no se comprobó un modelo comercial, precisión sobre histórico del cliente ni producción remota. Revisión independiente, aceptación e integración oficial siguen pendientes; este documento no aumenta el contador17/60.
