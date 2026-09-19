# Contratos entre módulos y modelo de datos

Diseño propuesto; no afirmar que las tablas existen. Todos los IDs opacos, tenant derivado de sesión/credencial validada, nunca confiado desde body del usuario.

## Contrato de ingesta
`SourceEnvelope { tenant_id, connection_id, source, source_account_id, entity_type, external_id, source_revision, occurred_at, observed_at, content_hash, payload_ref, deleted_at? }`.
Unicidad externa `(tenant_id, connection_id, entity_type, external_id, source_revision)`. Una misma revisión repetida no genera otra conversación/evento. Revisión nueva actualiza estado mediante historial, no suma dinero. CSV tiene batch hash y row hash, pero duplicado semántico entre archivos requiere identidad real; no deduplicar sólo por texto.

`CanonicalConversation { id, tenant_id, channel, customer_id?, order_id?, started_at, updated_at, language?, source_refs[], messages[] }`. Mensajes preservan rol customer/agent/internal, timestamp, texto normalizado, referencia original y redacción aplicada. Evitar que nota interna se presente como cita del cliente. HTML se normaliza sin ejecutar. Adjuntos inicialmente metadata, no descargar URLs arbitrarias. SKU/customer desconocidos null y cobertura visible.

## Esquema relacional por grupos
- Identidad: organizations, memberships(user_id, org_id, role), connections, external_aliases. Roles canónicos MVP owner/analyst/operator/viewer; la etiqueta «admin» usada en el dossier de seguridad es alias de owner, no un quinto rol. Plataforma soporte excepcional auditable, no query global por defecto.
- Fuentes: imports, import_rows, conversations, messages, message_revisions, customers, products, orders, order_lines. IDs remotos strings, importes minor units, monedas ISO y timestamps UTC.
- Evidencia: extraction_runs(model/prompt/schema/hash/status/usage), issues_extracted, evidence_spans(message_revision_id,start,end,quote_hash), embeddings(model_id,dim,version,tenant), problems, problem_versions, problem_conversations.
- Dinero: economic_events(kind/status/amount/currency/order/evidence), reversals, cost_rates, assumptions, metric_snapshots, metric_components, attributions.
- Ejecución: jobs, attempts, checkpoints, outbox, dead_letters, audit_events.
- Acción: recommendations, recommendation_versions, interventions, intervention_events, measurement_plans, weekly_briefs.

FK a entidades del tenant siempre verifica `(tenant_id, id)`. Scope global sólo para catálogos realmente públicos, no productos específicos del cliente. ON DELETE debe respetar retención y cascadas explícitas; no perder evidencia de consentimiento al eliminar un mensaje. RLS de Storage y vector search se prueba separadamente de las tablas.

## Interfaces del pipeline
1. `normalize(envelope, mappingVersion)` → accepted record o rejection(reason, field, row_ref). Nunca catch vacío.
2. `extract(redactedMessages, taxonomyVersion, modelPolicy)` → issues con categoría/severidad/citas/abstención. Schema no acepta importes financieros libres.
3. `validateEvidence(extraction, inputRevisions)` → exact-match spans autorizados o rechazo.
4. `assignProblems(extractions, problemCatalogVersion)` → memberships y candidatos nuevos. Los IDs sobreviven nuevos lotes; split/merge son eventos versionados.
5. `calculate(snapshot, scope, policyVersion)` → bundles del contrato `calidad/01...`. Función pura, sin LLM.
6. `recommend(problem, financialBundle, evidence)` → acción + precondiciones + rationale + refs; no proveedor/lote/carrier inventado.
7. `publishSnapshot(runId)` → visibilidad atómica con cobertura. Failure no borra último snapshot bueno.

## Jobs e idempotencia
Payload sólo referencias y tenant validado. Reclamación lease + fencing token; at-least-once asumido aunque documentación de cola describa garantías dentro de visibility window. Commit efectos/checkpoint antes de ack. Reintentar ante crash no publica dos veces. Máximo de intentos y deadline; 401/403 requiere reparar acceso, no más gasto. Backoff respetando Retry-After. Costo ambiguo de inferencia no se liquida gratis.

## Consultas del producto
Todas usan `{tenant, snapshot_id, scope_hash, date_range, timezone, filters, cursor}`. La definición de fecha cambia por métrica: conversation occurred, order date o refund settlement; rótulo debe decirlo. Agregados SQL por cohortes, no límite PostgREST silencioso. Filtros SKU multivalor no multiplican órdenes al hacer join. Búsqueda semántica filtra tenant antes de exponer resultados y metadata.

## Exportación y cache
Export server-side autorizado, job durable para grande, URL firmada breve, nombres sin PII, valores que empiezan por =/+/-/@ protegidos contra fórmulas CSV. Cache key incluye tenant, rol/scope, filtros, snapshot y versión de método. Revocación de acceso invalida acceso futuro, incluyendo polling/download; no basta borrar menú.

## Caso de migración
HubSpot ticket A y Zendesk ticket B pueden referirse al mismo caso. Con alias aprobado ambos apuntan a conversación canónica C; mensajes preservan su fuente. No inferir identidad cliente por email anonimizado marketplace. Comparación antes/después de migración controla diferencia de cobertura de canales y duplicación de históricos; de lo contrario se muestra «no comparable».

## Índices y escala
Índices esperados `(tenant_id, occurred_at, id)`, `(tenant_id, status, next_attempt_at)`, external unique keys, FK indexes y problemas por snapshot. Particionado se evalúa con explain/volumen, no obligatorio día 1. Leer 10K, 50K y 150K conversaciones sintéticas como cargas distintas; las metas PRD hasta 500K/mes no están probadas por procesar un CSV pequeño.
