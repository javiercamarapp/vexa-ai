# Resultado F02-01 — listo para revisión, no aceptado

**59/59 casos,0fallos/0skip, exit0** sobre copia TMP de la fuente real terminada.
**19controles sano0 → mutante1 por aserción específica → restaurado0**.
17pares ZIP adversos tienen validación independiente del invariante objetivo;
se añade1positivo de entidades XML permitidas. Ningún defecto de producto
apareció en esta batería. No equivale a seguridad exhaustiva ni a SaaS terminado.

Estado oficial **11/60**, sin freeze/accept ni publicación. Esta es autoría, no
revisión independiente. Base y HEAD fuente:
`8340d26e1c6463ed6ccd158ee2a6ed4d202bc987`. La implementación es un prototipo
no incorporado a ese commit: su identidad efectiva son los hashes siguientes.

Fuente read-only:
`/Users/javiercamaraportepetit/vexa/.runtime/f0201-parser-1789866904789409000/parser/packages/ingestion`.
Sólo index.mjs,csv.mjs,xlsx.mjs se copiaron a temporales propios; su hash coincide
antes/después. No se tocó ni copió scripts/__pycache__, ni se modificó producto.

| Módulo | SHA256 antes = después |
|---|---|
| index.mjs | `17161f0276d4e69672674820f15f6c39dac97d31369e74b9a1f1fa6cec8eb33d` |
| csv.mjs | `cd2d9d672215b86d63eb94e26d6335b56ec35e174831733f406cc69826decf71` |
| xlsx.mjs | `b97e223f08fde6394c5493d68bc92f118b07cb240eef3ab668285f6adde75e37` |

## Comandos y artefactos

Todos los paths de evidencia relativos a `evidence/close01/`.

| Comando | Resultado / artefacto |
|---|---|
| `python3 -B tests/acceptance/support/F02/verify-prototype.py SOURCE` |0; ejecuta gate59/59,preexpand0,actual-expansion0; verification.json y tres logs |
| `EVIDENCE_RUN=final-controls node tests/acceptance/support/F02/control-prototype.mjs SOURCE` |0;19secuencias0→1→0; final-controls/prototype-controls.json y57logs |
| `node tests/acceptance/support/F02/export-adversarial.mjs` |0;17pares+positivo y fixtures/fixtures.json con hashes |
| `python3 -B tests/acceptance/support/F02/validate-adversarial.py tests/acceptance/support/F02/evidence/close01/fixtures` |0; fixtures-validated.json: CRC,bytes reales,tamaños,partes intactas,XML y ZIP64 |

SOURCE es el directorio parser padre de packages. Gate interno real:
`VEXA_CANDIDATE=TMP node --test --test-reporter=tap tests/acceptance/F02-01.test.mjs`.
Node observado:v26.7.0. El runner no instala dependencias, no copia otras carpetas
y elimina sólo sus TMP. SHA256SUMS de esta entrega se encuentra en close01/.

## Alcance demostrado

[MATRIZ-01.md](MATRIZ-01.md) identifica aserciones y mutantes. Los17fixtures adversos
se generan desde XLSX sanos; Python demuestra que no se rompió otro campo para
obtener el rechazo. ZIP64 es un archivo válido con EOCD64/locator, no sólo bytes
sentinela: el rechazo tipado por formato no soportado es permitido.

El observador confirma `node:zlib.inflateRawSync` sobre esta fuente. Para la
bomba de tamaño mentiroso registra caps502,240,241,224,207,64; los primeros1414bytes
expanden realmente y el último miembro termina en ERR_BUFFER_TOO_LARGE. No se
presenta como prueba de RSS. Lector futuro ajeno a zlib: **BLOCKED por falta de
instrumentación**, requiere adaptador revisado; no es defecto ni mutante muerto.

Hubo1fallo de setup inicial: Node permission rechazó el alias /var de TMP antes
de cargar el candidato. Se conserva setup-permission-first.log/json; NO cuenta
como mutante muerto. Se corrigió canonicalizando únicamente el TMP propio.

Docs/evidencia heredados preservados: inherited-docs/ y complete01/. Controles
Python históricos rotulados controlOnly en la matriz, sin atribución a producto.

Pendientes: revisión independiente, adopción/congelación por control-plane y ciclo
oficial. No probado: límites RSS/heap, ataques ZIP/XML exhaustivos, otros lectores,
DB/Storage/jobs/UI/cloud/producción. No npm/controller generales solicitados.
Ninguna escritura fuera de gate01/supportF02 y TMP propios; sin Git/config/HEAD,
gates03/04, DB, red, Actions, push, deploy, envíos ni modelos externos.

Checks finales: sintaxis19archivos exit0 (syntax.json), `git diff --check` exit0, HEAD8340d26sin cambios. Control actual-budget reejecutado0→1→0 tras precisar telemetría; final-expansion-control/, sin incrementar19mutantes únicos.
