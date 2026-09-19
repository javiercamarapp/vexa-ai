# 02 · Supabase: datos, aislamiento y colas

## Decisiones y calidad de evidencia

Usar Postgres como autoridad de estados, identidad y resultados; Storage privado para archivos; Auth para usuarios; pgvector solo cuando se valide el proveedor de embeddings. Preferir Supabase Queues como candidato inicial del pipeline, condicionado a S03/S04. Son decisiones de diseño basadas en el [contexto](../../CONTEXTO-CANONICO.md), no infraestructura ya desplegada.

| Referencia | Qué respalda | Qué no demuestra |
|---|---|---|
| [Supabase Queues, repositorio oficial](https://github.com/supabase/supabase/blob/24e8333c54374b94645d77c2170c089c249a7173/apps/www/content/md/modules/queues.md), [fuente MD](../fuentes/supabase-queue.md), [JSON](../fuentes/supabase-queue.json) | Módulo durable basado en pgmq; entrega una vez dentro de ventana de visibilidad | Ejecución única de efectos, configuración del proyecto, worker activo o costo. |
| [Referencia pgmq](https://supabase.com/docs/guides/queues/pgmq), mismos archivos | Leer oculta temporalmente mensajes a otros consumidores | Firmas SQL/RPC completas o acceso concedido a roles VEXA. |
| [Catálogo RLS externo](https://tessl.io/registry/testland/row-level-security-postgres-reference), [supabase-rls.md](../fuentes/supabase-rls.md), [JSON](../fuentes/supabase-rls.json) | Describe RLS, `USING`, `WITH CHECK` y bypass del propietario | No es documentación oficial recuperada de Supabase/Postgres ni migración probada. No copiar su SQL como verificación. |
| [Guía MCP oficial fijada a commit](https://github.com/supabase/supabase/blob/24e8333c54374b94645d77c2170c089c249a7173/apps/docs/content/guides/ai-tools/mcp.mdx), [mcp-supabase.md](../fuentes/mcp-supabase.md), [JSON](../fuentes/mcp-supabase.json) | Aislar proyecto, lectura y grupos de herramientas al consultar producción | No concede acceso runtime ni certifica nuestras políticas RLS. |

La evidencia de RLS es insuficiente para prescribir firmas de funciones seguras o políticas ejecutables definitivas. S03 debe contrastar documentación primaria y probar roles reales; aquí se fijan invariantes internos verificables.

## Modelo lógico propuesto

Todas las entidades de negocio llevan `tenant_id`; usuarios globales se vinculan mediante membresías administradas por backend. No confiar en un tenant enviado por navegador. Una petición verifica usuario y membresía vigente antes de acceder a recursos.

| Grupo | Entidades y restricciones de diseño |
|---|---|
| Acceso | tenants, memberships, connections. Una conexión pertenece a un tenant; secretos solo del servidor, nunca en filas legibles por cliente. Registrar referencia a secreto y estado, no token en logs. |
| Ingestión | imports, sync_runs, source_objects, conversations, messages y asociaciones. Unicidad de identidad externa conforme al dossier 01. Checkpoints segregados por conexión/recurso. |
| Evidencias | Revisiones de mensajes, segmentos y extracción versionada. Cada evidencia resuelve una revisión concreta; si cambia o se borra, invalidar derivados afectados. |
| Análisis | analysis_runs, extracciones, clusters, membresías de cluster, revisiones humanas. Un reclustering produce versión nueva, no cambia silenciosamente IDs del informe previo. |
| Negocio | Productos/clientes/pedidos solo si hay datos; referencias nullable. financial_results conserva entradas, fórmula, moneda, versión y categoría observado/estimado/inferido. |
| Operación | jobs, attempts, checkpoints, outbox y cuarentena; audit_events sin cuerpos/secretos. Interventions registra responsable humano, decisión y estado declarado. |

Relaciones entre entidades tenant-scoped deben impedir cruzar tenants incluso con un ID existente: claves únicas y foráneas compuestas con `tenant_id` son la propuesta a verificar en S03. Un filtro en aplicación no reemplaza esa restricción. Índices candidatos: identidad externa, membresía `(tenant_id,user_id)`, mensajes por conversación/fecha, jobs por estado/próxima ejecución. Dimensionarlos con consultas reales; no prometer índices vectoriales antes de medir.

Money downstream: el LLM entrega categorías y evidencias, nunca montos calculados. SQL/TypeScript calcula usando importes decimales o unidades monetarias menores con escala explícita, moneda y reglas de redondeo versionadas. No sumar monedas distintas sin política de conversión y tasa fechada. Márgenes, costos o pedidos ausentes producen `null` y cobertura, no cero; no duplicar la misma pérdida por aparecer en varios problemas. Retorno estimado no es ingreso recuperado ni prueba causal.

## Fronteras de seguridad

- RLS en cada tabla expuesta, incluidas asociaciones, jobs visibles y agregados. Lectura y escritura prueban membresía; impedir cambiar `tenant_id` para mover filas. Clientes no administran su propia membresía ni elevan roles.
- Workers: privilegios mínimos sobre operaciones específicas. Si se usa un rol que evade RLS, la responsabilidad vuelve a consultas y funciones del servidor: no afirmar que RLS lo protege. Probar job/tenant/conexión juntos antes de cualquier lectura o escritura. `FORCE ROW LEVEL SECURITY` no debe interpretarse como solución universal para roles privilegiados.
- RPC, vistas y funciones: revisar rol efectivo, grants y comportamiento de seguridad; funciones privilegiadas requieren búsqueda de objetos controlada y argumentos validados. No exponer acceso genérico a SQL ni recepción pública de nombres de colas.
- Storage: bucket privado, ruta asociada al tenant y objeto registrado; URLs firmadas de vida limitada solo tras comprobar membresía. Prefijo de carpeta por sí solo no es autorización. Probar lectura directa y carga con ruta manipulada.
- Búsqueda vectorial y agregados filtran por tenant antes de devolver resultados. No confiar en ocultar filas después del top-k ni en cachés compartidas sin tenant, filtros y versión.
- Desconexión revoca credenciales y pausa nuevos jobs. Borrado de datos debe cubrir originales, derivados, embeddings, cachés y solicitudes en curso. Plazos de retención y backups son incertidumbres que el cliente debe resolver; no prometer borrado inmediato de backups.

## Semántica de cola y recuperación

La ventana de visibilidad no elimina reentregas después de expiración. Diseñar procesamiento al menos una vez con escritura idempotente. No se fija una firma de `pgmq.read`/archive ni wrapper RPC porque los extractos no bastan.

Secuencia propuesta:

1. Transacción crea import/run y outbox con clave idempotente. Un dispatcher reintentable publica la referencia al job. Si S04 demuestra enqueue en la misma transacción Postgres, simplificar a esa operación; evitar una doble escritura no recuperable.
2. Worker reclama un lote pequeño. Payload contiene IDs y versión, no cuerpos de conversación ni secretos. El job persistido determina tenant, conexión, etapa y política.
3. Registrar intento, lease y número de generación del reclamo. Una escritura final solo se admite si corresponde al reclamo vigente: el worker cuyo lease venció no sobreescribe al nuevo.
4. Procesar fuera de una transacción larga. Cada etapa escribe por clave `(tenant, entrada/revisión, etapa, versión de procesamiento)` para evitar resultados duplicados. Reanalizar con versión nueva es deliberado.
5. Persistir resultado/checkpoint antes de archivar o confirmar el mensaje. Fallo tras commit y antes de confirmación provoca reentrega inocua. Nunca confirmar antes de persistir.
6. Lease mayor al tiempo de lote medido con margen; comprobar renovación y límites en S04. Mientras no se pruebe renovación, acortar lote. Un lease no cancela una solicitud LLM que ya salió.
7. Reintentos acotados por clase de error, intentos y presupuesto. Entrada inválida va a cuarentena; credencial inválida pausa conexión; 429 difiere ejecución; timeout LLM genera costo incierto conforme al dossier 04. Cola de fallidos con motivo y reanudación humana versionada.

Propuesta de estados internos: `queued → running → succeeded`, `running → retry_wait/failed/blocked/cancelled`. Reclamaciones vencidas vuelven a ser elegibles. Cancelación marca intención y los workers la consultan antes del siguiente efecto; no promete deshacer consumo ya ocurrido. Los errores devueltos como valor por SDK deben inspeccionarse antes de cualquier avance de estado.

## Casos límite, aceptación y pasos para otro agente

**S03 seguridad, sin ejecutar:** crear tenants A/B, usuario solo A, usuario en ambos, usuario revocado y rol worker. Probar SELECT/INSERT/UPDATE/DELETE, asociaciones cruzadas, RPC, Storage, vector search y agregados. A no observa existencia, conteos, archivos ni evidencia de B; forjar `tenant_id` falla; retirar membresía revoca acceso según semántica verificada. La prueba incluye rol privilegiado para revelar bypass, no solo pruebas con usuario.

**S04 durabilidad, sin ejecutar:** provocar crash antes/después del commit y del ack, lease vencido con dos workers, enqueue duplicado y error de persistencia retornado como valor. Criterios: cero pérdidas de jobs aceptados, un resultado vigente por clave y versión, ningún avance falso, eventual salida o fallo visible, ninguna mezcla de tenants. Un resultado único no demuestra un único cobro externo.

Pasos: diseñar migraciones y fixtures; validar políticas/roles con documentación primaria cuando se permita red; verificar extensión y grants; implementar transacción/outbox; probar fallos; medir latencia de cola, jobs atascados, tamaño de índices y costo. Acceso a Supabase, extensión instalada, región, backup, retención, scheduler y presupuesto siguen sin probarse.
