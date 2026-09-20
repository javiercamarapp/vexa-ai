# F02-01: propuesta supervisada con XML estándar

> Documento histórico de la primera sustitución del lector. La restricción de
> definedNames/autoFilter y el pendiente Node22 descritos abajo quedan
> supersedidos por [INTEROPERABILITY.md](INTEROPERABILITY.md). Sus recibos
> originales se conservan y no acreditan la ampliación posterior.

No aceptación, adopción, commit ni candidato oficial. Trabajo exclusivamente en
`packages/ingestion/` de `xml-fix`; HEAD leído e inalterado:
`71bd4bf3c26c16f37fa8be98ae6765316e329a03`.
El candidato oficial preparado, root, otros worktrees, gates, controlador, grafo,
metadata y locks no se editaron. Los documentos y recibos anteriores se preservan
como historia de propuestas rechazadas, no como acreditación vigente.

## Causa y solución

Se elimina el tokenizer XML manual. `saxes 6.0.0`, con namespaces activados y
`xmlchars 2.2.0`, valida XML 1.0, nombres expandidos, declaraciones, entidades,
comentarios, cierres y unicidad de atributos. DTD, instrucciones de procesamiento,
XML 1.1 y encoding declarado distinto de UTF-8 se rechazan. No resuelve recursos
externos. Los prefijos se comparan por URI/local, nunca por su grafía.

`xml-grammar.mjs` define explícitamente cada elemento consumido, atributos por
URI/local, atributos requeridos, padres, orden y cardinalidad. Los contadores de
hijos sobreviven al desprendimiento de filas/strings; una segunda lista no evade
el control por haber consumido la primera. Wrappers, nodos ajenos, propiedades con
texto ambiguo y atributos desconocidos fallan cerrados. Las hojas requieren IDs
positivos únicos. No hay reglas por nombre de fixture, hash ni valor de celda.

Rich text conserva Unicode, espacios, referencias de carácter y saltos conforme
a XML (CR/CRLF literales normalizados por el parser estándar; `&#13;` preservado).
`rPr` acepta un conjunto explícito de propiedades vacías, sin repetirlas; `rPh`
contiene exactamente un `t`, y `phoneticPr` es vacío. La fonética válida es metadata,
no texto visible. Texto simple y runs no se mezclan. Los metadatos admitidos se
validan también por dentro; no existen subárboles comodín.

Se mantienen ZIP/CRC/expansión real, CSV/streaming, hashes, importes exactos,
límites de 20/100 MiB, 50000 datos, diez hojas y 2000 caracteres Unicode en el
contrato de normalización. La API y defaults no cambian. XLSX continúa recibiendo
bytes completos e inflando una parte; no se afirma streaming de bytes XLSX.

## Subconjunto y restricciones explícitas

La tabla de gramática es la lista exhaustiva de soporte estructural. Workbook:
fileVersion, workbookPr, bookViews/workbookView, sheets/sheet y calcPr. Worksheet:
sheetPr (tabColor/outlinePr/pageSetUpPr), dimension, sheetViews (pane/selection),
sheetFormatPr, cols/col, sheetData/row/c, sheetCalcPr, mergeCells/mergeCell,
phoneticPr, printOptions, pageMargins y pageSetup. Datos: valores, fórmulas
bloqueadas, inline/shared strings y sus runs/fonética. Content types y todas las
partes `.rels` también tienen gramática cerrada.

Otros elementos, incluidos definedNames, autoFilter, conditionalFormatting,
dataValidations, hyperlinks, drawing, extLst y AlternateContent, se rechazan
explícitamente incluso si el documento sería OOXML válido. Esta propuesta ofrece
menos compatibilidad de metadatos que el prototipo permisivo: no los omite como
si los hubiera entendido. Hay pruebas de rechazo de documentos con extensiones
y definedNames, y controles positivos de metadata soportada y prefijos Unicode.
No es un validador XSD completo: los dominios de todos los atributos de formato
no se validan exhaustivamente. Las partes XML no consumidas (p.ej. propiedades de
documento o estilos) reciben validación XML estándar sin DOM; no se interpreta su
semántica OOXML ni se usan para extraer valores. Fechas/estilos no se convierten.

## Dependencias reproducibles

Ver `vendor/README.md`, `vendor/provenance.json`, `vendor/relative-imports.patch`
y `vendor/license-provenance.json`. Versiones exactas, SRI SHA512 y SHA256 de los
tarballs oficiales npm; hashes originales/finales de cada archivo. Sólo se
cambian tres rutas `require` de saxes para resolver `../xmlchars/`; su lógica no
se modifica. JS legible y todos los archivos de distribución conservados.

Licencias: saxes ISC (incluye avisos históricos completos), xmlchars MIT. El
tarball saxes no incluye LICENSE: se incorporó intacta desde el gitHead exacto
publicado en npm, con URL oficial y SHA256 registrado. No hubo npm install,
postinstall, scripts, node_modules, lockfiles ni lectura de configuración npm.
Descargas HTTPS públicas con stdlib Python; archivos inspeccionados en temporal,
SRI verificado y paths/tipos/duplicados comprobados antes de extraer. La
reproducción final en un directorio nuevo dio **27 archivos byte-idénticos**.

## Verificación de esta fuente

Recibo: `xml-standard-result.json`. Comandos, cwd, exits, hashes de logs/fuentes,
fixtures/probes y gate, más RSS en `/tmp/f0201-xml-standard/`.
Todos los Python se invocaron con `-B`; pruebas con `PYTHONDONTWRITEBYTECODE=1`.
No APIs de proveedor, MCP, secretos, instalación de paquetes ni delegación.

| Comando | Exit | Salida |
|---|---:|---|
| `node --test <review>/regressions.test.mjs` antes del cambio | 1 | 2/8; seis excepciones ausentes |
| `node --test packages/ingestion/*.test.mjs` final | 0 | 57/57 |
| `node --test <review>/vexa-parser-review-assertions.mjs` | 0 | 17/17 previos |
| `node --test <review>/regressions.test.mjs` final | 0 | 8/8 (seis negativos, dos positivos) |
| `VEXA_CANDIDATE="$PWD" node --test /Users/javiercamaraportepetit/vexa/tests/acceptance/F02-01.test.mjs` | 0 | 64/64, root actual |

`<review>` = `/var/folders/l3/czqfpdq5057__w_l5dxpp5pc0000gn/T/f0201-independent-recheck-pnjnupc7`.
El rojo se reprodujo inicialmente en este workspace antes de editar y se confirmó
con exit capturado en una copia temporal de la fuente rechazada, cuyo xlsx SHA256
`c5727ba18f8c340ff40d90a8bc6295859015d350c01aee22b8c59b26fcfde5a1`
coincide con el recibo heredado. No se modificaron los probes originales.

Gate SHA256:
`a1d63ff1478fb5129655554e01c77f5e9646ad2f1658d0052b685aaa33f1d3f2`.
32 archivos del gate/probes/fixtures de recheck idénticos antes/después de la
verificación final. `git status --short`: sólo `?? packages/ingestion/`;
`git diff --name-only`: vacío (propuesta aún no rastreada).

## RSS observado

Node v26.7.0, procesos nuevos, fixtures sintéticos originales, mismo probe:

| Fixture | maxRSS final (KiB) | Resultado |
|---|---:|---|
| 450000 sharedStrings | 111024 | valor `x` preservado |
| 900000 celdas | 68544 | `XLSX_LIMIT_COLUMNS` |

Comandos: `node <review>/vexa-parser-review-probe.mjs large-shared` y
`node <review>/vexa-parser-review-probe.mjs million-nodes`, ambos exit0.
Una medición previa durante esta implementación dio 128272/68576 KiB; la
variación de GC/proceso impide tratar una sola cifra como cota. Se mantiene la
reducción frente a los 454992 KiB históricos del parser original para shared
strings; no se volvió a medir aquel parser aquí. No OOM ni techo RSS universal
acreditado. Sólo se retiene un árbol de string/fila a la vez más resultados;
strings, filas de salida, buffers y metadatos todavía consumen memoria.

## Pendiente para recheck y límites de evidencia

Revisión independiente del código, restricciones de gramática, empaquetado y
recibo sobre los hashes exactos. Corpus real Excel/LibreOffice, Node22,
typecheck consumidor y fuzzing exhaustivo no ejecutados. Tampoco npm test global,
controller, graph, build web, DB/RLS, jobs, cloud ni producción. Los verdes locales
no cambian el estado formal ni autorizan adopción, publicación o aceptación.
