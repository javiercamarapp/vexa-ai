> Propuesta supervisada posterior: [XML-STANDARD.md](XML-STANDARD.md) y [recibo](xml-standard-result.json). Este documento se conserva como historial; los correctivos previos fueron rechazados. No hay aceptación.

> Actualización del correctivo: [CORRECTIVE.md](CORRECTIVE.md) y [recibo](corrective-result.json). Los resultados y hashes del prototipo descritos debajo son históricos; fue rechazado por revisión independiente. El correctivo tiene 40/40 propios, 17/17 adversariales y 39/39 snapshot; sigue pendiente de nueva revisión y aceptación.

# Ingestion — propuesta aislada F02-01

No candidato oficial, baseline ni aceptación.

Fuente exacta: `/Users/javiercamaraportepetit/vexa/.runtime/closure-1789847917909284000/connected`, commit `5fbf2230b76d24e19cad966f97a136b661d03aaa`. Extracción por git show antes de modificar; originales en `/var/folders/l3/czqfpdq5057__w_l5dxpp5pc0000gn/T/f0201-parser-kq3mop20`.

```json
{
  "index.mjs": "53928bdf9a751fc3efa58b7b794b4de38134e34fc84ec7dc59e4b93a40a104f8",
  "index.d.ts": "77eb76cf976e5674faf0f540daa9d6a2e102fef03a08f9aa5011768a2db9186b",
  "index.test.mjs": "37e4446ee76db410f2cebaeaf38c6059b8f3cce73c34cf85ef86291c2ac314ae",
  "csv-adapter.test.mjs": "9c8d3ea448a9657e66ea3d359ef0c9a078d4c00ec5b010ce7b1622b72e6dc791"
}
```

## Procedencia y alcance

Baseline leído: `8340d26e1c6463ed6ccd158ee2a6ed4d202bc987`. No SHA de candidato: no se hizo commit, prepare, verify, promote ni aceptación. Única escritura del árbol: `packages/ingestion/`. Sin dependencias instaladas, manifests, lockfiles, Git/config, cloud ni delegación. Node observado `v26.7.0`.

El `IMPLEMENTATION.md` del banco semilla está en `packages/connectors/IMPLEMENTATION.md` (commit `983e007e98f8516ad0380ba4f51ee58b2086fa54`); leído completo como documento conjunto ingesta/conectores. `packages/ingestion/IMPLEMENTATION.md` no existe en dicho commit ni en connected. Se leyó también el mapa F02-INTEGRATION-MAP indicado por el coordinador. Esta recuperación es una propuesta explícitamente autorizada, no adopción de baseline antes de congelar gate.

## Comportamiento

- `parseCSV` conserva retorno `{rows,errors}`, sintaxis, campos y líneas físicas. Default 20 MiB, 50001 registros crudos (cabecera + 50000 datos), 100 columnas y 100000 puntos Unicode por campo. Un `maxRows` explícito en parser/stream incluye cabecera. `normalizeCSV` interpreta `maxRows` como datos y permite la cabecera adicional. Errores de límite llevan `line`.
- `parseCSVStream(AsyncIterable<Uint8Array>, options)` es generador asíncrono incremental: UTF-8 fatal, BOM/CR/LF/comillas/Unicode partidos, eventos `{type:'row',values,line}` y `{type:'error',code,line,field}`. Retiene el chunk actual y un registro; no concatena la fuente para parsearla al final. `yield` aplica backpressure también dentro de un chunk. Errores fatales y fallo del productor se propagan. Cancelación lanza `CSV_CANCELLED`, interrumpe una espera pendiente y solicita `return()` sin esperar a un productor que no coopera. No puede forzar la liberación interna de ese productor; éste debe atender señal/return.
- `normalizeCSV` sigue generando hashes, identidades y envelopes desde los mismos bytes/payload originales. Texto de mensaje: máximo 2000 codepoints después de NFC; SKU/customer vacíos siguen null; fórmula/HTML en texto son cadenas inertes. Nueva propiedad opcional `money` cuando existe columna `amount`: decimal exacto con BigInt y minor units string; nunca float. Monedas soportadas explícitamente USD/MXN/EUR/GBP/CAD/AUD (2), JPY (0), KWD (3). Amount vacío, fórmula, notación exponencial, escala excesiva o moneda ausente/no soportada se rechazan; no se inventa cero. No transforma dinero a otra moneda ni persiste un evento contable.
- `parseXLSX(Uint8Array, limits)` devuelve `{sheets:[{name,rows:[{line,values}],errors}]}`. ZIP real almacenado/deflate con CRC32, directorio central/local concordantes, tamaños reales, consumo comprimido real, rangos contiguos sin solapamientos, nombres seguros, detección de truncados y descriptor de datos. Declared expanded total se comprueba antes de inflar cualquier miembro; cada inflado tiene límite nativo de salida y se comprueba contra bytes/CRC reales. Se validan todos los miembros, aun no referenciados.
- Default XLSX 20 MiB comprimidos, 100 MiB expandidos, 10 hojas, 50000 filas crudas **en total** (no interpreta cabeceras), 100 columnas, campo 100000 codepoints, 10000 miembros ZIP y 1000000 nodos XML por parte. Parámetros opcionales documentados en `index.d.ts`. El número de hojas del workbook se valida antes de expandir worksheets; filas se cuentan al abrir nodos XML, antes de convertir celdas. No afirma conocer el número de filas antes de descomprimir la worksheet que las contiene.
- OOXML transitional con namespaces, relaciones de workbook, worksheets, shared strings/rich text, inline strings, entidades XML predefinidas/numéricas, celdas dispersas y Unicode. Números son lexemas string originales; no pasan por Number. Fórmula de celda, incluida compartida sin texto, siempre null + `XLSX_FORMULA` con coordenada; jamás usa cached value. Error Excel produce null + `XLSX_CELL_ERROR`. Sin eval/red/DOM.

## Subconjunto y límites pendientes

Parser ZIP/XML manual con node:zlib; no biblioteca XLSX/XML dedicada presente entre las dependencias consultadas. **Requiere revisión independiente de seguridad antes de adoptar**. Los tests sintéticos no acreditan soporte completo de Excel, rendimiento en producción ni sandbox universal.

Rechaza ZIP64, cifrado, multidisco, métodos distintos de stored/deflate, symlinks, entradas de directorio explícitas, prefijos/trailers de ZIP, paths ambiguos y OOXML strict/formatos distintos de transitional. Rechaza DTD/custom entities, macros/activeX/embeddings y relaciones externas (incluidos hyperlinks externos). No ejecuta fórmulas, estilos, formatos de fechas, macros ni enlaces. No interpreta estilos/date serials; no soporta XLS binario, XLSB, chartsheets ni conversiones de Excel a objetos contables. Fórmulas y shared strings no son sustitutos de un mapeo financiero.

XLSX recibe archivo en memoria y usa árboles XML acotados; **no es streaming XLSX**, ni hay benchmark de RSS máximo. Los límites de expansión no equivalen al RSS total: buffers, strings y nodos añaden memoria. Rechazos estructurales son fatales; no se retorna un workbook parcialmente válido como éxito. CSV sync y normalize siguen en memoria por compatibilidad; el entrypoint de streaming es separado.

No probado: Node22, typecheck consumidor de las declaraciones, archivos reales exportados por Excel/LibreOffice, fuzzing extenso ZIP/XML, descriptor de datos en una muestra real (sí probado en sintéticos stored/deflate), interoperabilidad de estilos/fechas, HTTP/Storage/jobs/pipeline/DB/RLS/UI/cloud. No se ejecutó controller110 ni se operó el control-plane. No hay nuevo hito aceptado (permanece el baseline).

## Pruebas y fallos conservados

Sólo fixtures sintéticas. Se añadieron tests antes de implementar: `/tmp/f0201-red.log`, `/tmp/f0201-xlsx-red.log`; mostraron fallos por APIs ausentes y amount inválido aceptado. Los wrappers iniciales terminaron con `tail` (exit shell 0); no capturaron el exit numérico de node, por lo que esos logs NO se rotulan como exit1 medido. El rojo propio de cancelación se conserva en `/tmp/f0201-abort-red.log`.

Primer contraste externo: `/tmp/f0201-external.log`, **exit1 capturado**, 38/39; `STREAM_PENDING_ABORT` falló por timeout. Se reprodujo localmente con productor cuyo `next`/`return` nunca resuelven y se corrigió la carrera de cancelación. Ningún examen externo fue editado ni relajado.

Comandos finales:

```sh
node --test packages/ingestion/*.test.mjs
# exit0, 26/26: 12 del banco + 14 nuevos
npm test
# exit0, 12 kernel + 12 foundation
VEXA_CANDIDATE=/Users/javiercamaraportepetit/vexa/.runtime/f0201-parser-1789866904789409000/parser node --test /Users/javiercamaraportepetit/vexa/.runtime/f02-complete-1789866620572603000/limits/tests/acceptance/F02-01.test.mjs
# exit0, 39/39 — BORRADOR, NO gate oficial congelado
```

Logs finales: `/tmp/f0201-own-final.log`, `/tmp/f0201-npm-test.log`, `/tmp/f0201-external-final.log`; recibo de comandos/exits/hashes: `/tmp/f0201-results.json`. Hashes externos antes/después del primer contraste en `/tmp/f0201-external-before.json` y `after.json`; último contraste también comparó todos sus módulos importados antes/después y resultaron estables. Los únicos cambios posteriores al contraste externo fueron tests propios/README, no runtime.

Casos medidos: 50000 mensajes y primer exceso por línea50002; CSV 20MiB exacto/exceso; XLSX 20MiB comprimido y 100MiB expandido exactos/exceso; diez/once hojas; declaración de expansión rechazada antes de inflar; salida antes de EOF; backpressure; cancelación pendiente; cada frontera de bytes UTF8/CRLF/quotes del fixture externo. Propios: CRC corrupto, offsets solapados, paths, DTD/entidades inválidas, XML mal cerrado/atributos duplicados, shared strings Unicode, celdas dispersas/fuera de orden, importes >2^53, moneda/escala inválidas y fórmulas cacheadas bloqueadas.

Próximo paso: revisión independiente ZIP/XML y contrato de filas crudas XLSX/cabeceras, más corpus real de OOXML y medición de memoria. Congelar examen fuera de esta propuesta antes de prepare/adopt/verify/promote. No autoaceptar por este verde.

SHA256 del borrador F02-01 ejecutado: `e347f900f5f31ba765b8220874a3af4b6c4681230cee3c014c07c1075b09f795`.

SHA256 de archivos de producto y fixtures propios (README excluido para evitar hash autorreferente):

```json
{
  "packages/ingestion/csv-adapter.test.mjs": "9c8d3ea448a9657e66ea3d359ef0c9a078d4c00ec5b010ce7b1622b72e6dc791",
  "packages/ingestion/csv.mjs": "cd2d9d672215b86d63eb94e26d6335b56ec35e174831733f406cc69826decf71",
  "packages/ingestion/index.d.ts": "752dc92a0c02380c41f38527b7eec65f6bc391593de31410b846c5e71668a66c",
  "packages/ingestion/index.mjs": "17161f0276d4e69672674820f15f6c39dac97d31369e74b9a1f1fa6cec8eb33d",
  "packages/ingestion/index.test.mjs": "37e4446ee76db410f2cebaeaf38c6059b8f3cce73c34cf85ef86291c2ac314ae",
  "packages/ingestion/parser.test.mjs": "2e072858cd97340ed5d711755e2e0f0cb1cc4d2cca693705a828f3f46745ef05",
  "packages/ingestion/xlsx.mjs": "b97e223f08fde6394c5493d68bc92f118b07cb240eef3ab668285f6adde75e37",
  "packages/ingestion/xlsx.test.mjs": "28df6e0682cb51e4ca7f05c648457a6c8df8876c04fd8af10977d919c5f379a2"
}
```
