# Rollback de migraciones recientes (0049, 0051, 0052, 0053, 0054)

Los scripts viven en `ops/rollback/` y se prueban con `node ops/rollback/test.mjs` (Postgres 17 local desechable). Ninguno se ha ejecutado en produccion.

## Estado remoto (segun el relevo del 19-oct; releer antes de actuar)
| Migracion | Contenido | En vexa-ai | Rollback |
|---|---|---|---|
| 0049 | indice `conversations_tenant_external_idx` + `association_candidates` por llaves exactas + `association_row_guard` | APLICADA | `ops/rollback/0049.down.sql` (restaura 0045) |
| 0050 | RESERVADA (no existe) | — | — |
| 0051 | 4 funciones `economic_batch_*` (importador por lotes) | no aplicada | `0051.down.sql` (solo funciones) |
| 0052 | 5 tablas + vista + 3 funciones del Tracker | no aplicada | `0052.down.sql` (con guarda de datos) |
| 0053 | tablas `attachment_blobs`/`attachment_links` + guarda | no aplicada | `0053.down.sql` (con guarda de datos) |
| 0054 | `association_candidates` con pre-deduplicacion de mensajes (arreglo del 57014) | APLICADA | `0054.down.sql` (= definicion de 0049); en remoto existe ademas `rollback-0054-association_candidates.sql` generado con `pg_get_functiondef` |

## Orden seguro
1. **0054 → 0053 → 0052 → 0051 → 0049** (del mas nuevo al mas viejo). 0051, 0052 y 0053 son independientes entre si; 0054 depende de 0049 (si se revierte 0049 antes, la funcion igual queda en la version de 0045, pero se pierde el indice que 0049 creo y la trazabilidad).
2. Antes de cualquier rollback que **elimine tablas** (0052, 0053): respaldo logico (`ops/backup-restore/backup.mjs`, ver 04) y verificacion de restauracion.
3. Los rollbacks de 0054/0049 reemplazan funciones: tomar tambien `pg_get_functiondef` actual (como hace `aplicar-0054.sh`) por si el estado remoto difiere del repo.
4. Pausar consumidores afectados antes (revocar la delegacion del worker o `cron.unschedule`); los de asociaciones no deben correr durante el cambio de `association_candidates` (un claim a mitad vera la funcion vieja o la nueva, ambas validas, pero conviene evitar mezclas en una misma tanda).

## Detalle por migracion
- **0054** — Reversible, sin perdida de datos, ~instantaneo. Efecto: el comando vuelve a ser lento en tandas con muchas filas `gorgias:` (57014 a 10 s en las de 250 filas con >200 validas). Hacerlo solo si 0054 produjera resultados distintos (la prueba de equivalencia dio 0 diferencias en [omitido: dato de cliente] filas). Las asociaciones ya cargadas con 0054 NO se tocan.
- **0049** — Reversible, sin perdida de datos. Restaura `association_candidates` y `association_row_guard` a los textos de 0045 y borra el indice. Consecuencia: las cargas de asociaciones vuelven al camino original (mas lento); **no revertir con una carga en curso**.
- **0051** — Reversible en esquema; **IRREVERSIBLE en datos por diseno**: lo que ya inserto `economic_batch_import` en `economic_ledger_entries` queda para siempre (trigger `economic_append_guard`: solo INSERT; el test confirma que DELETE y UPDATE siguen fallando tras el rollback). Para anular importes cargados se agregan asientos compensatorios (`reversal`/`refund`) con el mismo procedimiento de carga, nunca se borra. Por eso la carga de marketplaces debe ir precedida de lote piloto pequeno y verificacion.
- **0052** — Elimina 5 tablas del Tracker (solo-insercion). La guarda aborta si hay filas salvo que la sesion declare `set vexa.rollback_confirm_drop_data='yes'`. No hay rollback parcial de filas.
- **0053** — Elimina las 2 tablas de metadatos de adjuntos. **No toca los bytes del bucket** (quedan huerfanos; son direccionables por sha256, se pueden re-registrar). Misma guarda de datos.
- Datos producidos por funciones (asociaciones, vinculos, hechos): rollback de esquema no los revierte. Se retiran, si hace falta, con el flujo de retencion/borrado de 0033/0045 (`retention_erase`), no con DELETE.

## Aplicar en produccion (cuando Javier lo decida; no se hizo)
Mismo patron que `aplicar-0054.sh`: comprobar que el proyecto enlazado es `proyecto-ejemplo`, guardar el estado actual, `supabase db query --linked -f ops/rollback/<n>.down.sql`, verificar con lectura (md5 de `prosrc`, `to_regclass`), registrar. Para 0052/0053 con datos: respaldo verificado primero y luego `set vexa.rollback_confirm_drop_data='yes'` en la misma sesion. Si el clasificador bloquea la escritura, entregar el script `!`.

## Lo que se probo (local)
`node ops/rollback/test.mjs`: (1) para cada paso la huella `pg_dump --schema-only` del esquema revertido es identica a la de un esquema construido sin esas migraciones; (2) subir-bajar-subir devuelve la huella original; (3) cada `down` es idempotente; (4) 0052/0053 abortan con datos sin confirmacion y no borran nada, y con confirmacion eliminan solo sus tablas dejando mensajes/conversaciones/clientes/ledger intactos; (5) tras 0051.down el ledger conserva sus asientos y rechaza DELETE/UPDATE; (6) ninguna otra funcion referencia las funciones de 0051.

## No verificado
Que el esquema remoto coincida exactamente con el del repo (no se leyo produccion); comportamiento bajo carga concurrente real; el rollback de 0049/0054 contra datos reales (solo definicion identica + la prueba de equivalencia existente en `supabase/tests/association-candidates/`).
