# 03 · Arquitectura y contratos de implementación

**Especificación normativa propuesta para construir, no inventario de tablas/endpoints existentes.** Precedencia: requisito explícito del usuario → contexto canónico → contratos financieros/seguridad → este detalle → ficha → código comprobado. Una contradicción se registra y resuelve en control-plane; no se arregla cambiando tests dentro del candidato.

## ADR-01 · Una aplicación, módulos de dominio

npm workspaces; Next.js App Router TypeScript en `apps/web`, módulos en `packages/{platform,ingestion,jobs,connectors,gateway,intelligence,problems,economics,metrics,recommendations,interventions,briefs}`. Supabase Auth/Postgres/Storage; pgvector con modelo/dim/version. APIs de la app llaman servicios de dominio; esos servicios llaman puertos `Clock`, `IdGenerator`, `SourceTransport`, `ModelTransport`, `Repository`. Interfaces inyectables para probar errores sin cambiar producción.

No crear ocho microservicios, MCP server obligatorio ni agentes de negocio autónomos. OpenRouter es transporte del producto; Codex OAuth sólo construcción. Dinero permanece en kernel determinista existente. La capa HTTP/UI no contiene una segunda fórmula monetaria.

## ADR-02 · Trabajo durable antes que framework de workflow

**Base seleccionada para implementación local:** tablas outbox/jobs/checkpoints en Postgres, consumidor separado del request de carga, transacciones/fencing e idempotencia. Se puede demostrar localmente sin comprar otro servicio.

**Transporte alojado pendiente de spike F02-05/06:** evaluar Supabase Queues y activación por Vercel de chunks cortos; no sumar Vercel Workflow además por defecto. Para elegir, ejecutar el mismo fixture con crash después del commit, lease expirado, reintento, backlog y consumidor apagado. Registrar límites efectivos del plan y latencia bajo carga. Si el consumidor no progresa dentro del presupuesto objetivo, bloquear preview hasta escoger/autorizar runtime durable adecuado. La guía no afirma que un cron de un minuto cumpla cualquier SLA.

El transporte puede variar sin cambiar contrato de efectos/checkpoints. Procesamiento at-least-once: no prometer exactly-once extremo a extremo por una descripción comercial de cola.

## ADR-03 · Esquema, identidad y permisos

IDs internos UUID; IDs remotos string. Toda entidad privada tiene `tenant_id uuid NOT NULL`, `id`, timestamps y procedencia. Unique `(tenant_id,id)` habilita FK compuesta. Registros globales sólo para catálogos públicos. ON DELETE explícito: no anular tenant_id con un SET NULL general.

| Grupo / tablas | Columnas esenciales además de tenant/id | Índices/reglas críticas |
|---|---|---|
| organizations, memberships | memberships: user_id,role,status,permissions_version | unique tenant/user; consulta membership vigente |
| connections | source,account_id,status,credential_ref,watermark,last_success | unique tenant/source/account; nunca token en JSON cliente |
| external_aliases | source/account/entity/external_id,canonical_id,evidence_ref,approved_by,version | unique identidad por versión; mismo tenant en ambos lados |
| imports/import_rows | file_hash,mapping_version,state,total/accepted/rejected/duplicates/pending; row_ref/error | unique tenant/idempotency_key; suma de contadores |
| customers/products/orders/order_lines | external refs, customer_id?,SKU?,amount_minor?,currency,exponent,occurred_at | FK tenant-aware; moneda y exponente no implícitos |
| conversations/messages/message_revisions | source identity,revision,role,text_ref,hash,occurred_at,deleted_at | unique tenant/connection/entity/external_id/revision |
| jobs/attempts/checkpoints/outbox/dead_letters | state,input_ref,lease_until,fencing_token,next_attempt_at,deadline,checkpoint | tenant/type/input_hash/version unique; index state/next_attempt |
| extraction_runs/issues/evidence_spans | model/prompt/schema hash,status,usage; message_revision_id,start,end,quote_hash | ownership y revisión, offsets code points |
| embeddings/problems/problem_versions/problem_conversations | model/dim/version; stable problem_id,severity,cause_status,members | retrieval tenant-filtered; split/merge auditados |
| economic_events/reversals/cost_rates/assumptions | kind,status,amount_minor,currency,effective_at,source_ref,reversal_of | dedup de evento; reversal misma moneda/original |
| metric_snapshots/components/attributions | scope_hash,input_hash,policy_version,watermark,status,bundle_ref | publicar atómicamente; snapshot publicado inmutable |
| recommendations/interventions/measurement_plans/weekly_briefs | evidence_refs,owner,status,baseline_ref,measurement_ref,version | optimistic concurrency + idempotency; acciones humanas |
| audit_events/tombstones | actor,action,resource,reason,trace_id; deleted_source_key | no PII cruda; restore/reingesta respetan borrados |

**Secuencia SQL prevista:** 0001 identidad, 0002 fuentes, 0003 ejecución, 0004 evidencia/dinero; 0005+ extensiones por ficha. Estos números no están reservados globalmente: antes de escribir, listar migraciones actuales y asignar siguiente libre. No reutilizar un número aplicado. Cada archivo debe poder aplicarse en una DB local vacía en orden y la suite debe detectar FK/RLS/uniqueness incorrectas.

### Matriz RBAC

| Acción | owner | analyst | operator | viewer |
|---|---|---|---|---|
| Leer snapshots/evidencia/export autorizado | sí | sí | sí | sí |
| Importar/configurar mapping | sí | sí | no | no |
| Conectar fuente/cambiar política/miembros | sí | no | no | no |
| Proponer recomendación/intervención | sí | sí | sí | no |
| Aprobar intervención/política | sí | no | no | no |
| Registrar ejecución/medición asignada | sí | no | sí | no |
| Borrado/retención/costos | sí, con confirmación | no | no | no |

`admin` histórico significa owner, no rol nuevo. El tenant se deriva de identidad + membership vigente; selector de org sólo escoge entre memberships, jamás concede uno. Sesión autenticada sin membership no accede. RLS/Storage/RPC no dependen del sidebar. Acceso cross-tenant devuelve404 en recursos privados; identidad ausente401, rol insuficiente403; conflicto de estado409.

## ADR-04 · API del producto (a implementar)

Prefijo `/api`; `contract_version` en respuestas. JSON uniforme: `{data,meta:{trace_id,snapshot_id?,scope_hash?,coverage?,state}}`; errores `{error:{code,message,retryable},meta:{trace_id}}`, sin stack/token/PII. No devolver200conarrayvacío ante DB caída; usar503 y UI error/stale.

| Método/ruta | Input / efecto | Rechazos obligatorios |
|---|---|---|
| POST /api/imports | file metadata + idempotency key; reserva import/upload scoped | rol, tipo, bytes, cuota |
| POST /api/imports/:id/confirm | objeto/hash/mapping_version; transacción import+outbox | objeto ajeno, token expirado, hash distinto |
| GET /api/imports/:id | preview/mapping/row errors y contadores | tenant ajeno404 |
| GET /api/jobs/:id | queued/running/partial/succeeded/failed/cancelled | no éxito por202 |
| POST /api/jobs/:id/cancel | solicita cancelación idempotente | rol/estado inválido |
| GET /api/metrics | scope validado, mismo bundle que UI | fechas/moneda/basis inválidos400 |
| GET /api/problems y /:id | paginación estable; cifra→eventos→citas | cursor de otro scope, revisión no autorizada |
| GET /api/customers/:id | historial por identidad conocida | null no crea cliente ficticio |
| GET /api/connections | health/cobertura/reconnect | no credenciales en respuesta |
| POST /api/recommendations/:id/interventions | draft + idempotency key | viewer403, evidencia faltante |
| POST /api/interventions/:id/transition | expected_version,target,reason,measurement_ref | transición/versión inválida409 |
| POST /api/briefs | snapshot/scope/version | cifras no respaldadas, scope mismatch |
| POST /api/exports | snapshot/scope, formato | parcial sin modo explícito |
| GET /api/exports/:id/download | acceso revalidado; descarga scoped | membership revocada, expiración |
| POST /api/explorer/query | pregunta + scope; tools read-only | SQL libre, herramienta no allowlisted |
| GET /api/health/version | SHA/config hash no secretos | no estado sensible de todos los tenants |

Las rutas de login/callback dependen de la integración SSR documentada de la versión elegida. No inventar tokens válidos con un JSON base64 en tests; usar Auth real local para probar sesión.

### Scope y dinero: ejemplos exactos

```json
{"date_start":"2026-09-01T00:00:00Z","date_end":"2026-10-01T00:00:00Z","timezone":"UTC","date_basis":"occurred_at","currency":"USD","basis":"net","sku":[],"source":[],"snapshot_id":"synthetic-S1"}
```

`tenant_id` se añade en servidor desde sesión. El `scope_hash` de datos se calcula sobre serialización canónica de snapshot base, su hash, filtros y versiones de clasificación capturadas; no confía en el hash enviado por browser y no depende del lector. Una vista derivada identifica por separado `base_snapshot_id`, `base_scope_hash` y su manifiesto inmutable de clasificación. El cursor usa además `cursor_auth_hash`, ligado al usuario, rol y versión vigente de permisos; no se reutiliza entre lectores o recursos. Exportar vuelve a validar acceso actual a todas las referencias. Cambiar filtros o clasificación puede crear otra vista explícita, pero nunca modifica la vista histórica fijada por snapshot y hash. Agregados sobre TODA la población autorizada del snapshot, no sobre la primera página. En el ledger actual la fecha soportada es `occurred_at` (fecha efectiva del registro económico, UTC); otras bases requieren procedencia implementada y no se sustituyen silenciosamente.

```json
{"metric":"revenue_exposure","amount_minor":"30000","currency":"USD","exponent":2,"kind":"observed-order-exposure-not-loss","additive_across_problems":false,"order_ids":["O1","O2"],"scope_hash":"calculado-no-literal","snapshot_id":"synthetic-S1"}
```

Si falta O3.amount: total todas órdenes=null, known_subtotal=30000, known_count=2,total_count=3,partial. P1=30000 y P2=10000 NO hacen40000 global. Refund neto=1500; replacement=1200 observado; soporte=500 modelado. No se suman como «VEXA recuperó3200». USD/MXN separados salvo FX aprobado/versionado. Fuente financiera es ledger/orden, no frase del ticket.

## ADR-05 · IA con citas, abstención y costo

`extract(redactedMessages,taxonomy,policy)` devuelve issue/sentiment/intent/urgency/entities/evidence/abstention. No importes contables libres. Cada evidence_span referencia message_revision autorizada y offsets en **Unicode code points** sobre texto redactado versionado. Emoji no debe partirse como bytes/UTF16 indistintamente. Nota interna no se etiqueta como voz del cliente.

Gateway reserva antes de red, concilia usage y conserva reserva uncertain ante timeout. Fallback debe satisfacer mismos requisitos de proveedor/retención/residencia. No endpoint elegible → policy_blocked. `data_collection:deny` no prueba ZDR. El mock sólo verifica manejo del contrato; precisión requiere gold humano temporal y WTP requiere entrevistas.

## ADR-06 · Ocho vistas, no ocho nombres vacíos

Overview, Problems, Problem detail, Recommendations, Explorer, Customer, Interventions, Brief. Las fichas F06-01 y F06-02 cubren dos rutas cada una; las restantes cubren acciones, export y accesibilidad. Cada vista debe probar loading/empty/error/partial/stale/ready; UI/API/export comparten snapshot. Las aserciones exactas están en `docs/blueprint/calidad/04-aceptacion-end-to-end.md` y fixture SYN-E2E-v1.

## ADR-07 · Intervención y causalidad

Draft→approved(owner)→active(owner/operator asignado)→measuring→closed; cancelled con razón/auditoría. Baseline/hipótesis/unidad/población/fechas/plan se fijan antes de ejecutar. Cierre sin medición409. Antes/después es asociación, no ahorro causal; cambios de temporada, cobertura, mix de clientes y migración deben tratarse. Ninguna transición modifica CRM o emite un refund por sí sola.

### Detalle F06-02: identidad y procedencia histórica

El detalle conserva el snapshot y scope_hash financiero de F06-01. Un detail_hash adicional fija las versiones de asociación entre customer_key financiero y customers.id canónico, y las revisiones de conversación capturadas. detail_as_of identifica la vista de identidad, separado de as_of financiero; una asociación posterior no se presenta como existente al corte económico. Abrir una nueva vista de identidad crea una identidad explícita nueva; una vista fijada nunca consulta vínculos actuales como fallback ni cambia sus importes.

Los vínculos requieren evidencia, aprobación owner, CAS e historial con FK de tenant; no se crean clientes por hash o igualdad casual de texto. Conversaciones del mismo problema no se atribuyen a un cliente sin identidad histórica verificable. Los drilldowns reautorizan cada componente/evento/evidencia; sólo los registros financieros autorizados y sus versiones de fuente justifican dinero. Citas conversacionales y causalidad actual son contexto separado, con estado y cobertura explícitos.

## ADR-F06-03 · recomendaciones condicionadas y borradores persistidos

La recomendación fija publicación, alcance, versión del problema y referencias de evidencia autorizadas; una propuesta generada por reglas explícitas se etiqueta como tal. Acción, precondiciones, justificación, responsable y estado se revisan con versión esperada e historial inmutable. No se publica sin evidencia o condiciones ni se atribuyen ahorros a una explicación generada. La consulta y cada cambio revalidan permisos y procedencia vigentes. Una versión obsoleta no se convierte silenciosamente en una propuesta actual.

El borrador de intervención conserva versión de recomendación y baseline con idempotencia vinculada a la solicitud. Doble clic y reintento no ejecutan herramientas ni producen intervenciones duplicadas. La aprobación, activación y medición corresponden a F06-05; crear un borrador no las acredita. Se reutilizan las tablas canónicas, extendidas por0025 y un historial de versiones, sin importar migraciones del laboratorio antiguo.

### F06-04 — Explorer de consulta y evidencia

Explorer requiere un snapshot y alcance publicados y previamente vinculados. Las herramientas `search_problems`, `read_metrics` y `get_evidence` tienen esquemas cerrados, identidad/tenant derivados del servidor y transacciones sólo de lectura; no aceptan SQL ni herramientas de escritura. La resolución del alcance por el workspace permanece separada de la ejecución de herramientas. La paginación conserva filtros, orden estable e identificador, liga el cursor a autorización y alcance y no trunca silenciosamente en cien resultados.

La consulta ejecutiva interpreta de forma determinística preguntas soportadas de reembolsos, órdenes y exposición, devuelve cifras exactas y referencias autorizadas del mismo corte y declara esa modalidad. Un alcance o medida ambiguos requieren aclaración. Un único corte no prueba una tendencia ni una causa; el servicio se abstiene de tales afirmaciones y de preguntas fuera de su alcance. No promete que una clave habilite un modelo no implementado ni realiza inferencia pagada. Revocación vigente, cursores ajenos y parámetros fuera de esquema fallan cerrados.

## ADR-F06-05 · intervención, plan fijado y medición descriptiva

El snapshot que justificó la recomendación permanece como contexto. El plan puede seleccionar otra publicación autorizada como referencia de medición, con los mismos filtros, moneda, base, versión de método y población compatible. Ambos cortes se muestran por separado. La aprobación del propietario fija hipótesis, referencia y hash, unidad, población, resultado, control, madurez, fechas y cambios concurrentes antes de la ejecución. Cambiar la referencia después de aprobar no es una revisión válida.

Las transiciones usan versión esperada e idempotencia vinculada al contenido, con eventos inmutables. Aprobar y cancelar corresponde al propietario; registrar ejecución o medición requiere propietario u operador asignado vigente. Reasignar requiere propietario actual y razón: cambia el responsable operativo conservando el responsable original del plan, su aprobación y todo el historial. Un actor histórico que pierde su membresía no invalida por sí mismo la auditoría; la revocación de fuentes o evidencias financieras sí bloquea su uso actual. Ninguna transición ejecuta cambios en CRM ni reembolsos.

Medir recibe una referencia a un corte posterior; los importes y denominadores se derivan de componentes canónicos autorizados y del mismo alcance, nunca de montos enviados por el navegador. El corte posterior comienza después del fin real, conserva ventanas y método compatibles, y declara madurez y cobertura. Una comparación incompleta conserva importes desconocidos y subtotal conocido y permanece pendiente; cerrar exige un resultado completo vigente. El resultado describe asociación antes/después, no ahorro causal ni beneficios sumables entre intervenciones.

El propietario puede reabrir una medición cerrada con razón, nueva versión e idempotencia. La reapertura conserva plan, expectativas y resultados anteriores y exige una nueva medición antes de cerrar otra vez. Una cancelación no se convierte en ejecución ni revierte automáticamente acciones externas.


## ADR-F06-06 — Briefs ejecutivos versionados y exportación autorizada

Un brief captura una publicación, su alcance y las versiones de las fuentes, evidencia, recomendaciones e intervenciones usadas. El contenido es inmutable; una regeneración con las mismas entradas reutiliza el mismo documento y hash. Cambiar una entrada crea una versión nueva mediante CAS e idempotencia ligada al contenido. El orden, la fecha de lectura y el usuario lector no alteran las cifras capturadas. Un fallo de generación conserva visible sólo la última versión verificada, señalando que la nueva no se confirmó.

Las cifras proceden del motor financiero del alcance, con moneda, base, periodo, cobertura, minor units exactos, null y subtotal conocido. Las filas por problema no se suman para recrear el global. El top3 usa prioridad publicada vigente cuando existe; el orden alternativo por evidencia queda rotulado sin presentarse como probabilidad o riesgo calibrado. El carril crítico se presenta por separado. Cada cita y enlace conserva el alcance y la referencia capturada.

La comparación es explícita mediante una publicación previa autorizada y su consulta fijada. Moneda, base, filtros y definiciones deben coincidir; duración, orden temporal, método y cobertura determinan comparabilidad. Si es válida, muestra la diferencia observada entre importes actuales y anteriores, calculada exactamente y con null cuando no se puede estimar. Si falta o no es comparable, conserva el motivo. No se atribuyen ahorro causal, ingresos recuperados ni pronósticos sin evidencia aprobada.

El servidor deriva identidad y tenant. Owner y analyst generan; los miembros vigentes sólo leen documentos cuyas referencias siguen autorizadas. Lectura histórica, repetición de una petición y descarga revalidan fuentes y contribuyentes financieros de ambos periodos. Revocar permisos o retirar fuentes impide recuperar la copia persistida; una URL antigua no es un permiso. Los datos no se ofrecen mediante enlaces públicos permanentes.

La exportación JSON conserva el documento y sus hashes; el HTML legible escapa todo contenido, se descarga como adjunto y aplica política restrictiva. La respuesta es privada, sin caché compartida. Generar o descargar un brief no envía correo, ejecuta cambios de CRM ni inicia inferencia pagada. Los oráculos de aceptación comprueban UI/API/export equivalentes, concurrencia, histórico comparable, dinero exacto, aislamiento, revocación tras generar y ausencia de efectos externos.


## ADR-F06-08 — Centro de notificaciones y preferencias propias

El centro de notificaciones deriva tenant y usuario de la sesión vigente. Sólo destinatarios VEXA con membership activa acceden a su bandeja y preferencias; clientes o contactos importados desde CRM no constituyen destinatarios. El acceso directo desde REST de navegador a las tablas está cerrado y RLS permanece forzada. Todos los roles activos pueden cambiar únicamente sus preferencias y estado de lectura mediante la acción notify; ésta no habilita escritura financiera, jobs, conexiones, emisores ni destinatarios.

La bandeja ordena por fecha y UUID descendentes y pagina después de comprobar autorización actual del recurso. El cursor está vinculado a tenant, usuario, rol, versión de permisos, filtro y tamaño. La lectura de un aviso es idempotente y conserva su primera fecha. Recurso retirado o aviso ajeno devuelve404; una membership revocada devuelve403. Los links internos se construyen en servidor con el alcance y referencia correspondientes. Consultar un aviso no concede acceso permanente al recurso.

Preferencias por canal y evento usan enabled:false/version:0 si no existe fila. Una escritura recibe expectedVersion y devuelve409 ante conflicto; el navegador vuelve a consultar el valor persistido antes de anunciar éxito. Un fallo de transporte no significa rechazo de la transacción ni ausencia de avisos. La UI borra contenido que no pudo verificar y descarta respuestas tardías tras navegación o cambio de acceso.

El catálogo distingue emisores conectados y canales disponibles. F06-08 no conecta emisores de negocio, envíos email, suscripciones push ni outbox: esas tareas siguen en F06-09..12. Guardar una preferencia no declara un envío ni un permiso del navegador. Las invitaciones exigen el flujo explícito de owner y destinatario reservado; no se insertan como avisos para personas sin membership activa. Los eventos sintéticos de las pruebas entran por SQL de propietario, con todas las guardas activas; no equivalen a un emisor productivo.
