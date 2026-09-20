# F02-04 — propuesta de persistencia canónica; NO aceptada

Llamada F02 31 / global 175. Baseline Git leído: `38a8c503cf691413fde27d385a47ade53273843e`. No existe candidate_sha nuevo: no se modificó Git. Estado formal permanece 12/60. No gate externo, aceptación, promoción, nube ni despliegue realizados.

## API exacta

`import {persistCanonical} from './packages/ingestion/persistence/index.mjs'`

`await database.transaction('import', scope => persistCanonical(scope, {importId, record}))`

Scope es DatabaseScope de createDatabase, no tenant pasado por body. Import debe existir, tener conexión activa autorizada y estado queued/running/partial. No abre ni confirma transacciones propias. Una llamada procesa una fila; no hay límite de lote ni mapa de dedup en memoria. Devuelve `{status:'inserted'|'duplicate'|'conflict'|'rejected', code, canonical_id?}`. Un replay idéntico de la MISMA fila/import retorna su resultado original sin incrementar contadores. En OTRO import la misma revisión devuelve duplicate. Un fallo SQL se propaga y createDatabase revierte; no se convierte en rechazo ni ausencia.

Entradas:

- CSVRecord aceptado F02-01: verifica raw_payload/content_hash/row_hash/batch_hash/mapping_version y vuelve a aplicar adaptCSVRaw. Los campos message/money derivados del caller no son autoridad.
- `{envelope: SourceEnvelope, payload: objeto resuelto, row_ref: string|number, mapping_version: string}`. Verifica el hash del payload y source/account/connection/tenant contra imports+connections autorizados. Un SourceEnvelope solo, sin payload resuelto, queda rechazado PAYLOAD_REQUIRED: el módulo no inventa Storage ni realiza I/O remoto. El consumer05 deberá resolver payload_ref mediante Storage autorizado antes de llamar. Declaraciones en index.d.ts.

Payload estructurado implementado:

| entidad | contrato |
|---|---|
| customer | `{}`; no copia display_name ni crea identidad por email |
| product | `sku` string explícito |
| order | `amount_minor` string decimal entero no negativo hasta bigint SQL, o null; currency y exponent coherentes con parseMoney; amount_basis='gross'; customer_external_id/product_external_id opcionales |
| conversation | customer_external_id/order_external_id opcionales |
| message | text string, role customer/agent/internal, conversation_external_id obligatorio |

Cada referencia opcional puede fijar `<campo>_revision`; sin revisión se acepta solamente si existe exactamente UNA revisión. No se ordenan strings ni se elige la última. Todas las entidades recibidas requieren occurred_at explícito; unknown role se rechaza. Las referencias se resuelven dentro de tenant+connection. Customer/product/order/conversation/message usan versiones separadas; no se sobreescriben proyecciones anteriores. El contrato de orden usa amount_minor, no el amountMinor histórico del banco.

CSV sin customer_id/order_id/sku explícitos crea una conversación estructural identificada por conversation_id y revisión reservada csv-container-v1, con started_at null explícito; es un contenedor, no una fecha inferida ni evidencia comercial. CSV con esas relaciones queda CSV_STRUCTURED_CONTEXT_REQUIRED: falta contrato estructurado para validar las relaciones sin inferirlas. CSV money nunca crea orders/order_lines. Mensajes guardan text_ref/hash y ninguna copia de texto raw ni supuesto texto redactado.

## Identidad, atomicidad y cuarentena

UUID determinista SHA256 versionado por tenant/connection/source/account/entity/external_id/revision. La unicidad SQL arbitra entre procesos: INSERT ON CONFLICT DO NOTHING, seguido de lectura del ganador. No check-then-insert como garantía. SourceEnvelope fingerprint cubre hash del contenido, fecha, borrado, mapping y adaptación normalizada. Distinto contenido/contexto para misma identidad/revisión produce conflicto durable con FK al original y no lo modifica. Revisión distinta crea historia nueva sin asumir orden temporal.

Import se bloquea por fila para serializar contadores y replay de row_ref; imports distintos compiten por constraints de source_revisions. SAVEPOINT revierte únicamente rechazos de validación tipados, incluidos dominios auxiliares. import_rows, source_quarantine, dominio e imports counters se escriben en la misma transacción exterior. Una fila pendiente se consume si existe; en caso contrario aumenta total. No se marca import como completado: eso corresponde al consumidor con conteo final.

Evidencia raw se referencia mediante `import:<UUID>:row:<UUID>` y import_rows.row_ref; la resolución debe ir al objeto autorizado del import. No se guarda un URI arbitrario del payload que pueda contener secretos/PII. Quarantine conserva hash de la entrada, código, referencia de fila y referencia original si es conflicto de revisión. No retiene copia del cuerpo. La consulta directa al raw exige un resolver todavía no integrado.

## SQL y matriz externa — ampliar ANTES de promoción

Sólo migración nueva 0006_source_identity.sql; 0001–0005 intactas. Añade DOS tablas públicas, visibles en inventario:

- source_revisions: tenant/id/timestamps/provenance, unique de identidad+revisión, fingerprint, mapping_version; FK compuesta a connection y exactamente una FK tenant-aware al dominio canónico. FKs de dominio diferidas para reservar unicidad antes de proyectar.
- source_quarantine: tenant/id/timestamps/provenance, FK compuestas a imports/import_rows/source_revisions original, código y hash de evidencia.

Ambas FORCE RLS, sólo SELECT/INSERT para vexa_backend con tenant vigente y acción import owner/analyst en INSERT. Sin grants a browser/service_role y sin UPDATE/DELETE para backend. No SECURITY DEFINER nuevo, no esquema oculto. La matriz externa debe probar ambas tablas, tenant/roles/revocación, FK y borrados/retención antes de promoción. Los FKs restrictivos preservan historia; mantenimiento/borrado autorizado requieren diseño posterior, no se simulan aquí.

## Reutilización

Lectura del banco autorizado connected/packages/pipeline/IMPLEMENTATION.md e index.mjs (normalize/reference/ingest). Se reutilizó selectivamente el criterio de referencias no ambiguas y proyecciones canónicas; NO import del pipeline F06, NO copia de su DDL ni jobs/outbox. Reuso directo de createEnvelope/contentHash/identityKey/adaptCSVRaw de ingestion y createDatabase canónico.

Harness propio en supabase/tests/source-identity/run.mjs importa sql-pool.mjs y resourceBroker de soporte baseline READONLY. Copia únicamente isolated-infra.mjs a TMP sustituyendo imports absolutos y puertos Auth/Storage/Rest a 58010–58012. No DB publicada al host, Docker --pull never, recursos por UUID y journal0600. No deps instaladas, no npm config leída para instalaciones, no node_modules ni builds en candidato. Auth real local para operaciones principales; procesos de concurrencia usan IdentityPort sintético con IDs de fixture ya existentes y membership revalidada por DB real. No JWT fabricado de usuario.

## Evidencia y resultados

Comando de producto: `/tmp/vexa-xml-interop-renewed/node-v22.22.0-darwin-arm64/bin/node supabase/tests/source-identity/run.mjs`.

Ensayos conservados bajo supabase/tests/source-identity/evidence/:

- d6530b76… y d05ebfb8…: exit1 en concurrencia; constraint adicional de PK determinista no cubierto por target ON CONFLICT. Correctivo: resolver cualquier unique conflict y verificar el ganador por identidad. No cambios de oráculo para volver verde.
- 91d09b58…: exit0; nueve grupos, incluyendo dos procesos y 10000 filas aceptadas/contabilizadas, ninguna truncada.
- 4809a746…: exit1 en harness de prueba de permisos: faltó `;` en PL/pgSQL de h.probe. DIAGNOSTICO.md corrige atribución sin alterar result.json. No fallo del producto, caída de infra ni mutante muerto.

El ensayo final y hashes se referencian en RESULTADO.json junto a logs. sources.json registra SHA256 de implementación, declaraciones, SQL y harness antes de iniciar. Journals y cleanup.json verifican retirada por ID/owner. Fixtures son sintéticos, generados por el harness cuyo hash se conserva; no datos cliente. La salida observada incluye cinco entidades, dinero >2^53 exacto, replay/reorder, revisiones/conflicto original, dos tenants/hash/mapping, CSV, rollback, roles/revocación, tablas nuevas, dos procesos y 10K. No se llama gate a esta prueba del constructor.

Regresiones: `PYTHONDONTWRITEBYTECODE=1 npm test` exit0; `node22 --test packages/ingestion/*.test.mjs` exit0, 90/90. Logs conservados. No pruebas nuevas fuera de allowlist.

## Pendientes y límites

No hidratación autónoma de SourceEnvelope sin payload, Storage raw resolver productivo, enlaces CSV estructurados, redacción/IA, consumer05/checkpoints/fencing/cancelación, actualización de aliases, retención/tombstones, ni entidades distintas de las cinco declaradas (unsupported → quarantine). No promover como implementación completa del MVP o de ingesta extremo a extremo. Bare SourceEnvelope es rechazo explícito, no stub que devuelva éxito.

No prueba de SIGKILL real, fuzzing, carga sostenida/memoria, deadlocks bajo múltiples dependencias, build web/typecheck de declaraciones, gate externo independiente, revisión independiente, controlador, aceptación, nube ni producción. SQL constraints/RLS adicionales necesitan matriz externa ampliada. Hashes y evidencia son propuesta local; no reviewer externo designado.
