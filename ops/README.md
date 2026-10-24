# ops/ — operacion de Rovaq (solo preparacion local)

Nada aqui se ejecuta contra produccion por si solo. Documentacion: `docs/operacion/03..07`.

| Carpeta | Contenido | Prueba |
|---|---|---|
| `lib/` | Postgres 17 efimero (`localpg.mjs`, socket unix en `/private/tmp/claude-501/`) + esqueleto Supabase minimo (`stubs.sql`) | usado por todas las pruebas |
| `backup-restore/` | `backup.mjs` (respaldo logico por tenant, solo lectura), `restore-verify.mjs` (restaura en local y verifica), `synthetic-fixture.sql` | `node ops/backup-restore/test.mjs` |
| `rollback/` | `0054/0053/0052/0051/0049.down.sql` | `node ops/rollback/test.mjs` |
| `diagnostics/` | consultas de solo lectura para incidentes (`01`..`07`) | `node ops/diagnostics/test.mjs` |
| `scheduling/` | `gates.sql` (compuertas de trabajo) y `pg_cron-gated.TEMPLATE.sql` (plantilla, no aplicada) | `node ops/scheduling/test.mjs` |

Requisitos: Node 22+, PostgreSQL 17 (`pg_config` o `PG_BIN`). Disco: cada prueba usa < 300 MB y limpia al terminar (verificar con `df -h /`). Ejecutar las pruebas de una en una.
