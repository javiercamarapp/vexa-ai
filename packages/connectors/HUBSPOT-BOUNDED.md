# HubSpot: ejecución acotada y checkpoint v2

El factory usado por el runtime activa `bounded:true`. El recorrido legacy permanece disponible para el spike explícito; el runtime no puede desactivar el modo acotado mediante credenciales. No cambian scopes, allowlists, origen, filtros históricos, scheduler, deadline de 15s ni lease de 30s.

## Unidad durable

Una emisión contiene como máximo un registro o rechazo de proveedor, o una transición vacía que cambia el checkpoint. La máquina recorre `threads → messages → ticket → links → note`. Cada colección solicita `limit=1`; una respuesta que excede ese límite falla cerrada, nunca se corta silenciosamente. Los aliases de paginación observados se admiten sólo para listado de threads y colección de mensajes del mismo thread; se normaliza una capa de padding `%3D` en comparación, reanudación y URL, conservando el cursor raw del checkpoint. No se siguen links ni se admiten aliases para otro thread, thread directo u original-content.

Cada chunk hace un máximo de dos GET: mensaje y, si está truncado, contenido original. Las demás fases hacen un GET. El modo acotado deshabilita reintentos internos para mantener ese límite; un error reanuda desde el checkpoint durable en otra ejecución. El transporte mantiene sus límites de tiempo y bytes.

La conversación se emite y persiste antes de solicitar sus mensajes. Las asociaciones a notas fijan el ID antes del GET siguiente. No hay offsets sobre listas mutables ni se vuelve a listar para decidir qué thread o nota pendiente procesar. La paginación usa los cursores del proveedor y conserva hashes de cursores para detectar ciclos entre ejecuciones. Esto no convierte un recorrido de un origen mutable en un snapshot: cambios anteriores al cursor requieren la reconciliación histórica/solapamiento ya prevista por el producto.

`runSync` ya persiste registros, cuarentena y checkpoint en la misma transacción. El adaptador sólo propone el siguiente estado después de completar la unidad; no modifica el checkpoint recibido. Fallos de proveedor o de commit conservan el último estado durable. La repetición conserva identidad y revisión del original para la deduplicación existente.

Únicamente ante un error de `iterator.next()`, si el plazo de ESTA ejecución se agota tras al menos un commit durable, `DEADLINE_EXCEEDED` o un `TIMEOUT` al alcanzar ese plazo devuelven `continuation` con el último checkpoint confirmado. Un timeout antes del plazo, error HTTP, revocación, esquema, red, aborto ajeno o cero commits siguen siendo errores. No se ocultan fallos de persistencia ni de resumen.

## Checkpoints y rollback

El estado v2 contiene sólo fase, IDs, cursores opacos, hashes de cursores y contadores; no cuerpos, HTML, credenciales ni tokens. Está ligado al mismo scope autorizado y se valida antes de la red. Las emisiones lo clonan para impedir que una mutación del consumidor altere el generador.

Se acepta checkpoint v1 y se continúa exactamente en su cursor exterior; la primera emisión válida propone v2. No se reseteará un checkpoint antiguo ni se inventa cobertura del prefijo v1. El modo legacy/binario anterior rechaza v2 antes de la red: **rollback sobre cursores v2 necesita conservar este lector compatible o una estrategia revisada expresamente; no quitar ni resetear los cursores para arrancar el binario antiguo**.

## Límites

`maxPages` y `maxRecords` conservan su carácter por invocación; no son un límite nuevo al historial completo. Los contadores persistidos sólo admiten enteros seguros. No hay cap cumulativo de 10000 threads. La prueba SYN continúa tras 20662 páginas de threads y más de 100000 registros previos.

El checkpoint tiene límite persistente de **2 MiB JSON**, incluidos todos sus hashes de cursores; el chunk completo tiene límite de **8 MiB JSON**, inferior a los 32 MiB del consumidor. Sobrepasarlos produce error explícito sin avanzar ni declarar `done`. No se elimina historia de ciclos para ahorrar espacio. Un historial que llegue al límite de checkpoint requiere una continuación revisada, no un reinicio silencioso. Las pruebas no acreditan tiempos de persistencia bajo carga en DB real.

## Contenido original

Una respuesta original con `text` se conserva y puede completar el cuerpo. Una respuesta que sólo contiene `richText` se conserva íntegra, con `text:null`, `body_complete:false`; el consumidor la registra como `BODY_INCOMPLETE` en cuarentena. Nunca se reutiliza el texto truncado como si estuviera completo ni se trata HTML como texto limpio. La revisión/hash incluyen el original completo. Una respuesta sin `text` ni `richText` sigue fallando por esquema.

## Rendimiento pendiente

El hosted handler actual hace `maxPages=1`. Una programación cada cinco minutos permite como máximo **288 chunks/día**, no 288 threads ni una carga histórica completa. Threads, subpáginas, tickets y asociaciones consumen chunks separados. Este cambio resuelve el bloqueo y la reanudación; no acredita operación continua ni rendimiento suficiente para el histórico real. No amplía ventanas, plazos ni programación. La lectura de dos GET y la persistencia deben comprobarse en el entorno autorizado antes de afirmar continuidad.

## Pruebas locales

Node22, datos exclusivamente SYN, transportes y repositorio en memoria:

```sh
node --test packages/connectors/hubspot*.test.mjs packages/connectors/sync.test.mjs packages/connectors/sync-visibility.test.mjs
node --check packages/connectors/hubspot.mjs
node --check packages/connectors/sync.mjs
npm run typecheck --workspace @vexa/web
```

Incluyen rico HTML sin texto, cuerpo original malformado, reanudación v1/v2, rechazo legacy, conversación antecedente, commit fallido/replay, lista mutada, nested pagination y ciclos de threads/mensajes/notas, límite de proveedor/registros/checkpoint, cero solicitudes con estado inválido, pertenencia/scopes y errores de plazo positivos y negativos. No ejecutan API, DB, navegador, cron ni producción.
