# Importador económico por lotes

Migración: `supabase/migrations/0051_economic_batch_import.sql`. Prueba: `packages/economics/batch-import.test.mjs`. Estado: probado solo en un PostgreSQL 17 local con datos sintéticos; nada aplicado a Supabase real.

## Qué hace

`public.economic_batch_import(p jsonb) returns jsonb` agrega hasta 250 asientos de una misma fuente al ledger inmutable `economic_ledger_entries` en una sola transacción. Es el gemelo por conjunto de `EconomicRepository.record()` (`packages/metrics/repository.mjs`): misma validación, misma derivación del `entity_id`, misma semántica de `expectedRevision`/reintento, y los triggers `economic_append_guard` siguen disparándose en cada fila. No cambia tablas, políticas RLS ni guardas.

Diseño:

1. Guardas de acceso (patrón de `association_commit_batch`, 0045): `SECURITY DEFINER`, `search_path=''`, tenant solo desde `vexa.tenant_id`, `auth.uid()` obligatorio, `vexa_backend_action(t,['configure'])` y `vexa_member(t,['owner'])`. Grant de ejecución solo a `vexa_backend`; funciones auxiliares sin grants.
2. Forma y tamaño: objeto con exactamente `sourceId`, `sourceVersion`, `entries`; 1..250 entradas; `octet_length(p::text) <= 8 MiB`.
3. Pasada 1, pura y sin escritura: valida cada entrada (`economic_batch_entry_error`).
4. Mismo advisory lock por tenant que `record()` y el trigger (`<tenant>:economic-ledger`), se toma una vez por lote.
5. Fuente: última versión de `economic_source_versions`; debe estar activa, coincidir con `sourceVersion` y su `evidence_type` con el `kind` de cada entrada.
6. Pasada 2, en orden: `entity_id` = misma derivación que `stable([tenant,source,kind,externalId])` (sha256 del JSON canónico, formato uuid v5-like). Si la última revisión es `expectedRevision+1` y el contenido es idéntico, es un reintento (`replayed`, no escribe). Si la última revisión no es `expectedRevision`, conflicto. Si no, inserta la revisión `expectedRevision+1`.
7. Todo ocurre en una transacción: cualquier error aborta el lote completo, sin escritura parcial.

Idempotencia: la clave efectiva es `(tenant, source_id, kind, external_id, revision)` (índice único existente) vía el `entity_id` determinista. Reenviar el mismo lote devuelve todo como `replayed`. Un mismo asiento repetido dentro del lote se inserta una vez y la repetición es `replayed`.

## Contrato de entrada

```json
{
  "sourceId": "uuid", "sourceVersion": 1,
  "entries": [{
    "expectedRevision": 0, "externalId": "texto 1..200", "kind": "order|refund|reversal|replacement",
    "effectiveAt": "2026-03-01T00:00:00.000Z", "currency": "MXN", "exponent": 2, "basis": "texto 1..200",
    "amountMinor": "1234", "status": "...", "orderId": null, "reversalOf": null,
    "details": {}, "report": "20..8000 caracteres", "attested": true
  }]
}
```

- Las 14 claves de la entrada son obligatorias; claves desconocidas se rechazan.
- `amountMinor`: cadena de entero (`^(0|[1-9][0-9]{0,36})$`), o `null` (desconocido, nunca cero). Para `reversal`: `0` o negativo y `reversalOf` obligatorio; para el resto, `reversalOf` debe ser `null`. Un número JSON se rechaza.
- `effectiveAt`: instante UTC estricto `YYYY-MM-DDTHH:MM:SS[.fff]Z` que debe ir y volver sin cambio (rechaza `2026-02-30`, offsets, `24:00`). El trigger rechaza fechas futuras.
- `status`: `order` en `recorded|pending|cancelled|unknown`; `refund|reversal|replacement` en `settled|pending|cancelled|unknown`.
- `details` debe ser `{}`. Diferencia deliberada con `record()`: `support_model` y `future_scenario` (detalles aprobados a mano) no se aceptan por lote y siguen en el camino por registro.
- Las fuentes (`economic_source_versions`) se crean antes con `recordSource`; una llamada por lote usa una sola fuente y por tanto un solo tipo de evidencia (órdenes en fuente `order_export`, refunds/reversas en `payment_ledger`, etc.).
- Diferencia menor: UUID de entrada se normalizan a minúsculas; `record()` hashearía el texto tal cual. Con UUID en minúsculas el resultado es idéntico.

Respuesta: `{processed, inserted, replayed, entries:[{index, entityId, rowId, revision, outcome}]}`.

## Errores tipados

| SQLSTATE | `message` | `detail` |
| --- | --- | --- |
| 42501 | `insufficient_privilege` | sin tenant, sin sesión, acción distinta de `configure`, rol no propietario |
| 23514 | `ECONOMIC_BATCH_INVALID` | `batch_shape_or_size`, `source_reference_invalid`, o `entry N: <código>` con `entry_invalid`, `amount_or_reversal_invalid`, `status_invalid`, `unsupported_field` (mismos códigos que `record()`) |
| 23514 | `ECONOMIC_BATCH_SOURCE_UNAVAILABLE` | fuente inexistente, inactiva, versión vieja o tipo de evidencia incorrecto |
| 40001 | `ECONOMIC_BATCH_CONFLICT` | `entry N: entry_version_conflict` |
| 23514 / 40001 | (triggers existentes) | fechas futuras, saltos de revisión, etc.; abortan el lote completo |

## Límites y operación

- Máximo 250 entradas y 8 MiB por llamada.
- El llamador debe ejecutar `SET LOCAL statement_timeout='30000ms'` (y opcionalmente `lock_timeout`) en su propia transacción antes de llamar. Verificado en PostgreSQL 17: un `SET` en la función, o `set_config` dentro de ella, no amplía el temporizador de la sentencia que ya corre.
- El lock por tenant serializa lotes del mismo tenant entre sí y con `record()`; un lote de 250 dura decenas de ms, no hace falta paralelizar por tenant.
- El rol que despliega la migración debe poder insertar saltándose RLS (como `postgres` en Supabase o el dueño en las pruebas); es el mismo supuesto de `association_commit_batch`. Los triggers de append conservan las comprobaciones de membresía.
- Reversas: igual que en `record()`, `reversalOf` no tiene FK; huérfanos o excesos los detecta el adaptador al leer (`REFUND_RECONCILIATION_REQUIRED`). El lote no los oculta ni los repara.

## Resultados medidos (local, sintético)

Entorno: PostgreSQL 17 (Homebrew) local, socket Unix, `fsync=off`, esquema 0001..0051 sobre stubs mínimos de Supabase (`auth`, `storage`, vector); Mac con carga alta (load average ~7) durante la corrida. Comando en la cabecera de `batch-import.test.mjs`.

- Equivalencia: se aplicó la misma secuencia (1,556 llamadas; miles de filas finales; 5 monedas con exponentes 0, 2, 3, 4; `externalId` con ñ, emoji, CJK, comillas y barra invertida; orders, refunds, reversas, replacements; segunda y tercera revisión; reintentos idénticos; duplicado dentro del lote) con el `EconomicRepository.record()` real sobre una base y con el lote sobre otra base idéntica. Resultado: mismo `entity_id` y revisión en cada llamada, mismo digest SHA-256 de todas las columnas (menos `id`/`recorded_at`) y mismas métricas del adaptador sobre ambas bases (405 reintentos reconocidos como `replayed`).
- Rechazos: 20 casos inválidos o conflictivos dieron la misma causa que el camino por registro (moneda, exponente, fecha imposible/no UTC, importes y reversas, estado por tipo, claves extra, detalles, revisión vieja, fuente inactiva/incompatible, fecha futura). Cero filas escritas.
- Atomicidad y autorización: lotes de 249 válidos más un inválido al final (revisión vieja, moneda, fecha futura que dispara el trigger a mitad de escritura), 251 entradas, 0 entradas, más de 8 MiB, versión de fuente vieja, fuente desconocida, campo extra, rol analista, acción `read`, tenant ajeno, sin tenant y rol `authenticated`: todos rechazados con el código esperado y el conteo de filas sin cambio.
- Rendimiento con cientos de miles de asientos previos (lotes de 250): nuevos n=20, mediana 46 ms, máx 50 ms; reintento idéntico n=5, mediana 20 ms; segunda revisión de existentes n=5, mediana 47 ms; mixto 36 ms. Referencia: 250 llamadas `record()` por la misma base tardaron 146 ms de reloj contra socket local (sin latencia de red; con red real el camino por registro paga un viaje por asiento).

## Cableado de fuentes reales (19-oct, local, sin aplicar a remoto)

Mapeo y carga de marketplaces ([omitido: dato de cliente] filas) y Shopify (883 asientos ya cargados) sobre este importador: `marketplace-map.mjs`, `shopify-map.mjs`, `emit-sql.mjs` (SQL por tanda ≤250, sin begin/commit explícitos, resultado en una fila `ECON_BATCH_RESULT`), `scripts/economics/` (dry-run, preparar, `cargar-*.sh`, `aplicar-0051.sh`, consultas SOLO SELECT) y pruebas `marketplace-load.test.mjs` (datos sintéticos del mismo volumen). Reglas de Javier del 19-oct: filas idénticas sin identificador de línea => separadas, «a revisar» y fuera de totales vía sufijo en `basis`; con identificador y repetidas => una + `DUPLICADO_EXACTO`; identidades con moneda mezclada => cada línea en su moneda, `|multimoneda`, sin conversión; moneda desconocida => `XXX`/exponente 0/importe `null`. Detalle, orden de ejecución y límites en `~/.codex-work/rovaq-cierre-20261007/economico-carga-20261019/NOTAS.md`.

## No cubierto (siguiente fase)

- Mapeo de las fuentes reales (marketplaces y Shopify) al contrato de entrada: solo especificación. Para cada fuente hay que fijar `sourceId`, `evidence_type`, `externalId` estable (id de pedido/reembolso del origen), `basis`, moneda/exponente, `status` desde un mapa explícito, `orderId` = `economic_batch_entity_id(tenant, sourceDePedidos, 'order', externalIdDePedido)`, y el texto `report` con la procedencia del export. Estados no mapeados deben quedar `unknown`, nunca `settled`/`recorded` por inferencia.
- Tablas `economic_events` (histórica, montos sin signo), `economic_fx_versions` y `economic_currency_versions` (versionadas con aprobación del propietario), `economic_order_aliases` y `economic_order_customers` (requieren filas de ledger vigentes y reglas propias): no tienen función por lote en 0051. El ledger de [omitido: dato de cliente] + 857 pedidos entra por esta función; las relaciones y el FX se resuelven después con sus propios guardas.
- No se probó contra Supabase real, PostgREST ni el rol `postgres` hospedado, ni con volumen real; solo semántica y tiempos locales.
