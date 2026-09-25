# Despliegue web y consumidores durables

Este paquete prepara el despliegue del código publicado. No configura cloud por ejecutarse un build y no es un recibo de producción. El supervisor aplica los cambios remotos autorizados al proyecto propio verificado, registra los resultados y ejecuta F08-01/02.

## Web: configuración concreta

`vercel-settings.json` es el cuerpo de PATCH `/v9/projects/{projectId}`. Antes de aplicarlo, comprobar proyecto/equipo propios, configuración anterior, integración Git y entorno destino. Los valores configuran Next, raíz `apps/web`, fuentes compartidas desde el monorepo y Node22. La instalación usa el lock de la raíz; el build se ejecuta en `apps/web`. No añade GitHub Actions, cron de Vercel ni integración Git. El supervisor conserva el publisher autorizado.

```sh
# Supervisor: archivo JSON revisado; ID y equipo obtenidos del proyecto propio.
vercel api "/v9/projects/$VEXA_DEPLOY_PROJECT_ID" -X PATCH \
  --input support/F08-deploy/vercel-settings.json --scope "$VEXA_DEPLOY_SCOPE" --raw
```

Verificar la respuesta por campos sin registrar valores secretos. El pin `engines.node=22.x` del manifest raíz, de web y de sus entradas del lock evita que Vercel seleccione un major posterior por el rango anterior `>=22`. No cambia versiones resueltas de dependencias. Verificar el Node efectivo en el log de Vercel antes de usar evidencia de Node22; Vercel decide los parches menores del major admitido.

Preparar fuera del repositorio una exportación del SHA Git limpio publicado con sus fuentes públicas, lock y workspace completo. No subir el directorio canónico con `private/`, worktrees, `.env`, bases o evidencias privadas. Eliminar de la exportación únicamente artefactos que no forman parte del runtime no cambia la identidad del código compilado; el inventario debe registrar exactamente qué se envía. Vincular sólo esa copia con el proyecto VEXA verificado. Inspeccionar el upload antes de enviarlo con `vercel deploy --dry --json` según la versión CLI disponible.

Suministrar `VEXA_BUILD_REVISION` con el SHA completo antes del build; no cambiarlo después para renombrar un artefacto. El artefacto de Next debe incluir dependencias externas al root, especialmente `pg` y módulos compartidos. Inspeccionar los traces `.nft.json` y las funciones construidas. Un build convencional que ejecuta `next start` desde todo el checkout no demuestra que el bundle aislado de Vercel tenga esos archivos. Si falta una dependencia, reparar el tracing y verificar el bundle; no añadir un glob de todo el repositorio.

Desplegar primero al destino de ensayo autorizado y comprobar `/api/health/version` contra ese SHA. Si Deployment Protection bloquea el smoke o pg_net, configurar una excepción de automatización de alcance explícito mediante el mecanismo admitido del proyecto. Los scripts de cron actuales sólo envían el Bearer de VEXA; no envían bypass de Vercel. No desactivar protecciones del equipo para ocultar un401 ni contar esa respuesta como ejecución del consumidor.

## Variables de este runtime

Los nombres son contrato; no pegar claves en Git, URL, argumentos CLI visibles o logs. Configurar cada entorno destino por separado. Valores `NEXT_PUBLIC_*` se incorporan al build y son públicos. Las demás variables permanecen en servidor; sólo las señaladas como build se requieren al compilar.

| Variables | Clasificación | Condición |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL` | Públicas, build y runtime | URL y clave pública del mismo proyecto; origen exacto autorizado con redirects Auth. |
| `VEXA_BUILD_REVISION` | Pública, sólo build | SHA real del código. `VEXA_COMPILED_REVISION` y `VEXA_COMPILED_EXTRACTION_CODE` se derivan; no se configuran manualmente. |
| `VEXA_DATABASE_URL` | Secreto servidor | Login restringido, miembro capaz de `SET ROLE vexa_backend`; sin superuser, BYPASSRLS ni tablas propias. Usar conexión TLS y comprobar con ese login real. |
| `VEXA_IMPORT_CONFIRMATION_SECRET`, `VEXA_RETENTION_LEDGER_KEY` | Secretos servidor | Claves independientes conservadas/rotadas con su historial de firmas. |
| `VEXA_SUPABASE_URL`, `VEXA_SUPABASE_ANON_KEY` | Configuración servidor, clave pública | Mismo proyecto que Auth, Storage y DB. |
| `VEXA_WORKER_EMAIL`, `VEXA_WORKER_PASSWORD`, `VEXA_WORKER_USER_ID` | Identidad y secreto servidor | Usuario Auth real, sin usar credenciales de un owner; membership analyst y delegación vigentes por tenant. |
| `VEXA_WORKER_TRIGGER_SECRET` | Secreto servidor y Vault | Al menos32caracteres. El runtime actual comparte este trigger entre consumidores; rotar coordinadamente las cinco entradas Vault. |
| `VEXA_WORKER_DISPATCHER` | Configuración servidor | `enabled` para rotación multitenant. Alternativa `VEXA_WORKER_TENANT` fija y autorizada; no configurar ambas estrategias ambiguamente. |
| `VEXA_DURABLE_CONSUMER` | Configuración servidor | `enabled`: admisión de imports exige consumidor sano; un 202 no prueba ejecución. |
| `VEXA_WORKER_PLATFORM_TIMEOUT_MS`, `VEXA_WORKER_SOURCE_TIMEOUT_MS`, `VEXA_WORKER_INTERVAL_MS`, `VEXA_WORKER_CHUNK_SIZE` | Configuración servidor | 60000,20000,30000,100 respectivamente para la configuración existente. No ampliarlos para esconder fallos. |
| `VEXA_TEAM_AUTH_URL`, `VEXA_TEAM_AUTH_ADMIN_KEY` | Configuración y secreto administrativo servidor | Mismo proyecto Auth; sólo el servidor de invitaciones recibe la clave administrativa. Nunca usarla como conexión DB o credencial del worker. |
| `VEXA_EMAIL_AUTH_ENABLED`, `VEXA_GOOGLE_AUTH_ENABLED` | Configuración servidor | Habilitar sólo tras SMTP/OAuth/redirects propios efectivos; magic link no crea membresías. |
| `VEXA_CRM_CREDENTIALS_JSON` | Secreto servidor | Ref/tenant/proveedor/cuenta reales; concesión de lectura histórica autorizada. Véase CRM-RUNTIME.md. |
| `OPENROUTER_API_KEY` | Secreto servidor | Extracción. Requiere autorización de gasto y política vigente. |
| `VEXA_OPENROUTER_API_KEY` | Secreto servidor | Embeddings/problemas; es un nombre distinto requerido por ese runtime. |
| `VEXA_AI_RUNTIME`, `VEXA_EXTRACTION_CONFIG_JSON` | Configuración privada servidor | Extracción habilitada explícitamente, redacción/política/modelos/precios/vigencia y cuotas reales. |
| `VEXA_PROBLEMS_RUNTIME`, `VEXA_PROBLEMS_CONFIG_JSON` | Configuración privada servidor | Embeddings habilitados explícitamente y compatibles; presupuesto global y embedding. |
| `VEXA_EXTRACTION_CANDIDATES_JSON`, `VEXA_EVALUATION_CUSTODIANS_JSON` | Configuración privada servidor, claves públicas de firma | Evaluación válida, custodios vigentes y selección owner con CAS; no implica entrenamiento automático. |

`VEXA_EVALUATION_SIGNING_KEY` es del custodio externo y nunca se instala en web/worker. `VEXA_WORKER_ENDPOINT` sólo es entrada del scheduler CLI; Vercel no lo necesita para responder a sus rutas internas. El correo de invitaciones/acceso usa Supabase Auth/SMTP. Este paquete no configura ni acredita los transportes de notificaciones excluidos de su alcance.

## Infraestructura de ejecución ya soportada

Hay cinco funciones Node de Next, cada una con `maxDuration=60`, y colas/checkpoints/leases SQL. Supabase `pg_cron` puede invocar por `pg_net` cada30segundos; Vault guarda el Bearer. Esta ruta usa Supabase y Vercel existentes y no necesita un daemon de laptop ni otro hosting. Disponibilidad y límites efectivos se verifican en el proyecto, no por esta descripción.

| Consumidor | Endpoint POST | Script operativo | Secreto Vault / job |
|---|---|---|---|
| imports | `/api/internal/worker` | `supabase/operations/worker-cron.sql` | `vexa_worker_trigger` / `vexa-worker-chunk` |
| CRM | `/api/internal/crm` | `supabase/operations/crm-cron.sql` | `vexa_crm_trigger` / `vexa-crm-chunk` |
| extracción | `/api/internal/extraction` | `supabase/operations/extraction-cron.sql` | `vexa_extraction_trigger` / `vexa-extraction-chunk` |
| problemas | `/api/internal/problems` | `supabase/operations/problems-cron.sql` | `vexa_problems_trigger` / `vexa-problems-chunk` |
| histórico | `/api/internal/history` | `supabase/operations/history-cron.sql` | `vexa_history_trigger` / `vexa-history-chunk` |

Cada script exige `vexa.<nombre>_bootstrap_approved=yes`, endpoint y secreto en parámetros de sesión, con aprobación real del operador. Para imports el nombre es `worker`. No introducir valores en un archivo versionado ni inventar la aprobación. Aplicar por el canal remoto autorizado; si una revisión lo rechaza, detener esa mutación. Los scripts son operaciones explícitas, no migraciones autoejecutadas.

Antes: comprobar `pg_extension` y permisos efectivos de `pg_cron`, `pg_net`, Vault. Si están disponibles pero ausentes, su habilitación es una mutación remota independiente que debe pasar por la aprobación legítima. Provisionar rol DB, usuario Auth worker, membresías/delegaciones y comprobar las cinco rutas con la identidad y secretos reales. Sólo entonces programar los consumidores necesarios. Un runtime IA deshabilitado no permite aceptar procesamiento histórico completo.

Después: verificar nombres únicos, schedule30segundos y estado activo en `cron.job`, sin mostrar la columna command ni secretos Vault en logs. Correlacionar `cron.job_run_details` con respuestas HTTP de `net._http_response`, heartbeat y avance terminal del job de prueba. Éxito de cron significa que se encoló HTTP; no significa que Next devolvió200 ni que el trabajo terminó. Las colas de pg_net no sustituyen la cola durable de producto: si se pierde una invocación, la siguiente debe recuperar el trabajo SQL sin duplicación.

Con cinco schedules activos continuamente hay14400invocaciones/día, aunque la cola esté vacía. No es costo cero: verificar límites, presupuesto autorizado y medición del proveedor. Empezar el smoke con imports y fixtures SYN; habilitar CRM e IA sólo con sus cuentas y permisos de consumo reales. El scheduler no debe usar Vercel Cron diario como equivalente a30segundos.

Para detener un consumidor, aplicar el mismo script con su aprobación real y `vexa.<nombre>_revoke=yes`. Esto elimina únicamente su job; no borra secretos ni cancela trabajo en vuelo. Revisar las leases/reservas pendientes antes de revocar al worker o rotar el trigger compartido. La revocación de history debe conservar extracción/problemas para reconciliar hijos ya admitidos según su autoridad vigente.

## Histórico y mejora evaluada

CRM sincroniza el histórico autorizado hacia almacenamiento canónico; history crea trabajo reanudable que extracción y problemas ejecutan. Se necesita la conexión CRM y una decisión owner de procesamiento con configuraciones/costos reales. Tener una API no sustituye permisos de los datos, gold humano, márgenes, evaluación ni custodios. Las evaluaciones y selección/rollback de configuraciones preservan trazabilidad; este software no se autoentrena ni promueve modelos con sus propias etiquetas como verdad.

## Verificación del delta

`node --test support/F08-deploy/scheduler.test.mjs` usa PostgreSQL/pg_cron/pg_net/Vault reales y recursos propios. Comprueba aprobación ausente, endpoint inválido, creación/rotación sin duplicar job, secreto fuera del comando, revocación aislada y limpieza. El launcher cron está deshabilitado sólo en esa base desechable: no prueba entrega HTTP ni ejecución remota. Los endpoints/consumidores no se modifican aquí; el smoke remoto F08-02 debe probarlos después de desplegar.

Fuentes oficiales consultadas: [monorepos Vercel](https://vercel.com/docs/monorepos/monorepo-faq), [API de proyecto](https://vercel.com/docs/rest-api/projects/update-an-existing-project), [límites de funciones](https://vercel.com/docs/functions/limitations), [tracing Next](https://nextjs.org/docs/app/api-reference/config/next-config-js/output), [Node en Vercel](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions), [Cron Supabase](https://supabase.com/docs/guides/cron), [pg_net](https://supabase.com/docs/guides/database/extensions/pg_net).
