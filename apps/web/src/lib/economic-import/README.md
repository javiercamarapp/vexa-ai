# Importación económica v1

Carga owner por `/economics` sobre GET y POST existentes de `/api/economics`.
No modifica la selección de organización, no publica snapshots y no conserva archivos en almacenamiento del navegador.

## Contrato

Objeto JSON con exactamente `schema`, `tenantId`, `scope`, `currencyConfiguration`, `sources`, `entries`.
`schema` es `rovaq-economic-import-v1`; `tenantId` debe coincidir con el tenant autorizado por el servidor para esta página.

- `scope`: exactamente `start`, `end`, `timezone`, `dateBasis`, `currency`, `exponent`, `basis`. Periodo UTC de días completos, inicio inclusivo y fin exclusivo, fechas canónicas `YYYY-MM-DDT00:00:00.000Z`, fin no futuro. Valores fijos: `UTC`, `occurred_at`, `USD`, `2`, `gross_order_including_tax_shipping`.
- `currencyConfiguration`: `currency`, `exponent`, `expectedVersion`, `active`, `source`, `reference`, `date`, `report`, como `CurrencyInput` sin `attested`. Debe estar activa, coincidir con USD/2 y tener evidencia válida. Esta versión requiere `expectedVersion: 0` (configuración inicial o reanudación de la versión 1 idéntica).
- `sources`: entre 1 y 20 objetos con `sourceId`, `expectedVersion`, `name`, `evidenceType`, `active`, `complete`, `windowStart`, `windowEnd`, `watermark`, `report`. UUID explícito único; activa; tipo `order_export` o `payment_ledger`. Ventana cubre el periodo. Instantes ISO canónicos con cualquier milisegundo válido, incluyendo `.753Z`. Corte no futuro. Esta versión exige `complete: false` y `expectedVersion: 0`; rechaza toda declaración de completitud y toda versión posterior antes de cualquier solicitud. Las fuentes se guardan siempre incompletas, incluso cuando terminan de cargarse todas las filas.
- `entries`: entre 1 y 2000 objetos con `sourceId`, `sourceVersion`, `expectedRevision`, `externalId`, `kind`, `effectiveAt`, `currency`, `exponent`, `basis`, `amountMinor`, `status`, `orderId`, `reversalOf`, `details`, `report`. Únicamente `order`/`refund`, con fuente de tipo correspondiente. `sourceVersion = 1`, `expectedRevision = 0`, identidad fuente/tipo/externalId única. Importe entero no negativo en minor units como string de hasta 37 dígitos, o `null` (desconocido). Órdenes: recorded/pending/cancelled/unknown; reembolsos: settled/pending/cancelled/unknown. `orderId` nulo para órdenes; para reembolsos nulo o UUID estable de orden compatible existente o incluida. `reversalOf: null`; `details: {}`.

No se admiten claves extra, `attested` suministrado por archivo, modelos, FX ni reversos. Máximo 8 MiB UTF-8 y límite por operación de 32 KiB. La evidencia source/entry tiene entre 20 y 8000 caracteres; currency report entre 20 y 4000. El parser completo es `parseImport(content, authorizedTenantId, now?)`; no efectúa solicitudes.

## Revisión y escritura

La UI presenta organización, huella SHA-256, periodo, base, importes separados, estados de reembolsos, fuentes y todos los registros paginados. Los subtotales suman importes conocidos de todos los estados, no sólo liquidados. No infiere cobertura ni pérdidas. Requiere checkbox de revisión y frase exacta `IMPORTAR N`; ambas se reinician al cambiar archivo y al iniciar cada intento.

Antes de cualquier POST, GET verifica el tenant efectivo, permisos owner y todos los conflictos. Configuración y fuentes existentes sólo se omiten si versión y metadatos coinciden exactamente. Nunca se incrementan para resolver un conflicto. Registros existentes deben coincidir con su identidad determinista, revisión 1 y todos sus metadatos.

Escritura secuencial: moneda, fuentes, órdenes y reembolsos. Cada POST lleva `X-Economic-Import-Tenant`: restricción comparada dentro de la transacción ya autorizada. El header nunca elige tenant ni identidad. Los POST ajenos a este importador conservan su comportamiento existente.

Pausar, fallo de red o respuesta ambigua detiene el envío. No hay reintentos automáticos: conservar/reseleccionar el mismo archivo y confirmar de nuevo provoca otra lectura completa antes de enviar sólo lo ausente. Un 401/403 o cambio de tenant comprobado retira el archivo y sus contadores. Sólo una lectura final que confirme todas las filas y metadatos produce éxito; la UI abre el registro con el periodo/base importados. Guardado parcial permanece explícito.

## Verificación local (Node 22)

```sh
node --import tsx --test apps/web/tests/economic-import/import.test.ts
npm run lint --workspace @vexa/web
npm run typecheck --workspace @vexa/web
npm run build --workspace @vexa/web
```

Las pruebas usan únicamente fixtures SYN y transporte en memoria. Cubren prevalidación sin solicitudes, límites, importación y reanudación idempotente, respuesta perdida tras escritura, cancelación, fallo de lectura inicial/final, autorización revocada, conflictos de metadatos, relaciones y restricción de tenant dentro de la transacción. No sustituyen QA visual ni prueba con sesión real y base de producción.
