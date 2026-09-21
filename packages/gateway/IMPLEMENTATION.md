# Propuesta aislada: gateway y evidencia

Estado: implementado localmente, pendiente de revisión y gates externos del coordinador. No se aceptaron tareas ni se integró en candidato oficial. Base inspeccionada: `ed7f6cae65fceedb805201a2e9752794ce59d524`; cambios sin commit. Node observado: `v26.7.0`; sintaxis/API elegidas para Node >=22, sin ejecución específica en Node 22.

## Segunda implementación: corrección focalizada de caducidad (19-sep-2026)

La primera propuesta fue **rechazada**, aunque sus 20 pruebas de gateway y 4 de intelligence pasaban. El hallazgo P2 del revisor demuestra que planificar antes de `reserve` no autoriza enviar después de caducar tarifas o atestaciones. Se verificó localmente que el SHA256 inicial de `gateway/index.mjs` coincide con el del rechazo: `58d8be25d92c4996df81832df962d0b0e087efc8e842ab7dcb13f6c96b79165d`. Los resultados históricos de la primera implementación se conservan más abajo; no equivalen a aceptación. No se consultaron ni modificaron los originales/recibos archivados por el principal.

Cambio mínimo: `extract` vuelve a ejecutar `eligible(candidate, policy, clock.now())` después del await de `recordAttempt` y antes de cada transporte, incluido fallback. No existe otro await entre esa comprobación y la invocación del transporte. Si la tarifa o la atestación ya no están vigentes, termina con `policy_blocked`, sin enviar ese intento ni saltar a otro candidato. Las firmas públicas y el puerto de presupuesto no cambian.

Diez negativos nuevos comprueban por separado tarifa y privacidad en cinco situaciones: caducidad durante `reserve`, durante persistencia de intento `started`, durante persistencia de respuesta `received` antes del fallback, durante `Retry-After`, y exactamente en el instante de expiración. Usan reloj inyectado, tarifas sintéticas y transporte falso. El rechazo previo al primer envío concilia cero porque se conoce que no hubo transporte; el rechazo de fallback conserva el cero explícitamente reportado o los 3 micro-USD del primer intento. No convierte costos ausentes en cero. El registro `started` significa intención persistida previa al envío, no prueba de envío; puede existir en una reserva finalizada por bloqueo. Si la finalización falla, el comportamiento existente devuelve `budget_unavailable`/`uncertain`.

Evidencia ejecutada en esta segunda implementación, Node `v26.7.0`:

| Comando / momento | Salida observada |
|---|---|
| `node --test packages/gateway/gateway.test.mjs packages/intelligence/intelligence.test.mjs` después de añadir negativos, antes de corregir | `tests 34`, `pass 24`, `fail 10`, `cancelled 0`, `skipped 0`, `todo 0`; exit 1. Los diez fallan por `AssertionError: no envío con tarifa o atestación caducada`: `1 !== 0` en primer envío, `2 !== 1` en fallback. No hubo fallo de setup. |
| Mismo comando después de corregir | `tests 34`, `pass 34`, `fail 0`, `cancelled 0`, `skipped 0`, `todo 0`; exit 0. Incluye las 24 regresiones anteriores sin cambios. |
| `shasum -a 256 packages/gateway/index.mjs` final | `54336cdf18c4119bd703c535dbafb4220e1a1d61ceb56b498266b8bef6f4b4da`; exit 0. |
| `shasum -a 256 packages/gateway/gateway.test.mjs` final | `4a0345047bb581c521c6b24b503846ffdaffcadebde9b0316af34602ea75cb8a`; exit 0. |

Archivos editados en esta corrección: `packages/gateway/index.mjs`, `packages/gateway/gateway.test.mjs` y este informe. Intelligence y presupuesto no se modificaron. Sin delegación, red, instalaciones, acceso a private, operaciones Git, commits ni push. No se ejecutaron gates/aceptación ni controlador (su suite realiza operaciones Git, prohibidas en este encargo). Las verificaciones generales históricas de abajo no se presentan como reejecutadas en esta corrección.

Pendiente: revisión independiente del parche, gates externos y adopción por coordinador, integración durable/SQL, proveedor real, UI/producción y Node 22 específico. El reloj y el repositorio siguen siendo dependencias confiables inyectadas. Esta corrección comprueba vigencia al invocar transporte; no certifica residencia real del proveedor ni cancela retroactivamente solicitudes que caduquen después de enviarse. No se implementaron embeddings/clustering ni se midió precisión con gold humano. **CONFLICTO:** no se detectó contradicción normativa nueva para esta corrección; se mantienen los límites y la precedencia ADR05 explicados al final.

## Archivos y APIs

- `packages/gateway/index.mjs`: `createGateway({apiKey, policy, modelsByRole, budgetRepository, fetch?, clock?, endpoint?}) → {extract(input): Promise<Result>}`. Sólo servidor; no consulta variables de entorno ni registra credenciales. Transporte fetch nativo por defecto. URL admitida: `https://openrouter.ai/api/v1/chat/completions`; redirects bloqueados. No habilita destinos arbitrarios para una credencial. La configuración real consiste en modelos/proveedores, política, tarifas y dependencias inyectadas.
- `packages/gateway/budget.mjs`: `InMemoryBudgetRepository({budgets:[{tenantId,window,limitMinor}]})`, adaptador de pruebas de un solo proceso; `snapshot()` devuelve copia. No durable, no SQL.
- `packages/gateway/budget.d.ts`: puerto explícito `BudgetRepository.reserve(request)`, `recordAttempt(reservationId, attempt)`, `finalize(reservationId, settlement)` y requisitos de atomicidad/durabilidad/fencing.
- `packages/intelligence/index.mjs`: `extractionSchema(taxonomy,{modelOutput=false}?)`; `validateRevisions(revisions,tenantId)`; `validateEvidence(spans,revisions,{tenantId})`; `validateExtraction(value,revisions,{taxonomy,tenantId})`; `validateModelExtraction(value,revisions,options)`; `sha256(text)`.
- `packages/gateway/gateway.test.mjs` y `packages/intelligence/intelligence.test.mjs`: 34 pruebas locales (24 originales y 10 de caducidad) con datos sintéticos y transporte falso. Credencial de prueba efímera generada en memoria, sin clave real ni fixture de credenciales.

`extract` recibe `{tenantId,taskKey,role:'extraction',taxonomy:string[],revisions:[{tenant_id,message_revision_id,role,text}]}`. El caller servidor debe derivar tenant y revisiones permitidas de identidad/membership vigente; pasar un tenant en este contrato interno no autentica al usuario. Sólo se proyectan IDs de revisión, roles y texto redactado al proveedor; no se envían tenant, taskKey ni campos extra del caller. No se implementa redacción de PII: la entrada debe llegar redactada y versionada.

Éxito: `{ok:true,data,meta,billingState}`. Fallo: `{ok:false,error:{code,message,retryable:false},billingState?}`. Códigos estables sin cuerpo del proveedor, stack, token o texto de conversación. `meta` contiene modelo/proveedor configurados, hashes de prompt/schema, versión de política, número de intentos y tokens disponibles; NO afirma identidad remota verificada. ID remoto se guarda sólo hasheado en el registro del intento.

## Configuración obligatoria y política

`policy` exige `version`, `authorized:true`, `dataCollection:'deny'`, `requireZdr:boolean`, `residency`, `providers:string[]`, `maxAttempts` (1–3), `timeoutMs` (1–120000), `maxOutputTokens` (1–16000), `maxInputBytes`, `maxResponseBytes` (ambos hasta 1000000), `maxCostPerCallMinor`, `maxCostPerTaskMinor`, `tenantLimitMinor`, `window`, `currency:'USD'`, `exponent:6`. Importes son cadenas enteras positivas en micro-USD, nunca floats contables. Configuración se copia al construir el gateway, no puede mutarse entre awaits.

Cada candidato de `modelsByRole.extraction` exige `model`, `provider`, `structuredOutput:true`, `dataCollection:'deny'`, `zdr`, `residency`, `contextTokens`, `privacyAttestation:{version,residencyEnforced:true,expiresAt}` y `pricing:{version,validUntil,allChargesIncluded:true,inputMicroUsdPerToken,outputMicroUsdPerToken,overheadTokens}`. Tarifas son límites superiores enteros por token; overhead mínimo 1024. Son configuración de servidor de confianza, NO certificaciones obtenidas por este código. La atestación de residencia debe provenir de verificación real de ese endpoint/provider slug y condiciones aplicables. Sin ella o si caduca, se bloquea. `deny` no sustituye ZDR; ZDR no sustituye residencia.

La reserva estimada usa bytes UTF-8 de la solicitud serializada como cota conservadora de tokens de entrada, más overhead configurado, y máximo de tokens de salida. El integrador debe validar esta cota/tokenizador, tarifas y cobertura de todos los cargos antes de habilitar tráfico real; modelos con cargos no cubiertos no son elegibles. No se eligió un modelo premium universal ni se consultó catálogo actual. Los IDs/precios en tests son exclusivamente sintéticos.

Solicitud real implementada: POST JSON con bearer key, `response_format.type=json_schema`, `json_schema.strict=true`, `provider.only`, `allow_fallbacks:false`, `require_parameters:true`, `data_collection:deny`, y `zdr:true` cuando se exige. Sin tools, SDK ni fallback secreto del proveedor. Transporte real no ejecutado.

## Reserva, estados y reintentos

Antes de red se reserva la suma de cotas de todos los intentos planificados, limitada por llamada, tarea y tenant/ventana. El repositorio en memoria comprueba además su propio límite configurado; `reserve` realiza lectura/decisión/inserción sin awaits internos. Unicidad `(tenantId,taskKey)` y fingerprint SHA256 de entrada/política/planes impiden doble envío concurrente y replay; input distinto da `idempotency_conflict`. Misma clave completada devuelve `duplicate_task`: el resultado debe persistirse/recuperarse mediante un servicio durable, no se repite inferencia.

Intento iniciado se persiste antes de fetch. Timeout abarca headers y lectura del body, usando AbortController y Promise.race incluso cuando un transporte falso ignora abort. Timeout, error de transporte, JSON HTTP ilegible o ausencia de `usage.cost` mantienen `uncertain`, `actualMinor:null` y toda la reserva. No se reintenta una llamada de cargo incierto. Respuesta válida sin costo puede devolver datos validados con `billingState:uncertain`; no es autorización para ignorar la reserva.

Costo reportado se convierte de USD decimal a micro-USD con BigInt y redondeo hacia arriba. Cero explícito se conserva como reportado; ausencia no se transforma en cero. Formatos no soportados, negativos o exponenciales quedan desconocidos conservadoramente. Tokens disponibles sin costo no se convierten en costo observado. Sobreprecio reportado se contabiliza completo, devuelve `cost_overrun` y bloquea consumo posterior si agota el saldo. La cota local no es una garantía contractual de facturación del proveedor: tarifas incorrectas pueden producir un sobrecargo detectado después de la respuesta.

Sólo 429/503 con costo conocido pueden avanzar al siguiente candidato elegible; máximo tres intentos, sin reintentos adicionales del SDK. Cada fallback mantiene la misma política. Retry-After hasta 1 segundo se respeta; mayor/ilegible devuelve `retry_deferred`. 401/403, schema inválido, truncamiento, tools o referencias inválidas son terminales. Límite temporal de transporte por tarea: `maxAttempts × timeoutMs + hasta 2 segundos de espera`; latencia del repositorio no tiene deadline implementado. El reloj inyectable expone `now`, `setTimeout`, `clearTimeout`.

Repositorio durable pendiente: transacción serializable/locking para cuotas y unicidad, auth/RLS, ownership/fencing, persistencia antes de resolver, reconciliación posterior de incertidumbre con evidencia del proveedor, publicación atómica y recuperación de crashes. Una reserva sin finalize debe permanecer retenida, nunca liberarse por TTL. No se implementa endpoint remoto de conciliación ni se inventa deduplicación de cobros del proveedor.

## Evidencia y clasificación

Taxonomía configurada por caller servidor; categorías, severidad, sentimiento, intención y urgencia tienen enums cerrados. Campos desconocidos, importes, probabilidades, IDs de cliente inventados, arrays excesivos y entidades sin cita se rechazan. `abstention:{reason}` obliga issues/entities vacíos y etiquetas unknown. Sin abstención se exige al menos un issue con evidencia.

Cada span referencia revisión incluida en la entrada autorizada, mismo tenant y rol customer/agent/internal. Intervalo `[start,end)` en Unicode code points mediante `[...text]`, sin normalización posterior. Se exige cita exacta y SHA256 UTF-8; se rechazan duplicados de revisión, offsets fraccionarios/fuera de rango, emoji mal segmentado, texto mal formado, citas ajenas y rol falseado. El esquema enviado al modelo excluye quote_hash: el servidor lo calcula después de verificar forma y antes de validar integridad. No se exige criptografía al LLM.

Texto externo sólo ocupa datos JSON en mensaje user; no puede configurar políticas, herramientas ni rutas del cliente. No hay ejecutor de herramientas. Esto prueba separación estructural y rechazo de tool_calls, no inmunidad semántica del modelo a prompt injection. Cita exacta tampoco demuestra que respalde una interpretación: soporte factual, negación, causalidad y severidad requieren evaluación humana.

## Comandos y salidas observadas de la primera implementación (histórico)

| Comando | Salida real / exit |
|---|---|
| `node --test packages/gateway/*.test.mjs packages/intelligence/*.test.mjs` inicial | 11 tests, pass 2, fail 9; exit 1. Stubs de comportamiento permitieron observar aserciones rojas de reserva/envío/evidencia. |
| Prueba añadida de hashes calculados por servidor | 4 tests, pass 3, fail 1; export aún ausente. Limitación: ese rojo fue API ausente, no prueba de calidad criptográfica del modelo. |
| Prueba añadida de tarifa caducada/cargos no cubiertos | 19 tests, pass 18, fail 1; el caso recibía éxito indebido antes de la corrección. |
| `node --test packages/gateway/*.test.mjs packages/intelligence/*.test.mjs` final | 24 tests, pass 24, fail 0; exit 0. |
| `npm test` | kernel 12 + preparación/negativos 12; 24 pass, 0 fail; exit 0. |
| `PYTHONDONTWRITEBYTECODE=1 npm run test:controller` | Ran 108 tests in 60.245s; OK; exit 0. Suite existente usa Git/commits/remotos bare en repos temporales; no publicó ni cambió el historial del candidato. |
| `PYTHONDONTWRITEBYTECODE=1 npm run graph:check` | 55 tareas pending, 8 gates presentes/47 MISSING en este checkout; exit 0. No acredita aceptación. |
| `git diff --check` y `git status --short` | exit 0; sólo directorios nuevos packages/gateway y packages/intelligence. diff de tracked vacío porque los archivos son nuevos, no una revisión completa del contenido nuevo. |

No instalé dependencias ni generé node_modules/cache en candidato. No modifiqué economics, aceptación, orchestration, app, DB, configuración Git, manifests raíz o documentación global. No accedí a private ni a datos de cliente. No hice llamadas a inferencia, commits del candidato, push o despliegues.

## No cubierto / integración pendiente

- Adopción por coordinador y examen externo independiente congelado: pendiente. Estas pruebas no se autoaceptan como gate.
- Repositorio durable, permisos de identidad/revisiones vigentes, jobs/outbox/publicación/recovery: pendiente.
- Catálogo/precios/contrato real, residencia/ZDR efectivos, modelo/proveedor reportado y funcionamiento real del schema OpenRouter: no probados.
- Gold humano, precisión (>85% objetivo), recall, calibración, latencia/costos reales, soporte causal, utilidad comercial: no evaluados. Fixtures no son gold ni piloto.
- Embeddings, clustering, asignación estable de problemas, brief y otros roles: pendientes explícitos; sólo extracción/clasificación implementada.
- Build de app, integración UI/DB, Node 22 específico y pruebas multiproceso de presupuesto: no ejecutados.

CONFLICTO: no se identificó contradicción normativa nueva entre ADR01/05 y los contratos consultados. El esquema antiguo de anotación usa `message_id`; aquí rige ADR05: `message_revision_id` sobre texto redactado versionado. Las etiquetas de objetivos de precisión se conservan como objetivos sin convertir mocks en resultados. `guide.py next` muestra E00 por estado aislado; el encargo explícito limita esta propuesta a gateway/intelligence, por lo que no se alteró economics ni se aceptó E00.
