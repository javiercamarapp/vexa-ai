# FIX F0236 / global180 — propuesta no aceptada

HEAD leído y conservado: `da5406b89a48b94a65a6e43bbc981cf4d4e834cc`. Oficial13/60; no incrementado. Sin commit, Git mutation, push, accept, cloud, APIs pagadas, delegación ni envío. ADR redactado antes del código: [ADR-001.md](ADR-001.md). Contrato completo para Root/worker05/matriz: [INTERFACES.md](INTERFACES.md).

## Corrección y prueba observable

- `index.mjs:82`: ID lógico estable separado del ID de revisión. Una orden para varias revisiones, snapshots inmutables con importes exactos, relaciones protegidas por FK y raw hash/ref. Una revisión opaca nueva deja `REVISION_AMBIGUOUS`, cuarentena y amount_minor NULL en orden/línea; nunca SUM DISTINCT ni elegir último por texto/observed_at.
- `index.mjs:110/118`: historial recuperable y elección owner server-only, scope import verificado SQL, actor auth.uid, CAS con bloqueo transaccional y auditoría. Dos selecciones concurrentes: una selected, otra conflict. Nuevas revisiones invalidan elección; mismoRev/hash replay no suma ni recuenta; mismoRev distinto contenido conserva original.
- `index.mjs:19`: cinco entidades con snapshots, mensaje conserva message_revisions. Customer/product/conversation sin fecha legítimamente; mensajes nullable en006 y rol explícito. CSV resuelve customer/order/SKU por tenant+connection, valida relaciones y rechaza ambigüedad/mismatch. No órdenes por importe CSV.
- `index.mjs:204`: export para rechazos reales de normalización conserva código/campo/fila/hash sin falsificar envelope ni ocultar SQL. Prueba replay/contadores.
- SQL006 únicamente: tres tablas source, nuevas FK de historia/cabeza, snapshot, nullable messages.occurred_at e inmutabilidad message_revisions. 0001–0005 intactas.

## Comandos y recibos

Recibos nuevos: `supabase/tests/source-identity/evidence/f0236-75359f25-7f2c-4bce-b78b-13d6a8282013/`. Preserva stdout de ensayos fallidos y finales, SHA256 de cuatro archivos, snapshots fuente antes/después externos, recursos y cleanup. Ensayos previos en UUID originales permanecen. Configuración de prueba local sintética, journal0600, UUID propios, sin DB pública ni pull.

- `EXAM_NODE=/tmp/vexa-xml-interop-renewed/node-v22.22.0-darwin-arm64/bin/node VEXA_CANDIDATE="$PWD" EXAM_PORT_BASE=58019 python3 -B /Users/javiercamaraportepetit/vexa/.runtime/f02-specialists-1789923505171224000/canonical-gate/tests/acceptance/support/F02-canonical/run.py`: exit1,12pass/3fail (12 de13 casos de producto pasan; fallan importe automático, padre y GATE_INCOMPLETE). Node26 mismo comando sin EXAM_NODE, puerto58025: mismo resultado. Cleanup true ambos, snapshots antes/después iguales. Examen intacto.
- El rojo monetario final es `REVISION_NOT_ADDITIVE`: examen espera9007199254740994 escogiendo revisión2; se obtiene NULL deliberadamente por instrucción explícita de autoridad opaca. **LOGICAL_ORDER_SINGLE_PROJECTION pasa**, historia2, proyección1. No se hace verde escogiendo arbitrariamente.
- Examen externo `run.py F01-03.test.mjs`, puerto58031: exit1, tabla source_heads no clasificada. Matriz debe ampliar19FK nuevas respecto baseline5 y revisar nullabilidad/privilegios; no se modificó para omitir cobertura. No es aprobación de seguridad global.
- `node --test packages/ingestion/*.test.mjs`: exit0,90/90.
- `PYTHONDONTWRITEBYTECODE=1 npm test`: exit0.
- `PYTHONDONTWRITEBYTECODE=1 npm run test:controller`: exit0,117tests. Repos Git de prueba sólo temporales.
- `PYTHONDONTWRITEBYTECODE=1 npm run graph:check`: exit0. Registro local aislado pending no sustituye estado oficial13/60.
- `git diff --check`: exit0. Alcance de escritura preservado.

Primeros ensayos conservados: CSV timestamp equivalente Z/.000Z, referencia ambigua y carrera23505 se corrigieron; segundo propio pasó también10000filas. RLS no permitía el SELECT FOR UPDATE de conexión bajo import; se reemplazó por advisory xact scoped, conservando UNIQUE DB. Timestamp se canoniza para comparar identidad, sin cambiar raw/hash. La FK de SKU de mensaje se extrae del snapshot canónico de metadata.

## No cubierto / entrega pendiente externa

GATE_INCOMPLETE, revisión independiente y aceptación; matriz global nueva completa; UI/HTTP05 y conexión efectiva del consumer; retención tras revocar UPDATE/DELETE de message_revisions; producción/proveedores; throughput sostenido/deadlocks de múltiples conexiones por transacción; SIGKILL; corpus cliente. Proyección no monetaria ambigua no es autoridad y consumidores deben consultar source_heads. No se afirma SaaS terminado ni connection-ready global.

## Cierre de regresiones propias

`SOURCE_TEST_PORT=58110 <Node22> supabase/tests/source-identity/run.mjs` y Node26 puerto58113: exit0,16/16checks cada uno, incluyendo10000filas. Recibos55a58d1b-1d21-4090-a620-653588c9871f y b3ece02e-3a4e-4399-bd42-dea70bdadcfd. Estas dos corridas preceden únicamente la corrección de FK de SKU en metadata.

Repetición final tras esa corrección: `SOURCE_TEST_PORT=58116 /tmp/vexa-xml-interop-renewed/node-v22.22.0-darwin-arm64/bin/node supabase/tests/source-identity/run.mjs`: **exit0,16/16checks,10000filas**, recibo `e36db052-4791-465b-9342-3e8534d07941`. Hashes de los cuatro archivos ejecutados coinciden con archivos finales. Cleanup verified true en los tres ensayos; ningún proceso propio pendiente. Gate externo22/26 final también ejecutó esta corrección y conserva hashes before=after.

Los16checks incluyen concurrencia en dos procesos, reordered replay, nueva revisión/mismoRev conflict, CAS concurrente, owner/analyst y read-action, import viewer/operator/revocación, snapshots de cinco entidades, CSV conocido/mismatch, rollback por fallo dentro de persistencia, raw/hash/scopes, errores de normalización y contadores sin truncamiento. No sustituye los oráculos pendientes del autor externo.
