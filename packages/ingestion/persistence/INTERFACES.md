# Contrato para Root, matriz SQL y worker05 — F0236

Propuesta, no aceptada. ADR-001 precede la implementación. Todo acceso mediante `createDatabase`, login backend sin bypass/superusuario. No actor/tenant de body. No hay dependencia nueva ni SQL SECURITY DEFINER.

| API exportada | Transacción | Resultado / responsabilidad de 05 |
|---|---|---|
| `persistCanonical(scope,{importId,record})` | `import`, owner/analyst | inserted, duplicate, conflict, rejected. `REVISION_AMBIGUOUS` conserva la revisión y registra cuarentena; no significa que se perdió el historial. Replay misma fila no recuenta. SQL falla la transacción, nunca ausencia. |
| `readCanonicalHistory(scope,{canonicalId})` | `read`, membership vigente | null sólo si no existe visible; `{head,revisions}` con IDs de revisión, snapshots, hashes/ref. `head.version` es token CAS; `state=ambiguous` exige resolución. Orden por UUID sólo paginación de lectura, no autoridad temporal. |
| `selectCanonicalRevision(scope,{canonicalId,revisionId,expectedVersion,reason})` | `import`, owner SQL vigente | selected + nueva version, o `SELECTION_CAS_CONFLICT`. Owner y acción verificados contra SQL, `auth.uid()` debe coincidir con scope.userId. No actor aceptado del caller. Motivo requerido; auditoría atómica. UI debe refrescar historial tras conflicto, no reintentar ciegamente. |
| `persistNormalizationRejection(scope,{importId,error,rowRef,rawHash,batchHash,mappingVersion})` | `import` | Consume **rechazo real** del parser `{code,field}` y fila numérica; preserva code/field/row_ref/raw_hash sin raw ni PII. Valida mapping/hash de archivo, autorización y estado del import. No fabricar errores ni envolver excepciones SQL con este adaptador. |

Worker05 debe llamar APIs dentro de su transacción/checkpoint existente. No necesita implementar selección, dedup, snapshots, contadores ni SQL adicional. Integración HTTP/UI y consumer son trabajo fuera de esta allowlist; no se afirma que esos callers estén ya conectados. Los errores de autorización se traducen por Database a403; CAS es resultado explícito. Otras validaciones lanzadas siguen la traducción sanitizada del Database actual.

Un ID lógico por tenant/conexión/source/account/entidad/external_id; IDs de revisión separados. Nunca ordenar source_revision. Nueva revisión invalida cualquier elección anterior, incrementa CAS y deja money null en orders/order_lines. Seleccionar aplica exactamente snapshot, incluyendo retirar relación de línea anterior. Historia append-only. `message_revisions` tiene una fila por versión, sin crear conversación adicional. Proyección no monetaria ambigua conserva campos previos como caché: consumidores deben consultar `source_heads.state`, no presentarlos como resolución autorizada.

CSV: customer_id/order_id son **IDs externos**, SKU se busca en products dentro del mismo tenant+connection. Referencias ausentes, ambiguas o inconsistentes van a cuarentena. SKU se conserva en metadata de mensaje y FK de revisión; order/customer en conversación. Un importe CSV nunca crea orden. Un container CSV existente con contexto diferente se rechaza, no se sobreescribe ni se inventa relación. No inferimos rol ni fecha.

## Delta de SQL006 para el autor externo de matriz

0001–0005 intactas. La matriz anterior **no cubre este esquema**; su rechazo de tabla nueva se conserva.

- `source_revisions`: select/insert backend, sin UPDATE/DELETE ni browser; RLS enabled+forced. UNIQUE identidad por revisión, UNIQUE(tenant,id), UNIQUE(tenant,canonical_id,id). Snapshot JSON array inmutable con valores canónicos y relaciones, hash/raw ref originales. FK organización + conexión + cinco proyecciones ya existentes. Cinco FK nuevas: `(tenant,related_customer_id)→customers`, related_product_id→products, related_order_id→orders, related_conversation_id→conversations, message_revision_id→message_revisions. Todas restrict; orden/message_revision diferidas para inserción atómica. Mantiene CHECK de exactamente una proyección del tipo correcto.
- `source_quarantine`: sin cambios de privilegios; FK organización/import/import_row/original_revision. Rechazos de ambigüedad apuntan a revisión retenida.
- `source_heads` NUEVA: organización, conexión y FK triple `(tenant,id,selected_revision_id)→source_revisions(tenant,canonical_id,id)`; no permite seleccionar revisión de otra identidad/tenant. UNIQUE identidad lógica, version>0, estado unique/ambiguous/selected; selected_revision null iff ambiguous. Backend select/insert/update, sin delete/browser; acción import en DML, membership en lectura, RLS enabled+forced, tenant inmutable.
- `messages.occurred_at` ahora nullable; rol continúa obligatorio customer/agent/internal. customers/products/conversations admiten nulos legítimos sin tiempo inventado; orders conserva fecha obligatoria para contexto monetario.
- `message_revisions`: se revoca UPDATE/DELETE backend para preservar historia canónica. Su INSERT/SELECT y las FK existentes se conservan. Esta restricción también requiere regresión externa de retención.
- `audit_events` existente: selección añade actor SQL, razón, canonical_id, revision_id, revisión anterior y expected_version. No tabla de auditoría duplicada.

Total de FK nuevas respecto de0001–0005:19 (11 de006 previo +5 de historia +3 de heads). Todas requieren oráculos negativos por matriz externa; los snapshots JSON no reemplazan las FK. No se modificó esa matriz para omitirlas.

Limitación de rendimiento deliberada: bloqueo advisory transaccional por tenant/conexión serializa escritura de esa conexión; UNIQUE DB sigue siendo defensa de integridad. No se acreditan throughput ni deadlocks de lotes multiconexión. Caller procesa una conexión por transacción.
