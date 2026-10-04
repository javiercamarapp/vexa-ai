# Catálogo y política del gateway

Propuesta local F04-01. Reutiliza el gateway revisado del banco; agrega catálogo explícito y caducidad, lista de modelos autorizados y runtime apagado por defecto. No acepta la tarea ni habilita inferencia por existir una API key.

`fetchModelCatalog` hace exclusivamente GET al catálogo público de OpenRouter, sin credencial ni redirects, con timeout y límite de bytes. `parseModelCatalog` conserva IDs/capacidades/contexto y produce una versión SHA256; no convierte precios públicos a tarifas autorizadas ni infiere permisos del endpoint. Un error rechaza el refresco. El caller conserva su versión vigente hasta su expiración; una versión vencida, futura, vacía o inválida bloquea el gateway. TTL máximo de24horas, por defecto1hora. No existe renovación implícita durante extracción ni extensión de vigencia por fallo de red.

Cada instancia recibe `catalog`, `policy.allowedModels`, `modelsByRole` y, para habilitar su transporte, `runtime:'enabled'`. El default `stub` retorna `runtime_disabled` sin reserva ni red; no genera resultados sintéticos de negocio. Sólo servidor autorizado configura estas entradas. Cambiar política o catálogo exige crear una instancia con nueva versión, no mutar la instancia activa. Este módulo no es un endpoint de edición de políticas.

La intersección requiere ID permitido, presencia en catálogo vigente, soporte `response_format`, contexto suficiente tanto del catálogo como del endpoint, proveedor autorizado, tarifa y atestación de privacidad vigentes. `dataCollection:'deny'`, ZDR y residencia se comprueban por separado. El catálogo no acredita ninguno de los últimos dos. Se vuelve a comprobar la elegibilidad después de persistir la reserva/intento y antes de cada envío, incluido fallback. Catálogo y política se copian al crear el gateway; versión de catálogo entra en el fingerprint de reserva y la metadata del resultado.

Las pruebas del banco usan modelos, tarifas, tokens y transporte sintéticos. El adaptador en memoria de presupuesto sigue marcado exclusivamente para pruebas; F04-02 debe aportar repositorio SQL durable. No se ha realizado inferencia pagada ni verificado residencia efectiva de un proveedor, precisión, precio real, gold humano o producción remota.

Referencia de formato consultada20-sep-2026: [catálogo oficial](https://openrouter.ai/docs/api/api-reference/models/get-models). Controles separados de [residencia y privacidad](https://openrouter.ai/docs/guides/get-started/sovereign-ai). La consulta documental no autoriza ni demuestra acceso a funciones comerciales.

## Residencia y rutas explícitas

La política `residency: 'unrestricted'` usa el endpoint global y no declara residencia regional. El candidato debe coincidir y no puede afirmar `residencyEnforced: true`. Las políticas `US`/`us` y `EU`/`eu` conservan atestación vigente y usan únicamente `us.openrouter.ai` o `eu.openrouter.ai`, respectivamente. No hay retorno automático al dominio global. Las regiones desconocidas y los overrides de endpoint incompatibles se rechazan antes del envío.

Esta selección no acredita habilitación regional de la cuenta: las rutas regionales requieren las condiciones del proveedor. Se conservan los controles separados de recolección, ZDR, tarifas, catálogo, presupuesto y evidencia. [Contrato oficial de residencia](https://openrouter.ai/docs/guides/features/sovereign-ai).

Embedding billing accepts finite nonnegative numeric provider costs, including scientific notation, and rounds up to integer microUSD with BigInt. Missing or invalid cost retains an uncertain reservation. The observed Azure response ID `text-embedding-3-small` is accepted only for the pinned `openai/text-embedding-3-small` request through `azure`; other model/provider aliases remain rejected.


### Source-bound extraction references

The extraction request supplies bounded evidence spans and literal entity phrases with ephemeral ASCII references. The server resolves returned references only against the current validated revisions, then applies the unchanged final schema and citation validator. Unknown references, extra value keys and entity values linked to another revision are rejected. Existing literal spans remain compatible. Values are limited to 32 phrases per revision and 96 per request; this is not a complete entity catalog.

`schemaHash` identifies the final persisted extraction schema; `wireSchemaHash` identifies the dynamic provider response schema. Reference selection preserves the original Unicode and code-point coordinates without normalization or offset repair. Synthetic provider evidence demonstrates protocol compatibility; it does not certify customer classification quality.
