# Continuación acotada core22 — compatibilidad de integración, 2026-09-19

**Propuesta NO aceptada; promoción NO autorizada.** Baseline SHA `9bffa3cb26fb71319a1695a71dd303604f9eb17a`; candidate_sha no creado, cambios locales sin commit. Un solo escritor. El informe y toda evidencia anterior se conservan íntegros debajo y en sus rutas originales. No se editaron workspace-service, app, gate externo, orchestration ni Git.

## Resultado y contrato

- Snapshot: únicamente las dos ramas OLD/NEW de padre ausente/invisible cambian `23514` por `23503`. Publicado inmutable conserva `23514`; las políticas RBAC y su `42501` no cambian. FK de parent inexistente/otro tenant probada en INSERT de components/attributions y UPDATE; postpublished UPDATE/DELETE denegados; revocación impide escritura, INSERT de snapshot produce `42501`. Un INSERT de hijo con miembro revocado puede alcanzar primero el guard de padre invisible y devolver `23503`: no se promete prioridad de RBAC sobre triggers BEFORE. Su acceso sigue cerrado.
- La definición aprobada excluye **sólo en interventions** `version` y `reason`, además de los campos operativos ya excluidos. Payload, owner, hipótesis, referencias/baseline, recomendación y planes permanecen fijados; versiones de recomendación/planes siguen siendo contenido. El recibo sigue calculado por DB y no escribible por el llamante.
- Cambiar contador/razón después de draft exige cambio de estado y `version=OLD.version+1`; la máquina de estados y permisos se comprueban igualmente. No se puede saltar/retroceder contador, editar razón en terminal ni usar el incremento para cambiar contenido/recibo. Se mantienen los UPDATE sólo de status anteriores; el CAS esperado se valida en el servicio real y en su WHERE, no se presenta el trigger como sustituto del CAS del consumidor.
- Ciclo SQL positivo draft→approved→active→measuring→closed con `UPDATE status,version=version+1,reason` y predicado de versión: termina en versión5, recibo idéntico y resultado de medición permitido. No exige reaprobación operativa.
- Servicio real importado read-only: approve→active→measuring con versión2/3/4, razones diferentes, recibo idéntico, dos comandos con CAS viejo rechazados por **409/version_conflict**, sin persistir comandos/audit/outbox fallidos (4 filas de cada uno, incluidos creación y tres transiciones).

## Evidencia y regresiones

| Comando / artefacto | Salida |
|---|---|
| `node --test packages/platform/tests/schema/integration-compat.test.mjs` antes del parche | exit1, tests4/pass0/fail4. [Rojo previo](tests/schema/evidence/core22-integration-red.tap): FK clasificada incorrectamente y transición legítima rechazada. |
| `node --experimental-strip-types --test packages/platform/tests/schema/db.test.ts packages/platform/tests/schema/sql.test.mjs packages/platform/tests/schema/review-regressions.test.mjs packages/platform/tests/schema/approval-content.test.mjs packages/platform/tests/schema/integration-compat.test.mjs` | exit0, **26/26**, cero skipped; [salida final](tests/schema/evidence/core22-integration-final-green.tap). Incluye los22 anteriores y14 carreras (8+6). |
| Prueba propia `service-cas.test.mjs`, con imports del servicio real y migraciones de la propuesta en copia temporal | **2/2, exit0**; [verde](tests/schema/evidence/core22-service-final-green.tap). Mismo test contra copia íntegra pre-parche: **0/2, exit1**, falla activación legítima con approved definition immutable/database_conflict; [rojo](tests/schema/evidence/core22-service-final-red.tap). |
| `npm run test:controller` | exit0, **108 tests, OK**, 144.242s; [log](tests/schema/evidence/core22-controller.log). |
| `git diff --check` | exit0, sin errores de whitespace. |
| `npm test` | exit0, kernel12+foundation12; [log](tests/schema/evidence/core22-npm.log). |
| `npm run graph:check` | exit0, lectura de estado, sin regeneración; [log](tests/schema/evidence/core22-graph.log). |
| Constraints/alcance | **197 líneas con FK/CHECK/UNIQUE preservadas**, 0001/0002/0003 y db.ts idénticos a HEAD; [huellas](tests/schema/evidence/core22-integration-hashes.json), [delta SQL de esta continuación](tests/schema/evidence/core22-integration-only.patch). |

Los22 casos conservan sus ataques de contenido y concurrencia. Dos expectativas propias se actualizan por el nuevo contrato: padre invisible se captura como foreign_key_violation; `version=2` desde1 ya es una transición operativa legítima y su antiguo negativo se sustituye por `version=3` (salto). El negativo reason sin incremento permanece. Se añaden ataques con/sin incremento sobre cada referencia/contenido protegido y recibo falsificado. El gate estático externo no se modificó ni ejecutó.

Ejecución reproducible del servicio: `W=/Users/javiercamaraportepetit/vexa/.runtime/renewed-app-integration-1789837609558767000/app`; desde `/tmp/vexa-core22-service` (migraciones0001..0004 de este árbol y `packages/workspace-service/sql/001_workspace_service.sql` copiado de W), ejecutar `node --experimental-strip-types --import "$W/packages/workspace-service/tests/register.mjs" --test /Users/javiercamaraportepetit/vexa/.runtime/renewed-schema-approval-1789837609445822000/schema/packages/platform/tests/schema/service-cas.test.mjs`. El test conserva imports absolutos al árbol externo; requiere que siga disponible. Huellas de sus entradas en [service-inputs](tests/schema/evidence/core22-service-inputs.json). Para rojo se usó `/tmp/vexa-core22-service-before` con0004 previa, sin restaurar el candidato.

## Fallos conservados y límites

La suite externa original del servicio ejecutada sin editar produjo8/11: su fixture intenta cambiar owner **después** de aprobar y es correctamente bloqueada; briefs bajo propose falla RLS42501. [Salida original](tests/schema/evidence/core22-service-original-red.tap). Son incompatibilidades presentes antes de este parche, pendientes fuera de alcance; no se afirman resueltas. La prueba focalizada del servicio usa owner original para no cambiar contenido aprobado. Intentos de asignar otro owner previamente encuentran404 por visibilidad de memberships en servicio; se conservan los logs fixture-failure/fixture-assignment-failure, no se cuentan como rojos del guard. El operador asignado sí se prueba en SQL.

Se conserva también el [intermedio SQL](tests/schema/evidence/core22-integration-intermediate.tap):24/26 por expectativa equivocada de prioridad42501 en INSERT de hijo revocado. Se corrigió el harness para comprobar RBAC42501 sobre snapshot y postcondición de no escritura del hijo; no se modificaron políticas ni se permitió escritura.

Docker PostgreSQL17 propio, sin puertos publicados (ningún56327..29), datos SYNTHETIC; cleanup del propio contenedor/volúmenes. No HTTP/Auth/Storage real, gate externo, cierre completo mediante servicio con medición real, cloud ni integración UI. El ciclo completo cerrado se acredita en SQL, y CAS en el servicio contra SQL con transporte psql de ensayo e identidad fixture. Cambios propuestos sobre migración base, no migración incremental para una DB ya desplegada. No se garantiza el formato anterior de recibos persistidos en una instalación previa. Sin aceptación, push, merge ni promoción.

---

# Aprobación vinculada al contenido — corrección aislada, 2026-09-19

**Propuesta NO aceptada. Sin autorización de promoción.** Trabajo en el nuevo árbol `renewed-schema-approval-1789837609445822000/schema`; no se modificó el árbol schema anterior que consume el gate congelado. Baseline Git leída: `9bffa3cb26fb71319a1695a71dd303604f9eb17a`; candidate_sha: no creado, cambios sin commit. Este apartado se añade delante del informe anterior, preservado íntegro debajo.

## Corrección

Se modifica exclusivamente `0004_evidence_money.sql`, se añade `tests/schema/approval-content.test.mjs` con sus evidencias y se actualiza este informe. `0002`, `0003`, db.ts, los 14 tests anteriores, sus ocho carreras, Auth/0001, los gates externos y orchestration quedan intactos.

- `interventions.approval_content` guarda el contenido completo autorizado por owner vigente con action `approve`: intervención, recomendación y conjunto ordenado de planes. Incluye hipótesis, razón, versión, asignación, referencias, procedencia, unidad, población y ventanas. Se excluyen sólo estado operativo y updated_at de intervención, updated_at de recomendación y result_ref/updated_at del plan. Las columnas futuras entran automáticamente en la comparación. No se acepta un hash aportado por execute.
- Sólo el trigger calcula el recibo: INSERT exige draft y recibo NULL; UPDATE no permite escribir el recibo directamente, tampoco desde approve. Execute no puede sustituir campos, versión, asignación o recibo y conserva las transiciones previas. Owner puede cambiar la definición de una intervención todavía approved mediante una operación explícita approve, que vuelve a capturar el contenido; no puede hacerlo en active/measuring/closed.
- La recomendación se fija bajo bloqueo de fila antes de aprobar (`approval_bound`), incluyendo status, title, rationale, version, problem/snapshot/evidence refs, owner y procedencia. No puede desmarcarse ni reescribirse después, incluso por owner. Para revisar su contenido se crea otra recomendación draft y se reaprueba explícitamente la intervención. Esta decisión evita que una intervención activa apunte posteriormente a una recomendación reescrita.
- Todas las referencias a snapshots (baseline de intervención, recomendación y planes) deben ser NULL o snapshots published, ya inmutables junto con sus componentes/atribuciones. No se autoriza un baseline draft. measurement_ref debe pertenecer a la propia intervención.
- Cada INSERT/UPDATE/DELETE de plan bloquea su intervención y falla si no puede verla. Después de draft quedan fijos el conjunto de planes y su definición. Cambiar una definición de medición exige una nueva intervención draft; no se convierte un resultado medido en una revisión del plan. result_ref puede actualizarse bajo execute sólo en active/measuring, con recibo coincidente, membresía y asignación vigentes. Cerrada/cancelada/revocada/no asignada permanece bloqueada.
- Funciones SECURITY INVOKER, backend NOSUPERUSER/NOBYPASSRLS; no SECURITY DEFINER ni evasión RLS. Dos ampliaciones de UPDATE USING sirven para tomar bloqueos: recommendation bajo execute e intervention bajo retain. WITH CHECK conserva las capacidades de escritura anteriores; tests comprueban que esas acciones no pueden modificar timestamps ni datos. Padre invisible produce error, nunca ausencia aceptada.

## Evidencia reproducible

PostgreSQL17 real, imagen local `public.ecr.aws/supabase/postgres:17.6.1.159`, Docker efímero propio con `--pull never`, sin `-p`, sin puertos DB publicados; no se usan 56327..29 ni DB compartida. Cada harness elimina su contenedor y volúmenes. Fixtures SQL SYNTHETIC de Auth/Storage; no equivalen a servicios HTTP. Las operaciones del dominio usan vexa_backend y membresías reales del motor.

| Comando | Resultado |
|---|---|
| Desde `/tmp/vexa-approval-red`, `node --test <propuesta>/packages/platform/tests/schema/approval-content.test.mjs`; copia temporal de migraciones con 0004 anterior íntegra | exit 1; **8 tests, 1 pass, 7 fail** (seis negativos y envolvente; positivo legítimo pasa). Rojo específico del bypass: `UNEXPECTED_ALLOWED` al sustituir recommendation_id + hypothesis y activar. También rojo en definiciones de intervención/recomendación/plan y baseline mutable; carrera detecta ausencia de bloqueo. Ver conteo exacto en [rojo final](tests/schema/evidence/approval-content-final-red.tap). |
| `node --experimental-strip-types --test packages/platform/tests/schema/db.test.ts packages/platform/tests/schema/sql.test.mjs packages/platform/tests/schema/review-regressions.test.mjs packages/platform/tests/schema/approval-content.test.mjs` | exit 0; **22 tests, 22 pass, 0 fail, 0 skipped**. [Verde final](tests/schema/evidence/approval-content-final-green.tap). Conserva los 14 previos y añade siete subcasos más envolvente. |
| Carreras dentro del comando anterior | **8 anteriores + 6 nuevas**. Las nuevas ejercitan aprobación frente a edición de recomendación, edición de plan e INSERT de plan, ambos órdenes. Se observa `pg_stat_activity.wait_event_type=Lock` antes de liberar el holder. Aprobación primero: mutación rechazada y recibo original; mutación primero: aprobación posterior contiene exactamente la definición/conjunto modificado. |
| `npm test` | exit 0; kernel12 + foundation12. `/tmp/vexa-approval-npm.log`. |
| `npm run test:controller` | exit 0; **108 tests**, 51.201s, OK. `/tmp/vexa-approval-controller.log`. |
| `npm run graph:check` | exit 0; consulta de estado, no regeneración ni aceptación. `/tmp/vexa-approval-graph.log`. |
| `git diff --check` | exit 0, sin errores de whitespace. |
| Comparación byte a byte con `git show HEAD:<archivo>` y comprobación del sufijo histórico del informe | PASS: 0002/0003 y los 14 tests previos idénticos; informe anterior íntegro. Docker ps al cierre: ningún contenedor de estos harnesses restante. |

Se conservan también [rojo inicial](tests/schema/evidence/approval-content-initial-red.tap) y [verde intermedio](tests/schema/evidence/approval-content-green.tap). Se ajustaron los controles de permisos para aceptar tanto error RLS como cero filas modificadas, comprobando la postcondición; una fila invisible sin cambio no se etiqueta como bypass. No se relajó la aserción del bypass ni se modificaron los tests anteriores. Una repetición intermedia falló por comparar updated_at de un fixture creado en otra transacción con now(); se corrigió la postcondición contra su created_at sin modificar SQL. [Fallo del harness conservado](tests/schema/evidence/approval-content-harness-timestamp.tap); no se cuenta como rojo del producto.

## Huellas y límites

| Archivo | SHA256 |
|---|---|
| `supabase/migrations/0004_evidence_money.sql` | `53a3cf7fe5bffa9ec9d7bee1717fdf15f70cf44b5a442313bc71c6764e114799` |
| `packages/platform/tests/schema/approval-content.test.mjs` | `3c08053650cebec02cf7140b337a2fd9000915d3f3aedf98ecf7d7c966c74784` |

No probado en este corte: gate externo completo, Auth/Storage/PostgREST HTTP, cloud, integración con driver/repositorios/UI, aislamiento distinto de READ COMMITTED, cargas grandes o recuperación tras crash. Los bloqueos cruzados pueden abortar una transacción por deadlock en órdenes adicionales; no se implementa retry del consumidor en este scope. Las referencias externas (bundle_ref/result_ref y archivos de evidencia) necesitan almacenamiento inmutable y control de acceso en su integración; fijar la fila SQL no demuestra inmutabilidad de bytes externos. No se acredita despliegue ni SaaS terminado. Propuesta pendiente de revisión independiente y aceptación externa; no hubo commit, push, merge ni promoción.

---

# Corrección de revisión independiente F01-03 — 2026-09-19

**Propuesta NO aceptada; promoción NO autorizada.** Este corte actualiza el estado de los tres hallazgos recibidos; el informe anterior se conserva íntegro debajo como evidencia histórica. Sin delegación, cloud, proveedores, envíos ni acceso a DB compartida. Git del candidato no consultado ni modificado. Baseline **declarada por el encargo**, no revalidada: `83118a7a040191b26e76a88a3b3bbde13814deb5`; candidate_sha: no creado.

## Cambios y resultado

Sólo se modificó `supabase/migrations/0004_evidence_money.sql`, se añadieron regresiones/evidencias dentro de `packages/platform/tests/schema/` y se actualizó este reporte. SQL0002/0003 y db.ts no necesitaron cambios. Los tests externos, control-plane, Auth/0001 y baseline permanecen fuera de la autoría.

| Hallazgo del revisor (dictamen approved=false) | Corrección y prueba real |
|---|---|
| P1: DELETE de componentes publicados bajo retain quedaba permitido porque FOR UPDATE no encontraba el snapshot | El trigger rechaza `NOT FOUND` o resultado NULL, tanto para OLD como NEW. UPDATE USING del snapshot permite a retain tomar el bloqueo; WITH CHECK continúa exigiendo import para cualquier UPDATE efectivo. Probados DELETE de componentes/atribuciones publicados, parent oculto por una política RLS restrictiva sintética, UPDATE bajo retain denegado y borrado positivo completo de borrador. Sin SECURITY DEFINER ni nuevos grants/bypass. |
| P1: execute pasaba draft→active e INSERT active | Trigger invoker compara OLD/NEW bajo el bloqueo de fila. INSERT sólo draft; draft→approved sólo action approve y owner vigente; execute sólo approved→active→measuring→closed, con owner o asignación vigente comprobados también por RLS. Cancelación sólo approve/owner desde estados no terminales. No reapertura ni salto de estados. Probados operador sin aprobación, INSERT activo, operador intentando approve, owner revocado, operador no asignado y recorrido positivo con aprobación owner. |
| P2: attribution podía depender de component de otro snapshot | Se conserva la FK tenant+component y se añade FK `(tenant_id,snapshot_id,component_id)`→components `(tenant_id,snapshot_id,id)` con UNIQUE de soporte e índice. Negativos INSERT/UPDATE de atribución y traslado de componente; positivo dentro del mismo snapshot e inmutabilidad al publicar. Las 36 declaraciones FK previas de 0004 permanecen textualmente presentes; 0002/0003 intactas. |

## Evidencia roja/verde y concurrencia

Fixtures **SYNTHETIC**. PostgreSQL17 real en contenedores exclusivos `vexa-schema-review-*` y `vexa-schema-syn-*`, creados con imagen local `--pull never`, sin puertos publicados; eliminados con sus volúmenes al finalizar. Auth/Storage del harness son fixtures SQL, no servicios HTTP. Se aplican las migraciones locales completas; operaciones relevantes usan `SET LOCAL ROLE vexa_backend`, subject/action/tenant y memberships reales del motor. db.ts conserva driver simulado.

- Regresión roja final: `node --test <ruta-absoluta>/packages/platform/tests/schema/review-regressions.test.mjs` con cwd en copia temporal propia de migraciones, sustituyendo únicamente 0004 por la copia íntegra anterior al parche. **exit 1, tests8/pass0/fail8**, siete subcasos más envolvente. Reprodujo `UNEXPECTED_ALLOWED` en los tres hallazgos, INSERT activo, snapshot oculto y reapertura; concurrencia detectó ausencia de bloqueo en retención. La copia se eliminó sin restaurar/modificar el candidato. [Salida roja conservada](tests/schema/evidence/review-20260919-red.tap).
- Verde final: `node --experimental-strip-types --test packages/platform/tests/schema/db.test.ts packages/platform/tests/schema/sql.test.mjs packages/platform/tests/schema/review-regressions.test.mjs` → **exit 0, tests14/pass14/fail0/skipped0**. Incluye los cinco tests previos de db.ts, el test SQL previo de 36 tablas y siete regresiones con envolvente. [Salida verde conservada](tests/schema/evidence/review-20260919-green.tap).
- Concurrencia: **ocho carreras**, UPDATE y DELETE tanto de components como de attributions, publicación primero y mutación/retención primero. Dos sesiones independientes; el holder permanece abierto hasta observar `pg_stat_activity.wait_event_type='Lock'` en la competidora. Publicación primero: la mutación despierta y falla con `published component immutable`, conservando fila e importe/peso. Mutación primero: publicación espera, luego publica sólo después del commit de la mutación/borrado. No se da por probada la carrera por un simple sleep. Para DELETE de component se retira antes su atribución, evitando que una FK oculte un fallo del guard.
- Dos intentos iniciales de preparación se corrigieron antes del rojo válido: readiness durante reinicio de initdb y fixture problems sin severity/cause_status. Son errores del harness, **no** evidencia roja del producto; readiness ahora exige TCP listo además de rol inicializado.
- `npm test` → **exit 0, kernel12 + foundation12 PASS**; `/tmp/vexa-schema-review-npm.log`.
- `npm run test:controller` → **exit 0, Ran108tests in132.279s, OK**; repositorios de ensayo propios en temporales, sin modificar Git del candidato; `/tmp/vexa-schema-review-controller.log`.
- `npm run graph:check` → **exit 0**, tareas pendientes; `/tmp/vexa-schema-review-graph.log`. No regeneración ni aceptación.

## Huellas actuales

| Artefacto | SHA256 |
|---|---|
| supabase/migrations/0004_evidence_money.sql | `a9e0a724a6131330ee770740937ddfc0eb052ec58bc58f1909781935475aeef5` |
| fixture/regresión packages/platform/tests/schema/review-regressions.test.mjs | `2d0941a485cb6f5894a4d7f1c7d097b0dfc2a8f306ef609e9ccb8e3bb7defbfe` |

## Límites vigentes

El revisor independiente original rechazó la propuesta; estas correcciones aún requieren revisión independiente y gate externo actualizado por su autor. No se reejecutó ni se evaluó el gate F01-03 en esta corrección; el fallo histórico de clasificación FK no se presenta como resuelto. No autorización de promoción.

La concurrencia anterior cubre estas ocho carreras bajo READ COMMITTED; no acredita stress prolongado, todos los niveles de aislamiento ni revocación simultánea durante una transacción. Retención operativa completa, historial de aprobaciones, CAS/versionado de servicios y validación del contenido económico del bundle siguen pendientes. La máquina SQL ahora sí exige aprobación antes de ejecución; no se atribuye a este parche la implementación completa de intervenciones/UI.

No probado nuevamente: HTTP Auth/Storage/PostgREST, URLs firmadas, integración driver real→db.ts, build web, cloud, proveedores, conectores, notificaciones, producción, escalabilidad o recuperación del consumidor. Los PASS de servicios del corte previo se conservan como históricos, no como pruebas repetidas de esta versión. No SaaS terminado.

---

# Evidencia previa íntegra — corte anterior a esta corrección

# F01-03 — propuesta aislada de esquema, continuación 2026-09-19

## Estado y alcance

**NO aceptada. Gate completo FAIL por binding externo; pendiente revisión independiente.** Se conservaron las migraciones y tests existentes; no se modificaron identidad 0001, Auth, manifests, tests/acceptance, orchestration, grafo ni estado del controlador. No commits, proveedores reales, producción ni DB compartida.

- task_id: F01-03; baseline/HEAD observado: `83118a7a040191b26e76a88a3b3bbde13814deb5`; candidate_sha: **no creado**, cambios sin commit.
- SHA256 agregado de rutas SQL0002..0004 + db.ts + tests/schema (ruta UTF8, NUL, bytes, NUL en orden de esta lista): `13e018fe07e65162b154e395cb47dcbee05451caa219cc58c00da169dc0eca64`.
- Fixtures: **SYNTHETIC**; SQL/Auth/Storage propios y efímeros. Docker PostgreSQL17 por socket interno, sin puerto DB publicado. Launcher externo: HTTP56327/56328/56329 tras comprobarlos libres; cleanup limitado a sus recursos. PostgreSQL17 Homebrew carece de `vector.control`; no se declara migración pgvector probada allí.
- No reviewer asignado desde esta invocación, sin delegación. Ni tests propios ni servicios PASS permiten promover la tarea.

## Archivos/APIs e interfaces

| Archivo | Contrato |
|---|---|
| supabase/migrations/0002_sources.sql | 11 tablas de fuentes; vexa_backend NOLOGIN/NOSUPERUSER/NOBYPASSRLS; membership vigente; tenant/id inmutables; configuración directa sólo owner. |
| supabase/migrations/0003_execution.sql | 7 tablas jobs/attempts/checkpoints/outbox/dead_letters/audit_events/tombstones; índices de cola y referencias relacionales. |
| supabase/migrations/0004_evidence_money.sql | 18 tablas de evidencia/dinero/acciones; Storage privado; pgvector y RPC invoker; publicación inmutable; capacidades backend por operación. |
| packages/platform/src/db.ts | createDatabase({identity,pool,selectedTenant}).transaction(action,work); requireRow(result); SqlPool/SqlConnection/DatabaseScope/SqlValue. |
| packages/platform/tests/schema/db.test.ts | API servidor, permisos frescos, scope caducado, rollback/release, errores sanitizados. |
| packages/platform/tests/schema/sql.test.mjs | PostgreSQL17 real sintético propio: migraciones, 36 tablas, RLS, dinero, FK, publicación y permisos backend negativos/positivos. |
| packages/platform/tests/schema/external-services.mjs | Invoca oráculos externos SIN copiarlos/modificarlos; Auth/Storage/PostgREST + revocación, separado del fallo de clasificación de relaciones. |

`identity` implementa el IdentityPort ya aceptado; no se duplica Auth. `selectedTenant` procede del selector servidor y se resuelve contra memberships. Se copian userId/tenantId antes del await del pool. Cada transacción reconsulta membership SQL vigente, aplica rol contractual, SET LOCAL ROLE vexa_backend, GUC tenant/action/subject parametrizados y timeout10s. Read usa BEGIN READ ONLY. El scope queda inválido al salir del callback y errores del driver nunca se exponen. 401 identidad ausente;403 permiso;404 sólo requireRow sobre filas realmente vacías;409 FK/constraint/concurrencia;503 configuración/DB caída. No endpoint HTTP nuevo.

**Frontera de confianza:** query(text,values) es exclusivamente para repositorios del servidor con SQL estático y parámetros $n; no admite SQL del browser/LLM. El login del pool debe provisionarse separado, NO propietario/superuser/BYPASSRLS, miembro de vexa_backend. Un login de servidor comprometido puede cambiar GUC: no constituye sandbox para SQL hostil. No existe consumidor autónomo provisionado; membership de un humano no se suplanta silenciosamente al ejecutar jobs.

**Dinero:** bigint nullable (driver devuelve string/BigInt, nunca Number para importes), moneda de tres mayúsculas y exponente0..4; no catálogo exhaustivo ISO4217 ni FX. unknown exige amount_minor NULL. Reversal verifica tenant+evento+moneda+exponente. Fórmulas siguen en packages/economics/index.mjs. Timestamps timestamptz, ventanas/campos de procedencia explícitos; servicios posteriores deben exigir cobertura/procedencia completas antes de publicar.

## Requisitos cubiertos por ID

| ID | Implementación y evidencia limitada |
|---|---|
| F01-03 | 36 tablas con unique(tenant_id,id), FKs compuestas, RLS ENABLE/FORCE, lectura memberships vigentes, tenant inmutable incluso dual-member. Servicios externos A/B/revocación pasan; gate global bloqueado. |
| F01-02 dependencia | Reutiliza session.ts, organizations/memberships y migración0001 intacta; sin nueva aceptación Auth. |
| F02-01..06 / F03 | Columnas fuentes, identidades/revisiones/imports y jobs/outbox. No acredita adaptadores SQL, consumidor, crash/fencing funcional ni conectores integrados. |
| F04 / F05 | Persistencia evidencia/vector/dinero/snapshots. No acredita extracción IA, precisión, cálculo completo o métricas integradas. |
| F06 | Tablas recomendaciones/intervenciones/medición/brief. No acredita ocho vistas, transiciones completas ni entrega de notificaciones. |

## Permisos y restricciones

Los cuatro roles leen dominio del tenant autorizado. Authenticated sólo escribe connections como owner; demás DML usa repositorios servidor y vexa_backend. Filtro tenant no concede membership. service_role pierde grants sobre estas36tablas. No funciones SECURITY DEFINER.

| action backend | roles | Tablas/efecto |
|---|---|---|
| read | owner/analyst/operator/viewer | Transacción read only; RLS de tenant/membership. |
| configure | owner | connections, external_aliases, cost_rates, assumptions; audit insert. |
| import | owner/analyst | fuentes, jobs/outbox/checkpoints/attempts, procesamiento/evidencia/dinero/snapshots/brief; audit insert. |
| propose | owner/analyst/operator | recommendations draft/proposed; interventions draft; measurement_plans; audit insert. |
| approve | owner | recommendations/interventions/measurement_plans; audit insert. |
| execute | owner/operator | interventions/measurement_plans; operator exige asignación, owner conserva permiso contractual; audit insert. |
| retain | owner | DELETE dominio, respetando FKs/inmutabilidad; tombstones; audit insert. Confirmación explícita debe implementarse en API posterior. |

Políticas restrictivas SQL validan action y rol vigentes además del USING/WITH CHECK de tenant. Propose no edita intervenciones ya aprobadas ni recomendaciones aceptadas. Audit backend sólo append; snapshots publicados y sus componentes/atribuciones inmutables. No autorización global para backend sin subject/membership. Estados permitidos tienen CHECK, pero la máquina de transiciones/optimistic concurrency completa corresponde a servicios aún pendientes.

Storage: bucket `vexa-private`, public=false; path `<tenant_uuid>/...`; SELECT membresía vigente, INSERT owner/analyst, DELETE owner, sin UPDATE (no swap de nombre/bytes). Una URL ya firmada es bearer hasta expirar; revocación probada impide nueva firma/lectura autenticada, no se promete invalidación retroactiva de URLs emitidas.

RPC `match_embeddings(query_embedding extensions.vector, match_count integer, tenant_id uuid, model_id text default null, version text default null)` → id/content/similarity; SECURITY INVOKER, membresía y RLS, dimension matching, límite0..100. tenant_id es filtro, no autorización. Escaneo exacto, no ANN probado; consumidores deben pasar model_id/version explícitos para no mezclar espacios vectoriales de dimensión coincidente.

## Columnas de las 36 tablas

Todas añaden id UUID, tenant_id UUID NOT NULL→organizations, created_at/updated_at timestamptz, provenance JSONB objeto y unique(tenant_id,id). Listado siguiente excluye esas columnas comunes; el SQL es la definición exacta de defaults/CHECK/uniques.

| Tabla | Columnas de dominio |
|---|---|
| connections | source text; account_id text; status text; credential_ref text; watermark text; last_success timestamptz |
| imports | file_hash text; mapping_version text; state text; idempotency_key text; object_path text; total bigint; accepted bigint; rejected bigint; duplicates bigint; pending bigint; connection_id uuid |
| import_rows | row_ref text; row_hash text; state text; error_code text; payload_ref text; import_id uuid |
| customers | external_id text; source_revision text; display_name text; connection_id uuid |
| products | external_id text; source_revision text; sku text; connection_id uuid |
| orders | external_id text; source_revision text; amount_minor bigint; currency text; exponent smallint; occurred_at timestamptz; connection_id uuid; customer_id uuid |
| order_lines | amount_minor bigint; currency text; exponent smallint; external_id text; quantity numeric(20,6); order_id uuid; product_id uuid |
| conversations | source text; entity_type text; external_id text; source_revision text; channel text; language text; started_at timestamptz; deleted_at timestamptz; connection_id uuid; customer_id uuid; order_id uuid |
| messages | external_id text; source_revision text; role text; occurred_at timestamptz; deleted_at timestamptz; conversation_id uuid; connection_id uuid |
| message_revisions | revision text; text_ref text; redacted_text text; hash text; redaction_version text; occurred_at timestamptz; deleted_at timestamptz; message_id uuid |
| external_aliases | source text; account_id text; entity_type text; external_id text; evidence_ref text; approved_by uuid; version integer; canonical_id uuid |
| jobs | type text; state text; input_ref text; input_hash text; version text; lease_until timestamptz; lease_owner text; fencing_token bigint; next_attempt_at timestamptz; deadline timestamptz; cancel_requested_at timestamptz; max_attempts integer; import_id uuid |
| attempts | state text; attempt_number integer; fencing_token bigint; started_at timestamptz; finished_at timestamptz; error_code text; job_id uuid |
| checkpoints | checkpoint jsonb; stage text; fencing_token bigint; job_id uuid |
| outbox | state text; input_ref text; topic text; idempotency_key text; next_attempt_at timestamptz; lease_until timestamptz; fencing_token bigint; published_at timestamptz; job_id uuid |
| dead_letters | reason text; failed_at timestamptz; job_id uuid; attempt_id uuid |
| audit_events | actor text; action text; resource text; reason text; trace_id text; occurred_at timestamptz |
| tombstones | deleted_source_key text; reason text; deleted_at timestamptz; connection_id uuid |
| extraction_runs | model_id text; prompt_hash text; schema_hash text; input_hash text; status text; usage jsonb; conversation_id uuid; job_id uuid |
| issues | category text; severity text; sentiment text; intent text; urgency text; abstention_reason text; extraction_run_id uuid |
| evidence_spans | "start" integer; "end" integer; quote_hash text; message_revision_id uuid; issue_id uuid |
| embeddings | model_id text; dim integer; version text; content text; embedding extensions.vector; message_revision_id uuid |
| problems | severity text; cause_status text; title text; archived_at timestamptz |
| problem_versions | version integer; title text; rationale text; change_kind text; problem_id uuid; previous_version_id uuid |
| problem_conversations | valid_from timestamptz; valid_until timestamptz; problem_id uuid; conversation_id uuid; issue_id uuid |
| economic_events | kind text; status text; amount_minor bigint; currency text; exponent smallint; effective_at timestamptz; source_ref text; window_start timestamptz; window_end timestamptz; order_id uuid; evidence_span_id uuid; cost_rate_id uuid; assumption_id uuid |
| reversals | amount_minor bigint; currency text; exponent smallint; source_ref text; effective_at timestamptz; reversal_of uuid |
| cost_rates | amount_minor bigint; currency text; exponent smallint; effective_at timestamptz; effective_until timestamptz; unit text; version integer |
| assumptions | version integer; name text; value_decimal numeric; unit text; rationale text; approved_by uuid; window_start timestamptz; window_end timestamptz |
| metric_snapshots | scope_hash text; input_hash text; policy_version text; watermark timestamptz; status text; bundle_ref text; date_start timestamptz; date_end timestamptz; timezone text; currency text; date_basis text; published_at timestamptz; job_id uuid |
| components | amount_minor bigint; currency text; exponent smallint; metric text; kind text; known_subtotal_minor bigint; known_count bigint; total_count bigint; snapshot_id uuid; problem_id uuid |
| attributions | weight numeric; snapshot_id uuid; economic_event_id uuid; component_id uuid; problem_id uuid |
| recommendations | status text; version integer; title text; rationale text; owner_id uuid; idempotency_key text; problem_id uuid; snapshot_id uuid; evidence_span_id uuid |
| interventions | status text; version integer; owner_id uuid; hypothesis text; reason text; idempotency_key text; recommendation_id uuid; baseline_ref uuid; measurement_ref uuid |
| measurement_plans | version integer; unit text; population_ref text; date_start timestamptz; date_end timestamptz; result_ref text; intervention_id uuid; baseline_ref uuid |
| weekly_briefs | status text; version integer; scope_hash text; content_ref text; week_start date; snapshot_id uuid |

## Relaciones y bindings

FKs adicionales a la matriz externa se conservan: import/customer/product/order/message/tombstone→connections; extraction_run/metric_snapshot→jobs; dead_letter→attempt; evidence_span/problem_conversation→issue; problem_version→previous_version; economic_event→evidence_span/cost_rate/assumption; components/attributions→problem; attribution→component; recommendation→snapshot/evidence; intervention→baseline/measurement; plan→baseline; aprobadores/owners→memberships. Reversal además exige moneda/exponente coincidentes. Todas tenant-aware, ON DELETE RESTRICT explícito. El índice simple tenant,id no sustituye los índices tenant,FK presentes.

| Módulo/propuesta | Binding y pendiente exacto |
|---|---|
| @vexa/platform actual | db.ts importa el export existente @vexa/platform/session. **CONFLICTO:** package.json sólo exporta ./session; añadir ./db por integrador autorizado antes de consumir @vexa/platform/db. Este scope no puede modificar manifests. |
| Ingesta/conectores 983e007 | SourceEnvelope→connections/conversations/messages/message_revisions; NULL cliente/SKU no se inventa. **CONFLICTO:** normalizador permite role=unknown; messages SQL admite customer/agent/internal. Resolver cuarentena o ampliación contractual antes de persistir, no cast a customer. Alias SQL sólo conversación, propuesta genérica debe acotarse. |
| Jobs | public.jobs: type,state,input_ref,input_hash,version,lease_until,lease_owner,fencing_token,next_attempt_at,deadline,max_attempts,cancel_requested_at,import_id. public.outbox: topic,state,input_ref,idempotency_key,job_id,lease_until,fencing_token,next_attempt_at,published_at. No tabla JSON sustitutiva. Falta repositorio claim/CAS/leases, fencing de efectos, recovery y worker con identidad autorizada. |
| Gateway/intelligence 733c47e | extraction_runs→issues→evidence_spans→message_revisions; embeddings guarda model/dim/version. Falta repositorio durable para reservas de presupuesto y conciliación; usage JSON no es libro de reservas. |
| Métricas | metric_snapshots→components/attributions→economic_events; published requiere bundle_ref+published_at y luego es inmutable. Falta repositorio que calcule con kernel y publique bundle transaccional; no duplicar fórmulas. |
| Notificaciones 1a0df4e | public.outbox es transporte de refs genérico; **CONFLICTO** si se trata como notification_outbox ya completo: faltan destinatario/canal/preferencias/subscriptions/receipts/estados propios. Requiere migración posterior con repositorio y transacción emisora; no guardar todo el dominio en input_ref/JSON. |
| Nombres blueprint | Se usa issues/components de03-CONTRATOS frente a issues_extracted/metric_components del blueprint; no hay aliases SQL implícitos. **CONFLICTO:** blueprint también enumera recommendation_versions e intervention_events, fuera de las36tablas fijadas/matriz. Requieren decisión control-plane y migración ampliatoria; no se declaran presentes ni se autoamplía el gate. |

## Comandos/salidas reales de esta continuación

Ejecutados desde este worktree. Logs locales en /tmp/vexa-schema-renewed-*.log, sin secretos. Los paths externos son READ-ONLY.

| Comando | Exit / salida observada |
|---|---|
| node --experimental-strip-types --test packages/platform/tests/schema/db.test.ts packages/platform/tests/schema/sql.test.mjs | 0; tests6, pass6, fail0, skipped0. PostgreSQL17 real desechable, 36tablas; negativos de tenant/FK/dinero/contadores/publicación/rol/capacidad. |
| VEXA_CANDIDATE="$PWD" node --test /Users/javiercamaraportepetit/vexa/.runtime/auto-1789829683970974000-1789829684063951000-gate-worktree/tests/acceptance/F01-03.test.mjs | **1; tests1, pass0, fail1**. FK_UNCLASSIFIED:orders→connections:{tenant_id:tenant_id,connection_id:id}. Migraciones aplicaron; gate para antes de su matriz funcional. Reproducido dos veces; no setup FAIL ni PASS. |
| VEXA_F01_03_SUPPORT=/Users/javiercamaraportepetit/vexa/.runtime/auto-1789829683970974000-1789829684063951000-gate-worktree/tests/acceptance/support/F01-03 node packages/platform/tests/schema/external-services.mjs | 0; PASS external serviceOracle + revokeOracle: real local Auth/Storage/PostgREST, A/B, anonymous, outsider, signed URL, retrieval, revocation. Repetido después del último cambio SQL. No aceptación global. |
| node --experimental-strip-types --test packages/platform/tests/session.test.ts | 0; tests20, pass20, fail0, skipped0. |
| npm test | 0; kernel12 + foundation12 PASS. |
| npm run test:controller | 0; Ran108tests in69.142s, OK; repositorios de ensayo temporales propios. |
| npm run graph:check | 0; consulta de estado, tareas pendientes; no cambia ni acepta grafo. |
| npm ci --ignore-scripts --no-audit --no-fund --offline en copia temporal | 0; added361packages in4s; copia eliminada, sin node_modules en worktree. |
| node node_modules/typescript/bin/tsc --noEmit --strict --skipLibCheck --target es2022 --module nodenext --moduleResolution nodenext --allowImportingTsExtensions packages/platform/src/db.ts (copia) | 0; sin diagnósticos TS. |
| git diff --check | 0; sin whitespace errors. |

## Límites/no cubierto y pasos exactos de integración

1. Revisor/control-plane debe reconciliar la matriz de FKs, incluidos owners→memberships y reversal con moneda; no retirar constraints para facilitar el examen. Sus clones de attempts/checkpoints también deben conservar unicidad contractual (attempt_number/stage nuevos) al ampliarse esa matriz. Esta observación sobre clones es análisis estático, no un fallo ejecutado después del primer bloqueo.
2. Congelar gate revisado externamente. Preparar candidato oficial desde identidad aceptada y adoptar únicamente SQL0002..0004/db.ts/tests propios/reporte permitidos; no repetir0001 en una base ya migrada. No promover esta propuesta por los PASS parciales.
3. Añadir export ./db y driver/pool sólo por responsable de manifests. Provisionar login restringido y probar integración real driver→db.ts→Postgres; aquí SqlPool del test TS está simulado, mientras SQL y servicios usan motores reales separados.
4. Resolver bindings listados (roles unknown, nombres blueprint, historial de acciones, consumidor backend, notificaciones). Implementar repositorios de jobs/métricas/ingesta con tablas normativas y gates propios, sin reutilizar service_role para evadir RLS.
5. Ejecutar gate F01-03 completo, regresiones, revisión independiente y materialización limpia; aceptación/publicación exclusivamente por control-plane autorizado.

No probado: suite funcional externa completa por36tablas después del bloqueo; firma/expiración y revocación retroactiva de URL ya emitida; driver SQL real con db.ts; build web (no cambió app); escalabilidad/EXPLAIN150K/500K, ANN, restart/crash consumidor, transiciones y asignaciones completas, precisión IA/gold, cloud/proveedores/CRM/notificaciones reales, restauración y retención operativa. Índices/columnas de fencing no demuestran durabilidad del pipeline. No SaaS terminado.

## Huellas de fixtures/examen observado (READ-ONLY)

| Archivo | SHA256 |
|---|---|
| F01-03.test.mjs | `0f15a61b52c2c72b02e856c7c12dd2c25392c4bf30e8f0b2eb834e7811de3175` |
| support/F01-03/matrix.mjs | `586fba305923a81bfa19c85900f4f7e99cc09e8cb209c9c18ba7abba27246384` |
| support/F01-03/oracles.mjs | `e86d4d0cbd14b5c6b667c7a83b7ef91851da59ed4d7e852ccfcefffd31bfece5` |
| support/F01-03/services.mjs | `9c0cef86afcf32ec27a3f6ea4bac098d75bb63569fea9255bdcee0c0b3802847` |
| support/F01-03/harness.mjs | `af8a53cc127499d943b29088cd5e2ef89cbb1896344bd53af7aedf56ea1a1833` |
| fixture_hash: packages/platform/tests/schema/sql.test.mjs | `d44107d91c1111a2e45f733a6f89d1f74b1ba27a069e685bc0f3830948ebb20f` |
