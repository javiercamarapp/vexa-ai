# F02-02 — cierre del examen local, revisión/freeze pendientes

Fuente exacta read-only: `/Users/javiercamaraportepetit/vexa/.runtime/f02-renewed-1789878121257397000/imports`.
Baseline SHA `71bd4bf3c26c16f37fa8be98ae6765316e329a03`; producto propuesta sin candidate commit nuevo. No se cambió Git/HEAD/config ni producto, ROOT, control-plane, grafo o registro. Sólo entrypoint02 y support/F02-durable. Contadores recibidos22/24F02,166/220global preservados; cero subagentes/modelos adicionales, cloud, gasto o APIs externas.

Se retiró GATE_INCOMPLETE únicamente después del positivo total sobre esta fuente y controles reales. Esto es un examen autorado con resultado local; **NO aceptación, revisión independiente ni freeze del principal**. Los recibos no son autoridad de ejecución: el entrypoint ejecuta las aserciones; nunca lee un JSON de PASS ni inserta producto de referencia.

## Comandos y resultados

Prefijo `S=tests/acceptance/support/F02-durable`; candidato anterior exportado como `VEXA_CANDIDATE` salvo control ausente. Todos Python `-B`; npm ci offline/ignore-scripts, build en TMP, Docker `--pull never`, broker UUID/journal0600, sin DB publicada/compartida. Logs conservados en evidence/.

| Ejecución | Exit / evidencia |
|---|---|
| `python3 -B $S/run.py node $S/total-exam.mjs` | 0; run-cc549cad-09a2-4808-821d-516d97086da1, SSR completo +24/24 Node,0skip,cleanup true |
| `python3 -B $S/close-controls.py` | orquestador1 por fixture Node anónimo inválido histórico; SSR sano0/mutante1/restaurado0 válidos en close-controls-ccfb62a4-57ab-41e0-a309-1202d5525a81. No presentar el orquestador como exit0 |
| `python3 -B $S/run.py node --test --test-concurrency=1 $S/product-probe.test.mjs $S/product-expiry.test.mjs $S/product-bytes.test.mjs` | 0,24/24 tras corregir fixture; run-2db48b31-fde5-4427-a926-137dad250d1a |
| `python3 -B $S/product-mutations.py hash atomic` | 0; ambos OS0→1→0; product-mutations-ddecce23-dd62-4c22-8d15-f058d97c4dbe |
| sin candidato: `python3 -B $S/run.py node --test tests/acceptance/F02-02.test.mjs` | 1, IMPLEMENTATION_MISSING antes de infraestructura; run-0affe3b1-ca6e-4443-bc6a-4b58b095ff64 |

Ver abajo repetición final del entrypoint y hashes. Cada result.json registra argv y exit real; outputs completos, fallos y journals quedan conservados.

## Cobertura ejecutada y límites exactos

SSR Next real construido de la fuente exacta: GoTrue autentica cookies SSR, POST reserva/concurrencia/replay/conflicto, PUT directo Storage, confirmación202, GET200 queued; meta.trace_id obligatorio en todas las respuestas de API observadas. Negativos reales401anónimo con payload válido,403Origin extranjero/null/confirm,404tenant ajeno confirm/get,403selector forjado, Storage ajeno denegado, revocación mismo cookie confirm/get/Storage y restauración positiva. Jobs/outbox únicos por DB; SIGKILL/reinicio Next mantiene import/job/outbox y secreto. Triggers jobs y outbox alcanzados mediante secuencia no transaccional,503y snapshot íntegro acreditan rollback; reinicio/reintento de la MISMA reserva termina en un job/outbox.

Tamaño: cuerpo corto devuelve500DatabaseError/SQLSTATE23514; se exige ese código específico, ausencia de objeto durable y lectura200, ausencia job/outbox y reserva intacta. MISMA URL/capacidad acepta bytes correctos; lector HTTP independiente verifica bytes completos, tamaño y SHA; confirm202. No se exige permitir upload inseguro para probar confirm. Hash distinto con tamaño correcto sube200 y confirma422sin job/outbox. MutanteSHA real omite hash(bytes) y cae en PRODUCT_HASH_MISMATCH; el de atomicidad cae en ATOMIC_CONFIRM_ROLLBACK, no en setup.

SSR mutante real sólo en copia TMP del server.ts omite assertOrigin. Primero alcanza SSR_AUTHENTICATED_POSITIVE_REACHED; luego respuesta201frente403 alcanza SSR_ORIGIN_REJECT/ERR_ASSERTION. Sano/restaurado pasan la suite completa. No se modifica el snapshot del autor.

Node productivo:16casos canónicos,2owner/expiry,3bytes (24tests incluyendo3contenedores). Incluye uniqueSQL en conexiones independientes, canonical createDatabase/pg/SET LOCAL ROLE/RLS, rol noSU/noBYPASS/noowner y login sin acceso directo, membership obsoleto revalidado, capacidades Storage expiradas firmadas/control positivo, scope Storage manipulado, owner de reserva, viewer, inputs arbitrarios, fallo reserva, mapping, mismo contenido con distintas claves, SIGKILL/reinicio HTTP. Admin sólo observador/inyección/setup, nunca falso SqlPool.

Expiración reserva: DEFAULTSQL2s de fixture ANTES de firma, reloj real y409reservation_expired; no modifica expiry de un token ya firmado. No afirma espera completa15min. Propiedad corresponde a quien firma la capacidad, no al dispositivo físico. Queued≠completed. D02-15 reconciliación/retención sintética permanece histórica y no acredita02; contrato no exige exportinventado de mantenimiento.

## Fallos preservados

run-423ea900-b755-4f1d-9163-dde6f6bf8ec1: primer SSR sin Idempotency-Key en anónimo devolvió400invalid_metadata; fixture corregido para probar auth con metadatos válidos.
run-36d76ab4-44f6-478f-84d3-1f70b3deff98: rechazó500Storage por lista demasiado estrecha; se identificó23514 y se añadió exigencia del código y recuperación exacta, sin admitir un500genérico.
run-ab8b297b-9e23-4ad4-8cad-4a09aa6f582c: Node anónimo enviaba{}; se corrigió fixture, no expectativa401.
Todos los logs anteriores, incluidos setups fallidos de tamaño/owner y mutaciones anteriores, se conservan. Ninguno de estos tres fallos cuenta como mutante muerto. Parcial anterior conservado además en partial-entrypoint-preserved.txt y partial-exam02-preserved.mjs. Nueve mutantes sintéticos heredados no se reclasifican como productivos.

## Fuentes, fixtures, licencias y pendientes

CLOSE-PROVENANCE.json contiene hashes de manifiesto/propuesta y de test/http.mjs/prepare.py leídos sólo para infraestructura. Cookie/socket/proxy adaptados; aserciones nuevas independientes, no copiadas del candidato. Infra previa en infra-provenance.json; scaffold-copy/lifecycle/resourceBroker aceptados reutilizados sin cambios. Fixture CSV SSR nuevo SYNTHETIC/CC0-1.0, base64ySHA en provenance/logs. Los fixtures Node registran bytes/hash. Dependencias verificadas en package-lock: Next16.3.5,pg8.16.3,@supabase/ssr0.12.7,@supabase/supabase-js2.116.0, MIT. No se presume licencia nueva del proyecto/infra heredada ni se redistribuyen datos.

Pendiente revisión independiente del gate y producto, freeze/adopción/verificación/promoción por principal. No probado SaaS completo/ocho vistas, browserUI, Node22, cloud/producción, TTL15min completo, todas las cancelaciones/cleanup universal, crashSIGKILL DURANTE transacción SSR (sí rollback por trigger y reinicio posterior), retención/reconciliación futura. F02-04/05/06 **NO aprobados**. No se ejecutó suiteglobal/controller/graph porque no se modificó ese alcance ni se integra aquí.

## Repetición final y hashes verificados

`VEXA_CANDIDATE=/Users/javiercamaraportepetit/vexa/.runtime/f02-renewed-1789878121257397000/imports python3 -B tests/acceptance/support/F02-durable/run.py node --test tests/acceptance/F02-02.test.mjs` → **exit0**, SSR total +24/24 Node +1 envoltorio,0skip. Recibo `evidence/run-d41bd639-ea00-4255-824f-09443c1ba075/`, cleanup=true.

`VEXA_CANDIDATE=... python3 -B tests/acceptance/support/F02-durable/final-source-check.py after` → exit0, `GATE_AND_PRODUCT_SOURCES_UNCHANGED 30 82`. FINAL-SOURCE-BEFORE.json y FINAL-SOURCE-AFTER.json contienen hashes individuales idénticos de fuentes ejecutables del gate/producto, sin recibos/builds. También se comprobaron intactos los80archivos del producto de CLOSE-SOURCE-BEFORE.json.

- Entrypoint: `ec93ed7a288f535a245db19bdd11e953065d90a2e61bb78efbfc21beffa9cea6`
- SSR: `1d073d7a8a0aad34244dc6b33594453f80f53235bbe7501a1de174866b017e5d`
- Manifiesto final antes: `9773a6dab4fc8a5af803502d982382abaa272cd236d515e1c48a5ce88954a905`
- Manifiesto final después: `9773a6dab4fc8a5af803502d982382abaa272cd236d515e1c48a5ce88954a905`
