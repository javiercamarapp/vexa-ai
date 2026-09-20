# F02-01 — examen externo de límites, CSV streaming y XLSX

Autoría control-plane; **pendiente revisión independiente, no congelado**. Baseline
8340d26e1c6463ed6ccd158ee2a6ed4d202bc987; banco de lectura
5fbf2230b76d24e19cad966f97a136b661d03aaa. Estado oficial permanece 11/60.
Sólo F02-01 y este directorio se modificaron. durable-contracts.md y evidencia
previa se preservan como historial, no como entrega de F02-02..06.

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

## Matriz exacta de grupos del examen

| Casos (prefijo F02-01 omitido) | Aserción / frontera | Control disponible |
|---|---|---|
| CSV UTF8 BOM multiline; encoding invalid UTF8/NUL/surrogate; truncated | valores y líneas1/2/4; CSV_ENCODING; error línea2 | Banco y truncation0/1/0 |
| CSV byte/column/field/row boundary | límite personalizado exacto/+1; cabecera incluida | Banco, cuatro mutantes0/1/0 |
| configured20MiB; default9MiB; default20MiB exact | bytes, campos acotados, default20MiB | Banco parcial; rojo de política |
| 50000 data rows | 50000 aceptadas,50001 rechazo línea50002 | Banco rojo, no control positivo completo |
| message2000; Unicode codepoints; UTF8 bytes distinct | ASCII2000/2001, emoji2000/2001, 😀é=6bytes | Bytes banco; mensajes rojos |
| unknown customer/SKU; amounts invalid/formula | nulls; rechazo field amount | Null banco; amounts rojos |
| CSV formulas/HTML inert | strings exactos, fetch/eval/marker sin ejecución | Banco, execution/formula0/1/0 |
| streaming emits before source ends | fuente bloqueada tras cabecera; fila antes de liberar | Python csv.reader0/1/0 vs buffering |
| streaming all UTF8 quotes CRLF split positions | cada corte binario + chunks de1byte | Python csv.reader0/1/0 vs decode por chunk |
| streaming abort/break; pending read | no nuevas lecturas, return, CSV_CANCELLED | Aserciones escritas; binding banco ausente |
| streaming bounded consumption | bytes/filas/campo/columnas dejan tail sin consumir | Aserciones escritas; binding banco ausente |
| streaming malformed/truncated; source error | UTF8 incompleto fatal, línea2, identidad del error | Aserciones escritas; binding banco ausente |
| XLSX actual cells/10sheets | dos contenidos distintos, nombres/celdas todas las hojas | ZIP/XML independiente real |
| XLSX compressed/expanded custom boundaries | exacto y menos1, todos miembros | Controles y mutantes0/1/0 |
| XLSX default20MiB/100MiB | exacto/+1 reales, store/deflate | Controles independientes |
| XLSX zipbomb | >1MiB real comprimido<10KiB, límite100000 | Control y mutante0/1/0 |
| XLSX11sheets/macros/external/cachedformula/truncated | códigos y ubicación/celda null | Controles; mutantes de hojas/macros/external/fórmula |
| XLSX pre-expansion | positivo observa zlib; exceso invoca0 descompresores | Control Python read0→read1→read0; observador Node pendiente de lector producto |

## Evidencia y separación de controles

`control-xlsx.mjs` usa lector independiente Python stdlib zipfile + ElementTree,
lee bytes/CRC/relaciones/celdas reales. Nunca retorna fixture hardcodeada ni se
carga como candidato. Mutaciones deshabilitan guardias o adelantan lectura real en
una copia TMP0700. `fixture-validate.py` valida independientemente CRC, cada XML,
relaciones internas y XPath A1/B1 en todas las hojas. ZIP válido no significa
seguro para producto; vbaProject.bin es marcador sintético inerte, no macro real.
`control-stream.mjs` usa Python csv.reader real en proceso separado; sus mutantes
bufferizan hasta EOF o decodifican por chunk. No implementa parser alternativo de
producto, límites ni cancelación, ni acredita memoria acotada.

`preexpand.mjs` intercepta Node zlib y exige que un XLSX sano active el observador
antes de exigir cero llamadas en bomb. Un lector JS puro/nativo ajeno a esas rutas
produce INSTRUMENTATION_UNAVAILABLE, **no defecto probado ni mutante muerto**.
Hay que revisar/adaptar observador al lector elegido antes de freeze. Python es
herramienta de control ya disponible, no dependencia del producto. El banco carece
de lector XLSX Node: elegir/revisar librería y package/lock es trabajo posterior
expresamente fuera de estas rutas; no se instalaron dependencias.

## Reproducción

```sh
node --test --test-reporter=tap tests/acceptance/F02-01.test.mjs
VEXA_CANDIDATE=/ruta/connected node --test --test-reporter=tap tests/acceptance/F02-01.test.mjs
node tests/acceptance/support/F02/mutations.mjs /ruta/connected --f02-01-only
node tests/acceptance/support/F02/control-xlsx.mjs
node tests/acceptance/support/F02/control-stream.mjs
```

12 mutantes Node anteriores se mantienen con evidencia histórica. Se reejecutan
sólo7 propios de01; cinco de04 no se duplican ni se vuelven a ejecutar aquí. La
opción nueva guarda evidencia separada. Controles no convierten banco rojo en
verde. Resultado/comandos/limitaciones: [RESULTADO.md](RESULTADO.md).
