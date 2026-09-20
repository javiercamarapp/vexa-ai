> Propuesta supervisada posterior: [XML-STANDARD.md](XML-STANDARD.md) y [recibo](xml-standard-result.json). Este documento se conserva como historial; los correctivos previos fueron rechazados. No hay aceptación.

# Correctivo F02-01 — prototipo, revisión pendiente

Resultado local: cuatro fallos independientes reproducidos antes del cambio y rechazados después. No formalTask, adopción, commit ni aceptación; el estado comunicado sigue en 11/60. Base SHA **según el informe recibido**, sin consultar Git: `8340d26e1c6463ed6ccd158ee2a6ed4d202bc987`. No hay SHA de candidato; la fuente exacta se identifica con SHA256 en `corrective-result.json`.

## Cambio y contrato

`xlsx.mjs` comprueba cardinalidad de los hijos singleton (`sheetData`, `v`, `f`, `is`, `t`, etc.), rechaza wrappers no soportados en las rutas de datos y exige namespace SpreadsheetML para el texto consumido. `mc:AlternateContent` no se interpreta ni se omite: produce rechazo fatal. Ninguna de estas entradas devuelve un workbook parcial como éxito.

El tokenizer conserva el contador acumulado de nodos, pero entrega eventos de cierre: convierte y desprende cada `si` y cada fila. Conserva los strings por índice y las filas de salida; no conserva sus árboles completos. Los consumidores comprueban la identidad de la raíz para impedir que una raíz falsa anidada introduzca datos. El límite existente de columnas también se comprueba al abrir las celdas. Se retiraron las cachés globales de árboles y buffers inflados; un conjunto de partes verificadas conserva la comprobación de CRC/expansión de todos los miembros sin retener sus buffers.

Sin cambios de API, CSV, hashes de normalización, null, money exacto ni cancelación del stream. No se rebajaron 20 MiB/100 MiB/50000 filas/10 hojas/2000 caracteres, ni los límites previos de columnas, campos, entradas y nodos XML. Los tests del snapshot vuelven a comprobar las fronteras canónicas.

## Subconjunto estructural explícito — requiere revisión

No es un validador completo de OOXML. El worksheet permite sus elementos ordinarios de metadatos enumerados en el código, pero rechaza hijos desconocidos/ajenos y `extLst`; `sst` admite entradas `si`, sin extensiones. Las rutas `sheetData → row → c` no admiten wrappers. La celda admite `f`, `v`, `is` sin duplicados; no admite markup dentro de `v`/`f`, ni valor numérico e inline simultáneos. El texto es un `t` o secuencia de `r` con un `t` por run; conserva espacios, Unicode, prefijos válidos y formato `rPr`. Las anotaciones fonéticas `rPh`/`phoneticPr` siguen siendo metadatos, no se concatenan al texto visible.

**Documentos OOXML válidos que requieran extensiones o AlternateContent pueden ser rechazados explícitamente.** Esta restricción está declarada y probada, pendiente de revisión; no se presenta como interoperabilidad completa ni se trunca el corpus para lograr un verde. No se ensayó un corpus real Excel/LibreOffice en este correctivo.

## Reproducción y resultados

Node `v26.7.0`; las comprobaciones finales se ejecutaron en `/tmp/f0201-parser-corrective/candidate`, copia con hashes idénticos a la fuente. Oráculos originales intactos: 185 archivos de snapshot/support/artefactos comparados antes/después, cero cambios. Se ejecutaron copias byte-idénticas de los probes/aserciones del revisor. No se usó el gate mutable de otro autor.

| Comando (cwd de la copia salvo rojo inicial) | Exit | Resultado |
| --- | --- | --- |
| `node --test /tmp/f0201-parser-corrective/vexa-parser-review-assertions.mjs` antes | 1 | 13/17, los cuatro fallos indicados |
| `node --test packages/ingestion/xlsx.test.mjs` antes | 1 | 8/17, nueve regresiones propias rojas |
| `node --test packages/ingestion/*.test.mjs` después | 0 | 40/40; 26 heredadas + 14 nuevas |
| `node --test /tmp/f0201-parser-corrective/vexa-parser-review-assertions.mjs` después | 0 | 17/17 |
| `VEXA_CANDIDATE=/tmp/f0201-parser-corrective/candidate node --test /Users/javiercamaraportepetit/vexa/.runtime/f02-complete-1789866620572603000/limits/tests/acceptance/F02-01.test.mjs` | 0 | 39/39, snapshot de revisión, no aceptación |
| `node /tmp/f0201-parser-corrective/vexa-parser-review-probe.mjs duplicate-sheetdata duplicate-value alternate-content foreign-richtext` | 0 | `XLSX_XML`, `XLSX_XML`, `XLSX_UNSUPPORTED`, `XLSX_UNSUPPORTED` |

Fixtures nuevos sintéticos embebidos en `xlsx.test.mjs`: duplicados de sheetData/valor/inline; AlternateContent; namespace ajeno en inline/run compartido; wrapper de fila; markup dentro del valor; mezcla de texto plano/rich; prefijos/espacios/fonética/lexemas exactos; 10000 shared strings con índices intermedios/final/vacío y 500 filas; extensiones rechazadas; cola XML inválida; raíces worksheet/SST anidadas. Hash del archivo y del runtime en el recibo. Los casos añadidos después del rojo inicial incluyen la comprobación de liberación por eventos y sus bordes; no se afirma rojo previo de todos ellos.

## Memoria observada, no cota

Comparación en procesos nuevos, misma versión Node, mismos fixtures originales, mismo probe, sin OOM ni flags especiales:

| Fixture | Original, maxRSS KiB | Correctivo, maxRSS KiB | Resultado |
| --- | ---: | ---: | --- |
| `large-shared.xlsx`, 20061 bytes, 450000 strings | 454992 | 120784 | Ambos devuelven el mismo valor `x` |
| `million-nodes.xlsx`, 900000 celdas | 383120 | 67568 | Ambos rechazan con `XLSX_LIMIT_COLUMNS` |

Esto demuestra una reducción observada en esos casos, **no un techo RSS universal ni OOM PASS**. XLSX aún recibe el archivo entero, infla una parte y decodifica su XML en memoria; conserva strings y filas de salida, y árboles de metadatos. No es streaming de bytes XLSX. La estructura viva de datos baja de todos los nodos a una cadena/fila en proceso, más sus resultados; buffers, metadata, strings, límites configurables y GC aún afectan RSS.

## Evidencia y pendientes

Recibo persistente: `corrective-result.json`, con comandos exactos, cwd, exit/signal, hashes fuente, fixture, oráculo y logs. Artefactos completos: `/tmp/f0201-parser-corrective/` (`before.json`, `after.json`, `result.json`, copias original/candidate y logs rojo/verde/RSS). Snapshot SHA256: `e347f900f5f31ba765b8220874a3af4b6c4681230cee3c014c07c1075b09f795`.

Pendiente: revisión independiente del correctivo y de las restricciones estructurales; corpus real; Node22; typecheck consumidor; fuzzing exhaustivo y política de memoria de producción. No ejecutados npm test global, controller, graph, build de web, DB/RLS/UI/cloud; no corresponden a la validación de este parser aislado. Sin red, inferencia, gasto, delegación, Git ni control-plane. Únicas escrituras del repositorio en `packages/ingestion/`; pruebas y artefactos auxiliares en TMP. No se afirma aceptación por ninguno de los verdes.
