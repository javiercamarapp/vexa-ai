# Catálogo y política del gateway

Propuesta local F04-01. Reutiliza el gateway revisado del banco; agrega catálogo explícito y caducidad, lista de modelos autorizados y runtime apagado por defecto. No acepta la tarea ni habilita inferencia por existir una API key.

`fetchModelCatalog` hace exclusivamente GET al catálogo público de OpenRouter, sin credencial ni redirects, con timeout y límite de bytes. `parseModelCatalog` conserva IDs/capacidades/contexto y produce una versión SHA256; no convierte precios públicos a tarifas autorizadas ni infiere permisos del endpoint. Un error rechaza el refresco. El caller conserva su versión vigente hasta su expiración; una versión vencida, futura, vacía o inválida bloquea el gateway. TTL máximo de24horas, por defecto1hora. No existe renovación implícita durante extracción ni extensión de vigencia por fallo de red.

Cada instancia recibe `catalog`, `policy.allowedModels`, `modelsByRole` y, para habilitar su transporte, `runtime:'enabled'`. El default `stub` retorna `runtime_disabled` sin reserva ni red; no genera resultados sintéticos de negocio. Sólo servidor autorizado configura estas entradas. Cambiar política o catálogo exige crear una instancia con nueva versión, no mutar la instancia activa. Este módulo no es un endpoint de edición de políticas.

La intersección requiere ID permitido, presencia en catálogo vigente, soporte `response_format`, contexto suficiente tanto del catálogo como del endpoint, proveedor autorizado, tarifa y atestación de privacidad vigentes. `dataCollection:'deny'`, ZDR y residencia se comprueban por separado. El catálogo no acredita ninguno de los últimos dos. Se vuelve a comprobar la elegibilidad después de persistir la reserva/intento y antes de cada envío, incluido fallback. Catálogo y política se copian al crear el gateway; versión de catálogo entra en el fingerprint de reserva y la metadata del resultado.

Las pruebas del banco usan modelos, tarifas, tokens y transporte sintéticos. El adaptador en memoria de presupuesto sigue marcado exclusivamente para pruebas; F04-02 debe aportar repositorio SQL durable. No se ha realizado inferencia pagada ni verificado residencia efectiva de un proveedor, precisión, precio real, gold humano o producción remota.

Referencia de formato consultada20-sep-2026: [catálogo oficial](https://openrouter.ai/docs/api/api-reference/models/get-models). Controles separados de [residencia y privacidad](https://openrouter.ai/docs/guides/get-started/sovereign-ai). La consulta documental no autoriza ni demuestra acceso a funciones comerciales.
