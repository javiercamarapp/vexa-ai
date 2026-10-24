# Runbook de incidentes de Rovaq

Principios: primero **leer** (consultas de `ops/diagnostics/`, solo lectura, via MCP `execute_sql` con `project_id` explicito `proyecto-ejemplo` o `psql`), luego decidir; toda escritura de produccion la autoriza Javier (script `!`) con respaldo y verificacion posterior. No tocar contadores, no inventar aprobaciones, no reintentar un intento rojo sin informacion nueva.

## 1. API devuelve 503 (`database_unavailable`) o 57014
El adaptador (`packages/platform/src/db.ts`) mapea **cualquier** error de base no clasificado a 503 `database_unavailable`, y fija `statement_timeout=10000`. Un 503 es un sintoma, no una causa.
1. Confirmar la causa en el **log de Postgres** (MCP `query_logs` service `postgres`, ultimas 1-24 h): buscar `57014` (statement_timeout), `25P04` (transaction timeout, visto el 19-oct en la verificacion final del runner), `53300` (demasiadas conexiones), `57P01`.
2. `57014`: identificar la sentencia (log) y medirla con `EXPLAIN (ANALYZE, BUFFERS)` **en copia local**, no en produccion. Caso conocido: `association_candidates` (0049) → arreglado por 0054. Revisar `04-sesiones-bloqueos-y-timeouts.sql` y `05-pg_stat_statements-top.sql` (si la extension existe).
3. `25P04`: la transaccion supero `transactionMs` (25 s); acotar/paginar la consulta de verificacion (pendiente de `verifyAssociations`).
4. `53300`: `04` seccion de conexiones; revisar que cada funcion usa el pool del servidor y que los consumidores cierran (`worker.close()`); no subir compute (regla de costos).
5. Mitigacion segura sin escritura: pausar consumidores (dejar de llamar) y reintentar tandas mas chicas (`chunkRows` 50). Subir el timeout de 10 s **no** es mitigacion aceptada (ocultaria el problema).
6. Verificar version desplegada: `/api/health/version` (SHA); no desplegar para «probar».

## 2. Job atascado / lease vencida
1. `01-colas-y-consumidores.sql` (¿hay `lease_vencida`?, ¿latido reciente?) y `02-jobs-atascados.sql`.
2. **running + lease vencida + deadline vigente**: no hacer nada manual; el siguiente claim lo reclama (sube `fencing_token`, intento previo → `uncertain`/`LEASE_EXPIRED`). Si no ocurre en minutos, el consumidor no corre: revisar programacion (03), `worker_delegations.enabled` y `last_dispatched_at`, y probar un disparo `--once` con `scheduler.mjs`.
3. **deadline vencido**: el claim lo marca `failed` (`DEADLINE`) con `dead_letters`; para continuar se usa el **replay** documentado (no editar filas): validar primero que `import_rows` ya aceptadas coincide con el checkpoint (como hace `replay-job-v5.sql`), luego repetir el job con el paquete de la pieza.
4. **ATTEMPTS_EXHAUSTED/ACTOR_REVOKED/CONNECTION_REVOKED**: es una politica, no un bug; corregir la causa (re-autorizar la conexion/el actor) y luego replay.
5. Nunca poner `lease_until=null` ni cambiar `fencing_token` a mano: rompe la exclusion mutua.
6. Tras cualquier intento supervisado: leer el estado remoto (job, import, conteos), no confiar en el exit code del runner (el 19-oct el exit 1 ocurrio con la pieza ya cargada).

## 3. Presupuesto de IA / costos desbordados
`07-costo-ia.sql` (reservas `reserved`/`uncertain` sin liquidar), panel de OpenRouter, tope 80 de 90. Si el gasto real se acerca: parar consumidores de extraction/problems (no solo bajar frecuencia), no reintentar tandas pagadas sin informacion nueva (max. 2 seguidas). Spend Management y facturacion los cambia solo Javier.

## 4. Imports `running` desde el 28-sep (6 `crm-canonical-v1`, 4,536 aceptadas / 5,299 rechazadas `sync-raw`; 5 extracciones `running`)
1. `03-imports-en-curso-viejos.sql`: confirmar ids, ultimo movimiento (`updated_at`), si la suma de conteos cuadra, y si hay `jobs` asociados vivos.
2. **No cerrarlos sin decision de Javier.** Preguntas que deben responderse antes: ¿son restos de un sync abandonado o hay un job que aun puede avanzar? ¿las 5,299 rechazadas son esperadas (`sync-raw`)? ¿algo depende de ellos (cursores `sync_cursors`, reportes)?
3. Si Javier decide cerrar: respaldo logico (04) → para cada import, un cierre explicito a `cancelled` (no `failed`, para no simular error) por el camino de la aplicacion (`cancel` del repositorio) o, si no existe para ese tipo, un script `!` revisado que cambie solo `imports.state`, deje `provenance` con motivo/fecha/decision y no toque filas aceptadas/rechazadas ni contadores → verificar con `03` que dejan de aparecer.
4. Prevencion: vigilancia semanal con `03` y alerta si `dias_sin_actividad > 2`.

## 5. Disco, tamano y crecimiento
`06-disco-y-tamanos.sql`: tamano total, 20 mayores relaciones, `n_dead_tup` (candidatos a vacuum), bytes de Storage. Umbrales sugeridos (propios, no del proveedor): avisar a 70 % del disco de la base [NV: tamano contratado]; adjuntos: dry-run exige ≥ 6 GiB libres locales. En la Mac: `df -h /`; el swap de workflows paralelos puede llenar el disco; max 2 cargas pesadas.

## 6. Despliegues y reversa de la app
`vexa-ai` no tiene Git y su Ignored Build Step es `exit 0`; los despliegues son por CLI y **cada uno es un build facturable**: contar y reportar. Reversa de frontend = promover un despliegue anterior (Vercel «rollback»; no revierte el esquema) → ver 05 para el esquema. Comprobar SHA servido (`/api/health/version`) tras cualquier cambio.

## 7. Contactos y decisiones (matriz)
| Situacion | Decide / ejecuta |
|---|---|
| Escritura en produccion (cierre de imports, migraciones, rollback, cron) | Javier (script `!`) |
| Gasto fuera de tope, Spend Management, facturacion | Javier |
| Acceso de Responsable A (invitacion `pending`, vence 22-oct 19:12Z) | Javier reenvia; Responsable A acepta y confirma correo |
| Sospecha de fuga | Seguir seccion «Sospecha de fuga» de `02-RUNBOOK-Y-ACCESOS.md` |
