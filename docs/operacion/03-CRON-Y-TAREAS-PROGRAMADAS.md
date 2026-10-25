# Cron y tareas programadas de Rovaq

Estado: PROPUESTA. No se activo nada (ni pg_cron, ni Vercel Cron, ni GitHub Actions, ni cron/launchd en esta Mac). Todo lo marcado «no verificado» no se pudo comprobar sin leer produccion.

## 1. Inventario: que existe y que hace falta

El patron del repo es: un **consumidor durable** por endpoint `POST/GET /api/internal/<consumidor>` (Next.js, `maxDuration` 30-60 s, secreto `VEXA_WORKER_TRIGGER_SECRET`), que procesa UN trozo por llamada y devuelve `IDLE` si no hay trabajo. Alguien externo debe llamarlo.

| Tarea | Endpoint / consumidor | Existe en codigo | Programacion declarada hoy | Activa en produccion |
|---|---|---|---|---|
| Procesar jobs de importacion (lotes, asociaciones, historial) | `/api/internal/worker` (`imports`) | si | plantilla `supabase/operations/worker-cron.sql` (pg_cron, 30 s) | no verificado |
| Sync HubSpot / CRM | `/api/internal/crm` (`crm`) | si | `apps/web/vercel.json` `*/5 * * * *` y plantilla `crm-cron.sql` (30 s) | no verificado |
| Extraccion IA | `/api/internal/extraction` | si | plantilla `extraction-cron.sql` | no verificado |
| Embeddings / problemas | `/api/internal/problems` | si | plantilla `problems-cron.sql` | no verificado |
| Metadatos de extraccion | `/api/internal/metadata` | si | `vercel.json` `*/15 * * * *` (sin plantilla pg_cron) | no verificado |
| Historial por lotes | `/api/internal/history` | si | plantilla `history-cron.sql` | no verificado |
| Notificaciones (outbox/correo/push) | `/api/internal/notifications` | si | plantilla `notifications-cron.sql` | no verificado |
| **Limpieza de leases vencidas** | (no hace falta tarea propia) | si, dentro del claim | — | depende de que los consumidores corran |
| **Reconciliacion de imports `running` viejos** | no existe | NO | — | pendiente (ver 1.2) |
| Respaldo logico del tenant | `ops/backup-restore/backup.mjs` | si (manual) | ninguna | ver 04-RESPALDOS |
| Vigilancia (colas, leases, imports viejos) | `ops/diagnostics/*.sql` | si (manual) | ninguna | — |

Hechos de codigo que sustentan la tabla: `apps/web/src/app/api/internal/*/route.ts` (7 consumidores; `createRuntime` rechaza cualquier otro), `apps/web/vercel.json` (2 crons), `supabase/operations/*-cron.sql` (6 plantillas, todas «EXPLICIT INTERACTIVE REMOTE APPROVAL REQUIRED, Never called automatically»), `packages/jobs/durable/scheduler.mjs` (disparador local HTTP).

### 1.1 Leases vencidas: no necesitan cron propio
`packages/jobs/durable/repository.mjs` → `claim()` selecciona `state='queued'` **o** `state='running' AND lease_until<=now()` (con `FOR UPDATE SKIP LOCKED`), sube `fencing_token`, y marca los `attempts` abiertos como `uncertain` con `error_code='LEASE_EXPIRED'`. Si el `deadline` ya vencio o se agotaron intentos (`min(max_attempts,4)`), el claim lo termina como `failed` con `dead_letters` (`DEADLINE`, `ATTEMPTS_EXHAUSTED`, `ACTOR_REVOKED`, `CONNECTION_REVOKED`). Conclusion: **limpiar leases = asegurar que el consumidor se dispare mientras haya trabajo**. Lo que si falta es **vigilancia**: `ops/diagnostics/02-jobs-atascados.sql` lista lo que lleva tiempo sin ser reclamado. Un «limpiador» que escriba `lease_until=null` desde fuera seria PELIGROSO (rompe el fencing): no se propone.

### 1.2 Imports `running` desde el 28-sep (6 de `crm-canonical-v1`)
No se auto-cierran: tienen 4,536 aceptadas y 5,299 rechazadas `sync-raw`; cerrarlos es una escritura de produccion y una decision de negocio (Javier). Propuesta: (a) **detectar** semanalmente con `03-imports-en-curso-viejos.sql` (solo lectura); (b) si Javier decide cerrarlos, un cierre explicito, por import y con respaldo previo, se describe en el runbook (06, seccion 4). No se escribio una funcion SQL de «reconciliacion automatica»: seria una migracion nueva con efectos sobre datos y requiere su criterio.

## 2. Opciones para disparar los consumidores

Hechos verificados en documentacion oficial el 18-oct-2026: Vercel Cron «available on all plans», **todas** las cuentas 100 crons por proyecto; Hobby solo 1 vez al dia con precision ±59 min; Pro/Enterprise minimo 1 minuto; cada ejecucion es una invocacion de Vercel Function con el mismo precio (Pro: $0.60 por millon de invocaciones, mas Active CPU y memoria aprovisionada; <https://vercel.com/docs/cron-jobs/usage-and-pricing>, <https://vercel.com/docs/functions/usage-and-pricing>).

| Opcion | Granularidad | Costo directo | Efecto en builds | Riesgos |
|---|---|---|---|---|
| **A. Supabase pg_cron + pg_net + Vault** (plantillas ya escritas) | 30 s (o cualquier cron) | Sin cargo aparte (no verificado para este plan); usa CPU/conexiones de la base Micro; cada disparo = 1 invocacion de funcion en Vercel | **Ninguno** (no hay despliegue; el cambio es SQL) | Requiere habilitar extensiones y Vault en produccion (accion de Javier). Sin compuerta, 7 consumidores x 2/min = 20,160 invocaciones/dia aunque no haya trabajo |
| **A+. A con compuerta** (`ops/scheduling/gates.sql` + `pg_cron-gated.TEMPLATE.sql`) | 30 s solo si hay trabajo | casi 0 en reposo | Ninguno | Compuerta solo cubre consumidores basados en `jobs` (imports, extraction, problems, notifications); crm/history/metadata necesitan cadencia fija |
| B. Vercel Cron (`vercel.json`) | 1 min minimo en Pro | invocaciones normales | **Cada cambio de calendario exige un despliegue = 1 build**; los crons solo corren en el despliegue de produccion | No da 30 s; el proyecto tiene Ignored Build Step `exit 0` y sin Git, asi que cambiar `vercel.json` obliga a un deploy por CLI. Plan del equipo `likida`: no verificado |
| C. GitHub Actions `schedule` | 5 min minimo, best-effort | repo publico: minutos de runners estandar gratis (no verificado hoy); Actions esta DESACTIVADO en el repo por decision de Javier | Ninguno | Retrasos, deshabilitacion automatica tras 60 dias sin actividad (comportamiento documentado de GitHub; no verificado hoy), secretos en GitHub; solo sirve como vigilante secundario |
| D. `scheduler.mjs` manual (`node packages/jobs/durable/scheduler.mjs`) | 10-60 s | 0 | Ninguno | Solo mientras la terminal viva; sin reinicio automatico. **Util para demos/cargas supervisadas** |
| E. cron/launchd en la Mac | cualquiera | 0 | Ninguno | **Prohibido** por instruccion (no hooks/cron globales) y la Mac no es 24/7 |

### Costo estimado de las invocaciones (supuestos marcados)
Supuestos (no medidos): 1 GB de memoria, cada llamada en reposo (`IDLE`) ~0.4 s de pared y ~50 ms de CPU activa, region iad1/pdx1 (CPU $0.128/h, memoria $0.0106/GB-h segun la tabla oficial). 
- Sin compuerta, 7 consumidores cada 30 s: 604,800 invocaciones/mes → $0.36 (invocaciones) + ~$0.71 (memoria: 604,800 x 0.4 s x 1 GB / 3600 = 67 GB-h) + ~$1.07 (CPU: 604,800 x 0.05 s / 3600 = 8.4 h) ≈ **US$2.2/mes**.
- Con compuerta en 4 consumidores y crm/history/metadata cada 5 min: 3 x 8,640 = 25,920 invocaciones/mes en reposo ≈ **US$0.1/mes** + el trabajo real.
Lo caro no son las llamadas sino (1) los **builds** y (2) la **IA** (ver 07). Si el equipo `likida` esta en Pro, el credito mensual de uso de Pro (monto no verificado) probablemente absorbe estas cifras.

## 3. Recomendacion

1. **Produccion: opcion A+** (pg_cron + pg_net + Vault con compuerta), escalonada: primero `imports` (es lo que hoy bloquea las piezas 2-10), luego `extraction`/`problems`/`notifications`; `crm`, `history`, `metadata` cada 5 min fijos hasta definir su compuerta. Orden de arranque: `bootstrap-extensions.sql` → verificar con `verify-extensions.sql` → crear secreto en Vault → una programacion → observar 10 min (`cron.job_run_details`, `net._http_response`) → siguiente.
2. **Quitar la duplicidad**: `apps/web/vercel.json` ya programa `crm` (5 min) y `metadata` (15 min). Si se adopta A+, borrar esos dos crons en el **proximo despliegue que ya estuviera planeado** (no desplegar solo por esto: cuesta un build). Mientras tanto, llamadas duplicadas son inofensivas (`CHUNK_BUSY` 409 / fencing) pero se pagan.
3. **Hasta que A+ este aprobado**: opcion D bajo supervision (`--once` para una prueba; modo continuo para cargas), cuyo costo es solo las invocaciones.
4. **Vigilancia semanal** (manual o por agente, solo lectura): `ops/diagnostics/01,02,03`. Alertas automaticas (correo) quedan pendientes: requieren destino y credencial (no se asumio ninguno).
5. Nada de esto se activo. Cada paso que escribe en produccion (extensiones, Vault, `cron.schedule`) es **accion de Javier** con el script `!` correspondiente y su rollback (`cron.unschedule`).

## 4. Pruebas realizadas (local)
`node ops/scheduling/test.mjs`: las compuertas se abren solo con trabajo reclamable (queued vencido, running con lease vencida), se cierran con lease vigente, cancelacion pedida o job terminado; y el comando con compuerta no llama al endpoint cuando no hay trabajo (simulado con una funcion local; pg_cron/pg_net reales NO se probaron: no estan en el Postgres local).

## 5. No verificado
- Si pg_cron/pg_net/Vault ya estan instalados o hay programaciones activas en `proyecto-ejemplo`.
- Si el despliegue de produccion de `rovaq-ai` (antes `vexa-ai`; https://rovaq-ai.vercel.app) incluye el `vercel.json` con crons (y por tanto si ya hay invocaciones cada 5/15 min).
- Plan del equipo `likida` en Vercel; credito mensual de Pro; limite de concurrencia/conexiones de pg_cron en Micro.
- Retencion de `net._http_response` y `cron.job_run_details` (crecimiento de tablas).
- Compuertas para crm, history y metadata.
