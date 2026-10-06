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

Para comprobar el protocolo local se reutiliza `packages/jobs/durable/scheduler.mjs`, configurando `VEXA_WORKER_ENDPOINT` con el endpoint CRM. `--once` envía una sola solicitud; sin ese argumento programa iteraciones. La operación alojada está preparada por separado en `supabase/operations/crm-cron.sql`. Requiere aprobación legítima para SQL remoto y las extensiones existentes `pg_cron`, `pg_net` y Vault. Esta alternativa SQL no se activa por una migración ni por desplegar el frontend. No habilitarla simultáneamente con el cron Vercel descrito abajo. El operador suministra `vexa.crm_endpoint`, `vexa.crm_secret` y `vexa.crm_bootstrap_approved=yes` mediante una sesión protegida; el script guarda el secreto en Vault y programa `vexa-crm-chunk`. No copiar secretos a Git ni al historial de comandos.

Los errores de configuración se reintentan con espera creciente y se detienen después de cuatro intentos. Guardar una configuración corregida reinicia ese contador. Un 401/403 exige rotación legítima de las credenciales y confirmación owner en la pantalla de salud antes del siguiente intento. Los leases se liberan incluso cuando la salud queda en reconexión; sus fences siguen impidiendo liberaciones ajenas o antiguas. Los errores públicos no incluyen respuestas ni tokens del proveedor.

Antes de dar por terminada la conexión externa: aplicar las migraciones aprobadas, configurar los secretos y la identidad delegada, registrar el cron aprobado, comprobar una ejecución remota y reconciliar conversaciones autorizadas con el proveedor. El histórico HubSpot sigue siendo un recorrido conservador de los registros disponibles; no reconstruye snapshots pasados que el proveedor no expone. Sin esos ensayos, la cobertura real permanece pendiente.


## Cron CRM en Vercel — 6 de octubre de 2026

`apps/web/vercel.json` declara únicamente `/api/internal/crm` cada cinco minutos (`*/5 * * * *`). El proyecto debe tener Root Directory `apps/web` y plan compatible. [Vercel crea los cron al desplegar producción](https://vercel.com/docs/cron-jobs/quickstart); los previews no los programan. [Pro admite intervalos de un minuto; los cron están incluidos, pero sus Functions consumen uso facturable](https://vercel.com/docs/cron-jobs/usage-and-pricing).

GET y POST usan la misma instancia de `createCRMHostedHandler`, el mismo secreto y la misma selección de worker/tenant autorizada por Auth/RLS. El operador configura `CRON_SECRET` como variable Sensitive de producción **con el mismo valor** de `VEXA_WORKER_TRIGGER_SECRET` (mínimo 32 caracteres). [Vercel envía automáticamente `Authorization: Bearer <CRON_SECRET>`](https://vercel.com/docs/cron-jobs/manage-cron-jobs). El endpoint sólo verifica el secreto del trigger; no admite una credencial alternativa, cookies, User-Agent ni cabeceras de cron como autorización. Secreto ausente/mal configurado falla cerrado; valor distinto devuelve 401. Nunca copiar valores a código, URLs, logs o documentación.

GET exige cuerpo vacío y ninguna query. POST conserva cuerpo vacío o `{}` y ninguna query. Ninguno acepta tenant ni parámetros de trabajo. Ambos devuelven `Cache-Control: private, no-store`, conservan deadline CRM de 15 segundos y `maxPages:1`, y comparten la exclusión local `CHUNK_BUSY`. Entre instancias siguen vigentes los leases/fences durables; el guard local no sustituye RLS ni un lock distribuido. No hay activación de IA ni modificación de otros consumidores.

Secuencia de activación a cargo del operador autorizado:

1. Comprobar que no haya otro scheduler CRM activo. Para impedir trabajo automático antes de verificar el endpoint, mantener los cron desactivados si el control está disponible; alternativamente, comprobar que `CRON_SECRET` esté ausente del primer despliegue. Conservar `VEXA_WORKER_TRIGGER_SECRET`: el GET automático sin Bearer debe devolver 401 y nunca iniciar el runtime. La definición puede estar registrada y disparar solicitudes rechazadas; eso no equivale a sincronización activa.
2. Desplegar y verificar SHA, endpoint sin credencial rechazado, GET autenticado manual sin query/cuerpo y POST existente. Comprobar avance durable, identidad delegada y salud sin exponer datos ni secretos. No aportar todavía la credencial automática hasta completar estas comprobaciones.
3. Tras verificar, instalar `CRON_SECRET` Sensitive mediante el canal protegido con el mismo valor del trigger y redesplegar el **mismo SHA validado**; o habilitar los cron si se usó el control de desactivación. Observar al menos dos intervalos, ejecuciones, avance de cursor y fallos. La entrega de cron es best effort y puede duplicarse o faltar; un HTTP 200 aislado no acredita continuidad.
4. Para pausar, desactivar los cron si ese control está disponible; alternativamente, retirar `CRON_SECRET` y redesplegar, verificando que las nuevas solicitudes automáticas devuelvan 401. Para retirar la definición, eliminarla y redesplegar. Conservar checkpoint y delegaciones según la decisión operativa. No resetear cursores; respetar [el límite de rollback v2](HUBSPOT-BOUNDED.md).

El techo nominal con un bloque por invocación es 288 bloques al día, compartidos entre conexiones autorizadas pendientes. Los bloques pueden ser metadata, eventos, mensajes o trabajo auxiliar; no equivalen a 288 mensajes. Esta configuración no demuestra capacidad suficiente para completar el histórico ni monitorización permanente. Las pruebas locales son sintéticas; la activación, continuidad remota y tiempos de persistencia requieren evidencia operativa separada.
