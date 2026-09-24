# Presupuesto de agrupación y conciliación

Propuesta local 325 sobre 183fadd. El owner dispone en `/problems/manage` de límites para `all` y `embedding` y conciliación de reservas pendientes. La ventana proviene exclusivamente de `VEXA_PROBLEMS_CONFIG_JSON` del tenant autenticado; puede diferir de extracción. Un global sólo comparte consumo con los propósitos que usen esa misma ventana.

`GET /api/problems` incorpora `canConfigureBudget` y `budget` (null para otros roles). `budget` contiene ventana, límites/versiones y reservas embedding; incluye pendientes de ventanas antiguas incluso sin configuración vigente. No presenta costo desconocido como cero. Importes exactos USD con seis decimales, convertidos a unidades enteras sin Number.

`POST /api/problems` con `operation: budget`, `purpose: all|embedding`, `limitUsd` string decimal, `expectedWindow` y `expectedVersion` para actualización. Sin versión sólo crea; conflictos no sobrescriben. La ventana esperada debe coincidir con la configuración actual.

Conciliar requiere `operation: reconcile`, `reservationId`, `expectedVersion`, `expectedWindow`, `actualUsd`, `evidenceHash` SHA-256 hexadecimal y `confirmedProviderEvidence: true`. El owner debe contrastar el costo con evidencia del proveedor. El servidor no consulta ni certifica el recibo externo. Conserva el recibo durable existente; reintento idéntico es idempotente y un cambio incompatible devuelve conflicto. Cero sólo se escribe por conciliación explícita. Cada cambio del formulario revoca la confirmación.

Se reutiliza `createDurableBudgetRepository` sin modificar gateway ni SQL. Cada transacción comprueba nuevamente owner; selección tenant deriva de identidad. Configurar/conciliar no encola trabajos, no habilita proveedor y no hace inferencia. El runtime continúa requiriendo habilitación explícita.

Prueba de autor reproducible: `VEXA_CANDIDATE=<checkout> node packages/problems/tests/embedding-budget/functional.mjs`. Utiliza PG/Auth/Storage y Chromium locales propios, puertos62820–62825, compilación en temporal, fixtures SYN y fetch externo rechazado. Requiere Docker e infraestructura de pruebas existente. Evidencia por corrida: report.json, logs, capturas y recibo cleanup. Baseline.mjs reproduce la ausencia de UI en fuente anterior. La revisión independiente y aceptación quedan pendientes del controlador.
