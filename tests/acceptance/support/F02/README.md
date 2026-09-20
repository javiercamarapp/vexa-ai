# F02-01 — examen externo revisable

**59casos/19controles mutantes de fuente real, pendiente revisión independiente.**
Base8340d26e1c6463ed6ccd158ee2a6ed4d202bc987; estado11/60sin aceptación.
[Resultado y comandos](RESULTADO.md) · [matriz](MATRIZ-01.md) · [límites](LIMITES.md).
El contrato heredado siguiente se conserva; autoría no equivale a API aceptada.

## Contrato propuesto, aditivo y explícito

Binding único: `packages/ingestion/index.mjs`. Se conservan `parseCSV(input,limits)`
y `normalizeCSV(input,options)` del banco. No fallbacks, aliases de exports,
verdicts JSON ni implementaciones de producto dentro del gate.

- `parseCSV` devuelve `{rows:[{values,line}],errors:[{code,line,field}]}`. `maxRows`
  personalizado sigue contando TODOS los registros, incluida cabecera; 2 admite
  `a\nb`, rechaza `a\nb\nc`. **normalizeCSV permite 50000 datos + cabecera** por
  defecto; exceso localizado en línea física50002. No cambiar semántica del parser
  para obtener ese resultado. Configuración explícita del parser conserva su API.
- Bytes: UTF8, 20MiB=20971520. Mensajes:2000 Unicode code points (no bytes ni
  unidades UTF16); validar el texto normalizado NFC que se publica. El límite
  técnico `maxFieldChars` conserva semántica previa; no es el límite de mensaje.
  SKU/customer vacíos→null; amount inválido o fórmula→rechazo de fila con
  `field:'amount'`, nunca cero. No se exige aquí conversión financiera F02-03.
- Nuevo `parseCSVStream(source, {signal,...limits}?)`: `source` es AsyncIterable
  de Uint8Array/Buffer, devuelve AsyncIterable de eventos. Fila:
  `{type:'row',values:string[],line:number}`; error de sintaxis recuperable:
  `{type:'error',code:'CSV_SYNTAX',line,field:null}`. Mismas líneas físicas y
  normalización CRLF que parseCSV. BOM/UTF8/comillas pueden dividirse en cualquier
  byte. Encoding fatal y límites lanzan los códigos CSV existentes; aborto lanza
  `CSV_CANCELLED`. Emite fila terminada antes de EOF, sin solicitar siguiente
  chunk mientras consumidor no pide otro evento. Cierra source.return al abortar,
  romper consumidor o rechazar; interrumpe espera de next pendiente; preserva error
  original de fuente. No lee chunks posteriores al que demuestra exceso. No
  reclama poder recuperar bytes ya entregados por fuente dentro de un chunk.
- Nuevo `parseXLSX(bytes,{maxBytes=20971520,maxExpandedBytes=104857600,maxSheets=10}?)`
  síncrono: `{sheets:[{name,rows:[{values,line}],errors:[{code,line,field}]}]}`.
  Celdas escalares como strings; fórmula→null y XLSX_FORMULA con line y dirección
  de celda en field, aun con caché numérico. Límites inclusivos; suma de TODOS los
  miembros ZIP, no sólo hojas. Rechazos XLSX_LIMIT_BYTES/EXPANDED/SHEETS,
  XLSX_MACROS, XLSX_EXTERNAL_LINK, XLSX_TRUNCATED. Metadatos de expansión excedidos
  se rechazan antes de descomprimir cualquier miembro. El lector debe verificar
  tamaños reales/CRC; límites nunca se acreditan por morir de OOM/timeout.

Los exports/eventos/códigos nuevos son propuesta concreta para revisión, no API ya
aceptada. No se requiere renombrar fuentes del banco a src/parse.ts.

## Contrato adverso añadido

- CRC incorrecto: XLSX_CRC. Tamaño real distinto de declarado: XLSX_ZIP_MISMATCH;
  si excede el presupuesto durante expansión: XLSX_LIMIT_EXPANDED.
- Miembro duplicado: XLSX_ZIP_DUPLICATE. Alias ambiguos ./ y escapes ../, rutas
  absolutas/backslash y targets fuera del paquete o percent-encoded: XLSX_PATH.
- DTD/custom entities no permitidas: XLSX_XML. Entidades XML predefinidas y
  referencias numéricas válidas sí se preservan (positivo independiente).
- ZIP64 válido: celdas correctas o XLSX_ZIP_UNSUPPORTED documentado. No exige
  soportar ZIP64, ni acepta error genérico/setup como rechazo tipado.
- Tamaños mentirosos coherentes en local/central no eluden el presupuesto real.
  El observador del lector actual verifica cap antes/durante inflateRawSync;
  ausencia de esa instrumentación produce BLOCKED, no obligación de usar zlib.

## Fixtures, controles y reproducción

`adversarial-xlsx.mjs` genera pares sanos/adversos; `validate-adversarial.py`
verifica CRC,tamaños reales,partes intactas,XML/XPath y ZIP64 con stdlib sin
resolver entidades externas. Los negativos se ejecutan en `probe-adversarial.mjs`
bajo Node permission, sin red ni archivos externos. Node26.7.0 verificado.

`control-prototype.mjs` modifica copias de los3módulos reales mediante reemplazos
exactos y comprueba exits0→1→0, aserción específica y hash antes/después. No usa
verdicts ficticios ni modifica fuentes. `verify-prototype.py` ejecuta el gate
completo sobre otra copia TMP y conserva recibo/hash/logs.

Los lectores independientes Python previos son **controlOnly=true** y su
historial permanece en evidence/complete01/. No se cargan como candidato, no
se cuentan como59casos de producto y no se reejecutan en esta tanda.

```sh
python3 -B tests/acceptance/support/F02/verify-prototype.py /ruta/parser
EVIDENCE_RUN=final-controls node tests/acceptance/support/F02/control-prototype.mjs /ruta/parser
node tests/acceptance/support/F02/export-adversarial.mjs
python3 -B tests/acceptance/support/F02/validate-adversarial.py tests/acceptance/support/F02/evidence/close01/fixtures
```

No modificación de producto,otros gates,Git/HEAD/config,DB o infraestructura.
No congelación ni autoaceptación. Los resultados anteriores se conservan en
`evidence/close01/inherited-docs/`, sin confundirlos con el resultado actual.
