# Resultado F02-01 — examen ampliado, no congelado

**39 casos ejecutables; banco13pass/26fail/0skip, exit1.** Baseline ausente:
IMPLEMENTATION_MISSING, exit1 esperado. Estado oficial11/60 sin cambios.

Baseline SHA `8340d26e1c6463ed6ccd158ee2a6ed4d202bc987`.
Banco SHA `5fbf2230b76d24e19cad966f97a136b661d03aaa`, leído sin modificar;
ingestion SHA256 `53928bdf9a751fc3efa58b7b794b4de38134e34fc84ec7dc59e4b93a40a104f8`.
Reviewer: pendiente; ningún commit, freeze, registro, aceptación o publicación.

| Comando real | Exit / evidencia |
|---|---|
| `node --test --test-reporter=tap tests/acceptance/F02-01.test.mjs` |1, IMPLEMENTATION_MISSING; evidence/complete01/baseline-final.log |
| Mismo comando con `VEXA_CANDIDATE=/Users/javiercamaraportepetit/vexa/.runtime/closure-1789847917909284000/connected` |1,39tests/13pass/26fail/0skip; bank-final.log |
| `node tests/acceptance/support/F02/mutations.mjs /Users/javiercamaraportepetit/vexa/.runtime/closure-1789847917909284000/connected --f02-01-only` |0,7mutantes Node sobre copia de fuente real, exit0→1 aserción→0; node-mutants/ |
| `node tests/acceptance/support/F02/control-xlsx.mjs` |0,11oráculos positivos de lector independiente y8mutantes; xlsx-controls.json y logs subprocess por estado |
| `node tests/acceptance/support/F02/control-stream.mjs` |0,2controles con Python csv.reader; buffering/decodificación por chunk fallan por aserción; stream-controls.json y logs subprocess |
| `node --check` de mjs propios; Python `ast.parse` de py propios |0, sintaxis sin cache ni instalación |
| `git diff --check` |0; no cambio de HEAD. Archivos nuevos sin seguimiento: diff no sustituye revisión de sus contenidos |

Cada mutación nueva se ejecuta en subproceso con exits reales0→1→0 y aserción
específica; no se asigna muerte por verdictJSON, error de setup, timeout u OOM.
Lector Python verifica ZIP/CRC y celdas XML reales; no es producto ni fallback del
gate. Ocho fixtures verificados independientemente: CRC, XML, targets internos y
XPath A1/B1 en todas las hojas; hashes en xlsx-controls.json. Incluye contenido
alternativo OTHER/37 para evitar control por encabezado/conteo únicamente.

Los12mutantes Node heredados y sus logs se preservan. Sólo se repitieron los7 de01;
los5 de04 conservan evidencia histórica, no se atribuyen a esta ejecución. El
resultado anterior36/17/19 de tres gates sigue en evidence/RESULTADO-inherited.md;
no comparar su denominador con los39casos actuales exclusivamente de01.

Cambios: contrato y pruebas streaming incremental/splits/cancelación/consumo,
Unicode bytes vs codepoints, XLSX real con fronteras20/100MiB,10hojas y mutaciones
sobre lector independiente, validación ZIP/XML/XPath, observador de pre-expansión.
Conservadas API parseCSV/normalizeCSV y semántica custommaxRows incluye cabecera;
50Knormalizadas son datos. Sin cambios de producto ni otros gates.

**Qué impide freeze:** revisión independiente, observador de expansión compatible
con lector elegido y controles positivos pendientes de cancelación/consumo y
normalización; variantes adversarias ZIP aún no ejercitadas. Detalle completo:
[LIMITES.md](LIMITES.md). El banco rojo y la implementación ausente son esperados,
no son por sí mismos razón para bloquear un examen íntegro/revisado.

No probado: producto XLSX/streaming, memoria máxima/RSS, seguridad ZIP exhaustiva,
DB/Storage/durabilidad/workerhost, UI/cloud/producción ni regresiones generales.
No producto, package/lock, Git/config/orchestration/registry/guide, otras copias,
credenciales o originales privados modificados. No Docker, red, gasto ni modelos
adicionales. TEMP propios de controles eliminados; fuentes de entrada read-only.
