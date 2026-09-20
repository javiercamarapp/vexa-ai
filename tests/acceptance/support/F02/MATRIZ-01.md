# Matriz F02-01 para revisión independiente

Autoría final, NO revisión independiente, freeze ni aceptación. 59 casos: los39
heredados,18 ZIP/XML adversos/positivo,1 expansión observada y1 NFC.

| Grupo del gate | Comprobación | Evidencia actual |
|---|---|---|
| 39casos heredados (CSV/XLSX/stream) | Se conservan las39 pruebas; positivo de importe0 añadido a rechazos de amount | full-gate.log,59/59 en total |
| 50000 datos normalizados | cabecera excluida; dato50001 rechaza línea50002 | rows-normalized0/1/0 |
| Mensaje | ASCII2000/2001; emoji2000/2001; NFC de e+acento2000/2001 | message-limit,unicode,nfc0/1/0 |
| Amount inválido/fórmula | fila rechazada field amount, distinto de0 válido | invalid-zero,formula-zero0/1/0 |
| Cancelación/consumidor | CSV_CANCELLED, cierre, ninguna lectura extra, backpressure | cancel-ignored,cancel-close,break-close,backpressure0/1/0 |
| Aborto pendiente | error tipado antes de liberar next; return solicitado | pending-abort0/1/0 (código incorrecto, sin timeout) |
| Consumo al rechazar | tail sin leer tras exceso bytes/filas/campo/columnas | consumption0/1/0 (lectura adicional real) |
| ZIP mentiroso | declarado menor/mayor, cabeceras local/central coherentes, CRC correcto | declared-small/large + size-small/large0/1/0 |
| CRC | CRC cambiado igualmente en local/central; bytes sin alterar | crc0/1/0 |
| Duplicado | miembro hoja repetido con contenido OTHER; paquete original intacto | duplicate0/1/0 |
| Alias/escapes | ./,../,absoluta,backslash; relación ../../ y %2e%2e |6casos, path-alias0/1/0 |
| XML | DTD interna, SYSTEM https, SYSTEM file, entidad desconocida |4casos; sandbox sin red/archivos externos |
| Entidades permitidas | amp/lt/gt/quot/apos, decimal emoji, hexadecimal é | positivo producto + CRC/XML/XPath Python |
| ZIP64 | ZIP64 EOCD+locator válidos; celdas reales o rechazo XLSX_ZIP_UNSUPPORTED | Python zipfile confirma validez; prototipo rechaza tipado |
| Expansión real store/deflate | metadatos<100000, bytes reales>1MiB; rechazo XLSX_LIMIT_EXPANDED |2casos + validación independiente |
| Expansión antes de preflight | zlib observado en positivo,0 llamadas cuando central excede | pre-expansion0/1/0 |
| Tope durante expansión | cap de inflateRawSync<=presupuesto restante; ERR_BUFFER_TOO_LARGE real | actual-budget0/1/0, actual-expansion.log |

## Controles sobre la fuente real actual

Cada caso copia sólo index/csv/xlsx a TMP, verifica edición exacta, corre un único
caso en cada etapa y exige exit1+ERR_ASSERTION+mensaje específico. Restauración
repite la prueba con bytes originales. No se cuentan setup, sintaxis, timeout,
señal, ausencia de instrumentación ni un JSON de veredicto.

| Control | Defecto introducido / aserción específica | Exits OS |
|---|---|---|
| cancel-ignored | `STREAM_CANCEL_REASON` | 0 → 1 → 0 |
| backpressure | `STREAM_BACKPRESSURE` | 0 → 1 → 0 |
| nfc | `NFC_MESSAGE_LIMIT` | 0 → 1 → 0 |
| cancel-close | `STREAM_CANCEL_CLOSE` | 0 → 1 → 0 |
| break-close | `STREAM_BREAK_CLOSE` | 0 → 1 → 0 |
| pending-abort | `STREAM_PENDING_ABORT` | 0 → 1 → 0 |
| consumption | `STREAM_CONSUMPTION_CSV_LIMIT_BYTES` | 0 → 1 → 0 |
| rows-normalized | `DATA_ROW_OVERFLOW_REJECTED` | 0 → 1 → 0 |
| unicode | `MESSAGE_CODEPOINT_LIMIT` | 0 → 1 → 0 |
| message-limit | `MESSAGE_LIMIT_2000` | 0 → 1 → 0 |
| invalid-zero | `ACCOUNTING_AMOUNT_REJECTED` | 0 → 1 → 0 |
| formula-zero | `ACCOUNTING_AMOUNT_REJECTED` | 0 → 1 → 0 |
| pre-expansion | `XLSX_PREEXPANSION_NO_INFLATE` | 0 → 1 → 0 |
| crc | `ADVERSE_REJECT:crc` | 0 → 1 → 0 |
| size-small | `ADVERSE_REJECT:declared-small` | 0 → 1 → 0 |
| size-large | `ADVERSE_REJECT:declared-large` | 0 → 1 → 0 |
| duplicate | `ADVERSE_REJECT:duplicate` | 0 → 1 → 0 |
| path-alias | `ADVERSE_REJECT:alias-dot` | 0 → 1 → 0 |
| actual-budget | `ACTUAL_EXPANSION_CAP` | 0 → 1 → 0 |

Manifiesto: `evidence/close01/final-controls/prototype-controls.json`;
logs individuales `<id>-before/mutant/after.log`. Los sourceHash por etapa,
from/to y gateHash hacen la mutación revisable y reproducible.

## Evidencia heredada

Python `control-stream.mjs` y `control-xlsx.mjs`: **controlOnly=true**. Sus resultados
previos se preservan; no son producto ni se suman a59tests/19mutantes actuales.
Los7mutantes Node previos de01 usaron el banco anterior, no esta fuente. Los5de04
son historia preservada, sin ejecución ni autoría en este trabajo.

El control actual-budget se repitió tras precisar el log del descompresor: mismo0→1→0, en `evidence/close01/final-expansion-control/`; es el mismo control, no un mutante adicional.
