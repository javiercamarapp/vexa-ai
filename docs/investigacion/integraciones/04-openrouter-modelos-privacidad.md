# 04 · OpenRouter: modelos, privacidad, calidad y consumo

## Decisiones

Un gateway servidor selecciona modelos por rol y política versionada. No fijar IDs por memoria, marca o ejemplos de un SDK: validar cada ID exacto contra catálogo vigente y evaluar su endpoint con datos permitidos. Ningún modelo ni acceso comercial quedó probado en esta investigación sin red/API.

Roles MVP: extracción estructurada con evidencia, agrupación/asistencia de etiquetado y redacción de brief desde resultados verificados. Embeddings requieren spike propio; no inferir soporte del gateway por el de un wrapper. El LLM no calcula dinero, no adjudica recuperación de ingresos y no ejecuta acciones de negocio. El cálculo financiero ocurre downstream en código determinista con entradas/versiones auditables. Base: [contexto canónico](../../CONTEXTO-CANONICO.md).

## Evidencia y contrato respaldado

| URL y archivos | Contrato visible / restricción |
|---|---|
| [Models](https://openrouter.ai/docs/guides/overview/models), [openrouter-models.md](../fuentes/openrouter-models.md), [JSON](../fuentes/openrouter-models.json) | Metadatos `context_length`, `pricing`, `supported_parameters`; pricing descrito como el del proveedor principal y tokenización según modelo. No es catálogo consultado hoy ni precio efectivo de todo fallback. |
| [Structured Outputs](https://openrouter.ai/docs/guides/features/structured-outputs), [openrouter-structured.md](../fuentes/openrouter-structured.md), [JSON](../fuentes/openrouter-structured.json) | `response_format` con `type: json_schema`, `json_schema` y `strict: true`; preferencias de proveedor con `require_parameters: true`. Capacidad depende del endpoint y enforcement varía: sigue siendo necesaria validación local. |
| [Provider Routing](https://openrouter.ai/docs/guides/routing/provider-selection), [openrouter-privacy.md](../fuentes/openrouter-privacy.md), [JSON](../fuentes/openrouter-privacy.json) | `data_collection` permite allow/deny; `zdr: true` restringe a endpoints con política ZDR. El formato de la tabla extraída está deteriorado; no reconstruir defaults a partir de sus columnas. |
| [Sovereign AI](https://openrouter.ai/docs/guides/features/sovereign-ai), mismos archivos de privacidad | Distingue controles de colección, ZDR y routing regional. El extracto no contiene una configuración regional operable ni una garantía contractual de residencia. |

Los ejemplos Prism y Corsair en `openrouter-models.*` describen wrappers distintos. «Embeddings no implementado» en uno no demuestra ausencia en OpenRouter; nombres de funciones en otro no prueban endpoint público ni dimensiones. Catálogo, embeddings, autenticación, streaming y facturación detallada siguen incompletos.

## Privacidad como restricción de elegibilidad

`provider.data_collection = "deny"` no equivale a ZDR ni garantiza ubicación. Si el tratamiento acordado requiere ZDR, añadir `provider.zdr = true` y verificar disponibilidad/condiciones por endpoint. No afirmar cumplimiento jurídico a partir de esos parámetros. Los términos, logging del gateway, backups, tránsito, región y tratamiento de errores también importan.

Propuesta: política por tenant con finalidades, campos permitidos, retención y proveedores elegibles; en ausencia de política aprobada no enviar conversaciones reales. Minimizar PII antes de la salida, usar referencias seudónimas y mantener reidentificación en VEXA. Seudonimizar no convierte automáticamente el texto libre en anónimo: una conversación puede revelar dirección, salud o datos de terceros.

Un fallback solo puede elegir endpoints que satisfagan la misma privacidad, schema, contexto y presupuesto. Sin endpoint elegible: bloquear job con razón visible, nunca quitar ZDR, permitir colección o relajar residencia silenciosamente. Registrar política solicitada y proveedor/modelo efectivamente reportados; si la respuesta no permite verificar un atributo requerido, no certificarlo como cumplido.

Separar prompts de instrucciones del contenido CRM. Mensajes y adjuntos son datos no confiables: no obedecer instrucciones incrustadas, no incluir herramientas de escritura, no permitir que una URL extraída active descarga o exfiltración. Logs operativos no contienen texto completo, tokens de autenticación ni prompts por defecto.

## Contrato interno propuesto de extracción

Se apoya en evidencia, abstención y trazabilidad del contexto; no es un esquema remoto ya publicado. Versionarlo al implementarlo y probarlo con el subconjunto de JSON Schema admitido por el endpoint.

Entrada: referencias autorizadas de mensajes y revisiones, texto mínimo, idioma, taxonomía/versiones y política. Fragmentar por mensajes y presupuesto de contexto, conservando un mapa al original. Truncar silenciosamente destruye cobertura; registrar fragmentos procesados y ausentes.

Salida semántica: etiqueta permitida o abstención, causa probable diferenciada de hecho observado, referencias de evidencia y fragmentos localizables. IDs citados deben pertenecer al mismo tenant y a la entrada de esa solicitud. Rechazar evidencia inexistente, cita que no coincide con la revisión, enum desconocido y JSON inválido. Un JSON bien formado no prueba exactitud ni causalidad. No aceptar campos de dinero calculado, instrucciones operativas o IDs de cliente inventados.

El brief recibe agregados deterministas y evidencias autorizadas; cualquier cifra que publique debe resolver al snapshot financiero y su moneda/categoría, sin recalcularla mediante texto. Una recomendación apunta a evidencia y responsable humano; su creación no implica ejecución ni resultado económico.

## Presupuesto y estado de intentos

Antes de enviar, estimar consumo por modelo/endpoint, entrada, límite de salida y tarifas conocidas. Reservar presupuesto de forma atómica por tenant/run para impedir carreras entre workers. Incluir reintentos y fallback en el techo. Si no hay tarifa o tope defendible, costo es desconocido: pausar ejecución pagada hasta acordar política/presupuesto, no asignar cero.

Después, registrar intento con ID interno, ID remoto si existe, modelo/proveedor reportado, tokens/usage disponibles, tiempo, resultado de validación y costo con procedencia. Separar `estimado`, `reportado` y `desconocido`; no mezclar costo de IA con impacto financiero del cliente. Un valor explícito cero solo puede tratarse como tal si existe evidencia de gratuidad/consumo cero para ese concepto.

Secuencia propuesta: reserva → intento iniciado → respuesta recibida → validación → persistencia → conciliación. Si se pierde la conexión tras enviar, el proveedor pudo procesar/cobrar: marcar desenlace y costo inciertos. No liberar toda la reserva ni reenviar inmediatamente asumiendo gratuidad. Consultar mecanismos de conciliación cuando estén documentados y disponibles; su endpoint no consta en el corpus. Si no pueden conciliarse, conservar incertidumbre y requerir política de reintento dentro del presupuesto.

Una clave idempotente local evita publicar dos análisis iguales, pero no demuestra deduplicación de cobros del proveedor. Definir un único dueño de reintentos: evitar que SDK, worker y Workflow multipliquen intentos. Errores de schema pueden consumir tokens; rechazo de contenido, respuesta truncada y cancelación también deben conservar telemetría.

## S06/S07: catálogo, evals y privacidad

**Pruebas propuestas, no ejecutadas.**

1. S06 guarda snapshot fechado del catálogo real y metadatos por candidato; rechaza un ID ausente, contexto insuficiente o endpoint sin parámetros requeridos. Probar caso en que un modelo está listado pero el endpoint compatible no está disponible. No usar nombres ejemplares del corpus como elección.
2. Conjunto etiquetado y reservado para evaluación: español/inglés, mensajes cortos/largos, nota interna, varias causas, sarcasmo, duplicado, PII, prompt injection y conversación sin causa suficiente. Registrar modelo/endpoint, prompt/schema, dataset y política por versión.
3. Medir clasificación útil por conversación y utilidad de clusters con denominadores distintos. El contexto propone >85% clasificación y >80% clusters útiles: son objetivos de validación, no resultados actuales. Medir también validez de evidencia, abstención adecuada, omisiones, latencia y costo conocido/incierto. Aceptación de evidencia: ninguna referencia inventada publicada.
4. S07 verifica filtros de privacidad por request y cuenta con datos sintéticos. Cuando no exista endpoint elegible, job bloqueado y cero relajaciones automáticas. Residencia debe demostrarse por documentación/configuración contractual aplicable; ZDR por sí solo no pasa esta prueba.
5. Inyectar timeout después del envío, `usage` ausente, precio ausente y JSON válido con cita falsa. Aceptación: gasto incierto visible, presupuesto no reutilizado indebidamente, resultado falso no publicado y reintento contabilizado.
6. Embeddings: verificar contrato, ID, dimensiones y política de datos; medir recuperación por tenant. Si no se cierra, bloquear esa etapa o usar agrupación manual/lexical identificada como limitación; no fabricar vectores ni afirmar similitud semántica probada.

Otro agente debe implementar primero validadores, mocks del gateway y ledger de presupuesto; después obtener cuentas, catálogo, condiciones y autorización de consumo. Ejecutar evals pagadas únicamente cuando ese acceso y presupuesto existan. La suscripción de construcción Codex no financia runtime OpenRouter.
