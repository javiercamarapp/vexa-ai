# F02-05/06 — reconciliación acotada

Base/HEAD: `ff5f9bf8813b8d7956f3b1482d2b220cc4b8e6ca`. Estado conservado: **15/60 aceptadas, F02 4/6**. Propuesta local sin commit, accept, push, cloud, gasto ni llamadas a modelos. Sólo las cuatro áreas autorizadas. No se accedió a originales privados.

## Delta

Adopción selectiva desde `product56` de runtime durable, consumer/daemon, credenciales Auth con renovación, scheduler HTTP, dispatcher SQL multitenant con rotación persistida, rutas de jobs, UI, mapeo role/conversation y admisión configurable por salud. No se copió un árbol completo ni evidencia histórica. Se conserva el scheduler SQL pg_cron/pg_net/Vault como operación explícita, nunca autoejecutada por producto.

`0001..0006` (incluida 0006 final) y navegación con seis links core + Gestión son idénticas por bytes/modo a la base. Import-preview retiene bootstrap asíncrono con AbortController y busy inicial; sólo suma campos de mapping y enlace al job. El lint temprano descubrió efectos y enlace de UI heredados: se corrigieron cargas asíncronas cancelables/polling y enlaces Next sin desactivar reglas.

P1 0007: INSERT y UPDATE vinculan explícitamente tenant al scope. Trigger invoker vuelve inmutables `tenant_id` y `user_id`; enabled y last_dispatched_at siguen editables bajo sus permisos. Owner A+B con scope A ya no inserta en B; cambiar user_id queda rechazado. **Tenant A→B ya era rechazado en fuente; no se declara explotable.** El scope vacío exhibió el mismo defecto INSERT y también queda rechazado.

No se adoptó `bootstrap.mjs` de fuente porque contenía aprovisionamiento de memberships mediante SQL admin. Runtime conserva login SQL NOSUPERUSER/NOBYPASSRLS/no-owner, identidad validada por Auth y delegación explícita. La cuenta/membership analyst se aprovisiona externamente, con autorización; owner habilita/revoca desde UI. No hay SQL administrativo de aprovisionamiento dentro del runtime.

## Comandos y evidencia de esta sesión

Directorio de evidencia: `/var/folders/l3/czqfpdq5057__w_l5dxpp5pc0000gn/T/vexa-resume-4t92r386`. Dependencias y build exclusivamente `/var/folders/l3/czqfpdq5057__w_l5dxpp5pc0000gn/T/vexa-resume-4t92r386/build`; npm offline, ignore-scripts y dos archivos config vacíos distintos. NODE_TEST_CONTEXT eliminado en procesos reales; Python ejecutado con -B.

| Comando | Exit / observación |
|---|---|
| `npm ci --offline --ignore-scripts --no-audit --no-fund` en TMP | 0 |
| `npm run lint --workspace @vexa/web` en TMP | 1 original: tres errores/dos warnings; 0 tras corrección |
| `npm run build --workspace @vexa/web` en TMP | 0, Next/TypeScript |
| `env -u NODE_TEST_CONTEXT node --test packages/ingestion/*.test.mjs packages/jobs/durable/test/*.test.mjs` | Node26.7: 102 pass, 0 skip/fail |
| Mismo comando con Node22.22.0 local | 0; 102 pass, 0 skip/fail |
| `env -u NODE_TEST_CONTEXT npm test` con configs vacías/offline | 0; 24 pass |
| `env -u NODE_TEST_CONTEXT VEXA_REUSE_SOURCE=<product56> node supabase/tests/worker-delegations/resume.mjs --original` | 1: fallos reales INSERT B, UPDATE user_id y INSERT sin scope; no error de setup |
| Mismo probe sin `--original` | 0; 9/9 controles, Auth local real y login SQL restringido |
| `env -u NODE_TEST_CONTEXT node /var/folders/l3/czqfpdq5057__w_l5dxpp5pc0000gn/T/vexa-resume-4t92r386/integration.mjs` | 1 después de 8 grupos: ensayo esperaba checkpoint500, default vigente100 |
| `env -u NODE_TEST_CONTEXT node /var/folders/l3/czqfpdq5057__w_l5dxpp5pc0000gn/T/vexa-resume-4t92r386/integration-final.mjs` | 0; 10 grupos + browser + dispatcher/reinicio Next; recuperación 10K sin duplicación |
| `git diff --check` | 0 |

La segunda integración fija chunkSize500 explícito sólo en el fixture de SIGKILL (no modifica producto ni aceptación) y añade navegador con access/refresh tokens emitidos por Auth real. Chromium Docker local usa sandbox Chromium deshabilitado en contenedor; no deshabilita seguridad de origen. No se fabricaron JWT de usuario. Las claves anon/service de infraestructura efímera sólo configuran los servicios locales y no otorgan SQL privilegiado al runtime.

Los SQL probes escriben fixtures SYNTHETIC mediante setup externo; las operaciones examinadas usan login restringido, `SET LOCAL ROLE vexa_backend` y sujeto confirmado por `/user`. Todos los probes hacen ROLLBACK. `sql-red.log`/`sql-green.log` conservan códigos y affected rows. No se llaman mutantes muertos a timeout/setup ni se acredita aceptación con pruebas propias.

## Operación y pendientes

Config runtime: VEXA_DATABASE_URL, VEXA_SUPABASE_URL, VEXA_SUPABASE_ANON_KEY, VEXA_WORKER_EMAIL/PASSWORD/USER_ID. Dispatcher: VEXA_WORKER_DISPATCHER=enabled; alternativa instancia fija: VEXA_WORKER_TENANT. Endpoint alojado requiere VEXA_WORKER_TRIGGER_SECRET y VEXA_WORKER_PLATFORM_TIMEOUT_MS=60000. VEXA_DURABLE_CONSUMER=enabled activa admisión por salud. Scheduler HTTP y SQL son implementaciones ejecutables; su autorización/configuración remota sigue pendiente.

No probado: gate externo completo/standalone06, matriz global007 ampliada (nueva función/trigger requieren control-plane), revisión independiente de este delta, verify/accept/publicación; estabilidad y límites bajo carga del proveedor, entrega cron por red real/cloud, provisión externa de cuentas/memberships y auditoría global enterprise. No se declara connection-ready ni 17/60. Se reutilizó evidencia/código revisado intacto; no se repitió revisión integral.

## Integridad y limpieza

43 archivos de entrega, todos regulares0644; preflight por SHA256/modo en `/private/var/folders/l3/czqfpdq5057__w_l5dxpp5pc0000gn/T/vexa-resume-4t92r386/delivery-manifest.json`. Fuera de allowlist, migraciones0001..0006 y navegación intactos. SHA2560007: `006162251a75eaf28ff38c4b037342613b0d38b4833a0b76922714017adba971`.

`cleanup-final.json`: 21 recursos Docker propios ausentes.20 conservan ID Docker y se verificaron por inspect; el browser se retiró por ID mediante broker, pero ese ID no quedó persistido: ausencia final verificada por su nombre UUID/label. Este límite del recibo se conserva; no se inventa ID. Build/node_modules/.next y dos copias runtime eliminados; sockets eliminados, ocho puertos de ensayo libres. Hijos de test concluyeron por eventos exit o kill explícito; listado global ps rechazado por sandbox. Sin reset/prune ni manipulación de recursos ajenos. El primer bind de comprobación salió1 por dirección en uso; la repetición con SO_REUSEADDR salió0 y comprobó disponibilidad de los ocho puertos.

Journals activos0600 en TMP; no se copiaron/normalizaron journals históricos. Fuentes reutilizadas quietas e idénticas por hash/modo al cierre. `diagnostic.json` conserva una consulta diagnóstica de fixture con columna equivocada (exit1) y su corrección (exit0); ninguna cuenta como prueba. Evidencia y scripts adaptados quedan en TMP, sin secretos en la entrega.

La integración prueba checkpoint+replay tras SIGKILL a500,10.000 filas aceptadas sin duplicación, dos consumidores/tenants, roles/fence/revocación/deadline/backoff/CSV/CAS, refresh real y coldstarts. Expiración de lease inyectada por SQL de fixture; reloj cliente adelantado para disparar refresh. Scheduler pg_cron registrado/revocado localmente; no acredita entrega remota. Estado final de aceptación sigue15/60.

Inicio comprobado20:20:56UTC; cierre de pruebas/limpieza20:34:37UTC (821s). Última verificación HEAD y diff-check sin cambios Git.
