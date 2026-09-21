# Operación del sincronizador CRM

Propuesta local. Las pruebas con fuentes sintéticas no certifican cuentas reales, entrega de cron remoto ni producción.

El owner configura la conexión en `/connections`: proveedor, identificador de cuenta, referencia de la credencial del servidor, comienzo del histórico y activación. El servidor crea la identidad de conexión. Una cuenta distinta requiere una conexión nueva; no se reasigna historia existente. Cambiar el comienzo del histórico crea otra generación de cursores y conserva la deduplicación canónica. Pausar conserva los datos importados.

`VEXA_CRM_CREDENTIALS_JSON` es una configuración secreta del servidor con un array de entradas:

```json
[
  {"tenantId":"<organization UUID>","source":"zendesk","accountId":"<account identifier>","ref":"support-primary","token":"<server secret>","subdomain":"<Zendesk subdomain>"},
  {"tenantId":"<organization UUID>","source":"hubspot","accountId":"<account identifier>","ref":"sales-primary","token":"<server secret>","scopes":["<verified read scope>"]}
]
```

La referencia está vinculada a tenant, proveedor y cuenta. No se aceptan URLs arbitrarias. Los tokens no se guardan en las tablas de configuración ni se entregan al navegador. Los scopes y la cuenta deben verificarse legítimamente con el proveedor; guardar la referencia no los certifica.

El runtime reutiliza Auth, la cuenta de worker y las delegaciones de F02. Variables: `VEXA_DATABASE_URL`, `VEXA_SUPABASE_URL`, `VEXA_SUPABASE_ANON_KEY`, `VEXA_WORKER_EMAIL`, `VEXA_WORKER_PASSWORD`, `VEXA_WORKER_USER_ID`, `VEXA_WORKER_DISPATCHER=enabled` y `VEXA_WORKER_TRIGGER_SECRET` de al menos 32 caracteres. La conexión SQL debe conservar las restricciones del backend. El owner habilita al worker analyst en la organización. Tanto el owner original de la configuración como la delegación y la membresía del worker se comprueban en SQL durante cada operación.

El programador envía `POST /api/internal/crm`, sin tenant en el cuerpo ni query, con `Authorization: Bearer <trigger secret>`. Cada ejecución consume como máximo una página durante 15 segundos y conserva la continuación durable. El backend selecciona una organización autorizada y una conexión pendiente. La migración0015 conserva una rotación durable independiente para imports, CRM y extracción; sus cron pueden intercalarse sin consumir el turno de otro tipo. El propósito lo fija el endpoint del servidor, nunca el cuerpo de la solicitud. No hace falta que un navegador permanezca abierto.

Para comprobar el protocolo local se reutiliza `packages/jobs/durable/scheduler.mjs`, configurando `VEXA_WORKER_ENDPOINT` con el endpoint CRM. `--once` envía una sola solicitud; sin ese argumento programa iteraciones. La operación alojada está preparada por separado en `supabase/operations/crm-cron.sql`. Requiere aprobación legítima para SQL remoto y las extensiones existentes `pg_cron`, `pg_net` y Vault. No se activa por una migración ni por desplegar el frontend. El operador suministra `vexa.crm_endpoint`, `vexa.crm_secret` y `vexa.crm_bootstrap_approved=yes` mediante una sesión protegida; el script guarda el secreto en Vault y programa `vexa-crm-chunk`. No copiar secretos a Git ni al historial de comandos.

Los errores de configuración se reintentan con espera creciente y se detienen después de cuatro intentos. Guardar una configuración corregida reinicia ese contador. Un 401/403 exige rotación legítima de las credenciales y confirmación owner en la pantalla de salud antes del siguiente intento. Los leases se liberan incluso cuando la salud queda en reconexión; sus fences siguen impidiendo liberaciones ajenas o antiguas. Los errores públicos no incluyen respuestas ni tokens del proveedor.

Antes de dar por terminada la conexión externa: aplicar las migraciones aprobadas, configurar los secretos y la identidad delegada, registrar el cron aprobado, comprobar una ejecución remota y reconciliar conversaciones autorizadas con el proveedor. El histórico HubSpot sigue siendo un recorrido conservador de los registros disponibles; no reconstruye snapshots pasados que el proveedor no expone. Sin esos ensayos, la cobertura real permanece pendiente.
