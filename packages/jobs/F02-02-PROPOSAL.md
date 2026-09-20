# F02-02 — propuesta canónica con evidencia local

Propuesta para revisión del principal; no preparada, aceptada ni publicada. Gate02 externo pendiente; estas pruebas de autor no lo sustituyen. Baseline SHA `71bd4bf3c26c16f37fa8be98ae6765316e329a03`; no se creó commit ni candidate_sha. Identidad del contenido: `F02-02-owned-manifest.json` (SHA256 por archivo).

## Alcance y contrato

- `POST /api/imports`: SSR existente, Origin obligatorio, tenant seleccionado de sesión/membership activa y acción `import` mediante `createDatabase`/`SqlPool`. Reserva persistida con usuario, conexión, hash SHA256, tamaño 1–20 MiB, MIME CSV/XLSX, mapping y caducidad de 15 minutos. Idempotency-Key único por tenant; cambios de metadata/usuario producen conflicto. Concurrencia serializada por unique + row lock.
- Carga directa a Storage privado mediante URL firmada de la misma sesión, `upsert:false`, ruta generada por servidor; ninguna ruta/bucket/admin SQL/service key proviene del cliente. El upload_token de confirmación es HMAC ligado a tenant/import/usuario/fingerprint/expiry; requiere secreto servidor >=32 caracteres.
- Confirmación verifica propietario de Storage, descarga bytes reales y valida tamaño/hash antes de la transacción. Después revalida identidad, rol, conexión y reserva. `confirm_import` bloquea la reserva y crea job + outbox + transición `queued` + vínculo de upload en una transacción; una reserva previa sin job es un estado recuperable, no un import confirmado sin outbox. Replay no duplica efectos.
- `GET /api/imports/:id` devuelve estado persistido; `queued` nunca significa completed. No hay pipeline F06, parsing F02-01, UI03 ni consumidor F02-05/06 en esta propuesta.
- Producer Next usa `pg` real y export `@vexa/platform/db`. Rechaza login SUPERUSER/BYPASSRLS/propietario de tablas públicas; cada transacción usa rol `vexa_backend` NOLOGIN/NOSUPERUSER/NOBYPASSRLS. Configuración ausente/fallo devuelve 503.
- SQL0001–0004 permanecen idénticos a baseline. SQL0005 es aditivo. RLS limita reservas y acceso backend a objetos; un trigger de namespace importa también al redimir URL firmada, pues Storage firmado usa privilegios que eluden la política RLS de INSERT. Comprueba dueño/reserva/estado/expiry/membership y tamaño cuando Storage aporta `metadata.size`; la confirmación siempre comprueba bytes completos. Firma hace un probe rollback-only con metadata `contentLength` sin `size`. Objetos del namespace quedan inmutables (UPDATE/DELETE denegados). Función de guardia SECURITY DEFINER, search_path vacío, EXECUTE público revocado: revisar explícitamente este límite privilegiado.

## Defectos encontrados y corregidos

1. Import relativo del producer no resolvía packages/jobs: build original exit1; corregido, build + TypeScript exit0.
2. Parcial admitía 32 MiB; alineado a 20 MiB del contrato F02-01.
3. RLS sola no detenía redención de URL firmada tras expirar: prueba real devolvió 200 (rojo preservado en run-1789878469669508000). Guard SQL0005 lo rechaza ahora. Primer guard rechazó el probe de firma por metadata sin size; fallo preservado y corregido sin relajar dueño/expiry.
4. Transporte de ensayo bash/FD quedó bloqueado; sustituido por `nc` del contenedor existente, protocolo Pg real por socket Unix efímero. No DB publicada. Primer ensayo timeout124 con cleanup verificado, no mutante muerto ni fallo atribuido a SQL de producto.

## Reproducción

Requiere imágenes locales ya cacheadas enumeradas en `test/infra.mjs`, Docker disponible y Node (ejecutado con 26.7.0). No pull; no nube ni API pagada. Lifecycle/broker existentes se importan read-only desde tests/acceptance/support/ci; no se modifican. Cada ensayo crea DB/Auth/Storage/PostgREST propios, red UUID y journal0600. Fixture: `test/fixtures/SYNTHETIC.csv`, mismo contenido del ensayo HTTP; usuarios/tenants aleatorios de Auth real local.

```sh
python3 -B packages/jobs/test/prepare.py
F02_PRODUCT_TMP=$(cat packages/jobs/test/evidence/product-tmp-path.txt) python3 -B packages/jobs/test/run.py node packages/jobs/test/http.mjs
PYTHONDONTWRITEBYTECODE=1 npm test
PYTHONDONTWRITEBYTECODE=1 npm run test:controller
PYTHONDONTWRITEBYTECODE=1 npm run graph:check
```

`prepare.py` instala con `npm ci --ignore-scripts` en TMP, HOME temporal y configs npm vacías distintas (usar /dev/null para ambas falló por double-loading, preservado). No node_modules/.next en candidato. Construye Next y TypeScript; guarda comandos/exits. El harness reutiliza patrones HTTP/cookies del banco 5fbf223 y la infraestructura local existente, sin copiar oracle de referencia al producto ni el DDL/pipeline legacy.

## Resultados observados

- Preparación final `test/evidence/prepare-1789878670528905000.json`: install0/build0, TMP nuevo.
- Ensayo HTTP final `test/evidence/run-1789878710762393000/result.json`: exit0, cleanup_verified=true; output contiene PRODUCT_HTTP_COMPLETE. Quince grupos PASS: SSR/CSRF; reserva concurrente/replay/conflicto; Storage real/scope/capability; confirmación concurrente con un job/outbox/GET queued; restart/replay; hash incorrecto; tamaño Storage incorrecto y retry correcto; Storage/RLS cross-tenant; reserva expirada; rollback por excepción en outbox; muerte REAL de Next durante pg_sleep en trigger de outbox (se comprobó llegar a PgSleep), rollback y recuperación tras restart; rol backend seguro/login privilegiado rechazado; rol/revocación; falta de Pg503.
- `test/evidence/renewed-regressions.json`: npm test0, controlador0 (110 tests), graph:check0. Graph sólo lectura; no modificación ni regeneración.
- Todos los ensayos fallidos/timeout conservados en evidence; cleanup verificado para cada ejecución. Los errores de setup no se cuentan como mutantes. No se ejecutaron mutantes externos ni se removió GATE_INCOMPLETE.

## Revisión requerida y no probado

- Principal debe revisar ampliación prospectiva de allowlist ANTES de prepare02: sólo apps/web/package.json (`pg`/`@types/pg`), packages/platform/package.json (export db) y package-lock.json. No se tocó grafo/control-plane/otras copias.
- Revisión independiente del código, trigger privilegiado, fixtures y gate02 congelado; después ciclo oficial serial del principal. Presupuesto de modelos no reiniciado y sin subagentes adicionales.
- No probado: Node22, browser JS interactivo, proveedores/cloud/producción, consumidor/delivery del outbox, cuotas agregadas por tenant, carga alta y memoria máxima, rotación del secreto (invalida capacidades pendientes), retención/borrado de objetos reservados inmutables y compatibilidad con otras versiones de Storage. Membership/expiry se comprueban al insertar el objeto; revocación concurrente en el último instante de una transacción no tiene prueba específica.
- Una URL firmada es una capacidad portadora transferible; la atribución de propietario se fija al usuario firmante, no al humano que transmite bytes. Confirmación exige además sesión del dueño. No se afirma vinculación criptográfica al dispositivo.
- Configurar exclusivamente en servidor `VEXA_DATABASE_URL` con login dedicado sin privilegios y grant de vexa_backend, `VEXA_IMPORT_CONFIRMATION_SECRET`, y configuración Auth SSR existente. No contiene credenciales productivas ni habilita envío/despliegue alguno.
