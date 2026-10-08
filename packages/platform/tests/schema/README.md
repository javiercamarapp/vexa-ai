# Controles SQL de plataforma

Las cuatro pruebas `*.test.mjs` ejecutan PostgreSQL 17 aislado, sin puertos publicados ni red. `storage-fixture.mjs` contiene sólo la superficie SQL sintética de Auth/Storage necesaria para aplicar las migraciones actuales; no acredita esos servicios HTTP. Las funciones de operación Storage se copian de las migraciones oficiales 0024/0058 de Storage 1.69.11, con procedencia en el archivo y calibración independiente en `support/F07-recovery/storage-bootstrap.test.mjs`.

`public-tables.json` fija los 112 nombres públicos declarados por las migraciones 0001–0041. Se revisó que existen 112 declaraciones únicas y ningún DROP TABLE/RENAME. Sustituye el contador histórico de 36 tablas (0002–0004, que excluía identidad): ahora compara nombres completos, conservando las aserciones de RLS, revocación, FK, importes, contadores y capacidades. No se genera al ejecutar la prueba.

## Control retirado, no aprobado

`service-cas.test.mjs` queda **RETIRED_SUPERSEDED**. Probaba un prototipo eliminado: `workspace_service/sql/001_workspace_service.sql`, las tablas `workspace_service.commands/outbox` y `createWorkspaceService().command`, ninguna de las cuales pertenece al servicio vigente. La versión anterior y sus fallos permanecen en Git y en los recibos de cierre. Retirarlo no representa un PASS ni una aceptación adicional.

Los oráculos aplicables tienen estos sucesores obligatorios para el cierre:

| Intención original | Control vigente |
| --- | --- |
| CAS operacional, versión obsoleta, aprobación y razón | `integration-compat.test.mjs` y concurrencia 200/409 de `support/F06-interventions/functional.mjs` |
| Aprobación ligada a contenido inmutable | `approval-content.test.mjs`, `integration-compat.test.mjs` y plan congelado de F06-05 |
| Replay sin historia duplicada; payload distinto rechazado | F06-05: respuesta perdida, replay exacto, conflicto de payload e incremento único de historia |
| Atomicidad SQL real | `support/F06-interventions/sql-targeted.test.mjs`, mediante `INTERVENTION_PROBE_ATOMIC_ROLLBACK` en `tests/acceptance/support/F01-03/intervention-oracles.mjs` |
| Antiguos cuatro comandos/auditorías/outbox | Contrato sustituido: eventos durables por versión en migración0026; F06-05 exige que jobs/outbox/CRM permanezcan sin cambios. No se exige recrear cuatro envíos externos. |

La pasada funcional F06-05 por sí sola no ejecuta el control SQL dirigido: se requiere su recibo propio o el de F01-03 que lo incluya. Los límites originales de las pruebas conservadas no cambian; no se introduce una suite de 480 segundos dentro de un control de 120 segundos.
